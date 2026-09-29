# Chapter 16: reader and writing review

Status: chapter complete. Scoped run: chapter 16 only. Sections read in order.

Source: [16-interview-practice.md](../../../content/mobile-platform/16-interview-practice.md) (untracked at the start of the run). Snapshot: [snapshot.json](snapshot.json); line numbers refer to SHA-256 `dec0b864…777f`.
Coverage: 5 sections, 9 concepts, 35 variants; all prose, tables, exercises, options and explanations read. The first book's chapter 15 and chapter 1 depth table were read to check the recap; linked sections of this book were followed where the chapter paraphrases them.

**Learner experience: 8/10. Writing: 8/10** (readability 8, structure 8, conciseness 8, style consistency 9). The chapter turns the book into rehearsable answers: every rubric row and table cell points back to the section that teaches it, so a weak answer names its own remedy. The debugging narration and the practice project are the strongest sections. The main friction is in the first section, which defines the decision level carefully but then asks the learner to grade a two-minute answer without a model of one, and whose questions partly contradict their own definition (RR-16-01 to RR-16-03). The practice lab has no finish line (RR-16-10).

**Preserve:** the eight-part structure with its “where this book covers it” column; the traceability test (“A sentence you cannot trace to something you built or read is a sentence to check”); asking one question and then stating an assumption aloud; the six-step narration table and “what would change your mind”; “I am not sure … I would log the thread id”; the scored 1-out-of-10 example and how two sentences raise it; “The weak answers are not foolish”; the follow-up tables (especially the consent buffering row); “draw the client as a box with its own state”; the ordered practice project and the log of expected, actual, error, cause and fix; the honesty note about practice projects.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Editorial judgments against the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), not averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Answer “how would you integrate this SDK”<br>`interview-integration-answer` | 7 | 8 | 7 | 8 | 9 | 8 | Clear structure and depth table; no model eight-part answer to grade against (RR-16-01); two questions contradict the decision-level definition (RR-16-02, RR-16-03); the first question is taught after the depth table although the structure puts purpose first (RR-16-04). |
| Explain an investigation out loud<br>`interview-debugging-answer` | 9 | 9 | 9 | 8 | 9 | 9 | Six steps, one fully worked example and a strong paragraph on unknown details; the last table row presupposes the R8 outcome (RR-16-05). |
| A mock round with rubrics<br>`interview-platform-mock` | 8 | 8 | 8 | 8 | 9 | 8 | Rubric table and scored example make grading concrete; one elliptical cell (RR-16-07); the exercise leaves five follow-ups and the timing change unexplained (RR-16-08). |
| Run a system design round<br>`interview-system-design` | 8 | 7 | 8 | 7 | 8 | 8 | Driving the round and the platform engineer's depth are well argued; table cells are dense lists and one provenance sentence reads as an evidence log (RR-16-09); design-depth distractors differ in form from the answer (RR-16-12). |
| Build a practice project that gives you evidence<br>`interview-practice-project` | 8 | 9 | 9 | 9 | 9 | 9 | Ordered, justified and honest; the lab has no completion criterion or one-platform fallback (RR-16-10); one explanation names an option that is not there (RR-16-11). |

Measurement (for scale only): prose outside tables and question blocks, counted with `awk` as whitespace-separated words on non-table, non-question lines: 553, 475, 327, 461 and 380 words by section; table rows hold 2,095 words. About half of the chapter's teaching text is in table cells, which suits a rubric chapter; see the rendering limit below. `npm run guard -- options` for this file: correct option longest in 23% of 35 sets, shortest in 14%; median lengths 72 (correct) and 69 (wrong); word list gains nothing.

## Findings and proposed changes

Question-block findings are marked **pre-commit, no history cost**: the chapter is untracked, so its blocks can change now without consent or review-history cost. After the chapter is committed, the same changes would need consent under `docs/PLAN.md`.

### RR-16-01: Give a model two-minute answer to grade against

