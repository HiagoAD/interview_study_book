# Review request: questions that test arithmetic, and one accepted-answer list

- **Kind:** question design
- **Priority:** low
- **Where:** four concepts, listed below
- **Touches:** question blocks beyond their `-` lines: a new variant on three concepts, and one accepted answer

Phase 16 replaced the distractors this request first listed. Two problems remain: three
concepts that test only the multiplication their prompt sets up, and one accepted-answer
list that marks a correct answer wrong when it is typed with its unit.

## Questions that test arithmetic rather than the section

Three concepts ask only for a multiplication the prompt sets up:

- `missions-scale-estimate` (03:274): 20 × 100.
- `structures-pair-count` (09:46): 1,000 × 1,000.
- `performance-work-frequency` (11:147): 0.02 × 1,000.

Each section's point is what the product means, or does not: “It does not claim that every
predicate has equal cost”, “Reducing how many candidates need checking may help much
more”, “Small per-entity work can exceed an entire frame budget”. A reader can answer all
three without reading the section. Changing that needs more than `-` lines: a new prompt
on the same concept, or a `?+` variant that asks what the figure does not establish.
Leaving them costs little; they are easy review, not wrong review.

## One accepted-answer list

`performance-60-budget` (11:42) accepts only `16.67`. A reader who types the unit,
`16.67 ms`, is marked wrong, because the check removes spaces and compares `16.67ms`, and
has to press **I was right**. Adding `16.67ms` to the `=` line would accept both
spellings. The `=` line is outside what a questions pass may change, so this is a decision
rather than a fix.
