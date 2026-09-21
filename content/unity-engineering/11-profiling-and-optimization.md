---
book: Unity Game Engineering
chapter: 11: Profiling CPU, GPU, and managed memory
---

## Define a frame budget and measure a distribution {#performance-frame-budget}

At 60 frames per second, a frame interval is approximately 16.67 milliseconds. At 30 FPS it is 33.33 ms; at 120 FPS it is 8.33 ms.

$$ \text{frame interval in ms} = \frac{1000}{\text{target FPS}} $$

Your feature cannot use the entire frame interval. Simulation, rendering submission, UI, audio, integrations, engine work, and scheduling all share the device. Leave room for unusually busy content and for performance to fall as the device heats up.

CPU and GPU work can overlap across frames, so adding their durations does not necessarily give total frame time. Throughput depends on the slowest stage and on where stages wait for one another. Queued work also affects how quickly input reaches the display. Unity's [Profiler Highlights guide](https://docs.unity.com/en-us/engine/6000.0/manual/analysis/profiler/visualizing-data/highlights) explains the separate CPU and GPU frame budgets.

An average FPS value can hide occasional hitches. Record frame-time percentiles, along with how often long frames occur and how long they last. Under the chosen percentile definition, a p95 of 20 ms means about 95% of measured frames took no more than 20 ms. The worst frame may be much longer.

Make captures repeatable. Keep the device, build, quality level, camera path, entity count, and content the same, with a similar thermal state. Include sustained play, first use of effects, scene transitions, and resume. An empty scene on a cold device does not represent a busy session after several minutes.

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
* Both the improved median and the new 200 ms hitch during reward claims.
- Only the median because it summarizes all player experience.
- Only average memory because frame time is now irrelevant.
- That the optimization is unconditionally successful.
> A better median does not cancel out a new hitch in a common interaction. Report how frame times changed and which scenarios became worse.

## Find the limiting stage before changing code {#performance-bottleneck}

Start with the CPU timeline and any available GPU timings. Determine where the frame is being held up: main-thread computation, render-thread submission, GPU work, synchronization, or a frame-rate limit. That tells you which kind of change is likely to help.

