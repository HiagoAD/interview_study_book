# Evidence for chapter 10: Build variants, environments, and releases

What Phase 28 checked the chapter’s claims against, and where the outline was wrong. [PLAN.md](../PLAN.md), under “Decisions: evidence”, says what counts as evidence.

## Checked, and against what

### release-build-variants

- BuildOptions.Development makes a development Player with symbols and the Profiler: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/BuildOptions.Development.html.
- Development Build sets the DEVELOPMENT_BUILD scripting symbol: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html.
- Debug.isDebugBuild is true in development builds and always true in the Editor: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Debug-isDebugBuild.html.
- Script Debugging requires Development Build: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html.
- Autoconnect Profiler is available only with Development Build: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html.
- Wait for Managed Debugger appears when Script Debugging is enabled and pauses scripts until a debugger attaches: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html.
- Deep Profiling Support can slow script execution: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html.
- Assertions are included by default only in development builds; ForceEnableAssertions includes them otherwise: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:9250.
- A call to a conditional method is omitted when its symbol is undefined: confirmed. https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/attributes.
- Debug.Log calls require explicit removal or a guard for final builds; Development Build alone does not suppress them: narrowed to Unity recommends removing or guarding Debug.Log calls; Development Build is not a log switch. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Debug-isDebugBuild.html.
- The IL2CPP OptimizeSpeed option targets runtime performance: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Build.Il2CppCodeGeneration.html.
- The IL2CPP OptimizeSize option targets build size and build time: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Build.Il2CppCodeGeneration.html.
- C++ compiler Debug turns optimizations off: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Il2CppCompilerConfiguration.html.
- C++ compiler Release enables optimizations: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Il2CppCompilerConfiguration.html.
- Unity recommends Master for shipping if its build time is acceptable: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Il2CppCompilerConfiguration.html.
- Minimal is the default managed stripping level for IL2CPP: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/managed-code-stripping-configure.html.
- Unity has separate Android minifyDebug and minifyRelease settings: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:40413.
- The Android launcher template has distinct MINIFY_DEBUG and MINIFY_RELEASE placeholders: confirmed. PlaybackEngines/AndroidPlayer/Tools/GradleTemplates/launcherTemplate.gradle:43.
- EditorUserBuildSettings.iOSXcodeBuildConfig chooses the Xcode run scheme configuration: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:23004.
- BuildProfile can override the global scene list: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:8521.
- BuildProfile can hold user scripting defines: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:8531.
- Build profiles can override Player settings: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html.
- Build profiles can override Graphics settings: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html.
- Build profiles can override Quality settings: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html.
- BuildPlayerWithProfileOptions.buildProfile selects the profile to build: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:9596.
- BuildProfile.GetActiveBuildProfile returns the active profile, or null for a platform profile: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:8555.
- BuildProfile.GetActiveComponent<T> returns a component from the active profile, with a global fallback for PlayerSettings: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:8558.
- BuildPlayerOptions.extraScriptingDefines adds defines while compiling Player assemblies: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:9492.
- The -activeBuildProfile command line option selects a saved build profile asset: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-command-line.html.
- With -activeBuildProfile, Unity compiles scripts with profile scripting defines before -executeMethod: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/EditorCommandLineArguments.html.
- The durable probe export has Debug, Release, ReleaseForRunning and ReleaseForProfiling configurations. Its shared scheme runs ReleaseForRunning and archives Release: confirmed. `Exports/iOS/Unity-iPhone.xcodeproj/project.pbxproj:1352`; `Exports/iOS/Unity-iPhone.xcodeproj/xcshareddata/xcschemes/Unity-iPhone.xcscheme:25`.
- Development Build does not by itself select a different managed stripping level or a named IL2CPP code generation option: narrowed to the separately exposed Player settings, with a fresh project checked by Run 1. https://docs.unity3d.com/6000.3/Documentation/Manual/managed-code-stripping-configure.html.
- The Gradle templates define debug and release blocks for every export; exporting alone does not reveal which task a non-exported Unity build invokes: settled by run 3, in which Unity ran `bundleRelease` for a release app bundle and `bundleDebug` for a development one.
- Run 1 found both Android minify settings false in a fresh project. R8 can create release-only differences when release minification is enabled and the debug build differs, but the Development Build option alone does not establish that condition: narrowed.
- The exported Xcode project changes the generated Preprocessor.h, boot.config, metadata and debugger source references for the development variant in Run 1. A signed iOS archive has not been run, so archive behavior remains unverified.
- The session's runs (below) confirmed in a new 6000.3 project: IL2CPP, Minimal stripping, the Release C++ configuration and speed-optimized code generation for both platforms, with Minify Release and Minify Debug off; `DEVELOPMENT_BUILD` code, `Debug.Assert` and `Assert.IsTrue` messages, and a `[Conditional("DEVELOPMENT_BUILD")]` call's argument present in the development exports' `global-metadata.dat` and absent from the release exports', while a plain `Debug.Log` literal was in both; `android.permission.INTERNET`, the Profiler's `player-connection-*` lines and `--enable-debugger` in the development Android export alone; `UNITY_DEVELOPER_BUILD 1` and a `_Debugger.c` file per assembly in the development iOS export; a build fingerprint naming `Development` or `Release`. Source: run 1.
- With a custom keystore, both Gradle build types in the export sign with `signingConfigs.release`, the upload key; without one, both use the debug key: confirmed. Source: run 1 exports.
- The development app bundle's merged manifest differs from the release bundle's in `android.permission.INTERNET` and `android:debuggable="true"`: confirmed. Source: run 3, `bundletool dump manifest`.
- A build profile's scripting defines add to the project's, its build settings are not shared between build profiles, and its own Player settings start from the global ones: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html.
- A profile's defines reach the player's scripts, and an Editor started with `-activeBuildProfile` compiles its own scripts with them: confirmed. Source: run 2.

