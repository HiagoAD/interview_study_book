---
book: Unity Game Engineering
chapter: 06: Unity lifecycle, scenes, prefabs, and serialization
---

## Initialize objects without accidental execution-order dependencies {#unity-initialization}

Unity controls when component lifecycle methods run. Construct ordinary C# models with `new`, but create MonoBehaviours through GameObjects and Unity's component APIs. A component constructor should not depend on serialized scene values or call engine APIs.

On an active GameObject, `Awake` initializes the script instance and can run even if that component is disabled. If the GameObject starts inactive, `Awake` waits until activation. `OnEnable` runs when the component is enabled and its GameObject is active. `Start` runs once, before the component's first update while enabled. Do not assume another object's `Awake` has already run when yours begins. [Unity's Awake reference](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/monobehaviour/awake) details these conditions.

Use `Awake` for setup the component can complete on its own. If setup depends on other objects being ready, connect and initialize those objects explicitly. `Start` can help with ordinary scene startup, but it does not mean every possible dependency is ready: some objects may still be inactive, created later, or waiting for asynchronous work.

Put startup dependencies in order before enabling interaction:

```text
Load and validate definitions
Open or recover player state
Construct the feature models
Bind scene adapters
Mark the run ready
Enable player interaction
```

If startup can wait or fail, represent those states explicitly. Checking for a null dependency on every `Update` and trying again leaves the rest of the code without a clear way to know when initialization has succeeded.

Instantiation has the same ordering risk. An active prefab can run lifecycle callbacks before the caller assigns its dependencies. You can instantiate an inactive prefab and initialize it before activation, wait for an explicit binding call before using dependencies, or supply all required references in the prefab. With an inactive prefab, remember that your initialization method may run before `Awake`; it cannot assume `Awake` has already cached fields.

Script Execution Order can coordinate known script types, but a long ordering list can hide how the systems depend on each other. If one subsystem needs another to be ready, express that requirement in the startup sequence.

?? unity-awake-order Why is reading another component's initialized runtime state in `Awake` fragile?
* The other object's `Awake` may not have run yet.
- `Awake` always runs on a background thread.
- Serialized references are forbidden in MonoBehaviours.
- `Start` is guaranteed to run before every `Awake`.
> Another object's `Awake` may not have run yet. Initialize dependencies in an explicit order, and give callers a way to know when they are ready.

?+ A component's active prefab uses a dependency in OnEnable, but the factory assigns that dependency after Instantiate returns. What is the hazard?
* OnEnable can execute before the factory's assignment.
- Instantiate guarantees that all later factory assignments run first.
- OnEnable cannot execute on an instantiated object.
- A serialized reference automatically substitutes for any unassigned interface.
> An active prefab can run `OnEnable` before `Instantiate` returns. Supply the dependency beforehand, or keep the component from using it until initialization is complete.

?? unity-inactive-factory A factory instantiates an inactive prefab and calls `Initialize` before activation. What must `Initialize` account for?
* `Awake` may not yet have run, so its cached fields may not exist.
- `Start` has necessarily finished already.
- Inactive objects cannot hold serialized references.
- Activation automatically injects every interface dependency.
> Keeping the prefab inactive delays callbacks. Its explicit initialization method must therefore work even if `Awake` has not run.

## Update, fixed simulation, and time domains {#unity-update-time}

`Update` runs with rendered frames; `FixedUpdate` runs with fixed simulation steps. One rendered frame may contain zero, one, or several fixed updates. A higher rendering rate does not make physics run once per frame, and a slow frame can require extra simulation steps to catch up. [Unity's fixed-update explanation](https://docs.unity.com/en-us/engine/6000.6/manual/scripting/managing-time-and-frame-rate/fixed-updates) describes this scheduling.

Capture input when the selected input system processes it, then pass the command to the simulation at a defined point. A button press that is visible for only one frame can be missed or mishandled if you read it only in a fixed loop running on a different schedule. Check the Input System's update mode and action configuration when choosing where to read it.

For simple motion outside physics, displacement is velocity multiplied by elapsed simulation time. For an object controlled by physics, use the appropriate Rigidbody API at the appropriate simulation step. Arbitrary transform changes can conflict with the solver. Rigidbody interpolation smooths the displayed motion between simulation states; it does not make the physics more accurate.

Use `LateUpdate` for work that should follow ordinary frame updates, such as a camera following a character moved through its transform. Multiple scripts using `LateUpdate` still need an explicit ordering rule if one depends on another.

Separate time domains:

| Domain | Suitable use | Important limitation |
| --- | --- | --- |
| Scaled gameplay time | Effects and gameplay animation affected by pause | Stops or slows with the game's time policy |
| Unscaled elapsed time | Pause-menu animation and local timeout display | Not a trusted online deadline |
| Monotonic elapsed time | Measuring durations | Not a calendar date |
| UTC instant | Event availability and persisted timestamps | Device wall time can change or be manipulated |

Setting `timeScale` to zero stops only the work that follows scaled time. Tasks, network callbacks, and unscaled animation may continue. Define what pause means for input, simulation, UI, and audio, then test each part.

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

A scene groups authored objects and often determines when they are loaded and unloaded. A prefab defines a reusable hierarchy of objects. These tools help organize ownership, but the gameplay code still needs to specify who is allowed to change each piece of state.

A bootstrap scene can own application services, while gameplay scenes own cameras, level objects, and adapters for a run. Additive loading lets several scenes stay loaded together. The team then needs to decide which scene controls lighting, input, and the active camera, as well as the order in which those systems shut down.

`DontDestroyOnLoad` keeps objects across scene changes; it does not decide who should create them or how many should exist. If each scene creates its own persistent manager, scene transitions can accumulate duplicates. Create persistent services from one controlled entry point, and detect duplicate creation where necessary.

Release references to scene components when the scene unloads. A scene can register its components with an application service, then remove those registrations during teardown. If a persistent service needs the current camera, treat that reference as an optional scene binding that is valid only while the scene provides it.

Prefab variants work well for intentional differences in appearance or tuning. Long variant chains and many overrides can make the final values hard to understand. Review overrides when a base prefab changes. Also check where an edit is being applied: changing a scene instance does not necessarily change the shared prefab, and applying an override to the prefab can affect other instances.

Serialize and validate required component references, or discover them locally once if the relationship stays stable. Searching the entire scene by name during every update repeats work and makes gameplay depend on authoring details such as object names.

Keep an asset's `.meta` file with it when moving it under source control. That metadata contains its identity; losing it can create a new GUID and break references. When reviewing scene and prefab changes, check for missing scripts, unintended overrides, and unrelated asset edits.

?? unity-persistent-manager Repeated scene transitions create multiple persistent audio managers. What is the architectural correction?
* Give persistent service creation one controlled owner and handle duplicate creation explicitly.
- Make every scene object persistent as well.
- Rename the manager on every transition.
- Delay creation by a random number of frames.
> Keeping an object across scenes does not prevent another scene from creating a duplicate. Assign one owner to create and manage the persistent service.

?? unity-prefab-guid Why preserve an asset's `.meta` file when moving it?
* It carries identity information used by Unity references.
- It stores the current device frame rate.
- It replaces the need for the actual asset.
- It guarantees that every prefab override is intentional.
> Keeping metadata preserves the asset GUID. Regenerating identity can disconnect scene and prefab references.

## Serialization is a data contract {#unity-serialization}

In Unity 6.0, the ordinary serializer primarily saves eligible fields: public fields or fields marked `SerializeField`, using supported types and restrictions. It generally does not save arbitrary properties, static fields, dictionaries, or nested containers such as lists of lists. Wrappers or serialization callbacks can convert unsupported data into a supported representation. Check the [Unity 6.0 serialization rules](https://docs.unity3d.com/6000.0/Documentation/Manual/script-serialization-rules.html) for this book's baseline; support may differ in later versions.

Unity normally stores ordinary serializable managed classes inline. As a result, references to one shared object can become separate copies after serialization. `SerializeReference` supports cases such as polymorphism and shared managed references within one host's serialized data. It has restrictions and overhead, and does not make those objects globally shared assets.

A catalog can be authored as a list of entries, then converted to a dictionary at runtime. Validate the conversion: duplicate keys should produce an error instead of silently replacing an earlier entry. This keeps the saved format stable while giving runtime code a structure suited to lookups.

Renaming a field can affect data already saved in scenes or assets. `FormerlySerializedAs` helps Unity migrate a renamed serialized field. A separate JSON save format or external content format still needs its own migration. Also verify type changes, removed fields, and class moves involving managed references.

Validate content when it is authored and again when the build consumes it. Check for empty or duplicate IDs, invalid references, unsupported enum values, and durations that are not positive and finite. Keep runtime checks for data that can arrive without going through those validation steps.

Separate authored Unity data from player saves. Scenes and prefabs describe content shipped with the game. Player progress also needs versioning, migration, failure recovery, and a clear owner. Choosing a serializer does not supply those policies.

?? unity-serialization-version A Unity 6.0 project needs an Inspector-authored dictionary-like catalog. What is a reliable starting approach?
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

For a variable typed as a Unity object, `obj == null` can use Unity's check for an engine object that has been destroyed. `ReferenceEquals`, `is null`, and the null-conditional operator do not use that overloaded equality check. A reference typed as `object` or an interface can hide the Unity-specific behavior too. A non-null managed reference therefore does not prove that the engine object is still usable.

Use `OnDisable` to end a subscription or binding when it should last only while the component is enabled. Use `OnDestroy` for cleanup tied to destruction. Save important progress before shutdown, though: a mobile process can disappear without a destruction or application-quit callback.

`Destroy` schedules destruction; it does not tear down the object immediately at that line of code. Later code in the same operation must still recognize that the object is logically finished. Mark its owner or operation inactive before notifying callbacks that could call back into it.

Returning an object to a pool usually disables it for reuse, without destroying it. Clean up when that use of the object ends: reset gameplay state, subscriptions, pending work, transforms, trails, and any other feature data. `OnDestroy` alone cannot provide that cleanup.

Cleanup should be safe to repeat. If an explicit unbind is followed by `OnDisable`, the second call must not release an asset again or remove another owner's registration. Track which resources and registrations this owner still holds; a non-null reference alone is not enough.

?? unity-null-semantics A destroyed Unity object still has a managed wrapper. Which check can report it as null using Unity's overloaded equality operator?
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
> The variable's declared type determines which equality operator is used. An interface can still hold the managed wrapper after Unity has destroyed the engine object.

?? unity-pool-cleanup Why is `OnDestroy` alone insufficient for cleaning up a pooled projectile?
* Returning it to the pool may disable and reuse it without destroying it.
- Pooled objects can never subscribe to events.
- Destruction always runs once per rendered frame.
- Pooling removes every field automatically.
> Each use of a pooled object has its own lifetime. Clean it up when it returns to the pool, even though the GameObject remains allocated.

## Editor conveniences can hide production bugs {#unity-editor-vs-player}

Fast Enter Play Mode can disable domain reload. With that option enabled, static fields and static event subscriptions can survive between Play Mode sessions unless the code resets them. If a feature only works after restarting the Editor, investigate its initialization and cleanup. [Unity's domain reload guidance](https://docs.unity3d.com/6000.0/Documentation/Manual/domain-reloading.html) explains the reset responsibility.

Test repeated Play Mode sessions with the reload settings the project intends to use. A runtime initialization hook can reset static application state during startup. Give that job to the state's owner. Clearing globals wherever a duplicate appears can hide the fact that several objects are trying to own the same state.

A player build can differ from the Editor in available assets, compilation backend, filesystem behavior, code stripping, and performance overhead. Reflection may work in the Editor but fail in a player where the required types were stripped. Native integrations may only run in a build for the target platform.

Treat “works in Editor” as one part of validation. Also test on the target platform with the intended scripting backend, content build, and settings close to release. Record the build identity, so bug reports can be traced to the exact code and content.

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
