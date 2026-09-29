---
book: unity-game-engineering
chapter: 09: Data structures and complexity for game systems
---

## Analyze the work that grows with the game {#structures-complexity}

Complexity describes how resource use grows as the input grows. Name that input first: active enemies, collected IDs, missions, path nodes, or visible UI entries. The complexity claim only makes sense relative to the size you are measuring.

$O(1)$ describes work bounded independently of that input size; $O(n)$ describes linear growth; $O(n \log n)$ commonly appears in comparison sorting; $O(n^2)$ appears when every entity checks every other entity. These are growth classes, not execution-time measurements.

Distinguish worst-case, expected, and amortized costs. A hash lookup is commonly expected to take constant time with suitable hashing and load, but a bad case can take longer. Appending to a dynamic array is amortized constant time: most appends are cheap, while an occasional resize copies existing elements. One append can therefore take linear time. That difference matters if a single slow frame would be visible.

If 1,000 enemies each scan 1,000 potential targets every frame, there are about one million candidate checks per frame. At 60 FPS, that is about 60 million checks per second, before any expensive visibility or path queries. Reducing how many candidates need checking may help much more than removing one multiplication from each check.

Big-O leaves out constant costs, allocations, cache behavior, branch predictability, and engine calls. A linear scan of 20 contiguous elements can be faster than setting up and using a hash lookup. Use complexity to identify likely problems as the game grows, then measure the actual workload.

Account for memory as well as execution time. Caching every pairwise distance uses quadratic storage and needs updates when positions change. An index makes queries faster by spending memory and time on maintenance. Compare how often the data changes with how often it is queried.

For an interview, narrate the baseline first: “I would start with a linear scan of the active set; if population or profiling makes it expensive, I would introduce a [[spatial index]], such as a uniform grid of cells.” Explain why the scan is correct before discussing its replacement.

Because constants are omitted from the notation, it helps to carry one crossover figure as an anchor. A linear scan of a contiguous array reads memory in the order the hardware prefetches it, while a hash lookup computes a hash, jumps to a bucket, and follows a reference that may be anywhere. On typical hardware the scan often wins up to somewhere in the low tens of elements, and the dictionary pulls ahead beyond that. Treat the number as a reason to measure rather than as a rule: element size, key type, and access pattern all move it.

The shape of the comparison is more durable than the number. Growth class decides what happens as the game gets bigger; constants decide what happens at the size you actually ship. A quadratic algorithm over eight items is fine forever. A linear scan over a collection that is eight items today and eight thousand after a content update is the one to watch, so ask what bounds the size before choosing.

Saying this well in an interview means naming the input and staying with it. “This is quadratic” invites the question “in what?” Answer it first: “This is quadratic in the number of active enemies, which the design caps at 200, so the worst case is 40,000 checks per frame and I would measure before indexing.” That sentence contains a growth class, an input, a bound, and a next step, which is the whole argument.

Exercise: For a loop in your project, name the input, the current size, the size after the largest content update you can imagine, and the growth class. Decide whether the third column changes your answer.

?? structures-amortized What does amortized constant-time list append mean?
* The average cost over a sequence of appends is constant, although a resize can make one append linear.
- The cost of each append is bounded by a constant the runtime selects in advance.
- The total cost of n appends grows as n log n.
- Resizes are scheduled between frames, so no single append pays for one.
- The list reserves its maximum capacity on construction, so appends avoid copying.
> Most appends are cheap, but occasional growth copies existing elements. Averaging that work across many appends gives constant cost; an individual resize can still cause a spike.

?+ A latency-sensitive frame appends to a list whose capacity is exhausted. Which statement is correct?
* That append can allocate a larger backing array and copy existing elements despite amortized constant-time append.
- The append reuses the existing array and shifts elements to make room.
- The list adds one slot, so the copy covers a single element.
- The resize is deferred to the next append, which spreads the cost.
- The append fails and returns false, so the caller can retry later.
> Amortized bounds describe sequences of operations, not a hard latency guarantee for each operation.

