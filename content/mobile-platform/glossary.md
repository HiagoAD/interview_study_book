---
book: Unity Mobile Platform Engineering
kind: glossary
---

## Assembly definition {#assembly-definition}
= asmdef | assembly definitions

A Unity asset that compiles the scripts in its folder into an assembly of their own, with the assemblies it references and the platforms it compiles for stated in the asset. Code in it can use another assembly's types only through a reference, which turns a boundary into something the compiler checks.

Two defaults decide whether that check has teeth. The predefined `Assembly-CSharp` references every assembly marked Auto Referenced, and every assembly definition references every precompiled plugin DLL unless the plugin's Auto Referenced setting is off or the assembly uses Override References. [[#platform-interfaces]] uses both rules to keep vendor types out of gameplay, and [[#platform-composition]] uses the platform list to compile an adapter for its own platform only.

## Deep link {#deep-link}
= deep links

A URL that opens an app at a particular place instead of a web page. It can use a custom scheme, which any app can claim, or a verified https link that the platform has confirmed belongs to the app.

Unity reports the link that launched the app in `Application.absoluteURL` and raises `Application.deepLinkActivated` for links that arrive while it runs, so code that subscribes after start-up reads the property for the launch link. Anyone can send a link, which makes it untrusted input: it may choose a screen, and it grants nothing without the server. Chapter 4 covers verified links on both platforms.

## Edit Mode and Play Mode tests {#play-mode-tests}
= Edit Mode tests | Unity Test Framework

The two environments of Unity's Test Framework. Edit Mode tests run without entering Play Mode and suit rules that need no engine; Play Mode tests run with the engine playing, and can also be built into a player and run on a device.

Neither runs the native half of a platform integration in the Editor, which is why the contract suite in [[#platform-testing]] has a device run. Unity 6.3 ships version 1.6 of the framework, and from Unity 6.2 on its guide is part of the Unity Manual.

## Idempotence {#idempotence}
= idempotent | idempotency

A property of an operation whose repetition changes nothing further: applying it twice for the same identity leaves the same state as applying it once.

The identity is the whole mechanism. A purchase grant is idempotent for its transaction id, and a request for the key the client sent with it; an operation with no stable identity cannot be idempotent, because nothing tells the second call that it is the second. Platforms redeliver events on purpose, so a grant that is not idempotent eventually grants twice, as [[#platform-events]] shows. Chapter 9 carries the idea over HTTP with idempotency keys.

## IL2CPP {#il2cpp}

Unity's ahead-of-time scripting backend. It converts the game's compiled C# into C++, which the platform's compiler then builds into native code, and mobile release builds normally use it.

Two consequences reach the platform boundary. Code has to exist when the build is made, so reflection over types that nothing references can work in the Editor and fail on a device, where [[managed code stripping]] may have removed them. And a C# exception becomes a C++ exception: the wrapper IL2CPP generates for a callback that native code calls has no handler, so an exception that escapes the callback unwinds into native frames. The generated C++ sits in the exported project, and reading it settles questions about marshaling that the documentation leaves open.

## JNI {#jni}
= Java Native Interface

The Java Native Interface, through which native code and Java call each other inside one process. Unity's Android bridge is built on it: a C# call reaches Java through JNI, and a Java callback reaches C# the same way.

Each crossing looks classes and methods up by name and signature at run time, which is why a renamed Java method still compiles in C# and fails when it is called, and why [[R8]] can remove Java code that C# reaches by name. Objects that cross hold references someone has to release, and a thread Unity did not create has to be attached to the Java VM before it can make a call. Chapter 2 covers the C# side: `AndroidJavaObject`, `AndroidJavaClass` and `AndroidJavaProxy`.

## Managed code stripping {#managed-code-stripping}
= code stripping | stripping

A build step that removes the C# a player build appears not to use, to make it smaller. It follows static references, so a type reached only by reflection, by a string name or from native code can be missing from the build while the Editor still has it.

Unity sets how aggressive it is with the Managed Stripping Level in Player Settings. A `link.xml` file or the `[Preserve]` attribute keeps what the analysis cannot see, which the first book's testing and debugging chapter covers. Android release builds add a second stripper for Java, [[R8]], and a bridge can break under either one.

## Observer {#observer}
= observer pattern | observers

A source that announces facts, and listeners that react to them, with no reference from the source to any listener. At the platform boundary the source is the operating system or an SDK, announcing links, notifications, token changes and purchases.

The pattern's usual risks are order, retention and reentrancy. Platform events add timing: an event can arrive before anyone listens, arrive twice, or arrive after its listener is gone. [[#platform-events]] handles those with buffering, identity and a router.

## P/Invoke {#p-invoke}
= platform invoke

Platform invoke: calling a native function from C# through a method declared `extern` with `[DllImport]`. On iOS the library name is `__Internal`, and IL2CPP turns the declaration into a direct call to a C function compiled into the app.

Arguments are marshaled on the way across: plain values pass as they are, strings are converted, and anything native code keeps after the call returns needs an ownership rule. The reverse direction, native code calling C#, goes through a function pointer to a static method marked `[MonoPInvokeCallback]`, and IL2CPP generates a wrapper that attaches the calling thread to the runtime. Chapter 3 works through both directions.

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
