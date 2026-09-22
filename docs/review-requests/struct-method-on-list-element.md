# Review request: a struct method called through a list indexer

- **Kind:** accuracy
- **Priority:** high
- **Where:** `content/unity-engineering/04-csharp-fundamentals.md:54`, section `csharp-value-reference`, and the exercise at `:60`, which depends on it
- **Touches:** prose only

## What the book says

> The compiler error is the helpful case. The same mistake through a method is silent: if
> `Cell` has a `Weaken` method, `cells[i].Weaken()` on a `List<T>` does not compile, but
> the same expression on an *array* does compile and does work, because an array element
> is a storage location and a list indexer is a value-returning property.

## Why it is wrong

`cells[i].Weaken()` on a `List<Cell>` compiles. The indexer returns a copy, the method
runs on that hidden temporary, and the change is discarded at the end of the statement.
That is exactly the silent case the paragraph's first two sentences announce, and the
third sentence then contradicts them.

Checked with the .NET 8 compiler in a scratch program kept outside the repo:

```text
list[0].Weaken();                                 compiles; list[0].Blocker stays 3
array[0].Weaken();                                compiles; array[0].Blocker becomes 2
cells[0].Blocker -= 1;                            error CS1612: Cannot modify the return value of 'List<Cell>.this[int]'
foreach (var cell in cells) cell.Blocker -= 1;    error CS1654: Cannot modify members of 'cell' because it is a 'foreach iteration variable'
```

So the compiler catches a field assignment through the indexer or through a `foreach`
variable, and says nothing about a mutating method call. This is a standard C# interview
question, and a reader who memorizes the book's version will give the wrong answer with
confidence.

The exercise inherits the problem: “Predict the result of the loop above for an array and
for a list, then run both.” The `foreach` loop fails to compile for both containers, and
the `for` loop with its write-back works for both, so a reader who runs them finds no
difference at all.

## Proposed fix

Replace the sentence:

> The compiler error is the helpful case. The same mistake through a method is silent: if
> `Cell` has a `Weaken` method, `cells[i].Weaken()` compiles for a `List<T>` and for an
> array alike, and only the array keeps the change. An array element is a storage
> location, so the method changes it in place; a list indexer is a property that returns a
> copy, so the method changes a temporary that is thrown away at the end of the statement.

Point the exercise at the case that differs:

> Exercise: Predict what `cells[i].Weaken()` leaves in element `i` for an array and for a
> list, then run both. Where your prediction and the result differ, you have found the
> rule worth memorizing.

## Also check

- No question in the section tests this case, so no question block depends on the wrong
  sentence.
- Lines 56 and 58 (defensive copies on a `readonly` field, and the practical rule) are
  correct, and read better once line 54 is fixed, because they describe the same silent
  copy.
