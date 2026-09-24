---
book: unity-mobile-platform-engineering
chapter: 02: Calling Android from C# and back
---

## What runs where in a Unity Android app {#android-runtime-model}

A Unity game on Android is one Linux process, started by Android for the game's package, with a Java side and a native side. The Java side holds an activity, the Android component that owns a window and receives the lifecycle callbacks, together with Unity's Java classes, which an exported project carries as `unity-classes.jar`. The native side holds the player's libraries: `libmain.so` starts the player, `libunity.so` is the engine, and `libil2cpp.so` is the game's C# after [[IL2CPP]] has compiled it to machine code. The app's manifest, the XML file in which an app declares its components to Android, names the activity that launches the game.

Which activity that is comes from Player Settings, under Application Entry Point. Unity 6.3 offers two there, and its manifest template holds an activity block for each; a build keeps the block the setting selects.

| Entry point | Activity class | It extends | The game loop runs on |
| --- | --- | --- | --- |
| Activity | `UnityPlayerActivity` | Android's `Activity` | A Java thread named `UnityMain`, with a `Looper` of its own |
| GameActivity, the default for new projects | `UnityPlayerGameActivity` | `GameActivity` from Android's Jetpack libraries, itself an `AppCompatActivity` | A native thread with no Java `Looper` |

GameActivity also brings `libgame.so`, glue between the Jetpack library and the engine, which [[Gradle]] compiles from sources in the exported project.

A `Looper` is the message loop Android gives a thread so that other code can post work to it. The UI thread has one, and under the Activity entry point so does `UnityMain`, because Unity's Java code prepares one when it starts that thread. Under GameActivity, [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/android-application-entries-game-activity-requirements.html) warns, Java code called from the game loop finds no Looper: `Looper.myLooper()` returns null there, and whatever relies on it fails, such as a `Handler` created without naming its thread or a listener registered with a null handler. The same plugin code works under Activity. That is how a plugin that worked for years breaks when a project moves to GameActivity, and why plugin code should name the thread it wants, as `new Handler(Looper.getMainLooper())` does. The entry point also decides which class a custom activity has to extend, which the section on activities comes back to.

Three kinds of thread meet at the boundary:

| Thread | What runs there |
| --- | --- |
| Android's UI thread | Lifecycle callbacks such as `onPause` and `onNewIntent`, input, and all work on views and dialogs |
| Unity's main thread | The player loop: `Update`, coroutines, most Unity APIs, and each call into Java made from them |
| Other threads | Callbacks that an SDK or a system service delivers on a thread of its own, and threads the game starts |

