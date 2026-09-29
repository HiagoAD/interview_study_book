# Chapter 15: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [15-debugging-across-boundaries.md](../../../content/mobile-platform/15-debugging-across-boundaries.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 5 sections, 10 concepts, 50 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 8/10. Writing: 8/10.** The chapter teaches disciplined diagnosis through concrete contrasts and an unusually useful purchase trace. The native-crash case and the exercises need more observable intermediate evidence for the reader to practise the method independently.

**Preserve:** The distinction between an observation and a conclusion; the boundary evidence table; separating absence of logs from proof of absence; the sanitized purchase trace; recovery without duplicate grants; careful limits on diagnostic builds.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Follow one operation through every layer<br>`boundary-method` | 9 | 9 | 9 | 8 | 9 | 9 | A concrete opening, useful map and explicit hypothesis make the method memorable; no material prose defect. |
| Works in the Editor, fails on the device<br>`boundary-editor-device` | 8 | 8 | 8 | 8 | 8 | 8 | The symptom table organizes a broad recap effectively; its question concept is broader than its label suggests (RR-15-03). |
| Works in development, fails in production<br>`boundary-dev-prod` | 8 | 8 | 8 | 8 | 8 | 8 | Artifact comparisons are actionable and well scoped; the final paragraph compresses three operational steps. |
| Worked case: purchases fail in production after an SDK update<br>`boundary-purchase-case` | 8 | 8 | 7 | 7 | 8 | 8 | The trace supports the diagnosis; a long recovery detour needs internal landmarks (RR-15-02). |
| Native crashes after an SDK update: a second case<br>`boundary-crash-case` | 7 | 8 | 7 | 8 | 8 | 7 | The case supplies tools and hypotheses but skips the observations selecting the winning hypothesis (RR-15-01). |

## Findings and proposed changes

### RR-15-01: Show the decisive crash evidence

High priority. Scope: prose and code presentation. Section: `boundary-crash-case`. Source: [15-debugging-across-boundaries.md, line 495](../../../content/mobile-platform/15-debugging-across-boundaries.md#L495).

> In this case, the evidence eventually shows a worker-thread callback entering a Unity object API.

The resolution announces the cause after a table of plausible alternatives. The reader never sees the callback thread, main-thread identity, error-path code or before/after trace that selects this explanation. For a worked debugging case, that missing step obstructs imitation of the method. Add a short fictional paired trace and the queue-bypassing branch, then explain which alternatives each observation weakens. Keep the diagnosis explicitly fictional and do not imply that a stack alone proves it.

### RR-15-02: Give diagnosis and recovery separate landmarks

Medium priority. Scope: prose structure. Section: `boundary-purchase-case`. Source: [15-debugging-across-boundaries.md, line 332](../../../content/mobile-platform/15-debugging-across-boundaries.md#L332).

> Fixing new attempts leaves purchases from the incident unresolved.

The case shifts from finding a DTO mismatch to compatibility, a five-step recovery sequence, store deadlines, revocations, iOS differences and verification without subheadings. All are relevant, but readers searching for the diagnostic chain must repeatedly locate its end. Add internal headings for containment, evidence, contract repair, backlog recovery and verification. Keep the recovery detail and its qualifications; shorten only repeated framing.

### RR-15-03: Separate diagnostic method from mechanism recall

Medium priority. Scope: question blocks and concept structure. Section: `boundary-editor-device`. Source: [15-debugging-across-boundaries.md, line 146](../../../content/mobile-platform/15-debugging-across-boundaries.md#L146).

> ?? boundary-first-split A Java class lookup fails in a device build.

This section has one concept with eight variants spanning R8, DTO stripping, cleartext policy, frameworks, privacy keys, threads, file access and ABI. A correct answer to the initial R8 comparison can advance the concept without demonstrating the other mechanisms. Audit which variants truly assess choosing a discriminating observation and which require independently retained platform knowledge. Propose concept changes only where that distinction matters; retain IDs where possible and explicitly account for review history before any approved migration.

### RR-15-04: Offer a supplied practice case

Medium priority. Scope: prose and exercise. Section: `boundary-crash-case`. Source: [15-debugging-across-boundaries.md, line 501](../../../content/mobile-platform/15-debugging-across-boundaries.md#L501).

> Lab exercise: Reduce one SDK problem to a minimal project while preserving its failure.

The final exercise requires access to a reproducible SDK fault and matching crash artifacts. That is reasonable professional practice but is not guaranteed for this learner. Supply a small invented diagnostic packet or a paper exercise using the chapter's traces, with a sample reduction log and acceptance criteria. Keep the real-project exercise as the fuller option. The earlier personal-bug exercises can use the same supplied case as a fallback.

## Exercises and assessment

All 50 variants were read. Most ask for a justified next observation and explain why attractive shortcuts fail. The purchase section appropriately distinguishes diagnosis, recovery and prevention in three concepts. Several wrong options in mechanism questions are from unrelated domains, which can make selection easier than constructing an investigation; use a few competing explanations at the same boundary in a later authorized question pass. The crash-cluster concept also mixes clustering, symbol matching, loading, packaging and memory ownership; review it alongside RR-15-03. Reflective exercises have clear deliverables but depend on personal incident access (RR-15-04).

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> The first observation should separate mechanisms. A build with several settings changed at once makes a poor comparison. The rows below name observations to collect before deciding the fix:

After:

> Choose an observation that distinguishes the possible causes. Collect the evidence in the table before changing build settings; changing several settings at once makes the result harder to interpret.

Before:

> Duplicate native files also have two different stages.

After:

> Distinguish a duplicate-file build failure from the runtime effects of selecting one of those files.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
