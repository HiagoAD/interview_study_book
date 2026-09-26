---
book: unity-mobile-platform-engineering
chapter: 07: Integrating third-party SDKs
---

## Evaluate an SDK before it enters the build {#sdk-evaluation}

An SDK is code from another company that the game ships, updates and debugs for as long as it keeps it, and much of what it will cost can be seen before anyone adds it. An evaluation asks three questions: what the SDK adds to the build, how it behaves when it runs, and how it ships. The answers go on one sheet, and the sheet goes into the decision next to the feature the SDK was chosen for.

What it adds shows in the build:

| What it adds | Where it shows |
| --- | --- |
| Native libraries, and the libraries they depend on, with versions | [[Gradle]]'s dependency report ([[#gradle-dependencies]]) and `Podfile.lock` ([[#xcode-cocoapods]]) |
| Permissions, components and manifest attributes | The merged manifest, and the merger's report of where each element came from ([[#gradle-manifest-merge]]) |
| `Info.plist` keys and capabilities | The exported `Info.plist` and entitlements file |
| The data it collects, and the required-reason APIs it calls | Its [[privacy manifest]], and Xcode's privacy report for the whole app |
| Size | APK Analyzer, which compares two APKs or [[app bundles]], and `bundletool get-size total` for the download size per device; on iOS, the App Thinning Size Report that an export writes |
| Minimum OS versions | The `minSdk` in each library's manifest, and the deployment target of each pod ([[#xcode-cocoapods]]) |
| Tool versions | Its release notes: the Unity, [[Android Gradle Plugin]] and Xcode versions it supports |

The vendor's documentation lists what the vendor meant to add, and a build diff shows what was added. Build the probe project, a copy of the game's project or an empty one with the same Unity version, settings and other SDKs, once without the SDK and once with it, export both, and compare them item by item. Transitive dependencies are where the two can part: the SDK's library depends on others, each with a manifest of its own, and their permissions, components and privacy manifests arrive with it whether or not the SDK's guide mentions them. In a test for this chapter, one dependency, Firebase Analytics 22.4.0, added to a copy of the probe's Gradle export changed its release build well beyond that one line: 20 more libraries resolved, the APK grew from 17.3 MB to 19.1 MB, and the merged manifest gained six permissions, among them `INTERNET`, `AD_ID` and two for Android's Ad Services APIs, with three services, a receiver, an activity and `FirebaseInitProvider`, a [[content provider]] that starts the SDK as the app launches. The merger's report traced that provider to `firebase-common`, a library the one dependency pulled in. On iOS, the matching pod added to a copy of the Xcode export resolved to nine [[pods]], among them GoogleUtilities with a subspec named `AppDelegateSwizzler`, and six of their sources carried privacy manifests, while the exported `Info.plist` did not change. An archive of that copy then failed in Xcode 27, which builds for iOS 15.0 and later, because four of those pods still declared iOS 9.0 or 12.0 as their deployment target: the kind of mismatch the row for tool versions is there to catch.

How it behaves shows only when it runs. Measure it on a device, in a release-configured build, with and without the SDK:

