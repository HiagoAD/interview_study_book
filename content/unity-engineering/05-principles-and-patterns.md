---
book: Unity Game Engineering
chapter: 05: OOP, principles, and patterns with tradeoffs
---

## Encapsulation and polymorphism in gameplay {#oop-encapsulation}

Object-oriented programming brings state and behavior together behind defined operations. Encapsulation controls how state can change. Abstraction shows callers the operations they need, while hiding details they do not need. Inheritance lets one type derive from another. Polymorphism lets a caller use a shared contract without checking each concrete type to choose its behavior. These are distinct tools, as described in [Microsoft's OOP overview](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/).

For a wallet, encapsulation means a caller cannot simply assign a negative balance. Callers use operations such as grant and spend; the wallet validates the amount and keeps the balance within its rules. A class of public mutable fields can organize the data, but cannot enforce those rules on its own.

An `IDamageReceiver` interface can let an attack request damage without knowing whether its target is a crate or an enemy. The interface still needs a clear contract: whether the target can reject damage, what happens if it is already dead, and whether the result is available immediately.

Polymorphism helps when the same operation needs different behavior from different implementations. For a small, fixed set of states, a value identifying the state and a switch may be easier to read. If callers routinely cast an interface back to concrete types, check whether the interface actually provides what they need.

Use the game's vocabulary in APIs. `TrySpend` explains the intent better than `SetValue`; `BeginRun` explains more than `ChangeState(2)`. Types can also prevent mistakes. A run ID and a catalog ID may both contain strings, but separate wrapper types can stop a caller from passing one where the other belongs.

Object-oriented design does not require an object for every concept. One owner can control access to a dense array of compact states. You can use objects to define the operations between systems, while processing arrays efficiently inside a frequently executed loop.

?? oop-encapsulation-purpose What does encapsulation contribute to a wallet?
* It controls how the balance changes, so ordinary callers cannot create an invalid balance.
- It requires every balance update to allocate a new GameObject.
- It prevents the wallet from being tested.
- It means all fields must be globally accessible.
> Encapsulation is valuable when the public operations preserve a meaningful invariant.

?? oop-polymorphism-limit Callers routinely downcast an interface to inspect implementation-specific fields. What should be reconsidered?
* Whether the interface exposes the behavior its callers actually require.
- Whether inheritance should replace every collection.
- Whether all methods should become static.
- Whether type checks automatically improve extensibility.
> Repeatedly casting to concrete types suggests the interface is missing a needed operation, or does not fit the problem. Consider a clearer contract or an explicit model for a small, fixed set of cases.

## Interfaces, inheritance, and composition {#oop-composition}

An interface describes a capability. An abstract base class can also provide implementation and protected state for derived classes. Composition builds behavior by connecting separate objects that work together. A design can use all three.

Suppose enemies vary independently in movement, attack, and reward. An inheritance tree might start with `Enemy -> FlyingEnemy -> FlyingRangedEnemy`. It becomes awkward when the design adds a grounded ranged enemy or a flying melee boss. Separate movement and attack policies can express those combinations more directly.

Those separate policies need to be connected correctly. Assign an owner to each object, validate required references, and give designers presets for supported combinations. A base class can still be useful when every derived type follows the same stable sequence of lifecycle operations.

Check whether a caller can use a subtype without special handling. Suppose an inventory contract promises to accept an item whenever capacity is available. A subtype that throws for ordinary items breaks that promise, unless rejection was already allowed by the contract.

Choose inheritance for the relationship it expresses, rather than just to reuse a few lines. A helper function, contained object, or immutable value may share that code without tying two lifecycles together. Keep related logic together too: splitting one small algorithm into many strategies can make it harder to follow than a short conditional.

Unity already supports composition through the components attached to a GameObject. Those components still need clear boundaries. If each one reaches into the others' mutable fields, changing any component may affect the whole group.

Exercise: Design three enemy variants with independent movement and attack behavior. Explain how a designer chooses a valid combination and how the composition is tested without relying on scene-name lookups.

?? oop-composition-benefit Enemies vary independently in movement and attack. What often makes composition useful?
* It represents combinations without requiring a subclass for every pair of behaviors.
- It guarantees zero runtime overhead.
- It removes the need to initialize dependencies.
- It makes invalid combinations impossible without validation.
> Separate movement and attack objects avoid a subclass for every combination. The objects still need valid connections and clear owners.

?+ A composed enemy has movement and attack policies, but designers can omit either required reference. Which addition addresses the actual weakness?
* Check required references during construction and show designers which references are missing.
- A deeper inheritance tree while leaving the missing-reference behavior undefined.
- Runtime scene searches for a random compatible component.
- An empty catch block around every attack.
> A composed enemy only works when its parts are connected correctly. Factories, defaults, and validation help designers build valid combinations and locate missing references.

?? oop-substitution A subtype rejects ordinary inputs that the base contract promises to accept. Which principle is threatened?
* Substitutability.
- Hash collision resistance.
- Frame pacing.
- Asset compression.
> A caller that follows the base contract should still work with a subtype. Hidden extra requirements in the subtype break that promise.

## Use SOLID to examine a design {#oop-solid}

Use the five SOLID principles to check responsibilities and dependency contracts:

| Principle | Practical question | Common overcorrection |
| --- | --- | --- |
| Single responsibility | Which independent reasons make this unit change? | A class for every line of logic |
| Open/closed | Can a likely variation be added at a stable boundary? | A plugin framework for imaginary extensions |
| Liskov substitution | Do implementations honor the same observable contract? | Inheritance based only on similar names |
| Interface segregation | Does each consumer depend only on operations it needs? | Hundreds of meaningless one-method interfaces |
| Dependency inversion | Do high-level rules depend on appropriate contracts? | Hiding a service locator behind an interface |

A mission evaluator should not need to know the file format used to save progress. It can use a persistence contract, or return the next state for an application layer to save. That contract must still express which changes belong together. If rewards and claim records must be saved atomically, splitting them into unrelated interfaces can hide the requirement that both succeed or fail together.

The open/closed principle encourages extension points for variations you expect. It does not require existing code to remain untouched forever. When a new requirement shows that the original boundary was wrong, revise it; adding more adapters around the mistake can make it harder to fix.

Dependency inversion asks which layer needs to know about the other. Gameplay rules should not need a concrete scene controller to decide eligibility. The outer integration layer can depend on those rules and supply the infrastructure they need. A dependency-injection framework is optional.

Judge the result by cohesion and coupling. Cohesion asks whether the work inside a unit belongs together. Coupling asks how a change in one unit affects other units. A claim operation, for example, needs to understand the wallet's transaction rules. It should not need to know the current animation state of the reward screen.

?? oop-solid-boundary A reward and claim marker must commit together. What is wrong with splitting them into unrelated storage operations with no transaction contract?
* The separate operations hide the requirement that the reward and claim marker must be saved together.
- Interfaces cannot contain methods with return values.
- Small interfaces always improve correctness.
- Persistence should always happen in the HUD.
> The contract should make it possible to commit the reward and claim record together. Splitting the operations without a shared transaction makes that rule harder to enforce.

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

Before choosing an implementation for a run state machine, draw the allowed transitions: ready to running, running to paused, paused to running, running to dead, and dead to revived or finished. A switch may be enough. Separate state objects become useful when each state has substantial behavior and the rules for moving between states remain clear.

Storing a command does not by itself make an action reversible. A local editing command may be undone by restoring the previous state. An online reward or platform purchase has effects outside that local state; subtracting a number cannot reliably undo them. Reversing their effect may require a separate compensating operation, with its own rules.

A singleton answers “one instance is accessible here.” You still need to decide when it is initialized, who owns it, how tests isolate it, and what happens on scene reload. First check whether one instance is even correct for the feature. An application service can have a single, explicitly owned instance without exposing global static access.

When discussing a pattern, explain when its cost outweighs its benefit. For instance, a state hierarchy may add more navigation than it saves for three short transitions.

?? patterns-command-undo Why does representing a purchase as a command not automatically make it undoable?
* Effects outside the local program may need a separate compensating operation, with its own rules.
- Commands cannot contain parameters.
- Every purchase is an animation.
- Undo always means subtracting the same number later.
> Whether a purchase can be undone depends on the purchase rules and its external effects. Representing it as a command does not reverse those effects automatically.

?? patterns-state-choice A run has three small states and a clear transition table. What is a reasonable initial implementation?
* An explicit enum and transition logic, expanding only if behavior warrants separate state objects.
- A reflection-driven state framework regardless of requirements.
- Several independent booleans with no transition validation.
- A global event for every line of the transition.
> A compact state machine can remain explicit without a large class hierarchy. The important property is valid, understandable transitions.

## Enforce module boundaries and review for change cost {#patterns-modules}

Folders show how code is organized, but do not control which modules can reference each other. Unity assembly definitions let you compile modules separately and declare their references. Keep editor-only tools out of runtime assemblies, and avoid circular dependencies between gameplay modules. [Unity's assembly-definition manual](https://docs.unity3d.com/6000.0/Documentation/Manual/assembly-definition-files.html) explains these compilation units.

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

The arrows mean “is depended on by the layer below.” This is one possible arrangement; a small project does not automatically need five assemblies. Package integrations may need their own adapter assemblies. Also decide deliberately which internals tests can access, rather than making every method public for convenience.

Review one complete scenario through the feature. Follow the state owner, any rejection result, resource cleanup, and the relevant tests. Then try a change: would adding a mission type require edits in six unrelated systems? Would deleting the view stop progression? These checks reveal dependencies between modules and rules that accidentally depend on a view staying alive.

Use comments for reasoning that the code cannot make obvious: a save compatibility requirement, a Unity callback ordering issue, or an unusual numeric rule. Comments that repeat each assignment add work when the code changes. Clear names and operations should explain the ordinary steps.

Refactor when an actual change reveals duplicated work or dependencies that make edits unsafe. State the benefit you expect, and keep refactoring steps that preserve behavior separate from feature changes where practical. A refactor justified only as “Cleaner” may still break saves or consume the release window without solving a demonstrated problem.

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
> Progress should be recorded according to the gameplay rules and the lifetime of their owner. Closing a view must not accidentally stop those rules from running.
