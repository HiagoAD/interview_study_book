# Chapter 11: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [11-ci-and-jenkins.md](../../../content/mobile-platform/11-ci-and-jenkins.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 6 sections, 12 concepts, 41 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 7/10. Writing: 6/10.** The chapter gives useful operational detail and repeatedly ties success to evidence. Its large, partially assembled pipeline examples make a first read difficult, and one acknowledged weakness in the test gate conflicts with the behavior being taught.

**Preserve:** The stage/evidence table; checking output files from the current run; credential lifetimes; archiving failed-build logs; diagnosing a fresh checkout; promoting the tested artifact and retaining matching symbols.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The shape of a mobile pipeline<br>`ci-pipeline-shape` | 7 | 7 | 6 | 6 | 7 | 6 | Clear purpose, but a large partial class precedes a complete view of its dependencies; skipped tests undermine the gate (RR-11-01). |
| Jenkins pipelines: Jenkinsfile, agents, stages, and parameters<br>`ci-jenkins-pipeline` | 6 | 6 | 5 | 6 | 7 | 6 | A full two-platform pipeline arrives before a minimal Jenkins example; helper-script status is unclear (RR-11-02). |
| Secrets, credentials, and signing in CI<br>`ci-secrets-signing` | 7 | 6 | 6 | 6 | 7 | 6 | Concrete cleanup sequence, but command flags, probe evidence and security policy need separate treatment (RR-11-03). |
| Caching and build speed<br>`ci-caching` | 8 | 8 | 8 | 7 | 8 | 8 | Focused cache trade-offs and a clear diagnostic comparison; no material writing finding. |
| Failures that happen only in CI<br>`ci-only-failures` | 8 | 8 | 8 | 7 | 8 | 8 | A useful symptom table; preceding prose repeats much of the list (RR-11-04). |
| Automate versions and releases<br>`ci-release-automation` | 8 | 7 | 8 | 7 | 8 | 7 | Build identity and promotion are well motivated; symbols make a strong final application, with an access-dependent exercise. |

## Findings and proposed changes

### RR-11-01: Make the demonstrated evidence gate match the lesson

High priority. Scope: prose, code example and question blocks. Section: `ci-pipeline-shape`. Source: [11-ci-and-jenkins.md, line 154](../../../content/mobile-platform/11-ci-and-jenkins.md#L154).

> Unity's `total` includes skipped tests, and so does the step's check, so a run whose tests were all skipped passes both;

The section asks whether the intended tests executed, but explicitly says the shown check can pass with all tests skipped. A learner copying the example receives a known exception to the central guarantee rather than a complete solution. Show a small results validation step with the intended executed/passed/skipped policy, then include missing, stale, zero-test, all-skipped and failed-result fixtures. Revise the ci-batchmode-evidence wording only with separate consent. This finding comes from the chapter's own stated behavior, not a fresh runtime investigation.

### RR-11-02: Build up the pipeline and label its missing ingredients

Medium priority. Scope: code presentation and prose structure. Section: `ci-jenkins-pipeline`. Source: [11-ci-and-jenkins.md, line 221](../../../content/mobile-platform/11-ci-and-jenkins.md#L221).

> This Jenkinsfile builds both platforms in parallel, with a parameter that names the variant to build:

The first Jenkins example contains both platforms, nested stages, credentials, stashes, cleanup and uploads. It also calls helper scripts not all supplied here, while the build class is completed in another section. Start with a runnable checkout/test/archive skeleton, then add parallel builds and signing. Supply a file map naming each helper, where its implementation is provided, and which are project-specific placeholders. Keep a consolidated full example for reference. State the sample's macOS path assumption alongside agent labels so “any Unity agent” is not mistaken for portability.

### RR-11-03: Separate signing lifecycle from command-reference detail

Medium priority. Scope: prose and code presentation. Section: `ci-secrets-signing`. Source: [11-ci-and-jenkins.md, line 518](../../../content/mobile-platform/11-ci-and-jenkins.md#L518).

> Each `security` command does one thing, and the tool's manual explains the choices.

The following paragraph explains passwords, timeouts, import prompts, access partitions, search order, a local probe, profile paths and archive/export behavior in one block. A lifecycle diagram or numbered list would show creation, use and guaranteed cleanup. Put flag explanations in a small command/purpose table and the probe in a separate evidence note. Preserve the distinction between the temporary bound file and copies or keychains that the script creates.

### RR-11-04: Use the diagnostic table as the primary checklist

Low priority. Scope: prose conciseness. Section: `ci-only-failures`. Source: [11-ci-and-jenkins.md, line 655](../../../content/mobile-platform/11-ci-and-jenkins.md#L655).

> These are the usual ones:

The ten-item cause list and later symptom table repeat LFS pointers, missing files, case sensitivity, permissions, signing, disk and timeouts. Retain the table and the explanation of how to compare logs and fresh clones. Fold the few list-only causes into it or into a short supplementary paragraph, reducing rereading without removing diagnostic coverage.

### RR-11-05: Provide a practice route for readers without CI access

Medium priority. Scope: exercise prose. Section: `ci-caching`. Source: [11-ci-and-jenkins.md, line 611](../../../content/mobile-platform/11-ci-and-jenkins.md#L611).

> Exercise: Time each stage of your pipeline with and without its cache,

The audience has little CI experience, yet this and the debugging/release exercises assume a working pipeline, a previous failure and archived production artifacts. Offer a small supplied pair of build logs and an artifact manifest as alternatives, with the same deliverables: identify the costly stage, a missing input and the matching symbols. Keep timing a real pipeline as the fuller exercise.

## Exercises and assessment

All 41 variants were read. Stage evidence, secret lifetime and build-once questions usually test useful decisions. Several Jenkins post questions reward recalling names or order rather than selecting a block for a concrete failure; the existing failed-log and aborted-run scenarios are better models. The nunit/total question needs the same execution-policy clarification as the prose. Exercises are relevant but almost all presuppose pipeline ownership. Distinguish an interview-level skeleton task from a runnable upload pipeline; the latter needs platform accounts and project-specific helpers absent from this textbook example.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> What a developer checks by eye, a message that says the build succeeded or a file in a folder, a pipeline checks in code, because nobody watches it.

After:

> A pipeline checks success in code. Each stage must verify the result or file that a developer would otherwise inspect by eye.

Before:

> The method starts with the whole log. The console's last lines usually hold the last symptom, a message that the build failed, and the first error holds the cause; later errors often follow from it.

After:

> Start with the full log. The final lines often report only that the build failed. Read the earliest relevant error first, then check whether it explains the later failures.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