Medium priority. Scope: prose and exercise. Section: `interview-integration-answer`. Source: [line 23](../../../content/mobile-platform/16-interview-practice.md#L23), [line 39](../../../content/mobile-platform/16-interview-practice.md#L39).

> Two minutes for eight parts is fifteen seconds each, which is one sentence. That is the right first pass.

> Play the recording back and mark each of the eight parts you covered, each sentence at the decision level, and the one question you asked first.

The section asks for one sentence per part, at the decision level, but the only full answer it shows is the analytics decision cell (line 31, 122 words), which covers purpose, boundary, consent, evaluation and rollout and leaves out platform work, build impact and upgrades. The learner who records the exercise cannot see what an eight-sentence pass sounds like, how one sentence can be both brief and decision-level, or which parts the decision cell deliberately left for the interviewer to open. Consequence: grading the recording relies on the learner's own sense of “covered”, and the exercise's success criterion is hard to apply.

Proposed: after line 23, add a model first pass, one sentence per part, and say which part the interviewer would most likely open. For example:

> A first pass, one sentence per part: “I would first ask what it is for, and assume new product analytics on both platforms, with some players consenting first. Before adding it, I would diff a release build with and without it, for size, permissions and anything that starts itself. Gameplay calls a game-owned `IAnalytics` with the game's own events, so the vendor lives in one adapter. On each platform the adapter initializes the SDK and hands its callbacks to Unity's main thread through a queue. Its dependencies, pods and keep rules are checked in the merged manifest and a minified release build. Events wait in a bounded queue until the player answers, and a refusal also turns the SDK's own collection off. It ships in a staged rollout that halts on crash-free users for the new SDK version. One owner tracks its version, checks each upgrade the same way, and could remove it by replacing that adapter.”

Keep the depth table and the decision cell as they are; the model shows breadth, the cell shows depth.

### RR-16-02: Explanations say distractors give no reason when they do

Medium priority. Scope: question blocks, with one prose sentence. **Pre-commit, no history cost.** Section: `interview-integration-answer`. Source: [line 44](../../../content/mobile-platform/16-interview-practice.md#L44), [line 47](../../../content/mobile-platform/16-interview-practice.md#L47), [line 69](../../../content/mobile-platform/16-interview-practice.md#L69), [line 71](../../../content/mobile-platform/16-interview-practice.md#L71).

> - Initialize the SDK before the first scene loads, so that no tutorial event is lost

> The other answers name steps or mechanisms without the requirement that justifies them.

Three of the four distractors in the first variant carry a reason (“so that no tutorial event is lost”, “so both platforms are covered”, “so each one can be tested”), and the IAnalytics distractor at line 69 does too (“to follow the conventions the team already has”). A learner who applies the section's rule literally, a choice plus its reason, cannot eliminate them, and the explanation then tells them the reasons are absent. The skill actually tested is subtler and worth teaching: a reason makes a sentence decision-level only when it names the requirement the design serves, and a reason can be present and still wrong (early initialization ignores consent; injecting the vendor's client spreads its type through gameplay). The correct option at line 42 also has no rejected alternative, although the explanation's definition includes one.

**Status after a concurrent edit (see Completion and limits):** the line 47 explanation was rewritten during the run and now says “The reasons in the other answers do not hold up: …”, which resolves the first half of this finding. It still defines the decision level as including “what it rejected”, which the correct option at line 42 does not state; either drop that clause from the explanation or accept it as the general definition. Still open: the line 71 explanation and the prose sentence.

Proposed: at the end of line 33's paragraph, add: “A reason alone does not make a sentence decision-level: it has to be the requirement the choice serves, and a reason that ignores one, such as initializing early so that no event is lost, fails the test.” Rewrite the line 71 explanation (the line 47 proposal below is superseded by the concurrent edit and kept for the record):

> A decision-level answer states a choice with the requirement it serves. Owning the schema behind a game-owned interface keeps the vendor in one adapter, which is what the design is for. The other reasons miss a requirement: initializing early ignores consent, the Unity package is a packaging detail, and injecting the vendor's client spreads its type through gameplay.

> The decision level gives the requirement a choice serves. A vendor change confined to one adapter is what the interface is for. Method lists and registration describe the mechanism, and a naming convention is a reason about style, not about the design.

### RR-16-03: A correct option pairs a choice with the wrong reason

Medium priority. Scope: question blocks. **Pre-commit, no history cost.** Section: `interview-integration-answer`. Source: [line 58](../../../content/mobile-platform/16-interview-practice.md#L58); prose source [line 31](../../../content/mobile-platform/16-interview-practice.md#L31).

> * Events wait for consent, because the SDK can start before any C# runs

In the decision cell (line 31) the self-starting SDK is the reason a refusal must also turn the SDK's own collection off; events wait in the queue because the player has not answered. The option joins the queue to the other clause's reason. This variant's skill is exactly linking a choice to the fact that forces it, so the learner is rewarded for a causal link that the section does not make, and a careful reader may reject the “correct” answer.

Proposed:

> * A refusal also turns the SDK's own collection off, since it can start before any C# runs

> A decision states the choice together with the fact that forces it: an SDK that starts itself from a content provider collects before the game's consent code runs, so the refusal has to reach the SDK as well. The other sentences describe what the code does, or how the SDK is installed, without saying why.

Check the new correct option's length against the distractors (about 80 characters against 60 to 65) and shorten if the options guard shows it standing out.

### RR-16-04: Signpost where purpose is taught

Low priority. Scope: prose structure. Section: `interview-integration-answer`. Source: [line 14](../../../content/mobile-platform/16-interview-practice.md#L14), [line 35](../../../content/mobile-platform/16-interview-practice.md#L35).

> | Purpose | What the SDK is for, which feature or decision depends on it, and what success looks like | This section |

The structure puts purpose first, and the table says “This section”, but the first question and the stated assumption come four paragraphs later, after the depth table and the tracing test. A learner rehearsing the opening move has to hunt for it. Either move lines 35 to 37 to follow the eight-part table, or change the cell to “The first question, below” and open line 35 with “The purpose comes first because …”. Moving the paragraphs is the better fix: the section would then run in the order an answer does.

### RR-16-05: The last narration row assumes the R8 outcome

Low priority. Scope: prose. Section: `interview-debugging-answer`. Source: [line 125](../../../content/mobile-platform/16-interview-practice.md#L125).

> “If it shipped, halt the [[staged rollout]] and turn the feature off with its flag. Fix it with a keep rule, …”

The previous row keeps four outcomes open; this row fixes with a keep rule without saying which outcome was observed. Four lines later the prose marks “it is R8, add a keep rule” as the answer that scores low. A learner imitating the table may reproduce that jump. The Scope row already uses “Say it is …”; do the same: “Say logcat showed a missing class. If it shipped, halt the staged rollout …”.

### RR-16-06: Plain-text references to this book's chapters

Low priority. Scope: prose links (no question blocks). Sections: all but `interview-platform-mock`. Source: lines [17](../../../content/mobile-platform/16-interview-practice.md#L17), [18](../../../content/mobile-platform/16-interview-practice.md#L18), [107](../../../content/mobile-platform/16-interview-practice.md#L107), [131](../../../content/mobile-platform/16-interview-practice.md#L131), [304](../../../content/mobile-platform/16-interview-practice.md#L304), [408](../../../content/mobile-platform/16-interview-practice.md#L408).

> Chapter 15 gave the method; aloud, it becomes six steps:

> Chapter 13's labs are that service in pieces.

The writing rules link back to earlier sections with `[[#id]]`, and the rest of the chapter does so densely; these six mentions, which a learner is likely to want to open, stay plain. Proposed: row “Platform work”: `[[#android-runtime-model]], [[#ios-runtime-model]], [[#os-lifecycle]]` or “Chapters 2 to 4, from [[#android-runtime-model]]”; row “Build impact”: “Chapters 5 and 6, from [[#gradle-project]] and [[#xcode-build-flow]]”; line 107: “[[#boundary-method]] gave the method”; line 131: “and [[#design-round-method]] makes it for a backend's internals”; line 304: “as that section advises” (it is already linked at line 300); line 408: “The labs of [[#design-economy]] and [[#design-leaderboards]] are that service in pieces.” Mentions of the first book stay plain text, as the outline requires.

### RR-16-07: An elliptical list in the dependency row

Low priority. Scope: prose (table cell). Section: `interview-platform-mock`. Source: [line 201](../../../content/mobile-platform/16-interview-practice.md#L201).

> `dependencyInsight` to see who asks for what, then the lagging SDK updated, a shared version, the vendors, or one SDK dropped

“The vendors” has no verb, and the list does not say it is an order, though [[#gradle-dependencies]] gives one. Proposed: “`dependencyInsight` to see who asks for what, then in order: update the lagging SDK, find one version both accept, ask both vendors, or drop one SDK”.

### RR-16-08: The mock exercise's timing and follow-ups

Low priority. Scope: exercise. Section: `interview-platform-mock`. Source: [line 193](../../../content/mobile-platform/16-interview-practice.md#L193), [line 232](../../../content/mobile-platform/16-interview-practice.md#L232).

> Run the ten prompts above with a five-minute timer each, recorded. Score each recording on the five dimensions, then ask yourself one follow-up per prompt and answer it aloud.

Two frictions. “Integrate analytics” was a two-minute answer in the first section and is five minutes here, with no word on what the extra three minutes are for. And the follow-up table covers five prompts, so the learner must invent the other five follow-ups, the hardest part of self-practice. Ten recordings plus scoring is also more than one sitting. Proposed:

> Interview exercise: Run the ten prompts above, recorded, over two or three sessions. Give each five minutes: a two-minute first pass as in [[#interview-integration-answer]], then one part taken deeper. Score each recording on the five dimensions. Then answer one follow-up per prompt aloud: the five in the table, and for the other prompts change one constraint yourself, such as the platform, consent, the download size, build capacity or the server's behavior.

### RR-16-09: A provenance sentence in the teaching voice

Low priority. Scope: prose. Section: `interview-system-design`. Source: [line 306](../../../content/mobile-platform/16-interview-practice.md#L306).

> Guides to game studios' design rounds report the first three prompts below, and one candidate reported a payment system; the others are services of the same backends, which chapter 13 designs.

The sentence records where the prompts came from, which is evidence for the writer, in a form the learner has to parse: “one candidate reported a payment system” maps silently to the fifth row, “Purchases and refunds”. The qualification that these are reported, not guaranteed, is worth keeping. Proposed: “The first three prompts below are common in published accounts of game studios' design rounds, and purchases have been reported too; the others are services that chapter 13 designs. None of them is a prediction of what a studio will ask.” The detailed provenance belongs in the evidence file.

### RR-16-10: Give the practice lab a finish line

Medium priority. Scope: exercise. Section: `interview-practice-project`. Source: [line 412](../../../content/mobile-platform/16-interview-practice.md#L412).

> Lab exercise: Build the first two parts, the native call and the callback on another thread, on both platforms. Write down each thing that surprised you, with the error message that showed it.

The section's whole argument is that a practice project yields evidence, but the lab does not say what observation shows the two parts working, and a learner who meets no error has nothing to write down. It also assumes both platforms; iOS needs a Mac with Xcode, which not every reader has. Proposed:

> Lab exercise: Build the first two parts, the native call and the callback on another thread, on both platforms. Each is done when a log from a device, emulator or Simulator shows the native call's result, the callback arriving on a thread other than Unity's main thread, and the C# handler running on the main thread after the handoff. If one platform is out of reach, build the other and write down what the missing one would need. Write down each thing that surprised you, with the error message that showed it; if nothing failed, call a Unity API from the callback thread once on purpose and record what happens.

The last clause gives every learner the “story with evidence” the section asks for. Unverified referral: what a deliberate off-thread Unity API call logs on each platform (see referrals).

### RR-16-11: An explanation names an option that is not there

Low priority. Scope: question blocks. **Pre-commit, no history cost.** Section: `interview-practice-project`. Source: [line 433](../../../content/mobile-platform/16-interview-practice.md#L433), [line 436](../../../content/mobile-platform/16-interview-practice.md#L436).

> A list of SDKs or a smooth tutorial run gives nothing to ask about, and polish is not what a platform interview weighs.

**Status: resolved by a concurrent edit during the run.** Line 436 now reads “A smooth tutorial run, a tidy architecture or a clean lint gives nothing to probe”, which drops the missing option and addresses the architecture distractor. Kept for the record; no further action.

At the snapshot, no option mentioned a list of SDKs, and the “clean architecture, with an interface for each plugin” distractor, which a reader of chapter 1 may think defensible, was not addressed. Proposed at the time:

> A failure with its evidence, cause and fix is a story an interviewer can probe. A smooth tutorial run gives nothing to ask about, an architecture claimed without the problem it solved gives no decision to probe, and polish and style checks are not what a platform interview weighs.

### RR-16-12: Distractors that stand out by form or effort

Low priority. Scope: question blocks. **Pre-commit, no history cost.** Sections: `interview-system-design`, `interview-debugging-answer`. Source: [lines 362 to 366](../../../content/mobile-platform/16-interview-practice.md#L362), [line 148](../../../content/mobile-platform/16-interview-practice.md#L148), [line 387](../../../content/mobile-platform/16-interview-practice.md#L387), [line 390](../../../content/mobile-platform/16-interview-practice.md#L390).

> - Inside the database: how its storage engine lays out and compacts its pages

At lines 363 to 366 all four distractors begin “Inside the …” and the correct option begins “Where client meets service”, so the answer can be picked by pattern before reading. Several distractors elsewhere are not mistakes an engineer makes, against the distractor standard: “rewrite the plugin in C#” (148), “The interviewer counts the boxes” (387), “prefers client work” (390). Proposed: vary the forms at 363 to 366, for example “- In the load balancer: how it spreads connections across the servers”, “- In each endpoint's handler: how its code is split into classes”; replace 148 with “- “I would reproduce it in the Editor with the Android platform selected, and debug it there.””; replace 387 with “- It shows where the client's rendering and input handling sit in the design”; replace 390 with “- The client box lets the service assume each request arrives once, in order”. Rerun `npm run guard -- options` after the change.

### No material finding

- **Recap of the first book (line 8).** Accurate against the first book's chapter 15: project selection, metric honesty, the 0-to-2 rubric on five dimensions, and the spaced study loop. The long second sentence is covered by a wording revision below, not a finding.
- **Unknown-detail paragraph (line 131)** and its three variants: clear, concrete, consistent with chapter 12's advice.
- **Scored example and follow-up table (lines 210 to 230):** the best models in the chapter for how a rubric is applied.
- **Concept breadth.** `interview-mock-rubric` and `interview-practice-evidence` each span four different topics across their variants. In a practice chapter this is retrieval of earlier material through one judgment (strong versus weak answer), and each variant tests that judgment; no concept split is recommended.
- **Terminology.** “trade-offs” matches this book's usage in chapters 12 and 13; the first book writes “tradeoffs”. Not a defect inside this book.

## Exercises and assessment

All 35 variants were read. Most test the chapter's real skill, telling a strong answer from a weak one, and the explanations generally stand alone. The first section's two concepts carry the chapter's only questions whose keys disagree with its own prose (RR-16-02, RR-16-03). Distractor quality is otherwise good: many wrong options are the weak answers the rubric table names, which is exactly the right source. The exercises are well chosen and recorded aloud, as the chapter intends; the first and last lack a model or a completion criterion (RR-16-01, RR-16-10), and the mock round needs its timing and follow-ups spelled out (RR-16-08).

## Representative wording revisions

Proposals only; the source file is unchanged.

Before (line 8, second sentence 45 words):

> The first book's last chapter covers what this one assumes: choosing two or three projects whose stories give complementary evidence, stating metrics and your own part in them honestly, scoring a practice answer from 0 to 2 on requirements, ownership, failure handling, trade-offs and evidence, and a study loop spaced like the site's review queue.

After:

> This chapter assumes the first book's last chapter. That chapter covers choosing two or three projects whose stories give complementary evidence, and stating metrics and your own part in them honestly. It scores a practice answer from 0 to 2 on requirements, ownership, failure handling, trade-offs and evidence, and spaces a study loop like the site's review queue.

Before (line 201):

> `dependencyInsight` to see who asks for what, then the lagging SDK updated, a shared version, the vendors, or one SDK dropped

After:

> `dependencyInsight` to see who asks for what, then in order: update the lagging SDK, find one version both accept, ask both vendors, or drop one SDK

## Open technical referrals (unverified, for Phase 35)

- Line 123: “an exception about the main thread” is offered as one logcat entry for an app that closes. Whether a Unity API called from a Java thread closes the app, or logs a managed exception and continues, was not checked; if it does not close the app, the hypothesis belongs to a different symptom than “crashes”.
- RR-16-10's proposed deliberate off-thread call: what each platform logs was not checked; confirm before adding the clause.

## Completion and limits

**Input changed during the run.** The chapter was read at SHA-256 `dec0b864…777f`; at the end of the run it was `684fce8b…a445` (mtime 10:13, same time the evidence file appeared), still 444 lines. The explanations at lines 47 and 436 had been rewritten; every other explanation line and every excerpt quoted above was rechecked at its cited line and is unchanged. Changes elsewhere in the prose cannot be ruled out without the earlier copy, but no cited excerpt moved. RR-16-02 is partly and RR-16-11 fully addressed by that edit; ratings stand, since the section's learner rating rests mainly on RR-16-01 and RR-16-03.

No technical correction is asserted. Source review only: no rendered-page inspection, so whether the four-column rubric table (line 195) and the design tables with long cells read well on a phone is unknown. Not compared against the evidence file, which appeared during the run. No detector run. Findings can be applied from this report without rereading the conversation.
