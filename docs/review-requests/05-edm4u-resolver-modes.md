# EDM4U's resolver modes are described as they were before 1.2.179, and a variant teaches a duplication the resolver prevents

**Kind:** Accuracy. **Priority:** High. **Touches:** prose (`05-android-builds.md:253`), glossary (`glossary.md:208`), and a question block: the prompt, `*` option and explanation of one variant of `gradle-duplicate-class` (`05-android-builds.md:303-309`).

## Location

`content/mobile-platform/05-android-builds.md:253`:

> The resolver works in one of two modes. By default it runs Gradle itself, resolves the combined graph and copies the resulting AARs and JARs into `Assets/Plugins/Android`. With its Patch mainTemplate.gradle setting on, which needs a custom main Gradle template, it writes the dependencies into the template […] Mixing the two duplicates classes: AARs that an earlier resolution copied into `Assets/Plugins/Android` stay there after the template starts declaring the same libraries.

`content/mobile-platform/05-android-builds.md:303-309`, concept `gradle-duplicate-class`, third variant:

> ?+ EDM4U once copied SDK libraries into `Assets/Plugins/Android`, and the team has now turned on Patch mainTemplate.gradle. What goes wrong?
> \* The same libraries arrive twice, as the old copies and through the template
> […]
> \> In template mode the resolver writes dependencies into `mainTemplate.gradle`, and the copies that an earlier resolution left in `Assets/Plugins/Android` are still there, so the same classes come from both. […]

`content/mobile-platform/glossary.md:208` (EDM4U): “Mixing the two modes duplicates classes, as [[#gradle-dependencies]] shows.”

## Evidence

Two claims are wrong for the EDM4U the chapter's evidence names (source at 1.2.189, released September 2, 2026). The source and the README agree, so no run was needed.

**1. Which mode is the default.** EDM4U's changelog, <https://raw.githubusercontent.com/googlesamples/unity-jar-resolver/master/CHANGELOG.md>:

> # Version 1.2.179 - Feb 12, 2024
> * Android Resolver - Added logic to automatically turn on `mainTemplate.gradle` for new projects, and prompt users to enable it on projects that have previously had the resolver run.

`source/AndroidResolver/src/PlayServicesResolver.cs`, `ResolveUnsafeAfterMainTemplateCheck`: if the template is off and the user has not rejected the switch, then `if (ExecutionEnvironment.InBatchMode || !PlayServicesResolver.FindLabeledAssets().Any())` it calls `EnableGradleTemplates()` (the custom main template and the Gradle properties template); otherwise it shows the dialog “Enable Android Gradle templates?” with “The old method of downloading the dependencies into Plugins/Android is no longer recommended.” `SettingsDialog.cs` reads the setting as `projectSettings.GetBool(PatchMainTemplateGradleKey, true)`, so Patch mainTemplate.gradle defaults to on. For a new project, and for any batch-mode resolution such as CI, template mode is the default and copying is the opt-out. (The README's “Resolution Strategies” section still calls copying “the default resolution strategy”; it predates 1.2.179 and the code overrides it.)

**2. What happens to the old copies.** Every library the resolver copies is labeled `gpsr` (`ManagedAssetLabel = "gpsr"`, applied through `LabelAssets` in `GradleResolver.cs:482`). The resolver records its last state in `ProjectSettings/AndroidResolverDependencies.xml`: the packages, the labeled files, and the settings from `GetResolutionSettings()`, which include `patchMainTemplateGradle` and `gradleTemplateEnabled`. `ResolveUnsafe` compares the current state with that record, `DependencyState.Equals` compares the settings as well as the packages and files, and on any difference it runs `DeleteLabeledAssets()`, with the comment “Delete all labeled assets to make sure we don't leave any stale transitive dependencies in the project.” A forced resolution deletes them too. So turning on Patch mainTemplate.gradle, or accepting the “Enable Android Gradle templates?” dialog, changes the recorded settings, and the next resolution deletes the copies EDM4U made before it writes the template. The README says the same for both modes: “Remove the result of previous Android resolutions. E.g Delete all files and directories labeled with "gpsr" under `Plugins/Android` from the project.”

What does duplicate classes is a copy that carries no `gpsr` label: an AAR a vendor told the team to drop in by hand, a copy committed without its `.meta` file, or one another tool made. The chapter's general point about a local and a remote copy of one library (line 238, and the variants at lines 287 and 295) stands; only the claim that EDM4U's own mode switch causes it is wrong. The variant's premise is exactly the case the resolver handles, so its correct answer is false, and the review queue repeats it.

## Proposed fix

Prose, line 253, from “The resolver works in one of two modes.” to the end of the paragraph:

> The resolver works in one of two modes. In the first, it runs Gradle itself, resolves the combined graph and copies the resulting AARs and JARs into `Assets/Plugins/Android`, labeling each copy as its own. In the second, its Patch mainTemplate.gradle setting, it writes the dependencies into the custom main Gradle template between `// Android Resolver Dependencies Start` and `// Android Resolver Dependencies End`, and the build resolves them. Since EDM4U 1.2.179, released in February 2024, the resolver turns the custom template on by itself in a new project or in batch mode, and asks first in a project where it has already copied libraries, so the template is the usual mode. It keeps the POMs in play, so the build's own resolution and `dependencyInsight` see everything. When the mode changes, the next resolution deletes the copies the resolver labeled; a copy it did not make, such as an AAR a vendor's instructions had the team drop in by hand, stays, and then the same classes arrive twice. Delete Resolved Libraries removes the resolver's own copies on demand.

Glossary, `glossary.md:208`, replace the second paragraph's first two sentences:

> Its Android Resolver either writes the dependencies into the custom main Gradle template for the build to resolve, the mode it turns on by itself in new projects, or resolves them itself and copies the libraries into `Assets/Plugins/Android`. It deletes its own copies when the mode changes; a library copied in by hand beside the template's declaration duplicates classes, as [[#gradle-dependencies]] shows.

Question block, `05-android-builds.md:303-309`. Keep the concept and the lesson (a hand copy beside a declared dependency), and move the premise to the case that duplicates:

> ?+ EDM4U writes an SDK's dependencies into `mainTemplate.gradle`, and the SDK's old setup guide also had the team copy one of those AARs into `Assets/Plugins/Android` by hand. What goes wrong?
> \* The same library arrives twice, as the hand copy and through the template
> \- EDM4U replaces the custom template with Unity's default one on each resolution
> \- Gradle ignores the template while AARs are present in the Plugins folder
> \- The resolver stops reading `*Dependencies.xml` files once the template is patched
> \- Unity refuses to build when a template and plugins share one folder
> \> The resolver deletes the copies it made itself when its mode changes, but a copy it did not make stays, and the template declares the same library again, so the same classes come from both. Delete the hand copy and let the template's dependency stand.

Cost to review history: a changed prompt, `*` option and explanation in a committed variant. Its stable id stays, but the question it asks is new, so the reader's history for that variant no longer describes it; resetting that one variant is the honest choice. It needs the user's consent under the committed-question rule, and `npm run guard -- questions` reports the changed block. Only the four `-` lines could be kept as they are.

## Repeated in

- `content/mobile-platform/glossary.md:208`, the EDM4U entry, as quoted above.
- Nothing in chapters 06 to 16 describes the Android Resolver's modes.
