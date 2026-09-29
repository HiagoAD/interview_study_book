# Editing plan: chapter 16

Scoped to [chapter 16](chapter-16.md). Proposals only; implementing them is a separate task. Order is by reader benefit.

**Timing matters.** Chapter 16 is uncommitted. Every question-block change below is **pre-commit, no history cost**: no reader has progress on these concepts, so option, explanation and stem changes need no consent and no changes file now. If the chapter is committed first, batch 1 and batch 5 become committed question changes that need the user's explicit consent under `docs/PLAN.md` (distractor lines through `--allow distractors`; correct options, explanations and stems through `--allow structure --changes`). Applying them before the commit is the cheaper path. No concept or section id changes in any batch.

## Batch 1: make the decision-level concept consistent (question blocks + one prose sentence)

Findings: [RR-16-02](chapter-16.md#rr-16-02-explanations-say-distractors-give-no-reason-when-they-do), [RR-16-03](chapter-16.md#rr-16-03-a-correct-option-pairs-a-choice-with-the-wrong-reason).
Affected: concept `interview-integration-depth`, variants at lines 57 and 65 (correct option and explanation at 58 and 63; explanation at 71); prose at line 33. The line 47 explanation was already rewritten by a concurrent edit; only its “what it rejected” clause remains to settle.
Benefit: the concept's key matches the section's definition; learners are no longer marked right for a causal link the prose does not make.
Check: `npm run check`; `npm run guard -- style`; `npm run guard -- options` (correct-option length at line 58 should not stand out); reread the three variants against line 31.

## Batch 2: exercises with a model and a finish line (prose)

Findings: [RR-16-01](chapter-16.md#rr-16-01-give-a-model-two-minute-answer-to-grade-against), [RR-16-10](chapter-16.md#rr-16-10-give-the-practice-lab-a-finish-line), [RR-16-08](chapter-16.md#rr-16-08-the-mock-exercises-timing-and-follow-ups).
Affected: prose after line 23; exercises at lines 39, 232 and 412. No question blocks.
Dependency: RR-16-10's “deliberate off-thread call” clause waits on the Phase 35 referral, or is dropped.
Benefit: every exercise states what a successful attempt looks like; the analytics answer can be graded against a model; the mock round's time and follow-ups are complete.
Check: style guard (no em dashes, no contractions, curly quotes, exercise still last); detector per PLAN.md for new sentences; the model answer's eight sentences each map to one row of the table at line 12.

## Batch 3: order and precision in the prose (prose)

Findings: [RR-16-04](chapter-16.md#rr-16-04-signpost-where-purpose-is-taught), [RR-16-05](chapter-16.md#rr-16-05-the-last-narration-row-assumes-the-r8-outcome), [RR-16-07](chapter-16.md#rr-16-07-an-elliptical-list-in-the-dependency-row), [RR-16-09](chapter-16.md#rr-16-09-a-provenance-sentence-in-the-teaching-voice), plus the line 8 wording revision in the chapter report.
Affected: lines 8, 14, 35 to 37 (move), 125, 201, 306.
Benefit: the first section runs in answer order; the worked table no longer models the jump it criticizes; two dense sentences read in one pass.
Check: `npm run check`, style guard; confirm line 306's qualification (reported, not predicted) survives.

## Batch 4: links (prose)

Finding: [RR-16-06](chapter-16.md#rr-16-06-plain-text-references-to-this-books-chapters).
Affected: lines 17, 18, 107, 131, 304, 408. No question blocks; first-book mentions stay plain.
Benefit: the six references a learner is most likely to follow become one click.
Check: `npm run check` (links resolve).

## Batch 5: distractor and explanation polish (question blocks)

Findings: [RR-16-12](chapter-16.md#rr-16-12-distractors-that-stand-out-by-form-or-effort).
Affected: `interview-design-depth` (distractors 363 to 366, 387, 390), `interview-debugging-narration` (distractor 148).
Benefit: options cannot be picked by pattern; each explanation addresses the options shown.
Check: `npm run guard -- options`; each new distractor is a mistake an engineer makes; explanations still stand alone.

## Question-block summary

| Finding | Concept | Change | Cost now | Cost after commit |
| --- | --- | --- | --- | --- |
| RR-16-02 | `interview-integration-depth` | Explanation at 71 (47 already rewritten) | None (pre-commit, no history cost) | Consent; structure change |
| RR-16-03 | `interview-integration-depth` | Correct option and explanation | None (pre-commit, no history cost) | Consent; structure change |
| RR-16-11 | `interview-practice-evidence` | Done by concurrent edit to line 436 | None | None |
| RR-16-12 | `interview-design-depth`, `interview-debugging-narration` | Distractors | None (pre-commit, no history cost) | Consent; `--allow distractors` |

Prose-only findings: RR-16-01, 04, 05, 06, 07, 08, 09, 10. None changes a stable id or progress.
