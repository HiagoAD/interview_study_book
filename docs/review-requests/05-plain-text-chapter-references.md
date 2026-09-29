# Chapter 5 and two glossary entries name written chapters in plain text

**Kind:** Consistency. **Priority:** Low. **Touches:** prose (`05-android-builds.md:500`, `:521`) and glossary (`glossary.md:187`, `:376`).

## Location

- `content/mobile-platform/05-android-builds.md:500`: “the [`assetlinks.json` file](…) that verifies the game's https links, which chapter 4 describes;”
- `content/mobile-platform/05-android-builds.md:521`: “targeting 23 made dangerous permissions something the player grants at run time, which chapter 4 covers.”
- `content/mobile-platform/glossary.md:376` (Play App Signing): “[[#os-deep-links]] depends on it, and chapter 5 covers the two keys.”
- `content/mobile-platform/glossary.md:187` (dSYM): “[…] and chapter 11 archives them for each build.”

## Evidence

**Decisions: writing rules** in `docs/PLAN.md` asks for `[[#id]]` back to an earlier section of this book, and **If time runs short** says a chapter written early names an unwritten one in plain text until Phase 34's link pass connects them. Chapter 5 was written in parallel with chapter 4 (the Phase 23 log: “chapter 4 is named in plain text”), and these four references survived the link pass. Every other cross-chapter reference in chapters 04 to 06 is a link, such as `[[#gradle-manifest-merge | chapter 5]]` at `04-os-integration.md:130` and `[[#ci-secrets-signing | chapter 11]]` at `06-ios-builds.md:173`, and the glossary links sections elsewhere in the same entries. The sections exist: `os-deep-links` (App Links and `assetlinks.json`), `os-permissions` (runtime permissions), `gradle-packaging-signing` (the two keys), and `ci-pipeline-shape`, whose Artifacts row archives “the [[dSYM]] files” (`11-ci-and-jenkins.md:22`), with the symbol upload and retention in `ci-release-automation` (`11-ci-and-jenkins.md:846`).

## Proposed fix

- `05-android-builds.md:500`: “which [[#os-deep-links | chapter 4]] describes;”
- `05-android-builds.md:521`: “which [[#os-permissions | chapter 4]] covers.”
- `glossary.md:376`: “[[#os-deep-links]] depends on it, and [[#gradle-packaging-signing]] covers the two keys.”
- `glossary.md:187`: “and [[#ci-release-automation]] archives them for each build.”

Run `npm run check` afterwards; none of these lines is in a question block.

## Repeated in

No other plain-text chapter reference remains in chapters 04 to 06.