?? structures-pair-count A naive loop checks each of 1,000 enemies against 1,000 candidates. Approximately how many checks does it perform?
* 1,000,000.
- 2,000, adding the two populations.
- 500,000, since each pair is checked from one side.
- 1,000, scanning the candidate list once.
- 10,000, assuming each enemy checks ten candidates.
> Nested full scans multiply the dimensions. This estimate helps identify whether reducing candidates is worth investigating.

?+ A naive loop makes about a million checks a frame for 1,000 enemies against 1,000 candidates. What does that count not establish?
* How long the frame takes, since that depends on what each check costs.
* Whether the loop fits the frame budget on the slowest supported device.
- How many checks the loop makes each frame at these populations.
- That the work grows with the product of the two populations.
- That halving the candidates halves the number of checks.
- Whether the work grows quadratically when both populations grow together.
> The count measures the size of the work and says nothing about its duration. One check can be a subtraction or a raycast, so the same million can be trivial or far over budget, and a measurement on the target device settles which.

## Arrays, lists, and removal policies {#structures-arrays-lists}

An array provides a fixed number of indexed slots. `List<T>` uses a resizable array, with a count for the elements in use and a capacity for the storage reserved. Both support constant-time indexed access. Inserting or removing an item near the front of a list moves later elements.

Choose based on the access pattern:

| Operation | Array | List |
| --- | --- | --- |
| Read by valid index | Constant time | Constant time |
| Scan all elements | Linear | Linear |
| Append | Requires available logical space or new array | Amortized constant time |
| Ordered middle removal | Shift or rebuild | Linear shifting |
| Unordered removal by known index | Swap with last logical element | Swap with last, then remove last |

This helper removes an item without preserving order:

```csharp
using System;
using System.Collections.Generic;

public static class UnorderedList
{
    public static void RemoveAtSwapBack<T>(List<T> items, int index)
    {
        if (items == null)
            throw new ArgumentNullException(nameof(items));
        if (index < 0 || index >= items.Count)
            throw new ArgumentOutOfRangeException(nameof(index));

        int last = items.Count - 1;
        items[index] = items[last];
        items.RemoveAt(last);
    }
}
```

The helper keeps every element except the removed one, but changes their order. That fits an unordered list of active particles; it does not fit a leaderboard or chronological event queue. If a dictionary maps entity IDs to list indices, update the moved entity's index and delete the removed entity's entry.

If you can estimate the likely number of elements, reserve that capacity before gameplay that cannot tolerate a resize. Avoid reserving a huge capacity for every object “just in case.” Reserved storage uses memory even when the count is low, and clearing a list generally keeps that storage.

Account for moved elements when removing during iteration. After swap-back removal, an unprocessed element may now occupy the current index. Check that replacement before advancing, or use a loop whose rules account for the move. Otherwise an element can be skipped.

Removal during iteration is worth seeing as code, because the two correct loops look almost identical to the incorrect one:

```csharp
// Backward, order preserving. Later indices are already visited.
for (int i = items.Count - 1; i >= 0; i--)
    if (ShouldRemove(items[i]))
        items.RemoveAt(i);

// Forward with swap-back, order not preserved. Note the missing increment.
for (int i = 0; i < items.Count; )
    if (ShouldRemove(items[i]))
        UnorderedList.RemoveAtSwapBack(items, i);
    else
        i++;
```

The second loop is the one people write incorrectly. Incrementing `i` unconditionally skips whatever the removal moved into slot `i`, and the skipped element survives a pass it should not have survived. The defect is intermittent by nature: it appears only when two removable elements land in the wrong relative positions, so a test with one removal per frame will never see it.

Both loops share a property worth naming: neither allocates, and neither invalidates an enumerator, because neither uses one. When a collection must be modified while it is being walked, index-based iteration is usually simpler than collecting removals into a second list, and it avoids the allocation that the second list would cost every frame.

Exercise: Write the second loop from memory, then test it with a list where the last two elements should both be removed. That case distinguishes the correct version from the one that skips.

?? structures-swap-back Which property does swap-back removal sacrifice?
* Element order.
- Constant-time access by index.
- The ability to store value types without boxing.
- The guarantee that the list's capacity stays unchanged.
- Correct behavior when the list holds duplicate values.
> Moving the last element into the removed slot avoids shifting but changes ordering.

