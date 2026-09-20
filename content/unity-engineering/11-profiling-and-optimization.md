---
book: Unity Game Engineering
chapter: 11: Profiling CPU, GPU, and managed memory
---

## Define a frame budget and measure a distribution {#performance-frame-budget}

At 60 frames per second, a frame interval is approximately 16.67 milliseconds. At 30 FPS it is 33.33 ms; at 120 FPS it is 8.33 ms.

$$ \text{frame interval in ms} = \frac{1000}{\text{target FPS}} $$

The interval is not a promise that all of it is available for your feature. The engine, rendering submission, simulation, UI, audio, integrations, and scheduling share the device. Leave headroom for content spikes and sustained thermal conditions.

CPU and GPU work can overlap across frames. Do not add their measured durations as if they always execute serially. The limiting stage and synchronization determine throughput, while queued work also affects latency. Unity's [Profiler Highlights guide](https://docs.unity.com/en-us/engine/6000.0/manual/analysis/profiler/visualizing-data/highlights) explains the separate CPU and GPU frame budgets.

Average FPS hides hitches. Record frame-time percentiles and the frequency and duration of outliers. A p95 frame time of 20 ms means about 95% of measured frames are at or below 20 ms under the selected percentile definition. It does not describe the worst frame.

Make the workload repeatable: same device, build, quality level, camera path, entity count, content, and approximate thermal state. Include warm steady-state play, first use, scene transitions, and resume. A cold empty scene is not representative of a mature session.

Report units and conditions. “p95 main-thread active time decreased from 12.8 to 9.4 ms in a five-minute crowded-run capture on device X” is much more informative than “30% faster.” Example numbers in this book are hypothetical, not measured results from a shipped project.

?? performance-60-budget [short] What is the approximate frame interval at 60 FPS, in milliseconds? Give two decimal places.
= 16.67
> Dividing 1000 milliseconds by 60 frames gives approximately 16.67 milliseconds per frame.

?? performance-percentile Why can average FPS look healthy while gameplay visibly stutters?
* Occasional long frames can be hidden by many short frames in the average.
- Average FPS is always identical to the worst frame time.
- Stuttering can only happen below 10 FPS.
- Percentiles measure only texture resolution.
> Smoothness depends on frame-time consistency and outliers, not just average throughput.

?+ An optimization improves median frame time but adds a 200 ms hitch during every reward claim. What should the evaluation report?
* Both the median improvement and the new interaction-specific outlier.
- Only the median because it summarizes all player experience.
- Only average memory because frame time is now irrelevant.
- That the optimization is unconditionally successful.
> Distribution and scenario-specific regressions matter. A common interaction can become worse even when a central summary improves.

## Find the limiting stage before changing code {#performance-bottleneck}

Begin with the CPU timeline and available GPU timing. Determine whether the main thread performs expensive work, the render thread is busy submitting work, the GPU is saturated, or the application is waiting for synchronization or a frame cap.

