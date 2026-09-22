# Review request: name the Unity API where the book describes it

- **Kind:** coverage
- **Priority:** medium
- **Where:** three places in chapter 12
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
| 12:16 | “Check whether material access creates new material instances” | Reading `Renderer.material` “automatically instantiates the materials”, and destroying them is “your responsibility”; `Renderer.sharedMaterial` does not copy. Per-instance values through a `MaterialPropertyBlock` avoid the copy, but take the renderer out of the SRP Batcher, which is how Unity's manual tells you to make one incompatible on purpose. |
| 12:98 | frame pacing and a chosen target | `Application.targetFrameRate` and `QualitySettings.vSyncCount`. At the default of -1, with `vSyncCount` at 0, Android and iOS render “at a fixed 30 fps to conserve battery power”, and a nonzero `vSyncCount` makes Unity ignore `targetFrameRate`. |
| 12:146 | “A focus or pause callback …” | `OnApplicationPause(bool)` and `OnApplicationFocus(bool)`. `OnApplicationQuit` is the unreliable one: iOS apps “suspend rather than quit, so `OnApplicationQuit` won't be called”, and Unity advises treating every loss of focus as the exit. |

## How to close it

Add the names as clauses, or as a column in the chapter 06 table, keeping the book's order
of explaining the behavior first and naming it second. None of these touches a question
block, and none needs a glossary entry.
