# Review request: spatial index

- **First used:** `content/unity-engineering/09-data-structures.md:20`, section `structures-complexity`
- **Used again:** `content/unity-engineering/09-data-structures.md:231`, section `structures-caches-layout`
- **Explained in:** `content/unity-engineering/10-game-algorithms.md:16`, section `algorithms-spatial`
- **Now covered by:** the `spatial-index` entry, linked at both mentions

## What the reader meets first

Inside a model interview answer, which is the same pattern as the coroutine request:

> “I would start with a linear scan of the active set; if population or profiling makes it
> expensive, I would introduce a spatial index.”

The second use, twelve sections later, assumes more: "A spatial index needs updating when
an entity moves between cells." Cells have not been introduced either.

## Why this needs a decision

The gap is one chapter, and chapter 10 opens by building the grid from scratch, so a
reader working in order reaches the explanation quickly. Against that, chapter 09 offers
the sentence as something to say aloud in an interview, and the follow-up question to it
is "what kind of index?".

## Options

1. **Leave it.** One chapter is a short wait, and the entry answers it now.
2. **Name the structure in chapter 09**: "a spatial index, such as a uniform grid of
   cells". Three words, and the second use at line 231 stops being the first mention of
   cells.
3. **Reorder.** Not worth it; the two chapters are correctly ordered, since structures
   belong before the algorithms that use them.

## Recommendation (second read, 2026-09-22)

Option 2: “a spatial index, such as a uniform grid of cells”. Three words, and line 231's
“between cells” stops being the first mention of cells. Take it in the same pass as
[grid-cell-size.md](grid-cell-size.md), which corrects the starting cell size in chapter
10 and in this entry's last paragraph.
