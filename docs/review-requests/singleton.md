# Review request: singleton

- **First used:** `content/unity-engineering/01-architecture.md:337`, section `architecture-tradeoffs`
- **Explained in:** `content/unity-engineering/05-principles-and-patterns.md:190` and `:194`, section `patterns-selection`
- **Now covered by:** the `singleton` entry, linked at the first mention

## What the reader meets first

> “I rejected a global manager because runs require independent state; an application-wide
> catalog would still be shared” shows judgment more clearly than “singletons are bad.”

The sentence dismisses a position without the reader necessarily holding it. Chapter 05
later does the work properly, separating the three ideas the word carries: one instance,
global access, and lazy self-creation.

## Why this needs a decision

The chapter 01 use is rhetorical, and it is the weaker half of a comparison the book is
making about how to sound in an interview. A reader who does not know the word learns only
that a phrase they have not heard is a bad answer.

There is a good argument that this is fine. The sentence is about how to phrase a
tradeoff, not about singletons, and the reader loses nothing by not knowing. It is listed
here because the phrase is in quotation marks as an example of weak speech, which invites
the reader to believe they should already recognise it.

## Options

1. **Leave it.** The entry gives the three-part separation immediately, which is the same
   answer chapter 05 reaches.
2. **Swap the example** in chapter 01 for one the reader already has, such as “global
   state is bad”. The point about naming the requirement survives unchanged.
3. **Do nothing and accept the vocabulary**, as with coroutine. The two requests should
   probably be closed the same way, since both are words an interview candidate is assumed
   to have met.

## Recommendation (second read, 2026-09-22)

Option 3, closed together with [coroutine.md](coroutine.md), as this request suggests. The
sentence is about how to phrase a tradeoff, a candidate preparing for a Unity interview
has met the word, and the entry gives the three-part separation at once. Delete this file
when the decision is taken, and keep the entry.
