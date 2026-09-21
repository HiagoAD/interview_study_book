---
book: Unity Game Engineering
chapter: 10: Algorithms used in gameplay systems
---

## Filter candidates before expensive tests {#algorithms-spatial}

Start a nearby-coin query with a linear scan. For each active coin, compare its squared distance with the squared magnet radius. If you only need a threshold check, squaring both sides avoids calculating a square root. That saves some work per candidate; checking fewer candidates can save much more.

In two dimensions, the squared distance is:

$$ d^2 = (x_2-x_1)^2 + (y_2-y_1)^2 $$

Compare the squared distance with $r^2$, and ensure both use the intended coordinate space. Distance on the screen, distance in the world, and distance along a navigation path measure different things. In a three-dimensional game, include the third axis unless the design intentionally measures on a plane.

A uniform spatial grid maps positions to cells:

$$ c_x = \left\lfloor x / s \right\rfloor, \qquad c_y = \left\lfloor y / s \right\rfloor $$

Here, $s$ is the cell size. Use floor for negative coordinates: truncating toward zero places negative positions near the origin in the wrong cell. Query the cells touched by the search bounds, then check the exact distance of the candidates they contain.

Cell size affects both query cost and maintenance. Small cells mean a radius query must visit more cells. Large cells contain more objects, so each query may check many irrelevant candidates. Update membership when an entity moves between cells, and decide when empty buckets should be removed.

If the relevant objects already have colliders, Unity physics queries can find an initial set of nearby candidates. Filter by layer and choose an appropriate query API. For a nonallocating query with a fixed-size result buffer, handle the case where the buffer fills: more results may have been omitted unless the API guarantees otherwise. Grow and retry, use a fallback, or prove that the buffer covers the maximum possible population.

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
> A full buffer may contain only part of the result. Use a defined capacity limit or fallback before treating the query as complete.

## Select nearest or best candidates without unnecessary sorting {#algorithms-selection}

To find the nearest target, scan once while retaining the best candidate and score. That takes linear time and constant extra space. Sorting all candidates takes more work when only one result is needed.

Check whether a target is eligible before scoring it: it may need to be in the same run, alive, targetable, in range, and visible. Usually, apply cheap checks before expensive line-of-sight or path queries. Keep their order consistent with the intended gameplay rules.

Decide how equal scores are resolved. You might use a stable spawn ID, keep the existing target, or make a deliberate random choice. Without that rule, small differences in iteration order can make targeting flicker or cause replays to diverge.

If you need the best $k$ candidates, a heap of size $k$ can process $n$ items in $O(n \log k)$ time. Sort the selected items afterward if their final order matters. When $k$ is tiny or $n$ is small, a bounded list may be simpler and fast enough. Partition-based algorithms provide another option for larger problems, with different guarantees.

Hysteresis can make target selection steadier: keep the current target until another is sufficiently better, or until the current one becomes invalid. This changes when the player switches targets. Agree on that behavior with design before adding it as an optimization.

Checking targets every few frames reduces CPU work, but the chosen target may become stale between checks. Decide how much delay is acceptable, and check eligibility again before an irreversible action such as applying damage.

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
> Requiring a meaningful improvement prevents small score changes from switching targets repeatedly. The tradeoff is that switching may respond more slowly.

## Choose BFS, Dijkstra, or A-star from the graph contract {#algorithms-pathfinding}

A graph consists of nodes and edges. In a game, nodes might represent grid cells, waypoints, rooms, or navigation regions. Edges represent permitted movement and may carry costs.

Breadth-first search uses a queue. When all edges have the same cost, it finds a shortest path by minimizing the number of edges. Mark a node as discovered when adding it to the queue, so it is not added repeatedly. With adjacency lists, the running time is $O(V+E)$.

Dijkstra's algorithm next explores the node with the lowest known accumulated cost. It supports nonnegative edge weights. With a binary heap and appropriate priority updates, a common time bound is $O((V+E)\log V)$; details such as duplicate heap entries affect the exact bound. Negative edges break the assumption behind its greedy choice.

A-star orders candidates by $f(n)=g(n)+h(n)$: the cost accumulated so far, plus an estimate of the remaining cost. That estimate is admissible if it never exceeds the true remaining cost. A consistent heuristic also follows the triangle inequality along each edge, which simplifies correct graph search with a closed set. With an admissible but inconsistent heuristic, finding an optimal path may require reopening a node that was already closed.

