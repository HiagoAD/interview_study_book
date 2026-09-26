---
book: unity-mobile-platform-engineering
kind: glossary
---

## AAB {#aab}
= Android App Bundle | app bundle | app bundles

Android App Bundle: the format in which an app is published on Google Play. It holds the app's code and resources for every device configuration and cannot be installed; Google Play generates APKs from it for each device and signs them.

A phone downloads a base APK and the configuration APKs that fit it, such as the one with the native libraries of its ABI. [[bundletool]] turns a bundle into APKs on a computer in the same way, which is how a team tests one before uploading it. [[#gradle-packaging-signing]] covers the format and the key that Google Play signs with.

## ABI {#abi}
= application binary interface | ABIs

The application binary interface a native library is compiled for: an instruction set and its calling conventions. Android names each one, such as `arm64-v8a`, `armeabi-v7a` and `x86_64`, and a device installs the native libraries of the ABI that fits it.

Unity builds its player libraries for the ABIs chosen under Target Architectures in Player Settings, and each native plugin has to exist for all of them. A plugin missing for one ABI fails on the devices that need it and nowhere else, as [[#android-plugin-forms]] shows.

## Advertising identifier {#advertising-identifier}
= advertising identifiers | advertising ID | IDFA

An identifier for advertising that a device offers to the apps on it: the identifier for advertisers on iOS, and on Android the advertising ID that Google Play services provides.

On iOS, Apple's page on user privacy says that the value reads as all zeros unless the player has given the app permission to track through [[App Tracking Transparency]]. On Android, an app that uses the advertising ID and targets Android 13 or higher declares the `AD_ID` permission in its manifest. [[#sdk-consent-init]] places both in the start-up sequence.

## Android Gradle Plugin {#android-gradle-plugin}
= AGP

The Gradle plugin that builds Android apps and libraries. It compiles Java and Kotlin, merges the manifests and resources, runs R8, converts the code into DEX, and packages and signs APKs and app bundles.

Its version is chosen together with those of Gradle, the JDK and the Android SDK, and a Unity version fixes all of them: the project that Unity 6.3 writes names version 8.10.0. An AAR can state the lowest plugin version it works with, which is how an SDK update can call for a newer Unity. [[#gradle-project]] shows where the version is set.

## Android Keystore {#android-keystore}
= Keystore

Android's store for cryptographic keys, which keeps their key material out of the app's process: the app asks the Keystore to encrypt, decrypt or sign with a key that it has no way to export.

It holds keys rather than arbitrary data, so an app that must keep a secret, such as a pending sign-in attempt, encrypts it with a Keystore key and stores the result in its own files. [[#os-auth-callbacks]] uses it for the state and verifier of a sign-in that may outlive the process, and [[#http-sessions]] for the session's refresh token.

## Android vitals {#android-vitals}
= vitals

Google Play's measures of an app's technical quality on players' devices, among them the user-perceived crash rate, the user-perceived ANR rate and start-up times.

Each rate has a bad behavior threshold. As checked in September 2026, an app crosses it when 1.09% of its daily active users meet a user-perceived crash, or 0.47% a user-perceived ANR, and a cold start of five seconds counts as excessive. [[#sdk-upgrades]] watches them during a rollout.

## ANR {#anr}
= Application Not Responding | ANRs

Application Not Responding: Android's verdict that an app's UI thread has stopped responding, most often because an input event went unanswered for too long. In the foreground it shows a dialog that offers to close the app, and Android records every thread's stack at that moment.

In a Unity game the UI thread is Android's, not the thread that runs `Update`, so a frozen game loop becomes an ANR when the UI thread ends up waiting for it. [[#android-callbacks]] shows one way that happens, and [[#android-failure-evidence]] where the evidence is.

## App extension {#app-extension}
= app extensions

A separate bundle inside an iOS app that the system runs in a process of its own, to extend the system on the app's behalf: a notification service extension that edits a push notification before it appears, a widget, a share extension.

An extension has its own target, `Info.plist`, entitlements and signature, and the app target embeds it. Unity's Xcode export has no such target, so a post-processor adds one; [[#ios-runtime-model]] shows where it fits among the targets that Unity writes.

## App Store Connect {#app-store-connect}

Apple's service for publishing apps. A team uploads builds to it, sends them to testers through [[TestFlight]], submits them for review and releases them on the App Store, and its API lets a pipeline do the same with a key instead of a signed-in account.

[[#xcode-build-flow]] follows a build from Unity's export to an upload, and [[#xcode-signing-model]] shows `xcodebuild` using an API key to manage signing. [[#release-rollouts]] covers its testers, App Review and phased releases.

## App Tracking Transparency {#app-tracking-transparency}
= ATT

Apple's framework through which an app asks the player's permission to track them or to read the device's [[advertising identifier]], which Apple requires before either.

The app calls `ATTrackingManager.requestTrackingAuthorization`, with its reason in the `NSUserTrackingUsageDescription` key of its `Info.plist`, and the answer is one of four statuses: not determined, restricted, denied or authorized. The request shows its prompt only while the app is active. [[#sdk-consent-init]] fits it into the game's consent flow.

## App Transport Security {#app-transport-security}
= ATS

The iOS policy that makes connections through the URL Loading System, such as `URLSession`, use HTTPS. An app declares exceptions under the `NSAppTransportSecurity` key of its [[Info.plist]]: for the whole app, for named domains, or for local networking.

Unity's `UnityWebRequest` is built on `URLSession` on iOS, so the policy covers it, and Unity's “Allow downloads over HTTP” setting writes an exception for the whole app, as [[#xcode-build-settings]] shows. `HttpClient` is not: Unity builds it on Mono's own HTTP code, which the policy does not reach, as [[#http-unity-clients]] explains.

## ARC {#arc}
= Automatic Reference Counting

Automatic Reference Counting: the Objective-C compiler inserts the retain and release calls that keep an object alive while a strong reference to it exists, and frees the object when the last one goes. Unity's Xcode export compiles plugin files with it.

ARC counts Objective-C references and nothing else. A pointer borrowed from an object, such as the one `UTF8String` returns, lives no longer than the object, and an object whose one reference is an `IntPtr` held by C# needs a retain of its own, taken with `CFBridgingRetain` and given back with `CFBridgingRelease`. [[#ios-frameworks]] covers both.

## Assembly definition {#assembly-definition}
= asmdef | assembly definitions

A Unity asset that compiles the scripts in its folder into an assembly of their own, with the assemblies it references and the platforms it compiles for stated in the asset. Code in it can use another assembly's types only through a reference, which turns a boundary into something the compiler checks.

Two defaults decide whether that check has teeth. The predefined `Assembly-CSharp` references every assembly marked Auto Referenced, and every assembly definition references every precompiled plugin DLL unless the plugin's Auto Referenced setting is off or the assembly uses Override References. [[#platform-interfaces]] uses both rules to keep vendor types out of gameplay, and [[#platform-composition]] uses the platform list to compile an adapter for its own platform only.

## bundletool {#bundletool}

Google's command-line tool for app bundles. It builds them, and it turns a bundle into the APKs that Google Play would generate for each device, so that a bundle can be installed and tested before it is uploaded.

`build-apks` makes a set of APKs from a bundle, signed with the keystore it is given or with the debug key; `install-apks` installs the ones a connected phone needs; `dump manifest` prints the manifest a bundle carries. The APKs it makes reproduce Google Play's splits and not its signature, as [[#gradle-packaging-signing]] explains.

## Certificate pinning {#certificate-pinning}
= pinning | pinned | pin | pins

A client's rule that accepts a server's certificate only when the certificate, or a public key in its chain, matches one that the client carries, on top of the usual check that a trusted authority issued it.

It keeps out a party that can make the device trust a certificate of its own choosing, such as a proxy whose authority someone installed on the device. The cost is that the pins ship in the build: a server key replaced by one that no pin matches cuts off each installed client pinned to the old one, so teams pin more than one key, one of them a backup, and plan the rotation before the first release that pins. In Unity, a `CertificateHandler` makes the check for `UnityWebRequest`, as [[#http-unity-clients]] shows.

## CocoaPods {#cocoapods}
= pods | Podfile

A dependency manager for Apple platforms. A project lists its pods in a `Podfile`; `pod install` resolves their versions from a spec repository, records them in `Podfile.lock`, and builds them through a Pods project that a workspace joins to the app's own project.

In a Unity project, [[EDM4U]] writes the Podfile from the SDKs' dependency files and runs `pod install`. [[#xcode-cocoapods]] covers the workspace, the conflicts the resolver reports, and the plan to make CocoaPods' central spec repository read-only.

## Content provider {#content-provider}
= content providers | ContentProvider

An Android app component, declared in the manifest, that provides content to applications, its own and others. Android creates each registered one as the app's process starts.

Android calls each provider's `onCreate` on the main thread at launch, before the app's first activity. Libraries use that to start themselves without a call from the app: Firebase's `FirebaseInitProvider` and Jetpack App Startup's `InitializationProvider` are two. In a Unity game it happens before any C# runs, and [[#sdk-consent-init]] shows how to control it.

## Crash-free users {#crash-free-users}
= crash-free user | crash-free rate

The share of an app's users who had no crash in a period, as a crash reporter counts them. Crashlytics counts fatal events for it, and for Unity games also the uncaught exceptions that its SDK reports as fatal.

A release compares it version against version, for the same hours, as the first of its halting criteria in [[#release-rollouts]]. A failure that does not crash, such as a purchase that ends in an error, leaves it unchanged, which is why the criteria also count funnels.

## Custom Tabs {#custom-tabs}
= Custom Tab | Auth Tab

An Android feature that shows a web page in a tab of the player's browser, over the app, instead of in a web view that the app owns. The page runs in the browser, with its cookies and signed-in sessions, and the app has no access to what the player types.

That is why OAuth for native apps uses it. Auth Tab is a variant made for authentication that returns the result, or a cancellation, to the app. [[#os-auth-callbacks]] shows a sign-in that runs through one.

## Deep link {#deep-link}
= deep links

A URL that opens an app at a particular place instead of a web page. It can use a custom scheme, which any app can claim, or a verified https link that the platform has confirmed belongs to the app.

Unity reports the link that launched the app in `Application.absoluteURL` and raises `Application.deepLinkActivated` for links that arrive while it runs, so code that subscribes after start-up reads the property for the launch link. Anyone can send a link, which makes it untrusted input: it may choose a screen, and it grants nothing without the server. [[#os-deep-links]] covers verified links on both platforms, and a gap in Unity 6000.3 through which iOS links reach neither.

## Device attestation {#device-attestation}
= attestation | Play Integrity API | App Attest

A platform service that vouches for the app and the device a request comes from, in a form the backend checks with the platform: the Play Integrity API on Android, and App Attest, part of the DeviceCheck framework, on iOS.

A passing check makes it more likely that the request comes from the genuine app on a genuine device, and neither platform presents it as proof: Google recommends Play Integrity alongside other anti-abuse measures, and Apple warns that a single compromised device can serve assertions to many users. [[#http-sessions]] places it beside the session and the backend's own rules.

## Dispatch queue {#dispatch-queue}
= dispatch queues | main queue | Grand Central Dispatch | GCD

A queue of blocks that Grand Central Dispatch, Apple's library for concurrent work, takes in order and runs on threads it manages, or, for the main queue, on the main thread. iOS frameworks and SDKs deliver many of their callbacks on queues of their own.

`dispatch_async(dispatch_get_main_queue(), block)` posts work to the main thread and returns at once, which is how an iOS bridge moves UI work to the thread that UIKit requires; in a Unity game, a block posted there runs between two frames of the player loop. A callback that arrives on another queue runs C# on that queue's thread, as [[#ios-callbacks]] shows.

## dSYM {#dsym}
= dSYMs | debug symbol file

The debug symbol file of one Apple binary: a bundle holding the information that turns the binary's addresses into function names, source files and lines. A binary and its dSYM share a build UUID, and a dSYM fits no build but its own.

A Unity iOS release build produces one for the app and one for `UnityFramework`, which covers the game's C# as IL2CPP compiled it, and the Xcode archive keeps both, as [[#xcode-build-flow]] shows. [[#ios-failure-evidence]] shows how to check a UUID and symbolicate with them, and chapter 11 archives them for each build.

## EDM4U {#edm4u}
= External Dependency Manager for Unity | Android Resolver

Google's External Dependency Manager for Unity: a Unity package that reads the `*Dependencies.xml` files that SDKs ship in Editor folders and turns them into Android dependencies, and into CocoaPods for iOS.

Its Android Resolver either resolves the dependencies itself and copies the libraries into `Assets/Plugins/Android`, or writes them into the custom main Gradle template for the build to resolve. Mixing the two modes duplicates classes, as [[#gradle-dependencies]] shows. Its iOS Resolver writes a Podfile into the Xcode project and runs `pod install`, as [[#xcode-cocoapods]] shows.

## Edit Mode and Play Mode tests {#play-mode-tests}
= Edit Mode tests | Unity Test Framework

The two environments of Unity's Test Framework. Edit Mode tests run without entering Play Mode and suit rules that need no engine; Play Mode tests run with the engine playing, and can also be built into a player and run on a device.

Neither runs the native half of a platform integration in the Editor, which is why the contract suite in [[#platform-testing]] has a device run. Unity 6.3 ships version 1.6 of the framework, and from Unity 6.2 on its guide is part of the Unity Manual.

## Entitlements {#entitlements}
= entitlement | capability | capabilities

Key-value pairs in an app's code signature that grant it the use of a service or technology, such as push notifications, associated domains or Sign in with Apple. Xcode adds them through a target's capabilities and records them in an `.entitlements` file.

In a Unity export they belong to the `Unity-iPhone` target, whatever target holds the code that uses them, and a post-processor adds them with `ProjectCapabilityManager`, as [[#ios-xcode-postprocess]] shows. Each one that the app claims has to be on its provisioning profile's allowlist, as [[#xcode-signing-model]] shows.

## Gradle {#gradle}

The build system Android apps are built with. Unity exports an Android build as a Gradle project with a `launcher` module and a `unityLibrary` module, and Gradle, through the Android Gradle Plugin, compiles the Java, merges the manifests, resolves dependencies and packages the APK or app bundle.

Unity 6.3 ships Gradle 8.13 with its Android module, and the project exported for this book in September 2026 named [[Android Gradle Plugin]] 8.10.0. [[#android-plugin-forms]] shows where each kind of plugin lands in the project, [[#gradle-project]] covers the project and its templates, and [[#gradle-dependencies]] covers dependency resolution.

## Idempotence {#idempotence}
= idempotent | idempotency

A property of an operation whose repetition changes nothing further: applying it twice for the same identity leaves the same state as applying it once.

The identity is the whole mechanism. A purchase grant is idempotent for its transaction id, and a request for the key the client sent with it; an operation with no stable identity cannot be idempotent, because nothing tells the second call that it is the second. Platforms redeliver events on purpose, so a grant that is not idempotent eventually grants twice, as [[#platform-events]] shows. HTTP defines PUT, DELETE and the safe methods as idempotent and POST as not, which [[#http-semantics]] turns into rules for repeating a request, and [[#network-idempotency]] carries the idea over HTTP with idempotency keys.

## IL2CPP {#il2cpp}

Unity's ahead-of-time scripting backend. It converts the game's compiled C# into C++, which the platform's compiler then builds into native code, and mobile release builds normally use it.

Two consequences reach the platform boundary. Code has to exist when the build is made, so reflection over types that nothing references can work in the Editor and fail on a device, where [[managed code stripping]] may have removed them. And a C# exception becomes a C++ exception: the wrapper IL2CPP generates for a callback that native code calls has no handler, so an exception that escapes the callback unwinds into native frames. The generated C++ sits in the exported project, and reading it settles questions about marshaling that the documentation leaves open, as [[#ios-native-calls]] does.

## Info.plist {#info-plist}
= information property list

The property list at the top of an Apple app bundle, holding the keys that iOS reads about the app: its identifier and version, its scene configuration, the URL schemes it handles, and the usage descriptions shown in permission prompts.

Unity generates the app's `Info.plist` from Player Settings and updates it in place on an Append build, so a key that a plugin needs is set by a post-processor with `PlistDocument`, as [[#ios-xcode-postprocess]] shows. A missing usage description ends the app the first time it asks for the protected resource, which [[#ios-failure-evidence]] covers.

## JNI {#jni}
= Java Native Interface

The Java Native Interface, through which native code and Java call each other inside one process. Unity's Android bridge is built on it: a C# call reaches Java through JNI, and a Java callback reaches C# the same way.

Each crossing looks classes and methods up by name and signature at run time, which is why a renamed Java method still compiles in C# and fails when it is called, and why [[R8]] can remove Java code that C# reaches by name. Objects that cross hold references someone has to release, and a thread Unity did not create has to be attached to the Java VM before it can make a call. [[#android-java-calls]] covers `AndroidJavaObject` and `AndroidJavaClass` on the C# side, and [[#android-callbacks]] covers `AndroidJavaProxy`.

## JSON Web Token {#json-web-token}
= JWT | JWTs

A compact, URL-safe format for passing claims between two parties, defined in RFC 7519: the claims are a JSON object, signed or encrypted, and the token is a string of base64url parts separated by periods.

The claims of a signed token can be read by anyone who holds it, while only the holder of the signing key can produce a valid one. Backends often issue access tokens in this format, and OAuth still treats an access token as opaque to the client, so a client relies on the lifetime its token response states rather than on claims it reads from the token, as [[#http-sessions]] explains.

## Keychain {#keychain}
= iOS Keychain

The encrypted database in which iOS apps keep small secrets, such as passwords, tokens and keys, through Keychain Services.

Each item has an accessibility setting that says when it can be read, for example while the device is unlocked, and a setting ending in `ThisDeviceOnly` keeps the item from migrating to a new device. [[#os-auth-callbacks]] keeps a pending sign-in attempt there, so that it survives the app's process, and [[#http-sessions]] keeps the session's tokens there.

## Logcat {#logcat}

Android's system log, and the tool that reads it. Each process writes to it, Unity included: its own lines and the output of C#'s `Debug.Log` carry the tag `Unity`, and crash reports go to a separate crash buffer.

Read it with `adb logcat` from a computer connected to the device, or in the Editor with Unity's Android Logcat package, filtered by tag and priority as [[#android-failure-evidence]] shows.

## Managed code stripping {#managed-code-stripping}
= code stripping | stripping

A build step that removes the C# a player build appears not to use, to make it smaller. It follows static references, so a type reached only by reflection, by a string name or from native code can be missing from the build while the Editor still has it.

Unity sets how aggressive it is with the Managed Stripping Level in Player Settings. A `link.xml` file or the `[Preserve]` attribute keeps what the analysis cannot see, which the first book's testing and debugging chapter covers. Android release builds add a second stripper for Java, [[R8]], and a bridge can break under either one. [[#http-dtos]] shows it reaching the DTOs that a JSON library fills through reflection.

## Maven coordinates {#maven-coordinates}
= Maven coordinate

The name of a library in a Maven repository, written `group:artifact:version`, such as `androidx.appcompat:appcompat:1.6.1`. Gradle downloads a library by its coordinates together with its POM file, which lists the libraries it depends on.

Declaring a dependency by its coordinates lets Gradle fetch what the library needs and settle version conflicts, by default by choosing the highest version requested. [[#android-plugin-forms]] contrasts it with an AAR copied into the project, and [[#gradle-dependencies]] covers resolution.

## Method swizzling {#method-swizzling}
= swizzling | swizzles | swizzled

Exchanging the implementations of two Objective-C methods at run time, so that a call to one runs the other.

SDKs use it to hear what the application delegate hears without asking the game to forward it: the SDK's version of a delegate method runs in place of the original and is expected to call it. When two SDKs swizzle one method, the one installed last runs first, and the chain holds only while each calls through, as [[#ios-xcode-postprocess]] shows. [[#sdk-evaluation]] asks whether an SDK does it and whether it can be turned off.

## OAuth {#oauth}
= OAuth 2.0

The authorization framework of RFC 6749, in which a client obtains tokens from an authorization server, usually after the user signs in on the server's pages and approves.

A native app uses the authorization code flow with PKCE through an external browser, as RFC 8252 sets out, and holds no client secret. [[#os-auth-callbacks]] covers the flow and its callbacks, and [[#http-sessions]] the session that follows it.

## Observer {#observer}
= observer pattern | observers

A source that announces facts, and listeners that react to them, with no reference from the source to any listener. At the platform boundary the source is the operating system or an SDK, announcing links, notifications, token changes and purchases.

The pattern's usual risks are order, retention and reentrancy. Platform events add timing: an event can arrive before anyone listens, arrive twice, or arrive after its listener is gone. [[#platform-events]] handles those with buffering, identity and a router.

## OpenAPI {#openapi}
= OpenAPI Specification | OAS

A standard, language-independent description of an HTTP API: its paths and operations, their parameters, and the schemas of their requests and responses, in a document written in JSON or YAML.

One description can generate client code, DTOs included, server stubs and tests, so the client and the server read a field's name and type from the same source. [[#http-versioning]] names it among the ideas that keep an API's contract from drifting between versions.

## P/Invoke {#p-invoke}
= platform invoke

Platform invoke: calling a native function from C# through a method declared `extern` with `[DllImport]`. On iOS the library name is `__Internal`, and IL2CPP turns the declaration into a direct call to a C function compiled into the app.

Arguments are marshaled on the way across: plain values pass as they are, strings are converted, and anything native code keeps after the call returns needs an ownership rule. The reverse direction, native code calling C#, goes through a function pointer to a static method marked `[MonoPInvokeCallback]`, and IL2CPP generates a wrapper that attaches the calling thread to the runtime. [[#ios-native-calls]] and [[#ios-callbacks]] work through both directions.

## Play App Signing {#play-app-signing}
= app signing key | upload key

Google Play's arrangement in which Google keeps the app signing key and signs the app that players install with it, while the team signs what it uploads with a separate upload key.

Anything that identifies the installed app by its certificate, such as the fingerprint in an App Links `assetlinks.json`, uses the app signing key's, which Play Console shows. [[#os-deep-links]] depends on it, and chapter 5 covers the two keys.

## Privacy manifest {#privacy-manifest}
= PrivacyInfo.xcprivacy | privacy manifests

A property list named `PrivacyInfo.xcprivacy` in which an app or an SDK declares the data it collects, whether it tracks, the domains it tracks through, and its reasons for calling the APIs that Apple lists as required-reason APIs.

Each binary declares for itself: an SDK ships its own manifest inside its framework or bundle, and Xcode's privacy report aggregates the app's and the SDKs' manifests. Unity 6.3 puts one for the engine in `UnityFramework`, as [[#xcode-build-settings]] shows.

## Provisioning profile {#provisioning-profile}
= provisioning profiles

A file from Apple, embedded in a signed iOS app, that ties the app's identifier to a team, the certificates allowed to sign it and the entitlements it may use, and for development builds the devices it may run on.

Xcode derives some entitlements from it, such as `aps-environment`, which decides whether the app's push token belongs to the sandbox or the production environment of APNs, as [[#os-notifications]] shows. [[#xcode-signing-model]] covers profiles, certificates and their expiry.

## Push token {#push-token}
= push tokens | device token | registration token

The identifier a push service issues to one app on one device, which the backend needs to send that device a notification. The platform can replace it, so the client sends it to the backend again whenever it changes.

Android apps receive a registration token from Firebase Cloud Messaging, and iOS apps receive a device token from the Apple Push Notification service; the two are separate services with separate tokens. [[#platform-events]] treats the current token as state the boundary keeps for late subscribers, and [[#os-notifications]] covers when tokens change and what the client does at sign-out.

## R8 {#r8}

The Android build tool that shrinks, optimizes and obfuscates Java and Kotlin code, usually in release builds. It removes what nothing in the app references and shortens names, so Java code that C# reaches by name through JNI can be removed or renamed unless a keep rule protects it.

The failure appears only in minified builds, as a missing class or method at the moment the bridge calls it. [[#gradle-r8-symbols]] covers keep rules and the mapping file that turns obfuscated stack traces back into names.

## Remote configuration {#remote-configuration}
= remote config

Values that a game fetches from a service while it runs, to turn features on and off or change numbers without a new build. The game starts from defaults compiled into it, and uses the fetched values once it activates them.

Where each backend environment has its own, as with a Firebase project per environment, remote configuration chooses among values inside an environment, not the environment itself, as [[#release-environments]] explains. A flag in it stops the calls that the game makes, not native code that runs without a call, as [[#sdk-upgrades]] shows.

## Scene delegate {#scene-delegate}
= scene delegates | UISceneDelegate

The object that receives the events of a UIKit scene: connecting, becoming active, resigning active, entering the background, and the links and user activities meant for it.

An app that declares a scene manifest in its `Info.plist` gets these for each scene, and its application delegate no longer receives them, nor the launch URL in its launch options. Unity 6.3 declares `UnityScene` as the scene delegate, which forwards the lifecycle to `UnityAppController` and, in 6000.3.11f1, not the links; [[#os-deep-links]] shows the gap and a category that closes it.

## Scripting define symbol {#scripting-define-symbol}
= scripting define | scripting defines | scripting define symbols

A name that Unity passes to the C# compiler, so that code under `#if NAME` is compiled into a build where the name is defined and left out of the others. Unity defines its own, such as `UNITY_ANDROID` and `DEVELOPMENT_BUILD`, and a project adds its own in Player settings or in a build profile.

A define decides what a build contains, not what it does when it runs: code under a define that a build lacks is not in that build at all. [[#release-build-variants]] uses one to keep QA tools out of store builds, and [[#release-environments]] one to keep other environments' addresses out.

## Staged rollout {#staged-rollout}
= staged rollouts | phased release

Releasing an update to a fraction of players first, and widening it while its metrics hold. Google Play calls it a staged rollout and the App Store a phased release.

On Google Play the team sets the percentage and raises it over time, and halting a rollout stops new deliveries while the players who already updated keep the version. The App Store's phased release spreads an update over seven days to players who have automatic updates on, can be paused for up to 30 days, and leaves any player free to update by hand. [[#sdk-upgrades]] decides what halts one, and [[#release-rollouts]] compares the two stores' controls and sets out the halting criteria.

## Strategy {#strategy}
= strategy pattern | strategies

One interchangeable rule behind a small interface, so the code that runs the rule does not know which version it holds. The choice is made elsewhere, usually where the object is built.

At the platform boundary it holds a rule that differs between platforms inside a capability that is otherwise shared, such as how purchases are restored, with the implementation chosen in the composition root that [[#platform-composition]] describes. A strategy with a single implementation is an interface nobody needed yet.

## TestFlight {#testflight}

Apple's service for sending beta builds of an app to testers through App Store Connect. Testers install the builds with the TestFlight app, and their crash reports reach the developer whatever their device's sharing settings.

The Crashes organizer in Xcode shows crash reports from TestFlight and App Store builds, with names where the build's dSYMs were uploaded with it, as [[#ios-failure-evidence]] describes. [[#release-rollouts]] covers internal and external testers, and [[#release-verification]] why a release candidate is tested from it.

## TLS {#tls}
= Transport Layer Security

Transport Layer Security: the protocol that encrypts HTTPS and proves the server's identity. In its handshake the server presents a certificate for its host name, and the client refuses the connection unless the certificate chains to an authority it trusts and names the host it asked for.

That check is why nothing between the device and the server can answer in the server's name without the connection failing. A captive portal that intercepts a game's HTTPS request produces a certificate for the wrong host, and the request ends as a connection error, as [[#network-offline]] describes.
