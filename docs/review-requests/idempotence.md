# Review request: idempotence

- **First used:** `content/unity-engineering/01-architecture.md:106` and `:111`, **inside a question block** in section `architecture-requirements`
- **Used again:** `content/unity-engineering/02-power-up-design.md:246`, **in a section heading**: "Make collection idempotent and independent of animation"
- **Explained in:** `content/unity-engineering/03-missions-and-rewards.md:151`, section `missions-reward-claim`
- **Now covered by:** the `idempotence` entry, linked at the chapter 03 mention

## Why this one cannot be fixed by linking

This is the only request in the folder where the glossary could not do the whole job, and
it is worth stating why.

The first appearance is a correct answer and its explanation in a chapter 01 question:

> Collection is idempotent for that coin's identity within the run.
>
> Idempotent collection means repeating the same logical operation has no additional
> reward effect.

Question blocks are progress: their ids, prompts, options and explanations are load
bearing for the reader's review history, so nothing in them can be edited. The second
appearance is a `##` heading, and a heading cannot carry a `[[...]]` link.

The result is that a reader meets the word twice, once as an answer they are expected to
recognise, before chapter 03 defines it. The entry exists and is linked from chapter 03,
so the term is reachable from the glossary page, but nothing in chapters 01 or 02 points
at it.

## Options

1. **Add the word to chapter 02's prose and link it there.** The section explains the
   behaviour thoroughly without ever using the word its own heading uses: it says a
   duplicate request returns an "already collected" result, and calls it duplicate
   protection. One sentence naming the property, with a link, would close the gap at the
   place the heading already promises it.
2. **Move the definition to chapter 01 or 02.** Chapter 03's sentence is one line and does
   not depend on its surroundings, so it could be stated where the word first appears and
   referred back to in chapter 03.
3. **Leave it.** The word is arguably standard vocabulary, and the chapter 01 explanation
   defines it in passing while answering the question.

Option 1 is the one this request was written for. It is the only change that reaches the
reader at the point of confusion without touching a question block.

## Recommendation (second read, 2026-09-22)

Option 1, as this request argues. In `powerup-collection`, after the sentence about the
duplicate request's result, a sentence such as

> The operation is then [[idempotence|idempotent]]: repeating the same logical request has
> no further effect.

names the property the heading promises, where the behavior is described, and gives
chapter 02 its first link to the entry. Chapter 03's definition then reads as a reminder.
The section's own question already uses the word (“Idempotency is defined by logical
identity.”, 02:308), so the prose would be catching up with the question.
