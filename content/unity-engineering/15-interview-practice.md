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

The one-page note works better as a fixed form, because filling the same blanks for each project makes the gaps obvious:

```text
System:        Seasonal challenge for a mobile runner
Context:       Live game, weekly content, 1.2 M monthly players
My role:       Owned the progress and claim model; reviewed the UI binding
Constraints:   Existing save format, two supported client versions, 2 GB devices
Sketch:        Catalog -> player event state -> evaluator -> claim authority -> UI
Traced op:     Milestone claim, from button to committed inventory change
Hard failure:  Timeout after commit granted a second reward on retry
Alternative:   Rejected a generic objective scripting language; authoring cost
Validation:    Rule tests, historical save fixtures, staged rollout to 5 percent
Result:        Shipped; two events since with no claim incidents
Would change:  Reconciliation was manual; I would build it into the client
```

Twelve lines, and most interview questions about that project land on one of them. Writing them in advance means you are recalling rather than composing, which is what makes the difference under pressure.

The two lines people leave blank are the ones interviewers push on. “Alternative” blank means you have not examined your own decision, and “would change” blank reads as either inexperience or unwillingness to evaluate your work. Fill both, even if the answer is small.

Exercise: Fill this form for one project without looking at the code. The lines you cannot complete are what to review before the interview, in that order.

?? interview-story-selection Which project is strongest for a technical deep dive?
* One where you can explain your ownership, difficult decisions, implementation details, and evidence.
- The most recent project, since the details are freshest.
- The largest project, since it offers the most to discuss.
- The one whose technology matches the role's stack most closely.
- The one where the outcome was most successful.
> Depth of understanding and truthful ownership provide useful evidence of engineering judgment.

?? interview-metric-honesty You remember an improvement but have no reliable timing capture. What should you say?
* Describe the observed change and verification without inventing a numerical performance claim.
- Give a conservative estimate, noting that it is approximate.
- Say the improvement was significant, without giving a figure.
- Describe the optimization technique instead of its result.
- Offer to send the measurements after the interview.
> Honest evidence is more credible than unsupported precision.

## Walk from requirements to an implementation trace {#interview-deep-dive}

Begin with a concrete trigger: “The game needed missions that could be authored weekly without code changes, while preserving existing progress.” Then name the constraints: a mature save format, low-end devices, several active event types, and a short release window.

Draw the objects that own state and show their dependencies. Identify shared configuration, data that lasts for a player session, and data that exists only during a run. Make clear which objects can change the state and which only observe it for presentation.

Follow one operation in order. For a mission reward, begin with the button press, then explain eligibility, the stable claim ID, the transaction, the saved result, and the UI notification. Include a failure case: the server commits the reward, the response times out, and a retry with the same ID returns the original result.

Explain why those steps have those owners. A team might reject a generic objective framework when it has only three objective types and needs faster designer iteration more than runtime extensibility. It might still separate reward selection behind a strategy interface, because that behavior already varies independently.

Describe the hardest defect and the design change it prompted. A stale callback might lead to checking a generation ID. A failed migration might lead to historical save fixtures and a backup policy. Explain the failure that change prevents and how you verified the fix.

Finish with what shipped, what became easier, and what remained expensive. Support those results with tests or measurements. Then explain what you would change under today's constraints.

Practise drawing and explaining the system before showing code. Then use one representative operation to add detail. If the explanation needs every class, decide which responsibilities and dependencies the listener actually needs to follow that operation.

When you draw, use a notation you have practised, so the drawing takes no attention away from the explanation. A minimal one is enough:

```text
[ Box ]        an object that owns state
( Round )      an operation or an adapter
----->        calls, and waits for a result
- - ->        notifies, without waiting
=====>        owns the lifetime of
```

Five symbols cover most gameplay architecture, and the distinction the diagram must carry is the one between the solid and dashed arrows. A listener who can see which arrows return a result and which merely announce something can ask about failure handling without you explaining the convention first.

Draw the state owners across the middle of the space, leave the top for inputs and the bottom for persistence and presentation, and resist filling the corners. Space is what lets you add the failure path later, and running out of room mid-explanation is a surprisingly common way to lose the thread.

Say the trace as you draw it rather than drawing first and narrating afterward. “The button calls claim, claim asks the evaluator whether the milestone is complete, the authority commits the inventory change and the claim record together, then this dashed arrow tells the UI” moves the pen and the explanation together, and the listener can interrupt at the point they care about.

