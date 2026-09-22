# Review request: precision notes

- **Kind:** accuracy
- **Priority:** low
- **Touches:** prose only

Each item is right in spirit and imprecise in a way a careful interviewer could press on.
None is urgent; they are listed together so one editing pass can take them.

1. `04-csharp-fundamentals.md:200`: “with deep profiling on the suspect call”. Deep
   profiling instruments every method or none. For one call, the tools are a
   `ProfilerMarker` around it, or allocation call stacks for `GC.Alloc`, and neither needs
   deep profiling; a player build must also be built with Deep Profiling Support before it
   can be deep profiled at all.
2. `04-csharp-fundamentals.md:216`, the exercise: the estimate needs the size of a boxed
   `int`, which the book never gives, so the reader cannot check an answer. About 24 bytes
   on a 64-bit runtime (a 16-byte object header, 4 bytes of value and padding) makes it
   checkable: roughly 720 KB a second.
3. `04-csharp-fundamentals.md:274`: “creates a new delegate over a new closure”. Two
   lambdas in the same scope share one closure object; the removal fails because each
   lambda compiles to its own method, and delegate equality compares the method as well as
   the target. The conclusion is right, and a scratch program confirms the handler stays
   subscribed.
4. `05-principles-and-patterns.md:243`: “helping only the incremental case where your
   edits stay inside one of them”. An edit recompiles the edited assembly and every
   assembly that references it, so the gain is largest in assemblies few others depend on.
   An edit to `Game.Domain` in the graph at line 225 rebuilds everything above it.
5. `07-async-and-assets.md:36`: “The continuation resumes on a thread-pool thread.” It
   can; an operation that completes synchronously continues on the calling thread. “can
   resume” is exact.
6. `09-data-structures.md:245`: the flat board “keeps each row contiguous”, but so does an
   array of row arrays. The difference is one allocation with the rows back to back, and
   no second indirection per row. A 9 by 9 board is also small enough that its layout will
   not show in a profiler, which sits oddly beside line 24 (“A quadratic algorithm over
   eight items is fine forever”); on a board, the flat array's better argument is simpler
   indexing and bounds checks.
7. `11-profiling-and-optimization.md:22-32`: the budget table is a main-thread budget. The
   render thread, the job workers and the GPU each have their own 16.67 ms, as line 14
   says; one sentence stops a reader adding rendering submission and GPU work into one
   column.
8. `12-mobile-production.md:22`: on a tile-based GPU, blending reads tile memory, which is
   on chip and cheap. The cost of transparency is the second half of the sentence: every
   layer is shaded, because hidden-surface removal cannot discard it.
9. `13-liveops-and-releases.md:27`: “one calendar date spans 26 hours across the world”.
   The local midnights that end a date are spread over 26 hours, from UTC+14 to UTC−12;
   the date itself exists somewhere for 50. The sentence's consequence is right.
10. `13-liveops-and-releases.md:38`: some zones change their clocks at midnight, so on a
    transition day local midnight itself is skipped or repeated. That is the case that
    breaks the section's own example, “ends at local midnight”, and it deserves a clause
    beside 02:30.
11. `06-unity-lifecycle.md:260`: “Both appear in the same profiler entries” is unclear;
    cut it, or say which entries.
12. `06-unity-lifecycle.md:290`: “Fast Enter Play Mode” is an informal name that the
    Editor never shows. The installed 6000.3 Editor labels the setting Enter Play Mode
    Settings, with a “When entering Play Mode” choice such as Reload Domain and Scene.
13. `02-power-up-design.md:215`: `clamp(min, max, value)` puts the arguments in a
    different order from `Mathf.Clamp(value, min, max)`, which is the one a Unity reader
    will read it against.
14. `14-collaboration.md:213`: “has a common name, situation, task, action, result” never
    says the name. It is STAR, and interviewers use the word.