### release-environments

- Firebase documents separate projects for development and production: confirmed. https://firebase.google.com/docs/projects/multiprojects.
- For Firebase mobile wrappers, environment selection is normally a build-time configuration-file choice: confirmed. https://firebase.google.com/docs/projects/multiprojects.
- Firebase Unity setup places mobile config files under Assets: confirmed. https://firebase.google.com/docs/unity/setup.
- Firebase API keys identify the project and app; authorization uses IAM, Security Rules and App Check: confirmed. https://firebase.google.com/docs/projects/api-keys.
- Firebase Security Rules and App Check protect Firebase backend resources: confirmed. https://firebase.google.com/docs/projects/api-keys.
- Firebase warns against changing the Google app ID of a distributed variant because Analytics data can be dropped: confirmed. https://firebase.google.com/docs/projects/multiprojects.
- UGS Services Core 1.7 exposes SetEnvironmentName on InitializationOptions: confirmed. https://docs.unity.cn/Packages/com.unity.services.core@1.7/api/Unity.Services.Core.Environments.EnvironmentsOptionsExtensions.html.
- Firebase Remote Config has in-app defaults before network values arrive: confirmed. https://firebase.google.com/docs/remote-config/unity/get-started.
- Firebase Remote Config fetched values require activation before use: confirmed. https://firebase.google.com/docs/remote-config/unity/get-started.
- Unity calls IPreprocessBuildWithReport before a Player build starts: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Build.IPreprocessBuildWithReport.html.
- A prebuild callback can reject a build with BuildFailedException: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Build.IPreprocessBuildWithReport.html.
- Unity calls IPostprocessBuildWithReport after the Player build completes: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Build.IPostprocessBuildWithReport.html.
- BuildSummary.options exposes the BuildOptions passed to BuildPipeline.BuildPlayer: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:8775.
- UGS documentation describes the default production environment, but its current service page is rendered through JavaScript and is unsuitable for a retrievable quote in this evidence pass: unverified for the receipt checker. https://docs.unity.com/en-us/services/service-environments.
- `-activeBuildProfile` applies profile scripting defines before `-executeMethod`; the separate `BuildPlayerWithProfileOptions` path needs Run 2 to establish what a callback sees: settled by run 2, in which the profile that `BuildPlayerWithProfileOptions` built was active during `IPreprocessBuildWithReport` and after the build. https://docs.unity3d.com/6000.3/Documentation/Manual/EditorCommandLineArguments.html.
- The current UGS documentation could not yield a retrievable receipt for which environment is used when none is selected, or exactly what each environment isolates: unverified.
- Firebase documents Remote Config defaults and fetch then activate, but the exact Unity minimum fetch interval was not confirmed by a retrievable receipt: unverified.
- The chapter's `StoreEnvironmentCheck` passed a store profile with `ENV_PRODUCTION`, a QA profile with `QA_TOOLS` and `ENV_STAGING`, a profile with Development Build on (whose build options then include `Development`), a development build without a profile, and a profile with no defines while the shared Player settings defined `ENV_PRODUCTION`; it failed, with its message, a store profile with `ENV_STAGING` alone, that profile with no defines once the shared define was removed, and a release build without a profile: confirmed. Source: runs 4b and 5.
- Each profile's player held its own environment's address from `BuildEnvironment` and neither of the others: confirmed. Source: run 5.

