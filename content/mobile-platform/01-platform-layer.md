---
book: unity-mobile-platform-engineering
title: The Platform Layer
chapter: 01: The platform layer and the call path
---

## How to study the platform layer {#platform-study-method}

This book is about the code between a Unity game and the platforms it ships on. A live mobile game signs the player in through a platform account, sells items through a store, receives push notifications, opens from links, reports analytics and crashes, reads remote configuration, and talks to its own backend. Behind each of those sit native bridges on Android and iOS, operating-system features, third-party SDKs, two build pipelines, backend clients, and a CI system that builds the result. A platform team owns that layer, and interviews for platform roles spend most of their time on it.

One operation's path through the layer reads from top to bottom:

```text
game code
  -> game-owned interface
  -> adapter
  -> bridge (JNI or P/Invoke)
  -> native SDK
  -> OS
  -> network
  -> backend
```

A purchase starts as a call in gameplay code and reaches an interface the game owns. An adapter translates it for the store's SDK, and a bridge carries it from C# into Java or Objective-C: [[JNI]] on Android, [[P/Invoke]] on iOS. The SDK asks the operating system to show the store's purchase sheet, the payment travels over the network, and a backend validates the receipt. The answer comes back along the same path, usually on a different thread from the one that asked.

Each layer can give you its own evidence, and a symptom rarely says which one to ask:

| Layer | Evidence it can give you |
| --- | --- |
| Game code | C# logs and exceptions, and the state the player saw |
| Interface and adapter | What went in, what came back, and how the adapter mapped it |
| Bridge | Which call crossed, with which arguments, on which thread |
| Native SDK | Its own log lines, error codes and version |
| Operating system | Device logs, crash reports, and permission and lifecycle state |
| Network | Captured requests and responses, with their timings |
| Backend | Server logs and records, joined to the client by an operation id |

“The purchase never arrived” can start in any row. What this book practises is choosing the row whose evidence splits the possibilities, and looking there first; chapter 12 turns that into a method for the whole path.

The topics do not carry equal weight in an interview for a Unity mobile platform role. This table lists them from heaviest to lightest, with the chapters that cover each:

| Interview theme | Chapters |
| --- | --- |
| Native Android and iOS integration | 2–4, with crash evidence in 2 and 3 |
| Third-party SDK integration | 7, building on 1, 5 and 6 |
| Build and release pipeline | 5, 6 and 10 |
| Backend and API clients | 8 and 9 |
| Debugging across boundaries | 12, which uses everything before it |
| C# architecture at the boundary | 1 |
| CI/CD and Jenkins | 11 |
| Interview practice | 13 |

The book assumes Unity and C# at the level of *The Game Layer*, the first book on this site. Where a section builds on that book, it recaps what it needs in a paragraph and names the chapter, so this one can be read on its own. It assumes little hands-on experience with Gradle, Xcode, native plugins or CI. It teaches enough Java and Objective-C to read and write a thin bridge, and it goes as deep as an interview for a platform role goes: mechanisms, decisions, and debugging across the boundary, well short of Android or iOS app development.

The reference is Unity 6.3 LTS (6000.3.11f1) with the Android toolchain that Editor installs, which is OpenJDK 17, Gradle 8.13, the Android SDK platforms up to API level 36, and NDK r27c, together with Xcode 27.0 and the iOS 27.0 SDK. They were checked in September 2026. Platform rules move faster than engines: a required target API level, a store policy or a quota can change within a year. The text gives such a fact with the version or date it was checked against, and the questions test the mechanism behind it rather than the figure, because the review queue repeats a question for a month and more and should not go on teaching a number after it has changed.

The examples follow one imaginary live game with the integrations a platform team maintains: sign-in, purchases, push notifications, deep links, analytics, crash reporting, remote configuration, and its own backend. Its genre does not matter and is never named. The requirements are invented for the exercises, and the book makes no claims about the internals of any commercial game.

When an interviewer asks how you would integrate an SDK, the method calls are the part the vendor's documentation already gives you. The answer has to cover what the documentation leaves to you:

| Topic | What the answer says |
| --- | --- |
| Threads | Which thread each callback arrives on, and how its result reaches the main thread |
| Lifecycle | What happens when the app pauses, is killed in the background, or is launched by the SDK's own event |
| Permissions and privacy | What the SDK asks the player for, what it collects, and whether consent comes first |
| Build impact | Its dependencies, manifest and `Info.plist` entries, binary size, and minimum OS versions |
| Rollout | How it ships behind a switch, and what the team watches while it does |
| Verification | Which tests, devices and production signals show that it works |

When the question reaches a platform detail you have not met, say so and say how you would find out, as the first book's opening chapter advises: “I have not shipped that SDK. I would read the documentation for the version we use and confirm on a device with a log line in each callback.” That answer shows the listener how you work. A confident guess shows them something worse.

Exercise: Draw the call path for one integration you know, from the gameplay call to the backend. Under each layer, write one piece of evidence that layer could give you, and mark the ones you have looked at in practice.

