---
book: Unity Game Engineering
chapter: 01: Reasoning about gameplay architecture
---

## How to study and explain an engineering decision {#engineering-study-method}

Start with architecture: take a gameplay feature, decide who owns its state, and explain how it behaves when something fails. The later chapters cover C#, Unity production work, algorithms, mobile performance, live operations, collaboration, and evidence from your own projects. This order runs from design reasoning to production concerns, which is roughly how a technical interview works through them. Individual interview reports can suggest topics to practise, but cannot establish what a studio will ask next.

The running example is an imaginary mobile runner. Players collect coins, activate power-ups, complete missions, and participate in seasonal events. The requirements are invented for the exercises; they make no claims about the internals of any commercial game.

| Preparation area | Chapters |
| --- | --- |
| System design and architecture | 1–3, with the capstone in 15 |
| C# and software-engineering fundamentals | 4–5 |
| Unity production behavior and debugging | 6–8 |
| Data structures and game algorithms | 9–10 |
| Mobile performance and resource budgets | 11–12 |
| LiveOps and safe releases | 13 |
| Cross-disciplinary collaboration | 14 |
| Previous projects and interview practice | 15 |

Read each section, explain its central decision aloud, and then answer the questions. Multiple choice checks recognition; it does not prove that you can design a system. For deeper practice, close the book and draw the data ownership and lifetime boundaries yourself. Change one requirement and see whether your design still works.

The explanations use Unity 6.0 as the reference baseline. Unity package APIs, platform capabilities, and C# support vary with the Editor and package versions, so versioned documentation is linked where those differences matter. The examples isolate particular rules; project-specific types and pseudocode are identified. A complete Unity project or backend would need the surrounding integration. You can read the textbook and answer its questions offline. Opening the optional documentation links requires a connection.

Build a technical answer around these questions:

1. Requirement: What player or authoring behavior is needed?
2. Constraint: What limits the solution: time, devices, existing saves, team practices?
3. Invariant: What must remain true even during failure or unusual ordering?
4. Ownership: Who controls the authoritative state and its lifetime?
5. Mechanism: Which types and operations enforce those rules?
6. Tradeoff: What does the choice cost, and when would you choose differently?
7. Evidence: Which tests, measurements, or production observations support it?

For example, “I used interfaces and events” names mechanisms. “The run owns power-up state; presentation observes committed changes; a clock parameter lets us test expiration exactly at the boundary” explains a design.

?? architecture-answer-evidence Which answer best demonstrates an architectural decision?
* The run owns effect state so restarting cannot retain a previous run's timers, and restart tests verify that boundary.
- The system uses several well-known patterns, so it must be maintainable.
- Every type has an interface, so all dependencies are automatically correct.
- A single manager owns everything because fewer files always mean less complexity.
- The design resembles a popular repository, so alternatives need no discussion.
> Explain the requirement, ownership decision, and evidence. A pattern name alone does not establish that a design solves the actual problem.

?? preparation-evidence [tf] One candidate's interview report is enough to establish the exact technical syllabus for a future interview.
* false
> An interview report describes one experience. Prioritize the topics a studio's own products make likely, while preparing transferable engineering reasoning.

## Turn a feature request into a contract {#architecture-requirements}

“Add a coin magnet” leaves most engineering decisions unresolved. Does it attract coins through walls? Does it stack with another magnet? Does the duration pause during menus? Does death end it? Can a designer change its range without a code build? Can an attraction already in progress finish after the effect expires?

Start with a short player story, then enumerate observable behavior. Separate functional rules from quality requirements. “Coins inside the radius move toward the player” is functional. “The feature fits the remaining frame budget on the minimum supported device” is a quality constraint. “Designers can preview the radius in a test scene” is an authoring requirement.

Record the behavior for each edge case:

| Situation | Example contract |
| --- | --- |
| Collect a second magnet | Refresh the remaining time to the configured duration |
| Open a pause menu | Stop gameplay simulation time and attraction movement |
| Restart the run | Remove every active effect and release all run-owned objects |
| Coin enters two detection paths | Award it at most once |
| Invalid configuration | Reject it during content validation; use a defined runtime fallback |
| Coin already moving when magnet expires | Finish that attraction, provided the run is still active |

