---
book: Unity Game Engineering
chapter: 15: Project deep dives and interview practice
---

## Select two or three projects with complementary evidence {#interview-project-selection}

Choose systems you understand deeply enough to discuss implementation, failures, alternatives, and results. A large project name is less useful than clear ownership of a substantial subsystem.

Aim for complementary stories:

| Story | Evidence to prepare |
| --- | --- |
| Gameplay architecture | Requirements, state ownership, dependencies, extensibility, tests |
| Difficult bug or optimization | Reproduction, measurements, root cause, rejected hypotheses, validation |
| Live feature or team delivery | Compatibility, authoring workflow, rollout, collaboration, recovery |

One project can supply several stories, but avoid describing the same decision three times. Select examples that show different kinds of judgment.

Create a one-page note for each system: context, your responsibility, constraints, architecture sketch, one critical operation, one difficult failure, two alternatives, validation, outcome, and what you would change now.

Separate “I” and “we” accurately. “I designed the run-state model; another engineer implemented the storage adapter; we agreed on the migration contract” gives a clearer ownership picture than either taking all credit or describing everything impersonally.

Use only metrics you can support. If no reliable before/after measurement exists, say what you observed and how you verified it. Do not turn a vague impression into a precise percentage. If confidentiality limits detail, discuss generalized constraints and decisions without exposing protected material.

Prepare a one-minute introduction that establishes the problem and your contribution. Then practice a ten-minute walkthrough that connects implementation details to the requirements and decisions behind them.

?? interview-story-selection Which project is strongest for a technical deep dive?
* One where you can explain your ownership, difficult decisions, implementation details, and evidence.
- The project with the most famous title, even if you know none of its systems.
- A hypothetical project presented as personal work.
- The project with the largest number of files.
> Depth of understanding and truthful ownership provide useful evidence of engineering judgment.

?? interview-metric-honesty You remember an improvement but have no reliable timing capture. What should you say?
* Describe the observed change and verification without inventing a numerical performance claim.
- Invent a plausible percentage to make the story sound stronger.
- Claim that every device improved equally.
- Avoid mentioning what was actually checked.
> Honest evidence is more credible than unsupported precision.

## Walk from requirements to an implementation trace {#interview-deep-dive}

Begin with a concrete trigger: “The game needed missions that could be authored weekly without code changes, while preserving existing progress.” Then name the constraints: a mature save format, low-end devices, several active event types, and a short release window.

Draw the owners and dependencies. Explain which data is shared configuration, which belongs to a player session, and which exists only during a run. Mark the state-changing authority and the presentation observers.

Walk one operation in order. For a mission reward: button intent, eligibility check, stable claim identity, transaction, persisted result, and UI notification. Include the failure path: timeout after commitment, retry with the same identity, return the original outcome.

Explain the choices behind that sequence. For example, a team might reject a generic objective framework because only three types exist and designer iteration matters more than runtime extensibility. It might still keep a strategy boundary for reward selection, which already varies independently.

Discuss the hardest defect and how it changed the design. A stale callback may have led to explicit generation identity. A migration failure may have led to historical save fixtures and a backup strategy. Describe which failure the change prevents and how you verified it.

End with results and limitations. What shipped? What became easier? What remained expensive? Which tests or measurements support that answer? What would you change under today's constraints?

Practice drawing and narrating without code first, then show one representative operation. If the explanation requires reading every class, identify which responsibilities and dependencies the listener needs to understand the operation.

?? interview-operation-trace Why walk one reward claim end to end?
* It exposes ownership, ordering, commitment, and failure behavior in a concrete scenario.
- It eliminates the need to discuss tradeoffs.
- It proves the entire system has no bugs.
- It lets you avoid explaining persistence.
> A complete operation connects architecture boxes to actual behavior and reveals missing boundaries.

?? interview-constraints-first Why state constraints before presenting the chosen architecture?
* The listener needs the decision criteria to judge the tradeoffs.
- Constraints guarantee only one possible solution.
- Class names are always more important than behavior.
- A senior engineer should never discuss uncertainty.
> Design quality depends on the problem and limits it addresses. The same mechanism can be appropriate in one context and excessive in another.

## Defend alternatives and adapt when requirements change {#interview-followups}

An interviewer may challenge your design to see whether it is reasoned or memorized. Treat the change as new information. Restate the altered requirement, identify which assumption it breaks, and revise the relevant boundary.

Practice these follow-ups:

| Follow-up | What a strong answer examines |
| --- | --- |
| Support two local players | Per-player state, shared definitions, input routing, UI binding |
| Support offline progress | Authority limits, pending operations, reconciliation, conflict policy |
| Add 100 effect types | Authoring, validation, shared rules, debugging cost, extension points |
| Target a weaker device | Measured bottleneck, content scale, memory and frame budgets |
| Change rewards mid-event | Definition revisions, active-instance policy, claim consistency |
| Roll back tomorrow | Save compatibility, content exposure, irreversible side effects |