Exercise: Draw one system you know with exactly these five symbols and no labels beyond object names. Then check whether a listener could ask you a failure question from the drawing alone.

?? interview-operation-trace Why walk one reward claim end to end?
* It exposes ownership, ordering, commitment, and failure behavior in a concrete scenario.
- It shows the listener that you know the codebase in detail.
- It keeps the explanation within the time available.
- It avoids the need to draw the whole architecture.
- It demonstrates how many systems the feature touches.
> Following one claim shows what the architecture actually does, including who changes state and what happens if a step fails.

?? interview-constraints-first Why state constraints before presenting the chosen architecture?
* The listener needs the decision criteria to judge the tradeoffs.
- Constraints are quicker to state than an architecture.
- It shows that you gathered requirements before designing.
- It lets you defend the design if the interviewer disagrees later.
- Constraints are the part most candidates forget to mention.
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

When uncertain, say how you would resolve it. “I would check the installed [[Addressables]] contract and reproduce the handle lifetime in a small target build” is a useful answer. Guessing an API guarantee confidently is not.

Name a cost of the revised design. Offline operations, for example, need storage, expiration rules, and reconciliation. Adding an interface may organize those responsibilities, but does not implement them.

One worked follow-up shows the size of answer to aim for. Take “support offline progress” against the mission design from the earlier chapters.

Start by naming the assumption it breaks: the claim authority was trusted and reachable, and eligibility was decided there. Offline, neither holds. Then separate what can still be done locally from what cannot. Progress can accumulate locally, because it is derived from gameplay facts the client already produces. Rewards cannot be granted locally in an online economy, because the client is not trusted to decide them.

That split produces the design:

| Concern | Offline answer |
| --- | --- |
| Progress | Accumulate locally against the captured event revision |
| Claim | Record a pending claim with its stable identity; do not grant |
| Display | Show the reward as pending rather than as received |
| Reconnect | Send pending claims by identity; apply the authority's results |
| Conflict | The authority wins; surface any rejection to the player |
| Bounds | Cap the queue, expire entries, and define what an expired claim does |

Then name the cost honestly: a pending state the UI must express, a durable queue, a reconciliation path, and a product decision about what happens when the authority rejects something the player was shown. That last item is a design question rather than an engineering one, and saying so is part of the answer.

Note the shape of that response. One broken assumption, one split, one table, one cost. It fits in three minutes and it changes the parts of the system that the requirement actually touches, which is the judgment the follow-up was testing.

Exercise: Take a different row from the table above and work it the same way, in writing, in under ten minutes. Then check whether you named a cost.

?? interview-changing-requirements A new requirement invalidates an assumption behind your original design. What is the strongest response?
* Identify the broken assumption and revise the relevant ownership or contract.
- Ask whether the new requirement is in scope before responding.
- Describe how the existing design could be extended to cover it.
- Start again from the requirements, since the first design no longer applies.
- List the subsystems the change would touch, and stop there.
> A design depends on its requirements. Explain which assumption changed, then adjust the parts affected by it.

?+ Your run model already owns all per-player effects, while definitions are immutable and shared. A second local player is added. What is the most direct starting change?
* Create a separate set of runtime state for the second player's run, and connect that player's input and presentation.
- Move the run model into a persistent service both players can reach.
- Add a second camera and input source, and reuse the existing run model.
- Give each definition asset a player field the effects read at activation.
- Run a second instance of the game loop in a separate scene.
> Separate player-state owners allow the new player to have independent effects. Both players can continue using the same immutable definitions.

?? interview-uncertain-api You are unsure whether a package operation can actually be cancelled. What should you do?
* State the uncertainty and explain how you would verify the installed version's contract and cleanup behavior.
- Describe the behavior you have seen in a different package with a similar API.
- Say that the design avoids relying on cancellation, and move on.
- Describe both possible behaviors and let the interviewer pick one.
- Note that the documentation would answer it, and change the subject.
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

Before reading further, it is worth checking your own capstone answer against what a complete one contains:

1. The questions you asked before designing, and the assumptions you stated where you got no answer.
2. The owners of state, with their lifetimes, and which of them may change what.
3. One operation traced end to end, including where it commits.
4. At least two failure cases, one of which is an interruption rather than an error.
5. A compatibility story for older clients and for saves written by newer ones.
6. One alternative you rejected, with the requirement that rejected it.
7. What you would measure, and on what device.

