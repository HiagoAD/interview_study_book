# Chapter 07: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [07-sdk-integration.md](../../../content/mobile-platform/07-sdk-integration.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 6 sections, 12 concepts, 36 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 8/10. Writing: 7/10.** A coherent integration method with strong concrete examples; dense evidence paragraphs and a few unstated example contracts impede reuse.

**Preserve:** Evaluation by build diff, ownership of event schemas, explicit limits of remote switches, and collision diagnosis by shared resource.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Evaluate an SDK before it enters the build<br>`sdk-evaluation` | 8 | 7 | 8 | 6 | 7 | 7 | Useful evaluation categories; one oversized probe paragraph obscures the comparison. |
| Integrate an analytics SDK into an existing project<br>`sdk-analytics-integration` | 8 | 8 | 8 | 7 | 8 | 8 | Motivated architecture and queue code, but some promised capabilities remain unspecified. |
| Consent, privacy, and initialization order<br>`sdk-consent-init` | 7 | 7 | 7 | 7 | 8 | 7 | Good auto-init mechanism; local buffering and collection need a precise distinction. |
| Different implementations on Android and iOS<br>`sdk-platform-differences` | 8 | 8 | 8 | 7 | 8 | 8 | Four-case table anchors the native shim examples. |
| Upgrade an SDK safely<br>`sdk-upgrades` | 8 | 8 | 8 | 7 | 8 | 8 | Checklist, rollout and rollback form a practical sequence. |
| When SDKs collide<br>`sdk-conflicts` | 9 | 8 | 9 | 8 | 8 | 8 | Single ownership unifies apparently different SDK failures. |

## Findings and proposed changes

### RR-07-01: Turn the probe narrative into comparison evidence

Medium priority. Scope: presentation. Section: `sdk-evaluation`. Source: [07-sdk-integration.md, line 22](../../../content/mobile-platform/07-sdk-integration.md#L22).

> 20 more libraries resolved

The paragraph combines Android dependencies, size, permissions, components, iOS subspecs, privacy manifests and an archive failure. A platform/result/implication table would connect each observation to the evaluation sheet. Keep exact versions and measurements as provenance, not the main teaching sequence.

### RR-07-02: Explain the status of the pre-consent queue

Medium priority. Scope: cross-section terminology. Section: `sdk-consent-init`. Source: [07-sdk-integration.md, line 267](../../../content/mobile-platform/07-sdk-integration.md#L267).

> Consent comes before collection.

The preceding section records events and occurrence times while consent is unknown, then sends or discards them. Here collection is prohibited until agreement where required. Define the distinction between local buffering, SDK collection and transmission, and state that whether even temporary buffering is allowed depends on the chosen policy. Include a discard-at-source mode. This is a clarity referral, not a legal determination.

### RR-07-03: Show how event occurrence time reaches each destination

Medium priority. Scope: adapter contract. Section: `sdk-analytics-integration`. Source: [07-sdk-integration.md, line 129](../../../content/mobile-platform/07-sdk-integration.md#L129).

> Then it sends them in order, and each keeps the time it happened

GameEvent has OccurredUtc, but neither the shim’s logEvent signature nor the sample JSON mapping shows how a vendor receives or interprets it. Specify an occurred-at parameter and its meaning, and distinguish it from vendor ingestion/session time. Similarly identify EventSchema as a game-owned component still to implement, with a tiny schema fixture.

### RR-07-04: Trace a start that completes after the budget

Medium priority. Scope: example lifecycle. Section: `sdk-consent-init`. Source: [07-sdk-integration.md, line 323](../../../content/mobile-platform/07-sdk-integration.md#L323).

> It bounds the wait, not the work

The comment states the crucial limit clearly, but the text then says the capability is unavailable without explaining the late task. Show timeout, late success/failure, consent withdrawal and capability publication in a small timeline. State who observes eventual exceptions and who prevents stale completion from opening collection. Do not silently turn this teaching helper into a full lifecycle framework.

### RR-07-05: Label the partial shim explicitly

Low priority. Scope: example scope. Section: `sdk-platform-differences`. Source: [07-sdk-integration.md, line 536](../../../content/mobile-platform/07-sdk-integration.md#L536).

> The iOS half exports the same five functions

Only LogEvent is implemented below, and VendorAnalytics is a placeholder. Say the block demonstrates one of five exports and list the remaining four as implementation tasks. This avoids implying the displayed material forms a complete linkable plugin.

## Exercises and assessment

All concepts and variants were read. Questions generally stay focused on the named decision, especially single ownership and remote-switch limits. The short analytics exercise assesses schema ownership but not queue order, denial or drops; add an optional scripted trace of those states. Evaluation and conflict exercises need a supplied artifact packet for readers without an existing SDK stack. Preserve the realistic project option. Questions about policy should retain their explicit scenario assumptions.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> The third step does the damage.

After:

> Direct vendor calls make later migrations expensive.

Before:

> Three more belong to SDKs in particular.

After:

> Three further collisions commonly appear when SDKs share a process.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
