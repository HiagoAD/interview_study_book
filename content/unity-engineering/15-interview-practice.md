---
book: Unity Game Engineering
chapter: 15: Project deep dives and interview practice
---

## Select two or three projects with complementary evidence {#interview-project-selection}

Choose systems you know well enough to explain their implementation, failures, alternatives, and results. Clear responsibility for a substantial subsystem gives you more to discuss than a famous project name on its own.

Aim for complementary stories:

| Story | Evidence to prepare |
| --- | --- |
| Gameplay architecture | Requirements, state ownership, dependencies, extensibility, tests |
| Difficult bug or optimization | Reproduction, measurements, root cause, rejected hypotheses, validation |
| Live feature or team delivery | Compatibility, authoring workflow, rollout, collaboration, recovery |

One project can supply several stories, but avoid describing the same decision three times. Select examples that show different kinds of judgment.

Prepare a one-page note for each system. Include the context, your responsibility, constraints, and an architecture sketch. Trace one critical operation, describe a difficult failure, and compare two alternatives. Record the validation, outcome, and what you would change now.

Separate “I” and “we” accurately. “I designed the run-state model; another engineer implemented the storage adapter; we agreed on the migration contract” gives a clearer ownership picture than either taking all credit or describing everything impersonally.

Use metrics you can support. If you have no reliable before-and-after measurement, explain what you observed and how you checked it. Do not convert an impression into a precise percentage. If details are confidential, discuss the constraints and decisions in general terms without exposing protected material.

Practise a one-minute introduction that establishes the problem and your contribution. Then prepare a ten-minute walkthrough, connecting implementation details to the requirements and decisions that led to them.

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

Draw the objects that own state and show their dependencies. Identify shared configuration, data that lasts for a player session, and data that exists only during a run. Make clear which objects can change the state and which only observe it for presentation.

Follow one operation in order. For a mission reward, begin with the button press, then explain eligibility, the stable claim ID, the transaction, the saved result, and the UI notification. Include a failure case: the server commits the reward, the response times out, and a retry with the same ID returns the original result.

Explain why those steps have those owners. A team might reject a generic objective framework when it has only three objective types and needs faster designer iteration more than runtime extensibility. It might still separate reward selection behind a strategy interface, because that behavior already varies independently.

Describe the hardest defect and the design change it prompted. A stale callback might lead to checking a generation ID. A failed migration might lead to historical save fixtures and a backup policy. Explain the failure that change prevents and how you verified the fix.

Finish with what shipped, what became easier, and what remained expensive. Support those results with tests or measurements. Then explain what you would change under today's constraints.

Practise drawing and explaining the system before showing code. Then use one representative operation to add detail. If the explanation needs every class, decide which responsibilities and dependencies the listener actually needs to follow that operation.

?? interview-operation-trace Why walk one reward claim end to end?
* It exposes ownership, ordering, commitment, and failure behavior in a concrete scenario.
- It eliminates the need to discuss tradeoffs.
- It proves the entire system has no bugs.
- It lets you avoid explaining persistence.
> Following one claim shows what the architecture actually does, including who changes state and what happens if a step fails.

?? interview-constraints-first Why state constraints before presenting the chosen architecture?
* The listener needs the decision criteria to judge the tradeoffs.
- Constraints guarantee only one possible solution.
- Class names are always more important than behavior.
- A senior engineer should never discuss uncertainty.
> Design quality depends on the problem and limits it addresses. The same mechanism can be appropriate in one context and excessive in another.

## Defend alternatives and adapt when requirements change {#interview-followups}

An interviewer may change a requirement to test how you reason about the design. Restate the new requirement, identify the assumption it breaks, and adjust the relevant part of the system.

Practice these follow-ups:

| Follow-up | What a strong answer examines |
| --- | --- |
| Support two local players | Per-player state, shared definitions, input routing, UI binding |
| Support offline progress | Authority limits, pending operations, reconciliation, conflict policy |
| Add 100 effect types | Authoring, validation, shared rules, debugging cost, extension points |
| Target a weaker device | Measured bottleneck, content scale, memory and frame budgets |
| Change rewards mid-event | Definition revisions, active-instance policy, claim consistency |
| Roll back tomorrow | Save compatibility, content exposure, irreversible side effects |

Reconsider a choice when its constraints change. A single controller may work well for a small feature, then become difficult to maintain as independent behaviors grow. Explain which new requirement creates that pressure.

Keep the size of the change proportional to the requirement. A second local player may only need another owner for player state, plus separate input and presentation bindings. Check the consumers of that state before deciding that the wider architecture needs replacement.