### release-versioning

- Android versionCode is the internal ordering integer: confirmed. https://developer.android.com/studio/publish/versioning.
- Android versionName is the user-visible version string: confirmed. https://developer.android.com/studio/publish/versioning.
- Google Play permits versionCode no larger than 2100000000: confirmed. https://developer.android.com/studio/publish/versioning.
- Google Play rejects reuse of a previously uploaded versionCode: confirmed. https://developer.android.com/studio/publish/versioning.
- PlayerSettings.bundleVersion is Unity’s global app version string: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:39844.
- PlayerSettings.Android.bundleVersionCode controls the Android bundle version code: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:40336.
- PlayerSettings.iOS.buildNumber controls the bundle build number: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEditor.CoreModule.xml:41063.
- Application.version returns the application version at runtime: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEngine.CoreModule.xml:682.
- Application.buildGUID returns a GUID for the built Player: confirmed. Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEngine.CoreModule.xml:453.
- Apple CFBundleShortVersionString is the bundle release number: confirmed. https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleshortversionstring.
- Apple CFBundleVersion identifies the build iteration: confirmed. https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion.
- An App Store Connect build is identified by bundle ID, version number and build string together: confirmed. https://developer.apple.com/help/app-store-connect/reference/app-information/app-information.
- iOS build strings may restart at 1 on a new version, so they need not increase globally across the app: contradicted: Increment for each upload within an iOS version; a new version can restart its build string. https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution.
- Jenkins exposes BUILD_NUMBER as the current job build number: confirmed. https://www.jenkins.io/doc/book/pipeline/jenkinsfile/.
- Firebase Crashlytics for Unity has SetCustomKey for data attached to the next crash report: confirmed. https://firebase.google.com/docs/reference/unity/class/firebase/crashlytics/crashlytics.
- Crashlytics reports expose a display version and a build version together: confirmed. https://firebase.google.com/docs/reference/crashlytics/rest/v1alpha/projects.apps.reports.
- Unity’s separate APKs per CPU architecture require a bundleVersionCode under 100000 to generate valid version codes: confirmed. https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PlayerSettings.Android-bundleVersionCode.html.
- A Jenkins multibranch Pipeline can use different jobs for different branches, so BUILD_NUMBER alone is not guaranteed globally unique: narrowed to Treat BUILD_NUMBER as job-scoped; add a globally allocated release number if app uploads share one version space. https://www.jenkins.io/doc/book/pipeline/pipeline-as-code/.
- The run 1 Android and iOS exports place the assigned Unity version and build numbers in `launcher/build.gradle` and `Info.plist`; the receipt for the temporary exports is in the JSON answer and the run log.
- Google Play app bundles give generated device APKs the same base module version code. The separate Unity option that creates one APK per architecture has its own version code calculation; do not conflate the two: narrowed. https://developer.android.com/guide/app-bundle/configure-base; https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PlayerSettings.Android-bundleVersionCode.html.
- For an active build profile, Player settings API calls update that profile's override values: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html. Run 4 showed the consequence: a build step that set the version code while another profile with its own Player settings was active wrote 20301 into that profile and the stamp, and the store build it then made carried 33333 from the shared settings. With the profile to build made active first, the store build carried 20301 and a profile with its own Player settings the 20302 of its run (run 4b).
- The chapter's `BuildStamp`, written by `StoreBuild` under `Resources`, loads through `Resources.Load` with its version, build, commit, content revision and 37 package entries: confirmed in the Editor. Source: runs 4b and 5.
- A new 6000.3 project starts at version 1.0, version code 1 and iOS build number 0: confirmed. Source: run 1.
- A Jenkins multibranch Pipeline creates an item for each branch with a Jenkinsfile: confirmed. https://www.jenkins.io/doc/book/pipeline/multibranch/. That each item numbers its own builds follows from `BUILD_NUMBER` being the current job's build number; no page states it in those words.
- The time in seconds since 1970 reaches 2,100,000,000 on 2036-07-18 UTC: computed with Python from the limit on Android's versioning page.