Another game may choose different policies. Once the team agrees on them, use the same rules in gameplay, presentation, and tests.

An invariant is stronger than a happy-path requirement. “A coin is collected at most once per run” must hold under repeated collision callbacks, a late animation, and overlapping detection. “The reward balance never decreases during collection” implies overflow and negative-value validation deserve attention.

Define non-goals as well. A local prototype may not need network authority, cross-device saves, or configurable stacking combinations. Keeping these out of the first implementation reduces cost. Keep the state-changing operations separate from presentation so that a future authority can use them without requiring a service in the prototype.

Finish discovery with acceptance examples: given a paused run with three seconds remaining, advancing real time by ten seconds leaves three gameplay seconds remaining. These examples become tests and give designers a precise way to confirm intent.

?? architecture-invariant Which statement is an invariant for coin collection?
* A particular coin can increase the run's balance at most once.
* Repeated delivery of the same collection must not increase the reward again.
- The collection animation lasts approximately half a second.
- The magnet icon should look appealing.
- Most players should collect several coins.
- The implementation should have five classes.
> An invariant is a rule that must hold across valid execution paths, including retries, duplicated callbacks, and unusual ordering.

?+ A collision callback and a magnet callback both report the same coin. Which requirement directly determines the correct behavior?
* Collection is idempotent for that coin's identity within the run.
- The magnet should use a circular visual effect.
- Coin prefabs should have descriptive names.
- The run uses a fixed target frame rate.
> Idempotent collection means repeating the same logical operation has no additional reward effect.

## Assign responsibilities and identify sources of truth {#architecture-responsibilities}

A responsibility is a reason a unit must change. A magnet duration rule changes when design changes stacking. A sound player changes when audio integration changes. A save adapter changes when storage changes. Combining all three makes a small balance change risky because it touches unrelated behavior.

A practical decomposition for the runner is:

| Unit | Owns | Does not decide |
| --- | --- | --- |
| Run session | Run identity, phase, run lifetime | Audio mixing |
| Effect model | Activation, expiration, stacking policy | Prefab selection |
| Coin registry | Active coin identities and positions | Reward amounts |
| Collection operation | Eligibility and one-time collection transition | Animation timing |
| Wallet or run score | Valid balance changes | Collider filtering |
| Presentation | Icons, sounds, particles, visual interpolation | Whether a reward is earned |

Choose one authoritative owner for each piece of state. If both the HUD and the effect model count down independently, pause, rounding, or dropped frames can make them disagree. The HUD should derive its display from the effect model's deadline and the same clock domain.

This does not require one class per row. A small feature may combine the registry and collection operation. Split a unit when its responsibilities, lifetime, testing needs, or change frequency justify the boundary. Excessive fragmentation makes it harder to follow a single operation.

Distinguish state, policy, and effects. State says the magnet expires at simulation time 42. Policy says another pickup refreshes its duration. Effects play the sound and change the icon. State and policy should remain understandable even if the scene's presentation is replaced.

Name operations after intent: `TryCollect(coinId)`, `ActivateMagnet(duration)`, `FinishRun(reason)`. A public setter such as `Collected = true` lets callers bypass the reward rule. An operation can validate the transition, change all related state, and return an explicit outcome.

Draw ownership arrows separately from notification arrows. A HUD can observe the run without owning it. A run can own a collection registry without exposing that registry for arbitrary mutation.

![Inputs enter a run-owned operation, which commits authoritative state and exposes outcomes to persistence and presentation through explicit contracts](images/feature-boundaries.svg)

?? architecture-source-of-truth The HUD and gameplay each maintain a separate magnet timer. What is the main architectural risk?
* Their copies can diverge after pause, refresh, or delayed updates.
- Reading a timer from another object always allocates memory.
- Unity forbids multiple timers in one scene.
- The HUD must always own every gameplay deadline.
> Duplicated authoritative state creates synchronization work and inconsistent behavior. Derive presentation from the owner of the rule.

