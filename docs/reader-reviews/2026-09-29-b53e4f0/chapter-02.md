# Chapter 02: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order. Chapter 01's framing was read first, so prerequisite judgments follow the forward reading order.

Source: [02-android-bridge.md](../../../content/mobile-platform/02-android-bridge.md). Input: this chapter was reviewed in the working tree at `d55c2c8cd195ecd648d3451f2904a2d4d7250382` (clean), not at this run's `b53e4f0` snapshot. SHA-256 as read: `ba2e70bc70a6abbaff28da316eeb196715d33d08b9023ecbe8ca64700d795e3c`. Since `b53e4f0` the file changed in four lines, all chapter mentions turned into `[[#id]]` links (lines 137, 446, 462 and 721). Line numbers below refer to the `d55c2c8` file.
Coverage: 6 sections, 12 concepts, 38 variants; all prose, tables, code, exercises, options and explanations read. The glossary entries for JNI, ANR, ABI, logcat and Gradle were checked where the chapter relies on them.

**Learner experience: 8/10. Writing: 8/10.** This is a clear, well-paced chapter. It opens by settling the “main thread” naming collision and keeps to its convention throughout. Each API is followed by the failure it produces, shown with its real log line, and the deadlock timeline makes a subtle hazard visible. The friction is local. The first lab needs a mechanism the chapter teaches two sections later, the helper-activity example stops short of the call that starts it, and the activity section ends on a configuration-change topic that its concept then has to assess alongside link routing.

**Preserve:** The entry-point table and the Looper explanation of why plugins break under GameActivity; the UI thread versus main thread convention; the JNI signature and `NoSuchMethodError` walk-through; the kept-wrapper and batched-call examples; the deadlock timeline; the proxy versus `UnitySendMessage` table; the exported-project ABI listing; the failure table ordered from the easiest evidence to the hardest.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| What runs where in a Unity Android app<br>`android-runtime-model` | 8 | 8 | 8 | 8 | 9 | 8 | Process, entry points and threads build in order; the lab depends on proxies, which come later (RR-02-01). |
| AndroidJavaObject, AndroidJavaClass, and the cost of JNI<br>`android-java-calls` | 9 | 8 | 9 | 8 | 8 | 8 | Signature, lookup, references and cost are each shown with code or an error; no material finding. |
| Callbacks into C#: AndroidJavaProxy and UnitySendMessage<br>`android-callbacks` | 9 | 8 | 8 | 8 | 8 | 8 | Full proxy example, deadlock timeline and comparison table; one proxy-lifetime paragraph is dense but coherent. |
| Plugin forms: sources, AARs, library folders, and native libraries<br>`android-plugin-forms` | 8 | 8 | 8 | 7 | 8 | 8 | The forms table and ABI listing make packaging concrete; the dated 16 KB paragraph is labeled with its date; no material finding. |
| Activities, intents, and results without subclassing Unity's activity<br>`android-activity-integration` | 7 | 8 | 6 | 7 | 8 | 7 | The helper activity is not wired to C# (RR-02-02), and the configChanges topic is attached at the end (RR-02-03). |
| When the Android side fails: exceptions, native crashes, and ANRs<br>`android-failure-evidence` | 8 | 7 | 8 | 7 | 8 | 7 | Strong table and concrete lab; the symbols paragraph carries four points at once (RR-02-04). |

## Findings and proposed changes

### RR-02-01: Do not ask for a proxy callback before proxies are taught

