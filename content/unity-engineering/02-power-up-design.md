---
book: Unity Game Engineering
chapter: 02: Worked design of a power-up system
---

## Separate definitions, runtime state, and presentation {#powerup-data-model}

Separate a power-up's definition from its runtime state and presentation. The definition contains reusable design choices: a stable ID, duration, radius, icon, and stacking rule. Runtime state describes one activation in one run, including when it started, when it expires, and which entities it affects. Presentation controls what the player sees and hears.

In Unity, a [[ScriptableObject]] is a convenient asset for authoring the definition. Treat it as shared configuration: changing a field on the shared asset can affect every object that uses it. Keep changing values in a model owned by the run, or create a separate runtime instance and assign an owner to it. Editing a ScriptableObject in a deployed build does not provide a way to save player progress. [Unity's ScriptableObject manual](https://docs.unity3d.com/6000.0/Documentation/Manual/class-ScriptableObject.html) describes their shared asset role and persistence limitations.

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

Seeing the three layers for one effect at once makes the split easier to hold:

| Layer | Example content | Lifetime | Who may write it |
| --- | --- | --- | --- |
| Definition | `magnet`, 5 s, 4 m, refresh policy | Ships with the build | Content authors, offline |
| Runtime state | Expires at simulation time 42.0, affects run 7 | One run | The run that owns it |
| Presentation | Icon, fill amount, pickup sound | One view binding | The view, from state it reads |

Read the table downward when you design, and upward when you debug. A wrong radius is a definition problem. A radius that is correct in the Inspector but wrong for one player is a runtime state problem. A correct effect with a stuck icon is a presentation problem.

The Editor hides one asymmetry worth knowing before it costs you an afternoon. Changes written into a ScriptableObject asset during Play Mode can persist in the Editor after you stop, because the asset on disk was modified. The same code in a player build writes into a loaded copy that disappears with the process. A feature that appears to save correctly for weeks can therefore lose everything on the first device test. Treat any write to a shared asset at runtime as a mistake to find, rather than a storage mechanism to rely on.

Exercise: For one effect in a project you know, write the three rows of that table. Then name the file or object that holds each row, and say which of them a player build is allowed to modify.

?? powerup-shared-config Two players use the same magnet definition asset. Where should each player's expiration deadline live?
* In runtime state owned by that player's run or effect instance.
- On the shared definition asset, in a dictionary keyed by player id.
- In a static field on the effect component, indexed by player.
- On the HUD that displays the remaining time for that player.
- In `PlayerPrefs`, under a key built from the player id and the effect id.
> Shared definitions describe reusable content. Per-player deadlines need independently owned runtime state.

?+ A designer changes a shared definition's radius during a run. Which requirement must be decided before implementing the update?
* Whether active instances keep the values they started with, or adopt updated values at a specified point.
- Whether the change takes effect at the end of the current frame or the start of the next.
- Whether the new radius has to be written back to the player's save file.
- Whether the designer's edit should be blocked while the Editor is in Play Mode.
- Whether the HUD should keep showing the old radius until the effect expires.
> An active effect might keep a copy of its starting values, or read updated configuration. Decide which rule applies, so the effect and its display agree.

?? powerup-stable-id Why should a saved power-up ID differ from its display name?
* Localization and editorial renaming should not change persistent identity.
- An integer index compares faster than a string when looking up a definition.
- Display names can contain characters that the save format has to escape.
- The display name belongs to design, while the identifier belongs to engineering.
- Separate fields let the catalog be sorted by name and looked up by identifier.
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

The model answers questions; it does not announce anything. A small controller converts its answers into the single notification presentation needs:

```csharp
public sealed class EffectTicker
{
    private readonly RefreshingEffect effect;
    private bool wasActive;

    public EffectTicker(RefreshingEffect effect) => this.effect = effect;

    public event System.Action Expired;

    public void Tick(double now)
    {
        bool isActive = effect.IsActive(now);
        if (wasActive && !isActive)
            Expired?.Invoke();
        wasActive = isActive;
    }
}
```

The edge, not the state, is what deserves an event. Publishing on every tick where the effect is inactive would send the same notification for the rest of the run. Note also that `Tick` changes `wasActive`, so it is deliberately a command rather than a query; `IsActive` remains free of side effects.

The choice of `double` over `float` for time is worth stating, because it is a common follow-up. A `float` carries about seven significant decimal digits, so the spacing between representable values grows with the magnitude of the number. Near a simulation time of 3,600 seconds that spacing is roughly 0.00024 seconds; near 36,000 seconds it is roughly 0.004 seconds. A deadline compared against an accumulating `float` therefore becomes less exact the longer a session runs. A `double` keeps the spacing near this range far below anything gameplay can observe. Use `float` for positions and velocities, where its range and cost fit; prefer `double` for accumulated time and for money-like quantities you compare exactly.

Exercise: Write the two assertions that distinguish a strict deadline from an inclusive one, then decide which your design intends and where that intent is recorded.

?? powerup-deadline-boundary An effect activated at time 10 with duration 5 is active while `now < expiresAt`. What happens at time 15?
* It is expired.
- It is still active, because the comparison includes the deadline itself.
- It is still active for the remainder of the current simulation step.
- Whether it has expired depends on how far the clock advanced during this frame.
- It expires once `Remaining` has been called and returns zero.
> The deadline is 15 and the comparison is strict, so time 15 is the first expired boundary.

?+ The simulation clock freezes while paused. What happens to a deadline measured on that same clock?
* Its remaining gameplay duration stays unchanged.
- The remaining time keeps decreasing, because the deadline was stored as a number of seconds.
- The effect has expired by the time play resumes, because its deadline is now in the past.
- The remaining time is recalculated from the device clock when play resumes.
- The deadline has to be shifted by the pause duration before play resumes.
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

A small enum and an explicit branch are enough when the available policies are few and known in advance. A [[strategy]] interface becomes useful when policies are complex enough to implement separately, or come from different modules. A configurable expression language needs much more support: validation, repeatable evaluation, debugging tools, and compatibility rules.

When effects combine, the order in which you apply their kinds is itself a rule, and leaving it unstated produces values that differ between systems. Fix one pipeline and document it:

```text
effective = clamp(min, max, (base + sum of additive) * product of multiplicative)
```

With a base speed of 10, one additive bonus of +2, one multiplicative bonus of 1.5, and a cap of 18, that pipeline gives `(10 + 2) * 1.5 = 18`. Applying the multiplier first instead gives `10 * 1.5 + 2 = 17`. Neither is wrong as a design; only one can be the implementation, and the HUD preview must use the same one as the gameplay rule.

Decide separately what the cap limits. Clamping the effective value leaves the modifiers intact, so removing one still produces a sensible result. Clamping by discarding modifiers at the point of application is harder to undo, because the removal no longer knows what was dropped.

Exercise: Write the stacking policy your design uses as one sentence, then state what a second pickup does at each of these moments: while active, one frame after expiry, and while the run is paused.

Design exercise: Explain how a magnet and a double-score effect interact with death, revive, pause, and restart. Create a transition table before introducing an inheritance hierarchy.

?? powerup-extend-expired An effect expired at time 10. At time 100, a pickup extends it by 5 seconds. Which deadline matches the intended rule?
* 105, using the later of now and the existing deadline as the starting point.
- 15, because the extension adds its duration to the stored deadline.
- 100, because the deadline is reset to the moment the pickup was collected.
- 110, because the extension counts from the old deadline and from the current time.
- 5, because the effect restarts with the new duration measured from zero.
> Extension should start from the current deadline only while that deadline is still in the future. Otherwise it starts from now.

?+ An effect has 8 seconds remaining and a new pickup has duration 5. Under the chapter's refresh policy, how much time remains immediately afterward?
* 5 seconds.
- 13 seconds, adding the new duration to the time that remained.
- 8 seconds, because a refresh keeps whichever duration is longer.
- 3 seconds, because the new duration replaces the elapsed portion.
- 0 seconds, because a refresh restarts the effect from inactive.
> Refresh sets the deadline to now plus the new duration. Keeping the longer duration or adding time would be different stacking policies.

?? powerup-derived-modifiers Why derive effective speed from a base value and active modifiers?
* Removal and reordering remain consistent without relying on perfectly reversed arithmetic.
- Storing one effective value uses less memory than keeping the base and the modifier list.
- Recomputing on read removes the need to notify the display when a modifier changes.
- The effective value can be computed in the HUD, which keeps the gameplay model smaller.
- Dividing on removal needs floating-point arithmetic, which a derived value avoids.
> Derived state avoids cumulative mutation errors, but still needs a precise combination rule and an appropriate update strategy.

## Make collection idempotent and independent of animation {#powerup-collection}

A coin can be detected by a trigger, a proximity query, and an attraction animation in the same frame. The collection owner must recognize that these refer to one logical coin.

Give each spawned coin an identity that lasts for that spawn. A [[object pool|pooled]] GameObject may represent several different coins during one run, so its object identity alone is not enough. Combine a pool slot with a generation number, or assign a new spawn ID each time the object is taken from the pool.

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

The book keeps asking operations to return a result rather than a boolean, so it is worth showing what that result holds. A caller needs to know which outcome occurred, not merely whether it succeeded:

```csharp
public enum CollectOutcome
{
    Collected,
    AlreadyCollected,
    StaleGeneration,
    WrongRun,
    RejectedOverflow,
}

public readonly struct CollectResult
{
    public CollectOutcome Outcome { get; }
    public long Balance { get; }
    public int Awarded { get; }
}
```

Each outcome leads somewhere different. `Collected` plays the sound and animates the coin. `AlreadyCollected` is silent and normal, because a duplicate callback is expected. `StaleGeneration` and `WrongRun` are silent too, but a rise in either is worth investigating, because it means cleanup is leaving work behind. `RejectedOverflow` is a defect in validation upstream. A boolean would collapse all five into one branch, and the three you most want to see in a log would become invisible.

This also gives duplicate protection a cheap test. Call the operation twice with the same spawn identity and assert that the second call returns `AlreadyCollected` with an unchanged balance. That single assertion covers the repeated collider callback, the retried attraction, and the double tap.

Exercise: Trace one coin from spawn to committed reward, naming the owner at each step. Then repeat the trace with the coin despawning midway, and say which owner performs the cleanup.

?? powerup-pool-identity A pooled coin is despawned and reused before its old callback runs. What distinguishes the old logical coin from the new one?
* A spawn generation or unique identity captured when the old operation began.
- The index of the pool slot the coin was taken from.
- The component instance the callback was registered against.
- The position the coin occupied when the callback was registered.
- The time at which the attraction animation started.
> Reusing the object creates a new logical coin. Checking its generation prevents an old callback from collecting or rewarding the new coin.

?+ A repeated collection request refers to an already collected spawn ID. What should happen?
* Return the existing outcome or an already-collected result without adding currency.
- Add the reward, then subtract it again once the duplicate is detected.
- Log a warning and let the balance update proceed, since the coin was genuinely collected.
- Reject the request and clear the coin's entry, so a later retry can succeed.
- Queue the request until the first collection has finished saving.
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

Also test reset, invalid durations, and a clock that stops during pause. For collection, cover duplicate callbacks, a callback from an old spawn after [[object pool|pool]] reuse, overflow rejection, and a run restart. Check failures both before and after the reward is committed. Use [[Play Mode tests]] for the Unity adapter, where you can verify subscriptions during enable and disable, along with prefab behavior.

After checking correctness, measure the implementation on a target device with the largest expected number of active coins. Rule tests cannot tell you whether proximity queries, animation, or pool growth fit within the time available for a frame.

Be ready to explain why you rejected other approaches. One [[coroutine]] per power-up is simple for a single effect, but can spread pause and cancellation rules across several places. One controller owned by the run makes the order of those operations easier to see. A generic buff framework may help with dozens of interacting effects; for three independent power-ups, its extra complexity may bring little benefit.

Explain the model's limits as well. It does not save effects across app termination or synchronize them over a network. It also leaves the choice of a trusted time source to the caller. Supporting those requirements would need more state and integration code.

The hardest case in this chapter deserves a test of its own, because reasoning about it is unreliable. Pool reuse plus a late callback is only a few lines once the identity is explicit:

```csharp
[Test]
public void LateCallbackFromAPreviousSpawnDoesNotRewardTheNewCoin()
{
    var run = new RunCollection(runId: 7);
    var first = run.Spawn(slot: 3);      // generation 1
    run.Despawn(first);
    var second = run.Spawn(slot: 3);     // same slot, generation 2

    var late = run.Collect(first);       // the old callback finally arrives

    Assert.That(late.Outcome, Is.EqualTo(CollectOutcome.StaleGeneration));
    Assert.That(run.Collect(second).Outcome, Is.EqualTo(CollectOutcome.Collected));
}
```

The second assertion matters as much as the first. A fix that rejects every callback would pass the first line and quietly break the game, which is the regression trap described later under debugging.

Where a test needs both a controlled clock and a pool, supply both from the test rather than reaching for real time. Keeping the model free of engine types is what makes that possible, and it is the concrete payoff for the separation this chapter has been arguing for. If a rule cannot be tested without entering Play Mode, that is usually evidence that an engine dependency reached further into the rule than intended.

Exercise: Write the list of rule tests for this chapter's model from memory, then compare it with the cases named above and note which ones you forgot.

?? powerup-test-boundary Which test most directly detects an off-by-one expiration rule?
* Query activity immediately before and exactly at the deadline.
- Activate the effect and assert that it is still active one second later.
- Advance a real clock for the full duration and assert that the effect has ended.
- Assert that `Remaining` returns a positive value throughout the duration.
- Compare the deadline field with the sum of the activation time and the duration.
> Boundary tests distinguish strict and inclusive comparisons. Tests of implementation names do not establish behavior.

?? powerup-test-layers Why test both the plain model and the Unity adapter?
* The model's rules and the adapter's behavior in Unity can fail for different reasons.
- Play Mode tests run the same assertions under more realistic frame timing.
- Covering both layers raises the proportion of lines the suite exercises.
- The adapter tests confirm the model's arithmetic at real frame rates.
- Repeating the assertions catches a mistake in either test rather than in the code.
> Model tests check the rules with precise inputs. Unity tests check how those rules connect to components, including subscriptions, activation, and prefab references.
