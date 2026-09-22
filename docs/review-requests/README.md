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

### Accuracy

| Request | Where | Priority |
| --- | --- | --- |
| [Double for time, integers for money](money-in-floating-point.md) | 02 `powerup-expiration` | medium |
| [Where a Play Mode write to a ScriptableObject goes](scriptableobject-play-mode-writes.md) | 02 `powerup-data-model`, glossary | medium |
| [Why an ID comparer is explicit](string-comparer-default.md) | 06 `unity-serialization`, 09 `structures-hash-collections` | medium |
| [Grid cell size and the cells a query touches](grid-cell-size.md) | 10 `algorithms-spatial`, glossary | medium |
| [What an inflated A-star heuristic gives up](weighted-heuristic-bound.md) | 10 `algorithms-pathfinding` | medium |
| [What a physics replay needs besides its inputs](physics-replay-determinism.md) | 06 `unity-update-time` | medium |
| [The Addressables summary promises too much](addressables-summary.md) | glossary | medium |
| [Worked numbers that do not add up](worked-numbers.md) | 11, 14 (twice), 15 | medium |
| [Code samples that do not do what the prose says](code-samples.md) | 02, 05, 06, 07, 09, 10, 13 | medium to low |
| [Precision notes](precision-notes.md) | fourteen places | low |

### Question design

| Request | Where | Priority |
| --- | --- | --- |
| [Variants that test a different concept](variants-that-test-another-concept.md) | nine concepts, chapters 01 to 09 | medium to high |
| [The first check for a first-use hitch](first-use-hitch-contradiction.md) | 08 `debugging-unity-scenarios` | medium |
| [Option sets that give the answer away or defend a wrong option](option-sets.md) | fourteen questions | medium to low |

### Coverage and consistency

| Request | Where | Priority |
| --- | --- | --- |
| [Name the Unity API where the book describes it](unity-api-names.md) | eleven places | medium |
| [Documentation links and the reference version](links-and-versions.md) | 10 of 28 links | medium |
| [Cross-references, placement, and naming](cross-references-and-placement.md) | six places | medium to low |

### Forward references

| Concept | First used | Explained in | Distance | Recommended ending |
| --- | --- | --- | --- | --- |
| [Object pool](object-pool.md) | 02 `powerup-collection` | 11 `performance-pooling` | 9 chapters | One clause in 02 |
| [Managed wrapper](managed-wrapper.md) | 01 `architecture-dependencies` | 06 `unity-destruction` | 5 chapters, no entry | A new entry, linked in 01 |
| [Frame budget](frame-budget.md) | 01 `architecture-requirements` | 11 `performance-frame-budget` | 10 chapters | The number in 01 |
| [Scripting backend](scripting-backend.md) | 06 `unity-editor-vs-player` | 12 `mobile-build-integrations` | 6 chapters | Name both backends in 06 |
| [Play Mode tests](play-mode-tests.md) | 02 `powerup-test-matrix` | 08 `testing-contracts` | 6 chapters | One clause in 02 |
| [Idempotence](idempotence.md) | 01, in a question | 03 `missions-reward-claim` | 2 chapters | Name it in 02 |
| [Spatial index](spatial-index.md) | 09 `structures-complexity` | 10 `algorithms-spatial` | 1 chapter | Name the grid in 09 |
| [Breadth-first search](breadth-first-search.md) | 09 `structures-specialized` | 10 `algorithms-pathfinding` | 1 chapter | Turn the sentence around |
| [Job System and Burst](job-system-and-burst.md) | 07 `async-models` | 07 `async-jobs-burst` | same chapter | One sentence under the table |

Each forward-reference file ends with that recommendation and its reason.

## How to close one

[docs/PLAN.md](../PLAN.md), under “Feature: second-read editing pass”, orders these
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
entries that repeat the claim; none of the current ones needs a question block changed.

**Question design** requests close with a decision about the question block, taken with
the cost to review history that the request states.

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
- **Deep profiling** (04, before 11 `performance-bottleneck`). One passing mention, in a
  list of three ways to check a claim.
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
