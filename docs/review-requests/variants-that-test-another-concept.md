# Review request: variants that test a different concept

- **Kind:** question design
- **Priority:** medium to high, because it decides what the review queue can do for the reader
- **Where:** nine concepts in chapters 01 to 09, listed below
- **Touches:** question blocks, beyond the `-` lines a questions pass may change. Each fix adds a concept id or moves a variant; none renames an id.

## Why this matters on this site

Review works per concept, and a correct answer through any variant moves the concept up a
box (PROJECT.md, Spaced repetition). `pickVariant` (`src/engine/scheduling.ts:64`) shows a
never-shown variant first, and otherwise the one shown longest ago, leaving out the one
just answered wrongly.

Together those rules mean a concept should be one idea. A reader who misses variant 1 in
study is shown variant 2 at the first review. If variant 2 tests a different idea, the
reader answers it, the concept moves up a box, and the idea they missed has not been asked
again. It comes back only on the following review, three days later, and a concept can
climb the queue on the strength of the idea the reader already had. Nothing on screen
shows this happening.

A working rule for the future: a `?+` variant should be answerable by someone who
understands the `??` above it, and by nobody who does not.

## The clear cases

| Concept | The first variant tests | The other variant tests |
| --- | --- | --- |
| `architecture-lifetime` (01:230) | Unsubscribing when a binding's lifetime ends | Injecting the clock into an expiry rule (01:238) |
| `powerup-deadline-boundary` (02:168) | A strict comparison at the deadline | A deadline on a clock that stops during pause (02:176) |
| `powerup-extend-expired` (02:222) | Extending from an expired deadline | The refresh policy shortening an effect (02:230) |
| `powerup-pool-identity` (02:294) | A generation telling reused coins apart | Returning “already collected” for a repeat (02:302) |
| `missions-sequence-gap` (03:115) | Dropping a late sequence number | What a replay needs besides the seed (03:123) |
| `csharp-mutable-key` (04:164) | Mutating a key's equality fields | Resolving a hash collision (04:172) |
| `async-coroutine-thread` (07:47) | A coroutine is not a thread | Disabling a component does not stop its coroutines (07:51) |
| `testing-zero-tests` (08:232) | A run that discovered no tests | Native iOS behavior needing device evidence (08:240) |
| `structures-swap-back` (09:118) | Swap-back gives up order | Repairing the index map afterward (09:126 and 09:134) |

Two of the odd variants already have a better home in the same section: the collision
question is the idea `csharp-hash-contract` tests, and the iOS question is the idea
`testing-evidence-scope` tests.

## Borderline cases, left for judgment

Facets of one idea rather than two ideas, but a reader can hold one without the other:

- `csharp-shallow-copy` (04:62): struct copying, then reassigning a reference variable
  (two variants).
- `architecture-command-event` (01:289): a direct call when a result is needed, and
  delivery guarantees when a required update travels by event.
- `oop-composition-benefit` (05:99): why composition helps, and validating its missing
  parts.
- `async-stale-result` (07:127): releasing the stale asset, the generation check, and why
  cancellation is not enough. The last two are one idea; the first is the cleanup half of
  it.
- `liveops-kill-switch` (13:171): where a switch acts, and what it does to an outcome
  already committed.

`powerup-shared-config` (02:59) and `unity-awake-order` (06:62) looked similar and are
probably fine.

## Options

1. **Split or move the clear cases (recommended).** Turn each odd `?+` into a
   `?? <new-id>` line in the same section, keeping its options and explanation, or move it
   under the concept named above. Suggested ids: `architecture-inject-time`,
   `powerup-pause-clock`, `powerup-refresh-policy`, `powerup-duplicate-collection`,
   `missions-replay-inputs`, `async-coroutine-lifetime`, and `structures-index-repair`
   taking both index-repair variants. The collision variant moves under
   `csharp-hash-contract`, and the iOS variant under `testing-evidence-scope`.
2. **Rewrite the odd variant** so it tests its concept's idea. This keeps every count as
   it is, and loses the question.
3. **Leave them.** The ideas are adjacent, and each is tested at least once in study. The
   cost is the queue behavior described above.

## What option 1 costs the reader

Nothing already earned is lost. The old concept keeps its record, and a stored index past
its new variant count is ignored (`pickVariant`, “Stored indices at or past the current
variant count are ignored”). But a new concept starts with no history, and a section that
is already complete stays complete, so nothing prompts the reader to answer it: they meet
it only by practising the section again. A moved variant is in the same position, because
the concept that receives it is due only if the reader once missed it. So option 1 needs a
note to practise these nine sections again, or it quietly removes nine questions from the
reader's rotation until they do.