When uncertain, say how you would resolve it. “I would check the installed Addressables contract and reproduce the handle lifetime in a small target build” is a useful answer. Guessing an API guarantee confidently is not.

Name a cost of the revised design. Offline operations, for example, need storage, expiration rules, and reconciliation. Adding an interface may organize those responsibilities, but does not implement them.

?? interview-changing-requirements A new requirement invalidates an assumption behind your original design. What is the strongest response?
* Identify the broken assumption and revise the relevant ownership or contract.
- Insist the original design is always best.
- Replace every subsystem before examining the impact.
- Pretend the new requirement was already fully supported.
> A design depends on its requirements. Explain which assumption changed, then adjust the parts affected by it.

?+ Your run model already owns all per-player effects, while definitions are immutable and shared. A second local player is added. What is the most direct starting change?
* Create a separate set of runtime state for the second player's run, and connect that player's input and presentation.
- Make all effect deadlines static so both players use one value.
- Duplicate every configuration asset even when its values are identical.
- Replace the entire game architecture before evaluating existing boundaries.
> Separate player-state owners allow the new player to have independent effects. Both players can continue using the same immutable definitions.

?? interview-uncertain-api You are unsure whether a package operation can actually be cancelled. What should you do?
* State the uncertainty and explain how you would verify the installed version's contract and cleanup behavior.
- Promise cancellation stops all work instantly.
- Avoid discussing late completion entirely.
- Assume every asynchronous API has identical semantics.
> Accurate uncertainty plus a verification plan is stronger than an invented guarantee.

## Capstone: design a seasonal runner challenge {#interview-capstone}

Prompt: Add a seven-day challenge to a mobile runner. Players collect event tokens, complete three objectives, and claim milestone rewards. The team wants weekly content iteration. Some players use older binaries, and the app can be interrupted at any time.

First clarify who decides event start and end times, whether offline progress is allowed, whether a run crossing the deadline counts, and whether rewards can be claimed after earning closes. Then ask about minimum devices, existing wallet and save systems, supported client versions, and the team's content-authoring workflow.

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

At run start, capture the applicable event instance and rules. Each token spawn can be collected once, and the resulting run facts update the object that owns progress. Give a reward claim one stable identity, then commit its inventory update and claim record together. After an interruption, rebuild presentation from the committed state.

Put the grant operation outside the UI, because the view can close before the result is known. Keep player progress separate from shared event assets, so one player's updates cannot change another's state. Add a general event-scripting language only if the variety of content justifies its authoring tools and compatibility work.

Estimate the active token count and event frequency before choosing optimizations. Begin with a simple evaluator. Reuse buffers where measurements show repeated allocation costs, and budget how many celebration effects can run together. Profile transitions on target devices.

Before release, validate the catalog against supported clients. Control exposure, test old saves and pending claims, and define how a kill switch handles work already in progress. Plan for a rollback in which the previous binary encounters state saved by the newer version.

Choose the trust model explicitly. An online economy that requires trusted decisions needs service-side validation and durable transactions. An offline game can commit through a local save, but cannot provide the same protection against client tampering. State which product the design serves.

?? interview-capstone-owner In the capstone, which unit should decide whether a milestone reward is valid and commit it?
* The designated reward authority operating on event and player state.
- The celebration particle system.
- The visible button's animation controller.
- Every observer independently.
> The reward authority checks eligibility and commits the claim once. Presentation displays the result without deciding whether the grant is valid.

?? interview-capstone-revision Why capture an event revision for a run when the product policy requires consistent run rules?
* So mid-run content updates do not silently change how that run is evaluated.
- So every future event uses the same rewards forever.
- So old clients automatically understand new scripts.
- So offline clients can bypass all validation.
> The captured revision identifies the rules for this run. Client compatibility and trusted validation still need separate checks.

## Practice technical answers with an assessment rubric {#interview-mock-round}

Answer these prompts aloud. Start with clarifying questions, then spend several minutes developing the design. Use the suggested topics afterward to find gaps in your explanation.

“Design a power-up system.” Define the effect types and rules for stacking, pause, restart, and persistence. Separate shared configuration from runtime state, then trace activation and expiration. Explain how presentation observes the effect, how you would test it, and one alternative you rejected.

“Why use an interface here?” Name the capability the interface represents and the callers that need it. Explain whether it supports replacing an implementation, controlling inputs in tests, or isolating infrastructure. If none of those benefits apply, a concrete type may be clearer.

