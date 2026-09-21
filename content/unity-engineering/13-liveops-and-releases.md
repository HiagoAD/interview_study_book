---
book: Unity Game Engineering
chapter: 13: LiveOps, persistence, and safe releases
---

## Design a seasonal event as a versioned product feature {#liveops-event-model}

A seasonal event needs rules for availability, content, progress, rewards, presentation, and operational controls. Describing it as “a timer and a new screen” leaves out decisions such as who can participate, what happens when it ends, and how to stop it if something goes wrong.

Give the event a stable identity and version its content. Its definition contains start and end times, player eligibility rules, mission or level references, reward tables, and required client capabilities. Keep player state separate: it records participation, progress, claims, and pending operations.

Represent the lifecycle explicitly:

```text
Unavailable -> Upcoming -> Active -> Claim-only -> Archived
                         -> Suspended, according to incident policy
```

Choose the states the event actually needs. Keep earning progress separate from claiming a reward already earned. If participation ends at midnight, the design must still say whether players can claim their rewards afterward.

Decide which source of time controls eligibility. An online economy may need a trusted service to make that decision. Players can change the device clock, and saving an offset locally does not make an offline client fully trustworthy. Specify what offline participation allows: provisional progress, limited eligibility, or later reconciliation with the authority.

Represent shared global boundaries as UTC instants, then display them in the player's local time. If the requirement is “local midnight,” specify the timezone and what happens around daylight-saving changes. A calendar date alone does not identify one instant for every player.

Decide what happens when a run starts just before the event ends. Eligibility could depend on the start time, completion time, or event instance captured at the start. Choose a rule and test its exact boundary. Save the relevant revision so a resumed run does not silently switch rules.

?? liveops-claim-window Why separate “Active” from “Claim-only” in an event model?
* Earning new progress and claiming previously earned rewards can have different eligibility windows.
- Every event must last exactly one day.
- Claims are only presentation and cannot affect inventory.
- A client clock always provides trusted authority.
> Ending an event may stop new progress while still allowing earned rewards to be claimed. Separate states make both rules explicit.

?? liveops-time-authority Can a client-side clock offset by itself provide strong authority against device tampering?
* No; an offline client-controlled value is not equivalent to trusted server validation.
- Yes, if it is stored in a ScriptableObject.
- Yes, if it is converted to a string.
- Yes, if the countdown uses double precision.
> Changing how time is stored does not make it trusted. Decide what an offline client may do and how the authority will validate or reconcile it later.

## Version saves and migrate without losing player state {#liveops-save-migration}

A save must remain understandable beyond the version that created it. Include a schema version, stable content IDs, and enough state to recover interrupted operations. Scene object instance IDs, reorderable array positions, and display text are unsuitable as lasting identities.

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

Make each migration step deterministic, and test it against real historical saves where possible. A step may rely on its declared input version. The migration runner must then save the new version with the converted data, so the next load does not repeat a conversion or grant. Keep the original backup or another recovery path until the commit is confirmed.

A common local-save approach writes a complete temporary file, then replaces the previous save using the platform's storage facilities. The guarantees depend on the platform and filesystem: atomic replacement, flushing, and survival after a crash are distinct concerns. A rename alone is not a universal durability guarantee. Test failure recovery through the project's storage adapter.

Handle missing, corrupt, valid older, and unsupported newer saves as different cases. Resetting to defaults after every parse error can destroy progress that could have been recovered. After a rollback, an older binary may encounter a newer schema; follow a defined compatibility policy and preserve the original data.

Checksums help detect accidental corruption. They do not make client-owned data trustworthy against deliberate tampering. Encryption also does not give a client-owned economy the authority of a trusted server.

Decide how to handle IDs missing from the current catalog. You might preserve their records for later recovery, map retired content through an explicit table, or compensate under a documented policy. Deleting unknown items on every load can turn a temporary catalog mismatch into permanent loss.

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
> The saved version tells the loader which transformations have already happened. Without that update, another load may convert values again or duplicate rewards.

