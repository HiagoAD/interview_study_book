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

The safe instantiation order is short enough to keep in your head:

```csharp
public Coin Spawn(CoinDefinition definition, ICollectionOperation collection)
{
    // The prefab's root is inactive, so no lifecycle callback has run yet.
    var instance = Object.Instantiate(inactivePrefab, spawnPoint, Quaternion.identity);

    var coin = instance.GetComponent<Coin>();
    coin.Initialize(definition, collection, generation: nextGeneration++);

    instance.SetActive(true);   // Awake, then OnEnable, then Start run from here.
    return coin;
}
```

`Initialize` runs before `Awake`, which is exactly why this order is safe and also what makes it easy to get wrong. The method cannot read anything `Awake` was going to cache. Write it so it only stores what it was given, and let `Awake` do its own work afterward.

The callbacks themselves are easier to reason about as a table of guarantees rather than as a sequence, because the sequence depends on what else is in the scene:

| Callback | Runs | Does not guarantee |
| --- | --- | --- |
| Constructor | On managed construction | Any serialized value or engine API is usable |
| `Awake` | Once, when the instance becomes active | That any other object's `Awake` has run |
| `OnEnable` | Every time the component is enabled | That dependencies assigned after `Instantiate` are set |
| `Start` | Once, before the first update while enabled | That objects created later, or loaded asynchronously, exist |

Read the right-hand column when a bug appears. Almost every initialization defect in a Unity project is an assumption from that column being treated as a guarantee.

Exercise: For one prefab you spawn at runtime, write which of the four rows its dependencies actually need. If the answer is `Awake` and the caller assigns after `Instantiate`, you have found a latent ordering bug.

?? unity-awake-order Why is reading another component's initialized runtime state in `Awake` fragile?
* The other object's `Awake` may not have run yet.
- `Awake` runs before serialized values are applied to the component.
- Script Execution Order settings are ignored during `Awake`.
- `Awake` runs on the loading thread rather than the main thread.
- Reading another component in `Awake` forces a scene-wide search.
> Another object's `Awake` may not have run yet. Initialize dependencies in an explicit order, and give callers a way to know when they are ready.

?+ A component's active prefab uses a dependency in OnEnable, but the factory assigns that dependency after Instantiate returns. What is the hazard?
* OnEnable can execute before the factory's assignment.
- `Instantiate` defers activation to the end of the frame, so the assignment lands first.
- The dependency is copied from the prefab asset, so the factory's value is ignored.
- `OnEnable` runs twice on an instantiated object, so the second call sees the value.
- The component stays disabled until `Start`, which runs after the factory returns.
> An active prefab can run `OnEnable` before `Instantiate` returns. Supply the dependency beforehand, or keep the component from using it until initialization is complete.

?? unity-inactive-factory A factory instantiates an inactive prefab and calls `Initialize` before activation. What must `Initialize` account for?
* `Awake` may not yet have run, so its cached fields may not exist.
- `OnEnable` has already run, so its subscriptions are in place.
- Serialized references are cleared while the object is inactive.
- The object's transform cannot be set until it is activated.
- `Initialize` runs against a copy, so its assignments are lost on activation.
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

The mechanism behind that scheduling is an accumulator, and knowing it turns several confusing symptoms into one explanation:

```text
accumulator += min(deltaTime, maximumDeltaTime)
while accumulator >= fixedDeltaTime:
    accumulator -= fixedDeltaTime
    run one FixedUpdate
```

The clamp in the first line is the part most worth knowing. Without it, a frame that took 2 seconds would queue enough fixed steps to make the next frame even slower, which would queue more steps again. Unity bounds the time fed into the accumulator with `Time.maximumDeltaTime`, whose default is one third of a second, so the catch-up work per frame has a ceiling.

That ceiling has a consequence you should be able to state: under sustained load, simulation time falls behind real time rather than the game freezing. A physics object does not teleport to where it “should” be; it simply advanced fewer steps. For gameplay this is usually the behavior you want. For anything measured against a wall clock, such as a seasonal deadline, it is a reason not to derive that deadline from accumulated simulation time.

The same reasoning explains why raising the target frame rate does not make physics more accurate, and why lowering `fixedDeltaTime` to 0.005 to “improve” collisions can make a heavily loaded scene worse: each rendered frame now has up to sixty-six fixed steps available to run before the clamp stops it.

Exercise: With a fixed timestep of 0.02 and a frame that took 0.5 seconds, work out how many `FixedUpdate` calls run and how far simulation time now lags real time.

