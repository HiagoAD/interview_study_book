---
book: unity-mobile-platform-engineering
chapter: 03: Calling iOS from C# and back
---

## What runs where in a Unity iOS app {#ios-runtime-model}

An iOS app is a bundle: a folder that iOS treats as one app, holding the executable, its [[Info.plist]], its resources and the frameworks it loads. A Unity iOS build does not produce that bundle. It produces an Xcode project, which Xcode then compiles, links and signs; chapter 6 covers that build. The project that Unity 6.3 writes has four targets, and the target a file belongs to decides whether it works:

| Target | Produces | What it holds |
| --- | --- | --- |
| `Unity-iPhone` | The app | `MainApp/main.mm`, the launch screens and icons, the `Data` folder with the game's scenes and assets, the `Info.plist` and the app's [[entitlements]]. It embeds the frameworks |
| `UnityFramework` | `UnityFramework.framework`, a dynamic framework inside the app | The engine library, Unity's Objective-C++ code in `Classes/`, the two libraries below, and every plugin from `Assets/Plugins/iOS` |
| `GameAssembly` | Two static libraries, `libGameAssembly.a` and `il2cpp.a` | The game's C# as [[IL2CPP]]'s C++, and IL2CPP's runtime, both compiled when Xcode builds |
| `Unity-iPhone Tests` | A test bundle | A placeholder unit-test target |

The Objective-C++ code in `Classes/` comes from a folder in the Editor named `Trampoline`, a name that Unity's code also uses for this layer, and it is the part of Unity that a plugin talks to. `MainApp/main.mm`, the one source file of the app target, loads `UnityFramework.framework` from the app's `Frameworks/` folder with `NSBundle` and hands over to it. The framework calls `UIApplicationMain`, the entry point of UIKit, Apple's framework for an app's interface and life, with `UnityAppController` as the application delegate: the object that UIKit tells about events of the whole app, such as its launch and its [[push token]]. Unity 6.3 also names a scene delegate, `UnityScene`, in the `Info.plist`, and UIKit tells the scene delegate about the app's window: when it enters the foreground, when it enters the background, and when a link arrives for it. `UnityScene` passes the foreground and background changes on to the controller, and when the window first enters the foreground, it has the controller start the engine, create the window and the view, and create a display link.