The names collide. [Android's documentation](https://developer.android.com/guide/components/processes-and-threads) calls the UI thread the main thread, and Unity calls the thread that runs its game loop the main thread. They are different threads, and this book says UI thread for Android's and main thread for Unity's.

A call from C# into Java runs on the thread that made it and returns when the Java method returns. A C# method called from `Update` that reaches a Java method which builds a dialog runs that Java code on Unity's main thread. Android gives its UI thread two rules: do not block it, and do not touch the UI toolkit from any other thread. The fix is to move the work, and the best place to move it is inside the bridge, which knows what its own methods touch:

```java
package com.example.game;

import android.app.Activity;
import android.app.AlertDialog;

public final class PromptBridge {
    private PromptBridge() {}

    // C# calls this on Unity's main thread; the dialog is built on the UI thread.
    public static void show(final Activity activity, final String title) {
        activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
                .setTitle(title)
                .setPositiveButton(android.R.string.ok, null)
                .show());
    }
}
```

`runOnUiThread` runs the action at once when it is called on the UI thread and otherwise posts it to the UI thread's queue, so the C# caller returns without waiting for the dialog. Where no bridge method exists to hold the rule, C# makes the same move with Unity 6's `AndroidApplication.InvokeOnUIThread(action)`, which posts a delegate through the same `runOnUiThread`. `AndroidApplication` also gives C# the current activity, the application context and Unity's Java player object. Older code reached the activity through the static `currentActivity` field of Unity's `UnityPlayer` class, which 6.3 still has.

Underneath, the bridge is [[JNI]]. Android runs one Java VM per process, and a thread can call into Java only after it has been attached to that VM, which gives it the per-thread environment that JNI calls go through. The UI thread and Unity's main thread are attached already; a thread the game creates is not. Java objects cross as references: a local reference is valid until the native call that received it returns, and a global reference is valid until something deletes it. Unity's C# classes hold global references, and when they let go of them is the subject of the next section.

Lab exercise: In a development build, log the name of the current thread from a C# method that calls into Java, from the Java method it calls, and from a Java callback that comes back through a proxy. Draw the three threads and the calls between them, then switch the application entry point and draw them again.

?? android-two-threads A C# method called from `Update` calls a Java bridge method that builds and shows an `AlertDialog`. Which thread runs the Java method, and where does Android want the dialog?
* Unity's main thread runs it, and the dialog belongs on Android's UI thread
- Android's UI thread runs it, since Unity routes each Java call through that thread
- A JNI worker thread runs it, and Android accepts dialogs from attached threads
- Unity's main thread runs it, and Android accepts that, as the thread is attached
- Unity's render thread runs it, since that is the thread that owns the window
> A call into Java runs synchronously on the thread that made it, here Unity's main thread. Android's UI toolkit is single-threaded and belongs to the UI thread, so the bridge posts the dialog there with `runOnUiThread`, or C# uses `AndroidApplication.InvokeOnUIThread`.

?+ Which thread runs an activity's lifecycle callbacks, such as `onPause` and `onNewIntent`?
* Android's UI thread, which Android's documentation calls the main thread
- Unity's main thread, which receives them from Android between two frames
- A binder thread from the system's pool, a different one for each callback
- The last thread that called into Java from C#, while it stays attached
- Unity's render thread, which pauses the surface before the game loop stops
> Android dispatches system callbacks, lifecycle ones included, on the process's UI thread. Unity's activity passes them on to the player, which is how the game hears about a pause later, on its own main thread.

?+ [tf] In a Unity Android game, `Update` runs on the thread that Android's documentation calls the main thread.
* false
> Android's documentation calls its UI thread the main thread: the thread of lifecycle callbacks, input and views. `Update` runs on Unity's main thread, a different thread that runs the player loop, and each name carries its own rules.

?? android-entry-point A plugin method creates `new Handler()` when C# calls it from `Update`. It works in an older project and fails in a new one because the calling thread has no Looper. What differs?
* The new project uses GameActivity, whose game loop runs on a native thread
- The new project targets a newer API level, which removed that Handler constructor
- The new project uses IL2CPP, which runs C# on threads that Android does not track
- The new project calls the plugin from a coroutine, which runs on a pooled thread
- The new project shrinks its Java with R8, which removed the plugin's Looper field
> Under the Activity entry point, Unity's game loop runs on a Java thread with a Looper of its own. Under GameActivity, the default for new projects, it runs on a native thread with none, so code that relies on the calling thread's Looper fails there. Naming the thread, as with `Looper.getMainLooper()`, works under both.

?+ A vendor's guide says to extend `UnityPlayerActivity`, and the project uses the GameActivity entry point. Which class does a custom activity have to extend?
* `UnityPlayerGameActivity`, the class the generated manifest launches
- `UnityPlayerActivity`, which both entry points share as their base class
- `GameActivity` itself, since Unity's activity classes are sealed to plugins
- `AppCompatActivity`, since Unity attaches its player to whichever activity starts
- `UnityPlayerForGameActivity`, the bridge class that the activity creates
> Each entry point has its own activity: `UnityPlayerActivity` extends Android's `Activity`, and `UnityPlayerGameActivity` extends Jetpack's `GameActivity`. Unity's manual says a custom activity extends the one that matches the entry point, and not the bridge classes behind them.

?+ [multi n=6] Which of these does the choice of application entry point decide?
* Which Unity activity class the generated manifest launches
* Whether the thread that runs the game loop has a Java Looper
- Which scripting backend compiles the game's C# for the player
- Which ABIs the build packages the native libraries for
- Whether C# can call Java methods through `AndroidJavaObject`
- Which thread Android uses for the activity's lifecycle callbacks
> The entry point selects `UnityPlayerActivity` or `UnityPlayerGameActivity`, and with it the thread that runs the game loop: a Java thread with a Looper, or a native one without. The scripting backend, the ABIs and the JNI bridge are separate matters, and lifecycle callbacks arrive on the UI thread under both.

## AndroidJavaObject, AndroidJavaClass, and the cost of JNI {#android-java-calls}

Unity's high-level API reaches Java from C# with two classes. An `AndroidJavaClass` stands for a Java class and reaches its static members with `CallStatic`, `GetStatic` and `SetStatic`. An `AndroidJavaObject` stands for an instance and reaches its members with `Call`, `Get` and `Set`; its constructor takes the class name and the Java constructor's arguments. A generic parameter gives the type of a result. Java objects come back as `AndroidJavaObject`, except strings, which arrive as C# strings, and arrays of supported types, which arrive as C# arrays. A nested class is named with `$`, as in `android.os.Build$VERSION`.

```csharp
public static class DeviceFacts
{
    public static int SdkLevel()
    {
        using var version = new AndroidJavaClass("android.os.Build$VERSION");
        return version.GetStatic<int>("SDK_INT");
    }

    public static string LanguageTag()
    {
        using var localeClass = new AndroidJavaClass("java.util.Locale");
        using var locale = localeClass.CallStatic<AndroidJavaObject>("getDefault");
        return locale.Call<string>("toLanguageTag");
    }

    public static string CacheDirectory()
    {
        using var dir = AndroidApplication.currentActivity.Call<AndroidJavaObject>("getCacheDir");
        return dir.Call<string>("getAbsolutePath");
    }
}
```

Nothing in those calls is checked when C# compiles, because the method names are strings. Unity builds a [[JNI]] signature from the C# arguments and the generic result type: `Call("startPurchase", productId)`, with one string and no result, becomes `(Ljava/lang/String;)V`, which is JNI's way of writing “takes a `String`, returns nothing”. When the call runs, a helper class in Unity's Java library searches the class by reflection for a method with that name and a compatible signature, and caches what it finds. A Java method that was renamed, or whose parameters changed, still compiles in C# and still builds. The call fails on the device:

```text
AndroidJavaException: java.lang.NoSuchMethodError: no non-static method with name='startPurchase' signature='(Ljava/lang/String;)V' in class Lcom.example.game.StoreBridge;
```

Unity clears the pending Java error and throws it in C# as an `AndroidJavaException`, whose message is the Java error's and whose stack trace starts with the Java one. The same kind of failure appears in a release build when [[R8]] renames or removes Java code that only C# reaches by name, which chapter 5 prevents with keep rules. The adapter catches `AndroidJavaException` at its boundary like any other failure, as [[#platform-results-threads]] set out; a lookup failure is a defect to report, not an outcome to show the player.

Each `AndroidJavaObject` holds two JNI global references, one to the Java object and one to its class, and every call that returns a Java object makes a new wrapper. `Dispose` releases the references, and a `using` declaration disposes at the end of its scope, as Unity's manual recommends. A wrapper that is never disposed releases them when the garbage collector finalizes it, which happens when the C# heap needs collecting; the collector does not count JNI references. The references sit in a table with a fixed limit, 51,200 entries in the Android runtime's source as read in September 2026, and when it fills, the runtime aborts the process. Calling `getSystemService` from `Update` makes a new wrapper, and two global references, on every frame. Keep one wrapper instead, dispose it with its owner, and ask at the rate the answer changes, which for a decision about the game's music is twice a second:

```csharp
AndroidJavaObject audioManager;
float nextCheck;
bool musicPlaying;

void Start() => audioManager =
    AndroidApplication.currentActivity.Call<AndroidJavaObject>("getSystemService", "audio");

void Update()
{
    if (Time.unscaledTime < nextCheck) return;
    nextCheck = Time.unscaledTime + 0.5f;
    musicPlaying = audioManager.Call<bool>("isMusicActive");
}

void OnDestroy() => audioManager?.Dispose();
```

Each call also costs time, and [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/android-call-java-kotlin-code-best-practices.html) asks for few of them. Read from Unity 6.3's code, one high-level call by name does more work than it shows. C# builds the signature string and boxes value arguments into the parameter array. The method name and the signature become Java strings, and Unity's Java helper is asked for the method, which crosses into Java even when its cache already has the answer. Each string argument becomes a new Java string, the method runs, and Unity checks for a pending Java exception. Three habits keep the count down:

- Call at the rate the answer changes, not once a frame.
- Batch: send many values in one call, as one JSON string or one array.
- On a path that has to stay hot, look the method up once and call through its ID, which skips the lookup by name. The arguments are still converted on each call.

```csharp
public sealed class AndroidEventSink : IDisposable
{
    readonly AndroidJavaObject bridge = new AndroidJavaObject("com.example.game.EventBridge");
    readonly IntPtr logBatch;
    readonly List<string> pending = new List<string>();

    // Looked up once by name and signature; the calls below skip the lookup.
    public AndroidEventSink() =>
        logBatch = AndroidJNIHelper.GetMethodID(bridge.GetRawClass(), "logBatch", "(Ljava/lang/String;)V");

    public void Track(string eventJson) => pending.Add(eventJson); // Stays in C#.

    public void Flush()
    {
        if (pending.Count == 0) return;
        bridge.Call(logBatch, "[" + string.Join(",", pending) + "]"); // One call into Java.
        pending.Clear();
    }

    public void Dispose() => bridge.Dispose();
}
```

Threads the game starts itself, with `new Thread` or through the task pool, are not attached to the Java VM, and Unity's reference says such a thread must be attached before it uses these classes. `AndroidJNI.InvokeAttached(action)` attaches the calling thread if it needs to, runs the delegate, and detaches the thread again, which Android requires of an attached thread before it exits.

Exercise: Count the calls into Java that one feature makes in a frame. `AndroidJNIHelper.debug`, switched on in a development build, logs the calls that go through Unity's helpers. Then propose the change that removes most of them: a kept wrapper, a batch, a lower rate or a cached method ID.

?? android-jni-runtime-lookup A Java bridge method is renamed, and the C# call site still uses the old name. When does the mistake show up?
* When the call runs on a device, as an `AndroidJavaException` for `NoSuchMethodError`
- When C# compiles, since Unity checks method names against the plugin's classes
- When Gradle builds the export, since it verifies the calls that go through JNI
- At start-up, when Unity loads the plugin and resolves the methods C# names
- When R8 runs on the release build, since it reports methods that nothing calls
> The method name is a string and the signature is built from the call's arguments, so nothing checks them until the call runs. Then Unity's Java helper finds no match, and the Java `NoSuchMethodError` reaches C# as an `AndroidJavaException` that names the missing method.

?+ C# calls `bridge.Call("startPurchase", productId)`. How does Unity find the Java method it calls?
* By name, with a signature built from the C# arguments, looked up at the call
- Through a binding that Gradle generates when it compiles the plugin's sources
- By the method's position in its class, recorded when the plugin is imported
- Through metadata that IL2CPP records for each Java method named in C# code
- Through the Java class's interface, which Unity checks when the scene loads
> Nothing ties the C# call to a Java method before it runs. Unity writes a JNI signature from the argument types, `(Ljava/lang/String;)V` for one string and no result, and its Java helper searches the class for that name and a compatible signature when the call is made.

?+ Why does a call made by method name cost more than the same call through a method ID looked up once?
* Each call by name crosses into Java to find the method before calling it
- Each call by name runs a reflection search over the Java class's methods
- Unity recompiles the signature string into bytecode for each call by name
- Calls by name are dispatched through the UI thread, which waits for a frame
- A method ID skips argument conversion, so strings reach Java without copies
> Unity's Java helper caches the methods it has found, so the reflection search happens once, but a call by name still crosses into Java to consult that cache before crossing again to make the call. A method ID from `AndroidJNIHelper.GetMethodID` skips the lookup; the arguments are converted either way.

?? android-jni-references `Update` calls `activity.Call<AndroidJavaObject>("getSystemService", "audio")` each frame and never disposes the result. What accumulates?
* JNI global references, held by wrappers the garbage collector has not finalized
- Audio service objects, since each call asks Android for a new service instance
- Local references on the main thread, which Android frees at the next frame
- Pending callbacks from the audio service, queued on Android's UI thread
- Nothing, since Unity reuses one wrapper for each Java object it has seen
> Each call that returns a Java object creates a new `AndroidJavaObject`, which holds global references until it is disposed or finalized. The garbage collector runs when the C# heap needs it and does not count JNI references, so undisposed wrappers can pile up faster than they are released.

?+ Why does Unity's manual recommend a `using` statement around an `AndroidJavaObject`?
* It releases the wrapper's JNI references at a known point, not at collection
- It detaches the calling thread from the Java VM when the block ends
- It lets Java's garbage collector reclaim the object while C# still holds it
- It caches the object's method IDs for as long as the block is running
- It pins the Java object in memory so that native code can read it safely
> Disposing a wrapper releases its global references deterministically. Without it, the release waits for the C# garbage collector to finalize the wrapper, at a time the code does not control.

?+ After long sessions a game dies with an error saying that the JNI global reference table overflowed. Which change addresses it?
* Dispose each `AndroidJavaObject` a call returns, or keep one and reuse it
- Wrap the calls in `AndroidJNI.PushLocalFrame`, so that the pop frees them
- Raise the Java heap size in the Gradle properties, so the table grows
- Move the Java calls to a worker thread, which has a table of its own
- Catch the error in C# and retry the call once the table has room again
> The table holds global references, and each undisposed wrapper keeps two of them until it is finalized. Disposing wrappers, and not making a new one for the same object each frame, keeps the count flat. Local frames free local references, the table belongs to the whole process, and the runtime aborts when it overflows.

## Callbacks into C#: AndroidJavaProxy and UnitySendMessage {#android-callbacks}

Java reaches C# in two ways: through a proxy that implements a Java interface in C#, or through a message sent to a GameObject by name. They differ in nearly everything the adapter's contract has to state.

A class derived from `AndroidJavaProxy` names a Java interface in its constructor. When C# passes an instance to Java, Unity creates a Java object that implements the interface, and each call Java makes on it runs the C# method of the same name, with Java objects arriving as `AndroidJavaObject`, strings as strings and primitives as primitives. It works for interfaces alone, because the Java side is built on Java's own proxy mechanism, so an API that expects an abstract class needs a few lines of Java that forward to an interface. Android's network callback is such a class:

```java
package com.example.game;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;

public final class ConnectivityBridge {
    public interface Listener {
        void onAvailable();
        void onLost();
    }

    private final ConnectivityManager manager;
    private final ConnectivityManager.NetworkCallback callback;

    public ConnectivityBridge(Context context, final Listener listener) {
        manager = context.getSystemService(ConnectivityManager.class);
        // NetworkCallback is a class, and a C# proxy can only implement an interface.
        callback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network network) { listener.onAvailable(); }
            @Override public void onLost(Network network) { listener.onLost(); }
        };
        manager.registerDefaultNetworkCallback(callback);
    }

    public void close() {
        manager.unregisterNetworkCallback(callback);
    }
}
```

[Android's reference](https://developer.android.com/reference/android/net/ConnectivityManager) says a callback registered this way is invoked on the “default internal Handler”, which Android's source runs on a thread of its own named `ConnectivityThread`: neither the UI thread nor Unity's main thread. [Unity's reference for `AndroidJavaProxy`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AndroidJavaProxy.html) says the same in general terms: the C# method runs on the Java thread that called the interface method. So the proxy's first job is to get the event to the main thread without doing anything else where it is:

```csharp
public sealed class ConnectivityMonitor : MonoBehaviour
{
    public event Action<bool> OnlineChanged;

    readonly ConcurrentQueue<bool> changes = new ConcurrentQueue<bool>();
    AndroidJavaObject bridge;

    sealed class Listener : AndroidJavaProxy
    {
        readonly ConcurrentQueue<bool> changes;

        public Listener(ConcurrentQueue<bool> changes)
            : base("com.example.game.ConnectivityBridge$Listener") => this.changes = changes;

        // Android calls these on its connectivity thread, not on Unity's main thread.
        void onAvailable() => changes.Enqueue(true);
        void onLost() => changes.Enqueue(false);
    }

    void OnEnable() => bridge = new AndroidJavaObject(
        "com.example.game.ConnectivityBridge", AndroidApplication.currentContext, new Listener(changes));

    void Update()
    {
        while (changes.TryDequeue(out bool online)) OnlineChanged?.Invoke(online);
    }

    void OnDisable()
    {
        bridge.Call("close"); // Java drops its reference to the proxy.
        bridge.Dispose();
    }
}
```

The queue returns at once, and the Java thread goes back to its own work; a completion source does the same for a one-off result, as the adapter in [[#platform-results-threads]] did. Unity also offers `AndroidApplication.InvokeOnUnityMainThread`, which [its reference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Android.AndroidApplication.InvokeOnUnityMainThread.html) describes as blocking the calling thread until the main thread has run the delegate. In 6.3 it queues the delegate on Unity's synchronization context and waits with no time limit.

That wait is safe only while the main thread is free to reach the queue. Suppose an SDK calls its listener on the UI thread and the proxy blocks there, while the main thread is inside a plugin method that runs something on the UI thread and waits for the answer:

```text
Unity's main thread                      Android's UI thread
calls plugin.readSafeInsets()
  Java posts work to the UI thread
  and waits for its answer               runs the SDK's callback
                                           the proxy calls InvokeOnUnityMainThread
                                           and waits for the main thread
  still waiting                          still waiting
```

Neither thread can move. The game stops drawing and the UI thread stops answering input, and once a touch has gone unanswered for five seconds, Android reports an [[ANR]]. Without the plugin's wait there is no deadlock, but the blocking hand-off still holds the UI thread until the main thread's next frame, each time the callback fires. Unity's Java code for the Activity entry point shows the safer habit: when the activity pauses, the UI thread waits for the main thread to take the pause, and in 6.3 it gives up after two seconds and logs a timeout.

A proxy also has a lifetime on each side. Unity ties the C# object to its Java stand-in with a GC handle, a reference the C# garbage collector respects, and frees the handle after Java's own garbage collector has finalized the stand-in. While any Java object refers to the proxy, then, the C# object stays alive, and so does everything it refers to, a destroyed `MonoBehaviour` included. The usual such reference is a registration: the network callback above keeps the proxy reachable until `unregisterNetworkCallback`, which Android's reference asks apps to call, and `close` calls it from `OnDisable`. An exception that escapes a proxy method is caught by Unity, logged, and answered with `null`, as chapter 1 found.

`UnityPlayer.UnitySendMessage(objectName, methodName, message)` is the other way in. It names a GameObject, a method and one string:

```java
// In the push SDK's token listener, on whichever thread the SDK uses.
UnityPlayer.UnitySendMessage("PlatformEvents", "OnPushToken", token);
```

```csharp
public sealed class PlatformEvents : MonoBehaviour
{
    public static event Action<string> PushTokenChanged;

    void Awake()
    {
        gameObject.name = "PlatformEvents"; // Java finds the object by this name.
        DontDestroyOnLoad(gameObject);
    }

    // Unity calls it on the main thread, a frame after Java sent the message.
    void OnPushToken(string token) => PushTokenChanged?.Invoke(token);
}
```

[Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/android-plugins-csharp-code-from-java-kotlin.html) lists the limits: the receiving method takes one string and returns nothing, the call is asynchronous with a delay of one frame, and two GameObjects with the same name conflict. The code behind it adds two more. The Java call queues the message and returns, so Java never learns whether it arrived: when the main thread works through the queue and finds no object by that name, or no method, Unity writes a line such as `SendMessage: object PlatformEvents not found!` to the log and moves on. And a message sent before Unity's native libraries have loaded is dropped with a warning.

| | `AndroidJavaProxy` | `UnitySendMessage` |
| --- | --- | --- |
| Receiver | A C# object that Java holds a reference to | A GameObject found by name |
| Arguments and result | Typed arguments and a return value | One string, and no result |
| Thread | The Java thread that made the call | Unity's main thread, a frame later |
| When the receiver is gone | The proxy lives on while Java holds it, and is called even after its owner is destroyed | A line in the log, and the caller never knows |

Use the proxy for typed callbacks, for results, and for anything whose thread the contract has to name. `UnitySendMessage` suits a notice the game can afford to miss or can ask for again, such as a token the SDK will also hand over on request, and some vendor plugins already use it. Either way the boundary from chapter 1 wraps it, so gameplay sees an event on the main thread and never a GameObject's name.

Lab exercise: Implement one Java callback both ways, as a proxy and as `UnitySendMessage`. For each version, write down what it needs before it ships: the thread it runs on, what happens when it arrives before its receiver exists, and what happens when it arrives twice.

?? android-blocking-dispatch A proxy method runs on the UI thread and calls `AndroidApplication.InvokeOnUnityMainThread`, while the main thread is inside a plugin call that waits for the UI thread. What happens?
* Each thread waits for the other, and the game freezes with input unanswered
- Unity runs the delegate on the UI thread, since the main thread is busy
- The delegate runs once the plugin call returns, a frame later than usual
- Unity detects the cycle and throws an exception on the UI thread
- The plugin call times out after two seconds, and the delegate runs next
> `InvokeOnUnityMainThread` blocks the calling thread until the main thread has run the delegate, with no time limit. A main thread that is itself waiting for the UI thread never gets there, so both stop, and the UI thread's unanswered input becomes an ANR.

?+ Which hand-off lets a proxy callback give a result to the main thread without holding the Java thread?
* A concurrent queue that a main-thread `Update` drains each frame
- `AndroidApplication.InvokeOnUnityMainThread`, since it targets the main thread
- Calling the game's event directly, since proxy methods run on the main thread
- `Thread.Sleep` in the proxy until a main-thread flag says the result was read
- `AndroidJNI.AttachCurrentThread`, which turns the Java thread into a Unity one
> A queue, a posted continuation or a completion source hands the result over and returns at once, so the Java thread goes back to its own work. `InvokeOnUnityMainThread` holds the Java thread until the main thread has run the delegate.

?+ An SDK calls its listener on the UI thread, and the proxy blocks there until the main thread has handled each event. What does that cost when no deadlock occurs?
* The UI thread stalls until the main thread's next frame, for each callback
- Each event is handled twice, once on each of the two threads
- The main thread skips a frame so that it can run the delegate early
- The SDK unregisters the listener after the first callback that runs late
- Nothing, since the delegate runs in the same frame on both threads
> The main thread runs queued delegates once per frame, so a blocking hand-off holds the UI thread for up to a frame each time the callback fires, and input and view work wait with it. A queue returns at once.

?? android-sendmessage-limits Java calls `UnityPlayer.UnitySendMessage("PlatformEvents", "OnPushToken", token)` while no GameObject has that name. What happens?
* Unity logs that the object was not found, and the Java call returns as usual
- The Java call throws, and the SDK retries the message on its next callback
- Unity keeps the message until a GameObject with that name is created
- Unity delivers it to the first object that has an `OnPushToken` method
- The message runs on the Java thread with no receiver and returns null
> The call queues the message and returns. When the main thread processes the queue a frame later, it looks the object up by name, and a missing object produces a line in the log and nothing more; the Java side never learns of it.

?+ Which C# method can `UnitySendMessage` call?
* A method with one string parameter, on a component of the named GameObject
- A static method on any class, found by the name passed in the call
- A method with one `AndroidJavaObject` parameter carrying the Java values
- Any public method whose parameters Unity can convert from Java values
- A method on an `AndroidJavaProxy`, found through the Java interface's name
> `UnitySendMessage` names a GameObject and a method and passes one string, so the receiver is a `void Method(string)` on one of that object's components. Anything richer is serialized into the string, often as JSON.

?+ A push SDK hands the game its token through `UnitySendMessage`. What does the receiving side need that a proxy callback would not?
* A GameObject with a fixed name, alive whenever a message can arrive
- A lock around the handler, since messages arrive on the SDK's thread
- A Java interface for the method, so that Unity can find it at run time
- A `using` block, so the string's JNI reference is freed after the call
- A check that the message came on the UI thread before it touches views
> Delivery is by name, so the receiving GameObject has to carry exactly that name and exist when the message is processed, which usually means one persistent object created before the SDK starts. Messages arrive on the main thread, so the handler needs no lock.

?+ [tf] `UnitySendMessage` runs the C# method on the Java thread that called it.
* false
> The Java call queues the message and returns. Unity's main thread delivers it a frame later, which is why the receiver may use Unity APIs and why Java never learns whether it arrived.

## Plugin forms: sources, AARs, library folders, and native libraries {#android-plugin-forms}

Java and native code reach an Android build in five forms, and each lands in a different place in the [[Gradle]] project that Unity generates. The locations below come from exporting a Unity 6.3 project that holds one of each:

| Form | In `Assets` | In the exported project | What it carries |
| --- | --- | --- | --- |
| Java source | `.java` files | `unityLibrary/src/main/java/` | Code, compiled by Gradle with the game |
| JAR | a `.jar` file | `unityLibrary/libs/`, picked up by a file dependency | Compiled classes |
| AAR | an `.aar` file | `unityLibrary/libs/`, as `implementation(name: 'probe-sdk', ext:'aar')` | Classes, a manifest, resources, assets, native libraries and keep rules |
| Android Library | a folder named `*.androidlib` | A Gradle module of its own, `:unityLibrary:ProbeLib.androidlib` | What an AAR carries, as sources |
| Native library | a `.so` file per ABI | `unityLibrary/src/main/jniLibs/<abi>/` | Machine code for one [[ABI]] |

Unity compiles Kotlin source files the same way as Java ones. [Its manual](https://docs.unity3d.com/6000.3/Documentation/Manual/android-library-project-and-aar-plugins-introducing.html) recommends an Android Library while a plugin is being written, since it builds from source with the game, and an AAR, the library's compiled form, to distribute it. Native code can also come as a static library or as C and C++ sources, which an [[IL2CPP]] build links or compiles into the game.

An AAR is a ZIP file whose one required entry is `AndroidManifest.xml`. [Android's documentation](https://developer.android.com/studio/projects/android-library) lists what else it may hold, and the small test SDK in that export, `probe-sdk.aar`, holds the entries that matter most:

```text
AndroidManifest.xml
classes.jar
proguard.txt
jni/arm64-v8a/libprobesdk.so
```

`classes.jar` is what a JAR would have carried. The rest changes the app, not only its code. When Gradle builds, the library's manifest is merged into the app's, so the permissions, activities, services, receivers and providers it declares ship with the game, whether anyone read them or not; this one adds `ACCESS_NETWORK_STATE`. Its `proguard.txt` joins [[R8]]'s configuration for the whole app. Its native libraries are packaged for each ABI it covers, and for no other. Adding an AAR is therefore a change to the app's permissions, its shrinking rules and its ABI coverage, and it deserves the review such a change gets. Chapter 5 reads the merged manifest that results.

Player Settings chooses the ABIs the game ships, under Target Architectures, and Unity writes them into the Gradle project as its `abiFilters`. The plugin importer gives each native library its platform and its CPU. A device installs the native libraries of one ABI, the best fit it has, and leaves the other folders out. In the same export, with ARMv7 and ARM64 selected and a test library imported for ARM64 alone, the gap is visible before anything runs:

```text
unityLibrary/src/main/jniLibs/armeabi-v7a/libmain.so
unityLibrary/src/main/jniLibs/armeabi-v7a/libunity.so
unityLibrary/src/main/jniLibs/arm64-v8a/libmain.so
unityLibrary/src/main/jniLibs/arm64-v8a/libunity.so
unityLibrary/src/main/jniLibs/arm64-v8a/libprobenative.so
```

Nothing fails at build time. The game starts on a 32-bit ARM device and fails there at the first call that needs the library. IL2CPP resolves a `[DllImport]` the first time it is called and throws `DllNotFoundException` when it cannot load the library, and Java's `System.loadLibrary` throws `UnsatisfiedLinkError` in the same situation. A team whose test devices all share one ABI never sees it.

Native libraries have one more property to check. [Android 15 added support for devices that use 16 KB memory pages](https://developer.android.com/guide/practices/page-sizes), and a library whose segments are aligned for 4 KB pages fails on them. Unity 6.3 checks each native plugin when it builds and warns about any that is not aligned for 16 KB, and a library built with NDK r27 or older needs the linker option `-Wl,-z,max-page-size=16384`. The test library drew that warning until it was rebuilt with the option. In September 2026, Google Play required 16 KB support from apps targeting Android 15 or later, and said it would refuse their updates without it from February 1, 2027.

The last decision is where third-party AARs come from. A library published to a Maven repository is named by its [[Maven coordinates]], and the repository keeps a POM file beside it that lists the libraries it depends on. Declared as a dependency, the library arrives with what it depends on, and when two SDKs ask for different versions of the same library, [Gradle](https://docs.gradle.org/current/userguide/graph_resolution.html) picks one, by default the highest. A copy of the AAR dropped into `Assets` enters the build through a plain folder with no POM. Gradle does not know what it depends on, and a second copy of the same library, vendored by another SDK, enters the build beside it. Declare the dependency instead, in Unity's main Gradle template or through the dependency manager an SDK comes with; chapter 5 shows what duplicate copies do to a build.

Exercise: Unzip one AAR from a project you know and list its entries. Beside each, write what it adds to the build: code, manifest entries, resources, native libraries and for which ABIs, or keep rules. Then compare its ABIs with the project's Target Architectures.

?? android-aar-contents After an SDK's AAR was added, the game's store listing shows a permission that nobody on the team declared. Where did it come from?
* The AAR's manifest, which Gradle merges into the game's manifest
- The SDK's classes, which request it through reflection as they load
- Unity's Player Settings, which add a permission for each new plugin
- Google Play, which adds permissions for the SDKs it finds in an upload
- The AAR's keep rules, which R8 turns into manifest entries as it runs
> A library's manifest is merged into the app's when Gradle builds, so the permissions and components it declares ship with the game. A JAR has no manifest and could not have added one. Chapter 5 covers reading the merged manifest and removing what the game does not want.

?+ [multi n=6] Which of these can an AAR bring into a build that a JAR does not?
* Permissions and components, through its manifest
* Native libraries for the ABIs it covers
* Keep rules that R8 applies when it shrinks the app
* Android resources, such as layouts and strings
- Compiled Java classes for the app to call
- C# scripts that Unity compiles with the game
> A JAR holds compiled classes. An AAR holds those too, and adds a manifest that is merged into the game's, resources, native libraries per ABI, and a `proguard.txt` whose rules join R8's configuration for the whole app. Neither carries C# for Unity to compile.

?+ A team copies an SDK's AAR into `Assets` instead of declaring its Maven dependency. What does Gradle lose?
* The list of libraries it depends on, which comes with a POM file
- The library's native libraries, since Gradle skips jni folders in local AARs
- The library's permissions, since local AARs are left out of the merge
- The library's resources, which Gradle does not package from local AARs
- Nothing, since an AAR lists its dependencies inside its own manifest
> A library from a Maven repository arrives with a POM that names its dependencies and version, which Gradle uses to fetch them and to settle conflicts. A copied file has none of that, so its dependencies are added by hand, and a second copy of the same library can enter the build unnoticed.

?? android-missing-abi A native plugin ships for `armeabi-v7a` alone, and the game builds for ARMv7 and ARM64. Where does it fail?
* On 64-bit devices, the first time the game loads the plugin's library
- At build time, when Gradle finds that the ABI folders do not match
- On all devices, since Android rejects apps with uneven ABI folders
- On 32-bit devices, which install the 64-bit libraries when both exist
- On no device, since Android runs the 32-bit library in translation
> A device installs the libraries of one ABI, and a 64-bit device runs the game's arm64 libraries, where the plugin has no copy. The build succeeds, 32-bit devices work, and the failure waits for the first use on a 64-bit device: `DllNotFoundException` from C#, or `UnsatisfiedLinkError` from Java.

?+ A C# `[DllImport("vendorcore")]` call works on the team's phones and throws `DllNotFoundException` on some players' devices. What should be checked first?
* Whether the build has the plugin's `.so` for those devices' ABI
- Whether managed code stripping removed the `DllImport` declaration
- Whether R8 removed the native library from the release build
- Whether those players denied a permission that native code needs
- Whether those devices run an older IL2CPP than the build expects
> IL2CPP loads a native library the first time a declaration from it is called, and throws `DllNotFoundException` when no library by that name exists for the process's ABI. A plugin built for fewer ABIs than the game fits both halves of the report, so its packaging is the first thing to rule out.

?+ Why can a plugin with a missing ABI pass all its tests on the team's devices?
* The team's devices share an ABI, and a device loads one ABI's libraries
- Development builds package all ABIs, and release builds package fewer
- The Editor loads the plugin for the host's ABI, which the tests run on
- Android falls back to a device's second ABI when the first one is missing
- Missing ABIs surface as a store warning before any device installs them
> A device installs the native libraries of the ABI that fits it, so a gap in another ABI does not show there. Testing on devices of each shipped ABI, or checking each plugin's ABIs against Target Architectures, finds it before players do.

## Activities, intents, and results without subclassing Unity's activity {#android-activity-integration}

An intent is Android's message asking a component to do something: open a link, pick a photo, show a store page. Three things arrive only at an activity: the result of another activity it started, a new intent while it runs, and the answer to a permission request. Some SDKs written for Unity asked the game to subclass `UnityPlayerActivity`, override `onActivityResult`, `onNewIntent` or `onRequestPermissionsResult`, and forward the call to them.

That works for one SDK. One activity launches the game and a Java class has one parent, so when a second SDK asks for the same thing, someone writes a single subclass that forwards to both, and each upgrade of either SDK reopens it. The subclass also has to match the entry point: [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/android-custom-activity.html) says a custom activity extends `UnityPlayerGameActivity` under GameActivity and `UnityPlayerActivity` under Activity, so an SDK's subclass written for one entry point is the wrong class for the other.

Most of what those subclasses did has a home that needs no subclass:

- **New intents and permission answers.** Both of Unity's activities override `onNewIntent` and `onRequestPermissionsResult` and pass them to the player. The game receives [[deep link|links]] as `Application.deepLinkActivated` and permission answers through Unity's own permission requests, which chapter 4 covers.
- **Lifecycle.** `Application.registerActivityLifecycleCallbacks` reports the creation, start, resume, pause, stop and destruction of each activity in the process to the callbacks registered with it, so an SDK can follow the game's activity without being part of it. It reports nothing else, neither results nor intents.
- **Results.** A result goes to the activity that asked for it. An SDK can ask from a short-lived activity of its own, receive the result there, report it, and finish.
- **Components.** An SDK can declare its own activities, services, receivers and providers in its AAR's manifest, which the merge adds to the game's.

Newer Android libraries deliver results through the AndroidX Activity Result API, which registers on a `ComponentActivity`. `UnityPlayerGameActivity` is one, through `GameActivity` and `AppCompatActivity`. `UnityPlayerActivity` extends Android's plain `Activity` and is not, so an SDK that registers on the host activity needs the GameActivity entry point.

The helper activity is the general answer, and one detail decides whether it is correct:

```java
package com.example.game;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

// Transparent and short-lived: it exists to receive one result.
public final class PickImageActivity extends Activity {
    private static final int REQUEST_PICK = 1;
    private boolean delivered;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (state == null) {
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*");
            startActivityForResult(pick, REQUEST_PICK);
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        deliver(uri == null ? null : uri.toString());
        finish();
    }

    // Destroyed with no result, for example when a link brings the game's activity back.
    @Override protected void onDestroy() {
        if (!isChangingConfigurations()) deliver(null);
        super.onDestroy();
    }

    private void deliver(String uriOrNull) {
        if (delivered) return;
        delivered = true;
        PickImageBridge.deliver(uriOrNull);
    }
}
```

`PickImageBridge.deliver` passes the result to a listener that a C# proxy implements, and the C# side completes a task with it. The helper is declared in the plugin's own manifest, so that the merge adds it:

```xml
<activity
    android:name="com.example.game.PickImageActivity"
    android:theme="@android:style/Theme.Translucent.NoTitleBar"
    android:exported="false" />
```

The `onDestroy` path is there because of Unity's launch mode. The generated manifest declares Unity's activity with `android:launchMode="singleTask"`, and for such an activity, [Android's documentation](https://developer.android.com/guide/components/activities/tasks-and-back-stack) says, a new intent goes to the existing instance through `onNewIntent` instead of creating another, and the activities above it in its task are destroyed. A link tapped while the picker is open closes the helper before any result arrives. Without `onDestroy` reporting the missing result, the C# task awaiting the pick would wait forever, the callback that never arrives from chapter 1.

The same launch mode decides how a link reaches a game that is already running. It arrives in `onNewIntent` on the running activity; Unity's activity stores it with `setIntent`, passes it to the player, and the game sees `Application.deepLinkActivated` with `Application.absoluteURL` updated. A plugin that reads the link from the activity's intent in its own start-up code sees the link that launched the game and none of those that come later. The C# side of this, a link inbox that reads the launch link and subscribes for the rest, is in [[#platform-events]].

The generated manifest also lists fifteen configuration changes in `android:configChanges`, among them orientation, screen size, keyboard, locale and density:

```xml
<!-- From the generated unityLibrary manifest; other attributes, the intent filter and meta-data omitted. -->
<activity android:name="com.unity3d.player.UnityPlayerGameActivity"
          android:launchMode="singleTask"
          android:configChanges="mcc|mnc|locale|touchscreen|keyboard|keyboardHidden|navigation|orientation|screenLayout|uiMode|screenSize|smallestScreenSize|fontScale|layoutDirection|density"
          android:exported="true">
</activity>
```

By default Android destroys and recreates an activity when its configuration changes. For the listed changes it keeps the activity running and calls `onConfigurationChanged` instead, which Unity's activity passes to the player and Unity 6.3 exposes to C# as `AndroidApplication.onConfigurationChanged`. A plugin that expects recreation, and reloads a layout or reads the locale again in `onCreate`, does not see the change.

Exercise: Find every plugin in a project you know that extends Unity's activity, edits it in an exported project, or asks the game to forward an activity callback. For each, decide which of the alternatives above could replace it, and what it needs from the entry point.

?? android-activity-subclass Two SDKs each ship a subclass of `UnityPlayerActivity` and ask to be the game's launcher activity. What does the team have to do?
* Merge both into one subclass of its own, or replace one SDK's hook
- Declare both as launchers, and Android sends each its own callbacks
- Nothing, as Unity chains the subclasses in the order the plugins load
- Keep the newer SDK's subclass, since the older one's hooks go unused
- List both in Player Settings, which merges their overrides at build time
> One activity class launches the game, and a Java class has one parent, so the two subclasses end up as one hand-written class that the team maintains through each upgrade of either SDK. That cost is why SDKs moved to hooks that need no subclass.

?+ An SDK needs the result of an activity it starts. Which approach works without touching Unity's activity?
* A transparent activity of the SDK's own that starts it and gets the result
- Overriding `onActivityResult` in a C# `AndroidJavaProxy` for the activity
- Registering `ActivityLifecycleCallbacks`, which also report activity results
- Reading the result from `Application.absoluteURL` once the activity closes
- Calling `startActivityForResult` from the main thread, which returns it
> A result goes to the activity that asked for it. A short-lived activity of the SDK's own can ask, receive the result in its own `onActivityResult`, report it and finish, whichever activity launched the game. Lifecycle callbacks report lifecycle events and nothing else.

?+ An SDK needs to know when the game's activity pauses and resumes. What can it use in place of a subclass?
* `Application.ActivityLifecycleCallbacks`, registered with the application
- A transparent helper activity that stays open behind the game's window
- A broadcast receiver for the pause intent that Android sends to each app
- `onNewIntent`, which Android calls on the activity as it is paused
- A background thread polling `Activity.isFinishing` a few times a second
> The application object reports the lifecycle of each activity in the process to the callbacks registered with it, so an SDK can follow pause and resume without being part of the activity.

?? android-new-intent A player taps a link to the game while it is running. How does the link reach Unity's activity?
* Through `onNewIntent` on the running activity, which is declared `singleTask`
- Through `onCreate` on a new instance, which Android starts for each link
- Through `onResume`, which carries the link in the resumed activity's extras
- Through a broadcast that Unity's activity registers for incoming links
- Through `onActivityResult`, since the browser started the game for a result
> The generated manifest declares Unity's activity with `launchMode="singleTask"`, so Android routes the new intent to the existing instance. Unity's activity stores it with `setIntent` and passes it to the player, and the game sees `Application.deepLinkActivated` with `Application.absoluteURL` updated.

?+ A plugin reads the link from the activity's intent in its own start-up code. Which links does it miss?
* Links that arrive while the game runs, which come through `onNewIntent`
- The link that launched the game, which Unity consumes before plugins start
- Custom-scheme links, which Android delivers to verified apps alone
- Links from notifications, which bypass the activity's intent filters
- None, since Android restarts the activity for each link it delivers
> Start-up code sees the intent that created the activity. Later links reach the same instance through `onNewIntent`, so the plugin has to listen for them, or the game passes them on from `Application.deepLinkActivated`.

?+ Rotating the device does not recreate Unity's activity, and a plugin that reloaded its state in `onCreate` stops noticing rotations. Why?
* Unity's manifest lists the change in `configChanges`, so the activity stays
- Unity locks the activity's orientation and rotates the game's surface itself
- Android recreates the activity, but Unity skips the plugin's `onCreate`
- GameActivity handles rotation in native code, where Java sees none of it
- Rotation fires `onNewIntent`, which the plugin does not implement
> For configuration changes listed in `android:configChanges`, Android keeps the activity running and calls `onConfigurationChanged` instead of recreating it, and Unity's manifest lists orientation, screen size, locale and more. As with a link routed to the running instance, the change reaches the existing activity through a callback, which is where a plugin has to look.

## When the Android side fails: exceptions, native crashes, and ANRs {#android-failure-evidence}

A failure on the Android side leaves its evidence in one of five places, and the kind of failure decides which. The table runs from the easiest to see to the hardest:

| What happened | What the player sees | Where the evidence is |
| --- | --- | --- |
| A Java exception during a C# call | Nothing, when the adapter catches it | An `AndroidJavaException` in C#, with the Java message and stack trace |
| An uncaught Java exception on a Java thread | The game closes | `FATAL EXCEPTION`, the thread's name and the stack trace, under the `AndroidRuntime` tag in [[logcat]]'s crash buffer |
| A native crash | The game closes | A block under the `DEBUG` tag with the signal, the fault address and a backtrace, and a tombstone file |
| An [[ANR]] | A dialog offering to close the game, when it is in the foreground | Every thread's stack at that moment, in ANR traces on the device, a bug report, and Google Play's Android vitals |
| A low-memory kill | The game is gone when the player comes back | No report at all; the next launch can ask Android why the process ended |

An exception thrown in Java while C# waits on the call ends nothing: Unity turns it into an `AndroidJavaException`, as the section on calls showed. An exception thrown on a thread of Java's own, such as a worker an SDK started or the UI thread running a posted action, has nothing to catch it. Java's default handler reports it and [Android ends the process](https://developer.android.com/topic/performance/issues/crash). Unity 6.3's Java library installs no handler of its own for these, so logcat shows the crash in Android's usual form, here with an SDK's worker thread:

```text
--------- beginning of crash
AndroidRuntime: FATAL EXCEPTION: AnalyticsWorker
Process: com.example.game, PID: 12873
java.lang.IllegalStateException: Queue closed
    at com.example.analytics.Uploader.run(Uploader.java:88)
```

A native crash is a signal: `SIGSEGV` for a bad memory access, `SIGABRT` for code that aborted on purpose. Unity's crash handler sees it first and passes it on to Android's, as [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/android-handle-crashes.html) describes. Android then writes a report to logcat under the `DEBUG` tag, and a tombstone file with more: [Android's documentation](https://source.android.com/docs/core/tests/debug/native-crash) lists every thread's stack and the process's memory map among its extras. The logcat report looks like this, abridged:

```text
*** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***
signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x0
backtrace:
  #00 pc 0000000001a2b3c4  /data/app/.../lib/arm64/libil2cpp.so (BuildId: 9c41…)
  #01 pc 0000000001a2a0f0  /data/app/.../lib/arm64/libil2cpp.so (BuildId: 9c41…)
  #02 pc 00000000009e4410  /data/app/.../lib/arm64/libunity.so (BuildId: 83c8…)
```

Read the backtrace by library. Frames in `libil2cpp.so` are the game's C# as [[IL2CPP]] compiled it, together with the IL2CPP runtime. Frames in `libunity.so` are the engine, and frames in a vendor's library are its SDK. `SEGV_MAPERR` at address zero is a null pointer, which Android's documentation calls the classic native crash.

An ANR is Android declaring the UI thread unresponsive: most often an input event left unanswered for five seconds, in [Android's documentation](https://developer.android.com/topic/performance/issues/anr) as read in September 2026, or a broadcast receiver or service that did not finish in time. The evidence is every thread's stack at that moment, kept on the device under `/data/anr/`, included in a bug report and gathered by Google Play's Android vitals. In a Unity game, read the UI thread's stack first and the main thread's next, because a UI thread waiting on the game loop is a cause that a Unity game adds.

A stuck main thread with a free UI thread freezes the picture without being an ANR by Android's definition. It becomes one when something on the UI thread waits for the main thread, as the blocking hand-off in the section on callbacks did, and pausing is such a moment built into the engine. Under the Activity entry point, the pause handler in Unity 6.3's Java code waits two seconds for the main thread and then logs a timeout and carries on. Under GameActivity, the pause goes through the native glue that the Jetpack library ships as source, and its pause handler waits for the game loop to take the pause with no time limit. A game loop that is stuck when the player leaves the game leaves the UI thread stuck behind it, which is the state an ANR reports.

A low-memory kill leaves the least. Android ends the process with `SIGKILL`, which no handler can catch, so neither Unity nor a crash reporter writes a word. Android 11 (API level 30) added a record of recent process exits with their reasons, which the next launch can read, and Unity 6.3 wraps it:

```csharp
public static class LastExit
{
    public static void Report()
    {
        var exits = ApplicationExitInfoProvider.GetHistoricalProcessExitInfo(Application.identifier, 0, 1);
        if (exits == null || exits.Length == 0) return;
        IApplicationExitInfo last = exits[0];
        Debug.Log($"Previous exit: {last.reason}, status {last.status}, at {last.timestamp}: {last.description}");
    }
}
```

The arguments are the package, 0 for any of its processes, and at most one record; the newest comes first. `ExitReason.LowMemory` names a kill for memory, though [Android's reference](https://developer.android.com/reference/android/app/ApplicationExitInfo) warns that a device that cannot report one gives `Signaled`, with `SIGKILL` as the status, instead. The same record tells Java crashes, native crashes and ANRs apart, which makes it a cheap first report to send with the next session.

Logcat keeps several buffers. The `crash` buffer holds crash reports, and a filter of tags keeps the rest of the log quiet:

```bash
adb logcat -d -b crash                                   # crash reports, then exit
adb logcat Unity:V AndroidRuntime:E DEBUG:V '*:S'        # Unity's lines and both crash tags
```

The backtrace gives offsets, and function names come from symbols: the symbols of the build that crashed, and no other. The linker stamps each library with a GNU build ID, a hash of its contents, and the report prints it on each frame. The NDK's tools do the translation, and all three below ship in the Editor's NDK r27c:

```bash
ndk-stack -sym symbols/arm64-v8a -i crash.txt                     # each frame it has symbols for
llvm-readelf -n symbols/arm64-v8a/libil2cpp.so                     # the build ID to compare
llvm-addr2line -C -f -e symbols/arm64-v8a/libil2cpp.so 0x1a2b3c4   # one address
```

`ndk-stack` compares each frame's build ID with the symbol file's and refuses a mismatch with a warning, which is the right answer: symbols from another build point at the wrong functions. Nothing promises that a rebuild of the same commit produces the same binary, and development and release builds certainly differ: in the 6000.3.11f1 Editor, even the engine's `libunity.so` has one build ID for development and another for release. So each build's symbols are kept with it. Unity writes them as a zip file beside the build, named with the version and version code, when Debug Symbols is set to Public or Debugging with zip output, and an exported project gets `libil2cpp`'s symbols from Gradle under `unityLibrary/symbols/<abi>/`. [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/android-symbols.html) adds that Google Play symbolicates a crash only once the matching symbols are uploaded, and never one that arrived before them. Chapter 5 produces the files, and chapter 11 archives them for each build.

Lab exercise: In a development build, end the game three ways and keep the logcat evidence of each: throw an exception on a Java thread the game starts, call `Utils.ForceCrash(ForcedCrashCategory.AccessViolation)` from C#, and block the UI thread with `AndroidApplication.InvokeOnUIThread(() => Thread.Sleep(10000))`, then tap the screen. Symbolicate the native crash's frames with that build's symbols, and read the exit reason each failure leaves at the next launch.

?? android-crash-kinds Logcat's crash buffer shows `FATAL EXCEPTION: AnalyticsWorker` under the `AndroidRuntime` tag, then a Java stack trace. What kind of failure is it?
* An uncaught Java exception on a thread the analytics SDK started
- A native crash in the SDK's library, reported by Android's crash dumper
- A C# exception in the analytics adapter, rethrown by Unity in Java
- An ANR, reported for the thread that held the UI thread's lock
- An `AndroidJavaException` that C# did not catch around an SDK call
> `FATAL EXCEPTION` under `AndroidRuntime` is Java's default handler reporting an exception that no code caught, and the name after it is the thread's. A Java exception thrown during a C# call would have reached C# as an `AndroidJavaException` instead of ending the process.

?+ A native crash's top frames are in `libil2cpp.so`. Which code do they point at?
* The game's C# as IL2CPP compiled it, or the IL2CPP runtime beneath it
- Unity's engine, since `libil2cpp.so` is the engine's scripting library
- The Java bridge, since IL2CPP compiles the Java plugins with the C#
- The graphics driver, which IL2CPP calls for each frame it submits
- Android's C library, where the signal handler runs for the crash
> `libil2cpp.so` holds the game's C# converted to C++ and compiled, together with the IL2CPP runtime. Frames in `libunity.so` point at the engine, and frames in a vendor's own library at its SDK.

?+ A session ended with no crash report and no ANR while the game was in the background. What can tell the team why at the next launch?
* The exit records Android keeps, read through `ApplicationExitInfo`
- The tombstone that Android writes for each process it ends
- The `AndroidRuntime` log lines, which record each process the system stops
- Unity's crash handler, which reports kills at the next start-up
- The last `OnApplicationPause` call, which Unity saves with its reason
> A process ended for memory gets `SIGKILL`, which no handler can catch, so nothing writes a report. Android keeps recent exits with their reasons, which the next launch can read, and Unity 6.3 wraps that API as `ApplicationExitInfoProvider`.

?+ The game stops drawing, and after the player taps the screen, Android offers to close the app. Which thread does that dialog say was blocked?
* Android's UI thread, which left the player's input unanswered
- Unity's render thread, which stopped presenting new frames
- Unity's main thread, which Android watches for frame deadlines
- The finalizer thread, which held the JNI global references
- A binder thread, which the system uses to deliver the tap
> The dialog is an ANR, which Android raises when the UI thread leaves input unanswered too long. A stopped main thread explains the frozen picture, and the ANR adds that the UI thread was blocked too, which makes a UI thread waiting on the main thread the first thing to look for.

?? android-symbols-match Which symbol file can turn a native crash's `libil2cpp.so` frames into function names?
* The one produced by the build that the device was running
- One from any build with the same version name, since the code matches
- The newest build's, since its symbol file includes the older addresses
- The development build's, which carries the full debug information
- Unity's own symbol file for the Editor version that made the build
> Offsets mean something in the one binary that produced them. The linker stamps each library with a build ID, crash reports print it on each frame, and tools such as `ndk-stack` refuse a symbol file whose ID differs, so symbols are kept for each build.

?+ `ndk-stack` prints `WARNING: Mismatched build id` for `libil2cpp.so` and leaves its frames as offsets. What is the likely cause?
* The symbol folder holds `libil2cpp.so` from another build than the crash
- R8 renamed the native functions when it shrank the release build
- The crash happened in C#, which `ndk-stack` does not symbolicate
- The symbol file was stripped, so it has lost its build ID note
- The device's Android version prints build IDs in another format
> `ndk-stack` compares the build ID printed on each frame with the one in the symbol file and refuses a mismatch. The symbols came from another build, so the frames stay as offsets until the matching files are found.

?+ [tf] Symbols from a development build can symbolicate a release build's native crash, as long as both came from the same commit.
* false
> Development and release builds are different binaries with different build IDs; in the 6000.3.11f1 Editor even the engine's `libunity.so` differs between the two. Symbols have to come from the build that crashed.
