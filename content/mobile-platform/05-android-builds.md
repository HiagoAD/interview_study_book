---
book: unity-mobile-platform-engineering
chapter: 05: Android builds: Gradle, manifests, and dependencies
---

## From Unity to an APK or AAB: the generated Gradle project {#gradle-project}

A Unity Android build ends in [[Gradle]]. Unity does the part of the build that only Unity knows how to do, writes an ordinary Android project around the result, and hands that project to Gradle to compile, package and sign. An Android build that fails often fails in that second half, in files nobody on the team wrote, so the first thing to know is what Unity puts where.

With the IL2CPP scripting backend, a build runs in four steps:

1. Unity compiles the game's C# into assemblies, as the Editor does, and [[managed code stripping]] removes the code the build appears not to use.
2. [[IL2CPP]] converts the assemblies that remain into C++.
3. Unity writes a Gradle project that holds that C++, the game's data, Unity's Java classes, the engine's native libraries and every plugin.
4. Gradle builds the project with the [[Android Gradle Plugin]]. It compiles the Java and Kotlin, merges the manifests and the resources, runs [[R8]] when minify is on, converts the Java bytecode into DEX, the format Android runs, and packages and signs an APK or an [[AAB|app bundle]].

Export Project, in the Build Profiles window, stops after the third step and leaves the project in a folder you choose, where Android Studio can open it and Gradle can build it from the command line. An exported project also shows where IL2CPP's C++ is compiled. Its `unityLibrary` holds the engine's prebuilt `libmain.so` and `libunity.so` for each ABI and no `libil2cpp.so`, because the module's own Gradle build compiles that library with the NDK and leaves its symbols under `unityLibrary/symbols/<abi>/`.

The project has two modules, and Unity as a Library, Unity's support for embedding a game in another Android app, relies on the split. One module holds everything the game needs, and the other is a thin app around it:

| Module | Android module type | What it holds |
| --- | --- | --- |
| `unityLibrary` | Library | The game: Unity's Java classes in `libs/unity-classes.jar`, the engine's native libraries for each ABI, IL2CPP's C++, the game's data, Unity's manifest with its activity, every plugin, and the dependencies those plugins declare |
| `launcher` | Application | The app around the game: its application id, its version code and version name, its signing, the build types with their minify switches, and the packaging into an APK or an app bundle |

The application id, the version and the signature belong to the app that gets installed, so they live in `launcher`, and `launcher` is the module whose tasks build the game: `:launcher:assembleRelease` makes an APK and `:launcher:bundleRelease` an app bundle, both under `launcher/build/outputs/`. A team that embeds the game in its own Android app keeps `unityLibrary` and lets its app take the place of `launcher`.

Unity generates this project from its own templates, from Player Settings and from the plugins in the project. The generated files are output, like a compiler's: an edit made to them, or to an exported copy, is not part of the Unity project, and the next generated project does not have it. Changes have to live in the Unity project, and Unity 6.3 has three mechanisms for making them.

The first is a custom template. A checkbox in Publishing Settings, such as Custom Main Gradle Template, copies one of Unity's templates into `Assets/Plugins/Android/`, and from then on Unity writes the matching file from that copy, filling in placeholders such as `**DEPS**`:

| Template | The file Unity writes from it |
| --- | --- |
| `baseProjectTemplate.gradle` | The root `build.gradle`, which fixes the Android Gradle Plugin's version |
| `settingsTemplate.gradle` | `settings.gradle`, with the modules and the Maven repositories they resolve from |
| `mainTemplate.gradle` | `unityLibrary/build.gradle`, with `**DEPS**` where dependencies are written |
| `launcherTemplate.gradle` | `launcher/build.gradle` |
| `gradleTemplate.properties` | `gradle.properties` |

A custom template is a copy of Unity's template as it was in the Unity version that made the copy, and it stays that copy. Unity fills in its placeholders on each build and leaves the rest alone. When an upgrade changes Unity's own template, with a new placeholder, a newer Android Gradle Plugin, or a plugin setting renamed between plugin versions, the copy keeps the old text. The build then fails on a line nobody on the team edited, or it goes on building with the old settings and nobody notices; a copied `baseProjectTemplate.gradle` goes on naming the plugin version it was copied with. Tools that edit templates meet the same drift: [[EDM4U]], the dependency manager many SDKs for Unity rely on, changed in two releases in 2025 how it writes the plugin's `packaging` block, according to the plugin version it finds. Keep custom templates few, write down the edits each one carries, and after each Unity upgrade copy the template again from the new version and reapply those edits.

The second is `AndroidProjectFilesModifier`, which makes the same kinds of change from C#. A subclass in an Editor assembly overrides two methods. `Setup` runs first: it gathers what the change needs from the Unity project, hands it on with `SetData`, and declares the files the modifier will produce. `OnModifyAndroidProjectFiles` then receives the project's files as objects, such as a manifest to which it adds a permission or a receiver, and works from the data `Setup` handed it. Because a modifier declares what it produces, it fits Unity's incremental build, and that is the reason Unity's own Mobile Notifications package gave for moving to it in Unity 6. The package also keeps its manifest entries out of Unity's manifest: it writes them into a library module of its own, `unityLibrary/mobilenotifications.androidlib`, which the manifest merger then combines like any other library.

The third and oldest is the `IPostGenerateGradleAndroidProject` callback. Unity calls its `OnPostGenerateGradleAndroidProject(string path)` once the project is written, and the callback edits files on disk. It can change anything, and nothing checks what it did. A callback that finds its place by searching for a line of Unity's template stops finding it when an upgrade changes that line, often without an error, and its change quietly leaves the build.

