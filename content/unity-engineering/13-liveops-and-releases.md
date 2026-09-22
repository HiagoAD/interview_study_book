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

The cost of “ends at local midnight” is easier to accept once it is a number. Time zone offsets in use run from UTC minus 12 to UTC plus 14, so the local midnights that end one calendar date are spread over 26 hours, and the date itself exists somewhere in the world for 50. An event that ends at local midnight is therefore live somewhere for 26 hours after the first player loses access to it, and the leaderboard, the reward budget, and any “last chance” message all have to be written with that in mind.

Compare the two policies directly:

| Policy | Ends | Consequence |
| --- | --- | --- |
| Single UTC instant | The same moment everywhere | Some players get an inconvenient local hour; comparison is simple |
| Local midnight | Over a 26-hour window | Fair local hours; overlapping windows, and a longer tail to operate |

Neither is wrong, and both are shipped. What cannot work is choosing one and implementing the other, which is what happens when a deadline is stored as a calendar date with no zone attached. Store the instant, and derive the display.

Daylight-saving transitions add the cases that break naive implementations. In a zone that moves its clocks forward, a local time such as 02:30 does not exist on that date, and in a zone that moves them back it occurs twice. Some zones change their clocks at midnight, so on a transition day local midnight itself is skipped or happens twice, and that is the boundary “ends at local midnight” depends on. A deadline expressed as a local wall-clock time therefore has dates where it is undefined or ambiguous. Choosing a boundary such as 10:00 local avoids the common transition hours, and storing the instant avoids the problem entirely.

Exercise: For an event you know, write the exact instant it ends in UTC, then the local times that corresponds to for your three largest markets. Check whether any of them falls during a school or work day.

?? liveops-claim-window Why separate “Active” from “Claim-only” in an event model?
* Earning new progress and claiming previously earned rewards can have different eligibility windows.
- Claiming needs a server round trip, while earning can run locally.
- The claim screen uses a different scene, which needs its own state.
- Rewards are granted in batches once the event has closed.
- Progress is stored per run, while claims are stored per player.
> Ending an event may stop new progress while still allowing earned rewards to be claimed. Separate states make both rules explicit.

?? liveops-time-authority Can a client-side clock offset by itself provide strong authority against device tampering?
* No; an offline client-controlled value is not equivalent to trusted server validation.
- Yes, if the offset is captured from the first server response of the session.
- Yes, if the client also records elapsed monotonic time since launch.
- Yes, if the offset is signed with a key shipped inside the build.
- Yes, if the offset is stored in encrypted form on the device.
- No; the offset drifts too far to stay useful for more than a day.
- No; the offset has to be measured again at each launch of the game.
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

An idle game states that problem in its purest form, because its core loop is a grant computed from elapsed time. If the save holds the timestamp of the last session and the client subtracts it from the device clock, then moving the clock forward is a cheat that needs no tools at all. Three answers are available: accept it and treat the economy as local, take the time from a trusted source and grant on the server, or clamp the offline grant to a bounded window so the worst case stays small. Each is defensible. What is not defensible is choosing none of them and describing the save as encrypted.

Decide how to handle IDs missing from the current catalog. You might preserve their records for later recovery, map retired content through an explicit table, or compensate under a documented policy. Deleting unknown items on every load can turn a temporary catalog mismatch into permanent loss.

The five outcomes of a load deserve to be distinguishable in code, because the correct response differs for each:

| Outcome | Detected by | Response |
| --- | --- | --- |
| No save | File absent | Create defaults; this is a new player |
| Valid, older schema | Version below current | Migrate forward, then commit |
| Valid, current schema | Version equals current | Load |
| Valid, newer schema | Version above current | Refuse and preserve; follow the rollback policy |
| Unreadable | Parse or checksum failure | Preserve the bytes; attempt backup; report |

The first and last rows are the ones that get merged, and merging them is how progress gets destroyed. A corrupt file and an absent file both leave the game with nothing to load, so a single `catch` that creates defaults handles both identically, and the player who had a corrupt file has now been converted into a new player with no way back. Keep the bytes, try the backup, and tell someone.

The migration chain itself should be a list rather than a branch:

```text
migrations = [ v1_to_v2, v2_to_v3, v3_to_v4 ]

Load(bytes):
    doc = Parse(bytes)
    while doc.version < CurrentVersion:
        doc = migrations[doc.version - 1].Apply(doc)   // Version 1 uses v1_to_v2, at index 0.
        doc.version += 1
    Validate(doc)
    Commit(doc)
```

Each step handles one version transition and nothing else, which keeps every step testable against a fixture from the release that produced it. Keep those fixtures in the repository. A save file captured from a shipped build is evidence that no amount of reasoning about the old schema can replace, and it becomes impossible to produce once that build is gone.

