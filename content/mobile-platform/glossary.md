---
book: unity-mobile-platform-engineering
kind: glossary
---

## ABI {#abi}
= application binary interface | ABIs

The application binary interface a native library is compiled for: an instruction set and its calling conventions. Android names each one, such as `arm64-v8a`, `armeabi-v7a` and `x86_64`, and a device installs the native libraries of the ABI that fits it.

Unity builds its player libraries for the ABIs chosen under Target Architectures in Player Settings, and each native plugin has to exist for all of them. A plugin missing for one ABI fails on the devices that need it and nowhere else, as [[#android-plugin-forms]] shows.

## ANR {#anr}
= Application Not Responding | ANRs

Application Not Responding: Android's verdict that an app's UI thread has stopped responding, most often because an input event went unanswered for too long. In the foreground it shows a dialog that offers to close the app, and Android records every thread's stack at that moment.

In a Unity game the UI thread is Android's, not the thread that runs `Update`, so a frozen game loop becomes an ANR when the UI thread ends up waiting for it. [[#android-callbacks]] shows one way that happens, and [[#android-failure-evidence]] where the evidence is.

## App extension {#app-extension}
= app extensions

A separate bundle inside an iOS app that the system runs in a process of its own, to extend the system on the app's behalf: a notification service extension that edits a push notification before it appears, a widget, a share extension.

An extension has its own target, `Info.plist`, entitlements and signature, and the app target embeds it. Unity's Xcode export has no such target, so a post-processor adds one; [[#ios-runtime-model]] shows where it fits among the targets that Unity writes.

## ARC {#arc}
= Automatic Reference Counting

Automatic Reference Counting: the Objective-C compiler inserts the retain and release calls that keep an object alive while a strong reference to it exists, and frees the object when the last one goes. Unity's Xcode export compiles plugin files with it.

ARC counts Objective-C references and nothing else. A pointer borrowed from an object, such as the one `UTF8String` returns, lives no longer than the object, and an object whose one reference is an `IntPtr` held by C# needs a retain of its own, taken with `CFBridgingRetain` and given back with `CFBridgingRelease`. [[#ios-frameworks]] covers both.

## Assembly definition {#assembly-definition}
= asmdef | assembly definitions

A Unity asset that compiles the scripts in its folder into an assembly of their own, with the assemblies it references and the platforms it compiles for stated in the asset. Code in it can use another assembly's types only through a reference, which turns a boundary into something the compiler checks.

Two defaults decide whether that check has teeth. The predefined `Assembly-CSharp` references every assembly marked Auto Referenced, and every assembly definition references every precompiled plugin DLL unless the plugin's Auto Referenced setting is off or the assembly uses Override References. [[#platform-interfaces]] uses both rules to keep vendor types out of gameplay, and [[#platform-composition]] uses the platform list to compile an adapter for its own platform only.

## Deep link {#deep-link}
= deep links

A URL that opens an app at a particular place instead of a web page. It can use a custom scheme, which any app can claim, or a verified https link that the platform has confirmed belongs to the app.

Unity reports the link that launched the app in `Application.absoluteURL` and raises `Application.deepLinkActivated` for links that arrive while it runs, so code that subscribes after start-up reads the property for the launch link. Anyone can send a link, which makes it untrusted input: it may choose a screen, and it grants nothing without the server. Chapter 4 covers verified links on both platforms.

## Dispatch queue {#dispatch-queue}
= dispatch queues | main queue | Grand Central Dispatch | GCD

A queue of blocks that Grand Central Dispatch, Apple's library for concurrent work, takes in order and runs on threads it manages, or, for the main queue, on the main thread. iOS frameworks and SDKs deliver many of their callbacks on queues of their own.

`dispatch_async(dispatch_get_main_queue(), block)` posts work to the main thread and returns at once, which is how an iOS bridge moves UI work to the thread that UIKit requires; in a Unity game, a block posted there runs between two frames of the player loop. A callback that arrives on another queue runs C# on that queue's thread, as [[#ios-callbacks]] shows.

## dSYM {#dsym}
= dSYMs | debug symbol file

The debug symbol file of one Apple binary: a bundle holding the information that turns the binary's addresses into function names, source files and lines. A binary and its dSYM share a build UUID, and a dSYM fits no build but its own.

A Unity iOS release build produces one for the app and one for `UnityFramework`, which covers the game's C# as IL2CPP compiled it, and the Xcode archive keeps both. [[#ios-failure-evidence]] shows how to check a UUID and symbolicate with them, and chapter 11 archives them for each build.

## Edit Mode and Play Mode tests {#play-mode-tests}
= Edit Mode tests | Unity Test Framework

The two environments of Unity's Test Framework. Edit Mode tests run without entering Play Mode and suit rules that need no engine; Play Mode tests run with the engine playing, and can also be built into a player and run on a device.

Neither runs the native half of a platform integration in the Editor, which is why the contract suite in [[#platform-testing]] has a device run. Unity 6.3 ships version 1.6 of the framework, and from Unity 6.2 on its guide is part of the Unity Manual.

## Entitlements {#entitlements}
= entitlement | capability | capabilities

Key-value pairs in an app's code signature that grant it the use of a service or technology, such as push notifications, associated domains or Sign in with Apple. Xcode adds them through a target's capabilities and records them in an `.entitlements` file.

In a Unity export they belong to the `Unity-iPhone` target, whatever target holds the code that uses them, and a post-processor adds them with `ProjectCapabilityManager`, as [[#ios-xcode-postprocess]] shows. The signing that chapter 6 covers has to agree with them.

## Gradle {#gradle}

The build system Android apps are built with. Unity exports an Android build as a Gradle project with a `launcher` module and a `unityLibrary` module, and Gradle, through the Android Gradle Plugin, compiles the Java, merges the manifests, resolves dependencies and packages the APK or app bundle.

Unity 6.3 ships Gradle 8.13 with its Android module, and the project exported for this book in September 2026 named Android Gradle Plugin 8.10.0. [[#android-plugin-forms]] shows where each kind of plugin lands in the project, and chapter 5 covers the project, its templates and dependency resolution.

## Idempotence {#idempotence}
= idempotent | idempotency

A property of an operation whose repetition changes nothing further: applying it twice for the same identity leaves the same state as applying it once.

The identity is the whole mechanism. A purchase grant is idempotent for its transaction id, and a request for the key the client sent with it; an operation with no stable identity cannot be idempotent, because nothing tells the second call that it is the second. Platforms redeliver events on purpose, so a grant that is not idempotent eventually grants twice, as [[#platform-events]] shows. Chapter 9 carries the idea over HTTP with idempotency keys.

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

## Logcat {#logcat}

Android's system log, and the tool that reads it. Each process writes to it, Unity included: its own lines and the output of C#'s `Debug.Log` carry the tag `Unity`, and crash reports go to a separate crash buffer.

Read it with `adb logcat` from a computer connected to the device, or in the Editor with Unity's Android Logcat package, filtered by tag and priority as [[#android-failure-evidence]] shows.

## Managed code stripping {#managed-code-stripping}
= code stripping | stripping

A build step that removes the C# a player build appears not to use, to make it smaller. It follows static references, so a type reached only by reflection, by a string name or from native code can be missing from the build while the Editor still has it.

Unity sets how aggressive it is with the Managed Stripping Level in Player Settings. A `link.xml` file or the `[Preserve]` attribute keeps what the analysis cannot see, which the first book's testing and debugging chapter covers. Android release builds add a second stripper for Java, [[R8]], and a bridge can break under either one.

## Maven coordinates {#maven-coordinates}
= Maven coordinate

The name of a library in a Maven repository, written `group:artifact:version`, such as `androidx.appcompat:appcompat:1.6.1`. Gradle downloads a library by its coordinates together with its POM file, which lists the libraries it depends on.

Declaring a dependency by its coordinates lets Gradle fetch what the library needs and settle version conflicts, by default by choosing the highest version requested. [[#android-plugin-forms]] contrasts it with an AAR copied into the project, and chapter 5 covers resolution.

## Observer {#observer}
= observer pattern | observers

A source that announces facts, and listeners that react to them, with no reference from the source to any listener. At the platform boundary the source is the operating system or an SDK, announcing links, notifications, token changes and purchases.

The pattern's usual risks are order, retention and reentrancy. Platform events add timing: an event can arrive before anyone listens, arrive twice, or arrive after its listener is gone. [[#platform-events]] handles those with buffering, identity and a router.

## P/Invoke {#p-invoke}
= platform invoke

Platform invoke: calling a native function from C# through a method declared `extern` with `[DllImport]`. On iOS the library name is `__Internal`, and IL2CPP turns the declaration into a direct call to a C function compiled into the app.

Arguments are marshaled on the way across: plain values pass as they are, strings are converted, and anything native code keeps after the call returns needs an ownership rule. The reverse direction, native code calling C#, goes through a function pointer to a static method marked `[MonoPInvokeCallback]`, and IL2CPP generates a wrapper that attaches the calling thread to the runtime. [[#ios-native-calls]] and [[#ios-callbacks]] work through both directions.

## Push token {#push-token}
= push tokens | device token | registration token

The identifier a push service issues to one app on one device, which the backend needs to send that device a notification. The platform can replace it, so the client sends it to the backend again whenever it changes.

Android apps receive a registration token from Firebase Cloud Messaging, and iOS apps receive a device token from the Apple Push Notification service; the two are separate services with separate tokens. [[#platform-events]] treats the current token as state the boundary keeps for late subscribers, and chapter 4 covers when tokens change and what the client does at logout.

## R8 {#r8}

The Android build tool that shrinks, optimizes and obfuscates Java and Kotlin code, usually in release builds. It removes what nothing in the app references and shortens names, so Java code that C# reaches by name through JNI can be removed or renamed unless a keep rule protects it.

The failure appears only in minified builds, as a missing class or method at the moment the bridge calls it. Chapter 5 covers keep rules and the mapping file that turns obfuscated stack traces back into names.

## Strategy {#strategy}
= strategy pattern | strategies

One interchangeable rule behind a small interface, so the code that runs the rule does not know which version it holds. The choice is made elsewhere, usually where the object is built.

At the platform boundary it holds a rule that differs between platforms inside a capability that is otherwise shared, such as how purchases are restored, with the implementation chosen in the composition root that [[#platform-composition]] describes. A strategy with a single implementation is an interface nobody needed yet.

## TestFlight {#testflight}

Apple's service for sending beta builds of an app to testers through App Store Connect. Testers install the builds with the TestFlight app, and their crash reports reach the developer whatever their device's sharing settings.

The Crashes organizer in Xcode shows crash reports from TestFlight and App Store builds, with names where the build's dSYMs were uploaded with it, as [[#ios-failure-evidence]] describes. Chapter 10 covers release tracks.
