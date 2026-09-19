---
book: Sample Book
---

# Complexity

## Big-O basics {#big-o-basics}

Big-O notation describes how the running time of an algorithm grows with the input size $n$. Constants and lower-order terms are dropped, so $3n^2 + 5n + 2$ is $O(n^2)$. Adding up the first $n$ numbers shows where a quadratic comes from:

$$ \sum_{i=1}^{n} i = \frac{n(n+1)}{2} = O(n^2) $$

A loop over $n$ items does $O(n)$ work. A loop inside a loop over the same items does $O(n^2)$.

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
> The inner loop runs about $n/2$ times for each of the $n$ outer iterations, so the work grows as $n^2$.

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
> The inner loop runs 3, 2, 1 and 0 times, and $3 + 2 + 1 + 0 = 6$. In general that is $n(n-1)/2$.

## Space and time {#space-time}

Trading memory for speed is common. A hash set answers "have I seen this?" in $O(1)$ on average, at the cost of $O(n)$ extra space.

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

This version makes one pass, so it runs in $O(n)$ time instead of $O(n^2)$.

?? set-lookup What is the average cost of `seen.has(item)`?
* $O(1)$
* Constant time
- $O(n)$
- $O(\log n)$
- $O(n^2)$
> A hash set jumps straight to the bucket for a key, so a lookup takes constant time on average.

?? memory-tradeoff [tf] The set-based `hasDuplicate` is faster than the nested loops but needs more memory.
* true
> It stores up to $n$ items in `seen`, which the nested loops do not, and in return it drops from $O(n^2)$ to $O(n)$ time.
