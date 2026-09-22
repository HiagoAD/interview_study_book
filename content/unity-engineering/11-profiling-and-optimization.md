---
book: Unity Game Engineering
chapter: 11: Profiling CPU, GPU, and managed memory
---

## Define a frame budget and measure a distribution {#performance-frame-budget}

At 60 frames per second, a frame interval is approximately 16.67 milliseconds. At 30 FPS it is 33.33 ms; at 120 FPS it is 8.33 ms.

$$ \text{frame interval in ms} = \frac{1000}{\text{target FPS}} $$

Your feature cannot use the entire frame interval. Simulation, rendering submission, UI, audio, integrations, engine work, and scheduling all share the device. Leave room for unusually busy content and for performance to fall as the device heats up.

CPU and GPU work can overlap across frames, so adding their durations does not necessarily give total frame time. Throughput depends on the slowest stage and on where stages wait for one another. Queued work also affects how quickly input reaches the display. Unity's [Profiler Highlights guide](https://docs.unity3d.com/6000.0/Documentation/Manual/ProfilerHighlights.html) explains the separate CPU and GPU frame budgets.

An average FPS value can hide occasional hitches. Record frame-time percentiles, along with how often long frames occur and how long they last. Under the chosen percentile definition, a p95 of 20 ms means about 95% of measured frames took no more than 20 ms. The worst frame may be much longer.

Make captures repeatable. Keep the device, build, quality level, camera path, entity count, and content the same, with a similar thermal state. Include sustained play, first use of effects, scene transitions, and resume. An empty scene on a cold device does not represent a busy session after several minutes.

Report units and conditions. “p95 main-thread active time decreased from 12.8 to 9.4 ms in a five-minute capture of a fully built farm on device X” is much more informative than “30% faster.” Example numbers in this book are hypothetical, not measured results from a shipped project.

A budget only becomes useful once it is divided. The render thread, the job workers, and the GPU each have 16.67 ms of their own at 60 FPS, so the split that matters for gameplay code is the main thread's. A hypothetical split of it might look like this:

| Consumer | Allocation |
| --- | --- |
| Engine, culling, and rendering submission | 4.0 ms |
| Physics and fixed-step simulation | 2.5 ms |
| Animation and skinning | 2.0 ms |
| UI layout and rendering | 1.5 ms |
| Audio, input, and platform integrations | 1.0 ms |
| Headroom for thermal loss and content spikes | 3.0 ms |
| Remaining for gameplay code | 2.67 ms |

The last row is the one that surprises people. All the gameplay systems this book discusses, including missions, effects, collection, and spatial queries, share under three milliseconds. A mission evaluator that takes 0.5 ms has spent a fifth of the gameplay budget, which is a very different statement from “half a millisecond is nothing”.

The headroom row is not padding. A device that has been playing for ten minutes may deliver noticeably less than it did in the first thirty seconds, and content is authored to a standard the busiest scene exceeds. A budget with no headroom is a budget that holds only under laboratory conditions.

Treat these numbers as a worked example rather than as targets. Derive your own from a capture on the minimum supported device, and revise them when the project's content changes, because a budget agreed during prototyping rarely survives the arrival of real art.

Exercise: Write this table for your own project using measured numbers. Then state how many milliseconds a new feature may use, before anyone starts building it.

?? performance-60-budget [short] What is the approximate frame interval at 60 FPS, in milliseconds? Give two decimal places.
= 16.67 | 16.67ms
> Dividing 1000 milliseconds by 60 frames gives approximately 16.67 milliseconds per frame.

?? performance-percentile Why can average FPS look healthy while gameplay visibly stutters?
* Occasional long frames can be hidden by many short frames in the average.
- Average FPS is computed over the whole session rather than the visible window.
- The display refreshes at a fixed rate, so stutter is a presentation artifact.
- Stutter comes from input latency, which frame timing does not measure.
- The profiler samples frames, so short frames are over-represented.
> Smoothness depends on frame-time consistency and outliers, not just average throughput.

?+ An optimization improves median frame time but adds a 200 ms hitch during every reward claim. What should the evaluation report?
* Both the improved median and the new 200 ms hitch during reward claims.
- The median alone, with the hitch recorded as a separate known issue.
- The hitch alone, since a regression outweighs an improvement.
- The mean frame time, which already accounts for the hitch.
- The percentage improvement, measured across the session as a whole.
> A better median does not cancel out a new hitch in a common interaction. Report how frame times changed and which scenarios became worse.

