# Implementation plan

[PROJECT.md](../PROJECT.md) says what to build. This file says how. Separate sessions build it in phases, and this file keeps their work consistent. If this file conflicts with PROJECT.md or with the code, stop and ask; don't improvise.

## How to run a phase

1. Read [CLAUDE.md](../CLAUDE.md), [PROJECT.md](../PROJECT.md) and this file. **Decisions** and your phase's section are binding.
2. Build only your phase. Don't start work from later phases.
3. Work inline; don't spawn subagents.
4. Before finishing, run every command in your phase's **Done when** and confirm it passes. If something fails and you can't fix it, report the output; don't hide it.
5. Append an entry to the **Phase log** at the end of this file, in 10 lines or fewer: what was built, any deviation from this plan and why, and what the next phase needs to know.
6. Commit on `main` with a clear message.

## Layout

```
content/                study material: *.md files and their images, any subfolders
docs/                   PLAN.md, content-format.md
pipeline/               build-time Node code; never imported by src/
  parse.ts              file text → raw model (Markdown strings + line numbers) and errors
  render.ts             Markdown → HTML (unified, KaTeX, Shiki, images inlined)
  load.ts               find, parse, render and assemble all books; collect every error
  vite-plugin.ts        serves virtual:content
  check.ts              CLI behind `npm run check`
src/                    browser app
  types/content.ts      content types; pipeline/ imports them with `import type`
  engine/               pure logic: no React, no IndexedDB, no Date.now()/Math.random() (inject them)
  storage/              IndexedDB, export/import, ProgressProvider
  pages/  components/
  router.ts             hash router
  styles.css
scripts/verify-dist.mjs
```

Tests are `*.test.ts` files next to the code they test, and Vitest runs them.

## Decisions

### Tooling

- Vite, React and TypeScript in strict mode, at their latest stable versions.
- `vite-plugin-singlefile`, so `npm run build` outputs only `dist/index.html`.
- Hash routing (`#/...`) through a small hand-written router in `src/router.ts`. Don't add react-router.
- No CSS framework, UI kit or web fonts. Use one `styles.css` with CSS custom properties, with light and dark themes switched by `prefers-color-scheme`.
- Runtime dependencies: `react`, `react-dom`, `idb`, and `katex` for its CSS and fonts only. Everything else is a devDependency: `unified`, `remark-parse`, `remark-gfm`, `remark-math`, `remark-rehype`, `rehype-katex`, `shiki` (or `@shikijs/rehype`), `rehype-stringify`, `tsx`, `vitest`, `fake-indexeddb`.
- `tsconfig.app.json` covers `src/`. `tsconfig.node.json` covers `vite.config.ts`, `pipeline/` and `scripts/`.
- npm scripts:
  - `dev`: `vite`
  - `build`: `tsc -b && vite build && node scripts/verify-dist.mjs`
  - `preview`: `vite preview`
  - `test`: `vitest run`
  - `typecheck`: `tsc -b`
  - `check`: `tsx pipeline/check.ts` (added in Phase 2)

### Content files

This section extends "File format" in PROJECT.md. Anything PROJECT.md doesn't allow is an error.

**Files.** Every `.md` file under `content/` is a content file. Files are processed in path order (a plain string sort of the relative path), so use prefixes such as `01-caching.md` to set the order.

**Front matter.** It is required. The first line of the file is `---`, then `key: value` lines, then `---`. The keys are `book`, which is required, and `chapter`, which is optional. An unknown key is an error. Don't use a YAML library; parse the lines by hand.

**Chapters.** A `# Title` line starts a chapter, so one file can hold several chapters. If the front matter has `chapter:`, the file starts inside that chapter. A section that appears before any chapter is an error. Two chapters with the same title in the same book are an error, even when they are in different files. Chapter order is the order of first appearance across files.

**Sections.** `## Title {#id}` starts a section. A section heading with a missing or invalid id is an error, and the message shows the correct form. Ids and concept ids match `[a-z0-9]+(-[a-z0-9]+)*`. Section ids and concept ids must each be unique within a book. A duplicate is an error that names both locations. Headings `###` and deeper are ordinary content. Only blank lines may appear between a `# Chapter` line and its first section.

**Content block.** A section's content runs from its heading to its first `??` line and must not be empty. A section needs at least one concept.

**Fences.** Lines inside a fenced code block are never read as structure. A fence opens with 3 or more backticks or 3 or more tildes and closes with the same character, at least as many times. An unclosed fence is an error reported at its opening line.

**Question block.** From the first `??` to the end of the section, only these lines and blank lines are allowed. Any other line is an error that lists the valid markers.

- `?? <concept-id> [settings] <prompt>` starts a concept and its first variant.
- `?+ [settings] <prompt>` adds a variant to the concept above. A `?+` with no `??` before it in the section is an error.
- A fenced code block directly after a `??` or `?+` line is part of that prompt. This is an extension to PROJECT.md, so that questions can show code.
- `* text` is a correct option and `- text` is a wrong one.
- `= a | b` lists accepted short answers. A variant can have several `=` lines. Alternatives are split on `|` and trimmed, and empty ones are dropped.
- `> text` is the explanation. Consecutive `>` lines are joined with newlines and rendered as block Markdown. A bare `>` line is a paragraph break.

**Settings.** A `[` directly after the concept id (for `??`) or after `?+` always starts settings. The tokens inside are separated by spaces or commas:

- `multi`, `tf` and `short` set the type. Use at most one. With none, the type is `mc`.
- `n=<2..9>` sets the option count. It is only valid for `mc` and `multi`; the default is 4.
- An unknown token is an error.

**Validation per type.** Every variant must have a non-empty prompt and an explanation.

- `mc`: at least one `*` and at least one `-`, and no `=` lines.
- `multi`: at least one `*`, and no `=` lines.
- `tf`: exactly one `*` line, whose text is `true` or `false` in any case. No `-` or `=` lines.
- `short`: at least one accepted answer, and no `*` or `-` lines.

**Text.** Prompts, options and explanations accept Markdown, including inline code, math and emphasis. Accepted short answers are plain text. A literal dollar sign is written `\$`.

**Books.** A book's id is `slug(book title)`: NFKD, strip diacritics, lowercase, runs of non-alphanumerics become `-`, then trim the dashes. Two titles with the same slug are an error. Books are ordered by title. Renaming a book changes its id, so it loses its progress. `docs/content-format.md` must say so.

**Errors.** The format is `<path relative to repo>:<line>: <message>`. The pipeline collects every error from every file and reports them all together, then fails. Each message says what was expected.

### Content model

`src/types/content.ts`. Every string is HTML except `accepted`, which is plain text.

```ts
export interface Book { id: string; title: string; chapters: Chapter[] }
export interface Chapter { id: string; title: string; sections: Section[] }   // id = slug(title)
export interface Section { id: string; title: string; html: string; concepts: Concept[] }
export interface Concept { id: string; variants: Variant[] }
interface VariantBase { prompt: string; explanation: string }
export type Variant =
  | (VariantBase & { type: 'mc' | 'multi'; correct: string[]; wrong: string[]; n: number })
  | (VariantBase & { type: 'tf'; answer: boolean })
  | (VariantBase & { type: 'short'; accepted: string[] });
```

The parser produces the same shape, with Markdown instead of HTML and a source line on every section, prompt, option and explanation. That raw type lives in `pipeline/`.

### Rendering (build time)

- Build one unified processor and reuse it: `remark-parse` → `remark-gfm` → `remark-math` → image-inlining transform → `remark-rehype` → `rehype-katex` → Shiki → `rehype-stringify`.
- Section content, prompts and explanations are rendered as block Markdown. Options are rendered, then their single wrapping `<p>` is removed.
- Shiki uses the dual themes `github-light` and `github-dark`, switched by `prefers-color-scheme`. A fence with no language renders as plain `<pre><code>`. An unknown language is an error. Create the highlighter once.
- KaTeX errors become build errors at the source line. Never ship KaTeX's red error text.
- Images: a relative path is resolved from the Markdown file's folder and inlined as a base64 `data:` URI. Supported types are png, jpg/jpeg, gif, webp and svg. A missing file, or any `http(s):` URL, is an error.
- Line numbers: render each chunk (content, prompt, option, explanation) knowing its starting line in the source file, so that renderer errors report the real line.
- The app imports `katex/dist/katex.min.css`. A small Vite transform removes its `woff` and `ttf` sources and keeps `woff2`, so the fonts don't bloat `dist/index.html`.

### Question behaviour

- `mc`: one random `correct` plus `min(n−1, wrong.length)` random `wrong`, shuffled. It is single choice.
- `multi`: every `correct` plus `min(max(n − correct.length, 0), wrong.length)` random `wrong`, shuffled. The answer is correct only if the chosen set equals the correct set.
- `tf`: True and False buttons.
- `short`: normalize each string with NFKC, then lowercase it, then remove all whitespace. The answer is correct if the normalized input equals any normalized accepted answer. On a wrong answer, show the first accepted answer and the explanation, with two buttons: **I was right** (records correct) and **Continue** (records wrong). Record the answer when one of them is pressed.
- The other types record the answer on submit.
- After an answer: show right or wrong, and mark the correct options. Don't rely on colour alone; also use text or an icon. The explanation appears automatically on a wrong answer. On a right answer, a **Show explanation** button reveals it.
- Randomness comes from an injected `rng: () => number`.
- One `QuestionCard` component serves both study and review.

### Progress and scheduling

Records, stored per concept and per section:

```ts
interface ConceptRecord {
  key: string;                 // `${bookId}/${conceptId}`
  bookId: string; conceptId: string;
  box: 1 | 2 | 3 | 4 | 5 | null; // null = not in the review queue
  due: string | null;          // local date, YYYY-MM-DD
  history: { at: string; v: number; ok: boolean; mode: 'study' | 'review' }[]; // at = ISO timestamp, v = variant index
  variants: Record<number, { lastShownAt: string; lastOk: boolean }>;
}
interface SectionRecord {
  key: string;                 // `${bookId}/${sectionId}`
  bookId: string; sectionId: string;
  readAt: string | null; completedAt: string | null;
}
```

`applyAnswer(record | undefined, { v, ok, mode, now, today })` returns the new record. Study and review share it; `mode` is only recorded. `now` is the ISO timestamp stored in `history` and `lastShownAt`. `today` is the local date that every due-date calculation uses; the dev "Simulate today" override replaces it.

1. Append to `history` and update `variants[v]`.
2. A wrong answer sets box 1 and a due date of today + 1 day.
3. A right answer when `box !== null` and `due <= today` moves the concept up one box. The due date becomes today plus that box's interval: box 1 = 1 day, box 2 = 3, box 3 = 7, box 4 = 14, box 5 = 30. A right answer in box 5 removes the concept from the queue (`box` and `due` become null).
4. Any other right answer leaves `box` and `due` unchanged. A first correct answer never enters the queue, and practising early doesn't advance a box.

A concept is due when `box !== null && due <= today`. Every date is a local calendar date.

`pickVariant(concept, record)` chooses which variant to show:

1. The lowest-index variant never shown. Ignore stored indices that are `>=` the current variant count.
2. Otherwise, the variant with the oldest `lastShownAt`. If the last history entry was wrong, exclude its variant.
3. If the concept has one variant, show variant 0 with a fresh sample of options.

Sections:

- A section is **complete** when `completedAt` is set, or when every one of its concepts has at least one history entry. `recordAnswer` sets `completedAt` the first time that becomes true. Only a reset or an import clears it.
- A section is **unlocked** when any of these is true: it is the first section of its chapter; it has a `readAt`; or the previous section in the chapter is complete. Chapters are independent, so the first section of every chapter is open.
- Set `readAt` the first time an unlocked section is opened.