?? structures-index-repair A dictionary maps each entity to its index in a list. After swap-back removal, what must be repaired?
* The moved entity's index mapping and the removed entity's dictionary entry.
- The removed entity's entry, since the moved entity keeps its old index.
- The moved entity's entry, since the removed entity's key is reused.
- The indices of every entity after the removed position.
- The dictionary's capacity, which now exceeds the list's count.
> The dictionary must describe the list's current positions. Each removal must update both structures, including the element moved into the empty slot.

?+ List [A, B, C, D] uses swap-back removal at index 1. What index should the dictionary record for D afterward?
* 1.
- 3, since D has not moved.
- 2, since the entries after B shift down by one.
- 0, since D takes over the first slot.
- D keeps no index, since the mapping is rebuilt after each removal.
> D moves from the last slot into B's old slot. Its lookup mapping must follow that move.

## Dictionaries, sets, and lookup contracts {#structures-hash-collections}

Use a dictionary to map keys to values, such as a mission ID to its progress. Use a set when you only need to know whether an ID is present, such as whether a spawn has already been collected.

Hash collection performance depends on hashing and resizing. Collisions are normal; equality checks distinguish keys that share a hash. Poor hashing or unusual input distributions can slow the collection down, while mutable keys or an incorrect comparer can also break lookups.

Use `TryGetValue` when a key may be absent. It expresses that possibility directly and avoids a missing-key exception. It can also replace `ContainsKey` followed by indexing with one lookup. When building an authored catalog, report duplicate IDs instead of silently overwriting a definition.

Specify iteration order if gameplay, presentation, or replay depends on it. Sort by a stable key, or choose a collection with an ordering guarantee you deliberately rely on. Also define how ties are ordered when different items have the same primary key. The order a hash collection happens to return should not become a hidden gameplay rule.

Hash collections use more memory than a compact array and may access memory less predictably. A linear scan may be enough for a tiny, fixed catalog. For a large immutable catalog, build the index once and keep it. For frequently changing state, plan for the frames when the collection grows.

Choose the string comparer for technical IDs explicitly, and do not normalize them with `ToLower` or `ToUpper`, which follow the device's language: changing it can then change whether an item ID is found. Searching display names can follow a separate rule suited to the user's language.

Two behaviors of the standard dictionary are worth knowing before you depend on them. Its enumeration order is not part of its contract, and removals in particular can change the order in which later insertions appear, because a freed slot may be reused. Code that happened to enumerate in insertion order during development can therefore change behavior after an unrelated removal is added, which is the hidden gameplay rule this section warns against.

Growth is the other behavior. A dictionary that exceeds its load factor allocates a larger bucket array and rehashes every key into it. That is a single spike proportional to the current count, arriving at an unpredictable moment. Where the approximate size is known, pass the capacity to the constructor: doing so before a run avoids several rehashes during the frames where they would be most visible. Clearing a dictionary keeps the allocated buckets, so a per-run dictionary that is cleared rather than recreated pays that cost once rather than every run.

Exercise: Design a registry that supports constant expected-time lookup by spawn ID and efficient iteration over active entities. Explain removal, pool reuse, index repair, and how tests check the combined invariants.

?? structures-set-choice Which collection directly represents whether a spawn ID has already been collected?
* A hash set of spawn IDs.
- A counter of how many coins have been collected this run.
- A dictionary mapping spawn ID to the coin's world position.
- A bitmask sized to the number of coin prefabs in the project.
- A list of the coin definitions used by the current level.
> A set expresses unique membership. Other structures can work, but should be justified by additional requirements.

?? structures-order-contract A replay depends on visiting entities in a repeatable order. What should it use?
* An explicitly defined ordering with a stable tie-breaker.
- The insertion order of a dictionary, which holds while nothing is removed.
- A sort by distance from the player, recomputed each frame.
- The order the entities appear in the scene hierarchy.
- The order produced by a seeded shuffle at the start of each replay.
> Repeatable execution needs a defined visit order. An incidental collection order can change without violating the collection's own contract.

## Queues, stacks, heaps, and linked lists {#structures-specialized}

