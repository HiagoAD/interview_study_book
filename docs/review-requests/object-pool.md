# Review request: object pool

- **First used:** `content/unity-engineering/02-power-up-design.md:250`, section `powerup-collection`
- **Explained in:** `content/unity-engineering/11-profiling-and-optimization.md:207`, section `performance-pooling`
- **Distance:** nine chapters, and seven sections use it in between
- **Now covered by:** the `object-pool` entry, linked at eight first mentions

## What the reader meets first

> Give each spawned coin an identity that lasts for that spawn. A pooled GameObject may
> represent several different coins during one run, so its object identity alone is not
> enough.

Nothing before this sentence says what a pool is. The sentence does not depend on knowing,
which is why it survived several passes, but everything built on it does: the spawn
generation, the stale callback, the identity checks in chapter 04, the cleanup rules in
chapter 06, and the test in chapter 08 all assume reuse is understood.

## Why this needs a decision

Pooling is the widest forward reference in the book. It is used in chapters 02, 04, 05,
06, 07, 08 and 09, and explained in 11. It is also the mechanism behind the book's
recurring defect, the stale result applied to a reused object, so a reader who does not
have it does not have the thread that connects those chapters.

The counter-argument is that chapter 11 is the right home. Pooling belongs with allocation
and retained memory, because the reason to reach for it is a measurement, and teaching it
in chapter 02 would mean teaching that measurement there too.

## Options

1. **Leave it.** The entry defines pooling, names the identity problem, and points at
   `performance-pooling` for the contract. The strongest case of the three, because the
   concept genuinely belongs with the measurement that motivates it.
2. **One sentence in chapter 02.** After the sentence above, say what a pool is in a
   clause and that chapter 11 sets out its contract. Costs a line, removes the surprise.
3. **Move the mechanism forward.** A short subsection in chapter 02 on reuse and identity,
   with chapter 11 keeping the sizing and the memory argument. The most work, and it would
   leave chapter 11 explaining a concept the reader already has.

## Recommendation (second read, 2026-09-22)

Option 2. Pooling is the premise of the chapter's hardest test and of the book's recurring
defect, and a reader should not need a hover to follow chapter 02's own argument. One
clause teaches the mechanism without the measurement chapter 11 owns:

> A [[object pool|pooled]] GameObject, one that is disabled and handed out again instead
> of being destroyed, may represent several different coins during one run, so its object
> identity alone is not enough.

Keep the entry: it is the short answer for the six chapters in between.