?? platform-call-path A player was charged for a purchase that never appeared in the game. Which evidence shows whether the store SDK reported the purchase to the game?
* The adapter's log of what the SDK reported and what the adapter returned
- The store console's order record, which shows that the charge went through
- The backend's validation log, which lists the receipts the client submitted
- The gameplay log of inventory changes made after the purchase screen closed
- A crash report from the session in which the player made the purchase
> The adapter sits between the SDK and the game, so its record of what arrived and what it returned is the evidence at that boundary. The store's order record proves the charge, and the backend's log proves what reached the server; neither shows what the SDK told the game.

?+ The backend sent a push notification and the push provider accepted it, but the player's phone never showed it. Which evidence shows whether the phone received it?
* The device log from the system and the push SDK at that time
- The backend's send log, which records the provider's success response for that message
- The provider's response to the send, which returned a message id
- The game's log from its notification handler during that session
- The analytics count of notifications the player opened that day
> The provider accepting a message happens before delivery to the device, so the backend's and the provider's records stop at the network. The device's own log shows whether the message arrived and what the system did with it. The game's handler runs after the app has the notification, so it says nothing about one that never arrived.

?? platform-integration-scope An answer to “how would you integrate a crash-reporting SDK” names its initialization call and its API for custom keys. What should it cover next?
* Its callback threads, when it starts relative to consent, and what it adds to the build
- The rest of the SDK's public methods, including those the game will not call
- The vendor's sample project, adapted so that its scene loads inside the game
- The dashboard settings the vendor recommends for grouping crashes by version
- A wrapper that gives each of the SDK's methods a game-owned name for gameplay to call
> An integration is judged by what the documentation leaves to you: threads, start-up order and consent, build impact, rollout and verification. More of the API adds little, and a wrapper that mirrors each vendor method keeps the vendor's model in gameplay.

?+ Which question belongs to an SDK integration rather than to the SDK's API documentation?
* What the game does with a callback that outlives its screen
- Which parameters the initialization method accepts and what their defaults are
- Which method records a custom event, and how many parameters one event can carry
- Which enum values the SDK uses to report the outcome of a request
- How the SDK's sample code configures logging before it initializes
> The documentation describes the SDK's calls. What happens on the game's side of the boundary, such as a callback that arrives after its owner is gone, is a decision the integration makes and writes down.

## Own the interface: adapters and facades at the SDK boundary {#platform-interfaces}

The game starts from what it needs. It writes each capability as an interface in its own vocabulary: analytics becomes `IAnalytics` with `Track(GameEvent)`, sign-in becomes `IAuthService` with `SignInAsync`, and purchases become `IPurchaseService` with `BuyAsync`. No vendor type appears in those signatures, and none appears in the assemblies that hold gameplay: no vendor enum, exception, callback interface, handle or configuration object.

```csharp
// Game-owned: the vocabulary gameplay uses.
public enum PurchaseStatus { Succeeded, Cancelled, Unavailable, Failed, Unknown }

public interface IPurchaseService
{
    Task<PurchaseResult> BuyAsync(ProductId product, CancellationToken cancel);
}

// In the adapter's assembly, the one place that names the vendor.
// VendorCode stands for whatever the store SDK reports.
internal static class PurchaseMapping
{
    public static PurchaseStatus ToStatus(VendorCode code) => code switch
    {
        VendorCode.Ok => PurchaseStatus.Succeeded,
        VendorCode.UserCancelled => PurchaseStatus.Cancelled,
        VendorCode.BillingUnavailable => PurchaseStatus.Unavailable,
        VendorCode.NetworkError => PurchaseStatus.Unknown, // The charge may have gone through.
        _ => PurchaseStatus.Failed,
    };
}
```

Two patterns meet in that wrapper. An adapter converts one interface into the one a caller expects: the SDK reports a purchase through its own callback and codes, and the adapter turns that into a `PurchaseResult`. A facade puts a small interface in front of a large subsystem: the SDK exposes product queries, transaction queues, receipt formats and dozens of options, and the game needs a handful of operations. A wrapper around an SDK is usually both. Domain-driven design has a name for the aim, an anti-corruption layer: the vendor's model of a purchase stays on the vendor's side, and the game's model, a product and an outcome, stays on the game's.

The adapter is where three kinds of mapping live, so each has one place to be written, reviewed and tested:

| Mapping | What the adapter decides |
| --- | --- |
| Results | Which vendor codes mean succeeded, cancelled, unavailable, failed or unknown; a code that cannot tell success from failure maps to unknown |
| Errors | Which game category each failure belongs to, such as retry later, needs the player, configuration defect, or unknown |
| Threads | Which thread the game's result arrives on, whichever thread the SDK called back on |

