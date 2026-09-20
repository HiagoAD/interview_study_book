---
book: Unity Game Engineering
chapter: 13: LiveOps, persistence, and safe releases
---

## Design a seasonal event as a versioned product feature {#liveops-event-model}

A seasonal event combines availability, content, progression, rewards, presentation, and operational controls. Treating it as “a timer and a new screen” misses most of its production behavior.

Define an immutable event identity and a content revision. The event definition contains availability instants, eligible player conditions, mission or level references, reward tables, and supported client capabilities. Player state contains participation, progress, claims, and any pending operations.

Represent the lifecycle explicitly:

```text
Unavailable -> Upcoming -> Active -> Claim-only -> Archived
                         -> Suspended, according to incident policy
```

Use the states the event requires, keeping earning progress separate from claiming an already earned reward. Ending participation at midnight does not automatically answer whether a player may claim afterward.

Specify time authority. Online reward eligibility should use a trusted authority when the economy requires it. A device clock can be changed, and a stored offset alone cannot make an offline client fully trustworthy. Offline participation needs an explicit policy: allow provisional progress, limit eligibility, or reconcile later.

Use UTC instants for shared global boundaries and localize their display. If the product requires “local midnight,” specify timezone and daylight-saving behavior rather than treating a calendar date as a universal instant.

Define what happens to a run started just before the event ends. Eligibility can be based on start time, completion time, or a captured event instance. Choose one and test the boundary. Persist the relevant revision so a resumed run does not silently change rules halfway through.

?? liveops-claim-window Why separate “Active” from “Claim-only” in an event model?
* Earning new progress and claiming previously earned rewards can have different eligibility windows.
- Every event must last exactly one day.
- Claims are only presentation and cannot affect inventory.
- A client clock always provides trusted authority.
> Event closure has several meanings. Separate states make the earning and claiming policies explicit.

?? liveops-time-authority Can a client-side clock offset by itself provide strong authority against device tampering?
* No; an offline client-controlled value is not equivalent to trusted server validation.
- Yes, if it is stored in a ScriptableObject.
- Yes, if it is converted to a string.
- Yes, if the countdown uses double precision.
> Clock representation does not establish trust. Offline behavior and later reconciliation require an explicit product and authority policy.

## Version saves and migrate without losing player state {#liveops-save-migration}

A save is a long-lived contract. Include a schema version, stable content identities, and enough state to recover interrupted operations. Do not use scene object instance IDs, array positions that can reorder, or display text as durable identity.

A migration transforms one supported schema into the next:

```text
Read bytes
Parse envelope and version
Validate structural limits
Migrate v1 -> v2 -> v3 as required
Validate current invariants
Commit migrated data safely
Load runtime state
```

Keep migration steps deterministic and test them with real historical fixtures where possible. A migration may assume its stated input version; the overall migration runner should record the new version so loading again does not reapply a grant or conversion. Retain an original backup or recovery path until commitment is confirmed.

For local file persistence, a common approach writes a complete temporary file and then replaces the previous save using appropriate platform facilities. Atomic replacement, flushing, and crash durability depend on the platform and filesystem; a rename alone is not a universal durability guarantee. Test recovery through the project's storage adapter.

Distinguish missing, corrupt, unsupported-future, and old-valid saves. Resetting everything to defaults for every parse error can destroy recoverable progress. An unsupported newer schema after rollback should trigger a deliberate compatibility path, not silent truncation.

Checksums detect accidental corruption; they do not make client data authoritative against an attacker. Encryption similarly does not turn a client-owned economy into a trusted server.

Decide how unknown content IDs behave. Preserve unknown records for possible future recovery, map retired content through an explicit table, or compensate under a documented policy. Deleting unknown items during every load can make temporary catalog mismatches permanent.

?? liveops-future-save An older binary encounters a save from a newer unsupported schema. What should it do?
* Follow an explicit compatibility or recovery policy while preserving the original data.
- Silently discard unknown fields and overwrite the only copy.
- Assume every parse error means a new player.
- Grant all possible rewards to compensate automatically.
> Rollback compatibility must be designed. Destructive fallback can turn a recoverable version mismatch into permanent loss.

?? liveops-migration-repeat Why must a completed migration update the save's schema version?
* So later loads do not apply the same transformation or grant again.
- So display text becomes the new item ID.
- So validation can be skipped forever.
- So all future schemas become automatically readable.
> Migration sequencing is versioned state. Reapplying a nontrivial transformation can corrupt balances or duplicate rewards.

