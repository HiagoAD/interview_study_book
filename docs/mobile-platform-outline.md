# Outline: The Platform Layer

The specification for the second book. [PLAN.md](PLAN.md), under “Feature: second book”, says
how the phases write it and holds the rules every chapter follows. This file says what each
chapter teaches and tests.

Every factual statement below is a claim for the phase to check, not evidence. Where a check
contradicts the outline, the evidence wins and the phase log says what changed. A few claims were
checked while planning, on 2026-09-23, and say so with their source; the phase still quotes the
source when it writes the sentence.

## Scope and reader

The book covers the layer between a Unity game and the platforms it ships on. Read left to right,
one operation's path is:

```text
game code -> game-owned interface -> adapter -> bridge (JNI or P/Invoke) -> native SDK -> OS -> network -> backend
```

Every chapter works on one or two links of that path, and chapter 12 walks all of it. The reader
knows Unity and C# at the level of the first book, *The Game Layer*, and has little hands-on
experience with Gradle, Xcode, native plugins or CI. The book teaches enough Java and Objective-C
to read and write a thin bridge, not enough to be an Android or iOS app developer, and it goes as
deep as an interview for a Unity mobile platform role goes: mechanisms, decisions, and how to
debug across the boundary.

The worked example is an imaginary live mobile game with the integrations a platform team
maintains: sign-in, purchases, push notifications, deep links, analytics, crash reporting, remote
configuration, and its own backend. Its genre is incidental and never named.

The interview themes, by weight, and the chapters that carry them:

| Theme | Chapters |
| --- | --- |
| Native Android and iOS integration | 2, 3, 4, with crash evidence in 2 and 3 |
| Third-party SDK integration | 7, building on 1, 5 and 6 |
| Build and release pipeline | 5, 6, 10 |
| Backend and API clients | 8, 9 |
| Debugging across boundaries | 12, using everything before it |
| C# architecture at the boundary | 1 |
| CI/CD and Jenkins | 11 |
| Interview practice | 13 |

## Totals

| Chapter | File | Sections | Concepts |
| --- | --- | --- | --- |
| 01: The platform layer and the call path | `01-platform-layer.md` | 6 | 12 |
| 02: Calling Android from C# and back | `02-android-bridge.md` | 6 | 12 |
| 03: Calling iOS from C# and back | `03-ios-bridge.md` | 6 | 12 |
| 04: Lifecycle, permissions, links, notifications, and sign-in | `04-os-integration.md` | 5 | 10 |
| 05: Android builds: Gradle, manifests, and dependencies | `05-android-builds.md` | 5 | 11 |
| 06: iOS builds: Xcode, signing, and CocoaPods | `06-ios-builds.md` | 4 | 8 |
| 07: Integrating third-party SDKs | `07-sdk-integration.md` | 6 | 12 |
| 08: Backend clients: HTTP, sessions, and data contracts | `08-backend-clients.md` | 5 | 10 |
| 09: Reliable requests on unreliable networks | `09-reliable-networking.md` | 5 | 10 |
| 10: Build variants, environments, and releases | `10-variants-and-releases.md` | 5 | 10 |
| 11: CI/CD and Jenkins for Unity mobile builds | `11-ci-and-jenkins.md` | 6 | 12 |
| 12: Debugging across boundaries | `12-debugging-across-boundaries.md` | 5 | 10 |
| 13: Interview practice for platform roles | `13-interview-practice.md` | 4 | 7 |
| All | 13 files, plus `glossary.md` | 68 | 136 |

The chapter titles are the front matter's `chapter:` values. Section and concept ids are
proposals until the phase that writes them commits: a phase may rename or replace one, and says so
in its log. After that commit they are progress and never change.

Each section below lists what it must teach, the concepts it tests (one idea each), the evidence
its claims need beyond the defaults in PLAN.md, and an idea for its closing exercise.

## 01: The platform layer and the call path

### How to study the platform layer {#platform-study-method}

- The call path above, and which layer owns which evidence. The preparation table above, in the
  book's words.
- Reference versions: Unity 6.3 LTS (6000.3) and the Android and Xcode toolchains the phases
  checked against. Platform facts carry the version or date they were checked against, and the
  questions avoid them.
- The book assumes the first book, *The Game Layer*, and recaps what it needs in a paragraph,
  naming the chapter in plain text. The first book's title is set in italics, so it does not read as
  the phrase “the game layer”.
- What an answer to “how would you integrate X” covers besides API calls: threads, lifecycle,
  permissions and privacy, build impact, rollout, verification. Saying “I have not shipped that;
  here is how I would find out” is a legitimate answer, as in the first book.
- The imaginary game and its integrations, with the first book's disclaimer: the requirements are
  invented, and the book makes no claims about the internals of any commercial game.

Test: `platform-call-path` (given a symptom, which layer can produce the evidence);
`platform-integration-scope` (what belongs to an integration beyond calling the SDK).
Exercise: draw the call path for one integration you know, with one piece of evidence per layer.

### Own the interface: adapters and facades at the SDK boundary {#platform-interfaces}

- The game defines capability interfaces in its own terms (`IAnalytics`, `IAuthService`,
  `IPurchaseService`), and no vendor type appears in gameplay assemblies.
- Adapter converts one interface into another; Facade puts a small interface over a large
  subsystem. An SDK wrapper is usually both. “Anti-corruption layer” is the name for keeping a
  vendor's model out of the domain.
- Mapping rules live in the adapter: vendor results to game results, vendor errors to game error
  categories, vendor threading to the game's threading guarantee.
- Enforce it at compile time: only the adapter's assembly definition references the vendor's.
- Costs: the interface lags the SDK's features, and one vendor enum exposed “just this once”
  undoes the boundary. Keep the interface to what the game uses, not a lowest common denominator.

Test: `platform-adapter-facade`; `platform-vendor-types` (what vendor types outside the wrapper
cost: replaceability, tests, the size of an upgrade).
Exercise: list every vendor type that appears outside its wrapper in a project you know.

### Choose implementations at the composition root {#platform-composition}

- One place decides which implementation serves each capability: Android adapter, iOS adapter,
  Editor simulator, test fake, or a no-op when the feature is off or unsupported. Recap dependency
  injection and the composition root from the first book in a paragraph.
- Platform conditionals (`#if UNITY_ANDROID && !UNITY_EDITOR`, `Application.platform`) stay in the
  composition root and the adapter assemblies. An assembly definition's platform list compiles
  Android-only code only for Android.
- Strategy for behavior that differs by platform inside one capability.
- An Editor simulator exposes success, failure, cancellation and the unknown outcome. A vendor's
  Editor stub that always succeeds hides every path but one.

Test: `platform-conditional-scope` (where platform branches belong, and what spreading them
costs); `platform-editor-simulator`.
Exercise: find a platform conditional outside a composition root and move it.

### Results, errors, and threads at the boundary {#platform-results-threads}

- A game-owned result: succeeded, cancelled, unavailable, failed with a reason, unknown. Recap the
  first book's purchase result in a sentence and generalize it.
- Exceptions do not cross a native boundary. A Java exception during a C# call arrives as
  `AndroidJavaException`. A managed exception thrown from a callback that native code invoked must
  be caught in the callback (verify what IL2CPP does otherwise).
- Callback APIs become awaitable operations through `TaskCompletionSource` or Unity 6's
  `AwaitableCompletionSource`: `TrySet*` for a callback that can arrive twice, a timeout for one
  that never arrives, and a cancellation registration.
