# The thread table says an awaited Task always resumes “on a later frame”, but the chapter's own queue resumes it at once

**Kind:** Accuracy. **Priority:** Low. **Touches:** prose (one table row and the paragraph after it); no question block.

## Location

- `content/mobile-platform/01-platform-layer.md:288`: “| `await` a `Task`, starting on the main thread | The main thread, on a later frame, whichever thread completed the task |”
- `content/mobile-platform/01-platform-layer.md:293`: “The queue is the most explicit of the four and the easiest to log, which is why the example above uses it.”

## Evidence

“Whichever thread completed the task” includes the main thread, and in the chapter's own `BuyAsync` (lines 262 to 280) the main thread is exactly where the task completes: `Complete` enqueues `result.TrySetResult(outcome)` on `mainThread`, a queue drained on the main thread.

When a `Task` is completed on the thread whose current `SynchronizationContext` is the one the `await` captured, the continuation runs inline, inside the call that completes it, and is not posted. Unity's own class library does this. `monodis` of `MonoBleedingEdge/lib/mono/unityjit-linux/mscorlib.dll` in the 6000.3.11f1 Editor, `SynchronizationContextAwaitTaskContinuation::Run`:

```text
IL_0000:  ldarg.2                       // canInlineContinuationTask
IL_0001:  brfalse.s IL_0027
IL_0004:  ldfld ... m_syncContext
IL_0009:  call SynchronizationContext::get_Current()
IL_000e:  bne.un.s IL_0027              // different context: post (IL_0027)
IL_0011:  call AwaitTaskContinuation::GetInvokeActionCallback()   // same context: run now
```

A .NET 8 probe (scratch only) with a stand-in for `UnitySynchronizationContext` whose `Post` queues work for a later “frame” printed:

```text
  Post called
frame 1 ends
  other-thread completion: resumed in frame 2, thread 1
frame 3 drain loop starts
  main-thread completion: resumed in frame 3, thread 1
frame 3 drain loop ends
```

Completion from another thread is posted, and Unity's page [Awaitable completion and continuation](https://docs.unity3d.com/6000.3/Documentation/Manual/async-awaitable-continuations.html) backs the “later frame” for that case: “the continuation is posted to the UnitySynchronizationContext and runs on the next frame Update tick on the main thread.” Completion on the main thread is not posted: the awaiting method runs inside the drain loop, in the same frame, before the loop moves to its next item. The table's fourth row says so for the queue (“inside the drain loop”), so rows one and four contradict each other for the chapter's own design. It matters to an adapter author: code after the `await` runs re-entrantly inside the drain, so a caller that enqueues more work, or blocks, does so inside the loop.

## Proposed fix

Row 1:

> | `await` a `Task`, starting on the main thread | The main thread: at once, inside the call that completes it, when that call is on the main thread; otherwise when Unity next runs posted work, usually the next frame |

Add to the end of the paragraph at line 293:

> With the queue, the task completes on the main thread, so the awaiting method runs inside the drain loop, before the next queued item.

## Repeated in

`platform-callback-thread`, first variant (line 335), accepts “On the main thread, on a later frame, through Unity's synchronization context” for a task completed by a Java callback. That case is posted, so the answer is right and needs no change.