A boundary that exists only as a folder name erodes one convenient import at a time. [[Assembly definition|Assembly definitions]] turn it into a compile error: put gameplay in assemblies such as `Game.Domain` and `Game.Features`, give each adapter its own, such as `Game.Platform.Purchases`, and make the adapter the one assembly that references the vendor's code. Two of Unity's defaults work against this, and [Unity's page on assembly references](https://docs.unity3d.com/6000.3/Documentation/Manual/assembly-definitions-referencing.html) states both. The predefined `Assembly-CSharp` references every assembly marked Auto Referenced, so gameplay left there can reach any vendor. And every assembly definition references every precompiled plugin DLL, so a vendor shipped as a DLL stays reachable from gameplay until the plugin's Auto Referenced setting is off, or the gameplay assemblies turn on Override References and list what they use. With both handled, a vendor type in gameplay code fails to compile, and the review comment you would have written comes from the compiler instead.

The boundary has costs, and saying so is part of defending it. The interface lags the SDK: a new vendor feature is unusable until someone adds it to the interface and the adapter, which is friction on purpose. The usual erosion is one vendor enum passed through “just this once”. After that, every file that switches on it depends on the vendor, a major SDK version that renames its values turns into an edit across gameplay, and a gameplay test needs the vendor's assembly to build the values it checks. The opposite mistake is an interface designed as the lowest common denominator of every vendor you might use one day. Keep the interface to what this game uses, in this game's words, and extend it when a second implementation arrives that needs more.

Exercise: Search the gameplay code of a project you know for one SDK's namespace. List every vendor type you find outside its wrapper and, beside each, the game-owned type that should replace it.

?? platform-adapter-facade A wrapper exposes four game-owned operations over an SDK with dozens, and converts the SDK's callbacks and codes into game results. Which description fits it?
* Both a facade, since it narrows the SDK, and an adapter, since it converts its results
- An adapter alone, since a facade has to sit over several subsystems, not one SDK
- A decorator, because it keeps the SDK's contract and adds behavior around each call
- A proxy, because gameplay calls it in place of the SDK and it forwards each call
- A facade alone, because converting callbacks and codes is the bridge's job
> A facade gives a large subsystem a small interface, and an adapter converts one interface into the one a caller expects. An SDK wrapper usually does both: it narrows what gameplay sees and translates results, errors and threads into the game's terms.

?+ Where does the rule that turns the SDK's error codes into the game's error categories belong?
* In the adapter, with the other translations from vendor terms to game terms
- In each gameplay feature, next to the code that decides what to show the player
- In the composition root, which already knows which vendor it chose
- In a shared utility that gameplay and the adapter both call when an error appears
- In the vendor's configuration file, which the SDK reads when it initializes
> The adapter is the one place that knows both vocabularies, so each translation from vendor terms to game terms belongs there. Gameplay then handles a small set of categories, and an SDK upgrade that changes the codes changes one file.

?? platform-vendor-types A vendor's result enum is used in thirty gameplay files. What does that cost when the SDK's next major version renames its values?
* The upgrade reaches thirty gameplay files as well as the adapter
- The build grows, because each file that names the enum compiles its own copy of it
- IL2CPP generates a conversion at each use, so the upgraded build runs slower
- The vendor's assembly has to load before gameplay, which delays each start-up
- The cost is one of style, since the compiler points at each use that breaks
> A vendor type outside the wrapper makes each file that names it depend on the vendor. When the vendor changes the type, the change spreads through gameplay, where a type the game owns would have kept it inside the adapter.

?+ Gameplay code handles a vendor's callback type directly. What does that do to gameplay tests?
* Each test needs the vendor's assembly, and often its setup, to build its inputs
- The tests have to run on a device, since the Editor has no way to create vendor types
- The tests run faster, because they exercise the vendor's own objects instead of fakes
- The tests have to move to Play Mode, since vendor types need the engine's lifecycle
- Nothing changes, because a test can pass null wherever gameplay expects a vendor type
> A test of gameplay rules should need nothing but gameplay. When gameplay reads vendor types, each test drags in the vendor's assembly and whatever it takes to construct its objects, and the fake the game owns stops being enough.

## Choose implementations at the composition root {#platform-composition}

The first book's opening chapter describes a composition root as the one place that creates a feature's objects and hands each its collaborators. That is dependency injection done by hand, with no container required. At the platform boundary the root has one more job: choosing which implementation serves each capability. The candidates are usually five: the Android adapter, the iOS adapter, an Editor simulator, a test fake, and an implementation that reports the capability as unavailable, for a feature that is switched off or a device that cannot support it.

```csharp
public static class PlatformServices
{
    public static IPurchaseService CreatePurchases(PlatformConfig config)
    {
        if (!config.PurchasesEnabled) return new UnavailablePurchases();
#if UNITY_EDITOR
        return new SimulatedPurchases(config.PurchaseSimulator);
#elif UNITY_ANDROID
        return new PlayPurchaseAdapter(config.Store);
#elif UNITY_IOS
        return new AppStorePurchaseAdapter(config.Store);
#else
        return new UnavailablePurchases();
#endif
    }
}
```

The Editor branch comes first because of how Unity defines the symbols. With Android as the active build target, code compiled in the Editor has both `UNITY_EDITOR` and `UNITY_ANDROID` defined, while `Application.platform` reports the Editor, `OSXEditor` on a Mac. A test for `UNITY_ANDROID` alone would put the Android adapter into the Editor, so where the order does not already exclude the Editor, the condition reads `UNITY_ANDROID && !UNITY_EDITOR`. [Unity's scripting symbol reference](https://docs.unity3d.com/6000.3/Documentation/Manual/scripting-symbol-reference.html) lists the symbols.

Each adapter sits in an [[assembly definition]] whose platform list holds only its platform. Unity then compiles the Android adapter into Android players and nowhere else, neither into the Editor nor into an iOS player. The composition root may still reference that assembly, because in the Editor the reference compiles to nothing, and an Android type used outside its `#if` fails the Editor build at once with a missing-type error.

Platform conditionals belong in two places: the composition root, which chooses, and the adapter assemblies, which are platform code already. Spread anywhere else, they multiply. The iOS branch of a `#if UNITY_IOS` in a shop screen compiles in the Editor only while iOS is the active build target, and a branch guarded with `!UNITY_EDITOR` runs only on devices, so the Editor sessions that test the screen may never touch the code that ships to iPhones. Every new platform then adds a branch to every such file. `Application.platform` avoids the separate compilations, but the Editor reports itself as the Editor, so a device branch still runs only on a device.

Sometimes a capability is the same on both platforms except for one rule, and restoring purchases is an example. [Apple's App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) ask for a restore mechanism for any restorable in-app purchase, which games usually put behind a button. [Google's billing guide](https://developer.android.com/google/play/billing/integrate) has the app query its purchases each time it resumes, and the query returns what the player currently owns, so nothing waits for the player to ask. The rest of buying can be shared. The rule that differs is a [[strategy]]: an interface with a button-driven implementation and a resume-driven one, chosen in the composition root, so the difference lives in one class instead of in branches through the shop.

The Editor cannot run either adapter, so it gets a simulator, and a useful one does more than a stub. It can produce every outcome the real adapter produces, which means success, each failure reason the game handles, cancellation, and unknown, and it waits before answering, so loading states are visible. A settings asset or a small Editor window chooses the next outcome, which lets anyone walk the failure paths without editing code. Some vendors ship an Editor stub that succeeds at once. It keeps the Editor from failing, and it leaves every path except success untested until a device, where reaching it is slower and more expensive.

Exercise: Find a platform conditional outside a composition root or an adapter in a project you know. Move the decision into the root, and write down what the feature's code no longer needs to know.

?? platform-conditional-scope In a project with game-owned platform interfaces, where do `#if UNITY_IOS` checks belong?
* In the composition root, which chooses, and in the iOS adapter's own assembly
- In each feature that behaves differently on iOS, next to the code that differs
- In a static helper that each feature calls to ask which platform it runs on
- In the gameplay assemblies, wrapped in methods named after the capability they check
- In the scene, on a component that turns iOS-specific objects on and off at start-up
> The composition root chooses implementations and the adapter assembly holds platform code, so conditionals there sit where platform decisions are made anyway. Anywhere else, each one forks a feature into versions that some builds never compile and some tests never run.

?+ A shop screen contains a `#if UNITY_IOS` branch. What does the branch cost beyond readability?
* The Editor compiles its iOS path while iOS is the active target and skips it otherwise
- It adds a platform check to each frame for as long as the shop screen is open
- IL2CPP compiles both branches into each build, so the binary carries the unused one
- It has to be evaluated when the scene loads, which delays the shop's first frame
- It makes the screen's prefab platform-specific, so each platform needs its own copy
> A preprocessor branch is a separate version of the code for each target. The Editor compiles whichever one matches the active target, so the others go untested until someone switches target or builds, and each new platform adds another branch to the file.

?+ [tf] With Android as the active build target, code compiled in the Editor has `UNITY_ANDROID` defined.
* true
> The Editor defines the active target's symbol alongside `UNITY_EDITOR`. A branch meant for Android devices needs `UNITY_ANDROID && !UNITY_EDITOR`, or an earlier `#if UNITY_EDITOR` that has already taken the Editor.

?? platform-editor-simulator A vendor's Editor stub returns success for every call. What does a team give up by relying on it?
* Testing the failure, cancellation and unknown paths anywhere before a device build
- Running the adapter's native code inside the Editor's player loop
- Fast domain reloads, because the stub loads the vendor's native libraries into the Editor
- Accurate timing, because the stub returns its results on a background thread
- Play Mode tests, which fail when a stub completes an operation at once
> A stub that succeeds exercises one path. A simulator that can produce each outcome, with a delay, lets the Editor and its tests reach the error handling and loading states that a device would otherwise be the first to show.

?+ What should an Editor simulator for purchases let a developer choose without editing code?
* Which outcome comes next, failures and unknown included, and how long it takes
- The SDK version to imitate, so that the simulator matches the build that ships
- Which game-owned interface the shop uses, so that it can call the vendor directly
- The store account it signs in with, so that simulated purchases reach the sandbox
- The currency and price format to show, so that the shop matches each region
> The simulator's value is reaching every outcome the game has to handle. Choosing the outcome and a delay from a settings asset or an Editor window lets anyone walk the failure paths in the Editor.

## Results, errors, and threads at the boundary {#platform-results-threads}

The first book's mobile chapter gave purchases a result with five cases: succeeded, cancelled, unavailable, failed with a reason, and unknown. The same five fit most platform operations. Sign-in can be cancelled by the player, unavailable on a device without the platform's account service, failed with a reason, or unknown when the process died while the platform's sheet was open. Unknown needs the most care, because the operation may have happened: it cannot be retried as a new one or reported as a failure. It is recorded and reconciled later with whatever holds the truth, which for a purchase is the store and the backend.

Exceptions do not cross the boundary as exceptions. When a Java method throws during a call made through Unity's `AndroidJavaObject`, Unity clears the Java exception and throws an `AndroidJavaException` in C#, carrying the Java message and stack trace, and the adapter catches it and maps it like any other failure. The opposite direction has no such conversion. If a C# method throws while Java is calling it through Unity's `AndroidJavaProxy`, Unity catches the exception, logs it, and returns `null` to the Java caller, which never learns that your code stopped halfway. Under [[IL2CPP]], a C# exception is a C++ exception, and the wrapper IL2CPP generates for a callback that native code calls through a function pointer has no handler, so the exception unwinds into native code that was not written to expect it. Chapters 2 and 3 return to both. The rule for the adapter is the same on each platform: catch everything inside a callback, and turn it into a result.

Most SDK operations report through a callback, and the adapter turns each one into an awaitable operation. `TaskCompletionSource<T>` is the standard tool, and Unity's `AwaitableCompletionSource<T>` does the same for its own `Awaitable`. The completion source is also where three edge cases are handled: a callback that arrives twice, one that never arrives, and a caller that stops waiting.

```csharp
public Task<PurchaseResult> BuyAsync(ProductId product, CancellationToken cancel)
{
    var result = new TaskCompletionSource<PurchaseResult>();

    // The store calls back on a thread of its own, possibly twice, possibly never.
    // Each outcome goes through the main-thread queue, and the first one wins.
    void Complete(PurchaseResult outcome) =>
        mainThread.Enqueue(() => result.TrySetResult(outcome));

    var deadline = new CancellationTokenSource(TimeSpan.FromMinutes(2));
    deadline.Token.Register(() => Complete(PurchaseResult.Unknown(product)));
    var stop = cancel.Register(() => result.TrySetCanceled(cancel));
    result.Task.ContinueWith(_ => { deadline.Dispose(); stop.Dispose(); });

    store.Purchase(product.Value, native => Complete(PurchaseMapping.ToResult(native)));
    return result.Task;
}
```

`TrySetResult` makes a second callback harmless: it returns `false`, where `SetResult` would throw an `InvalidOperationException` on whichever thread called it. The deadline turns a callback that never comes into `Unknown` instead of a wait with no end. The registration lets the caller stop waiting, and waiting is all it stops. The store's sheet stays open, and a purchase that completes after the deadline or the cancellation is still money the player spent, so a production adapter also hands every store callback to the purchase record that reconciles unknown outcomes, whether or not a caller is still waiting.

Native code calls back on whichever thread it chose. [Unity's reference for `AndroidJavaProxy`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AndroidJavaProxy.html) says the proxy method runs on the Java thread that called the interface method, which is not always the main thread, and most Unity APIs work only on the main thread. The adapter's contract therefore has to say where its results arrive, and whether it can keep that promise depends on details that were checked in Unity 6.3 for this book:

| How the result reaches the caller | Where the awaiting code resumes |
| --- | --- |
| `await` a `Task`, starting on the main thread | The main thread, on a later frame, whichever thread completed the task |
| `await` the `Awaitable` of an `AwaitableCompletionSource` | The thread that completed it, such as the SDK's own thread |
| `await Awaitable.MainThreadAsync()` | The main thread, on the next frame when called from another thread |
| A queue that a main-thread component drains each frame | The main thread, inside the drain loop |

The first row works because Unity installs a `SynchronizationContext` on the main thread and posts task continuations to it, as [Unity's page on Awaitable completion](https://docs.unity3d.com/6000.3/Documentation/Manual/async-awaitable-continuations.html) describes. By the second row, an adapter that completes an `AwaitableCompletionSource` from a Java or Objective-C callback moves the awaiting method onto the SDK's thread, where its next call to a main-thread API is illegal. The queue is the most explicit of the four and the easiest to log, which is why the example above uses it.

Write the contract where callers read it, because the implementation does not show it. It answers three questions: which thread completes the operation, whether completion can happen more than once, and what happens when the caller has gone, because a scene unloaded or a screen closed while the platform was still working.

```csharp
public interface IPurchaseService
{
    /// Completes once, on the main thread. A store that never answers completes
    /// as Unknown after two minutes. Cancelling stops the wait but not the store:
    /// a purchase that completes afterwards is recorded and reconciled.
    Task<PurchaseResult> BuyAsync(ProductId product, CancellationToken cancel);
}
```

A caller whose owner can disappear passes a token such as `destroyCancellationToken`, which Unity cancels when the `MonoBehaviour` is destroyed, and the late result goes to the purchase record instead of to a screen that no longer exists.

Exercise: Write the contract for one native callback you depend on: the thread it arrives on, how many times it can arrive, how long its arguments stay valid, and what the game does when it never arrives.

?? platform-callback-completion A store SDK can invoke its purchase listener twice for one purchase. How should the adapter complete the task it returned?
* With `TrySetResult`, so the first outcome stands and the repeat returns false
- With `SetResult`, so the second call replaces the first outcome with the newer one
- With a new completion source per callback, so each outcome gets a task of its own
- By resetting the completion source after the first result, ready for the second
- With `SetResult` on the main thread, where Unity ignores a second completion
> A completion source completes once. `TrySetResult` reports a repeat by returning false, where `SetResult` throws `InvalidOperationException` on the thread that called it, which for a native callback is the SDK's own thread.

?+ The native sign-in sheet sometimes never calls back after the app returns from the background. What should the adapter add?
* A deadline that completes the operation as Unknown when no callback has arrived in time
- A retry that starts sign-in again each time the app resumes from the background
- A wait on the main thread until the callback arrives, so the result is not lost
- A check in `Update` that reports a failure once the task has waited for one frame
- A `SetResult` call in `OnApplicationPause`, so the task finishes before suspension
> A callback that may never arrive needs a deadline, or the caller waits forever. Completing as Unknown keeps to what is known: the platform may have signed the player in, so the next attempt starts by asking the platform for its current account.

?+ A purchase completed as Unknown at its deadline, and the store's success callback arrives a minute later. What should the adapter do with it?
* Record it for reconciliation: the player paid, whatever the caller was told
- Drop it, because `TrySetResult` returns false once the task has completed
- Complete a second task for the same purchase so that the shop can reopen with it
- Throw from the callback so that the store delivers the purchase again later
- Log it as a duplicate callback and discard it after the next launch
> A late callback is still a fact about money. The caller's task is settled, so the result goes to the durable purchase record that reconciles unknown outcomes and grants what was paid for.

?? platform-callback-thread A Java callback completes a `TaskCompletionSource` that a method started on the main thread is awaiting. Where does that method resume in Unity 6.3?
* On the main thread, on a later frame, through Unity's synchronization context
- On the Java thread, inside the call to `TrySetResult`, before the callback returns
- On a thread-pool thread, because a thread Unity did not create completed the task
- On the Android UI thread, because Unity delivers Java callbacks to it
- On a new thread that Unity starts for each awaiting method
> Unity installs a synchronization context on the main thread, and an `await` that starts there posts its continuation back to it. The code between the callback and `TrySetResult` still runs on the Java thread.

?+ A Java callback calls `TrySetResult` on an `AwaitableCompletionSource`, and a main-thread method awaiting its `Awaitable` then moves a Transform. What happens?
* The method resumes on the Java thread, so the Transform call runs off the main thread
- The method resumes on the main thread at the next frame, so the Transform call works
- `TrySetResult` throws, because it was called from a thread Unity did not create
- `TrySetResult` returns false, as the source belongs to the thread that created it
- Unity queues the Transform change and applies it at the end of the current frame
> An `AwaitableCompletionSource` resumes its awaiter on the thread that completes it. Completing it from a native callback moves the awaiting method onto the SDK's thread, so complete it on the main thread, or `await Awaitable.MainThreadAsync()` before touching the engine.

?+ Why does an adapter's contract name the thread that completes each operation?
* Whether the code after the `await` may call Unity APIs depends on it
- The thread decides how long the operation may take before the SDK times it out
- IL2CPP compiles the continuation differently for each thread it can run on
- The SDK needs the thread's id to route its callback to the right listener
- Garbage collection runs per thread, so the result has to stay on the thread that made it
> Callers write code after the await, and most Unity APIs are main-thread only. A contract that names the completing thread tells them whether that code is legal without reading the adapter.

## Events from the platform: early, repeated, and late {#platform-events}

The operations in the previous section start when the game asks. Other things start when the platform decides: a link opens the app, the player taps a notification, the [[push token]] changes, the platform signs the player out, the store delivers a purchase that completed while the game was closed, the app is paused, memory runs low. The game observes them, which makes the platform boundary the source in an [[observer]] arrangement, and these events bring three timing problems that the game's own events rarely have.

An event can arrive before anything listens. A [[deep link]] that launched the app existed before the first scene loaded. Unity stores it in `Application.absoluteURL` and raises `Application.deepLinkActivated` for links that arrive while the app runs, so a subscriber added by the first scene has missed the launch link and reads the property instead, as the example in [Unity's deep-linking page](https://docs.unity3d.com/6000.3/Documentation/Manual/deep-linking.html) does. Purchases work the same way. StoreKit, Apple's purchase framework, gives an app's unfinished transactions to its update listener once, immediately after launch, and [Apple's documentation](https://developer.apple.com/documentation/storekit/transaction/updates) warns that an app without that listener in place may miss them. Google's billing library does not call its purchase listener while the app is not running, which is why its guide has the app query purchases when it resumes.

The boundary therefore buffers. For state, such as the current push token or the signed-in account, it keeps the last value and hands it to each new subscriber. For occurrences, such as links and purchases, it keeps a queue and delivers each entry when the game can act on it:

```text
t=0.00  The player taps a link. The OS starts the process.
t=0.40  Unity starts and stores the link in Application.absoluteURL.
t=1.10  The boot scene loads. The link inbox subscribes to deepLinkActivated
        and queues the launch link it reads from absoluteURL.
t=3.60  The main menu is ready. The router takes the link from the inbox.
t=9.00  A second link arrives during play. It waits in the queue until play ends.
```

The same event can arrive twice. The store redelivers an unfinished purchase at each launch until the game finishes it, which is the point of the mechanism, and a player can tap the same link twice. A `handled` flag in memory fails twice over. A restart clears it, just when redelivery happens. And it records that something was handled without saying what, so a repeat and a new event of the same kind look alike. Identity works instead. Each purchase carries a transaction id, and the game keeps a durable record of the ids it has granted, the idea the first book applies to reward claims. The grant is then [[idempotence|idempotent]] for its transaction id, and a redelivery changes nothing.

An event can also arrive after the object that wanted it is gone. A sign-out notice reaches a profile screen that closed a minute ago, and the handler updates a view whose engine object has been destroyed. That is the lifetime problem the first book's chapter on C# semantics describes for any event: a subscription keeps the subscriber reachable until it is removed, so the binding that subscribes also unsubscribes when it ends, and a late result is checked against its owner before it acts.

Early and late are two halves of one question, which is when an event may act. Put the answer in one place, a router that owns the queues and knows the game's state. A link to a store item waits until play ends, a notification that opens a screen waits for the main menu, and a sign-out during a tutorial ends the tutorial before it takes effect. Without the router, each handler decides for itself, and the one that forgets opens a store page in the middle of play.

Exercise: List the platform events your game receives. For each one, write what happens when it arrives before the first scene has loaded, when it arrives twice, and when it arrives after the screen that wanted it has closed.

?? platform-early-event The title scene subscribes to `Application.deepLinkActivated`. The player opened the game by tapping a link. How does the game get that link?
* It reads `Application.absoluteURL`, which holds the link that launched the app
- It waits for `deepLinkActivated`, which Unity raises again once a subscriber is added
- It reads the launch intent with a Java plugin, since Unity keeps no copy of the link
- It asks the backend for the last link that was sent to the player's account
- It subscribes from a static constructor, which runs before the platform starts Unity
> At a cold start Unity stores the launching link in `absoluteURL`, and raises `deepLinkActivated` for links that arrive while the app runs. A subscriber added in a scene reads the property once and listens for the rest.

?+ Why does the boundary keep the current push token and give it to each new subscriber, instead of raising an event when it changes and nothing more?
* A subscriber that starts after a change still needs the value the event carried
- The token is too large to pass in an event, so subscribers read it from storage
- Tokens expire within minutes, so each subscriber needs a fresh copy on demand
- Raising a C# event from a native thread is illegal, so the value has to be stored
- Push tokens are secret, so the boundary hides the value behind a getter that checks callers
> A token is state, and state is read when a subscriber arrives. An event reports a change once, and anything that starts listening afterwards has missed it, so the boundary keeps the last value for late subscribers.

?+ Google's billing library does not call its purchase listener while the app is not running. What should the Android adapter do about purchases that complete then?
* Query the player's purchases on resume and send new ones through the usual grant path
- Nothing, since the listener replays missed purchases when the app next starts
- Ask the player to open the store's purchase history and confirm each purchase by hand
- Keep a background service running so the listener stays registered while the app is closed
- Wait until the player opens the shop, then show the purchases the store reports there
> A listener is an event source, and events are missed while nobody is listening. Google's billing guide has the app query its purchases in `onResume()`, which catches purchases that completed while the app was closed.

?? platform-event-identity The store redelivers an unfinished purchase at each launch until the game finishes it. Which check stops a second grant?
* Its transaction id, checked against a durable record of the ids already granted
- A `granted` flag in memory, set the first time the purchase is processed
- The purchase time, compared with the moment the current session started
- The product id, compared with the last product the player bought
- The delivery path, granting purchases from the listener and skipping those at launch
> Redelivery is how the store keeps a purchase from being lost, so the game recognizes the same purchase by its identity. A durable record of granted transaction ids survives the restart that caused the redelivery.

?+ Why is a `handled` flag in memory a weak defense against duplicate platform events?
* A restart clears it before redelivery, and it records no identity to compare
- Two events on the main thread can both read it as false before either sets it
- Unity resets static fields on each scene load, so the flag is lost during play
- The platform marks events as handled itself, so the flag duplicates its work
- Saving the flag to disk would make save files incompatible with older builds
> Duplicate delivery is recognized by identity. A flag records that something of a kind was handled, not which one, and it disappears with the process that redelivery follows.

## Test the boundary without a device, then on one {#platform-testing}

Most of a platform integration can be tested without a phone, and the part that needs one can be named in advance. The first book's testing chapter separates stubs, fakes, spies and mocks by purpose. At the platform boundary, four kinds of test do most of the work, from the cheapest to the most expensive:

| Test | Where it runs | What it establishes |
| --- | --- | --- |
| Game logic against a fake | Edit Mode, in seconds | Gameplay handles every result the interface can return |
| Adapter mapping from recorded responses | Edit Mode | The adapter turns each vendor response into the right game result |
| Contract suite | Against the fake in the Editor, and the real adapter on a device | The fake behaves like the real adapter |
| Device smoke test | A release-configured build on a device | The build, the operating system and the SDK work together |

The first two run as [[Edit Mode tests]]. Mapping tests need the translation separated from the bridge, so the adapter comes in two parts: a thin one that calls the SDK and passes on its raw response, and a pure function from that response to the game's result. The function runs in Edit Mode against responses recorded on a device, stripped of player data and kept per SDK version, as in `Fixtures/StoreSdk-7.2/purchase-pending.json`. When the SDK is upgraded, recording the same scenarios again and diffing the files shows what changed before any code does.

A fake drifts from the real adapter as the SDK changes, and a contract suite catches the drift. One abstract test class states what every implementation of the interface must do, and two small subclasses run it, one against the fake and one against the real adapter on a device:

```csharp
public abstract class PurchaseServiceContract
{
    protected abstract IPurchaseService Create();

    [Test]
    public async Task UnknownProductFailsWithAReason()
    {
        var result = await Create().BuyAsync(new ProductId("no-such-product"), CancellationToken.None);
        Assert.AreEqual(PurchaseStatus.Failed, result.Status);
        Assert.AreEqual(FailureReason.UnknownProduct, result.Reason);
    }
}

public sealed class FakePurchasesContract : PurchaseServiceContract
{
    protected override IPurchaseService Create() => new FakePurchases();
}

[UnityPlatform(RuntimePlatform.Android, RuntimePlatform.IPhonePlayer)]
public sealed class DevicePurchasesContract : PurchaseServiceContract
{
    protected override IPurchaseService Create() => PlatformServices.CreatePurchases(TestConfig.StoreSandbox);
}
```

The fake's run takes seconds on every change. The device run needs a build: [Unity's Test Framework](https://docs.unity3d.com/6000.3/Documentation/Manual/test-framework/workflow-run-playmode-test-standalone.html) can build the Play Mode tests into a player for the active target, run them there, and report the results back to the Editor, and the `UnityPlatform` attribute keeps the device subclass from running anywhere else. Contract tests cover what a device can check unattended. Anything that needs a person, such as the store's purchase sheet, belongs to the smoke test.

The device run matters because the Editor never executes part of the path:

- the native side of each bridge, and the SDK itself;
- [[IL2CPP]], and the [[managed code stripping]] that can remove C# reached only by reflection;
- [[R8]], which can remove or rename Java code that C# reaches only by name;
- the operating system's permission prompts, and the player's refusal;
- the real lifecycle: backgrounding, process death, and a launch started by a link or a notification;
- the callback threads, which a simulator reproduces only if it is written to.

The smoke test is a short scripted run on a build configured like the release: start-up, sign-in, a purchase in the store's test environment, a push, a link, and a background and resume. Chapters 5, 10 and 12 come back to why that configuration matters.

Exercise: Pick a fake in a project you know and write down one behavior of the real SDK that it does not model. Then decide which of the four kinds of test would catch the difference.

?? platform-contract-tests What keeps a hand-written fake from drifting away from the real SDK adapter as the SDK changes?
* One contract suite, run on the fake in the Editor and on the real adapter on a device
- Regenerating the fake from the SDK's public headers for each new SDK version
- Keeping the fake and the adapter in one assembly, so that each review sees both
- Running the fake's own tests in Play Mode, where the engine lifecycle is real
- Marking the fake obsolete whenever the vendor publishes a new release
> The same tests prove the same behavior in both implementations. When the SDK changes and the real adapter starts to behave differently, the device run of the suite fails before the fake can mislead the Editor tests that rely on it.

?+ An adapter test replays a response recorded on a device and checks the game result. What can it catch that a gameplay test against a fake cannot?
* A wrong translation of that vendor response into the game's result
- A gameplay rule that grants a reward twice when a purchase succeeds twice
- A shop screen that shows nothing while a purchase is pending
- A retry that treats the unknown outcome as a failure and buys again
- A Java class missing from the release build of the bridge
> The fake returns game results, so a test against it starts after the translation. A test that feeds the adapter recorded vendor responses is the one that checks the mapping itself.

?? platform-device-evidence Which failure can no test in the Editor reveal, whatever it runs against?
* A Java class the bridge reaches by name, removed from the release build by R8
- Gameplay that grants a reward twice when the store reports the same purchase twice
- A mapper that turns the SDK's cancellation code into a failure
- A shop screen that stays blank while a purchase is pending
- A retry loop that treats an unknown purchase outcome as a failure
> R8 runs in the Android release build, so no Editor test, with fakes or without, runs the code it changed. The other defects live in C# that Edit Mode tests exercise: gameplay rules, the result mapping, and screen state.

?+ The contract suite passes against the fake in the Editor, and its device run fails because a class is missing. Where does the difference most likely come from?
* A player build step, such as R8, stripping or native packaging
- The fake, which has to be rewritten to throw the same missing-class error
- The test framework, which loads classes in a different order on devices
- The Editor, which compiles the test assembly with the device's platform symbols
- The network, which is slower on the device and times the test out
> A class missing on the device and present in the Editor points at what only the player build does to code: shrinking, stripping and native packaging. The Editor has no equivalent step, which is why the suite has to run on the device.
