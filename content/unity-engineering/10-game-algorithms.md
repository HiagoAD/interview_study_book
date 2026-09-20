---
book: Unity Game Engineering
chapter: 10: Algorithms used in gameplay systems
---

## Filter candidates before expensive tests {#algorithms-spatial}

A magnet needs nearby coins. The baseline is a linear scan: compare each active coin's squared distance to the squared radius. Squared distance avoids a square root when only a threshold comparison is needed. This saves a small amount of work per candidate; reducing the candidate count can save much more.

In two dimensions, the squared distance is:

$$ d^2 = (x_2-x_1)^2 + (y_2-y_1)^2 $$

Compare it with $r^2$, using the correct coordinate space. A screen-space distance, world-space distance, and navigation-path distance answer different questions. For a three-dimensional game, include the third axis unless the design deliberately projects onto a plane.

A uniform spatial grid maps positions to cells:

$$ c_x = \left\lfloor x / s \right\rfloor, \qquad c_y = \left\lfloor y / s \right\rfloor $$

Here $s$ is cell size. Floor matters for negative coordinates; truncation toward zero maps negative positions incorrectly near the origin. Query the cells overlapped by the search bounds, then perform exact distance tests on their candidates.

Cell size trades query work against update and occupancy costs. Tiny cells mean more cells per radius query. Huge cells put too many objects in each bucket. Moving entities must update cell membership, and empty buckets need a retention policy.

Unity physics queries can supply a spatial broad phase when colliders already represent the relevant objects. Use layer filtering and appropriate query APIs. A fixed-size nonallocating result buffer needs overflow handling: when the returned count fills the buffer, treat possible truncation as unresolved unless the API guarantees otherwise. Grow and retry, use a fallback, or establish a proven population bound.

?? algorithms-grid-negative With cell size 10, which cell contains position -1 using floor-based indexing?
* -1.
- 0.
- 1.
- -10.
> Floor of -0.1 is -1. Truncation toward zero would incorrectly place the point in cell 0.

?? algorithms-query-capacity A fixed query buffer is completely filled. What should the implementation consider?
* Additional candidates may have been omitted, so the overflow policy must apply.
- The query has proved there are exactly that many candidates.
- Every omitted candidate is necessarily too far away.
- Nonallocating APIs automatically resize the supplied array.
> Avoid silently treating a potentially truncated candidate set as complete. Correctness needs a capacity or fallback contract.

## Select nearest or best candidates without unnecessary sorting {#algorithms-selection}

To find the nearest target, scan once while retaining the best candidate and score. That takes linear time and constant extra space. Sorting all candidates takes more work when only one result is needed.

Define eligibility before scoring: same run, alive, targetable, within range, and visible if required. Cheap filters should usually precede expensive line-of-sight or path queries, while preserving the intended rule.

Specify tie-breaking. If two targets have equal score, choose by stable spawn ID, existing lock, or a deliberate random rule. Otherwise tiny ordering differences can cause target flicker or replay divergence.

For the best $k$ candidates, a heap of size $k$ can process $n$ items in $O(n \log k)$ time, followed by sorting the selected set if needed. When $k$ is tiny or $n$ is small, a simpler bounded list may be easier and fast enough. For large selection problems, partition-based algorithms are another option with different guarantees.

Hysteresis can stabilize target changes. Keep the current target until a challenger is sufficiently better, or until the current target becomes invalid. This deliberately changes gameplay semantics, so agree on it with design rather than introducing it invisibly as an optimization.

Updating targeting every few frames reduces CPU work, but the chosen target can be stale. Define an acceptable latency and revalidate before applying an irreversible action such as damage.

Exercise: Design a nearest-coin attraction query that respects a maximum count, avoids rewarding duplicates, and remains correct when coins despawn during processing. State whether you iterate a snapshot or defer mutations.

?? algorithms-nearest-complexity What is the usual simplest algorithm for finding one nearest eligible target?
* A single scan that tracks the best candidate.
- Sorting every candidate on every query.
- Enumerating every possible permutation.
- Building a complete all-pairs distance table first.
> One best result needs only a running best score. Sorting is useful when ordered results are actually required.

