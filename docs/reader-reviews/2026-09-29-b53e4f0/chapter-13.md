# Chapter 13: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [13-game-services.md](../../../content/mobile-platform/13-game-services.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 7 sections, 14 concepts, 63 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 8/10. Writing: 7/10.** The chapter makes backend design concrete through schemas, stateful examples and failure scenarios. Its strongest sections explain why an operation has a particular order. Several long sections still need a clearer hierarchy, and two exercises or questions ask for details that the prose only implies.

**Preserve:** The old-account/new-guest comparison; the ledger's immutable history and refund policy; the purchase-order failure table; executable leaderboard commands with expected results; latency/fairness trade-offs; the presence and telemetry examples.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Accounts, identity, and player data<br>`design-player-data` | 8 | 7 | 7 | 7 | 8 | 7 | A memorable account collision gives the schema purpose; recovery, document rules and deletion need clearer internal boundaries. |
| Economy and purchases: the server owns the ledger<br>`design-economy` | 9 | 8 | 8 | 7 | 8 | 8 | The sequence and failure table teach the invariant well; platform specifics sometimes obscure the common flow (RR-13-01). |
| Leaderboards<br>`design-leaderboards` | 8 | 7 | 7 | 6 | 8 | 7 | Commands and tie examples are strong; baseline, capacity evidence and alternative products need separation (RR-13-02). |
| Matchmaking and game sessions<br>`design-matchmaking` | 8 | 8 | 8 | 7 | 8 | 8 | Ticket lifecycle and trade-offs are clear; the exercise reasonably requires explicit assumptions from Chapter 12. |
| Real-time multiplayer at the system level<br>`design-realtime-multiplayer` | 8 | 8 | 7 | 8 | 8 | 8 | The topology comparison works; clearly mark lockstep as a separate approach after the four latency techniques. |
| Social: friends, presence, chat, and notifications<br>`design-social` | 7 | 7 | 7 | 7 | 8 | 7 | Presence is well taught, but the chat/mute exercise needs an enforcement example (RR-13-03). |
| Live events, content, and telemetry<br>`design-live-events` | 8 | 8 | 8 | 7 | 8 | 8 | The pipeline gives a useful map; explain the deduplication horizon before testing it (RR-13-04). |

## Findings and proposed changes

### RR-13-01: Separate the common purchase invariant from platform-specific completion

Medium priority. Scope: prose structure. Section: `design-economy`. Source: [13-game-services.md, line 165](../../../content/mobile-platform/13-game-services.md#L165).

> Then the client finishes.

The section's main flow is strong, but verification names, deadlines, acknowledgement versus consumption, recovery, notifications and fraud controls accumulate around it. Add internal headings and a compact completion comparison for StoreKit, Play consumables and Play non-consumables. Keep the text's qualification that either client or backend may perform Play completion. That makes the simple sentence here less likely to be remembered as a universal ownership rule.

### RR-13-02: Make the basic leaderboard visible before scaling alternatives

Medium priority. Scope: prose structure and conciseness. Section: `design-leaderboards`. Source: [13-game-services.md, line 313](../../../content/mobile-platform/13-game-services.md#L313).

> How much memory a board takes is the estimate of [[#design-estimation]], which assumed 100 bytes per entry.

The section moves from command semantics through precision limits, reset payout, allocator measurements, sharding, cohorts, histograms, friends and cheating. Each topic is useful, but readers have little indication of when the baseline implementation is complete. Group basic queries and durable storage first, then ties/reset, then scale alternatives. Put exact allocator measurements in a brief evidence note and retain the estimate's limits. In the query table, use distinct symbols for total members and returned top entries rather than N for both.

### RR-13-03: Teach how a moderation decision reaches and constrains clients

Medium priority. Scope: prose and exercise. Section: `design-social`. Source: [13-game-services.md, line 625](../../../content/mobile-platform/13-game-services.md#L625).

> Exercise: Design chat for guilds of fifty with a week of history.

The exercise additionally asks how a guild officer's mute reaches every member. The prose supplies message ordering and delivery, but not a mute record, authorization check or behavior while a client misses the update. Add a small state-change example: who may mute whom, which server rejects later sends, and how connected and reconnecting clients learn the state. This turns a new architecture problem at the exercise's end into a supported application of the section.

### RR-13-04: Explain the remembered-ID lifetime in the lesson

Medium priority. Scope: prose and question coverage. Section: `design-live-events`. Source: [13-game-services.md, line 769](../../../content/mobile-platform/13-game-services.md#L769).

> ?+ How long must the consumers remember event ids to catch duplicates?

The answer explanation introduces the resend/redelivery horizon, including offline storage across sessions. The prose explains IDs and duplicate removal but never explicitly connects that horizon to retention. Add one delayed-resend timeline before the exercise, contrasting event retention with deduplication-ID retention. The question can then check reasoning already taught; no question change is necessary for this fix.

### RR-13-05: Signal the change to an alternative simulation approach

Low priority. Scope: prose structure. Section: `design-realtime-multiplayer`. Source: [13-game-services.md, line 521](../../../content/mobile-platform/13-game-services.md#L521).

> Deterministic lockstep drops the state altogether.

The lead-in promises four techniques for making an authoritative server playable; prediction, reconciliation, interpolation and lag compensation fulfill it. Lockstep immediately follows with the same paragraph shape. Mark it as an alternative approach, so a reader does not mistakenly count it as a fifth technique to layer into that same server design. The issue is categorization, not missing technical depth.

## Exercises and assessment

All 63 variants were read. Purchase sequencing, refund idempotency and matchmaking authority are particularly well aligned with their explanations. The leaderboard lab names useful edge cases and gives actual commands, making it easier to start than many project-dependent exercises. Its around-me question says ten players while the explanation describes five above, the player, and five below; clarify whether the count excludes the focal player in an authorized prompt/explanation edit. The social section assesses presence and push fan-out but has no concept checking chat ordering, reconnect catch-up or moderation despite those being its exercise; preserve the exercise and consider whether a distinct chat concept is warranted, with the progress cost stated. RR-13-04 is best fixed in prose.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> The account itself stays on the server, where support alone can reach it.

After:

> The account remains on the server. Without the guest credential or a linked sign-in, the player needs support to recover access.

Before:

> A cohort design gives up the exact global rank, and an approximate one is what a player deep in a board wants anyway: “top 38%”.

After:

> A cohort design gives up exact global rank. For players far down the global board, an approximate position such as “top 38%” may be more useful.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
