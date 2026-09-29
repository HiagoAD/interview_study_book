# Review requests

Each file here records one problem for an editing pass to decide on, found by reading
`content/` in order. The first read looked for concepts the book uses before it explains
them. A second read, on 2026-09-22, read the book as a teacher would: it checked the
claims, code samples, worked numbers and questions of every section, and tested the
doubtful ones against a C# compiler and the installed Unity 2022.3 and 6000.3 Editors. The
same day, an online pass loaded all 28 of the book's external links and checked the Unity
facts these requests assert against Unity's 6.0 manual and scripting reference, so the
requests quote Unity where they correct the book. The scratch programs it used are not
kept in the repo.

Phases 11 to 17 of [docs/plan-history.md](../plan-history.md) applied the second read, and each request's
file was deleted as it closed. [structure-changes.json](structure-changes.json) stays: it
lists the concepts Phase 17 split off and the variants it moved, which is the one record of
where those questions came from.

## Kinds of request

| Kind | What it records | Does the glossary close it? |
| --- | --- | --- |
| Forward reference | A concept used as though the reader knows it, which a later section explains properly | Yes, for a reader who needs it now |
| Accuracy | A claim, code sample or worked number that is wrong, or misleading as written | No: the reader learns it, and review repeats it |
| Question design | A question block whose shape weakens review | No |
| Coverage | Behavior the book explains without the name an interviewer asks for | No |
| Consistency | Links, cross-references, placement and naming | No |

A forward-reference request exists when both of these are true:

- the concept is used as though the reader knows it, and
- a later section explains it properly.

Where nothing later explains a term, there is no request. That gap is closed by the
glossary entry alone, and the entry is the permanent home. Forward references are notes
rather than defects, because the glossary already answers a reader who needs one now. The
other kinds are defects.

**Priority** applies to the other kinds. *High*: the book teaches something false that a
reader will repeat in an interview, or that the review queue will keep reinforcing.
*Medium*: misleading or incomplete in a way that costs the reader, or a worked example
that does not add up. *Low*: precision and polish.

**Touches** says what a fix changes, because question blocks are progress. Prose, code
fences and glossary entries can change freely. A questions pass may change a question
block's `-` lines and nothing else. Any other change inside a question block (a prompt, a
`*` option, an `=` answer, an explanation, or which concept a variant belongs to) needs an
explicit decision, and the request says what it would cost the reader's review history.

## Open requests

Phase 35 of [docs/plan-history.md](../plan-history.md), the teacher's read of the second book, The
Platform Layer, on 2026-09-29, left 27 requests, named `<chapter>-<topic>.md` after the chapter
where each problem first appears. They checked the book at `d55c2c8` against its evidence files,
the vendors' pages, the Unity 6000.3 Editor's shipped files, .NET 8 probes and one offline Gradle
build of the probe project's Android export. Each request says what it could not check. Eight
touch a committed question block, and none of those may change without the user's consent.