### Storage

- IndexedDB through `idb`. The database is `study`, version 1, with stores `concepts` and `sections`. Both use keyPath `key` and have an index on `bookId`.
- `ProgressProvider` loads every record into memory at startup and exposes them through React context. Every change updates memory and writes through to IndexedDB.
- If IndexedDB fails to open (some browsers block it for `file://` pages or in private mode), keep working in memory. Show a persistent banner saying progress won't be saved, and point to Export.
- Export produces `{ format: 'study-progress', version: 1, exportedAt, concepts, sections }` and downloads it as `study-progress-YYYY-MM-DD.json`, using a Blob and `<a download>`.
- Import: choose a file, validate its format, version and record shapes, ask for confirmation, then replace all progress. An invalid file shows an error and changes nothing.
- Reset book: ask for confirmation, then delete every record with that `bookId`.
- Keep records for concepts or sections that no longer exist in the content, but never show them or count them.
- Dev builds only (`import.meta.env.DEV`): a "Simulate today" date input on the Data page overrides today's date everywhere, so review scheduling can be tested by hand.

### UI

| Route | Page |
|---|---|
| `#/` | Home: the books, with sections completed out of the total; a "Review (N due)" link; a "Data" link. |
| `#/b/:book` | Book: its chapters, with progress for each. |
| `#/b/:book/:chapter` | Chapter: its sections, each marked locked, open or complete, with how many of its concepts are in review. |
| `#/b/:book/:chapter/:section` | Section: see below. |
| `#/review` | Review: see below. |
| `#/data` | Data: export, import, reset per book, and the dev date override. |
| anything else | Not found, with a link home. |

- **Section page.** Shows the content, then a **Start questions** button. Questions appear below the content one at a time ("Question 2 of 4"), and the content stays above them. A **Reread content** link scrolls up to it. Concepts come in file order. After the last question, show a result: x/y correct, which concepts went to review, **Next section** and **Back to chapter**. A locked section shows a notice instead. A section that is already complete can be practised again through the same flow.
- **Review page.** Covers the due concepts across all books, with the earliest due date first and ties broken in content order. Shows one question at a time, with a book › chapter › section breadcrumb that links to the section. Ends with a summary. When nothing is due, it shows an empty state.
- **Keyboard.** Keys 1–9 pick an option, and Enter submits or continues.
- **Look.** A readable textbook: body text around 70ch wide, system font stack, generous line height, restrained colour, light and dark themes, and usable at phone width with no horizontal scroll.

## Phases

### Phase 1: Scaffold and single-file build

Build:

- A Vite, React and TypeScript app with the scripts and tsconfig split from Tooling, minus `check`. Remove the template leftovers (logo, counter, `vite.svg` and the favicon link to it).
- `vite-plugin-singlefile`.
- Vitest, with one trivial test.
- `src/router.ts` and a placeholder page for every route in UI, so navigation works.
- `scripts/verify-dist.mjs` fails when:
  - `dist/` holds any file other than `index.html`;
  - after removing the bodies of inline `<script>` elements, the HTML still references a file or URL through `src=` or `href=` (a `data:` URI or a `#` anchor is fine);
  - any `url(` inside a `<style>` element is not a `data:` URI.

  Don't scan the text inside inlined JS; bundles contain harmless URL strings.
- Update CLAUDE.md: replace "Project status" with the stack, the commands, a short layout and a pointer to this plan.

Done when:

- `npm run build`, `npm test` and `npm run typecheck` pass, and `dist/` contains only `index.html`.
- `npm run dev` serves the placeholder pages.

Manual check (user): double-click `dist/index.html`. The placeholders load from `file://`, and the links between them work.

### Phase 2: Content parser

Build:

- `src/types/content.ts`, following Content model.
- `pipeline/parse.ts`: a line-based parser implementing Content files. It outputs the raw model (Markdown strings and line numbers) and a list of errors. It doesn't render anything; that's Phase 3.
- `pipeline/load.ts`: finds the files, parses them, and assembles books across files. This covers book ids and order, chapter duplicates, section and concept uniqueness within a book, and collecting every error.
- `pipeline/check.ts` and `npm run check`. On errors, it prints each one and exits with status 1. Otherwise it prints totals: books, chapters, sections, concepts and variants.
- Tests:
  - the PROJECT.md example parses to the expected structure;
  - one test per error rule, asserting the file and line;
  - fences that contain `#`, `##`, `??`, `*` and `-` lines are treated as content;
  - several chapters in one file, and one book split across files.
- `docs/content-format.md`: a compact, complete reference for writing content files, aimed at an LLM that generates books. It covers the rules, one full example and the common mistakes, in about 150 lines or fewer.

Done when:

- `npm test` and `npm run typecheck` pass.
- `npm run check` on a deliberately broken temporary file prints `file:line: message`. Delete the file afterwards.

### Phase 3: Rendering and Vite plugin

Build:

- `pipeline/render.ts`, following Rendering. `load.ts` now renders everything and returns `Book[]` of HTML plus the errors.
- `pipeline/vite-plugin.ts` serves the virtual module `virtual:content`, which exports `books: Book[]`. Its type declaration goes in `src/types/`.
  - In dev: watch `content/`. When a `.md` or image file changes, is added or is removed, invalidate the module and do a full reload. Errors appear in Vite's overlay.
  - In build: errors fail the build, and all of them are listed.
- `npm run check` runs the full parse-and-render pipeline.
- KaTeX CSS trimmed to `woff2`, and the Shiki dual-theme CSS.
- A sample book in `content/sample/`: two files, two chapters and four or five sections. It exercises code in two languages, inline and display math, an SVG image (next to the Markdown, in `images/`), all four question types, concepts with several variants, `[n=5]`, `[multi]`, and a prompt with a code block.
- Temporary: the placeholder pages list the books, chapters and sections from `virtual:content`, and the section placeholder renders `section.html`. Phase 5 replaces this.
- Tests: math, code highlighting and image inlining render; bad LaTeX, an unknown language and a missing image each report the right `file:line`.

Done when:

- `npm test`, `npm run typecheck`, `npm run check` and `npm run build` (including verify-dist) pass.
- In `npm run dev`, editing a content file reloads the page, and breaking one shows the overlay with `file:line`.

Manual check (user): with Wi-Fi off, double-click `dist/index.html`. Sample sections show highlighted code, typeset math and the image.

### Phase 4: Engine and storage

Build:

- `src/engine/`:
  - option sampling (`mc`, `multi`);
  - grading for every type, including short-answer normalization;
  - local-date helpers (today, addDays, compare);
  - `applyAnswer`, `isDue` and `pickVariant`;
  - section completion and unlocking;
  - the due list across books (from books, records and today).
- `src/storage/`:
  - the IndexedDB layer, with the in-memory fallback;
  - export and import, with validation;
  - reset book;
  - `ProgressProvider` and hooks exposing the records and the actions `recordAnswer`, `markRead`, `exportProgress`, `importProgress`, `resetBook` and the dev `setToday`. `recordAnswer` sets `completedAt` when due.
- Wire the provider into `App`. There's no other UI work in this phase.
- Tests are the deliverable here. The engine tests cover every rule in Question behaviour and Progress and scheduling, including graduating from box 5, an early correct review not advancing, the variant pick order, stale variant indices, and unlock state surviving a content edit. The storage tests use `fake-indexeddb`: a round trip, export then import, reset touching only one book, and an invalid import being rejected with nothing changed.

Done when: `npm test`, `npm run typecheck` and `npm run build` pass.

### Phase 5: Study UI

Build:

- Home, Book, Chapter and Section pages, and `QuestionCard`, following UI and Question behaviour. They are wired to `virtual:content` and `ProgressProvider`.
- `styles.css`, replacing the Phase 3 debug placeholders.
- The keyboard shortcuts.
- In-page links in rendered HTML (footnotes, `[x](#id)`). A click on an `href` that starts with `#` but not `#/` scrolls to the target element and never changes the route. Intercept these with one delegated click handler on the rendered-HTML containers.

Done when: `npm test`, `npm run typecheck` and `npm run build` pass.

Manual check (user), using the sample book in `npm run dev`:

1. Only the first section of each chapter is open.
2. Each question type works.
3. A wrong answer shows the explanation.
4. A wrong short answer offers **I was right**.
5. Finishing a section unlocks the next one.
6. Reloading the page keeps progress.
7. **Reread content** works mid-questions.
8. The layout works at phone width and in dark mode.

### Phase 6: Review, data page and finish

Build:

- The Review page and the due count on Home.
- The Data page: export, import and reset per book, plus the dev "Simulate today" input.
- The banner shown when IndexedDB is unavailable.
- If opening IndexedDB hasn't settled after 3 seconds, fall back to memory and show that banner. While it is opening, show a short loading state rather than a blank page.
- Refresh `today` when the page becomes visible again (`visibilitychange`), so a tab left open overnight shows the right due count.
- The Not-found page.
- A final pass on the styles.
- A short `README.md` covering how to build, how to open the site, how to add content (pointing to `docs/content-format.md`) and how to back up progress.
- Update CLAUDE.md so it matches the finished project.

Done when: `npm test`, `npm run typecheck`, `npm run check` and `npm run build` pass.

Manual check (user):