- Start-up cost: the time to the first frame, and what the SDK does on the main thread while it starts. Work on the main thread is what risks an [[ANR]] on Android, which [Android's ANR page](https://developer.android.com/topic/performance/views/vitals/anr-views) reports when input goes unanswered for five seconds, and on iOS a watchdog termination when launch takes too long ([[#ios-failure-evidence]]).
- Threads and network: the threads it starts, and the requests it sends at launch, to which hosts, and whether before the player's consent, which a later section of this chapter takes up. A proxy on the device's traffic shows the requests.
- [[Method swizzling|Swizzling]]: whether it replaces methods of the application delegate ([[#ios-xcode-postprocess]]), and whether that can be turned off. Firebase Cloud Messaging's [iOS guide](https://firebase.google.com/docs/cloud-messaging/ios/get-started), for example, documents an `Info.plist` flag, `FirebaseAppDelegateProxyEnabled`, that turns its swizzling off in a native integration.
- Activity subclassing: whether it asks the game to extend Unity's activity ([[#android-activity-integration]]).

How it ships decides how hard it will be to upgrade and to remove:

| Form | What it does to the project |
| --- | --- |
| A package for Unity's Package Manager, installed from a registry, a scoped registry, a Git URL or a tarball | One entry in the project manifest: an upgrade changes its version, and [removing the package](https://docs.unity3d.com/6000.3/Documentation/Manual/upm-ui-remove.html) removes the entry, and the package with it unless another package depends on it |
| A `.unitypackage` file from the vendor, a local asset package | Its files are copied into `Assets` where its author placed them, and the Package Manager [does not track them](https://docs.unity3d.com/6000.3/Documentation/Manual/upm-ui-remove-local.html), so removing it means finding each file by hand |
| Native libraries alone | AARs, frameworks and xcframeworks that the team places, configures and updates itself |

Many SDKs combine forms: a C# layer in a package, with a `*Dependencies.xml` file that [[EDM4U]] turns into Maven and CocoaPods dependencies. The vendor counts as much as the files: how often it releases, whether its changelog states changed behavior and raised minimum versions, whether it answers support requests, and how it has handled deprecations before.

Lab exercise: Produce an evaluation sheet for one SDK from a build diff of the probe project: the libraries, permissions, components, `Info.plist` keys, privacy manifest entries and size it adds on each platform, and the start-up time on a device with and without it.

?? sdk-build-diff An SDK's integration guide lists two Android permissions, and a diff of the merged manifests with and without the SDK shows four. What does the team do?
* Trust the diff, and look up where each extra permission came from in the merger's report
- Trust the guide, since the diff also counts permissions that Unity adds to each build
- Trust the guide, since the extra two come from the Editor's development build settings
- Trust the diff, and remove the two extra permissions before asking what uses them
- Trust neither, and read the permissions from the store's listing after upload
> The diff compares two builds that differ in one SDK, so what it shows is what that SDK brought, including permissions from libraries it depends on that its guide does not mention. The merger's report names the manifest each element came from, which says which library to ask about. Removing a permission before knowing what uses it can break the SDK in ways that appear only on a device.

?+ Why compare a build with the SDK against the same project built without it, rather than read the new build's manifest on its own?
* The difference separates what the SDK brought from what Unity and other SDKs add
- A single build's merged manifest leaves out the entries that libraries contribute
- The build without the SDK is needed to sign the new one with the same key
- Reading one manifest works as well, since each entry names the library it came from
> A merged manifest holds everything, from Unity, the game, and each library, with nothing on an entry to say where it came from; the merger's report is where the source is recorded. Two builds that differ in one SDK make that SDK's contribution the difference, which is also the list the evaluation sheet needs.

?+ Which property of a new SDK has to be measured on a device rather than read from a build diff?
* The time its start adds to launch, and its work on the main thread
- The permissions that its libraries add to the merged manifest
- The `Info.plist` keys and privacy manifest entries it brings
- The libraries it depends on, and the versions that Gradle resolves for them
> A build diff shows what the SDK adds to the build: libraries, manifest entries, keys, privacy declarations and size. What it does when it runs, how long its start takes, which threads it starts, which requests it sends, only shows when it runs, which means a release-configured build on a device, measured with and without it.

?? sdk-distribution-form A vendor offers its SDK as a package for Unity's Package Manager and as a `.unitypackage` file. Which does the team choose, and why?
* The package, since one manifest entry records it and one change upgrades it
- The `.unitypackage`, since the team can then edit the vendor's files where they are
- The `.unitypackage`, since packages leave out native Android and iOS libraries
- Either one, since Unity turns an imported asset package into a UPM package
> A package is one entry in the project's manifest, with its version recorded, and upgrading or removing it changes that entry. An asset package copies its files into `Assets`, where they mix with the project's own. Editing vendor files in place means redoing the edits at each upgrade, and packages can carry native plugins.

?+ A team upgrades an SDK that came as a `.unitypackage` file from the vendor's site by importing the new version over the old one. What can go wrong?
* Files the new version dropped stay in `Assets`, and still compile and ship
- The import fails, since Unity refuses to import over files that already exist
- Unity deletes the old version's files first, along with the team's edits to them
- Nothing, since the asset package lists the files that the import should delete
> The Package Manager does not track what a local asset package imported, so nothing in the project knows which files the old version brought. The import writes the new version's files, and the files that the old version had and the new one dropped stay behind, where a class the vendor deleted can still compile, collide with its replacement, or ship. An upgrade in this form needs a list of the old version's files, which is why a team that takes an SDK this way keeps one.

?+ Is an SDK that the vendor ships as a `.unitypackage` file harder to remove than one that ships as a package for the Package Manager?
* Yes: its files are spread through `Assets`, and the team has to find each one
- No: the Package Manager records the import and can remove the files it added
- No: deleting the SDK's top-level folder removes it, since imports stay in one folder
- Yes: an asset package installs into the Editor, where each project shares it
> Removing a package removes its entry from the project manifest, and the package goes with it unless another package still depends on it. Unity's manual says the Package Manager does not track assets imported from a local asset package, whose files were copied into `Assets` wherever its author put them, often across several folders, such as `Plugins`, `Editor` folders and a folder of the vendor's name, so removing it means finding each file.

## Integrate an analytics SDK into an existing project {#sdk-analytics-integration}

This section answers one interview question from start to finish: how would you integrate an analytics SDK into an existing project? A vendor's quick start answers it in three steps, which are to add the package, initialize the SDK, and call its logging method wherever something happens. The third step does the damage. A game that calls the vendor's method from two hundred places has made the vendor's API part of its gameplay, and it pays for that in each migration, in each audit of what the game collects, and in each test that needs the vendor's assembly to build.

The answer starts on the game's side, as [[#platform-interfaces]] does for every capability. The game owns the event schema: the list of events it sends and, for each one, its name, its parameters with their types and units, and how often it fires. The schema is a file in the game's repository. A change to it is reviewed like code, and each new event has someone who approves it, usually the analyst who will read it, since an event that nobody reads costs the player battery and data for nothing. Gameplay builds events through typed methods, so a call site cannot misspell a name or send a level number as text:

```csharp
// Game-owned: the interface and the events. No vendor type appears here.
public interface IAnalytics
{
    void Track(GameEvent gameEvent);
}

public sealed class GameEvent
{
    public string Name { get; }
    public IReadOnlyList<(string Key, object Value)> Parameters { get; }
    public DateTime OccurredUtc { get; } = DateTime.UtcNow;

    public GameEvent(string name, params (string Key, object Value)[] parameters)
    {
        Name = name;
        Parameters = parameters;
    }
}

public static class GameEvents
{
    public static GameEvent LevelCompleted(int level, int stars, float seconds) =>
        new GameEvent("level_completed", ("level", level), ("stars", stars), ("duration_s", (int)seconds));

    public static GameEvent PurchaseStarted(ProductId product) =>
        new GameEvent("purchase_started", ("product_id", product.Value));

    public static GameEvent EventsDropped(int count) =>
        new GameEvent("analytics_events_dropped", ("count", count));
}
```

Each vendor gets an adapter that turns a `GameEvent` into its SDK's call, and the adapter is the one place that names the vendor. It also applies the vendor's rules. [Firebase Analytics' reference](https://firebase.google.com/docs/reference/cpp/group/event-names), for example, said in September 2026 that an event name has at most 40 characters, letters, digits and underscores, starting with a letter, and that an app can report 500 types of event with up to 25 parameters each. The adapter's tests check the schema against those rules, so an event the vendor would refuse fails in a test instead of vanishing on a device.

A schema kept in one file and events built in another drift apart, so two checks hold them together. An [[Edit Mode tests|Edit Mode test]] builds each event that `GameEvents` can make and validates it against the schema file. A development build validates each event again as it is tracked, which covers what the test cannot build, such as parameters that come from data. Both fail loudly, so a misspelled name surfaces in the first playtest instead of as a gap in a report weeks later. `Debug.isDebugBuild` is true in development builds and always true in the Editor, so release builds skip the check.

Events start before the SDK can take them. The first scene reports that the game opened, the tutorial's first step fires while the consent prompt is still on screen, and the SDK may still be initializing. What an SDK does with a call made before it is ready is its vendor's choice, and its documentation may not say, so the game's own layer holds the events. It keeps them in a bounded queue until two things are true: the SDK is initialized, and the player's consent allows collection. Then it sends them in order, and each keeps the time it happened, which the time the SDK receives it would misstate. If the player denies consent, the queue is discarded. The bound is there because the wait can last as long as the player leaves the prompt open, and a full queue drops its oldest event and counts the drop, so the loss appears in the data instead of hiding in it:

```csharp
// One per vendor, in the vendor's assembly.
public interface IAnalyticsAdapter
{
    void Send(GameEvent gameEvent);
    void Flush();
    void StopCollection();
}

// The game's analytics service: validation, the early-event queue, and fan-out to the adapters.
public sealed class AnalyticsService : IAnalytics
{
    private const int MaxPending = 500;
    private readonly IReadOnlyList<IAnalyticsAdapter> adapters;
    private readonly EventSchema schema;
    private readonly Queue<GameEvent> pending = new Queue<GameEvent>();
    private bool open, denied;
    private int dropped;

    public AnalyticsService(IReadOnlyList<IAnalyticsAdapter> adapters, EventSchema schema)
    {
        this.adapters = adapters;
        this.schema = schema;
    }

    public void Track(GameEvent gameEvent)
    {
        if (Debug.isDebugBuild) schema.Validate(gameEvent); // Throws on an unknown name or a wrong type.
        if (denied) return;
        if (open) { Send(gameEvent); return; }
        if (pending.Count == MaxPending) { pending.Dequeue(); dropped++; }
        pending.Enqueue(gameEvent);
    }

    // Called once the adapters are initialized and consent allows collection.
    public void Open()
    {
        open = true;
        denied = false;
        while (pending.Count > 0) Send(pending.Dequeue());
        if (dropped > 0) Send(GameEvents.EventsDropped(dropped));
        dropped = 0;
    }

    // Called when the player denies consent, at the prompt or later in the settings.
    public void Deny()
    {
        open = false;
        denied = true;
        pending.Clear();
        dropped = 0;
        foreach (var adapter in adapters) adapter.StopCollection();
    }

    // Called from OnApplicationPause(true).
    public void Flush()
    {
        foreach (var adapter in adapters) adapter.Flush();
    }

    private void Send(GameEvent gameEvent)
    {
        foreach (var adapter in adapters) adapter.Send(gameEvent);
    }
}
```

The end of a session loses events as easily as the start. An SDK may hold events and send them in batches: [Firebase's DebugView page](https://firebase.google.com/docs/analytics/debugview) says that its events are generally batched over about an hour and uploaded together. The game's own layer batches the same way when it also sends events to its backend. On Android the process can end in the background without another callback, and iOS suspends an app shortly after it leaves the foreground ([[#os-lifecycle]]). Unity sends `OnApplicationPause(true)` as the app loses focus and pauses, so that is where the service asks each adapter to flush, and where the game's own uploader writes its unsent batch to disk, to send at the next launch if the request does not finish in time. `OnApplicationFocus(false)` is no substitute: [Unity's reference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.OnApplicationFocus.html) notes that on Android, pressing Home while the on-screen keyboard is open sends the pause and not the focus change.

Some events fire too often to send each one, such as a frame-time sample or each shot in a match, so the schema gives them a sampling rate. Sampling by session rather than by event keeps a session's funnel whole: the service decides once, as the session starts, whether this session sends the event, and each event it sends carries the rate, so the analysis can scale the counts back up.

Two definitions are the game's to make, since a vendor makes them otherwise. The user id is a pseudonymous id that the game's backend issues, not an email address, a name or a platform account id, and the service sets it on each adapter after sign-in, so the vendor's data can be joined to the game's own. A session has a meaning in each vendor's SDK as well, and two vendors may not define it alike. The game defines its own, starting at launch or at a resume after a stated time in the background, and sends its session id as a parameter, so that numbers from two vendors, or from a vendor and the backend, can be compared.

Replacing one vendor with another runs both for a while. A composite implementation hands each event to both adapters, and the two are compared per event and per day. They will not agree exactly, since each vendor counts sessions and removes duplicates in its own way, so the test is whether the difference stays stable. A difference that grows, or one event that disagrees while the rest match, points to a mapping mistake in one adapter. Two more sources confirm the numbers. On a device, the vendor's debug view shows events as they arrive, with their parameters; Firebase's is turned on with `adb shell setprop debug.firebase.analytics.app` and the package name on Android, and with the `-FIRDebugEnabled` launch argument in Xcode on iOS. On the backend, the game's own records, such as the purchases its server validated, give counts that no SDK produced, which checks both vendors at once. The new pipeline reaches players behind a remote flag, so turning it off needs no release, and the old one is removed when the numbers have matched long enough to trust.

Three mistakes recur:

- Vendor calls in two hundred places. The migration edits two hundred files, and the calls it misses go on sending to the old vendor.
- Personal data in events: a player's name or email address in a parameter, free text from a chat box, a precise location. [Google Analytics' policy](https://support.google.com/analytics/answer/6004245?hl=en) says its contracts prohibit sending personally identifiable information, and [Firebase's guide to user ids](https://firebase.google.com/docs/analytics/userid) says an id must not contain information that a third party could use to identify the user. The schema review is where it is stopped.
- Editor sessions in production data. If the Editor runs the real adapter, each play session in the Editor sends events. The composition root of [[#platform-composition]] gives the Editor an implementation that logs, and development builds send to a separate project, so testers' sessions stay out of the numbers the business reads.

Exercise: Write the interface and three event types for a feature you know, and name who approves a new event.

?? sdk-event-schema A team adds a second analytics SDK to a game that already has one. Where should the names and parameters of the game's events be defined?
* In the game's own schema and code, with each adapter translating them for its vendor
- In each vendor's dashboard, where the analysts who read the events can edit them
- In each adapter, so that each vendor gets names in the style its documentation uses
- In the gameplay classes that fire them, as string literals beside each call
- In the newer vendor's event list, which the older adapter then copies
> The event schema belongs to the game: it lives in the repository, changes through review, and uses the game's vocabulary. Each adapter translates it for its vendor, so adding or replacing a vendor changes one adapter and no gameplay code. Names typed as literals at call sites drift and get misspelled, and a schema kept in a vendor's dashboard or copied from a vendor's list ties the game's data to that vendor.

?+ Gameplay code calls the old vendor's logging method directly from two hundred places. What does that cost when the team replaces the vendor?
* Two hundred edits, and the calls the migration misses keep sending to the old vendor
- One change in the composition root, which picks the new vendor's class at start-up
- Nothing in code, if the new vendor accepts the same event names as the old one
- A new schema in the new vendor's dashboard, which maps the old calls at run time
> Each call site uses the old vendor's API, so each one has to change, and a missed one goes on sending to the old vendor. A composition root can swap an implementation only when callers depend on an interface, and a vendor's acceptance of the same names does not change the API the calls are written against. The game's own interface and schema, with one adapter per vendor, turn the migration into one new adapter.

?+ Gameplay builds each analytics event through a typed method. Why does a development build still check each tracked event against the schema file?
* Types catch misspelled call sites, not names or values the schema rejects
- The vendor drops unknown events in release builds, so each name must be registered first
- Typed methods are stripped from development builds, which leaves strings to check
- The check uploads the schema to the vendor, which needs it before the first event
> A typed method stops a call site from misspelling a name or passing the wrong type. It does not stop the method itself from using a name the schema does not have, or a parameter built from data from holding a value outside its range. Checking each event in development builds turns those mistakes into an exception in the first playtest, instead of a gap in a report weeks later, and release builds skip it.

?+ A product manager asks to add the player's email address to each analytics event so that support can find a player's history. Should the schema allow it?
* No: events carry a pseudonymous id, which the backend maps to the player for support
- Yes: the vendor's data is private to the team, so an address there exposes nothing new
- Yes, if the address is hashed on the device first, which makes the events anonymous
- No: analytics SDKs reject string parameters longer than a few dozen characters
> Personal data such as an email address does not belong in analytics events, and vendors' terms prohibit it. A hash of an email address is still a stable identifier that anyone holding the address can recompute, so it is not anonymous. The schema gives events a pseudonymous id issued by the game's backend, and support looks the player up there.

?? sdk-pre-init-events The first scene tracks an event before the analytics SDK has initialized and before the player has answered the consent prompt. What should the game's analytics layer do with it?
* Hold it in a bounded queue, and send it once the SDK is ready and consent allows
- Pass it to the SDK at once, and let the SDK queue what arrives before it is ready
- Hold the first scene until the SDK has initialized, so that no event arrives early
- Keep it in a list without a size limit, which the service drains after initialization
- Drop it, and track the same event again once the SDK reports that it is ready
> The game's layer holds the event until two things are true: the SDK is initialized and the player's consent allows collection. What an SDK does with a call made before it is ready is its vendor's choice. Holding the first scene spends the start-up budget on analytics, a list without a limit grows for as long as the prompt stays open, and tracking the event again later loses the time it happened.

?+ The player denies analytics consent. What happens to the events the game queued while the consent prompt was open?
* They are discarded, and the service stops passing events to the adapters
- They are sent once, since they were recorded before the player answered
- They are kept on disk, in case the player grants consent in a later session
- They are sent without the user id, which makes them anonymous enough to keep
> The queue was waiting for the player's answer, and the answer is no, so its events are discarded and collection stops. Keeping them for a later session holds data the player refused, and removing the user id does not make events anonymous, since their content and the device can still identify the player. A later grant starts collection from that moment.

?+ The consent prompt stays open for ten minutes while gameplay events keep firing. What keeps the analytics queue from growing without limit?
* A cap on its size that drops the oldest events and counts the drops
- The SDK's own buffer, which takes over once the game's queue is full
- A timer that passes the queued events to the SDK each minute until consent
- The garbage collector, which releases events once they are a frame old
> The queue has a fixed size. When it is full it drops the oldest event and counts the drop, and the count is sent as an event of its own once collection starts, so the loss shows in the data. Passing events to the SDK before consent is the collection the queue exists to prevent, and the SDK's buffer holds only what the game has already handed over.

## Consent, privacy, and initialization order {#sdk-consent-init}

Consent comes before collection. Where the law or a store's policy requires the player's agreement, an SDK that collects data for analytics or advertising collects nothing until the player has given it, and whether a region requires it is a question for the game's privacy policy, not for the platform code. What the platform code owns is the mechanism. It keeps a consent state for each purpose the game asks about, unknown until the player answers and then granted or denied, and each adapter consults it before its SDK starts. The state can change at any time, since the player can change their mind in the settings, and a change reaches each SDK it concerns:

```csharp
public enum ConsentPurpose { Analytics, Advertising, AdPersonalization }
public enum ConsentState { Unknown, Granted, Denied }

// Game-owned: the player's answers per purpose, stored on the device.
public interface IConsent
{
    ConsentState Get(ConsentPurpose purpose);
    event Action<ConsentPurpose, ConsentState> Changed;
}
```

The analytics adapter from [[#sdk-analytics-integration]] opens its queue on `Granted` and discards it on `Denied`, and it also passes the answer to the SDK's own switch. Firebase Analytics, for example, turns collection back on with `setAnalyticsCollectionEnabled`, and its consent mode takes a value per purpose; [its reference](https://firebase.google.com/docs/reference/swift/firebaseanalytics/api/reference/Categories/FIRAnalytics%28Consent%29) says that each purpose defaults to granted, so a game whose own state starts at unknown sets those values itself before collection begins.

iOS adds a prompt of its own for tracking. [Apple's page on user privacy](https://developer.apple.com/app-store/user-privacy-and-data-use/) says that an app needs the player's permission through the [[App Tracking Transparency]] framework to track them or to read the device's [[advertising identifier]], which reads as all zeros until they agree. The app asks with `ATTrackingManager.requestTrackingAuthorization`, gives its reason in the `NSUserTrackingUsageDescription` key of its `Info.plist`, and receives one of four statuses: not determined, restricted, denied or authorized. The SDK's header adds that the request shows a prompt only while the app is active, so a request made during launch, before the app is active, shows nothing. In Unity, the iOS 14 Advertising Support package (`com.unity.ads.ios-support`) wraps the request as `ATTrackingStatusBinding.RequestAuthorizationTracking`. On Android, an app that uses the advertising ID of Google Play services and targets Android 13 or higher declares the `AD_ID` permission in its manifest. The game's own consent and the tracking prompt answer different questions, so neither replaces the other, and the order of the two screens is part of the design.

An audience that includes children changes which SDKs may be in the build at all. [Google Play's Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en) allows ads to children, or to users of unknown age, only through ads SDKs it has self-certified for families, and it bars from apps that target children alone any SDK not approved for child-directed services. [Apple's App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) say that apps in the Kids Category should not include third-party analytics or advertising. That is decided at evaluation, before any integration work, since it can rule an SDK out.

Some Android SDKs start before any C# runs. Android calls the `onCreate` of each registered [[content provider]] on the main thread at launch, and [`Application.onCreate`](https://developer.android.com/reference/android/app/Application) runs before the app's activities, services and receivers, a list from which content providers are excluded. An SDK that declares a provider in its manifest is therefore called in the game's process before Unity's activity exists, let alone its first scene. Firebase's `FirebaseInitProvider` is one: [its reference](https://firebase.google.com/docs/reference/android/com/google/firebase/FirebaseApp) says it is merged into the app's manifest by default and runs at launch. Jetpack's [App Startup](https://developer.android.com/topic/libraries/app-startup) library works the same way, with one provider, `InitializationProvider`, that finds and calls the initializers of each library that uses it. An SDK that starts this way can send its first request before the game's consent code has run, which is why the build diff of [[#sdk-evaluation]] lists providers. The SDK's documentation says how to turn it off, usually with a manifest setting that keeps collection off until the game turns it on, or by removing the provider and starting the SDK from code:

```xml
<!-- In the game's own manifest, inside <application>; the manifest element declares xmlns:tools. -->
<!-- Firebase Analytics: start with collection off, until the consent code turns it on. -->
<meta-data android:name="firebase_analytics_collection_enabled" android:value="false" />

<!-- App Startup: keep one library's initializer out of the merged manifest, and start it from code. -->
<provider
    android:name="androidx.startup.InitializationProvider"
    android:authorities="${applicationId}.androidx-startup"
    android:exported="false"
    tools:node="merge">
    <meta-data android:name="com.example.sdk.ExampleInitializer" tools:node="remove" />
</provider>
```

On iOS the same Firebase switch is the `FIREBASE_ANALYTICS_COLLECTION_ENABLED` key of the `Info.plist`, set to `NO`.

iOS has no manifest component, but a framework's `+load` methods run as it loads, before `UIApplicationMain` ([[#ios-xcode-postprocess]]), so an SDK can start from there as well, and its documentation is again where the switch is.

The order at start-up follows from what each SDK is for:

```text
Process start    Crash reporting starts, so that it sees the crashes of what follows.
First scene      The stored consent loads. Unknown means nothing collects yet,
                 and analytics events wait in the game's queue.
Consent known    Analytics starts if the player agreed to it, ads with their purposes.
                 Each SDK starts asynchronously, with a deadline.
Main menu        The game waits for no SDK beyond its start-up budget.
```

Crash reporting comes first because a crash during another SDK's start is what it exists to report. The order is a design choice rather than a vendor rule: Firebase's Unity guide for Crashlytics, for one, initializes it in a script's `Start`, and the sequence above moves it as early as the game can. Whether it may start before the player's answer is again a question for the privacy policy; where it may not, it starts as soon as the answer allows. Everything else starts asynchronously within a budget, and a start that fails or runs out of time makes that capability unavailable, the implementation of [[#platform-composition]] that reports it missing, while the game plays on:

```csharp
// Waits for one SDK's start without letting it hold the game: failure or a timeout means unavailable, for now.
// It bounds the wait, not the work: start has to return at once, with the SDK's work running asynchronously.
public static async Task<bool> StartWithinBudget(Func<Task> start, TimeSpan budget)
{
    try
    {
        Task started = start();
        if (await Task.WhenAny(started, Task.Delay(budget)) != started) return false;
        await started; // Rethrows the start's exception, if it failed.
        return true;
    }
    catch (Exception e)
    {
        Debug.LogException(e);
        return false;
    }
}
```

The stores' privacy declarations follow from the SDKs in the build. [Google Play's Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) covers data collected and handled through the third-party libraries and SDKs in the app, and Apple's page on user privacy asks the developer to describe what third-party code, such as an analytics or advertising SDK, collects, how it is used and whether it tracks. Adding or upgrading an SDK is therefore also a change to those declarations, and the evaluation sheet of [[#sdk-evaluation]] holds the answers: what the SDK's documentation says it collects, its privacy manifest, and Xcode's privacy report.

Exercise: Draw the start-up sequence of the SDKs in a game you know, with the consent decision in it. Mark each SDK that can collect before the decision, and how it is held back.

?? sdk-auto-init An Android SDK sends a request at launch, although the game calls its start method only after the player consents. What is the likely cause?
* The SDK starts itself from a provider in its manifest, before any C# runs
- Unity's player starts each Android library in the build before it loads a scene
- The game's start call runs once in the Editor and once again on the device
- The Gradle build ran the SDK's initializer when it merged the manifests
- The SDK read a consent answer the player gave in another app on the device
> Android creates an app's content providers as its process starts, before the first activity, and an SDK can declare one to start itself there. That runs before Unity's player loads any C#, so the game's consent code has not yet run. The merged manifest lists each provider, and the SDK's documentation says how to keep it off until the game turns it on.

?+ Where does a team find which SDKs in its Android build can start themselves at launch?
* In the merged manifest's `provider` entries, and the report of their sources
- In the SDKs' C# wrappers, which call their native start from static constructors
- In Unity's Player Settings, which list the libraries loaded at start-up
- In Gradle's dependency report, which marks the libraries that run at launch
> A library starts itself by declaring a content provider, which the manifest merge copies into the app's manifest. So the merged manifest lists each one, and the merger's report says which library declared it. Nothing in C# is involved, since the provider runs before C# does.

?+ How does a game keep an Android SDK from starting itself before the consent code runs?
* With its documented switch, such as a manifest flag or removing its provider
- By calling the SDK's stop method from the first scene's `Awake`, before any event
- By holding the first scene until the player answers the consent prompt
- By removing the `INTERNET` permission from the merged manifest until consent
> The provider runs before the first scene, so nothing in `Awake` or in scene order comes early enough. The SDK's own documentation gives the switch: a manifest setting that keeps it idle until the game turns it on, or removing its provider in the game's manifest and starting it from code. A manifest permission applies to the installed app, so it cannot wait for consent.

?? sdk-init-order A game's privacy policy lets its crash reporter run before the player answers the consent prompt. In what order does the game start its crash reporter, its consent check, and its analytics and ads SDKs?
* Crash reporting first, then consent, then analytics and ads as the answers allow
- Consent first, then analytics and ads, and crash reporting once play begins
- Analytics first, to record the start-up, then consent, then crash reporting
- All at once on the main thread, so that none of them waits for another
> The crash reporter goes first, which this game's policy allows before consent, so that it can report a crash in anything that starts after it. The stored consent comes next, because analytics and ads depend on it, and they start once the answers allow, each asynchronously. Starting them all on the main thread at once blocks it for the sum of their costs, long enough for an unanswered input to become an ANR on Android or for the watchdog to end a slow launch on iOS.

?+ An ads SDK's start sometimes takes ten seconds on a slow network. What does the game's start-up do?
* Start it asynchronously with a deadline, and play on without ads if it misses it
- Wait for it before the main menu, since an ad may be the first screen shown
- Start it on the main thread in `Awake`, so that it finishes before the first frame
- Retry the start in a loop until it succeeds, holding the first scene meanwhile
> An SDK's start is not allowed to hold the game. The start-up code starts it, waits at most its budget, and moves on; a start that fails or runs late leaves ads unavailable for now, and the game plays. Blocking the main thread for ten seconds risks an ANR or a watchdog termination, and a retry loop that holds the first scene turns a slow network into a game that does not start.

?+ Should the game wait for its analytics SDK to finish starting before it shows the main menu?
* No: it starts within a budget, and events wait in the game's queue
- Yes: an SDK loses the events that it receives before it has finished starting
- Yes: the main menu's first event has to reach the SDK in the same frame
- No: analytics SDKs start themselves before Unity loads, so there is no wait
> The game's queue holds events until the SDK is ready and consent allows them, so nothing is lost by moving on, and the main menu does not wait for analytics. Some SDKs do start from a manifest provider, but that is something to control, not a reason to skip the budget, and the game's own start call still has to be made.

## Different implementations on Android and iOS {#sdk-platform-differences}

An SDK that exists on both platforms still differs between them: in its API, its threads, its limits, and sometimes in whether a feature exists at all. The game's interface stays the same on both, and the differences are absorbed below it. Four cases cover most SDKs:

| Case | What the game does |
| --- | --- |
| The vendor ships a Unity plugin with one C# API for both platforms | Wraps it anyway, in one adapter that keeps the plugin's types |
| The vendor ships two native SDKs with different APIs | Writes two adapters behind one interface |
| A feature exists on one platform | Asks a capability query instead of checking the platform |
| The behavior differs in timing, limits or threads | Normalizes it in the adapter, and writes the difference into the contract |

A vendor's Unity plugin with one C# API seems to make the interface unnecessary, since the game could call the plugin on both platforms. The reasons in [[#platform-interfaces]] hold anyway: the plugin's types would spread through gameplay, the Editor needs a simulator that the plugin may not provide, and a second vendor would find the game written in the first one's vocabulary. The plugin also hides two native SDKs, one per platform, with their own versions, release notes and bugs, so the adapter reports the plugin's version and each native version with the game's logs and crash reports, since a bug may live in either.

When the vendor ships two native SDKs and no plugin, the game writes one adapter per platform behind the same interface, and the composition root picks one. The two meet at the interface and at the contract suite of [[#platform-testing]], which runs the same abstract tests against the Android adapter on an Android device and against the iOS adapter on an iPhone. That suite is what keeps two implementations in two languages equivalent, and it is the first thing to run when either changes.

A feature that exists on one platform gets a capability query: a property or method of the interface that says whether the feature is available here. The tracking prompt of [[#sdk-consent-init]] is an example: [[App Tracking Transparency]] is part of iOS, and an Android build has no such prompt to show. The consent screen asks the interface, and each implementation answers:

```csharp
public interface ITrackingAuthorization
{
    // Whether this device has a tracking prompt at all. Screens ask this; they do not check the platform.
    bool IsAvailable { get; }
    Task<TrackingStatus> RequestAsync(CancellationToken cancel);
}

// Android, the Editor by default, and any build where the feature is switched off.
public sealed class NoTrackingPrompt : ITrackingAuthorization
{
    public bool IsAvailable => false;
    public Task<TrackingStatus> RequestAsync(CancellationToken cancel) => Task.FromResult(TrackingStatus.NotApplicable);
}
```

A capability query knows more than the platform does. Availability can depend on the device, such as an Android device without Google Play services, which [Google's setup guide](https://developers.google.com/android/guides/setup) says devices without the Play Store lack, for a feature that needs them, on a remote switch, on the player's region, or on what the Editor's simulator is set to report. A `#if UNITY_IOS` knows none of that, and scattered through screens it multiplies, as [[#platform-composition]] describes. The query also makes the missing branch testable: the simulator reports the feature as missing, and the screen's other path runs in the Editor.

Behavior that differs gets normalized in the adapter, and the contract says what the game can rely on. Threads are the common case: an SDK may call back on the main thread on iOS and on a thread of its own on Android, and both adapters deliver on Unity's main thread, as [[#platform-results-threads]] requires. Limits are another. Both stores offer a prompt that asks the player to rate the game without leaving it, and each store decides whether it appears: as checked in September 2026, StoreKit shows it at most three times within 365 days, and [Google Play's in-app review](https://developer.android.com/guide/playcore/in-app-review) applies a quota whose value is an implementation detail that can change without notice. A request is therefore not a display, so the game's interface reports that the request was made, not that the player saw it, and the game does not thank a player for a rating it cannot see. Timing is the third: an SDK whose start is synchronous on one platform and asynchronous on the other gets one asynchronous `InitializeAsync` in the interface.

Between an adapter and a large native SDK there is one more choice. The adapter can call the SDK's API from C#, one `AndroidJavaObject` call or one `DllImport` per native method, or the team can write a small native shim of its own, with the handful of functions the game needs, in Java on Android and in Objective-C on iOS, and call that. The shim is usually easier to keep correct, for four reasons:

- Fewer [[JNI]] calls. An operation built from a builder, three option objects and a callback crosses JNI for each call and each object, and each crossing looks its method up by name ([[#android-java-calls]]); [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/android-call-java-kotlin-code-best-practices.html) calls JNI resource intensive and slow. The shim's call crosses once.
- A typed boundary. The shim takes strings, numbers and JSON, and the SDK's builders, enums and listener interfaces stay on the native side. On iOS, `DllImport` reaches C functions and not Objective-C methods ([[#ios-native-calls]]), so a C layer exists anyway, and the shim is that layer written on purpose.
- Simpler keep rules. [[R8]] cannot see C# reaching a Java class by name ([[#gradle-r8-symbols]]). With a shim, one rule keeps the one class that C# names, and the SDK's own rules, which ship in its AAR, cover the rest.
- One place for threads. The shim decides which thread calls the SDK and which thread its callbacks leave on, and the rule is written once instead of at each call. C# still calls the shim from Unity's main thread: a call through `AndroidJavaObject` from a thread of the game's own needs that thread attached to the JVM first, as Unity's reference for the class says.

The Java half of a shim for an analytics SDK:

```java
package com.example.game.analytics;

import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import java.util.Iterator;
import org.json.JSONException;
import org.json.JSONObject;

// The game's own API over the vendor's SDK: the same five functions as the iOS shim.
// VendorAnalytics stands for the SDK's entry class.
public final class AnalyticsShim {
    // Every call reaches the SDK on the UI thread, in the order C# made them.
    private static final Handler ui = new Handler(Looper.getMainLooper());

    private AnalyticsShim() {}

    public static void start(Context context, String configJson) {
        Context app = context.getApplicationContext();
        ui.post(() -> VendorAnalytics.start(app, configJson));
    }

    public static void setCollectionEnabled(boolean enabled) {
        ui.post(() -> VendorAnalytics.setCollectionEnabled(enabled));
    }

    public static void setUserId(String id) {
        ui.post(() -> VendorAnalytics.setUserId(id));
    }

    public static void logEvent(String name, String paramsJson) {
        Bundle params = toBundle(paramsJson);
        ui.post(() -> VendorAnalytics.logEvent(name, params));
    }

    public static void flush() {
        ui.post(VendorAnalytics::flush);
    }

    private static Bundle toBundle(String json) {
        Bundle bundle = new Bundle();
        try {
            JSONObject object = new JSONObject(json);
            for (Iterator<String> keys = object.keys(); keys.hasNext(); ) {
                String key = keys.next();
                Object value = object.get(key);
                if (value instanceof Integer || value instanceof Long) bundle.putLong(key, ((Number) value).longValue());
                else if (value instanceof Number) bundle.putDouble(key, ((Number) value).doubleValue());
                else bundle.putString(key, String.valueOf(value));
            }
        } catch (JSONException e) {
            bundle.putString("shim_error", "invalid_parameters");
        }
        return bundle;
    }
}
```

C# reaches either half through one small interface, and the adapter above it turns a `GameEvent` into the JSON it takes:

```csharp
// The shim's five functions, the same on both platforms.
internal interface IAnalyticsShim
{
    void Start(string configJson);
    void SetCollectionEnabled(bool enabled);
    void SetUserId(string id);
    void LogEvent(string name, string paramsJson);
    void Flush();
}

#if UNITY_ANDROID && !UNITY_EDITOR
internal sealed class AndroidAnalyticsShim : IAnalyticsShim
{
    private readonly AndroidJavaClass shim = new AndroidJavaClass("com.example.game.analytics.AnalyticsShim");

    public void Start(string configJson) => shim.CallStatic("start", AndroidApplication.currentActivity, configJson);
    public void SetCollectionEnabled(bool enabled) => shim.CallStatic("setCollectionEnabled", enabled);
    public void SetUserId(string id) => shim.CallStatic("setUserId", id);
    public void LogEvent(string name, string paramsJson) => shim.CallStatic("logEvent", name, paramsJson);
    public void Flush() => shim.CallStatic("flush");
}
#elif UNITY_IOS && !UNITY_EDITOR
internal sealed class IosAnalyticsShim : IAnalyticsShim
{
    [DllImport("__Internal")] private static extern void AnalyticsShim_Start(string configJson);
    [DllImport("__Internal")] private static extern void AnalyticsShim_SetCollectionEnabled([MarshalAs(UnmanagedType.U1)] bool enabled);
    [DllImport("__Internal")] private static extern void AnalyticsShim_SetUserId(string id);
    [DllImport("__Internal")] private static extern void AnalyticsShim_LogEvent(string name, string paramsJson);
    [DllImport("__Internal")] private static extern void AnalyticsShim_Flush();

    public void Start(string configJson) => AnalyticsShim_Start(configJson);
    public void SetCollectionEnabled(bool enabled) => AnalyticsShim_SetCollectionEnabled(enabled);
    public void SetUserId(string id) => AnalyticsShim_SetUserId(id);
    public void LogEvent(string name, string paramsJson) => AnalyticsShim_LogEvent(name, paramsJson);
    public void Flush() => AnalyticsShim_Flush();
}
#endif
```

The iOS half exports the same five functions from an Objective-C++ file. Each copies its string arguments before it returns, since the marshaled copies are freed when the call ends ([[#ios-native-calls]]), and then calls the SDK on the [[main queue]]:

```objective-cpp
#import <Foundation/Foundation.h>
#import "VendorAnalytics.h" // VendorAnalytics stands for the SDK's entry class.

extern "C" void AnalyticsShim_LogEvent(const char* name, const char* paramsJson)
{
    // Copy both strings now: the marshaled arguments are freed when this call returns.
    NSString* eventName = [NSString stringWithUTF8String:name];
    NSData* json = [NSData dataWithBytes:paramsJson length:strlen(paramsJson)];

    // Every call reaches the SDK on the main queue, in the order C# made them.
    dispatch_async(dispatch_get_main_queue(), ^{
        NSDictionary* params = [NSJSONSerialization JSONObjectWithData:json options:0 error:nil];
        [VendorAnalytics logEventWithName:eventName parameters:params];
    });
}
```

With minification on, the one keep rule is the shim's, in the plugin's consumer rules or the game's `proguard-user.txt`:

```text
# Called from C# by name.
-keep class com.example.game.analytics.AnalyticsShim { public static *; }
```

Exercise: Sketch a five-function shim API for one SDK in a project you know, the same on both platforms. For each function, write the thread it calls the SDK on and the thread its result comes back on.

?? sdk-native-shim A Unity game calls a large Android SDK from C#, building a request from a builder, three option objects and a listener. What does a small Java shim with the game's own five functions improve?
* Fewer JNI crossings, a typed boundary, one keep rule, one place for threads
- The SDK's own methods run faster, since Java calls them without crossing JNI at all
- The C# adapter goes away, since the shim implements the game's interface directly
- The SDK's permissions stay out of the merged manifest, since the shim alone is linked
- IL2CPP compiles the shim into the game's native library, which removes the bridge
> Each `AndroidJavaObject` call crosses JNI and looks its method up by name, so a request assembled from a builder, options and a listener crosses many times. The shim assembles it in Java and offers one call per operation, with strings, numbers and JSON at the boundary. C# then names one class, which one keep rule protects from R8, and the shim decides which thread calls the SDK. The C# adapter still maps to the game's types, and the SDK's manifest still merges.

?+ C# reaches an SDK through a shim class. With minification on, which Java classes need a keep rule of the game's own?
* The shim, which C# names through JNI, while the SDK's rules cover its classes
- Each SDK class the shim calls, since R8 does not follow calls made from a shim
- None of them, since R8 leaves a plugin's source files as they are written
- The SDK's entry classes, while the shim needs none because it is the game's code
> R8 follows Java calling Java, so the SDK classes the shim uses stay reachable through the shim. What it does not see is C# reaching a class by name through JNI, so the shim, the one class C# names, needs a rule. The SDK's own keep rules come with its AAR and apply in each build that includes it, and plugin sources are shrunk like any other code.

?+ An SDK requires its methods to be called on Android's UI thread, and the game calls it from Unity's main thread. Where does the switch between threads belong?
* In the shim, which posts each call to the UI thread before it calls the SDK
- In each gameplay call site, which wraps its call in a dispatch to the UI thread
- Nowhere, since Unity's main thread is Android's UI thread in a Unity app
- In the C# adapter, which calls the SDK from a `Task.Run` worker instead
> Unity's main thread is not Android's UI thread ([[#android-runtime-model]]), so something has to move the call. The shim is the one place that sees each call to the SDK, so the rule is written there once, with a handler for the main looper that also keeps the calls in order. Call sites that each dispatch spread the rule, and a worker thread is a third thread, not the UI thread.

?? sdk-capability-query App Tracking Transparency's prompt exists on iOS and not on Android. How should the consent screen decide whether to show its explanation before the system prompt?
* It asks the tracking interface whether the prompt is available on this device
- It wraps the explanation in `#if UNITY_IOS`, since the prompt is a feature of iOS
- It compares `Application.platform` with `RuntimePlatform.IPhonePlayer`
- It requests the prompt on both platforms and catches the exception Android throws
- It reads the operating system's version and shows the screen above a set number
> A capability query puts the decision in the implementation that knows: the iOS adapter reports the prompt as available, and the Android implementation reports it as missing. The same query answers what a platform check misses, such as a feature switched off remotely or the Editor's simulator. Platform conditionals in screens multiply, and a call that is expected to fail uses an exception as a question.

?+ A feature needs a service that some Android devices do not have. Where does the game learn that the service is missing on the device it runs on?
* From the capability query, which the Android adapter answers at run time
- From `#if UNITY_ANDROID`, which marks the builds whose devices have the service
- From the merged manifest, which lists the services the device provides
- From the first call's failure, which the game shows the player as an error
> Whether a device has a service is known on the device, at run time, so the adapter that talks to the service answers the capability query there. A compile-time symbol describes the build and the manifest describes the app, and neither knows the device. A failed call is a late and confusing way to learn it, and the screen that made it has already been shown.

?+ How does a team test the screen that appears where a capability is missing, without a device that lacks it?
* Set the Editor's simulator or a fake to report the capability as missing
- Build for the other platform, where the Editor reports the capability as missing
- Add an `#if` for the Editor that hides the feature while the tests run
- Wait for the device run of the contract suite, which covers both branches
> Because the screen asks a capability query, the answer comes from whichever implementation the composition root chose. In the Editor that is a simulator or a fake, which can be set to report the capability as missing, so the screen's other branch runs in Edit Mode or Play Mode tests. A device run covers the devices it has, and a conditional that hides the feature tests nothing.

## Upgrade an SDK safely {#sdk-upgrades}

An SDK upgrade changes code the team did not write, inside a build that works. The procedure keeps each change small, and makes it observable before most players receive it:

1. Read the changelog and the migration guide, looking for changed behavior, new permissions, raised minimum versions and deprecated calls.
2. Upgrade one SDK per change. Two SDKs upgraded together share every symptom, so a crash that follows cannot be assigned to either. Shared dependencies make this sharper: upgrading one SDK can move a library that another SDK also uses, since [[Gradle]] picks the highest version any library requests ([[#gradle-dependencies]]).
3. Diff the build, as the evaluation in [[#sdk-evaluation]] did: the dependency graph, the merged manifest, the `Info.plist`, the privacy manifest, the size and the minimum OS version.
4. Run the contract tests of [[#platform-testing]] and a smoke test of a release-configured build on a device, since [[R8]], [[stripping]] and signing act only there.
5. Stage it through the stores' test tracks, internal testing on Google Play and [[TestFlight]] on iOS, before any production release.

Then the release reaches a fraction of players first. Google Play's [[staged rollout|staged rollouts]] send an update to a percentage of users that the team raises over time ([Google's help page](https://support.google.com/googleplay/android-developer/answer/6346149?hl=en)). The App Store's [phased release](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases) spreads an update over seven days to a random sample of players who have automatic updates on, and it can be paused, while any player can still update by hand. What to watch is decided before the rollout starts, together with the value that halts it: crash-free users for the new SDK version, the [[ANR]] rate on Android, and the business metric the SDK carries, such as purchase success for a store SDK or completed sign-ins for an authentication SDK. The stores' own lines sit further out: as checked in September 2026, Google Play's [[Android vitals]] flag an app when 1.09% of its daily active users meet a [user-perceived crash](https://developer.android.com/google/play/vitals/crash), or 0.47% a [user-perceived ANR](https://developer.android.com/google/play/vitals/anr), and a rollout halts well before either. Crash-free users per SDK version needs the version in each crash report, which is why the adapter reports it ([[#sdk-platform-differences]]).

A remote switch can stop the game calling an SDK: the composition root reads a flag and picks the implementation that reports the capability as unavailable ([[#platform-composition]]). It cannot remove the SDK's native code from the build that players installed. A native library that crashes as it loads, a content provider that starts the SDK before any C# runs ([[#sdk-consent-init]]), and a [[swizzled]] app delegate method all run whatever the flag says. The switch is still useful for failures in calls the game controls, but a rollback of the native code means a new build: the previous SDK version, a higher version number, review, and the rollout again. There is no way back to the old build on a device: Android refuses to install an APK whose `versionCode` is lower than the installed one ([Android's versioning guide](https://developer.android.com/studio/publish/versioning)), and halting a staged rollout stops new deliveries while the players who already updated keep the version.

Versions are pinned, so the build that was tested is the build that ships. Each dependency names an exact version, never a dynamic one such as `7.+` or a range, which [Gradle's documentation](https://docs.gradle.org/current/userguide/dependency_locking.html) warns can break a build unexpectedly because the version that resolves changes over time, and which Android lint reports as `GradleDynamicVersion`. Lock files record what resolved and go into version control: `gradle.lockfile` for Gradle ([[#gradle-dependencies]]), `Podfile.lock` for [[CocoaPods]] ([[#xcode-cocoapods]]), and `Packages/packages-lock.json`, where Unity's Package Manager stores each successful resolution, for Unity's packages. Each SDK's version is part of the build's identity as well: printed in the build log, and set as metadata in the crash reporter, so any crash can be matched to the SDK versions that produced it.

Some upgrades are not the team's choice. As checked in September 2026, Google Play requires new apps and updates to [target Android 16](https://developer.android.com/google/play/requirements/target-sdk), API level 36; [[App Store Connect]] [accepts uploads](https://developer.apple.com/news/upcoming-requirements/) built with Xcode 26 or later and an SDK from the 26 releases; and each version of the Play Billing Library has a [two-year deprecation cycle](https://developer.android.com/google/play/billing/deprecation-faq). Each arrives with a date, announced months ahead, and an SDK that has not been updated for it blocks the game's own update. A calendar of the known dates, checked each quarter against each SDK's release notes, turns them into planned work.

Exercise: Write the upgrade checklist for your riskiest SDK, with the metric that halts its rollout and the value at which it halts.

?? sdk-upgrade-one-at-a-time A release is due and three SDKs have updates. Why does the team upgrade them in three separate changes rather than one?
* A regression then points to one SDK, and a revert keeps the other two upgrades
- Gradle resolves one changed dependency per build, and would skip the other two
- The stores review one SDK change per release, so three would hold up the release
- Each SDK's license requires its upgrade to be tested and approved on its own
> Three upgrades in one change share each symptom that follows, so a new crash or a drop in a metric cannot be assigned to one of them, and the fix is to revert all three. One upgrade per change makes each regression point at its cause, and a revert undoes only that one. Gradle and the stores impose no such limit; the rule exists for diagnosis.

?+ After one SDK is upgraded, a second SDK that nobody touched starts to crash. What is the likely link?
* The upgrade raised a library both SDKs use, and Gradle picked the newer one
- The untouched SDK checks the upgraded one's version at run time and refuses it
- The upgrade reset the untouched SDK's settings in the Unity project
- Unity rebuilt the untouched SDK's native code with the new SDK's compiler flags
> SDKs share dependencies, and when two of them request different versions of one library, Gradle resolves the highest. Upgrading one SDK can therefore move a library underneath the other, which was built and tested against the older version. The dependency diff of the upgrade shows the move, which is one reason each upgrade gets one.

?? sdk-remote-switch A new SDK version crashes for some players, and the game has a remote flag that stops it calling the SDK. What does turning the flag on fix?
* Crashes in calls the game makes, and not the native code that runs without them
- All of the SDK's crashes, since the flag removes the SDK from the app
- All of the SDK's crashes, once players restart and the flag is read
- Nothing, until the store installs the previous version on the players' devices
> A flag changes which implementation the composition root picks, so the game stops calling the SDK. The SDK's native code is still in the installed app, and what runs without a call from the game still runs: a library that crashes as it loads, a content provider that starts the SDK, a swizzled delegate method. And Android refuses to install an APK whose version code is lower than the installed one.

?+ An SDK version crashes in its native start-up code, before the game calls it. How does the team roll it back?
* Ship a new build with the previous SDK version and a higher version number
- Use the store's rollback, which reinstalls the previous build on players' devices
- Turn on a remote flag that makes the game load the old version's library instead
- Halt the staged rollout, which returns updated players to the previous build
> The crash happens before any game call, so no flag in the game can stop it, and the app cannot load a library that the installed build does not contain. Halting a rollout stops new players from receiving the version, and players who already have it keep it. The fix is a new build with the old SDK, numbered above the broken one, released like any other.

?+ Can a remote configuration flag stop an Android SDK that a content provider starts before any C# runs?
* No: the provider runs as the process starts, before any flag is read
- Yes: the Unity player reads remote flags before Android creates any provider
- Yes, if the flag is cached on disk from the previous session
- No: remote configuration waits for consent, which comes after the provider
> Android creates an app's content providers before its first activity, and the SDK's provider starts it there, before Unity's player has loaded any C#. A cached flag is read by C# as well, so it arrives just as late. The SDK's own switch, such as a manifest setting that keeps it off until the game turns it on, is what reaches that early.

## When SDKs collide {#sdk-conflicts}

Two SDKs that each work alone can fail together, because a process has some resources that only one party can hold. Earlier chapters met most of them:

| Collision | Where the book covers it |
| --- | --- |
| Two versions of one library, or two copies of one class | [[#gradle-dependencies]] and [[#xcode-cocoapods]] |
| Two subclasses of Unity's activity | [[#android-activity-integration]] |
| Two app controller subclasses, and [[swizzled]] delegate methods | [[#ios-xcode-postprocess]] |
| Conflicting manifest attributes | [[#gradle-manifest-merge]] |
| Two post-processors writing one `Info.plist` key | [[#ios-xcode-postprocess]] |

Three more belong to SDKs in particular.

**Crash handlers.** A crash reporter learns of a crash through handlers that the process holds one of each. A native signal has one action, which `sigaction` sets while returning the action it replaced (`man 2 sigaction`); Java has one [default handler](https://developer.android.com/reference/java/lang/Thread) for uncaught exceptions, set with `Thread.setDefaultUncaughtExceptionHandler`; and Objective-C has one uncaught-exception handler, set with `NSSetUncaughtExceptionHandler`. A second reporter that installs its handlers replaces the first one's, and the first hears crashes only if the second calls the handler it replaced. Unity's player takes part too. In 6000.3.11f1, its Android `UnityPlayer` class installs a default handler that keeps the one it found and calls it after its own work, and the iOS Trampoline's `CrashReporter.mm` does the same for Objective-C exceptions when its handler is enabled. So the handler that a crash reporter finds may already be Unity's, and chaining is what keeps both working. Chaining looks like this in Java: the new handler keeps the one it found, records the crash, and hands it on.

```java
package com.example.game.crash;

// Records a crash, then hands it to whichever handler was installed before this one.
public final class ChainingCrashHandler implements Thread.UncaughtExceptionHandler {
    private final Thread.UncaughtExceptionHandler previous;

    private ChainingCrashHandler(Thread.UncaughtExceptionHandler previous) {
        this.previous = previous;
    }

    public static void install() {
        Thread.setDefaultUncaughtExceptionHandler(
            new ChainingCrashHandler(Thread.getDefaultUncaughtExceptionHandler()));
    }

    @Override
    public void uncaughtException(Thread thread, Throwable error) {
        try {
            CrashLog.write(thread, error); // To disk only: the process is about to end.
        } finally {
            if (previous != null) previous.uncaughtException(thread, error);
        }
    }
}
```

Which handler holds the slot after start-up can be read from C#, which is a quick check after adding an SDK:

```csharp
#if UNITY_ANDROID && !UNITY_EDITOR
using var thread = new AndroidJavaClass("java.lang.Thread");
using var handler = thread.CallStatic<AndroidJavaObject>("getDefaultUncaughtExceptionHandler");
Debug.Log($"Default uncaught exception handler: {handler?.Call<AndroidJavaObject>("getClass").Call<string>("getName")}");
#endif
```

A game needs one crash reporter. Two that chain correctly still both run inside a process that has already failed, where each extra step is a chance to fail again, and they report the same crash twice, to two places, with two sets of symbols to upload.

**Push.** On iOS, `UNUserNotificationCenter` has one `delegate`, which [Apple's documentation](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/delegate) says to set before the app finishes launching. Unity's Mobile Notifications package is already a claimant: version 2.5.0 makes itself that delegate as the app finishes launching. On Android, Firebase Cloud Messaging delivers messages to a service that declares the `com.google.firebase.MESSAGING_EVENT` action, and when more than one service matches an intent that names none in particular, [Android's reference](https://developer.android.com/reference/android/content/Context) says that any of them may be used. Two SDKs that each handle push, such as a push service and a customer-messaging SDK, compete for that one delegate and that one service, and the loser receives nothing, with no error.

**The main thread at start-up.** Each SDK's start costs a little on the main thread, and the costs add up. Five SDKs that each take a fifth of a second there make a second of launch, and the main thread is blocked for the sum: with enough SDKs, long enough for an unanswered input to become an [[ANR]] on Android, or for the watchdog to end a slow launch on iOS ([[#ios-failure-evidence]]).

The method is the same for each collision:

1. Find the shared resource: the one slot, handler, delegate, service, key or thread that both SDKs want.
2. Choose one owner: one SDK, or the game's own code.
3. Route the others through the owner. The owner receives each event and passes it to the SDK it belongs to, through the method that SDK documents for being handed events by the app, with that SDK's own handling turned off.
4. Escalate to the vendors with a minimal reproduction: an empty project with the two SDKs and nothing else, which takes the game out of the question.
5. Write the decision down where the next upgrade will find it: which component owns which resource, and why.

Exercise: List every process-wide resource that the SDKs in a project you know touch, such as crash handlers, push callbacks, the application delegate, the activity and the main thread at start-up, with the owner of each.

?? sdk-single-owner Two SDKs both need push notifications on Android, and each declares its own messaging service for them. What does the team do?
* One service owns the messages and passes each to the SDK it is for
- Keep both services, since Android hands each message to each matching service
- Give the two services different priorities, so each message reaches both in turn
- Merge the two manifests with `tools:node="replace"`, which keeps both handlers
> When more than one service matches the messaging action, Android uses one of them, so the other SDK's service receives nothing, and giving both a place in the manifest does not change that. One service owns the messages, and it passes each one to the SDK it belongs to, through the method that SDK documents for being handed a message by the app. The decision, and the reason for it, is written down where the next upgrade of either SDK will find it.

?+ A game uses Unity's Mobile Notifications package and adds a push SDK that also makes itself the `UNUserNotificationCenter` delegate at launch. What happens?
* The last one set is the delegate, and the other stops getting callbacks
- iOS keeps both delegates and calls each in the order they were set
- The second assignment raises an exception, and the app stops at launch
- Each one receives the callbacks for the notifications that it scheduled or sent
> The notification center has one `delegate` property, and Mobile Notifications 2.5.0 sets it as the app finishes launching, as the push SDK does. Setting it again replaces the earlier value without an error, so whichever set it first stops hearing about notifications, silently. One component owns the delegate and forwards each notification to the SDK it belongs to.

?+ Two SDKs collide over something the process has one of. What comes first?
* Finding the shared resource, then choosing one owner that the others go through
- Upgrading both SDKs to their newest versions, which tend to resolve conflicts
- Removing whichever SDK was added last, since it introduced the conflict
- Asking both vendors to change their SDKs, and waiting for their releases
> A collision is two SDKs wanting one slot, handler, delegate, service or key. Naming it shows what has to have a single owner, and the owner then routes events to the others. Newer versions may collide the same way, the last SDK added is not necessarily the one at fault, and vendors act faster on a minimal reproduction than on a report that two SDKs do not get along.

?? sdk-crash-handlers A game adds a second crash reporter, and the first one stops reporting native crashes. What is the likely cause?
* The second replaced the first's signal handlers and does not call them
- The OS delivers each crash signal to the crash reporter that registered first
- The first reporter's symbols no longer match the build, so its reports are discarded
- The OS stops sending crash signals to an app that registers two handlers
> A process holds one action per signal, and installing a handler replaces the one before it. The earlier reporter hears a crash only if the later one saved the handler it replaced and calls it. Symbols affect how a report is read, not whether it is made.

?+ What does a crash handler have to do so that the handler installed before it still hears crashes?
* Keep the handler it replaced, and call it after recording the crash
- Install itself before the other handler, so that both stay registered
- Handle different signals from the other handler, so that the two do not overlap
- Upload its report before it returns, so the other handler has nothing to do
> Installing a handler replaces the one in the slot. To keep the other one working, the new handler reads the old one as it installs, records the crash, and then calls the old handler, which is what chaining means. Order alone does not help, since the later one replaces the earlier, and a crash arrives as whichever signal it is.

?+ On Android, an SDK passes its own handler to `Thread.setDefaultUncaughtExceptionHandler`. What happens to the default handler set before it?
* It is replaced, and runs if the new handler calls it, and not otherwise
- It keeps running, since each thread keeps its own list of handlers
- It runs first, since the earlier handler takes priority over later ones
- It moves to a backup slot that Android calls if the new handler fails
> The default handler is one value for the process, used for any thread without a handler of its own, so setting it replaces the one before. An SDK that wants the earlier one to keep working reads it with `getDefaultUncaughtExceptionHandler` before setting its own, and calls it after recording the crash.