### release-rollouts

- Google Play provides three testing tracks plus production: confirmed. https://support.google.com/googleplay/android-developer/answer/9859348?hl=en.
- Google Play internal testing supports up to 100 chosen testers: confirmed. https://support.google.com/googleplay/android-developer/answer/9859348?hl=en.
- A new internal-test app bundle can reach testers within minutes: confirmed. https://support.google.com/googleplay/android-developer/answer/9845334?hl=en.
- Internal Google Play tests might bypass standard policy and security review: confirmed. https://support.google.com/googleplay/android-developer/answer/9845334?hl=en.
- Halting a Play staged rollout stops additional recipients while updated users remain on it: confirmed. https://support.google.com/googleplay/android-developer/answer/6346149?hl=en.
- Play’s track API models a halted release separately from a completed one: confirmed. https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks.
- The Play track API userFraction is the staged-release eligible fraction: confirmed. https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks.
- TestFlight internal testers are App Store Connect users and can number up to 100: confirmed. https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers.
- TestFlight external testing can invite up to 10,000 people: confirmed. https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers.
- The first TestFlight external build requires a full Beta App Review; later builds of the version might not: confirmed. https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers.
- A TestFlight build is testable for up to 90 days: confirmed. https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/.
- Every App Store version submitted for distribution is reviewed: confirmed. https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review.
- Apple permits an expedited App Review request for a critical update: confirmed. https://developer.apple.com/support/switching-to-the-apple-developer-program/.
- Apple does not offer reverting to a prior App Store version; a fix needs a new version: confirmed. https://developer.apple.com/help/app-store-connect/update-your-app/create-a-new-version.
- Crashlytics crash-free metrics count fatal events, including Unity uncaught exceptions reported as fatal: confirmed. https://firebase.google.com/docs/crashlytics/crash-free-metrics.
- Crashlytics crash-free charts can be filtered by build: confirmed. https://firebase.google.com/docs/crashlytics/crash-free-metrics.
- Apple documents the seven day automatic update schedule and allows a total of 30 paused days; manual downloads remain available: confirmed. https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases.
- The Play Console Help page does not explicitly specify which binary a new install receives during a staged rollout: narrowed to what the page says, that new and existing users are eligible and chosen at random for each rollout. https://support.google.com/googleplay/android-developer/answer/6346149?hl=en.
- A single first-party source did not establish every review rule for internal versus external TestFlight builds, or a per-version Xcode Organizer crash filter: unverified beyond the specific receipts above.
- App Review for a production version and an expedited review request are separate from TestFlight Beta App Review: confirmed. https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review; https://developer.apple.com/support/switching-to-the-apple-developer-program/.
- Users who already received a halted staged rollout remain on that version; a resumed rollout reaches the same users; a staged rollout of a new release before the previous one completes uses the same group of users: confirmed. https://support.google.com/googleplay/android-developer/answer/6346149?hl=en.
- Closed testing reaches a limited number of chosen testers, and users join open testing from the store listing: confirmed. https://support.google.com/googleplay/android-developer/answer/9859348?hl=en.
- The App Store's phased release runs over seven days to a random sample of users with automatic updates on (1, 2, 5, 10, 20, 50 and 100 percent), anyone can download the app or update by hand at any time, a release can be paused for up to 30 days with no limit on the number of pauses, and the App Store Connect API manages phased releases: confirmed. https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases.
- Google Play's release dashboard compares releases on installs, uninstalls, updates, ratings, reviews, crashes and ANRs: confirmed. https://support.google.com/googleplay/android-developer/answer/7383463?hl=en.
- In 500 sessions, a crash that affects one session in 1,000 appears at least once with a probability of 1 − 0.999^500 ≈ 39%: computed.