A wait marker needs to be read alongside the work on other threads. For example, `Gfx.WaitForPresentOnGfxThread` can involve waiting related to the GPU or presentation pacing. Inspect simultaneous render-thread work and GPU measurements before declaring the game GPU-bound. [Unity's profiler marker reference](https://docs.unity.com/en-us/engine/6000.7/manual/analysis/profiler/markers) explains the relevant distinctions.

Use controlled experiments:

| Experiment | Evidence it may provide | Caveat |
| --- | --- | --- |
| Lower render resolution | Pixel work or bandwidth may dominate if GPU time falls | Not every GPU workload scales with resolution |
| Disable a measured AI subsystem | Its CPU contribution becomes visible | Removing it can change the scene workload |
| Hide a costly UI region | Reveals layout, rebuild, or overdraw cost | Hidden state may affect gameplay callbacks |
| Reduce shadow distance | Tests shadow workload | Visual quality changes must be assessed |

Instrument game-owned phases with `ProfilerMarker`. In this fragment, `EvaluateMissions` is a project-specific method:

```csharp
// using Unity.Profiling;
// private static readonly ProfilerMarker MissionTick =
//     new ProfilerMarker("Game.Missions.Evaluate");
//
// using (MissionTick.Auto())
// {
//     EvaluateMissions();
// }
```

Use deeper profiling selectively because instrumentation can alter timing. Start with representative captures and add detail where needed. Allocation call stacks, CPU timeline, Frame Debugger, and Memory Profiler answer different questions.

Reprofile after each optimization. Fixing a CPU bottleneck can expose the GPU as the new limit. An optimization that reduces one marker may not improve frame time if it was outside the critical path.

?? performance-wait-marker A frame contains a large graphics wait marker. What is the best next step?
* Inspect concurrent render-thread activity, GPU timing, and frame-pacing conditions.
- Assume the largest C# method caused it.
- Conclude the GPU is always saturated from the marker name alone.
- Force garbage collection every frame.
> Wait time must be interpreted in the pipeline context. Presentation caps and dependencies can resemble bottlenecks.

?? performance-resolution-test GPU time drops sharply when resolution is reduced. What hypothesis does this support?
* Pixel-related rendering work or bandwidth is a significant cost.
- The mission evaluator is necessarily quadratic.
- Every allocation has disappeared.
- All device thermal effects are irrelevant.
> Resolution experiments can implicate pixel-scaled work, but further inspection is needed to identify the specific passes.

## Reduce repeated work before micro-optimizing instructions {#performance-cpu-work}

First look for work that does not need to run. Update a score label when its displayed value changes. Recalculate a path when relevant state changes. Evaluate mission types that can react to the current event.

Consider frequency and scope. A 0.02 ms operation seems small, but running it for 1,000 entities consumes 20 ms if costs scale linearly. Conversely, replacing a readable operation that runs once at startup may have no player-visible benefit.

Cache stable component references where repeated lookups appear in hot paths. The cache must remain valid if components or bindings change. Avoid repeated whole-scene discovery as an implicit dependency mechanism.

Centralized update lists can reduce the overhead of many tiny component callbacks and allow staggered work, but they need registration and iteration rules. Removing an item during iteration can skip work or invalidate an enumerator. Specify whether changes take effect immediately or at the next phase.

Physics costs respond to active body count, contact complexity, solver settings, query frequency, layer interactions, and timestep. Prefer filtering irrelevant collisions and reducing unnecessary work before globally lowering simulation quality. A longer fixed timestep reduces update frequency but can change responsiveness and collision behavior.

Animation and UI also consume CPU. Large numbers of active animators, layout recalculations, and frequently changing text can dominate a seemingly simple scene. Do not restrict investigation to gameplay scripts.

Use complexity improvements when scale warrants them. Replacing a repeated full scan with an index is useful only if update and invalidation costs remain acceptable. Keep a correctness test for the optimized path and compare it against the simple reference implementation on representative inputs.

?? performance-work-frequency An operation costs 0.02 ms and runs serially for 1,000 entities. What is its approximate total cost?
* 20 ms.
- 0.02 ms.
- 0.2 ms.
- 2,000 ms.
> Repeated cost multiplies by the number of executions. Small per-entity work can exceed an entire frame budget at scale.

?? performance-ui-updates What is a useful first optimization for a score label rebuilt every frame despite an unchanged displayed score?
* Update it only when the displayed value changes.
- Convert the whole UI into a physics simulation.
- Allocate a new string builder every frame regardless of need.
- Disable all gameplay events.
> Avoiding unnecessary rebuilds and formatting addresses the actual repeated work while preserving presentation.

## Allocation traffic, retained memory, and garbage collection {#performance-gc}

Allocation rate and retained memory are different. Temporary strings may create high allocation traffic but become unreachable quickly. A static collection can retain a large graph with little ongoing allocation. Investigate both.

Unity's garbage collector reclaims unreachable managed objects. The exact runtime and platform behavior is version-dependent. Incremental collection spreads work over frames; it does not make allocations free or remove the total tracing cost. [Unity's incremental collection guide](https://docs.unity.cn/Manual/performance-incremental-garbage-collection.html) explains that tradeoff.

Use allocation call stacks to locate hot sources. Candidates include string formatting, closure captures, boxing, iterator creation, temporary collections, and APIs that return a fresh array. Check how often these operations run and what they allocate in the player before choosing one to optimize.

Reuse caller-owned buffers when appropriate. Pre-size collections before gameplay when a realistic bound exists. Avoid repeatedly accessing an array-returning property inside a loop; fetch once or use a supported caller-supplied collection API. Unity's [array optimization guide](https://docs.unity.com/en-us/engine/6000.0/manual/scripting/optimization/performance-optimizing-code-managed-memory/arrays) discusses such copying costs.

Reusing a buffer can retain references to large objects unless its used elements are cleared according to the container's behavior. A buffer that grows to a rare extreme can also retain that capacity indefinitely. Set retention and trimming policies at safe boundaries.

Do not treat manually forcing collection every frame as a general fix. It introduces collection work and can worsen pacing. Disabling collection similarly requires a tightly bounded allocation plan; otherwise unreachable objects accumulate.

Measure in a representative player. Editor-only allocations can distract from player behavior, while native and graphics allocations do not appear as ordinary `GC.Alloc`. Zero managed allocation in a marker does not mean zero memory cost.

?? performance-allocation-retention Which symptom suggests retention rather than merely temporary allocation traffic?
* Objects remain reachable after their intended lifetime and repeated feature cycles increase retained memory.
- A short-lived string is allocated once during startup.
- A profiler marker has a descriptive name.
- A timer uses a double rather than a float.
> Retention concerns objects that stay reachable. Allocation rate concerns how much new managed memory is requested over time.

?+ Opening and closing a screen stops allocating after pool warm-up, but a static event retains every closed presenter. What problem remains?
* A retention and subscription-lifetime defect despite low ongoing allocation.
- No problem, because zero per-frame allocation proves no leak.
- A guaranteed GPU bottleneck caused by hashing.
- A missing random seed.
> Allocation traffic can be low while unintended live references accumulate. Trace ownership and subscriptions as well as GC.Alloc.

?? performance-incremental-gc [tf] Incremental garbage collection eliminates the total work of tracing live managed objects.
* false
> Incremental collection distributes work to reduce long pauses. It does not remove the need to inspect managed reachability.

## Pooling trades creation cost for lifecycle complexity {#performance-pooling}

Pooling reuses objects instead of repeatedly creating and destroying them. It can reduce allocation and initialization spikes for bullets, particles, and transient UI. It also keeps memory resident and makes reset correctness essential.

Define the pool contract:

1. Who owns the pool and when is it disposed?
2. What is reset on checkout and return?
3. What happens when no inactive object is available?
4. What is the maximum retained capacity?
5. How is double return detected?
6. How are outstanding asynchronous operations invalidated?

A pooled projectile may need velocity, damage source, collision state, lifetime, trail history, audio state, transform, subscriptions, and generation reset. Turning the GameObject off does not reset arbitrary fields.

Prewarming moves cost earlier; it does not erase it. A pool prewarmed for the theoretical maximum can make startup slow and exceed memory budgets. Measure ordinary and burst occupancy, then choose an explicit cap and growth policy.

Compare before and after. If the original bottleneck was GPU overdraw from too many particles, pooling those particles may leave the bottleneck unchanged while increasing memory. If prefab instantiation caused the hitch, pooling may help directly.

A hypothetical investigation might find that a reward celebration creates 200 identical objects in one frame. A bounded prewarmed pool reduces creation spikes, and staggered animation keeps peak active count controlled. Validation should include repeated celebrations, interruption by scene unload, low-memory conditions, and the pool's retained memory.

A rarely opened, resource-heavy screen may be better released between uses. Reuse is beneficial only when its saved work outweighs retained resources and complexity.

?? performance-pool-bottleneck Why might pooling a particle effect fail to improve frame time?
* The dominant cost may be rendering the active particles rather than creating them.
- Pools always reduce GPU overdraw automatically.
- Pooled objects never consume memory.
- Every hitch is caused by managed object creation.
> Pooling addresses creation and reuse costs. It does not inherently reduce the work of simulating or rendering active objects.

?? performance-pool-contract [multi n=5] Which policies belong in a production pool contract?
* Reset and cleanup at lease boundaries.
* Capacity and exhaustion behavior.
* Protection against stale work or double return.
- A guarantee that all pooled objects consume no memory.
- A rule that every feature must use the same global pool.
> A pool is an ownership and reuse mechanism. Capacity, reset, identity, and release rules determine whether it remains correct under stress.
