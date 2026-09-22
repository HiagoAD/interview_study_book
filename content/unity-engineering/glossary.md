---
book: Unity Game Engineering
kind: glossary
---

## Adapter {#adapter}
= adapter pattern | adapters
-> decorator

One object that presents another one through the interface a caller expects, so a platform SDK, a storage API, or an older system can be reached through a contract the game owns.

The value is that the foreign type stops at the boundary. A purchase adapter turns whatever its SDK reports into the game's own result type, and gameplay code never names a store class. When the second platform arrives, a second adapter maps a different set of callbacks onto the same results and nothing above the boundary changes.

The usual misuse is an adapter that leaks. If the SDK's handle, exception, or enum travels through it, every caller now depends on that SDK and the boundary exists in the folder structure rather than in the code. The test is whether deleting the package would break anything above the adapter.

An adapter also translates between two systems inside one codebase. Connecting a new evaluator to an existing event source, as [[#missions-incremental-integration]] describes, is the same shape: one small object that speaks both vocabularies so neither system has to learn the other.

## Addressables {#addressables}
= addressable assets

Unity's package for loading assets by address rather than through a direct reference, returning handles it reference counts. Each acquisition has a matching release, and the memory is freed when nothing holds the asset any more.

It answers two separate questions: where content comes from, which may be the build or a remote catalog, and when it is in memory. A project that only needs the second can use it entirely locally. Direct serialized references remain simpler for small assets that are always resident, because the engine already manages their lifetime.

The part that produces bugs is ownership. Loading a prefab and cloning it with `Object.Instantiate` does not acquire a second reference, so the clones depend on a load somebody else must keep alive. Releasing a handle also does not promise the memory goes away, since dependencies and bundles can keep it resident. Check the installed package version before quoting any of this in an interview, because the API has changed across versions.

## Breadth-first search {#breadth-first-search}
= BFS | breadth first

A graph search that visits every node one edge from the start, then every node two edges away, and so on, using a queue. Where all edges cost the same, the first time it reaches a node is by a path with the fewest edges.

Mark a node as discovered when it is added to the queue rather than when it is taken out, or a node reachable from several places is queued several times. With adjacency lists the work is proportional to nodes plus edges.

It stops being correct the moment edges carry different costs, because fewest edges and cheapest path are then different questions. [[#algorithms-pathfinding]] takes that step and compares it with Dijkstra's algorithm and A-star.

## Burst {#burst}
= Burst compiler
-> job-system

A Unity compiler that translates a restricted subset of C# into optimized native code. It applies to job code written against value types and native containers, not to ordinary gameplay classes.

The restriction is the point rather than a limitation: code with no managed allocation, no reference types, and no exceptions of the usual kind is code a compiler can reason about and vectorize. That is also why it cannot simply be switched on over an existing system. The data has to move into the shape first, which is the work described in [[#async-jobs-burst]], and the compiler is the reward for having done it.

## Command {#command}
= command pattern | commands
-> observer

A player intent represented as an object rather than as a direct call, so that it can be queued, logged, replayed, or reversed.

This is a different idea from the command and event distinction in [[#architecture-communication]], which is about direction: a command asks an owner to act, an event reports what already happened. The pattern is about reification. Once the request is a value, something else can decide when it runs, record that it ran, and replay the sequence on another machine.

Undo is the property people assume and it is not free. A local editing command can be reversed by restoring the previous state, because the state is all there was. A reward grant or a platform purchase changed something outside the local model, and subtracting a number does not retract it. Reversing those needs a separate compensating operation with rules of its own.

The cost is a type per intent and a queue somebody owns. For a feature where the caller wants an immediate answer, a direct call that returns a result says more with less.

## Coroutine {#coroutine}
= coroutines

A Unity iterator the engine pauses and resumes across frames. It sequences work over time on the main thread; it does not move that work anywhere else, so a long calculation before the next yield still blocks the frame it runs in.

Its lifetime belongs to the MonoBehaviour that started it, and the rules surprise people in both directions. Disabling the component does not stop its coroutines. Deactivating the GameObject, or destroying the component, does. Nothing about it reports failure to a caller, which is why work that can fail usually wants a result somebody can observe.

[[#async-models]] compares it with `Task` and Unity's `Awaitable`, and the short version is that a coroutine fits a short scene sequence, a task fits existing asynchronous input and output, and neither of them makes arbitrary code run in parallel.

## Decorator {#decorator}
= decorator pattern
-> adapter

An object that implements the same contract as the one it wraps and adds behavior around it, such as tracing, caching, retries, or a rate limit, without the caller knowing it is there.

The distinction from an adapter is the contract. An adapter changes the interface so two sides can meet; a decorator keeps it and changes what happens inside. Because the type is unchanged, decorators compose, and that is both the appeal and the trap.

Deep chains obscure errors. A stack trace through four wrappers tells you less about where the failure began than one through none, and behavior that was added for tracing is easy to leave in a release. Two layers with names that say what they add are usually the limit worth keeping.

## Dependency injection {#dependency-injection}
= DI
-> service-locator

Giving an object what it needs from outside, usually as constructor parameters, rather than letting it find its own collaborators. The dependencies become visible in the signature, and a test can supply different ones.

A framework is optional and the term is often confused with one. [[#architecture-dependencies]] does it by hand: a composition root creates the clock, the wallet, and the effect model, and hands each object its collaborators in a few readable lines. That is dependency injection with no container anywhere.

A container earns its place when the graph is large enough that writing it out becomes the bigger cost, and it charges for that in registration errors, lifetime configuration, and a layer that stands between a failure and its cause. Either way the design question is the same, which is who owns each object and how long it lives.

## Draw call {#draw-call}
= draw calls
-> srp-batcher

One instruction from the CPU telling the GPU to draw a set of geometry with the current render state. Each one costs CPU time to prepare and submit, which is why the count is quoted so often.

The count alone decides very little. A frame with a thousand cheap draws can be limited by CPU submission, and a frame with fifty can be limited by what those draws shade. Both are fixed by different work, so the number is a symptom to check against the timeline rather than a target on its own.

Reducing submission cost and reducing shading cost are separate levers. Batching and instancing address the first, as [[#mobile-rendering]] describes; resolution, overdraw, and shader complexity address the second.

## Factory {#factory}
= factory pattern | factories
-> dependency-injection

An object or method whose job is creating other objects, so a caller can obtain a valid, fully connected instance without knowing which concrete type it receives or how it was assembled.

It covers what a composition root cannot. A root runs once and connects what exists at startup; enemies, projectiles, and view models are created later, repeatedly, and often with a type chosen at runtime. A factory is where that choice and the assembly rules live, which keeps the validation in one place instead of at every call site.

Creating an object is not the same as owning it. A factory that hands back an instance still leaves open who disposes it, returns it to a pool, or unsubscribes it, and a design that answers only the first question tends to leak the rest.

The familiar misuse is a single global factory that knows how to build everything, which quietly becomes a dependency of every subsystem and a place where any two modules can reach each other.

## Frame budget {#frame-budget}

The time one frame may take to hold the target frame rate, about 16.67 ms at 60 FPS, split between engine work, rendering submission, physics, animation, UI, audio, and gameplay code, with headroom left for a device that has warmed up.

The split is what makes it useful, and the gameplay share is usually smaller than people expect. [[#performance-frame-budget]] works an example where everything a gameplay engineer writes shares under three milliseconds, which turns half a millisecond in a mission evaluator from a rounding error into a fifth of the budget.

Measure it as a distribution rather than an average. A mean frame time hides the occasional long frame that a player actually notices, so percentiles and the frequency of long frames say more about how a build feels than any single number does.

## Idempotence {#idempotence}
= idempotent | idempotency

A property of an operation whose repetition changes nothing further: applying it twice for the same logical identity leaves the same state as applying it once.

The identity is the whole mechanism. Collecting a coin is idempotent for that coin's spawn identity, not for coins in general, and a claim is idempotent for its claim identity, not for the player. An operation with no stable identity cannot be idempotent, because nothing tells the second call that it is the second call.

It is worth separating from delivery. Messages can still arrive twice, and the network is not obliged to stop them; idempotence means the second arrival has no further effect. [[#missions-reward-claim]] follows that through a timeout after a commit, which is the case where the distinction pays for itself.

## Job System {#job-system}
= jobs
-> burst

Unity's scheduler for small units of work that run on worker threads, with dependencies between them declared explicitly. Jobs read and write native containers under access rules the system checks, rather than touching engine objects.

Most `UnityEngine` APIs are unavailable from a job, so the pattern is to copy the values out, compute, and apply the results on the main thread. Scheduling is not free either: for a small array an ordinary loop finishes before a job has been arranged, and calling `Complete` immediately after scheduling gives up the overlap that made it worth scheduling at all.

[[#async-jobs-burst]] covers the ownership rules for the containers and the region where measurement starts being worthwhile.

## Liskov substitution {#liskov-substitution}
= Liskov | LSP

The rule that an implementation must be usable wherever its contract is expected. A subtype that refuses work the contract promises to accept breaks every caller written against the contract rather than against that subtype.

What matters is observable behavior, not the signature, which is why a compiler cannot check it. [[#oop-composition]] gives the example: an inventory that promises to accept an item whenever capacity allows, and a subtype that throws for ordinary items. The override compiles, and the promise is gone.

The usual repair is to widen the contract honestly rather than to narrow the implementation quietly. If rejection is a real outcome, the operation should return one, and then callers can handle it instead of discovering it.

## Object pool {#object-pool}
= pooling | pooled | pool
-> factory

A set of objects kept alive and reused rather than created and destroyed repeatedly. Taking one out and returning it replaces allocation and initialization with a reset, at the cost of memory held for as long as the pool exists.

The reset is where the defects live. Disabling a GameObject does not clear velocity, damage source, trail history, subscriptions, or pending work, so every field that belongs to one use has to be named and cleared when that use ends. Anything missed becomes a bug that only appears after the object has been reused.

Reuse also breaks object identity. The same instance represents different logical entities over a run, so a callback that captured a reference can apply its result to whatever occupies that slot now. Combining a slot with a generation number, and checking it before acting, is the usual fix, and it appears throughout this book as the stale-result problem.

[[#performance-pooling]] states the full contract a pool needs, including what happens when nothing is free, how double returns are caught, and how the capacity is derived from the spawn rate and lifetime.

## Observer {#observer}
= observer pattern | observers

A source that announces facts, and listeners that react to them, with no reference from the source to any listener. UI and audio reacting to a reward that has already been granted is the usual gameplay case.

The value is direction. The wallet does not know the HUD exists, so the HUD can be deleted, duplicated, or opened from two screens without the wallet changing. That is also the risk: the source no longer knows who runs, in what order, or whether anyone is still listening.

Three problems are worth naming before an interviewer names them. Order: listeners run in subscription order, which is an accident of scene load, so no listener may depend on another having run first. Retention: a subscription keeps the listener alive, so a view that forgets to unsubscribe leaks and keeps reacting after it is closed. Reentrancy: a listener that causes the same event to fire again re-enters the source mid-notification, where half the state has been updated and half has not.

Announce facts that have already happened, rather than requests. “Reward granted” can be handled by any number of listeners in any order. “Grant reward” cannot, because two listeners would grant it twice.

## Play Mode tests {#play-mode-tests}
= Edit Mode tests | Unity Test Framework

Tests that run with the engine playing, so component lifecycles, scenes, prefabs, physics, and coroutines behave as they do in the game. Edit Mode tests run without entering play mode and suit rules that need no engine at all.

The distinction decides what a passing run establishes. An Edit Mode test over a plain C# model proves the rule; it says nothing about whether the prefab is wired up or the subscription is released on disable. A Play Mode test covers those and costs more time per run, which is why the rule layer in this book is kept free of engine types.

Running either in a player build on the target device adds a third kind of evidence again, since stripping, the scripting backend, and the filesystem all differ there. [[#testing-contracts]] sets out what each environment is for.

## Scripting backend {#scripting-backend}
= IL2CPP | Mono

The choice of how a build turns C# into code the device runs. Mono compiles just in time while the game runs; IL2CPP converts the assemblies to C++ and compiles them ahead of time, which is what shipping mobile builds normally use.

The difference is not only speed. Ahead-of-time compilation means code has to exist at build time, so reflection over types nothing references statically, and anything that generates code at runtime, can work in the Editor and fail on the device. Managed code stripping removes what appears unused, which turns the same assumption into a missing type in a player build.

Because of that, “works in the Editor” is a statement about the Editor. [[#mobile-build-integrations]] covers what to verify in the build you actually ship.

## ScriptableObject {#scriptable-object}
= scriptable objects

A Unity asset that holds serialized data without belonging to a GameObject, used for configuration that several objects share and that designers author in the Editor.

Its defining property is that the asset is shared. Writing to one at runtime changes it for everything that references it, and the Editor makes that worse rather than obvious: a write during play mode can persist on disk after play stops, while the same write in a player build lands in a loaded copy that disappears with the process. A feature that appears to save for weeks can lose everything on the first device test.

Treat one as authored input, and convert it into validated runtime definitions the run owns, as [[#powerup-data-model]] describes. Player progress belongs in a save with a version and a migration path, which a ScriptableObject does not provide.

## Service locator {#service-locator}
= locator
-> dependency-injection

A global registry that objects ask for their collaborators, usually through a static call such as `Locator.Get<IWallet>()`. Anything becomes reachable from anywhere, and what a class actually depends on stops being visible in its signature.

That is the whole trade. Construction gets easier, because nothing has to be passed anywhere, and every other question gets harder: what this class needs, whether a test can replace it, what order things must be registered in, and what happens when a scene reloads and a stale entry is still registered.

Hiding it behind an interface does not repair it, which is the overcorrection named in [[#oop-solid]]. The dependency on global state remains; it now has a nicer type.

## Singleton {#singleton}
= singletons
-> service-locator

A type that guarantees a single instance and exposes it globally, usually creating itself on first access. The word carries three separable ideas: one instance, global access, and lazy self-creation.

Almost all of the pain comes from the second and third. One instance is often the correct design, and an application service created by the composition root and passed to the objects that need it has that property without global reach, without ambiguity about when it is created, and without the test isolation problem.

That separation is the answer to “are singletons bad”, and [[#patterns-selection]] develops it. In Unity there is a fourth cost worth knowing: a self-creating static survives a scene load, and with domain reload disabled it can survive entering play mode again, carrying the previous session's state with it.

## Spatial index {#spatial-index}
= spatial partition | spatial grid | uniform grid

A structure that maps positions to buckets, most simply a uniform grid of cells, so a range query examines the entities near the search area instead of every entity in the world.

It is a trade, not a free improvement. Queries get cheaper and movement gets more expensive, because an entity that crosses a cell boundary has to change buckets. Dividing reads by writes over a representative second of play decides whether it pays, and a catalog queried thousands of times is a very different case from entities that move every frame.

Cell size is the one parameter and it can be reasoned about rather than guessed. [[#algorithms-spatial]] starts it near the common query radius and gives the symptom of each mistake in either direction.

## SRP Batcher {#srp-batcher}
= SRP batching
-> draw-call

A rendering path in Unity's scriptable render pipelines that keeps material data resident on the GPU, so consecutive draws using compatible shaders skip most of their per-draw setup. It reduces the CPU cost of each draw; it does not merge objects into one draw.

The confusion it causes is the word batching. Nothing is combined, the draw count does not fall, and the saving appears in CPU submission time. GPU instancing is the separate mechanism that draws many copies of one mesh together, and the two have different compatibility requirements.

Compatibility is decided by the shader and how its properties are declared, so an otherwise reasonable material can quietly fall out of the fast path. [[#mobile-rendering]] is where that sits in the order of things to check.

## State {#state}
= state object | run phase

One object per phase of a run, each holding the behavior for that phase and the moves out of it. It replaces a growing switch when the phases have substantial behavior of their own.

A run that is ready, running, paused, dead, or finished can be an enum and a switch, and for three short phases that is usually the clearest thing to write. The pattern earns its place when each phase carries real behavior: its own update, its own entry and exit work, its own input handling.

The cost is navigation. Five classes and an interface replace one readable switch, and the transition table that used to sit in one place is now spread across the classes that perform the moves. Keeping the allowed transitions in one table, even when the behavior lives in state objects, is what holds that cost down.

Draw the transitions before choosing, as [[#patterns-selection]] suggests: ready to running, running to paused, paused to running, running to dead, and dead to revived or finished. If the drawing is small and the phases are thin, the enum wins.

## Strategy {#strategy}
= strategy pattern | strategies
-> state

One interchangeable rule behind a small interface, so a caller can run the rule without knowing which one it holds. Aim selection, reward selection, and difficulty curves are the usual gameplay cases.

A strategy separates the rule from the moment it is chosen. The caller keeps a reference to the interface and calls it, while which implementation sits behind that reference is decided elsewhere, usually where the object is built.

```csharp
public interface IAimPolicy
{
    Transform Choose(IReadOnlyList<Transform> targets);
}

public sealed class Turret
{
    private readonly IAimPolicy aim;

    public Turret(IAimPolicy aim) => this.aim = aim;
}
```

What justifies it is variation that already exists: two aim rules, a reward table per event, a difficulty curve per platform. Naming that variation is what separates a strategy from indirection nobody needed. One fixed rule behind an interface costs a file, a reference, and a call, and buys nothing until the second rule arrives.

Testing is the other common reason. A policy with no engine references can be exercised with plain values, which is harder when the rule is a private method on a MonoBehaviour.

The pattern says nothing about where the choice is made. A factory, a preset asset, or the composition root can all supply it, and that decision is usually more interesting than the interface itself.
