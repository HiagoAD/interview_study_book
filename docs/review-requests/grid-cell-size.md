# Review request: grid cell size and the cells a query touches

- **Kind:** accuracy
- **Priority:** medium
- **Where:** `content/unity-engineering/10-game-algorithms.md:26`, section `algorithms-spatial`; the `spatial-index` entry, `content/unity-engineering/glossary.md:220`, repeats the starting size
- **Touches:** prose and a glossary body

## What the book says

> Start at roughly the radius of the most common query. A radius query then touches a
> small, bounded block of cells, typically four in two dimensions when the radius and the
> cell size are similar, and the candidates it collects are mostly relevant.

## Why it is wrong

A radius query's bounding box is a diameter wide. With cells the size of the radius, a box
two cells wide spans three cells on each axis unless it happens to line up with the grid,
so the query touches nine cells, not four.

Worked with the book's own floor formula: radius 5, cell size 5, centre (7, 7). The box
runs from 2 to 12 on each axis, which is cells 0, 1 and 2, a 3 by 3 block. With cell size
10 the same box covers cells 0 and 1, a 2 by 2 block.

Four cells is what a cell about the size of the query's diameter gives, which is the usual
rule of thumb. The paragraph's argument (few cells, mostly relevant candidates) survives
either way; only the starting size and the count are wrong, and the count is the part a
reader will quote.

## Proposed fix

> Start at roughly the diameter of the most common query. A radius query then touches at
> most a 2 by 2 block of cells in two dimensions, and the candidates it collects are
> mostly relevant. Cells the size of the radius touch a 3 by 3 block instead, which is
> still bounded, and may suit a game whose query radius varies.

The glossary entry's last paragraph, to match:

> [[#algorithms-spatial]] starts it near the common query's diameter and gives the symptom
> of each mistake in either direction.

## Also check

The exercise at line 32 asks for “the chosen cell size”, and neither question in the
section tests the cell count, so nothing else moves.
