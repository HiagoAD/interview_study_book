# Review request: coroutine

- **First used:** `content/unity-engineering/01-architecture.md:45`, section `engineering-study-method`
- **Used again:** `content/unity-engineering/02-power-up-design.md:347`, section `powerup-test-matrix`
- **Explained in:** `content/unity-engineering/07-async-and-assets.md:8`, section `async-models`
- **Now covered by:** the `coroutine` entry, linked at both early mentions

## What the reader meets first

It appears inside the example of a good answer, in the table that grades answers by depth:

> I rejected one coroutine per effect, because pause and cancellation rules would then
> live in several places.

Chapter 02 repeats the argument at more length, still without saying what a coroutine is.

## Why this needs a decision

The first use is unusual: the word is not being taught, it is being used inside a model
answer that the reader is meant to imitate. A reader who does not know the word cannot
tell whether the sentence is a technical claim they should be able to make or an aside.

Both early uses make the same point, that one coroutine per effect scatters the pause and
cancellation rules. That point does not need the reader to know how a coroutine resumes,
only that it is a per-object piece of work with its own lifetime.

## Options

1. **Leave it.** The entry gives the definition and the lifetime rules, and points at
   `async-models` for the comparison with tasks and `Awaitable`.
2. **Reword the two early uses** so they do not depend on the word, for example "one timer
   object per effect". This loses the connection to what the reader will later learn is
   the common wrong answer, which is part of why the example works.
3. **Accept it as vocabulary.** A Unity engineer preparing for interviews arguably knows
   the word already, and the book assumes similar knowledge elsewhere, such as prefabs and
   the Inspector. If that is the position, this request closes with no change.