Exercise: Find the oldest schema version your project still supports, and check whether a real save file from that version exists in the repository. If not, that is the first thing to add.

?? liveops-future-save An older binary encounters a save from a newer unsupported schema. What should it do?
* Follow an explicit compatibility or recovery policy while preserving the original data.
- Load the fields it recognizes and ignore the rest.
- Run the migration chain in reverse to reach the supported version.
- Treat it as corrupt and restore from the most recent backup.
- Accept it, since a newer schema is a superset of the older one.
> Rollback compatibility must be designed. Destructive fallback can turn a recoverable version mismatch into permanent loss.

?? liveops-migration-repeat Why must a completed migration update the save's schema version?
* So later loads do not apply the same transformation or grant again.
- So the loader can choose the correct parser for the file.
- So the checksum covers the version field as well as the data.
- So analytics can report which schema versions are still in use.
- So the file size stays consistent with the schema's expectations.
> The saved version tells the loader which transformations have already happened. Without that update, another load may convert values again or duplicate rewards.

?+ A migration doubles a legacy currency balance but leaves the schema version unchanged. What can happen on the next load?
* The migration can double the already converted balance again.
- The loader rejects the save, since the balance exceeds the legacy range.
- The balance is restored from the backup written before the migration.
- The migration is skipped, since the value no longer matches the legacy format.
- The doubling applies to the portion added since the last load.
> Save the converted balance and new schema version together. Otherwise the next load may treat an already converted balance as legacy data.

## Feature flags and configuration need complete states {#liveops-flags-config}

A feature flag decides whether a feature is exposed or how it behaves. Define a safe default for configuration that is unavailable, malformed, stale, or incompatible with the client.

Keep experiment assignment separate from feature activation. A player may belong to a test group while the feature remains disabled because content is missing or the client lacks a required capability. Keep that assignment stable, so the player does not switch groups on every launch.

For an operation that needs consistent rules, capture the configuration it should use. If a reward multiplier changes during a run, decide whether the run keeps its starting revision or adopts the new value at a defined point. Reading changing configuration independently in every component can produce conflicting results.

Validate configuration before accepting a revision. Check numeric ranges, finite values, required references, supported enum values, and minimum client capabilities. If the game must continue when a new revision is invalid, keep a known valid fallback.

A kill switch must stop the operation causing the problem. Hiding a button does not stop a queued claim, a background grant, or a task using previously captured configuration. Decide whether work already in progress should finish, cancel, or have its result reconciled. Preserve outcomes that have already been committed.

Test the feature while disabled and enabled, with only some dependencies available, with stale configuration, and while configuration changes during an operation. Flags add valid combinations that the game must handle. Remove old flags once they no longer serve an operational purpose.

Where a switch acts decides what it can actually stop. Reading the layers from the player inward:

| Layer | A switch here stops | It does not stop |
| --- | --- | --- |
| Presentation | The button being visible | Anything already queued or scheduled |
| Feature entry | New claims being started | Requests already sent |
| Operation | The grant executing | Work already committed |
| Authority | The reward being recorded | Rewards recorded before the switch |

Most incidents need the third row, and most first attempts implement the first. The distance between them is the reason a feature keeps granting rewards after it has been “turned off”, which is a sentence that reads very badly in an incident review.

A useful discipline is to write the switch and its test at the same time as the feature, while the paths are fresh. The test is simple to state: activate the switch, then attempt the operation by every route that can reach it, and assert that the state does not change. Enumerating those routes is the part that finds the surprise, because the button is rarely the only one.

Decide also what the player sees. A feature that disappears without explanation generates support contacts; a feature that shows “temporarily unavailable” generates far fewer. That message is part of the switch, and writing it in advance is faster than writing it during an incident.

Exercise: For a feature you own, list every route that can reach its state-changing operation. Then say which of those routes your current switch actually blocks.

?? liveops-kill-switch A faulty reward feature is disabled by hiding its button, but queued grant operations still run. What is missing?
* Rules that stop the actual grant operations or recover the results of operations already in progress.
- A check in the button's handler that reads the switch before calling.
- A confirmation dialog before the grant, so the player can cancel it.
- A delay before the grant runs, giving operators time to react.
- A log entry recorded whenever a grant runs while the switch is active.
> Disabling the view does not stop the code that grants rewards. Apply the switch where that operation is controlled, and define how existing requests are handled.

?+ A kill switch activates after a reward has already committed. Which policy preserves the transaction's meaning?
* Keep the committed outcome and handle any compensation through an explicit separate policy.
- Reverse the grant on the client, so the balance matches the disabled feature.
- Leave the balance and clear the claim record, so the state looks untouched.
- Roll the player's save back to the state from before the claim.
- Mark the claim as pending again, so it is retried once the switch clears.
> A switch can stop future claims, but the earlier transaction already changed the player's state. Any reversal or compensation needs a separate, explicit operation.