The tools under the project are chosen together. Unity 6.3 installs Gradle 8.13, OpenJDK 17, the Android SDK and NDK r27c with its Android module, and the root build file of its project names Android Gradle Plugin 8.10.0 on a line of the form `id 'com.android.application' version '8.10.0' apply false`. [Android's release notes for that plugin](https://developer.android.com/build/releases/agp-8-10-0-release-notes), as read in September 2026, require Gradle 8.11.1 or later, JDK 17 and SDK Build Tools 35.0.0, and support API levels up to 36. Changing one of these alone is a common way to break a build that worked, and SDKs push on the same chain. A library can [record in its AAR](https://developer.android.com/reference/tools/gradle-api/8.10/com/android/build/api/dsl/AarMetadata) the lowest plugin version and the lowest compile SDK it needs, and the plugin fails the build with a message that says so when the project falls short. An SDK update that needs a newer Android Gradle Plugin than the Unity version ships leaves two sound choices: a Unity version whose project has that plugin, or an SDK version that does not need it. Raising the version in a custom base template also gets past the error, and it runs Unity's project on a plugin version Unity did not test it with.

When Gradle fails, its own output is the first evidence. An exported project is a good place to read it: run the failing task there with `--stacktrace`, try a fix in seconds, and then move the fix back into the Unity project through one of the three mechanisms.

Lab exercise: Export the Gradle project of a Unity project you know, and build `:launcher:bundleRelease` from its folder with the Gradle version the Editor installs. List what each module holds, and find the line that names the Android Gradle Plugin's version. Then change one Player Setting, such as the version code, export again into a second folder, and diff the two exports to see which files Unity wrote differently.

?? gradle-modules A plugin's AAR sits in `Assets/Plugins/Android`. Which module of the generated Gradle project does it end up in?
* `unityLibrary`, the library module that holds the game and its plugins
- `launcher`, since the application module packages the app's dependencies
- A module of its own, which Unity generates for each AAR it imports
- The root project, whose build file shares it with both modules
- `unityLibrary` for its classes and `launcher` for its manifest entries
> Unity puts the game and what it depends on in `unityLibrary`, plugins included, and `launcher` reaches them through its dependency on that module. The AAR's manifest is still merged into the app's manifest when `launcher` is built, because a library's manifest travels with the library.

?+ Which module holds the application id, the version code and the signing configuration?
* `launcher`, the application module that makes the game an installable app
- `unityLibrary`, since Unity writes Player Settings into that module
- The root project, which passes them down to both modules as properties
- `unityLibrary` for the id and version, and `launcher` for the signing
- Neither, since Unity stamps them onto the APK after Gradle builds it
> The identity, version and signature belong to the app that gets installed, which in Unity's project is `launcher`. `unityLibrary` is a library, the part a host app would embed, so it carries none of them.

?+ A team embeds its Unity game in an existing Android app with Unity as a Library. What does the host app take from the exported project?
* `unityLibrary`, with the host app taking the place that `launcher` held
- `launcher`, which starts the game, with `unityLibrary` as a template
- Both modules, since Unity's activity is declared in `launcher`
- The exported APK, added to the host app as a local dependency
- The root build file, which the host app applies to its own modules
> The split exists for this case. `unityLibrary` holds the engine, the game's content and its plugins, and `launcher` is a thin app that runs it, so a host app includes `unityLibrary` and plays the part `launcher` played.

?? gradle-customization After a Unity upgrade, the Android build fails on a line of `mainTemplate.gradle` that nobody on the team changed. What is the likely cause?
* The custom template is still the copy made from the old Unity version's template
- The upgrade merged Unity's new template into the copy and left a conflict
- Gradle's cache kept the old template, which a clean build would replace
- The upgrade turned the custom template off, so Unity reads its default one
- The line reads a Player Setting that the upgrade reset to its default value
> A custom template is a copy of Unity's template from the version that made it. Unity fills in its placeholders and leaves the rest alone, so when the new version's project needs different text, the old copy fails or keeps old settings. Copy the template again from the new version and reapply the team's recorded edits.

?+ What does an `AndroidProjectFilesModifier` offer that an `IPostGenerateGradleAndroidProject` callback does not?
* Declared outputs and typed files, which the incremental build tracks
- A chance to change the project before Unity writes any of its files
- Access to the Gradle daemon, so the change applies while Gradle builds
- Edits written back into the Unity project's templates after each build
- Permission to change `launcher`, which a callback is not allowed to touch
> A modifier declares in `Setup` what it will produce and changes the project through objects that stand for its files, so Unity's incremental build knows what it made. A post-generate callback edits text on disk after the project is written, and nothing checks or tracks what it did.

?+ A team keeps two custom Gradle templates. What makes the next Unity upgrade cheap for it?
* A record of each edit to Unity's template, to reapply to a fresh copy
- A backup of the Editor's own templates folder from the current version
- The exported Gradle project, to restore over the next export
- A lock on the templates' import settings, so Unity leaves them unchanged
- The Gradle cache from the last good build, reused after the upgrade
> An upgrade does not touch the copies, so their risk is staying old. With the team's edits written down, someone copies each template again from the new version and reapplies exactly those edits, instead of carrying the whole old file forward.

## Manifest merging and the permissions nobody asked for {#gradle-manifest-merge}

An installed app has one manifest, and nobody writes it by hand. The build assembles it from every manifest in the project, with a tool that [Android's documentation](https://developer.android.com/build/manage-manifests) calls the manifest merger. In Unity's project those manifests are, from the highest priority to the lowest:

1. The main manifest of the `launcher` module, the app module.
2. Unity's manifest in `unityLibrary`, the one that declares Unity's activity, which the team can take over as a custom main manifest in `Assets/Plugins/Android/AndroidManifest.xml`.
3. The manifest of each library in the build, in the order of the dependency graph: every AAR and Android Library folder, and every Maven dependency, including those that arrived as dependencies of dependencies.

The build files feed the merge as well. Values that Gradle sets, such as `minSdk`, `targetSdk`, the version and the application id, override whatever a manifest says about them.

The merger works from the lowest priority up. It matches elements by a key, which for most elements is `android:name`, adds an element that has no match, and combines the attributes of two elements that do. Two different values for the same attribute are a conflict, and a conflict fails the build with “Manifest merger failed” and a suggestion, unless the higher-priority manifest says how to resolve it. A few elements follow rules of their own: the attributes of `<manifest>` come from the highest-priority file, intent filters are never matched with each other, so each one is kept, and a library that declares a higher `minSdk` than the app is an error, which the next section returns to.

The higher-priority manifest resolves a conflict with markers from the `tools` namespace, declared as `xmlns:tools="http://schemas.android.com/tools"`:

| Marker | Effect on the merged manifest |
| --- | --- |
| `tools:node="remove"` | Removes the matching element that a lower-priority manifest declares |
| `tools:node="replace"` | Replaces the lower-priority element with this one, whole |
| `tools:replace="android:theme"` | Keeps this manifest's value for the attributes it lists |
| `tools:remove="android:theme"` | Removes the attributes it lists from the merged element |
| `tools:selector="com.example.sdk"` | Limits a marker to the manifest of the library with that package name |

The merger reads the markers of the higher-priority manifest in each pair it merges. A marker in the game's manifest can therefore remove what an SDK declares, and a marker in an SDK's manifest has no say over the game's.

The source manifests say what each author wrote; the merged manifest says what ships. Read it from the build. In an exported project, the merger writes a report to `launcher/build/outputs/logs/manifest-merger-release-report.txt` that lists each element and attribute of the result with the manifest it came from. For a finished app bundle, `bundletool dump manifest --bundle=game.aab` prints the manifest that shipped.

The merged manifest is also where a permission nobody on the team chose appears. An SDK update adds `READ_PHONE_STATE` or a location permission to the manifest in its AAR, the merger adds it to the game's, and the next release carries it to every player's device. Nothing in the build fails, so the change needs a check of its own: a CI step that diffs each build's merged manifest against the last release's shows new permissions, components and exported flags in review, whichever library brought them.

When the game does not need a permission that an SDK declares, the game's manifest removes it. In the custom main manifest, the removal is one element:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.READ_PHONE_STATE"
                     tools:node="remove" />
</manifest>
```

Writing it is easy, and deciding it is the work. The build cannot tell whether the SDK calls an API that the permission protects. If it does, the feature that makes the call fails on a device, in whatever way that SDK handles a missing permission, and no build step reports it. The answer comes from the SDK's documentation for the version in the build, from its vendor, or from exercising the SDK's features on a device with the permission removed. Then the removal is a recorded decision, and the SDK's next update reopens it.

One manifest rule has been a build error [since Android 12](https://developer.android.com/about/versions/12/behavior-changes-12). An app that targets API level 31 or higher must say, with `android:exported`, whether other apps may start each activity, service and receiver that has an intent filter. Without the attribute, the merge fails with a “Manifest merger failed” message that names the rule, and a device running Android 12 or later would refuse to install the app anyway. An older SDK whose AAR declares such a component without the attribute breaks the build on the day the game raises its target. The fix is an update of the SDK. Until one exists, the game's manifest can declare the same component by its name with the `android:exported` value the vendor documents, and the merger combines the two declarations, keeping the SDK's intent filter.

Exercise: Export a release build of a project you know before and after its latest SDK update, and diff the two merged manifests. For each permission, component and exported flag that changed, find the manifest it came from in the merger's report, and decide whether the game needs it.

?? gradle-merge-priority An SDK's AAR sets `android:allowBackup="true"` on `<application>`, and the game's manifest sets it to `false`. What does the manifest merger do?
* It stops with an error until the game adds `tools:replace="android:allowBackup"`
- It keeps `false`, because the app's own manifest wins any conflict it takes part in
- It keeps `true`, because library manifests are merged last and overwrite values
- It keeps whichever value appears in the manifest that Gradle happens to read first
- It drops the attribute from both, so that Android's default value applies to the app
> Two different values for one attribute are a conflict, and the merger stops with “Manifest merger failed” and a suggestion. The higher-priority manifest settles it with a marker: `tools:replace` keeps its own value for the attributes it lists.

?+ An SDK's AAR declares a permission that the team wants gone. Where does `tools:node="remove"` have to be written?
* In one of the game's own manifests, which outrank the SDK's in the merge
- In any manifest in the build, since the merger reads markers from all of them
- In `launcher/build.gradle`, as a packaging option that filters permissions
- In the project's keep rules, which R8 applies to the merged manifest
- In `gradleTemplate.properties`, which the merger reads before it starts
> In each pair of manifests it merges, the merger reads the markers of the higher-priority one. A marker in the game's manifest can remove what a library declares, and a library's markers have no say over the game's elements.

?+ The game's manifest and an SDK's manifest both declare the same activity, each with its own intent filter. What does the merged manifest contain?
* One activity that holds both intent filters
- The game's activity with its own intent filter, since it has priority
- Two activities with the same name, which Android rejects at install
- A merge error, since two intent filters on one activity conflict
- The SDK's activity, since the lower-priority element is kept on a match
> Elements are matched by `android:name`, so the two declarations become one activity with their attributes combined. Intent filters are never matched with each other: each one is kept and added to the merged activity.

?+ [tf] The `minSdk` in the app module's Gradle build file takes precedence over a `minSdkVersion` written in the app's own manifest.
* true
> Gradle injects values such as `minSdk`, `targetSdk`, the version and the application id into the merge, and they override the corresponding attributes in the manifests. Android's documentation recommends setting them in the build files alone, so that nobody reads a manifest value that does not apply.

?? gradle-remove-permission After an SDK update, the merged manifest holds `READ_PHONE_STATE`, which the game never asked for. What should happen before the team removes it?
* Confirming with the SDK's documentation or vendor that no feature in use needs it
- Nothing, since a permission that the team did not declare is safe to remove
- Reverting the update, since removing an SDK's permission ends the vendor's support
- Declaring the permission in the game's manifest too, so the team owns the decision
- Waiting for the store review, which reports whether the build uses the permission
> The build does not know whether the SDK calls an API the permission protects. Removing one it needs moves the failure to a device, in whichever feature makes the call, so the removal waits for evidence that nothing the game uses depends on it.

?+ A team removed an SDK's permission with `tools:node="remove"`, and a feature of that SDK still needs it. When does the mistake show?
* On a device, when the feature calls an API the permission protects
- At build time, when the merger checks the SDK's code against its permissions
- At install time, when Android compares the manifest with the SDK's classes
- At upload, when the store matches permissions against the SDKs it detects
- At the next SDK update, when the vendor's manifest restores the permission
> Nothing in the build links a permission to the code that needs it. The SDK meets the gap when it calls the protected API on a device, and the result depends on how that SDK handles a missing permission, from an error to a feature that quietly does less.

?+ Which file shows the permissions that a release build ships?
* The merged manifest of that build, from its output or the merger's report
- `Assets/Plugins/Android/AndroidManifest.xml`, the custom main manifest
- `launcher/src/main/AndroidManifest.xml` in the exported project
- The manifest in each AAR, whose permissions Gradle copies unchanged
- The Player Settings asset, from which Unity writes the final manifest at build time
> Each source manifest shows what one author wrote. The merged manifest shows what ships, after every library's entries and every marker have been applied, and the merger's report names the source of each line.

?+ How can a team find out that an SDK update added a permission before players see it?
* Diff each build's merged manifest against the last release's in CI
- Read the SDK's changelog, which lists each manifest change it makes
- Search the game's C# for calls to APIs that the permission protects
- Compare the size of the new AAR with the size of the old one
- Check Player Settings for entries that appeared after the import
> The merged manifest is the one place where every library's contribution appears, so a diff of it per build catches new permissions, components and exported flags wherever they came from. A changelog helps when it is complete, and the diff does not depend on that.

## Dependencies, conflicts, and resolution {#gradle-dependencies}

A library published to a Maven repository is named by its [[Maven coordinates]], `group:artifact:version`, and arrives with a POM that lists the libraries it needs. Gradle downloads the whole tree, the libraries the project declares and the ones they depend on, so declaring two SDKs can add dozens of libraries to a build. In Unity's project, dependencies are declared in `unityLibrary/build.gradle`, written from the main template or by a tool that edits it, and since Unity 2022.2 the repositories they come from are declared once, for the whole build, in `settings.gradle`. An SDK that needs a repository of its own adds it there.

Two tasks read the graph that Gradle resolved. Both take the configuration to resolve, which for the release build of the app is `releaseRuntimeClasspath`:

```bash
gradle :launcher:dependencies --configuration releaseRuntimeClasspath
gradle :launcher:dependencyInsight --dependency netcore --configuration releaseRuntimeClasspath
```

In a project where an analytics SDK depends on `netcore` 1.2.0 and an ads SDK depends on `netcore` 2.0.0, Gradle 8.13 prints the tree with the version it chose after the arrow, and the insight says why, abridged here:

```text
+--- com.example.sdk:analytics:3.1.0
|    \--- com.example.lib:netcore:1.2.0 -> 2.0.0
\--- com.example.sdk:ads:5.0.0
     \--- com.example.lib:netcore:2.0.0

com.example.lib:netcore:2.0.0
   Selection reasons:
      - By conflict resolution: between versions 2.0.0 and 1.2.0
```

A build holds one version of each library, because a class name means one class at run time. When two paths through the graph ask for different versions, Gradle picks one for all of them, by default the highest version requested. The analytics SDK was compiled against 1.2.0 and now runs against 2.0.0. Nothing compiles it again, so the build succeeds, clean or not. If 2.0.0 renamed or removed a method that the SDK calls, the call fails when it runs, with `NoSuchMethodError`, on a device, in whichever code path makes that call, which may be a feature the release checklist never opens. A resolution strategy with `failOnVersionConflict()` turns every conflict into a build failure that names the module and both versions, which suits an audit of the graph better than a permanent setting in a game with twenty SDKs.

Gradle can settle a conflict between versions of one module. It cannot settle two copies of the same classes that it takes for two different modules. The usual source is a copy: an AAR or JAR dropped into `Assets/Plugins/Android` enters the build as a file with no coordinates, and when the same library also arrives from Maven, as the dependency of another SDK, both copies reach the step that converts classes into DEX, the case that [Android's guide to dependency errors](https://developer.android.com/build/dependency-resolution-errors) describes as a local and a remote binary dependency on the same library. The build fails with an error that names the class and both artifacts; D8, the tool that converts them, words it as a type “defined multiple times”. The fix is one copy. Delete the file and keep the Maven dependency, whose POM lets Gradle resolve it against the rest of the graph.

A dependency can also refuse the game's minimum Android version. A library whose manifest declares a higher `minSdk` than the app's fails the manifest merge. Raising the game's minimum removes the older devices from the store. An older version of the SDK keeps them. `tools:overrideLibrary`, a marker on the game's `<uses-sdk>`, lets the build through and leaves the library running on devices below the minimum it was built for, where it can fail.

Of Gradle's tools for steering resolution by hand, four come up in SDK conflicts, and in Unity's project they go in the templates or in a modifier:

| Tool | What it does | What it decides |
| --- | --- | --- |
| A constraint | Joins resolution as a requested version, with the reason recorded | That every path to the library gets at least that version |
| `strictly` | Rejects any other version, and can lower a version a dependency asked for | Which SDK runs against a version it was not built for |
| An exclusion | Removes a transitive dependency from one path | Whether the SDK finds its classes at run time; if not, `NoClassDefFoundError` |
| Dependency locking | Records the resolved versions in `gradle.lockfile` and fails when one moves | That version changes arrive as a diff someone reviews |

The first three are compatibility decisions made on someone else's behalf. `strictly` on the lower version chooses which SDK breaks, and an exclusion bets that the SDK never loads what was excluded. Before using one, read the release notes of the versions involved, and afterwards test a release build on a device through the features of both SDKs.

Many SDKs for Unity never ask the team to edit Gradle files. They ship an XML file named like `*Dependencies.xml` in an Editor folder, and [[EDM4U]], Google's External Dependency Manager for Unity, turns those files into Android dependencies with its Android Resolver. The resolver works in one of two modes. By default it runs Gradle itself, resolves the combined graph and copies the resulting AARs and JARs into `Assets/Plugins/Android`. With its Patch mainTemplate.gradle setting on, which needs a custom main Gradle template, it writes the dependencies into the template between `// Android Resolver Dependencies Start` and `// Android Resolver Dependencies End`, and the build resolves them. The second mode keeps the POMs in play, so the build's own resolution and `dependencyInsight` see everything. Mixing the two duplicates classes: AARs that an earlier resolution copied into `Assets/Plugins/Android` stay there after the template starts declaring the same libraries. The resolver's Delete Resolved Libraries command removes the copies it made, and one mode per project keeps them from coming back.

Sometimes no single version satisfies two SDKs, because one needs an API that the other's version removed. Try the options in this order. Update the SDK that lags, since its newer releases often move to the newer library. Look for one version that both accept, and prove it with a release build on a device. Ask both vendors, with the `dependencyInsight` output that shows the conflict. Drop one of the SDKs. Repackaging one SDK's copy of the library under another package name comes last: it creates a private fork that the team carries through every update of that SDK, and it breaks wherever the library's classes are found by name, in reflection, in keep rules and through JNI.

Lab exercise: Export a Unity project that uses at least two SDKs, print the release runtime graph of `launcher` with `dependencies`, and find a library requested at two versions. Explain the winner with `dependencyInsight`, then check whether the SDK that asked for the lower version has a release built against the higher one.

?? gradle-highest-version An analytics SDK depends on `netcore` 1.2.0 and an ads SDK on `netcore` 2.0.0. Which `netcore` does the game ship with?
* 2.0.0, for both SDKs, since Gradle picks the highest version requested
- Both, since each SDK loads the copy of the library it was compiled against
- 1.2.0, since the dependency that is declared first takes precedence
- 2.0.0 for ads and 1.2.0 for analytics, packaged in separate DEX files
- Neither, since Gradle stops the build until someone picks a version
> A build holds one version of each library. By default Gradle considers each version requested anywhere in the graph and picks the highest for all of them, so the analytics SDK runs against a version it was not compiled with.

?+ A debug build with minify off succeeds after the ads SDK is added, and the analytics SDK then throws `NoSuchMethodError` on a device. What happened?
* Gradle raised a library the SDK calls to a version without that method
- The analytics SDK was compiled against a newer Android API than the device has
- R8 renamed the method, since the analytics SDK reaches it through reflection
- Two copies of the library were packaged, and the device loaded the older one
- The build cache kept a stale class file, which a clean build would replace
> The SDK arrives as bytecode compiled against the older version and is not compiled again, so the build has nothing to reject. Conflict resolution moved the shared library up to the version the ads SDK wanted, and the first call to a method that version removed fails at run time.

?+ Which command explains why `netcore` resolved to 2.0.0 in the release build?
* `dependencyInsight` for `netcore` on the release runtime classpath
- `dependencies` with `--refresh-dependencies`, which lists fresh versions
- `assembleRelease` with `--info`, which logs each download as it happens
- `bundletool dump manifest`, which prints the libraries a bundle holds
- `androidDependencies`, which prints the reason beside each library
> `dependencyInsight` shows, for one module, the version chosen, which paths asked for which versions, and the reason, such as conflict resolution between 2.0.0 and 1.2.0. The `dependencies` report shows the tree and its arrows, without the reasons.

?+ [tf] A clean build would have reported the `netcore` version conflict as a compile error.
* false
> Nothing is compiled against the new version: the analytics SDK arrives as bytecode built against the old one. The build succeeds, clean or not, and the mismatch surfaces when the removed method is called on a device.

?? gradle-duplicate-class The release build fails because `com.example.netcore.Client` is defined in a JAR copied into `Assets/Plugins/Android` and in `netcore-2.0.0.jar` from Maven. What fixes it?
* Deleting the copy and keeping the Maven dependency, so one version is resolved
- Replacing the copy with 2.0.0, so both artifacts hold the same version
- Turning on minify, so R8 removes whichever copy nothing references
- Adding a keep rule for the class, so the packager accepts one of the copies
- Renaming the copied JAR, so the two files no longer share a name
> Gradle resolves versions of one module, and a copied file has no coordinates, so to Gradle the two copies are different modules and both reach DEX. Removing the copy leaves one artifact with a POM, which Gradle resolves against the rest of the graph.

?+ Why can Gradle's conflict resolution not choose between an AAR copied into `Assets` and the same library from Maven?
* The copy has no coordinates, so Gradle sees two different modules
- Resolution applies to declared dependencies, and the copy is transitive
- Local files are resolved after Maven ones, too late to take part
- The copy's manifest is merged before resolution starts, which fixes it
- Gradle compares versions by file name, and the copy's name has none
> Resolution picks one version per module, and a module is identified by its group and artifact. A file dropped into the project carries neither, so Gradle keeps both, and the classes collide when the build converts them to DEX.

?+ EDM4U once copied SDK libraries into `Assets/Plugins/Android`, and the team has now turned on Patch mainTemplate.gradle. What goes wrong?
* The same libraries arrive twice, as the old copies and through the template
- EDM4U replaces the custom template with Unity's default one on each resolution
- Gradle ignores the template while AARs are present in the Plugins folder
- The resolver stops reading `*Dependencies.xml` files once the template is patched
- Unity refuses to build when a template and plugins share one folder
> In template mode the resolver writes dependencies into `mainTemplate.gradle`, and the copies that an earlier resolution left in `Assets/Plugins/Android` are still there, so the same classes come from both. Deleting the resolved libraries and keeping one mode avoids it.

?? gradle-incompatible-sdks Two SDKs need versions of a shared library that no single version satisfies. What should the team try first?
* An update of the SDK that lags, whose newer releases may accept the newer library
- `strictly` on the older version, so the build keeps the version it had before
- Repackaging one SDK's copy of the library under a different package name
- An exclusion on one SDK, so that each SDK resolves the library separately
- A separate Gradle module for each SDK, so that each module resolves its own version
> The cheapest fix removes the conflict at its source: vendors update their dependencies, and a newer release of the lagging SDK often accepts the newer library. Pinning, excluding and repackaging each choose which SDK runs against code it was not built for.

?+ The team pins the shared library to the older version with `strictly`. What has it decided?
* That the SDK wanting the newer version runs against the older one
- That Gradle packages both versions and gives each SDK the one it asked for
- That the conflict is settled, since strict versions are checked at build time
- That the newer SDK falls back to the copy of the library it bundles
- That the build fails until the newer SDK is removed from the project
> `strictly` rejects any other version and can lower one that a dependency asked for, so the SDK that wanted the newer version now runs against the older one. The build succeeds, and whether that SDK works is a question for a device test of its features.

?+ Why is repackaging one SDK's copy of the library the last resort?
* It makes a private fork, and it breaks where classes are found by name
- It needs the vendor's source code, which vendors do not publish
- It doubles the app's size, since each SDK ships a full library copy
- It turns R8 off for the renamed classes, slowing the release build
- It hides the conflict from Gradle, which then fails the build later
> A relocated copy is a fork that the team carries through every update of that SDK, and it breaks wherever the library is reached by name: reflection, keep rules, JNI. Updating, finding a shared version, asking the vendors or dropping an SDK leave no such fork behind.

## R8, keep rules, and symbol files {#gradle-r8-symbols}

With minify on, a release build runs [[R8]] over the whole app: the game's plugins, the SDKs and Unity's own Java code. [R8 shrinks](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization), removing the classes and members that nothing reachable uses, starting from entry points such as the activities and services in the manifest. It optimizes, inlining small methods and merging classes. And it obfuscates, renaming what it keeps to short names such as `a.a`, which makes the DEX smaller. Unity turns it on per build type in Publishing Settings, and a build script sets the same switches as `PlayerSettings.Android.minifyRelease` and `minifyDebug`. R8 runs when the app module is built, and each library adds its own rules to that run.

R8 follows references in bytecode, and [Android's page on keep rules](https://developer.android.com/topic/performance/app-optimization/keep-rules-overview) names what it misses: code reached by reflection, and code called through JNI. R8 does not read the strings in C# that the bridge uses to reach Java: `new AndroidJavaClass("com.example.game.StoreBridge")` followed by `CallStatic("startPurchase", ...)` looks the class and the method up by name at run time, through [[JNI]], as [[#android-java-calls]] showed. To R8, a class that only C# uses is unreachable, so it is removed, and a class kept for another reason can still be renamed. The failure appears in minified builds alone, usually the release builds, as an `AndroidJavaException` that carries Java's error for a missing class or method.

A test of R8 8.10.21 on a small bridge shows how far the damage goes. The bridge has a class that C# calls and an interface that C# implements with an `AndroidJavaProxy`:

```java
package com.example.game;

// Implemented in C# by an AndroidJavaProxy; nothing in Java implements it.
public interface PurchaseListener {
    void onPurchased(String productId);
    void onFailed(String productId, int code);
}
```

```java
package com.example.game;

// Called from C# by name through AndroidJavaClass; nothing in Java calls it.
public final class StoreBridge {
    private StoreBridge() {}

    public static void startPurchase(String productId, PurchaseListener listener) {
        ReceiptFormatter formatter = new ReceiptFormatter();
        if (productId.isEmpty()) {
            listener.onFailed(productId, 400);
        } else {
            listener.onPurchased(formatter.format(productId));
        }
    }
}
```

`ReceiptFormatter` is a small helper in the same package. With no keep rule, R8 removed all three classes. With a rule for `StoreBridge` alone, it kept that class under its name and renamed what it touches, as the mapping file it wrote records, abridged here:

```text
com.example.game.PurchaseListener -> a.a:
    void onFailed(java.lang.String,int) -> a
    void onPurchased(java.lang.String) -> b
com.example.game.StoreBridge -> com.example.game.StoreBridge:
```

R8 even dropped the parameters of the two renamed methods, since nothing in Java implements the interface, and the kept method now takes an `a.a` where C# passes a `PurchaseListener`. Unity creates the proxy by looking the interface up by its original name, which no longer exists, and it dispatches each call on the proxy to the C# method with the same name as the Java method, which is now `a` or `b`. A keep rule has to cover what C# names on both sides of the boundary:

```text
# Called from C# by name.
-keep class com.example.game.StoreBridge { public static *; }
# Implemented in C# with AndroidJavaProxy: keep the interface and its method names.
-keep interface com.example.game.PurchaseListener { *; }
```

Rules belong with the code they protect. A plugin built as an Android Library folder lists its rules as consumer rules in its own `build.gradle`, and an AAR carries them in its `proguard.txt`; either way, each game that includes the plugin applies them, whoever turns minify on. Unity's Mobile Notifications package does exactly this, with rules for the classes that C# calls and for the interface that C# implements, and a release of it in 2025 added a rule it had missed. Rules that belong to the game rather than to a plugin go in a project-wide file, `Assets/Plugins/Android/proguard-user.txt`, which Publishing Settings can create. Keep all of them narrow: a rule for the members C# names leaves R8 free to shrink the rest, and a rule for a whole package does not. And catch the failure where it happens, by turning on minify for development builds too or by running the device smoke test from [[#platform-testing]] on a release-configured build.

Obfuscation renames the frames of Java stack traces, and the mapping file is the way back. R8 writes one for each build, at `launcher/build/outputs/mapping/release/mapping.txt` in an exported project, and [`retrace`](https://developer.android.com/tools/retrace), from the Android SDK's command-line tools, applies it:

```bash
retrace mapping.txt stacktrace.txt
```

In the same test, R8 inlined `ReceiptFormatter.format` into `startPurchase`, so an exception thrown in the helper is reported from `startPurchase` alone. Given the frame `at com.example.game.StoreBridge.startPurchase(SourceFile:3)`, retrace printed both methods:

```text
at com.example.game.ReceiptFormatter.format(ReceiptFormatter.java:5)
at com.example.game.StoreBridge.startPurchase(StoreBridge.java:12)
```

A mapping file fits one build. R8 decides names, inlining and line numbers for each build, so another build's file still retraces, without any warning, into names and lines that are wrong. Retraced with the mapping of the next build of the test bridge, in which one call had been added, the same frame came back as a single frame, `startPurchase` at line 10, with the helper gone and no warning. The header of each file carries a `pg_map_id` that identifies it. Keep the mapping of every release build with its artifacts, since the next build overwrites the file. An app bundle [carries it to Google Play](https://developer.android.com/topic/performance/app-optimization/troubleshoot-the-optimization), which then shows readable Java stack traces, and any other crash reporter needs it uploaded.

Native code has the same problem with a different key. [[#android-failure-evidence]] showed how native frames are symbolicated with the symbols of the build that crashed, and where Unity writes them. The Android Gradle Plugin can also [put native symbols into an app bundle](https://developer.android.com/build/include-native-symbols), at one of two levels: a symbol table, which gives function names, or full debug information, which adds files and line numbers. Either way, a build's mapping file and native symbols are kept together, with the build, for as long as that build is installed anywhere.

[[Managed code stripping]] is the same problem on the C# side, with a different tool. Unity's linker removes C# that nothing references statically, so a C# member that only native code or reflection reaches looks unused to it, as a Java method that only C# reaches looks unused to R8. `link.xml` and `[Preserve]`, which the first book's chapter on testing and debugging covers, keep it. A release build with a bridge in it needs rules for both strippers.

Lab exercise: In a Unity project with a Java bridge, turn on minify for development builds, call the bridge from C# on a device, and read the exception. Fix it with consumer rules in the bridge's own library folder, then throw an exception inside the bridge and retrace the stack trace with that build's mapping file, and once more with the next build's.

?? gradle-r8-reflection A release build throws an `AndroidJavaException` saying that the class `com.example.game.StoreBridge` was not found, and the development build works. What is the likely cause?
* R8 removed or renamed the class, since C# reaches it by name alone
- Managed code stripping removed the C# wrapper that loads the class
- IL2CPP compiled the call with a mangled name that Java does not recognize
- The class sits in a plugin folder that release builds leave out
- Release builds load plugin classes on a thread without a class loader
> R8 follows references in bytecode, and a class named in a C# string has none. With minify on, R8 removes it if nothing in Java uses it and renames it if something does, and the lookup by name fails on the device. A keep rule for what C# names fixes it.

?+ The team keeps `StoreBridge` with a rule, and C# now fails to create the `AndroidJavaProxy` for `PurchaseListener`, an interface the bridge takes. Why?
* R8 renamed the interface, which the rule for the class did not keep
- The proxy needs a Java class that implements the interface, and R8 removed it
- Keeping a class stops R8 from keeping the types its methods mention
- The rule kept the class's name and removed its public static methods
- AndroidJavaProxy is disabled in minified builds, which strip reflection
> A rule keeps what it names. R8 renamed the listener interface and rewrote the kept method to take the new name, and Unity creates a proxy by looking the interface up by its original name. The interface needs a rule of its own, with its method names, since Unity dispatches each call on the proxy by name.

?+ [multi n=6] Which Java code in a Unity plugin needs a keep rule when minify is on?
* Classes and methods that C# calls by name through `AndroidJavaObject`
* Interfaces C# implements with `AndroidJavaProxy`, and their method names
* Methods that native code looks up and calls through JNI by their names
- Classes that the plugin's other Java classes call directly through imports
- Activities and services that the merged manifest declares for the plugin
- Private helper methods that the kept public methods of the bridge call
> R8 follows references in bytecode and in the manifest, so what it misses is code reached by name: from C# through JNI, from native code through JNI, and through a proxy that Unity creates for an interface. Code that Java calls directly, and components the manifest declares, are already reachable.

?+ Where should a plugin's keep rules live?
* With the plugin, as consumer rules in its library folder or its AAR
- In the game's `link.xml`, which Unity passes on to R8 with its own rules
- In the exported `launcher/build.gradle`, edited again after each export
- In an attribute on the calling C# code, which Unity turns into a rule
- In the Gradle properties template, which applies them to each module
> Consumer rules travel with the library, so each app that includes the plugin applies them when it shrinks, whoever turns minify on. `link.xml` and `[Preserve]` serve Unity's C# linker, and an edit to an exported project is gone at the next export.

?? gradle-mapping-file A crash report from a release build shows frames such as `at a.a.a(SourceFile:3)`. What turns them back into names?
* The `mapping.txt` that R8 wrote during that same build, applied with `retrace`
- The symbols zip that Unity wrote beside the build, applied with `ndk-stack`
- The mapping file of the latest build, since a version shares one mapping
- The Java sources, built again with minify off to see where the line falls
- A stack trace of the same crash from a development build, which keeps names
> Obfuscated Java frames map back through the mapping file of the build that produced them, and `retrace` applies it. Native symbols serve native frames, and a build without minify differs in names, inlining and line numbers.

?+ Why keep a mapping file for each release build, rather than one per version name?
* Names and lines differ per build, and a wrong file misleads quietly
- R8 refuses a mapping file whose version name differs from the build's
- Google Play deletes uploaded mapping files when a newer version arrives
- A mapping file covers the classes that changed since the previous build
- Keeping one file per version name invalidates the app bundle's signature
> R8 decides names, inlining and line numbers for each build, so a mapping file matches the build that wrote it. Another build's file still retraces without an error, into plausible names and lines that are wrong, which is worse than a failure.

?+ A team uploads app bundles to Google Play and also uses a third-party crash reporter. Where does each release's mapping file have to go?
* To the crash reporter and the build archive, since the bundle takes it to Play
- Nowhere, since R8 keeps the original names inside the release DEX
- To Play by hand as well, since app bundles leave the mapping file out
- Into the Unity project's Plugins folder, so the next build reuses the names
- Onto the store listing, where players' crash reports are decoded
> An app bundle carries its mapping file to Google Play, which uses it for its own crash reports. Any other tool needs the file uploaded, and the team's archive needs a copy, because the next build overwrites it.

## APK, AAB, and the Play signing key {#gradle-packaging-signing}

An APK is the file Android installs. It holds the merged manifest, the DEX files, the resources, the native libraries for the ABIs the build includes, the game's assets, and a signature. An [[AAB|app bundle]] is a [publishing format](https://developer.android.com/guide/app-bundle). It holds the same code and resources for every device configuration, it cannot be installed, and it exists to be uploaded: Google Play generates APKs from it for each device and signs them. A phone downloads a base APK and the configuration APKs that fit it, such as the one with the native libraries of its ABI, so a Unity game built for two ABIs delivers one set of native libraries to each phone. Google Play has required app bundles for new apps since August 2021. In Unity, a build setting chooses between the two outputs, `EditorUserBuildSettings.buildAppBundle` from a script.

Split APKs change how a build is shared. Copying `base.apk` from one phone to another no longer works: Android's documentation says that an install missing its required splits fails on Android 10 and later. [[bundletool]], the tool that the Android Gradle Plugin and Google Play use to build app bundles, [reproduces Play's step](https://developer.android.com/tools/bundletool) on a computer:

```bash
# All the APKs Play could generate, signed with the upload key.
bundletool build-apks --bundle=game.aab --output=game.apks \
    --ks=upload.keystore --ks-key-alias=upload
# The splits that fit the connected phone, installed together.
bundletool install-apks --apks=game.apks
# One APK with every split merged in, for sharing.
bundletool build-apks --bundle=game.aab --output=universal.apks --mode=universal
```

The APKs it makes are signed with the keystore it is given, or with the debug key when it is given none. They reproduce Play's splits and leave out Play's signature.

Android installs an update only when it is signed with the same key as the installed app, so the key is part of the app's identity, much like the package name. Three kinds of key meet in a Unity project:

| Key | Who holds it | What it signs |
| --- | --- | --- |
| Debug key | Each developer's machine, where the Android tools create it | Development builds; Google Play does not accept an app signed with it |
| Upload key | The team, in the keystore that Player Settings points to | The app bundles uploaded to Google Play |
| App signing key | Google Play, under Play App Signing | The APKs that players install from Google Play |

When a custom keystore is set, Unity signs release builds with the keystore and alias in Player Settings, `PlayerSettings.Android.keystoreName` and `keyaliasName` from a script, and with Play App Signing that key is the upload key. [Play App Signing](https://developer.android.com/studio/publish/app-signing) has been required for new apps on Google Play since August 2021, and when Google generates the app signing key, the team never holds the key that signs what players install. The team signs each upload with its upload key; Google checks the signature against the upload certificate it registered, and signs the APKs it generates with the app signing key, which it does not release. Losing the upload key costs an upload key reset, requested in the Play Console, after which updates continue. An older app that manages its own signing key has no such remedy: losing that key ends its updates, and a new key means a new app under a new package name.

The certificate on players' phones is therefore the app signing key's, and anything that recognizes the game by its certificate has to be given that certificate's fingerprint:

- the [OAuth client that platform sign-in checks](https://developer.android.com/games/pgs/console/setup), whose Android entry names the package and a SHA-1 fingerprint;
- the [`assetlinks.json` file](https://developer.android.com/training/app-links/configure-assetlinks) that verifies the game's https links, which chapter 4 describes;
- any other service that registers the game by its package and certificate, as that service's documentation says.

Each of them can accept more than one certificate, as several fingerprints or as one entry per certificate, so the debug, upload and app signing certificates can all be registered, and the Play Console's app signing page lists the fingerprints of the last two. Leaving out the app signing key's fingerprint breaks sign-in in a way that is easy to misread: it works on each build the team installs from CI, signed with the upload key, and fails for each player, whose copy Google signed. To see which certificate a phone really has, pull the installed APK and print it with [`apksigner`](https://developer.android.com/tools/apksigner):

```bash
adb shell pm path com.example.game
adb pull /data/app/.../base.apk          # the path that pm printed
apksigner verify --print-certs base.apk
```

The last part of a build's identity is three [API levels](https://developer.android.com/build), and they are easy to confuse:

| Setting | What it decides |
| --- | --- |
| `minSdk` | The oldest Android version that can install the game; Google Play also hides the game from older devices |
| `targetSdk` | Which Android versions' behavior changes the game has adopted; on newer versions, Android keeps older behavior for it where it can |
| `compileSdk` | Which Android APIs the Java code can reference when it compiles; it changes nothing at run time |

In Unity, `PlayerSettings.Android.minSdkVersion` and `targetSdkVersion` set the first two, and Unity 6.3 supports API level 25 and later as the minimum. Raising the target is not a compile-time change. It opts the game into the behavior changes of each level up to the new one, on devices that run those versions: targeting API level 31 made `android:exported` compulsory, as [[#gradle-manifest-merge]] showed, and targeting 23 made dangerous permissions something the player grants at run time, which chapter 4 covers. The work of raising it is a device test on the new Android version, with the behavior changes of each level crossed. [Google Play moves the required target up](https://developer.android.com/google/play/requirements/target-sdk) each year. As read in September 2026, new apps and updates had to target API level 36 from August 31, 2026, and existing apps that target API level 34 or lower were offered to new users only on devices running Android 14 or older.

Unity's target level can also be left at `AndroidApiLevelAuto`, which means the highest SDK platform installed on the machine that builds. Two machines with different SDKs then build the same commit with different targets, and so with different behavior on newer phones. Set the level explicitly, and raise it on purpose.

Exercise: List every place your project has registered a signing certificate: sign-in clients, `assetlinks.json`, and any SDK or service dashboard that asked for a fingerprint. For each one, check that it includes the fingerprint of the app signing key from the Play Console, and note which feature would fail first if it did not.

?? gradle-play-signing Sign-in works on builds the team installs from CI and fails for players who installed the game from Google Play. What is the likely cause?
* The sign-in client knows the upload key's fingerprint and not the app signing key's
- Google Play runs R8 again on each uploaded bundle, removing the sign-in classes
- Play delivers split APKs, and the sign-in SDK reads resources from the base APK
- The Play build uses the package name of the internal track, which is different
- Players' phones block sign-in for apps whose certificate the store has replaced
> With Play App Signing, Google signs the APKs that players install with the app signing key, while CI builds carry the upload key. A sign-in client that registered one certificate recognizes those builds and rejects Play's, and registering the app signing key's fingerprint fixes it.

?+ With Play App Signing, which key signs the APKs that players download from Google Play?
* The app signing key, which Google holds and does not release
- The upload key, which signed the bundle the team uploaded
- A key Google generates for each release and then discards
- The debug key of the machine that built the uploaded bundle
- Both keys, with the upload key added as a second signer
> Google verifies an upload with the upload certificate and then signs the APKs it generates with the app signing key. That key does not leave Google, so its fingerprint comes from the Play Console's app signing page.

?+ The upload keystore is lost. What does that cost a game that uses Play App Signing?
* An upload key reset in the Play Console, after which updates continue
- A new store listing under a new package name, since updates need that key
- Nothing, since Google keeps a copy of the upload key for recovery
- A new signing certificate on players' phones at the next update
- A reinstall for all players, since the app's signature changes
> The upload key identifies the team's uploads, and players' copies carry the app signing key, which Google holds. A lost or compromised upload key is replaced through an upload key reset, and the game keeps updating as before.

?+ [multi n=6] Which of these must include the app signing key's fingerprint for the Play-installed game to work?
* The OAuth client that platform sign-in checks for the game's package
* The `assetlinks.json` that verifies the game's https links
- The upload keystore that Player Settings points to for release builds
- The version code that the `launcher` module's build file sets
- The mapping file that R8 writes for each release build
- The debug keystore that the Android tools create on the build machine
> Anything that recognizes the game by its certificate needs the certificate on players' phones, which under Play App Signing belongs to the app signing key. The keystores the team holds sign uploads and development builds, and version codes and mapping files have nothing to do with certificates.

?? gradle-target-sdk The game raises `targetSdkVersion` by one level, and the project compiles cleanly. What is left to do?
* Test on devices running that Android version, whose new behaviors now apply
- Nothing more, as the target level decides which APIs the code can reference
- Raise `minSdkVersion` to the same level, since Android requires them to match
- Sign with a new key, since a new target level counts as a new app
- Lower `compileSdkVersion` below the target, to keep the older APIs available
> The target level opts the game into the behavior changes of each Android version up to it, on devices that run those versions. Compiling says nothing about behavior, so the check is a device test on the new version against its list of changes.

?+ Which setting decides the oldest Android version that can install the game?
* The minimum level, `minSdkVersion`
- The target level, `targetSdkVersion`
- The compile level, `compileSdkVersion`
- The NDK version that compiled the native libraries
- The Android Gradle Plugin version in the root build file
> Android refuses to install an app on a device whose API level is below `minSdkVersion`, and Google Play hides the app from those devices. The target level changes behavior, and the compile level changes which APIs the code can see.

?+ The target API level is left at `AndroidApiLevelAuto`, and the CI machine has a newer SDK platform than the developers' machines. What follows?
* CI builds target a higher level, and behave in ways local builds do not
- The CI build fails, since the automatic setting needs one fixed platform
- Gradle downloads the developers' platform, so that the machines match
- Nothing, since Android reads the target level from the device at run time
- Google Play rejects the CI build for targeting an unreleased API level
> The automatic setting means the highest SDK platform installed on the machine that builds. Two machines then produce different targets from one commit, with different behavior on newer phones, which is why the target is set explicitly and raised on purpose.

?+ What does `compileSdkVersion` decide?
* Which Android APIs the Java code can reference when it compiles
- Which Android behavior changes apply to the game on newer devices at run time
- The lowest Android version on which the game can be installed
- The Android version that Google Play requires for new uploads
- Which ABIs the build compiles the native libraries for
> The compile level is the Android SDK that the code compiles against, so it decides which APIs exist for the compiler. It has no effect at run time, where the target level decides behavior, or on which devices can install the game, which the minimum level decides.
