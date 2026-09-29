# Chapter 14: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [14-running-services.md](../../../content/mobile-platform/14-running-services.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 5 sections, 10 concepts, 52 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 7/10. Writing: 6/10.** The chapter provides strong operational decisions and numerical examples, but sustained clause-heavy prose makes their relationships harder to retain. Its tables are substantially easier to study than the paragraphs connecting them.

**Preserve:** The player-visible degradation table; capacity arithmetic for lost instances and zones; distinguishing storage contraction from API contraction; server-controlled admission priorities; linking an incident to client-visible symptoms.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Spikes: launches, resets, and event starts<br>`design-spikes` | 7 | 6 | 6 | 6 | 7 | 6 | Good layered protection diagram, but ticketing, recovery and load testing crowd a single teaching unit (RR-14-01). |
| Failure isolation and graceful degradation<br>`design-degradation` | 8 | 7 | 7 | 7 | 7 | 7 | Degradation examples and Little's law are useful; the cascading-failure paragraph needs a visible causal sequence. |
| Deploying and evolving a live backend<br>`design-backend-deploys` | 8 | 6 | 7 | 6 | 7 | 6 | The migration table supports a difficult topic; the post-code paragraph obscures its safety conditions (RR-14-02). |
| Observability, service levels, and incidents<br>`design-slos` | 7 | 6 | 6 | 6 | 7 | 6 | Clear player-oriented metrics, but burn-rate arithmetic is stated without enough intermediate work (RR-14-03). |
| Abuse, cheating, and privacy at the service<br>`design-abuse-privacy` | 7 | 7 | 7 | 6 | 7 | 7 | Ownership/rate/plausibility is a helpful progression; lengthy policy recaps interrupt the reusable design lesson. |

## Findings and proposed changes

### RR-14-01: Break the queue explanation into its distinct decisions

Medium priority. Scope: prose structure. Section: `design-spikes`. Source: [14-running-services.md, line 32](../../../content/mobile-platform/14-running-services.md#L32).

> Queue eligibility can be represented by two counters; the service also tracks redeemed tickets.

The surrounding paragraph moves from database protection to signed tickets, eligibility, redemption, accumulated tickets, UI position, polling, backgrounding and a vendor analogy. The reader needs to distinguish eligibility from admission, the paragraph's most important qualification. Present arrival, waiting, eligibility and redemption as a short sequence, followed by a separate background/resume example. Keep the aggregate limit and one-use redemption explicit.

### RR-14-02: Separate migration invariants from validation evidence

Medium priority. Scope: prose and code presentation. Section: `design-backend-deploys`. Source: [14-running-services.md, line 339](../../../content/mobile-platform/14-running-services.md#L339).

> Three properties make it safe on a live database.

The paragraph starts by promising three properties, then adds an exact SQLite run, old-writer races, rollback constraints, authoritative reads, atomic writes and PostgreSQL DDL locks. Readers can lose the conditions under which the SQL is safe. Put the prerequisites before the code, the three properties after it, a two-writer trace beside the race explanation, and the probe results in a compact evidence note. This improves organization without weakening any caveat.

### RR-14-03: Derive the alert threshold before asking readers to choose one

Medium priority. Scope: prose and worked example. Section: `design-slos`. Source: [14-running-services.md, line 435](../../../content/mobile-platform/14-running-services.md#L435).

> For the sign-in objective, a burn rate of 14.4 is 1.44% of sign-ins failing.

The exercise asks for a burn-rate paging threshold, but the text introduces 14.4 amid a long attributed sentence. Show the steps: 30 days contain 720 hours; spending 2% of that budget in one hour corresponds to 0.02 × 720 = 14.4 times the allowed rate; 14.4 × 0.1% = 1.44%. Label this an example policy, then distinguish selecting a paging policy from calculating its rate. Keep the short-window qualification.

### RR-14-04: Expose the causal chain and reduce repeated source narration

Medium priority. Scope: prose structure and conciseness. Section: `design-degradation`. Source: [14-running-services.md, line 204](../../../content/mobile-platform/14-running-services.md#L204).

> Overload spreads.

The paragraph embeds the cascade and every defense in one block, repeatedly narrating what the SRE book says. Elsewhere the chapter also repeatedly introduces the same source. Give the cascade as numbered stages or an arrow chain, then pair each defense with the link it breaks. Attach the existing attribution to the explanation once. Source authority remains visible without repeatedly interrupting the teaching voice.

### RR-14-05: Keep retention, minimization and policy recognition distinguishable

Medium priority. Scope: question blocks and concept structure. Section: `design-abuse-privacy`. Source: [14-running-services.md, line 604](../../../content/mobile-platform/14-running-services.md#L604).

> ?? design-data-retention Request logs hold each player's IP address and device identifier.

The variants of this concept also assess regional data minimization, store disclosures and recognition of COPPA. Those are distinct learning outcomes: correctly answering a deletion-period question does not demonstrate the others. Review the concept grouping and the exercise's coverage before proposing a consented question migration. Preserve the current emphasis on purpose-based retention rather than memorizing changing limits.

## Exercises and assessment

All 52 variants were read. The scenario wording generally tests an operational decision, and the alternatives include plausible shortcuts such as autoscaling, indiscriminate retries and immediate schema replacement. The migration exercise is particularly strong because it asks what rollback leaves at every stage. The degradation exercise checks player-visible behavior but not the capacity arithmetic or RPO/RTO just introduced; a small worked follow-up would improve coverage without requiring more tracked questions. Two concepts per section group broad subjects: review retention in RR-14-05 and whether the autoscaling concept's load-shedding variants assess the same skill. Do not infer mastery from the size of a variant pool.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> It acts on what has already happened.

After:

> Autoscaling responds after demand rises.

Before:

> The storage contracts once the servers have moved, which a deploy does in hours, while the API contracts once the clients have, which for a mobile game takes months: the time until the minimum supported version passes the last build that reads the old field.

After:

> The old storage column can be removed after all servers have moved to the new one. Removing the old API field must wait until no supported client needs it. Server migration may take hours; mobile clients can remain supported for months.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
