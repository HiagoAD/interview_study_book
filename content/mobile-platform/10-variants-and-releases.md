---
book: unity-mobile-platform-engineering
chapter: 10: Build variants, environments, and releases
---

## Development and release builds differ on purpose {#release-build-variants}

The same Unity project is built more than one way. A programmer turns on Development Build to connect the Profiler and a debugger, the stores receive a release build, and QA tests a third variant between the two. Each variant serves a purpose, and each difference between them is also a place where a bug can hide from the builds that were tested. This chapter follows the variants to the store: this section covers what differs between them, the next two what each build talks to and how it identifies itself, and the last two how a build reaches players and how the one that reaches them is checked.

What the Development Build option changes is narrower than its name suggests. A new Unity 6.3 project, exported once with the option and once without for each platform, showed where the two builds part:

- Scripts compile with `DEVELOPMENT_BUILD` defined, and `Debug.isDebugBuild` returns true. A method under `#if DEVELOPMENT_BUILD` reached the development exports alone.
- Assertions are compiled in. `Debug.Assert` and `Assert.IsTrue` from `UnityEngine.Assertions` are conditional methods, compiled where `UNITY_ASSERTIONS` is defined, and the reference for `BuildOptions.ForceEnableAssertions` says that by default assertions are included in development builds alone. [C#'s rule for a conditional method](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/attributes) leaves out a call to it where none of its symbols is defined, and with the call go the expressions in its arguments. The release exports held none of the test's assertion messages.
- A debugger and the Profiler can reach the player. The development exports' `boot.config` held the settings for the Profiler's connection, and the Android export's manifest requested `android.permission.INTERNET`, which the release export's did not. With Script Debugging on, [[IL2CPP]] ran with `--enable-debugger`, and the iOS export gained a `_Debugger.c` file for each assembly.
- The engine is a development build as well. The Android export's build fingerprint named the configuration `Development` instead of `Release`, the iOS export set `UNITY_DEVELOPER_BUILD` to 1 in `Classes/Preprocessor.h`, and the engine's static libraries differed, as `libunity.so` did in the tests of [[#android-failure-evidence]].

On Android the option also picks [[Gradle]]'s build type. Building [[AAB|app bundles]], Unity ran Gradle's `bundleDebug` task for the development build and `bundleRelease` for the other, and the development bundle's merged manifest set `android:debuggable="true"`. Each build type has its own minify switch, Minify Debug and Minify Release in Publishing Settings, and a new 6.3 project leaves both off, so [[R8]] runs only in a build type whose switch a team turns on.

Other settings belong to the project and do not follow the option. The scripting backend, the [[managed code stripping]] level, IL2CPP's code generation and C++ compiler configuration, and the [[scripting define symbol|scripting defines]] are Player settings, which both builds share: in the new project, both used IL2CPP, the Minimal stripping level, the Release compiler configuration and the code generation that favors run-time speed. [Unity's reference for the compiler configuration](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Il2CppCompilerConfiguration.html) recommends Master for a shipping build when its longer build time is acceptable, so the store variant may be the one build that uses it. Android signing is shared too. In the exported Gradle project, the `debug` and `release` build types both signed with the debug key when no keystore was set and with the upload key when one was, while players' copies carry the app signing key of [[Play App Signing]] ([[#gradle-packaging-signing]]).

On iOS, Xcode adds a split of its own. The scheme that Unity generates builds a different configuration for each action: Run uses ReleaseForRunning, Profile uses ReleaseForProfiling, Test uses Debug, and Archive, which makes the build that goes to the store, uses Release ([[#xcode-build-flow]]). `EditorUserBuildSettings.iOSXcodeBuildConfig`, whose reference calls it the scheme Xcode uses to run the project, was Release in the new project, and Run then used ReleaseForRunning.

| Setting | Where it is set | Follows Development Build |
| --- | --- | --- |
| `DEVELOPMENT_BUILD`, `Debug.isDebugBuild`, assertions | The Development Build option | Yes |
| Profiler connection, Script Debugging | Options that need Development Build | Yes |
| Gradle build type: `debug` or `release` | The Development Build option | Yes |
| Minify, per build type | Publishing Settings | Through the build type |
| Stripping level, IL2CPP settings, scripting defines | Player settings, or a build profile | No |
| Android signing key | Publishing Settings, the same for both build types | No |
| Xcode configuration | The scheme's action | No: Archive uses Release |

Bugs that only a release build shows come from those differences:

- R8, when Minify Release is on and Minify Debug is off: Java that only C# reaches by name is removed or renamed ([[#gradle-r8-symbols]]).
- A stripping level or IL2CPP setting that only the release variant uses. The Editor neither strips nor runs IL2CPP, so stripping first shows on a device, and a team that raises the stripping level for store builds alone first meets its failures there.
- Code that one variant holds and the other does not: a block under `#if DEVELOPMENT_BUILD`, an assertion or a conditional log call whose argument did work the game relied on, or a debug menu whose start-up created something the game later used.
- Timing. A development player carries the Profiler's connection and, with Script Debugging, the debugger's support in the code that IL2CPP generates, and Unity's reference warns that Deep Profiling might slow down script execution. A race that a slower build wins can go the other way in a faster one.
- The signature. What recognizes the app by its certificate or its [[provisioning profile]] sees a different one in each build: verified links and sign-in clients on Android ([[#os-deep-links]]), and on iOS the `aps-environment` entitlement that the provisioning profile sets ([[#os-notifications]]).
- Less to read. A team that compiles its own diagnostic logging out of release builds also removes the evidence that logging would have given, so the bug that only players meet is the one with the fewest logs. `Debug.Log` itself stays in a release build unless the team removes its calls, which [the reference for `Debug.isDebugBuild`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Debug-isDebugBuild.html) recommends for final builds; the test's plain log message was in both exports.

The assertion case is the easiest to write by accident:

```csharp
// A release build leaves out this whole call, Remove included, so the receipt stays pending there.
Debug.Assert(pendingReceipts.Remove(receipt.Id), "The receipt was not pending.");
```

In a development build, the receipt leaves the pending set and the assertion checks that it was there. A release build compiles neither, so the receipt stays pending, and the game sends it to the server again at each launch. Work that the game needs goes on a line of its own, and the assertion checks its result:

```csharp
bool removed = pendingReceipts.Remove(receipt.Id);
Debug.Assert(removed, "The receipt was not pending.");
```

So QA tests a release-configured build with a debug overlay, not a development build. The QA variant has the store variant's settings: Development Build off, the same minify switches, stripping level and IL2CPP settings, and the same signing. It adds one scripting define of the team's own, such as `QA_TOOLS`, which compiles in what testers need: the environment and the build on screen, a viewer for the game's logs, and shortcuts to the screen under test. The store variant is the same without that define, so the overlay's code and its strings are not in the store build at all. The two builds still differ by the define, and by what the store does to a build on its way to a phone, which is why the last section of this chapter installs the release candidate from the store itself.

Unity 6 keeps variants as build profiles. A build profile is an asset for one platform, and [Unity's reference for build profiles](https://docs.unity3d.com/6000.3/Documentation/Manual/build-profiles-reference.html) lists what it holds: the platform's build settings, Development Build and its options among them, which are not shared between build profiles; a scene list of its own if the team adds one; scripting defines, which add to the project's rather than replace them; and, if the team creates them, Player settings, Graphics settings and Quality levels of its own, which start from the project's values. A project can hold Android Development, Android QA and Android Store, and the same three for iOS. Since profiles are assets in version control, the difference between two variants is a diff between two files, and CI builds a variant by naming its profile: the `-activeBuildProfile` argument with the asset's path, which [Unity's command-line reference](https://docs.unity3d.com/6000.3/Documentation/Manual/EditorCommandLineArguments.html) says compiles the scripts with the profile's defines before an `-executeMethod` runs, or `BuildPipeline.BuildPlayer` given a `BuildPlayerWithProfileOptions`. In a test project, a profile's defines reached the player's scripts, and the profile that `BuildPlayerWithProfileOptions` built was the active one while the build's callbacks ran, and stayed active after it. The older way, a build script that edits the shared Player settings before each build, keeps the variant's definition in the script, and a setting it changes for one build stays changed for the next unless the script puts it back.

A profile differs from the project only where it overrides. If the store profile raises the stripping level and the QA profile does not, QA tests a build that strips less than the one players receive, so a setting that matters to what ships belongs in both profiles or in neither.

Exercise: List every difference between your development and release builds, including the ones that come from signing and from the store, and mark which of them QA never exercises.

?? release-config-testing QA has to find the bugs that players will meet. Which build do they test from day to day?
* One with the store build's settings and a QA overlay compiled in by a define of its own
- A development build, whose Profiler and debugger show more about each bug they find
- A development build with Minify Debug turned on, so that R8 runs as in the store build
- An Editor session in Play Mode, with the store profile active so the same code compiles
> A development build differs from the store build in more than its tools: its assertions and `DEVELOPMENT_BUILD` code, its debugging connections, its engine build and, on Android, its Gradle build type. Turning one of those back leaves the others, and the Editor neither strips nor runs IL2CPP. A QA build that copies the store variant's settings and adds the overlay's define alone tests what players run, with the tools that testers need.

?+ A release build sends the same purchase receipt to the server at each launch, and the development build that QA tested does not. The code reads `Debug.Assert(pendingReceipts.Remove(receipt.Id));`. What happened?
* The release build leaves out the whole call, so `Remove` does not run there
- The release build runs `Remove` on a copy of the set, so the stored set keeps the receipt
- `Debug.Assert` throws in release builds, so the code that saves the set is skipped
- IL2CPP runs the call later in release builds, after the receipt has been sent again
> `Debug.Assert` is a conditional method, compiled where `UNITY_ASSERTIONS` is defined, which by default means development builds. Elsewhere the compiler leaves out the call along with the expressions in its arguments, so the receipt is never removed from the set. Work that the game needs goes on a line of its own, and the assertion checks its result.

?+ [tf] Turning on Development Build also lowers the managed stripping level and switches IL2CPP's C++ compiler configuration to Debug.
* false
> The stripping level and IL2CPP's settings are Player settings, which development and release builds share unless a build profile overrides them. In a new Unity 6.3 project, the development and release exports both used the Minimal stripping level and the Release compiler configuration. Development Build changes the defines, the assertions, the debugging connections, the engine build and, on Android, the Gradle build type.

?+ [multi n=6] A store build fails where the development build that QA tested works. Which differences can explain it?
* R8, which the release build type runs when Minify Release is on
* Code under `#if DEVELOPMENT_BUILD`, which the store build does not contain
* A higher stripping level set in the store build's profile and nowhere else
- The scripting backend, which Development Build switches from IL2CPP to Mono
- The Unity version, since a development build runs the Editor's own player
- The scripting defines in Player settings, which release builds ignore
> A development build is Gradle's debug build type, which follows the Minify Debug switch, conditional code exists where its symbol is defined, and a profile's override applies to that profile's builds. The scripting backend and the Player settings' defines are shared by both builds, and one Unity version makes both.

?+ Why does the QA overlay go behind a define of the team's own rather than behind `DEVELOPMENT_BUILD`?
* So that a build configured like the store build can still carry the overlay
- Because Unity leaves `DEVELOPMENT_BUILD` undefined in scripts built for devices
- So that the store build can turn the overlay on later through remote configuration
- Because code under `DEVELOPMENT_BUILD` stays in store builds, where players reach it
> Tying the overlay to `DEVELOPMENT_BUILD` would make each build that has it a development build, with its assertions, debugging connections, engine build and build type. A define of the team's own, set in the QA profile alone, adds the overlay to a build that is otherwise the store build, and the store build, compiled without the define, holds none of the overlay's code.

?? release-build-profiles A project keeps Android Development, Android QA and Android Store as Unity 6 build profiles. What does each profile hold?
* Its build settings, its scene list and defines, and any Player settings it overrides
- A name for the target platform, while all settings stay shared between the three profiles
- The output path of its builds and the store credentials that CI uploads them with
- Its own copy of the project's assets, imported for its platform and its settings
> A build profile holds its variant's settings: the platform's build settings, such as Development Build, which build profiles do not share; a scene list and scripting defines of its own, the defines adding to the project's; and Player settings of its own if the team creates them, starting from the project's values. The assets stay shared, and credentials belong to CI, not to a profile.

?+ Why keep the store variant as a build profile rather than as a script that edits Player settings before each build?
* The variant is a versioned asset, and a change for one build stays out of the next
- Profiles skip compiling scripts whose settings did not change, so the builds finish sooner
- Player settings are locked against a script that runs in batch mode on a CI agent
- The stores read the profile's name from the build and reject builds made without one
> A profile holds its variant's settings in an asset that reviews and diffs show, and building it does not edit the settings that other variants share. A script that edits Player settings keeps the variant in code, and whatever it changes for one build stays changed until something restores it. Scripts can write Player settings in batch mode, and no store sees a profile.

?+ The store profile overrides the managed stripping level to High, and the QA profile keeps the project's Minimal. What does that do to testing?
* QA tests a build that strips less code than the one players receive
- Nothing, since Development Build sets the stripping level and both are release builds
- The QA build strips more, since the lower of the two levels applies to both profiles
- The store build keeps more code, since a profile's override skips the stripping step
> A profile differs from the project where it overrides, and nowhere else. With High in the store profile alone, code that High strips and Minimal keeps, such as a type reached through reflection alone, works in each QA build and fails in players' copies. A setting that matters to what ships belongs in both profiles or in neither.

?+ How does a CI job build the store variant from its profile?
* It names the profile's asset, with `-activeBuildProfile` or in the build options
- It names the profile in `-buildTarget`, which takes profile names as well as platforms
- It copies the profile's values into `ProjectSettings.asset` and then builds as before
- It opens the Build Profiles window in batch mode and selects the profile's Build button
> `-activeBuildProfile` takes the path of a saved profile, and Unity compiles the scripts with its defines before `-executeMethod` runs; in a build script, `BuildPlayerWithProfileOptions` names the profile to build. `-buildTarget` takes a platform, and copying a profile's values into the project's settings brings back the leak that profiles remove.

## Environment-specific configuration {#release-environments}

A game's backend runs as more than one copy. Development is where programmers deploy work in progress and break it, staging is a copy set up like production where a release is tested before players see it, and production is where the players are. Each copy has its own address, and the services around the game split the same way. [Firebase's guide to multiple projects](https://firebase.google.com/docs/projects/multiprojects) names separate projects for development and production as a common case, so each environment has its own analytics data, its own [[remote configuration]] and its own configuration files, and an SDK that takes a key takes the environment's key. A build talks to one environment, and the choice is made either when the build is compiled or when it runs.

At build time, the variant chooses. A [[scripting define symbol]] in each build profile of [[#release-build-variants]] selects one environment, and the code compiled for it holds that environment's values and no other's:

```csharp
// The environment is fixed when the build is compiled, and only its own values are compiled in.
public static class BuildEnvironment
{
#if ENV_PRODUCTION
    public const string Name = "production";
    public const string ApiBaseUrl = "https://api.example.com/";
#elif ENV_STAGING
    public const string Name = "staging";
    public const string ApiBaseUrl = "https://api.staging.example.com/";
#else
    public const string Name = "development";
    public const string ApiBaseUrl = "https://api.dev.example.com/";
#endif
}
```

The composition root of [[#platform-composition]] reads `BuildEnvironment` and hands each client its address and each adapter its keys, so nothing else in the game names an environment. A build with no environment define gets development's values, which the check below keeps out of any build that can reach players. SDKs that read a configuration file choose the same way. Firebase's Unity SDK takes `google-services.json` and `GoogleService-Info.plist` from the project's `Assets` folder, and Firebase's guide says that on Android and Apple platforms, their Unity wrapper included, the switch between environments is usually a build-time decision, made with a different configuration file for each environment, so the build step copies the environment's files into place before it builds. The same guide warns against a change to the production files between releases: an app that ships one version with a Google app ID and the next with another may lose analytics data.

At run time, the game chooses among values inside its environment. Remote configuration, fetched from the environment's own service, turns features on and sets their values without a new build; Firebase's Remote Config, for example, starts from defaults compiled into the app and uses fetched values once the app activates them. Where each environment has a remote configuration service of its own, as it does with a Firebase project per environment, remote configuration cannot choose the environment itself: the game has to know which environment's service to ask before it has any answer to read. A QA build can also carry a switcher, a menu in the overlay of [[#release-build-variants]] that points the build at development or staging, so that testers do not wait for a build of each. It sits under the overlay's define, since a switcher in the store build would let anyone who found it point a player's game at staging.

Leaving the other environments out of the build matters because anyone who has a build can read what it holds. In the test project of [[#release-build-variants]], a method returned a staging address or a production address according to a flag that release builds never set, and both addresses were in the release exports' `global-metadata.dat`, the file where IL2CPP keeps the game's string literals, readable with any tool that prints a file's strings. Built from a store profile that defined `ENV_PRODUCTION`, the same project's `BuildEnvironment` left staging's and development's addresses out. For the same reason, secrets are not configuration: a key that grants access to anything is not safe inside a build, and chapter 11 covers where CI keeps the ones it needs. What a client carries are identifiers. Firebase's page on its API keys says that they identify the Firebase project and app to its services, and that controlling which users and which apps reach its resources takes Security Rules and App Check.

The failure to prevent is a release build that talks to staging. It passes QA, since QA tests against staging, and players who receive it put their purchases, progress and events into a copy that the team resets. Two guards stop it. The first is on screen: each build except the store build shows its environment and build in a corner, such as `STAGING 2.3.0 (20300)`, with the label compiled in under `QA_TOOLS` or `DEVELOPMENT_BUILD`, so a tester knows what a build talks to before trusting what it shows. The second fails the build. A build with neither Development Build nor the QA overlay can go to a store, so it has to be production, and a check in an `Editor` folder refuses anything else:

```csharp
using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Profile;
using UnityEditor.Build.Reporting;

// A build with neither Development Build nor QA_TOOLS can reach players, so it must point at production.
class StoreEnvironmentCheck : IPreprocessBuildWithReport
{
    public int callbackOrder => 0;

    public void OnPreprocessBuild(BuildReport report)
    {
        if ((report.summary.options & BuildOptions.Development) != 0) return;

        // The compiler sees the Player settings' defines and the profile's, which add to them.
        BuildProfile profile = BuildProfile.GetActiveBuildProfile();
        var target = NamedBuildTarget.FromBuildTargetGroup(report.summary.platformGroup);
        string[] defines = PlayerSettings.GetScriptingDefineSymbols(target).Split(';')
            .Concat(profile != null ? profile.scriptingDefines : Array.Empty<string>())
            .ToArray();
        if (defines.Contains("QA_TOOLS")) return;

        if (!defines.Contains("ENV_PRODUCTION"))
            throw new BuildFailedException(
                $"{(profile != null ? profile.name : "A build without a profile")} can reach players but does not define ENV_PRODUCTION.");
    }
}
```

[Unity's reference for `IPreprocessBuildWithReport`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Build.IPreprocessBuildWithReport.html) says a callback can fail the build by throwing `BuildFailedException` with a clear message. The check reads the defines that the compiler will see: those of the Player settings, which for an active profile with Player settings of its own are that profile's, and those that the profile adds. The profile being built is the active one while the callbacks run, as the previous section's test found, so the check covers each build, from CI or from the Build Profiles window. In a Unity 6.3 test, it passed a store profile that defined `ENV_PRODUCTION`, a QA profile that defined `QA_TOOLS` and `ENV_STAGING`, a profile with Development Build on, a development build made without a profile, and a profile with no defines while the project's Player settings defined `ENV_PRODUCTION`. It failed, with its message, a store profile that defined `ENV_STAGING` alone, the profile with no defines once the Player settings no longer defined `ENV_PRODUCTION`, and a release build made without a profile. CI can add a second look at the finished build, in chapter 11: a search of the store build's files for the addresses of development and staging finds them wherever they came from, as long as they sit in the build as plain strings.

Test events stay out of production's analytics the same way. Each environment's build sends to that environment's analytics project, so a day of QA sessions against staging lands in staging's numbers. The other sources are development builds and the Editor, which [[#sdk-analytics-integration]] keeps out.

Exercise: Find where your project decides its backend URL, and write the check that fails a release build pointing at staging. Then list what else changes with the environment, such as SDK keys, configuration files and the analytics project, and check that one decision selects all of them.

?? release-environment-selection The store build must not be able to reach staging. Where is its environment decided?
* When the store variant is compiled, so staging's values are left out of it
- At start-up, from remote configuration, which can move it back to production
- At start-up, by a hidden switcher in the store build that QA knows how to open
- At first launch, from the country of the store account that installed the game
> A build holds what it was compiled with, and a choice made at run time needs the other environments' values in the build to choose from. Choosing when the store variant is compiled leaves staging's addresses and keys out of it. Remote configuration chooses values inside one environment, and a switcher belongs to QA builds.

?+ Each environment has a remote configuration service of its own. Why can remote configuration then not choose the environment a build talks to?
* The game must know which environment's service to ask before it has any answer
- Remote configuration holds flags and numbers, and an address is neither of them
- The stores reject builds that change their server addresses after installation
- Its values are cached for a day, so a change would reach players too late
> Remote configuration is a service in each environment, with values of its own. A build has to know which one to fetch from before its first fetch, so the environment is fixed before remote configuration can say anything; its values then turn features on and set numbers within that environment.

?+ A store build picks its API address with `useStaging ? StagingUrl : ProductionUrl`, and `useStaging` is false in each store build. What does the store build contain?
* Both addresses, since both literals are compiled in whatever the flag holds
- The production address alone, since IL2CPP drops the branch the flag does not take
- Neither address, since IL2CPP stores string literals encrypted in the binary
- The production address alone, since stripping removes unread string literals
> A flag read at run time chooses between values that are both in the build. In a test project, a staging and a production address behind such a flag were both in the release exports' `global-metadata.dat`, where anyone can read them. Leaving an environment out of a build takes a choice made at compile time.

?+ [multi n=6] Which values change with the backend environment, and so belong to the same decision?
* The base address of the game's API
* The SDK configuration files, such as `google-services.json`
* The analytics project that the events go to
- The Minify Release switch
- The IL2CPP C++ compiler configuration for the release build
- The marketing version that players see in the store listing
> The address, the SDKs' configuration files and the analytics project all name one copy of the backend and its services, so one decision selects them together, and a build that takes one from staging and another from production mixes the two. Minify, the compiler configuration and the marketing version belong to the variant or to the release, whatever environment the build talks to.

?? release-wrong-environment A release build that talks to staging would pass QA and reach players. What stops it when it is built?
* A build check that fails a build able to reach players unless it defines production
- A label with the environment's name, shown in each build including the store build
- A remote flag that redirects builds pointing at staging to production at start-up
- A review of each change to the environment file before the change is merged
> A check that runs during the build refuses the wrong build before anyone installs it. A label helps testers read what they hold, and a review catches the changes someone makes on purpose, not the wrong profile picked for a build. A build pointed at staging asks staging's services for its flags, so a flag set in production's does not reach it.

?+ Why does each build other than the store build show its environment on screen?
* A tester sees what the build talks to before trusting the results it shows
- Players report bugs more precisely when they can read the environment's name
- The stores ask for test builds to show their backend on screen before review
- The label switches the environment's analytics off while it is visible
> The label is for the people who test: a QA session against production, or a bug report from a build that points at development, is wasted work until someone notices the environment. Players receive the store build, which carries no label and no overlay.

?+ CI searches the store build's files for staging's host name and finds nothing. What can the search still miss?
* An address assembled at run time from parts, or kept in an asset the build compresses
- Nothing, since IL2CPP keeps each string of the game in its metadata file as it is
- An address in a comment, which IL2CPP keeps beside the code that it generates
- The production address, which the search does not look for in the build's files
> The search finds an address that sits in the build as a plain string, as a C# literal does in IL2CPP's `global-metadata.dat`. An address put together from pieces at run time, or stored in an asset that the build compresses, is not there as one string, which is why the check on the profile's defines comes first and the search second.

?+ QA's sessions against staging start to appear in production's analytics. What keeps test events out?
* Each environment's build sends its events to that environment's analytics project
- Development Build, which stops the analytics SDK from uploading any events
- A filter on production's dashboards that hides the sessions of QA's devices
- Sampling, which drops most of the events from builds that are not the store build
> When the environment selects the analytics project along with the backend, QA's sessions against staging land in staging's numbers. Development Build does not change what an SDK sends, a dashboard filter hides events after they have mixed into the data, and sampling reduces events without separating them.

## Versions and build identity {#release-versioning}

Each build carries two version values, and they answer different questions:

| | Android | iOS | Unity | Read by |
| --- | --- | --- | --- | --- |
| Marketing version | `versionName` | `CFBundleShortVersionString` | Version in Player settings, `PlayerSettings.bundleVersion`, and `Application.version` at run time | Players, the store listing, support |
| Build number | `versionCode`, a positive whole number | `CFBundleVersion` | `PlayerSettings.Android.bundleVersionCode` and `PlayerSettings.iOS.buildNumber` | The stores, and a device deciding which build is newer |

One field sets the marketing version on both platforms. With Version set to 2.3.0, the test exports of [[#release-build-variants]] carried `versionName "2.3.0"` in the [[Gradle]] project and a `CFBundleShortVersionString` of 2.3.0 in the [[Info.plist]]. The build numbers are two fields, and they wrote `versionCode 20300` and a `CFBundleVersion` of 20300 into the same exports. A new Unity 6.3 project starts at version 1.0, version code 1 and build number 0.

Players read the marketing version, and many builds share one: each build of 2.3.0 that QA tests carries 2.3.0. The stores tell those builds apart by their build numbers. [Android's versioning guide](https://developer.android.com/studio/publish/versioning) calls `versionCode` an internal version number, says that Google Play refuses an upload whose `versionCode` an earlier version used, and, as checked in September 2026, puts the largest value Google Play allows at 2,100,000,000; a device, as [[#sdk-upgrades]] showed, installs no update whose version code is lower than the installed one's. [[App Store Connect]] identifies a build by its bundle ID, version and build string together, and [Apple's guide to preparing an app for distribution](https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution) lets the build strings of iOS apps start again at 1 for a new version. One rule satisfies both stores: a number that rises with each upload of the app and never repeats.

So CI assigns the build number, and nobody types it. A person who forgets to raise it has the upload refused, and two people who raise it on two branches make two builds with one number. The counter has to rise across everything that can upload:

- A CI job's own build number, such as [`BUILD_NUMBER` in Jenkins](https://www.jenkins.io/doc/book/pipeline/jenkinsfile/), counts that job's builds. A multibranch Pipeline creates an item for each branch that holds a Jenkinsfile, as [Jenkins's documentation](https://www.jenkins.io/doc/book/pipeline/multibranch/) describes, and each of those jobs numbers its own builds, so two branches that both upload repeat each other's numbers. It works as a build number when one job makes every build that can be uploaded, or when a counter that all jobs share hands the numbers out.
- A number derived from the marketing version, such as 2030105 for the fifth build of 2.3.1, sorts as the versions do, so a hotfix of 2.3.0 numbers above each 2.3.0 build and below each 2.4.0 build. It allows 99 builds per version, and two branches that build one version still need a counter they share. Unity's option to build one APK for each CPU architecture derives their version codes from this field, and [its reference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PlayerSettings.Android-bundleVersionCode.html) asks for a value below 100000 for those codes to be valid, which this scheme exceeds; [[AAB|app bundles]] are not split that way.
- The time, in seconds since 1970, rises while the build machines' clocks agree, and two builds started in the same second get one number, so it still needs a single place that hands the numbers out. It also passes Google Play's limit on July 18, 2036, a date that follows from the limit checked in September 2026; minutes since a fixed date last far longer.

The marketing version names a release and the build number an upload, but neither says what went into the build. *The Game Layer*, in its chapter “Mobile graphics, memory, and platform constraints”, asked diagnostic records to carry the binary version, the content version, the SDK versions and the configuration revision, since a bug that appears with one content revision cannot be reproduced from the binary's version alone. A build stamp carries them in the build itself. The CI build step writes it, and the game reads it at start-up:

```csharp
using System;
using UnityEngine;

// Written into each build by the CI build step, and read at start-up for logs and crash reports.
[Serializable]
public sealed class BuildStamp
{
    public string version;          // the marketing version that players see
    public int build;               // versionCode on Android, CFBundleVersion on iOS
    public string commit;           // the commit the build was made from
    public string contentRevision;  // the content the build shipped with
    public string[] packages;       // "name version" for each package in the project

    public static BuildStamp Load() =>
        JsonUtility.FromJson<BuildStamp>(Resources.Load<TextAsset>("build-stamp").text);
}
```

```csharp
using System;
using System.Globalization;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Profile;
using UnityEditor.Build.Reporting;
using UnityEngine;
using PackageInfo = UnityEditor.PackageManager.PackageInfo;

// CI runs: Unity -batchmode -quit -projectPath . -executeMethod StoreBuild.Run
// with BUILD_PROFILE, BUILD_NUMBER, GIT_COMMIT, CONTENT_REVISION and BUILD_OUTPUT set.
public static class StoreBuild
{
    public static void Run()
    {
        // Player settings calls read and write the active profile's settings, which may be its own copy,
        // so the profile to build is made active before anything is set.
        BuildProfile.SetActiveBuildProfile(
            AssetDatabase.LoadAssetAtPath<BuildProfile>(Environment.GetEnvironmentVariable("BUILD_PROFILE")));

        int build = int.Parse(Environment.GetEnvironmentVariable("BUILD_NUMBER"), CultureInfo.InvariantCulture);
        PlayerSettings.Android.bundleVersionCode = build;
        PlayerSettings.iOS.buildNumber = build.ToString(CultureInfo.InvariantCulture);

        var stamp = new BuildStamp
        {
            version = PlayerSettings.bundleVersion,
            build = build,
            commit = Environment.GetEnvironmentVariable("GIT_COMMIT"),
            contentRevision = Environment.GetEnvironmentVariable("CONTENT_REVISION"),
            packages = Array.ConvertAll(PackageInfo.GetAllRegisteredPackages(), p => p.name + " " + p.version),
        };
        Directory.CreateDirectory("Assets/Resources");
        File.WriteAllText("Assets/Resources/build-stamp.json", JsonUtility.ToJson(stamp));
        AssetDatabase.ImportAsset("Assets/Resources/build-stamp.json");

        BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerWithProfileOptions
        {
            buildProfile = BuildProfile.GetActiveBuildProfile(),
            locationPathName = Environment.GetEnvironmentVariable("BUILD_OUTPUT"),
        });
        EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
    }
}
```

The step sets the build numbers, writes the stamp as a JSON file under `Resources`, a file kept out of version control, and builds the profile, so the version code, the stamp and the build all come from one run. The profile is made active first because Player settings calls read and write the settings of the active build profile, and a profile can hold Player settings of its own. In a Unity 6.3 test, a first version of the step set the version code while a profile with its own Player settings was active and then built the store profile: the stamp said 20301, and the store build carried 33333 from the project's shared settings. With the profile it builds made active first, the store build carried 20301, and a profile with Player settings of its own carried the 20302 of its own run.

At start-up the game loads the stamp and logs it in one line with `BuildEnvironment.Name`, then hands its values to the crash reporter as custom keys, through the game's own interface; Crashlytics' `SetCustomKey`, for example, sets a key and value that are sent with the next crash report. Crashlytics already filters its charts by build; the commit, the content revision and the package versions are what the stamp adds. SDKs that arrive as Unity packages appear in `packages`, while a native SDK that [[EDM4U]] resolves is pinned in the lock files of [[#sdk-upgrades]], which the step can add to the stamp as well. The same line goes into the QA overlay and a support screen, and chapter 8's version header can carry the build number beside the version ([[#http-versioning]]). `Application.buildGUID`, a GUID that Unity makes for each build, tells two builds apart without saying what went into either, so it goes into the log line too.

Exercise: Design the version stamp your builds carry: each field, where its value comes from in CI, and where it appears at run time. Then check that two builds made from one commit on two branches cannot receive the same build number.

?? release-build-numbers Why does CI set the build number, rather than a person typing it into Player settings before each release?
* Each upload needs a number no earlier upload used, which a counter provides
- The stores read the build number from the CI system that uploaded the build
- Player settings reset the build number to 1 when the project is opened again
- A number typed by hand is copied into the marketing version that players see
> Google Play refuses a version code that an earlier upload used, and App Store Connect tells the builds of a version apart by their build strings. A person forgets to raise the number, or raises it on two branches at once; a counter in CI does neither, and the build step writes its value into the project before it builds.

?+ Two branches each build in their own job of a multibranch Pipeline, and both use `BUILD_NUMBER` as the version code. What goes wrong?
* Each job counts its own builds, so the two branches produce the same numbers
- Jenkins numbers builds across all branches, so the version codes skip values
- The store renumbers the second branch's uploads so that the two do not clash
- Nothing, since a version code has to be unique within one branch's builds
> `BUILD_NUMBER` counts the builds of one job, and a multibranch Pipeline gives each branch a job of its own. Two branches that can both upload then use each other's numbers, and Google Play refuses a version code that was used before. One job for all uploads, or a counter that all jobs share, keeps the numbers unique.

?+ What does the marketing version tell, and what does the build number tell?
* The marketing version names the release, and the build number orders the uploads
- The marketing version orders the uploads, and the build number is what players see
- Both order uploads, and the store compares whichever of the two is higher
- The marketing version is Android's field, and the build number is iOS's field
> `versionName` and `CFBundleShortVersionString` are shown to players, and many builds share one. `versionCode` and `CFBundleVersion` tell those builds apart: the stores check them on upload, and an Android device compares version codes before it installs an update.

?+ [tf] Two builds uploaded to Google Play for the same release may share a marketing version.
* true
> Each build of 2.3.0 carries 2.3.0 as its `versionName`, and each has a `versionCode` of its own. Google Play refuses a version code that an earlier upload used, and sets no such rule for the marketing version.

?+ A CI build step sets the version code while a profile with Player settings of its own is active, then builds the store profile, which has none. Which version code does the store build carry?
* The one in the shared Player settings, since the step wrote to the other profile
- The one the step set, since Player settings calls write to the project's shared settings
- The one the step set, since a profile build reads the version code last written
- Zero, since a profile without Player settings of its own has no version code
> For an active build profile, Unity's Player settings calls read and write that profile's own values, so the step's write went into the profile that happened to be active. The store profile, which has none, builds with the shared settings. In a Unity 6.3 test, the stamp said 20301 and the store build carried 33333; making the profile to build active before setting anything fixed it.

?? release-build-stamp A crash report from the store says 2.3.0. Why is that not enough to reproduce the crash?
* Many builds carry 2.3.0; the commit, build number, content and SDK versions pick one
- The store rewrites the marketing version, so the report's 2.3.0 is not the team's
- Crash reporters shorten a version to two numbers, which drops the patch number
- The version in a report belongs to the operating system, not to the game itself
> Every build of a release shares its marketing version, and even the build number names an upload, not what went into it. The commit, the content revision and the SDK versions describe the build, and a crash that appears with one content revision cannot be reproduced from the binary's version alone.

?+ [multi n=6] Which values belong in the stamp that each build carries into its logs and crash reports?
* The commit the build was made from
* The revision of the content it shipped with
* The versions of the packages and SDKs in it
- The account of the player who crashed
- The model of the device it runs on
- The time zone of the machine that made the build
> The stamp describes the build: its source, its content and the SDK versions in it, which together let the team make the same build again. The player's account and the device belong to each report, and crash reporters record the device on their own; neither says which build it was, and the build machine's time zone says nothing about the build.

?+ Where do the stamp's values come from?
* The CI build step, which writes them into the build that it makes
- The game at start-up, which reads them from the device and the store
- A file that the release manager edits by hand before each release
- The crash reporter, which fills them in as it uploads each report
> CI knows the build number, the commit and the content revision at the moment it builds, and the build step writes them into the build, so the stamp describes the build it is in. A file edited by hand drifts from the builds, and neither the device nor the crash reporter knows the commit.

?+ Why does the game log the stamp and hand it to the crash reporter at start-up rather than when it crashes?
* A crash can end the process before more code runs, and earlier reports need the stamp too
- The crash reporter reads custom keys once, when its SDK initializes at start-up
- The stamp file is deleted after start-up, so the game has to read it at once
- Custom keys set after the first minute of a session are dropped by crash reporters
> A crash handler runs in a failing process, and a native crash may leave no chance to run C# at all, so the keys are set before anything fails. Crashlytics sends its custom keys with the next crash report, and each error report and log line in between carries the stamp as well.

## Store tracks and staged rollouts {#release-rollouts}

A build reaches players in stages, and each store sets its own. Google Play has [three testing tracks and production](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en). As checked in September 2026, internal testing reaches up to 100 chosen testers, and a new [[AAB|app bundle]] on it becomes available to them within minutes; internal tests might not go through Play's standard policy and security reviews. Closed testing reaches a limited number of chosen testers, and open testing any user who joins from the store listing. The bundle that goes to production is the one that testers approved on a track, with its version code, not a rebuild of the same commit. Apple's [[TestFlight]] has two kinds of testers: internal testers, up to 100 users of the team's [[App Store Connect]] account, and external testers, up to 10,000 people by invitation, where the first build of a version needs a full Beta App Review and later builds of the same version might not. A TestFlight build can be tested for up to 90 days. A version for the App Store then goes through App Review, which covers every version, and Apple takes requests to expedite a review in exceptional cases, such as a fix for a critical bug.

The last stage is gradual on both stores, a [[staged rollout]] on Google Play and a phased release on the App Store, as [[#sdk-upgrades]] introduced. Their controls differ, as checked in September 2026:

| | Google Play staged rollout | App Store phased release |
| --- | --- | --- |
| Who receives it | A percentage of users, new and existing, chosen at random, which the team raises | A random sample of users with automatic updates on, rising from 1% to 100% over seven days; anyone can still download it by hand |
| Stop | Halt: no more users receive the version | Pause, for up to 30 days, with no limit on the number of pauses |
| Users who have it | Stay on it | Stay on it |
| Continue | Resume, which reaches the same users | Resume, or release to all users at once |
| Replace | A new release with a higher version code; staged before the halted one completes, it uses the same group of users | A new version, through App Review |

Halting is not a rollback. It stops the version from reaching users who do not have it yet, and [Google's page on staged rollouts](https://support.google.com/googleplay/android-developer/answer/6346149?hl=en) says that users who already received it remain on it. Apple says that a version on the App Store cannot be reverted, so a fix means a new version, and an Android device installs no lower version code over a higher one ([[#sdk-upgrades]]). The fix reaches players as a new build with a higher build number, tested and released like the one before it. On Google Play, a staged rollout of that fix, started before the broken release completed, uses the same group of users as that release, depending on its percentage, which is the group that needs it.

So a mobile team rolls back on the server. *The Game Layer*, in its chapter “LiveOps, persistence, and safe releases”, set out the tools: several binary versions live at once, a feature flag with a safe default for each risky feature, a kill switch that stops the operation itself rather than hiding the button that starts it, and data changes made in expand-and-contract stages that each live version can read, since reverting code undoes no migration and takes back no reward. Chapter 8 keeps the backend answering each client version it still supports ([[#http-versioning]]), and chapter 7 set a flag's limit: it stops calls that the game makes, not native code that runs without one ([[#sdk-upgrades]]).

What halts a rollout is decided before it starts, since during one, each worrying number comes with a reason to wait. The criteria compare the new version with the previous one over the same hours, because traffic, content and devices change from week to week, and the tools split their figures that way: Google Play's [release dashboard](https://support.google.com/googleplay/android-developer/answer/7383463?hl=en) compares releases on crashes, [[ANR|ANRs]], uninstalls and ratings, and [Crashlytics](https://firebase.google.com/docs/crashlytics/crash-free-metrics) filters its [[crash-free users]] by build. An example for one release:

| Metric | Source | Halt when |
| --- | --- | --- |
| Crash-free users | The crash reporter, by build | 0.3 points or more below the previous version |
| User-perceived ANR rate | [[Android vitals]], by version code | Above the previous version's, or close to Google Play's threshold |
| Purchases completed per purchase started | The backend, by client version | 5% or more below the previous version |
| Sign-ins completed per sign-in started | The backend, by client version | 5% or more below the previous version |
| Server errors per request | The backend, by client version | Twice the previous version's rate |

The thresholds are a team's own, set from its history; what each row needs is a source, a comparison and a value. Two more parts make the criteria usable. Each metric names the sample it needs before anyone reads it. At the first stage, an hour may hold 500 sessions of the new version, and a crash that affects one session in 1,000 appears in them at least once with a probability of about 39%, so a clean first hour says little, and the first stage lasts until the sample is there. And the funnel rows are there because the worst failures often do not crash: a purchase that ends in an error, or a sign-in that never returns, leaves the crash-free rate as it was.

The criteria also name who may halt. Halting costs little, since a halted rollout resumes, while each hour of a bad rollout reaches more players, so the release's owner and whoever is on call can each halt it alone, at once, and the discussion follows. A job can halt it too. In the [Google Play Developer API](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks), each release on a track has a status, and a halted release's APKs are no longer served, while users who already have them are unaffected; App Store Connect's API manages phased releases. A job that reads the criteria can then stop a rollout when a threshold passes, at any hour.

Exercise: Write the halting criteria for your next release: each metric, its source, its comparison with the previous version, its threshold, the sample it needs, and the people who may halt the release.

?? release-halt-rollout A staged rollout on Google Play reaches 20%, crashes rise, and the team halts it. What happens to the players who already updated?
* They keep the new version; halting stops deliveries to users who lack it
- Google Play reinstalls the previous version on their devices within a day
- The new version stops opening on their devices until a fix is published
- They return to the previous version the next time the Play Store app updates
> Halting stops the release from reaching more users, and Google's page on staged rollouts says that users who already received it remain on it. Android installs no lower version code over a higher one, so the way back for those players is forward, through a new build with a higher version code.

?+ After the halt, how does the fix reach the players who have the broken version?
* As a new build with a higher version code, released through the tracks again
- By resuming the halted rollout once the backend has been fixed for it
- By uploading the previous build again, which the store then offers as an update
- Through the store's rollback, which reinstalls the version before the broken one
> A device installs no update with a lower version code, and the previous build's is lower, so the fix is a new build with a higher one, tested and rolled out like any other. A staged rollout of it, started while the halted release is incomplete, uses that release's group of users, depending on its percentage. Resuming the halted rollout would send the broken version to more players.

?+ An App Store phased release is paused on its third day. Who can still get the new version?
* Anyone who downloads or updates the app by hand from the App Store
- Nobody, until the team resumes the release or submits another version
- Users with automatic updates on, on the schedule they had before the pause
- TestFlight testers alone, since the App Store stops offering the version
> A phased release controls automatic updates, and Apple says that apps and updates in a phased release can be downloaded by hand from the App Store by anyone at any time. Pausing stops the automatic updates; users who already updated keep the version, and those who ask for it get it.

?+ [tf] Halting a staged rollout on Google Play returns the players who updated to the previous version.
* false
> Halting stops the version from reaching users who do not have it. Users who already received it remain on it, and the fix reaches them as a new build with a higher version code.

?+ A new version corrupts some players' saves, and its rollout is halted. What limits the damage for the players who already have it?
* A server-side switch that stops the operation, if the version checks one
- The halt, which also stops the new version from running on their devices
- A new build with a lower version code, so the store installs the older code
- A refund of their purchases, after which the store removes the version
> The players who have the version keep it until a fix arrives, so what protects them in the meantime is on the server: a kill switch that stops the operation that corrupts saves, as *The Game Layer* describes, if the version was built to check one. The halt protects the players who do not have the version yet.

?? release-halting-criteria When are a rollout's halting criteria decided?
* Before the rollout starts, with a threshold per metric and the people who may halt
- At each stage, once that stage's numbers are in and the team can discuss them
- After the first halt, so that the thresholds come from a failure the team has seen
- When the store's own thresholds are reached, since those thresholds set the criteria
> During a rollout, each worrying number comes with a reason to wait, and a threshold chosen while looking at the numbers tends to land just past them. Criteria set before the rollout, each with a source, a comparison, a value and the people who may act, leave nothing to argue about while the numbers come in.

?+ Why compare the new version's crash-free users with the previous version's over the same hours, rather than with last week's figure?
* Traffic, content and devices change by the week, and the same hours hold them level
- Crash reporters keep one week of data, so last week's figure is gone by then
- The previous version stops sending crashes once the new version is released
- Last week's figure also counts the crashes of TestFlight testers and internal testers
> A new version's figure mixes its own effect with everything else that changed since last week: an event, a campaign, new devices. The previous version, measured over the same hours, meets the same traffic and content, so a difference between the two points at the version rather than at the week, and the random choice of users in a staged rollout keeps the two groups alike.

?+ At a 1% rollout, the new version shows no crashes after an hour of 500 sessions. What does that show?
* Little, since a crash that hits one session in 1,000 would often not appear yet
- That the version is safe to raise to all of its users at once, since none crashed
- That crash reporting is broken in the new version, since new versions crash at first
- That its crash rate is below the previous version's, which crashed in the same hour
> In 500 sessions, a crash that affects one session in 1,000 appears at least once with a probability of about 39%. A clean hour is what a broken build shows most of the time at that size, so each criterion names the sample it needs before it is read.

?+ A purchase flow breaks in a new version without crashing. Which criterion catches it?
* Purchases completed per purchase started, by client version, from the backend
- Crash-free users, since a failed purchase reports an exception to the crash reporter
- The ANR rate, since a stuck purchase screen counts as the app not responding
- The store rating, which drops within the hour when purchases start to fail
> A purchase that ends in an error leaves the crash-free rate as it was, and a screen that waits is not an ANR while the main thread keeps running. A funnel metric counts the purchases that finished against those that started, per client version, and shows the drop directly.

?+ Who may halt a rollout?
* The people the criteria name, each alone and at once, with the discussion after
- The whole release group, once a meeting agrees that the numbers are real
- The store, which halts a rollout when its metrics pass the store's thresholds
- The engineer who wrote the change, who knows whether the metric is related
> Halting costs little, since a halted rollout resumes, while each hour of a bad rollout reaches more players. So the criteria name the people who may halt, and any one of them can do it at once; the meeting comes after the halt, not before it.

## Verify the build the store will ship {#release-verification}

A release candidate is the build that goes to production if nothing is found: the store variant, built once from the release branch, with the version and the build number it will ship with. Every check in this section runs on that build. A fix makes a new candidate and the checks start again, since a rebuild of the same code is another binary with another build number.

The candidate is installed from the store, not from CI, because what CI produces is not what a phone installs:

- Google Play re-signs it. Under [[Play App Signing]], players' copies carry the app signing key, while builds that the team signs carry the upload key, so what recognizes the app by its certificate sees a different one ([[#gradle-packaging-signing]]).
- Google Play splits it. An [[AAB|app bundle]] is never installed as uploaded: [Google Play generates and serves APKs](https://developer.android.com/guide/app-bundle) optimized for each device configuration, so a native library missing for one ABI, or a resource in the wrong split, shows up only in what the store delivers.
- The App Store re-signs it as it distributes it ([[#xcode-build-flow]]), and the `aps-environment` of the build that [[TestFlight]] installs, which its distribution [[provisioning profile]] sets, decides which APNs environment its [[push token]] belongs to ([[#os-notifications]]).
- It arrives as an update. Players have the previous version, with its saves and caches, so a tester who has the production version and joins the test track receives the candidate over it, as players will.

The stores' own channels deliver it this way: the internal testing track on Google Play, and TestFlight on iOS. Google Play's [internal app sharing](https://support.google.com/googleplay/android-developer/answer/9844679?hl=en) looks similar and is not. It re-signs each upload with an Internal App Sharing key that Google creates for the app, and its uploads cannot be part of a release on a testing or production track, so it suits quick installs of work in progress and tests nothing about the signature.

A person then walks the paths that only the whole chain shows:

- Sign-in, against production's client registrations, which recognize the store's signature.
- Purchases. On Google Play, [license testers](https://developer.android.com/google/play/billing/test) have test payment methods that are not charged, while a tester who is not a license tester pays real money for purchases made on a test track. An app installed from TestFlight uses the App Store's sandbox. The backend's verification of each receipt is part of the test.
- Push, sent by the production backend to the token that the candidate registered.
- Links from outside the game: a verified link opened from a browser or a mail app, and the link in a notification.
- The update itself: the candidate installed over the production version, with a save made by that version.

Then the candidate is compared with the previous release. That release is known to work, so the diff shows only what changed, and each changed line is a decision someone can name:

| What | How | What it catches |
| --- | --- | --- |
| The merged manifest | `bundletool dump manifest --bundle` on each app bundle, then `diff` | Permissions and components that an SDK added, `android:debuggable`, cleartext traffic |
| The `Info.plist` | `plutil -p` on each app's `Info.plist` | Usage descriptions, URL schemes, exceptions to [[App Transport Security]] |
| [[Entitlements]] | `codesign -d --entitlements - --xml` on each signed app | `aps-environment`, associated domains, keychain groups |
| Size | `apkanalyzer apk compare` on the APKs, the App Thinning Size Report on iOS | Assets and libraries that should not be there |
| Privacy declarations | The SDKs' documentation and each SDK's [[privacy manifest]], against the store answers | Data that an SDK began to collect |

The manifest, `Info.plist` and entitlement diffs catch the most for the time they take. They are short, and each line is a change to what the app is allowed to do or to what it asks of players: a location permission that an SDK update brought, an exception to App Transport Security that belongs to development builds ([[#xcode-build-settings]]), a debuggable flag. In the test bundles of [[#release-build-variants]], the development bundle's manifest differed from the release bundle's in two lines, the `android.permission.INTERNET` permission and `android:debuggable="true"`, which is what a development build that slipped into a release would show. The size diff catches what arrived without a line anywhere, such as a folder of textures that went under `Resources` by mistake.

Records and settings complete the list:

- The privacy declarations are current. Google Play asks for an accurate Data safety section, kept up to date, and [[App Store Connect]] asks for the privacy answers to be updated when practices change, which an SDK update can do ([[#sdk-consent-init]]).
- This build's symbols are uploaded: its [[dSYM]] files ([[#ios-failure-evidence]]), R8's mapping file ([[#gradle-r8-symbols]]), and the native symbols, which an app bundle can carry to the Play Console and which Unity's Debug Symbols setting produces.
- The stamp that the candidate shows names production, the build number being uploaded and the release branch's commit.
- The weakest device that the game supports passes a smoke test of start-up, a full session, and background and resume, as in [[#platform-testing]]. Google Play's [pre-launch report](https://support.google.com/googleplay/android-developer/answer/9842757?hl=en) adds devices: after an upload, Google installs the app on devices in a test lab, then launches it and crawls it for several minutes with taps, typing and swipes. It explores on its own, with test credentials if the team provides them, so it adds devices to the smoke test and replaces none of its steps.

Exercise: Split this checklist into what a CI job can check and what a person must, and for each item a person checks, name what it would take to automate it.

?? release-store-installed Why is the release candidate installed from the store's test track rather than from the build that CI produced?
* The store signs and splits it as for players, which the CI build does not show
- The store adds its crash reporting to the build as it distributes it to testers
- CI produces a development build, and the test track holds the release build
- A build installed outside the store is unable to reach the production backend
> Under Play App Signing, players' copies carry the app signing key, and Google Play generates the APKs for each device from the bundle; the App Store re-signs as well. A build installed from CI has none of that, so certificate checks, split APKs and entitlements are tested through the store's channel.

?+ Google Play offers internal app sharing and an internal testing track. Which one gives testers the candidate as players will receive it?
* The internal testing track, which delivers a release as the store signs it
- Internal app sharing, since it skips review and reaches testers at once
- Internal app sharing, since it installs exactly the bundle that was uploaded
- Either of them, since both sign with the app signing key before delivering
> Internal app sharing re-signs each upload with an Internal App Sharing key that Google creates for the app, and its uploads cannot join a release on a testing or production track. The internal testing track delivers its release through Google Play as players' copies are delivered, generated from the bundle and signed with the app signing key.

?+ A tester on the closed testing track buys a pack of gems in the release candidate and is charged. Why?
* The tester is not a license tester, so purchases on a test track cost real money
- The candidate points at production, which charges each purchase made on a track
- Test tracks charge a tester's first purchase and refund it after a week
- The purchase went through the sandbox, which bills the tester's real card
> Google's testing guide says that users pay real money for purchases on a test track unless they are license testers, whose test payment methods are not charged. Testers who buy are added as license testers before they test purchases.

?+ [multi n=6] What does a candidate installed from the store's test track exercise that a build installed from CI does not?
* The signature that players' copies carry
* The APKs that Google Play generates for the device
* The update over the production version, made by the store
- The game's C# code, which the store compiles for each device
- The shaders, which the store compiles for each device's GPU
- The analytics SDK, which the store adds to each copy it serves
> The store signs, splits and updates: players' copies carry the app signing key, their APKs come from the bundle, and they arrive over the version before. The store changes none of the code, which IL2CPP compiled before the upload, and it adds no SDK.

?? release-diff-review An SDK update added a location permission to the release candidate. Which comparison with the previous release shows it?
* The diff of the two releases' merged manifests
- The diff of the two releases' download sizes
- The diff of the two releases' crash-free users
- The diff of the two projects' Gradle templates
> The permission reaches the app through the SDK's own manifest, which Gradle merges into the app's, so the merged manifest is where it appears, and `bundletool dump manifest` prints it from each bundle. The project's templates do not change when an SDK brings a permission, and neither size nor crashes say anything about it.

?+ The candidate's `Info.plist` diff shows `NSAllowsArbitraryLoads` set to true, which the previous release did not have. What is the likely cause?
* “Allow downloads over HTTP” is `AlwaysAllowed`, or this is a development build
- An SDK's privacy manifest added it, since privacy manifests carry network exceptions
- Xcode adds it to the archives that TestFlight distributes, for their crash uploads
- The App Store adds it as it re-signs the app, and the diff read the store's copy
> Unity writes `NSAllowsArbitraryLoads` when “Allow downloads over HTTP” is `AlwaysAllowed`, and in development builds when it is `DevelopmentOnly` ([[#xcode-build-settings]]). In a candidate, either is a setting or a variant to fix before the upload, since the key lets each connection in the app, an SDK's included, use plain HTTP.

?+ A release candidate's merged manifest shows `android:debuggable="true"`, which the previous release did not have. What does that say?
* The candidate is a development build, which Gradle builds with its debug build type
- A native plugin was compiled with debug symbols, which marks the app debuggable
- Minify was turned off for the release build type, which marks the app debuggable
- The candidate was signed with the upload key, which Android treats as debuggable
> In the test bundles of this chapter, the development build ran Gradle's `bundleDebug`, and its manifest was the one with `android:debuggable="true"`, beside an internet permission that the release build did not request. A candidate with those lines is the wrong variant, and the diff shows it before the upload.

?+ Why diff the candidate against the previous release rather than review its whole manifest?
* The previous release is known to work, so each changed line is a decision to check
- The stores reject a manifest that differs from the previous release's manifest
- A whole manifest is unreadable, since Unity encrypts the parts that it writes
- A diff is the format the stores ask for when a release adds a permission
> A merged manifest holds hundreds of lines, most of them from Unity and the SDKs, and nobody reviews them all at each release. The previous release shipped and worked, so the lines that differ are the ones that need a decision: a permission, a component, a flag.

?+ Which comparison catches a folder of textures that went under `Resources` by mistake?
* The size comparison with the previous release, per device configuration
- The merged manifest diff, which lists each file that the bundle holds
- The entitlements diff, which lists each resource that the app can open
- The Data safety answers, which list the files that the app stores
> The textures change no permission, key or entitlement, so the diffs of the manifest, the `Info.plist` and the entitlements stay the same. They add megabytes to the download, which the size comparison per device configuration shows.