?+ A migration doubles a legacy currency balance but leaves the schema version unchanged. What can happen on the next load?
* The migration can double the already converted balance again.
- The loader necessarily knows the transformation already happened from the number alone.
- The balance automatically returns to its original value.
- The version field is irrelevant to migration sequencing.
> A transformation and its version transition must be committed coherently. Otherwise repeated loading can repeat the transformation.

## Feature flags and configuration need complete states {#liveops-flags-config}

A feature flag controls exposure or behavior. It should have a safe default when configuration is unavailable, malformed, stale, or incompatible.

Separate assignment from activation. A player can belong to an experiment cohort while the feature remains disabled because required content is missing or the client lacks a capability. Stable assignment avoids players switching treatment groups every launch.

Capture the relevant configuration for operations that must remain consistent. If a reward multiplier changes halfway through a run, decide whether the run uses its starting revision or adopts the new value at a defined boundary. Avoid reading mutable configuration independently in every component.

Configuration is input and needs validation. Check ranges, finite numbers, required references, supported enum values, and minimum client capabilities before accepting a revision. Keep a known valid fallback if the product requires continued operation.

A kill switch must reach the operation that causes the problem. Hiding a button does not stop an already queued claim, a background grant, or a task that captured old configuration. Define whether in-flight work finishes, cancels, or reconciles, and preserve already committed player outcomes.

Test disabled, enabled, partially available, stale, and mid-operation transition states. Flags increase the number of valid configurations; remove obsolete flags once their operational purpose ends.

?? liveops-kill-switch A faulty reward feature is disabled by hiding its button, but queued grant operations still run. What is missing?
* A policy that gates or reconciles the authoritative in-flight operations.
- A different button color.
- A larger image cache.
- A guarantee that presentation visibility is authority.
> A kill switch must reach the behavior it is intended to stop. Existing operations need explicit handling at the state or authority boundary.

?+ A kill switch activates after a reward has already committed. Which policy preserves the transaction's meaning?
* Keep the committed outcome and handle any compensation through an explicit separate policy.
- Pretend the original commitment never occurred because the button is now hidden.
- Delete the idempotency record so the client can retry as a new grant.
- Allow the animation to decide whether the balance should remain.
> Disabling future behavior does not retroactively erase a committed transaction. Reversal or compensation is a separate domain operation.

?? liveops-config-snapshot Why might a run capture a configuration revision at startup?
* To keep its rules consistent if configuration changes during play.
- To prevent all future content updates.
- To replace the need for input validation.
- To make a client automatically authoritative over server rewards.
> A captured revision establishes which rules apply to that operation. Trust and validation remain separate concerns.

## Ship compatible code and content in controlled stages {#liveops-release-compatibility}

In a live game, multiple binary versions can coexist. Content and services must account for older clients that have not updated. A new event referencing a new component cannot work on a binary that lacks that component.

Use an explicit capability or compatibility contract: schema version, supported feature IDs, required assets, and fallback behavior. Validate content before exposure. Downloaded content still needs to be compatible with the receiving client.

An expand-and-contract change introduces compatible support first, then transitions usage, and removes the old path only after it is safe. For a renamed field, a reader can temporarily accept old and new representations while the writer moves to the new format. The exact plan depends on which versions must coexist.

A release sequence might be:

1. Add backward-compatible code and tests with exposure disabled.
2. Validate content against supported clients and device budgets.
3. Run internal and limited-cohort checks.
4. Increase exposure while observing technical and product guardrails.
5. Retain a compatible fallback until risk is understood.
6. Remove transitional code and flags in a deliberate follow-up.

Guardrails can include crash or error rates, claim failures, save failures, frame-time regressions, and unexpected economy changes. Compare like cohorts and account for sample size; a tiny cohort with no observed crash is not proof of zero risk.

Rollback has limits. Reverting code does not undo a save migration or already granted rewards. Prefer reversible exposure changes and backward-compatible data transitions; otherwise plan a forward repair or compensation.

In an interview, describe the release gates you used rather than presenting an idealized process as your history.

?? liveops-content-compatibility What does a successful asset download fail to prove?
* That the current binary understands the content schema and required runtime capabilities.
- That any bytes arrived.
- That the file has a name.
- That the player has a screen.
> Delivery and compatibility are separate. A client can receive content that it cannot safely use.