[Apple's reference for `CADisplayLink`](https://developer.apple.com/documentation/quartzcore/cadisplaylink) describes a timer that synchronizes an app's drawing with the display. It is added to a run loop, the loop in which a thread waits for events and handles them, and it calls its target each time the screen is about to update. Unity adds it to the run loop of the thread that creates it, which is the main thread, and each call runs one frame of the player loop. The 6000.3.11f1 code also holds a path for the newer Metal display link, switched off in that release with a comment about GPU timeouts; it would run on the same thread. A sample of a test project's main thread, taken while the game ran in the iOS Simulator, shows the whole chain:

```text
main                                        MainApp/main.mm, in the app
-[UnityFramework runUIApplicationMainWithArgc:argv:]
UIApplicationMain
  ...                                       the main thread's run loop
CA::Display::DisplayLink::dispatch_items    Core Animation fires the display link
-[UnityAppController(Rendering) repaintDisplayLink]
UnityRepaint
UnityPlayerLoopImpl
PlayerLoop()                                one frame: Update, coroutines, the rest
```

So on iOS the thread that runs `Update` is the app's main thread, the thread UIKit runs on, and [Apple's UIKit documentation](https://developer.apple.com/documentation/uikit) asks apps to use UIKit's classes from the main thread or the main dispatch queue alone, unless a class's documentation says otherwise. Three kinds of thread meet at the boundary:

| Thread | What runs there |
| --- | --- |
| The main thread | UIKit's callbacks, touches and views. Inside the display link's callback, Unity's player loop, and each call into native code made from it |
| Unity's own threads | Rendering, when Multithreaded Rendering is on, and job workers, loading and audio |
| Other threads | Completion handlers and callbacks that iOS frameworks and SDKs deliver on a [[dispatch queue]] of their own, and threads the game starts |

Multithreaded Rendering, an option in Player Settings, moves the graphics API calls from the main thread to a worker thread, as [Unity's iOS Player settings page](https://docs.unity3d.com/6000.3/Documentation/Manual/class-PlayerSettingsiOS.html) describes it; the same sample showed that thread as `UnityGfxDeviceWorker`. Scripts stay on the main thread either way.

Android differs here. On Android, Unity's main thread is not the UI thread, so a C# call that reaches native UI code fails there, as [[#android-runtime-model]] showed, while the same call works on iOS. A bridge that depends on it works on one platform by the accident of where the game loop runs. The contract should say instead that each native entry point that touches UI moves its own work to the UI thread: with `runOnUiThread` on Android, and with the main dispatch queue on iOS.

```objective-cpp
#import <UIKit/UIKit.h>
#include "Unity/UnityInterface.h"

// C# calls this on the main thread, inside a frame of the player loop.
extern "C" void PromptBridge_Show(const char* title)
{
    NSString* text = title ? [NSString stringWithUTF8String:title] : @""; // Copied: the pointer dies with the call.
    dispatch_async(dispatch_get_main_queue(), ^{ // Runs after this frame, between two player-loop calls.
        UIAlertController* alert = [UIAlertController alertControllerWithTitle:text
                                                                       message:nil
                                                                preferredStyle:UIAlertControllerStyleAlert];
        [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];
        [UnityGetGLViewController() presentViewController:alert animated:YES completion:nil];
    });
}
```

On iOS the post does a second job. The call arrives inside a frame of the player loop, and [Unity's troubleshooting page](https://docs.unity3d.com/6000.3/Documentation/Manual/TroubleShootingIPhone.html) describes UI operations that make iOS redraw the window at once, which from inside a frame runs the player loop again and logs `PlayerLoop called recursively!`. It recommends scheduling such work to run between player-loop calls, and a block posted to the main queue does that: it runs once the frame has returned to the run loop. `UnityGetGLViewController`, which the Trampoline declares in `Classes/Unity/UnityInterface.h`, returns the view controller that hosts the game's view, the usual parent for anything a plugin presents.

Sharing the thread has a cost too. Whatever blocks the main thread stops the game and UIKit together, and at launch, as the last section of this chapter shows, iOS ends an app whose main thread stays busy too long.

Where each file goes matters as much as where each call runs. Unity copies plugins from `Assets/Plugins/iOS` into the export, sources into `Libraries/Plugins/iOS/` and frameworks and bundles into `Frameworks/Plugins/iOS/`, and adds all of them to `UnityFramework`. That target is right for code, and wrong for three other things a platform team adds:

- Capabilities, such as push notifications, associated domains or Sign in with Apple, belong to the app target. Xcode records them as entitlements, and [Apple's documentation](https://developer.apple.com/documentation/bundleresources/entitlements) places an app's entitlements in the code signature of its executable, which is the app's and no framework's.
- An [[app extension]], such as a notification service extension that edits a push notification before it appears, is a bundle of its own that runs in a process of its own. It is a target of its own, and the app target embeds it.
- Resources that an SDK loads from the main bundle. In a test export, a resource bundle placed in `Assets/Plugins/iOS` went into the resources of `UnityFramework` and shipped inside `UnityFramework.framework`, where `[NSBundle mainBundle]` does not look, and a plain `.plist` placed beside it was not copied into the export at all. A vendor's configuration file that the SDK expects at the top of the app needs a post-processor to add it to `Unity-iPhone`, which the section on post-processing covers.

Lab exercise: Generate an Xcode project from a Unity project with one empty scene, and list the files that each target compiles, links or copies into the app. Then write a native function that logs `[NSThread isMainThread]`, call it from `Update` and from the completion handler of an iOS API whose documentation names no queue, and draw the threads beside the drawing you made for Android in chapter 2.

?? ios-targets A post-processor adds the push notifications capability to the exported project. Which target has to carry it?
* `Unity-iPhone`, since entitlements go in the app executable's signature
- `UnityFramework`, since the plugin that registers for push is compiled there
- `GameAssembly`, since the C# that asks for a push token is compiled there
- Each target that links the push plugin, since each one is signed separately
- None of them: iOS grants push to any app whose identifier is registered
> Xcode records a capability as entitlements, and iOS reads an app's entitlements from the code signature of its executable. Plugin code in `UnityFramework` runs inside that process and uses the app's entitlements, so the capability goes on `Unity-iPhone`, whatever target holds the code that uses it.

?+ A vendor's SDK reads its configuration file with `[NSBundle mainBundle]`. Where does the file have to end up?
* In the resources of `Unity-iPhone`, at the top level of the app's own bundle
- In `Assets/Plugins/iOS`, which Unity copies into the app's main bundle
- In the resources of `UnityFramework`, beside the plugin that reads it
- In the `Data` folder, which Unity loads before any plugin starts
- In `Assets/StreamingAssets`, which iOS searches as part of the main bundle
> The main bundle is the app. Unity puts plugin code and resource bundles from `Assets/Plugins/iOS` into `UnityFramework`, whose resources ship inside `UnityFramework.framework`, and it leaves a plain `.plist` out of the export altogether. A post-processor adds such a file to the `Unity-iPhone` target.

?+ The game needs a notification service extension. How does it fit into the exported project?
* As a separate target that the app embeds, since it runs in its own process
- As source files in `Assets/Plugins/iOS`, compiled into `UnityFramework`
- As a second scene delegate, named in the app's `Info.plist`
- As a category on `UnityAppController`, which receives the notification first
- As a resource bundle that `UnityFramework` loads when a notification arrives
> An app extension is a bundle with an executable of its own, which iOS starts in a separate process, so it needs its own target and its own signature, and the app target embeds it. Unity's export has no such target, so a post-processor adds it.

?+ [tf] Source files placed in `Assets/Plugins/iOS` compile into the `Unity-iPhone` target by default.
* false
> Unity copies them into the export and adds them to `UnityFramework`, together with the engine and the game's C#. The app target compiles one file of its own, `MainApp/main.mm`.

?? ios-main-thread On iOS, which thread runs `Update`, and which thread does UIKit require for UI work?
* The same thread: the app's main thread, where a display link runs each frame
- Unity's own game thread for `Update`, and the app's main thread for UIKit
- The render thread for `Update`, since the display link belongs to rendering
- A dispatch queue for `Update`, and the main thread for UIKit
- The main thread for `Update`, and any thread for UIKit calls that C# makes
> Unity adds a `CADisplayLink` to the main thread's run loop, and each of its calls runs one frame of the player loop there. That is also the thread UIKit requires, so native code called from `Update` is already where UIKit wants it, which is not the case on Android.

?+ A native `ShowPrompt` presents a `UIAlertController` directly, and C# calls it from `Update`. It works on iOS, and the same design fails on Android. What should the bridge contract say?
* Each UI entry point posts its own work to the UI thread, whichever thread calls it
- C# calls UI entry points from `Update`, which is the UI thread on both platforms
- The Android version calls `InvokeOnUnityMainThread` before it touches a view
- The iOS version waits with `waitUntilDone:YES`, so the alert is up on return
- C# calls UI entry points from a worker thread, which neither platform blocks
> On iOS, `Update` runs on UIKit's thread; on Android, Unity's main thread is not the UI thread. A contract under which each native UI function moves its own work to the UI thread, with the main dispatch queue or `runOnUiThread`, gives C# the same behavior on both platforms, from any thread.

?+ A completion handler from an iOS framework runs on a background dispatch queue and calls a C# method that moves a Transform. What happens?
* The C# method runs on that queue's thread, where Unity's APIs are not allowed
- Unity moves the call to the main thread before the C# method starts
- Unity queues the Transform change and applies it at the end of the frame
- The call waits for the next frame, since the C# runtime pauses between frames
- The Transform moves, since native threads on iOS share the main thread's loop
> A callback runs on the thread that calls it, and a framework that documents an arbitrary queue can call from any. Code on that thread has to hand the work to the main thread first, as the adapter in chapter 1 does.

?+ With Multithreaded Rendering switched on in Player Settings, which thread runs `Update` on iOS?
* The main thread: the setting moves graphics API calls to a worker thread
- The render thread, which the setting creates to run the player loop
- A job worker, since the setting runs scripts in parallel with rendering
- The main thread for the first frame, and the render thread after it
- A dispatch queue, which the display link switches to
> Multithreaded Rendering moves the graphics API calls from the main thread to a worker thread, which a sample shows as `UnityGfxDeviceWorker`. The player loop, scripts included, stays on the main thread.

?+ C# already calls `ShowPrompt` on the main thread. Why does the iOS implementation still post its UI work to the main queue?
* It runs after this frame, outside the player loop, and keeps Android's contract
- UIKit rejects calls made from inside a display link's callback
- A posted block runs on the render thread, which draws the alert sooner
- Posting makes the call synchronous, so C# knows the alert is showing
- The main queue has a thread of its own, separate from the main thread
> The call arrives inside a frame, and UI work that redraws at once can re-enter the player loop, which Unity logs as `PlayerLoop called recursively!`. A block posted to the main queue runs once the frame has returned to the run loop, and posting to the UI thread is the same rule the Android bridge follows.

## DllImport, __Internal, and marshaling {#ios-native-calls}

On Android, a native plugin is a shared library that the game loads when it runs, and C# names it: `[DllImport("vendorcore")]` finds `libvendorcore.so`, as [[#android-plugin-forms]] showed. iOS accepts third-party dynamic code inside frameworks alone ([Apple's page on bundle layout](https://developer.apple.com/documentation/bundleresources/placing-content-in-a-bundle) rules out standalone `.dylib` files), and Unity compiles plugin sources, and links static libraries, into `UnityFramework` together with the game's C#. There is no library to name, so the declaration names the program itself:

```csharp
[DllImport("__Internal")]
static extern int SecureStore_Write(string key, string value);
```

[[IL2CPP]] turns each such declaration into a direct call to the C function of that name, which the linker resolves when Xcode builds `UnityFramework`. Three consequences follow.

A missing native function is a build error. A declaration whose function is misspelled, left out of the build, or excluded from iOS in the plugin importer stops the link, which names the wrapper that IL2CPP generated for the declaration:

```text
Undefined symbols for architecture arm64:
  "_SecureStore_Write", referenced from:
      _SecureStoreNative_SecureStore_Write_m5A1C… in libGameAssembly.a(…)
ld: symbol(s) not found for architecture arm64
```

On Android the same mistake compiles and builds, and fails on the device at the first call.

C linkage decides the name. The linker looks for the C name, and a `.mm` or `.cpp` file is compiled as C++, which encodes a function's parameter types into its symbol. `int SecureStore_Clear(void)` written in a `.mm` file becomes `__Z17SecureStore_Clearv` and fails the link as though it were missing. [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/ios-native-plugin-create.html) asks for `extern "C"` around such functions; C and Objective-C files need nothing.

The Editor has none of this. There, `__Internal` names the Editor's own process, which contains none of the plugin's functions, and the call throws `EntryPointNotFoundException`. The composition root in [[#platform-composition]] gives the Editor a simulator, so no Editor code reaches these declarations.

Data crosses as C types. The rules below come from the C++ that IL2CPP generated for a test project, checked by running it in the Simulator:

| C# | C | What crosses |
| --- | --- | --- |
| `int`, `long`, `float`, `double` | `int32_t`, `int64_t`, `float`, `double` | The value |
| `IntPtr` | `void*` | An address or an opaque handle |
| `bool` | `int32_t`, or `bool` with `[MarshalAs(UnmanagedType.U1)]` | Four bytes, unless the declaration says otherwise |
| `string`, as an argument | `const char*` | A UTF-8 copy, freed when the call returns |
| `string`, as a result | `char*` | Copied into a new C# string, then passed to `free` |
| `int[]`, `float[]` | A pointer, with the count as another argument | The C# array's own elements, for the length of the call |
| A struct of numbers | A C struct with the same fields in the same order | The struct's bytes |

A struct whose fields are all plain numbers is what the marshaler calls blittable: its bytes mean the same thing on both sides, so they cross as they are. Strings, booleans and arrays are where the questions start.

Strings passed in are copies. IL2CPP converts the C# string to UTF-8 in a buffer from `malloc`, passes the pointer, and frees the buffer as soon as the native function returns. The generated wrapper, abridged:

```cpp
// IL2CPP's wrapper for SecureStore_Write, abridged.
char* key_marshaled = il2cpp_codegen_marshal_string(key);     // a UTF-8 copy, from malloc
char* value_marshaled = il2cpp_codegen_marshal_string(value);
int32_t result = SecureStore_Write(key_marshaled, value_marshaled);
il2cpp_codegen_marshal_free(key_marshaled);                    // free, right after the call
il2cpp_codegen_marshal_free(value_marshaled);
```

Measured from the native side in the test project, an argument's buffer was a 16-byte allocation during the call and no allocation at all after it. A native function that stores the pointer and reads it later reads memory that the allocator may have given to something else: the old text if nothing has reused it yet, other data if something has, or a crash. Native code copies what it keeps before it returns, into an `NSString` or with `strdup`.

Strings returned are freed. For a function declared to return `string`, IL2CPP copies the returned characters into a new C# string and then passes the pointer to `free`. The function has to return memory from `malloc`, which is what `strdup` gives, and [Unity's page on callbacks from native code](https://docs.unity3d.com/6000.3/Documentation/Manual/ios-native-plugin-call-back.html) asks for returned strings in UTF-8 and on the heap. A string literal, a static buffer or the pointer from `[NSString UTF8String]`, which belongs to the string, ends the app when the marshaler frees it. In the test project, a returned literal and a returned `UTF8String` pointer each stopped the app with the same line, and the crash report put `il2cpp_codegen_marshal_free` under the abort, called from the P/Invoke wrapper:

```text
malloc: *** error for object 0x108f333ab: pointer being freed was not allocated
```

When native code has to keep ownership of what it returns, a buffer it reuses for example, C# declares the result `IntPtr` and reads it with `Marshal.PtrToStringUTF8`, which copies the characters and frees nothing.

Booleans are four bytes unless told otherwise. C#'s `bool` is marshaled as a four-byte value by default, a Windows convention, while C's `bool` and Objective-C's `BOOL` are one byte on iOS devices. As a single argument or result, the difference did not show in the test project, since one value travels in a register either way. Inside a struct it changes the layout:

```csharp
// The C side: typedef struct { bool muted; bool vibrate; int32_t volume; } AudioFlags; (8 bytes)
struct AudioFlags { public bool muted; public bool vibrate; public int volume; } // marshaled as 12 bytes
```

The native side read `volume` from where the marshaled copy kept `vibrate`, and returned 0 for a volume of 7, with no error anywhere. `[MarshalAs(UnmanagedType.U1)]` on each `bool`, parameters and fields alike, or a `byte` on both sides, makes the layouts agree.

Arrays are lent. An array of numbers crosses as a pointer to the C# array's own elements, with no copy, so native code can read or fill it, and the count goes as a separate argument. The pointer is good for the call and no longer. Data with a shape of its own, nested or of varying length, is simpler as one JSON string each way than as a set of structs, at the cost of a parse on each side.

The ownership rules belong next to the declarations, where both sides read them. The game keeps its session token in the keychain, iOS's encrypted store for small secrets, through two functions:

```csharp
// In the iOS adapter's assembly. The comments are the contract with SecureStore.mm.
static class SecureStoreNative
{
    // key and value cross as UTF-8 copies that live for the call. Returns an OSStatus: 0 is success.
    [DllImport("__Internal")]
    public static extern int SecureStore_Write(string key, string value);

    // The native side returns a malloc'd copy, which the marshaler frees; null when nothing is stored.
    [DllImport("__Internal")]
    public static extern string SecureStore_CopyValue(string key);
}
```

```objective-cpp
#import <Foundation/Foundation.h>
#import <Security/Security.h>
#include <string.h>

static NSMutableDictionary* QueryFor(const char* key)
{
    return [@{ (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
               (__bridge id)kSecAttrAccount: @(key) } mutableCopy];
}

extern "C" {

// key and value are UTF-8 and valid only during the call; the keychain keeps its own copy.
// Returns an OSStatus: 0 is success.
int SecureStore_Write(const char* key, const char* value)
{
    NSMutableDictionary* query = QueryFor(key);
    SecItemDelete((__bridge CFDictionaryRef)query);
    query[(__bridge id)kSecValueData] = [@(value) dataUsingEncoding:NSUTF8StringEncoding];
    query[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAfterFirstUnlock;
    return (int)SecItemAdd((__bridge CFDictionaryRef)query, NULL);
}

// Returns a UTF-8 copy from malloc, which the caller frees, or NULL when nothing is stored.
char* SecureStore_CopyValue(const char* key)
{
    NSMutableDictionary* query = QueryFor(key);
    query[(__bridge id)kSecReturnData] = @YES;
    CFTypeRef data = NULL;
    if (SecItemCopyMatching((__bridge CFDictionaryRef)query, &data) != errSecSuccess) return NULL;
    NSString* value = [[NSString alloc] initWithData:(__bridge_transfer NSData*)data encoding:NSUTF8StringEncoding];
    return value ? strdup(value.UTF8String) : NULL;
}

}
```

A `NULL` result reaches C# as `null`. The `__bridge` casts convert between Objective-C objects and the types of Core Foundation, the C layer beneath Foundation that the Security framework uses. `__bridge_transfer` also moves ownership: `SecItemCopyMatching` returns its result retained, and the cast hands that reference to [[ARC]], which releases it once the string has been made. The status codes matter too. In the Simulator, an unsigned test build got `errSecMissingEntitlement`, -34018, from `SecItemAdd` instead of 0, since the keychain expects a signed app, which is one more reason the adapter maps every status and does not assume success.

Exercise: Write three native functions for a plugin you know: one that takes a string, one that returns a string, and one that takes a struct with a `bool` in it. Above each, write the comment its caller needs: who allocates each pointer, who frees it, and how long it stays valid. Then write the matching C# declarations, with `[MarshalAs]` wherever the defaults do not match.

?? ios-string-lifetime A native `Analytics_SetUserId(const char* id)` stores the pointer and reads it at the next upload. Uploads sometimes carry garbage, and some crash. Why?
* IL2CPP frees its UTF-8 copy of the string as soon as the call returns
- The C# garbage collector moves the string, so the stored pointer goes stale
- IL2CPP passes UTF-16 text, which native code misreads after one character
- ARC releases the characters when the autorelease pool drains after the frame
- The pointer refers to the C# string, which is freed when its variable goes out of scope
> The marshaler allocates a UTF-8 copy with `malloc`, passes it, and frees it when the native function returns. A pointer kept past the call points at freed memory, which may still hold the old text, hold something else, or fault. Copy what you keep before returning.

?+ What does native code receive for a C# `string` argument under IL2CPP?
* A pointer to a UTF-8 copy that the marshaler frees after the call
- A pointer into the C# string's UTF-16 characters, pinned for the call
- A UTF-8 copy from `malloc` that native code is expected to free when done
- An `NSString` that ARC keeps alive for as long as native code holds it
- A pointer that stays valid for as long as the C# string is referenced
> IL2CPP converts the string to UTF-8 in a buffer from `malloc`, passes the pointer, and frees the buffer right after the call. Native code owns nothing, and a native `free` of the buffer would free it twice.

?+ How should native code keep a string that it received as a `const char*` argument?
* Copy it before returning, into an `NSString` or with `strdup`
- Keep the pointer, and have C# hold a reference to the string meanwhile
- Keep the pointer, and call `free` on it once a newer value replaces it
- Pin the C# string with a `GCHandle`, so that the pointer stays in place
- Retain the pointer with `CFRetain`, which extends the buffer's lifetime
> The buffer belongs to the marshaler and lives for the call. A copy made inside the call belongs to the native side, whatever C# does with its string afterwards.

?+ [tf] The `const char*` that native code receives for a C# string argument stays valid for as long as the C# string is referenced.
* false
> The pointer is to a UTF-8 copy, not to the C# string, and the marshaler frees the copy when the call returns.

?? ios-returned-string A native function declared `static extern string GuestName()` returns the literal `"guest"`. What happens when C# calls it?
* The marshaler passes the literal to `free`, and malloc aborts the app
- C# receives `"guest"`, and the literal stays in the binary untouched
- IL2CPP recognizes a pointer into the binary and skips the free
- The call returns null, since the literal is not in heap memory
- The literal is copied, and the pointer is left alone because it is `const`
> IL2CPP copies a returned `char*` into a C# string and then calls `free` on it. A literal was never allocated, so `free` stops the process with “pointer being freed was not allocated”. Return a copy from `malloc`, such as `strdup` gives.

?+ A crash report shows “pointer being freed was not allocated” under `il2cpp_codegen_marshal_free`, called from a P/Invoke wrapper. What is the likely bug?
* A native function returned a `string` that `malloc` did not allocate
- Native code stored a string argument and read it again after the call returned
- A `GCHandle` used as a callback context was freed a second time
- The garbage collector moved a C# string while the native call was running
- IL2CPP's wrapper freed the string argument of a native callback
> `il2cpp_codegen_marshal_free` under a P/Invoke wrapper frees what native code returned for a `string` result. A literal, a static buffer or the pointer from `[NSString UTF8String]` did not come from `malloc`, so `free` aborts.

?+ How must a native function that returns a `string` to C# allocate the characters?
* With `malloc`, as `strdup` does, since the marshaler frees them with `free`
- As an autoreleased `NSString`, whose `UTF8String` the marshaler releases
- In a static buffer that the function reuses, since the marshaler copies it
- With C++ `new[]`, whose buffer the marshaler frees with `delete[]`
- On the stack, since the marshaler copies it before the function returns
> The marshaler copies the characters into a C# string and then calls `free`, so the memory has to come from `malloc`. A stack buffer is gone before the copy is made, and the other choices are freed with the wrong function.

?+ Native code keeps a UTF-8 buffer that it reuses, and has to keep ownership of it. How should C# declare the function that returns it?
* Return `IntPtr`, and read it with `Marshal.PtrToStringUTF8`, which frees nothing
- Return `string`, which copies the buffer and leaves the pointer to its owner
- Return `string` with `[MarshalAs(UnmanagedType.LPStr)]`, which skips the free
- Return `byte[]`, which the marshaler fills from the buffer without freeing it
- Return `string`, and have native code release the buffer after the copy
> Declared as `string`, the result is freed after the copy, whatever the attribute says. Declared as `IntPtr`, it is a plain address, and `Marshal.PtrToStringUTF8` copies the characters without taking ownership.

## Callbacks: MonoPInvokeCallback, function pointers, and UnitySendMessage {#ios-callbacks}

Native code calls C# the way C calls anything, through a function pointer. The C# side declares a delegate type with the shape of the C function pointer, and passes a method to a native function that stores it. What native code receives is a pointer to a wrapper that IL2CPP generated at build time, a plain C function that calls the C# method, and that wrapper explains the rules. This one, for a callback of type `void (*)(void* context, int status, const char* message)`, came from a test project, abridged:

```cpp
extern "C" void ReversePInvokeWrapper_Adapter_OnDone_m7E07…(intptr_t context, int32_t status, char* message)
{
    il2cpp::vm::ScopedThreadAttacher _vmThreadHelper;              // attaches this thread to the runtime if needed
    String_t* message_unmarshaled = il2cpp_codegen_marshal_string_result(message); // a copy; the caller keeps its buffer
    Adapter_OnDone_m7E07…(context, status, message_unmarshaled, NULL);
}
```

It has no object to call a method on, so the C# method has to be static. IL2CPP generates such a wrapper for a method marked `[MonoPInvokeCallback]`, from the `AOT` namespace; in a test, a static method without the mark got none. And nothing in the wrapper catches an exception. [Unity's page on scripting restrictions](https://docs.unity3d.com/6000.3/Documentation/Manual/scripting-restrictions.html) states the first two rules for every ahead-of-time platform. Breaking them compiles, and fails on the device, at the call that passes the delegate, with a `NotSupportedException` whose message says which rule was broken:

| Passed as the callback | What IL2CPP throws |
| --- | --- |
| An instance method | `IL2CPP does not support marshaling delegates that point to instance methods to native code.` |
| A lambda, even one that captures nothing | The same, because the C# compiler makes a lambda an instance method of a hidden class, such as `Adapter+<>c::<Run>b__42_0` |
| A static method without the attribute | `To marshal a managed method, please add an attribute named 'MonoPInvokeCallback' to the method definition.` |

The Editor never runs this code, since `__Internal` has nothing to call there, so the first run of an IL2CPP build, on a device or in the Simulator, is also the first test of each callback.

A static method has no `this`, so a native API that calls back takes a context pointer, a `void*` that it stores and hands back unchanged. C# puts a `GCHandle` there. `GCHandle.Alloc(obj)` registers the object with the garbage collector, which then keeps it alive; `GCHandle.ToIntPtr` turns the handle into a number that native code can store; and the callback gets the object back with `GCHandle.FromIntPtr(context).Target`. A reference kept in native memory does not count for the garbage collector, which is why the handle is needed at all.

Asking for the camera, which the game needs to scan a friend's invite code, shows the whole pattern. The native half is small:

```objective-cpp
#import <AVFoundation/AVFoundation.h>

typedef void (*AccessCallback)(void* context, bool granted);

// iOS calls the handler once, on "an arbitrary dispatch queue", as AVCaptureDevice.h puts it.
extern "C" void CameraAccess_Request(AccessCallback callback, void* context)
{
    [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo completionHandler:^(BOOL granted) {
        callback(context, granted);
    }];
}
```

The C# half implements the game's `ICameraAccess` and turns the callback into a task, as the adapters in chapter 1 do:

```csharp
public sealed class IosCameraAccess : ICameraAccess
{
    delegate void AccessCallback(IntPtr context, [MarshalAs(UnmanagedType.U1)] bool granted);

    [DllImport("__Internal")]
    static extern void CameraAccess_Request(AccessCallback callback, IntPtr context);

    public Task<bool> RequestAsync(CancellationToken cancel)
    {
        var result = new TaskCompletionSource<bool>();
        // The handle keeps result alive while iOS holds nothing but a number.
        IntPtr context = GCHandle.ToIntPtr(GCHandle.Alloc(result));
        CameraAccess_Request(OnAnswered, context);
        // Cancelling ends the wait, not the request: iOS will still call back with context.
        CancellationTokenRegistration stop = cancel.Register(() => result.TrySetCanceled(cancel));
        result.Task.ContinueWith(_ => stop.Dispose());
        return result.Task;
    }

    [MonoPInvokeCallback(typeof(AccessCallback))]
    static void OnAnswered(IntPtr context, bool granted)
    {
        try
        {
            GCHandle handle = GCHandle.FromIntPtr(context);
            var result = (TaskCompletionSource<bool>)handle.Target;
            handle.Free(); // iOS calls once, so this is the handle's last use.
            result.TrySetResult(granted);
        }
        catch (Exception e)
        {
            Debug.LogException(e); // Nothing may escape into native code.
        }
    }
}
```

The handle's lifetime follows one rule: one `Free` for each `Alloc`, after the last callback that can carry that context. Freed late, or never, a handle keeps its object alive, with everything the object refers to, like a proxy that Java still holds in [[#android-callbacks]]. Freed early, it is worse than a crash. IL2CPP keeps handles in a table and gives a freed slot to the next allocation, and in the test project a handle freed before its callback was reused at once: when native code called back with the old number, `GCHandle.FromIntPtr` returned the newer object, and nothing reported an error. So cancelling in C# must not free a handle while native code can still call back with it. When the native API can cancel, the adapter asks it to, and frees the handle in the callback that reports the cancellation. When it cannot, as with this request, cancelling ends the C# wait, and the handle waits for the answer from iOS.

The callback runs on whatever thread native code calls it from. For this request, `AVCaptureDevice.h` promises an arbitrary dispatch queue. In the test project, a callback from a background queue ran C# on a thread other than the main one, a callback from the main queue ran on the main thread, and the microphone request, with permission already granted, happened to answer on the main thread too, which is why the contract is written from the documentation and not from one run. Completing the task hands the rest of the work to the main thread, as the first row of the table in [[#platform-results-threads]] showed; anything else the callback does has to be safe off the main thread.

Nothing catches an exception that leaves the callback. Under IL2CPP a C# exception is a C++ exception, the wrapper has no handler for it, and neither do the Objective-C and dispatch frames that called the wrapper, so the process ends. In the test project, a callback that threw from a background queue and one that threw from the main queue both ended the app with the same line, and the C# message appeared nowhere:

```text
libc++abi: terminating due to uncaught exception of type Il2CppExceptionWrapper
```

The crashed thread in the report still shows the callback's frames, which is where to start. Each callback catches everything and reports it, as `OnAnswered` does.

The other way in is `UnitySendMessage(const char* obj, const char* method, const char* msg)`, which the Trampoline declares in `Classes/Unity/UnityInterface.h`. It behaves as it does on Android, and a test on the Simulator confirmed each point: the receiver is a `void Method(string)` on a GameObject found by name, the message arrives on the main thread a frame later (sent in frame 5, received in frame 6), and a missing receiver is a line in the log and nothing for the caller:

```text
SendMessage: object PlatformEvents not found!
SendMessage: object PlatformEvents does not have receiver for function OnPushToken!
```

It copies its three strings before it returns: a test sent a message from a background queue and overwrote the buffers straight after the call, and the message arrived intact. Native code can therefore call it from any thread, with temporary strings.

| | Function pointer | `UnitySendMessage` |
| --- | --- | --- |
| Receiver | A static C# method, and the object behind a context handle | A GameObject found by name |
| Arguments | Typed, as the delegate declares them | One string |
| Thread | The thread native code calls from | The main thread, a frame later |
| When something goes wrong | An exception that escapes ends the process | A missing receiver is a line in the log |
| Cleanup | The context handle, freed once by C# | None |

Use function pointers for results, for typed data, and for anything whose thread the contract has to name. `UnitySendMessage` suits notices that the game can afford to miss or ask for again, and a vendor plugin that already uses it. Either way, the adapter from chapter 1 wraps it.

Lab exercise: Implement a native timer that calls back into C# after a delay, with a context handle, and a cancel function after which the timer calls back once with a cancelled status. Free the handle in the callback. Then break it twice: free the handle in the cancel path, allocate a second handle, and log which object the late callback receives; and leave the handle unfreed, and check with the Memory Profiler whether its object survives a scene change.

?? ios-static-callback A C# adapter passes an instance method as the callback of a `[DllImport("__Internal")]` function. What happens on the device?
* The call that passes the delegate throws `NotSupportedException`
- It works, because IL2CPP stores the instance inside the wrapper it generates
- The Xcode build fails at the link, since no wrapper exists for the method
- The callback runs against a copy of the object that IL2CPP made for native code
- The app crashes later, the first time native code calls the pointer
> The wrapper that native code calls is a plain C function with no object to call a method on. Marshaling a delegate to an instance method raises `NotSupportedException` at the call that passes it, in an IL2CPP build; the Editor never runs `__Internal` calls, so it does not catch the mistake earlier.

?+ Why does a lambda that captures nothing fail as a native callback under IL2CPP?
* It compiles to an instance method of a hidden class, which IL2CPP refuses
- Lambdas are compiled when first called, which an ahead-of-time build does not do
- The lambda's delegate is collected before native code calls it back
- IL2CPP inlines lambdas into their callers, so no function pointer exists for one
- Lambdas run on the thread pool, which native code has no pointer into
> A lambda with no captures still becomes an instance method of a compiler-generated class, such as `Adapter+<>c::<Run>b__42_0`, and IL2CPP refuses instance methods with the same `NotSupportedException`. A named static method with `[MonoPInvokeCallback]` works.

?+ What does the wrapper that IL2CPP generates for a `[MonoPInvokeCallback]` method do before it calls the method?
* Attaches the thread to the runtime if needed, and converts the arguments
- Moves the call to the main thread, and waits for the method to return
- Catches C# exceptions and turns them into error codes that native code can read
- Checks that the context pointer is a live `GCHandle` before passing it on
- Queues the call for the next frame, as `UnitySendMessage` does
> The wrapper attaches a thread that the runtime does not know yet, copies arguments such as strings into C# values, and calls the method on the same thread. It does not change threads, check handles or catch exceptions; those are the callback's own work.

?+ A `[MonoPInvokeCallback]` method throws an exception while iOS calls it from a background queue. What happens?
* The process ends, with an uncaught `Il2CppExceptionWrapper` in the log
- Unity logs the C# exception with its stack trace, and the callback returns
- The exception is dropped at the native boundary, and the queue carries on
- IL2CPP rethrows it on the main thread at the start of the next frame
- The native caller receives an error code and reports the failure itself
> Under IL2CPP a C# exception is a C++ exception, and neither the generated wrapper nor the native frames above it catch it, so the C++ runtime terminates the process. The callback has to catch everything itself.

?? ios-callback-handle An adapter frees its `GCHandle` when the caller cancels, and the native SDK calls back later with the same context. What can happen?
* The callback resolves whichever object has since been given the freed slot
- `FromIntPtr` throws, and the callback can catch that and ignore it
- Nothing, since the handle keeps its object alive until native code returns
- The SDK notices the freed handle and skips the callback
- The garbage collector crashes the next time it scans the handle table
> IL2CPP reuses freed handle slots, so a stale number can name a newer object, and the callback completes the wrong operation without an error. Free the handle once, in the last callback that native code will make with it.

?+ What does `GCHandle.Alloc` do for an object whose one reference outside C# is a number held by native code?
* Keeps it alive, and gives native code a number that maps back to it
- Pins it in place, so that native code can read its fields directly
- Copies it into native memory, where it stays for the length of the call
- Ties the callback to the thread that allocated the handle
- Registers it with the SDK, which later calls it back by name
> The garbage collector does not count references kept in native memory. A handle is a reference that it does count, and `GCHandle.ToIntPtr` and `GCHandle.FromIntPtr` turn it into a number and back, which is all that native code needs to store.

?+ When should the adapter free the context handle of a native operation?
* Once, in the last callback that native code will make with that context
- When the C# caller cancels, since nothing is waiting for the result any more
- In a continuation of the C# task, which runs as soon as the task completes
- Right after the native call returns, since native code keeps its own copy
- In the adapter's finalizer, when the garbage collector reclaims the adapter
> Native code holds the number until its final callback, so that callback is the one safe place to free it. A cancellation, or a continuation that a cancellation can trigger, frees it while the callback may still come, and a finalizer does not run while a handle keeps its object reachable.

?+ An adapter allocates a handle for each request and does not free any of them. What does that cost?
* Each request's object, and all it refers to, stays reachable until the process ends
- Native code runs out of context slots after a fixed number of requests
- Each callback arrives later than the one before, as the handle table grows
- Nothing, since IL2CPP frees stale handles whenever a scene unloads
- The handles pin memory, which fragments the heap until allocation fails
> A handle is a strong reference until it is freed. Each completion source, adapter or screen that a leaked handle points at stays alive, a leak that grows with every request.

## Frameworks, xcframeworks, Swift, and Objective-C++ {#ios-frameworks}

Native code reaches an iOS build in five forms, and what separates them is when their code joins the game:

| Form | When its code joins the game | Where it ends up |
| --- | --- | --- |
| Source files: `.m`, `.mm`, `.c`, `.cpp`, `.swift` | Compiled into `UnityFramework` when Xcode builds | Inside `UnityFramework` |
| Static library, `.a` | Linked into `UnityFramework` when Xcode builds | Inside `UnityFramework` |
| Static framework | The same: a static library in a framework's folder layout, with its headers | Inside `UnityFramework` |
| Dynamic framework | Loaded by `dyld`, the dynamic linker, when the code that uses it loads | A binary of its own, in the app's `Frameworks/` folder |
| xcframework | As the library or framework in the slice that matches the build | As that slice |

[Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/ios-native-plugin-automated-integration.html) lists the extensions it copies from `Assets/Plugins/iOS` into the export by itself; frameworks and xcframeworks go through the plugin importer too, and land in `Frameworks/Plugins/iOS/`.

A dynamic framework's code is not copied into any binary that Xcode builds. `dyld` loads it when the binary that uses it loads, from a path such as `@rpath/VendorKit.framework/VendorKit`, where `@rpath` stands for the folders that the loading binary lists as its search path, and for `UnityFramework` those include the app's `Frameworks/` folder. So the framework has to be copied into the app as well as linked, which Xcode calls embedding. iOS loads frameworks from the top level of the app, and [Apple's page on bundle layout](https://developer.apple.com/documentation/bundleresources/placing-content-in-a-bundle) says that a nested bundle, such as an app extension, cannot include one. The app target, `Unity-iPhone`, therefore embeds a vendor's framework, even though `UnityFramework` is the target that links it. Unity's plugin importer has an Add to Embedded Binaries setting for this, which [its manual](https://docs.unity3d.com/6000.3/Documentation/Manual/plug-in-inspector.html) recommends for dynamically loaded libraries and the frameworks that hold them. In a Unity 6.3 test project, the setting was on by default for each dynamic framework imported and off for the static library.

When the embed is missing, [Apple's article on missing frameworks](https://developer.apple.com/documentation/xcode/addressing-missing-framework-crashes) describes a crash at launch, with `dyld` naming the library it could not find. A Unity game fails one step later and more quietly, because the missing framework is a dependency of `UnityFramework`, which `main.mm` loads with `NSBundle`. In the test project, that load failed, `main` found no framework object to start and returned, and the app closed at launch with no crash report at all. The device log held the reason:

```text
Error loading …/Frameworks/UnityFramework.framework/UnityFramework (235):
  dlopen(…): Library not loaded: @rpath/VendorKit.framework/VendorKit
  Referenced from: …/UnityFramework.framework/UnityFramework
  Reason: tried: …
```

A game that shows its launch screen and closes, with nothing in the crash reports, is the case for searching the device log for `Library not loaded`.

A device and the Simulator on an Apple silicon Mac both run arm64, and they are still different platforms: a binary built for one does not link into the other. `lipo`, which merges builds for different architectures into one file, refuses the pair, since both are arm64, and a library built for devices alone stops every Simulator build of the game:

```text
ld: building for 'iOS-simulator', but linking in object file (…/libVendorKit.a[2](VendorKit.o)) built for 'iOS'
```

An xcframework is Apple's container for this case: a folder with one slice for each platform, such as `ios-arm64` and `ios-arm64-simulator`, each holding a library or a framework, from which Xcode picks the slice each build needs. Unity 6.3 accepts xcframeworks in `Assets/Plugins/iOS`, static or dynamic, and a test export linked both kinds into `UnityFramework` and embedded the dynamic one. An SDK that ships a plain `.a` or `.framework` built for devices alone works in device builds, and breaks the Simulator for the whole team.

Static libraries have one more trap. A static library is an archive of object files, and the linker takes from it the object files that define a symbol something else uses. An Objective-C category, which adds methods to an existing class, such as a vendor's helpers on `NSString`, defines no symbol that anything refers to: its methods are found by name at run time. `libtool` even warns, when it builds such a library, that the object file “has no symbols”. So the linker leaves it out, the build succeeds, and the first call fails:

```text
*** Terminating app due to uncaught exception 'NSInvalidArgumentException', reason: '-[__NSCFConstantString vendor_reversed]: unrecognized selector sent to instance 0x105cd5560'
```

[Apple's Q&A on static libraries with categories](https://developer.apple.com/library/archive/qa/qa1490/_index.html) gives the fix: the `-ObjC` linker flag, which makes the linker load each object file that defines an Objective-C class or category. It loads them whether or not anything uses them, so the binary can grow; `-force_load` with a library's path loads every member of that one library instead. The `UnityFramework` target that Unity 6000.3.11f1 writes does not pass it. The one `-ObjC` in the exported project sits on `GameAssembly`, a static library, whose build does not run the linker at all. An SDK that needs the flag says so in its integration guide, and a post-processor adds it to `UnityFramework`, as the next section shows. In the test project, the category call worked once it had.

Swift files in `Assets/Plugins/iOS` compile into `UnityFramework` with the rest, and Unity adds the Swift build settings to the project when it finds one. iOS has carried the Swift runtime since iOS 12.2, as [Apple's Swift 5 release notes](https://developer.apple.com/documentation/xcode-release-notes/swift-5-release-notes-for-xcode-10_2) record, and [Unity 6.3 supports iOS 15 and later](https://docs.unity3d.com/6000.3/Documentation/Manual/ios-requirements-and-compatibility.html), so nothing else ships with the game. Often the platform decides the language. [StoreKit's current purchase API](https://developer.apple.com/documentation/storekit/in-app-purchase), with its `Product` and `Transaction` types, exists in Swift alone, and `SKPaymentQueue`, the original API it replaced and the one that Objective-C can call, has been deprecated since iOS 18.

C# reaches Swift through a C function, and Swift writes one with the `@c` attribute, which [Swift 6.3 made official](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0495-cdecl.md) as the formal version of `@_cdecl`, the name that older plugins use. A shop screen needs the localized prices of its products:

```swift
import Foundation
import StoreKit

public typealias PricesCallback = @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>?) -> Void

// C# declares it as: static extern void Store_FetchPrices(string productIdsJson, PricesCallback callback, IntPtr context);
@c(Store_FetchPrices)
public func storeFetchPrices(_ idsJson: UnsafePointer<CChar>, _ callback: PricesCallback, _ context: UnsafeMutableRawPointer?) {
    let json = String(cString: idsJson) // Copied now: the pointer is valid only during this call.
    Task {
        var prices: [String: String] = [:]
        if let ids = try? JSONDecoder().decode([String].self, from: Data(json.utf8)),
           let products = try? await Product.products(for: ids) {
            for product in products { prices[product.id] = product.displayPrice }
        }
        let body = (try? JSONEncoder().encode(prices)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        body.withCString { callback(context, $0) } // Once, on a thread of Swift's choosing.
    }
}
```

The C# side declares the function and a delegate with the shape of `PricesCallback`, and passes a context handle as in the previous section:

```csharp
delegate void PricesCallback(IntPtr context, string pricesJson);

[DllImport("__Internal")]
static extern void Store_FetchPrices(string productIdsJson, PricesCallback callback, IntPtr context);
```

In a Simulator test, the callback arrived on a thread from Swift's concurrency runtime, not on the main thread, so the rules of the previous section apply unchanged. Swift code with state of its own can also stay a class: a `public` class marked `@objc` is visible to Objective-C through the header that Xcode generates for the framework, `UnityFramework-Swift.h`, which a `.mm` file imports as `<UnityFramework/UnityFramework-Swift.h>` and wraps in C functions.

A `.mm` file is Objective-C++: C++ and Objective-C in one file, which suits a bridge whose C functions call Objective-C APIs. Unity's export compiles plugin files with [[ARC]], Automatic Reference Counting, under which the compiler inserts the retains and releases that keep an Objective-C object alive while a strong reference to it exists. Two consequences reach the boundary:

- A pointer borrowed from an object lives no longer than the object. `[NSString UTF8String]` points into memory the string owns, which is why the earlier sections copy it with `strdup` before returning or keeping it.
- An object handed to C# as an opaque `IntPtr` needs a reference that ARC can see, since ARC knows nothing of the copy C# holds. `CFBridgingRetain(object)` returns a retained pointer, and a release function that C# calls later ends that reference with `CFBridgingRelease`. Without the retain, ARC frees the object while C# still holds its address. It is the native mirror of the `GCHandle` in the previous section, and `__bridge_transfer` in `SecureStore_CopyValue` made the opposite move, from Core Foundation to ARC.

Lab exercise: Add to a test project a static library that holds an Objective-C category, and a dynamic framework. Build without `-ObjC` and call the category method; turn off Add to Embedded Binaries for the framework and launch; link a device-only copy of either into a Simulator build. For each break, keep the error it produces, where the error appeared, and the fix.

?? ios-dynamic-embed A Unity game with a new vendor framework shows its launch screen and closes, with no crash report, and the device log says `Library not loaded: @rpath/VendorKit.framework/VendorKit`. What is wrong?
* The framework is linked but not embedded in the app's `Frameworks/` folder
- The framework is static, and `dyld` looks for a copy of it that does not exist
- The framework lacks a Simulator slice, which a device also checks at launch
- The app's `Info.plist` does not list the framework among its libraries
- Managed code stripping removed the C# class that loads the framework
> A dynamic framework is loaded when the binary that links it loads, from the app's `Frameworks/` folder. Linked but not copied there, it is missing at launch. In a Unity app the failed load is that of `UnityFramework`, so `main` returns quietly instead of crashing, and the log line is the evidence.

?+ `UnityFramework` links a vendor's dynamic framework. Which target has to embed it?
* `Unity-iPhone`, whose `Frameworks/` folder is where iOS loads them from
- `UnityFramework`, since the target that links a framework is the one that embeds it
- `GameAssembly`, since the C# that calls into the framework is compiled there
- Both `Unity-iPhone` and `UnityFramework`, so that each binary finds a copy
- Neither, since iOS finds dynamic frameworks in the system's shared cache
> On iOS a nested bundle does not carry frameworks of its own, so the framework goes into the app's `Frameworks/` folder, next to `UnityFramework` itself. Unity's Add to Embedded Binaries setting puts it in the embed phase of `Unity-iPhone`.

?+ [multi n=5] Which of these have to be embedded in the app, and not just linked?
* A dynamic framework
* An xcframework whose slices hold dynamic frameworks
- A static library, `.a`
- A static framework
- An xcframework whose slices hold static libraries
- Plugin source files, such as `.mm` and `.swift`
> Static code becomes part of `UnityFramework` when it is linked. Dynamic code stays a binary of its own that `dyld` loads at run time, so it has to be in the app's `Frameworks/` folder.

?+ [tf] A static library that `UnityFramework` links also has to be embedded in the app.
* false
> The object files of a static library become part of `UnityFramework` at link time, so nothing of it remains to be loaded. Embedding is for dynamic frameworks, which `dyld` loads when the app starts.

?? ios-objc-flag A vendor's static library works in the vendor's sample app, and in the Unity game its first call fails with `unrecognized selector sent to instance`. What is most likely missing?
* The `-ObjC` linker flag on the target that links the library
- The library's headers in the header search paths of `UnityFramework`
- The Add to Embedded Binaries setting on the library in the importer
- An `extern "C"` block around the library's functions
- A Simulator slice in the library, which device builds also read
> An object file that holds only a category defines no symbol that anything refers to, so the linker leaves it out unless `-ObjC` makes it load each Objective-C object file. The build succeeds, and the method is missing at run time, which Objective-C reports as an unrecognized selector.

?+ Why does the linker leave out an object file that holds only an Objective-C category?
* It takes object files that define used symbols, and a category defines none
- Categories are compiled for the Simulator unless the library is an xcframework
- It drops categories that would replace an existing method of their class
- ARC removes category methods that no Objective-C code calls at build time
- Dead-code stripping removes methods that no C# declaration refers to
> From a static library, the linker pulls in the members that resolve undefined symbols. Category methods are found by name at run time, so nothing asks for their object file, and `libtool` reports that it “has no symbols” when the library is built.

?+ Where does a post-processor add `-ObjC` for a vendor library in `Assets/Plugins/iOS`?
* `OTHER_LDFLAGS` of `UnityFramework`, the target that links the plugins
- `OTHER_LDFLAGS` of `GameAssembly`, which carries the flag already
- `OTHER_LDFLAGS` of `Unity-iPhone`, since the app is what calls the category
- The library's Compile flags, in the plugin importer's iOS settings
- `OTHER_CFLAGS` of `UnityFramework`, where Objective-C options belong
> Unity links plugins into `UnityFramework`, so that link is the one that needs the flag. `GameAssembly` is a static library whose build does not link, so its `-ObjC` changes nothing, and compile flags do not reach the linker.

## Change the Xcode project from C#: post-processing and app delegate hooks {#ios-xcode-postprocess}

Every Unity build writes the Xcode project again, and whether a hand edit survives depends on the mode. [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/iphone-BuildProcess.html) describes two. Replace removes everything in the folder and generates a new project. Append removes the files in the folder's root and in `Data` and `Libraries`, fills them again, and updates the existing project file. In a test project, a build setting typed into `project.pbxproj` by hand and a key added to the `Info.plist` by hand both survived an Append build; the next Replace, which is what a clean CI build does, would remove both. A change that the game needs in its Xcode project is therefore code that runs after every build: a post-processor.

A post-processor implements `IPostprocessBuildWithReport`, or marks a static method with `[PostProcessBuild]`, the older form, and edits the project through the `UnityEditor.iOS.Xcode` classes. `PBXProject` reads and writes targets and build settings, with `GetUnityMainTargetGuid` and `GetUnityFrameworkTargetGuid` to find `Unity-iPhone` and `UnityFramework`; `PlistDocument` edits the `Info.plist`; and `ProjectCapabilityManager` adds capabilities and the entitlements file behind them. This one does the three jobs that the earlier sections left to a post-processor:

```csharp
#if UNITY_IOS
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.iOS.Xcode;

// Runs after Unity writes or updates the Xcode project, on every build, in Replace and in Append.
public sealed class IosProjectPostprocessor : IPostprocessBuildWithReport
{
    public int callbackOrder => 100;

    public void OnPostprocessBuild(BuildReport report)
    {
        if (report.summary.platform != BuildTarget.iOS) return;
        string root = report.summary.outputPath;

        string projectPath = PBXProject.GetPBXProjectPath(root);
        var project = new PBXProject();
        project.ReadFromFile(projectPath);
        // AddBuildProperty skips a value the setting already holds, so a second run adds nothing.
        project.AddBuildProperty(project.GetUnityFrameworkTargetGuid(), "OTHER_LDFLAGS", "-ObjC");
        project.WriteToFile(projectPath);

        string plistPath = Path.Combine(root, "Info.plist");
        var plist = new PlistDocument();
        plist.ReadFromFile(plistPath);
        plist.root.SetString("NSCameraUsageDescription", "Scans a code to join a friend's game.");
        PlistElementArray schemes = plist.root["LSApplicationQueriesSchemes"]?.AsArray()
            ?? plist.root.CreateArray("LSApplicationQueriesSchemes");
        if (!schemes.values.Any(v => v.AsString() == "examplewallet"))
            schemes.AddString("examplewallet"); // Checked first: an Append build keeps the old entry.
        plist.WriteToFile(plistPath);

        var capabilities = new ProjectCapabilityManager(projectPath, "Unity-iPhone/game.entitlements",
            targetGuid: project.GetUnityMainTargetGuid());
        capabilities.AddPushNotifications(false);
        capabilities.AddAssociatedDomains(new[] { "applinks:example.com" });
        capabilities.WriteToFile();
    }
}
#endif
```

`LSApplicationQueriesSchemes` lists the URL schemes of other apps that the game may check for, here an imaginary wallet app, and it stands for any list in the `Info.plist` that several SDKs add to. Since an Append build updates the project it finds, a post-processor runs over its own earlier output, and has to leave the same result the second time as the first. The test project showed where that holds without help and where it does not. `AddBuildProperty` skips a value that the setting already holds, so `-ObjC` stayed single however often the build ran, and so did the capabilities that `ProjectCapabilityManager` wrote and the description that `SetString` replaced. An entry appended to an `Info.plist` array did not: a version of the same post-processor without the check left its entry in the list twice after one Append build. The rule is to set values, and to look before adding to a list.

Order is the other half. Post-processors run in `callbackOrder` order, lowest first, as [Unity's reference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Build.IOrderedCallback-callbackOrder.html) states, and each SDK brings its own. In the test project, a second post-processor with a higher order set the same usage description to other text, and its text shipped, with no warning from either one. Two SDKs that each write `NSCameraUsageDescription`, or each replace the entitlements file, leave whichever ran last. The team's own post-processor, given the highest order, is the one that runs last, and so the place where such values are decided.

Some events reach an iOS app through its application delegate and nowhere else, and in a Unity game that delegate is `UnityAppController`. A plugin has three ways to hear what the controller hears:

- A listener. `UnityRegisterAppDelegateListener`, declared in `Classes/PluginBase/AppDelegateListener.h`, subscribes an object to the notifications that the controller posts and to UIKit's own, through optional methods such as `onOpenURL:`, `didBecomeActive:` and `applicationDidReceiveMemoryWarning:`. `UnityRegisterLifeCycleListener` does the same for the lifecycle alone. Any number of plugins can listen at once.
- A notification. The controller also posts notifications that no listener method covers, such as `kUnityDidRegisterForRemoteNotificationsWithDeviceToken`, which a plugin observes with `NSNotificationCenter`.
- A subclass. `IMPL_APP_CONTROLLER_SUBCLASS(ClassName)` makes a subclass of `UnityAppController` the application delegate.

A listener registers from a class's `+load` method, which the Objective-C runtime calls when `UnityFramework` loads, before `UIApplicationMain` starts, so it hears the launch as well. In a test project, a listener registered there received `didFinishLaunching:`. A plugin that keeps decoded images in memory can give them back when iOS warns that memory is short:

```objective-cpp
#import <Foundation/Foundation.h>
#include "PluginBase/AppDelegateListener.h"

// The plugin's decoded thumbnails, filled elsewhere in this file.
static NSMutableDictionary<NSString*, NSData*>* sThumbnails;

@interface ThumbnailCacheListener : NSObject<AppDelegateListener>
@end

@implementation ThumbnailCacheListener

+ (void)load
{
    // Runs when UnityFramework loads, before UIApplicationMain, so no launch event is missed.
    static ThumbnailCacheListener* instance;
    instance = [ThumbnailCacheListener new];
    UnityRegisterAppDelegateListener(instance);
}

// UIKit's memory warning, which reaches each registered listener.
- (void)applicationDidReceiveMemoryWarning:(NSNotification*)notification
{
    [sThumbnails removeAllObjects];
}

@end
```

A listener hears what the delegate is told, and no more, and two gaps showed in 6000.3.11f1. The controller's method that posts the push token notification compiles only when `UNITY_USES_REMOTE_NOTIFICATIONS` is set in the Trampoline's `Preprocessor.h`, which the export leaves at 0 until something sets it. And with the scene delegate that Unity 6.3 declares, iOS delivers a link that opens the running app to the scene delegate, not to the application delegate: in a Simulator test, a link reached a `scene:openURLContexts:` method added to `UnityScene` for the test, and without that method it reached neither `onOpenURL:` nor `Application.deepLinkActivated`. Chapter 4 follows links and push tokens along those paths.

The subclass is the option with one slot. `IMPL_APP_CONTROLLER_SUBCLASS` stores the subclass's name in a single global variable from the subclass's `+load`, and `main` creates the class that the variable names. When two plugins each ship a subclass, the one whose `+load` runs last wins, and the other's overrides do not run, with no error from anything. In a test with two subclasses, one became the delegate and the other's `application:didFinishLaunchingWithOptions:` was not called once. It is the iOS form of the two SDKs that each subclass Unity's activity in [[#android-activity-integration]], and listeners are the way around it.

Some SDKs use none of the three and change the delegate at run time instead. Objective-C lets code exchange the implementations of two methods, which is called method swizzling, so an SDK's version of a method such as `application:didRegisterForRemoteNotificationsWithDeviceToken:` runs in place of the delegate's and is expected to call the original. When two SDKs swizzle the same method, the one installed last runs first, and the chain holds only while each calls through. A small test of the Objective-C runtime, run on macOS, showed both halves: with one swizzle installed, the SDK's version ran and then the delegate's did; with a second installed after it that did not call through, neither the first SDK nor the delegate saw the call. The order depends on when each SDK starts, so when a push token or a link stops arriving after an unrelated SDK update, check the swizzlers first. An SDK that can turn its swizzling off, and take the calls from the game instead, hands that order back to the team.

Lab exercise: Write a post-processor that sets a usage description, appends a URL scheme to an array in the `Info.plist`, and adds a capability. Build once with Replace and twice with Append, and diff `Info.plist`, the entitlements file and `project.pbxproj` after each build. Fix whatever grows. Then add a second post-processor with a higher `callbackOrder` that writes the same usage description, and check which text ships.

?? ios-postprocess-idempotent After two Append builds, the game's `Info.plist` lists the same URL scheme twice. What is wrong with the post-processor?
* It appends to the array without checking whether the entry is already there
- It runs before Unity writes the `Info.plist`, so Unity keeps a copy of the entry
- It uses `SetString`, which adds a second key with the same name on each build
- It reads the `Info.plist` of the Unity project instead of the exported one
- Unity runs each post-processor twice when a build uses Append mode
> An Append build keeps the existing `Info.plist` and updates it, so the post-processor runs over its own earlier output. Setting a value is safe to repeat, and appending to a list is safe after a check that the entry is missing.

?+ Why does a change that the game needs in its Xcode project belong in a post-processor, and not in Xcode?
* A Replace build writes a new project, which has none of the hand edits
- Xcode marks a Unity project as damaged once it has been saved by hand
- Unity refuses to Append into a project that Xcode has saved since
- A hand edit changes the signing identity, which the store rejects
- A post-processor runs faster than Xcode, so CI builds finish sooner
> Replace removes the folder and generates the project again, so a hand edit lives in one copy of the project and nowhere in version control. A post-processor makes the change on each build, in both modes, on each machine.

?+ Two SDKs' post-processors both set `NSCameraUsageDescription`, each to its own text. Which text ships?
* The text of the one with the higher `callbackOrder`, which runs later
- The first text written, since `PlistDocument` keeps a key that already exists
- Both, joined into one string by the `Info.plist` writer
- Neither of them, since Xcode stops the build on a key set twice
- The text of the SDK that was imported into the project first
> Post-processors run from the lowest `callbackOrder` to the highest, and `SetString` replaces the value, so the last one to run wins, without a warning. The team's own post-processor, ordered last, is where such keys get their final value.

?? ios-app-controller-subclass Two SDKs each ship a subclass of `UnityAppController` with `IMPL_APP_CONTROLLER_SUBCLASS`. What happens?
* One subclass becomes the delegate, and the other's overrides do not run
- Unity chains the two subclasses in the order in which the SDKs were imported
- Xcode fails to link, with a duplicate symbol for the controller class
- Both run, since each one registers itself with UIKit as a delegate
- The app crashes at launch, with an error about two delegates
> The macro stores the class name in one global variable from the subclass's `+load`, and `main` creates the class that the variable names. The subclass whose name was overwritten is never created, and nothing reports it; listeners avoid the single slot.

?+ How can a plugin free memory on iOS's memory warnings without subclassing `UnityAppController`?
* A listener, registered with `UnityRegisterAppDelegateListener` from `+load`
- Add `applicationDidReceiveMemoryWarning:` to `UnityAppController` in a category
- Declare a second subclass with `IMPL_APP_CONTROLLER_SUBCLASS`, beside the first
- Name the plugin's class as the scene delegate in the `Info.plist`
- Implement the method on any class, since UIKit sends the warning to each object
> A listener receives UIKit's memory warning through a notification, alongside any other listener. A category method with the controller's own method name replaces Unity's version, a second subclass contends for the single slot, and a new scene delegate replaces `UnityScene` altogether.

?+ Why does `IMPL_APP_CONTROLLER_SUBCLASS` leave room for one subclass?
* It sets one global class name from `+load`, and the last to run wins
- The macro defines a symbol with a fixed name, which the linker accepts once
- Unity checks the subclass when it builds, and rejects a second one
- The Trampoline creates the controller before the plugins' classes load
- iOS reads the delegate's class name from the `Info.plist`, which holds one
> `main` hands `UIApplicationMain` the class name held in a variable that each subclass sets as it loads. The last assignment wins, and the class it replaced is never created. Listeners avoid the slot altogether.

?+ After an SDK update, push tokens stop reaching a second SDK that swizzles the same app delegate method. What is the likely cause?
* The updated SDK's replacement no longer calls the implementation it replaced
- The updated SDK subclassed `UnityAppController`, which stops swizzling
- iOS delivers the token to the first SDK that asked for it, and to no other
- Swizzled methods run on a background thread, where the other SDK misses them
- The update changed the token's format, which the second SDK now rejects
> Swizzles form a chain: the last one installed runs first and passes the call on by calling the implementation it replaced. One that stops calling through cuts off each swizzle installed before it, and the app delegate too.

## When the iOS side fails: crash reports, terminations, and symbols {#ios-failure-evidence}

A failure on the iOS side leaves its evidence in one of several places, and the kind of failure decides which. Some kinds leave nothing where a team looks first:

| What happened | What the player sees | Where the evidence is |
| --- | --- | --- |
| An Objective-C exception in native code that C# called | The game closes | `Terminating app due to uncaught exception`, with the name and the reason, in the device log, and a crash report whose `Last Exception Backtrace` shows where it was thrown |
| A bad memory access in native code | The game closes | A crash report with `EXC_BAD_ACCESS`, the faulting address and the crashed thread's backtrace |
| A C# exception escaping a native callback | The game closes | `uncaught exception of type Il2CppExceptionWrapper` in the device log, and the callback's frames on the crashed thread |
| A missing usage description | The game closes the first time it asks for the resource | A crash report whose termination names `TCC` and the missing key |
| A missing dynamic framework | The game closes at launch | `Library not loaded` in the device log, and in a Unity game no crash report |
| A watchdog termination | The game disappears during launch or a transition | A report on the device with the code `0x8badf00d`, which Xcode's Crashes organizer does not show |
| A memory termination | The game is gone, often when the player comes back to it | No crash report: a `JetsamEvent` report on the device, and MetricKit's counts |

On Android, a Java exception thrown while C# waits on the call becomes an `AndroidJavaException`, as [[#android-failure-evidence]] showed. iOS has no such conversion. An Objective-C exception thrown in native code that C# called passes up through IL2CPP's frames, whose `catch` blocks handle C# exceptions, and ends the process. In a test project, a C# `try` and `catch (Exception)` around the call did not run, and the app ended with this line:

```text
*** Terminating app due to uncaught exception 'NSInvalidArgumentException', reason: '*** -[__NSDictionaryM setObject:forKey:]: object cannot be nil (key: token)'
```

The Trampoline installs an uncaught exception handler that logs `Uncaught exception:` with the name, the reason and the stack before the process ends. [Apple's article on language exceptions](https://developer.apple.com/documentation/xcode/addressing-language-exception-crashes) explains what the crash report adds: a `Last Exception Backtrace`, placed before the first thread, with the frames that led to the throw. In the test, it named the plugin function, the P/Invoke wrapper and the C# methods above it.

The bridge is the place to stop such an exception, with `@try` and `@catch` in the native function, which then returns an error code to C#. Unity's export turns Objective-C exceptions off for the whole project (`GCC_ENABLE_OBJC_EXCEPTIONS` is `NO`), so `@try` fails to compile, with “cannot use '@try' with Objective-C exceptions disabled”, until the file gets `-fobjc-exceptions` through the Compile flags setting of its plugin importer, which Unity writes onto that one file in the project. With the flag, the test's bridge caught the exception and returned 0 to C#. Most Objective-C APIs report expected failures through `NSError` and return normally; an exception marks a programming error, such as the `nil` above, so the catch at the boundary keeps a bug from ending the game, and does not replace checking the errors that APIs return.

A bad memory access is a signal, as on Android: `EXC_BAD_ACCESS`, with `SIGSEGV` or `SIGBUS`, and an address. A write through a null pointer, in a plugin function that C# called, looks like this in a report, abridged:

```text
Exception Type:    EXC_BAD_ACCESS (SIGSEGV)
Exception Subtype: KERN_INVALID_ADDRESS at 0x0000000000000000

Thread 0 name:  Dispatch queue: com.apple.main-thread
Thread 0 Crashed:
0   UnityFramework   VendorScanner_Start (ScannerBridge.mm:42)
1   UnityFramework   ScannerNative_VendorScanner_Start_m0FBE… (Assembly-CSharp.cpp:1150)
2   UnityFramework   InviteScreen_OnScan_mBE7D… (Assembly-CSharp.cpp:2346)
3   UnityFramework   InviteScreen_Start_m20F9… (Assembly-CSharp.cpp:1521)
```

`KERN_INVALID_ADDRESS` at address zero is a null pointer. Reading the frames differs from Android in one way. There, the library of each frame told the layers apart: `libil2cpp.so` for the game's C#, `libunity.so` for the engine, a vendor's `.so` for its SDK. On iOS the plugin, the game's C# as IL2CPP compiled it, the IL2CPP runtime and, on a device, the engine are one binary, `UnityFramework`, so the function names do that job: a plugin's C functions by their own names, a C# method by the name that IL2CPP gives it, class then method then `_m` and a hash, and the IL2CPP runtime under `il2cpp::`. A vendor's dynamic framework is the one layer that keeps an image of its own. In a release build the optimizer also merges small methods into their callers, so a C# frame can be missing: the same crash in the test's release build went straight from the plugin function to `Start`, which [Unity's page on managed stack traces](https://docs.unity3d.com/6000.3/Documentation/Manual/iOSManagedStackTraces.html) warns about.

The watchdog is iOS's check that an app stays responsive. [Apple's article on watchdog terminations](https://developer.apple.com/documentation/xcode/addressing-watchdog-terminations) describes it: it ends an app that blocks its main thread for too long, with the code `0x8badf00d` in the termination reason, and `scene-create` in the description means that the app did not draw its first frame in time. In a Unity game, that first frame waits for the start of the engine and for the first scene, which both run on the main thread, as the first section of this chapter showed. Each `Awake` and `Start` in the first scene, and each SDK that initializes there, spends the launch's allowance. Synchronous work is the usual cause, and Apple lists synchronous networking first, including calls that hide it, such as an initializer that takes a URL. A main thread that waits for a callback which native code posts to the main queue waits forever, a deadlock that at launch the watchdog ends. [Unity's troubleshooting page](https://docs.unity3d.com/6000.3/Documentation/Manual/TroubleShootingIPhone.html) gives the remedy for a heavy start: a small first scene that loads the large one after its first frames.

The Simulator does not reproduce the watchdog. In a test on the iOS 27.0 Simulator, a launch that held the main thread for thirty seconds finished normally, and the log of SpringBoard, the process that runs the home screen and launches apps, showed an allowance of 598.63 seconds for the game's first scene; Apple's example of a device report shows 19.97 seconds. A launch problem that shows in the Simulator is real, and one that does not may still be there on a device.

Watchdog reports, like memory ones, do not reach Xcode's Crashes organizer: [Apple's article on acquiring crash reports](https://developer.apple.com/documentation/xcode/acquiring-crash-reports-and-diagnostic-logs) lists both among the kinds it leaves out. They stay on the device, under Analytics Data in the Settings app, from where a tester can send them, and a connected device hands them to Xcode. A memory termination, a jetsam event in Apple's terms, leaves the least. When memory runs short, iOS ends apps to reclaim it, and [Apple's article on jetsam event reports](https://developer.apple.com/documentation/xcode/identifying-high-memory-use-with-jetsam-event-reports) notes that the `JetsamEvent` report lists the memory use of the processes on the device and no backtrace of any thread; if the game was on screen, the player saw a crash. For numbers across players, MetricKit, Apple's framework for an app's own daily reports, counts the app's exits by cause, among them `cumulativeMemoryResourceLimitExitCount` and `cumulativeAppWatchdogExitCount`. It is the nearest that iOS comes to the exit records Android keeps, counted per day and not per session.

Two terminations come from the app's configuration. A protected resource, such as the camera, the microphone or the contacts, needs a usage description in the `Info.plist` before the app asks for it, and without one iOS ends the app at the request. In the test project, a contacts request without it ended the app with a report whose termination names `TCC`, the part of iOS that guards such resources, and carries the reason:

```text
This app has crashed because it attempted to access privacy-sensitive data without a usage description. The app's Info.plist must contain an NSContactsUsageDescription key with a string value explaining to the user how the app uses this data.
```

Chapter 4 covers permissions and their descriptions. A missing dynamic framework closes a Unity game at launch without a report, as the previous section showed.

Symbols turn the addresses in a report into names, and on iOS they come in a [[dSYM]], one for each binary. [Apple's article on debugging information](https://developer.apple.com/documentation/xcode/building-your-app-to-include-debugging-information) states the rule that decides which one fits: a binary and its dSYM share a build UUID, and they are compatible only when the UUIDs are identical, which even a rebuild of the same source with other settings breaks. A Unity release build produces a dSYM for the app and `UnityFramework.framework.dSYM`, which covers everything linked into `UnityFramework`. The Xcode archive keeps both, and uploading them with the build lets the Crashes organizer show [[TestFlight]] and App Store reports with names.

Check the match first, because a mismatch fails silently. In a test, `atos`, which names one address, took the dSYM from the same build and returned the plugin function and the C# method, with their files and lines; given the binary from another build of the same project, it returned other functions, plausible ones, and no warning. The commands, with the report's load address and frame address:

```bash
dwarfdump --uuid UnityFramework.framework.dSYM                     # compare with UnityFramework's UUID in the report
mdfind "com_apple_xcode_dsym_uuids == 00D417A8-2B15-3EBB-94AB-993E9BA136A7"   # find the dSYM with a given UUID
atos -arch arm64 -o UnityFramework.framework.dSYM/Contents/Resources/DWARF/UnityFramework -l 0x1032cc000 0x1032ce338
xcrun crashlog Game-2026-09-24-232507.ips                          # symbolicate a whole report
```

The export also carries `process_symbols.sh`, which runs Unity's `usymtool` to upload a dSYM's symbols to Unity's own crash-reporting service. The test exports did not run it, and Apple's tools do not need it.

Not every failure is a crash, and for the rest the device log is the evidence. [Apple's article on acquiring crash reports](https://developer.apple.com/documentation/xcode/acquiring-crash-reports-and-diagnostic-logs) has the Console app on a Mac read the log of a connected device, and Xcode 27's Device Hub lists the device's crash reports. On a device with no debugger attached, the Trampoline sends `Debug.Log` output to the system log, so the game's own lines appear in Console beside those of iOS and the SDKs.

Lab exercise: In a development build on a device, end the game three ways: raise an Objective-C exception in a native function that C# calls, write through a null pointer in another, and block the main thread for thirty seconds in the first scene's `Awake`. Collect each report from the device, symbolicate the bad access with that build's dSYM after checking its UUID, and compare what the same thirty-second block did in the Simulator.

?? ios-termination-kinds A game disappears for players on low-memory devices, often while it is in the background, and no crash reports arrive. What evidence does iOS keep?
* Jetsam reports on the devices, and MetricKit's memory exit counts
- Crash reports in Xcode's Crashes organizer, under a filter for memory
- The game's last log lines, which iOS saves into a crash report
- An uncaught exception that Unity's handler logged before the exit
- A watchdog report with the code `0x8badf00d` in its reason
> Ending an app for memory writes no crash report. The device keeps a `JetsamEvent` report, which lists memory use and no backtraces, and MetricKit's daily exit data counts the terminations for exceeding the memory limit.

?+ C# wraps a call into native code in `try` and `catch (Exception)`, and the native code raises `NSInvalidArgumentException`. What happens?
* The exception passes IL2CPP's frames uncaught, and the app ends
- C# catches it as a `SEHException` that carries the Objective-C reason
- IL2CPP converts it into a `NotSupportedException` at the wrapper
- The native function returns zero, and Unity logs the exception
- Unity's handler logs it, and the game carries on with the next frame
> IL2CPP's `catch` blocks handle C# exceptions, and an Objective-C exception is not one, so it goes past them and ends the process with `Terminating app due to uncaught exception`. A `@try` in the native function, in a file compiled with Objective-C exceptions on, is where it can be stopped.

?+ A crash report shows `EXC_BAD_ACCESS (SIGSEGV)` with `KERN_INVALID_ADDRESS at 0x0000000000000000`, and a plugin function on top. What does it point to?
* The plugin function read or wrote through a null pointer
- The plugin raised an Objective-C exception that nothing caught
- The watchdog ended the app while the plugin held the main thread
- iOS ended the app for memory while the plugin was allocating
- A deep recursion in C# overflowed the main thread's stack
> A bad access at address zero is a read or write through a null pointer, and the top frame is where it happened. An uncaught exception ends with `SIGABRT` and a `Last Exception Backtrace`, the watchdog with `0x8badf00d`, and a memory termination with no crash report at all.

?+ The game closes the first time a player opens the invite-code scanner, and the report's termination names `TCC`. What is missing?
* The camera's usage description in the `Info.plist`
- The camera entitlement on the `Unity-iPhone` target
- A link to `AVFoundation` in the `UnityFramework` target
- The player's permission, which iOS treats as a crash when denied
- A capture session configured before the permission request
> iOS ends an app that asks for a protected resource without the matching usage description, in a report whose termination names `TCC` and the missing key. A denied permission is an answer that the app handles, not a termination.

?? ios-watchdog-launch On slower devices, the game is killed at launch, with `0x8badf00d` and `scene-create` in the report. Which change addresses it?
* A small first scene that loads the heavy one after its first frames
- Moving the heavy work from `Awake` to `Start` in the same scene
- A longer allowance for launch, requested in the `Info.plist`
- Loading the heavy scene with `Resources.Load` instead of the build list
- A `try` and `catch` around the start-up code, so that none of it aborts
> `scene-create` means that the first frame was not drawn in time. Unity starts the engine and loads the first scene on the main thread before that frame, so the first scene's `Awake` and `Start` both count. A light first scene draws at once and loads the rest afterwards.

?+ A launch that holds the main thread for a long time finishes in the Simulator and is killed on a device. Why?
* The Simulator allows far more time for the first frame than a device does
- The Simulator runs the player loop on a background thread
- The watchdog counts CPU time, and the Mac provides more of it
- Development builds turn the watchdog off, and device builds are release builds
- The Simulator's watchdog applies to Apple's own apps alone
> In a test, SpringBoard in the iOS Simulator gave the game's first scene an allowance of about ten minutes, where Apple's example of a device report shows about twenty seconds. A launch problem that shows in the Simulator is real, and one that does not may still be there on a device.

?+ An SDK initializes in the first scene's `Awake` and makes a synchronous network request. Why is that a launch risk on iOS?
* It holds the main thread, which has to draw the first frame in time
- iOS rejects network requests made before the first frame is drawn
- `Awake` runs on a background thread, where requests are throttled
- The request's DNS lookup runs on the render thread and stalls it
- Unity delays the first scene until pending requests return
> The first scene loads on the main thread before the first frame, so a synchronous request there holds the frame back for as long as the network takes, which varies with each player's connection. Apple names synchronous networking first among the causes of watchdog terminations.

?+ Where does a team find the watchdog terminations of players' devices?
* On the devices, and as counts in MetricKit's daily exit data
- In Xcode's Crashes organizer, grouped under their own exception type
- In App Store Connect's list of crashes, once enough players report them
- In the game's own crash reporter, which catches the termination signal
- In the console log that iOS uploads with each crash report
> Apple lists watchdog events among the reports that the Crashes organizer does not show; they stay on the device, and MetricKit's daily exit data counts them. A crash reporter inside the app gets no chance to run, since the watchdog ends the process with `SIGKILL`.
