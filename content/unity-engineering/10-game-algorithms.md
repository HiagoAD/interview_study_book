---
book: Unity Game Engineering
chapter: 10: Algorithms used in gameplay systems
---

## Filter candidates before expensive tests {#algorithms-spatial}

Start a tower's in-range query with a linear scan. For each active enemy, compare its squared distance with the squared tower radius. If you only need a threshold check, squaring both sides avoids calculating a square root. That saves some work per candidate; checking fewer candidates can save much more.

In two dimensions, the squared distance is:

$$ d^2 = (x_2-x_1)^2 + (y_2-y_1)^2 $$

Compare the squared distance with $r^2$, and ensure both use the intended coordinate space. Distance on the screen, distance in the world, and distance along a navigation path measure different things. In a three-dimensional game, include the third axis unless the design intentionally measures on a plane.

A uniform spatial grid maps positions to cells:

$$ c_x = \left\lfloor x / s \right\rfloor, \qquad c_y = \left\lfloor y / s \right\rfloor $$

Here, $s$ is the cell size. Use floor for negative coordinates: truncating toward zero places negative positions near the origin in the wrong cell. Query the cells touched by the search bounds, then check the exact distance of the candidates they contain.

Cell size affects both query cost and maintenance. Small cells mean a radius query must visit more cells. Large cells contain more objects, so each query may check many irrelevant candidates. Update membership when an entity moves between cells, and decide when empty buckets should be removed.

If the relevant objects already have colliders, Unity physics queries can find an initial set of nearby candidates. Filter by layer and choose an appropriate query API. For a nonallocating query with a fixed-size result buffer, handle the case where the buffer fills: more results may have been omitted unless the API guarantees otherwise. Grow and retry, use a fallback, or prove that the buffer covers the maximum possible population.

Cell size is the one parameter of a uniform grid, and it can be reasoned about rather than guessed. Start at roughly the diameter of the most common query. A radius query then touches at most a 2 by 2 block of cells in two dimensions, and the candidates it collects are mostly relevant. Cells the size of the radius touch a 3 by 3 block instead, which is still bounded, and may suit a game whose query radius varies.

The two failure directions are easy to recognize once you know the shape. Cells much smaller than the query radius mean each query visits many cells and spends its time on bookkeeping; the symptom is cost that grows when you shrink cells further. Cells much larger than the radius mean each cell holds many objects the query will reject; the symptom is a high ratio of candidates examined to candidates accepted. Instrument that ratio, because it tells you which direction to move.

A grid also assumes roughly even distribution. A tower-defense level where every enemy walks one narrow path puts most entities in a handful of cells no matter what size you choose, and the structure stops helping. Where the distribution is uneven, sort along the axis that actually varies, or use a structure that adapts, such as a tree that subdivides only where objects are dense. Measuring the occupancy of the busiest cell is the cheapest way to find out which situation you are in.

Exercise: For a query in your game, write the typical radius, the chosen cell size, and the average number of candidates a query examines and accepts. The ratio between the last two numbers is your tuning signal.

?? algorithms-grid-negative With cell size 10, which cell contains position -1 using floor-based indexing?
* -1.
- 0, truncating toward zero.
- 1, taking the absolute value first.
- 9, wrapping into the positive range.
- -10, multiplying by the cell size.
> Floor of -0.1 is -1. Truncation toward zero would incorrectly place the point in cell 0.

?? algorithms-query-capacity A fixed query buffer is completely filled. What should the implementation consider?
* Additional candidates may have been omitted, so the overflow policy must apply.
- The buffer size matched the candidate count, so the result is complete.
- The omitted candidates are the ones furthest from the query point.
- The extra candidates were written past the end of the buffer.
- The API returns a negative count to signal that results were dropped.
> A full buffer may contain only part of the result. Use a defined capacity limit or fallback before treating the query as complete.

## Select nearest or best candidates without unnecessary sorting {#algorithms-selection}

To find the nearest target, scan once while retaining the best candidate and score. That takes linear time and constant extra space. Sorting all candidates takes more work when only one result is needed.

Check whether a target is eligible before scoring it: it may need to be in the same run, alive, targetable, in range, and visible. Usually, apply cheap checks before expensive line-of-sight or path queries. Keep their order consistent with the intended gameplay rules.

Decide how equal scores are resolved. You might use a stable spawn ID, keep the existing target, or make a deliberate random choice. Without that rule, small differences in iteration order can make targeting flicker or cause replays to diverge.

If you need the best $k$ candidates, a heap of size $k$ can process $n$ items in $O(n \log k)$ time. Sort the selected items afterward if their final order matters. When $k$ is tiny or $n$ is small, a bounded list may be simpler and fast enough. Partition-based algorithms provide another option for larger problems, with different guarantees.

