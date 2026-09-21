---
book: Unity Game Engineering
chapter: 09: Data structures and complexity for game systems
---

## Analyze the work that grows with the game {#structures-complexity}

Complexity describes how resource use grows as the input grows. Name that input first: active enemies, collected IDs, missions, path nodes, or visible UI entries. The complexity claim only makes sense relative to the size you are measuring.

$O(1)$ describes work bounded independently of that input size; $O(n)$ describes linear growth; $O(n \log n)$ commonly appears in comparison sorting; $O(n^2)$ appears when every entity checks every other entity. These are growth classes, not execution-time measurements.

Distinguish worst-case, expected, and amortized costs. A hash lookup is commonly expected to take constant time with suitable hashing and load, but a bad case can take longer. Appending to a dynamic array is amortized constant time: most appends are cheap, while an occasional resize copies existing elements. One append can therefore take linear time. That difference matters if a single slow frame would be visible.

If 1,000 enemies each scan 1,000 potential targets every frame, there are about one million candidate checks per frame. At 60 FPS, that is about 60 million checks per second, before any expensive visibility or path queries. Reducing how many candidates need checking may help much more than removing one multiplication from each check.

Big-O leaves out constant costs, allocations, cache behavior, branch predictability, and engine calls. A linear scan of 20 contiguous elements can be faster than setting up and using a hash lookup. Use complexity to identify likely problems as the game grows, then measure the actual workload.

Account for memory as well as execution time. Caching every pairwise distance uses quadratic storage and needs updates when positions change. An index makes queries faster by spending memory and time on maintenance. Compare how often the data changes with how often it is queried.

For an interview, narrate the baseline first: “I would start with a linear scan of the active set; if population or profiling makes it expensive, I would introduce a spatial index.” Explain why the scan is correct before discussing its replacement.

?? structures-amortized What does amortized constant-time list append mean?
* The average cost over a sequence of appends is constant, although a resize can make one append linear.
- Every append is guaranteed to take exactly the same time.
- List appends never allocate.
- The worst-case cost of every append is logarithmic.
> Most appends are cheap, but occasional growth copies existing elements. Averaging that work across many appends gives constant cost; an individual resize can still cause a spike.

?+ A latency-sensitive frame appends to a list whose capacity is exhausted. Which statement is correct?
* That append can allocate a larger backing array and copy existing elements despite amortized constant-time append.
- Amortized constant time prevents any single resize.
- List capacity automatically grows during an earlier idle frame.
- The append becomes a constant-time linked-list insertion.
> Amortized bounds describe sequences of operations, not a hard latency guarantee for each operation.

?? structures-pair-count A naive loop checks each of 1,000 enemies against 1,000 candidates. Approximately how many checks does it perform?
* 1,000,000.
- 2,000.
- 1,000.
- 10,000.
> Nested full scans multiply the dimensions. This estimate helps identify whether reducing candidates is worth investigating.

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

?? structures-swap-back Which property does swap-back removal sacrifice?
* Element order.
- The ability to remove the last element.
- Type safety.
- The ability to retain the remaining elements.
> Moving the last element into the removed slot avoids shifting but changes ordering.

?+ A dictionary maps each entity to its index in a list. After swap-back removal, what must be repaired?
* The moved entity's index mapping and the removed entity's dictionary entry.
- Only the list's display name.
- Every entity's persistent ID.
- Nothing, because dictionaries track list movement automatically.
> The dictionary must describe the list's current positions. Each removal must update both structures, including the element moved into the empty slot.

?+ List [A, B, C, D] uses swap-back removal at index 1. What index should the dictionary record for D afterward?
* 1.
- 3.
- 2.
- D should be deleted along with B.
> D moves from the last slot into B's old slot. Its lookup mapping must follow that move.

## Dictionaries, sets, and lookup contracts {#structures-hash-collections}

Use a dictionary to map keys to values, such as a mission ID to its progress. Use a set when you only need to know whether an ID is present, such as whether a spawn has already been collected.

Hash collection performance depends on hashing and resizing. Collisions are normal; equality checks distinguish keys that share a hash. Poor hashing or unusual input distributions can slow the collection down, while mutable keys or an incorrect comparer can also break lookups.

Use `TryGetValue` when a key may be absent. It expresses that possibility directly and avoids a missing-key exception. It can also replace `ContainsKey` followed by indexing with one lookup. When building an authored catalog, report duplicate IDs instead of silently overwriting a definition.

Specify iteration order if gameplay, presentation, or replay depends on it. Sort by a stable key, or choose a collection with an ordering guarantee you deliberately rely on. Also define how ties are ordered when different items have the same primary key. The order a hash collection happens to return should not become a hidden gameplay rule.

Hash collections use more memory than a compact array and may access memory less predictably. A linear scan may be enough for a tiny, fixed catalog. For a large immutable catalog, build the index once and keep it. For frequently changing state, plan for the frames when the collection grows.

Choose the string comparer for technical IDs explicitly. Changing the device language should not change whether an item ID is found. Searching display names can follow a separate rule suited to the user's language.