?? liveops-rollback-limit Why might reverting to the previous binary fail to restore safe behavior?
* The newer version may already have changed persistent data or granted irreversible outcomes.
- Source code can never be reverted.
- Every feature flag automatically repairs old saves.
- Rollback always erases all external effects safely.
> Operational recovery must account for persistent effects, not just executable code.

## Treat outages, retries, and reconciliation as normal paths {#liveops-network-failures}

A live client must handle disconnection, latency, duplicate delivery, process suspension, and ambiguous completion. These are ordinary operating conditions.

Use bounded retries with increasing delays and jitter for retryable failures. Jitter reduces synchronized retry bursts across clients. Respect the operation's idempotency contract; retries are unsafe if every attempt creates a new reward.

Classify errors. Invalid input and unsupported content usually require correction, not rapid retry. Temporary unavailability may justify retry. Authentication expiry may require a controlled refresh. A timeout after a request was sent can require querying the operation's status.

Persist pending operation identity when the action must survive process restart. Otherwise the client may lose the only key that distinguishes a retry from a new action. Reconciliation compares the local view with authoritative results and applies missing presentation or local state updates.

Offline queues need bounds and ordering rules. A queue that grows forever can exhaust storage; an old action may no longer be valid when the event closes. Define expiration, rejection, and player feedback. Do not promise an offline reward that the authority can later reject without a clear product policy.

If several systems must react to a committed operation, a transactional outbox is one possible server-side design: save the state change and pending notification in the same transaction, then deliver the notification with retry. Consumers still need idempotency. Use an outbox when a committed change must reliably produce notifications despite a process failure.

?? liveops-retry-classification Which failure most clearly calls for correction rather than repeated immediate retries?
* A request violates the supported schema with an invalid required field.
- A temporary service-unavailable response under a retryable contract.
- A short transient connection interruption.
- A retryable rate-limit response after the specified waiting period.
> Retrying the same invalid request cannot make its schema valid. Classify failures so recovery matches the cause.

?? liveops-pending-persistence Why persist a pending reward operation's identity before relying on later recovery?
* Restart must be able to reconcile the same logical operation instead of inventing another grant.
- It guarantees the network cannot fail.
- It makes every client-provided reward amount trusted.
- It removes the need for an authoritative result.
> Stable operation identity connects attempts across process lifetimes. Authority and reconciliation still determine the result.

## Handle production incidents with containment and evidence {#liveops-incidents}

When a live defect appears, first establish player impact and scope. Is the game crashing, losing progress, duplicating currency, or showing a cosmetic error? Which builds, content revisions, cohorts, and devices are affected?

Contain the problem with the smallest effective intervention: pause exposure, disable a risky operation, withdraw incompatible content, or revert a safe configuration revision. Assign an incident owner and communicate known facts, current impact, mitigation, and the next update. Distinguish confirmed facts from suspected causes.

Preserve evidence: operation IDs, error categories, configuration revisions, relevant traces, and a timeline. Handle player information according to the organization's policies and incident-response needs. Avoid collecting broad sensitive data merely because it might be convenient.

Then reproduce, fix, and validate. A duplicate reward incident may require both stopping new duplicates and reconciling affected accounts. Compensation is a product and operations decision with its own correctness requirements; do not improvise a mass balance change while still unsure of the cause.

After containment, write a blameless causal analysis. Include the triggering change, the conditions that allowed it, why checks missed it, how it was detected, and specific prevention work. “Be more careful” is not a useful action item. “Validate reward IDs before event publication and add a timeout-after-commit regression test” is.

Measure the effectiveness of follow-up work. If every seasonal event requires a manual rescue, the problem may be the authoring and validation system rather than individual mistakes.

?? liveops-incident-first Which response best begins an incident involving duplicated rewards?
* Establish scope and contain further grants while preserving evidence for reconciliation.
- Immediately rewrite the whole economy system.
- Delete all operation records to simplify the database.
- Assume the UI is wrong and tell players to restart.
> Containment limits ongoing impact. Evidence supports a correct repair and avoids compounding the problem.

?? liveops-actionable-postmortem Which postmortem action is most concrete?
* Add pre-publication validation for duplicate reward IDs and a regression test for the triggering retry.
- Ask everyone to be more careful.
- Promise that no future release will contain bugs.
- Remove diagnostic context to reduce log volume regardless of usefulness.
> Effective follow-up changes a system or check in a verifiable way.