?? unity-fixed-frequency At a high rendering frame rate, how many `FixedUpdate` calls can occur in one rendered frame?
* Zero, one, or more, according to accumulated simulation time.
- One, matched to each rendered frame.
- One for each Rigidbody currently in the scene.
- As many as the accumulated time requires, with no upper bound.
- The rendering rate divided by the physics rate, rounded up.
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

One controlled owner is easier to build than the guard people usually reach for. The common attempt is for each manager to check whether another already exists and destroy itself, which puts the creation rule inside every copy and still runs `Awake` on the duplicate before it dies. Prefer a bootstrap scene, or a single initialization entry point, that creates each persistent service exactly once and is the only place those objects appear:

```text
Boot scene loads.
  Composition root creates the audio service, settings, and platform adapter.
  Each is marked to survive scene changes, by that root and nowhere else.
  The root loads the first gameplay scene.
Gameplay scenes contain no persistent services, so no duplicate can be created.
```

The invariant is now structural: a duplicate cannot appear, because no other scene contains one to instantiate. That is a stronger position than detecting duplicates at runtime.

Additive loading needs its shutdown order stated as deliberately as its load order. When two scenes are unloaded, decide which one owned the active camera, the audio listener, and the input bindings, and what happens to them in the gap before the next scene provides replacements. A frame with no audio listener or two of them is a common and confusing symptom whose cause is entirely in the teardown order.

Exercise: List every persistent object in a project you know and name the single place each is created. Any object with two creation sites is a duplicate waiting for an unusual transition.

?? unity-persistent-manager Repeated scene transitions create multiple persistent audio managers. What is the architectural correction?
* Give persistent service creation one controlled owner and handle duplicate creation explicitly.
- Have each manager destroy itself in `Awake` when it finds an existing instance.
- Look the manager up by tag before creating one, and reuse whatever is found.
- Keep a manager in every scene, so a transition always has one available.
- Create the manager lazily, the first time audio is requested.
> Keeping an object across scenes does not prevent another scene from creating a duplicate. Assign one owner to create and manage the persistent service.

?? unity-prefab-guid Why preserve an asset's `.meta` file when moving it?
* It carries identity information used by Unity references.
- It records the asset's position in the Project window.
- It holds a copy of the asset, used to restore it after a failed import.
- It lists the scenes and prefabs that reference the asset.
- It stores the modification time that source control compares against.
> Keeping metadata preserves the asset GUID. Regenerating identity can disconnect scene and prefab references.

## Serialization is a data contract {#unity-serialization}

In Unity 6.0, the ordinary serializer primarily saves eligible fields: public fields or fields marked `SerializeField`, using supported types and restrictions. It generally does not save arbitrary properties, static fields, dictionaries, or nested containers such as lists of lists. Wrappers or serialization callbacks can convert unsupported data into a supported representation. Check the [Unity 6.0 serialization rules](https://docs.unity3d.com/6000.0/Documentation/Manual/script-serialization-rules.html) for this book's baseline; support may differ in later versions.

Unity normally stores ordinary serializable managed classes inline. As a result, references to one shared object can become separate copies after serialization. `SerializeReference` supports cases such as polymorphism and shared managed references within one host's serialized data. It has restrictions and overhead, and does not make those objects globally shared assets.

A catalog can be authored as a list of entries, then converted to a dictionary at runtime. Validate the conversion: duplicate keys should produce an error instead of silently replacing an earlier entry. This keeps the saved format stable while giving runtime code a structure suited to lookups.

Renaming a field can affect data already saved in scenes or assets. `FormerlySerializedAs` helps Unity migrate a renamed serialized field. A separate JSON save format or external content format still needs its own migration. Also verify type changes, removed fields, and class moves involving managed references.

Validate content when it is authored and again when the build consumes it. Check for empty or duplicate IDs, invalid references, unsupported enum values, and durations that are not positive and finite. Keep runtime checks for data that can arrive without going through those validation steps.

Separate authored Unity data from player saves. Scenes and prefabs describe content shipped with the game. Player progress also needs versioning, migration, failure recovery, and a clear owner. Choosing a serializer does not supply those policies.

The conversion from authored list to runtime lookup is worth writing once, because the validation is the point of it:

```csharp
public Dictionary<string, PowerUpDefinition> BuildCatalog(IReadOnlyList<Entry> entries)
{
    var catalog = new Dictionary<string, PowerUpDefinition>(entries.Count, StringComparer.Ordinal);
    foreach (var entry in entries)
    {
        if (string.IsNullOrWhiteSpace(entry.Id))
            throw new ContentException($"Entry {entry.name} has no id.");
        if (catalog.ContainsKey(entry.Id))
            throw new ContentException($"Duplicate id '{entry.Id}'.");
        catalog.Add(entry.Id, entry.ToDefinition());
    }
    return catalog;
}
```

Using `catalog[entry.Id] = ...` instead of the check and `Add` would make a duplicate ID silently keep the last entry. The author would see one of their two power-ups quietly stop existing, with nothing in the log to explain it. The explicit comparer matters for the same reason as in the equality section: an ID lookup must not depend on the device's language settings.

Run this conversion where a failure is cheap. An import step or a build-time validation reports the problem to the author with the asset name attached. The same exception thrown during a player's run reports it to nobody useful.

Exercise: Find one place in your project where authored data becomes a runtime lookup. Check what it does with a duplicate key, and whether anyone would notice.

?? unity-serialization-version A Unity 6.0 project needs an Inspector-authored dictionary-like catalog. What is a reliable starting approach?
* Serialize supported entry data and build a validated runtime dictionary.
- Mark the dictionary field `SerializeField`, which enables dictionary support.
- Keep the catalog in a static dictionary populated from a scene object.
- Serialize the catalog as a list of lists, one per key group.
- Apply `SerializeReference` to the dictionary so its entries keep their types.
> Use the project's actual serialization rules. A supported entry list plus validation separates authoring representation from runtime lookup.

?? unity-field-migration Does `FormerlySerializedAs` automatically migrate an independently designed JSON player-save schema?
* No; that schema needs its own migration contract.
- Yes, because the attribute rewrites any serialized field name it finds.
- Yes, provided the JSON uses the same field names as the component.
- Yes, once the save file is regenerated by the current build.
- No, because the attribute applies to scene files rather than to fields.
> The attribute concerns Unity-serialized field names. Other persistence formats have separate behavior and compatibility requirements.

## Destruction, Unity null, and cleanup {#unity-destruction}

A `UnityEngine.Object` has a managed wrapper and an engine-side object. After engine destruction, a wrapper can remain reachable while Unity's overloaded equality treats it as null. This differs from a literal null reference. [Unity's equality operator documentation](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Object-operator_eq.html) describes the distinction.

