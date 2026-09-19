---
book: Sample Book
chapter: Caching
---

## Cache eviction {#cache-eviction}

A cache is small, so it has to decide what to throw away when it is full. An **LRU** (least recently used) cache evicts the entry that has gone longest without being read. A hash map plus a doubly linked list makes both lookup and eviction $O(1)$.

![Four keys in recency order, with B about to be evicted](images/lru.svg)

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.entries = OrderedDict()

    def get(self, key):
        self.entries.move_to_end(key)
        return self.entries[key]
```

Reading an entry moves it to the front of the list. When the cache is full, the entry at the back goes.

?? lru-evict Which entry does an LRU cache evict first?
* The least recently used entry
* The entry that has gone longest without being read
- The most recently used entry
- The largest entry
- The oldest inserted entry
- A random entry
> LRU tracks access order and removes the entry that has gone longest without being read.

?+ Keys A, B and C are inserted in that order, then A is read. Which key does LRU evict next?
* B
- A
- C
> After A is read, B is the least recently used key.

?? lru-cost [tf] LRU lookups take $O(n)$ time.
* false
> With a hash map and a doubly linked list, both lookup and eviction are $O(1)$.

?? fifo-name [short] Name the eviction policy that removes the oldest inserted entry.
= FIFO | first in first out
> FIFO ignores reads and evicts in insertion order.

## Hit rate {#hit-rate}

The hit rate is the share of lookups that find what they want:

$$ hit\ rate = \frac{hits}{hits + misses} $$

A cache that answers 80 of 100 lookups has a hit rate of $0.8$. If each miss costs \$0.002 of database time, then 1000 lookups at a hit rate of $0.9$ cost $100 \times 0.002 = 0.2$ dollars.

| Hit rate | Misses per 100 lookups |
| -------- | ---------------------- |
| 0.50     | 50                     |
| 0.90     | 10                     |
| 0.99     | 1                      |

```ts
function hitRate(hits: number, misses: number): number {
  return hits / (hits + misses)
}
```

?? hit-rate-formula [n=5] Which expression is the hit rate?
* $\frac{hits}{hits + misses}$
* $\frac{hits}{lookups}$
- $\frac{misses}{hits + misses}$
- $\frac{hits}{misses}$
- $hits - misses$
- $\frac{misses}{lookups}$
- $hits + misses$
> Every lookup is a hit or a miss, so $hits + misses$ is the number of lookups, and the hit rate is the share of them that were hits.

?? hit-rate-calc [short] A cache answers 90 of 100 lookups. What is its hit rate as a decimal?
= 0.9 | .9 | 0.90
> $90 / 100 = 0.9$.

?+ [tf] A cache with a hit rate of 0.5 misses on half of its lookups.
* true
> The miss rate is $1 - 0.5 = 0.5$.

## Write policies {#write-policies}

When data changes, the cache and the store behind it have to agree. There are three common policies:

- **Write-through** writes to the cache and the store together. Reads stay fresh, but every write pays for the slower store.
- **Write-back** writes to the cache and marks the entry dirty. The store is updated later, when the entry is evicted.
- **Write-around** writes to the store only. The cache fills on the next read.

?? write-policies-store [multi] Which policies send every write to the store immediately?
* Write-through
* Write-around
- Write-back
- Read-through
- Refresh-ahead
> Write-through and write-around both send each write straight to the store. Write-back waits until the entry is evicted.
