# Review requests

Each file here records one concept the book uses before it explains it, found by
reading `content/` in order. They are notes for an editing pass, not defects: the
glossary now covers every one of them, so no reader is stranded while they wait.

A request exists when both of these are true:

- the concept is used as though the reader knows it, and
- a later section explains it properly.

Where nothing later explains a term, there is no request. That gap is closed by the
glossary entry alone, and the entry is the permanent home.

## Open requests

| Concept | First used | Explained in | Distance |
| --- | --- | --- | --- |
| [Object pool](object-pool.md) | 02 `powerup-collection` | 11 `performance-pooling` | 9 chapters |
| [Coroutine](coroutine.md) | 01 `engineering-study-method` | 07 `async-models` | 6 chapters |
| [Frame budget](frame-budget.md) | 01 `architecture-requirements` | 11 `performance-frame-budget` | 10 chapters |
| [Scripting backend](scripting-backend.md) | 06 `unity-editor-vs-player` | 12 `mobile-build-integrations` | 6 chapters |
| [Singleton](singleton.md) | 01 `architecture-tradeoffs` | 05 `patterns-selection` | 4 chapters |
| [Play Mode tests](play-mode-tests.md) | 02 `powerup-test-matrix` | 08 `testing-contracts` | 6 chapters |
| [Idempotence](idempotence.md) | 01, in a question | 03 `missions-reward-claim` | 2 chapters |
| [Spatial index](spatial-index.md) | 09 `structures-complexity` | 10 `algorithms-spatial` | 1 chapter |
| [Breadth-first search](breadth-first-search.md) | 09 `structures-specialized` | 10 `algorithms-pathfinding` | 1 chapter |
| [Job System and Burst](job-system-and-burst.md) | 07 `async-models` | 07 `async-jobs-burst` | same chapter |

## How to close one

Three endings are reasonable, and the right one differs per concept:

1. **Leave it.** The forward reference is deliberate, and the glossary entry is the
   answer for a reader who needs one now. Delete the file.
2. **Point forward in the prose.** Name the chapter that covers it, the way chapter 02
   already writes “the regression trap described later under debugging”. Costs a clause.
3. **Move the explanation earlier**, or move the use later. The largest change, and the
   only one that removes the forward reference rather than signposting it.

Where an entry was written because of a request, closing the request does not mean
deleting the entry. A term with an entry and a section that develops it is the normal
arrangement here: the entry is the short answer, the section is the long one.

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
- **Cohesion, coupling, assembly definitions, feature flags, seams, event buses.** Each
  is defined at its first appearance. They were on the original plan's list, and the
  read found they had since been covered in place.
