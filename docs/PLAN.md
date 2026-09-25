# Implementation plan

[PROJECT.md](../PROJECT.md) says what to build. This file says how. Separate sessions build it in phases, and this file keeps their work consistent. If this file conflicts with PROJECT.md or with the code, stop and ask; don't improvise. [plan-history.md](plan-history.md) holds Phases 1 to 17, which built the site, the glossary and the Unity book's second read, with their decisions and their log; read it before changing the code they built.

## How to run a phase

1. Read [CLAUDE.md](../CLAUDE.md), [PROJECT.md](../PROJECT.md) and this file. **Decisions** and your phase's section are binding.
2. Build only your phase. Don't start work from later phases.
3. Work inline; don't spawn subagents. Codex, under **Delegated evidence**, is the one exception.
4. Before finishing, run every command in your phase's **Done when** and confirm it passes. If something fails and you can't fix it, report the output; don't hide it.
5. Append an entry to the **Phase log** at the end of this file, in about 200 words: what was built, any deviation from this plan and why, the figures your phase's **Done when** asks for, and what the next phase needs to know. Detail belongs elsewhere: a chapter phase writes what it checked, against what, and where the outline was wrong in the chapter's evidence file (see **Decisions: evidence**).
6. Commit on the feature's branch, `second-book-plan` for the second book, with a clear message. Merging into `main` is the user's decision.

**Committed question blocks.** Once a question block is committed, the reader may have answered it. So no phase changes one, in either book, without the user's explicit consent, whatever the guard would let through. The phase stops and explains what is wrong, the evidence, the proposed text and what the change costs the reader's review history, and the user decides. An approved change is committed on its own, its log entry records the consent, and later question checks run against that commit.

## Layout