Avoid defending every original choice after its constraints change. A single controller can be right for a small feature and wrong after substantial independent variation appears. Explain which new requirement makes the original controller hard to maintain.

Also avoid overreacting. Adding a second player does not necessarily require replacing the entire engine architecture. If state already has an explicit owner, instantiate another owner and wire its adapters. Check which consumers also need to change and why.

When uncertain, say how you would resolve it. “I would check the installed Addressables contract and reproduce the handle lifetime in a small target build” is a useful answer. Guessing an API guarantee confidently is not.

Include one cost of your revised design. Supporting offline operations adds storage, expiry, and reconciliation; an interface alone does not eliminate that work.

?? interview-changing-requirements A new requirement invalidates an assumption behind your original design. What is the strongest response?
* Identify the broken assumption and revise the relevant ownership or contract.
- Insist the original design is always best.
- Replace every subsystem before examining the impact.
- Pretend the new requirement was already fully supported.
> Architecture is conditional on requirements. Adaptation should be explicit and proportional.

?+ Your run model already owns all per-player effects, while definitions are immutable and shared. A second local player is added. What is the most direct starting change?
* Create another run-owned state graph and bind the second player's input and presentation.
- Make all effect deadlines static so both players use one value.
- Duplicate every configuration asset even when its values are identical.
- Replace the entire game architecture before evaluating existing boundaries.
> Explicit per-player ownership localizes the new requirement. Shared immutable configuration can remain shared while runtime state is independent.

?? interview-uncertain-api You are unsure whether a package operation can actually be cancelled. What should you do?
* State the uncertainty and explain how you would verify the installed version's contract and cleanup behavior.
- Promise cancellation stops all work instantly.
- Avoid discussing late completion entirely.
- Assume every asynchronous API has identical semantics.
> Accurate uncertainty plus a verification plan is stronger than an invented guarantee.

## Capstone: design a seasonal runner challenge {#interview-capstone}

Prompt: Add a seven-day challenge to a mobile runner. Players collect event tokens, complete three objectives, and claim milestone rewards. The team wants weekly content iteration. Some players use older binaries, and the app can be interrupted at any time.

Begin by clarifying event start and end authority, whether offline progress is allowed, whether a run crossing the deadline counts, and whether claiming remains available after earning closes. Ask about minimum devices, existing wallet and save systems, supported client versions, and authoring expectations.

A plausible design uses these owners:

| Owner | Responsibility |
| --- | --- |
| Event catalog | Validated definitions, revisions, required client capabilities |
| Player event state | Participation, objective progress, claim identities |
| Run session | Captured event revision and run-scoped token facts |
| Progress evaluator | Apply eligible, deduplicated facts to objectives |
| Reward authority | Validate and commit one-time claims with inventory changes |
| Presentation | Display availability, progress, pending status, and celebrations |
| Adapters | Persistence, time authority, platform or service communication |

At run start, capture the applicable event instance and policy. Token collection commits once per spawn. Run facts update the appropriate progression owner. A claim uses one stable identity; commitment updates inventory and claim state together. Presentation reconstructs from committed state after interruption.

Keep the grant outside the UI, whose view can close before the outcome is resolved. Store player progress separately from shared event assets so one player's changes cannot affect another player's state. Avoid a universal event-scripting language until content variation justifies its tooling and compatibility cost.

For performance, estimate active tokens and event frequency. Start with a simple evaluator, reuse buffers in measured hot paths, and budget the celebration's simultaneous effects. Profile transitions on target devices.

For release safety, validate catalog compatibility, keep exposure controlled, test old saves and pending claims, and define a kill-switch policy for in-flight work. A rollback must preserve any newer state the previous binary may encounter.

This design still has open decisions. A trusted online economy needs service-side validation and durable transactions. An offline-only game can use a local save transaction with clearly weaker trust. Say which product you are designing.

?? interview-capstone-owner In the capstone, which unit should decide whether a milestone reward is valid and commit it?
* The designated reward authority operating on event and player state.
- The celebration particle system.
- The visible button's animation controller.
- Every observer independently.
> A single authority protects eligibility and one-time commitment. Presentation reports and displays its outcome.

?? interview-capstone-revision Why capture an event revision for a run when the product policy requires consistent run rules?
* So mid-run content updates do not silently change how that run is evaluated.
- So every future event uses the same rewards forever.
- So old clients automatically understand new scripts.
- So offline clients can bypass all validation.
> Version capture makes the operation's rules explicit. Compatibility and trust need their own mechanisms.

## Practice technical answers with an assessment rubric {#interview-mock-round}

