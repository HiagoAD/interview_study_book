# The crash narration expects a main-thread exception that release players do not raise

**Kind:** Accuracy. **Priority:** Medium. **Touches:** prose only (chapter 16); no question block.

## Location

- `content/mobile-platform/16-interview-practice.md:123`: the scope of the narration is fixed as “Say it is a release build”.
- `content/mobile-platform/16-interview-practice.md:125`: “Then Unity's log just before it, where an `AndroidJavaException` naming a class or method that was not found, or an exception about the main thread, marks the call that failed first.”
- `content/mobile-platform/16-interview-practice.md:412`: “The callback crashed because it touched a `GameObject` from a Java thread; the log said so”, in a practice project whose parts include a release build (line 405).
- Related, outside this group: `content/mobile-platform/08-backend-clients.md:149` reports a `UnityException` for `UnityWebRequest` created off the main thread “in a test with Unity 6.3” without saying whether the test ran in the Editor, a development player or a release player.

## Evidence

Unity's per-API thread check (the message “`%s` can only be called from the main thread.”, which becomes the `UnityException` chapter 8 quotes) is native code in the player library. Searching the installed 6000.3.11f1 player libraries for that format string:

```text
AndroidPlayer/Variations/il2cpp/Development/Libs/arm64-v8a/libunity.so      1 match: "%s can only be called from the main thread."
AndroidPlayer/Variations/il2cpp/Release/Libs/arm64-v8a/libunity.so          0 matches
AndroidPlayer/Variations/il2cpp/Release_ThinLTO/Libs/arm64-v8a/libunity.so  0 matches
iOSSupport/Trampoline/Libraries/libiPhone-lib-dev.a                          1 match
iOSSupport/Trampoline/Libraries/libiPhone-lib.a                              0 matches
```

(`strings <lib> | grep -c 'can only be called from the main thread'`.) The release libraries keep other thread messages, such as “This operation must be performed on the main thread”, so the absence is specific to the per-API check: it is compiled into development players and the Editor, and left out of release players. The managed assemblies keep only a few managed checks (`Awaitable`, `EnsureRunningOnMainThread`), not the per-API one.

So in the release build that line 123 stipulates, a callback that touches a Unity object from a Java thread gets no “exception about the main thread” in Unity's log; it runs unchecked, and fails however the engine's unsynchronized state fails, often as a native crash. That is exactly what chapter 15's second case models (`15-debugging-across-boundaries.md:528-533`: the new client applies the result on `t9` and crashes with `SIGSEGV`), so chapters 15 and 16 currently disagree about what the reader will see. The line-412 story is right for a development build, where the log does say so.

No device run was made. A release and a development build of the probe project, each touching a `Transform` from an `AndroidJavaProxy` callback, would confirm what logcat shows in each.

## Proposed fix

Line 125, replace the last sentence of the cell with:

“Then Unity's log just before it, where an `AndroidJavaException` naming a class or method that was not found marks the call that failed first. A Unity API called from the wrong thread is reported as an exception only in a development build; a release build runs it unchecked, so I would repeat the step in a development build if the crash is a native signal inside the engine.”

Line 412, make the story's build explicit: “The callback crashed because it touched a `GameObject` from a Java thread; the development build's log said so, and I moved the work to the main thread through a queue”.

If chapter 8's test at line 149 ran in the Editor or a development player, add that to its sentence (“In a test with Unity 6.3 in the Editor, …”).

## Repeated in

No glossary entry or question block states it. `16-interview-practice.md:433` (“A callback crash off the main thread, with its log line”) stays true for a development build and needs no change.
