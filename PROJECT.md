# Project: Interactive Study Textbook

## Purpose

A personal, local-only website for studying. It works like an interactive textbook: you read a short portion of content, then answer questions about it before moving on.

There is one user (me). There are no accounts, no sharing, and no hosting. The constraints in [CLAUDE.md](CLAUDE.md) apply to everything here.

## Core idea

Study material is split into small portions. Each portion is followed by questions that check whether it was understood.

```
Book
└── Chapter
    └── Section
        ├── Content (the text to read)
        └── Concepts (what the section tests)
            └── Variants (different questions that test the same concept)
                └── Option pool (more options than are shown at once)
```

- **Book**: one subject, such as "System Design Interviews". The site can hold several books.
- **Chapter**: a topic within the book.
- **Section**: the unit of study, sized to read in a few minutes. It has one block of content and one or more concepts.
- **Concept**: one thing being tested, such as "which entry LRU evicts". Progress and review are tracked per concept, not per question.
- **Variant**: one question that tests a concept. A concept can have one variant or several.
- **Option pool**: a variant can list more correct and wrong options than are displayed. Each time it appears, a different sample is drawn.

## Content

The first version is a textbook: mostly text, with:

- **Code blocks** with syntax highlighting.
- **Math**, inline and display, written in LaTeX syntax.
- **Images**, stored as local files next to the content.

## Content source

All study material comes from plain files in the repo. The site reads them; it does not have its own editor.

- One book can be written as a single file or split across several files (for example, one file per chapter).
- Files are human-editable and cheap for an LLM to generate: the format must use as few tokens as possible.
- Adding or editing a file, then rebuilding, is all it takes to change what the site shows.
- A malformed file produces a clear error naming the file, the line and the problem.

### File format

Markdown with a compact question syntax. Markdown carries the prose, code and math with almost no overhead, and the question syntax avoids the quotes, braces and repeated keys of JSON or YAML.

````markdown
---
book: System Design
chapter: Caching
---

## Cache eviction {#cache-eviction}

Content in plain Markdown. Inline math $O(1)$, display math:

$$ hit\ rate = \frac{hits}{hits + misses} $$

```python
cache = LRUCache(capacity=100)
```

![LRU diagram](images/lru.png)

?? lru-evict Which entry does an LRU cache evict first?
* The least recently used entry
* The entry that has gone longest without being read
- The most recently used entry
- The largest entry
- The oldest inserted entry
- A random entry
> LRU tracks access order and removes the entry that has gone longest without being read.

?+ Keys A, B and C are inserted in that order, then A is read. Which key does LRU evict next?
* B
- A
- C
> After A is read, B is the least recently used key.

?? lru-cost [tf] LRU lookups are O(n).
* false
> With a hash map plus a doubly linked list, both lookup and eviction are O(1).

?? fifo-name [short] Name the eviction policy that removes the oldest inserted entry.
= FIFO | first in first out
> FIFO ignores access; it evicts by insertion order.
````

- `## Title {#id}` starts a section. `{#id}` is a stable ID.
- `?? <concept-id> [type] <text>` starts a concept and its first variant. With no type it is multiple choice.
- `?+ [type] <text>` adds another variant to the concept above it. Variants can use different types.
- `*` is a correct option, `-` a wrong one.
- `= a | b` lists accepted short answers.
- `>` is the explanation for that variant.
- `[[strategy]]` links to a glossary entry, and `[[#section-id]]` to another section. Both show a preview card on hover.
- Optional settings go in the brackets: `[n=5]` shows five options instead of the default four; `[multi]` makes it multiple select.

Concept IDs must be stable, so that editing a file does not wipe the progress of unrelated concepts. Variants are identified by their position under the concept; reordering them only affects which variant is picked next, not the concept's progress.

## Questions

Multiple choice is the main question type. The others exist but should be used less.

- **Multiple choice**: shows one correct option drawn from the `*` options, plus wrong options drawn from the `-` options, up to the option count (default 4). Order is shuffled.
- **Multiple select** (`[multi]`): shows every `*` option plus wrong options up to the option count. Correct only if exactly the right set is chosen.
- **True / false** (`[tf]`).
- **Short answer** (`[short]`): checked automatically against the accepted answers (case and whitespace ignored). If the check says wrong, you can still mark yourself correct after seeing the expected answer.

Because the options are sampled, the same variant can appear several times with different options and different correct wording. A variant with a small pool simply repeats the same options in a new order.

Each variant has an **explanation**. It is shown automatically when the answer is wrong, and can be revealed on request when it is right.

## Study flow

1. Pick a book, then a chapter.
2. Read the section's content.
3. Answer one variant of each concept in the section. Feedback, and the explanation on a wrong answer, appears after each one.
4. See the section result, then continue.

**Unlocking:** a section unlocks once every concept in the previous section has been answered. Wrong answers do not block progress; the concept goes to the review queue instead.

You can go back and reread the content while answering, and revisit any unlocked section.

## Glossary and previews

