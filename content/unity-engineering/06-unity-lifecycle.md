---
book: Unity Game Engineering
chapter: 06: Unity lifecycle, scenes, prefabs, and serialization
---

## Initialize objects without accidental execution-order dependencies {#unity-initialization}

Unity controls the lifecycle of components. Construct ordinary C# models with `new`, but create MonoBehaviours through GameObjects and Unity's component APIs. A component constructor is not the place to depend on serialized scene state or call engine APIs.

For an active GameObject, `Awake` is initialization of its script instance; it can run even when that component is disabled. An initially inactive GameObject defers `Awake` until activation. `OnEnable` runs when the component is enabled and active. `Start` runs once, before its first update when enabled. The ordering of different objects' `Awake` calls is not a dependency contract. [Unity's Awake reference](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/monobehaviour/awake) details these conditions.

Use `Awake` for local setup that does not require another object to have completed initialization. Use explicit composition for cross-object dependencies. `Start` can help with ordinary scene initialization, but it is not a universal barrier for objects created later, inactive objects, or asynchronous startup.

Put startup dependencies in order before enabling interaction:

```text
Load and validate definitions
Open or recover player state
Construct the feature models
Bind scene adapters
Mark the run ready
Enable player interaction
```

Represent not-ready and failed states when startup can wait or fail. A null reference followed by a retry in every `Update` is not a clear initialization policy.

The same ordering issue occurs during instantiation. An active prefab can invoke its lifecycle before the caller assigns its dependencies. Options include an inactive prefab initialized before activation, a factory whose components do not consume dependencies until explicit binding, or serialized self-contained dependencies. If using an inactive object, ensure explicit initialization does not itself assume `Awake` has already cached fields.

Script Execution Order can coordinate specific known script types, but a large ordering list often encodes an invisible architecture. When one subsystem needs another to be ready, express that dependency in the startup operation.

?? unity-awake-order Why is reading another component's initialized runtime state in `Awake` fragile?
* The other object's `Awake` may not have run yet.
- `Awake` always runs on a background thread.
- Serialized references are forbidden in MonoBehaviours.
- `Start` is guaranteed to run before every `Awake`.
> Unity does not provide arbitrary cross-object Awake ordering as a dependency guarantee. Explicit construction and readiness contracts make dependencies reliable.

?+ A component's active prefab uses a dependency in OnEnable, but the factory assigns that dependency after Instantiate returns. What is the hazard?
* OnEnable can execute before the factory's assignment.
- Instantiate guarantees that all later factory assignments run first.
- OnEnable cannot execute on an instantiated object.
- A serialized reference automatically substitutes for any unassigned interface.
> Active instantiation can trigger lifecycle callbacks before subsequent caller code. Construction must prevent early consumption or provide the dependency beforehand.

?? unity-inactive-factory A factory instantiates an inactive prefab and calls `Initialize` before activation. What must `Initialize` account for?
* `Awake` may not yet have run, so its cached fields may not exist.
- `Start` has necessarily finished already.
- Inactive objects cannot hold serialized references.
- Activation automatically injects every interface dependency.
> Inactive construction can prevent early callbacks, but initialization must not depend on callbacks that activation has not triggered.

## Update, fixed simulation, and time domains {#unity-update-time}

