# Chapter 12: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [12-system-design.md](../../../content/mobile-platform/12-system-design.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 6 sections, 12 concepts, 50 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 8/10. Writing: 7/10.** A strong bridge from client engineering to backend design. Requirements are connected to components, estimates to decisions, and failure windows to transactional code. Some survey-like passages overload the first encounter with a topic, and the practical lab lacks a minimal runnable setup.

**Preserve:** The community-event questions and their design consequences; the estimation table and queue-drain example; distinguishing stateless APIs from stateful connections; the GrantOnce failure cases; the phone/tablet version check.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| How a game system design round runs<br>`design-round-method` | 8 | 7 | 8 | 7 | 8 | 7 | Useful interview framework; opening source narration and broad timing ranges need a more direct entry (RR-12-01). |
| Estimate before you draw<br>`design-estimation` | 9 | 8 | 9 | 8 | 8 | 9 | Assumptions, arithmetic and resulting design decisions are explicit; no material finding. |
| Stateless services and where state lives<br>`design-services-state` | 8 | 8 | 8 | 7 | 8 | 8 | Two paths clarify state ownership; buying services adds a long secondary checklist. |
| Storage chosen by access pattern<br>`design-storage` | 7 | 7 | 6 | 6 | 8 | 6 | Access patterns, sharding, hashing, replicas and backups accumulate; hashing needs a small worked illustration (RR-12-02). |
| Caches, queues, and events<br>`design-caches-queues` | 8 | 8 | 8 | 7 | 8 | 8 | The transaction and acknowledgement boundary are well explained; lab setup remains implicit (RR-12-03). |
| Consistency, concurrency, and the trade-off said aloud<br>`design-consistency` | 8 | 7 | 7 | 7 | 8 | 7 | Good SQL demonstration; CAP/PACELC survey and concurrency practice would benefit from separate internal headings. |

## Findings and proposed changes

### RR-12-01: Lead with the usable interview plan

Low priority. Scope: prose and table. Section: `design-round-method`. Source: [12-system-design.md, line 10](../../../content/mobile-platform/12-system-design.md#L10).

> Guides to the design rounds of game studios, built from candidates' reports, describe a round of about an hour,

The learner first receives the provenance of several guides and repeated qualifications before seeing what to do. State that the schedule is illustrative, present the table, then place the source qualification after it. The ranges total 38–54 minutes, so give one concrete 45-minute allocation or explain that the upper ends cannot all be used together. The table should help rehearse pacing rather than require the learner to reconcile the ranges.

### RR-12-02: Teach redistribution before presenting simulation statistics

Medium priority. Scope: prose and example presentation. Section: `design-storage`. Source: [12-system-design.md, line 354](../../../content/mobile-platform/12-system-design.md#L354).

> With `hash(key) mod N`, adding an eleventh node to ten changes the node of most keys:

The paragraph introduces modulo remapping, ring placement, virtual points, imbalance and Redis hash slots, along with several percentages. For a first encounter, the measurements arrive before a learner can picture the operation. Use a tiny ring or a short key-to-node table to show one added node, then explain why multiple points reduce imbalance. Retain the simulation figures as optional supporting evidence. Separate this topic from replicas and backups with internal headings.

### RR-12-03: Give the database lab a runnable entry point

Medium priority. Scope: prose and code presentation. Section: `design-caches-queues`. Source: [12-system-design.md, line 497](../../../content/mobile-platform/12-system-design.md#L497).

> Lab exercise: Build the consumer above against SQLite, give a player a wallet,

The sample is a method over DbConnection, and the exercise additionally refers to acknowledgement and crashing, neither of which is present in the code. Specify a minimal local .NET project/provider, imports, connection creation, schema initialization and a simulated delivery/acknowledgement harness. Show the exact before/after coin and processed-ID assertions for repeat delivery, post-commit interruption and a missing wallet. A real message broker is unnecessary; make that explicit so the learner can practise the invariant with the supplied ingredients.

### RR-12-04: Scope the wallet rule to spending before the later refund exception

Medium priority. Scope: prose and cross-chapter consistency. Section: `design-storage`. Source: [12-system-design.md, line 348](../../../content/mobile-platform/12-system-design.md#L348).

> a balance must not go below zero, whatever order two spends arrive in.

Chapter 13 explicitly moves the rule from a wallet CHECK to the spend condition so refunds can record a deficit. That is a useful refinement, but Chapter 12 initially presents the constraint as the general design. Add a short signpost that this example prevents overspending, while the later ledger design distinguishes spends from refund reversals. Keep both examples and explain their different requirements rather than treating the later design as a contradiction to memorize.

## Exercises and assessment

All 50 variants were read, including the multiple-select replica question. Estimates and optimistic concurrency are tested with meaningful changing inputs. The questions usually have enough context for their intended decision. The consistency-per-feature concept also includes CAP, PACELC and phrasing a trade-off, which deserve a deliberate grouping decision in the later assessment pass. The section exercises fit interview preparation; the SQLite lab is the one where missing setup most directly prevents independent execution. Storage and connection-tier material can serve as prerequisites for Chapters 13–14 once the teaching hierarchy is clearer.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> The average is the figure that undersizes a backend.

After:

> Sizing the backend for average traffic leaves it unprepared for peaks.

Before:

> A restore that has never been tried is not a backup, since nobody knows how long it takes or whether it works.

After:

> An untested backup leaves two questions unanswered: whether it can be restored and how long recovery takes.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