?? liveops-config-snapshot Why might a run capture a configuration revision at startup?
* To keep its rules consistent if configuration changes during play.
- To avoid reading the configuration service on every frame.
- To make the client's configuration authoritative over the server's.
- To let a run continue after its configuration has failed validation.
- To ensure every run in a session uses a different revision.
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

A worked rename shows why the stages cannot be compressed. Suppose `coinReward` becomes `tokenReward`, and the team supports the current release and the one before it:

| Release | Writers produce | Readers accept | Live clients |
| --- | --- | --- | --- |
| 1, today | `coinReward` | `coinReward` | 1 |
| 2, expand | `coinReward` | `coinReward` or `tokenReward` | 1 and 2 |
| 3, migrate | `tokenReward` | `coinReward` or `tokenReward` | 2 and 3 |
| 4, contract | `tokenReward` | `tokenReward` | 3 and 4 |

The rule that makes this safe is visible in the table: a field is never written in a form that some live client cannot read. Release 3 can start writing the new name only because release 2 already understood it, and release 4 can stop accepting the old name only because no client that writes it is still supported.

That also explains why the sequence takes as many releases as it does, and why compressing it is the common failure. Shipping releases 2 and 3 together means clients on release 1 receive `tokenReward` and cannot read it. The work is not the rename; the work is waiting between the stages for the client population to move.

Before starting, find out what that population actually looks like. If ten percent of players are two versions behind and cannot update, the window is set by them rather than by the team's schedule.

Exercise: For a field you would like to rename, write the four rows above with your project's real supported versions. Then estimate the calendar time between the first and last row.

?? liveops-content-compatibility What does a successful asset download fail to prove?
* That the current binary understands the content schema and required runtime capabilities.
- That the bytes arrived intact, where the transfer was checksummed.
- That the device had enough storage to write the file.
- That the content service was reachable from the player's network.
- That the requested content identifier exists on the service.
> Delivery and compatibility are separate. A client can receive content that it cannot safely use.

?? liveops-rollback-limit Why might reverting to the previous binary fail to restore safe behavior?
* The newer version may already have changed persistent data or granted irreversible outcomes.
- The previous binary is no longer available in the store.
- The rollback requires every player to reinstall the application.
- Configuration changes are applied on the server and cannot be reverted.
- The previous binary would need rebuilding from the original toolchain.
> Restoring old code leaves saved data and earlier grants in place. Recovery must handle those effects as well.

## Treat outages, retries, and reconciliation as normal paths {#liveops-network-failures}

A live client must handle disconnection, latency, duplicate delivery, process suspension, and ambiguous completion. These are ordinary operating conditions.

For retryable failures, limit the number of attempts and increase the delay between them. Add random variation, called jitter, so clients do not all retry at the same moment. Reuse the operation's identity and follow its duplicate-handling rules; a retry must not create another reward.

Choose recovery according to the error. Invalid input or unsupported content usually needs correction. Temporary unavailability may justify a retry. Expired authentication may need a controlled refresh. If a sent request times out, check whether it completed before deciding what to do next.

Save a pending operation's identity when recovery must survive a process restart. Otherwise the client can lose the key that tells the authority this is a retry of an existing action. During reconciliation, compare local state with the authoritative result, then apply any missing local updates or presentation.

Limit offline queue size and define processing order. An unlimited queue can exhaust storage, and an action may become invalid before the client reconnects, such as when an event closes. Specify expiry, rejection, and player feedback. If an offline reward can later be rejected by the authority, make that possibility part of the product's policy.

A server can use a transactional outbox when a committed change must reliably produce notifications. Save the state change and a pending notification in the same transaction, then send the notification with retries. A process failure can then be recovered without forgetting the notification. Receivers still need to recognize duplicates.

A concrete schedule is easier to review than a description. Exponential backoff with full jitter, capped, looks like this:

| Attempt | Base delay | Actual delay, drawn uniformly |
| --- | --- | --- |
| 1 | 1 s | 0 to 1 s |
| 2 | 2 s | 0 to 2 s |
| 3 | 4 s | 0 to 4 s |
| 4 | 8 s | 0 to 8 s |
| 5 | 16 s | 0 to 16 s |
| 6 and later | 30 s cap | 0 to 30 s |

The jitter is not a detail. Without it, every client that failed during the same outage retries at the same instants, so the service receives a synchronized wave of traffic exactly when it is least able to absorb it, fails again, and receives a larger wave a moment later. Spreading each client's delay across the interval turns that wave into a flat load, and it costs one random draw.