### release-verification

- Google Play internal app sharing is separate from testing tracks: confirmed. https://support.google.com/googleplay/android-developer/answer/9844679?hl=en.
- Google Play re-signs internal app sharing APKs with its Internal App Sharing key: confirmed. https://support.google.com/googleplay/android-developer/answer/9844679?hl=en.
- Google Play generates and serves device-optimized APKs from app bundles: confirmed. https://developer.android.com/guide/app-bundle.
- The Play pre-launch report installs an upload on lab devices, then launches and crawls it: confirmed. https://support.google.com/googleplay/android-developer/answer/9842757?hl=en.
- Google Play license testers can use test payment methods without real charges: confirmed. https://developer.android.com/google/play/billing/test.
- Purchases by ordinary test-track users can cause real charges: confirmed. https://developer.android.com/google/play/billing/test.
- Apps installed from TestFlight use the In-App Purchase sandbox: confirmed. https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight.
- apkanalyzer manifest print prints an APK manifest as XML: confirmed. https://developer.android.com/tools/apkanalyzer.
- apkanalyzer apk compare compares APK sizes: confirmed. https://developer.android.com/tools/apkanalyzer.
- Apple’s App Thinning Size Report lists compressed and uncompressed sizes for each IPA variant: confirmed. https://developer.apple.com/documentation/xcode/reducing-your-app-s-size.
- Google Play requires an accurate, maintained Data safety section, including SDK data: confirmed. https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB.
- App Store Connect app privacy responses must stay accurate as practices change: confirmed. https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy.
- An Android App Bundle can include native debug symbols for upload to Play Console: confirmed. https://developer.android.com/build/include-native-symbols.
- Unity’s Android symbols setting offers Public and Debugging levels: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/android-symbols.html.
- Unity’s Android exported Gradle project generates libil2cpp symbols when Gradle builds it: confirmed. https://docs.unity3d.com/6000.3/Documentation/Manual/android-symbols.html.
- Crashlytics for Unity configures Xcode to upload symbols for Apple builds: confirmed. https://firebase.google.com/docs/crashlytics/unity/get-started.
- Android App Bundles automatically include R8 mapping.txt for deobfuscation: confirmed. https://developer.android.com/topic/performance/app-optimization/troubleshoot-the-optimization.
- Compare a store-installed candidate against the preceding store release, including the merged Android manifest, Apple property list, signed entitlements, app size, store privacy declarations and symbols. The listed tools provide each artifact; a person still needs to exercise sign-in, purchases, push and deep links.
- Apple documentation retrieved here establishes that the signed `aps-environment` entitlement selects APNs development or production. It does not establish a universal TestFlight APNs environment for every uploaded build: narrowed to inspecting the installed candidate’s signed entitlement. https://developer.apple.com/documentation/bundleresources/entitlements/aps-environment.
- TestFlight size is not identical to final App Store size. Use App Store Connect’s size for the shipped variant when it is available: confirmed. https://developer.apple.com/documentation/xcode/reducing-your-app-s-size.
- The exact APNs environment of a particular TestFlight installation requires inspecting its signed entitlement; the sources here do not support a universal answer. The Google Play pre-launch report does not prove account, purchase or push paths succeed.
- The pre-launch report installs an upload on lab devices, launches and crawls it for several minutes with basic actions, and can use test account credentials: confirmed. https://support.google.com/googleplay/android-developer/answer/9842757?hl=en.
- `bundletool dump manifest --bundle` printed each run 3 bundle's merged manifest, with its version code: confirmed. Source: run 3.

