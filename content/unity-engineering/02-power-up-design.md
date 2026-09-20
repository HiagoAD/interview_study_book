---
book: Unity Game Engineering
chapter: 02: Worked design of a power-up system
---

## Separate definitions, runtime state, and presentation {#powerup-data-model}

A power-up has at least three forms of data. Its definition describes reusable design choices: stable ID, duration, radius, icon, and stacking rule. Its runtime state describes one use in one run: activation time, expiration, and affected entities. Its presentation describes what the player sees and hears.

In Unity, a ScriptableObject is a convenient authoring asset for the definition. Treat that asset as shared configuration. Changing a runtime field on one shared definition can affect every consumer of that asset. Copy values into a run-owned model, or create a deliberate runtime instance with a clear owner. A deployed build does not turn ScriptableObject edits into a player-save system. [Unity's ScriptableObject manual](https://docs.unity3d.com/6000.0/Documentation/Manual/class-ScriptableObject.html) describes their shared asset role and persistence limitations.

The rule layer can use this plain C# definition:

```csharp
using System;

public sealed class MagnetDefinition
{
    public string Id { get; }
    public double Duration { get; }
    public float Radius { get; }

    public MagnetDefinition(string id, double duration, float radius)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("An ID is required.", nameof(id));
        if (double.IsNaN(duration) || double.IsInfinity(duration) || duration <= 0)
            throw new ArgumentOutOfRangeException(nameof(duration));
        if (float.IsNaN(radius) || float.IsInfinity(radius) || radius <= 0)
            throw new ArgumentOutOfRangeException(nameof(radius));

        Id = id;
        Duration = duration;
        Radius = radius;
    }
}
```

This example validates programmer or content-author errors at construction. A production content importer should collect and report all invalid definitions with their asset locations, rather than discovering them halfway through a run.

The current player, collider, active flag, and remaining time belong to each running instance, so they are absent from the definition. Stable IDs also differ from display names. Renaming “Super Magnet” in a translation should not invalidate progress or save references.

Convert Unity authoring assets to validated runtime definitions at a controlled boundary. This allows rule tests to use ordinary C# values while artists and designers keep Inspector workflows.

?? powerup-shared-config Two players use the same magnet definition asset. Where should each player's expiration deadline live?
* In runtime state owned by that player's run or effect instance.
- In one mutable field on the shared asset.
- In the icon's animation state.
- In the translated display name.
> Shared definitions describe reusable content. Per-player deadlines need independently owned runtime state.

?+ A designer changes a shared definition's radius during a run. Which requirement must be decided before implementing the update?
* Whether active instances capture their starting definition or adopt changes at a defined boundary.
- Whether radius should become the player's persistent identity.
- Whether all runtime state should now move into the shared asset.
- Whether the HUD should independently choose its own radius.
> Shared configuration and runtime snapshots have different update semantics. Choose a policy so active behavior and presentation remain consistent.

?? powerup-stable-id Why should a saved power-up ID differ from its display name?
* Localization and editorial renaming should not change persistent identity.
- IDs must always be random every time the game starts.
- Display names cannot contain spaces.
- Stable IDs remove the need for content validation.
> Persistent references require stable identity. A display name is presentation and may change without changing what the item represents.

## Implement expiration with an explicit time contract {#powerup-expiration}

Use a gameplay simulation clock for an effect that pauses with the run. Use a monotonic real-time source for an elapsed operation that should continue during pause. Use a trusted absolute-time policy for an online event deadline. A single global “time” service can conceal which of these rules an operation follows.

The following complete plain C# model implements refresh semantics. Activating an already active effect sets its deadline to now plus the duration. Time is supplied by the caller and must be finite, nonnegative, and nondecreasing over this model's run. The effect expires at the deadline.

```csharp
using System;

public sealed class RefreshingEffect
{
    private bool activated;
    private double expiresAt;

    public void Activate(double now, double duration)
    {
        ValidateTime(now);
        if (double.IsNaN(duration) || double.IsInfinity(duration) || duration <= 0)
            throw new ArgumentOutOfRangeException(nameof(duration));
        double deadline = now + duration;
        if (double.IsInfinity(deadline))
            throw new ArgumentOutOfRangeException(nameof(duration));

        expiresAt = deadline;
        activated = true;
    }

    public bool IsActive(double now)
    {
        ValidateTime(now);
        return activated && now < expiresAt;
    }

    public double Remaining(double now)
    {
        ValidateTime(now);
        return activated ? Math.Max(0, expiresAt - now) : 0;
    }

    public void Reset()
    {
        activated = false;
        expiresAt = 0;
    }

    private static void ValidateTime(double now)
    {
        if (double.IsNaN(now) || double.IsInfinity(now) || now < 0)
            throw new ArgumentOutOfRangeException(nameof(now));
    }
}
```

A deadline avoids subtracting frame delta in multiple places. However, it does not solve clock selection: a deadline on a clock that continues during pause still expires during pause. The owner must provide the correct clock and enforce monotonicity. The model validates the numeric domain but does not track previous calls to detect a backward clock.

Polling `IsActive` does not emit an expiration event. If presentation needs exactly one expiration notification, a controller can compare the previous active state with the new one at its tick boundary. Define whether that notification occurs immediately on a query, during the next simulation tick, or only when explicit advancement happens. Avoid hidden state changes in a property-like query.

?? powerup-deadline-boundary An effect activated at time 10 with duration 5 is active while `now < expiresAt`. What happens at time 15?
* It is expired.
- It has exactly one more frame of guaranteed activity.
- It refreshes automatically.
- It remains active until wall-clock midnight.
> The deadline is 15 and the comparison is strict, so time 15 is the first expired boundary.

?+ The simulation clock freezes while paused. What happens to a deadline measured on that same clock?
* Its remaining gameplay duration stays unchanged.
- It loses time according to the device's calendar clock.
- It doubles because there are fewer frames.
- It must be moved to a ScriptableObject.
> A deadline and its current-time value must use the same clock domain. A frozen simulation clock preserves remaining gameplay duration.

?? powerup-time-contract [tf] Validating that a time value is finite also proves that it never moved backward.
* false
> Numeric validation and monotonicity are separate properties. Detecting a backward clock requires comparing values or trusting an explicitly enforced clock contract.

## Define stacking as a gameplay policy {#powerup-stacking}

“Stacking” can mean several incompatible rules:

| Policy | Second activation while active | Typical concern |
| --- | --- | --- |
| Ignore | Keep the existing effect | The pickup may feel wasted |
| Refresh | Set remaining time to the new duration | A shorter new duration can shorten the effect |
| Extend | Add duration to the current deadline | Repeated pickups can create very long effects |
| Strongest wins | Keep the strongest intensity | Define how duration relates to strength |
| Independent instances | Track each activation separately | More state and aggregation work |

For extend semantics, use `max(now, expiresAt) + duration`, rather than always adding to an expired deadline. If the deadline is 10 and the new activation arrives at 100, adding 5 to 10 would produce an effect that is already expired. Apply a design cap if intended, and define whether the cap applies to remaining duration or lifetime since first activation.

For intensity aggregation, order matters. Two bonuses of 20% can mean addition, giving 1.4 times the base value, or multiplication, giving 1.44. A “strongest wins” policy gives 1.2. Record the rule and its interaction with debuffs, rounding, and caps.

Avoid applying reversible modifiers as repeated arithmetic on a shared property. Multiplying speed on activation and dividing it on removal can fail after rounding, base-stat changes, or duplicate cleanup. Instead, retain the base value and active modifiers, then derive the effective value using the chosen aggregation rule.

Use a small enum and explicit branch when the policy set is closed and compact. Use a strategy interface when policies are independently complex or supplied by different modules. A configurable expression language is an expensive option: it needs validation, deterministic evaluation, debugging tools, and compatibility rules.

Design exercise: Explain how a magnet and a double-score effect interact with death, revive, pause, and restart. Create a transition table before introducing an inheritance hierarchy.

?? powerup-extend-expired An effect expired at time 10. At time 100, a pickup extends it by 5 seconds. Which deadline matches the intended rule?
* 105, using the later of now and the existing deadline as the starting point.
- 15, because every extension must start at the old deadline.
- 100, because expired effects cannot be reactivated.
- 500, because duration multiplies the current time.
> Extension should start from the current deadline only while that deadline is still in the future. Otherwise it starts from now.

?+ An effect has 8 seconds remaining and a new pickup has duration 5. Under the chapter's refresh policy, how much time remains immediately afterward?
* 5 seconds.
- 13 seconds.
- 8 seconds.
- 40 seconds.
> Refresh sets the deadline to now plus the new duration. Keeping the longer duration or adding time would be different stacking policies.

?? powerup-derived-modifiers Why derive effective speed from a base value and active modifiers?
* Removal and reordering remain consistent without relying on perfectly reversed arithmetic.
- Multiplication is forbidden in Unity.
- All modifiers then become allocation-free automatically.
- A derived value eliminates the need to define stacking rules.
> Derived state avoids cumulative mutation errors, but still needs a precise combination rule and an appropriate update strategy.

## Make collection idempotent and independent of animation {#powerup-collection}

A coin can be detected by a trigger, a proximity query, and an attraction animation in the same frame. The collection owner must recognize that these refer to one logical coin.

Give each spawned coin an identity valid for its lifetime. A pooled GameObject's instance identity alone is insufficient if the same object represents several logical coins over a run. Pair a slot with a generation, or allocate a new spawn ID on every checkout.

A coin can follow these transitions:

```text
Available -> Attracting -> Collected
Available -> Collected
Available or Attracting -> Despawned
```

Decide when the reward is earned. If collection commits at arrival, attraction can still be cancelled before arrival. If collection commits when attraction starts, later visuals are a presentation of an already earned reward. Both policies can work; mixing them produces missing or duplicate currency.

For a small single-threaded local model, the collection operation can validate the run ID, look up the coin's generation and state, calculate the new balance with overflow checks, then commit both balance and collected state without invoking external callbacks in between. A duplicate returns an “already collected” result. The return value describes the authoritative outcome; observers animate afterward.

Do not mark the coin collected and then call an arbitrary reward service that can fail without defining recovery. Either keep the two changes in one owned transaction or model a pending operation with an idempotency key and a retryable reward contract. A remote wallet requires its own authoritative transaction; a local set of IDs cannot provide server durability.

Cleanup also follows identity. A callback from an old attraction should carry the captured spawn generation. If the pooled object has since been reused, discard the old callback rather than rewarding the new coin.

?? powerup-pool-identity A pooled coin is despawned and reused before its old callback runs. What distinguishes the old logical coin from the new one?
* A spawn generation or unique identity captured when the old operation began.
- The unchanged GameObject reference alone.
- The current material color.
- The frame rate at which the callback runs.
> Pool reuse preserves the object while changing its logical identity. A generation check prevents old work from acting on a new occupant.

?+ A repeated collection request refers to an already collected spawn ID. What should happen?
* Return the existing outcome or an already-collected result without adding currency.
- Award currency again because each callback is a new request.
- Create a replacement coin automatically.
- Deduct the previous reward to balance the duplicate.
> Idempotency is defined by logical identity. Repeating the same collection must not apply another reward.

## Test boundaries and defend the design {#powerup-test-matrix}

Test the model at transitions rather than only after a typical pickup. For the expiration example, useful NUnit-style tests are:

```csharp
using NUnit.Framework;

public sealed class RefreshingEffectTests
{
    [Test]
    public void ExpiresAtTheExactDeadline()
    {
        var effect = new RefreshingEffect();
        effect.Activate(10, 5);
        Assert.That(effect.IsActive(14.999), Is.True);
        Assert.That(effect.IsActive(15), Is.False);
        Assert.That(effect.Remaining(16), Is.EqualTo(0));
    }

    [Test]
    public void RefreshUsesTheNewActivationTime()
    {
        var effect = new RefreshingEffect();
        effect.Activate(10, 5);
        effect.Activate(12, 5);
        Assert.That(effect.Remaining(12), Is.EqualTo(5));
        Assert.That(effect.IsActive(17), Is.False);
    }
}
```

These examples require the earlier model and a test assembly with NUnit available. They demonstrate rule tests, not a complete Unity test setup.

Add reset, invalid duration, and pause-clock tests. For collection, test duplicate callbacks, an old generation after reuse, overflow rejection, run restart, and failure before versus after commitment. For the adapter, use Play Mode tests to verify enable/disable binding and prefab behavior.

Then measure the implementation with the maximum expected active coin population on a target device. Pure correctness tests do not establish that proximity queries, animation, or pool growth meet the frame budget.

Be prepared to explain rejected alternatives. A coroutine per power-up is simple for one effect, but it can scatter pause and cancellation rules. A single run-owned controller makes ordering visible. A full generic buff framework may be justified by dozens of interacting effects, but adds little value if the current game has three independent power-ups.

State the remaining limitations. The example model does not persist effects across app termination, synchronize them over a network, or implement a universal time authority. Those requirements would need additional state and integration beyond this model.

?? powerup-test-boundary Which test most directly detects an off-by-one expiration rule?
* Query activity immediately before and exactly at the deadline.
- Check that the icon has the expected color.
- Run only a long random play session.
- Assert that the class contains a field named `expiresAt`.
> Boundary tests distinguish strict and inclusive comparisons. Tests of implementation names do not establish behavior.

?? powerup-test-layers Why test both the plain model and the Unity adapter?
* Rule correctness and engine lifecycle integration are different failure surfaces.
- Passing either test suite automatically proves performance.
- Play Mode tests cannot inspect gameplay behavior.
- Plain C# tests require all scene assets to load first.
> Fast model tests cover policy precisely; engine tests cover binding, activation, prefab wiring, and other integration behavior.