- Native callbacks arrive on arbitrary threads. Unity APIs need the main thread, so marshal with a
  queue drained on the main thread, a `SynchronizationContext`, or `Awaitable.MainThreadAsync()`
  (all present in 6000.3's `UnityEngine.CoreModule.dll`, checked while planning).
- The adapter's contract says which thread completes, whether completion can happen twice, and
  what happens after the caller is gone.

Test: `platform-callback-completion` (duplicate and missing callbacks); `platform-callback-thread`.
Evidence: a dotnet 8 probe for the completion-source behavior.
Exercise: write the contract for one native callback: thread, number of calls, lifetime, and what
happens when it never arrives.

### Events from the platform: early, repeated, and late {#platform-events}

- Events the OS starts: a deep link opens the app, a notification is tapped, the push token
  changes, auth state changes, pending purchases are delivered at launch, the app pauses, memory
  runs low.
- Observer at the boundary. At cold start an event can arrive before anything subscribes, so the
  boundary buffers it (the last value, or a queue) and delivers it once the game can act on it.
- Repeated delivery is handled by identity, not a boolean. Late delivery after the owner is gone
  is a lifetime question: recap the first book's event-lifetime section in a sentence.
- A router decides when an event may act, such as never in the middle of a run or a tutorial.

Test: `platform-early-event`; `platform-event-identity`.
Exercise: list the platform events your game receives and what happens when each arrives before
the game is ready.

### Test the boundary without a device, then on one {#platform-testing}

- Game logic against fakes in the Editor. Adapter mapping tests that replay recorded vendor
  payloads and assert the game's results. Contract tests: one suite runs against the fake and, on a
  device, against the real implementation, so the fake cannot drift. Device smoke tests on a
  release-configured build for what only a device shows.
- What the Editor never exercises: native code, IL2CPP and stripping, R8, OS permissions, the real
  lifecycle, the real callback threads.
- Sanitized payload fixtures per SDK version make an upgrade's difference visible.

Test: `platform-contract-tests`; `platform-device-evidence` (which failure only a device run shows).
Exercise: pick a fake in a project and write one behavior of the real SDK it does not model.

## 02: Calling Android from C# and back

Evidence for the chapter: Java snippets compile with the Editor's OpenJDK 17 against
`SDK/platforms/android-36/android.jar` and Unity's `classes.jar`; claims about the generated
project come from the probe project's Gradle export, which Phase 20 creates.

### What runs where in a Unity Android app {#android-runtime-model}

- One process, an activity, and the player's native libraries. The application entry is
  `UnityPlayerActivity` or `UnityPlayerGameActivity`: 6000.3's `Apk/UnityManifest.xml` carries both
  blocks and keeps the one Player Settings selects (checked while planning). The 6.3 manual also
  lists a Service entry point; mention it only if a claim needs it.
- The Unity main thread, which runs the game loop, is not the Android UI thread. Android UI work
  must run on the UI thread. The contrast with iOS comes in chapter 3.
- JNI in a paragraph: the Java VM, local and global references, and threads attached to the VM.
- Unity 6's `UnityEngine.Android.AndroidApplication`: `currentActivity`, `InvokeOnUIThread`,
  `InvokeOnUnityMainThread` (present in 6000.3, checked while planning).

Test: `android-two-threads` (a dialog shown straight from the Unity thread fails; which thread it
needs); `android-entry-point` (what the entry point decides for plugins that extend Unity's
activity; verify, and replace the concept if nothing durable is testable).
Exercise: log the thread for a C# call, for the Java method it calls, and for a Java callback, and
draw which thread each runs on.

### AndroidJavaObject, AndroidJavaClass, and the cost of JNI {#android-java-calls}

- Static and instance calls, fields, constructors, and reaching the current activity.
- Methods are found by name and signature at run time. A renamed Java method still compiles in C#
  and fails when called, as an `AndroidJavaException` wrapping the Java error (verify the wording).
- `AndroidJavaObject` holds a JNI global reference. Dispose it; leaked global references exhaust a
  table and crash the process (verify the limit before stating a number).
- Every call crosses JNI. Cache classes and method ids on hot paths, never call per frame, and batch
  data into one call.
- Calls from threads Unity did not create need the thread attached to the VM (verify what Unity 6
  does automatically).

Test: `android-jni-runtime-lookup`; `android-jni-references`.
Exercise: count the JNI calls a feature makes per frame and propose one batching change.

### Callbacks into C#: AndroidJavaProxy and UnitySendMessage {#android-callbacks}

- `AndroidJavaProxy` implements a Java interface in C#. Unity's 6.3 reference, checked while
  planning: “Unity invokes the proxy method on the Java thread that calls the interface method,
  which isn't always the Unity main thread.” It also says `InvokeOnUnityMainThread` “blocks the
  calling thread until the delegate completes and has no effect in the Editor”. Blocking the UI
  thread on the main thread while the main thread waits on the UI thread deadlocks; a non-blocking
  queue avoids it.
- Proxy lifetime: what keeps the C# side alive while Java holds the interface (verify).
- `UnitySendMessage(object, method, message)`: one string argument, a GameObject found by name,
  delivered later on the main thread, and nothing reported when the object is missing (verify each).
- When to use which: the proxy for typed callbacks with explicit threading, `UnitySendMessage` for
  fire-and-forget notices, or when a vendor plugin already uses it.

Test: `android-blocking-dispatch` (the deadlock a blocking dispatch can cause);
`android-sendmessage-limits`.
Lab exercise: implement one callback both ways and list what each needs to be robust.

### Plugin forms: sources, AARs, library folders, and native libraries {#android-plugin-forms}

- Java or Kotlin sources in `Assets`, `.jar`, `.aar` (classes, manifest, resources, native
  libraries, consumer ProGuard rules), `.androidlib` library folders, and `.so` files per ABI.
- The plugin importer's platform and CPU settings. A missing ABI fails only on devices with that
  ABI, as `UnsatisfiedLinkError`.
- Declare Maven dependencies rather than vendoring copies of third-party AARs; chapter 5 shows the
  duplicates that copies cause.

Test: `android-aar-contents` (what an AAR adds to the build that a JAR cannot, such as manifest
entries and permissions); `android-missing-abi`.
Exercise: unzip an AAR from a project and list what it adds to the build.

### Activities, intents, and results without subclassing Unity's activity {#android-activity-integration}

- Older SDKs asked for a subclass of `UnityPlayerActivity` to receive activity results, new intents
  or permission results. Only one activity can launch the game, so two such SDKs conflict.
- Alternatives: `Application.ActivityLifecycleCallbacks`, a transparent helper activity started for
  a result, and SDKs that register their own components (verify which result APIs Unity's
  activities support).
- A link that arrives while the game runs comes through `onNewIntent`, because of the activity's
  launch mode (verify the mode in the generated manifest), and Unity raises
  `Application.deepLinkActivated`.
- Unity declares most configuration changes itself, so rotation does not recreate the activity
  (verify from the generated manifest). Plugins that expect recreation behave differently.

Test: `android-activity-subclass`; `android-new-intent`.
Exercise: find every plugin that extends or edits Unity's activity, and decide which could use
lifecycle callbacks instead.

### When the Android side fails: exceptions, native crashes, and ANRs {#android-failure-evidence}

- A Java exception during a C# call is catchable as `AndroidJavaException`. An uncaught Java
  exception on a Java thread ends the process (`FATAL EXCEPTION` in logcat). A native crash is a
  signal in a `.so` with a tombstone and a backtrace, and `libil2cpp.so` frames are the game's C#
  compiled by IL2CPP. An ANR comes from a blocked UI thread (verify whether a blocked Unity main
  thread alone produces one). A low-memory kill leaves no crash report; Android's exit-reason API
  can tell you afterwards (verify its name and API level).
- Reading logcat: by process, by tag (`Unity`, `AndroidRuntime`, `DEBUG`), and the crash buffer.
- Native frames are symbolized with symbols from the exact build: `ndk-stack` and `llvm-addr2line`
  ship in the Editor's NDK r27c (checked while planning). Chapter 5 produces the symbol files, and
  chapter 11 archives them.

Test: `android-crash-kinds` (from the evidence to the kind of failure); `android-symbols-match`.
Evidence: the NDK tools' own help; Android's documentation for tombstones and ANRs.
Lab exercise: crash a development build three ways (Java exception, native null dereference,
blocked UI thread) and keep the logcat evidence of each.

## 03: Calling iOS from C# and back

Evidence for the chapter: the Trampoline under `PlaybackEngines/iOSSupport/Trampoline`; an Xcode
project generated from the probe project; Objective-C and Swift compiled for the iOS SDK with
Xcode; IL2CPP's generated C++ for marshaling claims.

### What runs where in a Unity iOS app {#ios-runtime-model}

- Unity writes an Xcode project with two targets: `Unity-iPhone`, the app (`main.mm`, launch
  screen, icons, app entitlements), and `UnityFramework` (the player, IL2CPP output, `Classes/`, and
  plugins by default). `UnityAppController` is the application delegate.
- The player loop is driven by a `CADisplayLink` created in `UnityAppController+Rendering.mm`
  (checked while planning), which puts it on the app's main thread. Verify that claim exactly,
  including what multithreaded rendering changes, before contrasting it with Android.
- Plugin sources and binaries go in `Assets/Plugins/iOS` and compile into `UnityFramework` unless
  configured otherwise.

Test: `ios-targets` (which target an app extension, a capability or an SDK resource needs);
`ios-main-thread` (a UI call from a C# callback works on iOS and fails on Android: what the bridge
contract should say).
Lab exercise: generate an Xcode project from an empty scene and list which files belong to each
target.

### DllImport("__Internal") and marshaling {#ios-native-calls}

- `[DllImport("__Internal")]` because IL2CPP links plugins statically, and C linkage for `.mm` and
  `.cpp` files: Unity's 6.3 page `ios-native-plugin-create` says so (checked while planning).
- Blittable types, `bool` (C# marshals a 4-byte BOOL by default, Objective-C's `BOOL` is one byte;
  verify under IL2CPP), strings as UTF-8 `const char*` valid only during the call, returned strings
  as a heap copy the marshaller frees (verify in IL2CPP's generated code), arrays as pointer and
  length, sequential structs, and JSON when the shape is complex.
- Write down who allocates, who frees, and how long a pointer is valid.
- `__Internal` calls fail in the Editor, so the composition root from chapter 1 picks a simulator
  there.

Test: `ios-string-lifetime` (native code keeps a `const char*` argument); `ios-returned-string`.
Exercise: write one function of each kind (string in, string out, struct) with its ownership
comment.

### Callbacks: MonoPInvokeCallback, function pointers, and UnitySendMessage {#ios-callbacks}

- Native code calls C# through a function pointer. Under IL2CPP the target is a static method
  marked `[MonoPInvokeCallback(typeof(T))]`; instance methods and closures cannot be marshaled
  (verify the error).
- To reach an instance, pass a context pointer (`GCHandle.ToIntPtr`) that native code hands back.
  Free the handle on completion and on cancellation; a leak or a use after free follows otherwise.
- The callback runs on whichever thread native code calls from.
- `UnitySendMessage`, declared in `Classes/Unity/UnityInterface.h` (checked while planning), with
  the same limits as on Android.

Test: `ios-static-callback`; `ios-callback-handle`.
Lab exercise: implement a native timer that calls back into C# with a context pointer, and free the
handle on completion and on cancellation.

### Frameworks, xcframeworks, Swift, and Objective-C++ {#ios-frameworks}

- Static libraries, static frameworks, and dynamic frameworks, which must be embedded; a missing
  embed crashes at launch in the dynamic loader (verify the message). An xcframework holds slices
  for device and simulator (verify Unity's support in `Plugins/iOS`).
- `-ObjC` for static libraries with categories: without it, a category method is missing at run
  time.
- Swift plugins: `.swift` files compile into `UnityFramework`, reached from C# through `@_cdecl`
  functions or an `@objc` class behind a C wrapper (verify what Unity 6.3 needs for the Swift
  runtime).
- Objective-C++ (`.mm`) mixes C++ and Objective-C; ARC applies.

Test: `ios-dynamic-embed`; `ios-objc-flag`.
Lab exercise: add a static and a dynamic framework to the probe project, break each as the section
describes, and keep the errors.

### Change the Xcode project from C#: post-processing and app delegate hooks {#ios-xcode-postprocess}

- `IPostprocessBuildWithReport` or `[PostProcessBuild]` runs after Unity writes the project.
  `PBXProject` (`GetUnityMainTargetGuid`, `GetUnityFrameworkTargetGuid`), `PlistDocument` and
  `ProjectCapabilityManager` (push, associated domains, Sign in with Apple, in-app purchase) are all
  in 6000.3's `UnityEditor.iOS.Extensions.Xcode.dll` (checked while planning).
- Hand edits to the generated project are lost on a Replace build, so changes belong in a
  post-processor. An Append build reuses the project, so a post-processor must set rather than add.
  Two SDKs' post-processors are ordered by callback order and can overwrite each other.
- App delegate hooks: `UnityRegisterAppDelegateListener`, `UnityRegisterLifeCycleListener`, and
  notifications such as `kUnityOnOpenURL` and `kUnityDidRegisterForRemoteNotificationsWithDeviceToken`
  (all in `Classes/PluginBase`, checked while planning), rather than subclassing
  `UnityAppController` with `IMPL_APP_CONTROLLER_SUBCLASS`, which allows one subclass. Method
  swizzling by SDKs, and why its order matters.

Test: `ios-postprocess-idempotent`; `ios-app-controller-subclass`.
Lab exercise: write a post-processor that adds a usage description and a capability, build twice
with Append, and diff the project.

### When the iOS side fails: crash reports, terminations, and symbols {#ios-failure-evidence}

- An uncaught `NSException`, with its reason in the report; signals such as `EXC_BAD_ACCESS`;
  watchdog terminations when the main thread does not respond during launch or a lifecycle
  transition (verify the code and the rules); memory terminations with no crash report; the
  termination for a missing usage description; dynamic loader failures.
- Since the player loop runs on the main thread, a long synchronous load at startup is a watchdog
  risk (verify).
- Symbolication needs the dSYMs of the exact build, matched by UUID, including
  `UnityFramework.framework.dSYM` for IL2CPP code. The Trampoline's `process_symbols.sh` is Unity's
  build phase for symbols (read what it does). Crash reports reach the developer through Xcode's
  Organizer for TestFlight and App Store builds.
- Device logs: the Console app and Xcode's device window.

Test: `ios-termination-kinds` (which failure leaves no crash report); `ios-watchdog-launch`.
Lab exercise: crash a development build three ways (exception, bad pointer, blocked main thread at
launch) and symbolicate one report.

## 04: Lifecycle, permissions, links, notifications, and sign-in

### Two lifecycles: the OS's app states and Unity's callbacks {#os-lifecycle}

- Android's activity lifecycle, process death in the background with no final callback, and a
  restart that begins the player from scratch (verify what Unity does with saved instance state).
- iOS's states: not running, inactive, active, background, suspended. A suspended app gets no CPU
  and can be terminated without a callback.
- Unity's callbacks: `OnApplicationPause`, `OnApplicationFocus`, `OnApplicationQuit` (unreliable on
  mobile; recap the first book), `Application.lowMemory`. The order of focus and pause differs by
  platform (record it from probe logs), so nothing may depend on it.
- Native work in the background: timers stop, sockets drop, and queued callbacks arrive in a burst
  on resume (verify how `UnitySendMessage` behaves while paused).
- On pause: flush analytics and persist pending operations. On resume: check permissions again,
  refresh tokens, reconcile purchases, and send the push token again if it changed.

Test: `os-resume-recheck`; `os-lifecycle-order`.
Lab exercise: log every lifecycle callback on both platforms while you background the app, lock
the screen, and swipe it away.

### Permissions and usage descriptions {#os-permissions}

- Android: install-time and runtime permissions, declared in the merged manifest and requested at
  run time. Unity's `Permission` API and `PermissionCallbacks`, whose 6.3 reference lists
  `PermissionGranted`, `PermissionDenied`, `PermissionDeniedAndDontAskAgain` (“or denies the
  permission twice on newer Android versions”) and `PermissionRequestDismissed` (checked while
  planning). Rationale screens, sending the player to Settings, and the notification permission on
  recent Android versions (verify the API level).
- iOS: purpose strings in `Info.plist` are required, and the app is terminated when it touches a
  protected resource without one (verify Apple's wording). One-time prompts, provisional
  notification authorization, and App Tracking Transparency with its own purpose string.
- Ask at the moment of need, treat denial as a normal state, never block core play on an optional
  permission, and check again on resume. A permission a library added without anyone deciding to is
  chapter 5's subject.

Test: `os-permission-denied` (what the app can still do after a permanent denial);
`os-usage-description` (works on Android, terminated on iOS).
Exercise: map each permission your game uses to the moment it is requested and what the game does
when it is denied.

### Deep links and verified links {#os-deep-links}

- Custom schemes, which any app can claim, against verified https links: Android App Links
  (`autoVerify` and `/.well-known/assetlinks.json` with the signing certificate's fingerprint) and
  iOS Universal Links (the Associated Domains entitlement and the `apple-app-site-association`
  file). The fingerprint must be the Play app signing key's, which chapter 5 explains.
- Unity: `Application.absoluteURL` holds the link that launched or activated the app, and
  `Application.deepLinkActivated` is raised when a link arrives while it runs (6.3 reference,
  checked while planning). On iOS, `UnityAppController` sets the URL from `openURL`, from
  `continueUserActivity` for universal links, and from the launch options (Trampoline, checked
  while planning).
- A link is untrusted input: allow-list its routes, and never grant anything from its parameters
  without the server. Route it once the game can act (chapter 1), and expect the same link twice.
- Testing: `adb shell am start -a android.intent.action.VIEW -d <url> <package>` and
  `xcrun simctl openurl booted <url>`.

Test: `os-link-trust`; `os-verified-links` (what a verified link protects that a custom scheme
cannot).
Exercise: send your game a link at cold start, in a menu, and during a run, and record where each
lands.

### Local and push notifications {#os-notifications}

- Local notifications scheduled on the device (Unity's Mobile Notifications package) and remote
  push through FCM on Android and APNs on iOS, sent by the backend with the device token.
- Tokens change: after reinstall, restore, or a refresh. The client sends the token with the player
  id whenever it changes and removes it on logout.
- Android: notification channels, the notification permission, and how notification and data
  messages differ while the app is in the background (verify against FCM's documentation).
- iOS: authorization options, and the APNs environment. The `aps-environment` entitlement comes
  from the provisioning profile, so a development build gets a sandbox token that the production
  endpoint rejects (verify the error name).
- A tap opens or resumes the app with a payload, routed like a deep link. Payloads carry no secrets
  and no rewards.

Test: `os-push-token` (when the client sends the token again); `os-apns-environment`.
Exercise: trace one push from your backend to the player's tap, naming each component and the
identity it uses.

### Sign-in callbacks and external authentication {#os-auth-callbacks}

- Platform sign-in and web sign-in. Apple's rule on offering Sign in with Apple beside other
  sign-in options (verify the current guideline before stating it).
- OAuth for native apps, RFC 8252: an external user agent rather than an embedded web view, the
  authorization code flow with PKCE (RFC 7636), a claimed https redirect or a private-use scheme,
  and a `state` value tying the response to the request.
- The redirect arrives as a deep link, is matched to the pending attempt, and the backend exchanges
  the code. The app holds no client secret.
- Android can destroy the activity or the process while the browser is in front, so the redirect
  can arrive in a new process: persist the pending attempt (state and verifier, securely) or
  restart the flow cleanly. A closed browser sends no callback at all, so resume needs a timeout.
- The result becomes a backend session, which chapter 8 covers.

Test: `os-auth-pkce-state` (what each protects against); `os-auth-process-death`.
Evidence: the RFCs' text.
Exercise: diagram your game's sign-in from the button to the backend session, marking where the
process could die and what survives.

## 05: Android builds: Gradle, manifests, and dependencies

Evidence for the chapter: 6000.3's templates under `AndroidPlayer/Tools/GradleTemplates`
(`baseProjectTemplate.gradle`, `launcherTemplate.gradle`, `mainTemplate.gradle`,
`libTemplate.gradle`, `settingsTemplate.gradle`, `gradleTemplate.properties`), and the probe
project's export built with the Editor's Gradle 8.13, which needs the network the first time.

### From Unity to an APK or AAB: the generated Gradle project {#gradle-project}

- The steps: C# compiled, IL2CPP converts assemblies to C++, the NDK compiles `libil2cpp.so` per
  ABI, Unity writes a Gradle project with a `launcher` application module and a `unityLibrary`
  library module, and the Android Gradle Plugin compiles Java, merges manifests and resources, runs
  R8 in release, packages and signs.
- Three ways to customize it: custom templates, the `AndroidProjectFilesModifier` API (in 6000.3's
  `UnityEditor.Android.Extensions.dll`, checked while planning), and `IPostGenerateGradleAndroidProject`.
  Exporting the project to build or debug it outside Unity.
- The versions move together: Unity, the Android Gradle Plugin, Gradle, the JDK, the SDK and the
  NDK. 6000.3 ships Gradle 8.13, OpenJDK 17.0.9 and NDK r27c (checked while planning); read the
  plugin version from `baseProjectTemplate.gradle`.

Test: `gradle-modules` (what ends up in `launcher` and what in `unityLibrary`);
`gradle-customization` (which mechanism for which change, and why templates drift across Unity
upgrades).
Lab exercise: export a Gradle project, build it from the command line, and note what Unity
regenerated on the next export.

### Manifest merging and the permissions nobody asked for {#gradle-manifest-merge}

- The sources: the launcher manifest, Unity's library manifest with any custom main manifest,
  every library's manifest, and values Gradle injects. The application's manifest wins conflicts.
  `tools:node`, `tools:replace` and `tools:remove`, and “Manifest merger failed”.
- The merged manifest and the merger's report in the build intermediates are the truth (verify the
  paths for the plugin version). Diffing the merged manifest per release is a cheap CI check.
- An SDK update can add a permission, which changes the store's declarations. Remove it with
  `tools:node="remove"` only after checking the SDK does not need it.
- Components with intent filters must declare `android:exported` on recent target levels (verify).

Test: `gradle-merge-priority`; `gradle-remove-permission`.
Exercise: diff the merged manifest of two builds, before and after an SDK update.

### Dependencies, conflicts, and resolution {#gradle-dependencies}

- Maven coordinates, repositories declared in the settings file, transitive dependencies, and
  `dependencies` and `dependencyInsight` for reading the resolved graph.
- Gradle resolves a version conflict to the highest requested version (verify the wording). A
  library compiled against the older API can then fail at run time with `NoSuchMethodError`, after
  a clean build. Duplicate classes from two artifacts, such as a vendored copy beside the Maven
  one, fail the build instead. A dependency's higher `minSdkVersion` fails the manifest merge.
- The tools (constraints, strict versions, `force`, exclusions, dependency locking) are
  compatibility decisions. Read the release notes and test the resolved graph on a device.
- EDM4U's Android Resolver reads each SDK's `*Dependencies.xml` and either patches the Gradle
  template or copies AARs into `Assets` (verify both modes and their names). Mixing the modes
  duplicates classes.
- Two SDKs that need incompatible versions: upgrade the one that lags, find a version both
  tolerate and test it, ask the vendors, or drop one. Repackaging is the last resort.

Test: `gradle-highest-version`; `gradle-duplicate-class`; `gradle-incompatible-sdks`.
Lab exercise: print the resolved graph of the probe project and find a library requested at two
versions; say which won and why.

### R8, keep rules, and symbol files {#gradle-r8-symbols}

- R8 shrinks, optimizes and obfuscates release builds. Code reached only by name (from C# through
  `AndroidJavaObject`, or from native code through JNI) looks unused, so it is removed or renamed
  and fails only in release. Keep rules in `proguard-user.txt` and in SDKs' consumer rules (verify
  Unity 6.3's minify settings by name).
- `mapping.txt` per release build retraces obfuscated stack traces; upload it with the build.
- Unity's symbols package for native crashes (verify the setting's options and file names), kept
  per build.
- Managed stripping is a different stripper that can break the same bridge from the C# side; recap
  `link.xml` and `[Preserve]` from the first book in a sentence.

Test: `gradle-r8-reflection`; `gradle-mapping-file`.
Lab exercise: enable minify in the probe project, call a bridge class from C#, watch it fail, and
fix it with a keep rule.

### APK, AAB, and the Play signing key {#gradle-packaging-signing}

- An APK installs; an AAB is a publishing format from which Play generates split APKs per device.
  `bundletool` reproduces that locally; 6000.3 ships `bundletool-all-1.17.2.jar` (checked while
  planning).
- Signing: the debug keystore, a release keystore, and Play App Signing, where Google holds the
  app signing key and the team uploads with an upload key. A Play-installed app carries the app
  signing key's certificate, so every fingerprint registered elsewhere (OAuth clients, API key
  restrictions, `assetlinks.json`, SDK dashboards) must include it. What losing each key costs
  (verify Play's recovery rules).
- `minSdkVersion`, `targetSdkVersion` and `compileSdkVersion`. Raising the target changes run-time
  behavior, not only compilation. Play's target-level requirement rises yearly; state it with its
  date, in prose only.

Test: `gradle-play-signing` (sign-in fails only in the Play-installed build); `gradle-target-sdk`.
Exercise: list every place your project registered a signing fingerprint and check that each
includes the Play app signing key.

## 06: iOS builds: Xcode, signing, and CocoaPods

Evidence for the chapter: the probe project's Xcode project, archived with `xcodebuild`; a
provisioning profile read with `security cms -D -i`. Signing for a device needs an Apple team; if
none is available, the phase says which claims came from documentation alone.

### From Unity to an IPA {#xcode-build-flow}

- Replace and Append builds; IL2CPP's C++ compiled by Xcode; the build configurations Unity
  generates (verify the names); `xcodebuild archive` producing an `.xcarchive` with the app and its
  dSYMs; `xcodebuild -exportArchive` with an `ExportOptions.plist` producing the IPA (verify the
  current method names); upload through Xcode, Transporter or the App Store Connect API.
- iOS builds need a macOS machine; chapter 11 hands the project across CI agents.

Test: `xcode-archive-contents` (what the archive keeps that the IPA does not);
`xcode-export-method` (what the export method decides).
Lab exercise: archive and export the probe project from the command line and list what each step
produced.

### Certificates, identifiers, profiles, and entitlements {#xcode-signing-model}

- A signing identity is a certificate with its private key in a keychain. The App ID is the bundle
  identifier with its capabilities. A provisioning profile binds certificates, the App ID, the
  allowed entitlements, the devices for development and ad hoc builds, and an expiry date.
- The app's entitlements come from its capabilities and must be allowed by the profile. The
  profile decides `aps-environment` (chapter 4).
- Automatic and manual signing, and why CI prefers explicit settings.
- Certificates and profiles expire, so a CI build that passed yesterday can fail today with no
  change (verify the lifetimes before stating them).

Test: `xcode-profile-binding`; `xcode-expiry`.
Exercise: decode a provisioning profile and read its entitlements, certificates and expiry.

### Build settings and Info.plist keys that decide whether the app runs {#xcode-build-settings}

- The deployment target, `-ObjC`, system frameworks, the Swift runtime, and bitcode, deprecated in
  Xcode 14 (prose, with the version), which old post-processors still switch off.
- App Transport Security blocks plain http unless an exception is declared, so a development
  server that works on Android fails on iOS. `LSApplicationQueriesSchemes` for `canOpenURL`.
  Background modes.
- Privacy manifests (`PrivacyInfo.xcprivacy`): the app's and each SDK's, declaring collected data
  and the reasons for certain APIs (verify Apple's current rules and their dates).

Test: `xcode-ats`; `xcode-privacy-manifest` (what it declares and whose it is).
Exercise: read the generated `Info.plist` of a build and explain each key a plugin added.

### CocoaPods and dependency resolution on iOS {#xcode-cocoapods}

- EDM4U's iOS Resolver writes a Podfile from each SDK's `*Dependencies.xml` and runs
  `pod install`, which produces `Unity-iPhone.xcworkspace`. Building the project instead of the
  workspace fails at link time. Which target pods link into, and static or dynamic linkage (verify
  the resolver's settings).
- `Podfile.lock` records what resolved; keep it with each build.
- Two pods that need incompatible versions of a shared pod fail `pod install`. Two static
  libraries that embed the same code fail the link with duplicate symbols.
- CI: a pinned CocoaPods version, network access to the specs, and a cache. Unity's support for
  Swift Package Manager in generated projects (verify before saying anything).

Test: `xcode-workspace`; `xcode-pod-conflict`.
Lab exercise: add two SDKs that share a dependency to the probe project, read `Podfile.lock`, and
say which version won.

## 07: Integrating third-party SDKs

### Evaluate an SDK before it enters the build {#sdk-evaluation}

- What it adds: binary size per platform, manifest entries and permissions, `Info.plist` keys, a
  privacy manifest and the data it collects, transitive dependencies, minimum OS levels, and the
  Unity, Gradle plugin and Xcode versions it needs.
- How it behaves: start-up cost, threads, network calls at launch, main-thread work that risks an
  ANR or a watchdog termination, swizzling, activity subclassing.
- How it ships: a UPM package, a `.unitypackage` that scatters files through `Assets` and makes
  upgrades and removal hard, or raw native libraries. Its release cadence, changelog and support.
- A build diff in the probe project shows what it adds more reliably than its documentation.

Test: `sdk-build-diff`; `sdk-distribution-form`.
Lab exercise: produce an evaluation sheet for one SDK from a probe build diff.

### Integrate an analytics SDK into an existing project {#sdk-analytics-integration}

- The worked answer to the interview question. The game owns the event schema: names, parameters,
  types, volume. One interface, one adapter per vendor, a buffer for events fired before
  initialization or consent, batching, and a flush on pause.
- Validate events in development builds so a misspelled name fails early. Sample high-volume
  events. Define the user id and the session.
- During a migration, run the old and new pipelines in parallel and compare them. Verify with the
  vendor's debug view and with counts on the backend, and roll out behind a flag.
- What goes wrong: vendor calls in two hundred places, personal data in events, Editor sessions
  sending events into production data.

Test: `sdk-event-schema`; `sdk-pre-init-events`.
Exercise: write the interface and three event types for a feature you know, and name who approves a
new event.

### Consent, privacy, and initialization order {#sdk-consent-init}

- Consent comes before collection. A consent state per purpose (unknown, granted, denied) that the
  SDK layer consults, and changes at run time that reach every SDK. App Tracking Transparency on
  iOS. Audiences that include children.
- Some Android SDKs start themselves before any C# runs, through a component in their manifest;
  their documentation says how to turn that off (verify the mechanism in general terms).
- Order: crash reporting early to catch start-up crashes, then consent, then analytics and ads.
  Initialize asynchronously within a start-up budget, and never let an SDK's failure stop the game.
- The stores' privacy declarations follow from the SDKs in the build.

Test: `sdk-auto-init`; `sdk-init-order`.
Exercise: draw the start-up sequence of your SDKs with the consent decision in it.

### Different implementations on Android and iOS {#sdk-platform-differences}

- Four cases: a vendor Unity plugin with one C# API, which still gets wrapped; native SDKs with
  different APIs, which get two adapters behind one interface; a feature on one platform only,
  which gets a capability query; and behavior that differs in timing, limits or threads, which the
  adapter normalizes. The contract suite from chapter 1 runs on both devices.
- A thin native shim with a small API of your own, on each platform, is easier to keep correct than
  calling a large native API from C#: fewer JNI calls, a typed boundary, simpler keep rules, and one
  place for threading.

Test: `sdk-native-shim`; `sdk-capability-query`.
Exercise: sketch a five-function shim API for one SDK, the same on both platforms.

### Upgrade an SDK safely {#sdk-upgrades}

- Read the changelog and migration guide. One SDK per change. Diff the dependency graph, merged
  manifest, `Info.plist`, privacy manifest, size and minimum OS. Run the contract tests and a
  release-configured device smoke test, then stage it through internal tracks.
- A staged rollout watched by crash-free users per SDK version, ANR rate, and the business metric
  the SDK carries, such as purchase success.
- A remote switch can stop the game calling the SDK; it cannot remove shipped native code.
  Rolling back means a new build.
- Pinned versions, no dynamic versions, lock files, and SDK versions in the build's identity.
- Platform deadlines and vendor deprecations force upgrades on a schedule; plan for them.

Test: `sdk-upgrade-one-at-a-time`; `sdk-remote-switch`.
Exercise: write the upgrade checklist for your riskiest SDK, with the metric that halts the
rollout.

### When SDKs collide {#sdk-conflicts}

- Collisions: dependency versions and duplicate classes (chapter 5), activity subclasses
  (chapter 2), the app controller and swizzling (chapter 3), two crash reporters installing signal
  handlers, two SDKs that each register a push receiver, conflicting manifest attributes and
  `Info.plist` keys, and start-up contention on the main thread.
- The method: find the shared resource, choose one owner, route the others through it, escalate to
  vendors with a minimal reproduction, and write the decision down.

Test: `sdk-single-owner` (two SDKs both need push callbacks); `sdk-crash-handlers`.
Exercise: list every process-wide resource the SDKs in a project touch, with the owner of each.

## 08: Backend clients: HTTP, sessions, and data contracts

Evidence for the chapter: RFC 9110 for HTTP semantics; 6000.3's `UnityEngine.UnityWebRequestModule.dll`
and the 6.3 reference; dotnet 8 probes for `HttpClient` and serializer behavior.

### HTTP semantics a game client relies on {#http-semantics}

- Safe methods (GET, HEAD) and idempotent ones (PUT, DELETE and the safe ones). POST is not
  idempotent unless the server makes it so, which is chapter 9's subject.
- Status codes a client handles distinctly: 200, 201, 204, 304; 400; 401, which means not
  authenticated and calls for a refresh; 403, which means authenticated and not allowed; 404, 409,
  412, 422; 429 with `Retry-After`; 500; 502, 503 and 504. And no response at all, whose outcome is
  unknown.
- Headers: `Content-Type`, `Accept`, `Authorization`, `Retry-After`, `ETag` with `If-None-Match` to
  save bandwidth and with `If-Match` to guard a save against a concurrent write.

Test: `http-401-403`; `http-unknown-outcome` (a POST timed out: what the client knows).
Exercise: list the status codes each endpoint your game calls can return, with the client's
reaction to each.

### UnityWebRequest and HttpClient in a Unity client {#http-unity-clients}

- `UnityWebRequest`: its thread rules (verify), `SendWebRequest` and how to await it in Unity 6
  (verify), `result` with `ConnectionError`, `ProtocolError` and `DataProcessingError` (present in
  6000.3, checked while planning), `responseCode`, `timeout` in seconds (verify its meaning),
  `Abort`, `Dispose`, handlers, `CertificateHandler` for pinning.
- `HttpClient` on IL2CPP mobile builds (verify the caveats): usable off the main thread, takes a
  `CancellationToken`, and one shared instance.
- Platform rules: iOS App Transport Security, and Android's default block on cleartext traffic
  from API 28 (verify), so an `http://` development server works in the Editor and fails on a
  device.
- One client behind the game's own HTTP abstraction, with a fake transport for tests.

Test: `http-request-result` (connection error or protocol error: what each means for a retry);
`http-request-dispose`.
Exercise: wrap one request in a function that returns a game-owned result for every `result` value
and for a timeout.

### Sessions and tokens {#http-sessions}

- A platform identity (chapter 4) exchanged for a backend session: a short-lived access token and a
  long-lived refresh token, attached in the HTTP layer and never at call sites.
- On a 401, refresh once and retry the request once. Concurrent 401s share one refresh; separate
  refreshes can invalidate each other when refresh tokens rotate, which logs the player out. Refresh
  ahead of expiry using server time.
- Secure storage (the Android Keystore, the iOS Keychain), not `PlayerPrefs` (verify where
  `PlayerPrefs` writes on each platform).
- Nothing in the client is secret: a key in the build can be extracted. Device attestation adds
  signals, not proof (name the platform services, verify).
- Logout and account switch: clear the tokens, unregister the push token, reset the analytics user.

Test: `http-single-flight-refresh`; `http-client-secrets`.
Exercise: trace what happens to three in-flight requests when the access token expires between
them.

### JSON, DTOs, and the game's domain {#http-dtos}

- DTOs mirror the wire and are versioned and serializer-friendly; domain types keep invariants.
  Map between them at the boundary, the same adapter idea as chapter 1, so backend changes stay out
  of gameplay.
- `JsonUtility` and its rules (verify the list: fields, dictionaries, top-level arrays,
  polymorphism). Json.NET through Unity's `com.unity.nuget.newtonsoft-json` package: flexible, and
  reflection-based, so IL2CPP stripping can empty DTOs on a device (recap the first book's
  `link.xml` and `[Preserve]`; verify what Unity 6's IL2CPP still needs for generics).
- A tolerant reader ignores unknown fields and defaults missing ones. An enum value added by a
  newer server must not break an old client. Integers above 2^53 travel as strings, dates as UTC
  ISO 8601, and money as integer minor units.
- Mapping tests read recorded responses from each API version.

Test: `http-dto-mapping`; `http-tolerant-reader`.
Exercise: take one response, write its DTO and domain type, and list three server changes the
mapping must survive.

### API versions and clients that never update {#http-versioning}

- Old clients stay installed for months; recap the first book's release-compatibility section.
  Versioning in the path, in a header, or in the media type. Additive changes, never a repurposed
  field, and deprecation measured by usage per client version.
- The client sends its version and platform so the server can adapt, refuse, or ask for an update.
  A minimum-version check at start-up drives a forced update and a softer prompt, and the check
  itself must stay compatible and fail in a chosen direction.
- Contract tests and a shared schema from which DTOs are generated, named as ideas.

Test: `http-additive-change`; `http-min-version`.
Exercise: mark which of a service's recent API changes would break the oldest supported client.

## 09: Reliable requests on unreliable networks

### Deadlines, timeouts, and cancellation {#network-timeouts}

- Timeouts at each layer: connection, one attempt, the whole operation across retries, and the
  server's own. Choose them from measured latency percentiles, not guesses.
- Cancellation from the owner (`destroyCancellationToken`, a screen's token) aborts the request.
  It stops the waiting, not the server's work, so a cancelled write still needs reconciling.
- iOS suspends a backgrounded app and its requests fail on resume. Background transfer APIs exist
  for large downloads; name them only.

Test: `network-deadline` (why a per-attempt timeout alone does not bound an operation);
`network-timeout-values`.
Exercise: for one operation, write the per-attempt timeout, the overall deadline, and what the
player sees when each runs out.

### Retries that help instead of hurt {#network-retries}

- Recap the first book's backoff with full jitter in a paragraph. What to retry: connection errors;
  timeouts for idempotent requests; 408; 429 after `Retry-After`; 502, 503 and 504. What not to:
  400, 403, 404, 409 and 422, and 401, which calls for a refresh.
- Retry amplification: an SDK, the client and a gateway that each retry three times make up to 27
  attempts. Budgets, and a circuit breaker that stops sending for a while after repeated failures.
- One retry policy in the HTTP layer, set per endpoint, not loops scattered through features.

Test: `network-retry-classes`; `network-retry-amplification` (the arithmetic, and what the figure
leaves out).
Exercise: find every retry loop in a codebase, including those inside SDKs, and compute the
worst-case number of attempts.

### Idempotency keys over HTTP {#network-idempotency}

- One key per logical operation, persisted with the pending operation before the first send
  (recap the first book), sent as `Idempotency-Key`. The header is an IETF draft; say so, and verify
  its current status and the status codes it proposes for a key reused with another payload and for
  a duplicate in flight.
- The server's retention window, the client's key lifetime, and never reusing a key for a
  different operation.

Test: `network-key-persistence`; `network-key-payload`.
Lab exercise: add a key to one write in a sample client and test the lost-response case against a
fake server.

### Offline play and reconciliation {#network-offline}

- `Application.internetReachability` reports the kind of route, not whether the game's server
  answers (verify the reference's wording). A captive portal answers 200 with HTML, so check the
  content type and the schema before trusting a response.
- A strategy per feature: blocked (purchases), queued (analytics, progress, with a bounded queue),
  or local first with later reconciliation. Cloud save conflicts: last writer wins, merge, or ask
  the player, with `ETag` and `If-Match`.
- Honest states in the interface: pending, confirmed, failed.

Test: `network-reachability`; `network-captive-portal`.
Exercise: play your game in airplane mode through three features and write what each should do.

### Trace a request: ids, logs, and privacy {#network-observability}

- A correlation id per operation, created by the client, sent as a header, and logged on both sides,
  with the build identity and SDK versions. Structured logs with error categories, and latency and
  error rates per endpoint and version.
- Never log tokens, personal data or whole payloads in production; sample what is high volume.

Test: `network-correlation-id`; `network-log-redaction`.
Exercise: design the client and server log lines for one request so they can be joined.

## 10: Build variants, environments, and releases

### Development and release builds differ on purpose {#release-build-variants}

- Unity's Development Build, script debugging, the IL2CPP code generation option, the managed
  stripping level, and scripting defines. Unity 6's build profiles (the class is in 6000.3's
  `UnityEditor.CoreModule.dll`, checked while planning; verify what a profile can override). Gradle
  build types with minify per type, and Xcode configurations.
- Bugs only a release build shows come from R8, stripping, optimization and timing, missing debug
  logs, and a different signature. QA tests a release-configured build with a debug overlay, not a
  development build.

Test: `release-config-testing`; `release-build-profiles`.
Exercise: list every difference between your development and release builds and mark which QA never
exercises.

### Environment-specific configuration {#release-environments}

- Development, staging and production backends, SDK keys per environment, and flags per
  environment. Chosen at build time (defines, profiles, configuration assets) or at run time (remote
  configuration, a QA switcher removed from release builds).
- The failure to prevent is a release build pointing at staging. Show the environment in
  non-release builds and assert it in CI for release variants.
- Secrets are not configuration (chapter 11). Test events stay out of production analytics.

Test: `release-environment-selection`; `release-wrong-environment`.
Exercise: find where your project decides its backend URL and write the check that fails a release
build pointing at staging.

### Versions and build identity {#release-versioning}

- A marketing version (`versionName`, `CFBundleShortVersionString`) with one source of truth, and a
  build number (`versionCode`, `CFBundleVersion`) that must increase with each upload (verify both
  stores' rules and `versionCode`'s maximum), derived by CI. `PlayerSettings.Android.bundleVersionCode`
  and `PlayerSettings.iOS.buildNumber` (present in 6000.3, checked while planning).
- The build carries its commit, build number, content revision and SDK versions into logs and crash
  reports; recap the first book's build identity in a sentence.

Test: `release-build-numbers`; `release-build-stamp`.
Exercise: design the version stamp your builds carry and where each part comes from.

### Store tracks and staged rollouts {#release-rollouts}

- Google Play: internal, closed, open and production tracks; a staged rollout by percentage, which
  can be halted and resumed; a fix ships with a higher `versionCode`. Apple: TestFlight with internal
  testers and external testers, who need beta review; App Review; phased release of automatic
  updates, which can be paused (verify the duration and what manual updates do).
- No binary rollback on mobile, so server-side switches and compatible backends do the work;
  recap the first book in a paragraph.
- Halting criteria are decided before the rollout starts: crash-free users, ANR rate, and funnel
  metrics per version.

Test: `release-halt-rollout` (what halting does and does not do); `release-halting-criteria`.
Exercise: write the halting criteria for your next release and who may halt it.

### Verify the build the store will ship {#release-verification}

- A release candidate is installed from the store's test track and signed as the store signs it.
  Sign-in, purchases, push and deep links work end to end. The merged manifest, `Info.plist`,
  entitlements and size are diffed against the previous release. Privacy declarations are updated,
  symbols uploaded, versions and environment correct, and a low-end device smoke test passes.

Test: `release-store-installed` (why test from the store track); `release-diff-review` (which
diffs catch the most).
Exercise: split this checklist into what a CI job can check and what a person must.

## 11: CI/CD and Jenkins for Unity mobile builds

Evidence for the chapter: Jenkins's own documentation for pipeline syntax, the credentials
bindings and stash; Unity's 6.3 command-line reference for batch mode. No Jenkins runs on this
machine, so the Jenkinsfile examples are checked against the syntax reference, and the phase log
says so.

### The shape of a mobile pipeline {#ci-pipeline-shape}

- Checkout with LFS; the toolchain chosen explicitly (the Unity version from
  `ProjectSettings/ProjectVersion.txt`, the JDK, SDK and NDK, the Xcode version, CocoaPods);
  license activation; dependency resolution (`packages-lock.json`, EDM4U); the Unity build in batch
  mode (`-batchmode -nographics -quit -projectPath -buildTarget -executeMethod -logFile`) with a
  build script that sets versions, signing and defines; the native build; Edit Mode and Play Mode
  tests with a results file; signing; artifacts (APK, AAB or IPA, symbols, mapping, logs, the
  merged-manifest report); distribution to a test track; notification.
- Each stage proves itself with its exit code, its expected artifact and its log; recap the first
  book's “zero tests is not a pass”.

Test: `ci-batchmode-evidence`; `ci-toolchain-pinning`.
Exercise: write your pipeline's stages with the evidence each must produce.

### Jenkins pipelines: Jenkinsfile, agents, stages, and parameters {#ci-jenkins-pipeline}

- A controller and agents, chosen by label, with macOS agents for iOS. A Jenkinsfile in the
  repository. Declarative syntax: `pipeline`, `agent`, `environment`, `parameters`, `options`,
  `stages`, `stage`, `steps`, `when`, `parallel`, `post`.
- `stash` and `unstash` between agents, and what they are not for (verify Jenkins's guidance on
  size). `archiveArtifacts`, `junit`, `timeout`, `retry`, `buildDiscarder`,
  `disableConcurrentBuilds`. Multibranch pipelines, shared libraries, and scripted pipelines named.
- One worked Jenkinsfile, in a `groovy` fence, building Android and iOS in parallel with
  parameters for environment and build type.

Test: `ci-jenkins-agents`; `ci-jenkins-post`.
Exercise: write a declarative Jenkinsfile skeleton with the stages from the previous section.

### Secrets, credentials, and signing in CI {#ci-secrets-signing}

- Jenkins's credentials store and `withCredentials` bindings (file, string, username and
  password). Masking is best effort: a transformed secret is not masked (verify). Scope secrets to
  the steps that need them, never echo them, never commit them, rotate them, and give store API keys
  the least privilege.
- Android: the keystore as a file credential and its passwords as strings, set through
  `PlayerSettings.Android` in the build script. iOS: a temporary keychain holding the certificate,
  the profile installed, manual signing, and the keychain deleted in `post` (verify the `security`
  steps).
- Unity license activation and return on agents.

Test: `ci-secret-masking`; `ci-temp-keychain`.
Exercise: list every secret your pipeline uses, where it is stored, who can read it, and how it is
rotated.

### Caching and build speed {#ci-caching}

- Unity's `Library` folder, keyed by Unity version, target and package lock; a stale one produces
  odd import errors. Unity's shared import cache, named. Gradle's caches and daemon, CocoaPods's
  cache, IL2CPP's build cache (verify its location), and disk space.
- Release candidates build clean.

Test: `ci-cache-key`; `ci-clean-release`.
Exercise: time each stage with and without its cache and decide which caches pay for themselves.

### Failures that happen only in CI {#ci-only-failures}

- What differs from a developer's machine: a clean checkout (ignored files the build relied on, LFS
  pointers instead of files), tool versions, environment variables, locale and time zone, no
  graphics, a locked keychain, network access, builds sharing a workspace or a Gradle daemon, disk
  space, case-sensitive file systems on Linux agents, file permissions, and time limits.
- The method: read the full Unity, Gradle and Xcode logs rather than the console's tail, reproduce
  with the pipeline's exact command in a clean clone, print tool versions in every build, and bisect
  pipeline changes. A table of common failures with the first check for each.

Test: `ci-clean-clone`; `ci-full-log`.
Debugging exercise: reproduce your last CI failure from a clean clone with the pipeline's exact
command.

### Automate versions and releases {#ci-release-automation}

- The pipeline derives versions (chapter 10), tags the commit, archives artifacts and symbols with
  a retention policy, uploads to the test tracks through the stores' APIs, and leaves promotion to
  production as a manual gate.
- Build the candidate once and promote that artifact; rebuilding for release ships something
  untested. Symbols are uploaded and archived by the pipeline, so every shipped build can be
  symbolicated later.

Test: `ci-build-once`; `ci-symbol-upload`.
Exercise: trace a production crash back to its commit and symbols using only what your pipeline
records today.

## 12: Debugging across boundaries

### Follow one operation through every layer {#boundary-method}

- The call path from chapter 1 as the map. The evidence at each layer: C# logs and exceptions,
  bridge logs of what crossed, logcat and the device console, OS state (permissions, network,
  lifecycle), captured traffic, and backend logs joined by correlation id.
- Find the last layer where the operation was right and the first where it was wrong: a bisection
  along the path; recap the first book's bisection in a sentence. Order checks by cost and by how
  much each one splits.

Test: `boundary-last-good-layer`; `boundary-cheapest-check`.
Exercise: take a recent bug and write, layer by layer, what you knew and what you assumed.

### Works in the Editor, fails on the device {#boundary-editor-device}

- What the Editor does not run: native code, IL2CPP, stripping, R8, the OS, device paths and case
  sensitivity, cleartext and ATS rules, real callback threads, device memory limits.
- A table in the first book's form: symptom, then the one observation that splits it fastest. A
  Java class not found: does it fail with minify off? Empty JSON fields: does it work with stripping
  at Minimal? A failed request: is the URL `http`? A launch crash on iOS: does the report name the
  dynamic loader or a purpose string? One Android device only: its ABI, API level, or maker?

Test: `boundary-first-split`, with several `?+` variants, one symptom each.
Exercise: take one device-only bug and list which rows one build could rule out.

### Works in development, fails in production {#boundary-dev-prod}

- The differences: the signing key and its fingerprints, the APNs environment, R8, the stripping
  level, the backend environment, flags per environment, store installation, SDK versions,
  debug-only code, and API keys per environment. A table: symptom, likely difference, first check.
- Reproduce with a release-configured build installed from the internal track.

Test: `boundary-dev-prod-diff`; `boundary-release-repro`.
Exercise: write your project's development-against-production difference list with a check for
each.

### Worked case: purchases fail in production after an SDK update {#boundary-purchase-case}

- The investigation in order. The symptom stated precisely, its scope and timeline. Hypotheses by
  layer: the adapter maps a new result code to a failure; R8 renamed a class the updated SDK loads
  by name, which only minified builds show; the new SDK version requires a step the old one did
  not, such as acknowledging a purchase (verify against the billing library's documentation); only
  store-installed builds are affected; the backend's validation rejects a changed payload, or
  production uses different credentials. Client logs with operation ids joined to the backend's
  validation logs.
- Containment, the fix verified on the internal track, and prevention: a release-configured device
  test of purchases, a contract test on the validation payload, and a review of the dependency and
  manifest diffs.
- Purchases made during the incident are still owed: reconcile and grant them, within the store's
  refund window (verify it).

Test: `boundary-purchase-first-check`; `boundary-purchase-recovery`; `boundary-prevention-check`.
Interview exercise: tell this investigation aloud for “push notifications stopped arriving on iOS
after a release”.

### Native crashes after an SDK update: a second case {#boundary-crash-case}

- Crashes rise on some Android devices after an update. Cluster by device, OS level and ABI; read
  the symbolicated native stack, which needs that build's symbols; name the library in the top
  frames. Hypotheses: a missing ABI, a raised minimum API level, two SDKs shipping clashing copies of
  the same native library (verify how Android packaging treats two `.so` files with one name), a
  callback touching Unity off the main thread. The iOS equivalent in a paragraph.
- Escalate to the vendor with a minimal reproduction project and symbolicated traces.

Test: `boundary-crash-cluster`; `boundary-vendor-repro`.
Lab exercise: build a minimal reproduction project for one SDK problem you have seen.

## 13: Interview practice for platform roles

Each section practises answers aloud. The first book's chapter 15 covers project stories,
honesty about metrics and study loops; this chapter recaps them in a paragraph and stays on
platform questions.

### Answer “how would you integrate this SDK” {#interview-integration-answer}

- A structure: purpose, evaluation (chapter 7), the boundary (chapter 1), platform work (2 to 4),
  build impact (5 and 6), privacy and consent, rollout and verification, upgrades. The analytics
  answer at three depths: naming, mechanism, decision, as in the first book's table.
- The first clarifying question, and stating an assumption so the answer can continue.

Test: `interview-integration-depth`; `interview-integration-first-question`.
Interview exercise: answer the analytics question in two minutes, recorded, and grade it against
the structure.

### Explain an investigation out loud {#interview-debugging-answer}

- Restate the symptom, scope it, form hypotheses per layer, pick the cheapest observation that
  splits them, say what each result would mean, then contain, fix and prevent. Worked for “works in
  the Editor, crashes on Android”.
- An interviewer grades the process: what you would look at, why, and what would change your mind.
  When a platform detail is unknown, say how you would find it.

Test: `interview-debugging-narration`; `interview-unknown-detail`.
Interview exercise: narrate chapter 12's purchase case in three minutes.

### A mock round with rubrics {#interview-platform-mock}

- The prompts: integrate analytics; keep vendor types out of gameplay; per-platform
  implementations; upgrade an SDK safely; incompatible Android dependencies; works in the Editor,
  crashes on Android; purchases fail in production after an update; design a Jenkins pipeline;
  token refresh under concurrency; offline behavior. For each: what a strong answer contains and the
  common weak answer.
- Follow-ups that change a constraint mid-answer.

Test: `interview-mock-rubric`; `interview-mock-followup`.
Interview exercise: run the round with a timer and score each answer against its rubric.

### Build a practice project that gives you evidence {#interview-practice-project}

- The smallest project that gives real experience to talk about: a plugin on both platforms with a
  call, a callback on another thread, a deep link, a post-processor, a keep rule, and a CI script
  that builds both. Which parts to build first when time is short.

Test: `interview-practice-evidence` (which parts give the most to talk about per hour).
Lab exercise: build the first two parts and write down what surprised you.

## Glossary candidates

Entries go into `content/mobile-platform/glossary.md` with the chapter that first uses the term
without defining it. The list is a starting point, not a quota: an entry is written only where the
text leans on the term.

- Boundary and architecture: adapter, facade, anti-corruption layer, composition root, dependency
  injection, strategy, observer, idempotence.
- Android: JNI, AAR, activity, intent, Android Gradle Plugin, Gradle, Maven coordinates, manifest
  merger, R8, AAB, bundletool, Play App Signing, ABI, ANR, tombstone, logcat, ndk-stack, FCM.
- iOS: Trampoline, UnityFramework, xcframework, dSYM, symbolication, provisioning profile,
  entitlement, App Transport Security, privacy manifest, CocoaPods, APNs, watchdog, jetsam.
- Unity: IL2CPP, managed code stripping, `link.xml`, EDM4U, build profile, batch mode.
- Network and backend: DTO, tolerant reader, bearer token, refresh token, PKCE, correlation id,
  exponential backoff, jitter, circuit breaker, captive portal.
- CI: Jenkinsfile, agent, stash, credentials binding.
