---
book: Unity Game Engineering
chapter: 03: Missions, rewards, and feature boundaries
---

## Model progress as facts evaluated against definitions {#missions-progress-model}

A mission system answers three different questions: what does the mission require, what has the player done, and has its reward been claimed? Represent those separately.

A definition might contain a stable mission ID, revision, objective type, target, eligible mode, reward specification, and availability window. Progress contains a count or accumulated quantity. Claim state records the grant operation and its outcome. Changing text must not change identity; changing a target during an active mission requires a migration or a rule that active missions retain their original definition revision.

Start with explicit objective categories such as collect coins, finish runs, and travel distance. An event describing a completed action carries the relevant facts:

```text
RunEvent:
  eventId
  runId
  sequence
  eventKind
  amount
  modeId
  simulationTick
```

A small offline game can update counters directly without retaining the events in this example schema. Recording events becomes useful for diagnosing ordering, replaying deterministic rules, or processing delayed operations, but it adds storage and compatibility costs.

Define the meaning of amounts. A distance mission might use whole centimeters accumulated by simulation rather than repeatedly rounding a displayed meter value. A “collect 100 coins in one run” objective differs from “collect 100 coins across runs”; the former needs a run-scoped counter and a clear reset boundary.

Progress should usually saturate at the target if excess progress has no meaning. Saturation also simplifies the UI. Use a sufficiently wide type and validate input before addition; clamping after an overflowing addition does not repair the result.

Consider indexing active missions by event kind. If only three of fifty missions react to coin collection, evaluate those three. Keep the plain scan until the scale or measurement justifies the index, because indices must be rebuilt when the active mission set changes.

?? missions-definition-state A mission's description is translated. Which data should remain stable?
* Its persistent mission identity.
- Its claim operation must be recreated.
- Its progress must reset.
- Its content ID must become the translated sentence.
> Presentation changes should not invalidate persistent references. Semantic rule changes need explicit revision and migration decisions.

?? missions-scope Why does “collect 100 coins in one run” require different state handling from “collect 100 coins overall”?
* The first objective's accumulation and reset are tied to a run boundary.
- The first can only be implemented with inheritance.
- The second needs a collider on every mission.
- Both must reset whenever the HUD closes.
> Scope determines state ownership and reset behavior. Similar wording can hide different lifecycle requirements.

## Ordering, duplicate delivery, and reproducibility {#missions-event-ordering}

Imagine these facts arriving: run finished, coin collected, coin collected again. If the last two messages are delayed or duplicated, incrementing a counter on every callback can corrupt progress.

First define the delivery contract. Are events synchronous within a single run? Queued until the end of the frame? Persisted and retried? Received from a server? The answers determine how much ordering and deduplication the receiver needs to handle.

A sequence number orders events within a stream; an event ID identifies a logical event. They are related but not interchangeable. The “largest sequence processed” optimization is safe only if earlier events are guaranteed already processed or intentionally irrelevant. Receiving sequence 12 before 11 and discarding all lower numbers can lose valid progress.

For a single ordered stream, validate consecutive sequencing and buffer or request gaps. For unordered delivery, maintain a bounded deduplication window or process through a durable operation store when the requirements justify it. Decide when old identities can be discarded. An ever-growing set can become its own memory or storage problem.

Reproducible evaluation requires more than a seed. It requires the same definitions, input ordering, initial state, clock policy, and random algorithm. A fixed seed cannot make two different event sequences equivalent. If authoritative outcomes depend on float calculations, cross-platform numerical behavior may also matter.

A practical diagnostic record includes the mission definition revision, run ID, operation ID, old progress, accepted delta, new progress, and rejection reason. Keep sensitive player data out of diagnostic payloads unless there is a defined need and appropriate handling.

An ordered run dispatcher is enough for the local example. Add persistence or out-of-order handling when the delivery contract requires it.

?? missions-sequence-gap Events 12 and 11 arrive in that order. Why can “ignore any sequence below the largest seen” be wrong?
* Event 11 may contain valid work that has never been applied.
- Sequence numbers can never be compared.
- Event 12 necessarily includes every earlier event's payload.
- The UI must be the source of truth for event order.
> A high-water mark assumes an ordering or cumulative-state guarantee. Without one, a late event can be lost.

