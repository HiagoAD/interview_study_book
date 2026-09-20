# Interactive Study Textbook

A personal study site. You read a short section, answer questions on it, and the concepts you get wrong come back for review on a schedule. It runs entirely on your machine: no server, no account, no network. [PROJECT.md](PROJECT.md) says what it does.

## Build and open

```sh
npm install
npm run build
```

Then double-click `dist/index.html`. It is one self-contained file, so there is nothing to serve. Rebuild after you add or change content.

While you work on the site or write content:

- `npm run dev` serves it on localhost and reloads when a file changes. The Data page also gets a **Simulate today** field, to try review without waiting for days to pass. It is not in the built site.
- `npm run check` reads everything under `content/` and prints each problem as `file:line: message`.
- `npm test` runs the tests, and `npm run typecheck` type-checks.
- `npm run preview` serves the built site on localhost.

## Add content

Put Markdown files under `content/`. A book can be one file or several, and images go next to the Markdown. The format for sections, questions, math and code is in [docs/content-format.md](docs/content-format.md), which is written so that an LLM can generate a book from it. Run `npm run check`, then rebuild.

Progress is stored under the book's title and the section and concept ids, so renaming one of them loses the progress on it.

## Back up your progress

Progress lives in your browser (IndexedDB) and is tied to where the page is opened from. A moved or renamed `index.html`, another browser or a private window starts empty.

The **Data** page (`#/data`) has:

- **Export**, which saves everything to `study-progress-YYYY-MM-DD.json`.
- **Import**, which replaces all progress with a backup file after you confirm. A file that is not a valid backup is refused and changes nothing.
- **Reset** for one book.

Export before you move or rename `index.html`, and import afterwards.

If your browser will not let a page opened from `file://` store data, the site shows a banner saying progress is not being saved. It keeps working from memory, so export before you close the tab. `npm run preview` serves the same build from localhost, where storage works; progress there is separate from progress on `file://`, and export and import move it across.
