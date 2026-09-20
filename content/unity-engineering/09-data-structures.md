---
book: Unity Game Engineering
chapter: 09: Data structures and complexity for game systems
---

## Analyze the work that grows with the game {#structures-complexity}

Complexity describes how resource use grows with input size. Define the input before naming the complexity: number of active enemies, collected IDs, missions, path nodes, or visible UI entries.

$O(1)$ describes work bounded independently of that input size; $O(n)$ describes linear growth; $O(n \log n)$ commonly appears in comparison sorting; $O(n^2)$ appears when every entity checks every other entity. These are growth classes, not execution-time measurements.

Distinguish worst-case, expected, and amortized costs. A hash lookup is commonly expected constant time under suitable hashing and load, but can degrade. Appending to a dynamic array is amortized constant time: occasional growth copies existing elements, so a particular append can be linear. That distinction matters when one slow frame is unacceptable.

If 1,000 enemies each scan 1,000 potential targets every frame, the algorithm performs about one million candidate checks per frame. At 60 FPS that is about 60 million per second, before expensive visibility or path queries. Reducing the candidate set can matter much more than removing one multiplication.

Big-O also omits constants, allocation, cache behavior, branch predictability, and engine-call costs. A contiguous linear scan over 20 elements can beat a hash lookup with setup overhead. Measure the workload after using complexity analysis to identify likely scaling problems.

State space complexity too. Caching all pairwise distances trades recomputation for quadratic storage and invalidation. Maintaining an index trades faster queries for update work and memory. Ask how often the data changes relative to how often it is queried.

For an interview, narrate the baseline first: “I would start with a linear scan of the active set; if population or profiling makes it expensive, I would introduce a spatial index.” Explain why the scan is correct before discussing its replacement.

?? structures-amortized What does amortized constant-time list append mean?
* The average cost over a sequence of appends is constant, although a resize can make one append linear.
- Every append is guaranteed to take exactly the same time.
- List appends never allocate.
- The worst-case cost of every append is logarithmic.
> Amortized analysis distributes occasional expensive growth across many cheap operations. It does not remove individual spikes.

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

Arrays provide fixed-length indexed storage. `List<T>` provides a resizable array with a logical count and capacity. Both give constant-time indexed access; list insertion or removal near the front shifts later elements.

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

This preserves membership except for the removed item, but changes order. It is appropriate for an unordered active-particle list, not a leaderboard or chronological event queue. If a dictionary maps entity IDs to list indices, update the moved entity's mapping and remove the deleted entity's mapping.

Pre-size a collection when expected occupancy gives you a capacity estimate, especially before latency-sensitive gameplay. Do not reserve huge capacity for every object “just in case.” Capacity consumes memory even when count is low, and clearing a list generally retains that capacity.

When removing while iterating, account for movement. With swap-back removal, inspect the replacement at the same index before incrementing, or iterate using a carefully defined loop. Otherwise an element can skip processing.

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
> The list and index map form one data structure with shared invariants. Every mutation must keep them consistent.

?+ List [A, B, C, D] uses swap-back removal at index 1. What index should the dictionary record for D afterward?
* 1.
- 3.
- 2.
- D should be deleted along with B.
> D moves from the last slot into B's old slot. Its lookup mapping must follow that move.

## Dictionaries, sets, and lookup contracts {#structures-hash-collections}

A dictionary maps keys to values. A set represents unique membership. Use a dictionary for mission ID to progress; use a set for collected spawn IDs when membership alone is needed.

Expected constant-time operations depend on hashing and resizing behavior. Hash collisions are normal and resolved using equality. A poor comparer, mutable keys, or unusual input distributions can degrade performance and correctness.

Use `TryGetValue` when absence is expected, rather than indexing and catching a missing-key exception. Avoid `ContainsKey` followed by indexing when one lookup can supply the result. Validate duplicate authored IDs while constructing the catalog instead of silently overwriting one definition.

Iteration order should not become an accidental gameplay contract. If deterministic presentation or replay needs ordering, sort by an explicit stable key or use a structure whose ordering contract you deliberately depend on. Stable sorting also needs a tie rule if distinct items have equal primary keys.

Hash collections consume more memory than a compact array and have less predictable locality. For a tiny static catalog, a linear scan may be sufficient. For a large immutable catalog, build the index once and keep it stable. For hot dynamic state, account for resize points.

Choose technical string comparison deliberately. A stable item ID should not change lookup behavior because the device language changes. Display-name search can use a separate user-facing matching policy.

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
> Determinism requires ordering to be part of the contract, not an incidental collection implementation detail.

## Queues, stacks, heaps, and linked lists {#structures-specialized}

A queue models first-in, first-out work: pending commands or breadth-first search. A stack models last-in, first-out work: depth-first traversal or nested undo history. Both can be implemented with contiguous storage and amortized constant-time operations.

A priority queue selects the item with the smallest or largest priority. A binary heap typically offers constant-time peek and logarithmic insertion and removal. It is useful for scheduled deadlines, pathfinding frontiers, or “next task” selection. Do not assume a particular modern .NET collection API exists in the Unity project's selected compatibility profile; verify before adopting it.

Cancellation is a design choice. Removing arbitrary heap entries needs an index map or a different structure. A simpler scheduler can mark entries cancelled and discard them when popped, but cancelled entries retain memory until removed. Compact when the retained work justifies it.

For equal priorities, add a monotonically increasing sequence if stable order matters. Otherwise two tasks scheduled for the same deadline can run in an unspecified order.

A linked list can remove a known node in constant time, but finding that node is linear without another index. Each node can add allocation and pointer chasing. “Frequent removal” alone does not make it faster than a list; location knowledge and locality matter.

An LRU cache often combines a dictionary for lookup with a doubly linked list for recency. It provides efficient operations at the cost of two structures whose invariants must agree. A cache also needs capacity, eviction cleanup, and a policy for resources still borrowed by users.

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

An optimization that stores derived information creates another invariant. A cached effective speed must be invalidated when the base speed or active modifiers change. A spatial index must update when an entity changes cells. An ID-to-index map must follow list movement.

Choose between eager recomputation, lazy invalidation, and periodic rebuilding:

| Strategy | Good fit | Cost |
| --- | --- | --- |
| Recompute on every change | Few changes, many reads | Repeated work during bursts of writes |
| Mark dirty and compute on read | Many writes before next read | A read can become unexpectedly expensive |
| Rebuild in a batch | Coherent update phases | Results can be stale between rebuilds |

Define whether stale results are acceptable. A cosmetic preview may tolerate a frame of delay; a collision or reward eligibility check may not.

Memory layout matters in hot loops. An array of structs keeps related per-entity fields together. Separate arrays can let an operation read only positions without pulling in unrelated state. An array of class references is contiguous in references, but the objects they point to can be scattered.

Do not convert the whole game to a data-oriented layout because one loop is slow. Identify the data the loop actually uses, make a narrow representation change, and compare CPU time, memory, and maintenance cost.

A cache key must account for every input that affects the answer, including relevant content revision or settings. Omitting difficulty from a cached reward calculation can reuse an answer from the wrong mode. An overbroad key increases misses, while an incomplete key produces incorrect hits.

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
> Lazy recomputation coalesces writes but moves work into a read. That timing matters in frame-sensitive code.
