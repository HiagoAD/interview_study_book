# Chapter 09: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [09-reliable-networking.md](../../../content/mobile-platform/09-reliable-networking.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 5 sections, 10 concepts, 38 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 7/10. Writing: 7/10.** The chapter clearly distinguishes an attempt, a logical operation and an uncertain outcome. Its examples explain several costly mistakes well. The main teaching gap is integration: the parts do not yet demonstrate the deadline and recovery behavior the prose promises.

**Preserve:** The four timeout categories; 47-second and retry-amplification arithmetic; same-key/same-body examples; a player-visible pending state; the structured log line and allowlist reasoning.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Deadlines, timeouts, and cancellation<br>`network-timeouts` | 7 | 7 | 7 | 7 | 8 | 7 | Good distinctions and numbers, but the shared-refresh exception weakens the demonstrated deadline guarantee (RR-09-01). |
| Retries that help instead of hurt<br>`network-retries` | 8 | 8 | 8 | 7 | 8 | 8 | The retry table and multiplication examples teach useful decisions; policy execution is left implicit (RR-09-02). |
| Idempotency keys over HTTP<br>`network-idempotency` | 8 | 7 | 8 | 7 | 8 | 7 | HTTP example and persistence rules are strong; retention wording is ambiguous (RR-09-03). |
| Offline play and reconciliation<br>`network-offline` | 7 | 8 | 7 | 7 | 8 | 7 | Clear portal and offline states; assessment concentrates on connectivity rather than reconciliation (RR-09-04). |
| Trace a request: ids, logs, and privacy<br>`network-observability` | 9 | 8 | 9 | 8 | 8 | 9 | Concrete log fields, lifecycle of IDs and redaction rationale support the exercise; no material writing finding. |

## Findings and proposed changes

### RR-09-01: Complete the deadline example across shared refresh

High priority. Scope: prose and code presentation. Section: `network-timeouts`. Source: [09-reliable-networking.md, line 52](../../../content/mobile-platform/09-reliable-networking.md#L52).

> One wait escapes the timer.

The section promises an operation-wide deadline and then states that waiting for the shared token refresh can exceed it. That qualification is honest but leaves the learner without a working model of the advertised behavior. Show how a caller can stop waiting without cancelling the refresh needed by other callers, and check the remaining deadline before sending. A two-caller timeline should show one caller timing out while the other continues. If implementation is deferred, label the snippet as incomplete before the code and provide a precise follow-up, not only the caveat after it.

### RR-09-02: Show how the policy pieces cooperate

Medium priority. Scope: code presentation and worked example. Section: `network-retries`. Source: [09-reliable-networking.md, line 154](../../../content/mobile-platform/09-reliable-networking.md#L154).

> The policy lives in one place and is set per endpoint, so that no feature carries a loop of its own:

The code stores limits and selects retryable responses but never demonstrates their execution with the session layer, Retry-After, waits, deadline and persisted operation. Supply a short pseudocode loop and a trace of a lost-response retry. Explain where retry budget/circuit-breaker decisions enter and which failure knowledge the transport actually supplies. The full implementation need not be large; the learner needs the order and ownership of the decisions.

### RR-09-03: Name the two retention windows directly

Medium priority. Scope: prose readability. Section: `network-idempotency`. Source: [09-reliable-networking.md, line 293](../../../content/mobile-platform/09-reliable-networking.md#L293).

> The key's lifetime is shorter than the server's.

The sentence sounds as though it compares the lifetime of a key with the lifetime of a server process. The paragraph is actually about the client's resend window and the server's retention of completed-operation keys. Replace it with that relationship and a short expired-key timeline. Also reconcile the “four rules” lead-in with the subsequent never-reuse rule by grouping reuse under operation identity or numbering the rules consistently.

### RR-09-04: Assess reconciliation as well as detecting connectivity

Medium priority. Scope: question blocks and concept structure. Section: `network-offline`. Source: [09-reliable-networking.md, line 415](../../../content/mobile-platform/09-reliable-networking.md#L415).

> ?? network-reachability `Application.internetReachability` returns `ReachableViaLocalAreaNetwork`.

The two concepts cover reachability and captive portals, while the latter half teaches durable pending work, cloud-save conflicts and player-visible states. None of the variants tests resolving a 412, retaining a timed-out write, or handling competing balances. Propose an additional reconciliation concept or a focused exercise with expected states. A new concept affects progress/unlocking and needs an explicit decision; adding more reachability variants would not close the gap.

### RR-09-05: Supply the lost-response test fixture

Medium priority. Scope: exercise and code presentation. Section: `network-idempotency`. Source: [09-reliable-networking.md, line 327](../../../content/mobile-platform/09-reliable-networking.md#L327).

> Lab exercise: Add an idempotency key to one write in a sample client,

The exercise depends on a server that commits and drops the connection, but only the client operation type is supplied. Provide a minimal fake or a transport-level scripted response with an observable server-side count, plus instructions for reloading the persisted operation after a simulated restart. State which behavior a pure fake proves and which needs an actual socket test. This makes the failure case repeatable without requiring the learner to invent the testing infrastructure.

## Exercises and assessment

All 39 variants were read. Deadline arithmetic, retry multiplication and operation identity are well tested with changing situations. The retry and key questions generally distinguish transient failure from uncertainty. Offline reconciliation is the notable coverage gap (RR-09-04). The airplane-mode/portal exercise requires suitable device and network access; a supplied HTML-200/TLS-failure fixture would provide a useful alternative. The observation exercise is well supported by the example JSON and can be done without a production logging system.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> The key's lifetime is shorter than the server's.

After:

> The client must stop resending before the server expires its record of the key.

Before:

> The figure is for one player action, and what it leaves out is when it happens.

After:

> The 27-attempt estimate describes one action. During an outage, many players trigger that same retry load together.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
