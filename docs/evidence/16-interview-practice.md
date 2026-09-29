# Evidence for chapter 16: Interview practice for platform roles

What Phase 34 checked the chapter's claims against, and where the outline was wrong. [PLAN.md](../PLAN.md), under “Decisions: evidence”, says what counts as evidence.

This chapter teaches how to answer, not how a platform behaves. Nearly every technical statement in it restates a section of chapters 1 to 15, and each of those sections was checked against its own evidence when it was written (see the evidence file named like it). So the check here is that each restatement matches its source section, read on September 29, 2026 against the working tree at `7d2c7e0`. The chapter adds no external link and no new figure.

Codex was not used. The previous phase found the delegated CLI unable to start in the sandbox, and the user asked for Claude agents instead: a Sonnet agent and then an Opus agent each read the chapter blind, as the teacher's read of step 4. Their findings and what was done with them are in the Phase 34 log.

## Checked, and against what

### interview-integration-answer

- The first book's recap (projects with complementary evidence, honesty about metrics and contribution, the 0 to 2 rubric on five dimensions, the spaced study loop): `content/unity-engineering/15-interview-practice.md`, sections `interview-project-selection`, `interview-mock-round`, `interview-study-loop`.
- The three depths (naming, mechanism, decision): the first book's `01-architecture.md`, the table after its seven questions.
- The eight-part structure: each row links the section that teaches it. The decision-level analytics answer: schema and adapter from `sdk-analytics-integration`; the consent queue and an SDK that starts from a content provider from `sdk-evaluation` and `sdk-consent-init`; the build diff from `sdk-evaluation`; crash-free users for the new SDK version as the halt metric from `sdk-upgrades`.
- Running two vendors side by side when one replaces another: `sdk-analytics-integration`.

### interview-debugging-answer

- The six steps restate `boundary-method` in spoken form.
- The Android crash's candidate causes and first splits: `boundary-editor-device` (R8 and class lookup, managed code stripping, ABI and native library packaging, callback threads); `AndroidJavaException` at the adapter from `android-java-calls`; `UnsatisfiedLinkError` from `System.loadLibrary` from `android-plugin-forms`; tombstones, `ndk-stack` and symbolication from `boundary-crash-case`.
- No rollback of an installed build on a device, and a halted rollout leaving updated players on the version: `sdk-upgrades`.
- “Say you do not know, then how you would find out”: the first book's `01-architecture.md` and this book's `design-round-method`.

### interview-platform-mock

- Each rubric row names its section, and each was compared with it: `sdk-analytics-integration`, `platform-interfaces`, `platform-composition` (an implementation that reports the capability as unavailable, also in `sdk-upgrades`), `sdk-upgrades`, `gradle-dependencies` (`dependencyInsight`, and the order: update the lagging SDK, a shared version, the vendors, drop one), `boundary-editor-device`, `boundary-purchase-case`, `ci-jenkins-pipeline` (labels, Macs for iOS, the controller's built-in node advised against), `http-sessions` (single flight, one refresh and one retry, the token-comparison check, rotating refresh tokens), `network-offline` and `network-idempotency` (keys saved before the first send).
- An upgrade moving a library under another SDK: `sdk-upgrades`.
- Early-event buffering as a question for legal: `sdk-consent-init`, which separates buffering, collection and transmission.

### interview-system-design

- The schedule (6 minutes of requirements and 4 of estimates, so the first ten), the graded areas and the reported prompts: `design-round-method`. The first three prompts (leaderboard, matchmaking, a live event) and one candidate's payment system are the reported ones; the chapter says the rest are services chapter 13 designs, since the Phase 30 research found no guide reporting chat, cloud save or push to a segment.
- A board of 10 million players in one sorted set: `design-leaderboards` (895 MB measured on Redis 8.10.2 in Phase 31). 200,000 sessions from a push to 2 million players that one in ten tap: `design-social`.
- Each prompt row against its section: `design-leaderboards` (UTC reset, a key per week, ties by who reached first, rewards paid under an operation id of board and player), `design-matchmaking` (tickets, parties as one ticket, widening rules, timeouts, join tokens), `design-live-events` and `design-social` (content ahead, jittered start, paced push), `design-player-data` (one writer per field, version check, schema versions migrated on read), `design-economy` (verification, ledger keyed by the store's transaction, finish or acknowledge, refund reversals), `design-social` (`Unregistered` push tokens, channel sequence numbers, moderation at the accepting server).
- Follow-ups: home region and the economy service down, from `design-degradation`; removing a cheater's entries before rewards, from `design-abuse-privacy`.

### interview-practice-project

- Each part links its section: `android-java-calls`, `ios-native-calls`, `android-callbacks`, `ios-callbacks`, `os-deep-links`, `ios-xcode-postprocess`, `gradle-r8-symbols`, `ci-pipeline-shape`.
- The ledger in SQLite and the leaderboard in Redis or a .NET sorted structure: the labs of `design-economy` and `design-leaderboards`.

## Rests on documentation alone

Nothing new. The claims about interview practice (what interviewers grade, a stated assumption, follow-ups that change a constraint) are the book's teaching advice, drawn from the design-round guides cited under **Decisions: system design** in PLAN.md and from the first book; they are not presented as any studio's policy.

## Narrowed or cut

- “The question a platform interview asks most often” became “in one form or another, since SDK work is much of the role”: no source measures frequency.
- The design prompts are attributed as the research supports: three reported prompts and one reported payment system; the others are named as chapter 13's services.
- A follow-up row that said SDK modules can be left out to save size was cut to the release build's measured size per device, which chapter 7 does support.
- The outage follow-up was first written as a store outage; `design-degradation` describes the economy service being down, so the row is now named for that: the shop closes rather than take money for items that cannot arrive, and a paid purchase stays unfinished in the store until the grant.
- The crash narration first listed an `AndroidJavaException` and a main-thread exception as crash entries. Chapter 2's `android-failure-evidence` and chapter 1 show both are logged failures of a call, not what closes the app, so the narration reads the crash buffer (`FATAL EXCEPTION`, or a native signal with a tombstone) first and Unity's log second. A native signal no longer rules R8 out by itself, since `gradle-dependencies` notes classes found by name through JNI.
- The iOS deep link in the practice project names chapter 4's patch for Unity 6000.3.11f1 (`os-deep-links`), and the iOS call is a C function, as `ios-native-calls` says, not an Objective-C method.
- A refresh ends the session when the server refuses it, not when it merely fails (`http-sessions`).

## Where the outline fell short

- The outline's figures total 174 concepts. The reader-review commit `7d2c7e0` added nine concepts to chapters 8, 9, 13, 14 and 15 under its structure changes, so the book now has 183, with chapter 16 at the outline's 9.
- The outline's mock-round prompts include “purchases fail in production after an update”; its strong answer is chapter 15's worked case, which the rubric links rather than repeats.