Read a wait marker alongside the work happening on other threads. `Gfx.WaitForPresentOnGfxThread`, for example, can involve waiting for the GPU or for presentation timing. Compare render-thread activity and GPU measurements before concluding that the GPU is the bottleneck. [Unity's profiler marker reference](https://docs.unity.com/en-us/engine/6000.7/manual/analysis/profiler/markers) explains these distinctions.

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

Add detailed profiling where you need it, because instrumentation can change timing. Begin with representative captures, then investigate the expensive area. Allocation call stacks, the CPU timeline, Frame Debugger, and Memory Profiler each answer different questions.

Measure again after every optimization. Reducing a CPU bottleneck may expose the GPU as the next limit. Making one marker shorter may have no effect on frame time if other work was determining when the frame could finish.

?? performance-wait-marker A frame contains a large graphics wait marker. What is the best next step?
* Inspect concurrent render-thread activity, GPU timing, and frame-pacing conditions.
- Assume the largest C# method caused it.
- Conclude the GPU is always saturated from the marker name alone.
- Force garbage collection every frame.
> A thread may be waiting for work elsewhere or for the next allowed presentation time. Compare the other threads and GPU timing before identifying the bottleneck.

?? performance-resolution-test GPU time drops sharply when resolution is reduced. What hypothesis does this support?
* Pixel-related rendering work or bandwidth is a significant cost.
- The mission evaluator is necessarily quadratic.
- Every allocation has disappeared.
- All device thermal effects are irrelevant.
> Resolution experiments can implicate pixel-scaled work, but further inspection is needed to identify the specific passes.

## Reduce repeated work before micro-optimizing instructions {#performance-cpu-work}

First look for repeated work that is unnecessary. Update a score label when the displayed value changes. Recalculate a path when relevant state changes. For a mission event, evaluate only the mission types that could respond to it.

Multiply the cost by how often the operation runs. An operation taking 0.02 ms seems small, but 1,000 serial executions take 20 ms if the cost scales linearly. In contrast, replacing a readable operation that runs once at startup may produce no visible benefit.

Cache stable component references if repeated lookups are expensive in frequently executed code. Define when that cache must change if the component or binding changes. Repeated whole-scene searches also hide dependencies that could be supplied explicitly.

A shared update list can reduce the overhead of many tiny component callbacks and spread work between frames. It needs clear registration and iteration rules, though. Removing an item during a loop can skip work or invalidate an enumerator. Decide whether registrations and removals take effect immediately or between processing phases.

Physics cost depends on the number of active bodies, contacts, solver settings, query frequency, layer interactions, and timestep. First remove irrelevant collisions and unnecessary queries. Increasing the fixed timestep can reduce how often simulation runs, but also changes responsiveness and collision behavior.

Profile animation and UI as well as gameplay scripts. Many active animators, repeated layout calculations, or frequently changing text can dominate CPU time in a scene that otherwise looks simple.

Change the algorithm when the workload justifies it. An index can replace repeated full scans, but also needs updates and invalidation. Keep correctness tests for the optimized version, and compare its results with a simple reference implementation on representative inputs.

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

Distinguish how quickly memory is allocated from how much stays in use. Temporary strings can create many allocations and become unreachable soon afterward. A static collection may instead retain many objects while allocating almost nothing new. Investigate both patterns.

Unity's garbage collector reclaims managed objects that are no longer reachable. Its exact behavior depends on the runtime and platform version. Incremental collection spreads some of the work across frames; allocation still has a cost, and the collector still needs to trace live objects. [Unity's incremental collection guide](https://docs.unity.cn/Manual/performance-incremental-garbage-collection.html) explains the tradeoff.

Use allocation call stacks to find frequently executed sources. Look for string formatting, captured variables, boxing, iterators, temporary collections, and APIs that return new arrays. Check their frequency and allocation size in a player build before choosing what to change.

Reuse buffers owned by the caller where that fits the API. Reserve collection capacity before gameplay when a realistic bound is known. If a property returns a fresh array, avoid reading it repeatedly inside a loop: fetch it once, or use an API that fills a supplied collection. Unity's [array optimization guide](https://docs.unity.com/en-us/engine/6000.0/manual/scripting/optimization/performance-optimizing-code-managed-memory/arrays) discusses these copying costs.

A reused buffer can keep large objects reachable through old entries. Clear used elements according to the container's behavior when those references are no longer needed. A buffer that grows during a rare burst may also keep that capacity indefinitely. Decide when it is safe to trim retained storage.

Forcing garbage collection every frame adds work and can worsen pacing. Disabling collection has a different risk: unreachable objects keep accumulating. Either choice needs evidence and a carefully bounded allocation plan, rather than being used as a general fix.

Measure memory in a representative player build. Editor-only allocations can distract from what the player does. Native and graphics allocations also do not appear as ordinary `GC.Alloc`, so a marker with zero managed allocation can still have a memory cost.

?? performance-allocation-retention Which symptom suggests retention rather than merely temporary allocation traffic?
* Objects remain reachable after their intended lifetime and repeated feature cycles increase retained memory.
- A short-lived string is allocated once during startup.
- A profiler marker has a descriptive name.
- A timer uses a double rather than a float.
> Retention concerns objects that stay reachable. Allocation rate concerns how much new managed memory is requested over time.

?+ Opening and closing a screen stops allocating after pool warm-up, but a static event retains every closed presenter. What problem remains?
* Closed presenters are still retained through subscriptions, even though new allocations are low.
- No problem, because zero per-frame allocation proves no leak.
- A guaranteed GPU bottleneck caused by hashing.
- A missing random seed.
> Few new allocations do not mean old objects were released. Follow the static event's references and check when each presenter should unsubscribe.

?? performance-incremental-gc [tf] Incremental garbage collection eliminates the total work of tracing live managed objects.
* false
> Incremental collection distributes work to reduce long pauses. It does not remove the need to inspect managed reachability.

## Pooling trades creation cost for lifecycle complexity {#performance-pooling}

Pooling keeps objects for reuse instead of repeatedly creating and destroying them. It can reduce allocation and initialization spikes for bullets, particles, or temporary UI. The tradeoff is retained memory and more responsibility for resetting each object correctly.

Define the pool contract:

1. Who owns the pool and when is it disposed?
2. What is reset on checkout and return?
3. What happens when no inactive object is available?
4. What is the maximum retained capacity?
5. How is double return detected?
6. How are outstanding asynchronous operations invalidated?

A projectile may need to reset velocity, damage source, collision state, lifetime, trail history, audio, transform, subscriptions, and generation. Disabling the GameObject does not reset arbitrary fields. List the state that belongs to each use of the object, and clear it when that use ends.

Prewarming performs creation work earlier. It still takes time and memory, and prewarming for a theoretical maximum can make startup too slow or exceed the memory budget. Measure normal and burst usage, then define a retained-capacity limit and a policy for growth.

Compare measurements before and after pooling. If too many particles are expensive to draw, reusing their objects may leave frame time unchanged while retaining more memory. If creating their prefabs causes the hitch, pooling may directly reduce it.

As a hypothetical example, a reward celebration might create 200 identical objects in one frame. A bounded, prewarmed pool could reduce that creation spike, while staggered animation limits how many are active together. Validate repeated celebrations, interruption by scene unload, and low-memory conditions. Also measure how much memory the pool keeps afterward.

A rarely opened screen that holds large resources may be better released between uses. Compare the work saved by keeping it with the memory and lifecycle complexity that reuse adds.

?? performance-pool-bottleneck Why might pooling a particle effect fail to improve frame time?
* The dominant cost may be rendering the active particles rather than creating them.
- Pools always reduce GPU overdraw automatically.
- Pooled objects never consume memory.
- Every hitch is caused by managed object creation.
> Pooling addresses creation and reuse costs. It does not inherently reduce the work of simulating or rendering active objects.

?? performance-pool-contract [multi n=5] Which policies belong in a production pool contract?
* Reset and cleanup when each use of a pooled object begins and ends.
* Capacity and exhaustion behavior.
* Protection against stale work or double return.
- A guarantee that all pooled objects consume no memory.
- A rule that every feature must use the same global pool.
> A pool needs rules for who owns each object, how it is reset, how much it retains, and when it can be returned. Those rules prevent stale work and duplicate release under load.
