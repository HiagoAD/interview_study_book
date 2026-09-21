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
| Process many independent numeric items | Job System, possibly Burst |
| Evaluate a small deterministic rule | Ordinary synchronous method |

Give callers a way to observe failure. They cannot await an `async void` method or inspect a normal task result from it. Use `async void` only where an event-handler API requires it, catch failures at that entry point, and put reusable work in an asynchronous method whose result callers can observe.

Avoid using `.Result` or `.Wait()` on the main thread to wait synchronously for an async API. This can freeze rendering. If completion needs the same synchronization context that is now blocked, it can also deadlock. Let startup and screens show a loading state while the work finishes.

?? async-coroutine-thread [tf] Moving a long CPU calculation into a coroutine automatically moves it off Unity's main thread.
* false
> A coroutine can pause at a yield point. The synchronous work between those points still runs on the executing thread, normally Unity's main thread.

?+ A coroutine runs on a MonoBehaviour. Only that component's enabled property is set to false while its GameObject stays active. Under the documented coroutine behavior, what happens?
* The coroutine is not automatically stopped by disabling the component alone.
- Every coroutine in the scene stops.
- The coroutine moves to a worker thread.
- The coroutine restarts from its first statement.
> Disabling a component differs from deactivating its GameObject. End the coroutine explicitly if that is the component's binding policy.

?? async-awaitable-reuse Why should one Unity `Awaitable` instance not be awaited by several consumers?
* Awaitable instances are pooled and their contract does not support repeated awaits.
- Unity forbids all asynchronous operations.
- Awaiting always creates a new scene.
- Tasks and Awaitables have identical reuse guarantees.
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

?? async-stale-result A view now displays item B when item A's earlier load finishes. What should happen to A's successfully acquired owned asset?
* Discard the stale result and release the acquired asset according to the loader's contract.
- Assign it because successful completion proves it is current.
- Ignore it without releasing any acquired handle.
- Reset the player's inventory to item A.
> The generation check prevents the wrong image from being shown. Releasing the rejected asset prevents a leak; the code needs both steps.

?+ Request A completes after request B has rebound a pooled view. Cancellation of A was requested but ignored by the loader. Which check still protects the view?
* Compare A's captured binding generation with the view's current generation before applying the result.
- Check only that the pooled GameObject reference is non-null.
- Check only that A completed successfully.
- Allow every successful result to overwrite the current image.
> The view can still exist, and the load can succeed, even though the view now represents a different item. Check the binding generation before applying the result.

?+ Why is cancellation alone insufficient to prevent stale callbacks?
* Cancellation is cooperative and may race with completion or may not stop the underlying operation.
- Cancellation always rewinds all side effects.
- Tokens automatically compare item IDs.
- Cancellation only applies to value types.
> Requesting cancellation does not establish that a result is still valid for the current owner.

## Load assets with explicit leases and release rules {#assets-ownership}

An asset reference, an instantiated object, and a load operation are different resources. For each API, check what it returns, who owns that result, and how it must be released.

Addressables tracks acquired loads through reference counts. Pair each acquisition with the appropriate release. Releasing a handle may not free all associated memory immediately, because other references, dependencies, or bundles can keep it loaded. The [Addressables 1.21 memory guide](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/MemoryManagement.html) provides a versioned example; check the installed package's documentation for exact API behavior.

Loading a prefab through Addressables and cloning it with ordinary `Object.Instantiate` are separate operations. The clone does not automatically acquire another Addressables load reference, so retain the required assets for as long as the clones need them. If you instantiate through Addressables instead, use the release method documented for that operation. The [Addressables operation-handle guide](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetsAsyncOperationHandle.html) describes these lifetimes.

A game-owned adapter can represent an acquired asset as a lease: an object that provides the result and one way to release it. Decide who holds that lease. A cache might retain it while views borrow access, or each view might acquire and release its own load. Make borrowed and owned references distinguishable, so callers know which ones they must release.

Check the cleanup required when a load fails. Keep error handling and release logic together, so cancellation, failure, and a successful but stale result all follow the ownership rules.

An asynchronous load can still perform work on the main thread. Deserialization, object creation, shader work, and scene activation may cause hitches after the bytes arrive. Measure the time until the content is ready to use, including those steps.

Addressables can load local content without a remote service. Choose it when the feature needs its loading and lifetime controls. Direct serialized references may be simpler for small always-resident assets.