?+ What is needed in addition to the same random seed for reliable replay?
* The same initial state, rule revisions, input order, and random algorithm.
- Only the same device wallpaper.
- A higher rendering frame rate.
- A different seed for every subsystem on every replay.
> A seed determines one input to a computation. Other inputs and the order of random consumption also affect its outcome.

## Claim rewards through one authoritative operation {#missions-reward-claim}

“Claim reward” combines eligibility, the one-time claim marker, and the inventory or wallet update. These must have a coherent commitment boundary.

For a local game with one save document, build a candidate state containing both the granted reward and the claim record, then commit that document through the storage layer. Define what “committed” means: changed in memory, serialized to a temporary file, or durably replaced on storage are distinct stages. If persistence fails, the caller needs an explicit policy rather than a success animation followed by silent data loss.

For an online economy, a trusted service should validate the claim and atomically store both the reward and an idempotency record. A client-provided “I completed the mission” flag is not authority. The service must evaluate trusted progress or otherwise validate the submitted evidence.

Use a stable claim identity such as player, mission instance, and reward tier. The identity represents one logical action. Generating a new operation ID every time a timed-out request is retried defeats deduplication.

The difficult case is ambiguous completion:

```text
Client sends claim K
Service commits reward and claim K
Response is lost
Client retries claim K
Service returns the recorded result for K
```

The transaction grants one reward despite repeated delivery. This is an idempotent effect; it does not require exactly-once message delivery.

![A claim commits but its response is lost; retrying the same identity returns the recorded result without granting another reward](images/reward-retry.svg)

Because reward definitions can change between attempts, the claim record should preserve the granted outcome or the definition revision needed to recover it. Recomputing a previous claim against today's reward table can return a different answer.

An in-progress button prevents casual double tapping but is not a correctness boundary. Two screens, retries, a resumed task, or a modified client can bypass it. Keep UI protection for usability and operation-level protection for correctness.

?? missions-idempotency-key A reward request times out after the server might have committed it. Which retry is safest?
* Retry the same logical claim identity and let the authority return its stored outcome.
- Generate a new claim identity and grant again.
- Assume a timeout proves nothing was committed.
- Trust that disabling the button prevented every duplicate request.
> A timeout describes missing knowledge, not necessarily failure. Stable operation identity lets the authority distinguish a retry from a new claim.

?+ Claim K was committed under reward revision 4. Before a retry, revision 5 changes its reward. What should the retry of K normally return?
* The outcome recorded for K under the original commitment.
- A second grant calculated from revision 5.
- A reversal of revision 4 followed by a new untracked grant.
- A failure that deletes the original claim record.
> Retrying retrieves an existing logical outcome. Re-evaluating an already committed claim against new content can make the result inconsistent or duplicate it.

?? missions-atomic-claim Which changes should share the reward transaction boundary?
* The one-time claim record and the authoritative inventory or balance update.
- The reward animation and the screen's background color.
- Every unrelated setting in the application.
- Only the button's interactable state.
> If the claim marker and reward can commit independently, crashes and retries can produce a lost reward or a duplicate grant.

## Integrate a feature into a mature codebase {#missions-incremental-integration}

A mature game already has save formats, lifecycle conventions, logging, dependency registration, content pipelines, and test seams. Understand those before introducing a new framework.

Trace one similar feature from user action to state mutation and persistence. Find where the state changes, including accidental authority such as a UI script that currently grants currency. Document behavior before replacing it. An awkward implementation can still encode essential compatibility rules.

Use a narrow adapter to connect the new mission evaluator to the existing event or progress system. A strangler-style migration moves behavior behind a boundary gradually: route one operation or one mission type through the new implementation, compare results where safe, and expand after evidence accumulates.

Shadow evaluation can compare old and new progress without allowing the new path to grant rewards. It must be read-only with respect to player outcomes. Running both reward paths “for comparison” is a duplication bug. Define which implementation owns writes during every rollout stage.