?? algorithms-hysteresis Why can target-selection hysteresis reduce visible flicker?
* It requires a challenger to be meaningfully better before replacing the current target.
- It guarantees every distance is an integer.
- It removes all invalid targets from memory forever.
- It makes every target equally preferred.
> Hysteresis prevents small score fluctuations from repeatedly changing the selected target. It is a gameplay policy with responsiveness tradeoffs.

## Choose BFS, Dijkstra, or A-star from the graph contract {#algorithms-pathfinding}

A graph consists of nodes and edges. In a game, nodes might represent grid cells, waypoints, rooms, or navigation regions. Edges represent permitted movement and may carry costs.

Breadth-first search uses a queue and finds shortest paths by edge count when every edge has equal cost. Mark a node discovered when enqueuing it to avoid repeated queue entries. With adjacency lists, its time is $O(V+E)$.

Dijkstra's algorithm expands the smallest known accumulated cost and supports nonnegative edge weights. A binary-heap implementation commonly takes $O((V+E)\log V)$ with appropriate priority updates; implementation details such as duplicate entries affect the exact bound. Negative edges violate its greedy guarantee.

A-star orders by $f(n)=g(n)+h(n)$: accumulated cost plus a heuristic estimate to the goal. An admissible heuristic never overestimates the true remaining cost. A consistent heuristic also obeys the edge triangle inequality, making closed-set graph search easier to implement correctly. With an admissible but inconsistent heuristic, a correct optimal implementation may need to reopen nodes.

On a four-neighbor grid with unit moves and no cheaper shortcuts, Manhattan distance is an appropriate heuristic. If diagonal moves or teleports are introduced, revisit that assumption. Multiplying the heuristic by a factor greater than one can prioritize speed, but generally sacrifices the ordinary optimality guarantee.

Retain predecessor information to reconstruct a path. Handle unreachable goals, invalid start nodes, and changing obstacles explicitly. A path valid when computed can become invalid before it is followed.

In Unity, a navigation package may already handle mesh construction and path queries. A custom graph can be justified for a discrete puzzle or specialized lane network. Explain which requirements the engine's navigation system handles and which need a different representation.

?? algorithms-bfs-condition When does breadth-first search find a minimum-cost path by treating each edge as one step?
* When all traversable edges have the same cost.
- When arbitrary negative edge weights are present.
- Whenever the graph is drawn in Unity.
- Only when every node has exactly two neighbors.
> BFS minimizes edge count. Edge count corresponds to path cost only when all edges have equal cost.

?+ A direct edge to the goal costs 10, while a two-edge route costs 1 per edge. What can an unweighted BFS prefer?
* The one-edge route, even though its total cost is higher.
- The two-edge route because BFS automatically reads all numeric weights.
- Neither route, because a graph cannot mix edge costs.
- The route with the largest number of edges.
> BFS minimizes edge count, so weighted movement needs an algorithm that accounts for cost.

?? algorithms-astar-heuristic What does an admissible A-star heuristic guarantee about its estimate?
* It never overestimates the true remaining path cost.
- It always equals the exact remaining cost.
- It may overestimate without affecting any optimality conditions.
- It removes the need to track accumulated cost.
> Admissibility is an upper restriction on the estimate relative to the true cost. Graph-search details, including reopening with inconsistent heuristics, still matter.

## Randomness should be testable and statistically appropriate {#algorithms-randomness}

Randomness is an input to a rule. Pass a random source to selection code so a test can supply known draws and a replay can control the sequence. Separate streams for unrelated systems can prevent a new particle effect from changing gameplay loot merely by consuming another random number.

For a uniform shuffle, use Fisher–Yates:

```csharp
using System;
using System.Collections.Generic;

public static class Shuffling
{
    public static void Shuffle<T>(IList<T> items, Random random)
    {
        if (items == null)
            throw new ArgumentNullException(nameof(items));
        if (random == null)
            throw new ArgumentNullException(nameof(random));

        for (int i = items.Count - 1; i > 0; i--)
        {
            int j = random.Next(i + 1); // Uniform integer in [0, i].
            T temporary = items[i];
            items[i] = items[j];
            items[j] = temporary;
        }
    }
}
```

