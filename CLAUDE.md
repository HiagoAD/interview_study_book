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
- `npm run check` — parses and renders everything under `content/` (Markdown, KaTeX, Shiki, images) and prints each problem as `file:line: message`.

## Layout

```
content/        study material: *.md files and their images (format: docs/content-format.md); sample/ is a demo book
pipeline/       build-time Node code (parser, renderer, loader, Vite plugin); never imported by src/
src/
  types/        content model types, and the declaration of the virtual:content module
  engine/       pure rules: option sampling, grading, local dates, scheduling, unlocking, the due list, preparing a question or a whole review (variant + options). Takes today, now and an rng as parameters; never reads the clock or Math.random
  storage/      progress: IndexedDB layer, the in-memory store written through to it, export/import, ProgressProvider and its hooks. Opening the database is given up on after 3 seconds and progress stays in memory (`persistent` is false)
  components/   QuestionCard (study and review), Html (rendered content; handles in-page links), StorageBanner (shown while progress isn't being saved), and the small pieces they use
  pages/        Home, Book, Chapter, Section, Review, Data and Not found; they read the books from virtual:content and progress from useProgress
  router.ts     hash router (#/...)
  styles.css
scripts/verify-dist.mjs   checks dist/ has only index.html, no external references and none of the dev-only UI
```

The site was built in six phases, all done. [docs/PLAN.md](docs/PLAN.md) holds the implementation decisions, the phases and a log of what each phase delivered; read it for why something is the way it is. [README.md](README.md) is for using the site; this file is for changing it.

## Notes

- **Simulate today** is a date field on the Data page that sets the date every due date and the due count use, so review can be tried without waiting. It exists only under `npm run dev`: `import.meta.env.DEV` guards it, and `verify-dist` fails the build if any of it reaches `dist/`.
- Review works from a queue captured when it starts: answering removes a concept from the due list, so the page never walks the live list.
