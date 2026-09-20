---
book: Unity Game Engineering
chapter: 07: Asynchronous work and asset ownership
---

## Coroutines, tasks, and Awaitable solve different problems {#async-models}

A coroutine suspends and resumes an iterator through Unity's scheduling. It does not move expensive synchronous work to another CPU thread. A long calculation before the next yield still blocks the main thread. Disabling a component alone does not stop its coroutines; deactivating its GameObject or destroying the component does. [Unity's coroutine manual](https://docs.unity3d.com/6000.0/Documentation/Manual/Coroutines.html) documents those lifecycle distinctions.

`Task` represents eventual completion, including failure or cancellation. Marking a method `async` does not automatically make it parallel: it begins synchronously and yields at an incomplete awaited operation. `Task.Run` schedules work on a thread-pool thread where supported; most Unity object APIs remain unavailable there.

Unity's `Awaitable` supports engine-aware asynchronous operations. Its instances are pooled and should not be awaited multiple times. Its continuations execute synchronously when completion is triggered, so the completing thread matters. [Unity's asynchronous programming reference](https://docs.unity.cn/6000.0/Documentation/Manual/AwaitSupport.html) explains its differences from `Task`.

Choose according to the operation:

| Need | Reasonable starting point |
| --- | --- |
| Sequence a short scene animation across frames | Coroutine or Unity Awaitable |
| Coordinate existing task-returning I/O | Task-based async flow |
| Process many independent numeric items | Job System, possibly Burst |
| Evaluate a small deterministic rule | Ordinary synchronous method |

The caller also needs a way to observe failures. An `async void` method cannot be awaited by its caller and does not expose a normal task result. Limit it to required event-handler boundaries, catch failures there, and put reusable work in a result-bearing asynchronous method.

Never block the main thread with `.Result` or `.Wait()` to turn an async API into a synchronous one. You can freeze rendering and, if completion needs the same synchronization context, deadlock. Design startup and screens to represent loading states instead.

?? async-coroutine-thread [tf] Moving a long CPU calculation into a coroutine automatically moves it off Unity's main thread.
* false
> Coroutines divide work across suspension points. Synchronous work inside each resumed segment still runs on the executing thread, normally Unity's main thread.

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

A view requests artwork for item A, closes, and is reused for item B. The A request finishes after B's request. If the continuation blindly assigns its result, the view displays the wrong item without any null reference.

Cancellation requests that work stop. It does not prove that the work stopped, that a callback cannot arrive, or that an already completed side effect was reversed. Some APIs accept a token only for waiting; the underlying load may continue.

Use both lifetime cancellation and result validity. Capture a request generation, cancel the previous request if supported, and compare the captured generation before applying the result. The comparison and assignment must occur on the appropriate thread without an intervening yield that lets the binding change.

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

The stale branch must release a successfully acquired resource. “Ignore the callback” is insufficient if the operation handed you a handle that now needs cleanup. If an adapter retains ownership until success is accepted, state that contract instead; exactly one owner must release.

Separate cancellation from timeout. A timeout means the caller stopped waiting at a deadline. The operation may still be running. For a reward request, reconcile using its stable operation ID. For an asset request, ensure eventual completion still leads to release.

?? async-stale-result A view now displays item B when item A's earlier load finishes. What should happen to A's successfully acquired owned asset?
* Reject it as stale and release its ownership according to the loader contract.
- Assign it because successful completion proves it is current.
- Ignore it without releasing any acquired handle.
- Reset the player's inventory to item A.
> Generation checks prevent stale presentation, and ownership cleanup prevents a leak. Both are needed.

?+ Request A completes after request B has rebound a pooled view. Cancellation of A was requested but ignored by the loader. Which check still protects the view?
* Compare A's captured binding generation with the view's current generation before applying the result.
- Check only that the pooled GameObject reference is non-null.
- Check only that A completed successfully.
- Allow every successful result to overwrite the current image.
> Object existence and successful loading do not establish that a result belongs to the current logical binding.

?+ Why is cancellation alone insufficient to prevent stale callbacks?
* Cancellation is cooperative and may race with completion or may not stop the underlying operation.
- Cancellation always rewinds all side effects.
- Tokens automatically compare item IDs.
- Cancellation only applies to value types.
> Requesting cancellation does not establish that a result is still valid for the current owner.

## Load assets with explicit leases and release rules {#assets-ownership}

An asset reference, an instance, and a load operation are different resources. Know which one an API returns and who owns it.

Addressables tracks load ownership through reference counts. Mirror explicit acquisitions with their appropriate releases. Releasing a handle does not necessarily free all associated memory immediately, because dependencies and bundles can remain resident. The [Addressables 1.21 memory guide](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/MemoryManagement.html) is a versioned example of these rules; use the installed package's documentation for exact API behavior.

If you load a prefab and instantiate it through ordinary `Object.Instantiate`, the clone does not automatically acquire a separate Addressables load reference. Keep the required asset ownership alive for those clones. If you use an Addressables instantiation operation, pair cleanup with that operation's documented release path. These lifetimes are described in the [Addressables operation-handle guide](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetsAsyncOperationHandle.html).

Represent acquisition as a lease in your game-owned adapter when that clarifies responsibility: the lease supplies the result and has one release operation. A cache can own a long-lived lease while views borrow access, or each view can own an independent acquisition. Do not mix borrowed and owned references without a convention.

Failed loads also need cleanup according to their operation contract. Keep error handling and release together so cancellation, failure, and stale success do not create different leak paths.

Loading asynchronously does not mean all work occurs off the main thread or that activation is free. Deserialization, object creation, shader work, and scene activation can still create hitches. Measure the entire ready-to-use path, not just the time until bytes are available.

Addressables can load local content without a remote service. Choose it when the feature needs its loading and lifetime controls. Direct serialized references may be simpler for small always-resident assets.

?? assets-clone-lifetime A prefab is loaded through Addressables, then cloned with ordinary `Instantiate`. What should the owner ensure?
* The required load ownership remains valid for the clones' lifetimes.
- Every clone automatically increments Addressables' reference count.
- Releasing the load handle always preserves every dependency indefinitely.
- The clone becomes a serialized project asset.
> Ordinary instantiation and Addressables acquisition are distinct operations. Do not assume a clone establishes a new package-managed lease.

?? assets-release-memory [tf] Releasing one Addressables handle guarantees an immediate equal-sized decrease in process memory.
* false
> Other owners, bundle dependencies, and allocator behavior can retain memory. Handle accounting and process memory are related but not identical.

## Choose loading boundaries from peak memory and latency {#assets-loading-boundaries}

Scene A uses 300 MB of content. Scene B uses 250 MB. A transition that keeps A alive while loading B can require much more than either scene alone, especially while compressed data, decompressed buffers, and engine objects overlap. Shared dependencies reduce duplication only when packaging and loading actually share them.

Include overlapping and temporary resources in the transition estimate:

```text
Peak resident memory approximately includes:
  old scene still retained
  new scene becoming resident
  temporary loading/decompression buffers
  shared services and pools
  graphics resources and transient render targets
```

If peak memory is too high, release old scene ownership earlier, stage new content, reduce simultaneous temporary buffers, or use a lightweight transition scene. Each change affects latency and presentation. A loading screen can be a useful budget boundary, but it does not justify an unbounded stall.

Bundle grouping affects how much you can release. A small, frequently used icon can keep a bundle containing a large environment resident. Splitting everything into separate bundles also adds overhead and can increase dependency churn. Group assets by when they are used and released, then check the resulting build and runtime behavior.

Prewarm pools and expensive visual variants during an appropriate phase, with a cap. Loading everything “to prevent hitches” can cause low-memory termination. Delaying everything until first use can cause first-use stalls. Measure first-use latency and retained memory on target devices to choose the preload set.

For a live game, catalog and binary compatibility add another constraint: a downloaded asset can require scripts or shaders absent from an older binary. Content delivery needs a capability contract, not merely a successful download.

?? assets-peak-memory Why can a scene transition exceed both scenes' individual memory footprints?
* Old and new content can overlap with temporary loading buffers and shared resources.
- A scene can never unload resources.
- Memory usage is always exactly the size of the largest texture.
- Asynchronous loading removes all temporary allocations.
> Peak memory includes concurrent ownership and temporary work. Steady-state measurements alone can miss transition failures.

?? assets-bundle-grouping Which consideration should influence asset bundle grouping?
* Which assets are used together and have similar lifetimes.
- Alphabetical order alone.
- The assumption that more bundles always means less memory.
- The assumption that one bundle always minimizes loading cost.
> Grouping determines dependency and residency behavior. Co-usage and measured overhead matter more than a universal bundle-count rule.

## Account for job ownership and scheduling overhead {#async-jobs-burst}

The Job System schedules work with explicit dependencies. Jobs commonly operate on native containers with restricted access patterns; Burst can compile supported code for efficient execution. Neither mechanism automatically makes an arbitrary MonoBehaviour graph safe to process in parallel. [Unity's Job System overview](https://docs.unity3d.com/6000.0/Documentation/Manual/job-system.html) introduces this model.

First identify independent work: for example, computing distances for many entities from a snapshot of positions. Collect data from Unity objects where those APIs are supported, schedule the computation over that data, and apply results when dependencies have completed.

Scheduling has overhead. For a small array, a straightforward loop may finish before a job's scheduling and synchronization costs are recovered. If the main thread immediately calls `Complete` after scheduling, there may be little overlap. Schedule before other independent work and wait when the results are needed, within the feature's latency limit.

Native memory requires explicit lifetime management. A scheduled job must not read a container already disposed or reused by another owner. Express dependencies, use the correct allocator lifetime, and release only when work is complete according to the relevant APIs.

Data-oriented design focuses on access patterns: contiguous relevant data, fewer pointer hops, and processing that matches the operation. Entity Component System architecture is one way to pursue it, but it is not a prerequisite for using arrays or jobs. A migration to ECS is a major design choice whose authoring, integration, and team costs need justification.

Parallelism also changes reproducibility. Floating-point reductions can produce different results when addition order changes. A deterministic authoritative simulation needs an explicit numerical and scheduling strategy.

?? async-job-worthwhile When is moving a loop to jobs most promising?
* It has enough independent work to outweigh scheduling and synchronization costs.
- It reads arbitrary scene objects from worker threads.
- It consists of one trivial operation followed by an immediate wait.
- It has unknown ownership of the input buffer.
> Parallel execution is useful when the workload, data access, and timing allow real overlap at acceptable overhead.

?? async-native-lifetime A job still reads a native buffer. When can its owner safely dispose or reuse that buffer?
* After the relevant dependencies complete, following the container's ownership contract.
- Immediately after scheduling, because the job copied every byte automatically.
- Whenever the view is hidden, regardless of job state.
- Only after garbage collection decides the buffer is unreachable.
> Native data lifetimes must cover every scheduled use. Managed garbage collection does not supply this synchronization.