?? assets-clone-lifetime A prefab is loaded through Addressables, then cloned with ordinary `Instantiate`. What should the owner ensure?
* The required assets stay acquired for as long as the clones need them.
- Every clone automatically increments Addressables' reference count.
- Releasing the load handle always preserves every dependency indefinitely.
- The clone becomes a serialized project asset.
> An ordinary clone does not automatically create another Addressables reference. Its owner must keep the required load alive.

?? assets-release-memory [tf] Releasing one Addressables handle guarantees an immediate equal-sized decrease in process memory.
* false
> Other owners, bundle dependencies, and allocator behavior can retain memory. Handle accounting and process memory are related but not identical.

## Choose loading boundaries from peak memory and latency {#assets-loading-boundaries}

Suppose scene A uses 300 MB of content and scene B uses 250 MB. Keeping A loaded while loading B can require much more memory than either scene uses alone. Compressed data, decompressed buffers, and engine objects may all overlap during the transition. Shared dependencies save memory only if packaging and loading actually share them.

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

Create a bounded set of pooled objects and expensive visual variants before the phase that needs them. Loading everything “to prevent hitches” can exhaust memory, while loading everything on demand can cause stalls at first use. Measure both first-use delay and retained memory on target devices to decide what to preload.

A live game also needs compatibility between its content catalog and installed binary. A downloaded asset may require scripts or shaders that an older binary does not contain. Check that the client can use the content, as well as whether it downloaded successfully.

?? assets-peak-memory Why can a scene transition exceed both scenes' individual memory footprints?
* Old and new content can overlap with temporary loading buffers and shared resources.
- A scene can never unload resources.
- Memory usage is always exactly the size of the largest texture.
- Asynchronous loading removes all temporary allocations.
> During a transition, old content, new content, and temporary buffers can all be in memory together. Measuring each scene only after loading can miss that peak.

?? assets-bundle-grouping Which consideration should influence asset bundle grouping?
* Which assets are used together and have similar lifetimes.
- Alphabetical order alone.
- The assumption that more bundles always means less memory.
- The assumption that one bundle always minimizes loading cost.
> Grouping determines dependency and residency behavior. Co-usage and measured overhead matter more than a universal bundle-count rule.

## Account for job ownership and scheduling overhead {#async-jobs-burst}

The Job System schedules work using explicit dependencies. Jobs commonly process native containers under defined access rules, and Burst can compile supported code for efficient execution. These tools do not make arbitrary MonoBehaviour objects safe to access in parallel. [Unity's Job System overview](https://docs.unity3d.com/6000.0/Documentation/Manual/job-system.html) introduces the model.

First identify calculations that can run independently, such as distances between many entities using a snapshot of their positions. Read data from Unity objects where their APIs permit it. Then schedule jobs over that data, and apply the results once the required work has completed.

Scheduling and synchronization both cost time. For a small array, an ordinary loop may be faster than creating a job and waiting for it. Calling `Complete` immediately after scheduling also leaves little chance for useful overlap. Where the feature's response-time requirements allow it, schedule early, perform other independent work, and wait when you actually need the results.

Keep native containers alive for every job that uses them. Disposing a buffer, or reusing it for another owner, while a scheduled job still reads it is unsafe. Express the job dependencies, choose an allocator whose lifetime fits the work, and follow the API's rules for release after completion.

Data-oriented design organizes data around how it is accessed: keep relevant values together, reduce pointer chasing, and process them in a form suited to the operation. An Entity Component System (ECS) is one way to do that. Arrays and jobs can also be useful without an ECS migration. Such a migration needs to justify its cost to authoring tools, integration, and the team.

Parallel execution can affect reproducibility. A floating-point sum may change when values are added in a different order. If the authoritative simulation must produce identical results, define the numeric and scheduling rules that will preserve that requirement.

?? async-job-worthwhile When is moving a loop to jobs most promising?
* It has enough independent work to outweigh scheduling and synchronization costs.
- It reads arbitrary scene objects from worker threads.
- It consists of one trivial operation followed by an immediate wait.
- It has unknown ownership of the input buffer.
> Parallel work helps when there is enough computation to cover scheduling costs, and other useful work can run before the results are needed.

?? async-native-lifetime A job still reads a native buffer. When can its owner safely dispose or reuse that buffer?
* After the relevant dependencies complete, following the container's ownership contract.
- Immediately after scheduling, because the job copied every byte automatically.
- Whenever the view is hidden, regardless of job state.
- Only after garbage collection decides the buffer is unreachable.
> Keep native data alive until every scheduled job using it has finished. Managed garbage collection does not wait for those jobs or release the buffer for you.