```
content/                study material: *.md files and their images, any subfolders
docs/                   PLAN.md, plan-history.md (Phases 1 to 17), content-format.md,
                        mobile-platform-outline.md, evidence/ (one file per chapter, and codex/
                        with the delegation briefs, schemas and receipt checker), review-requests/
pipeline/               build-time Node code; never imported by src/
  parse.ts              file text → raw model (Markdown strings + line numbers) and errors
  render.ts             Markdown → HTML (unified, KaTeX, Shiki, images inlined)
  load.ts               find, parse, render and assemble all books; collect every error
  vite-plugin.ts        serves virtual:content
  check.ts              CLI behind `npm run check`
  guard.ts              CLI behind `npm run guard`: questions, style, options, links
  options.ts, links.ts  the figures and the link check behind two of those commands
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

**Books.** A book's id is `slug(book title)`: NFKD, strip diacritics, lowercase, runs of non-alphanumerics become `-`, then trim the dashes. Two titles with the same slug are an error. Books are ordered by title. Renaming a book changes its id, so it loses its progress. `docs/content-format.md` must say so. (Superseded by **Book ids (after Phase 19)** in the log: the id is now the `book:` line itself and the title a `title:` line, so renaming a book keeps its progress.)

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

## Feature: second book, The Platform Layer

The site can hold several books, and this feature writes the second. It covers the layer between a Unity game and the platforms it ships on: native bridges on Android and iOS, the operating system's features, third-party SDKs, both build pipelines, backend clients, CI with Jenkins, and debugging across all of them. It prepares for interviews for Unity mobile platform roles, where native integration and SDK work carry the most weight. [mobile-platform-outline.md](mobile-platform-outline.md) is the specification: every chapter, section and concept, and what each chapter's claims are checked against.

It continues the numbering under the same rules as **How to run a phase**. Phase 18 prepares the tools, Phases 19 to 31 write one chapter each, and Phase 32 reads the finished book as a teacher. Everything in **Decisions** still holds.

Three things it leaves alone. **The product:** Home lists books by title, Review and the due count span books, and Data resets one book at a time, so a second book needs no change in `src/`. **PROJECT.md**, including its non-goal of links between books. **The Unity book:** every phase checks that its question blocks still match, and no phase edits its prose.

### Decisions: the book

| Decision | Default | Alternative |
| --- | --- | --- |
| Title and id | The Platform Layer, first titled Unity Mobile Platform Engineering; id `unity-mobile-platform-engineering` | Another title at any time: since **Book ids (after Phase 19)** the id is the `book:` line, so a new title keeps the progress |
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
- A section is as long as its content needs, and asks as many questions as it takes to validate that content: a concept gets the `?+` variants that test it from the sides the section teaches, and there is no set number. Concepts are one idea each, as many as the outline gives the section.
- The distractor standard from the start. Each `-` is a mistake an engineer makes. The word-list heuristic (always, never, every, automatically, only, guarantees, cannot, forbids) gains nothing. Correct and wrong options have similar median lengths; the Unity book's are 73 and 65 characters. A yes-or-no set includes a “No” with a wrong reason. Each variant tests its own concept, and each explanation stands alone.
- **Questions outlive facts.** Version numbers, API levels, dates, fees, quotas and limits may appear in prose, with the version or date they were checked against, but never as a correct answer. The review queue repeats a concept for a month and more, and would go on reinforcing a figure after it changed.
- `[[term]]` at a term's first mention in a section, and `[[#id]]` back to an earlier section of this book; never inside a heading or a code span, or in a question block that has been committed. An external link is documentation the reader chooses to open, and returns HTTP 200 with no redirect when it is written.
- Code fences: `csharp`, `java`, `objective-c`, `objective-cpp`, `swift`, `groovy` for `build.gradle` files and Jenkinsfiles, `kotlin` for `.kts` files, `xml` for manifests, property lists and entitlements, `ruby` for Podfiles, `properties`, `bash`, `json` and `http`. Shiki has no `gradle` or `plist`.
- Every new sentence passes the avoid-ai-writing skill's detector, run one section at a time with `--context technical --source-mode rendered-markdown`, since it refuses a whole chapter as too long. It passes when it reports nothing beyond its known false positives: `{#id}` and `[[#id]]` read as hashtags, dotted names such as `Game.Features` read as verbs, low vocabulary diversity, which is an effect of length in technical prose, and the uniform punctuation of question blocks. Its judgment-only patterns still need a read.
- Quotations from Unity's, Android's or Apple's documentation are evidence for the writer, contractions included, and never text for the book.

### Decisions: evidence

The Unity book was checked after it was written, and that read found thirty problems. This book checks its claims while it is written. A claim that cannot be checked is narrowed to what can be, or cut, and the chapter's evidence file says which.

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

**The evidence file.** Each chapter phase writes a file in `docs/evidence/` named like its chapter file, such as `04-os-integration.md`: what each claim was checked against, section by section; what rests on documentation alone; what was narrowed or cut; and where the outline fell short. Phase 32 reads it beside the chapter. The files for chapters 01 to 03 hold what the logs of Phases 19 to 21 recorded.

**The probe project** is one Unity 6000.3 project outside the repo, created in Phase 20 and reused by the phases after it. It is never committed, and the Phase 20 log records its path. Other scratch programs stay outside the repo too.

**Delegated evidence (from Phase 24).** Codex gathers the chapter's evidence and reads the finished chapter blind; the session writes. The briefs, their schemas and the receipt checker are in `docs/evidence/codex/`, and the Codex CLI is the one bundled with the VS Code extension (`ls -d ~/.vscode/extensions/openai.chatgpt-*/bin/macos-aarch64/codex`).

- Evidence: `codex exec -m gpt-6-sol -c model_reasoning_effort="xhigh" -s workspace-write -c sandbox_workspace_write.network_access=true -c approval_policy="never"`, with `--add-dir` for the probe project and the session's scratchpad, the brief `docs/evidence/codex/brief.md` filled in with the outline's chapter section, and `--output-schema docs/evidence/codex/evidence.schema.json -o <answer.json>`. Codex writes only the chapter's evidence file and lists the runs it needs, which the session batches in one script. The session reads the answer file, and the log only to see why a run failed.
- Receipts: `python3 docs/evidence/codex/check_receipts.py <answer.json>` re-fetches every quote, and a `guard -- receipts` command can replace it later. The session reads the quotes behind each correct answer and explanation premise; a quote that does not state the claim counts as no receipt.
- Review: `-m gpt-6-astra -c model_reasoning_effort="xhigh" -s read-only` with `docs/evidence/codex/review.md` and `review.schema.json`. Each problem is judged, and those that hold are fixed. Every Codex model draws on one usage allowance, so the evidence runs on Sol, which uses a smaller share of it, and the review runs after the evidence.
- **When Codex is blocked.** A blocked run exits within seconds with a usage-limit error that names its reset time, and writes no answer file. Another model is no way around it, since they share the allowance. For the evidence and for the review alike:
  1. If the reset is within two hours, schedule the step for the reset in a background command, and carry on with the parts of the phase that do not need it.
  2. Otherwise, or if Codex does not start at all, the session does the step itself: the evidence under rule A, written to the same receipts JSON so that the checker and the evidence file work unchanged, with sentences pulled out by scripts rather than whole pages read; and the teacher's read of step 4 in place of the review.

  The chapter is not committed before one of these reviews has run, since a committed question block changes only with the user's consent. The log names the step each part used.
- The log records Codex's time and tokens, the receipts that failed, and what the review caught.

**Before Phase 18,** accept the Xcode license once: `sudo xcodebuild -license accept`. Until then `/usr/bin/git`, `python3` and every Xcode tool exit with status 69, so `npm run guard -- questions` cannot read a revision and no Objective-C or Swift compiles. Putting `/Library/Developer/CommandLineTools/usr/bin` first on `PATH` restores `git`, and nothing else.

### Decisions: tools

- `npm run guard -- questions --allow new-chapters` accepts the sections and concepts of every chapter none of whose sections exists at the base revision, and says how many it accepted. Everything else stays strict: a new book passes, while a new section in an existing chapter fails, and so does any change to a committed question block. A chapter is recognized by its sections, because its title may change.
- `npm run check` prints each book's totals after the sums, so a phase can compare the new book with the outline.
- `npm run guard -- style` already reads every content file, so it needs no change.
- `npm run guard -- options [--book <id>]` gives the figures the distractor standard is measured by, per chapter file and per book: how often the correct option is the longest or the shortest of its set, the median lengths of correct and wrong options, and how often each holds a word from the list, with whether rejecting those options would gain anything. It counts every option a variant lists, through the site's own parser.
- `npm run guard -- links [--base <rev> | --all]` checks each external link that is new since `<rev>`, or every link, for HTTP 200 with no redirect. It asks for English, because Node's default `Accept-Language: *` makes Google's documentation sites redirect to a locale picked at random. It is the only command that needs the network, and neither `npm test` nor `npm run build` runs it.

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
2. Check the chapter's claims before writing, per **Decisions: evidence**, with probes outside the repo. From Phase 24, Codex gathers them, as **Delegated evidence** says.
3. Write the chapter file. Add glossary entries for the terms it uses without defining them, and link their first mentions.
4. Read it back as a teacher: each claim against its evidence, each question against the standard, with the word list and the option lengths measured by `npm run guard -- options`. From Phase 24, Codex's blind review is this read, and the session judges what it reports.
5. Run the avoid-ai-writing detector over the new prose and fix what it reports.

**Every chapter phase's Done when:**

- `npm run check`, `npm test` and `npm run build` pass, and so does `npm run guard -- style`.
- `npm run guard -- questions --allow new-chapters --base <the phase's starting commit>` passes and accepts this chapter and nothing else.
- `npm run check`'s line for the book matches the outline's figures for the chapters written so far, and reports no entry that nothing links to.
- `npm run guard -- links --base <the phase's starting commit>` passes: every external link the phase adds returns HTTP 200 with no redirect.
- The no-brand search stays empty.
- The chapter's evidence file says what was checked, against what, and where the outline was wrong. The phase log gives the chapter's line from `npm run guard -- options`, the terms added and, from Phase 24, the figures that **Delegated evidence** asks for.

Manual check (user): read the chapter in `npm run dev` and answer its questions.

**A committed chapter is progress.** The reader may start it at once, so later phases change its question blocks only the way the Unity book's editing passes did: `-` lines under `--allow distractors`, and anything else through a changes file under `--allow structure`, with the cost to the reader's review history stated. Each change needs the user's explicit consent first, as **Committed question blocks** under **How to run a phase** says.

**Phase 19 is a pilot.** The user reads chapter 1 before Phase 20 starts. A change to depth, length or tone goes into this section first, so the other twelve chapters are written to it rather than rewritten. The user read it on 2026-09-24: depth and tone stand, question counts and section lengths follow the content, as the writing rule above now says, and the layout works on phones.

**Phase 31's link pass.** Earlier chapters mention later ones in plain text. Where a link helps the reader, the mention becomes a `[[#id]]` in prose, never in a question block.

### If time runs short

If an interview comes before the book is done, run the phases in the order of what the interview weighs most: 19 to 22 (the boundary and native integration), 25 (SDKs) and 30 (debugging across boundaries), then 23, 24, 26 to 29, and 31. The book's order stays as it is, because the file names fix it. A chapter written early explains in place the little it needs from an unwritten one, names that chapter in plain text, and Phase 31's link pass connects them.

### Phase 32: A teacher's read

Read the whole book in order, as the Unity book's second read did: every claim, code sample, worked number and question, testing the doubtful ones against **Decisions: evidence**, with each chapter's evidence file beside it to show what was checked while it was written and what rests on documentation alone. Write one file per problem in `docs/review-requests/`, with the kinds and priorities its README defines. A later section of this plan orders them into phases, as Phases 11 to 17 did.

Done when: every chapter has been read in order, each problem has its file and its row in the README, and the phase log counts the requests by kind and priority.

## Phase log

Phases 1 to 17 are logged in [plan-history.md](plan-history.md).

### Phase 18: Tools for a second book

Built `questions --allow new-chapters` in `pipeline/guard.ts`: a chapter none of whose sections is at the base is accepted, sections, concepts and all, and the command names each accepted chapter with its counts; every other difference stays strict. `pipeline/check.ts` prints each book's totals after the sums, through an exported `totalsLines` built on `summarize`, and now runs only when executed, as the guard does. Six new tests, 658 in all: with the option on, a new chapter and a new book pass, while a new section, a new concept and a changed `*` line in an existing chapter each fail, a renamed chapter is still compared strictly, and a concept moved into a new chapter is reported as moved; `check.test.ts` covers the per-book lines. Breaking the new logic four ways failed the suite each time. On the real content, a scratch `content/mobile-platform/99-scratch.md` passed with the option and failed without it, and a new section in chapter 03 and a changed `*` line in chapter 09 each failed with it; every Unity file matched its checksum afterwards.

Rules the plan left open: `--allow` still takes one value, and a chapter is new only when none of its sections is at the base, so a renamed chapter that gains one section fails on that section.

Next phase: the Xcode license is accepted, so `/usr/bin/git`, `python3` and `xcodebuild` (Xcode 27.0) all run. The Unity book's id is `unity-game-engineering`; `check` prints the new book as `unity-mobile-platform-engineering` followed by its counts.

### Phase 19: Chapter 01, the pilot

Wrote `content/mobile-platform/01-platform-layer.md` (6 sections, 12 concepts, 28 variants, with the outline's ids) and `content/mobile-platform/glossary.md`, whose 12 entries the chapter links: assembly definition, deep link, Edit Mode and Play Mode tests, idempotence, IL2CPP, JNI, managed code stripping, observer, P/Invoke, push token, R8 and strategy. `npm run check` reports the book as 1 chapter, 6 sections and 12 concepts, with 12 terms, 14 links and no unlinked entry; `questions --allow new-chapters --base 7ae9396` accepts this chapter and nothing else; the nine external links return 200 with no redirect; the no-brand search is empty.

What was checked, against what, and where the outline fell short: [evidence/01-platform-layer.md](evidence/01-platform-layer.md).

Question figures: the correct option is the longest of its set in 22% of the 27 choice sets and the shortest in 22% (the Unity book: 48% and 24%), the medians are 77 and 77.5 characters, and the word-list heuristic rejects no option. The first draft had the correct option longest in 74% of sets, so option lengths were rebalanced before committing. The avoid-ai-writing detector reports minimal signals, all false positives (`{#id}` read as hashtags, `Game.Features` as a verb, the type-token ratio of an 8,000-word file); the read for its judgment-only patterns removed two self-labels.

For the pilot read: sections carry 540 to 800 words of content, the first 950 with its three tables. 28 variants over 12 concepts is 2.3 per concept against the Unity book's 1.2, each a scenario from another side, and is the ratio most worth a decision. There is no diagram: the call path is linear, and a vertical text fence fits any width where a one-line one overflowed. Headless Chrome will not narrow to 390 px, so phone width rests on `styles.css`, whose prose, inline code, tables and code blocks all wrap or scroll inside the page.

### Position bar (after Phase 19)

A section page now opens with `ChapterPosition`, a bar pinned to the top: "Section N of M" with the chapter title, the percentage of this section's content scrolled through, and a track with one segment per section (earlier ones full, this one filling, unlocked ones linking to their section, locked ones dimmed). Sections have no subheadings, so depth is measured over the content block alone: `readingDepth` (pure, tested) is 0 while the content's top is at or below the bar and 1 once its bottom reaches the bottom of the viewport, and the questions below it do not count. The page gets `scroll-padding-top` while the bar is on it, so Reread content, footnotes and revealed cards stop below the bar rather than under it. The locked page shows the bar without a percentage. Checked in headless Firefox from `file://` at 1100px and 390px: the percentage follows the scroll, the chapter title truncates on a phone and there is no horizontal scroll.

### Book ids (after Phase 19)

A book's id is now its `book:` line, and its title is a `title:` line in one of its files, so a book can be renamed without losing its progress. Both books kept the ids their titles had made: every file's `book:` line became `unity-game-engineering` or `unity-mobile-platform-engineering`, and each book's first chapter file gained its `title:`. `assembleBooks` groups files by id. A book with no `title:` shows its id, a second `title:` in one book is an error, and so are two books with the same title. A `book:` value that is not an id is an error whose message names the id it would make and the `title:` line to add. Chapter ids still come from chapter titles, but progress is keyed by section and concept ids, so renaming a chapter changes only its route. `docs/content-format.md`, PROJECT.md's examples and the README say so.

The guard parses its base revision with the current parser, and content from before this change names its book by title, so `withBookId` in `pipeline/guard.ts` reads such a `book:` line in the base as the slug it made. It rewrites the line in place, so line numbers hold, and content in the working tree gets no such allowance. Against `a8b89af` the guard reports the same 61 differences as the code at `58ef4a4`, one line lower in the two files that gained a `title:`.

Tests: 666, up from 661. They cover a new title keeping the id, books ordered by title, a second title and a shared title as errors, a title written where the id goes, and a base that names its book by title comparing cleanly with `\n` or `\r\n` line ends. Breaking the logic four ways failed the suite each time: the guard reading old bases unchanged, the id made from the title again, a second title winning silently, and `book:` accepting any text. The build is byte-identical to the one before the change. In headless Firefox from `file://`, over WebDriver BiDi, one completed section in each book showed "1 of 80" and "1 of 6" on Home; after both books were renamed to The Game Layer and The Platform Layer and rebuilt, Home showed the new titles with the same counts and the same `#/b/` routes. The titles were then restored.

### Book and site names (after Phase 19)

The site is now The Unity Stack: in the browser tab, as Home's heading (which said "Books"), and at the top of the README and PROJECT.md. The books are The Game Layer and The Platform Layer, the code inside a game and the layer between it and the platforms it ships on, named as two layers of one stack. Each rename is one `title:` line, and the ids are unchanged, so progress carries over. The second book's opening section named the first by its old title and now names *The Game Layer*, in italics so it does not read as the phrase "the game layer"; the outline asks later chapters to do the same. The outline, CLAUDE.md, and this plan's second-book heading and decisions use the new names, while the log keeps the old ones where it records what happened then. The repository folder and `package.json` keep `interview-website`. Home sorts books by title, and the new titles keep the reading order. Checked in headless Firefox from `file://` at 1100px and 390px: the tab and the heading say The Unity Stack, the books list in reading order under their unchanged routes, and there is no horizontal scroll.

### Phase 20: Chapter 02, calling Android from C# and back

Wrote `content/mobile-platform/02-android-bridge.md` (6 sections, 12 concepts, 38 variants, the outline's ids) and five glossary entries: ABI, ANR, Gradle, Logcat, Maven coordinates; the JNI entry now links the two new sections. `npm run check` reports the book as 2 chapters, 12 sections, 24 concepts, 17 terms and 29 links with no unlinked entry; `questions --allow new-chapters --base de784c7` accepts this chapter alone; the 19 external links return 200 with no redirect. **The probe project is `/Users/hiago/Documents/PlatformLayerProbe`** (Unity 6000.3.11f1, never committed; its README lists the three batch exports: Gradle with GameActivity, Gradle with Activity, Xcode). It holds the chapter's Java and C# samples, a `.androidlib`, a hand-built AAR, a JAR and a one-ABI `.so`; all exports succeed with no warnings, and the Java compiles under `javac -Xlint:all -Werror` against `android.jar` 36 and `classes.jar`.

What was checked, against what, and where the outline fell short: [evidence/02-android-bridge.md](evidence/02-android-bridge.md).

Question figures: correct option longest in 27% of 33 choice sets and shortest in 27%, medians 69 and 70 characters, no option uses the word list. The avoid-ai-writing skill, its detector in technical mode plus its judgment-only catalog, rated the chapter's prose 1 and the five new entries 4, both "Minimal AI signals", and found no vocabulary hits. Four bold, period-ended list labels in `android-activity-integration` became plain colon labels, since the book uses no bold labels anywhere else, and the ANR paragraphs in `android-failure-evidence` now say main thread where they had switched to game loop for the same thread. Its low vocabulary-diversity flag (a length effect in 5,000 words of technical prose) and its six hashtags (the `[[#section-id]]` link targets) are false positives; three "X, not Y" contrasts and the true three-item lists stay, because each carries information. No question block changed.

### Phase 21: Chapter 03, calling iOS from C# and back

Wrote `content/mobile-platform/03-ios-bridge.md` (6 sections, 12 concepts, 47 variants, the outline's ids; the second section's title is “DllImport, __Internal, and marshaling”, since the guard reads the quotes in `DllImport("__Internal")` as prose) and seven glossary entries: App extension, ARC, Dispatch queue, dSYM, Entitlements, Info.plist and TestFlight; the P/Invoke and IL2CPP entries now link the new sections. `npm run check` reports the book as 3 chapters, 18 sections, 36 concepts, 113 variants, 24 terms and 40 links with no unlinked entry; `questions --allow new-chapters --base 58a2436` accepts this chapter alone; the 25 external links return 200 with no redirect; the no-brand search is empty. Each native and C# sample the chapter prints sits byte for byte in the probe project (README updated) and builds for the iOS Simulator SDK and, unsigned in Release, for the device SDK, with no warnings.

What was checked, against what, and where the outline fell short: [evidence/03-ios-bridge.md](evidence/03-ios-bridge.md).

Question figures: the correct option is the longest of its set in 21% of the 43 choice sets and the shortest in 19%, the medians are 70 and 70 characters, and no option uses the word list; a first draft had the correct option longest in 47% of sets. The avoid-ai-writing detector, run per section in technical mode, rated every part “Minimal AI signals”, and the read for its judgment-only patterns removed two self-labels, a vague “worth checking” and one cliché contrast; its remaining flags are the length effect on vocabulary diversity, the uniform punctuation of question blocks, and `{#id}` and `[[#id]]` read as hashtags.

Next phase: in 6000.3.11f1, iOS hands a link that opens the running app to the scene delegate, and `UnityScene` has no `scene:openURLContexts:`. In the Simulator, a link the app opened for itself reached a handler added to `UnityScene` and reached neither `onOpenURL:` nor `Application.deepLinkActivated`, and `Application.absoluteURL` stayed empty. Chapter 4 has to settle warm and cold links on iOS (the cold path went untested, since `simctl openurl` stops at a confirmation that a headless run cannot answer), and chapter 1's sentence that Unity raises `deepLinkActivated` for links that arrive while the app runs may need an iOS caveat in Phase 32. The push token notification is compiled out while `UNITY_USES_REMOTE_NOTIFICATIONS` is 0, which is the export's default.

### Plan and tools (after Phase 21)

Asked for by the user on 2026-09-25. Phases 1 to 17, with their feature sections and log, moved to `plan-history.md`, and the evidence paragraphs of Phases 19 to 21 to `docs/evidence/`; a script confirmed that all 345 paragraphs of the old file survive word for word, one of them split in two. New rules: a committed question block changes only with the user's explicit consent; a log entry runs about 200 words, and the chapter's evidence file takes the detail; the detector's known false positives are named; commits go on the feature's branch.

`guard -- options` and `guard -- links` are new, with 9 tests (675 in all). `options` reproduces the word-list and median figures Phases 16 and 17 logged for the Unity book, and counts three more choice sets than the logs of Phases 20 and 21: chapter 02 holds 35 (correct option longest in 29%, shortest in 29%, medians 71 and 70) and chapter 03 holds 44 (25%, 18%, 71 and 70). `links --base 58a2436` passes chapter 03's 25 links. `--all` finds that Microsoft Learn's `GetHashCode` page, linked in the Unity book's chapter 04 prose, now redirects to `?view=net-10.0`; it is left as it is.

Next phase: `UnityScene` in 6000.3.11f1 implements none of the scene delegate's URL methods, and Apple's TN3187 says an app built with the SDK after iOS 26 must use scenes, so cold links on iOS may be lost as well as warm ones. If they are, chapter 01's `platform-early-event` explanation needs a correction, and that needs the user's consent.

### Phase 22: Chapter 04, lifecycle, permissions, links, notifications, and sign-in

Wrote `content/mobile-platform/04-os-integration.md` (5 sections, 10 concepts, 34 variants, the outline's ids) and seven glossary entries: Android Keystore, Custom Tabs, Keychain, OAuth, Play App Signing, Provisioning profile and Scene delegate. Phase 23 was committed first, so the checks run against `69781db`: `questions --allow new-chapters` accepts this chapter alone, its 23 new links return 200, and `check` reports the book as 5 chapters, 28 sections, 57 concepts, 35 terms and 71 links with no unlinked entry. Options: correct longest in 24% of 34 sets, shortest in 18%, medians 74.5 and 74, no word-list option. Evidence and the one run: [evidence/04-os-integration.md](evidence/04-os-integration.md).

Two deviations, piloted at the user's request. A: evidence cheapest first, with a run only where documentation and shipped files were silent. B: Codex (GPT-6 Astra, `xhigh`) gathered the evidence in 42 minutes and 276,965 tokens, 100 receipts for 97 claims, and none was misquoted when a script re-fetched them (6 first-pass failures: 5 in the checker's normalization, 1 a Simulator command its sandbox could not run). That run spent the plan's shared Astra and Sol allowance, so the blind review waited an hour, then took 9.5 minutes and 273,809 tokens and found 8 problems, all of which held and are fixed.

The run: Unity 6000.3.11f1 loses custom-scheme links on iOS, cold and warm, since `UnityScene` implements no scene URL method; the chapter prints a category that restores both. By the user's choice, chapter 01's `platform-early-event` stays as it is.

### Phase 23: Chapter 05, Android builds

Wrote `content/mobile-platform/05-android-builds.md` (5 sections, 11 concepts, 39 variants, the outline's ids) and four glossary entries: AAB, Android Gradle Plugin, bundletool and EDM4U; the Gradle, Maven coordinates and R8 entries now link the new sections. `npm run check` reports the book as 4 chapters, 23 sections, 47 concepts, 152 variants, 28 terms and 54 links with no unlinked entry; `questions --allow new-chapters --base c3597b8` accepts this chapter alone; the 18 external links return 200 with no redirect; the no-brand search is empty.

Deviation: the phase ran in a cloud container, in parallel with Phase 22, so chapter 4 is named in plain text. The container had no Editor, probe project or Android SDK, and its network policy blocked Unity's documentation and downloads, `dl.google.com`, and Gradle's and Play's help pages, so the probe's Gradle export was not built. Gradle 8.13, R8 8.10.21, bundletool 1.17.2, Unity's C# reference source and packages, EDM4U's source and Android's pages stood in, and the chapter was narrowed to them: [evidence/05-android-builds.md](evidence/05-android-builds.md).

Question figures: correct option longest in 24% of 37 choice sets and shortest in 22%, medians 70 and 70, no option uses the word list. The avoid-ai-writing skill is not installed in the container; a manual pass for its patterns removed a self-label, a cliché, a superlative and a vague “worth copying”.

Next phase: on the Mac, 6000.3's templates can settle what this chapter left to other sources: whether a non-exported build compiles `libil2cpp.so` inside Gradle, the Publishing Settings label for `proguard-user.txt`, and the manifest order in an AGP build.

### Delegated evidence (after Phase 23)

Asked for by the user on 2026-09-25, after Phase 22's pilot. **Delegated evidence**, under **Decisions: evidence**, makes the pilot the rule from Phase 24: Codex gathers the evidence on GPT-6 Sol at `xhigh` and reads the chapter blind on GPT-6 Astra at `xhigh`, the session writes, and a fallback covers a blocked Codex, whose models share one allowance. The settings follow published guidance the user asked for: Sol comes closest to Astra on long agentic work at a smaller share of the allowance, and reviews gain most from high effort. `docs/evidence/codex/` holds the two briefs as templates, their schemas, and the receipt checker Phase 22 used; the checker is Python for now, with a page cache outside the repo, and passes all 100 of Phase 22's receipts.

### Phase 24: Chapter 06, iOS builds

Wrote `content/mobile-platform/06-ios-builds.md` (4 sections, 8 concepts, 30 variants, the outline's ids) and four glossary entries: App Store Connect, App Transport Security, CocoaPods and Privacy manifest; four older entries now link the new sections. `npm run check` reports the book as 6 chapters, 32 sections, 65 concepts, 216 variants, 39 terms and 84 links with no unlinked entry; `questions --allow new-chapters --base 23425df` accepts this chapter alone; its 17 new links return 200; the no-brand search is empty. The probe's Xcode export archives unsigned, and exporting it needs a team this Mac lacks. Evidence and runs: [evidence/06-ios-builds.md](evidence/06-ios-builds.md).

Codex (GPT-6 Sol, `xhigh`) gathered the evidence in 26 minutes and 313,903 tokens: 76 receipts, none failed on re-fetch, and the session's 78 more, from two batches of runs, passed too. The blind review (GPT-6 Astra, `xhigh`) hit the shared limit after a minute and 105,754 tokens, with the reset three hours off, so the session read the chapter as a teacher. That read caught a wrong correct answer: an unsigned archive records no team even with `DEVELOPMENT_TEAM` set, so the variant now names `teamID` in the export options.

Options: correct option longest in 20% of 30 sets and shortest in 20%, medians 65.5 and 65, no word-list option; the detector found minimal signals. The outline was wrong about plain HTTP: a default Unity 6.3 project refuses it on both platforms, at Unity's own check.

Next phase: a Sol evidence run and an Astra review did not fit in one allowance window; starting the review after the reset avoids the fallback.
