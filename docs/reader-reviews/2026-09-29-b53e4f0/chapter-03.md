# Chapter 03: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order. Chapter 01's framing was read first, so prerequisite judgments follow the forward reading order.

Source: [03-ios-bridge.md](../../../content/mobile-platform/03-ios-bridge.md). Input: this chapter was reviewed in the working tree at `d55c2c8cd195ecd648d3451f2904a2d4d7250382` (clean), not at this run's `b53e4f0` snapshot. SHA-256 as read: `09edfd6a53996119b15f39d2ee8037c6d42a288a7439726f7a7c3ee411486476`. Since `b53e4f0` the file changed in three lines, all chapter mentions turned into `[[#id]]` links (lines 8, 744 and 860). Line numbers below refer to the `d55c2c8` file.
Coverage: 6 sections, 12 concepts, 47 variants; all prose, tables, code, exercises, options and explanations read. The glossary entries for ARC, dispatch queue, P/Invoke, entitlements and app extension were checked where the chapter relies on them.

**Learner experience: 8/10. Writing: 7/10.** The chapter is the iOS counterpart of Chapter 2, and it earns its depth. Each ownership and threading rule comes with the generated code or the failure it prevents, so the reader learns why the rule holds as well as what it is. Friction is concentrated in two places. The opening packs the whole launch sequence into one paragraph, and the frameworks section runs five topics together without internal headings. Several labs and one explanation also rely on material the reader has not been given.

**Preserve:** The four-target table and the sampled main-thread stack; the marshaling table with the abridged IL2CPP wrapper; the `bool`-in-a-struct demonstration (0 returned for a volume of 7); the context-handle reuse experiment; the function-pointer and `UnitySendMessage` comparison table; the idempotent post-processor with its Append-mode test; the termination table, which pairs each kind with where its evidence is.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| What runs where in a Unity iOS app<br>`ios-runtime-model` | 7 | 6 | 7 | 6 | 8 | 6 | Strong target and thread tables; the start-up chain is packed into one paragraph (RR-03-01), and the lab leaves out an API and the expected result (RR-03-02). |
| DllImport, __Internal, and marshaling<br>`ios-native-calls` | 9 | 8 | 9 | 8 | 8 | 8 | Consequences are numbered in prose, each demonstrated by a link error, generated code or a measured crash; no material finding. |
| Callbacks: MonoPInvokeCallback, function pointers, and UnitySendMessage<br>`ios-callbacks` | 8 | 8 | 8 | 8 | 8 | 8 | Complete worked adapter and a strong handle-lifetime argument; “the first two rules” leaves the reader to count them (RR-03-03). |
| Frameworks, xcframeworks, Swift, and Objective-C++<br>`ios-frameworks` | 7 | 7 | 6 | 7 | 8 | 7 | Each topic is well demonstrated, but five topics run together without internal headings (RR-03-04). |
| Change the Xcode project from C#: post-processing and app delegate hooks<br>`ios-xcode-postprocess` | 8 | 8 | 7 | 7 | 8 | 7 | Idempotence and ordering are well taught; two version-specific gaps arrive in one dense paragraph (RR-03-05). |
| When the iOS side fails: crash reports, terminations, and symbols<br>`ios-failure-evidence` | 8 | 7 | 8 | 7 | 8 | 7 | Useful table and dSYM matching commands; two explanations teach facts the prose does not (RR-03-06), and one return value can be misread (RR-03-07). |

## Findings and proposed changes

### RR-03-01: Give the launch sequence as steps

