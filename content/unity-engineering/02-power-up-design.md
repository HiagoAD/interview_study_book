---
book: Unity Game Engineering
chapter: 02: Worked design of a power-up system
---

## Separate definitions, runtime state, and presentation {#powerup-data-model}

Separate a power-up's definition from its runtime state and presentation. The definition contains reusable design choices: a stable ID, duration, radius, icon, and stacking rule. Runtime state describes one activation in one run, including when it started, when it expires, and which entities it affects. Presentation controls what the player sees and hears.

In Unity, a ScriptableObject is a convenient asset for authoring the definition. Treat it as shared configuration: changing a field on the shared asset can affect every object that uses it. Keep changing values in a model owned by the run, or create a separate runtime instance and assign an owner to it. Editing a ScriptableObject in a deployed build does not provide a way to save player progress. [Unity's ScriptableObject manual](https://docs.unity3d.com/6000.0/Documentation/Manual/class-ScriptableObject.html) describes their shared asset role and persistence limitations.

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

The constructor catches invalid values supplied by a programmer or content author. In a production project, the content importer should check all definitions and report each error with its asset location. That lets the team fix the content before a player encounters it during a run.

Each running instance owns its current player, collider, active flag, and remaining time. Those fields therefore do not belong in the shared definition. Keep stable IDs separate from display names, too: translating or renaming “Super Magnet” should not break saved references or reset progress.

Choose a specific point at which Unity authoring assets become validated runtime definitions. Rule tests can then use ordinary C# values, while artists and designers continue editing assets in the Inspector.

?? powerup-shared-config Two players use the same magnet definition asset. Where should each player's expiration deadline live?
* In runtime state owned by that player's run or effect instance.
- In one mutable field on the shared asset.
- In the icon's animation state.
- In the translated display name.
> Shared definitions describe reusable content. Per-player deadlines need independently owned runtime state.

?+ A designer changes a shared definition's radius during a run. Which requirement must be decided before implementing the update?
* Whether active instances keep the values they started with, or adopt updated values at a specified point.
- Whether radius should become the player's persistent identity.
- Whether all runtime state should now move into the shared asset.
- Whether the HUD should independently choose its own radius.
> An active effect might keep a copy of its starting values, or read updated configuration. Decide which rule applies, so the effect and its display agree.

?? powerup-stable-id Why should a saved power-up ID differ from its display name?
* Localization and editorial renaming should not change persistent identity.
- IDs must always be random every time the game starts.
- Display names cannot contain spaces.
- Stable IDs remove the need for content validation.
> Persistent references require stable identity. A display name is presentation and may change without changing what the item represents.

## Implement expiration with an explicit time contract {#powerup-expiration}

Choose the clock according to what the timer means. An effect that pauses with the run needs gameplay simulation time. An operation that continues during pause needs an elapsed-time source that never moves backward, called a monotonic clock. An online event deadline needs an absolute-time policy based on a trusted source. A single global “time” service can hide these differences.

The following plain C# model implements a refresh rule: activating an effect again sets its deadline to the current time plus the new duration. The caller supplies time. During a run, that value must be finite, nonnegative, and must never move backward. The effect expires exactly at its deadline.

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

Storing a deadline avoids subtracting a frame's elapsed time in several places. You still have to choose the right clock: if that clock keeps advancing during pause, the effect will expire during pause too. The owner must supply the correct clock and ensure that it never moves backward. The model checks whether a time value is valid, but does not remember previous calls to detect time going backward.

Calling `IsActive` only checks the state; it does not send an expiration event. If presentation needs one notification when the effect expires, a controller can compare the previous and current active states during a simulation tick. Decide when that notification should occur: immediately during a query, on the next tick, or when an explicit advance operation runs. Keep any state changes visible in the API, so a call that looks like a simple query does not unexpectedly change the model.

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
> Measure the deadline and the current time with the same clock. When that clock stops, the remaining gameplay duration stays the same.

?? powerup-time-contract [tf] Validating that a time value is finite also proves that it never moved backward.
* false
> A valid number may still be smaller than the previous time value. To detect time going backward, compare successive values or rely on a clock that explicitly guarantees this cannot happen.

## Define stacking as a gameplay policy {#powerup-stacking}

“Stacking” can mean several incompatible rules:

| Policy | Second activation while active | Typical concern |
| --- | --- | --- |
| Ignore | Keep the existing effect | The pickup may feel wasted |
| Refresh | Set remaining time to the new duration | A shorter new duration can shorten the effect |
| Extend | Add duration to the current deadline | Repeated pickups can create very long effects |
| Strongest wins | Keep the strongest intensity | Define how duration relates to strength |
| Independent instances | Track each activation separately | More state and aggregation work |

To extend an effect, use `max(now, expiresAt) + duration`. This starts from the existing deadline if the effect is still active, or from now if it has expired. Suppose the old deadline is 10 and another pickup arrives at time 100: adding 5 to the old deadline would give 15, which is already in the past. If the design caps duration, specify what the cap limits: time remaining, or total lifetime since the first activation.

When combining effect strengths, define the arithmetic. Two 20% bonuses give 1.4 times the base value if you add them, or 1.44 times if you multiply them. A “strongest wins” policy gives 1.2. Also specify how the rule handles debuffs, rounding, and caps.

Keep the base value and the active modifiers, then calculate the effective value from them. Multiplying a shared speed property on activation and dividing it on removal is easy to get wrong: rounding, a changed base speed, or duplicate cleanup can prevent the value from being restored. Calculating from the current base and modifiers avoids relying on perfectly reversed arithmetic.

A small enum and an explicit branch are enough when the available policies are few and known in advance. A strategy interface becomes useful when policies are complex enough to implement separately, or come from different modules. A configurable expression language needs much more support: validation, repeatable evaluation, debugging tools, and compatibility rules.

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

Give each spawned coin an identity that lasts for that spawn. A pooled GameObject may represent several different coins during one run, so its object identity alone is not enough. Combine a pool slot with a generation number, or assign a new spawn ID each time the object is taken from the pool.

A coin can follow these transitions:

```text
Available -> Attracting -> Collected
Available -> Collected
Available or Attracting -> Despawned
```

Decide exactly when the player earns the reward. If it is committed when the coin arrives, attraction can still be cancelled before arrival. If it is committed when attraction starts, the animation shows a reward the player has already earned. Either policy can work. Mixing the two can cause currency to be lost or granted twice.

In a small local model that runs on one thread, begin by checking the run ID and the coin's generation and state. Then calculate the new balance, checking for overflow. Commit the balance and collected state together, with no external callbacks between those changes. A duplicate request returns an “already collected” result. The return value tells the caller what happened; observers can animate the result afterward.

If you mark the coin as collected before calling a reward service, decide how to recover when that service fails. One option is to commit collection and reward together in a single transaction. Another is to record a pending operation with a stable ID, then let retries of that ID safely recover the reward result. A remote wallet needs its own authoritative transaction; keeping a set of IDs locally cannot guarantee that the server saved the reward.

Cleanup must check the coin's identity too. Capture the spawn generation when attraction begins, and include it in the callback. If the pooled object has been reused by the time the callback runs, discard the old callback so it cannot reward the new coin.

?? powerup-pool-identity A pooled coin is despawned and reused before its old callback runs. What distinguishes the old logical coin from the new one?
* A spawn generation or unique identity captured when the old operation began.
- The unchanged GameObject reference alone.
- The current material color.
- The frame rate at which the callback runs.
> Reusing the object creates a new logical coin. Checking its generation prevents an old callback from collecting or rewarding the new coin.

?+ A repeated collection request refers to an already collected spawn ID. What should happen?
* Return the existing outcome or an already-collected result without adding currency.
- Award currency again because each callback is a new request.
- Create a replacement coin automatically.
- Deduct the previous reward to balance the duplicate.
> Idempotency is defined by logical identity. Repeating the same collection must not apply another reward.

## Test boundaries and defend the design {#powerup-test-matrix}

Test what happens as the model changes state, including the exact point at which an effect expires. A normal pickup test alone can miss these cases. The expiration model can be checked with the following NUnit-style tests:

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

Also test reset, invalid durations, and a clock that stops during pause. For collection, cover duplicate callbacks, a callback from an old spawn after pool reuse, overflow rejection, and a run restart. Check failures both before and after the reward is committed. Use Play Mode tests for the Unity adapter, where you can verify subscriptions during enable and disable, along with prefab behavior.

After checking correctness, measure the implementation on a target device with the largest expected number of active coins. Rule tests cannot tell you whether proximity queries, animation, or pool growth fit within the time available for a frame.

Be ready to explain why you rejected other approaches. One coroutine per power-up is simple for a single effect, but can spread pause and cancellation rules across several places. One controller owned by the run makes the order of those operations easier to see. A generic buff framework may help with dozens of interacting effects; for three independent power-ups, its extra complexity may bring little benefit.

Explain the model's limits as well. It does not save effects across app termination or synchronize them over a network. It also leaves the choice of a trusted time source to the caller. Supporting those requirements would need more state and integration code.

?? powerup-test-boundary Which test most directly detects an off-by-one expiration rule?
* Query activity immediately before and exactly at the deadline.
- Check that the icon has the expected color.
- Run only a long random play session.
- Assert that the class contains a field named `expiresAt`.
> Boundary tests distinguish strict and inclusive comparisons. Tests of implementation names do not establish behavior.

?? powerup-test-layers Why test both the plain model and the Unity adapter?
* The model's rules and the adapter's behavior in Unity can fail for different reasons.
- Passing either test suite automatically proves performance.
- Play Mode tests cannot inspect gameplay behavior.
- Plain C# tests require all scene assets to load first.
> Model tests check the rules with precise inputs. Unity tests check how those rules connect to components, including subscriptions, activation, and prefab references.