“The game freezes every few seconds on a phone.” Reproduce the problem and capture data on the target device. Inspect CPU and GPU timing, allocations, garbage collection, loading, and thermal conditions. Choose a hypothesis and an experiment that could rule it in or out; do not assume garbage collection is responsible before measuring.

“Which collection stores active enemies?” Clarify lookup, iteration, removal, ordering, and population requirements. A list plus an ID-to-index dictionary may provide fast lookup and compact iteration. If order does not matter, consider swap-back removal. Explain how removal repairs the index map and how generation IDs distinguish reused objects.

“A player received the same reward twice.” Follow the operation ID through callbacks, retries, the claim transaction, and persistence. Determine whether there were two separate logical claims or repeated attempts to complete one claim.

“What is difficult about working with artists or designers?” Use a real example of differing goals or missing shared expectations. Explain your actions and how tools, prototypes, or measured budgets helped the team reach a decision.

Score each answer from 0 to 2 for clear requirements, explicit ownership, failure handling, tradeoffs, and evidence. Give 0 when a dimension is absent, 1 when it is named, and 2 when it is explained with a concrete example. Use the result to choose your next practice topic. It is not a prediction of an interview outcome.

Also practise small coding tasks: prevent duplicate collection, remove an entity and repair its index map, test an exact expiration boundary, or shuffle a collection. Explain the complexity and edge cases before optimizing.

?? interview-performance-prompt A phone freezes periodically. Which answer shows the strongest diagnostic reasoning?
* Reproduce on the device, capture timing and allocations, and test hypotheses before choosing a fix.
- Declare GC responsible without a capture.
- Replace every list with a linked list.
- Lower texture resolution regardless of the limiting stage.
> Several systems can cause periodic freezes. Use measurements to identify the cause before choosing a fix.

?? interview-rubric [multi n=5] Which elements belong in the five-dimension practice rubric?
* Explicit ownership.
* Failure handling.
* Tradeoffs and supporting evidence.
- Number of fashionable pattern names mentioned.
- Confidence regardless of correctness.
> The rubric rewards a reasoned design: requirements, ownership, failure handling, tradeoffs, and evidence. Vocabulary alone is not a substitute.

## Build a study loop around weak explanations {#interview-study-loop}

Follow the chapter priorities, and spend extra time on ideas you cannot yet explain from memory.

| Pass | Focus | Deliverable |
| --- | --- | --- |
| Architecture | Chapters 1–3 | Draw and defend one complete gameplay feature |
| Language and design | Chapters 4–5 | Explain copying, equality, lifetime, and abstraction choices |
| Unity production | Chapters 6–8 | Diagnose initialization, async, asset, and test-boundary failures |
| Algorithms | Chapters 9–10 | Choose structures and explain costs for game workloads |
| Mobile performance | Chapters 11–12 | Walk a measured CPU, GPU, or memory investigation |
| Shipping and teamwork | Chapters 13–14 | Explain a safe release and a collaboration decision |
| Personal evidence | This chapter | Prepare two or three truthful deep dives |

In each session, read a few sections, answer their questions, and explain one scenario without looking at the text. Record where your explanation becomes vague. If you say “I would use a manager,” continue by naming the state it owns, its operations, its dependencies, and how long it lives.

Practise both recognizing an answer and producing one yourself. Multiple-choice questions can reveal misconceptions. Drawing a dependency graph or tracing an interrupted claim requires you to build the explanation from memory.

Use the site's review queue for concepts you answered incorrectly. Revisit correct answers you guessed as well. Then vary the scenario: add a second player, delay a callback, load an old save, or target a weaker device. Check whether you can still apply the same principle.

Before the interview, rehearse a short introduction for each project and one detailed technical walkthrough. Keep facts, measurements, and your personal contribution accurate. Prepare questions about the team's architecture, content workflow, target devices, and release process, so you can reason within their constraints.

?? interview-retrieval-practice Which practice best complements multiple-choice questions?
* Explain a new scenario aloud and draw its ownership and failure boundaries without looking.
- Memorize only the positions of correct options.
- Read pattern names repeatedly without applying them.
- Avoid scenarios that change the original assumptions.
> Explaining an unfamiliar scenario checks whether you can apply the idea yourself. Multiple choice mainly checks whether you recognize a valid answer.

?? interview-vague-manager You say “I would add a manager” and cannot explain further. What should you define next?
* Its owned state, operations, dependencies, and lifetime.
- Only a longer class name.
- Its icon color.
- A guarantee that it will never change.
> A class name does not explain what the system does. Define its responsibilities, how callers use it, and when it is created and cleaned up.
