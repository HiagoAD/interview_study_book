---
book: Sample Book
---

# Complexity

## Big-O basics {#big-o-basics}

Big-O notation describes how an algorithm's running time grows with input size $n$. Ignore constant factors and lower-order terms when describing that growth: $3n^2 + 5n + 2$ becomes $O(n^2)$. Summing the first $n$ numbers gives an example of quadratic growth:

$$ \sum_{i=1}^{n} i = \frac{n(n+1)}{2} = O(n^2) $$

A single pass over $n$ items does $O(n)$ work. If each iteration also loops over those same items, the work grows to $O(n^2)$.

```python
def has_duplicate(items):
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if items[i] == items[j]:
                return True
    return False
```

?? nested-loops What is the worst-case running time of `has_duplicate` for a list of $n$ items?
* $O(n^2)$
- $O(n)$
- $O(\log n)$
- $O(1)$
- $O(n \log n)$
> In the worst case, the inner loop averages about $n/2$ iterations for each of the $n$ outer iterations. Multiplying them gives work that grows as $n^2$.

?+ [tf] Doubling the length of the list roughly doubles the running time of `has_duplicate`.
* false
> Doubling $n$ multiplies $n^2$ by four, so the running time roughly quadruples.

?? drop-constants [tf] $O(2n)$ and $O(n)$ describe the same growth.
* true
> Big-O ignores constant factors.

?? loop-count How many times does the body of the inner loop run when `n = 4`?
```python
n = 4
count = 0
for i in range(n):
    for j in range(i + 1, n):
        count += 1
print(count)
```
* 6
- 4
- 8
- 10
- 16
> The inner loop runs 3, 2, 1, and 0 times, so $3 + 2 + 1 + 0 = 6$. For a general list length, the total is $n(n-1)/2$.

## Space and time {#space-time}

You can often make an algorithm faster by storing information it would otherwise need to calculate again. A hash set answers "have I seen this?" in $O(1)$ on average, using up to $O(n)$ extra space to remember the items.

```ts
function hasDuplicate(items: number[]): boolean {
  const seen = new Set<number>()
  for (const item of items) {
    if (seen.has(item)) return true
    seen.add(item)
  }
  return false
}
```

This version checks each item once and remembers it in the set. Its expected running time is $O(n)$, compared with $O(n^2)$ for the nested loops.

?? set-lookup What is the average cost of `seen.has(item)`?
* $O(1)$
* Constant time
- $O(n)$
- $O(\log n)$
- $O(n^2)$
> A hash set jumps straight to the bucket for a key, so a lookup takes constant time on average.

?? memory-tradeoff [tf] The set-based `hasDuplicate` is faster than the nested loops but needs more memory.
* true
> The set stores up to $n$ items that the nested loops do not need to store. In exchange for that memory, expected running time falls from $O(n^2)$ to $O(n)$.
