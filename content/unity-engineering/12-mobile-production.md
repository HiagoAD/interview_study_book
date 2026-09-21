---
book: Unity Game Engineering
chapter: 12: Mobile graphics, memory, and platform constraints
---

## Optimize rendering according to CPU and GPU evidence {#mobile-rendering}

Rendering can be limited by CPU submission, vertex processing, pixel shading, bandwidth, memory, or synchronization. The number of draw calls describes only one part of that work.

If submitting rendering work is expensive on the CPU, inspect material and state changes, batching compatibility, culling, and unnecessary renderers. The SRP Batcher reduces setup work for compatible shaders and materials; it does not combine every object into one draw. GPU instancing can draw compatible mesh instances together. Both depend on the render pipeline and shader setup. See [Unity's SRP Batcher guide](https://docs.unity3d.com/6000.0/Documentation/Manual/SRPBatcher.html) and [GPU instancing guide](https://docs.unity3d.com/6000.0/Documentation/Manual/GPUInstancing.html) for those mechanisms.

For GPU cost, examine expensive passes, resolution, shadows, lighting, post-processing, geometry, and transparency. A large transparent particle can shade many pixels even when it looks faint. Overlapping transparent layers shade some pixels repeatedly, increasing overdraw.

Use the Frame Debugger to see what is drawn and why work is split into different passes or batches. Use GPU profiling, where supported by the device and graphics API, to measure how long that work takes. The draw list explains the frame's construction; timings identify its expensive parts.

Check whether material access creates new material instances. Accidental copies can use more memory and prevent intended sharing. Changing a shared material has the opposite risk: it affects every renderer that uses it. Choose who owns the material or per-instance data, then verify the result's batching behavior in the project's pipeline.

Preserve the cues players need to recognize hazards. Start by reducing large effects that add little information, and work with artists on alternatives: tighter particle bounds, less overlap, cheaper shader variants, or less work outside the camera view.

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

Budget memory for the whole process. Include native engine objects, textures, render targets, meshes, audio, managed data, loading buffers, and plugin allocations. The device also needs memory for the operating system and other applications.

Estimate texture memory from its runtime format. An uncompressed 2048 by 2048 RGBA32 texture uses four bytes per pixel, giving 16 MiB for its base level. A full mip chain adds about one third, for roughly 21.33 MiB before alignment and extra copies. The source PNG's compressed size does not tell you this runtime cost.

GPU compression changes that estimate, and supported formats differ by target. Read/write settings can keep an additional CPU-accessible copy for supported resources. Mipmaps use more memory but improve sampling when a texture is displayed smaller. A UI texture that is never reduced in size may therefore need different settings from a world texture seen at many distances. [Unity's texture compression reference](https://docs.unity3d.com/6000.0/Documentation/Manual/texture-compression-formats.html) explains platform-specific choices.

Audio memory depends on duration, channel count, sample rate, codec, and load mode. For fully decoded PCM, estimate sample rate multiplied by channels, bytes per sample, and duration. A long music track and a short, frequently played effect need different policies. Streaming can reduce how much audio stays in memory, but adds I/O, buffering, and decoding work.

Compare memory snapshots taken in equivalent states before and after repeatedly opening and closing a feature. Follow retained references and native resource owners to explain any growth. Allocators and caches may keep reserved memory after a resource is released, so reservation alone does not prove a leak. [Unity's Memory Profiler package](https://docs.unity3d.com/Packages/com.unity.memoryprofiler@1.1/manual/index.html) provides snapshot analysis tools.

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
> Compare the same state after repeated cycles, and check whether objects that should have been released still have owners. Reserved allocator memory and a bounded cache need separate interpretation.

## Frame pacing, heat, battery, and quality tiers {#mobile-thermal}

A scene may run well for the first minute and slow down as the device heats up. Thermal throttling reduces available CPU or GPU performance. A short benchmark on a cold device can therefore overstate what a normal play session will sustain.

Test a range of supported devices, including lower-end hardware, relevant GPU families, memory capacities, and operating-system versions. Select that range from the game's support policy and audience data; one flagship phone cannot represent it.

Frame pacing describes when completed frames reach the display. Stable 30 FPS can feel more consistent than a higher rate that repeatedly misses its deadlines. Choose a target that fits the display's refresh behavior and the workload the device can sustain. Android's [Unity development guide](https://developer.android.com/games/engines/unity/start-in-unity) discusses frame pacing and thermal behavior.

Use quality tiers to reduce the costs measurements identify. A GPU-limited device may benefit from lower resolution, simpler shadows, or fewer expensive effects. A CPU-limited scene may need fewer simulated agents or less frequent updates for noncritical behavior. Lowering texture quality alone cannot solve every CPU bottleneck.

Make automatic quality changes resist small, short-lived fluctuations. Switching tiers every few frames can visibly alternate quality and repeatedly load or rebuild resources. Use a stable observation window, clear thresholds, and a limit on how quickly settings change. Expensive settings may be better changed between scenes.

Where tools allow it, measure battery use and sustained temperature alongside frame times. A menu rendering as fast as possible while waiting for input can waste energy even if every frame meets its time budget.

Explain the player-facing tradeoff to design. Reducing distant effect density, for example, may keep controls responsive on the minimum supported device. Use measurements to support that choice.

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
> A longer observation window and clear switching thresholds keep brief timing changes from repeatedly changing quality and loading resources.

## UI, input, and application lifecycle are production systems {#mobile-ui-lifecycle}

Mobile UI must remain readable across aspect ratios, safe areas, text lengths, and input interruptions. A design that works only on one Editor resolution is incomplete.

Have the UI read the state owned by gameplay: a currency label reflects the wallet, and a progress bar reflects mission progress. Closing a screen must not undo a reward that has already been committed. When the screen reopens, rebuild it from current state, even if the earlier animation never finished.

In a Canvas-based UI, layout or graphic changes can trigger rebuilds. Group elements according to how they update, and measure before putting every widget on its own Canvas. Other UI frameworks have different costs, so use evidence from the framework the project actually uses.

Localization affects layout, required glyphs, and memory. Translated sentence fragments may need a different order, so avoid joining them according to English grammar. Plan text overflow and font coverage with the content team, and keep localization keys separate from gameplay IDs.

Pause and focus changes do not guarantee a clean shutdown. Save at defined checkpoints, such as completing a run or committing a reward, and recover pending operations on resume. Assume the operating system can terminate the process without a final callback. Keep checkpoint writes bounded, so backgrounding does not require a huge last-second save.

On resume, check view bindings and pending work. A request may have finished while the UI was hidden, a session may need recovery, or an event window may have closed. Restore the display from authoritative state, applying only callbacks that are still relevant.

?? mobile-view-reconstruction What should a reward screen do after reopening following an interrupted celebration?
* Rebuild its display from the authoritative claim and inventory state.
- Grant the reward again because the animation did not finish.
- Assume the old visual state is the only truth.
- Delete the claim record to force a fresh flow.
> The reward can be committed even when its animation is interrupted. Rebuilding the screen from saved claim and inventory state shows the correct result without granting it again.

?? mobile-checkpoint-saving Why avoid relying only on an application-quit callback to save progress?
* A mobile process may be terminated without an orderly final callback.
- Local storage is always unavailable on mobile.
- Every frame must instead write the entire save synchronously.
- Pause callbacks guarantee unlimited time for disk work.
> Save important progress when the relevant operation completes. A shutdown callback can help, but the process may end before it runs.

## Build identity, native integrations, and backend differences {#mobile-build-integrations}

A mobile game includes more than managed gameplay code. Native SDKs, operating-system lifecycle, graphics APIs, scripting backends, stripping, content packages, and build settings affect behavior.

IL2CPP translates managed assemblies through a C++ toolchain and compiles ahead of time. Code cannot assume the same just-in-time behavior as a desktop runtime, or that arbitrary runtime code generation is available. Verify reflection, generic use, and dynamically referenced types in the target build.

Put a platform integration behind an interface owned by the game. Describe the operation and its possible results: unavailable, cancelled, succeeded, failed, or outcome unknown when the API cannot confirm completion. Translate SDK callbacks into those results, keeping SDK-specific types out of gameplay rules.

Define how the adapter initializes, which threads it uses, how long callbacks remain valid, and how duplicate completion is handled. A native callback arriving after a scene closes needs the same ownership checks as any late result, along with handling for platform-specific failures.

Include the binary version, content version, relevant SDK versions, and configuration revision in diagnostic records. If a bug occurs only with one content revision, the binary version alone will not identify the conditions needed to reproduce it.

Run a smoke test on the target device with settings close to release. Cover startup, a complete run, pause and resume, scene transitions, save and load, and critical integrations. Development builds help with diagnostics, but their overhead can differ from release builds. Use each build type to answer the questions it can reliably test.

?? mobile-adapter-contract Which detail belongs in a platform SDK adapter's contract?
* Which thread delivers completion and how callbacks are handled after the caller's lifetime ends.
- The exact layout of every gameplay screen.
- A guarantee that native integrations cannot fail.
- Permission for domain code to mutate all SDK internals.
> Gameplay needs to know when and where a callback can run, whether its owner is still valid, and what the result means.

?? mobile-build-identity Why record content revision alongside binary version?
* The same binary can behave differently with different compatible content or configuration.
- Content never affects runtime behavior.
- Binary version alone uniquely identifies every asset in all delivery models.
- It eliminates the need for reproduction steps.
> Reproducing the bug requires the relevant code, content, and configuration versions. A binary version identifies only part of that setup.
