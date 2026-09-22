---
book: Unity Game Engineering
chapter: 12: Mobile graphics, memory, and platform constraints
---

## Optimize rendering according to CPU and GPU evidence {#mobile-rendering}

Rendering can be limited by CPU submission, vertex processing, pixel shading, bandwidth, memory, or synchronization. The number of [[draw call|draw calls]] describes only one part of that work.

If submitting rendering work is expensive on the CPU, inspect material and state changes, batching compatibility, culling, and unnecessary renderers. The [[SRP Batcher]] reduces setup work for compatible shaders and materials; it does not combine every object into one draw. GPU instancing can draw compatible mesh instances together. Both depend on the render pipeline and shader setup. See [Unity's SRP Batcher guide](https://docs.unity3d.com/6000.0/Documentation/Manual/SRPBatcher.html) and [GPU instancing guide](https://docs.unity3d.com/6000.0/Documentation/Manual/GPUInstancing.html) for those mechanisms.

For GPU cost, examine expensive passes, resolution, shadows, lighting, post-processing, geometry, and transparency. A large transparent particle can shade many pixels even when it looks faint. Overlapping transparent layers shade some pixels repeatedly, increasing overdraw.

Use the Frame Debugger to see what is drawn and why work is split into different passes or batches. Use GPU profiling, where supported by the device and graphics API, to measure how long that work takes. The draw list explains the frame's construction; timings identify its expensive parts.

Check whether material access creates new material instances. Accidental copies can use more memory and prevent intended sharing. Changing a shared material has the opposite risk: it affects every renderer that uses it. Choose who owns the material or per-instance data, then verify the result's batching behavior in the project's pipeline.

Preserve the cues players need to recognize hazards. Start by reducing large effects that add little information, and work with artists on alternatives: tighter particle bounds, less overlap, cheaper shader variants, or less work outside the camera view.

One property of most mobile GPUs explains a large share of their performance behavior, and it is worth knowing by name. They are tile-based: the screen is divided into small tiles, and each tile is rendered using fast on-chip memory before the result is written out to main memory once. This is a deliberate trade, because memory bandwidth costs far more power than arithmetic on a phone.

Two consequences follow, and both are practical. Opaque geometry is cheap to overlap, because the hardware can often discard hidden fragments before shading them. Transparency is not, because blending requires reading what is already in the tile and the fragments cannot be discarded by depth in the same way. A stack of large transparent particles is therefore expensive in a way that the same area of opaque geometry is not, and this is why the advice in this section keeps returning to overdraw from transparent effects rather than to polygon counts.

The second consequence concerns operations that break the tiling. Reading back the framebuffer, switching render targets frequently, or using effects that need the full screen mid-frame can force the tile contents out to memory and back. On a desktop GPU these cost something; on a tile-based mobile GPU they can cost a great deal more. When a post-processing effect is much more expensive on device than its desktop profile suggested, this is a common reason.

Exercise: Use an overdraw visualization on your busiest scene and find the region with the most layers. Count how many of those layers are transparent, and ask the artist which of them the player would miss.

?? mobile-drawcall-myth [tf] A low draw-call count guarantees low GPU frame time.
* false
> A few draws can still perform expensive pixel shading, transparency, bandwidth-heavy work, or complex geometry processing.

?? mobile-srp-batcher What is the main kind of cost the SRP Batcher is designed to reduce?
* CPU rendering setup work for compatible shader and material usage.
- The number of draw calls submitted per frame.
- The amount of GPU memory used by material properties.
- The cost of pixel shading for overlapping transparent surfaces.
- The number of shader variants compiled at build time.
> The SRP Batcher addresses compatible rendering setup. It does not replace GPU workload analysis or memory management.

## Budget textures, audio, and total resident memory {#mobile-resource-memory}

Budget memory for the whole process. Include native engine objects, textures, render targets, meshes, audio, managed data, loading buffers, and plugin allocations. The device also needs memory for the operating system and other applications.

Estimate texture memory from its runtime format. An uncompressed 2048 by 2048 RGBA32 texture uses four bytes per pixel, giving 16 MiB for its base level. A full mip chain adds about one third, for roughly 21.33 MiB before alignment and extra copies. The source PNG's compressed size does not tell you this runtime cost.

GPU compression changes that estimate, and supported formats differ by target. Read/write settings can keep an additional CPU-accessible copy for supported resources. Mipmaps use more memory but improve sampling when a texture is displayed smaller. A UI texture that is never reduced in size may therefore need different settings from a world texture seen at many distances. [Unity's texture compression reference](https://docs.unity3d.com/6000.0/Documentation/Manual/texture-compression-formats.html) explains platform-specific choices.

Audio memory depends on duration, channel count, sample rate, codec, and load mode. For fully decoded PCM, estimate sample rate multiplied by channels, bytes per sample, and duration. A long music track and a short, frequently played effect need different policies. Streaming can reduce how much audio stays in memory, but adds I/O, buffering, and decoding work.

Compare memory snapshots taken in equivalent states before and after repeatedly opening and closing a feature. Follow retained references and native resource owners to explain any growth. Allocators and caches may keep reserved memory after a resource is released, so reservation alone does not prove a leak. [Unity's Memory Profiler package](https://docs.unity3d.com/Packages/com.unity.memoryprofiler@1.1/manual/index.html) provides snapshot analysis tools.

Setting the compressed figures beside the uncompressed one shows the size of the decision. For the same 2048 by 2048 texture:

| Runtime format | Bits per pixel | Base level | With full mip chain |
| --- | --- | --- | --- |
| RGBA32, uncompressed | 32 | 16 MiB | about 21.3 MiB |
| ETC2 RGBA8 | 8 | 4 MiB | about 5.3 MiB |
| ASTC 4x4 | 8 | 4 MiB | about 5.3 MiB |
| ASTC 6x6 | about 3.56 | about 1.78 MiB | about 2.4 MiB |
| ASTC 8x8 | 2 | 1 MiB | about 1.3 MiB |

The span from the first row to the last is sixteen to one, which is why import settings rather than source art usually decide a project's texture budget. A single accidental uncompressed texture costs as much as sixteen correctly compressed ones, and the mistake is invisible in the Editor.

Note that these are GPU memory figures, not download size, and that the two move independently. A texture compressed on disk and uncompressed at runtime is small to download and large to hold. Check the platform's supported formats before choosing, and verify the actual runtime format in the imported asset rather than assuming the override applied.

Exercise: Sort the textures in a project by runtime size rather than by file size, and look at the top ten. Explain why each is in the list, and see whether any of them surprised you.

?? mobile-texture-size What is the base-level size of a 2048 by 2048 RGBA32 texture without compression or extra copies?
* 16 MiB.
- 21.3 MiB, which includes the full mip chain.
- 4 MiB, assuming one byte per pixel.
- 8 MiB, assuming two bytes per pixel.
- 64 MiB, counting four bytes for each of four channels.
> There are 4,194,304 pixels at four bytes each: 16,777,216 bytes, or 16 MiB.

?+ The texture's source PNG is only 1 MiB, but runtime import uses uncompressed RGBA32. Which number determines its base GPU pixel-data estimate?
* The imported dimensions and four bytes per pixel.
- The PNG's compressed size, scaled by the import quality setting.
- The ratio of the PNG size to the texture's bit depth.
- The size the texture occupies in the build's asset bundle.
- The number of mip levels, which sets the base level size.
> Disk compression and runtime graphics format are distinct. Additional copies and mip levels must be budgeted separately.

?? mobile-memory-leak-evidence Which observation most strongly motivates investigating a resource leak?
* Equivalent open-close cycles keep adding owned objects that remain reachable after cleanup.
- Total memory rises during the first minute and then levels off.
- The managed heap stays at its high-water mark after a large load.
- A profiler snapshot shows more objects than the previous build did.
- Memory rises whenever the player opens a screen for the first time.
> Compare the same state after repeated cycles, and check whether objects that should have been released still have owners. Reserved allocator memory and a bounded cache need separate interpretation.

## Frame pacing, heat, battery, and quality tiers {#mobile-thermal}

A scene may run well for the first minute and slow down as the device heats up. Thermal throttling reduces available CPU or GPU performance. A short benchmark on a cold device can therefore overstate what a normal play session will sustain.

Test a range of supported devices, including lower-end hardware, relevant GPU families, memory capacities, and operating-system versions. Select that range from the game's support policy and audience data; one flagship phone cannot represent it.

Frame pacing describes when completed frames reach the display. Stable 30 FPS can feel more consistent than a higher rate that repeatedly misses its deadlines. Choose a target that fits the display's refresh behavior and the workload the device can sustain. Android's [Unity development guide](https://developer.android.com/games/engines/unity/start-in-unity) discusses frame pacing and thermal behavior.

Use quality tiers to reduce the costs measurements identify. A GPU-limited device may benefit from lower resolution, simpler shadows, or fewer expensive effects. A CPU-limited scene may need fewer simulated agents or less frequent updates for noncritical behavior. Lowering texture quality alone cannot solve every CPU bottleneck.

Make automatic quality changes resist small, short-lived fluctuations. Switching tiers every few frames can visibly alternate quality and repeatedly load or rebuild resources. Use a stable observation window, clear thresholds, and a limit on how quickly settings change. Expensive settings may be better changed between scenes.

Where tools allow it, measure battery use and sustained temperature alongside frame times. A menu rendering as fast as possible while waiting for input can waste energy even if every frame meets its time budget.

Explain the player-facing tradeoff to design. Reducing distant effect density, for example, may keep controls responsive on the minimum supported device. Use measurements to support that choice.

A soak test needs a protocol, or the results will not be comparable between runs. A workable one: charge the device to a consistent level and let it reach room temperature; start a capture; play a representative session for at least fifteen minutes without pausing; and record frame-time percentiles for each five-minute segment separately rather than for the whole session.

Reading the segments separately is the point. A run whose first segment shows a p95 of 15 ms and whose third shows 26 ms has described a thermal curve, which a single figure averaged over the session would have concealed. Note the point at which the curve flattens, because that plateau, not the opening minute, is the performance the game actually delivers.

Two details change results more than people expect. Charging while testing adds heat and can produce numbers no player will ever see. And a device in a case, in a hand, or on a desk dissipates heat differently, so keep that constant too. These sound fussy until two runs disagree by 30 percent and nobody can say why.

Exercise: Run the same scenario twice, once from cold and once immediately afterward. Compare the two p95 figures, and use the difference as your project's thermal headroom requirement.

?? mobile-sustained-performance Why include a sustained play session in mobile performance testing?
* Heat and throttling can change available performance after the device warms.
- Longer sessions give the profiler a larger sample to average.
- Memory fragmentation makes allocations slower over time.
- Background applications accumulate and compete for the CPU.
- The garbage collector runs more often as the session continues.
> Sustainable performance can differ substantially from a cold-device burst. Test the duration and content of actual play.

?? mobile-quality-hysteresis Why avoid changing quality tiers on every short fluctuation?
* Rapid switching can cause visual oscillation and resource churn.
- Each switch writes the new tier to disk, which stalls the frame.
- Quality tiers can be changed once per session on most platforms.
- Frame time is measured per frame, so a single sample is noise.
- The renderer needs a full scene reload to apply a new tier.
> A longer observation window and clear switching thresholds keep brief timing changes from repeatedly changing quality and loading resources.

## UI, input, and application lifecycle are production systems {#mobile-ui-lifecycle}

Mobile UI must remain readable across aspect ratios, safe areas, text lengths, and input interruptions. A design that works only on one Editor resolution is incomplete.

Have the UI read the state owned by gameplay: a currency label reflects the wallet, and a progress bar reflects mission progress. Closing a screen must not undo a reward that has already been committed. When the screen reopens, rebuild it from current state, even if the earlier animation never finished.

In a Canvas-based UI, layout or graphic changes can trigger rebuilds. Group elements according to how they update, and measure before putting every widget on its own Canvas. Other UI frameworks have different costs, so use evidence from the framework the project actually uses.

Localization affects layout, required glyphs, and memory. Translated sentence fragments may need a different order, so avoid joining them according to English grammar. Plan text overflow and font coverage with the content team, and keep localization keys separate from gameplay IDs.

Pause and focus changes do not guarantee a clean shutdown. Save at defined checkpoints, such as completing a run or committing a reward, and recover pending operations on resume. Assume the operating system can terminate the process without a final callback. Keep checkpoint writes bounded, so backgrounding does not require a huge last-second save.

On resume, check view bindings and pending work. A request may have finished while the UI was hidden, a session may need recovery, or an event window may have closed. Restore the display from authoritative state, applying only callbacks that are still relevant.

Be precise about which lifecycle callbacks are guaranteed, because the design depends on it. A focus or pause callback usually arrives when the player leaves the app, and that is a good moment to save. A quit callback is not reliably delivered on mobile: the operating system can reclaim a backgrounded process without running any further application code. Design so that losing everything after the last pause callback is acceptable, and treat anything the quit callback does as a convenience.

That constraint bounds how much work a save may do. Whatever runs in the pause callback competes with the system's willingness to let the app finish, so a save that serializes the whole game state there is a gamble that gets worse as the save grows. Keep the pause-time write small and bounded: commit the operations that have completed, not a full snapshot recomputed from scratch. Where a save is necessarily large, write it at the natural checkpoints this section describes, and let the pause callback write only what has changed since.

The resume side needs a defined order too. Recover pending operations before rebuilding any screen, so the UI is built from settled state rather than showing a value it will have to correct a moment later. A brief loading state on resume is a better experience than a reward count that visibly changes twice.

Exercise: Background your game at three different moments, including during a reward animation, and force the process to be terminated. Record what the player loses in each case, and whether they would consider it acceptable.

?? mobile-view-reconstruction What should a reward screen do after reopening following an interrupted celebration?
* Rebuild its display from the authoritative claim and inventory state.
- Replay the celebration from the beginning, then show the final balance.
- Show the balance from before the claim until the animation completes.
- Send the claim again, so the screen has a fresh result to display.
- Restore the visual state that was saved when the screen was interrupted.
> The reward can be committed even when its animation is interrupted. Rebuilding the screen from saved claim and inventory state shows the correct result without granting it again.

?? mobile-checkpoint-saving Why avoid relying only on an application-quit callback to save progress?
* A mobile process may be terminated without an orderly final callback.
- The quit callback runs after the scene has already been unloaded.
- Writing to disk from the quit callback requires a background thread.
- The quit callback runs before the last gameplay frame completes.
- Saves written during shutdown skip the platform's flush step.
> Save important progress when the relevant operation completes. A shutdown callback can help, but the process may end before it runs.

## Build identity, native integrations, and backend differences {#mobile-build-integrations}

A mobile game includes more than managed gameplay code. Native SDKs, operating-system lifecycle, graphics APIs, scripting backends, stripping, content packages, and build settings affect behavior.

IL2CPP translates managed assemblies through a C++ toolchain and compiles ahead of time. Code cannot assume the same just-in-time behavior as a desktop runtime, or that arbitrary runtime code generation is available. Verify reflection, generic use, and dynamically referenced types in the target build.

Put a platform integration behind an interface owned by the game. Describe the operation and its possible results: unavailable, cancelled, succeeded, failed, or outcome unknown when the API cannot confirm completion. Translate SDK callbacks into those results, keeping SDK-specific types out of gameplay rules.

Define how the adapter initializes, which threads it uses, how long callbacks remain valid, and how duplicate completion is handled. A native callback arriving after a scene closes needs the same ownership checks as any late result, along with handling for platform-specific failures.

Include the binary version, content version, relevant SDK versions, and configuration revision in diagnostic records. If a bug occurs only with one content revision, the binary version alone will not identify the conditions needed to reproduce it.

Run a smoke test on the target device with settings close to release. Cover startup, a complete run, pause and resume, scene transitions, save and load, and critical integrations. Development builds help with diagnostics, but their overhead can differ from release builds. Use each build type to answer the questions it can reliably test.

The unknown outcome deserves to exist in the type system rather than in a comment, because a result that can be unknown is handled differently everywhere it flows:

```csharp
public enum PurchaseStatus
{
    Succeeded,
    Cancelled,       // The player chose to stop. Not an error.
    Unavailable,     // Billing is not ready. Retry later.
    Failed,          // A definite failure with a reason.
    Unknown,         // The SDK could not confirm. Reconcile on next launch.
}
```

`Unknown` is the state most integrations omit, and it is the one that produces the worst defects. A purchase that may or may not have completed cannot be retried as a new purchase and cannot be reported as a failure, because either choice is wrong half the time. The only correct handling is to record it and reconcile against the authority later, which is the same durable pending record that the rewards chapter describes. Modelling it as a `bool` forces the code to lie about one of the two possibilities.

Keeping this enum on the game's side of the boundary is what makes the SDK replaceable. When a second platform arrives, its adapter maps a different set of native callbacks onto these five cases, and no gameplay code changes. When the SDK's own types cross the boundary instead, each new platform reaches into the code that was supposed to be platform independent.

Exercise: Take an integration in your project and list every outcome its API can produce. Map each one onto a small set of game-owned results, and see whether an unknown case exists that the current code treats as a failure.

?? mobile-adapter-contract Which detail belongs in a platform SDK adapter's contract?
* Which thread delivers completion and how callbacks are handled after the caller's lifetime ends.
- The SDK version the adapter was written against.
- The retry schedule the gameplay layer should use on failure.
- The list of products the store is expected to return.
- The analytics events the adapter emits for each result.
> Gameplay needs to know when and where a callback can run, whether its owner is still valid, and what the result means.

?? mobile-build-identity Why record content revision alongside binary version?
* The same binary can behave differently with different compatible content or configuration.
- Content revisions change more often than binary versions do.
- The content revision identifies which team produced the build.
- Recording both makes the diagnostic record easier to sort.
- The binary version is unavailable in release builds.
> Reproducing the bug requires the relevant code, content, and configuration versions. A binary version identifies only part of that setup.