A queue processes the oldest waiting item first, which fits pending commands, and is how a [[breadth-first search]] visits nearer nodes before farther ones. A stack processes the most recently added item first, which fits nested undo history, and is how a depth-first traversal follows one branch to its end before backing up. Both can use contiguous storage and support amortized constant-time operations.

A priority queue returns the item with the lowest or highest priority. A binary heap typically provides constant-time access to the next item, with logarithmic insertion and removal. This suits deadlines, pathfinding frontiers, and selecting the next task. A tower-defense wave schedule is the plainest game-shaped version: every spawn in the level is one entry keyed by its time, the level loop pops whatever has come due, and the structure is unchanged whether the level holds twenty spawns or two thousand. Before choosing a .NET API, check that it exists in the Unity project's compatibility profile. The `PriorityQueue<TElement, TPriority>` that .NET 6 added is the case in point: Unity's class libraries do not include it, so a Unity project writes its own binary heap or imports one.

Decide how a heap-based scheduler handles cancellation. Removing an arbitrary entry needs an index map or a different structure. A simpler option is to mark the entry as cancelled and discard it when it reaches the front. Those cancelled entries still occupy memory until removed, so compact them if that retained memory becomes significant.

If equal-priority tasks must run in insertion order, include an increasing sequence number as a tie-breaker. Without a tie rule, two tasks with the same deadline may run in an unspecified order.

A linked list can unlink a known node in constant time. Finding that node by value can still take a linear search unless another index supplies it. Nodes can also add allocations and pointer chasing. Frequent removal is therefore not enough to choose a linked list; consider how the node is found and how memory is accessed.

A least-recently-used (LRU) cache often combines a dictionary for lookup with a doubly linked list for access order. Operations can be efficient, but every change must keep the two structures consistent. Define the cache capacity, what cleanup eviction performs, and what happens if a caller is still borrowing an evicted resource.

Lazy deletion is worth seeing concretely, because the bookkeeping is where it goes wrong. Cancelling means marking, and the discard happens at the front:

```text
Schedule(entry):
    heap.Push(entry)
    pending.Add(entry.taskId)

Cancel(taskId):
    if pending.Contains(taskId):
        cancelled.Add(taskId)

PopNext(now):
    while heap is not empty and heap.Peek().deadline <= now:
        entry = heap.Pop()
        pending.Remove(entry.taskId)
        if cancelled.Remove(entry.taskId):
            continue          // Was cancelled; drop it and the marker together.
        return entry
    return none
```

Removing the marker at the same moment the entry is dropped keeps the cancelled set from growing without limit, which is the part most implementations forget. Without that line, a game that cancels a thousand tasks an hour accumulates a thousand identifiers an hour, and nothing ever removes them. That removal covers a cancel that arrives while the task is still waiting. A cancel that arrives after the task has run would add a marker no entry will ever meet, which is why `Cancel` checks the pending set first: a late cancel is the stale callback of earlier chapters, arriving at the scheduler.

The remaining weakness is a cancelled entry with a distant deadline: it sits in the heap until its time arrives, holding whatever it references. If a scheduler can accumulate many of these, add a compaction that rebuilds the heap without the cancelled entries when their proportion crosses a threshold. Choose the threshold from the retained memory, not from tidiness, and note that compaction is linear, so it belongs at a scene boundary rather than in a frame.

Exercise: For a scheduler you know, work out how many cancelled entries can exist at once and what each one keeps alive. That product decides whether compaction is needed.

?? structures-heap-deadlines Which structure fits repeatedly selecting the earliest scheduled deadline among many pending tasks?
* A min-priority queue, commonly implemented with a heap.
- A sorted list, re-sorted after each insertion.
- A queue processed in insertion order.
- A dictionary keyed by deadline, enumerated each tick.
- A circular buffer sized to the longest deadline.
> A min-heap maintains efficient access to the smallest priority. Cancellation and equal-priority ordering still need explicit policies.