Characterization tests record current behavior at the boundary: rounding, reward timing, reset conditions, and persisted IDs. They are especially valuable when requirements are incomplete. If current behavior is a known bug, document the intentional change separately so parity failures are not dismissed casually.

Keep migration units small enough to review. A feature change mixed with global renaming, dependency rewiring, and save-format redesign is hard to assess and harder to roll back. A preparatory refactor can expose a seam first, with behavior held constant, followed by the feature change.

Interview exercise: A mission counter is updated from three separate scene scripts. Explain how you would establish one owner without resetting existing player progress. Include inspection, tests, migration, rollout, and a rollback-compatible save policy.

?? missions-shadow-mode What makes shadow evaluation safe during a reward-system migration?
* The candidate path computes comparisons while only the designated authority applies rewards.
- Both paths grant rewards and the UI hides duplicates.
- The old save data is deleted before comparison.
- Every mismatch is ignored because the new design is cleaner.
> Shadow execution should provide evidence without changing player outcomes. Write ownership must remain unambiguous.

?+ Old and new evaluators disagree during shadow comparison. Which response preserves player-state ownership?
* Keep writes with the designated authority and investigate the recorded mismatch.
- Let whichever evaluator finishes first grant the reward.
- Grant both results temporarily to avoid missing either one.
- Alternate writers each frame without a migration rule.
> Shadow comparison is diagnostic. A mismatch is evidence to investigate, not a reason to introduce competing writers.

?? missions-characterization What is the purpose of a characterization test before a refactor?
* Capture observable existing behavior so unintended changes become visible.
- Prove that every existing behavior is desirable.
- Require the new implementation to use identical private fields.
- Replace the need to understand save compatibility.
> Characterization tests establish a behavioral baseline. Intentional fixes can change that baseline, but should be explicit and reviewed.

## Explain the complete design in layers {#missions-design-presentation}

Start a system-design explanation with player behavior and invariants. Draw the state owners and follow one operation through them; that gives the listener enough context to discuss failures and scale.

A concise mission-system walkthrough can sound like this:

“Definitions have stable IDs and revisions. A player-session model owns active mission instances and progress. Gameplay supplies committed facts through an ordered run dispatcher. The evaluator updates only relevant objectives. Claiming is a separate operation with a stable identity; the wallet update and claim marker share the authoritative transaction. The UI reads progress and observes changes. I would test duplicate events, run boundaries, definition changes, and timeout-after-commit before optimizing the evaluator.”

Then expand where the interviewer asks. If they challenge performance, estimate the number of events and active missions. If they challenge ownership, explain scope and cleanup. If they challenge online authority, distinguish client presentation from trusted validation. If they challenge complexity, show the simpler local-only variant.

Avoid responding to every question by adding a new service. A counter does not need a distributed event log merely because events exist. A one-screen prototype may reasonably use direct calls and one save document. The design should grow in response to a specific requirement.

Use estimates honestly. “With 20 active missions and 100 events per second, a full scan does 2,000 predicate checks per second; I would measure that before indexing” is a useful order-of-magnitude argument. It does not claim that every predicate has equal cost or that 2,000 checks are necessarily negligible on every target.

End the technical explanation with evidence and open questions: which tests pass, what the profiler shows, which compatibility cases remain, and what design clarification is still needed.

?? missions-scale-estimate With 20 active missions and 100 events per second, how many mission predicate evaluations does a full scan perform per second?
* 2,000.
- 120.
- 20.
- 100,000.
> Each of the 100 events is checked against 20 missions: 100 times 20 equals 2,000 evaluations. Actual cost still depends on the predicate work.

?? missions-proportional-design When should a simple direct-call mission counter gain a durable event-processing layer?
* When requirements such as retry, recovery, or cross-system processing justify its additional complexity.
- Whenever the code contains an event keyword.
- Before the first counter is implemented, regardless of scope.
- Only after every class has an interface.
> Architectural mechanisms should address concrete constraints. Their maintenance and failure costs need justification.