For a variable typed as a Unity object, `obj == null` can use Unity's check for an engine object that has been destroyed. `ReferenceEquals`, `is null`, and the null-conditional operator do not use that overloaded equality check. A reference typed as `object` or an interface can hide the Unity-specific behavior too. A non-null managed reference therefore does not prove that the engine object is still usable.

Use `OnDisable` to end a subscription or binding when it should last only while the component is enabled. Use `OnDestroy` for cleanup tied to destruction. Save important progress before shutdown, though: a mobile process can disappear without a destruction or application-quit callback.

`Destroy` schedules destruction; it does not tear down the object immediately at that line of code. Later code in the same operation must still recognize that the object is logically finished. Mark its owner or operation inactive before notifying callbacks that could call back into it.

Returning an object to a pool usually disables it for reuse, without destroying it. Clean up when that use of the object ends: reset gameplay state, subscriptions, pending work, transforms, trails, and any other feature data. `OnDestroy` alone cannot provide that cleanup.

Cleanup should be safe to repeat. If an explicit unbind is followed by `OnDisable`, the second call must not release an asset again or remove another owner's registration. Track which resources and registrations this owner still holds; a non-null reference alone is not enough.

Two details about destruction timing complete the picture.

`Destroy` is deferred, and Unity documents the delay as occurring after the current frame's update phase and before rendering. So within the rest of the method that called it, and within every callback that runs before that boundary, the object is still fully alive: components respond, `Update` may still run, and a comparison against null still reports the object as present. Code that calls `Destroy` and then assumes the object is gone is reading the next frame's state one frame early.

`DestroyImmediate` removes the object at that line, and Unity's guidance is to treat it as editor tooling rather than a runtime shortcut. In play mode it can destroy an object while the engine or another script is still iterating the structure that contains it. If a runtime path seems to need it, the real requirement is usually that some other object should stop referring to the target now, which is a question about ownership and unsubscription rather than about destruction timing.

Note that destroying a GameObject destroys its components and children, while destroying a component leaves the GameObject and its other components in place. Both appear in the same profiler entries and both produce a wrapper that compares equal to null, so state which one you intended when describing a cleanup path.

Exercise: In a system you have written, find a `Destroy` call and name every object that still holds a reference to the target at the moment the call returns.