Give the whole sequence a deadline as well as a cap, since an operation that retries forever is a different failure wearing the costume of resilience. After the deadline, move the operation to the abandoned state described earlier, tell the player something true, and leave the record for reconciliation. Note also that these delays are wall-clock, so decide what happens when the app is backgrounded partway through a wait, and whether the schedule resumes or restarts.

Exercise: Write the retry schedule your project uses, including the cap, the jitter, and the deadline. If any of the three is missing, decide what it should be.

?? liveops-retry-classification Which failure most clearly calls for correction rather than repeated immediate retries?
* A request violates the supported schema with an invalid required field.
- A response indicating the service is temporarily over capacity.
- A connection reset partway through sending the request.
- A response asking the client to wait before trying again.
- A timeout with no response received from the service.
> Retrying the same invalid request cannot make its schema valid. Classify failures so recovery matches the cause.

?? liveops-pending-persistence Why persist a pending reward operation's identity before relying on later recovery?
* After restart, the client must recover the same claim's result instead of creating another grant.
- So the retry schedule resumes from the attempt it had reached.
- So the player can see the pending reward while the app is offline.
- So the claim can be cancelled from the settings screen.
- So analytics can measure how long claims take to confirm.
> The saved ID lets the client resume the same logical operation after restart. It still needs the authority's result to determine what happened.

## Handle production incidents with containment and evidence {#liveops-incidents}

First establish the impact and scope of a live defect. Determine whether it crashes the game, loses progress, duplicates currency, or only affects presentation. Identify the affected builds, content revisions, test groups, and devices.

Use the smallest intervention that stops further harm: pause exposure, disable the failing operation, withdraw incompatible content, or restore a safe configuration. Assign an incident owner. Communicate confirmed facts, current impact, the mitigation, and when the next update is due; label suspected causes as unconfirmed.

Keep the evidence needed to investigate: operation IDs, error categories, configuration revisions, relevant traces, and a timeline. Handle player information according to organizational policies and the incident's needs. Avoid collecting broad sensitive data without a specific reason.

Once the problem is contained, reproduce it, fix it, and validate the repair. A duplicate-reward incident may also need account reconciliation. Compensation has its own product and correctness requirements; agree on those before making a mass balance change, especially while the cause is still uncertain.

Write a causal analysis without assigning blame. Explain the triggering change, the conditions that allowed the failure, why checks missed it, and how it was detected. Follow with specific prevention work. “Be more careful” gives the team nothing concrete to verify. “Validate reward IDs before event publication and add a timeout-after-commit regression test” does.

Check whether the follow-up work prevents recurrence. If every seasonal event needs a manual rescue, investigate the authoring and validation process instead of treating each incident as an isolated mistake.

The first fifteen minutes have a shape worth rehearsing, because that is when judgment is worst and the pressure to act is highest:

```text
0-2 min    State the symptom in one sentence. Do not diagnose yet.
2-5 min    Scope it: which builds, content revisions, cohorts, platforms?
5-8 min    Decide containment. Prefer the reversible action available now.
8-10 min   Apply containment. Record the exact time it took effect.
10-15 min  Post confirmed facts, current impact, action taken, next update time.
```

The instruction not to diagnose early is the one that saves the most time. An incident that begins with a theory tends to collect evidence for that theory, and the first theory is frequently wrong. Scope first: knowing that only one content revision is affected often identifies the cause without anyone reasoning about code at all.

Record the time containment took effect, because every later question depends on it. Which players are affected, how many rewards need reconciling, and whether the fix worked are all answered by comparing against that timestamp. It is much harder to reconstruct afterward than to write down at the moment.

Say what you know and when you will next speak. “Duplicate grants confirmed on event winter-07, claims disabled at 14:22 UTC, reconciliation scope being assessed, next update at 15:00” gives every reader what they need. Silence during an incident is filled by speculation, and the speculation is usually worse than the truth.

Exercise: Write the one-sentence symptom statement for the last incident you witnessed, as it would have been written at minute two. Compare it with what the cause turned out to be.

?? liveops-incident-first Which response best begins an incident involving duplicated rewards?
* Identify who is affected, stop further duplicate grants, and preserve the records needed to reconcile results.
- Reproduce the duplicate locally before changing anything in production.
- Deploy the fix as soon as the cause has been identified.
- Compensate the affected players so the economy balances again.
- Announce the issue publicly before the scope is known.
> Stopping further duplicates limits the impact. Keeping the operation records lets the team investigate and repair affected state without making the problem worse.

?? liveops-actionable-postmortem Which postmortem action is most concrete?
* Add pre-publication validation for duplicate reward IDs and a regression test for the triggering retry.
- Add a review step requiring two approvals on reward content.
- Increase the size of the test cohort for the next event.
- Schedule a team session on the idempotency rules.
- Document the incident timeline in the team wiki.
> Effective follow-up changes a system or check in a verifiable way.
