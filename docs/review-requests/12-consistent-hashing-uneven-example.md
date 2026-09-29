# The ring example shows two equal stretches as its case of uneven shares

**Kind:** Accuracy. **Priority:** Medium (the worked example contradicts the point it makes). **Touches:** prose only.

## Location

`content/mobile-platform/12-system-design.md:362`, in `design-storage`, under “Which node holds a key”:

> One point on the ring for each node gives uneven shares, since the gaps between points differ: in the example, C holds the stretch from 41 to 70 and B only the stretch from 11 to 40.

## Evidence

The example at line 360 puts A at 10, B at 40 and C at 70 on a ring of positions 0 to 99, and gives each key to the next node along the ring. Counted by hand:

| Node | Before D joins | After D joins at 55 |
| --- | --- | --- |
| A | 71 to 99 and 0 to 10: 40 positions | 40 positions |
| B | 11 to 40: 30 positions | 30 positions |
| C | 41 to 70: 30 positions | 56 to 70: 15 positions |
| D | none | 41 to 55: 15 positions |

The sentence compares C's 41 to 70 with B's 11 to 40. Both are 30 positions, so the example gives two equal shares as its case of unequal ones. A reader who counts the positions finds that the example disproves its own sentence. The rest of the paragraph, including the simulation's figures of 0.3% to 30.7% with one point each and 7.5% to 11.2% with 100 points, is not affected, and those figures match the evidence file's run 1.

The text came in with the reader review in commit `7d2c7e0`, after the blind review of Phase 30, so no earlier review read it.

## Proposed fix

Replace the clause after the colon:

> One point on the ring for each node gives uneven shares, since the gaps between points differ: in the example, once D has joined, A holds the forty positions from 71 round to 10, and C only the fifteen from 56 to 70.

## Repeated elsewhere

No question block or glossary entry repeats the example.