## Rests on documentation alone

- Store policies, tester limits, rollout percentages, App Review behavior, Firebase environment guidance, privacy declarations and crash reporting behavior are documented but cannot be exercised without store accounts and released artifacts.
- The Play internal sharing signing rule and store-generated device APKs come from Google documentation. The probe has no Play-installed build with which to verify the final certificate.

## Narrowed or cut

- Do not say a development build automatically uses lower managed stripping or a different IL2CPP code generation option. Those are explicit settings; Run 1 found Minimal and OptimizeSpeed in its fresh project before both builds.
- Do not present R8 as an automatic difference between development and release builds. The fresh project had minifyDebug and minifyRelease disabled; turn on release minification deliberately and test that configuration.
- Do not say all assertions or all logs disappear from release builds. Unity documents assertion inclusion by default only in development builds, and its `Debug.Log` guidance calls for removing or guarding logging separately.
- Do not say an iOS build string must rise across every app version. Apple allows non-macOS build strings to restart at 1 for a new version. A Jenkins branch job number is not a global upload sequence.
- Do not treat internal app sharing as the internal testing track. Google Play uses a distinct internal app sharing certificate and its artifacts cannot enter a testing or production release.
- Do not promise a halted rollout removes a version from devices that already installed it. Both Google Play and Apple require a new uploaded version to fix an installed binary.

## Where the outline fell short

- The release environment assertion should validate the selected endpoint and Firebase project together. Run 1 retained both endpoint literals in release metadata, so a hidden switch alone does not remove staging configuration.
- A release-configured QA build needs an overlay controlled independently of Unity Development Build. Its signature also needs to match the store distribution path for certificate-bound integrations.
- A Google Play pre-launch report crawls an artifact on a lab device, but its crawler cannot complete every purchase or account path. Human smoke tests remain necessary.
- The checklist needs explicit ownership and thresholds set before rollout: version-specific crash-free users, ANR rate, and funnel changes, plus who can halt.
- The outline listed Gradle build types with minify per type; it did not say that Development Build chooses the build type, so a development build is also Gradle's debug build type, debuggable and with its own minify switch (run 3).
- “Verify what a profile can override”: a profile holds its platform's build settings, its own scene list, additive scripting defines, and its own Player, Graphics and Quality settings if the team creates them. The outline did not foresee the consequence for versioning: Player settings calls act on the active profile's own settings, so a CI step has to activate the profile it builds before it sets the build number (runs 4 and 4b).
- The environment check the outline asked for (“assert it in CI for release variants”) is written as a build callback that reads the build's defines, those of the Player settings and those of the profile, so it runs on every build; the artifact search is left to chapter 11.

## Runs

The session ran these in a new Unity 6000.3.11f1 project made for the phase in its scratchpad, since the probe project's settings had been changed by earlier phases and the defaults were part of the evidence. The scripts are kept in the probe project under `Tools/Phase28/`.

