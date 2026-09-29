# The currency-ledger variant's correct option is the longest by 17 characters

**Kind:** Question design. **Priority:** Low. **Touches:** question block, `-` lines only, `content/mobile-platform/09-reliable-networking.md:546-549`.

## Location

`content/mobile-platform/09-reliable-networking.md:544-550`, the third variant of `network-reconciliation` (“Two devices were offline and each spent gems from the same balance. On reconnecting, how is the balance settled?”):

- `* A server-side ledger applies each spend as an operation, and both devices show its balance` (90 characters)
- the longest wrong option, `- The game keeps the higher of the two balances, as it does for best scores` (73)

## Evidence

A script over the question blocks of chapters 9 to 11 measured, for every single-answer set, how far the correct option exceeds the longest wrong one. This set is the only one in the three chapters where the gap is 10 characters or more (it is 17). The chapter's aggregate figures are within the standard (`npm run guard -- options`: longest in 22% of 41 sets, medians 61 and 60), but this one set can be answered by length, and it is also the only option that names a server, which the section's prose (line 456) makes the answer. The set was added in `7d2c7e0`, after the chapter's teacher's read measured the options.

## Proposed fix

Lengthen the wrong options with the reason each mistake gives, under `--allow distractors`; no prompt, answer or explanation changes, so no review history is lost:

- `- The game keeps the higher of the two balances, as a merge does for best scores and unlocks`
- `- The game keeps the balance of the device that reconnects last, as last writer wins does for saves`
- `- The game shows both balances and asks the player which one is correct, as it does for save conflicts`
- `- Each device subtracts the other's spend from the balance it holds, once the two have synced`

## Repeated elsewhere

None.