The book teaches what its sections cover, but it also uses terms it never stops to define, and it refers to sections you may not have read. Looking one of those up should not mean leaving the site, and it should not mean reading a whole section you did not need.

A **glossary** holds those terms. An entry is a term, any other names for it, a one-paragraph summary, and a longer explanation when the term needs one. Entries live in the content files and belong to one book, but they sit outside the reading order: nothing unlocks them, and no question tests them. A term is explained once, where it can be looked up, instead of being worked into the prose of every section that uses it.

Two link forms reach that material from anywhere in the book:

- `[[strategy]]` links to a glossary entry.
- `[[#oop-composition]]` links to another section of the same book.

Both are written by hand, so a link is always one the author meant, and both render as a marked link in the text.

**Hovering** a link shows a preview card beside it: the term and its summary, or the section's title and its first paragraph. **Clicking** it opens the entry page or the section. Focusing the link with the keyboard shows the same card, Escape closes it, and Enter follows the link. A touch screen has no hover, so a tap follows the link.

The preview of a section that is still locked says so, and says what unlocks it, instead of showing its first paragraph. Clicking it lands on the locked notice the section page already shows. Unlocking is otherwise unchanged.

Each book has a glossary page listing its terms, and every entry has a page of its own. An entry's page also lists the sections that link to it, so a term leads back into the book.

### Glossary format

A glossary file is a content file whose front matter says `kind: glossary`. Each entry is a `##` heading with a stable id, then optional `=` lines naming its other names and `->` lines pointing at related entries, then a summary paragraph and an optional body.

````markdown
---
book: Unity Game Engineering
kind: glossary
---

## Strategy {#strategy}
= strategy pattern | strategies
-> state-pattern | composition

An object holding one interchangeable policy behind a small interface, so a caller can swap the rule without knowing which one it has.

The paragraphs, code and tables after the summary are the rest of the entry. They appear on its page and never in the preview card.
````

The first paragraph is the summary, and it is what a preview card shows, so it stays short. Everything after it is the body. An entry id must be stable for the links that point at it, but no progress is stored against it, so renaming one costs nothing but the links.

## Spaced repetition

Review works on **concepts**. Getting a concept right through any variant counts, so the question you got wrong does not have to come back.

Scheduling uses Leitner boxes:

- A wrong answer puts the concept in box 1.
- A correct review moves it up one box; a wrong review sends it back to box 1.
- Boxes 1–5 are due after 1, 3, 7, 14 and 30 days. Passing box 5 removes the concept from the queue.

When a concept is due, the site picks which variant to show:

1. A variant never shown before.
2. Otherwise, the variant shown longest ago, excluding the one that was just answered wrong.
3. If the concept has only one variant, it is shown again with a fresh sample of options.

A **Review** page shows the concepts due today, across all books, and the home page shows the count.

## Progress

Progress is stored in the browser (IndexedDB) and never leaves the machine.

- Sections read and unlock state.
- Per concept: Leitner box, due date, and history.
- Per variant: when it was last shown and whether it was answered right.
- Reset progress per book.
- Export and import progress as a local JSON file, for backup.

Browsers tie stored data to the page's location. If the built `index.html` is moved or renamed, progress will not follow it; export and import cover that case.

## Stack

- **TypeScript** throughout.
- **React**, built with **Vite**.
- **Content pipeline at build time:** a Vite plugin parses the Markdown files, validates the question syntax, and renders the Markdown to HTML. Code highlighting uses **Shiki** and math uses **KaTeX**, both at build time, so the browser receives finished HTML and ships no parser.
- **Single-file output:** `vite-plugin-singlefile` inlines all JavaScript, CSS, KaTeX fonts and images into one `dist/index.html`.

Why this setup: browsers refuse to load ES modules or read other local files from a page opened as `file://`. A single self-contained HTML file avoids both problems, so the site opens by double-clicking with no server running. Vite and React keep the full power of a modern toolchain for development.

How it is used:

- `npm run dev`: local dev server with hot reload, for building the site and writing content.
- `npm run build`: produces `dist/index.html`, which is opened by double-click.

Libraries come from npm and are bundled into the output, so nothing is fetched at runtime. Rebuilding requires `node_modules`, which stays out of git.

## Future: LLM integration

Later, the site may connect to LLM services (Claude, ChatGPT, Gemini), for example to grade short answers or explain a wrong answer in more depth. This is out of scope for now. When it is built:

- It must be opt-in and off by default, with the user supplying their own API key.
- The site must stay fully usable offline without it.
- It is an exception to the "no remote APIs" rule in [CLAUDE.md](CLAUDE.md), which must be updated to allow it at that point.

## Non-goals

- No hosting, deployment, accounts, or sync between devices.
- No in-browser content editor.
- No LLM or remote API calls in the first version.
- No glossary shared between books: a glossary belongs to one book, and a term used by two books is written twice.
- No automatic linking: prose becomes a link only where a `[[...]]` was written.
- No preview inside a preview: a link in a card navigates instead of opening another card.