?+ A migration doubles a legacy currency balance but leaves the schema version unchanged. What can happen on the next load?
* The migration can double the already converted balance again.
- The loader necessarily knows the transformation already happened from the number alone.
- The balance automatically returns to its original value.
- The version field is irrelevant to migration sequencing.
> Save the converted balance and new schema version together. Otherwise the next load may treat an already converted balance as legacy data.

## Feature flags and configuration need complete states {#liveops-flags-config}

A feature flag decides whether a feature is exposed or how it behaves. Define a safe default for configuration that is unavailable, malformed, stale, or incompatible with the client.

Keep experiment assignment separate from feature activation. A player may belong to a test group while the feature remains disabled because content is missing or the client lacks a required capability. Keep that assignment stable, so the player does not switch groups on every launch.

For an operation that needs consistent rules, capture the configuration it should use. If a reward multiplier changes during a run, decide whether the run keeps its starting revision or adopts the new value at a defined point. Reading changing configuration independently in every component can produce conflicting results.

Validate configuration before accepting a revision. Check numeric ranges, finite values, required references, supported enum values, and minimum client capabilities. If the game must continue when a new revision is invalid, keep a known valid fallback.

A kill switch must stop the operation causing the problem. Hiding a button does not stop a queued claim, a background grant, or a task using previously captured configuration. Decide whether work already in progress should finish, cancel, or have its result reconciled. Preserve outcomes that have already been committed.

Test the feature while disabled and enabled, with only some dependencies available, with stale configuration, and while configuration changes during an operation. Flags add valid combinations that the game must handle. Remove old flags once they no longer serve an operational purpose.

?? liveops-kill-switch A faulty reward feature is disabled by hiding its button, but queued grant operations still run. What is missing?
* Rules that stop the actual grant operations or recover the results of operations already in progress.
- A different button color.
- A larger image cache.
- A guarantee that presentation visibility is authority.
> Disabling the view does not stop the code that grants rewards. Apply the switch where that operation is controlled, and define how existing requests are handled.

?+ A kill switch activates after a reward has already committed. Which policy preserves the transaction's meaning?
* Keep the committed outcome and handle any compensation through an explicit separate policy.
- Pretend the original commitment never occurred because the button is now hidden.
- Delete the idempotency record so the client can retry as a new grant.
- Allow the animation to decide whether the balance should remain.
> A switch can stop future claims, but the earlier transaction already changed the player's state. Any reversal or compensation needs a separate, explicit operation.

?? liveops-config-snapshot Why might a run capture a configuration revision at startup?
* To keep its rules consistent if configuration changes during play.
- To prevent all future content updates.
- To replace the need for input validation.
- To make a client automatically authoritative over server rewards.
> Capturing a revision makes it clear which rules the run uses. It does not replace validation or make the client a trusted reward authority.

## Ship compatible code and content in controlled stages {#liveops-release-compatibility}

Players in a live game may run several binary versions at once. Content and services must support the older clients that have not updated. An event requiring a new component cannot run on a binary that lacks that component.

Define compatibility in terms the client can check: schema version, supported feature IDs, required assets, and fallback behavior. Validate content before exposing it. A successful download does not establish that the receiving client can use the content.

An expand-and-contract migration adds compatible support first, moves usage to the new form, then removes the old form when it is safe. For a renamed field, readers might temporarily accept both names while writers move to the new name. Plan those stages around the versions that must coexist.

A release sequence might be:

1. Add backward-compatible code and tests with exposure disabled.
2. Validate content against supported clients and device budgets.
3. Run internal and limited-cohort checks.
4. Increase exposure while observing technical and product guardrails.
5. Retain a compatible fallback until risk is understood.
6. Remove transitional code and flags in a deliberate follow-up.

Choose measurements that tell the team when to stop increasing exposure. These can include crash and error rates, failed claims or saves, slower frames, and unexpected economy changes. Compare similar groups and account for sample size. Seeing no crashes in a tiny group does not prove that the release has no crash risk.

Reverting code does not undo a save migration or take back rewards already granted. Prefer exposure changes that can be reversed and data changes compatible with older versions. When those are not possible, plan a repair in a newer version or a separate compensation operation.

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
> Restoring old code leaves saved data and earlier grants in place. Recovery must handle those effects as well.

## Treat outages, retries, and reconciliation as normal paths {#liveops-network-failures}

