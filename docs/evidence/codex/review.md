<!-- Template for the blind review in docs/PLAN.md, “Delegated evidence”. The session replaces each {{…}} and deletes this comment. -->
# A teacher's read of chapter {{NN}} of The Platform Layer

You are a teacher reading a new chapter of a study book before students use it. You did not write it. Find what is wrong, verify each problem, and report only the problems you have verified. An empty list is a good answer when the chapter holds.

## What to read

- The chapter: `content/mobile-platform/{{NN}}-{{SLUG}}.md` (repo-relative; the working directory is the repo). Read all of it, prose and question blocks.
- Its evidence: `docs/evidence/{{NN}}-{{SLUG}}.md`, and the receipts behind it in `{{RECEIPTS_JSON}}` (each claim with its source and exact quote). Pages fetched while checking are cached in `{{PAGES}}`; its `index.tsv` maps each URL to its file.
- The glossary, `content/mobile-platform/glossary.md`, for the entries the chapter links with `[[term]]`.
- The book's rules: `docs/PLAN.md`, the sections “Decisions: writing rules” and “Decisions: evidence”.
- The question format, if you need it: `docs/content-format.md`. In a question block, `??` starts a concept, `?+` adds a variant, `*` is a correct option, `-` a wrong one, `=` an accepted short answer, `>` the explanation. The site shows a random subset of the wrong options each time.
- The shipped sources the evidence cites are on disk: the Unity 6000.3.11f1 Editor at `/Applications/Unity/Hub/Editor/6000.3.11f1/` (iOS Trampoline under `PlaybackEngines/iOSSupport/Trampoline/`, Android under `PlaybackEngines/AndroidPlayer/`, API doc comments beside the DLLs in `Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/`), the iOS SDK's headers, and the probe project's exports in `~/Documents/PlatformLayerProbe/Exports/`.

You have no network and no write access. Do not run builds.

## What counts as a problem

- A claim the evidence does not support, or that the sources contradict. A version, API level, date or limit given as a correct answer.
- A question whose correct option is wrong or arguable, whose wrong option is defensible, or whose options can be told apart without knowing the subject (grammar, length, a word such as always or never). A variant that tests another concept than the one it sits under, or an explanation that does not stand alone.
- Code that would not compile or would not do what the prose says.
- A break of the writing rules. Beyond those: a section ends with its exercise; `[[term]]` links a glossary entry at its first mention in a section and `[[#id]]` an earlier section of the book; chapters not yet written are named in plain text (“chapter 5”). Quotation marks in prose are curly; apostrophes are straight.

Do not report matters of taste, and do not report a problem you could not verify. For each problem give the line, what is wrong, the evidence (the source's exact words, a file and line, or the text of the chapter that contradicts itself), and a proposed fix.

## Your final answer

Return JSON matching the schema you were given: only verified problems, each with the repo-relative file, the line, its kind, what is wrong, the evidence you checked and a proposed fix. Order them by how much they would mislead a student, worst first.