Seven items, and a complete answer to a capstone prompt in an interview usually runs twenty to thirty minutes. Most incomplete answers are missing items 4 and 5, because both concern situations the prompt does not mention and a candidate working from the prompt alone will not reach them.

Items 1 and 6 are the ones that distinguish a senior answer most reliably. Anyone can produce a design; stating which question would have changed it, and which alternative was close, shows that the design was chosen rather than merely produced.

Exercise: Answer the capstone prompt aloud from memory, then check off the seven items. Answer it again a week later and compare which items you reached without prompting.

?? interview-capstone-owner In the capstone, which unit should decide whether a milestone reward is valid and commit it?
* The designated reward authority operating on event and player state.
- The progress evaluator, which already knows the objective is complete.
- The player event state, which records the claim identities.
- The run session, which captured the event revision at its start.
- The presentation layer, which knows whether the player saw the milestone.
> The reward authority checks eligibility and commits the claim once. Presentation displays the result without deciding whether the grant is valid.

?? interview-capstone-revision Why capture an event revision for a run when the product policy requires consistent run rules?
* So mid-run content updates do not silently change how that run is evaluated.
- So the run can be replayed from its recorded events later.
- So the client can detect when a newer revision becomes available.
- So analytics can record which content the player encountered.
- So the reward table stays in memory for the duration of the run.
> The captured revision identifies the rules for this run. Client compatibility and trusted validation still need separate checks.

## Practice technical answers with an assessment rubric {#interview-mock-round}

Answer these prompts aloud. Start with clarifying questions, then spend several minutes developing the design. Use the suggested topics afterward to find gaps in your explanation.

“Design a power-up system.” Define the effect types and rules for stacking, pause, restart, and persistence. Separate shared configuration from runtime state, then trace activation and expiration. Explain how presentation observes the effect, how you would test it, and one alternative you rejected.

“Why use an interface here?” Name the capability the interface represents and the callers that need it. Explain whether it supports replacing an implementation, controlling inputs in tests, or isolating infrastructure. If none of those benefits apply, a concrete type may be clearer.

“The game freezes every few seconds on a phone.” Reproduce the problem and capture data on the target device. Inspect CPU and GPU timing, allocations, garbage collection, loading, and thermal conditions. Choose a hypothesis and an experiment that could rule it in or out; do not assume garbage collection is responsible before measuring.

“Which collection stores active enemies?” Clarify lookup, iteration, removal, ordering, and population requirements. A list plus an ID-to-index dictionary may provide fast lookup and compact iteration. If order does not matter, consider swap-back removal. Explain how removal repairs the index map and how generation IDs distinguish reused objects.

“A player received the same reward twice.” Follow the operation ID through callbacks, retries, the claim transaction, and persistence. Determine whether there were two separate logical claims or repeated attempts to complete one claim.

“What is difficult about working with artists or designers?” Use a real example of differing goals or missing shared expectations. Explain your actions and how tools, prototypes, or measured budgets helped the team reach a decision.

“Design the resolution order for a played card.” Say what a card is made of, which of its effects resolve immediately and which are queued, and what happens when one effect removes the target of the next. Explain where the order is decided, how a test drives it, and what a replay needs in order to reach the same board.

“A cascade sometimes stops one tile short.” Establish first whether the match scan or the refill is wrong, and say how you would tell them apart. Name the seed, the board state, and the step you would capture. Explain why mutating the grid during the scan that reads it produces exactly this symptom.

“Players lose offline progress after changing time zone.” Separate what the client may compute from what an authority must confirm. State which clock the grant reads, what a clamp would bound, and how you would tell a genuine long absence from a manipulated one.

The prompts deliberately cross genres. A power-up, a card, a board and an idle grant raise the same four questions about ownership, ordering, failure and evidence, and an answer that only works for the genre you practised is an answer built on the wrong thing.

Score each answer from 0 to 2 for clear requirements, explicit ownership, failure handling, tradeoffs, and evidence. Give 0 when a dimension is absent, 1 when it is named, and 2 when it is explained with a concrete example. Use the result to choose your next practice topic. It is not a prediction of an interview outcome.

Also practise small coding tasks: prevent duplicate collection, remove an entity and repair its index map, test an exact expiration boundary, or shuffle a collection. Explain the complexity and edge cases before optimizing.