Use these prompts aloud. Allow clarifying questions, then spend several minutes developing the answer. Use the suggested topics to check for gaps in your answer.

“Design a power-up system.” Establish effect types, stacking, pause, restart, and persistence. Separate configuration from runtime state. Trace activation and expiry. Explain the presentation boundary, tests, and one rejected alternative.

“Why use an interface here?” Identify the stable capability and its consumers. Explain substitution, test control, or infrastructure isolation. If the abstraction provides none of those benefits, a concrete type may be clearer.

“The game freezes every few seconds on a phone.” Gather a repeatable target-device capture, inspect CPU and GPU timing, allocation and collection, loading, and thermal context. Do not assume GC before seeing evidence. Choose one hypothesis and a discriminating experiment.

“Which collection stores active enemies?” Ask about lookup, iteration, removal, order, and population. A list plus ID-to-index dictionary may suit lookup and dense iteration, with swap-back removal if order is irrelevant. Explain map repair and generation identity.

“A player received the same reward twice.” Trace operation identity, duplicate callbacks, retry behavior, claim transaction, and persistence. Distinguish two separate operations from duplicate attempts at one operation.

“What is difficult about working with artists or designers?” Discuss differing goals or missing shared contracts, give a real example, describe your actions, and show how tooling, prototypes, or measured budgets improved the outcome.

Score each answer from 0 to 2 on five dimensions: clear requirements, explicit ownership, failure handling, tradeoffs, and evidence. A score of 0 means absent, 1 means named, and 2 means explained with a concrete example. Use the score to choose what to practice next, not to predict an interview result.

Add small coding exercises: implement deduplicated collection, remove an entity while repairing an index map, test exact expiration, or shuffle a collection. Explain complexity and edge cases before optimizing.

?? interview-performance-prompt A phone freezes periodically. Which answer shows the strongest diagnostic reasoning?
* Reproduce on the device, capture timing and allocations, and test hypotheses before choosing a fix.
- Declare GC responsible without a capture.
- Replace every list with a linked list.
- Lower texture resolution regardless of the limiting stage.
> Similar symptoms can come from different systems. Evidence should select the intervention.

?? interview-rubric [multi n=5] Which elements belong in the five-dimension practice rubric?
* Explicit ownership.
* Failure handling.
* Tradeoffs and supporting evidence.
- Number of fashionable pattern names mentioned.
- Confidence regardless of correctness.
> The rubric rewards a reasoned design: requirements, ownership, failure handling, tradeoffs, and evidence. Vocabulary alone is not a substitute.

## Build a study loop around weak explanations {#interview-study-loop}

Follow the priority order, but use retrieval to decide where extra time goes.

| Pass | Focus | Deliverable |
| --- | --- | --- |
| Architecture | Chapters 1–3 | Draw and defend one complete gameplay feature |
| Language and design | Chapters 4–5 | Explain copying, equality, lifetime, and abstraction choices |
| Unity production | Chapters 6–8 | Diagnose initialization, async, asset, and test-boundary failures |
| Algorithms | Chapters 9–10 | Choose structures and explain costs for game workloads |
| Mobile performance | Chapters 11–12 | Walk a measured CPU, GPU, or memory investigation |
| Shipping and teamwork | Chapters 13–14 | Explain a safe release and a collaboration decision |
| Personal evidence | This chapter | Prepare two or three truthful deep dives |

For each session, read a small number of sections, answer the questions, and explain one scenario without looking. Record the point where your explanation becomes vague. “I would use a manager” is a cue to name its state, operations, dependencies, and lifetime.

Alternate recognition with production. Multiple-choice questions help expose misconceptions, but drawing a dependency graph or tracing an interrupted claim requires generating the model yourself. Practice both.

Revisit wrong concepts through the site's review queue. Also revisit answers that were technically correct but guessed. Change the scenario: a second player, a delayed callback, an old save, a weaker device. This tests whether the principle transfers.

Before the interview, rehearse a short introduction for each project and one detailed technical walkthrough. Keep facts, measurements, and personal ownership accurate. Prepare a few questions about the team's existing architecture, content workflow, target devices, and release process so you can reason within their constraints.

?? interview-retrieval-practice Which practice best complements multiple-choice questions?
* Explain a new scenario aloud and draw its ownership and failure boundaries without looking.
- Memorize only the positions of correct options.
- Read pattern names repeatedly without applying them.
- Avoid scenarios that change the original assumptions.
> Generating an explanation tests whether you can apply the model, while multiple choice mainly tests recognition.

?? interview-vague-manager You say “I would add a manager” and cannot explain further. What should you define next?
* Its owned state, operations, dependencies, and lifetime.
- Only a longer class name.
- Its icon color.
- A guarantee that it will never change.
> A manager name does not establish a design. Concrete responsibilities and contracts do.