| Request | Ch. | Kind | Priority | Touches | Problem |
| --- | --- | --- | --- | --- | --- |
| [05-edm4u-resolver-modes](05-edm4u-resolver-modes.md) | 05 | Accuracy | High | prose, glossary, question block (prompt, `*`, explanation) | Since EDM4U 1.2.179 the resolver turns on the Gradle template and deletes its own earlier copies, so a variant's correct answer describes a duplication it prevents |
| [07-release-build-what-differs](07-release-build-what-differs.md) | 07 | Accuracy | Medium | prose | Says R8, stripping and signing act only in a release build; chapter 10 shows only R8 depends on the build type |
| [09-log-line-timing-and-categories](09-log-line-timing-and-categories.md) | 09 | Accuracy | Medium | prose, code | The sample log line's 504 after 10,012 ms contradicts the 10 s attempt timer, and the categories omit 5xx |
| [12-consistent-hashing-uneven-example](12-consistent-hashing-uneven-example.md) | 12 | Accuracy | Medium | prose | The ring's example of uneven shares compares two 30-position stretches |
| [16-release-thread-exception](16-release-thread-exception.md) | 16 | Accuracy | Medium | prose | The narration expects a main-thread exception that release player libraries do not contain |
| [01-task-resume-main-thread-inline](01-task-resume-main-thread-inline.md) | 01 | Accuracy | Low | prose | An awaited task completed on the main thread resumes at once, not on a later frame |
| [01-purchase-mapping-method-name](01-purchase-mapping-method-name.md) | 01 | Accuracy | Low | code | `BuyAsync` calls `PurchaseMapping.ToResult`, which the class shown does not define |
| [03-handle-finalizer-explanation](03-handle-finalizer-explanation.md) | 03 | Accuracy | Low | question block (explanation) | The reason given against freeing a handle in a finalizer does not hold in the chapter's design |
| [04-att-row-repeat-request](04-att-row-repeat-request.md) | 04 | Accuracy | Low | prose | The tracking row of the repeat-request table does not say what a repeat request does |
| [04-usage-description-location-glossary](04-usage-description-location-glossary.md) | 04 | Accuracy | Low | glossary | The Info.plist entry says every missing usage description ends the app |
| [05-duplicate-class-check](05-duplicate-class-check.md) | 05 | Accuracy | Low | prose, question block (two explanations) | Duplicate classes fail in AGP's own check before DEX, with another message |
| [07-fcm-service-selection](07-fcm-service-selection.md) | 07 | Accuracy | Low | prose | Cites the wrong Android rule for which push service receives a message |
| [07-families-self-certification](07-families-self-certification.md) | 07 | Accuracy | Low | prose | The ads SDKs certify themselves; Google Play keeps the list |
| [09-background-transfer-process](09-background-transfer-process.md) | 09 | Accuracy | Low | prose | User-initiated data transfer jobs run in the app's own process |
| [11-signing-cleanup-shared-agent](11-signing-cleanup-shared-agent.md) | 11 | Accuracy | Low | code, prose | A fixed profile name lets two builds on one agent delete each other's profile (from reading, not a run) |
| [12-consumer-lab-unhandled-exception](12-consumer-lab-unhandled-exception.md) | 12 | Accuracy | Low | prose | The lab's third case ends the program before its numbers can be read |
| [13-telemetry-id-horizon](13-telemetry-id-horizon.md) | 13 | Accuracy | Low | prose, question block (explanation) | The id-horizon example treats a late first upload as a duplicate |
| [01-intro-omits-service-design](01-intro-omits-service-design.md) | 01 | Consistency | Low | prose | The introduction predates chapters 12 to 14 |
| [05-plain-text-chapter-references](05-plain-text-chapter-references.md) | 05 | Consistency | Low | prose, glossary | Four mentions of written chapters are still plain text |
| [07-analytics-user-id-seam](07-analytics-user-id-seam.md) | 07 | Consistency | Low | code | No method sets the user id that the prose says the service sets |
| [14-backfill-writer-retirement](14-backfill-writer-retirement.md) | 14 | Consistency | Low | prose | Two rules for when old writers must be retired |
| [15-chapter-title-numbers](15-chapter-title-numbers.md) | 15, 16 | Consistency | Low | front matter | The two titles lack the “NN: ” prefix; the chapter id may depend on it |
| [15-operation-id-naming](15-operation-id-naming.md) | 15 | Consistency | Low | prose | Names chapter 9's correlation id and attempt number differently |
| [05-intent-filter-option-length](05-intent-filter-option-length.md) | 05 | Question design | Low | question block (`-` lines) | The correct option is the shortest by 21 characters |
| [09-ledger-option-length](09-ledger-option-length.md) | 09 | Question design | Low | question block (`-` lines) | The correct option is the longest by 17 characters |
| [15-streamingassets-case-distractor](15-streamingassets-case-distractor.md) | 15 | Question design | Low | question block (one `-` line) | A distractor is a check the section recommends |
| [15-dyld-min-version-distractor](15-dyld-min-version-distractor.md) | 15 | Question design | Low | question block (one `-` line) | A distractor may be correct for a missing system framework (partly unverified) |