The correctness argument is incremental: choose the final element uniformly from all remaining elements, then repeat for the remaining positions. Choosing a swap partner from the full list at every step is a different algorithm and generally biases permutations.

For weighted selection with nonnegative weights, draw a value in the half-open interval from zero to the total weight, then select the first cumulative total strictly greater than the draw. Validate finite weights and a positive finite total. A zero-weight entry should never win. For frequent draws from a static table, cumulative sums with binary search or an alias table can trade preprocessing for cheaper selection.

Test exact boundary draws and membership properties. Statistical tests can detect large bias, but a small sample cannot prove perfect uniformity and an overly tight statistical assertion becomes flaky.

A fixed seed is useful within a controlled implementation. Do not assume `System.Random` sequences are a permanent cross-runtime persistence contract. For long-lived replay compatibility, specify and version the generator and its consumption order.

?? algorithms-shuffle-range In Fisher–Yates at index `i`, which swap-partner range is correct?
* Every index from 0 through i, inclusive.
- Every index from 0 through the full list length, inclusive.
- Only index 0.
- Only indices strictly greater than i.
> The algorithm chooses uniformly among positions not yet finalized. `Random.Next(i + 1)` uses an exclusive upper bound.

?? algorithms-weight-zero A weighted table contains weights 0, 2, and 3. What should be true of the first entry?
* It is never selected.
- It is selected whenever the draw equals zero if boundaries are implemented correctly.
- It receives one third of the probability.
- Its zero weight invalidates every otherwise valid table.
> A zero-width interval has no probability mass. Using the first cumulative total strictly greater than the draw avoids selecting a leading zero-weight entry.

?+ Weights are 2 and 3, and a draw is exactly 2 in the interval [0, 5). Which entry wins with the stated cumulative-boundary rule?
* The second entry.
- The first entry.
- Both entries.
- Neither entry because integer-valued draws are forbidden.
> The intervals are [0, 2) and [2, 5). Select the first cumulative total strictly greater than the draw.

## Scheduling and simulation order are algorithmic choices {#algorithms-scheduling}

Thousands of independent timers can be represented as one list scanned each tick, a heap of deadlines, or a timing wheel. The right structure depends on timer count, update frequency, required precision, and cancellation patterns.

A scan is simple and predictable for a small active set. A heap lets you inspect only deadlines that are due, paying logarithmic insertion and removal. A timing wheel groups deadlines into buckets and can offer efficient scheduling when time resolution is bounded, but introduces bucket precision and wraparound complexity.

Use one time domain per queue. Comparing a gameplay deadline with wall-clock UTC is meaningless without conversion and an explicit policy. Define how the scheduler handles a large time jump: execute all overdue work, cap work per frame, coalesce repeated events, or discard obsolete actions.

Budgeted processing spreads work but changes latency. If only 100 of 1,000 due AI tasks run this frame, some agents observe older state. That can be acceptable for ambient behavior and unacceptable for authoritative reward expiry. Specify how late each kind of task may run.

Deterministic simulation also needs a stable phase order. For example, a local simulation can collect inputs, update simulation, resolve interactions, commit state changes, and publish presentation results in that order. Deferring collection mutations until a phase boundary can prevent iteration invalidation, but commands must still be deduplicated and validated against current state.

A fixed timestep alone does not guarantee deterministic cross-platform simulation. Input order, floating-point behavior, physics implementation, random consumption, and multithreaded reductions can still differ.

?? algorithms-overdue-policy A suspended app resumes with many overdue timers. What must the scheduler define?
* Whether to replay, coalesce, cap, or discard overdue work according to each timer's semantics.
- That every overdue timer is automatically harmless.
- That all clocks refer to the same time domain.
- That the rendering frame rate decides reward eligibility.
> Catch-up behavior is part of the product contract. Blindly replaying every missed action can create long stalls or incorrect outcomes.

?? algorithms-fixed-determinism [tf] Using a fixed timestep alone guarantees bit-identical simulation on every platform.
* false
> Fixed steps control time increments. Numerical behavior, ordering, random inputs, and engine simulation can still differ.
