---
book: Unity Game Engineering
chapter: 07: Asynchronous work and asset ownership
---

## Coroutines, tasks, and Awaitable solve different problems {#async-models}

A coroutine lets Unity pause an iterator and resume it later. It does not move expensive calculations to another CPU thread: a long calculation before the next yield still blocks the main thread. Disabling the component alone does not stop its coroutines, but deactivating its GameObject or destroying the component does. [Unity's coroutine manual](https://docs.unity3d.com/6000.0/Documentation/Manual/Coroutines.html) documents those lifecycle distinctions.

A `Task` represents work that will eventually succeed, fail, or be cancelled. Adding `async` to a method does not automatically run it in parallel. The method starts synchronously and gives up control when it awaits an operation that has not finished. `Task.Run` can schedule work on a thread-pool thread where supported, but most Unity object APIs cannot be used there.

Unity's `Awaitable` supports asynchronous operations integrated with the engine. Its instances are pooled, so the same instance should not be awaited multiple times. Its continuation runs synchronously when completion is triggered; this makes the thread that completes the operation significant. [Unity's asynchronous programming reference](https://docs.unity.cn/6000.0/Documentation/Manual/AwaitSupport.html) explains the differences from `Task`.

Choose according to the operation:

| Need | Reasonable starting point |
| --- | --- |
| Sequence a short scene animation across frames | Coroutine or Unity Awaitable |
| Coordinate existing task-returning I/O | Task-based async flow |
| Process many independent numeric items | [[Job System]], possibly [[Burst]] |
| Evaluate a small deterministic rule | Ordinary synchronous method |

Give callers a way to observe failure. They cannot await an `async void` method or inspect a normal task result from it. Use `async void` only where an event-handler API requires it, catch failures at that entry point, and put reusable work in an asynchronous method whose result callers can observe.

Avoid using `.Result` or `.Wait()` on the main thread to wait synchronously for an async API. This can freeze rendering. If completion needs the same synchronization context that is now blocked, it can also deadlock. Let startup and screens show a loading state while the work finishes.

The question that follows all of this in an interview is where an `await` resumes, and it has a definite answer. Unity installs a synchronization context on the main thread. When you `await` inside a method that started there, the continuation is posted back to that context and runs on the main thread during the player loop. That is why calling a Unity API after an `await` normally works, and it is the property most task-based Unity code depends on without stating it.

`ConfigureAwait(false)` removes that property. It tells the runtime not to return to the captured context, so the continuation runs on whatever thread completed the operation:

```csharp
// The continuation resumes on Unity's main thread.
var bytes = await ReadFileAsync(path);
transform.position = Parse(bytes);         // Legal.

// The continuation resumes on a thread-pool thread.
var other = await ReadFileAsync(path).ConfigureAwait(false);
transform.position = Parse(other);         // Not legal from another thread.
```

Library advice to use `ConfigureAwait(false)` everywhere comes from server code, where there is no thread affinity to preserve and avoiding the post is a real saving. In gameplay code it removes the guarantee you rely on. Use it only for a section that touches no engine API, and return to the main thread before you do.

The same reasoning explains why `Task.Run` is narrower than it looks in Unity. It moves work to a thread-pool thread, where most `UnityEngine` APIs are unavailable. It fits pure computation over data you have already copied out; it does not fit anything that reads a transform or instantiates an object.

Exercise: Take an `async` method in your code and mark, for each line after the first `await`, which thread you believe it runs on. Any line you cannot answer is a line worth checking.

?? async-coroutine-thread [tf] Moving a long CPU calculation into a coroutine automatically moves it off Unity's main thread.
* false
> A coroutine can pause at a yield point. The synchronous work between those points still runs on the executing thread, normally Unity's main thread.

?+ A coroutine runs on a MonoBehaviour. Only that component's enabled property is set to false while its GameObject stays active. Under the documented coroutine behavior, what happens?
* The coroutine is not automatically stopped by disabling the component alone.
- The coroutine pauses and resumes when the component is enabled again.
- The coroutine continues, but its `WaitForSeconds` yields stop advancing.
- The coroutine is stopped at the end of the current frame.
- The coroutine keeps running and is re-registered on the GameObject.
> Disabling a component differs from deactivating its GameObject. End the coroutine explicitly if that is the component's binding policy.

?? async-awaitable-reuse Why should one Unity `Awaitable` instance not be awaited by several consumers?
* Awaitable instances are pooled and their contract does not support repeated awaits.
- An `Awaitable` completes on a worker thread, so two consumers would race.
- Each `await` advances the operation by one frame, so the second sees a later state.
- The `Awaitable` carries a cancellation token that the first consumer consumes.
- Awaiting twice schedules the operation twice, which doubles its cost.
> Unity Awaitable and .NET Task have different contracts. Share an appropriate result or abstraction rather than assuming a pooled Awaitable supports multiple awaits.

## Cancellation is cooperation; validity is a separate check {#async-cancellation}

Suppose a view requests artwork for item A, closes, and is reused for item B. The request for A then finishes after the request for B. If its continuation assigns the image without checking which item the view now represents, the view shows the wrong artwork. The object still exists, so there may be no null-reference error.

Cancellation asks work to stop. It does not prove that the work stopped, prevent every later callback, or undo effects that already happened. Some APIs use a cancellation token only to stop waiting; the underlying load continues.

Cancel work when its owner's lifetime ends, and separately check whether a result still belongs to the current request. Give each binding a generation number and capture it when starting the request. Before applying the result, compare that captured number with the current one. Perform the comparison and assignment on the appropriate thread, without yielding between them; otherwise the binding could change after the check.

This pseudocode assigns cleanup to the request or displayed-asset owner:

```text
Bind(item):
    increment generation
    cancel previous request
    release previously displayed owned asset
    begin request(item, captured generation)

On request completes with owned lease:
    if view is unbound or captured generation != current generation:
        release lease
        return
    transfer lease to displayed-asset owner
    assign artwork on main thread

Unbind():
    increment generation
    cancel outstanding request
    release displayed owned asset
```

A stale result still needs cleanup if the operation acquired a resource for you. “Ignore the callback” can leak a handle. Release that resource, or define an adapter contract in which the adapter keeps ownership until the caller accepts success. In either design, exactly one owner must perform the release.

Distinguish a timeout from cancellation. A timeout means the caller stopped waiting after a deadline; the operation may still be running. For a reward request, use the same stable operation ID to recover its result. For an asset request, ensure that a late completion still leads to release if nobody needs the asset.

The cancellation source itself needs an owner, and that owner is almost always the same object that owns the binding:

```csharp
public void Bind(ItemId item)
{
    Unbind();                                        // Cancel and dispose the previous one.
    cts = new CancellationTokenSource();
    generation++;
    _ = LoadArtworkAsync(item, generation, cts.Token);
}

public void Unbind()
{
    generation++;
    cts?.Cancel();
    cts?.Dispose();
    cts = null;
}
```

Three rules make this reliable. Create the source where the work begins, so its lifetime matches the work. Dispose it after cancelling, because a source holds registrations that the callbacks are attached to. And never reuse a source after it has been cancelled: a cancelled source stays cancelled, so the next request would start already cancelled.

Where a request should stop for more than one reason, such as the view unbinding or the whole scene shutting down, a linked source combines them, and the same ownership rule applies to the linked source it creates. Register the token with a long-lived source only if you also remove the registration. A token from an application-lifetime source that accumulates one registration per view binding is a leak whose symptom is slow growth rather than a visible failure.

Exercise: Find a `CancellationTokenSource` in your code and answer three questions about it: who creates it, who disposes it, and what happens on the second request after the first was cancelled.

?? async-stale-result A view now displays item B when item A's earlier load finishes. What should happen to A's successfully acquired owned asset?
* Discard the stale result and release the acquired asset according to the loader's contract.
- Assign it, then request item B again so the display corrects itself.
- Drop the reference and let garbage collection release the handle.
- Hold the handle until the view is destroyed, then release everything at once.
- Release it when the load reports a failure, and keep it otherwise.
> The generation check prevents the wrong image from being shown. Releasing the rejected asset prevents a leak; the code needs both steps.

?+ Request A completes after request B has rebound a pooled view. Cancellation of A was requested but ignored by the loader. Which check still protects the view?
* Compare A's captured binding generation with the view's current generation before applying the result.
- Confirm that A's cancellation token reports cancellation before applying the result.
- Check that the view's GameObject is still active in the hierarchy.
- Verify that A's result is not null before assigning it.
- Apply the result in `LateUpdate`, after the rebind has settled.
> The view can still exist, and the load can succeed, even though the view now represents a different item. Check the binding generation before applying the result.

?+ Why is cancellation alone insufficient to prevent stale callbacks?
* Cancellation is cooperative and may race with completion or may not stop the underlying operation.
- Cancellation is delivered on the next frame, so one more callback arrives.
- A cancelled operation runs its continuation with a default result.
- Cancellation applies to the token source rather than to the awaiting call.
- Cancelling a token disposes the result before the caller can read it.
> Requesting cancellation does not establish that a result is still valid for the current owner.

## Load assets with explicit leases and release rules {#assets-ownership}

An asset reference, an instantiated object, and a load operation are different resources. For each API, check what it returns, who owns that result, and how it must be released.

[[Addressables]] tracks acquired loads through reference counts. Pair each acquisition with the appropriate release. Releasing a handle may not free all associated memory immediately, because other references, dependencies, or bundles can keep it loaded. The [Addressables 1.21 memory guide](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/MemoryManagement.html) provides a versioned example; check the installed package's documentation for exact API behavior.

Loading a prefab through Addressables and cloning it with ordinary `Object.Instantiate` are separate operations. The clone does not automatically acquire another Addressables load reference, so retain the required assets for as long as the clones need them. If you instantiate through Addressables instead, use the release method documented for that operation. The [Addressables operation-handle guide](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetsAsyncOperationHandle.html) describes these lifetimes.

A game-owned adapter can represent an acquired asset as a lease: an object that provides the result and one way to release it. Decide who holds that lease. A cache might retain it while views borrow access, or each view might acquire and release its own load. Make borrowed and owned references distinguishable, so callers know which ones they must release.

A level-based puzzle gives that decision a natural boundary. Everything acquired for level 47 is released when level 47 ends, so the lease belongs to the level session rather than to any view inside it. A view that acquires its own art and is then destroyed by a restart has to release it on a path few projects test, whereas the end of a level is an event the game already handles carefully.

Check the cleanup required when a load fails. Keep error handling and release logic together, so cancellation, failure, and a successful but stale result all follow the ownership rules.

An asynchronous load can still perform work on the main thread. Deserialization, object creation, shader work, and scene activation may cause hitches after the bytes arrive. Measure the time until the content is ready to use, including those steps.

Addressables can load local content without a remote service. Choose it when the feature needs its loading and lifetime controls. Direct serialized references may be simpler for small always-resident assets.

A lease is a small type whose value is that it cannot be ignored:

```csharp
public interface IAssetLease<out T> : System.IDisposable
{
    T Value { get; }
    bool IsReleased { get; }
}
```

Returning one of these instead of the raw asset changes what a caller can accidentally do. A raw reference gives no hint that anything must be released, and a stale result is easy to discard silently. A lease is a disposable the caller must place somewhere, which makes forgetting it a visible omission rather than an invisible one.

State when the lease is not worth it, because this is exactly the kind of rule that gets over-applied. An asset referenced directly in a prefab or scene, loaded with the object that uses it and unloaded with it, already has its lifetime managed by the engine; wrapping it adds a layer with nothing to decide. A small always-resident asset such as a UI font or a default material is in the same position. The lease earns its place when the asset is acquired at runtime, when more than one owner might hold it, or when a request can complete after its requester is gone. Those are the same conditions that make the stale-result problem possible, which is not a coincidence.

Exercise: List the runtime-loaded assets in a feature you know, and mark each one as owned or borrowed. For every owned entry, name the line that releases it, including on the failure and cancellation paths.

?? assets-clone-lifetime A prefab is loaded through Addressables, then cloned with ordinary `Instantiate`. What should the owner ensure?
* The required assets stay acquired for as long as the clones need them.
- Each clone should be released through the Addressables instantiation API.
- The load handle should be released as soon as `Instantiate` returns.
- The clone should be registered with Addressables after instantiation.
- The prefab should be marked as a dependency of the clone's scene.
> An ordinary clone does not automatically create another Addressables reference. Its owner must keep the required load alive.

?? assets-release-memory [tf] Releasing one Addressables handle guarantees an immediate equal-sized decrease in process memory.
* false
> Other owners, bundle dependencies, and allocator behavior can retain memory. Handle accounting and process memory are related but not identical.

## Choose loading boundaries from peak memory and latency {#assets-loading-boundaries}

Take a level-based puzzle in which each level is its own scene. Suppose the level being left, scene A, uses 300 MB of content, and the level being entered, scene B, uses 250 MB. Keeping A loaded while loading B can require much more memory than either scene uses alone. Compressed data, decompressed buffers, and engine objects may all overlap during the transition. Shared dependencies save memory only if packaging and loading actually share them.

Include overlapping and temporary resources in the transition estimate:

```text
Peak resident memory approximately includes:
  old scene still retained
  new scene becoming resident
  temporary loading/decompression buffers
  shared services and pools
  graphics resources and transient render targets
```

If the transition's peak memory is too high, consider releasing the old scene earlier, loading the new content in stages, reducing temporary buffers, or using a lightweight transition scene. Each choice also affects waiting time and what the player sees. A loading screen gives you a planned place to do this work, but still needs a time budget.

Bundle contents affect what can be released together. A small icon used frequently might keep an entire bundle loaded, including a large environment. Putting every asset in its own bundle also has costs: more overhead and potentially repeated dependency loads. Group assets by when they are used and released, then measure the build and runtime behavior.

Create a bounded set of [[object pool|pooled]] objects and expensive visual variants before the phase that needs them. Loading everything “to prevent hitches” can exhaust memory, while loading everything on demand can cause stalls at first use. Measure both first-use delay and retained memory on target devices to decide what to preload.

A live game also needs compatibility between its content catalog and installed binary. A downloaded asset may require scripts or shaders that an older binary does not contain. Check that the client can use the content, as well as whether it downloaded successfully.

Putting numbers on the transition makes the shape of the problem clear. Using the two scenes above, and rough figures for the rest:

| Contributor | Estimate |
| --- | --- |
| Scene A, still resident | 300 MB |
| Scene B, becoming resident | 250 MB |
| Decompression and loading buffers | 40 MB |
| Shared services, pools, managed heap | 60 MB |
| Render targets and transient graphics memory | 50 MB |
| Peak during the overlap | 700 MB |

Neither scene is close to the peak on its own, and a budget derived from measuring each scene after it finished loading would have missed the number that actually matters. This is why the measurement instruction above specifies the transition rather than the steady state.

The table also tells you where to look first. Releasing scene A before scene B loads removes the largest single contributor, at the cost of a visible gap the player must be given something to look at. A transition scene is small precisely so that the overlap it creates is cheap: A unloads, a 20 MB transition holds the screen, then B loads. Staging B's load reduces the second row instead, and reducing buffer sizes reduces the third; each buys less than the first option and costs less.

Exercise: For a transition in a project you know, write the five rows above with real numbers. If you cannot fill a row, that is the measurement to take next.

?? assets-peak-memory Why can a scene transition exceed both scenes' individual memory footprints?
* Old and new content can overlap with temporary loading buffers and shared resources.
- Loading a scene duplicates its shared dependencies for each referencing scene.
- Scene memory is reported after compression, so the figures understate the real size.
- The profiler counts the loading thread's stack against the scene's budget.
- Unloading is deferred to the next frame, which doubles the reported total.
> During a transition, old content, new content, and temporary buffers can all be in memory together. Measuring each scene only after loading can miss that peak.

?? assets-bundle-grouping Which consideration should influence asset bundle grouping?
* Which assets are used together and have similar lifetimes.
- The folder structure the artists already use in the project.
- Keeping each bundle close to a fixed target size.
- Grouping by asset type, so textures and meshes stay separate.
- The order in which the assets were added to the project.
> Grouping determines dependency and residency behavior. Co-usage and measured overhead matter more than a universal bundle-count rule.

## Account for job ownership and scheduling overhead {#async-jobs-burst}

The Job System schedules work using explicit dependencies. Jobs commonly process native containers under defined access rules, and Burst can compile supported code for efficient execution. These tools do not make arbitrary MonoBehaviour objects safe to access in parallel. [Unity's Job System overview](https://docs.unity3d.com/6000.0/Documentation/Manual/job-system.html) introduces the model.

First identify calculations that can run independently, such as distances between many entities using a snapshot of their positions. Read data from Unity objects where their APIs permit it. Then schedule jobs over that data, and apply the results once the required work has completed.

Scheduling and synchronization both cost time. For a small array, an ordinary loop may be faster than creating a job and waiting for it. Calling `Complete` immediately after scheduling also leaves little chance for useful overlap. Where the feature's response-time requirements allow it, schedule early, perform other independent work, and wait when you actually need the results.

Keep native containers alive for every job that uses them. Disposing a buffer, or reusing it for another owner, while a scheduled job still reads it is unsafe. Express the job dependencies, choose an allocator whose lifetime fits the work, and follow the API's rules for release after completion.

Data-oriented design organizes data around how it is accessed: keep relevant values together, reduce pointer chasing, and process them in a form suited to the operation. An Entity Component System (ECS) is one way to do that. Arrays and jobs can also be useful without an ECS migration. Such a migration needs to justify its cost to authoring tools, integration, and the team.

Parallel execution can affect reproducibility. A floating-point sum may change when values are added in a different order. If the authoritative simulation must produce identical results, define the numeric and scheduling rules that will preserve that requirement.

“Enough work” deserves an order of magnitude, with the caveat that it varies by platform and must be measured. Scheduling a job and waiting for it has a fixed cost typically measured in microseconds, so a job over a few dozen elements of trivial arithmetic can easily cost more than the loop it replaced. Hundreds of elements with real work per element, or thousands of elements with trivial work, is the region where the answer stops being obvious and measurement starts being worthwhile.

Measure the ordinary loop first, and keep it. It is the correctness reference for the parallel version, and it answers the question that decides everything: a loop taking 0.05 ms cannot repay any scheduling overhead, no matter how parallel it is. The upper bound on what parallelism can win is the time the loop currently takes, and features are often optimized without anyone checking that number.

When the job version does win, expect the gain to be smaller than the core count suggests. The sequential remainder, the copy into and out of native containers, and the wait at the point where the results are needed all limit it. Scheduling early and completing late is what makes the difference between a job that overlaps with other work and a job that simply moved the same wait to a different line.

Exercise: Time the ordinary loop you are considering replacing, then write down the best possible outcome of parallelizing it. Decide whether that number would change any decision.

?? async-job-worthwhile When is moving a loop to jobs most promising?
* It has enough independent work to outweigh scheduling and synchronization costs.
- The loop writes into a managed list that several systems read.
- The loop calls into the physics API for each element.
- The loop is short, so its results are available in the same frame.
- The loop already runs from a coroutine, so the job adds little overhead.
> Parallel work helps when there is enough computation to cover scheduling costs, and other useful work can run before the results are needed.

?? async-native-lifetime A job still reads a native buffer. When can its owner safely dispose or reuse that buffer?
* After the relevant dependencies complete, following the container's ownership contract.
- As soon as `Complete` is called on any job in the same frame.
- After the next `FixedUpdate`, by which point scheduled jobs have run.
- Once the allocator's lifetime expires, which releases the buffer for reuse.
- When the job's `Execute` method returns for the final element.
> Keep native data alive until every scheduled job using it has finished. Managed garbage collection does not wait for those jobs or release the buffer for you.