Exercise: Design a registry that supports constant expected-time lookup by spawn ID and efficient iteration over active entities. Explain removal, pool reuse, index repair, and how tests check the combined invariants.

?? structures-set-choice Which collection directly represents whether a spawn ID has already been collected?
* A hash set of spawn IDs.
- A list of translated item descriptions as the authority.
- A stack of animation frames.
- A dictionary keyed only by the current frame number.
> A set expresses unique membership. Other structures can work, but should be justified by additional requirements.

?? structures-order-contract A replay depends on visiting entities in a repeatable order. What should it use?
* An explicitly defined ordering with a stable tie-breaker.
- Whatever order a hash collection happens to return.
- A random order without recording the random inputs.
- The order in which asynchronous loads happen to finish.
> Repeatable execution needs a defined visit order. An incidental collection order can change without violating the collection's own contract.

## Queues, stacks, heaps, and linked lists {#structures-specialized}

A queue processes the oldest waiting item first, which fits pending commands or breadth-first search. A stack processes the most recently added item first, which fits depth-first traversal or nested undo history. Both can use contiguous storage and support amortized constant-time operations.

A priority queue returns the item with the lowest or highest priority. A binary heap typically provides constant-time access to the next item, with logarithmic insertion and removal. This suits deadlines, pathfinding frontiers, and selecting the next task. Before choosing a .NET API, check that it exists in the Unity project's compatibility profile.

Decide how a heap-based scheduler handles cancellation. Removing an arbitrary entry needs an index map or a different structure. A simpler option is to mark the entry as cancelled and discard it when it reaches the front. Those cancelled entries still occupy memory until removed, so compact them if that retained memory becomes significant.

If equal-priority tasks must run in insertion order, include an increasing sequence number as a tie-breaker. Without a tie rule, two tasks with the same deadline may run in an unspecified order.

A linked list can unlink a known node in constant time. Finding that node by value can still take a linear search unless another index supplies it. Nodes can also add allocations and pointer chasing. Frequent removal is therefore not enough to choose a linked list; consider how the node is found and how memory is accessed.

A least-recently-used (LRU) cache often combines a dictionary for lookup with a doubly linked list for access order. Operations can be efficient, but every change must keep the two structures consistent. Define the cache capacity, what cleanup eviction performs, and what happens if a caller is still borrowing an evicted resource.

?? structures-heap-deadlines Which structure fits repeatedly selecting the earliest scheduled deadline among many pending tasks?
* A min-priority queue, commonly implemented with a heap.
- A stack ordered only by insertion.
- A hash set with no ordering.
- A list sorted only by display name.
> A min-heap maintains efficient access to the smallest priority. Cancellation and equal-priority ordering still need explicit policies.

?? structures-linked-list Why does a linked list not guarantee constant-time removal by value?
* It may first require a linear search to find the node.
- Linked lists cannot remove nodes.
- Every removal must sort the list.
- A value determines its node address automatically.
> Constant-time unlinking assumes a known node. Searching for that node can dominate the operation.

## Caches, indices, and memory layout {#structures-caches-layout}

Storing derived information adds a rule you must maintain. A cached effective speed becomes stale when base speed or active modifiers change. A spatial index needs updating when an entity moves between cells. An ID-to-index map must change when list elements move.

Choose when to update derived data: immediately after a change, when it is next read, or during a scheduled rebuild:

| Strategy | Good fit | Cost |
| --- | --- | --- |
| Recompute on every change | Few changes, many reads | Repeated work during bursts of writes |
| Mark dirty and compute on read | Many writes before next read | A read can become unexpectedly expensive |
| Rebuild in a batch | Coherent update phases | Results can be stale between rebuilds |

Decide how current each result must be. A cosmetic preview may tolerate a frame of delay. A collision test or reward eligibility check may need the latest state.

For frequently executed loops, consider which fields each iteration reads. An array of structs keeps an entity's fields together. Separate arrays can let a position-only calculation read positions without unrelated state. An array of class references keeps the references together, but the objects themselves may be scattered in memory.

Start with the data used by the slow loop. Change that representation where needed, then compare CPU time, memory use, and maintenance cost. One slow loop does not by itself justify reorganizing the whole game.

Include every input that affects the result in a cache key, including relevant settings and content revisions. A reward cache that omits difficulty could return a value calculated for another mode. Unnecessary key fields reduce reuse; missing required fields can return incorrect answers.

?? structures-cache-key A reward depends on mission ID, difficulty, and definition revision. Which cache key is correct?
* One that accounts for all three inputs.
- Mission ID alone regardless of the other inputs.
- The reward's display color alone.
- A random key on every read while claiming perfect reuse.
> A cached answer is valid only for the inputs that produced it. Missing dependencies create incorrect cache hits.

?? structures-dirty-cache What is a tradeoff of recomputing a dirty value only when first read?
* The read can incur a larger and less predictable cost.
- The value never needs invalidation.
- All writes become persistent automatically.
- The cached result can no longer be stale.
> Several writes can be combined into one recalculation, but the first reader pays that cost. Decide whether that timing fits the frame budget.
