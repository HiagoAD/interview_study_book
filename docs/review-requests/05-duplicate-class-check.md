# Duplicate classes fail in the Android Gradle Plugin's own check, before DEX, with a message the chapter does not quote

**Kind:** Accuracy. **Priority:** Low. **Touches:** prose (`05-android-builds.md:238`), and the explanation lines of two variants of `gradle-duplicate-class` (`05-android-builds.md:293` and `:301`).

## Location

`content/mobile-platform/05-android-builds.md:238`:

> […] both copies reach the step that converts classes into DEX, the case that [Android's guide to dependency errors](https://developer.android.com/build/dependency-resolution-errors) describes as a local and a remote binary dependency on the same library. The build fails with an error that names the class and both artifacts; D8, the tool that converts them, words it as a type “defined multiple times”.

Explanations: line 293, “so to Gradle the two copies are different modules and both reach DEX”; line 301, “so Gradle keeps both, and the classes collide when the build converts them to DEX.”

## Evidence

Phase 23 had no Android Gradle Plugin (its evidence file: “No Gradle build of a Unity project ran”), and took the message from D8 run on its own. On this Mac, a copy of the probe project's export (`PlatformLayerProbe/Exports/Android-Activity`, Unity 6000.3.11f1, AGP 8.10.0, the Editor's Gradle 8.13 and OpenJDK 17, offline from the Gradle cache) was given a local Maven repository holding `com.example.lib:netcore:2.0.0`, a JAR with `com.example.netcore.Client`, declared in `unityLibrary/build.gradle`, and the same JAR copied to `unityLibrary/libs/netcore.jar`, which the export's `implementation fileTree(dir: 'libs', include: ['*.jar'])` picks up. `:launcher:checkReleaseDuplicateClasses` failed:

```text
Execution failed for task ':launcher:checkReleaseDuplicateClasses'.
> A failure occurred while executing com.android.build.gradle.internal.tasks.CheckDuplicatesRunnable
   > Duplicate class com.example.netcore.Client found in modules netcore-2.0.0.jar -> jetified-netcore-2.0.0 (com.example.lib:netcore:2.0.0) and netcore.jar -> jetified-netcore (netcore.jar)
     Learn how to fix dependency resolution errors at https://d.android.com/r/tools/classpath-sync-errors
```

`gradle -m :launcher:assembleRelease` lists `:launcher:checkReleaseDuplicateClasses` at position 28, before `:launcher:dexBuilderRelease` (49), `:launcher:mergeExtDexRelease` (52) and `:unityLibrary:buildIl2Cpp` (80). Asking for `:launcher:mergeExtDexRelease` alone, with IL2CPP excluded, failed in `checkReleaseDuplicateClasses` too, so the DEX step depends on the check and never runs. A Unity build runs the same Gradle tasks, so the player sees “Duplicate class … found in modules …” and not D8's “defined multiple times”. Android's page, fetched on 2026-09-29, quotes an older wording again, “Program type already present com.example.MyClass”.

The chapter's point is right: the build fails and names the class and both artifacts. What is off is the stage (the check reads the classes on the runtime classpath before anything is converted to DEX) and the quoted wording, which a reader would search a build log for.

## Proposed fix

Prose, line 238, replace the last two sentences before “The fix is one copy.”:

> The build fails before anything is converted to DEX: the Android Gradle Plugin checks the classes on the app's runtime classpath and stops with “Duplicate class … found in modules …”, naming the class, the Maven artifact with its coordinates, and the copied file.

and in the same paragraph, “both copies reach the step that converts classes into DEX” becomes “both copies reach the app's runtime classpath”.

Explanations (need consent; no option, prompt or answer changes):

- line 293: “so to Gradle the two copies are different modules, and the plugin's duplicate-class check fails the build.”
- line 301: “so Gradle keeps both, and the plugin's duplicate-class check finds the same class in two modules and fails the build.”

Cost to review history: explanation-only edits in two committed variants; no variant's progress moves, but `npm run guard -- questions` reports both blocks as changed, so they need the user's consent. The prose change alone fixes the wording a reader searches for, if the explanations are left.

## Repeated in

Nothing else in the book or the glossary quotes the message.
