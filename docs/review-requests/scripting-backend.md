# Review request: scripting backend

- **First used:** `content/unity-engineering/06-unity-lifecycle.md:294`, section `unity-editor-vs-player`, as "compilation backend"
- **Used again:** `content/unity-engineering/08-testing-and-debugging.md:162` and `:204`, as "scripting backend"
- **Explained in:** `content/unity-engineering/12-mobile-production.md:174`, section `mobile-build-integrations`
- **Now covered by:** the `scripting-backend` entry, linked at three mentions

## What the reader meets first

In a list of the ways a player build differs from the Editor:

> A player build can differ from the Editor in available assets, compilation backend,
> filesystem behavior, code stripping, and performance overhead.

Two sentences later the section says reflection may work in the Editor and fail in a
player. The cause of that is the backend, and the list has named it without connecting the
two.

## Why this needs a decision

This one is different from the others in the folder, because the early use is not a
passing reference: chapter 06 and chapter 08 both ask the reader to *act* on it. Chapter
06 says to test on the intended backend, and chapter 08 makes comparing the backend the
first step when a feature works in the Editor only. Neither says what choosing one
changes, which is what makes the instruction actionable.

The term also drifts: chapter 06 says "compilation backend", chapters 08 and 12 say
"scripting backend". Unity's own name is the second.

## Options

1. **Leave it.** The entry explains Mono against IL2CPP, and why ahead-of-time compilation
   is what breaks reflection and dynamic types.
2. **Name the two backends in chapter 06.** "Compilation backend, since a player build
   normally uses IL2CPP rather than the Editor's Mono" makes the following sentence about
   reflection follow from something.
3. **Move the IL2CPP paragraph from chapter 12 to chapter 08**, where the debugging
   scenario needs it, and leave chapter 12 with the integration-specific parts. Chapter 12
   is about mobile constraints, and the backend is not only a mobile concern.

Worth fixing regardless of which option wins: make chapter 06 say "scripting backend", so
all three places use Unity's term.

## Recommendation (second read, 2026-09-22)

Option 2 and the terminology fix now, together: at chapter 06 line 294,
“[[scripting backend]], since a player build normally uses IL2CPP rather than the Editor's
Mono”, which also replaces “compilation backend”. Take option 3 in the same pass as
[development-build-and-stripping.md](development-build-and-stripping.md): chapter 08's
table is where the reader first acts on the backend, and the same table is wrong about
what a development build rules out. Whichever chapter ends up holding the IL2CPP
paragraph, point the entry at it.