Hysteresis can make target selection steadier: keep the current target until another is sufficiently better, or until the current one becomes invalid. This changes when the player switches targets. Agree on that behavior with design before adding it as an optimization.

Checking targets every few frames reduces CPU work, but the chosen target may become stale between checks. Decide how much delay is acceptable, and check eligibility again before an irreversible action such as applying damage.

The tie rule and the hysteresis rule combine into a single comparison, and writing it as one expression keeps them from drifting apart:

```text
keep current target unless:
    current is no longer eligible, or
    score(challenger) < score(current) - switchMargin, or
    (score(challenger) == score(current) - switchMargin and challenger.spawnId < current.spawnId)
```

The margin makes switching require a real improvement, and the identifier comparison makes the remaining ties resolve the same way on every machine and in every replay. A margin of zero reduces the rule to plain nearest-target selection, which is a useful default to ship first and a useful baseline to compare against when design asks for steadier targeting.

Exercise: Design a tower's target query that respects a maximum count, avoids selecting the same enemy twice, and remains correct when enemies despawn during processing. State whether you iterate a snapshot or defer mutations.

?? algorithms-nearest-complexity What is the usual simplest algorithm for finding one nearest eligible target?
* A single scan that tracks the best candidate.
- Sort the candidates by distance and take the first.
- Partition the candidates around a pivot and recurse into the lower half.
- Keep a heap of the candidates and pop the smallest.
- Cache the distances in a dictionary and query the minimum key.
> One best result needs only a running best score. Sorting is useful when ordered results are actually required.

?? algorithms-hysteresis Why can target-selection hysteresis reduce visible flicker?
* It requires a challenger to be meaningfully better before replacing the current target.
- It re-evaluates targets less often, so fewer changes are possible.
- It rounds scores to fewer decimal places, so small differences disappear.
- It caches the previous target, so the scan can be skipped on most frames.
- It sorts candidates by score, so the ordering stops changing.
> Requiring a meaningful improvement prevents small score changes from switching targets repeatedly. The tradeoff is that switching may respond more slowly.

## Choose BFS, Dijkstra, or A-star from the graph contract {#algorithms-pathfinding}

A graph consists of nodes and edges. In a game, nodes might represent grid cells, waypoints, rooms, or navigation regions. Edges represent permitted movement and may carry costs.

Breadth-first search uses a queue. When all edges have the same cost, it finds a shortest path by minimizing the number of edges. Mark a node as discovered when adding it to the queue, so it is not added repeatedly. With adjacency lists, the running time is $O(V+E)$.

Dijkstra's algorithm next explores the node with the lowest known accumulated cost. It supports nonnegative edge weights. With a binary heap and appropriate priority updates, a common time bound is $O((V+E)\log V)$; details such as duplicate heap entries affect the exact bound. Negative edges break the assumption behind its greedy choice.

A-star orders candidates by $f(n)=g(n)+h(n)$: the cost accumulated so far, plus an estimate of the remaining cost. That estimate is admissible if it never exceeds the true remaining cost. A consistent heuristic also follows the triangle inequality along each edge, which simplifies correct graph search with a closed set. With an admissible but inconsistent heuristic, finding an optimal path may require reopening a node that was already closed.

A tower-defense build grid is the case where the graph is not a fixed input. Every tower the player places removes edges, so the path has to be recomputed, and a placement that would leave no path at all has to be rejected before it is committed rather than discovered by a search that returns nothing. Deciding which of those two the game does, block the placement or let the enemies break through, is a design rule and not a search detail, and it must be settled before the algorithm is chosen.

Manhattan distance is an appropriate heuristic for a four-neighbor grid with unit-cost movement and no cheaper shortcuts. Reconsider it if the game adds diagonal movement or teleports. Multiplying a heuristic by more than one can favor faster search, but generally gives up the usual guarantee of an optimal path.

Remember each node's predecessor so you can reconstruct the path. Define the result for an unreachable goal or an invalid start. Also account for obstacles changing: a path can be valid when calculated and blocked before the character follows it.

Unity's navigation packages may already provide mesh construction and path queries. A discrete puzzle or a specialized lane network may justify a custom graph. Explain which requirements the existing navigation system meets and which require a different representation.

A three-node example shows exactly what admissibility protects. Let the edges be S to A costing 1, A to G costing 1, and S to G costing 3. The optimal path is S, A, G at a total cost of 2. Now give A an overestimating heuristic of 5:

```text
f(A)          = g(A) + h(A) = 1 + 5 = 6
f(G, direct)  = g(G) + h(G) = 3 + 0 = 3
```