By kind and priority: 17 accuracy (1 high, 4 medium, 12 low), 6 consistency (low), 4 question
design (low), and no forward references, since the book wrote its glossary with each chapter.
The companion [reader review](../reader-reviews/2026-09-29-b53e4f0/index.md) judged learning and
writing rather than accuracy; its [editing plan](../reader-reviews/2026-09-29-b53e4f0/editing-plan.md)
overlaps two of these requests (the ring example, as RR-12-05, and the plain-text references, as
RR-GL-03 and RR-BK-07), and a later section of the plan orders both sets into phases.

## How to close one

[docs/plan-history.md](../plan-history.md), under “Feature: second-read editing pass”, orders these
requests into Phases 11 to 17, says which phase closes each one, and lists the defaults it
assumes for the choices the requests leave open.

**Forward references** have three reasonable endings, and the right one differs per
concept:

1. **Leave it.** The forward reference is deliberate, and the glossary entry is the
   answer for a reader who needs one now. Delete the file.
2. **Point forward in the prose.** Name the chapter that covers it, the way chapter 02
   already writes “the regression trap described later under debugging”. Costs a clause.
3. **Move the explanation earlier**, or move the use later. The largest change, and the
   only one that removes the forward reference rather than signposting it.

Where an entry was written because of a request, closing the request does not mean
deleting the entry. A term with an entry and a section that develops it is the normal
arrangement here: the entry is the short answer, the section is the long one.

**Accuracy** requests close by correcting the text. Each lists the questions and glossary
entries that repeat the claim.

**Question design** requests close with a decision about the question block, taken with
the cost to review history that the request states. `npm run guard -- questions` then
shows that nothing else moved: `--allow distractors` for a change to `-` lines, and
`--allow structure` with a changes file like `structure-changes.json` for new concepts,
moved or added variants, and added answers.

**Coverage and consistency** requests close in place, a clause or a link at a time.

In every case, run `npm run check` after the edit, delete the file once it is closed, and
remove its row here.

## Considered and left out

Terms that a read flagged and a second look rejected, recorded so the judgement can be
overruled rather than repeated:

- **Garbage collection** (04, before 11 `performance-gc`). Assumed knowledge for the
  book's audience, and the sentences that use it early do not lean on the detail.
- **Managed code stripping** (06, before 08 `debugging-unity-scenarios`). The scripting
  backend entry covers why it bites, and chapter 08 explains it where it matters.
- **NUnit** (02). Named once, as the framework the example is written in.
- **Hitch** (07, 08, 11). Game jargon the surrounding sentences always make concrete.
- **Entity Component System** (07). Named and expanded once, in a paragraph about
  data-oriented design that gives the reason without the machinery.
- **Cohesion, coupling, assembly definitions, feature flags, seams.** Each is defined at
  its first appearance. They were on the original plan's list, and the read found they had
  since been covered in place.
- **Event buses** (01). The first read listed them with the terms above, but they are
  first named in two chapter 01 question options (lines 55 and 110), before
  `architecture-communication` defines them at line 268. They stay out because an option
  only has to be recognized as a mechanism offered without a reason, which is what both
  questions test, and the definition arrives in the same chapter.
- **Unscaled time** (01 `architecture-responsibilities`, before 02 `powerup-expiration`
  and 06 `unity-update-time`). The next line of the two-timer trace shows what it does, so
  the sentence teaches the term by example.
- **`Awake`, `OnEnable`, `Start` and `LateUpdate`** (01 and 04, before 06
  `unity-initialization`). Unity vocabulary on the level of prefab and Inspector; chapter
  06 explains their guarantees, which is the part the book needs.
- **Coroutine** (01 `engineering-study-method`, before 07 `async-models`) and
  **singleton** (01 `architecture-tradeoffs`, before 05 `patterns-selection`). Words a
  candidate preparing for a Unity interview has met. The chapter 01 sentences make their
  point without the detail, and each word has an entry for a reader who has not met it.
  Both requests were closed in Phase 11 with no change to the book.