Scoring is easier to apply after seeing one answer scored. Take the prompt “design a power-up system” and this answer: “I would make a base PowerUp class with virtual OnActivate and OnExpire, and each power-up would inherit from it. A manager would hold a list and update them each frame.”

| Dimension | Score | Why |
| --- | --- | --- |
| Requirements | 0 | No question asked about stacking, pause, or persistence |
| Ownership | 1 | A manager is named, but not what it owns or how long it lives |
| Failure handling | 0 | Restart, interruption, and duplicate activation are absent |
| Tradeoffs | 0 | No alternative considered; inheritance assumed |
| Evidence | 0 | Nothing about how it would be tested |

A total of 1 out of 10, and nothing in the answer is wrong. That is the point worth absorbing: a technically correct answer can score near zero, because the rubric measures engineering judgment rather than syntax. The same candidate adding “does a second pickup refresh or extend?” and “the run owns the effects, so restarting cannot leak them” moves two dimensions to 2 without writing any more code.

Score your own answers immediately after giving them, while you can still remember what you said. Scoring from memory a day later produces generous results, and the value of the rubric is entirely in its ability to disagree with you.

Exercise: Record yourself answering one prompt, then score the recording rather than your memory of it. The gap between the two is the thing worth working on.

?? interview-performance-prompt A phone freezes periodically. Which answer shows the strongest diagnostic reasoning?
* Reproduce on the device, capture timing and allocations, and test hypotheses before choosing a fix.
- Check the allocation call stacks first, since periodic freezes suggest collection.
- Reduce the physics timestep, since periodic freezes often come from the solver.
- Ask what changed in the most recent release, then inspect that code.
- Collect crash and error logs from the players reporting the freeze.
> Several systems can cause periodic freezes. Use measurements to identify the cause before choosing a fix.

?? interview-rubric [multi n=5] Which elements belong in the five-dimension practice rubric?
* Explicit ownership.
* Failure handling.
* Tradeoffs and supporting evidence.
- The number of design patterns the answer names.
- How quickly the candidate arrives at a design.
- Whether the answer matches the interviewer's own solution.
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

Spacing is what turns the passes in that table into retention, and it needs to be concrete to survive a busy week. Review a concept the day after you first meet it, then after three days, then after a week, then after two. A concept you got wrong restarts the schedule; a concept you got right but guessed moves back one step rather than forward. This site's review queue implements that pattern, so the practical instruction is to open it before starting new material rather than after, since due reviews are worth more than new sections and are easier to skip.

Keep the sessions small and frequent rather than long and occasional. Twenty-five minutes of reading followed by ten minutes of explaining aloud with the book closed is a complete session, and it is one you will still do on a bad day. A three-hour session once a week covers the same pages and retains much less, because almost all of it is reading and almost none of it is retrieval.

Track one number: the count of concepts you can explain without looking. Not the sections you have read, since that measures time spent, and not the questions you have answered correctly, since recognition runs ahead of production. The gap between those numbers is the honest measure of how ready you are, and closing it is what the exercises in this book have been for.

A final point about the material itself. The chapters have described what a system must decide, not what it must be, because the decisions transfer between engines, companies, and problems while the specific answers do not. When you meet a problem this book did not cover, the questions still apply: what must remain true, who owns the state, what happens when it fails, and how would you know. An answer built from those will hold up under follow-up questions, which is more than can be said for an answer built from remembered vocabulary.

Exercise: Write the list of concepts you can currently explain without looking, and date it. Repeat in a week and compare the lists rather than the feeling.

?? interview-retrieval-practice Which practice best complements multiple-choice questions?
* Explain a new scenario aloud and draw its ownership and failure boundaries without looking.
- Re-read the sections whose questions you answered incorrectly.
- Answer the same questions again until each one is correct.
- Write a summary of each chapter in your own words.
- Work through the questions a second time with the book closed.
> Explaining an unfamiliar scenario checks whether you can apply the idea yourself. Multiple choice mainly checks whether you recognize a valid answer.

?? interview-vague-manager You say “I would add a manager” and cannot explain further. What should you define next?
* Its owned state, operations, dependencies, and lifetime.
- Which design pattern the manager corresponds to.
- The folder and assembly the manager should live in.
- How the manager is registered with the dependency container.
- Which existing classes the manager would replace.
> A class name does not explain what the system does. Define its responsibilities, how callers use it, and when it is created and cleaned up.
