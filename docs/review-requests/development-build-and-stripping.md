# Review request: what a development build rules out

- **Kind:** accuracy
- **Priority:** high
- **Where:** `content/unity-engineering/08-testing-and-debugging.md:176` and `:178`, section `debugging-unity-scenarios`
- **Touches:** prose only

## What the book says

The table of questions that split a symptom fastest:

> | It works in the Editor only | Does a development build also fail? |

and the paragraph after it:

> If a development build fails too, stripping and optimization are ruled out and the
> difference is elsewhere, such as in the content or the filesystem.

## Why it is wrong

A development build keeps both of the things the sentence rules out. Unity's manual puts
Managed Stripping Level under **Edit > Project Settings > Player > Other Settings >
Optimization**, with no exception for development builds, and the scripting backend does
not change either: an IL2CPP development build is still compiled ahead of time and still
stripped. The IL2CPP C++ compiler configuration is a third, separate setting. So a
development build that fails says almost nothing about stripping, and a reader who follows
the table crosses the likeliest cause off first. Line 162 of the same section names that
cause: “Managed stripping can remove code that is accessed dynamically.”

What a development build changes is diagnostics: the `DEVELOPMENT_BUILD` symbol, the
profiler connection, script debugging and the on-screen error console. That makes it the
right build for the next step, not a test of stripping.

## Proposed fix

The lowest stripping level is not the same on every backend. Unity's manual lists
Disabled, Minimal, Low, Medium and High; Disabled exists only for Mono, and Minimal is the
IL2CPP default, where “Unity searches only the `UnityEngine` and the .NET class libraries
for unused code. Unity doesn't remove any user-written code.” So on IL2CPP the test
separates the game's own code from everything else, rather than ruling stripping out
altogether.

Change the row to:

> | It works in the Editor only | Does it still fail with managed stripping at Minimal? |

and the paragraph to:

> If it still fails at Minimal, which removes none of the game's own code, the game's
> types were not stripped, and the difference is elsewhere: stripping inside the engine
> or the .NET libraries, ahead-of-time compilation, the content, or the filesystem. Where
> the platform allows the Mono backend, a Mono build with stripping disabled removes the
> first two at once, so if that build works, the cause is one of them. A development build
> answers none of these questions, because it keeps the stripping level and the scripting
> backend of the release build; use it for the logs and the profiler once you know where
> to look.

## Also check

- [scripting-backend.md](scripting-backend.md): chapter 08 is where the reader first acts
  on the backend. If that request moves the IL2CPP paragraph into chapter 08, write this
  fix after it, so the table can refer to it.
- Chapter 12 line 182 (“Development builds help with diagnostics, but their overhead can
  differ from release builds”) is correct and agrees with the fix.
