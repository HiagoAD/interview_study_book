# Implementation plan

[PROJECT.md](../PROJECT.md) says what to build. This file says how. Separate sessions built it in Phases 1 to 35, and all of them are done: the site, the glossary and its previews, the Unity book's second read, and the second book, The Platform Layer. [plan-history.md](plan-history.md) holds every phase's decisions, specification and log. Its decisions still bind: read the site's **Decisions** before changing the code, and **Feature: second book** (the book, writing rules, evidence, tools and system design) before changing the second book. If this file conflicts with PROJECT.md or with the code, stop and ask; don't improvise.

## How to run a phase

1. Read [CLAUDE.md](../CLAUDE.md), [PROJECT.md](../PROJECT.md) and this file. The decisions here and your phase's section are binding, and so are the site's **Decisions** in [plan-history.md](plan-history.md), which a phase reads before changing the code they describe.
2. Build only your phase. Don't start work from later phases.
3. Work inline; don't spawn subagents. Codex, under **Delegated evidence**, is the one exception.
4. Before finishing, run every command in your phase's **Done when** and confirm it passes. If something fails and you can't fix it, report the output; don't hide it.
5. Append an entry to the **Phase log** at the end of this file, in about 200 words: what was built, any deviation from this plan and why, the figures your phase's **Done when** asks for, and what the next phase needs to know. Detail belongs elsewhere: a chapter phase writes what it checked, against what, and where the outline was wrong in the chapter's evidence file (see **Decisions: evidence**).
6. Commit on the feature's branch, `second-book-plan` for the second book, with a clear message. Merging into `main` is the user's decision.

**Committed question blocks.** Once a question block is committed, the reader may have answered it. So no phase changes one, in either book, without the user's explicit consent, whatever the guard would let through. The phase stops and explains what is wrong, the evidence, the proposed text and what the change costs the reader's review history, and the user decides. An approved change is committed on its own, its log entry records the consent, and later question checks run against that commit.

## Layout

```
content/                study material: *.md files and their images, any subfolders
docs/                   PLAN.md, plan-history.md (every phase's decisions, specification and log),
                        content-format.md, mobile-platform-outline.md, evidence/ (one file per
                        chapter, and codex/ with the delegation briefs, schemas and receipt
                        checker), review-requests/, reader-review-plan.md and reader-reviews/
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

## Status

Every planned phase is done. What remains open, for a later section of this file to order into phases when the user asks:

- The 27 requests Phase 35 left in [review-requests/](review-requests/README.md). Eight touch committed question blocks.
- The [editing plan](reader-reviews/2026-09-29-b53e4f0/editing-plan.md) of the reader review, with 31 open findings; two of them overlap those requests.
- The user's manual read of chapters 15 and 16 in `npm run dev`.
- One link in the Unity book that now redirects: `content/unity-engineering/04-csharp-fundamentals.md:102`.

A phase that edits the second book follows **Committed question blocks** above and the checks under **Every chapter phase's Done when** in plan-history.md, with the strict question guard, or its `--allow` mode for an approved change, in place of `--allow new-chapters`.

## Phase log

Phases 1 to 35 are logged in [plan-history.md](plan-history.md).