`Update` follows rendered frames; `FixedUpdate` follows fixed simulation steps. A rendered frame can contain zero, one, or several fixed updates. Increasing rendering frame rate does not make physics step once per rendered frame. A slow frame can cause catch-up simulation work. [Unity's fixed-update explanation](https://docs.unity.com/en-us/engine/6000.6/manual/scripting/managing-time-and-frame-rate/fixed-updates) describes this scheduling.

Capture frame-based input where the selected input system processes it, then consume a command in the simulation at a defined point. A one-frame button edge read only in a mismatched fixed loop can be missed or mishandled. The exact integration depends on the Input System update mode and action configuration.

For simple transform motion in a non-physics model, displacement is velocity multiplied by elapsed simulation time. For physics-driven objects, choose the appropriate Rigidbody API and simulation phase; do not fight the physics solver by changing transforms arbitrarily. Rigidbody interpolation smooths presentation between simulation states but does not add physical accuracy.

Use `LateUpdate` for tasks that should observe completed ordinary frame updates, such as a camera following a transform-driven character. This still does not establish arbitrary order among multiple LateUpdate scripts.

Separate time domains:

| Domain | Suitable use | Important limitation |
| --- | --- | --- |
| Scaled gameplay time | Effects and gameplay animation affected by pause | Stops or slows with the game's time policy |
| Unscaled elapsed time | Pause-menu animation and local timeout display | Not a trusted online deadline |
| Monotonic elapsed time | Measuring durations | Not a calendar date |
| UTC instant | Event availability and persisted timestamps | Device wall time can change or be manipulated |

Setting `timeScale` to zero does not automatically stop every system, task, network callback, or unscaled animation. A pause is a product policy spanning input, simulation, UI, and audio. Test each part.

?? unity-fixed-frequency At a high rendering frame rate, how many `FixedUpdate` calls can occur in one rendered frame?
* Zero, one, or more, according to accumulated simulation time.
- Exactly one in every case.
- Exactly the number of visible GameObjects.
- None whenever the GPU is idle.
> Fixed updates follow the simulation interval, not a one-to-one correspondence with rendered frames.

?? unity-pause-policy [tf] Setting `Time.timeScale` to zero guarantees that all asynchronous operations and callbacks stop.
* false
> Time scale affects systems that use scaled game time. Tasks, external callbacks, and unscaled operations have separate lifetimes and scheduling.

## Scenes and prefabs are ownership tools {#unity-scenes-prefabs}

A scene groups authored objects and often establishes a lifetime boundary. A prefab defines a reusable object hierarchy. Neither should become the sole definition of gameplay authority.

A bootstrap scene can own application services, while gameplay scenes own cameras, level objects, and run adapters. Additive loading allows several scenes to coexist, but now the team must define which scene owns lighting, input, the active camera, and shutdown ordering.

`DontDestroyOnLoad` is a persistence mechanism, not a complete service architecture. If every scene spawns its own persistent manager, repeated transitions can accumulate duplicates. Create persistent services from one controlled root, and make duplicate detection explicit where needed.

Avoid letting application services retain scene components after unload. Use scene registration scopes that unbind during teardown. If a persistent service needs a current camera, express that as an optional scene binding with a clear validity period.

Prefab variants are useful for intentional differences such as enemy appearance and tuning. Long inheritance chains and broad overrides can make it hard to see the effective data. Review overrides when base prefabs change. Avoid editing a scene instance while assuming the shared prefab changed, or applying an override broadly without checking its other consumers.

For component references, serialize and validate required relationships, or discover them locally once if they remain stable. Searching the whole scene by a string name during every update couples behavior to authoring details and adds repeated work.

Unity asset identity depends on metadata. Preserve the corresponding `.meta` file when moving an asset under source control; losing it can regenerate its GUID and break references. Scene and prefab review should include missing scripts, accidental overrides, and unintended asset changes.

?? unity-persistent-manager Repeated scene transitions create multiple persistent audio managers. What is the architectural correction?
* Give persistent service creation one controlled owner and handle duplicate creation explicitly.
- Make every scene object persistent as well.
- Rename the manager on every transition.
- Delay creation by a random number of frames.
> Persistence does not establish uniqueness. A composition and lifetime policy must determine who creates the service.

?? unity-prefab-guid Why preserve an asset's `.meta` file when moving it?
* It carries identity information used by Unity references.
- It stores the current device frame rate.
- It replaces the need for the actual asset.
- It guarantees that every prefab override is intentional.
> Keeping metadata preserves the asset GUID. Regenerating identity can disconnect scene and prefab references.

## Serialization is a data contract {#unity-serialization}

For the Unity 6.0 baseline, Unity's ordinary serializer works primarily on eligible fields: public fields or fields marked `SerializeField`, with supported types and restrictions. It does not generally serialize arbitrary properties, static fields, dictionaries, or nested container shapes such as lists of lists through the ordinary rules. Custom wrappers or serialization callbacks can bridge unsupported representations. [Unity 6.0 serialization rules](https://docs.unity3d.com/6000.0/Documentation/Manual/script-serialization-rules.html) are the relevant baseline; later versions can change support.

Ordinary serializable managed classes are normally stored inline. Shared references can become distinct copies after serialization. `SerializeReference` supports managed-reference use cases such as polymorphism and shared references within a host's serialized graph, with additional restrictions and overhead. It does not turn arbitrary objects into globally shared assets.

For a runtime dictionary, a common authoring representation is a list of entries converted into a validated dictionary. Detect duplicate keys rather than silently letting the last one win. Preserve a stable serialized representation while using a runtime structure appropriate to lookup.

Field renaming can affect authored data. `FormerlySerializedAs` helps migrate a renamed Unity-serialized field; it does not automatically migrate a separate JSON save schema or every external content format. Type changes, removals, and managed-reference class moves require their own verification.

Validate content at authoring and build boundaries: nonempty IDs, unique keys, positive finite durations, valid references, and supported enum values. Runtime checks remain necessary for data that can arrive independently of that validation.

Distinguish Unity serialization from player persistence. Scene and prefab data describe shipped content. Player saves need explicit versions, migration, recovery, and ownership. Reusing a serializer does not supply those policies.

?? unity-serialization-version A Unity 6.0 project needs an Inspector-authored dictionary-like catalog. What is a robust baseline approach?
* Serialize supported entry data and build a validated runtime dictionary.
- Assume every .NET collection is automatically supported by Unity 6.0 serialization.
- Store progress in static fields and expect scene saves to preserve it.
- Use display names as unvalidated unique keys.
> Use the project's actual serialization rules. A supported entry list plus validation separates authoring representation from runtime lookup.

?? unity-field-migration Does `FormerlySerializedAs` automatically migrate an independently designed JSON player-save schema?
* No; that schema needs its own migration contract.
- Yes, including every remote service's records.
- Yes, but only if the HUD is open.
- No, because Unity cannot rename fields at all.
> The attribute concerns Unity-serialized field names. Other persistence formats have separate behavior and compatibility requirements.

## Destruction, Unity null, and cleanup {#unity-destruction}

A `UnityEngine.Object` has a managed wrapper and an engine-side object. After engine destruction, a wrapper can remain reachable while Unity's overloaded equality treats it as null. This differs from a literal null reference. [Unity's equality operator documentation](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Object-operator_eq.html) describes the distinction.