A-star expands the smallest f first, so it takes G directly and returns the cost-3 path, having never looked past A. Nothing failed and no assertion fired; the search simply answered a different question. That is the whole practical content of admissibility. An arbitrary overestimate like this one puts no limit on how much worse the answer can be. Multiplying an admissible heuristic by a weight $w$ is different: the search then returns a path costing at most $w$ times the optimum, a trade you can state in advance, and it is the form to reach for when search has to be faster.

The other practical matter is what happens after the path is returned. A path is a plan made against a snapshot of the world, and the world moves. Recomputing every frame for every agent is the expensive answer; better ones are usually cheaper. Follow the path until the next segment is blocked and only then repath. Spread repaths across frames with a budget, so a hundred agents reacting to one closed door do not all search in the same frame. Check only the next segment or two for validity rather than the whole path, since the far end will be revised before the agent reaches it anyway.

Exercise: Work the three-node example again with h(A) equal to 1. Confirm that A-star now returns the cost-2 path, and note which node it expands first.

?? algorithms-bfs-condition When does breadth-first search find a minimum-cost path by treating each edge as one step?
* When all traversable edges have the same cost.
- When the graph contains no cycles.
- When the goal is reachable within a bounded number of steps.
- When the heuristic used to order the queue is admissible.
- When the graph is stored as an adjacency matrix.
> BFS minimizes edge count. Edge count corresponds to path cost only when all edges have equal cost.

?+ A direct edge to the goal costs 10, while a two-edge route costs 1 per edge. What can an unweighted BFS prefer?
* The one-edge route, even though its total cost is higher.
- The two-edge route, since BFS accumulates the cost along each path.
- Whichever route is discovered first, depending on neighbor order.
- The two-edge route, since BFS prefers paths with a lower average edge cost.
- Neither, since BFS reports failure when edge costs differ.
> BFS minimizes edge count, so weighted movement needs an algorithm that accounts for cost.

?? algorithms-astar-heuristic What does an admissible A-star heuristic guarantee about its estimate?
* It never overestimates the true remaining path cost.
- It matches the true remaining cost at every node.
- It decreases by at most the edge cost along each step.
- It stays within a constant factor of the true remaining cost.
- It is computed without reading the cost accumulated so far.
> An admissible estimate is never greater than the true remaining cost. Correct graph search still needs to handle other details, such as reopening nodes when the heuristic is inconsistent.

## Randomness should be testable and statistically appropriate {#algorithms-randomness}

Treat randomness as an input to the rule. Pass a random source to selection code, so tests can supply known draws and replays can control their sequence. Separate random streams for unrelated systems can prevent a new particle effect from changing loot results simply by consuming an extra random number. `UnityEngine.Random` is one static generator shared by every caller, packages included, so it is the stream such an effect disturbs. An instance of `System.Random`, or `Unity.Mathematics.Random` in jobs and Burst code, gives each system a stream of its own.

For a uniform shuffle, such as the one a card game owes its deck at the start of every match, use Fisher–Yates:

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

A fixed seed helps reproduce results within a controlled implementation. A seed passed to `UnityEngine.Random.InitState` reproduces nothing on its own, because any other caller can draw from the same generator in between. Do not assume `System.Random` will produce the same sequence across every runtime forever. If replays must survive runtime or game updates, specify and version both the generator and the order in which its numbers are consumed.

The claim that the naive shuffle is biased can be settled by counting rather than by testing. Take the version that swaps each position with a partner drawn from the whole list:

```text
for i in 0 .. n-1:
    swap(items[i], items[random(0, n-1)])
```

For n equal to 3 this makes three independent draws from three options, so there are 3 times 3 times 3, or 27, equally likely execution paths. Those paths produce 6 possible permutations. Since 27 is not divisible by 6, the permutations cannot all be equally likely, whatever the random source does. No amount of sampling is needed, and no better generator can repair it.

Fisher–Yates avoids this by construction. Its draws have n, then n-1, and so on down to 1 option, giving n factorial paths for n factorial permutations, one path each. That exact correspondence is the reason the upper bound shrinks with each step, and it is why `random.Next(i + 1)` rather than `random.Next(items.Count)` is the line the whole algorithm rests on.

This is a useful answer to have ready, because “shuffle a list” is a common coding prompt and the follow-up is usually “how do you know it is uniform?” A counting argument settles it in two sentences; a statistical argument requires a sample size and still cannot prove the case.

Exercise: Enumerate all 27 paths for a three-element list and count how many produce each of the 6 permutations. The distribution you get is the bias.

?? algorithms-shuffle-range In Fisher–Yates at index `i`, which swap-partner range is correct?
* Every index from 0 through i, inclusive.
- Every index from 0 through the list length, exclusive.
- Every index from i through the end of the list.
- Every index except i itself.
- Every index from 1 through i, inclusive.
> The algorithm chooses uniformly among positions not yet finalized. `Random.Next(i + 1)` uses an exclusive upper bound.

