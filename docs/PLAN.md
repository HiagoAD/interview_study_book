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
- The Not-found page.
- A final pass on the styles.
- A short `README.md` covering how to build, how to open the site, how to add content (pointing to `docs/content-format.md`) and how to back up progress.
- Update CLAUDE.md so it matches the finished project.

Done when: `npm test`, `npm run typecheck`, `npm run check` and `npm run build` pass.

Manual check (user):

1. Answer something wrong. Simulate tomorrow; it appears in Review, and Home shows the count.
2. A correct review moves it to the next box. Simulate later dates through box 5; it leaves the queue.
3. Export, reset the book, then import. Progress comes back.
4. With Wi-Fi off, `dist/index.html` from `file://` works in Safari and in Chrome, and DevTools' Network tab shows no requests. If Safari blocks IndexedDB on `file://`, the banner appears.

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
