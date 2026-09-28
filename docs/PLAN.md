# Implementation plan

[PROJECT.md](../PROJECT.md) says what to build. This file says how. Separate sessions build it in phases, and this file keeps their work consistent. If this file conflicts with PROJECT.md or with the code, stop and ask; don't improvise. [plan-history.md](plan-history.md) holds the site's **Decisions** and Phases 1 to 17, which built the site, the glossary and the Unity book's second read, with their decisions and their log; read it before changing the code they built. It also holds the log of Phases 18 to 29.

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
docs/                   PLAN.md, plan-history.md (the site's decisions, Phases 1 to 17, the log
                        to Phase 29), content-format.md, mobile-platform-outline.md, evidence/
                        (one file per chapter, and codex/ with the delegation briefs, schemas and
                        receipt checker), review-requests/
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

## Feature: second book, The Platform Layer

The site can hold several books, and this feature writes the second. It covers the layer between a Unity game and the platforms it ships on: native bridges on Android and iOS, the operating system's features, third-party SDKs, both build pipelines, backend clients, the design of the game's own services, CI with Jenkins, and debugging across all of them. It prepares for interviews for Unity mobile platform roles, where native integration and SDK work carry the most weight. [mobile-platform-outline.md](mobile-platform-outline.md) is the specification: every chapter, section and concept, and what each chapter's claims are checked against.

It continues the numbering under the same rules as **How to run a phase**. Phase 18 prepares the tools, Phases 19 to 34 write one chapter each, and Phase 35 reads the finished book as a teacher. Everything in the site's **Decisions**, in plan-history.md, still holds. The plan had thirteen chapters until 2026-09-26, when chapters 12 to 14 on system design were added (see **Decisions: system design**). The debugging and interview chapters moved from 12 and 13 to 15 and 16, and the teacher's read from Phase 32 to Phase 35. Log entries written before that date use the old numbers.

Three things it leaves alone. **The product:** Home lists books by title, Review and the due count span books, and Data resets one book at a time, so a second book needs no change in `src/`. **PROJECT.md**, including its non-goal of links between books. **The Unity book:** every phase checks that its question blocks still match, and no phase edits its prose.

### Decisions: the book

| Decision | Default | Alternative |
| --- | --- | --- |
| Title and id | The Platform Layer, first titled Unity Mobile Platform Engineering; id `unity-mobile-platform-engineering` | Another title at any time: since **Book ids (after Phase 19)**, logged in plan-history.md, the id is the `book:` line, so a new title keeps the progress |
| Folder | `content/mobile-platform/`: `01-…md` to `16-…md`, and `glossary.md` | None |
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
- Code fences: `csharp`, `java`, `objective-c`, `objective-cpp`, `swift`, `groovy` for `build.gradle` files and Jenkinsfiles, `kotlin` for `.kts` files, `xml` for manifests, property lists and entitlements, `ruby` for Podfiles, `properties`, `bash`, `json`, `http`, `sql` for schemas and queries, and `text` for component diagrams. Shiki has no `gradle` or `plist`.
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

**The evidence file.** Each chapter phase writes a file in `docs/evidence/` named like its chapter file, such as `04-os-integration.md`: what each claim was checked against, section by section; what rests on documentation alone; what was narrowed or cut; and where the outline fell short. Phase 35 reads it beside the chapter. The files for chapters 01 to 03 hold what the logs of Phases 19 to 21 recorded.

**The probe project** is one Unity 6000.3 project outside the repo, created in Phase 20 and reused by the phases after it. It is never committed, and the Phase 20 log records its path: `/Users/hiago/Documents/PlatformLayerProbe`. Other scratch programs stay outside the repo too.

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

### Decisions: system design

Asked for by the user on 2026-09-26: platform engineers at game studios often own the game's services or share them with backend engineers, so the book covers system design for game services, to a firm middle ground rather than a backend specialist's depth. The outline's **Scope and reader** says what the reader can do after chapters 12 to 14 and where they stop, and that paragraph is binding.

What the research found, and what the chapters are built from:

- Guides to game studios' design rounds report the same prompts: a leaderboard for millions of players, matchmaking with low waits, a session service with disconnects, a live event pushed to every connected client, telemetry made queryable, chat and friends, an inventory or economy ([one guide](https://www.designgurus.io/answers/detail/what-to-expect-in-the-epic-games-system-design-interview), [another](https://www.systemdesignhandbook.com/guides/roblox-system-design-interview/), [a candidate's report](https://www.linkjob.ai/interview-questions/roblox-software-engineer-interview/)). They grade requirements gathering, a clear component diagram, reasoning about scale, and trade-offs stated honestly.
- Mobile system design rounds ask the same kind of prompt from the client's side: offline behavior, sync and conflicts, pagination, real-time updates, push, idempotent requests, and rate limits so that a large client base does not overwhelm its own backend ([a framework](https://github.com/weeeBox/mobile-system-design)). That side is where a platform engineer goes deepest, and chapters 8 and 9 already cover it.
- Published architectures agree on the pieces: stateless services, durable per-player data, a server-owned economy, leaderboards on in-memory sorted sets, matchmaking tickets in queues, persistent connections with pub/sub for presence and chat, and a stateless tier in front of them ([a cloud vendor's database guide for games](https://aws.amazon.com/blogs/gametech/player-profiles-to-leaderboards-choosing-the-right-aws-database-part-2/), [a large mobile studio's social backend](https://www.scylladb.com/2025/01/14/how-supercell-handles-real-time-persisted-events-with-scylladb/)). Purchases are verified and granted on the server before they are acknowledged ([Google Play](https://developer.android.com/google/play/billing/backend)). Launches and outages are survived with login queues, rate limits, and capacity restored in slices ([a survey of launch incidents](https://www.cgmagonline.com/articles/how-online-games-stay-up)).

These links are for the plan's readers. The book's text never names the studios or games behind them, and each phase finds its own evidence.

| Decision | Default | Alternative |
| --- | --- | --- |
| Where | Chapters 12 to 14, after the client chapters 8 and 9 and before debugging (15) and interview practice (16), so debugging walks a path whose backend the reader has designed | A third book, which would split one role's preparation across two books |
| Depth | Mechanisms and trade-offs at interview depth, with numbers from estimates; consensus, storage engines, replication internals, orchestration and netcode implementation named, with the property a design needs from each | A backend specialist's depth, which would double the chapters |
| Names | Open-source server software by name as one example of its category, where interviews name it: Redis and its sorted sets, PostgreSQL, SQLite. Unity Gaming Services by name, as Unity's own. Cloud vendors' products and third-party game backends by category. Algorithms and patterns by their names (Elo, Glicko, TrueSkill, CAP, saga, outbox). Never a game, studio or publisher, including in the incidents chapter 14 describes | Naming cloud products |
| Worked example | The book's imaginary live game, now with its backend. Estimates use round, invented figures and say so | A real game's published figures, which the names rule forbids |
| Diagrams | Component diagrams as `text` fences like chapter 01's call path, which fit any width. The book's limit of one SVG per chapter still holds | An SVG per section |
| Evidence | The claims are about documented behavior rather than a Unity build, so **Rule A** applies with these sources: the software's own reference (Redis's commands and their stated complexity, PostgreSQL's transactions and isolation, one queue's delivery guarantee); the stores' server APIs and notifications; APNs's and FCM's pages; Google's SRE books; papers for CAP; Unity's pages for Addressables, Netcode for GameObjects, Relay and Unity Gaming Services. SQLite 3.51 (installed) and .NET 8 probes run the schema, transaction, constraint and version-check samples | A cloud account, which the project does not have |
| A local Redis | Not installed. Phase 31's leaderboard lab runs against a Redis-compatible server from Homebrew only if the user agrees to install one when the phase starts; otherwise a .NET sorted structure stands in, and the evidence file says so | None |

**Phase 30 also** edits chapter 01's prose, which still names debugging as chapter 12 and interview practice as chapter 13: the two plain-text mentions of chapter 12 at lines 38 and 475 become 15, and in the theme table debugging becomes 15, interview practice 16, and the row “System design for game services | 12–14, building on 8 and 9” follows “Backend and API clients”. No question block changes, so the strict question check still passes for chapter 01. It also adds the sources above to **Rule A** in `docs/evidence/codex/brief.md`, and the names rule above to the **Limits** of both briefs.

### Phase 18: Tools for a second book

Build:

- `--allow new-chapters` in `pipeline/guard.ts`, with tests in `guard.test.ts`: a new chapter in an existing book passes, a new book passes, and a new section in an existing chapter, a new concept in an existing section and a changed `*` line in an existing chapter each fail.
- Per-book totals in `pipeline/check.ts`, built on `summarize`, with a test.
- CLAUDE.md: `content/mobile-platform/` in the layout, the new option beside `npm run guard`, and a note that Phases 18 to 32 write the second book from `docs/mobile-platform-outline.md`.

Done when: `npm test`, `npm run typecheck`, `npm run check` and `npm run build` pass, `npm run guard -- style` and `npm run guard -- questions` pass, and the new option is shown to bite on the real content. A scratch file `content/mobile-platform/99-scratch.md` holding one section passes with `--allow new-chapters` and fails without it; a new section in an existing Unity chapter fails with it; a changed `*` line in the Unity book fails with it. Revert every mutation afterwards.

### Phases 19 to 34: one chapter each

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
| 30 | 12: System design for game services: method and building blocks | 6 | 12 | Edits chapter 01's chapter numbers and theme table, and the Codex briefs, as **Decisions: system design** says |
| 31 | 13: Designing core game services | 7 | 14 | Asks the user about a local Redis before the leaderboard lab |
| 32 | 14: Running game services at scale | 5 | 10 | |
| 33 | 15: Debugging across boundaries | 5 | 10 | |
| 34 | 16: Interview practice for platform roles | 5 | 9 | The link pass |

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

**Phase 34's link pass.** Earlier chapters mention later ones in plain text. Where a link helps the reader, the mention becomes a `[[#id]]` in prose, never in a question block.

### If time runs short

If an interview comes before the book is done, run the phases in the order of what the interview weighs most. Phases 19 to 29 are done. For a round that includes system design, run 30 and 31 (the method and the core services), then 33 (debugging across boundaries), 32 and 34. Without a design round, run 33 first. The book's order stays as it is, because the file names fix it. A chapter written early explains in place the little it needs from an unwritten one, names that chapter in plain text, and Phase 34's link pass connects them.

### Phase 35: A teacher's read

Read the whole book in order, as the Unity book's second read did: every claim, code sample, worked number and question, testing the doubtful ones against **Decisions: evidence**, with each chapter's evidence file beside it to show what was checked while it was written and what rests on documentation alone. The log of each chapter's phase, in plan-history.md up to Phase 29, says what it left open and what the user settled. Write one file per problem in `docs/review-requests/`, with the kinds and priorities its README defines. A later section of this plan orders them into phases, as Phases 11 to 17 did.

Done when: every chapter has been read in order, each problem has its file and its row in the README, and the phase log counts the requests by kind and priority.

## Phase log

Phases 1 to 29 are logged in [plan-history.md](plan-history.md).

### Plan: system design chapters (after Phase 29)

Asked for by the user on 2026-09-26: platform engineers at game studios often own or share the game's services, so the book gains chapters 12 to 14 on system design for game services, to a firm middle ground. The outline has the three chapters (18 sections, 36 concepts), a new section in the interview chapter, `interview-system-design` (2 concepts), and a line of glossary candidates. Its scope now says what the reader can do after these chapters and where a backend specialist goes further. The book is now 16 chapters, 87 sections and 174 concepts. Debugging across boundaries and interview practice, both unwritten, moved to chapters 15 and 16 with their ids unchanged. Their phases are now 33 and 34, and the teacher's read is Phase 35. **Decisions: system design** records the research behind the chapters, where they sit and why, their depth, the names rule for server software, and their evidence sources.

Next phase: Phase 30 starts with the edits to chapter 01 and to the Codex briefs that the decisions list. The outline's figures that change with time, such as the stores' acknowledgement and deletion rules, carry “verify”.

### Phase 30: Chapter 12, system design: method and building blocks

Wrote `content/mobile-platform/12-system-design.md` (6 sections, 12 concepts, 50 variants, the outline's ids) and nine glossary entries: CDN, Load balancer, Object storage, Pub/sub, Read replica, Saga, Sorted set, Unity Gaming Services and WebSocket. `npm run check` reports the book as 12 chapters, 65 sections, 131 concepts, 468 variants, 63 terms and 218 links with no unlinked entry; `questions --allow new-chapters --base 66d9806` accepts this chapter alone; its 8 new links return 200; the no-brand search is empty. Chapter 01's chapter numbers and theme table are updated, with no question block changed, and both briefs carry the names rule, `review.md` under what counts as a problem, since it has no Limits section. Evidence and runs: [evidence/12-system-design.md](evidence/12-system-design.md).

Codex (GPT-6 Sol, `xhigh`) first stopped at 2.5 minutes and 29,940 tokens with “Selected model is at capacity”, and a retry ten minutes later took 30 minutes and 350,857 tokens. Its answer kept 78 of the 112 receipts in its working file; all 112, and the session's 23, pass on re-fetch. The guides support five studio prompts, not chat, friends, an economy or cloud save. The blind review (GPT-6 Astra, `xhigh`, 10 minutes, 183,839 tokens) found 10 problems, and 9 held and are fixed, among them a consumer that lost the reward of a player with no wallet.

Options: correct option longest in 20% of 50 sets, shortest in 20%, medians 65 and 63, no word-list option (the first draft had 56% and 8%); the detector found minimal signals.

Next phase: Redis is not installed, so Phase 31 asks the user about one before its leaderboard lab. Chapter 13 builds on this chapter's estimates, `GrantOnce` and version check, and Cloud Save's default player data is writable by the client.

### Phase 31: Chapter 13, designing core game services

Wrote `content/mobile-platform/13-game-services.md` (7 sections, 14 concepts, 63 variants, the outline's ids) and three glossary entries: Ledger, Time to live and Token bucket. `npm run check` reports the book as 13 chapters, 72 sections, 145 concepts, 531 variants, 66 terms and 240 links with no unlinked entry; `questions --allow new-chapters --base b86fad8` accepts this chapter alone; its 6 new links return 200; the no-brand search is empty. Evidence and runs: [evidence/13-game-services.md](evidence/13-game-services.md).

The user chose to install Redis 8.10.2 from Homebrew. Homebrew's own post-install step failed, since Homebrew is older than the formula, and the server runs. A board of 10 million players measured 895 MB, 89 bytes per entry, which holds chapter 12's estimate.

Codex (GPT-6 Sol, `xhigh`) hit the usage limit after 23 minutes and 278,177 tokens, before its final answer; its working file held 102 receipts, and all pass. The session added 76 under rule A, none failed; EUR-Lex refused connections, so the GDPR is cited from the Commission's page. The Astra review (`xhigh`, 12 minutes, 200,236 tokens) ran at the 01:23 reset from a background command started two hours before it, and found 13 problems; all held and are fixed, among them a wallet constraint that refused the refund's reversal.

Options: correct option longest in 21% of 63 sets, shortest in 22%, medians 65 and 65, no word-list option (the first draft had 40% and 8%). The detector found known false positives alone.

Next phase: chapter 14 builds on this chapter's push pacing, the event start's prefetch and jitter, and the ledger's refunds. Redis stays installed, with no service running, for any run chapter 14 needs.


### Phase 32: Chapter 14, running game services at scale

Wrote `content/mobile-platform/14-running-services.md` (5 sections, 10 concepts, 52 variants, the outline's ids) and seven glossary entries: Canary release, Circuit breaker, Error budget, Expand and contract, Load shedding, Service level indicator and Service level objective. The book now has 14 chapters, 77 sections, 155 concepts, 583 variants, 73 terms and 266 links, with no unlinked entry. All 675 tests, content check, build and style pass; the question guard against `4c3b742` accepts this chapter alone; six new links return 200; the no-brand search is empty. Evidence: [evidence/14-running-services.md](evidence/14-running-services.md).

Codex (GPT-6 Sol, `xhigh`) gathered 100 receipts in 26 minutes and 279,222 tokens; ten additional working receipts and the session's 38 also passed re-fetch. Completion rechecked those 148 against saved pages and fetched one new PostgreSQL receipt; none failed. The Astra review (`xhigh`, 189 minutes 33 seconds wall time, 207,032 tokens) finished after the writing session stopped. All ten findings held and were fixed, including stale migration values, unbounded ticket redemption and request/player canary exposure. Three off-concept variants now test indicator choice, preserving the outline's concept count. The corrected migration passes stale-value, restart, null and repeat-run checks.

Options: correct longest in 17% of 52 sets, shortest in 23%, median lengths 66 and 66, no word-list option. The detector found contextual false positives alone.

Next phase: Phase 33 writes chapter 15, using this chapter's mitigation order, client-version dashboards, correlation ids and incident roles. The user's manual chapter read remains.

### Phase 33: Chapter 15, debugging across boundaries

Wrote `content/mobile-platform/15-debugging-across-boundaries.md` (5 sections, 10 concepts, 50 variants, the outline's ids) and three glossary entries: Dynamic linker, Symbolication and Tombstone. The book now has 15 chapters, 82 sections, 165 concepts, 633 variants, 76 terms and 293 links, with no unlinked entry. All 675 tests, content check, build and style pass; the question guard against `1e0aced` accepts this chapter alone; five new links return 200 without redirects; the no-brand search is empty. Evidence: [evidence/15-debugging-across-boundaries.md](evidence/15-debugging-across-boundaries.md).

The delegated CLI could not initialize in the sandbox, and automatic approval review rejected the external retry for exporting repository-derived prompt material. Both evidence and review used the plan's inline fallback; no successful delegated run or token usage was reported. All 72 receipts, 70 documentation and two local NDK command checks, pass, including a fresh source re-fetch. The teacher's read corrected an off-concept variant, implausible distractors in three variants, and a loose source cross-reference. Both incidents are explicitly invented; no device or store test is claimed.

Options: correct longest in 18% of 50 sets, shortest in 28%, median lengths 64 and 65.5, no word-list option. The detector reports technical vocabulary repetition alone.

Next phase: Phase 34 writes interview practice and performs the planned prose link pass. The user's manual chapter read remains.
