# Chapter 01: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order. This chapter's framing was read before Chapters 02 and 03 were judged.

Source: [01-platform-layer.md](../../../content/mobile-platform/01-platform-layer.md). Input: this chapter was reviewed in the working tree at `d55c2c8cd195ecd648d3451f2904a2d4d7250382` (clean), not at this run's `b53e4f0` snapshot. SHA-256 as read: `86d81175189dc18efb5944dab495ffea12d6d4dc9f03cdb3d4f317e2fbd321e5`. Since `b53e4f0` the file changed in three lines, all chapter mentions turned into `[[#id]]` links (lines 38, 258 and 476). Line numbers below refer to the `d55c2c8` file.
Coverage: 6 sections, 12 concepts, 28 variants; all prose, tables, code, exercises, options and explanations read. The glossary entries for strategy, observer, JNI and P/Invoke were checked where the chapter relies on them.

**Learner experience: 8/10. Writing: 8/10.** The chapter does what an opening chapter should. It gives the reader one call path and one evidence table that the rest of the book reuses, and it recaps each concept it takes from *The Game Layer* in a sentence rather than assuming it. It also teaches the boundary's design through patterns (adapter, facade, composition root, strategy, observer), each tied to a platform consequence. The friction comes from the third section. There, the exception rules of Chapters 2 and 3 arrive in compressed form before the reader has seen either bridge, and the central code sample uses a `mainThread` queue that is explained only later. A few sentences about assemblies and the composition root need to be read twice.

**Preserve:** The call path and evidence-per-layer table; the table of what an integration answer covers; the vendor-code mapping with `NetworkError` mapped to unknown; the costs of the boundary, stated as part of defending it; the five candidate implementations; the thread-resumption table; the early, repeated and late framing with its link timeline; the four-kind test ladder and the contract suite.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| How to study the platform layer<br>`platform-study-method` | 8 | 8 | 7 | 7 | 8 | 7 | Useful orientation; an assessed skill (what an integration answer covers) sits unmarked among orientation material (RR-01-01). |
| Own the interface: adapters and facades at the SDK boundary<br>`platform-interfaces` | 9 | 8 | 9 | 8 | 8 | 8 | Clear patterns and costs; the assembly paragraph carries two Unity defaults and their fixes at once (RR-01-06). |
| Choose implementations at the composition root<br>`platform-composition` | 8 | 7 | 8 | 8 | 8 | 8 | Symbol ordering is well explained; one sentence about referencing the adapter assembly is unclear (RR-01-04). |
| Results, errors, and threads at the boundary<br>`platform-results-threads` | 7 | 7 | 7 | 7 | 8 | 7 | Strong completion-source code and thread table; compressed forward material (RR-01-02) and an undefined `mainThread` (RR-01-03). |
| Events from the platform: early, repeated, and late<br>`platform-events` | 9 | 9 | 9 | 8 | 8 | 9 | Three timing problems, each with a mechanism and a remedy, then a router that unifies them; no material finding. |
| Test the boundary without a device, then on one<br>`platform-testing` | 8 | 8 | 8 | 8 | 8 | 8 | A clear ladder of test kinds; the contract suite's project setup is left implicit (RR-01-05). |

## Findings and proposed changes

### RR-01-01: Mark the integration-answer checklist as a lesson of its own