A live client must handle disconnection, latency, duplicate delivery, process suspension, and ambiguous completion. These are ordinary operating conditions.

For retryable failures, limit the number of attempts and increase the delay between them. Add random variation, called jitter, so clients do not all retry at the same moment. Reuse the operation's identity and follow its duplicate-handling rules; a retry must not create another reward.

Choose recovery according to the error. Invalid input or unsupported content usually needs correction. Temporary unavailability may justify a retry. Expired authentication may need a controlled refresh. If a sent request times out, check whether it completed before deciding what to do next.

Save a pending operation's identity when recovery must survive a process restart. Otherwise the client can lose the key that tells the authority this is a retry of an existing action. During reconciliation, compare local state with the authoritative result, then apply any missing local updates or presentation.

Limit offline queue size and define processing order. An unlimited queue can exhaust storage, and an action may become invalid before the client reconnects, such as when an event closes. Specify expiry, rejection, and player feedback. If an offline reward can later be rejected by the authority, make that possibility part of the product's policy.

A server can use a transactional outbox when a committed change must reliably produce notifications. Save the state change and a pending notification in the same transaction, then send the notification with retries. A process failure can then be recovered without forgetting the notification. Receivers still need to recognize duplicates.

?? liveops-retry-classification Which failure most clearly calls for correction rather than repeated immediate retries?
* A request violates the supported schema with an invalid required field.
- A temporary service-unavailable response under a retryable contract.
- A short transient connection interruption.
- A retryable rate-limit response after the specified waiting period.
> Retrying the same invalid request cannot make its schema valid. Classify failures so recovery matches the cause.

?? liveops-pending-persistence Why persist a pending reward operation's identity before relying on later recovery?
* After restart, the client must recover the same claim's result instead of creating another grant.
- It guarantees the network cannot fail.
- It makes every client-provided reward amount trusted.
- It removes the need for an authoritative result.
> The saved ID lets the client resume the same logical operation after restart. It still needs the authority's result to determine what happened.

## Handle production incidents with containment and evidence {#liveops-incidents}

First establish the impact and scope of a live defect. Determine whether it crashes the game, loses progress, duplicates currency, or only affects presentation. Identify the affected builds, content revisions, test groups, and devices.

Use the smallest intervention that stops further harm: pause exposure, disable the failing operation, withdraw incompatible content, or restore a safe configuration. Assign an incident owner. Communicate confirmed facts, current impact, the mitigation, and when the next update is due; label suspected causes as unconfirmed.

Keep the evidence needed to investigate: operation IDs, error categories, configuration revisions, relevant traces, and a timeline. Handle player information according to organizational policies and the incident's needs. Avoid collecting broad sensitive data without a specific reason.

Once the problem is contained, reproduce it, fix it, and validate the repair. A duplicate-reward incident may also need account reconciliation. Compensation has its own product and correctness requirements; agree on those before making a mass balance change, especially while the cause is still uncertain.

Write a causal analysis without assigning blame. Explain the triggering change, the conditions that allowed the failure, why checks missed it, and how it was detected. Follow with specific prevention work. “Be more careful” gives the team nothing concrete to verify. “Validate reward IDs before event publication and add a timeout-after-commit regression test” does.

Check whether the follow-up work prevents recurrence. If every seasonal event needs a manual rescue, investigate the authoring and validation process instead of treating each incident as an isolated mistake.

?? liveops-incident-first Which response best begins an incident involving duplicated rewards?
* Identify who is affected, stop further duplicate grants, and preserve the records needed to reconcile results.
- Immediately rewrite the whole economy system.
- Delete all operation records to simplify the database.
- Assume the UI is wrong and tell players to restart.
> Stopping further duplicates limits the impact. Keeping the operation records lets the team investigate and repair affected state without making the problem worse.

?? liveops-actionable-postmortem Which postmortem action is most concrete?
* Add pre-publication validation for duplicate reward IDs and a regression test for the triggering retry.
- Ask everyone to be more careful.
- Promise that no future release will contain bugs.
- Remove diagnostic context to reduce log volume regardless of usefulness.
> Effective follow-up changes a system or check in a verifiable way.
