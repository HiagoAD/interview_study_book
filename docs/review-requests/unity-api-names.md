# Review request: name the Unity API where the book describes it

- **Kind:** coverage
- **Priority:** medium
- **Where:** ten places in chapters 06, 07, 08, 09, 10 and 12
- **Touches:** prose only, a clause or a table column at a time

## The pattern

The book teaches Unity through behavior, and rarely names the API that has it. That is a
deliberate strength for judgment questions, and part of why its principles transfer. It
costs the reader in the other kind of question, the one asked by name: “what is the
difference between `Time.deltaTime` and `Time.unscaledDeltaTime`?”, or “why does reading
`renderer.material` leak?”. In each place below the book already explains the behavior
correctly; the request is only to attach the name an interviewer will use, so the reader
can connect the two.

Every engine member named below exists in the installed 6000.3 Editor, and all but the two
`Awaitable` members also exist in the installed 2022.3 Editor; `Awaitable` arrived in
2023.1, and chapter 07 already treats it as part of the 6.0 baseline. On 2026-09-22 each
behavior in the table was also checked against Unity's 6.0 scripting reference and manual,
and the quoted phrases are Unity's.

| Where | The book says | Name to add |
| --- | --- | --- |
| 06:98-105 | four time domains, in a table | Scaled: `Time.time`, `Time.deltaTime`. Unscaled: `Time.unscaledTime`, `Time.unscaledDeltaTime`. Monotonic: `Time.realtimeSinceStartupAsDouble` or a `Stopwatch`. UTC: `DateTime.UtcNow`, with a server's time as the trusted source. A column in the existing table. |
| 07:41 | “return to the main thread before you do” | `await Awaitable.MainThreadAsync()`, and `Awaitable.BackgroundThreadAsync()` for the move off it: with the first, “continuation happens on the main thread”, and with the second, “on a background thread”. The chapter introduces `Awaitable` and never shows one of its members. |
| 07:101-123 | a cancellation source owned by the binding | `MonoBehaviour.destroyCancellationToken` and `Application.exitCancellationToken`, the lifetimes Unity already provides. Linking the binding's source to one of them is the “more than one reason” case line 123 describes. |
| 08:158 | “Check colliders, Rigidbody configuration …” | Trigger messages need a `Rigidbody` on at least one of the two objects, and collision messages need a non-kinematic one: “Collision events are only sent if one of the colliders also has a non-kinematic rigidbody attached.” It is the most common answer to this question in an interview. |
| 08:162 | “Preserve the required types or members” | `link.xml`, placed under `Assets` (a package cannot contain one), or the `[Preserve]` attribute from `UnityEngine.Scripting`. |
| 09:182 | “check that it exists in the Unity project's compatibility profile” | `PriorityQueue<TElement, TPriority>` arrived in .NET 6 and is absent from Unity's class libraries (checked in the 6000.3 install's Mono libraries and its .NET Standard 2.1 reference), so a Unity project writes or imports its own heap. The hedge becomes an answer. Chapter 04 line 328 points here. |
| 10:150 and 10:184 | separate random streams, and seeded replay | `UnityEngine.Random` is one static generator shared by every caller, packages included, which is exactly the problem line 150 describes. An instance of `System.Random`, or `Unity.Mathematics.Random` in jobs and Burst, gives each system its own stream. |
| 12:16 | “Check whether material access creates new material instances” | Reading `Renderer.material` “automatically instantiates the materials”, and destroying them is “your responsibility”; `Renderer.sharedMaterial` does not copy. Per-instance values through a `MaterialPropertyBlock` avoid the copy, but take the renderer out of the SRP Batcher, which is how Unity's manual tells you to make one incompatible on purpose. |
| 12:98 | frame pacing and a chosen target | `Application.targetFrameRate` and `QualitySettings.vSyncCount`. At the default of -1, with `vSyncCount` at 0, Android and iOS render “at a fixed 30 fps to conserve battery power”, and a nonzero `vSyncCount` makes Unity ignore `targetFrameRate`. |
| 12:146 | “A focus or pause callback …” | `OnApplicationPause(bool)` and `OnApplicationFocus(bool)`. `OnApplicationQuit` is the unreliable one: iOS apps “suspend rather than quit, so `OnApplicationQuit` won't be called”, and Unity advises treating every loss of focus as the exit. |

## How to close it

Add the names as clauses, or as a column in the chapter 06 table, keeping the book's order
of explaining the behavior first and naming it second. None of these touches a question
block, and none needs a glossary entry.