Low priority. Scope: prose (internal heading). Section: `platform-study-method`. Source: [01-platform-layer.md, line 60](../../../content/mobile-platform/01-platform-layer.md#L60).

> When an interviewer asks how you would integrate an SDK, the method calls are the part the vendor's documentation already gives you.

The section holds three tables and several paragraphs about scope, assumptions, reference versions and the imaginary game. The integration checklist that follows them is taught content, and one of the section's two concepts (`platform-integration-scope`) assesses it. From the title, “How to study the platform layer”, a reader may skim the section as front matter and miss it. Chapter 16's interview practice also builds on this checklist. Proposal: add a level-three heading before line 60, such as “What an integration answer covers”. Optionally move the reference-version paragraph (line 56) after the running-game paragraph, so the orientation reads scope, audience, example and then versions.

### RR-01-02: State the exception rule first and tabulate the platform details

Medium priority. Scope: prose. Section: `platform-results-threads`. Source: [01-platform-layer.md, line 258](../../../content/mobile-platform/01-platform-layer.md#L258).

> Under [[IL2CPP]], a C# exception is a C++ exception, and the wrapper IL2CPP generates for a callback that native code calls through a function pointer has no handler

The paragraph describes three crossings (Java into C# through `AndroidJavaObject`, Java calling a C# proxy, and native code calling a function pointer) in about 150 words. It uses `AndroidJavaObject`, `AndroidJavaProxy` and IL2CPP's reverse wrappers, which Chapters 2 and 3 introduce, and the rule the reader needs comes last. The linked chapters resolve the dependency, but only later. At this point the reader has to hold three unfamiliar mechanisms in mind to reach one rule. Proposal: open with the rule (“Exceptions do not cross the boundary as exceptions, so the adapter catches everything inside a callback and turns it into a result”). Then give a three-row table (direction, what happens, where it is taught), and keep the existing links. No technical content is lost.

### RR-01-03: Introduce the main-thread queue where the code uses it

Medium priority. Scope: code presentation. Section: `platform-results-threads`. Source: [01-platform-layer.md, line 270](../../../content/mobile-platform/01-platform-layer.md#L270).

> `mainThread.Enqueue(() => result.TrySetResult(outcome));`

`mainThread` is not declared in the sample. It is explained only in the fourth row of the table 20 lines later and in the sentence “which is why the example above uses it” (line 293). A reader studying the code first may take `mainThread` to be a Unity API. In the same sample, `PurchaseMapping.ToResult(native)` (line 277) calls a method that the mapping class shown earlier does not have: it defines `ToStatus` (line 124). Proposal: add a comment to the code, such as “`mainThread`: a queue that a main-thread component drains each frame; see the table below”. Either use `ToStatus` or say that `ToResult` wraps the status mapping into a `PurchaseResult`.

### RR-01-04: Clarify how the composition root can reference a platform-only assembly

Medium priority. Scope: prose. Section: `platform-composition`. Source: [01-platform-layer.md, line 208](../../../content/mobile-platform/01-platform-layer.md#L208).

> The composition root may still reference that assembly, because in the Editor the reference compiles to nothing

The phrase “the reference compiles to nothing” has no clear referent. It could mean the assembly reference, the `#if` branch, or the adapter type. The point that follows (a use outside the `#if` fails the Editor build) is the useful guard, but it is hard to reach. Proposal: “The composition root's assembly can still list the Android adapter's assembly as a reference. The Editor does not compile that assembly, so its types are usable only inside the root's Android branch, which the Editor skips. Named anywhere else, an Android type fails the Editor build at once with a missing-type error.” Phase 35 should confirm that this is the intended mechanism before the wording changes (see referrals).

### RR-01-05: Say where the contract suite lives and how its device run starts

Medium priority. Scope: prose and code presentation. Section: `platform-testing`. Source: [01-platform-layer.md, line 437](../../../content/mobile-platform/01-platform-layer.md#L437).

> One abstract test class states what every implementation of the interface must do, and two small subclasses run it

The table says the suite runs “Against the fake in the Editor, and the real adapter on a device”, and line 465 says the device run builds the Play Mode tests into a player. The reader is not told that both subclasses must therefore sit in a Play Mode test assembly, or whether the fake's run is Edit Mode or Play Mode in the Editor. They are also not told how `TestConfig.StoreSandbox` reaches the player. Someone who follows the earlier advice to run fakes in Edit Mode may put the abstract class in an Edit Mode assembly and find it cannot build into the player. Proposal: add two sentences. Name the test assembly type that holds the suite, say which Test Runner action runs each leg, and say that the device leg needs a sandbox store account configured in the build.

### RR-01-06: Present the two assembly defaults as a small table

Low priority. Scope: prose. Section: `platform-interfaces`. Source: [01-platform-layer.md, line 145](../../../content/mobile-platform/01-platform-layer.md#L145).

> Two of Unity's defaults work against this

The paragraph covers the assembly layout, `Assembly-CSharp` with Auto Referenced, precompiled DLLs referenced by every assembly, and two alternative fixes, in about 170 words. The two defaults and their fixes are parallel, and a two-row table (default, what it lets gameplay reach, fix) would make them easy to check against a project. The closing sentence about the compiler writing the review comment is worth keeping as the conclusion.

## Exercises and assessment

All 28 variants were read. The concepts track single skills well. `platform-call-path` asks which layer's evidence answers a specific question, and its push variant changes the domain while keeping the skill. `platform-callback-completion` covers a repeated callback, a callback that never arrives, and a late callback, which are the three edge cases the prose names. The distinction between `Task` and `AwaitableCompletionSource` resumption is tested in both directions. Explanations stand alone and restate the mechanism.

The exercises ask for a written analysis of “a project you know”. That suits the stated reader, who knows Unity, but a reader without a project that uses an SDK has no fallback. For the first exercise, a single sentence would do: “or use the purchase example above”. The contract exercise (line 309) is a good template, and Chapters 2 and 3 answer it for their bridges.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> By the second row, an adapter that completes an `AwaitableCompletionSource` from a Java or Objective-C callback moves the awaiting method onto the SDK's thread, where its next call to a main-thread API is illegal.

After:

> The second row is the trap: an adapter that completes an `AwaitableCompletionSource` from a Java or Objective-C callback moves the awaiting method onto the SDK's thread, where its next call to a main-thread API is illegal.

Before:

> The composition root may still reference that assembly, because in the Editor the reference compiles to nothing, and an Android type used outside its `#if` fails the Editor build at once with a missing-type error.

After: see RR-01-04.

## Technical referrals to Phase 35

Unverified; recorded for the technical read, not asserted as errors.

- Line 208: the mechanism by which the composition root can reference a platform-restricted adapter assembly while the Editor compiles (see RR-01-04).
- Lines 444–450: that `[Test] public async Task` methods run as written in the Unity Test Framework version that ships with 6000.3.11f1, in both the Editor and the player build.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Reviewed at `d55c2c8` with the hash above, not at this run's `b53e4f0` snapshot. Cross-chapter comparisons remain provisional until the synthesis. Committed question changes require the separate consent described in the shared plan.
