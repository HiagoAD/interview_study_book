# Review request: breadth-first search

- **First used:** `content/unity-engineering/09-data-structures.md:180`, section `structures-specialized`
- **Explained in:** `content/unity-engineering/10-game-algorithms.md:97`, section `algorithms-pathfinding`
- **Now covered by:** the `breadth-first-search` entry, linked at the first mention

## What the reader meets first

The two search orders are used to motivate two collections:

> A queue processes the oldest waiting item first, which fits pending commands or
> breadth-first search. A stack processes the most recently added item first, which fits
> depth-first traversal or nested undo history.

The sentence is a definition of queue and stack that borrows two undefined terms to do it.
A reader who knows the searches finds it clarifying; a reader who does not has two unknowns
explaining two knowns.

## Why this needs a decision

Note that depth-first traversal has the same problem and no entry, because the book never
explains it anywhere. If this request is closed by editing rather than by leaving it, both
halves of the sentence should be treated together.

## Options

1. **Leave it.** The entry covers breadth-first search and points at
   `algorithms-pathfinding`. Depth-first stays unexplained, which is defensible only
   because the book never needs it again.
2. **Turn the sentence around**, so the collection explains the search rather than the
   other way about: "which is how a breadth-first search visits nearer nodes first". The
   sentence then teaches instead of assuming, and it costs no more words.
3. **Add a depth-first entry** as well, so both halves resolve. Worth doing if option 1 is
   chosen, since the asymmetry is otherwise arbitrary.

## Recommendation (second read, 2026-09-22)

Option 2, treating both halves together, which also removes the asymmetry option 3 was
written for:

> A queue processes the oldest waiting item first, which fits pending commands, and is how
> a breadth-first search visits nearer nodes before farther ones. A stack processes the
> most recently added item first, which fits nested undo history, and is how a depth-first
> traversal follows one branch to its end before backing up.

The sentence then teaches both searches in words it already uses, and depth-first needs no
entry, because the book never uses it again.