?+ A power-up expires correctly, but its icon stays visible after reopening the HUD. Which design most directly prevents that discrepancy?
* Rebuild the icon from the effect owner's current state whenever the view binds.
- Persist a separate HUD timer and never compare it with gameplay.
- Extend the gameplay effect whenever the icon is visible.
- Rely only on the expiration event, even while the HUD is unsubscribed.
> A view can miss notifications while absent. Reading current authoritative state on binding establishes a correct baseline; notifications maintain it afterward.

?? architecture-encapsulation Why prefer `TryCollect(id)` over a publicly settable `Collected` property?
* The operation can enforce eligibility, one-time transition, and related balance updates together.
- Methods always execute faster than properties.
- A method automatically makes the operation thread-safe.
- Properties cannot be tested.
> Encapsulation protects an invariant by controlling how state changes. A method name alone does not provide atomicity or thread safety; its implementation and calling contract must do that.

## Direct dependencies, composition roots, and lifetimes {#architecture-dependencies}

A dependency is anything a unit needs to do its job: another object, global state, a clock, a random source, a scene, or even an initialization convention. Constructor parameters make dependencies visible. Global lookups and static access hide them.

For ordinary C# objects, use construction to establish a valid state. A mission evaluator can receive immutable definitions and a progress store. In Unity, serialized component references provide Inspector wiring, while a composition root creates the ordinary objects and connects them to components. A composition root is a location where a graph is assembled; it does not require a dependency-injection framework.

Match object lifetimes explicitly:

| Lifetime | Examples | Cleanup boundary |
| --- | --- | --- |
| Application | Settings, installed catalog, platform adapter | Application shutdown or explicit replacement |
| Player session | Loaded profile, authenticated identity | Logout or profile switch |
| Scene | Scene bindings, cameras | Scene unload |
| Run | Score, effects, mission event buffer | Run end or restart |
| View | Subscriptions, pending artwork request | Hide, unbind, or destroy, according to its contract |

A longer-lived service retaining a shorter-lived object is a warning sign. A static event holding a scene HUD can keep its managed wrapper reachable after scene unload. A task launched by a view can complete after the view has been reused for a different item. These are lifetime bugs even when no exception occurs.

Use an interface to describe a dependency whose implementation callers should not need to know: a clock, storage operation, reward service, or replaceable selection policy. An immutable definition can stay a concrete type; an interface adds little if callers only need its data.

The wiring mechanism also has costs. Inspector references work well for stable scene relationships but cannot express every runtime graph. Explicit factories support dynamic creation but need an ownership convention. A DI container can help a large graph with scopes, but adds registration failures and another debugging layer. A service locator is convenient yet allows any caller to acquire hidden dependencies.

?? architecture-lifetime A persistent service subscribes a scene HUD to its event. Which responsibility must be assigned?
* The HUD or its binding owner must unsubscribe when that binding's lifetime ends.
- Garbage collection must infer that the scene no longer needs notifications.
- Every subscriber should become persistent.
- The event should invoke only during `Update`, which prevents lifetime problems.
> The publisher retains delegates to subscribers. Explicit unbinding prevents stale notifications and retention across scene lifetimes.

?+ Which dependency is most useful to inject into a rule that expires effects?
* The relevant clock or the current time value.
- The entire scene hierarchy.
- Every registered service, whether needed or not.
- A global singleton that reads wall time internally.
> Supplying time explicitly makes pause behavior and exact expiration boundaries controllable in tests.

## Commands, events, and failure ordering {#architecture-communication}

A command requests an action: collect a coin, spend currency, start a run. It has an owner that accepts or rejects it. An event reports something that has happened: coin collected, currency spent, run started. Confusing the two makes causality hard to follow.

Prefer a direct call when a caller needs a result from one owner. `TrySpend(amount)` can return insufficient funds. Publishing `PleaseSpendMoney` and hoping an unknown subscriber responds hides the operation's completion and error handling.

Use notifications when several independent observers need a committed fact. A collected coin can update the HUD, play audio, and feed a mission tracker. Decide which of those are required gameplay work. If mission progress is part of the collection contract, do not accidentally make it optional just because it is implemented as a subscriber.

The safe order for a small local transaction is:

```text
Validate command
Prepare all required changes
Commit authoritative state
Record or return the result
Notify presentation observers
```

A C# multicast event invokes handlers synchronously in order until one throws. The state may already be changed while later observers never run. For a critical operation, return the authoritative result independently of presentation, define an error boundary for observers, and log failures with context. Do not let an animation exception imply that a committed reward should be granted again.