?? unity-null-semantics A destroyed Unity object still has a managed wrapper. Which check can report it as null using Unity's overloaded equality operator?
* `obj == null` when resolved against a Unity object type.
- `ReferenceEquals(obj, null)`, which the engine overrides for its object types.
- `obj is null`, because pattern matching consults the declared type's operators.
- `obj?.name`, which yields null once the engine object has been destroyed.
- `object.Equals(obj, null)`, which dispatches to Unity's comparison.
> Unity overloads equality for its object types. Ordinary reference identity and null-conditional behavior do not use the same engine-object validity test.

?+ An interface variable refers to a component whose native Unity object was destroyed. Why can an ordinary interface null check be misleading?
* It can see a non-null managed reference without testing native-object validity.
- The interface reference is set to null when the engine object is destroyed.
- Casting back to the component type clears the managed wrapper.
- The check runs against a copy of the reference taken at assignment.
- The interface call throws before the null check can run.
> The variable's declared type determines which equality operator is used. An interface can still hold the managed wrapper after Unity has destroyed the engine object.

?? unity-pool-cleanup Why is `OnDestroy` alone insufficient for cleaning up a pooled projectile?
* Returning it to the pool may disable and reuse it without destroying it.
- Disabling a GameObject raises `OnDestroy` on each of its components.
- `OnDestroy` runs before the component's fields can be read.
- A pooled object is destroyed and recreated on each checkout.
- `OnDestroy` runs on the pool rather than on the object it manages.
> Each use of a pooled object has its own lifetime. Clean it up when it returns to the pool, even though the GameObject remains allocated.

## Editor conveniences can hide production bugs {#unity-editor-vs-player}

Fast Enter Play Mode can disable domain reload. With that option enabled, static fields and static event subscriptions can survive between Play Mode sessions unless the code resets them. If a feature only works after restarting the Editor, investigate its initialization and cleanup. [Unity's domain reload guidance](https://docs.unity3d.com/6000.0/Documentation/Manual/domain-reloading.html) explains the reset responsibility.

Test repeated Play Mode sessions with the reload settings the project intends to use. A runtime initialization hook can reset static application state during startup. Give that job to the state's owner. Clearing globals wherever a duplicate appears can hide the fact that several objects are trying to own the same state.

A player build can differ from the Editor in available assets, compilation backend, filesystem behavior, code stripping, and performance overhead. Reflection may work in the Editor but fail in a player where the required types were stripped. Native integrations may only run in a build for the target platform.

Treat “works in Editor” as one part of validation. Also test on the target platform with the intended scripting backend, content build, and settings close to release. Record the build identity, so bug reports can be traced to the exact code and content.

For an interview story, explain the difference that made the bug difficult. “It only failed on the second Play Mode entry because a static event retained a previous subscriber” is more informative than “Unity was behaving strangely.” Show the reproduction, root cause, fix, and regression check.

The reset hook mentioned above has a name worth carrying:

```csharp
[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
private static void ResetStatics()
{
    activeRun = null;
    Changed = null;    // Clearing a static event drops subscribers from the last session.
}
```

`SubsystemRegistration` runs early enough to be useful, before the first scene loads. Put the method on the type that owns the state, next to the fields it clears, so the reset is maintained by whoever adds the next static field. A single global reset routine that reaches into other types drifts out of date the first time someone adds a field and does not know the routine exists.

The deeper point is that this hook is a repair, not a design. Each static field it has to clear is a piece of state with no owner and no lifetime. Where the state can instead live on an object the composition root creates at startup, the problem disappears: a new session constructs a new object, and there is nothing to reset. Reach for the attribute for the statics you cannot remove, and treat a growing reset method as a signal about ownership.

Exercise: Turn off domain reload in a project you know, enter and exit play mode three times, and note the first thing that behaves differently on the second run. That behavior names your unowned state.

?? unity-domain-reload With domain reload disabled, which state needs deliberate reset?
* Static fields and static event subscriptions that must start fresh.
- Serialized fields on scene components, which keep the values from the last session.
- Instance fields on MonoBehaviours, which are reused between play sessions.
- The scene hierarchy, which is not reloaded when the domain is skipped.
- Compiled assemblies, which have to be reloaded before each session.
> Disabling domain reload changes the usual reset behavior. Static state and registrations can survive between play sessions.

?? unity-player-validation Why test a reflection-heavy feature in the intended player build?
* Backend and stripping behavior can differ from the Editor.
- Reflection is disabled in the Editor and enabled in player builds.
- The Editor resolves types lazily, so a missing type surfaces later.
- Player builds keep a separate reflection cache that has to be warmed.
- Player builds resolve types on a worker thread, which changes the result.
> Compilation success and Editor execution do not establish that a stripped target build contains every dynamically accessed type.