Medium priority. Scope: prose (exercise). Section: `android-runtime-model`. Source: [02-android-bridge.md, line 56](../../../content/mobile-platform/02-android-bridge.md#L56).

> and from a Java callback that comes back through a proxy

`AndroidJavaProxy` is introduced in `android-callbacks` (line 245), two sections later. A reader who does the lab when they reach it cannot build the third leg, and the lab gives no expected result. The lab's point is that thread names differ between entry points, so under GameActivity the reader needs to know what a native game-loop thread looks like in the log. Proposal: move the proxy leg to the callbacks lab (line 369), which already asks for the thread each version runs on. Here, keep the C# caller and the Java method, and say what to expect: `UnityMain` under Activity, and the thread GameActivity's glue starts under GameActivity.

### RR-02-02: Show how the helper activity is started and how its result reaches C#

Medium priority. Scope: code presentation. Section: `android-activity-integration`. Source: [02-android-bridge.md, line 574](../../../content/mobile-platform/02-android-bridge.md#L574).

> `PickImageBridge.deliver` passes the result to a listener that a C# proxy implements, and the C# side completes a task with it.

The example gives the helper activity and its manifest entry, but not the two pieces that make it usable: the call that starts `PickImageActivity` from the game's activity, and `PickImageBridge` with its listener. The section's claim is that the helper “is the general answer”. Without those pieces a reader cannot assemble it, especially since the proxy-with-task pattern has to be pieced together from two earlier sections. Proposal: add a short `PickImageBridge` (a listener interface, a static `start(Activity, Listener)` that stores the listener and calls `startActivity`, and `deliver`). Add a C# method of about ten lines that creates the proxy, completes a `TaskCompletionSource<string>` through the main-thread queue from `android-callbacks`, and returns the task. Alternatively, list those steps in prose with links to the two sections.

### RR-02-03: Separate configuration changes from link routing

Medium priority. Scope: prose and question/concept structure. Section: `android-activity-integration`. Sources: [line 587](../../../content/mobile-platform/02-android-bridge.md#L587) and the variant at [line 642](../../../content/mobile-platform/02-android-bridge.md#L642).

> The generated manifest also lists fifteen configuration changes in `android:configChanges`

The section is about getting results and intents without a subclass. The `configChanges` material arrives after the links topic closes, without a heading or a transition that ties it to the section's purpose. Its one assessment is a variant of `android-new-intent`, whose other variants test how a link reaches the running activity. The explanation links the two (“As with a link routed to the running instance”), but that one concept now tracks two skills. On a study pass the learner may be tested on either one and never see the other. Proposal, prose only: add a short internal heading, such as “Changes that do not recreate the activity”, and one sentence tying it to the section: the running activity receives the change, as it receives new intents. Question structure, only with consent: move the rotation variant into its own concept, or accept the pairing and record the reason.

### RR-02-04: Split the symbols paragraph into matching and keeping

Low priority. Scope: prose. Section: `android-failure-evidence`. Source: [02-android-bridge.md, line 721](../../../content/mobile-platform/02-android-bridge.md#L721).

> So each build's symbols are kept with it.

The paragraph, about 190 words, covers four points: `ndk-stack` refuses a mismatch; rebuilds and development or release builds differ; where Unity and Gradle write symbols; and Google Play's upload rule. A reader looking for where the symbols are has to read through the argument for why they must match. Proposal: end the first paragraph at “So each build's symbols are kept with it.” Then start a new paragraph, or use a small table (source, location, setting), for the zip beside the build, the exported project's `unityLibrary/symbols/<abi>/` and the Play upload. Keep the links to Chapters 5 and 11.

### RR-02-05: Link the remaining backward chapter mentions

Low priority. Scope: prose (links only). Sections: `android-callbacks`, `android-activity-integration`. Sources: lines [333](../../../content/mobile-platform/02-android-bridge.md#L333), [367](../../../content/mobile-platform/02-android-bridge.md#L367), [523](../../../content/mobile-platform/02-android-bridge.md#L523) and [583](../../../content/mobile-platform/02-android-bridge.md#L583); also the explanation at [line 472](../../../content/mobile-platform/02-android-bridge.md#L472).

> the callback that never arrives from chapter 1.

Phase 34 linked most chapter mentions, but these remain plain text: three to Chapter 1, one to Chapter 4 and, in an explanation, one to Chapter 5. Each points to a specific idea the reader may want to recheck: the proxy exception rule, the boundary, the deadline for a missing callback, and permissions. Proposal: `[[#platform-results-threads | chapter 1]]`, `[[#platform-events | chapter 1]]`, `[[#os-permissions | chapter 4]]` and `[[#gradle-manifest-merge | Chapter 5]]` as appropriate. The explanation link is inside a question block and needs consent.

## Exercises and assessment

All 38 variants were read. The pools track the taught decisions closely. The Looper variant (line 78) and the reversed-ABI variant (line 491) are good transfer questions, because they change the situation the prose used and still test the same mechanism. The multi-select entry-point variant separates what the entry point decides from what it does not. Apart from `android-new-intent` (RR-02-03), each concept tracks one skill.

The labs have concrete failure recipes. The failure-evidence lab names `Utils.ForceCrash` and a blocking `InvokeOnUIThread`, and it asks the reader to read the exit reason at the next launch, which ties the lab to the `LastExit` code. The AAR exercise works on any project with an SDK. Every lab needs an Android device, or at least an emulator. The chapter does not say an emulator is enough for the thread and crash labs, although it would help readers without a device.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> The `onDestroy` path is there because of Unity's launch mode.

After:

> The `onDestroy` path handles the case in which the helper is closed before it has a result, which Unity's launch mode makes possible.

Before:

> A stuck main thread with a free UI thread freezes the picture without being an ANR by Android's definition.

After:

> When the main thread is stuck and the UI thread is free, the picture freezes, but Android does not report an ANR.

## Technical referrals to Phase 35

Unverified; recorded for the technical read, not asserted as errors.

- Line 189: that `AndroidJNI.InvokeAttached(action)` exists in Unity 6.3 with the attach, run and detach behavior described.
- Line 687: that GameActivity's native pause handler waits for the main thread with no time limit in the reference versions, since the ANR explanation depends on it.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Reviewed at `d55c2c8` with the hash above, not at this run's `b53e4f0` snapshot. Cross-chapter comparisons remain provisional until the synthesis. Committed question changes require the separate consent described in the shared plan.