1. Answer something wrong. Simulate tomorrow; it appears in Review, and Home shows the count.
2. A correct review moves it to the next box. Simulate later dates through box 5; it leaves the queue.
3. Export, reset the book, then import. Progress comes back.
4. With Wi-Fi off, `dist/index.html` from `file://` works in Firefox (the user's browser), and DevTools' Network tab shows no requests. The Storage tab lists a `study` IndexedDB database that survives a reload. If Firefox blocks IndexedDB on `file://`, the banner appears.

## Feature: glossary and previews

[PROJECT.md](../PROJECT.md) says what this is; this section says how. It continues the numbering: Phases 7 to 10 build it, under the same rules as **How to run a phase** at the top of this file. Everything in **Decisions** still holds, and what follows adds to it.

Two things it does not change. **Storage is untouched:** glossary entries carry no progress, so `src/storage/`, the IndexedDB schema and an existing export all stay as they are. **`verify-dist.mjs` is untouched:** the glossary is inlined content like the rest, and none of it is dev-only.

### Decisions: glossary files

**Front matter.** A third optional key, `kind`. Its only value is `glossary`; anything else is an error. A file with `kind: glossary` holds entries and nothing else, so `chapter:` beside it is an error, and so is a `#` chapter line, a `##` heading with no `{#id}`, or a `??` or `?+` marker inside it. `book:` is still required: a glossary belongs to one book, and several glossary files in a book merge the way chapters do.

**Entries.** `## Term {#entry-id}` starts an entry. The id matches `ID_PATTERN`, as section and concept ids do. The heading text is the term, shown as written.

**Header lines.** Directly under the heading, before any content, an entry may have:

- `= other name | another name` gives the term more names. Split on `|`, trimmed, empties dropped, as accepted answers are. Several `=` lines are allowed.
- `-> entry-id | another-id` lists related entries, shown as "See also". Several `->` lines are allowed. Each target is an entry id in this book's glossary; an unknown one, or the entry itself, is an error.

Both are read only directly after the heading. Once a content line has appeared, a line starting with `=` or `->` is ordinary Markdown.

**Summary and body.** After the header lines, the first paragraph, meaning the run of non-blank lines up to the first blank line, is the **summary**. Everything after it is the **body**, which may be empty. The summary has to be a paragraph, so a first content line that opens a fence, a list, a table, a blockquote or a heading is an error that says to put it in the body. Its Markdown source is limited to 400 characters, because a preview card shows it whole; over that is an error giving the count.

**Uniqueness.** Within a book, every entry id and every other name, slugged, is one name in one namespace, so two entries cannot claim the same word. A collision is an error naming both places. Glossary ids and section ids are separate namespaces, so a section and an entry may share an id.

**Order.** The glossary page lists entries by term with `localeCompare(..., 'en')`, as books already are. File order decides nothing.

### Decisions: cross-reference links

**Syntax.** `[[target]]` and `[[target|text]]`, anywhere Markdown is rendered: section content, prompts, options, explanations, and glossary summaries and bodies.

- A target starting with `#` is a **section of the same book**, named by its `{#id}`.
- Any other target is a **glossary entry**, matched by `slug(target)` against entry ids and other names.
- The text shown is what is written before the `|`. A section target with no `|` shows the section's title instead, since `#oop-composition` is not a phrase. So `[[Strategy]]` reads "Strategy", `[[strategies|strategy objects]]` reads "strategy objects", and `[[#oop-composition]]` reads the section's title.

**Errors**, each at the line the link is on: an empty target; `[[` with no `]]` on the same line; an unknown term, naming the target and suggesting an entry when exactly one id or other name contains it; an unknown section id; a link to the entry or section it is written in. To show a literal `[[`, put it in a code span or a fence, where nothing is read as a link.

**Resolution happens while rendering**, because a target is usually defined in another file. `renderBooks` already walks one book at a time: build that book's name-to-entry map and its section index (id to chapter id, title) first, then render its chapters and its glossary with both in the render context.

**Output** is one `<a>` carrying the route, so the hash router, the keyboard, the back button and a middle click all work with no extra code:

```html
<a class="ref ref-term" href="#/g/unity-engineering/strategy">Strategy</a>
<a class="ref ref-section" href="#/b/unity-engineering/05-oop-principles-and-patterns-with-tradeoffs/oop-composition">Interfaces, inheritance, and composition</a>
```

The browser reads the target back out of the href with `parseRoute`, so nothing is copied into data attributes.

**Backlinks.** While rendering, each resolved term link records the chapter and section it sits in. `renderBooks` collects them per entry, deduplicated, in content order. A term link written inside a glossary entry records nothing: `->` is what relates entries to each other.

### Decisions: content model

`src/types/content.ts` gains one array on `Book` and one type. Every string is HTML except `term` and `names`.

```ts
export interface Book { id: string; title: string; chapters: Chapter[]; glossary: GlossaryEntry[] }

export interface GlossaryEntry {
  id: string
  term: string    // plain text, the heading
  names: string[] // plain text, the `=` lines
  summary: string // HTML, one paragraph
  html: string    // HTML, the body; '' when the entry is only a summary
  see: string[]   // entry ids, the `->` lines
  uses: { chapter: string; section: string }[] // the sections that link here
}
```

`Section` does not change. A section card's lead is taken from the first `<p>` of `section.html` in the browser (`sectionLead`, below), so no prose is stored twice and `dist/index.html` grows only by the glossary itself.

The raw model in `pipeline/parse.ts` mirrors this with `{ md, line }` chunks, as the rest of it does: `parseContentFile` returns entries on `RawFile`, and `assembleBooks` merges them into the `RawBook` and checks uniqueness.

`npm run check` prints two more totals, `terms` and `links`, and after them a line naming any entry nothing links to. That is a note, not an error: an entry can be worth having and only ever reached from the glossary page.

### Decisions: routes and pages

| Route | Page |
|---|---|
| `#/g/:book` | Glossary: every term in the book |
| `#/g/:book/:term` | One entry |

A top-level `#/g/...` leaves the book's own routes alone, so no chapter slug has to become a reserved word.

- **Glossary page.** Breadcrumb Home > Book. The term count, a filter box matching the term and its other names by case-insensitive substring, and the list: each term, its other names and its summary. The filter is page state and is not stored.
- **Entry page.** Breadcrumb Home > Book > Glossary. The term as `h1`, "Also called ..." when it has other names, the summary, the body, "See also", and **Where this appears**: the sections that link to the entry, labelled chapter > section. A locked section there is plain text with the note the chapter page already uses, so the list never offers a link into a locked page.
- **Book page** gains a "Glossary (N terms)" link. A book with no entries shows nothing new.
- An unknown book or term falls through to the existing Not-found page.

### Decisions: preview cards

- One card at a time, rendered with `createPortal` into `document.body` by a provider inside `App`, positioned `absolute` in page coordinates so it travels with the page and needs no scroll listener.
- `Html` gains the delegated handlers that open and close it, so every block of rendered content gets previews from one place: section content, prompts, options, explanations, and the card's own content.
- **Hover** opens after 300 ms and closes 200 ms after the pointer has left both the link and the card, so the pointer can travel into the card. **Focus** opens at once. **Escape** closes, and so does a route change. `(hover: hover)` gates the hover half, so a touch screen only follows the tap.
- **A link inside a card never opens a second card.** It navigates on click like any other link.
- A **term card** shows the term and its summary. A **section card** shows the chapter and section titles and the section's lead, or, when that section is locked, the sentence the section page shows, naming what unlocks it.
- The card is `aria-hidden` and the link gets no `aria-describedby`. Everything in a card is one Enter away on a page of its own, and a preview that narrated itself would read the same text twice.
- At most `min(22rem, 100vw - 2rem)` wide, with the body capped in height and faded at the bottom, so a long section lead cannot fill the screen.

Three pure modules carry the logic that can be tested the way the rest of the code is:

- `previewTarget(href, books)`: an href to what a card would show, or nothing. Built on `parseRoute`.
- `placePreview(anchor, card, viewport, gap)`: page coordinates and which side, preferring below the link, flipping above when there is more room there, clamped into the viewport.
- `sectionLead(html)`: the first `<p>...</p>` of a section's HTML, anchored at the start, or `''`. That HTML comes from the pipeline and a `<p>` never nests, so this needs no parser.

The timers and the measure-then-place pass stay in the component, and the manual checks cover them.

### Decisions: styles

`.ref` is an accent-coloured link with a dotted underline, so a link that previews reads differently from a plain link without a second colour. `.preview-card` uses the existing `--surface`, `--border` and `--muted`, takes a small shadow, and fades in only under `prefers-reduced-motion: no-preference`. Both themes come from the variables already in `styles.css`.

### Phase 7: Glossary format and pipeline

Build:

- `pipeline/parse.ts`: the `kind` front-matter key, glossary files, entries, header lines, the summary and body split, and every error above.
- `pipeline/load.ts`: entries merged into the book, the id and name namespace check, and `summarize` counting terms.
- `pipeline/render.ts`: `[[...]]` as a remark transformer, after `remarkInlineImages` and before `remark-rehype`. It visits `text` nodes only, which is what keeps code spans, fences and math out of it: the parser has already made those `inlineCode`, `code` and `inlineMath` nodes, whatever order the transformers run in. It resolves from the render context and records backlinks through a sink on the chunk context, like the image plugin's.
- `src/types/content.ts` per Content model above, and `glossary: []` in `src/test-helpers.ts`'s `book()`.
- `pipeline/check.ts`: the `terms` and `links` totals and the unlinked-entry note.
- `docs/content-format.md`: the glossary file, both link forms, the rules and the new common mistakes.
- Tests in the style of the existing ones: one per error rule, asserting file and line; resolution by id, by other name and by section id; the display-text defaults; `[[x]]` inside a fence and a code span staying literal; backlinks deduplicated and in content order; one glossary split across two files; a link in a prompt, an option and an explanation.

Done when: `npm test`, `npm run typecheck`, `npm run check` and `npm run build` pass, with two or three real entries and a handful of links added to the Unity book to exercise it. Keep them; Phase 10 extends them.

Note for whoever runs it: nothing renders the glossary yet, and a term link goes to Not found until Phase 8 adds the route. That is expected. Do not add the pages early.

### Phase 8: Glossary pages and links

Build:

- `#/g/:book` and `#/g/:book/:term` in `src/router.ts`, with tests beside the existing route tests.
- `src/pages/Glossary.tsx` and `src/pages/GlossaryEntry.tsx` per Routes and pages, wired into `App`.
- The "Glossary (N terms)" link on the Book page.
- Styles for `.ref` and for both pages.

Done when: `npm test`, `npm run typecheck` and `npm run build` pass.

Manual check (user), in `npm run dev`:

1. A term link in chapter 05 opens its entry, and the browser's back button returns to the same place in the section.
2. The entry lists the sections that link to it, and a locked one is not a link.
3. The filter on the glossary page finds a term by one of its other names.
4. A `[[#id]]` link opens the right section.
5. Phone width and dark mode have no horizontal scroll.

### Phase 9: Preview cards

Build the provider, the card, the `Html` handlers, the three pure modules with their tests, and the styles, per Preview cards above.

Done when: `npm test`, `npm run typecheck` and `npm run build` pass.

Manual check (user), in Firefox, on `npm run dev` and on `dist/index.html` from `file://` with the network off:

1. Hovering a term shows the card after a beat; moving the pointer into the card keeps it open; leaving closes it.
2. Tab to a link shows the card, Escape closes it, and Enter opens the page.
3. A card near the bottom of the window flips above the link, and one near the right edge stays on screen.
4. A link to a locked section previews the locked notice, not the text.
5. A link inside a card opens no second card.
6. Phone width and dark mode work, and a tap on a phone-sized touch screen simply follows the link.

### Phase 10: First glossary batch for the Unity book

Write `content/unity-engineering/glossary.md`, and link first mentions, starting where the problem was found: the pattern table in chapter 05, where a reader who does not know Strategy has nowhere to go.

The first batch is the terms the book already uses as though they were known. A survey of the current text puts it at, at least: Strategy, State, Observer, Command, Factory, Adapter, Decorator, object pool, singleton, service locator, composition root, dependency injection, substitutability, cohesion and coupling, assembly definition, coroutine, Burst, the Job System, Addressables, ScriptableObject, IL2CPP, draw call, the SRP batcher, idempotence, and feature flag. Several appear in four or more chapters, so one entry pays for itself many times over.

Rules for the pass:

- **Prose only. Never touch a question block.** Concept ids and option text are progress, and editing them loses it.
- The book's prose style applies to entries too: no em dashes, no contractions, curly quotes, and the plain voice the chapters use.
- Link the first mention in a section, not every mention, and never inside a heading or a code span.
- Where the book already explains a term properly, write a `[[#section-id]]` link to that section instead of an entry repeating it.
- Work chapter by chapter, run `npm run check` after each, and commit per chapter.

Done when: `npm run check`, `npm test` and `npm run build` pass, and every pattern named in chapter 05's table previews.

After this, the glossary grows as reading finds gaps: an entry and its links are a two-line change, and `npm run check` catches a link to a term that does not exist yet.

## Feature: second-read editing pass

`docs/review-requests/` holds 30 requests from a teacher's read of the Unity book on 2026-09-22. Each quotes the text it would change, gives the evidence, and proposes the fix. This section orders them into Phases 11 to 17, under the same rules as **How to run a phase** at the top of this file. It adds no product behavior: every phase edits `content/` and the requests, except that Phase 11 adds the guard the others rely on and Phase 17 extends it.

Two things hold in every phase:

- **Question blocks are progress.** Phases 11 to 15 change none of them, Phase 16 changes only `-` lines, and Phase 17 changes only what its changes file lists. The guard checks this in every phase, because a byte-identical rule kept by care alone is broken sooner or later.
- **The requests are the specification.** Apply the proposed wording in each request, adjusting only what the surrounding sentence needs. If a fix no longer fits because an earlier phase changed its paragraph, write to the request's intent and say so in the phase log. When a request is fully applied, delete its file and remove its row from that folder's README; when a grouped request is partly applied, delete the items done.

### Decisions: defaults the phases assume

Several requests leave a choice open. The phases assume the defaults below; changing one changes only the phase it names.

| Decision | Default | Alternative | Phase |
| --- | --- | --- | --- |
| Chapter 15's description of the review queue | Describe the queue as it is, the request's option 1 | Change the scheduler to match the paragraph: a product change, outside this feature | 11 |
| Forward-reference endings | The "Recommended ending" column of the requests' README; coroutine and singleton close with no change | Any other option a request lists | 11 to 14 |
| Managed wrapper | A new glossary entry, linked at chapter 1's first mention | One clause in chapter 1 | 12 |
| Scripting backend, option 3: moving the IL2CPP paragraph into chapter 8 | Decide in Phase 13, after reading chapter 8 with the Phase 11 fix in place. Move it only if the table cannot be acted on with the glossary preview alone | Always move it | 13 |
| "Pixel 6a" in chapter 8 | Replace it with "a mid-range Android device" | Keep it | 13 |
| Variants that test another concept | Split seven into new concepts and move two, as the request lists | Leave them, recorded under "Considered and left out"; or rewrite the odd variant | 17 |
| Arithmetic-only questions and the `16.67` answer | One new `?+` variant on each of the three concepts, asking what the figure does not establish; accept `16.67ms` as well | Leave them | 17 |
| Unity reference version | Stay on 6.0, with every link pinned to it | Move the book to a later release: a content decision of its own, not part of this feature | none |

### Decisions: the guard

`pipeline/guard.ts`, run as `npm run guard -- <command>`, with its logic tested in `pipeline/guard.test.ts` like the rest of the pipeline. It is built on `parseContentFile`, so it reads question blocks exactly as the site does, and it adds no dependency.

- `questions [--base <rev>]` parses every chapter file at a git revision (read with `git show`; the default is `HEAD`) and in the working tree, matches sections by id, and compares each section's concepts and variants while ignoring line numbers. Every difference is printed as `file:line: message`, and the exit status is 1. Section ids and their order may not change.
- `questions --allow distractors` also accepts `-` options that were changed, added or removed, and nothing else.
- `style` reads the prose of the chapter and glossary files, outside code fences, code spans and quotation marks, and reports em dashes, contractions, straight double quotes, and a chapter section whose last content paragraph is not its closing exercise.

The guard does not search for the names the no-brand rule protects. That search stays one run by hand, so the names never appear in a tracked file.

Phase 17 adds a third mode, described there.

### Decisions: working rules

- Find each edit by its quoted text, not its line number. The requests cite lines of commit `cfe2bff`, and every edit above a line moves it.
- Keep the book's style in every new sentence: no em dashes, no contractions, curly quotes in prose and straight ones in code, American spelling except the verb "practise", mechanics and genres rather than products, and the closing exercise last in its section. The requests quote Unity's documentation, contractions included; those quotations are evidence for the editor, never text for the book.
- Leave the three pinned examples as they are: the magnet in `collaboration-discovery`, the mission message in `collaboration-tools`, and the coin in `debugging-method`.
- A new glossary summary stays within 400 characters, and a new `=` name must not collide with any id or name in the book. `npm run check` reports both.
- Checking a link needs the network, and the site still does not: a documentation link is an anchor the reader chooses to follow, never a load, so the offline rule in CLAUDE.md is unaffected.

**Every phase's Done when includes:** `npm run check`, `npm test` and `npm run build` pass; `npm run guard -- style` passes; the phase's question check passes; the no-brand search stays empty; and the requests the phase closes are gone from `docs/review-requests/` and its README.

### Phase 11: The guard, and the three high-priority fixes

Build:

- Commit `docs/review-requests/` first, if it is not already committed, and record that commit in the phase log as the feature's base. Phases 12 to 15 also run the strict question check against it.
- The guard's `questions` and `style` commands, per the guard decisions above, with tests beside them, and `"guard": "tsx pipeline/guard.ts"` in `package.json`.
- Apply [struct-method-on-list-element](review-requests/struct-method-on-list-element.md) (chapter 4), [development-build-and-stripping](review-requests/development-build-and-stripping.md) (chapter 8) and [review-queue-description](review-requests/review-queue-description.md) (chapter 15, option 1).
- Apply item 2 of [cross-references-and-placement](review-requests/cross-references-and-placement.md), moving the two exercises in `powerup-stacking` to the end of the section, which the new `style` check requires.
- Close [coroutine](review-requests/coroutine.md) and [singleton](review-requests/singleton.md) with no change to the book.
- CLAUDE.md: list `npm run guard` with the other commands, and say that Phases 11 to 17 apply the review requests.

Done when: the checks common to every phase pass, and the guard is shown to bite. Breaking a `*` line, a `>` line and an `=` line each fails `questions`; breaking a `-` line fails `questions` and passes `questions --allow distractors`; an em dash in prose fails `style`. Revert every mutation afterwards.

Manual check (user): read the three corrected sections in `npm run dev`.

### Phase 12: Chapters 1 to 5

Apply, in chapter order:

- Chapter 1: [frame-budget](review-requests/frame-budget.md); [managed-wrapper](review-requests/managed-wrapper.md), which is a new entry in `glossary.md` and its link at the first mention.
- Chapter 2: [scriptableobject-play-mode-writes](review-requests/scriptableobject-play-mode-writes.md), with its glossary sentence; [money-in-floating-point](review-requests/money-in-floating-point.md), together with the chapter 2 row of [unity-api-names](review-requests/unity-api-names.md), because both rewrite one sentence; [object-pool](review-requests/object-pool.md); [idempotence](review-requests/idempotence.md); [play-mode-tests](review-requests/play-mode-tests.md), together with item 7 of cross-references-and-placement, the entry's heading; item 6 of [code-samples](review-requests/code-samples.md); item 13 of [precision-notes](review-requests/precision-notes.md).
- Chapter 3: item 4 of cross-references-and-placement.
- Chapter 4: items 1, 2 and 3 of precision-notes; item 3 of cross-references-and-placement.
- Chapter 5: item 3 of code-samples, dropping the `Maximum` half of the invariant unless a grant method is added with it; item 4 of precision-notes.

Done when: the common checks pass, with the strict question check against the feature's base, and `npm run check` reports 26 terms and no unlinked entry.

Manual check (user): hover the new link in chapter 1 and read its card.

### Phase 13: Chapters 6 to 8

Apply:

- Chapter 6: [physics-replay-determinism](review-requests/physics-replay-determinism.md); [string-comparer-default](review-requests/string-comparer-default.md), both halves, including its chapter 9 sentence, so that it closes in one phase; [scripting-backend](review-requests/scripting-backend.md), option 2 and the terminology fix, with option 3 per the decisions above (if the paragraph moves, the entry's last paragraph points at its new section); the time-domain row of unity-api-names, as a column in the existing table; the chapter 6 links of [links-and-versions](review-requests/links-and-versions.md) (06:10 and 06:88); item 4 of code-samples; items 11 and 12 of precision-notes.
- Chapter 7: [job-system-and-burst](review-requests/job-system-and-burst.md); [addressables-summary](review-requests/addressables-summary.md), in the glossary; the two chapter 7 rows of unity-api-names; the chapter 7 links and link texts of links-and-versions (07:12, 07:155 and 07:157); item 7 of code-samples; item 5 of precision-notes.
- Chapter 8: items 1 and 6 of cross-references-and-placement, item 6 per the decisions above; the two chapter 8 rows of unity-api-names; the chapter 8 link of links-and-versions (08:162).

Done when: the common checks pass, with the strict question check against the feature's base, and every link this phase introduces returns HTTP 200.

Manual check (user): the chapter 6 time-domain table at phone width, where it should scroll sideways rather than widen the page; the Addressables preview card.

### Phase 14: Chapters 9 to 11

Apply:

- Chapter 9: [spatial-index](review-requests/spatial-index.md); [breadth-first-search](review-requests/breadth-first-search.md); the chapter 9 row of unity-api-names, the `PriorityQueue` fact that chapter 4's pointer from Phase 12 now names; item 2 of code-samples; item 6 of precision-notes.
- Chapter 10: [grid-cell-size](review-requests/grid-cell-size.md), with the last paragraph of the `spatial-index` entry; [weighted-heuristic-bound](review-requests/weighted-heuristic-bound.md); the chapter 10 row of unity-api-names; item 5 of cross-references-and-placement, which closes it; item 5 of code-samples.
- Chapter 11: the chapter 11 links of links-and-versions (11:14, 11:66, 11:167 and 11:171), which closes it; item 1 of [worked-numbers](review-requests/worked-numbers.md); item 7 of precision-notes.

Done when: the common checks pass, with the strict question check against the feature's base, and every link this phase introduces returns HTTP 200.

### Phase 15: Chapters 12 to 15

Apply:

- Chapter 12: the three chapter 12 rows of unity-api-names, which closes it; item 8 of precision-notes.
- Chapter 13: item 1 of code-samples, which closes it; items 9 and 10 of precision-notes.
- Chapter 14: items 2 and 3 of worked-numbers, leaving the mission message in `collaboration-tools` as it is; item 14 of precision-notes, which closes it.
- Chapter 15: item 4 of worked-numbers, which closes it.

Then update the requests' README: its accuracy, coverage, consistency and forward-reference tables are now empty, and its opening paragraph should say which phases applied the second read.

Done when: the common checks pass, with the strict question check against the feature's base, and the only requests left in the folder are the question-design ones.

### Phase 16: Distractors

A questions pass: only `-` lines change, held to the book's distractor standard.

- [first-use-hitch-contradiction](review-requests/first-use-hitch-contradiction.md), option 1: replace one distractor.
- [option-sets](review-requests/option-sets.md), its sections on Yes and No and on defensible options: add a "No" option with a wrong reason to each of the three yes-or-no sets, and replace the seven defensible distractors.

Every new option is wrong on its own section's terms, avoids the standard's word list (always, never, every, automatically, only, guarantees, cannot, forbids), and sits near the book's median length for a wrong option.

Done when: the common checks pass; `npm run guard -- questions --allow distractors` passes against the phase's starting commit; and the word-list heuristic, run again over the whole book, still gains nothing, with the new figures recorded in the phase log.

### Phase 17: Question structure

Runs only as far as the two question decisions above allow. Before starting, export progress from the Data page as a backup.

Build the guard's third mode first: `questions --allow structure --changes <file>`. The changes file lists each new concept id with the variant it takes, each moved variant with its old and new concept, each variant added to an existing concept, and each accepted answer added. The check fails unless every old concept id survives, every old variant appears exactly once and unchanged, in its place or where the file moves it, and nothing the file does not list has changed. Commit the file with the phase as `docs/review-requests/structure-changes.json` and keep it there: it is the record of which concept each moved question came from.

Then apply [variants-that-test-another-concept](review-requests/variants-that-test-another-concept.md), option 1: seven `?+` lines become `??` lines with the ids the request suggests, and two variants move to the concepts it names. Apply the rest of option-sets: one `?+` variant on each arithmetic-only concept, written to the distractor standard, and `16.67ms` among the accepted answers of `performance-60-budget`.

Done when: the common checks pass; the structure check passes against the phase's starting commit; with both defaults taken, `npm run check` reports 160 concepts and 190 variants; `docs/review-requests/` holds only its README and the changes file; and the phase log names the sections to practise again, because a new concept starts with no history and nothing on screen prompts for it.

Manual check (user): practise one section with a split concept and one with a moved variant; the chapter pages still show every other concept's progress.

### After Phase 17

The requests surfaced two product changes, deliberately left out of this feature:

- Queue every first answer, or let the reader mark a right answer as a guess, so that the review queue does what chapter 15 first described.
- On a completed section, show how many of its concepts have never been answered. Phase 17 would then announce itself, and so would any question added later.

Each changes PROJECT.md and needs a plan of its own.

## Feature: second book, Unity Mobile Platform Engineering

The site can hold several books, and this feature writes the second. It covers the layer between a Unity game and the platforms it ships on: native bridges on Android and iOS, the operating system's features, third-party SDKs, both build pipelines, backend clients, CI with Jenkins, and debugging across all of them. It prepares for interviews for Unity mobile platform roles, where native integration and SDK work carry the most weight. [mobile-platform-outline.md](mobile-platform-outline.md) is the specification: every chapter, section and concept, and what each chapter's claims are checked against.

It continues the numbering under the same rules as **How to run a phase**. Phase 18 prepares the tools, Phases 19 to 31 write one chapter each, and Phase 32 reads the finished book as a teacher. Everything in **Decisions** still holds.

Three things it leaves alone. **The product:** Home lists books by title, Review and the due count span books, and Data resets one book at a time, so a second book needs no change in `src/`. **PROJECT.md**, including its non-goal of links between books. **The Unity book:** every phase checks that its question blocks still match, and no phase edits its prose.

### Decisions: the book

| Decision | Default | Alternative |
| --- | --- | --- |
| Title, which fixes the book id and with it the book's progress | Unity Mobile Platform Engineering, id `unity-mobile-platform-engineering` | Another title, chosen before Phase 19 commits; renaming later loses progress |
| Folder | `content/mobile-platform/`: `01-…md` to `13-…md`, and `glossary.md` | None |
| Reference version | Unity 6.3 LTS (6000.3), the installed Editor that has both platform modules; Unity links pinned to `/6000.3/` | 6.0, the Unity book's version, which is not installed with iOS support, so its iOS claims could not be checked here |
| The Unity book | The new book stands alone. It recaps what it needs from the first in a paragraph at most, naming the chapter in plain text | Links between books: a product change that amends PROJECT.md's non-goals |
| Names | Platforms, their stores, services and first-party tools, Unity and its packages, Jenkins, EDM4U and open standards by name; third-party SDK vendors by category (“an analytics SDK”); never a game, studio or publisher | Naming vendors |
| Native snippets | Java, compiled with the Editor's JDK; Objective-C, Objective-C++ and Swift, compiled with Xcode | Kotlin, which needs a compiler this machine does not have |
| Phase order | Reading order, as below | The order under **If time runs short** |
| Glossary | Written with each chapter | One pass after the book, as the Unity book had; that pass had to rediscover the terms the text assumed |
| Diagrams | At most one per chapter, only where the structure is the point: SVG with `title` and `desc`, drawn like the Unity book's two | None |

### Decisions: writing rules

The Unity book's conventions hold from the first draft, and `npm run guard -- style` checks several of them:

- No em dashes, no contractions, curly quotes in prose and straight ones in code, and American spelling except the verb “practise”.
- Every section ends with its exercise: `Exercise:` to reflect on a project, `Lab exercise:` to build something, `Interview exercise:` to answer aloud, `Debugging exercise:` to investigate.
- A section reads in a few minutes, as the Unity book's do: roughly 500 to 900 words of content, two concepts and at most three, and `?+` variants where a scenario tests the same idea from another side.
- The distractor standard from the start. Each `-` is a mistake an engineer makes. The word-list heuristic (always, never, every, automatically, only, guarantees, cannot, forbids) gains nothing. Correct and wrong options have similar median lengths; the Unity book's are 73 and 65 characters. A yes-or-no set includes a “No” with a wrong reason. Each variant tests its own concept, and each explanation stands alone.
- **Questions outlive facts.** Version numbers, API levels, dates, fees, quotas and limits may appear in prose, with the version or date they were checked against, but never as a correct answer. The review queue repeats a concept for a month and more, and would go on reinforcing a figure after it changed.
- `[[term]]` at a term's first mention in a section, and `[[#id]]` back to an earlier section of this book; never inside a heading or a code span, or in a question block that has been committed. An external link is documentation the reader chooses to open, and returns HTTP 200 with no redirect when it is written.
- Code fences: `csharp`, `java`, `objective-c`, `objective-cpp`, `swift`, `groovy` for `build.gradle` files and Jenkinsfiles, `kotlin` for `.kts` files, `xml` for manifests, property lists and entitlements, `ruby` for Podfiles, `properties`, `bash`, `json` and `http`. Shiki has no `gradle` or `plist`.
- Every new sentence passes the avoid-ai-writing skill's detector.
- Quotations from Unity's, Android's or Apple's documentation are evidence for the writer, contractions included, and never text for the book.

### Decisions: evidence

The Unity book was checked after it was written, and that read found thirty problems. This book checks its claims while it is written. A claim that cannot be checked is narrowed to what can be, or cut, and the phase log says which.

| Claim | Evidence |
| --- | --- |
| A Unity API exists, with this signature | The 6000.3 Editor's assemblies, under `Unity.app/Contents/Resources/Scripting/Managed/` and `PlaybackEngines/*/`, searched with Node |
| Unity's documentation says so | The 6000.3 page fetched with `curl` and quoted exactly. A missing page returns a real 404, so a 200 means the page exists |
| Unity generates this | `PlaybackEngines/AndroidPlayer/Apk/`, `…/Tools/GradleTemplates/` and `PlaybackEngines/iOSSupport/Trampoline/` in the Editor, and the probe project's exports |
| C# behaves this way | A .NET 8 probe |
| IL2CPP marshals or strips this way | The C++ that IL2CPP generates for the probe project |
| This Java compiles | `AndroidPlayer/OpenJDK` (17) against `SDK/platforms/android-36/android.jar` and a `classes.jar` under `Variations/il2cpp/` |
| This Objective-C or Swift compiles | Xcode, for the iOS SDK |
| Android, Google Play, Apple or Jenkins says so | The vendor's page, fetched and quoted. Apple's pages render in JavaScript, so read their JSON under `developer.apple.com/tutorials/data/documentation/` |
| HTTP or OAuth works this way | The RFC |
| A device behaves this way | No device is assumed. State what the documentation says, and what a device check would show |

**The probe project** is one Unity 6000.3 project outside the repo, created in Phase 20 and reused by the phases after it. It is never committed, and the Phase 20 log records its path. Other scratch programs stay outside the repo too.

**Before Phase 18,** accept the Xcode license once: `sudo xcodebuild -license accept`. Until then `/usr/bin/git`, `python3` and every Xcode tool exit with status 69, so `npm run guard -- questions` cannot read a revision and no Objective-C or Swift compiles. Putting `/Library/Developer/CommandLineTools/usr/bin` first on `PATH` restores `git`, and nothing else.

### Decisions: tools

- `npm run guard -- questions --allow new-chapters` accepts the sections and concepts of every chapter none of whose sections exists at the base revision, and says how many it accepted. Everything else stays strict: a new book passes, while a new section in an existing chapter fails, and so does any change to a committed question block. A chapter is recognized by its sections, because its title may change.
- `npm run check` prints each book's totals after the sums, so a phase can compare the new book with the outline.
- `npm run guard -- style` already reads every content file, so it needs no change.

### Phase 18: Tools for a second book

Build:

- `--allow new-chapters` in `pipeline/guard.ts`, with tests in `guard.test.ts`: a new chapter in an existing book passes, a new book passes, and a new section in an existing chapter, a new concept in an existing section and a changed `*` line in an existing chapter each fail.
- Per-book totals in `pipeline/check.ts`, built on `summarize`, with a test.
- CLAUDE.md: `content/mobile-platform/` in the layout, the new option beside `npm run guard`, and a note that Phases 18 to 32 write the second book from `docs/mobile-platform-outline.md`.

Done when: `npm test`, `npm run typecheck`, `npm run check` and `npm run build` pass, `npm run guard -- style` and `npm run guard -- questions` pass, and the new option is shown to bite on the real content. A scratch file `content/mobile-platform/99-scratch.md` holding one section passes with `--allow new-chapters` and fails without it; a new section in an existing Unity chapter fails with it; a changed `*` line in the Unity book fails with it. Revert every mutation afterwards.

### Phases 19 to 31: one chapter each

| Phase | Chapter | Sections | Concepts | Also |
| --- | --- | --- | --- | --- |
| 19 | 01: The platform layer and the call path | 6 | 12 | Creates `glossary.md`; the pilot |
| 20 | 02: Calling Android from C# and back | 6 | 12 | Creates the probe project and shows it exporting both a Gradle project and an Xcode project |
| 21 | 03: Calling iOS from C# and back | 6 | 12 | |
| 22 | 04: Lifecycle, permissions, links, notifications, and sign-in | 5 | 10 | |
| 23 | 05: Android builds: Gradle, manifests, and dependencies | 5 | 11 | Builds the probe's Gradle export with the Editor's Gradle |
| 24 | 06: iOS builds: Xcode, signing, and CocoaPods | 4 | 8 | Archives the probe's Xcode project |
| 25 | 07: Integrating third-party SDKs | 6 | 12 | |
| 26 | 08: Backend clients: HTTP, sessions, and data contracts | 5 | 10 | |
| 27 | 09: Reliable requests on unreliable networks | 5 | 10 | |
| 28 | 10: Build variants, environments, and releases | 5 | 10 | |
| 29 | 11: CI/CD and Jenkins for Unity mobile builds | 6 | 12 | |
| 30 | 12: Debugging across boundaries | 5 | 10 | |
| 31 | 13: Interview practice for platform roles | 4 | 7 | The link pass |

Each phase, in order:

1. Read the outline's opening sections and its chapter, the chapters it builds on, and `glossary.md`.
2. Check the chapter's claims before writing, per **Decisions: evidence**, with probes outside the repo.
3. Write the chapter file. Add glossary entries for the terms it uses without defining them, and link their first mentions.
4. Read it back as a teacher: each claim against its evidence, each question against the standard, with the word-list heuristic and the option lengths measured.
5. Run the avoid-ai-writing detector over the new prose and fix what it reports.

**Every chapter phase's Done when:**

- `npm run check`, `npm test` and `npm run build` pass, and so does `npm run guard -- style`.
- `npm run guard -- questions --allow new-chapters --base <the phase's starting commit>` passes and accepts this chapter and nothing else.
- `npm run check`'s line for the book matches the outline's figures for the chapters written so far, and reports no entry that nothing links to.
- Every external link the phase adds returns HTTP 200 with no redirect.
- The no-brand search stays empty.
- The phase log says what was checked and against what, where the outline was wrong, the heuristic's figures, and the terms added.

Manual check (user): read the chapter in `npm run dev` and answer its questions.

**A committed chapter is progress.** The reader may start it at once, so later phases change its question blocks only the way the Unity book's editing passes did: `-` lines under `--allow distractors`, and anything else through a changes file under `--allow structure`, with the cost to the reader's review history stated.

**Phase 19 is a pilot.** The user reads chapter 1 before Phase 20 starts. A change to depth, length or tone goes into this section first, so the other twelve chapters are written to it rather than rewritten.

**Phase 31's link pass.** Earlier chapters mention later ones in plain text. Where a link helps the reader, the mention becomes a `[[#id]]` in prose, never in a question block.

### If time runs short

If an interview comes before the book is done, run the phases in the order of what the interview weighs most: 19 to 22 (the boundary and native integration), 25 (SDKs) and 30 (debugging across boundaries), then 23, 24, 26 to 29, and 31. The book's order stays as it is, because the file names fix it. A chapter written early explains in place the little it needs from an unwritten one, names that chapter in plain text, and Phase 31's link pass connects them.

### Phase 32: A teacher's read

Read the whole book in order, as the Unity book's second read did: every claim, code sample, worked number and question, testing the doubtful ones against **Decisions: evidence**. Write one file per problem in `docs/review-requests/`, with the kinds and priorities its README defines. A later section of this plan orders them into phases, as Phases 11 to 17 did.

Done when: every chapter has been read in order, each problem has its file and its row in the README, and the phase log counts the requests by kind and priority.

## Phase log

### Phase 1: Scaffold and single-file build

Built the Vite/React/TS app, `src/router.ts` (hash router, tested in `router.test.ts`) with a placeholder page per route, `scripts/verify-dist.mjs`, and updated CLAUDE.md. Verified `vite-plugin-singlefile@2.3.3` against npm's current Vite (`8.3.0`, its peer range includes `^8.0.0`) before writing code, per instructions; also confirmed TypeScript's new `latest` (`7.0.2`) works with `tsc -b` project references. Versions installed: react/react-dom 19.3.0, @vitejs/plugin-react 6.1.1, typescript 7.0.2, vite 8.3.0, vitest 5.0.1.

Deviation: package.json only has deps this phase's code uses (react, react-dom, vite, @vitejs/plugin-react, typescript, vite-plugin-singlefile, vitest, @types/*). `idb`, `katex` and the unified/remark/shiki toolchain from Tooling aren't installed yet — add them in the phases that first import them (2/3/4) rather than now.

Manually verified with headless Chrome against `dist/index.html` opened via `file://`: Home and a deep `#/b/:book/:chapter/:section` route both render, no console errors.

### Phase 2: Content parser

Built `src/types/content.ts`, `pipeline/parse.ts` (line-based, fence-aware, one file at a time), `pipeline/load.ts` (file discovery with a recursive `readdirSync`, cross-file checks for books, chapters, section ids and concept ids, `summarize`) and `pipeline/check.ts` with `npm run check`. `tsx` is the only new dependency. 103 tests cover every error rule by file and line. `docs/content-format.md` is 155 lines; a test parses its example.

Errors the plan did not spell out: a chapter with no sections; a file with no sections; a prompt line with no text; a second `>` block in one variant; a fence in the question block that is not directly after `??` or `?+`. Chapters are compared by id (`slug(title)`), not by raw title, since the id is the route. Markers must start at column 0 followed by a space (a lone `>` is fine). Blank lines in front matter are ignored, and the order of `*`, `-` and `=` lines within a variant is free.

Next phase: the raw model is `RawFile` → `RawChapter` → `RawSection` → `RawConcept` → `RawVariant` (`parse.ts`), assembled into `RawBook[]` by `assembleBooks` (`load.ts`). Every Markdown chunk is `{ md, line }`, where `line` is the file line of `md`'s first line, so line `k` of a chunk is file line `line + k`. Accepted answers are plain strings. `content-format.md` already states Phase 3's rendering rules (images, code languages, LaTeX); `check` enforces them only once Phase 3 lands.

### Phase 3: Rendering and Vite plugin

Built `pipeline/render.ts` (one Shiki highlighter and one unified processor, created on first use; each chunk is rendered alone and its errors are mapped to file lines), `pipeline/vite-plugin.ts` (`virtual:content`; a Vite 8 `hotUpdate` hook invalidates the module and sends a full reload on `.md` and image changes, and errors reach the overlay and the build log, all listed; plus `katexWoff2Only`), async `loadContent`/`renderBooks`, `npm run check` on the full pipeline, the Shiki dual-theme CSS, placeholder pages reading `virtual:content`, and the sample book in `content/sample/`. 162 tests. Checked in headless Chrome: `npm run dev` reloads on edit, add, delete and image change, and the overlay shows every `file:line`; `dist/index.html` from `file://` with the network offline shows code, math and the image, and makes no request. **`dist/index.html` is 664,199 bytes (664 kB, 341 kB gzipped)**; about 370 kB of it is inlined CSS, mostly the 20 KaTeX woff2 fonts.

Deviations: katex is `^0.16.47`, not the latest 0.18.7, because rehype-katex 7.0.1 needs `^0.16`; `npm ls katex` shows one copy. Also added `unist-util-visit`, `vfile`, `@types/hast` and `@types/mdast` (imported directly) and `RawChapter.file`. Rules the plan left open: rehype-katex never throws, it records a message and renders red markup, so every message is an error and a failed chunk returns no HTML; KaTeX also paints `\href`, `\url`, `\includegraphics` and `\html*` red with no message, so a throwing `trust` turns them into errors; display math has no position of its own, so its line comes from the enclosing `<pre>`; raw HTML is an error (it was silently dropped); images must be relative and inside `content/`; math opened with `$$` on one line is display math (remark-math makes it inline). `content-format.md` says all of this.

Next phase: ids and titles are plain text; section html, prompts and explanations are block HTML; options are HTML without their wrapping `<p>`; `accepted` is plain. Keep the `.shiki` rules in `styles.css` and the KaTeX CSS import in `main.tsx`. Footnotes and `[x](#anchor)` links emit bare `#…` hrefs, which the hash router reads as unknown routes; handle or ban them. A formula error names the line where the formula starts, not the line inside a multi-line one.

### Phase 4: Engine and storage

Built `src/engine/` (records, dates, sampling, grading, scheduling, sections, due list) and `src/storage/` (clock, IndexedDB layer, an in-memory store written through to it, export/import validation, `ProgressProvider` with `useProgress` and `useProgressActions`), and wired the provider into `App`. New dependencies: `idb`, and `fake-indexeddb` (dev). 298 new tests (460 in all): the storage tests run on `fake-indexeddb`, the date tests in ten time zones, and a guard test fails if `src/engine/` calls `Date.now()`, `new Date()`, `Math.random()` or `toISOString()`. To check that the tests bite, I broke 136 rules one at a time: 134 failed the suite, 2 are equivalent mutants (a second layer enforcing the same limit). Checked in headless Chrome from `file://`: the provider mounts, the `study` database is created with both stores and survives a reload, no console errors. `dist/index.html` is 677,154 bytes; in the production bundle `setToday` compiles to an empty function.

Deviations: `applyAnswer`'s argument also carries `bookId` and `conceptId`, used only when there is no record yet (the plan's signature can't name a new one); `markRead(bookId, chapter, sectionId)` takes the chapter and ignores a locked section; `importProgress(text)` validates again, so the UI can call `readProgressExport(text)` first for its confirmation. Rules the plan left open: an import needs timestamps exactly as `toISOString` writes them (`pickVariant` compares them as text) and `box` and `due` both null or both set; memory is authoritative and IndexedDB a mirror, so a failed write (not only a failed open) sets `persistent` to false; `openStudyDb` is `async` because `idb`'s `openDB` throws instead of rejecting when `indexedDB` is missing.

Next phase: the provider renders nothing until IndexedDB has opened. `useProgress()` gives `{ concepts, sections, today, persistent }`; `useProgressActions()` gives the actions. Call `recordAnswer({ bookId, section, conceptId, v, ok, mode })` once per question, when the answer is final (for a wrong short answer, on **I was right** or **Continue**). `sampleOptions` takes the `rng`: pass `Math.random` from the component. `snapshot.today` refreshes on every change and on `setToday`, not at midnight while a page sits idle. Phase 6: the Data page's import should call `readProgressExport` before confirming, and show the Simulate today input only under `import.meta.env.DEV`. Test helpers are in `src/test-helpers.ts`.

### Phase 5: Study UI

Built the Home, Book, Chapter and Section pages, `QuestionCard`, `styles.css`, the 1-9/Enter shortcuts and the in-page link handler (`Html`, one delegated click handler). Added to `src/engine/`: `prepareQuestion(s)` (`pickVariant` + `sampleOptions` as plain data), `countCompleteSections`, `countInReview`. **The Start button makes the whole sequence once and keeps it in `useState`; answering never re-picks or reshuffles.** 44 new tests (504 in all). Driven in headless Chrome, against `npm run dev` and `dist/index.html` from `file://` (no external requests): all eight manual checks except how it looks and feels, plus 109 assertions on flow, keys, IndexedDB contents, phone width, dark mode and links.

Rules the plan left open: True/False answer on click, choice questions need Submit; both short-answer buttons record and move on, Enter is Continue; locked sections are not links; `SectionPage` is keyed per section and `QuestionCard` per question (state leaked between them without it); the route scrolls to the top on change; **Reread content** moves focus to the content (left on the button, Enter would repeat it). Home has a plain Review link: the due count is Phase 6.

Next phase: for Review, call `prepareQuestion(concept, record, Math.random)` once per due concept, hold it in state, and key `QuestionCard` by question; `onAnswer(ok)` is where to call `recordAnswer({ ..., mode: 'review' })`. Show all rendered HTML through `Html`. Headings get no ids, so `[x](#id)` can only reach footnotes; footnote definitions are only allowed in section content.

### Phase 6: Review, data page and finish

Built the Review page, the due count on Home, the Data page, `StorageBanner`, a loading state, the Not-found page, a style pass, README.md and the CLAUDE.md update. **Review opens on the live due count with a Start review button; Start captures the queue once (`prepareReview`) and the page walks that copy, never the live due list.** The store gives up on IndexedDB after 3 seconds (`OPEN_TIMEOUT_MS`, covering the open and the first read; a connection that opens late is closed), `refreshToday` runs on `visibilitychange` (`storage/visibility.ts`), and `ProgressProvider` shows a loading note meanwhile. 25 new tests (529 in all); breaking the timer, the deadline, the late close and `refreshToday` one at a time failed the suite each time. Driven in headless Chrome, against `npm run dev` and `dist/index.html` from `file://` with the network offline (no request but the inlined `data:` fonts): 108 assertions on manual checks 1-3, the queue staying fixed while answering, a real hanging `indexedDB.open` (app up at 3.05 s, with the banner), blocked storage, phone width and dark mode. `dist/index.html` is 711,260 bytes.

Rules the plan left open: import and reset confirm in an inline panel (Esc cancels), not `window.confirm`; the loading note fades in after 0.4 s, so a normal open shows nothing; the Review summary reads each concept's new box and due date from its record instead of recomputing them; the dev section carries `data-dev-only`, and `verify-dist.mjs` now fails the build if that marker is in `dist/` (checked against a build with `DEV` forced on, which does contain it). Docs: `content-format.md` gained a line saying footnotes work only in section content and `[x](#id)` links reach nothing (both checked against the pipeline); README.md is new; CLAUDE.md matches the finished project.

Left for the user: manual check 4 in Safari (does it open IndexedDB on `file://`, and does the banner show if not), and how it feels to use. Chrome's Network tab lists the inlined `data:` fonts; they are not requests. The dev server logs a `favicon.ico` 404, as it has since Phase 1.

### Final touches (after Phase 6)

Verified in headless Firefox 156 (the user's browser), driving `dist/index.html` from `file://` over WebDriver BiDi with scratch scripts kept outside the repo: IndexedDB opens (no banner), a study session records answers and unlocks the next section, progress survives a reload and a full browser restart, export downloads `study-progress-YYYY-MM-DD.json`, and reset then import restores it. No console errors and no network requests; dark mode and a 390px viewport have no horizontal scroll. Changes: the import's native file control (whose text follows the browser's language) is now a "Choose backup file…" button driving a hidden input; the backup's export date is formatted as `en-GB` so it matches the English page; `index.html` has a `data:,` favicon, so the dev server no longer logs a `favicon.ico` 404. Manual check 4 now names Firefox.

### Phase 7: Glossary format and pipeline

Built `kind: glossary` files (`parseGlossaryBody` in `parse.ts`, sharing the fence reader and one `parseHeading` with the section parser), `[[...]]` resolution (`remarkCrossReferences` in `render.ts`, between the image plugin and `remark-rehype`), the model changes, the name-namespace and `->` checks in `assembleBooks`, backlinks gathered per section in `renderBooks`, the `terms` and `links` totals with the unlinked-entry note in `check`, and the two new sections of `content-format.md`. 58 new tests (586 in all). `content/unity-engineering/glossary.md` holds Strategy, State and Observer, linked from chapter 05's pattern table and from `oop-composition`.

Rules the plan left open: an unknown `kind` stops the body being read at all, because parsing it as chapters piled two guesses on top of the one real error; the summary's "one paragraph" rule is checked on the rendered HTML instead of the source, which is exact and needs no list, table or blockquote detection; a `[[...]]` inside a Markdown link is an error rather than a silent nesting, and so is a `[[` that never closes; a fence ends a summary even with no blank line before it. The suggestion for a failed target matches by containment **and** by a rough singular, because `[[strategies]]` does not contain `strategy`, which is the likeliest typo of all.

Next phase: `Book.glossary` is sorted by term, and `GlossaryEntry.uses` holds `{ chapter, section }` in content order, once per section, empty when nothing links to the entry. Links already render as `<a class="ref ref-term" href="#/g/:book/:term">` and `<a class="ref ref-section" href="#/b/:book/:chapter/:section">`, so `#/g/...` is the route to add and `.ref` the selector to style. `src/storage/` and `verify-dist.mjs` are untouched, as planned.

### Phase 8: Glossary pages and links

Built the `#/g/:book` and `#/g/:book/:term` routes, `src/pages/Glossary.tsx` (every term, with a filter over its name and its other names) and `src/pages/Term.tsx` (the term, its other names, summary, body, "See also" and "Where this appears"), the "Glossary (N terms)" link on the Book page, and the `.ref`, `.lead`, `.term-summary` and `.inline-links` styles. The logic worth testing sits in `src/components/glossary.ts` (`matchesTerm`, `appearances`), so the components stay thin. 10 new tests, 596 in all.

Rules the plan left open: the filter reuses the Data page's `.field` and `.text-input` instead of a second pair of control styles; a locked section under "Where this appears" is named but not linked, in the chapter page's own words; a recorded section the book no longer has is skipped rather than rendered, which only happens against a stale build; a book with no entries shows a notice instead of an empty list, since the route can be reached by hand.

Both doc examples are now addressed by heading (`docExample` in `pipeline/test-helpers.ts`) and parsed by a test, because `content-format.md` holds two and the first-match regex silently switched to the new one. That test earned its place immediately: the glossary example it was written for had `= write through` under `{#write-through}`, which is the entry's own id written a second way, and a `->` pointing at a section id.

Next phase: nothing previews anything yet. Every `.ref` link carries its route in the href, so `previewTarget` can read it back with `parseRoute`, and `Html` is the single place every block of rendered content passes through.

### Phase 9: Preview cards

Built `PreviewProvider` (one card for the page, drawn into `document.body` with `createPortal` and positioned in page coordinates, so it travels with the page and needs no scroll listener), the card, the handlers `Html` now spreads over every block of rendered content, the two pure modules `previewTarget.ts` (an href to what it would show, plus `sectionLead`) and `previewPlacement.ts` (`placePreview`), and the card styles. 15 new tests, 611 in all.

Rules the plan left open: the pure module is `previewTarget.ts` rather than `preview.ts`, because macOS cannot hold that beside `Preview.tsx`; a term summary is never clamped, since `check` caps it at 400 characters precisely so a card can show it whole, and only a section lead gets the cut and its fade; the card renders its own content under a context of no-op handlers, which is what stops a card from opening a card.

Verified in headless Chrome over CDP against `dist/index.html` from `file://`, adding no dependency, since Node has a global WebSocket. 24 checks: nothing opens before the delay, hovering opens a card naming the term, the pointer can travel into it, leaving closes it, focus opens it and Escape closes it, a link with no room below flips the card above and it stays inside the window, a locked section previews its locked notice instead of its text, an unlocked one previews its opening paragraph, and the page makes no network request. Two checks failed first time and both were the driver's fault: it had unlocked the very section it then expected to find locked, and it tried to make room by scrolling a link to the bottom of a page that had already run out of scroll. Screenshots also caught a real one: a complete term summary was fading as though it had been cut off, which is what moved the clamp onto section leads alone. The driver and the screenshot scripts stay outside the repo.

Left for the user: Firefox, which needs WebDriver BiDi rather than CDP, and how the timings feel in the hand.

Next phase: the machinery is finished and Phase 10 is content. `content/unity-engineering/glossary.md` holds Strategy, State and Observer as the pattern the rest should follow.

### Phase 10: First glossary batch for the Unity book

Read all fifteen chapters in order, looking for concepts used as though the reader already had them, and wrote 22 entries against what the read found. 25 terms and 44 links; `npm run check` reports no unlinked entry. Chapter 05's pattern table previews all eight of its rows, which was the gap that started the phase.

The entries fall into three groups. Five patterns the table named and nothing explained (Command, Factory, Adapter, Decorator, Object pool). Ten terms the book never defines anywhere (dependency injection, service locator, Addressables, ScriptableObject, draw call, SRP Batcher, scripting backend, Burst, Job System, Liskov substitution). Eight terms a later section does explain, where the first use comes chapters earlier (object pool, coroutine, singleton, idempotence, frame budget, Play Mode tests, breadth-first search, spatial index); those entries end by pointing at the section that develops them, so the entry is a way in rather than a second explanation.

The plan's suggested list did not survive the read intact. Cohesion and coupling, assembly definitions, feature flags, seams and event buses are each defined at their first appearance, so they got no entry. Composition root is explained in `architecture-dependencies`, so chapters 05 and 06 link back to that section instead, which is the rule the plan set for a term the book already explains. Substitutability became an entry under Unity's usual name for it, Liskov substitution, since that is what the SOLID table calls it and the name is the part that carries no meaning on its own.

`docs/review-requests/` is new, holding one file per concept whose explanation arrives later, plus an index and a record of the terms a second look rejected. They are notes for an editing pass rather than defects, because the entry closes the gap for the reader either way. Idempotence is the one that cannot be closed by linking at all: it first appears in a chapter 01 question block and then in a chapter 02 `##` heading, and neither can carry a link, so only an editorial change reaches the reader at the point of confusion.

Rules the plan left open: a link is placed at the first mention in a section, and for a term a later section explains, only at mentions before that section, since after it the reader has the section itself. Mentions in a different sense are skipped, so `Task.Run` on a thread pool and a pooled `Awaitable` are not object pooling. `ScriptableObject` is `{#scriptableobject}` rather than `{#scriptable-object}`, because a target resolves by the slug of what is written and the book writes it as one word. Question blocks were held byte identical by snapshotting all 1,474 of their lines before the pass and diffing after, rather than by care.

Also fixed: `docs/content-format.md` said the text shown by `[[target|text]]` is written *before* the bar, which contradicts its own table, the error message in `resolveReference` and the existing `[[strategy|strategies]]` link in chapter 05. `docs/PLAN.md` line 370 carries the same slip beside two examples that are correct; it is left alone, because this log records the plan rather than rewrites it.

### Phase 11: The guard, and the three high-priority fixes

The feature's base is `a8b89af`, which committed `docs/review-requests/` and this plan's feature section; Phases 12 to 15 run `npm run guard -- questions --base a8b89af`. Built `pipeline/guard.ts` with `questions` and `style`, 35 tests in `guard.test.ts` (646 in all), and `npm run guard`; `parse.ts` now exports `openFence` and `findFenceEnd`, so the guard reads fences exactly as the parser does. The guard bites on the real book: a changed `*`, `>` or `=` line each fails `questions`, a changed `-` line fails it and passes `--allow distractors` (1 new, 1 gone), and an em dash in prose fails `style`. Every mutation was restored from a byte copy and its checksum compared.

Applied struct-method-on-list-element (rerun with .NET 8 first: through a list the element stays 3, through an array it becomes 2), development-build-and-stripping, review-queue-description and item 2 of cross-references-and-placement, and closed coroutine and singleton. Deviations, all to fit the requests' intent: chapter 15 says the queue implements "part of" the pattern rather than "the first half", since it has the intervals and the restart only for missed concepts, and it adds that a correct answer at the thirty-day review takes a concept out of the queue, which the request's own evidence lists and its example leaves out. Chapter 08 says "the player build" where the request wrote "it", because "it" followed a sentence about hitches. Also: coroutine and singleton are recorded under "Considered and left out" so a later read does not raise them again; two links from surviving requests to deleted ones became plain text; CLAUDE.md said Phase 10 was still open.

Rules the plan left open: `questions` compares options as texts that appear and disappear, so an edited option reads as one gone and one new, and it reports a reordering; concepts are matched across the book, so one that changes section is reported as a move. `style` also reads headings, question text and glossary names, and masks code, math, link targets, URLs and curly quotations. A closing exercise is a last paragraph starting `Exercise:` or `<Word> exercise:`. Because the book writes possessives with straight apostrophes, `'s` counts as a contraction only after a pronoun or a question word such as "it" or "what".

Next phase: `npm run check` still reports 25 terms and 44 links. The item numbers in grouped requests are kept when items are deleted, because this plan cites them by number.

### Phase 12: Chapters 1 to 5

Applied everything the phase lists, in chapter order; the strict check against `a8b89af` still matches 80 sections, 153 concepts and 187 variants, and `npm run check` reports 26 terms and 46 links with no unlinked entry. The new entry is "Destroyed Unity object" (`{#destroyed-unity-object}`, `= managed wrapper | fake null | Unity null`), linked from chapter 01's one prose mention; the other two sit in a text fence. Its body is written from chapter 06's own explanation, plus `MissingReferenceException`, which both installed Editors contain.

Deviations, each to fit a request's intent: the entry's summary says the wrapper stays reachable "for as long as anything refers to it", not unconditionally. Chapter 02's time sentence also names `Time.unscaledTime` and `Time.unscaledTimeAsDouble`, as the unity-api-names row asks. `CollectResult` gained its constructor rather than a comment, and the wallet took the plan's default of dropping `Maximum`; both samples were compiled and run with .NET 8. Widening the entry heading to "Edit Mode and Play Mode tests" also changed its summary's first words from "Tests that run" to "Play Mode tests run", since the old words would otherwise define both kinds. For precision note 4, Unity's manual does not say whether a body-only edit rebuilds the assemblies that reference it, so the text says an edit "can" rebuild them, and where the request says "above" `Game.Domain` the chapter's diagram draws the dependents below it. Note 3 was checked first: two lambdas over one local share a `Target`, differ in `Method`, and `-=` leaves the handler subscribed.

Also: chapter 04 no longer mentions deep profiling, so its bullet under "Considered and left out" is gone. Chapter 04's pointer names `PriorityQueue<TElement, TPriority>`, which chapter 09 states explicitly from Phase 14.

Next phase: decide scripting-backend option 3 after reading chapter 08 as Phase 11 left it.

### Phase 13: Chapters 6 to 8

Applied everything the phase lists. The strict check against `a8b89af` matches, and every link in the phase's diff returns HTTP 200 with no redirect. Scripting-backend option 3 was not taken. Chapter 08's table, as Phase 11 left it, explains Minimal stripping, ahead-of-time compilation and the Mono build in its own paragraph, and the `scripting backend` preview supplies Mono against IL2CPP, so the IL2CPP paragraph stays in chapter 12 and the entry still points at `mobile-build-integrations`.

Deviations, each for accuracy: chapter 06's clause says "a mobile build normally uses IL2CPP", because desktop players default to Mono. The physics-replay sentences close their paragraph and open "Even with its inputs recorded", so the sentence about positions keeps its place. Chapter 07 says "a job's scheduling cost" where the request wrote "their", since Burst schedules nothing, and its memory-guide link adds that 2.10 is the version released for Unity 6.0. Chapter 08 writes "Android smoke on a mid-range device", because the line already names Android. The new time-domain column is headed "Read it from". Precision note 11 is a cut, since nothing says which profiler entries were meant.

Checked before writing: the comparer claims under `tr-TR` with .NET 8; the two cancellation tokens, the `Awaitable` members, `link.xml` placement and the package rule, and precision note 12's setting names, all in the 6.0 manual or reference; and `UnityEngine.Scripting.PreserveAttribute` in both installed Editors.

Next phase: chapter 04's pointer already names `PriorityQueue<TElement, TPriority>`; Phase 14 adds the fact it points at.

### Phase 14: Chapters 9 to 11

Applied everything the phase lists; the strict check against `a8b89af` matches, and the four chapter 11 links return HTTP 200 with no redirect, which closes links-and-versions and cross-references-and-placement. Before stating the `PriorityQueue` fact, a scan of all 497 class-library files in the 6000.3 install found no `PriorityQueue` type, where the same scan finds `SortedSet` and `HashSet` hundreds of times.

Deviations, each for accuracy: the breadth-first sentence keeps its `[[breadth-first search]]` link, which the request's wording dropped. The lazy-deletion sample gains a `Schedule` step, because a `pending` set that `Cancel` consults needs something that fills it. Precision note 6 asked to credit the flat board with simpler bounds checks, but a flat index is the riskier one: a column one past the edge lands on the next row instead of failing. So the paragraph argues for one index calculation and one array to copy, and warns about that wrap. The pool sentence is split in two, since the fix gave it two semicolons.

Next phase: chapters 12 to 15, then the README restructure; its forward-reference table is already empty.

### Phase 15: Chapters 12 to 15

Applied everything the phase lists; the strict check against `a8b89af` matches, and `docs/review-requests/` holds only the three question-design requests and the README. The README's opening now names Phases 11 to 15, and its open requests are those three, with the phase that applies each.

One correction to a request: on Android and iOS Unity ignores `vSyncCount` ("always ignored because mobile devices do not allow unsynchronized rendering"), so `Application.targetFrameRate` is the only control there, and the request's rule that a nonzero `vSyncCount` overrides the target is the desktop one. Chapter 12 states the mobile rule and gives the desktop one as the contrast. The material, `MaterialPropertyBlock` and lifecycle names were checked against the same 6.0 reference.

Choices the requests left open: chapter 14's budget menu gains a combined row, about 3.2 ms measured together, and one sentence on why combined savings are measured rather than added; keeping the effect reads about 50 FPS, or 30 under strict vsync, since 16.67 - 1 + 4 is 19.67 ms. The tool payback keeps 2 days and states them as about 16 hours. Chapter 15 says "Eleven lines" rather than gaining a twelfth, which would have meant inventing example content. The migration fix carries a comment naming the index.

Next phase: run `npm run guard -- questions --allow distractors --base` with this phase's commit.

### Phase 16: Distractors

Replaced eight `-` lines and added four; `npm run guard -- questions --allow distractors --base c72f0b6` reports 12 new and 8 gone, and nothing else changed. The first-use hitch distractor is the request's own wording. The three yes-or-no sets gained a "No" with a wrong reason, written "No;" like their correct answers so punctuation gives nothing away; the clock-offset set, which had none, gained two, as its request suggests. The seven defensible options became mistakes the sections themselves name or rule out: faster per-frame formatting, which chapter 11 calls step four; a failed storage write, the I/O error chapter 04 separates from rejection; fixing timers before measuring a freeze; a remembered percentage; a false claim that properties cannot be overridden; making the old evaluator agree with the new; and a tooltip in place of validation. Before the phase the word-list heuristic rejected 7.2% of the 181 correct options and 3.4% of the 702 wrong ones, and afterwards 7.2% and 3.4% of 706, with medians still 73 and 65 characters: no new option uses a listed word, so the heuristic still costs more than it wins. The new options run from 63 to 83 characters, each within the range of its own set.

Rejected while writing: a negative price as a caller bug, since the book's own `TrySpend` rejects negative amounts by returning false, which would make that option defensible.

Next phase: export progress from the Data page first, as the plan says.

### Phase 17: Question structure

Built `questions --allow structure --changes <file>`: `readStructureChanges` refuses a file of the wrong shape and names every problem, and `compareStructure` builds each concept's expected variants from the file and compares them with the book. On top of the plan's rules, a concept may give up only its last variants, so the ones it keeps keep their numbers, which progress records store; all nine cases already met that. Moved variants go to the end of their new concept. Six tests (652 in all), and on the real book a changed moved variant, a new concept missing from the file, and a changed `-` line each fail.

Applied both defaults: seven splits and two moves, recorded in `docs/review-requests/structure-changes.json`; one `?+` variant on each arithmetic concept, with two correct answers and four wrong ones, none using the standard's word list; and `16.67ms` accepted for `performance-60-budget`. `npm run check` reports 160 concepts and 190 variants, and the structure check against `7247787` passes. The heuristic now rejects 7.0% of 187 correct options and 3.3% of 718 wrong ones. The progress export the plan asks for is the reader's step in the browser, and was not taken in this session; no repo change touches stored progress, so it can still be taken before opening the rebuilt site.

Practise these sections again, because nothing on screen prompts for a new concept or a variant never shown: the seven new concepts are in `architecture-dependencies` (01), `powerup-expiration`, `powerup-stacking` and `powerup-collection` (02), `missions-event-ordering` (03), `async-models` (07) and `structures-arrays-lists` (09); the moved variants are in `csharp-equality-hashing` (04) and `testing-evidence` (08); the added variants are in `missions-design-presentation` (03), `structures-complexity` (09) and `performance-cpu-work` (11).

### Phase 18: Tools for a second book

Built `questions --allow new-chapters` in `pipeline/guard.ts`: a chapter none of whose sections is at the base is accepted, sections, concepts and all, and the command names each accepted chapter with its counts; every other difference stays strict. `pipeline/check.ts` prints each book's totals after the sums, through an exported `totalsLines` built on `summarize`, and now runs only when executed, as the guard does. Six new tests, 658 in all: with the option on, a new chapter and a new book pass, while a new section, a new concept and a changed `*` line in an existing chapter each fail, a renamed chapter is still compared strictly, and a concept moved into a new chapter is reported as moved; `check.test.ts` covers the per-book lines. Breaking the new logic four ways failed the suite each time. On the real content, a scratch `content/mobile-platform/99-scratch.md` passed with the option and failed without it, and a new section in chapter 03 and a changed `*` line in chapter 09 each failed with it; every Unity file matched its checksum afterwards.

Rules the plan left open: `--allow` still takes one value, and a chapter is new only when none of its sections is at the base, so a renamed chapter that gains one section fails on that section.

Next phase: the Xcode license is accepted, so `/usr/bin/git`, `python3` and `xcodebuild` (Xcode 27.0) all run. The Unity book's id is `unity-game-engineering`; `check` prints the new book as `unity-mobile-platform-engineering` followed by its counts.

### Phase 19: Chapter 01, the pilot

Wrote `content/mobile-platform/01-platform-layer.md` (6 sections, 12 concepts, 28 variants, with the outline's ids) and `content/mobile-platform/glossary.md`, whose 12 entries the chapter links: assembly definition, deep link, Edit Mode and Play Mode tests, idempotence, IL2CPP, JNI, managed code stripping, observer, P/Invoke, push token, R8 and strategy. `npm run check` reports the book as 1 chapter, 6 sections and 12 concepts, with 12 terms, 14 links and no unlinked entry; `questions --allow new-chapters --base 7ae9396` accepts this chapter and nothing else; the nine external links return 200 with no redirect; the no-brand search is empty.

Checked, and against what. A scratch project in the session scratchpad (not the Phase 20 probe project, and not kept), run in the 6000.3.11f1 Editor in batch mode: with Android or iOS active, Editor code sees `UNITY_EDITOR` and the target's symbol while `Application.platform` is `OSXEditor`; an Android-only assembly definition compiles into the Android player alone, and its type used outside `#if` fails the Editor compile with CS0246; awaiting an `AwaitableCompletionSource` resumes on the thread that completed it, while a `Task` awaited from the main thread resumes there. The engine's IL, read with the Editor's `monodis`: `AwaitableCompletionSource` throws on a second `SetResult`, `AndroidJNISafe.CheckException` turns a pending Java exception into `AndroidJavaException`, and the proxy path catches a C# exception, which `javap` on `classes.jar` shows being logged and answered with `null`. An iOS export of the same project: IL2CPP's reverse P/Invoke wrapper has no handler, libil2cpp's `Exception::Raise` throws a C++ `Il2CppExceptionWrapper`, and `__Internal` becomes a direct `extern "C"` call. A .NET 8 probe covered `TaskCompletionSource`. The five C# samples compile at C# 9 under each platform symbol, and in the Editor against the built-in Test Framework 1.6.0, whose `UnityPlatformAttribute` compares `Application.platform`. Unity's 6.3 pages, Apple's StoreKit and App Review pages, Google's billing guide and `BillingClient` reference, and Android's R8 page back the sentences that cite them.

Where the outline fell short: no claim in it failed, but two were incomplete. It offered `TaskCompletionSource` and `AwaitableCompletionSource` as alternatives, and they resume on different threads, which section 4 now turns on. It asked what IL2CPP does with an exception escaping a native callback and left out Android's proxy, where Unity swallows the exception and returns `null`; section 4 covers both. Section 2 adds the two defaults that let a vendor DLL reach gameplay despite assembly definitions, and section 3's strategy example is restoring purchases, from Apple's guideline and Google's query on resume. The text says `AwaitableCompletionSource` without "Unity 6's", which the outline used and nothing checked.

Question figures: the correct option is the longest of its set in 22% of the 27 choice sets and the shortest in 22% (the Unity book: 48% and 24%), the medians are 77 and 77.5 characters, and the word-list heuristic rejects no option. The first draft had the correct option longest in 74% of sets, so option lengths were rebalanced before committing. The avoid-ai-writing detector reports minimal signals, all false positives (`{#id}` read as hashtags, `Game.Features` as a verb, the type-token ratio of an 8,000-word file); the read for its judgment-only patterns removed two self-labels.

For the pilot read: sections carry 540 to 800 words of content, the first 950 with its three tables. 28 variants over 12 concepts is 2.3 per concept against the Unity book's 1.2, each a scenario from another side, and is the ratio most worth a decision. There is no diagram: the call path is linear, and a vertical text fence fits any width where a one-line one overflowed. Headless Chrome will not narrow to 390 px, so phone width rests on `styles.css`, whose prose, inline code, tables and code blocks all wrap or scroll inside the page.