Manhattan distance is an appropriate heuristic for a four-neighbor grid with unit-cost movement and no cheaper shortcuts. Reconsider it if the game adds diagonal movement or teleports. Multiplying a heuristic by more than one can favor faster search, but generally gives up the usual guarantee of an optimal path.

Remember each node's predecessor so you can reconstruct the path. Define the result for an unreachable goal or an invalid start. Also account for obstacles changing: a path can be valid when calculated and blocked before the character follows it.

Unity's navigation packages may already provide mesh construction and path queries. A discrete puzzle or a specialized lane network may justify a custom graph. Explain which requirements the existing navigation system meets and which require a different representation.

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
> An admissible estimate is never greater than the true remaining cost. Correct graph search still needs to handle other details, such as reopening nodes when the heuristic is inconsistent.

## Randomness should be testable and statistically appropriate {#algorithms-randomness}

Treat randomness as an input to the rule. Pass a random source to selection code, so tests can supply known draws and replays can control their sequence. Separate random streams for unrelated systems can prevent a new particle effect from changing loot results simply by consuming an extra random number.

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

Fisher–Yates fills one position at a time. Choose the final element uniformly from those remaining, then repeat for the remaining positions. Choosing from the full list at every step is a different algorithm and generally produces biased permutations.

For weighted selection, use nonnegative, finite weights with a positive, finite total. Draw a value from zero up to, but excluding, that total. Select the first cumulative total strictly greater than the draw; a zero-weight entry then has no interval in which it can win. If a fixed table is sampled frequently, cumulative sums with binary search or an alias table can spend work during setup to make later draws cheaper.

Test draws exactly at the selection boundaries, as well as properties such as preserving every item in a shuffle. Statistical tests can reveal large bias. A small sample cannot prove perfect uniformity, though, and an overly strict statistical assertion can fail by chance.

A fixed seed helps reproduce results within a controlled implementation. Do not assume `System.Random` will produce the same sequence across every runtime forever. If replays must survive runtime or game updates, specify and version both the generator and the order in which its numbers are consumed.

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
> A zero weight occupies no part of the draw interval. Choosing the first cumulative total strictly greater than the draw prevents a leading zero-weight entry from winning even when the draw is zero.

?+ Weights are 2 and 3, and a draw is exactly 2 in the interval [0, 5). Which entry wins with the stated cumulative-boundary rule?
* The second entry.
- The first entry.
- Both entries.
- Neither entry because integer-valued draws are forbidden.
> The intervals are [0, 2) and [2, 5). Select the first cumulative total strictly greater than the draw.

## Scheduling and simulation order are algorithmic choices {#algorithms-scheduling}

Many timers can be managed by a list scanned each tick, a heap of deadlines, or a timing wheel. Choose according to how many timers exist, how often they change, the precision required, and how cancellation works.

For a small active set, scanning every timer is simple and predictable. A heap gives direct access to the next deadline, with logarithmic insertion and removal. A timing wheel groups deadlines into time buckets; it can schedule efficiently when limited time resolution is acceptable, but needs rules for bucket precision and wraparound.

Use the same kind of clock for every deadline in a queue. A gameplay timestamp cannot be directly compared with wall-clock UTC without a defined conversion. Also decide what a large time jump should do: run all overdue work, limit work per frame, combine repeated events, or discard actions that no longer matter.

Spreading work across frames also delays some results. If only 100 of 1,000 due AI tasks run this frame, some agents act on older state. That may be acceptable for background behavior, but unsuitable for an authoritative reward-expiration rule. Set an allowed delay for each kind of task.

A repeatable simulation needs a defined order of phases. For example, collect inputs, advance simulation, resolve interactions, commit state changes, and then publish results for presentation. Applying collection changes between phases can prevent a loop from being invalidated during iteration. Commands still need duplicate checks and validation against the current state.

A fixed timestep controls how much time each simulation step advances. It does not guarantee identical results across platforms: input order, floating-point calculations, physics, random draws, and parallel sums may still differ.

?? algorithms-overdue-policy A suspended app resumes with many overdue timers. What must the scheduler define?
* Whether each kind of timer should replay missed actions, combine them, limit catch-up work, or discard obsolete actions.
- That every overdue timer is automatically harmless.
- That all clocks refer to the same time domain.
- That the rendering frame rate decides reward eligibility.
> Decide what missed time means for each timer. Replaying every missed action without a limit can cause a long stall or apply actions that are no longer valid.

?? algorithms-fixed-determinism [tf] Using a fixed timestep alone guarantees bit-identical simulation on every platform.
* false
> Fixed steps control time increments. Numerical behavior, ordering, random inputs, and engine simulation can still differ.
