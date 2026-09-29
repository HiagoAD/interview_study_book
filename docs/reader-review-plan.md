# The Platform Layer: reader and writing review

Run this review after the second book is written. It complements Phase 35's
technical teacher's read with the learner and writing perspectives requested on
2026-09-27. Creating this workflow does not start the review.

## Run it

- Codex: `$review-platform-book`.
- Claude Code: `/review-platform-book`.
- Either assistant: “Follow docs/reader-review-plan.md to review the second book.”

The default is the whole book, both perspectives. Optional instructions can narrow
the scope, for example `chapter 8, section 2`, `writing only`, or
`resume docs/reader-reviews/<run>/`. A scoped run must label its coverage and must
not give a whole-book verdict. These are assistant instructions, not shell commands.

The Codex entry point lives in `.agents/skills/review-platform-book/`, following
the [repository skill convention](https://learn.chatgpt.com/docs/build-skills).
Both entry points read this plan so the criteria have one maintained source.

## Scope and boundaries

Review `content/mobile-platform/`, including the glossary and all question
variants. Read as the audience in `docs/mobile-platform-outline.md`: someone who
knows Unity and C# at the first book's level and is learning mobile platform
engineering. Do not judge the book as an introduction to programming or demand
backend-specialist depth.

Produce review documents only. Work inline, as the phase workflow requires.
Leave content, code, question blocks, IDs, progress data and existing technical
review requests unchanged. Do not commit as part of this review. The general
phase commit step does not apply to this companion workflow.

This review assesses explanations and learning, not the truth of every API claim.
Record suspected technical defects as unverified referrals to Phase 35; do not
assert a factual correction without checking it. An unclear explanation can be
reported as unclear without deciding whether its underlying technical claim is
true. External research and runtime probes belong to the technical review.

An AI-writing detector is optional supporting evidence when available and
requested. It cannot establish readability, teaching quality or authorship, and
its absence does not block this review. Do not invoke an automatic rewrite mode.

## Preparation and checkpoints

1. Read `CLAUDE.md`, `PROJECT.md`, this plan, the outline's scope and reader, and
   `docs/PLAN.md`'s writing rules and Phase 35. Read relevant evidence or phase
   decisions only when needed to interpret a passage.
2. Record the starting commit and working-tree status. Review the actual working
   tree, including pre-existing edits, and never revert them. Record SHA-256
   hashes for chapter files, the glossary, outline and writing rules so a resumed
   review can detect changed inputs even when the commit has not changed.
3. Inventory the actual chapters, section IDs and titles, concepts, variants and
   glossary entries. Compare coverage with the current outline; do not hard-code
   counts from this plan. Record missing or extra material. If the book is not
   finished, any assessment of the available material is explicitly partial.
4. Create `docs/reader-reviews/<YYYY-MM-DD>-<short-commit>/`, adding a suffix if
   that run already exists unless the user requested a resume. Create `index.md`
   first: scope, input snapshot, rubric, chapter checklist and next unread
   section. Write chapter reports as each chapter is completed rather than
   holding the entire review in conversational memory.

On resume, read the index and completed chapter reports, compare the input
snapshot, and re-read changed sections and any affected prerequisite or
consistency judgments. Keep completed work on unchanged material. Mark stale
ratings and synthesis until rechecked. A context limit or interrupted session
leaves an explicit partial report and an exact continuation point, never an
unqualified completion claim.

## Pass 1: read each chapter in order

Read every section's full prose, tables, code, closing exercise and all question
variants. Inspect local illustrations when the explanation relies on them. Follow
glossary links that the learner needs. Source reading is enough for prose review;
if rendered pages are also inspected, say which ones. Do not claim a visual or
interaction check from reading Markdown alone.

Make two distinct judgments for each section:

**Learner experience**

- Can the reader state what this section enables them to understand or do?
- Are prerequisites taught earlier, briefly recapped or usefully linked? Does a
  glossary definition actually resolve the dependency?
- Do examples explain the mechanism and the reason for decisions? Is code
  introduced, walked through and connected to observable results?
- Is there time to absorb an idea before exceptions, implementation evidence and
  qualifications accumulate? Separate necessary technical depth from avoidable
  mental effort.
- Can the reader start the exercise with what is supplied? Are setup, expected
  observations and success criteria adequate for its stated purpose?
- Do questions test what the section teaches, with plausible alternatives and
  explanations that stand alone? Does each concept track one skill? Remember
  that the site presents one variant per concept on a study pass: many variants
  do not mean that all those skills are assessed during that pass.

**Writing**

| Dimension | What to examine |
| --- | --- |
| Readability | Sentence load, paragraph focus, clear subjects and referents, concrete language, jargon appropriate to this reader, rules separated clearly from caveats |
| Structure | Purpose and sequence, useful subheadings, transitions, main point placement, table and code placement, conclusions consistent with the explanation |
| Conciseness | Repetition, roundabout framing, evidence detail interrupting the lesson, boilerplate, opportunities to shorten without losing a mechanism or qualification |
| Style consistency | Stable teaching voice, terminology and naming, degree of formality, book conventions, shifts between instruction and investigation logs, consistency across prose, captions and explanations |

Preserve deliberate depth and the author's voice. The existing writing rules
allow sections to be as long as their content needs. Word counts, sentence
lengths and code-line counts can describe a problem, but there are no automatic
length limits, heading quotas or readability-score gates. Technical vocabulary,
long code and deliberate repetition are not defects by themselves.

When a finding depends on scale, measure it reproducibly and state the counting
method. Distinguish prose words from code and questions. Judge repetition by its
purpose: retrieval practice or a useful recap can help a learner.

## Ratings and chapter reports

Use the same 1–10 scale for learner experience and each of the four writing
dimensions. Whole numbers are sufficient:

| Score | Anchor |
| --- | --- |
| 9–10 | Clear and effective for this audience; only small refinements remain |
| 7–8 | Strong overall, with localized friction that does not obscure the lesson |
| 5–6 | Useful material, but recurring friction requires rereading or outside help |
| 3–4 | Major gaps or organization problems obstruct understanding or application |
| 1–2 | The intended reader cannot reliably learn the stated material from it |

Also give an overall writing rating with a short rationale. Treat it as editorial
judgment, not a mechanically precise average. Explain any large difference from
the four dimension scores. Do not carry over ratings from the earlier Chapter 8
conversation: assess the version being read on its own merits.

Write `chapter-<NN>.md` with:

- A brief chapter verdict, strengths worth preserving, and learner and writing
  ratings with reasons.
- A coverage table containing every section's ID, title, learner rating, four
  writing ratings, overall writing rating and a short reason or finding link.
- Findings with stable IDs such as `RR-08-01`. Each gives the section ID, source
  path and line, a short exact excerpt, the reader's difficulty, its consequence,
  and a concrete proposed improvement. Keep excerpts and line references tied
  to the recorded input snapshot.
- A priority and change scope for each finding. High means understanding or
  application is obstructed; medium means recurring rereading or missing
  guidance; low means local polish. Scope identifies prose, code presentation,
  glossary, question blocks or section/concept structure. These are editorial
  priorities, distinct from Phase 35's accuracy priorities.
- A few representative before/after passages where wording is the problem.
  Preserve technical meaning, scope, qualifications and book conventions.
  Proposed passages stay in the report; do not silently rewrite the chapter.
- Open technical referrals and any limits to the review. Record “no material
  finding” when appropriate rather than inventing a defect to fill a quota.

If only writing was requested, mark learner ratings as not assessed and omit
the learning pass; apply the same rule to a learner-only run.

## Pass 2: the whole book

After the section pass, compare the chapters and read the whole glossary for
clarity, consistent terminology and useful summaries. Record glossary coverage
explicitly in the index. Evaluate:

- Progression of assumed knowledge and difficulty, including useful forward
  references versus dependencies that stop the learner.
- Recurring explanation patterns, unexplained changes of terminology, duplicated
  teaching, shifts in voice and differences in code walkthrough depth.
- Whether chapter openings, exercises and interview preparation support the
  book's stated purpose, and whether later chapters build on earlier examples.
- Which successful passages provide useful models for revising weaker ones.

Recheck earlier ratings against the same anchors after seeing the whole book.
Document significant changes in judgment. Consolidate recurring issues into one
book-wide finding with representative locations and links to chapter findings;
keep the section coverage even when findings are consolidated.

Write `summary.md`: scope and completion status, overall learner and writing
ratings, the four writing ratings, a chapter comparison table, strengths to
preserve, highest-impact findings, and review limits. Whole-book scores are
reasoned judgments supported by chapter evidence; disclose any numerical
aggregation used and keep it secondary to that judgment.

Write `editing-plan.md`: ordered, concrete revision batches linked to finding
IDs, their dependencies, expected learner benefit and how improvement will be
checked. Separate prose-only work from question or structure changes. Identify
the affected stable IDs and possible progress/review-history costs. Existing
rules require explicit consent for any committed question-block change,
including distractors; a passing guard does not supply that consent. Preparing
the review and editing plan requires no additional approval. Implementing the
plan is a separate task with whatever authorization the user gives then.

## Completion checks

- Every inventoried section and glossary entry has been read; all question
  variants were considered. Missing material and scoped exclusions are explicit.
- Each section has the requested ratings and a reason, including sections with
  no finding. No conclusion substitutes a sample for whole-book coverage.
- Report links, excerpts and locations resolve against the input snapshot.
- Findings distinguish learner difficulty, editorial preference and unverified
  technical concerns. The summary does not label suspected errors as proven.
- The editing plan prioritizes reader benefit and preserves technical depth,
  qualifications, stable IDs and question history in its proposed work.
- Compare final working-tree status with the initial state and confirm this run
  changed only its review documents. Do not overwrite concurrent user edits.
- Mark the index complete only after chapter reports, glossary review, synthesis
  and editing plan are finished. Finish with the ratings, the main findings and
  links to the summary and editing plan.

No application build or network link sweep is needed for report-only work.
Later content edits use the checks required by `docs/PLAN.md`, including content
validation, style and question guards; reviews themselves do not waive them.
