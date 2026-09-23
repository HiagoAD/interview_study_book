# InterviewWebsite

A website that runs entirely on the user's device. Nothing is deployed or hosted, and nothing leaves the machine.

## Constraints

- **Local only.** The site is opened from the local filesystem or a local dev server (`localhost`). Do not add deployment configs, hosting, or CI/CD for publishing.
- **No network dependencies at runtime.** Do not load scripts, stylesheets, fonts, or images from CDNs or third-party URLs. Vendor any library into the repo.
- **No external services.** No analytics, telemetry, trackers, remote APIs, or backends. Data persists only in the browser (e.g. `localStorage`, IndexedDB) or in local files.
- **Works offline.** Any change must keep the site fully usable with networking disabled.

## What the project is

An interactive study textbook: portions of content followed by questions, loaded from local files. [PROJECT.md](PROJECT.md) is the source of truth for scope and behaviour; read it before making changes.

## Stack

Vite, React and TypeScript (strict mode), with `vite-plugin-singlefile` so `npm run build` outputs a single `dist/index.html`.

- `npm run dev` — local dev server with hot reload.
- `npm run build` — type-checks, builds, then verifies `dist/` is a single self-contained file.
- `npm run preview` — serves the production build.
- `npm test` — runs the Vitest suite.
- `npm run typecheck` — type-checks without emitting.
- `npm run check` — parses and renders everything under `content/` (Markdown, KaTeX, Shiki, images) and prints each problem as `file:line: message`; on success it prints the totals, summed and per book.
- `npm run guard -- questions` — fails if any question block differs from `HEAD`, or from `--base <rev>`, ignoring line numbers; `--allow distractors` accepts changed `-` options, `--allow new-chapters` accepts every chapter none of whose sections is at the base and names each one, and `--allow structure --changes <file>` accepts the new concepts, moved or added variants, and added answers a JSON file lists. `npm run guard -- style` checks the book's prose conventions: no em dashes, no contractions, no straight double quotes in prose, and each section closing with its exercise.

## Layout

```
content/        study material: *.md files and their images (format: docs/content-format.md)
  unity-engineering/   Unity Game Engineering, the first book
  mobile-platform/     Unity Mobile Platform Engineering, the second, written from docs/mobile-platform-outline.md
pipeline/       build-time Node code (parser, renderer, loader, Vite plugin, guard); never imported by src/
src/
  types/        content model types, and the declaration of the virtual:content module
  engine/       pure rules: option sampling, grading, local dates, scheduling, unlocking, the due list, preparing a question or a whole review (variant + options). Takes today, now and an rng as parameters; never reads the clock or Math.random
  storage/      progress: IndexedDB layer, the in-memory store written through to it, export/import, ProgressProvider and its hooks. Opening the database is given up on after 3 seconds and progress stays in memory (`persistent` is false)
  components/   QuestionCard (study and review), Html (rendered content; handles in-page links and previews), Preview (the one hover card, drawn into the body), StorageBanner (shown while progress isn't being saved), and the small pieces they use
  pages/        Home, Book, Chapter, Section, Glossary, Term, Review, Data and Not found; they read the books from virtual:content and progress from useProgress
  router.ts     hash router (#/...)
  styles.css
scripts/verify-dist.mjs   checks dist/ has only index.html, no external references and none of the dev-only UI
```

The site was built in six phases, all done. Phases 7 to 10 added the glossary, its preview cards and the Unity book's entries. Phases 11 to 17 applied the review requests a teacher's read of the book left in `docs/review-requests/`; the folder keeps its README and `structure-changes.json`, the record of which concept each moved question came from. Phases 18 to 32 write the second book, Unity Mobile Platform Engineering, from [docs/mobile-platform-outline.md](docs/mobile-platform-outline.md): Phase 18 the tools, Phases 19 to 31 one chapter each, and Phase 32 a teacher's read. [docs/PLAN.md](docs/PLAN.md) holds the implementation decisions, the phases and a log of what each phase delivered; read it for why something is the way it is. [README.md](README.md) is for using the site; this file is for changing it.

## Notes

- **Simulate today** is a date field on the Data page that sets the date every due date and the due count use, so review can be tried without waiting. It exists only under `npm run dev`: `import.meta.env.DEV` guards it, and `verify-dist` fails the build if any of it reaches `dist/`.
- Review works from a queue captured when it starts: answering removes a concept from the due list, so the page never walks the live list.
- **The glossary** holds terms the book uses without defining them. A file with `kind: glossary` in its front matter holds the entries, `[[term]]` and `[[#section-id]]` link to them from anywhere, and hovering one shows a preview card. Entries carry no progress, so nothing about them touches `src/storage/`.