?? algorithms-weight-zero A weighted table contains weights 0, 2, and 3. What should be true of the first entry?
* It is never selected.
- It is selected when the draw lands exactly on zero.
- It shares the probability of the entry that follows it.
- It receives the smallest nonzero share available.
- Its presence shifts the other entries' intervals by one.
> A zero weight occupies no part of the draw interval. Choosing the first cumulative total strictly greater than the draw prevents a leading zero-weight entry from winning even when the draw is zero.

?+ Weights are 2 and 3, and a draw is exactly 2 in the interval [0, 5). Which entry wins with the stated cumulative-boundary rule?
* The second entry.
- The first entry, since its interval includes its own upper bound.
- Either entry, since the draw lands on the boundary between them.
- The first entry, since cumulative totals are compared with `<=`.
- Neither, since a draw landing on a boundary has to be taken again.
> The intervals are [0, 2) and [2, 5). Select the first cumulative total strictly greater than the draw.

## Scheduling and simulation order are algorithmic choices {#algorithms-scheduling}

Many timers can be managed by a list scanned each tick, a heap of deadlines, or a timing wheel. Choose according to how many timers exist, how often they change, the precision required, and how cancellation works.

For a small active set, scanning every timer is simple and predictable. A heap gives direct access to the next deadline, with logarithmic insertion and removal. A timing wheel groups deadlines into time buckets; it can schedule efficiently when limited time resolution is acceptable, but needs rules for bucket precision and wraparound.

Use the same kind of clock for every deadline in a queue. A gameplay timestamp cannot be directly compared with wall-clock UTC without a defined conversion. Also decide what a large time jump should do: run all overdue work, limit work per frame, combine repeated events, or discard actions that no longer matter.

Spreading work across frames also delays some results. If only 100 of 1,000 due AI tasks run this frame, some agents act on older state. That may be acceptable for background behavior, but unsuitable for an authoritative reward-expiration rule. Set an allowed delay for each kind of task.

A repeatable simulation needs a defined order of phases. For example, collect inputs, advance simulation, resolve interactions, commit state changes, and then publish results for presentation. Applying collection changes between phases can prevent a loop from being invalidated during iteration. Commands still need duplicate checks and validation against the current state.

A fixed timestep controls how much time each simulation step advances. It does not guarantee identical results across platforms: input order, floating-point calculations, physics, random draws, and parallel sums may still differ.

Numbers make the catch-up decision concrete. Suppose a game schedules one energy refill every 6 minutes and the player returns after 27 hours in the background. That is 270 overdue refills. Replaying them one at a time is both slow and pointless, because the state they produce is a single number that the cap will clamp anyway.

The four policies produce visibly different products:

| Policy | Result after 27 hours | Fits |
| --- | --- |  --- |
| Replay each | 270 refill events, 270 notifications, a long stall | Almost nothing |
| Combine | One computation from elapsed time, clamped to the cap | Resource regeneration |
| Limit catch-up | Process 20, keep the rest queued for later frames | Work with per-item side effects |
| Discard | Drop the missed ticks and resume from now | Cosmetic or ambient timers |

Combining is usually right for anything that is really a function of elapsed time, and it is also the cheapest: the refill becomes `min(cap, stored + floor(elapsed / interval))` with no loop at all. Keep the remainder too. Advance the stored refill time by the whole intervals granted instead of resetting it to now, and move it to now only when the cap is reached; otherwise every resume discards up to one interval of progress. Reserve replay for work whose individual occurrences matter, and then bound it, because an unbounded catch-up loop on resume is one of the more reliable ways to be killed by the operating system during startup.

Note that all four policies need the elapsed time to come from a source the player cannot move backward, which is the monotonic and trusted-time distinction from the earlier chapters arriving in a concrete form.

Exercise: For a timer in a game you know, choose one of the four rows and write what the player sees after a day away. Then check whether the implementation actually does that.

?? algorithms-overdue-policy A suspended app resumes with many overdue timers. What must the scheduler define?
* Whether each kind of timer should replay missed actions, combine them, limit catch-up work, or discard obsolete actions.
- Which clock source each timer reads after the process resumes.
- Whether the timers are recreated from the save file or from memory.
- How the overdue count is presented to the player.
- Whether the catch-up work runs before or after the first rendered frame.
> Decide what missed time means for each timer. Replaying every missed action without a limit can cause a long stall or apply actions that are no longer valid.

?? algorithms-fixed-determinism [tf] Using a fixed timestep alone guarantees bit-identical simulation on every platform.
* false
> Fixed steps control time increments. Numerical behavior, ordering, random inputs, and engine simulation can still differ.
