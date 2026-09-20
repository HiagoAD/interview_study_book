---
book: Unity Game Engineering
chapter: 05: OOP, principles, and patterns with tradeoffs
---

## Encapsulation and polymorphism in gameplay {#oop-encapsulation}

Object-oriented programming combines state and behavior behind contracts. Encapsulation controls valid state changes. Abstraction exposes the relevant operations while hiding unnecessary details. Inheritance establishes a derived relationship. Polymorphism allows callers to use a contract without selecting behavior through concrete-type checks. These terms describe different tools, as outlined in [Microsoft's OOP overview](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/).

For a wallet, encapsulation means callers cannot arbitrarily assign a negative balance. The wallet exposes operations such as grant and spend, validates the amount, and preserves its invariant. A class containing only public mutable fields may organize data without enforcing such a boundary.

For damage, an `IDamageReceiver` contract can let an attack deliver a damage request without knowing whether the target is a destructible crate or an enemy. The contract still needs semantics: can it reject damage, can the target already be dead, and is the result synchronous?

Polymorphism is useful when behavior varies. A simple data discriminator and switch may be clearer for a small closed set of states. If every call site immediately casts an interface back to concrete types, the abstraction may not describe what callers really need.

Keep domain language in APIs. `TrySpend` communicates more than `SetValue`. `BeginRun` communicates more than `ChangeState(2)`. Types should prevent invalid combinations when doing so is practical: a run ID and a catalog ID may both be strings, but wrappers can prevent passing one where the other belongs.

Do not equate OO with allocating one object for every conceptual thing. A dense array of compact states can still have an encapsulated owner. Objects at system boundaries can coexist with data-oriented processing in a hot loop.

?? oop-encapsulation-purpose What does encapsulation contribute to a wallet?
* It controls state transitions so invalid balances cannot be created through ordinary callers.
- It requires every balance update to allocate a new GameObject.
- It prevents the wallet from being tested.
- It means all fields must be globally accessible.
> Encapsulation is valuable when the public operations preserve a meaningful invariant.

?? oop-polymorphism-limit Callers routinely downcast an interface to inspect implementation-specific fields. What should be reconsidered?
* Whether the interface exposes the behavior its callers actually require.
- Whether inheritance should replace every collection.
- Whether all methods should become static.
- Whether type checks automatically improve extensibility.
> Frequent downcasts suggest the abstraction may be incomplete or inappropriate. A smaller, clearer contract or an explicit closed-set model may work better.

## Interfaces, inheritance, and composition {#oop-composition}

An interface states a capability. An abstract base class can also supply shared implementation and protected state. Composition builds behavior by connecting collaborators. These choices are not mutually exclusive.

Suppose enemies vary by movement, attack, and reward. An inheritance tree can start as `Enemy -> FlyingEnemy -> FlyingRangedEnemy`, then struggle when a grounded ranged enemy or a flying melee boss arrives. Independent movement and attack policies often represent these combinations more directly.

That flexibility requires more wiring. Assign an owner to each collaborator, validate required references, and provide presets so designers can choose supported combinations. A base class can still be appropriate for a stable lifecycle template where all derived types obey the same contract.

Apply the substitution test: can a caller use the subtype without needing to know that it is special? If a base inventory promises that adding an item succeeds when capacity is available, a subtype that throws for ordinary items violates that expectation unless rejection is already part of the contract.

Do not use inheritance merely to reuse three lines. A helper function, contained object, or immutable value can share implementation without coupling lifecycles. Conversely, do not split a cohesive algorithm into many strategies solely to avoid a short conditional.

For Unity components, composition is already present at the GameObject level. That does not automatically make a design modular. Components that all reach into each other's mutable fields can be more tightly coupled than a well-encapsulated ordinary class.

Exercise: Design three enemy variants with independent movement and attack behavior. Explain how a designer chooses a valid combination and how the composition is tested without relying on scene-name lookups.

?? oop-composition-benefit Enemies vary independently in movement and attack. What often makes composition useful?
* It represents combinations without requiring a subclass for every pair of behaviors.
- It guarantees zero runtime overhead.
- It removes the need to initialize dependencies.
- It makes invalid combinations impossible without validation.
> Composition can avoid a combinatorial inheritance tree, but the graph still needs valid construction and ownership.

?+ A composed enemy has movement and attack policies, but designers can omit either required reference. Which addition addresses the actual weakness?
* Validated construction and authoring feedback for required collaborators.
- A deeper inheritance tree while leaving the missing-reference behavior undefined.
- Runtime scene searches for a random compatible component.
- An empty catch block around every attack.
> Composition moves some correctness responsibility into wiring. Factories, defaults, and validation make the combinations usable and diagnosable.

?? oop-substitution A subtype rejects ordinary inputs that the base contract promises to accept. Which principle is threatened?
* Substitutability.
- Hash collision resistance.
- Frame pacing.
- Asset compression.
> A caller relying on the base contract must remain correct when given a subtype. Stronger hidden preconditions break that relationship.

## Use SOLID to examine a design {#oop-solid}

Use the five SOLID principles to check responsibilities and dependency contracts:

| Principle | Practical question | Common overcorrection |
| --- | --- | --- |
| Single responsibility | Which independent reasons make this unit change? | A class for every line of logic |
| Open/closed | Can a likely variation be added at a stable boundary? | A plugin framework for imaginary extensions |
| Liskov substitution | Do implementations honor the same observable contract? | Inheritance based only on similar names |
| Interface segregation | Does each consumer depend only on operations it needs? | Hundreds of meaningless one-method interfaces |
| Dependency inversion | Do high-level rules depend on appropriate contracts? | Hiding a service locator behind an interface |

A mission evaluator should not know which file format stores its progress. It can depend on a persistence boundary or return the next state to an application layer. However, if persistence must atomically update rewards and claims, two unrelated tiny interfaces may hide that essential transaction. Keep operations that must commit together under a contract that exposes that requirement.

The open/closed principle does not mean existing code must never change. It means stable code can accommodate expected variation through a suitable extension point. If requirements reveal that the original boundary was wrong, revising it is healthier than accumulating adapters around a mistake.

Dependency inversion concerns direction of knowledge. Domain rules should not need a concrete scene controller to decide eligibility. The outer integration layer can depend on the domain and provide the infrastructure. A DI framework is optional.

Use cohesion and coupling to judge the result. Cohesion asks whether the parts of a unit belong together. Coupling asks what a change forces other units to know or change. For example, a claim operation needs the wallet's transaction contract; it should not need the reward screen's animation state.

?? oop-solid-boundary A reward and claim marker must commit together. What is wrong with splitting them into unrelated storage operations with no transaction contract?
* The abstraction hides a consistency requirement that callers must preserve.
- Interfaces cannot contain methods with return values.
- Small interfaces always improve correctness.
- Persistence should always happen in the HUD.
> An abstraction should expose the unit of consistency. Mechanical interface splitting can make an essential invariant harder to enforce.

?? oop-open-closed [tf] The open/closed principle forbids changing existing code even when new requirements invalidate its original abstraction.
* false
> Extension points help with expected variation. A wrong boundary should be revised rather than treated as permanent.

## Choose patterns by the problem they solve {#patterns-selection}

A design pattern describes an arrangement of responsibilities and its tradeoffs. Choose one by the problem it addresses:

| Pattern | Gameplay use | Cost or misuse |
| --- | --- | --- |
| Strategy | Swap an aim or reward-selection policy | Indirection for a trivial fixed rule |
| State | Encapsulate behavior for run phases | Many classes for three simple transitions |
| Observer | Notify UI and audio of committed facts | Hidden order, retention, and reentrancy |
| Command | Represent a player intent for queuing or replay | Assuming every command can be undone |
| Factory | Create a valid object graph or pool lease | A global factory that knows every subsystem |
| Adapter | Translate a platform SDK to a game-owned contract | Leaking SDK types through the boundary |
| Decorator | Add tracing or rate limits around an operation | Deep chains that obscure errors |
| Object pool | Reuse costly short-lived objects | Stale state and retained memory |

For a run state machine, first draw allowed transitions: ready to running, running to paused, paused to running, running to dead, dead to revived or finished. A switch can be sufficient. Use separate state objects when behavior becomes substantial and transition responsibilities remain clear.

Undo requires more than storing a command. A local editing operation may be reversible with a captured previous state. Granting an online reward or sending a platform purchase request is not safely undone by applying an inverse integer operation. External side effects may require compensation with their own rules.

A singleton answers “one instance is accessible here.” It does not answer initialization order, ownership, test isolation, scene reload, or whether one instance is actually correct. An explicitly owned application service may have one instance without global static access.

When discussing a pattern, explain when its cost outweighs its benefit. For instance, a state hierarchy may add more navigation than it saves for three short transitions.

?? patterns-command-undo Why does representing a purchase as a command not automatically make it undoable?
* External side effects and authoritative transactions may require compensation rather than simple reversal.
- Commands cannot contain parameters.
- Every purchase is an animation.
- Undo always means subtracting the same number later.
> Reversibility depends on domain semantics and external effects, not on the object used to represent the request.

?? patterns-state-choice A run has three small states and a clear transition table. What is a reasonable initial implementation?
* An explicit enum and transition logic, expanding only if behavior warrants separate state objects.
- A reflection-driven state framework regardless of requirements.
- Several independent booleans with no transition validation.
- A global event for every line of the transition.
> A compact state machine can remain explicit without a large class hierarchy. The important property is valid, understandable transitions.

## Enforce module boundaries and review for change cost {#patterns-modules}

Folders communicate organization; they do not enforce dependency direction. In Unity, assembly definitions can establish compilation boundaries and explicit references. Keep editor-only authoring tools out of runtime assemblies, and avoid cycles between gameplay domains. [Unity's assembly-definition manual](https://docs.unity3d.com/6000.0/Documentation/Manual/assembly-definition-files.html) explains these compilation units.

A possible dependency graph is:

```text
Game.Domain          ordinary rules and values
      ^
Game.Application     feature operations and orchestration
      ^
Game.UnityAdapters   components, asset conversion, presentation bindings

Game.Editor          authoring tools referencing relevant runtime contracts
Game.Tests           tests referencing the units under test
```

Arrows here mean “is depended on by the layer below.” This is one arrangement, not a requirement to create five assemblies in every project. Package integration may need additional adapter assemblies. Keep test access deliberate rather than making every method public for convenience.

Review a feature through one complete scenario. Can a reviewer identify the state owner, understand a rejection result, see resource cleanup, and locate tests? Does a new mission type require edits in six unrelated systems? Does deleting the view accidentally stop progression? The answers show which changes would cross module boundaries and which rules depend on a view's lifetime.

Useful comments explain why: a compatibility constraint, an engine ordering caveat, or an unusual numerical rule. Comments that paraphrase every assignment become stale noise. Prefer names and operations that carry ordinary intent.

Refactor when a concrete change exposes repeated work or unsafe coupling. Name the expected benefit and keep behavior-preserving steps separate from feature changes where practical. “Cleaner” is not enough if the refactor breaks saves or consumes the release window without reducing a demonstrated cost.

?? patterns-assembly-direction What should a plain gameplay rule assembly generally avoid depending on?
* A concrete scene HUD or platform SDK implementation.
- Its own domain value types.
- A small contract that expresses a needed capability.
- A deterministic calculation helper.
> Keeping engine presentation and infrastructure outside the rule layer improves testability and prevents unrelated integration details from shaping policy.

?? patterns-review-scenario Which review question most directly tests whether progression is wrongly coupled to presentation?
* Does closing or deleting the mission view prevent progress from being recorded?
- Is every file shorter than an arbitrary line limit?
- Do all classes end with the same suffix?
- Has every conditional been replaced with inheritance?
> Gameplay progression should follow its ownership and lifetime contract. A view's existence should not accidentally determine whether core rules execute.