?? structures-linked-list Why does a linked list not guarantee constant-time removal by value?
* It may first require a linear search to find the node.
- Removing a node requires rebuilding the links for the whole list.
- The node's neighbors have to be copied into new nodes.
- Each removal reallocates the list's backing storage.
- The list has to be traversed again afterward to update its count.
> Constant-time unlinking assumes a known node. Searching for that node can dominate the operation.

## Caches, indices, and memory layout {#structures-caches-layout}

Storing derived information adds a rule you must maintain. A cached effective speed becomes stale when base speed or active modifiers change. A [[spatial index]] needs updating when an entity moves between cells. An ID-to-index map must change when list elements move.

Choose when to update derived data: immediately after a change, when it is next read, or during a scheduled rebuild:

| Strategy | Good fit | Cost |
| --- | --- | --- |
| Recompute on every change | Few changes, many reads | Repeated work during bursts of writes |
| Mark dirty and compute on read | Many writes before next read | A read can become unexpectedly expensive |
| Rebuild in a batch | Coherent update phases | Results can be stale between rebuilds |

Decide how current each result must be. A cosmetic preview may tolerate a frame of delay. A collision test or reward eligibility check may need the latest state.

For frequently executed loops, consider which fields each iteration reads. An array of structs keeps an entity's fields together. Separate arrays can let a position-only calculation read positions without unrelated state. An array of class references keeps the references together, but the objects themselves may be scattered in memory.

A board makes that choice visible. Holding a match-3 grid as one flat array of cells, with the row and column folded into a single index, puts the rows back to back in one allocation, so reaching a cell never follows a second reference. An array of row arrays keeps each row contiguous too, but every row is a separate allocation that may sit anywhere, and every access goes through the outer array first. A 9 by 9 board is too small for either difference to show in a profiler, though, so there the flat array's better argument is simpler code: one index calculation and one array to copy for a snapshot. Check the column before folding it into the index, because a column one past the edge lands on the next row's first cell instead of failing.

Start with the data used by the slow loop. Change that representation where needed, then compare CPU time, memory use, and maintenance cost. One slow loop does not by itself justify reorganizing the whole game.

Include every input that affects the result in a cache key, including relevant settings and content revisions. A reward cache that omits difficulty could return a value calculated for another mode. Unnecessary key fields reduce reuse; missing required fields can return incorrect answers.

Deciding not to index is as much a design decision as deciding to index, and it deserves the same arithmetic. Compare the work saved against the work added. If entities move every frame and the index is queried twice per frame, every query saves a scan while every movement costs an update, and the index can easily cost more than it saves. If the data is a catalog loaded once and queried thousands of times, the index is free after the first frame.

A rough test: divide reads by writes over a representative second of play. A ratio far above one favors an index, a ratio near or below one favors scanning the authoritative data, and a ratio you cannot estimate is a reason to measure rather than to build. Apply the same test to a cache, because a cache is an index over computation rather than over data.

The hidden cost is not performance but correctness. Every derived structure adds a rule that something must maintain, and the failure mode is a stale answer rather than a crash, which makes it expensive to find. Before adding one, decide who invalidates it, on which events, and what the system does if that invalidation is missed. If that answer is unclear, the simple version that recomputes is worth keeping until the measurement forces the issue.

Exercise: Pick a cache or index in your project and estimate its read-to-write ratio over one second of typical play. Then find the line that invalidates it, and the case where that line does not run.

?? structures-cache-key A reward depends on mission ID, difficulty, and definition revision. Which cache key is correct?
* One that accounts for all three inputs.
- Mission ID and difficulty, since a revision change clears the cache.
- Mission ID and definition revision, since difficulty is fixed per session.
- The mission ID, with the other inputs checked after the lookup.
- A hash of the reward value returned by the previous lookup.
> A cached answer is valid only for the inputs that produced it. Missing dependencies create incorrect cache hits.

?? structures-dirty-cache What is a tradeoff of recomputing a dirty value only when first read?
* The read can incur a larger and less predictable cost.
- Writes become more expensive, since each one recomputes the value.
- The value is recomputed even when nothing has changed.
- Readers see the value from before the most recent write.
- The dirty flag has to be checked on every write as well as every read.
> Several writes can be combined into one recalculation, but the first reader pays that cost. Decide whether that timing fits the frame budget.
