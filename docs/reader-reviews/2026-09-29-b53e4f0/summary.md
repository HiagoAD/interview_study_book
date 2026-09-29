# Summary: reader and writing review of The Platform Layer

## Scope and completion

Whole book, learner and writing perspectives: chapters 1 to 16 and the glossary of `content/mobile-platform/`. Pass 1 and Pass 2 of the [review plan](../../reader-review-plan.md) are complete.

The run was assembled from three inputs, so each chapter's review commit differs:

- Chapters 4 to 15 were reviewed at `b53e4f0`. Commit `7d2c7e0` then applied their findings. For this summary each of those findings was rechecked against `git show 7d2c7e0` and the files at HEAD `d55c2c8`, and the chapter ratings were confirmed or re-rated ([status table](#status-of-earlier-findings)).
- Chapters 1 to 3 and the glossary were reviewed at `d55c2c8`. Their findings are open. The files' SHA-256 hashes at HEAD still match the hashes recorded in those reports.
- Chapter 16 was reviewed on its own in [2026-09-29-7d2c7e0](../2026-09-29-7d2c7e0/summary.md), before `d55c2c8` committed it with those findings applied. That chapter was not re-read after the application. A spot check confirmed that the model first pass (RR-16-01) and the practice lab's finish line (RR-16-10) are in the committed text.

Pass 2 read the chapter openings, every exercise line, the transitions between chapters and the passages behind each book-wide finding. It also used the Pass 1 reports and the measurements described under [Method](#method-and-measurements). It did not re-read every section of chapters 4 to 15 beyond the text that `7d2c7e0` changed. The whole-book ratings rest on the chapter reports, the recheck and these cross-chapter comparisons.

## Ratings

| | Learner | Readability | Structure | Conciseness | Style consistency | Overall writing |
| --- | --- | --- | --- | --- | --- | --- |
| Whole book | 8 | 7 | 8 | 7 | 8 | 7 |

**Learner experience: 8/10.** An engineer who knows Unity at the first book's level can learn the book's material from it. One call path (game, interface, adapter, bridge, SDK, OS, network, backend) organizes all sixteen chapters. Most mechanisms come with the failure they prevent, shown as a real error, a log line or a table. After `7d2c7e0`, chapters 4 to 15 also give worked traces, fallback practice packets and fixtures where their exercises needed access that the reader may not have. Chapters 1 to 3 now carry most of the remaining friction. They teach the densest material in the book (the two bridges) at its start, their examples leave out a helper or the step that wires them up, and their exercises assume a project, a device or a Mac with no fallback.

**Writing: 7/10**, at the upper end of the band. The teaching voice is stable, and the conventions (tables for comparisons, links back to the teaching section, exercises that close each section) hold across chapters. Structure is now strong: most long sections gained internal headings in `7d2c7e0`. Readability and conciseness keep the rating at 7. Many sentences are long: in chapters 10 to 14, 18% to 23% of prose sentences run to 40 words or more. Investigation and attribution narration still interrupts the lesson in chapter 3 and in chapter 14's repeated references to the SRE book. The four dimension scores and the overall score agree; there is no large gap to explain.

Numerical aggregation, secondary to the judgment above: the mean of the chapter writing scores is 7.4 (6 chapters at 8, 10 at 7), and every chapter's learner score is 8.

## Chapter comparison

L = learner experience, W = overall writing. The status says whether the chapter's reader-review findings have been applied to the book.

| Chapter | Review commit | L | W | Findings | Remaining friction |
| --- | --- | --- | --- | --- | --- |
| [01 The platform layer and the call path](chapter-01.md) | `d55c2c8` | 8 | 8 | Open (6) | Compressed forward material in the thread section; `mainThread` undeclared |
| [02 Calling Android from C# and back](chapter-02.md) | `d55c2c8` | 8 | 8 | Open (5) | Lab needs proxies before they are taught; helper activity not wired to C# |
| [03 Calling iOS from C# and back](chapter-03.md) | `d55c2c8` | 8 | 7 | Open (8) | Launch sequence in one paragraph; five topics with no headings in the frameworks section |
| [04 Lifecycle, permissions, links, notifications, and sign-in](chapter-04.md) | `b53e4f0` | 8 | 7 | Applied (5 of 5) | New repetition after the permissions table ([RR-04-06](#findings-from-the-recheck)) |
| [05 Android builds](chapter-05.md) | `b53e4f0` | 8 | 8 | Applied (5 of 5) | None material |
| [06 iOS builds](chapter-06.md) | `b53e4f0` | 8 | 7 | Applied 3, partly 1 | Profile exercise still needs team credentials |
| [07 Integrating third-party SDKs](chapter-07.md) | `b53e4f0` | 8 | 7 | Applied (5 of 5) | The consent paragraph is long |
| [08 Backend clients](chapter-08.md) | `b53e4f0` | 8 (was 7) | 7 | Applied (6 of 6) | Long sentences in the client-choice subsection |
| [09 Reliable requests](chapter-09.md) | `b53e4f0` | 8 (was 7) | 7 | Applied (5 of 5) | Long rule paragraphs in the idempotency section |
| [10 Build variants, environments, and releases](chapter-10.md) | `b53e4f0` | 8 | 8 (was 7) | Applied (4 of 4) | Highest sentence length in the book (mean 28.9 words) |
| [11 CI/CD and Jenkins](chapter-11.md) | `b53e4f0` | 8 (was 7) | 7 (was 6) | Applied (5 of 5) | A new comma splice in the signing section ([RR-11-06](#findings-from-the-recheck)) |
| [12 System design: method and building blocks](chapter-12.md) | `b53e4f0` | 8 | 7 | Applied (4 of 4) | The new ring example contradicts its own point ([RR-12-05](#findings-from-the-recheck)) |
| [13 Designing core game services](chapter-13.md) | `b53e4f0` | 8 | 7 | Applied (5 of 5) | The longest chapter (19,060 words); dense but well signposted |
| [14 Running game services at scale](chapter-14.md) | `b53e4f0` | 8 (was 7) | 7 (was 6) | Applied 4, partly 1 | 20 lines still name the SRE book or workbook |
| [15 Debugging across boundaries](chapter-15.md) | `b53e4f0` | 8 | 8 | Applied (4 of 4) | A different voice from the rest of the book ([RR-BK-09](#rr-bk-09-chapter-15-writes-in-a-different-voice)) |
| [16 Interview practice](../2026-09-29-7d2c7e0/chapter-16.md) | `7d2c7e0` (scoped run) | 8 | 8 | Applied in `d55c2c8` (12, one of them by a concurrent edit) | Not re-read after application |
| [Glossary](glossary.md) | `d55c2c8` | 8 | 8 | Open (9) | Observer summary contradicts its body; chapter 15 entries point only forward |

### Re-ratings after the recheck

These re-ratings apply only where `7d2c7e0`'s edits changed the judgment. All other chapter and section ratings in the chapter reports stand.

| Chapter | Section | Before | After | Why |
| --- | --- | --- | --- | --- |
| 04 | `os-deep-links` | L7 S6 C6 W6 | L8 S8 C7 W7 | Validation and the parser come first; the 6000.3.11f1 patch is a labeled note under its own heading |
| 04 | `os-auth-callbacks` | L8 | L9 | The RFC vector and the step timeline make the flow checkable |
| 06 | `xcode-build-flow` | R7 S7 W7 | R8 S8 W8 | The warnings investigation moved under its own heading after the happy path |
| 06 | `xcode-cocoapods` | L7 S7 | L8 S8 | The lock's lifecycle is a numbered sequence, and the lab has local pods |
| 07 | `sdk-evaluation` | C6 W7 | C7 W8 | The probe paragraph became a platform/result/implication table |
| 07 | `sdk-consent-init` | L7 | L8 | Buffering, collection and transmission are distinguished; the late-start timeline names its owners |
| 08 | `http-unity-clients` | L7 S6 C6 W6 | L8 S8 C7 W7 | Six internal headings and the interface invariant stated before the types |
| 08 | `http-sessions` | L7 | L8 | The sign-out guard and its three-step failure order are shown |
| 08 | `http-dtos` | R7 W7 | R8 W8 | The serializer behavior is a table with the mapper's policy |
| 09 | `network-timeouts` | L7 S7 W7 | L8 S8 W8 | The deadline now holds across the shared refresh, with a two-caller example |
| 09 | `network-offline` | L7 | L8 | The reconciliation concept assesses the section's second half |
| 10 | `release-build-variants` | S7 C6 W7 | S8 C7 W8 | The settings table leads, and the evidence follows the assertion example |
| 10 | `release-environments` | C6 W7 | C8 W8 | The guard results are a table with the two edge rows explained |
| 10 | `release-versioning` | S7 W7 | S8 W8 | Sample stamp and log line; `StoreBuild`'s scope is stated |
| 11 | `ci-pipeline-shape` | L7 S6 C6 W6 | L8 S7 C7 W7 | A results check with a stated policy and six fixtures |
| 11 | `ci-jenkins-pipeline` | L6 R6 S5 C6 W6 | L8 R7 S7 C7 W7 | A test-stage skeleton comes first, with a map of the helper scripts |
| 11 | `ci-secrets-signing` | R6 S6 W6 | R7 S8 W7 | The keychain lifecycle is a numbered list, and the flags are a table; the new splice (RR-11-06) keeps W at 7 |
| 12 | `design-storage` | L7 S6 C6 W6 | L8 S8 C7 W7 | Worked modulo and ring examples, with headings; the ring example's slip (RR-12-05) keeps L at 8 |
| 13 | `design-social` | L7 | L8 | The mute record and its enforcement are taught before the exercise |
| 14 | `design-spikes` | L7 R6 S6 W6 | L8 R7 S8 W7 | Arrival, waiting, eligibility and redemption as steps |
| 14 | `design-degradation` | S7 | S8 | The cascade is numbered, and each defense names the step it breaks |
| 14 | `design-backend-deploys` | R6 C6 W6 | R7 C7 W7 | Conditions before the code, a two-writer trace, and an evidence note |
| 14 | `design-slos` | L7 R6 S6 W6 | L8 R7 S7 W7 | The 14.4 burn rate is derived step by step |
| 15 | `boundary-crash-case` | L7 S7 W7 | L8 S8 W8 | Paired thread traces, what each weakens, and a practice packet |

Chapters 4, 5, 6, 7, 12, 13 and 15 keep their chapter ratings: their section gains either brought weaker sections up to the level of the others or were offset by a new finding. Chapters 8, 9, 11 and 14 gain a learner point. Chapters 11 and 14 gain a writing point, and chapter 10's sections are now all rated 8 or 9 for writing.

## Status of earlier findings

Each finding from the chapter 4 to 15 reports, checked against `git show 7d2c7e0` and the files at `d55c2c8`. “Applied” means the change the finding proposed is in the text. “Partly” names what is still missing. No finding was left open.

| Finding | Priority | Status | Evidence at `d55c2c8` |
| --- | --- | --- | --- |
| RR-04-01 | Medium | Applied | Parser and trust rules precede `### Unity 6000.3.11f1 on iOS: a patch for link delivery`, which names the tested and untested link kinds |
| RR-04-02 | Medium | Applied | Resource/request/exception table; see new [RR-04-06](#findings-from-the-recheck) for the paragraph that now repeats it |
| RR-04-03 | Medium | Applied | Payload × foreground/background/tap table, with the intent-extras warning kept |
| RR-04-04 | Medium | Applied | RFC 7636 verifier and challenge given, plus a button-to-session timeline |
| RR-04-05 | Medium | Applied | Pause scoped to a normal move to the background, with checkpoints as progress happens |
| RR-05-01 | Medium | Applied | Need/prefer/why table for the three mechanisms |
| RR-05-02 | Low | Applied | “assembles it from the source manifests in the project rather than from one file anyone maintains” |
| RR-05-03 | Medium | Applied | `strictly` wording now conditional on the older release having every API |
| RR-05-04 | Medium | Applied | A lab bridge with no consumer rules, an offline retrace route, and a two-library fixture |
| RR-05-05 | Low | Applied | `### API levels: minimum, target and compile` |
| RR-06-01 | Medium | Applied | Warnings investigation moved under its own heading and labeled as this probe's figures |
| RR-06-02 | Medium | Applied | Four-step lock procedure and EDM4U ownership paragraph |
| RR-06-03 | Low | Applied | `### URL-scheme queries and background modes`, with an observable consequence for each |
| RR-06-04 | Medium | Partly | Local pod fixtures supplied. The profile exercise ([06-ios-builds.md, line 179](../../../content/mobile-platform/06-ios-builds.md#L179)) still needs a profile the team signs with, and no redacted profile fixture was added |
| RR-07-01 | Medium | Applied | Platform/diff/sheet table, plus an invented practice packet |
| RR-07-02 | Medium | Applied | Buffer, collect and transmit distinguished; discard-at-source mode stated |
| RR-07-03 | Medium | Applied | `occurred_at_ms` defined; `EventSchema` labeled as game-owned, with a fixture |
| RR-07-04 | Medium | Applied | Late-start timeline and the two owners |
| RR-07-05 | Low | Applied | The block is labeled as one of five exports, and the other four are named |
| RR-08-01 | Medium | Applied | “no usable response, not that the server was silent” |
| RR-08-02 | Medium | Applied | Six internal headings; the invariant precedes the types |
| RR-08-03 | High | Applied | Refresh-token check after the await, with a three-step failure order; exercise extended |
| RR-08-04 | Medium | Applied | JSON/serializer/mapper table |
| RR-08-05 | Medium | Applied | The mapper is named as the one enforcing place; code comment updated |
| RR-08-06 | Medium | Applied | Six-change JSON history; Node stall handlers for the timeout lab |
| RR-09-01 | High | Applied | `WaitForRefresh` sketch and a two-caller example |
| RR-09-02 | Medium | Applied | Pseudocode loop with breaker, budget, `Retry-After` and deadline, and a lost-response trace |
| RR-09-03 | Medium | Applied | Resend window versus retention, with a 12/24/30-hour example; “five rules” |
| RR-09-04 | Medium | Applied | New concept `network-reconciliation` (3 variants), with consent |
| RR-09-05 | Medium | Applied | Minimal fake listener, restart procedure, and what fake and socket tests each prove |
| RR-10-01 | Medium | Applied | Settings table first, then the assertion bug, then the export evidence |
| RR-10-02 | Medium | Applied | Eight-row guard result table, with the two edge rows explained |
| RR-10-03 | Medium | Applied | Sample stamp and log line; `StoreBuild` scoped against chapter 11 |
| RR-10-04 | Medium | Applied | Relative-drop wording, a 40% to 38% example, the 1 − 0.999^500 assumption, and a sample policy |
| RR-11-01 | High | Applied | `ci/check-results.sh` with a stated policy and six fixtures; `ci-batchmode-evidence` answer and explanation revised with consent |
| RR-11-02 | Medium | Applied | Test-stage skeleton, helper-script map, macOS label assumption |
| RR-11-03 | Medium | Applied | Four-step lifecycle, command table, separate evidence sentence; see new [RR-11-06](#findings-from-the-recheck) |
| RR-11-04 | Low | Applied | The cause list folded into a ten-row symptom table |
| RR-11-05 | Medium | Applied | Invented timings, log lines and a release manifest for readers without CI |
| RR-12-01 | Low | Applied | Planned 45-minute column, range column, and provenance after the table |
| RR-12-02 | Medium | Applied | Twelve-key modulo example, a 0–99 ring, `### Which node holds a key` and `### Replicas and backups`; see new [RR-12-05](#findings-from-the-recheck) |
| RR-12-03 | Medium | Applied | `### Lab: run the consumer locally` with a harness and exact expected numbers |
| RR-12-04 | Medium | Applied | Signpost that chapter 13 refines the spending rule for refunds |
| RR-13-01 | Medium | Applied | Six internal headings and a three-column completion table |
| RR-13-02 | Medium | Applied | Baseline declared complete, then ties/resets, scaling and friends/cheating; evidence note; N and K distinguished |
| RR-13-03 | Medium | Applied | Mute record, authorization and enforcement paragraph; new concept `design-chat-order-moderation`, with consent |
| RR-13-04 | Medium | Applied | Monday-to-Sunday resend timeline separating event retention from id retention |
| RR-13-05 | Low | Applied | “a different approach, not a fifth technique” |
| RR-14-01 | Medium | Applied | Four-step queue sequence and a separate backgrounding paragraph |
| RR-14-02 | Medium | Applied | Conditions before the code, the job's three properties after it, a two-writer trace and an evidence note |
| RR-14-03 | Medium | Applied | 720 hours, 0.02 × 720 = 14.4, 14.4 × 0.1% = 1.44%, and policy separated from calculation |
| RR-14-04 | Medium | Partly | Cascade numbered, and each defense breaks one step. The chapter-wide trim of attribution was not done: 20 lines still name the SRE book or workbook (the `7d2c7e0` message records this) |
| RR-14-05 | Medium | Applied | `design-privacy-rules` split from `design-data-retention`, with consent |
| RR-15-01 | High | Applied | Paired fictional thread traces, and the table rows each observation weakens |
| RR-15-02 | Medium | Applied | Containment, evidence, contract repair, backlog recovery, and verification headings |
| RR-15-03 | Medium | Applied | `boundary-platform-mechanisms` split out; two method variants added to `boundary-first-split`; distractors replaced, with consent |
| RR-15-04 | Medium | Applied | `### A practice packet` with a reduction log and acceptance criteria |

**Counts:** 57 findings: 55 applied, 2 partly applied (RR-06-04, RR-14-04), 0 open. Of the 5 high-priority findings, all are applied.

Across the whole run, 31 chapter and glossary findings are open: 6 in chapter 1, 5 in chapter 2, 8 in chapter 3, 9 in the glossary and the 3 new findings below. The 2 partly applied findings have open remainders. The 12 chapter 16 findings are applied.

### Findings from the recheck

Three new findings come from text that `7d2c7e0` added. They follow the chapter reports' format and priorities.

#### RR-04-06: The permissions table is followed by a paragraph that repeats it

Low priority. Scope: prose. Section: `os-permissions`. Source: [04-os-integration.md, line 178](../../../content/mobile-platform/04-os-integration.md#L178).

> after the player answers, a new request returns the recorded answer without a prompt. A new location request after an answer does nothing.

The new table already gives both rules and the provisional-authorization exception, and the paragraph after it restates all three. The reader looks for what the paragraph adds and finds only the Settings link and the C# calls. Proposal: keep the guide link on the table's lead-in, cut the three restated sentences, and keep the Settings and `Application.RequestUserAuthorization` sentences.

#### RR-11-06: The cleanup sentence runs on into Unity licensing

Low priority. Scope: prose. Section: `ci-secrets-signing`. Source: [11-ci-and-jenkins.md, line 607](../../../content/mobile-platform/11-ci-and-jenkins.md#L607).

> and a deletion placed after it would never run; Unity itself needs a license on each agent too.

The `7d2c7e0` edit moved the bound-file sentence earlier and left the semicolon that followed it. It now joins keychain cleanup to agent licensing, which are unrelated. Proposal: end the sentence at “would never run.” and start a new paragraph at “Unity itself needs a license on each agent too.”

#### RR-12-05: The ring example's uneven shares are equal

Medium priority. Scope: prose (worked example). Section: `design-storage`. Source: [12-system-design.md, line 362](../../../content/mobile-platform/12-system-design.md#L362).

> in the example, C holds the stretch from 41 to 70 and B only the stretch from 11 to 40.

The two stretches are both 30 positions long, so the example shows equal shares while the sentence claims uneven ones. A reader who checks the numbers, as the section invites, finds the illustration contradicting its point. The uneven share in this ring is A's, which holds 71 to 99 and 0 to 10, 40 positions against 30 each for B and C. Proposal: compare A with B, or move a node (for example C to 80) so that the gaps visibly differ, and recheck the six example keys and node D against the new positions. This is arithmetic in the text, not a technical claim.

## Book-wide findings

Each consolidates a recurring issue. Status is given at HEAD. For the chapter findings that are already applied, the book-wide finding records the pattern so that later edits do not reintroduce it.

### RR-BK-01: Investigation narration in the teaching voice

Medium priority. Scope: prose structure.

The book's evidence rule ([docs/PLAN.md](../../PLAN.md), “This book checks its claims while it is written”) produced probe narration in many sections: what a test project did, with its versions and counts, often before or inside the rule it supports. Representative findings: [RR-03-01](chapter-03.md) (the Metal display-link remark), [RR-03-05](chapter-03.md), [RR-04-01](chapter-04.md), [RR-06-01](chapter-06.md), [RR-07-01](chapter-07.md), [RR-10-01](chapter-10.md), [RR-10-02](chapter-10.md), [RR-12-01](chapter-12.md), [RR-13-02](chapter-13.md), [RR-14-02](chapter-14.md), [RR-14-04](chapter-14.md) and [RR-16-09](../2026-09-29-7d2c7e0/chapter-16.md). A related form is repeated attribution: in chapter 14, 20 lines name the SRE book or workbook (counted with `grep -c 'SRE book\|SRE workbook'`).

`7d2c7e0` settled most of these with three patterns worth making the convention: the rule first and the evidence after it; a labeled `Evidence note:` ([13-game-services.md, line 341](../../../content/mobile-platform/13-game-services.md#L341); [14-running-services.md, line 367](../../../content/mobile-platform/14-running-services.md#L367)); and a version note under its own heading ([04-os-integration.md, line 339](../../../content/mobile-platform/04-os-integration.md#L339)). Still open: chapter 3's launch and post-processor paragraphs, and the RR-14-04 remainder. Proposal: apply the same three patterns there. In chapter 14, name the SRE book once per section at the claim it supports, and keep every link.

### RR-BK-02: Multi-topic paragraphs and long sentences

Medium priority. Scope: prose and internal headings.

Sections that teach several topics in one paragraph or with no headings recurred in Pass 1: [RR-01-02](chapter-01.md), [RR-01-06](chapter-01.md), [RR-02-04](chapter-02.md), [RR-03-01](chapter-03.md), [RR-03-04](chapter-03.md), [RR-08-02](chapter-08.md), [RR-11-03](chapter-11.md), [RR-12-02](chapter-12.md), [RR-13-01](chapter-13.md), [RR-13-02](chapter-13.md), [RR-14-01](chapter-14.md) and [RR-15-02](chapter-15.md). Those in chapters 4 to 15 are applied. The book now has 30 level-three headings, and chapters 1 to 3 have none. Chapter 3 is the book's steepest point for its position: its 14,394 words are the third most in the book, it has the most probe markers (22), and 17% of its prose sentences run to 40 words or more. That is a lot of load for the third chapter a new reader meets.

Sentence load is measured, not gated. Method: prose lines outside code fences, tables, lists and question blocks, with links reduced to their text and code spans to one token, then split at sentence ends. Mean length is 23 to 26 words in chapters 1 to 9, 27 to 29 in chapters 10 to 14, 16.5 in chapter 15 and 22.5 in chapter 16. The share of sentences of 40 words or more is 18% to 23% in chapters 10 to 14 and 1% in chapter 15. Long sentences are not defects by themselves. They matter where a sentence carries a rule and its exceptions together, as in the paragraphs RR-14-01 and RR-14-02 fixed. Proposal: apply the chapter 1 to 3 findings. Then run one targeted pass over paragraphs in chapters 10, 11 and 14 that hold more than one rule, splitting rule from qualification. Do not apply a length target.

### RR-BK-03: Exercises that assume access the reader may not have

Medium priority. Scope: exercise prose.

The outline's reader has “little hands-on experience with Gradle, Xcode, native plugins or CI”, yet many exercises start from “a project you know”, a device, a Mac, a CI pipeline or a past incident. Representative findings: [RR-05-04](chapter-05.md), [RR-06-04](chapter-06.md), [RR-08-06](chapter-08.md), [RR-11-05](chapter-11.md), [RR-15-04](chapter-15.md) and [RR-16-10](../2026-09-29-7d2c7e0/chapter-16.md), all applied except the RR-06-04 remainder. `7d2c7e0` added fallbacks throughout chapters 4 to 15: invented packets, fixtures and mock inventories. That now makes chapters 1 to 3 the outliers. All six chapter 1 exercises ask about “a project you know” ([chapter 1 report](chapter-01.md), exercises). Chapter 2's labs do not say whether an emulator will do, and chapter 3's native timer lab gives no starting code. [RR-02-01](chapter-02.md) and [RR-03-02](chapter-03.md) are the two labs that cannot start as written. Proposal: give each exercise in chapters 1 to 3 a one-line fallback in the style of chapter 7's invented packet ([07-sdk-integration.md, line 51](../../../content/mobile-platform/07-sdk-integration.md#L51)), and add the redacted profile fixture that RR-06-04 asked for.

### RR-BK-04: Worked examples that stop before the step that makes them usable

Medium priority (the high-priority instances are applied). Scope: code presentation and prose.

Pass 1 found examples that leave out the declaration, wiring or decisive observation that a learner needs to imitate them: [RR-01-03](chapter-01.md), [RR-01-05](chapter-01.md), [RR-02-02](chapter-02.md), [RR-04-04](chapter-04.md), [RR-07-03](chapter-07.md), [RR-07-05](chapter-07.md), [RR-08-03](chapter-08.md), [RR-09-01](chapter-09.md), [RR-09-02](chapter-09.md), [RR-10-03](chapter-10.md), [RR-11-02](chapter-11.md), [RR-12-03](chapter-12.md), [RR-15-01](chapter-15.md) and [RR-16-01](../2026-09-29-7d2c7e0/chapter-16.md). Three of them (RR-08-03, RR-09-01 and RR-15-01) were high priority. All are applied except RR-01-03, RR-01-05 and RR-02-02. Chapter 1's `mainThread` queue and its `ToResult` call sit in the book's foundational completion-source example, which chapters 2, 3 and 7 imitate. That example matters more than its low line count suggests. Proposal: apply the three open findings. For future sections, check that each code block's undeclared names are declared or called out in a comment.

### RR-BK-05: Concepts that track two skills, and explanations that teach beyond the prose

Medium priority. Scope: question blocks and concept structure (consent required).

Recurring in Pass 1: [RR-02-03](chapter-02.md) (configuration changes inside `android-new-intent`), [RR-03-06](chapter-03.md) (explanations that use `SIGABRT` and `SIGKILL`, which the prose never names), [RR-09-04](chapter-09.md), [RR-13-04](chapter-13.md), [RR-14-05](chapter-14.md), [RR-15-03](chapter-15.md), [RR-16-02 and RR-16-03](../2026-09-29-7d2c7e0/chapter-16.md). The chapter 8, 9, 13, 14 and 15 instances were resolved with the user's consent ([structure-changes.json](../structure-changes.json)). Open: RR-02-03's question part, and RR-03-06, whose prose-only route (adding both signals to the termination table) needs no consent. There is also one candidate that no finding numbered: the chapter 6 report noted that the `xcode-pod-conflict` variant asking where the installed version shows ([06-ios-builds.md, line 516](../../../content/mobile-platform/06-ios-builds.md#L516)) tests the lock record rather than conflict resolution. Proposal: see the [editing plan](editing-plan.md), batch 6.

### RR-BK-06: Terminology and naming drift

Low priority. Scope: prose, glossary, front matter.

- **Player Settings.** Chapters 2 to 8 write “Player Settings” (22 occurrences). Chapter 10 writes “Player settings” 32 times, chapter 11 3 times and chapter 3 once. The glossary uses both (3 and 1). Counted with `grep -o` per file, links included. Pick one, as the name of Unity's settings window, and apply it throughout.
- **Unity version.** The book's rule is “Unity 6.3” for the release and “6000.3.11f1” where a patch-level observation needs it. Two places break it: “In Unity 6000.3” at [15-debugging-across-boundaries.md, line 138](../../../content/mobile-platform/15-debugging-across-boundaries.md#L138), and the Deep link glossary entry ([RR-GL-05](glossary.md)).
- **“capability”.** It means a game-owned feature behind an interface in 71 chapter uses, and it is an alias of Entitlements in the glossary ([RR-GL-04](glossary.md)).
- **Chapter titles.** Chapters 1 to 14, and all fifteen chapters of the first book, set `chapter: NN: Title` in their front matter. Chapters 15 and 16 set `chapter: Debugging across boundaries` and `chapter: Interview practice for platform roles` with no number, so the site shows them in a different form from the others. The parser makes the chapter's id from this title (`pipeline/parse.ts`, line 215), so adding the number changes the id. Before editing, check what the id feeds: routes and any bookmarks, and unlocking.

### RR-BK-07: Backward chapter mentions left as plain text

Low priority. Scope: prose links (two are inside committed question blocks).

Phase 34 turned 28 forward mentions into `[[#id]]` links. Backward mentions such as “which chapter 4 describes” were mostly left as plain text. Reported per chapter: [RR-02-05](chapter-02.md), [RR-03-08](chapter-03.md), [RR-GL-03](glossary.md) and [RR-16-06](../2026-09-29-7d2c7e0/chapter-16.md) (applied). Pass 2 found more with the same form: [05-android-builds.md, lines 500 and 521](../../../content/mobile-platform/05-android-builds.md#L500) (“which chapter 4 describes”, “which chapter 4 covers”); [08-backend-clients.md, lines 390, 573, 575 and 584](../../../content/mobile-platform/08-backend-clients.md#L390); and [09-reliable-networking.md, line 458](../../../content/mobile-platform/09-reliable-networking.md#L458). Where a sentence already carries the section link elsewhere, the mention can stay. Search method: every “chapter N” in chapters 4 to 16 and the glossary, after `[[...]]` links and code spans were removed, read in context; chapter-level orientation sentences (“Chapter 13 designed the game's services”) were excluded. The two mentions inside explanations (chapter 2, line 472; chapter 3, line 125) need consent even though they only add a link.

### RR-BK-08: A rule stated before its scope

Low priority. Scope: prose wording.

A sentence states a rule as universal, and a later sentence or chapter narrows it: [RR-04-05](chapter-04.md) (pause as the last safe moment), [RR-05-02](chapter-05.md) (“nobody writes it by hand”), [RR-05-03](chapter-05.md) (“chooses which SDK breaks”), [RR-12-04](chapter-12.md) (the wallet rule refined in chapter 13), [RR-03-07](chapter-03.md) (a return value of 0 that reads as success), [RR-GL-01](glossary.md) and [RR-GL-07](glossary.md). The chapter 4 to 12 instances are applied. RR-03-07, RR-GL-01 and RR-GL-07 are open. The fix is always the same: put the condition in the sentence that states the rule, as chapter 12 now does with “That constraint is the rule for spending”.

### RR-BK-09: Chapter 15 writes in a different voice

Low priority. Scope: style consistency; editorial judgment, not a defect to remove.

Chapters 1 to 14 teach in the third person about the game (“the game saves”, “the adapter decides”), with sentences averaging 23 to 29 words. Chapter 15 addresses the reader in the imperative (“Start by naming the outcome”, “Use the path”, “Choose the next check”), averages 16.5 words a sentence, and fills its tables with noun lists (“Initialization state, raw result category, callback thread and time”). Chapter 16's second person suits interview practice. Chapter 15's voice also suits a method chapter, and its short sentences are easier to read than the book's average. The shift is abrupt, though, and the three glossary entries written for chapter 15 carry its hedged voice into the glossary ([RR-GL-02](glossary.md)). Proposal: keep chapter 15's sentence length as a model. Change only the glossary entries (RR-GL-02). Optionally give the chapter one opening sentence that says it turns the book's mechanisms into a method, as chapters 12 to 14 open by placing themselves.

### RR-BK-10: Interview practice arrives late

Low priority. Scope: exercise prose; editorial preference.

The book's purpose is interview depth, but its `Interview exercise:` closers appear only in chapters 12 (2), 13 (1), 15 (1) and 16 (4). Chapters 1 to 11, the platform core, have none. Chapter 16 closes the loop well: every rubric row names the section to reread, so a learner is not stranded. A learner who practises along the way, though, first speaks an answer in chapter 12. Proposal, optional: in three or four core chapters (for example 4, 7, 8 and 11), turn one existing exercise into, or follow it with, a one-minute spoken answer that chapter 16 later grades. Do not add exercises only to meet a count.

## Progression and cross-chapter judgments

- **Assumed knowledge.** The book recaps the first book where it depends on it, and chapter 16 states its dependency on the first book's last chapter. Two early dependencies stop the learner and are open: chapter 1 compresses chapters 2 and 3's exception rules ([RR-01-02](chapter-01.md)), and chapter 2's first lab needs proxies from two sections later ([RR-02-01](chapter-02.md)). Forward references elsewhere are useful, and they are linked since Phase 34. The move to the backend at chapter 12 is well prepared: its opening says where chapters 8 and 9 stopped and what chapters 13 and 14 add.
- **Difficulty.** Chapters 3, 13 and 14 are the heaviest (see RR-BK-02). The chapter 13 and 14 load suits their position, near the end of the book. Chapter 3's does not, which is why batch 2 of the editing plan starts there.
- **Later chapters build on earlier examples.** The purchase is the book's backbone: chapter 1's `PurchaseResult` mapping, chapter 4's sign-in and pending operations, chapters 8 and 9's reward claim with its idempotency key, chapter 12's `GrantOnce`, chapter 13's ledger, chapter 15's purchase case and chapter 16's answers. Chapter 9 builds on chapter 8's session layer by name, chapter 11 on chapter 10's variants and guard, and chapter 14 on chapter 13's services.
- **Code walkthrough depth.** Chapters 1 to 11 walk through code line by line where it matters. Chapters 12 to 14 teach mainly with SQL, commands and tables (5, 7 and 4 code blocks), which suits system design. The difference is appropriate, and no finding is raised.
- **Chapter openings.** Every chapter opens on its subject. Chapters 9, 12, 13 and 14 place themselves against the chapters before them. Chapters 2, 3, 5 and 6 open straight into the mechanism, which works because chapter 1's table maps the path. Chapter 15's opening scenario (“A player sees ‘Purchase failed’”) is the most engaging start in the book.

## Strengths to preserve

- One call path and one evidence-per-layer table from chapter 1, reused by chapters 15 and 16.
- Failures shown with their real text: the `NoSuchMethodError` walk-through, `Library not loaded`, the deadlock timeline, the wrong-mapping-file retrace.
- Decision tables that turn a paragraph of cases into rows: the permissions and FCM tables (chapter 4), the three customization mechanisms (chapter 5), the serializer table (chapter 8), the guard results (chapter 10) and the CI symptom table (chapter 11).
- Explicit limits on each mechanism: remote switches stop calls and not native code; a passing attestation proves little; a timeout means unknown, not failed.
- The chapter 12 and 13 worked designs, which state requirements, derive numbers and name the failure windows.
- Chapter 16's “Where this book covers it” column, which turns the whole book into a set of remedies.

**Passages to use as models for revising weaker ones:**

| Model | Where | Use it for |
| --- | --- | --- |
| Early, repeated and late events, then one router | `platform-events` (chapter 1) | Any section that lists cases before its unifying mechanism |
| Priority, conflict markers, provenance | `gradle-manifest-merge` (chapter 5) | Causal sequences (RR-BK-02) |
| The two-caller deadline example | `network-timeouts` (chapter 9) | Timelines that make a concurrency rule checkable (RR-BK-04) |
| The numbered cascade, and “breaks step N” | `design-degradation` (chapter 14) | Paragraphs that pair a failure chain with its defenses |
| `Evidence note:` and the version-note heading | chapters 13, 14 and 4 | Investigation narration (RR-BK-01) |
| The invented SDK packet | `sdk-evaluation` (chapter 7) | Exercise fallbacks (RR-BK-03) |
| `ci/check-results.sh` and its six fixtures | `ci-pipeline-shape` (chapter 11) | Examples that state a policy and test it |
| Estimation table and queue-drain arithmetic | `design-estimation` (chapter 12) | Showing arithmetic step by step |
| Six-step narration and “what would change your mind” | `interview-debugging-answer` (chapter 16) | Interview exercises in earlier chapters (RR-BK-10) |

## Highest-impact open work

1. Chapters 1 to 3's examples and labs (RR-01-03, RR-01-05, RR-02-01, RR-02-02, RR-03-02, with RR-BK-03's fallbacks). These are the first code a reader imitates, and they are now the weakest point in the book's otherwise consistent practice route.
2. Chapter 3's structure and the forward-compressed rule in chapter 1 (RR-03-01, RR-03-04, RR-01-02). This is the steepest point in the book, at its start.
3. RR-12-05, a worked example that contradicts its own point, added in the latest edit.
4. The glossary's Observer summary (RR-GL-01) and chapter 15 entries (RR-GL-02). Preview cards appear at the moment of need, and one of them contradicts its body.

## Method and measurements

- Recheck: `git show 7d2c7e0` for each of chapters 4 to 15, read against every finding. The files at `d55c2c8` were checked where a finding's evidence lay outside the diff: the burn-rate derivation (chapter 14), the profile exercise (chapter 6) and the SRE mentions (chapter 14).
- Word counts: `wc -w` per file, which includes questions and code. Prose counts exclude code fences, tables, list lines and question blocks.
- Sentence statistics: described under RR-BK-02. They describe the prose and are not scores.
- Terminology counts: `grep -o` per file, with the patterns given in each finding.
- Input hashes at HEAD (SHA-256, first 16 hex digits): chapters 1 to 3 and the glossary match their reports (`86d81175…`, `ba2e70bc…`, `09edfd6a…`, `29d61c10…`). Chapter 16 is `c691bdd9…`, changed since its scoped review by the application of its findings.

## Limits

- Source review only. No rendered page, preview card or phone-width layout was inspected.
- No technical claim was verified, and no command was run beyond reading and counting. The technical referrals in the chapter and glossary reports remain open for Phase 35, unverified. Nothing here asserts that a technical claim is wrong. RR-12-05 is internal arithmetic, and RR-GL-01 is an internal contradiction.
- Chapters 4 to 15 were not re-read in full after `7d2c7e0`. The recheck covered each finding, every changed passage and the book-wide measurements. A defect elsewhere in text that `7d2c7e0` did not touch would have been found by the original reviews at `b53e4f0`.
- Chapter 16 was not re-read after `d55c2c8` applied its findings. Its ratings are those of the scoped run.
- Concurrent technical review requests in `docs/review-requests/` were not read or used, as the brief required.
- No AI-writing detector was run.
