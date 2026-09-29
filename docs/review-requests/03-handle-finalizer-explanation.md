# An explanation rejects freeing a handle in the adapter's finalizer for a reason that does not hold in the chapter's own design

**Kind:** Accuracy. **Priority:** Low. **Touches:** question block, the explanation line of one variant; no option, prompt or answer changes.

## Location

`content/mobile-platform/03-ios-bridge.md:500-501`, concept `ios-callback-handle`, third variant (“When should the adapter free the context handle of a native operation?”):

- the option at line 500: “In the adapter's finalizer, when the garbage collector reclaims the adapter”
- the explanation at line 501: “… and a finalizer does not run while a handle keeps its object reachable.”

## Evidence

The option is wrong, and the answer is right; the reason the explanation gives covers only one case. A finalizer is blocked by the handle only when the handle's target keeps the adapter reachable. In the chapter's own adapter (lines 384 to 404), the handle targets the `TaskCompletionSource<bool>` (`GCHandle.Alloc(result)`), and nothing in that completion source refers to the `IosCameraAccess` adapter. The adapter can therefore become unreachable and be finalized while iOS still holds the context, and a finalizer that frees the handle then frees it before the callback, which is the stale-slot reuse the section describes at line 414 (a freed slot given to the next allocation, so the late callback resolves another object). So there are two failures, depending on what the handle points at:

- the handle keeps the adapter reachable: the finalizer never runs, and the handle leaks;
- it does not: the finalizer can run first and free the handle early, the use-after-free the concept is about.

The explanation states the first as a fact and leaves out the second, which is the more dangerous one and the one the chapter's own code would meet.

## Proposed fix

Replace the last clause of the explanation at line 501:

> Native code holds the number until its final callback, so that callback is the one safe place to free it. A cancellation, or a continuation that a cancellation can trigger, frees it while the callback may still come. A finalizer runs at a time the garbage collector picks: never, if the handle keeps the adapter alive, or before the callback, if it does not.

Cost to review history: an explanation-only change inside a committed question block. It changes no option, prompt, answer or concept, so no variant's progress moves; it still needs the user's consent under **Committed question blocks**, and `npm run guard -- questions` reports it as a changed block.

## Repeated in

Nothing else; the prose at line 414 is correct and does not mention finalizers.
