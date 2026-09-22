# Review request: frame budget

- **First used:** `content/unity-engineering/01-architecture.md:69`, section `architecture-requirements`
- **Explained in:** `content/unity-engineering/11-profiling-and-optimization.md:8`, section `performance-frame-budget`
- **Distance:** ten chapters, the longest in the book
- **Now covered by:** the `frame-budget` entry, linked at the first mention

## What the reader meets first

As the example of a quality requirement, set against a functional one:

> “Coins inside the radius move toward the player” describes what the feature does. “The
> feature fits the remaining frame budget on the minimum supported device” limits how much
> work it can do.

The word "remaining" is doing real work there, and it only means something if the reader
knows the budget is a fixed total that other systems have already drawn on.

## Why this needs a decision

This is the book's own example of a well-formed requirement, so it is worth the reader
understanding it exactly. Chapter 11 later shows that the gameplay share is under three
milliseconds of the 16.67 available, which is the fact that makes the chapter 01 sentence
sharp rather than vague.

Chapter 02 makes the same appeal, and chapter 15 lists frame budgets among the things a
weaker device changes.

## Options

1. **Leave it.** The entry gives the arithmetic and the split, and points at
   `performance-frame-budget` for the worked table.
2. **Add the number in chapter 01.** "The feature fits the remaining frame budget, about
   16.67 ms at 60 FPS shared between every system, on the minimum supported device." One
   clause, and the requirement becomes checkable where it is first shown.
3. **Leave chapter 01 and adjust chapter 11**, opening it by noting that the budget has
   been assumed since chapter 01. Weakest option; it signposts backwards, which helps a
   reader who already got through.

## Recommendation (second read, 2026-09-22)

Option 2. The sentence is the book's own example of a requirement you can check, and the
number is what makes it checkable. The clause the option proposes is accurate and fits the
book's style. Chapter 11's table then confirms a figure the reader has already met, which
is the better order of the two.