Medium priority. Scope: prose. Section: `ios-runtime-model`. Source: [03-ios-bridge.md, line 17](../../../content/mobile-platform/03-ios-bridge.md#L17).

> The framework calls `UIApplicationMain`, the entry point of UIKit, Apple's framework for an app's interface and life, with `UnityAppController` as the application delegate:

This paragraph brings in the Trampoline, `main.mm`, `NSBundle`, `UIApplicationMain`, UIKit, the application delegate, the scene delegate `UnityScene`, and the moment the engine, window and display link are created. It defines four of these terms in apposition along the way. The Unity reader is meeting most of them for the first time, and sentences of 50 to 70 words make them hold every link of the chain in memory before the display-link paragraph uses it. The paragraph that follows then adds the switched-off Metal display link (line 19), which is investigation detail the lesson does not need.

Proposal: keep one sentence of definitions, then give start-up as a numbered list: `main.mm` loads `UnityFramework`; the framework calls `UIApplicationMain` with `UnityAppController`; UIKit reports the window's foreground entry to `UnityScene`; `UnityScene` has the controller start the engine and add a display link to the main run loop. Move the Metal display-link remark into a short version note, or remove it. The sampled stack at line 21 then confirms steps the reader already has.

### RR-03-02: Name the API and the expected result in the thread lab

Medium priority. Scope: prose (exercise). Section: `ios-runtime-model`. Source: [03-ios-bridge.md, line 73](../../../content/mobile-platform/03-ios-bridge.md#L73).

> call it from `Update` and from the completion handler of an iOS API whose documentation names no queue

The learner has to find an iOS API with a completion handler, and has to know how to recognize a documented queue, before the lab can start. The chapter already supplies one: `AVCaptureDevice requestAccessForMediaType:` is documented to answer on “an arbitrary dispatch queue” (line 365). The lab also gives no expected observation, although line 416 shows that such a handler can answer on the main thread. A reader who sees `1` both times may conclude the handler is main-thread safe. The “drawing you made for Android in chapter 2” is Chapter 2's first lab and is not linked.

Proposal: name the camera or microphone request, say that `Update` must log 1 and the handler may log either value, and say that a result of 1 does not prove the contract (the point line 416 makes). Link the Android lab with `[[#android-runtime-model | chapter 2]]`.

### RR-03-03: List the callback rules instead of counting them

Low priority. Scope: prose. Section: `ios-callbacks`. Source: [03-ios-bridge.md, line 346](../../../content/mobile-platform/03-ios-bridge.md#L346).

> states the first two rules for every ahead-of-time platform

The rules are stated across three sentences in different forms: a consequence (“has to be static”), a test result (the missing mark), and an absence (“nothing in the wrapper catches”). The reader must work out that the first two are static and the attribute, and that the third is the exception rule, which Unity's page does not cover. Proposal: after the wrapper, list the three rules (a static method; `[MonoPInvokeCallback]`; catch everything inside), then say that Unity's page states the first two and that the third follows from the wrapper having no handler. The table and the later exception paragraph can stay as they are.

### RR-03-04: Give the frameworks section internal headings

Medium priority. Scope: section structure (headings only; no ID or concept change). Section: `ios-frameworks`. Source: [03-ios-bridge.md, line 513](../../../content/mobile-platform/03-ios-bridge.md#L513).

> Native code reaches an iOS build in five forms, and what separates them is when their code joins the game:

The section then teaches five topics in sequence: embedding dynamic frameworks, device and Simulator slices, categories and `-ObjC`, Swift through `@c`, and Objective-C++ with ARC. Each has its own failure and fix, and the lab and three concepts address them separately. Without headings, a reader returning to fix a `Library not loaded` or an unrecognized selector has to scan about 80 lines of prose. The dense embedding paragraph at line 525 also covers `@rpath`, embedding, the nested-bundle rule, the importer setting and a test result together. ARC gets its explanation here (line 591), although line 269 already relies on it. The glossary link there resolves the dependency, so this is a placement note only.

Proposal: add level-three headings such as “Dynamic frameworks must be embedded”, “Device and Simulator slices”, “Categories and `-ObjC`”, “Swift”, and “Objective-C++ and ARC at the boundary”. Split line 525 after “which Xcode calls embedding.” Section ID, concepts and progress are unaffected.

### RR-03-05: Separate the two 6000.3.11f1 gaps and say what closes the first

Low priority. Scope: prose. Section: `ios-xcode-postprocess`. Source: [03-ios-bridge.md, line 744](../../../content/mobile-platform/03-ios-bridge.md#L744).

> which the export leaves at 0 until something sets it

Two version-specific findings (the push-token preprocessor flag and link delivery to the scene delegate) share one 100-word paragraph. The first leaves the learner without a next step: what normally sets `UNITY_USES_REMOTE_NOTIFICATIONS`, and whether it is the team's post-processor. Proposal: present the two gaps as a labeled two-item list for 6000.3.11f1. For the first gap, name what sets the flag, or point to the Chapter 4 section that does (`[[#os-notifications]]`). Leave the verification of what sets it to Phase 35 (see referrals).

### RR-03-06: Keep question explanations within what the prose teaches

Low priority. Scope: question blocks (explanations; requires consent). Section: `ios-failure-evidence`. Sources: [line 901](../../../content/mobile-platform/03-ios-bridge.md#L901) and [line 941](../../../content/mobile-platform/03-ios-bridge.md#L941).

> An uncaught exception ends with `SIGABRT` and a `Last Exception Backtrace`

> since the watchdog ends the process with `SIGKILL`

Neither signal appears in the section's prose or its table. The prose identifies an Objective-C exception by `Terminating app due to uncaught exception` and the watchdog by `0x8badf00d`. An explanation that relies on untaught facts reads as the reason for the answer, yet the learner cannot check it against the section. Proposal: add both signals to the termination table's evidence column, which is the smaller change and keeps the explanations. Alternatively, reword the explanations to use the evidence the prose names. Only the explanation route touches question blocks.

### RR-03-07: Avoid a return value that reads as success

Low priority. Scope: prose. Section: `ios-failure-evidence`. Source: [03-ios-bridge.md, line 830](../../../content/mobile-platform/03-ios-bridge.md#L830).

> With the flag, the test's bridge caught the exception and returned 0 to C#.

Earlier in the chapter the bridge convention is an `OSStatus` where 0 means success (lines 221 and 245). A reader carrying that convention reads this as “the bridge reported success”, which is the opposite of the lesson. Proposal: “With the flag, the test's bridge caught the exception and returned its failure code to C#, and the game went on.” If the test really returned 0 as a failure value, say so explicitly.

### RR-03-08: Link the remaining backward chapter mentions

Low priority. Scope: prose (links only). Section: `ios-runtime-model`, `ios-callbacks`. Sources: lines [73](../../../content/mobile-platform/03-ios-bridge.md#L73), [125](../../../content/mobile-platform/03-ios-bridge.md#L125), [374](../../../content/mobile-platform/03-ios-bridge.md#L374) and [443](../../../content/mobile-platform/03-ios-bridge.md#L443).

> as the adapters in chapter 1 do:

Phase 34 linked the forward mentions in this chapter, but these four backward mentions of Chapters 1 and 2 remain plain text (line 125 is in a question explanation). A reader who wants to recheck the completion-source adapter has to find it without a link. Proposal: use `[[#platform-results-threads | chapter 1]]`, `[[#platform-interfaces | chapter 1]]` and `[[#android-runtime-model | chapter 2]]` as appropriate. The line 125 change is inside a question block and needs the same consent as any explanation edit, even though it only adds a link.

## Exercises and assessment

All 47 variants were read. The pools test decisions the prose teaches, and several use real error text as the stem (`Library not loaded`, `unrecognized selector`, `pointer being freed was not allocated`). That is strong preparation for the debugging interview. The `ios-main-thread` concept spans five variants over three ideas: which thread runs `Update`, what Multithreaded Rendering moves, and why UI work is posted. Every variant tests the same thread model, so that concept is coherent. `ios-termination-kinds` maps several failures to their evidence, which is one skill with many cases.

All the labs need a Mac and Xcode, and most need a device. The failure-evidence lab tells the reader to compare the device result with the Simulator, which partly covers readers without hardware. The native timer lab (line 445) gives no native code. A hint of `dispatch_after` and a cancelled flag would let a reader who is new to Objective-C start. The post-processor lab and the frameworks lab state their break-and-observe steps clearly.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> A listener hears what the delegate is told, and no more, and two gaps showed in 6000.3.11f1.

After:

> A listener hears only what the delegate is told. In 6000.3.11f1 that leaves two gaps:

Before:

> The 6000.3.11f1 code also holds a path for the newer Metal display link, switched off in that release with a comment about GPU timeouts; it would run on the same thread.

After (as a version note, or removed):

> In 6000.3.11f1 a Metal display-link path exists but is switched off; if it were on, it would use the same thread.

## Technical referrals to Phase 35

Unverified; recorded for the technical read, not asserted as errors.

- Line 744: what sets `UNITY_USES_REMOTE_NOTIFICATIONS` in a 6000.3.11f1 export (for example the Mobile Notifications package or a post-processor editing `Preprocessor.h`), so that RR-03-05 can name it.
- Lines 556–566: the `@c(Store_FetchPrices)` spelling and the claim that Swift 6.3 made `@c` official through SE-0495. The reader-facing sample depends on the exact attribute syntax the reference Xcode accepts.
- Line 830: the value the test bridge returned after catching the exception (see RR-03-07).

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Reviewed at `d55c2c8` with the hash above, not at this run's `b53e4f0` snapshot. Cross-chapter comparisons remain provisional until the synthesis. Committed question changes require the separate consent described in the shared plan.
