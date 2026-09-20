---
book: Unity Game Engineering
chapter: 12: Mobile graphics, memory, and platform constraints
---

## Optimize rendering according to CPU and GPU evidence {#mobile-rendering}

Rendering performance has several dimensions: CPU submission, vertex processing, pixel shading, bandwidth, memory, and synchronization. Draw-call count alone does not describe the whole problem.

For CPU submission cost, investigate material and state changes, batching compatibility, culling, and unnecessary renderers. The SRP Batcher reduces CPU work associated with compatible shader and material setup; it is not a promise that all objects become one draw. GPU instancing can draw compatible mesh instances together. Their applicability depends on the render pipeline and shader setup. [Unity's SRP Batcher guide](https://docs.unity3d.com/6000.0/Documentation/Manual/SRPBatcher.html) and [GPU instancing guide](https://docs.unity3d.com/6000.0/Documentation/Manual/GPUInstancing.html) describe those mechanisms.

For GPU cost, inspect expensive passes, resolution, shadows, lighting, post-processing, geometry, and transparency. A large transparent particle can shade many pixels even where its visual contribution is faint. Multiple overlapping transparent layers increase overdraw.

Use the Frame Debugger to understand what draws and why it is split into passes or batches. Use GPU profiling to measure duration where the device and graphics API support it. The draw-call list explains how the frame is assembled; timing shows which parts are expensive.

Avoid accidental material duplication. Access patterns that instantiate a material can increase memory and break intended sharing. Changing a shared material can affect every renderer using it. Select the appropriate material ownership or per-instance data mechanism, then verify batching behavior for the project's pipeline.

Optimization should preserve the intended visual hierarchy. Reduce the cost of large low-information effects before removing the visual cues players need to read hazards. Work with artists on alternatives: tighter particle bounds, fewer overlapping layers, cheaper shader variants, or reduced offscreen work.

?? mobile-drawcall-myth [tf] A low draw-call count guarantees low GPU frame time.
* false
> A few draws can still perform expensive pixel shading, transparency, bandwidth-heavy work, or complex geometry processing.

?? mobile-srp-batcher What is the main kind of cost the SRP Batcher is designed to reduce?
* CPU rendering setup work for compatible shader and material usage.
- Every possible physics cost.
- The number of mission events.
- All texture residency regardless of asset ownership.
> The SRP Batcher addresses compatible rendering setup. It does not replace GPU workload analysis or memory management.

## Budget textures, audio, and total resident memory {#mobile-resource-memory}

Budget the mobile process's total memory. Account for native engine objects, textures, render targets, meshes, audio, managed data, loading buffers, and plugin allocations. Device memory is shared with the operating system and other applications.

Estimate texture memory from the runtime format. An uncompressed 2048 by 2048 RGBA32 texture contains 16 MiB at the base level: width times height times four bytes. A full mip chain adds approximately one third, giving about 21.33 MiB before alignment and additional copies. The source PNG's compressed file size does not determine that runtime footprint.

Compressed GPU formats change the calculation and depend on target support. Read/write settings can retain an additional CPU-accessible copy for supported resources. Mipmaps improve sampling at smaller sizes but consume memory. A UI texture never minified may have different needs from a world texture viewed at many distances. [Unity's texture compression reference](https://docs.unity3d.com/6000.0/Documentation/Manual/texture-compression-formats.html) explains platform-specific choices.

For audio, duration, channel count, sample rate, codec, and load mode all matter. Fully decoded PCM memory is approximately sample rate times channels times bytes per sample times duration. A long music track and a tiny frequently played effect need different policies. Streaming reduces some resident audio cost but adds I/O, buffering, and decode considerations.

Use snapshots to compare equivalent states before and after repeated feature cycles. Trace retained references and native resource ownership to explain growth. Allocator reservations and caches can remain after resources are released, so a larger reserved region alone does not prove a leak. [Unity's Memory Profiler package](https://docs.unity3d.com/Packages/com.unity.memoryprofiler@1.1/manual/index.html) provides snapshot analysis tools.

?? mobile-texture-size What is the base-level size of a 2048 by 2048 RGBA32 texture without compression or extra copies?
* 16 MiB.
- The same size as its PNG file on disk in every case.
- 4 KiB.
- 2 MiB.
> There are 4,194,304 pixels at four bytes each: 16,777,216 bytes, or 16 MiB.

?+ The texture's source PNG is only 1 MiB, but runtime import uses uncompressed RGBA32. Which number determines its base GPU pixel-data estimate?
* The imported dimensions and four bytes per pixel.
- The PNG's compressed file size alone.
- The length of the asset's filename.
- The number of scenes that mention the asset, regardless of actual sharing.
> Disk compression and runtime graphics format are distinct. Additional copies and mip levels must be budgeted separately.

?? mobile-memory-leak-evidence Which observation most strongly motivates investigating a resource leak?
* Equivalent open-close cycles keep adding owned objects that remain reachable after cleanup.
- A cache retains its documented bounded capacity.
- The allocator keeps reserved memory after a resource is released.
- A single startup load increases memory to its expected steady state.
> Look for unintended retained ownership across equivalent states. Reservation and intentional caching require interpretation rather than automatic leak labels.

## Frame pacing, heat, battery, and quality tiers {#mobile-thermal}

A device can run a scene well for one minute and throttle after sustained load. Thermal behavior changes CPU and GPU availability, so a short cold-device benchmark can overstate real-session performance.

Choose a supported device matrix rather than one flagship phone. Include a lower-end device, relevant GPU families, memory classes, and operating-system versions. Device selection should follow the game's support policy and audience data.

Frame pacing concerns when frames are presented. A stable 30 FPS can feel more consistent than oscillation between higher rates with repeated misses. A target should fit the display refresh behavior and sustainable workload. Android's [Unity development guide](https://developer.android.com/games/engines/unity/start-in-unity) discusses frame pacing and thermal considerations.

Quality tiers should reduce measured costs. GPU-limited devices may benefit from lower resolution, simpler shadows, and fewer expensive effects. CPU-limited scenes may need fewer simulated agents or lower update frequency for noncritical behavior. Reducing texture quality alone does not solve every CPU bottleneck.

Adaptation needs hysteresis. Changing quality every few frames can cause visible oscillation and repeated resource churn. Use a stable observation window, clear thresholds, and bounded adjustment rates. Some settings are expensive to change at runtime and may belong at a scene boundary.

Measure battery and sustained temperature alongside frame times where tooling permits. A menu that renders at maximum speed while waiting for input can waste energy even when no frame-budget failure occurs.

State the tradeoff to design: lower distant effect density can preserve responsive controls on the minimum device. Quality policy is a player-experience decision backed by measurements.

?? mobile-sustained-performance Why include a sustained play session in mobile performance testing?
* Heat and throttling can change available performance after the device warms.
- The first frame always predicts the entire session.
- Thermal state only affects desktop games.
- Sustained testing removes the need for a device matrix.
> Sustainable performance can differ substantially from a cold-device burst. Test the duration and content of actual play.

?? mobile-quality-hysteresis Why avoid changing quality tiers on every short fluctuation?
* Rapid switching can cause visual oscillation and resource churn.
- Quality settings cannot ever change at runtime.
- Lower quality always increases CPU cost.
- Every frame-time change means the device has permanently changed class.
> Stable thresholds and adjustment windows prevent the adaptation mechanism from becoming a new source of instability.

## UI, input, and application lifecycle are production systems {#mobile-ui-lifecycle}

Mobile UI must remain readable across aspect ratios, safe areas, text lengths, and input interruptions. A design that works only on one Editor resolution is incomplete.

Separate display state from gameplay authority. A currency label reflects the wallet; a progress bar reflects mission progress. Closing a screen should not cancel a reward that has already committed. Reopening should reconstruct the current state rather than depend on an animation having finished.

For a Canvas-based UI, changing layout or graphics can trigger rebuild work. Group elements by appropriate update behavior and measure before splitting every widget into its own Canvas. A different UI framework has different cost mechanisms; apply the profiler's evidence to the framework actually in use.

Localization changes layout, glyph requirements, and memory. Avoid concatenating translated sentence fragments with assumed English order. Plan overflow behavior and font coverage with the content team. Use stable localization keys separately from gameplay IDs.

Application pause and focus changes are not the same as a clean shutdown. Save progress at defined checkpoints, such as a completed run or committed reward, reconcile pending operations on resume, and assume the operating system can terminate the process without a final callback. Keep checkpoint writes bounded so backgrounding does not trigger an enormous last-second save.

On resume, validate view bindings and outstanding work. A request may have completed while the UI was hidden; a session may need recovery; an event window may have changed. Restore from authoritative state rather than replaying every visual callback blindly.

?? mobile-view-reconstruction What should a reward screen do after reopening following an interrupted celebration?
* Rebuild its display from the authoritative claim and inventory state.
- Grant the reward again because the animation did not finish.
- Assume the old visual state is the only truth.
- Delete the claim record to force a fresh flow.
> Presentation can be interrupted independently of commitment. Reconstructing from authoritative state avoids duplicates and missing displays.

?? mobile-checkpoint-saving Why avoid relying only on an application-quit callback to save progress?
* A mobile process may be terminated without an orderly final callback.
- Local storage is always unavailable on mobile.
- Every frame must instead write the entire save synchronously.
- Pause callbacks guarantee unlimited time for disk work.
> Checkpoint important state during meaningful operations. Shutdown callbacks are useful signals, not a durability guarantee.

## Build identity, native integrations, and backend differences {#mobile-build-integrations}

A mobile game includes more than managed gameplay code. Native SDKs, operating-system lifecycle, graphics APIs, scripting backends, stripping, content packages, and build settings affect behavior.

IL2CPP translates managed assemblies through a C++ toolchain and uses ahead-of-time compilation. Do not assume desktop JIT behavior or arbitrary runtime code generation is available. Reflection, generic use, and dynamically referenced types deserve target-build verification.

Wrap a platform integration behind a game-owned contract that describes the needed operation and result. Translate callbacks to explicit outcomes: unavailable, cancelled, succeeded, failed, or outcome-unknown when appropriate. Keep SDK types out of domain rules.

The adapter should define initialization, thread affinity, callback lifetime, and duplicate completion handling. A native callback arriving after a scene closes is the same ownership problem as any other late result, with additional platform failure modes.

Track binary version, content version, relevant SDK versions, and configuration revision in diagnostic context. A bug that exists only with one content revision cannot be reproduced reliably from a binary number alone.

A release-like smoke test should cover startup, a full run, pause/resume, scene transitions, save/load, and critical integrations on the target device. Development builds provide diagnostics, but their overhead can differ from release builds. Use each build type for the evidence it can provide.

?? mobile-adapter-contract Which detail belongs in a platform SDK adapter's contract?
* Which thread delivers completion and how callbacks are handled after the caller's lifetime ends.
- The exact layout of every gameplay screen.
- A guarantee that native integrations cannot fail.
- Permission for domain code to mutate all SDK internals.
> Platform boundaries need explicit scheduling, lifetime, and result semantics so gameplay can handle them safely.

?? mobile-build-identity Why record content revision alongside binary version?
* The same binary can behave differently with different compatible content or configuration.
- Content never affects runtime behavior.
- Binary version alone uniquely identifies every asset in all delivery models.
- It eliminates the need for reproduction steps.
> Reproduction depends on the full relevant configuration of code and data, not just one version number.