Events also introduce reentrancy: a callback may issue another command before the first call returns. Establish state before notifying, reject invalid nested transitions, or queue commands for a later processing point. A queue makes ordering explicit but introduces latency and queue ownership.

An event bus can connect publishers and subscribers without direct references. That makes subscribers harder to find and introduces ordering, retention, and replay concerns. Include run IDs, stable entity IDs, or operation IDs in payloads when they are necessary to distinguish stale or duplicate work.

?? architecture-command-event A purchase button needs to know whether the player has enough currency. Which interaction is clearest?
* Call the purchase operation and receive an explicit success or failure result.
- Broadcast a presentation event and assume a subscriber performed the purchase.
- Update the balance label first and infer success from its text.
- Let each listener independently deduct the price.
> An operation with one authority should expose its result directly. Notifications can follow after the authoritative decision.

?+ A mission counter must advance whenever a collection commits. What must the architecture specify if it uses events for that update?
* A delivery and failure contract that preserves this required gameplay work.
- That any optional observer may perform the update if it happens to be loaded.
- That playing the coin sound establishes mission progress.
- That an event name alone guarantees durable delivery.
> Required gameplay consequences cannot become accidental optional observers. Event-based integration needs an explicit guarantee appropriate to the invariant.

?? architecture-notification-failure A reward is committed, then its celebration animation throws. What should a retry policy preserve?
* The same logical reward must not be granted a second time.
- Every animation exception should reset the player's balance.
- A failed observer proves the original reward never happened.
- Repeating all state changes is safe because the call threw.
> Failure after commitment is different from rejection before commitment. Retrying safely requires recognizing the already-completed logical operation.

## Evaluate architecture with change scenarios {#architecture-tradeoffs}

Evaluate a design by trying the changes it is likely to face.

For the magnet, ask: can a designer tune duration without changing collection code? Can two players have independent effects? Can a test advance time without loading a scene? Can a run restart during attraction? Can a new renderer replace particles without changing reward rules? Can a programmer trace one collection from input to saved result?

These goals can conflict. A generic effect framework supports arbitrary combinations, but debugging a simple magnet may require following configuration through six registries. A direct implementation is easier to inspect, but several duplicate power-ups may drift apart. A useful middle ground shares proven rules such as expiration and stacking while keeping feature-specific behavior explicit.

Record major decisions in a short architecture decision record:

```text
Context: Three effects share duration and pause semantics.
Decision: One run-owned timer model, separate effect behaviors.
Alternative: A global effect manager.
Reason rejected: It mixes runs and complicates isolated tests.
Cost: Explicit construction and binding at run start.
Revisit when: Effects must persist across runs or synchronize online.
Evidence: Restart, pause, and boundary tests; device profiling.
```

The same tradeoff appears in resource management. Preloading lowers transition latency but raises resident memory. More indirection can improve substitution while making traces harder to read. Caching lowers repeated computation but introduces invalidation and retention.

Choose the smallest design that satisfies current requirements and credible near-term changes. Keep irreversible decisions especially visible: save identifiers, content contracts, public APIs, and dependency direction. Internal class arrangements are usually easier to revise.

In an interview, articulate one rejected alternative and a condition under which it would become reasonable. “I rejected a global manager because runs require independent state; an application-wide catalog would still be shared” shows judgment more clearly than “singletons are bad.”

?? architecture-tradeoff A preload strategy eliminates a transition hitch but doubles peak memory. What is the next engineering decision?
* Compare the latency improvement and peak memory against the actual device budgets.
- Accept it because lower latency always dominates memory usage.
- Reject it because caching is always premature optimization.
- Hide the extra memory in a different subsystem's accounting.
> Tradeoffs require explicit budgets and measurements. A local improvement can make the whole product less reliable.

?? architecture-rejected-alternative What makes discussion of a rejected alternative useful?
* Explain which requirement it failed and when it would become appropriate.
- Describe it as inherently unprofessional.
- List its pattern name without discussing behavior.
- Claim the selected approach has no costs.
> Alternatives demonstrate reasoning when they are evaluated against constraints rather than personal preference.