When a variable is typed as a Unity object, `obj == null` can use that engine-aware equality. `ReferenceEquals`, `is null`, and the null-conditional operator do not perform the same overloaded equality check. An `object` or interface-typed reference can also hide Unity-specific comparison behavior. Do not use a null-conditional call as proof that a destroyed engine object is still usable.

Use `OnDisable` to end an active binding when that matches the component's contract, and `OnDestroy` for destruction-related cleanup. Do not rely on destruction or application-quit callbacks as the only opportunity to persist important progress; mobile processes can disappear without an orderly shutdown.

`Destroy` is scheduled rather than immediate teardown at the call site. Code later in the same operation must still respect the object's logical lifetime. Mark the operation or owner inactive before broadcasting callbacks that could reenter it.

Pooled objects are usually disabled, not destroyed. Their return-to-pool cleanup must reset gameplay state, subscriptions, pending work, transforms, trails, and other feature-specific data. `OnDestroy` is therefore insufficient for a pool lease.

Cleanup should be idempotent. An explicit unbind followed by `OnDisable` should not double-release an owned asset or remove another owner's registration. Track ownership, not merely whether a reference is non-null.

?? unity-null-semantics A destroyed Unity object still has a managed wrapper. Which check can report it as null through Unity's overloaded semantics?
* `obj == null` when resolved against a Unity object type.
- Every `ReferenceEquals` call automatically.
- Every interface comparison automatically.
- Every null-conditional operator automatically.
> Unity overloads equality for its object types. Ordinary reference identity and null-conditional behavior do not use the same engine-object validity test.

?+ An interface variable refers to a component whose native Unity object was destroyed. Why can an ordinary interface null check be misleading?
* It can see a non-null managed reference without testing native-object validity.
- Interface assignment always destroys the underlying object.
- Destroyed components automatically become new objects.
- Every interface comparison calls Unity's Object equality overload.
> Declared types affect operator resolution. A still-reachable wrapper is not proof that its engine-side object is usable.

?? unity-pool-cleanup Why is `OnDestroy` alone insufficient for cleaning up a pooled projectile?
* Returning it to the pool may disable and reuse it without destroying it.
- Pooled objects can never subscribe to events.
- Destruction always runs once per rendered frame.
- Pooling removes every field automatically.
> A pool lease has its own lifetime. Cleanup must happen when that lease ends, even if the GameObject remains allocated.

## Editor conveniences can hide production bugs {#unity-editor-vs-player}

Fast Enter Play Mode options can disable domain reload. Under that setting, static fields and static event subscriptions can survive transitions into Play Mode unless explicitly reset. A system that works only after restarting the Editor has an initialization or cleanup problem. [Unity's domain reload guidance](https://docs.unity3d.com/6000.0/Documentation/Manual/domain-reloading.html) explains the reset responsibility.

Test repeated play sessions and the intended reload configurations. A runtime initialization hook can reset application statics as part of startup. Assign that reset to the owner of the state; clearing globals wherever a duplicate appears can conceal competing owners.

The Editor also differs from a player in asset availability, compilation backend, filesystem behavior, stripping, and performance overhead. Code using reflection can work in the Editor while required types are removed from a stripped player. Native integrations may not execute at all until the target-platform build runs.

Treat “works in Editor” as one piece of evidence. Validate on the target platform with the intended scripting backend, content build, and release-like settings. Capture build identity so a bug report refers to the exact code and content.

For an interview story, explain the difference that made the bug difficult. “It only failed on the second Play Mode entry because a static event retained a previous subscriber” is more informative than “Unity was behaving strangely.” Show the reproduction, root cause, fix, and regression check.

?? unity-domain-reload With domain reload disabled, which state needs deliberate reset?
* Static fields and static event subscriptions that must start fresh.
- Only the editor window size.
- Every imported texture file on disk.
- Nothing; entering Play Mode always reconstructs all managed state.
> Disabling domain reload changes the usual reset behavior. Static state and registrations can survive between play sessions.

?? unity-player-validation Why test a reflection-heavy feature in the intended player build?
* Backend and stripping behavior can differ from the Editor.
- The Editor guarantees all possible player configurations.
- Reflection only affects visual quality.
- A successful C# compile proves all runtime types are retained.
> Compilation success and Editor execution do not establish that a stripped target build contains every dynamically accessed type.
