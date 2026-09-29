# Editing plan: The Platform Layer

Proposals only. Implementing them is a separate task, with whatever authorization the user gives then. The plan covers findings that are still open at `d55c2c8`: the chapter 1 to 3 and glossary findings, the remainders of RR-06-04 and RR-14-04, the three findings from the recheck, and the book-wide findings in [summary.md](summary.md). The applied findings of chapters 4 to 16 are listed in the summary's [status table](summary.md#status-of-earlier-findings).

**Consent.** Batches 1 to 5 and 8 are prose, code presentation or glossary work, and change no stable id. Batch 6 changes committed question blocks. Under `docs/PLAN.md`, every change to a committed question block needs the user's explicit consent, including a distractor, an explanation or a link added inside one. A passing guard does not supply that consent. Batch 7 may change a chapter id and must be investigated before anyone decides on it.

**Checks for every batch:** `npm run check`; `npm run guard -- style`; `npm run guard -- questions` (it must pass unchanged for batches 1 to 5, 7 and 8); the avoid-ai-writing detector on each new sentence, per `docs/PLAN.md`; and a reread of the changed passage against its finding's excerpt.

## Batch 1: make the chapter 1 to 3 examples and labs usable (prose and code presentation)

Findings: [RR-01-03](chapter-01.md), [RR-01-05](chapter-01.md), [RR-02-02](chapter-02.md), [RR-02-01](chapter-02.md), [RR-03-02](chapter-03.md), and [RR-BK-03](summary.md#rr-bk-03-exercises-that-assume-access-the-reader-may-not-have) for chapters 1 to 3.

- `platform-results-threads`: declare or comment `mainThread`, and reconcile `ToResult` with `ToStatus` (chapter 1, lines 270 to 277).
- `platform-testing`: name the Play Mode test assembly, which Test Runner action runs each leg, and the sandbox account the device leg needs (line 437).
- `android-activity-integration`: add `PickImageBridge` and a C# method of about ten lines that completes a task through the main-thread queue, or list the steps with links (line 574).
- `android-runtime-model`: move the proxy leg of the lab to the callbacks lab, and state the expected thread names (line 56).
- `ios-runtime-model`: name the camera or microphone request, give the expected log values, and link chapter 2's lab (line 73).
- A one-line fallback for each exercise that assumes access: the six chapter 1 exercises (“or use the purchase example above”), a note that an emulator suffices for chapter 2's thread and crash labs, and a `dispatch_after` hint for chapter 3's timer lab (line 445). Model: chapter 7's invented packet ([07-sdk-integration.md, line 51](../../../content/mobile-platform/07-sdk-integration.md#L51)).

Dependencies: none. RR-01-03 should land before batch 2's RR-01-02, since both edit `platform-results-threads`.
Benefit: the book's foundational code sample compiles in the reader's head, and every early exercise can be started without a project, a device or a Mac.
Check: each undeclared name in the changed code blocks is declared or commented; each exercise states a fallback and an expected observation.
Stable ids: none changed. No progress or review-history cost.

## Batch 2: structure and wording in chapters 1 to 3 (prose)

Findings: [RR-03-01](chapter-03.md), [RR-03-04](chapter-03.md), [RR-01-02](chapter-01.md), [RR-01-06](chapter-01.md), [RR-02-04](chapter-02.md), [RR-03-05](chapter-03.md), [RR-03-03](chapter-03.md), [RR-03-07](chapter-03.md), [RR-01-01](chapter-01.md), [RR-01-04](chapter-01.md), and the prose part of [RR-02-03](chapter-02.md). These are the chapter 1 to 3 parts of RR-BK-01, RR-BK-02 and RR-BK-08.

Order within the batch, by reader benefit:

1. Chapter 3: the launch sequence as numbered steps, with the Metal display-link remark moved to a version note (RR-03-01); level-three headings in `ios-frameworks`, with line 525 split (RR-03-04).
2. Chapter 1: rule first, then a three-row table of crossings (RR-01-02); the assembly defaults as a two-row table (RR-01-06); the heading “What an integration answer covers” (RR-01-01).
3. Chapter 2: the symbols paragraph split into matching and keeping (RR-02-04); a heading and a transition for configuration changes (RR-02-03, prose part only).
4. Chapter 3: the two 6000.3.11f1 gaps as a labeled list (RR-03-05); the three callback rules listed (RR-03-03); the failure code wording (RR-03-07).
5. RR-01-04 last. Its wording depends on the Phase 35 referral about how the composition root references a platform-only assembly.

Dependencies: RR-01-04 waits for Phase 35. RR-03-05's first gap can name what sets `UNITY_USES_REMOTE_NOTIFICATIONS` only after its referral; until then it links `[[#os-notifications]]`.
Benefit: the steepest chapter in the book, at its start, gains landmarks, and chapter 1's thread section no longer front-loads two chapters.
Check: `grep -c '^### '` shows the new headings in chapters 1 to 3; section ids and concept ids are unchanged (`npm run guard -- questions` passes).
Stable ids: none changed. No progress or review-history cost.

## Batch 3: recent-edit fixes and the two partial findings (prose)

Findings: [RR-12-05](summary.md#rr-12-05-the-ring-examples-uneven-shares-are-equal), [RR-11-06](summary.md#rr-11-06-the-cleanup-sentence-runs-on-into-unity-licensing), [RR-04-06](summary.md#rr-04-06-the-permissions-table-is-followed-by-a-paragraph-that-repeats-it), the RR-06-04 remainder and the RR-14-04 remainder ([RR-BK-01](summary.md#rr-bk-01-investigation-narration-in-the-teaching-voice)).

- Chapter 12, line 362: make the uneven-share example uneven. Recheck all six keys and node D against any moved node.
- Chapter 11, line 607: split the sentence and start licensing as its own paragraph.
- Chapter 4, line 178: remove the three sentences that repeat the table.
- Chapter 6, line 179: add a redacted provisioning-profile fixture (App ID, entitlements, device list, expiry) for readers without team credentials.
- Chapter 14: name the SRE book or workbook once per section, at the claim it supports, and keep every link. At present 20 lines name it.

Dependencies: none. RR-12-05 comes first, since it is the only medium-priority item and its error is in the text a reader checks.
Benefit: the latest edits stop contradicting their own point, and the last two partial findings close.
Check: recompute the ring arcs by hand; `grep -c 'SRE book\|SRE workbook' 14-running-services.md` falls to about one per section; every external link is still present (`npm run guard -- links --base d55c2c8` covers only new links, and none should be added).
Stable ids: none changed.

## Batch 4: glossary (glossary file, plus one chapter link)

Findings: [RR-GL-01](glossary.md), [RR-GL-02](glossary.md), [RR-GL-09](glossary.md), [RR-GL-03](glossary.md), [RR-GL-04](glossary.md), [RR-GL-05](glossary.md), [RR-GL-06](glossary.md), [RR-GL-07](glossary.md), and the JWS clause of [RR-GL-08](glossary.md).

Order: the Observer summary (GL-01); the tombstone, symbolication and dynamic linker entries, each linking back to where chapters 2 and 3 teach them (GL-02); the ANR figure (GL-09); then the low-priority wording and links.
Dependencies: GL-08's sentence about Google's managed Pub/Sub waits for Phase 35. GL-04 changes one chapter link (chapter 4, `the push [[capability]]` to `[[entitlements | capability]]`). That is prose, not a question block. Link the first mention of “tombstone” in chapter 2 (lines 658, 672 and 743) in the same change.
Benefit: preview cards stop contradicting their bodies, and the chapter 15 entries point to the chapters that teach the mechanics.
Check: `npm run check` (links and aliases resolve); read each changed entry's preview summary on its own.
Stable ids: glossary entry ids unchanged. Entries carry no progress.

## Batch 5: consistency pass (prose)

Findings: [RR-BK-06](summary.md#rr-bk-06-terminology-and-naming-drift) (terms only), [RR-BK-07](summary.md#rr-bk-07-backward-chapter-mentions-left-as-plain-text) (prose mentions only), and the prose route of [RR-03-06](chapter-03.md).

- One spelling of Player Settings throughout: 32 changes in chapter 10, 3 in chapter 11, 1 in chapter 3 and 1 in the glossary if the capitalized form is kept.
- “Unity 6.3” at chapter 15, line 138.
- Backward links in prose: chapter 2, lines 333, 367, 523 and 583 (RR-02-05); chapter 3, lines 73, 374 and 443 (RR-03-08); chapter 5, lines 500 and 521; chapter 8, lines 390, 573, 575 and 584; chapter 9, line 458; glossary lines 187 and 376 (RR-GL-03). Skip any whose sentence already links the section.
- Add `SIGABRT` and `SIGKILL` to chapter 3's termination table (RR-03-06, prose route). This makes the explanations at lines 901 and 941 checkable without touching them.

Dependencies: after batch 2, which edits some of the same chapter 3 paragraphs.
Benefit: one name per thing, and one click back to each recalled idea.
Check: `grep -o` counts show a single spelling; `npm run check` resolves every new link; no link is added inside a question block.
Stable ids: none changed.

## Batch 6: question blocks (consent required for each item)

Findings: [RR-02-03](chapter-02.md) (question part), [RR-02-05](chapter-02.md) and [RR-03-08](chapter-03.md) (the links inside explanations), [RR-03-06](chapter-03.md) (explanation route, only if batch 5's table route is not taken), and the `xcode-pod-conflict` candidate ([RR-BK-05](summary.md#rr-bk-05-concepts-that-track-two-skills-and-explanations-that-teach-beyond-the-prose)).

| Item | Concept | Change | Review-history cost | Guard |
| --- | --- | --- | --- | --- |
| RR-02-03 | `android-new-intent` | Move the rotation variant (chapter 2, line 642) to a new concept, or keep it and record why | The moved variant starts without history under the new concept id; the others keep theirs. A new concept also adds one unlock unit to `android-activity-integration` | `--allow structure --changes <file>` |
| RR-02-05 | `android-...` explanation at chapter 2, line 472 | Add `[[#gradle-manifest-merge \| Chapter 5]]` | None: explanation text only | Needs consent; no allow flag |
| RR-03-08 | Explanation at chapter 3, line 125 | Add the chapter 1 or 2 link | None | Needs consent |
| RR-03-06 | Explanations at chapter 3, lines 901 and 941 | Reword to the evidence the prose names | None | Needs consent |
| Candidate | `xcode-pod-conflict`, variant at chapter 6, line 516 | Move the lock-record variant to its own concept, or accept the pairing | Same as RR-02-03 if moved | `--allow structure` |

Dependencies: batch 5 first. If the table gains the two signals, drop the RR-03-06 row.
Benefit: each concept tracks one skill, and each explanation teaches only what the section taught.
Check: `npm run guard -- questions --base d55c2c8 --allow structure --changes <file>`, with a new changes file in the format of [structure-changes.json](../structure-changes.json); `npm run guard -- options` for any new distractor.

## Batch 7: chapter titles for chapters 15 and 16 (structure; investigate first)

Finding: [RR-BK-06](summary.md#rr-bk-06-terminology-and-naming-drift), chapter titles.

The parser makes a chapter's id from its `chapter:` front-matter title (`pipeline/parse.ts`, line 215). Adding “15: ” and “16: ” to match the other thirty chapters therefore changes both ids. Before deciding, find what the id feeds: hash routes (`src/router.ts`), anything stored in progress (`src/storage/`) and unlocking (`src/engine/`). If only routes use it, the cost is broken bookmarks. If progress or unlocking keys on it, this is a structure change that needs the user's decision.
Benefit: the site lists all sixteen chapters in one form.
Check: `npm test`; `npm run check`; open both chapters from the Book page under `npm run dev`.

## Batch 8: optional polish (prose)

Findings: [RR-BK-02](summary.md#rr-bk-02-multi-topic-paragraphs-and-long-sentences) (sentence load), [RR-BK-10](summary.md#rr-bk-10-interview-practice-arrives-late) and [RR-BK-09](summary.md#rr-bk-09-chapter-15-writes-in-a-different-voice).

- In chapters 10, 11 and 14, split paragraphs that state more than one rule, rule first and qualification after. Model: chapter 14's numbered cascade. No length target.
- In chapters 4, 7, 8 and 11, follow one exercise with a one-minute spoken answer that chapter 16's rubric later grades. The PLAN rule that each section ends with its exercise must still hold.
- Give chapter 15 one opening sentence that says it turns the book's mechanisms into a method.

Dependencies: after batches 1 to 5.
Benefit: less rereading in the book's longest-sentence chapters, and speaking practice before chapter 12.
Check: rerun the sentence statistics in the summary's method; they describe the change and are not a gate.

## Summary of costs

| Batch | Scope | Consent | Stable ids affected | History cost |
| --- | --- | --- | --- | --- |
| 1 | Prose, code presentation | Not for questions | None | None |
| 2 | Prose, headings | Not for questions | None | None |
| 3 | Prose | Not for questions | None | None |
| 4 | Glossary, one chapter link | Not for questions | None | None |
| 5 | Prose, links | Not for questions | None | None |
| 6 | Question blocks | Yes, per item | New concept ids if variants move | Moved variants restart |
| 7 | Front matter | User decision after investigation | Two chapter ids | Depends on what the id feeds |
| 8 | Prose | Not for questions | None | None |
