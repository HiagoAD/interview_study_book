# Review request: Job System and Burst

- **First used:** `content/unity-engineering/07-async-and-assets.md:20`, section `async-models`
- **Explained in:** `content/unity-engineering/07-async-and-assets.md:253`, section `async-jobs-burst`
- **Distance:** same chapter, first section to last
- **Now covered by:** the `job-system` and `burst` entries, linked at the first mention

## What the reader meets first

A row of the table that chooses between asynchronous models:

> | Process many independent numeric items | Job System, possibly Burst |

Both names appear here for the first and only time before the last section of the chapter,
which is where they are explained.

## Why this is listed at all

The distance is the shortest of any request in this folder, and the reader will reach the
explanation within the chapter. It is recorded for a different reason: the table is a
decision aid. Its job is to let a reader pick an approach, and two of its four rows point
at tools it does not describe, so the row cannot be acted on at the moment it is read.

The site's structure sharpens this. Each section is its own page, and a section later in
the chapter is locked until the ones before it are done, so `async-jobs-burst` is not
somewhere the reader can simply skip ahead to.

## Options

1. **Leave it.** Both entries define the tools in a sentence each and point at
   `async-jobs-burst`. For a table row, a hover card is arguably the right size of answer.
2. **Add a clause to the row or under the table**, naming what the Job System is in the
   half-sentence the table can afford.
3. **Say it in the prose under the table.** The paragraph after it discusses `async void`;
   a sentence before that, noting that the last section of the chapter covers jobs, would
   set expectations without moving anything.

## Recommendation (second read, 2026-09-22)

Option 3. The table is a decision aid, and the site locks the section that explains two of
its rows, so the reader cannot follow a pointer ahead. One sentence before the paragraph
on `async void`, such as “The last section of this chapter covers the Job System and
Burst, including when their scheduling cost is repaid.”, sets the expectation. The hover
cards stay the right size of answer for the row itself.