## Find the limiting stage before changing code {#performance-bottleneck}

Start with the CPU timeline and any available GPU timings. Determine where the frame is being held up: main-thread computation, render-thread submission, GPU work, synchronization, or a frame-rate limit. That tells you which kind of change is likely to help.

Read a wait marker alongside the work happening on other threads. `Gfx.WaitForPresentOnGfxThread`, for example, can involve waiting for the GPU or for presentation timing. Compare render-thread activity and GPU measurements before concluding that the GPU is the bottleneck. [Unity's profiler marker reference](https://docs.unity3d.com/6000.0/Documentation/Manual/profiler-markers.html) explains these distinctions.

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

A capture is only worth analyzing if it represents the thing you care about, and a few habits make that reliable. Profile a development build on the target device rather than the Editor, because the Editor adds its own work and hides platform behavior. Connect before the scenario starts so the first frames are included. Record for long enough to catch the outliers rather than the average, and note the device's thermal state, because a capture taken cold and one taken after ten minutes describe different machines.

Deep profiling deserves a warning of its own. It instruments every managed method, which can multiply managed call cost several times over and change which part of the frame appears expensive. Use it to find which of your own methods is responsible once a marker has already implicated an area, and do not read its absolute timings as the real cost. The same caution applies in the other direction: adding your own markers is cheap individually and not free in a loop that runs thousands of times per frame.

Work from coarse to fine. A capture with a handful of well-placed markers around feature-level phases will usually tell you which system to investigate, and that is a smaller question than the one you started with. Reaching for per-method detail before you know the area is how profiling sessions consume an afternoon and produce a number nobody can act on.

Exercise: Add three markers to a feature you own, at the phase level rather than the method level. Capture thirty seconds on a device and write down which phase you would investigate next.

?? performance-wait-marker A frame contains a large graphics wait marker. What is the best next step?
* Inspect concurrent render-thread activity, GPU timing, and frame-pacing conditions.
- Reduce the target frame rate until the wait marker disappears.
- Add more markers inside the waiting call to find the slow line.
- Move the work inside the marker onto a job.
- Compare the marker's duration against the same marker in the Editor.
> A thread may be waiting for work elsewhere or for the next allowed presentation time. Compare the other threads and GPU timing before identifying the bottleneck.

?? performance-resolution-test GPU time drops sharply when resolution is reduced. What hypothesis does this support?
* Pixel-related rendering work or bandwidth is a significant cost.
- The CPU is submitting fewer draw calls at the lower resolution.
- Vertex processing dominates, since fewer pixels means fewer vertices.
- The frame is limited by shadow map resolution alone.
- The measurement is unreliable, since resolution changes the scene content.
> Resolution experiments can implicate pixel-scaled work, but further inspection is needed to identify the specific passes.

## Reduce repeated work before micro-optimizing instructions {#performance-cpu-work}

First look for repeated work that is unnecessary. Update a score label when the displayed value changes. Recalculate a path when relevant state changes. For a mission event, evaluate only the mission types that could respond to it. A farm builder with four hundred plots is the shape this rule exists for: every plot holds a growth timer, but only the few whose timers expired this frame have anything to report, so the frame's cost should follow the expiries and not the population.

Multiply the cost by how often the operation runs. An operation taking 0.02 ms seems small, but 1,000 serial executions take 20 ms if the cost scales linearly. In contrast, replacing a readable operation that runs once at startup may produce no visible benefit.

Cache stable component references if repeated lookups are expensive in frequently executed code. Define when that cache must change if the component or binding changes. Repeated whole-scene searches also hide dependencies that could be supplied explicitly.

A shared update list can reduce the overhead of many tiny component callbacks and spread work between frames. It needs clear registration and iteration rules, though. Removing an item during a loop can skip work or invalidate an enumerator. Decide whether registrations and removals take effect immediately or between processing phases.

Physics cost depends on the number of active bodies, contacts, solver settings, query frequency, layer interactions, and timestep. First remove irrelevant collisions and unnecessary queries. Increasing the fixed timestep can reduce how often simulation runs, but also changes responsiveness and collision behavior.

Profile animation and UI as well as gameplay scripts. Many active animators, repeated layout calculations, or frequently changing text can dominate CPU time in a scene that otherwise looks simple.

Change the algorithm when the workload justifies it. An index can replace repeated full scans, but also needs updates and invalidation. Keep correctness tests for the optimized version, and compare its results with a simple reference implementation on representative inputs.

Attack the cost in the order that has the largest possible payoff, because the steps are not equally valuable:

1. Does this work need to happen at all? Removing it is the only change with unlimited return.
2. Does it need to happen this often? Moving from every frame to on-change is usually the largest remaining win.
3. Does it need to process this many items? Filtering candidates before the expensive test comes next.
4. Does each item need to cost this much? Micro-optimization is last, and it is bounded by the work that remains.

Most features never reach step four, and features that begin at step four usually produce a small percentage of a cost that step two would have removed entirely. The score label is the canonical example: making the string formatting faster is step four, and updating only when the value changes is step two, which removes the formatting altogether on almost every frame.

The ladder also gives you a way to challenge a proposed optimization in review. Asking which step a change belongs to is quicker than debating its details, and a step-four change proposed before anyone has answered step two is usually premature regardless of how well written it is.

Exercise: Take a costly system you know and answer all four questions in order. Note how far down the list you get before the answer stops being “yes, it does”.

?? performance-work-frequency An operation costs 0.02 ms and runs serially for 1,000 entities. What is its approximate total cost?
* 20 ms.
- 0.2 ms, treating the count as ten.
- 2 ms, dividing by the frame rate.
- 200 ms, carrying an extra factor of ten.
- 0.02 ms, since the operations run in parallel.
> Repeated cost multiplies by the number of executions. Small per-entity work can exceed an entire frame budget at scale.

?+ An operation measured at 0.02 ms runs serially for 1,000 entities, so the estimate is 20 ms. What does that estimate not establish?
* That each call still costs 0.02 ms when 1,000 of them run back to back.
* Whether the work has to finish within a single frame at all.
- That the estimated total is larger than a 16.67 ms frame at 60 FPS.
- What the total comes to if the per-call cost holds at 0.02 ms.
- That a per-call cost under a tenth of a millisecond can still add up.
- That the total comes from many small calls rather than one slow one.
> The estimate assumes each call costs the same at scale, which caching, contention, and allocation can change, and it says nothing about whether the work must finish in one frame. Treat the figure as a reason to measure the loop as it runs.

?? performance-ui-updates What is a useful first optimization for a score label rebuilt every frame despite an unchanged displayed score?
* Update it only when the displayed value changes.
- Format the score faster each frame, reusing a character buffer.
- Move the label onto its own Canvas so its rebuild is isolated.
- Update the label every other frame, halving the rebuild cost.
- Replace the text component with one that renders to a texture.
> Avoiding unnecessary rebuilds and formatting addresses the actual repeated work while preserving presentation.

## Allocation traffic, retained memory, and garbage collection {#performance-gc}

Distinguish how quickly memory is allocated from how much stays in use. Temporary strings can create many allocations and become unreachable soon afterward. A static collection may instead retain many objects while allocating almost nothing new. Investigate both patterns.

Unity's garbage collector reclaims managed objects that are no longer reachable. Its exact behavior depends on the runtime and platform version. Incremental collection spreads some of the work across frames; allocation still has a cost, and the collector still needs to trace live objects. [Unity's incremental collection guide](https://docs.unity3d.com/6000.0/Documentation/Manual/performance-incremental-garbage-collection.html) explains the tradeoff.

Use allocation call stacks to find frequently executed sources. Look for string formatting, captured variables, boxing, iterators, temporary collections, and APIs that return new arrays. Check their frequency and allocation size in a player build before choosing what to change.

Reuse buffers owned by the caller where that fits the API. Reserve collection capacity before gameplay when a realistic bound is known. If a property returns a fresh array, avoid reading it repeatedly inside a loop: fetch it once, or use an API that fills a supplied collection. Unity's [array optimization guide](https://docs.unity3d.com/6000.0/Documentation/Manual/performance-optimizing-arrays.html) discusses these copying costs.

A reused buffer can keep large objects reachable through old entries. Clear used elements according to the container's behavior when those references are no longer needed. A buffer that grows during a rare burst may also keep that capacity indefinitely. Decide when it is safe to trim retained storage.

Forcing garbage collection every frame adds work and can worsen pacing. Disabling collection has a different risk: unreachable objects keep accumulating. Either choice needs evidence and a carefully bounded allocation plan, rather than being used as a general fix.

Measure memory in a representative player build. Editor-only allocations can distract from what the player does. Native and graphics allocations also do not appear as ordinary `GC.Alloc`, so a marker with zero managed allocation can still have a memory cost.

One property of Unity's managed memory explains a question that comes up in most memory investigations, which is why the reported heap never seems to go down. The managed heap grows when an allocation does not fit, and the memory it has claimed is generally retained by the process afterward rather than returned to the operating system. Collection makes space available for reuse inside that heap; it does not shrink it back.

The practical consequences are worth stating directly. A single burst of allocation, such as a badly written loading screen that allocates 80 MB once, raises the process's memory ceiling for the rest of the session even though those objects were collected immediately. Watching the heap size therefore tells you about the worst moment the game has had so far, not about the current one. And on a memory-constrained device, the peak is what gets you terminated, so a rare spike deserves attention even when the steady state looks comfortable.

This is also why the advice to reserve capacity before a run and reuse buffers is about more than allocation rate. A buffer that grows to its worst-case size once and is reused thereafter has one expansion; a buffer recreated every run may cause several, each potentially raising the ceiling. Check the exact behavior for the runtime and platform in the project, since collector and allocator details differ between backends and versions.

Exercise: Record the managed heap size at startup, after five minutes of play, and after returning to the menu. If the third number matches the second rather than the first, find the moment that raised the ceiling.

?? performance-allocation-retention Which symptom suggests retention rather than merely temporary allocation traffic?
* Objects remain reachable after their intended lifetime and repeated feature cycles increase retained memory.
- The allocation rate rises steadily while frame time stays flat.
- Garbage collection runs more often as the session continues.
- A single large buffer is allocated during the loading screen.
- The managed heap reaches its steady size within the first minute.
> Retention concerns objects that stay reachable. Allocation rate concerns how much new managed memory is requested over time.

?+ Opening and closing a screen stops allocating after pool warm-up, but a static event retains every closed presenter. What problem remains?
* Closed presenters are still retained through subscriptions, even though new allocations are low.
- The pool is oversized, so it holds more presenters than the screen needs.
- The presenters are collected, but their native resources are not.
- Each open allocates a new subscription, which raises the allocation rate.
- The static event delays collection until the next scene load.
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

Sizing a pool is arithmetic rather than guesswork. The number of objects alive at once settles around the spawn rate multiplied by the average lifetime. A weapon firing 10 bullets per second with a 2-second lifetime needs about 20 live bullets in the steady state. Add the burst case, two weapons firing together, and about 40 are alive; a capacity near 50 covers it with margin.

That calculation gives you the two numbers a pool contract needs. Prewarm to the steady state, because those objects will exist within the first seconds anyway and creating them during a loading screen is free. Set maximum retained capacity near the burst figure, because that is what a rare moment requires and what you are willing to keep afterward. The gap between the two is the region where growth is allowed, and it should be a decision rather than an accident.

Check the calculation against reality once, since a mismatch is informative. A pool that keeps growing past the predicted figure usually means objects are not being returned on some path, most often an early exit, a failure branch, or a scene unload. That is a leak, and pooling has made it slower to notice than plain destruction would have, because nothing is obviously missing.

Exercise: For a pooled object in your project, compute the rate times lifetime figure and compare it with the pool's actual peak count. Explain any gap before changing the capacity.

?? performance-pool-bottleneck Why might pooling a particle effect fail to improve frame time?
* The dominant cost may be rendering the active particles rather than creating them.
- Returning an object to the pool costs as much as destroying it.
- The particle system rebuilds its internal buffers on each activation.
- The pool's objects are created during the loading screen instead.
- The effect's material is instanced on each use.
> Pooling addresses creation and reuse costs. It does not inherently reduce the work of simulating or rendering active objects.

?? performance-pool-contract [multi n=5] Which policies belong in a production pool contract?
* Reset and cleanup when each use of a pooled object begins and ends.
* Capacity and exhaustion behavior.
* Protection against stale work or double return.
- A rule that every pooled object implements the same interface.
- A requirement that the pool is held in a static field for global access.
- A guarantee that reuse costs less than creation for every object type.
> A pool needs rules for who owns each object, how it is reset, how much it retains, and when it can be returned. Those rules prevent stale work and duplicate release under load.
