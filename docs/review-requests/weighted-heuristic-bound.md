# Review request: what an inflated A-star heuristic gives up

- **Kind:** accuracy
- **Priority:** medium
- **Where:** `content/unity-engineering/10-game-algorithms.md:118`, section `algorithms-pathfinding`; line 105 states the same idea correctly
- **Touches:** prose only

## What the book says

After the three-node example, where h(A) = 5 against a true remaining cost of 1:

> That is the whole practical content of admissibility, and it is why multiplying a
> heuristic to make search faster trades away the optimality guarantee rather than merely
> making the result approximate in some bounded way you can ignore.

## Why it needs changing

Multiplying an admissible heuristic by a weight w of at least 1 is weighted A-star, and it
has a known bound: the path it returns costs at most w times the optimal cost. So
multiplying does make the result approximate in a bounded way, and that bound is why games
use the technique at all. What has no bound is an arbitrary overestimate, which is what
the example shows: h(A) = 5 is not presented as a multiple of any admissible estimate.
(Even so, the example stays inside the bound it would have had as w = 5 on the perfect
heuristic: 3 against an optimum of 2.)

Line 105 is accurate (“generally gives up the usual guarantee of an optimal path”). Line
118 goes further and denies that any bound exists, which an interviewer who knows weighted
A-star will notice.

## Proposed fix

> That is the whole practical content of admissibility. An arbitrary overestimate like
> this one puts no limit on how much worse the answer can be. Multiplying an admissible
> heuristic by a weight w is different: the search then returns a path costing at most w
> times the optimum, a trade you can state in advance, and it is the form to reach for
> when search has to be faster.

## Also check

`algorithms-astar-heuristic` has the distractor “It stays within a constant factor of the
true remaining cost.”, which is about the estimate, not the returned path, so it stays
wrong after the fix.