1. Defaults and exports: the new project's Player settings printed, then Android (with and without a custom keystore) and iOS exports with Development Build on and off, with version 2.3.0, version code 20300 and build number 20300; the string literals of a probe script searched for in each export's `global-metadata.dat`, and each pair diffed.
2. Build profiles: Android QA (`QA_TOOLS`, `ENV_STAGING`) and Android Store (`ENV_PRODUCTION`) profiles created in batch mode; the store profile built with `BuildPlayerWithProfileOptions`, and the QA profile with `-activeBuildProfile`, logging the active profile and defines inside `IPreprocessBuildWithReport`. The first build failed at signing, because a keystore set in run 1 stays in the project while its passwords do not.
3. App bundles: Unity built a release and a development `.aab` itself, and the store profile's APK; the log showed `bundleRelease`, `bundleDebug` and `assembleRelease`, and `bundletool dump manifest` gave the two bundles' manifests. Setting Export Project while a profile is active changes that profile, as the build profile reference says, so the platform's setting had to be set after the profile was deactivated.
4. The chapter's samples (`BuildEnvironment`, `StoreEnvironmentCheck`, `BuildStamp`, `StoreBuild`) copied byte for byte into the project and run against four profiles and two builds without a profile; the first version of `StoreBuild` shipped the wrong version code, as recorded under release-versioning. 4b repeated the runs with each profile loaded by path, since a build destroys the other profile objects a script holds, and with the corrected `StoreBuild`.
5. The check revised to read the shared Player settings' defines as well as the profile's, run over the same cases plus a profile with no defines, with and without `ENV_PRODUCTION` in the shared settings.

The samples also compiled in a .NET 8 harness against the 6000.3 assemblies, with warnings as errors, for Android and iOS and with each environment define.

## The teacher’s read

The blind review (GPT-6 Astra, `xhigh`) started after the evidence run and stopped at the shared usage limit after 9.5 minutes and 172,463 tokens, with no answer file; the reset was 3 hours 45 minutes away, so the session read the chapter as a teacher in its place, each claim against its receipt and each question against the standard. The review's log had already named two problems it had verified, both of which held, and two concerns it was narrowing, both of which the read confirmed. The read changed:

- The time-based build number, said to rise and never repeat: two builds started in the same second get one number, and machines whose clocks disagree can go backwards, so the scheme still needs one place that hands the numbers out.
- The entitlement diff's command, which lacked the path argument: `codesign -d --entitlements - --xml` prints a signed app's entitlements, as the man page says and a run on a signed app showed.
- The comparison of versions over the same hours, whose explanation said the difference “belongs to the version”: it now points at the version, with the random choice of users in a staged rollout keeping the two groups alike.
- Remote configuration, which the prose and one question said cannot choose the environment: that holds where each environment has its own service, as with a Firebase project per environment, and both now say so.
- Google's rule for the users of a replacement rollout, which applies to a release staged before the halted one completed, and depends on its percentage.
- The environment label, which the check assumes development builds show: the label is now compiled in under `QA_TOOLS` or `DEVELOPMENT_BUILD`.
- Claims without a receipt: the reason development builds request the internet permission, the promotion of a release from one track to another, the assertion attribute on every method of `Assert` (only `Assert.IsTrue` was checked), and Firebase's API keys not being kept hidden, all narrowed to what the sources and runs show; “these platforms” in Firebase's guide is now Android and Apple, their Unity wrapper included.
- Before the read, the options were rebalanced: the correct option was the longest of its set in 52% of the 42 sets and is now in 21%, and five options that held words from the list were rewritten.

The avoid-ai-writing detector, run per section and on the three new glossary entries, rated each “Minimal AI signals”; what it flagged were known false positives (`{#id}` read as hashtags, low vocabulary diversity) and “features” read as a verb where it is a noun. The read for its judgment-only patterns removed a teaser sentence and a transformation phrase.
