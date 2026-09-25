---
book: unity-mobile-platform-engineering
chapter: 06: iOS builds: Xcode, signing, and CocoaPods
---

## From Unity to an IPA {#xcode-build-flow}

A Unity iOS build ends in Xcode, as an Android build ends in Gradle ([[#gradle-project]]). Unity writes an Xcode project, and Apple's tools do the rest: they compile and link it, sign it, package it and upload it. Xcode runs on macOS alone, so [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/iphone-BuildProcess.html) says that a local iOS build needs a Mac, and a team without one builds on a Mac elsewhere, such as Unity's Build Automation service. Chapter 11 hands the project from one CI agent to another.

From a Unity project to a build on [[App Store Connect]], Apple's service for testing and publishing apps, the path has five steps:

1. Unity compiles the game's C#, [[IL2CPP]] converts it into C++, and Unity writes the Xcode project, replacing the folder or appending to it, as [[#ios-xcode-postprocess]] describes.
2. Xcode builds the three targets that make up the app, `GameAssembly`, `UnityFramework` and `Unity-iPhone`, which [[#ios-runtime-model]] describes. The `GameAssembly` target compiles IL2CPP's C++ in a script phase, which starts IL2CPP's own build driver, and the driver compiles the C++ into `libGameAssembly.a` with Xcode's compiler and with flags of its own.
3. `xcodebuild archive` builds the scheme's archive configuration and stores the result as an `.xcarchive`.
4. `xcodebuild -exportArchive` re-signs the archived app for one distribution method and packages it as an IPA, the `.ipa` file in which an iOS app is installed or uploaded.
5. The IPA reaches App Store Connect through Xcode, Apple's Transporter app, the `altool` command-line tool, or the export itself.

The second step explains where some warnings come from. In a test archive of a Unity 6.3 export, built with Xcode 27, the targets that Xcode compiled itself built for iOS 15.0, the export's deployment target, while IL2CPP's driver compiled for iOS 11.0. All 56 warnings in which Xcode's C++ library said that it no longer supported the chosen iOS version came from the `GameAssembly` phase. A warning or an error there comes from IL2CPP's build, whose flags the target's build settings do not show: `xcodebuild -showBuildSettings` gives `GameAssembly` a deployment target of 15.0.

Unity's project has four build configurations: Debug, Release, ReleaseForRunning and ReleaseForProfiling. Its `Unity-iPhone` scheme archives with Release, and in Release the build writes debug symbols into [[dSYM]] files rather than into the binaries (`DEBUG_INFORMATION_FORMAT = dwarf-with-dsym`): one for the app's executable, and one for `UnityFramework` that covers everything linked into it, `GameAssembly` included. That is how Apple's release builds keep the distributed app small. The two commands that follow Unity's export:

```bash
# Archive Unity's export. With CocoaPods, pass -workspace Unity-iPhone.xcworkspace instead of -project.
xcodebuild archive -project Unity-iPhone.xcodeproj -scheme Unity-iPhone \
  -destination 'generic/platform=iOS' -archivePath build/Game.xcarchive

# Re-sign and package the archived app for one distribution method.
xcodebuild -exportArchive -archivePath build/Game.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/AppStore
```

The archive is a folder. The test archive, built unsigned with `CODE_SIGNING_ALLOWED=NO`, as a CI pipeline might build one, held these parts:

| Path in the archive | What it holds |
| --- | --- |
| `Products/Applications/<Product>.app` | The app as Xcode built it: 23 MB in the test, and unsigned, since signing was off |
| `dSYMs/` | A dSYM for the app's executable and one for `UnityFramework`, 123 MB together in the test, each with the same UUID as its binary |
| `Info.plist` | The archive's record of the build: bundle identifier, version, build number, signing identity and team, the last two empty in the test |
| `Signatures/` | A file for each xcframework that the build used, static or dynamic |

The export works from the archive and leaves it unchanged. It re-signs the app with the certificate and profile that its method calls for and writes the IPA, and the same archive can be exported again for another method, since Xcode repackages the archive's contents for each distribution ([Apple's distribution guide](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)). The IPA is the distributed app, which a release build keeps small by leaving its debug symbols in the dSYMs. An App Store export can carry the build's symbols to Apple when its `uploadSymbols` option is on, so that Apple adds names to the crash reports that Xcode's Crashes organizer shows; any other tool that names frames, such as `atos` or a crash-reporting SDK, needs the dSYMs themselves, and the archive is where they are. The options come from a property list:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>destination</key>
    <string>export</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>teamID</key>
    <string>A1B2C3D4E5</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.example.game</key>
        <string>Game App Store</string>
    </dict>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
```

The method decides where the build can go, because it decides what the app is signed with:

| `method` | Where the build can go | What the export signs it with |
| --- | --- | --- |
| `app-store-connect` | [[TestFlight]] and the App Store, through App Store Connect | A distribution certificate and an App Store profile, which lists no devices; the App Store re-signs the app when it distributes it |
| `release-testing` | The registered devices that its profile lists | A distribution certificate and an ad hoc profile |
| `enterprise` | The members of an organization in the Apple Developer Enterprise Program | An in-house profile, which covers all devices |
| `debugging` | Registered devices, for development and testing | A development certificate and a development profile |

Xcode 27 still accepts the older names `app-store`, `ad-hoc` and `development`, and its `xcodebuild -help` marks them deprecated. With `destination` set to `upload`, the export sends the app to App Store Connect instead of writing an IPA.

The export takes its team from the archive: the `teamID` option defaults to the team the archive was built with. The test archive had none, and each export of it, for two methods and both signing styles, stopped with `No Team Found in Archive` before looking for a certificate. Given a made-up `teamID`, the export went one step further and stopped at the certificate: `No "iOS Distribution" signing certificate matching team ID "ABCDE12345" with a private key was found.` An unsigned archive records no team even when the build names one: archived again with `CODE_SIGNING_ALLOWED=NO` and a team in `DEVELOPMENT_TEAM`, the test project's archive still had an empty team, and its export stopped the same way. A pipeline that archives without signing therefore names the team in the export options, and signs at export with the identity that the next section describes.

App Store Connect accepts uploads from Xcode's Organizer, from Transporter, from `altool`, and from an export whose destination is `upload`, and its API has resources for build uploads as well ([Apple's upload guide](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)). The same page lists the Xcode versions that App Store Connect accepts builds from. As read in September 2026, an iOS app had to be built with Xcode 26 or later, a higher bar than the Xcode 16 that Unity 6.3 requires, so the Mac that builds the game follows the store's minimum rather than the engine's.

Lab exercise: Archive a Unity iOS export from the command line, list the archive's folders, and compare the UUIDs of the app, `UnityFramework` and the two dSYMs with `dwarfdump --uuid`. Then export the archive with `-exportArchive`. With a team and its certificates, export it twice, for `debugging` and for `app-store-connect`, and compare the two IPAs; without them, read which step stops the export, and with what message.

?? xcode-archive-contents A crash-reporting SDK needs the dSYMs of the release that shipped two weeks ago. Where does the team find them?
* In the release's Xcode archive, which keeps a dSYM for each binary
- In the app binary inside the IPA, since release builds keep their symbols
- On App Store Connect, which offers the dSYMs of each uploaded build
- In the crash reports themselves, which carry the symbols of each frame
- In the Unity project's `Library` folder, where IL2CPP keeps them
> A release build writes its debug symbols into dSYM files rather than into the binary, and `xcodebuild archive` gathers a dSYM for each binary into the archive. App Store Connect offers debug symbols for download only for old bitcode submissions, and a crash report holds addresses rather than names, so the archive, or a copy of its `dSYMs` folder, is the source.

?+ In a test, the archive of a Unity export held a 23 MB app and 123 MB of dSYMs. What reaches the players' devices?
* The app, re-signed by the export, while the dSYMs stay in the archive
- The app and its dSYMs, which iOS reads to name the frames of a crash
- The app and a stripped copy of each dSYM, packed into the IPA
- The dSYMs, from which each device rebuilds the stripped app on install
- The whole archive, which the store unpacks for each device model
> Release builds keep debug symbols out of the binary so that the distributed app stays small. The export packages the app, re-signed for its method, and leaves the dSYMs in the archive. Names are added to crash reports later, by Xcode on a Mac that has the dSYMs, or by Apple from symbols uploaded with the build.

?+ Why keep each release's `.xcarchive`, and not only the IPA that was uploaded?
* It keeps the dSYMs, and the app can be exported from it again
- It holds the private key that signed the IPA, for the next release
- App Store Connect asks for it before it accepts the next build
- Xcode derives the next build number from the last archive it finds
- Test devices refuse an IPA once its archive has been deleted
> The archive holds the build as Xcode made it, with a dSYM for each binary. The dSYMs name the frames in that build's crash reports, and the archive can be exported again, for another method or after a signing problem, without building the game again.

?+ An App Store export's options turn on `uploadSymbols`. What does that give the team?
* Names in the crash reports that reach Xcode's Crashes organizer
- dSYMs that a crash-reporting SDK can download from App Store Connect
- A smaller IPA, since the symbols leave the app before it is uploaded
- Crash reports symbolicated on testers' devices before they are sent
- Debug symbols inside the app binary, so reports arrive with names
> With symbols uploaded alongside the build, the App Store adds names to crash reports before it delivers them to the Crashes organizer; without them, the reports arrive unnamed. A crash-reporting SDK or `atos` still needs the dSYMs themselves, which stay in the archive.

?? xcode-export-method One archive has to reach testers' registered iPhones this week and App Store Connect next week. What differs between the two exports?
* The method, which picks the certificate and profile used to re-sign
- The build configuration, so that each channel needs its own archive
- The bundle identifier, since each channel needs an App ID of its own
- The scheme, since Unity's project has one scheme for each channel
- The dSYMs, which each method regenerates for the binary it signs
> The archive is built once. `-exportArchive` re-signs the app for the method its options name: `release-testing` with a distribution certificate and an ad hoc profile that lists the testers' devices, and `app-store-connect` with an App Store profile for upload. Nothing is rebuilt, so the same dSYMs serve both.

?+ Which devices can install an app exported with the `release-testing` method?
* The registered devices that its provisioning profile lists
- The devices of testers who accepted a TestFlight invitation
- The devices of the organization, as with an in-house build
- Any device, once the build has passed App Review
- The developers' own devices, since it is signed for development
> A release-testing build, which Xcode called ad hoc before it renamed the method, is signed for distribution with an ad hoc profile, and the profile lists the registered devices it may run on. TestFlight builds go through App Store Connect, and in-house profiles, which cover all devices, belong to the Enterprise Program.

?+ CI archives with `CODE_SIGNING_ALLOWED=NO` and a team in `DEVELOPMENT_TEAM`, and `-exportArchive` stops with `No Team Found in Archive`. Which change gets the export past that check?
* A `teamID` entry in the export options, naming the team to sign for
- Automatic signing in the export options, so that Xcode picks the team
- The `debugging` method, which signs with no team for local testing
- A second `pod install`, so that the workspace records the team
- A removed archive `Info.plist`, since it stores the empty team
> The export takes its team from the archive unless its options name one, and an unsigned archive records no team, whatever `DEVELOPMENT_TEAM` says. In tests, exports of such an archive failed this way for two methods and both signing styles; with `teamID` in the options, the export went on to look for that team's distribution certificate, the next thing it needs.

## Certificates, identifiers, profiles, and entitlements {#xcode-signing-model}

iOS runs only code that Apple has authorized. On a device, the authorization is a [[provisioning profile]] embedded in the app, and the device checks the app against it when the app runs. An app installed from the App Store carries none: the App Store checks the app while it distributes it and re-signs it, as Apple's [TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles) explains. Signing is therefore a set of parts that have to agree, and a signing failure is one of them missing, wrong or expired.

The first part is the signing identity: a certificate, and the private key that matches the public key in it ([TN3161](https://developer.apple.com/documentation/technotes/tn3161-inside-code-signing-certificates)). The certificate is public, and Apple issues it. With a certificate signing request, the key is created on the Mac that makes the request, in its login keychain, and it stays there unless someone exports it. A CI agent that has the certificate without the key has no identity. The certificate types for signing iOS apps include Apple Development, for running an app on devices while it is developed, and Apple Distribution, for sending it to test devices or to App Store Connect ([Apple's certificate overview](https://developer.apple.com/help/account/certificates/certificates-overview)).

The second is the App ID, the app's identity in the team's account: an App ID prefix and the bundle identifier, such as `A1B2C3D4E5.com.example.game`. An explicit App ID names one app, and a wildcard such as `A1B2C3D4E5.com.example.*` covers a set. The App ID also carries the capabilities that the app may use, such as push notifications or associated domains, which reach the app as [[entitlements]].

The provisioning profile ties the parts together, and TN3125 names the property that holds each one:

| Question | Property | What it holds |
| --- | --- | --- |
| Who may sign? | `DeveloperCertificates` | The certificates whose identities can sign the code that the profile covers |
| Which app? | `application-identifier`, under `Entitlements` | An App ID, explicit or wildcard |
| Where may it run? | `ProvisionedDevices` or `ProvisionsAllDevices` | A device list in development and ad hoc profiles, all devices in in-house profiles, and neither in App Store profiles |
| What may it use? | `Entitlements` | The allowlist of entitlements that the app may claim |
| Until when? | `ExpirationDate` | The date on which the profile stops being valid |

A profile is a property list inside a signed wrapper, and `security` removes the wrapper:

```bash
security cms -D -i Game_AppStore.mobileprovision -o profile.plist   # the property list inside
plutil -extract ExpirationDate raw -o - profile.plist
plutil -extract Entitlements xml1 -o - profile.plist
plutil -extract ProvisionedDevices xml1 -o - profile.plist          # fails for an App Store profile, which has none
```

The app's entitlements come from its `.entitlements` file, which a capability in Xcode or a post-processor's `ProjectCapabilityManager` writes ([[#ios-xcode-postprocess]]), and from what Xcode adds as it signs, from the team's account and the project. Each entitlement that the app claims has to be in the profile's allowlist; the reverse does not hold, since a profile may allow more than the app uses. The profile also sets values: `aps-environment`, which decides whether push tokens belong to APNs's sandbox or to production, comes from the profile that the build is signed with ([[#os-notifications]]). A capability that a post-processor adds therefore needs two changes in the team's account as well: the capability enabled on the App ID, and the profiles that use that App ID regenerated, since a change to an App ID invalidates them ([Apple's capability guide](https://developer.apple.com/help/account/identifiers/enable-app-capabilities)).

Xcode can manage all of this. With automatic signing, it picks the identity and creates or updates the App ID, the certificate and the profile in the team's account as a build needs them. On the command line, `xcodebuild` talks to Apple for that only when it is given `-allowProvisioningUpdates`, and only with an account signed into Xcode or an [[App Store Connect]] API key passed with `-authenticationKeyPath`, `-authenticationKeyID` and `-authenticationKeyIssuerID`. With manual signing, the project names each part: `CODE_SIGN_STYLE = Manual`, the team in `DEVELOPMENT_TEAM`, the identity in `CODE_SIGN_IDENTITY` and the profile in `PROVISIONING_PROFILE_SPECIFIER`. Unity fills these in from Player Settings: `PlayerSettings.iOS.appleDeveloperTeamID` is the team, `appleEnableAutomaticSigning` asks Xcode to sign automatically for that team, and `iOSManualProvisioningProfileID`, a profile's UUID, with `iOSManualProvisioningProfileType`, is the profile for manual signing.

Manual signing suits CI better. Automatic signing makes a build depend on what the agent holds, an account or an API key, and with `-allowProvisioningUpdates` a build may create certificates and profiles in the team's account while it runs. Manual signing, with an identity and a profile that the pipeline installs from its secrets, gives the same result on each agent, and chapter 11 covers where those secrets live.

Every part has a date. A certificate is valid for a range of dates, and a profile carries its `ExpirationDate`. TN3125, as read in September 2026, says that a profile's validity varies by type and is typically not more than a year, and Apple's account help says that a free personal team's profiles expire seven days after they are issued. What an expiry breaks depends on how the app was distributed. An App Store app keeps working when the team's distribution certificate expires or is revoked, because the App Store re-signed it with credentials that do not expire; what stops is uploading builds signed with that certificate. An in-house app stops running when the certificate that signed it expires or is revoked. A revoked certificate invalidates each profile that contains it, and an expired or invalid profile has to be regenerated and the app re-signed with the new one ([Apple's profile guide](https://developer.apple.com/help/account/provisioning-profiles/edit-download-or-delete-profiles)).

So a build that passed yesterday can fail today with no change to the project: the certificate expired, someone revoked it, or a capability changed on the App ID and invalidated the profile. `security find-identity -p codesigning` lists the identities an agent can sign with, and a decoded profile shows its expiry date, so a pipeline can check both before it builds and warn weeks ahead.

Exercise: Decode a provisioning profile that your team signs with, and read its App ID, its entitlements, its device list if it has one, and its expiry date. Then write down what breaks on that date, for which builds, and who would notice first.

?? xcode-profile-binding A `release-testing` build installs on four testers' iPhones and fails to install on a fifth. What is the likely cause?
* The fifth iPhone is missing from the devices that the profile lists
- The fifth iPhone runs a newer iOS than the SDK the build was made with
- The profile allows four installs per build, and the fifth went over
- The fifth tester has no TestFlight invitation for this build
- The build's development certificate expired during the install
> A development or ad hoc profile carries the list of devices it provisions, and a device checks the app against its profile. A device that was registered after the profile was made, or never registered, is not on that list: register it, regenerate the profile, and export again.

?+ A post-processor adds the Associated Domains entitlement to the build. What else has to change before a signed build can use it?
* The App ID's capability, and the profiles regenerated to allow it
- Nothing, since Xcode signs whatever the entitlements file claims
- The certificate, which lists the entitlements its holder may sign
- `UnityFramework`'s own entitlements, since the link-handling code is there
- The `Info.plist`, which declares the domains that the app may open
> A profile's entitlements are an allowlist, and each entitlement the app claims has to be on it. The capability is enabled on the App ID first; changing the App ID invalidates the profiles that use it, so they are regenerated with the new entitlement and the build is signed with one of them.

?+ The pipeline installs the team's distribution certificate file on a new agent, and signing finds no identity. What is missing?
* The private key that belongs to the certificate, kept in a keychain
- The device list of the profile, which the agent has to register
- A signed-in Apple account, without which Xcode ignores certificates
- The App ID's capabilities, which the certificate needs beside it
- A development certificate, which distribution signing also uses
> A signing identity is a certificate together with the private key that matches its public key. A certificate file on its own holds the public half, so the agent needs the key as well, imported into the keychain that it signs from.

?+ A push-enabled build receives sandbox tokens, though production was meant. Which part of signing decided that?
* The profile, whose `aps-environment` the signed app takes as its own
- The iOS version on the device, since beta versions use the sandbox
- The `UIBackgroundModes` key, whose `remote-notification` value picks it
- The APNs server, which checks whether the device joined TestFlight
- The bundle identifier, whose suffix marks the production builds
> The profile that the build is signed with sets `aps-environment`, and its value decides whether the device's token belongs to APNs's sandbox or to production. The fix is signing with the profile meant for production.

?? xcode-expiry A nightly iOS build that passed yesterday fails at signing today, and nothing was committed. What should the team check first?
* The certificate and profile it signs with, for expiry or revocation
- The agent's derived data, which a clean build of the project would reset
- Unity's license on the agent, which signs the exported project
- Yesterday's build in App Review, which holds new signatures
- The App Store profile's device list, which drops old devices
> Certificates and profiles carry dates, and a certificate can be revoked, or a profile invalidated by a change to its App ID, all without a commit. `security find-identity -p codesigning` shows the identities that the agent can still use, and a decoded profile shows its expiry date.

?+ The team's App Store distribution certificate expired last night. What happens to the version players installed from the App Store?
* It keeps working, and uploads need a certificate that is valid
- It stops launching until players install a build with a new certificate
- It keeps working for a grace period, then stops until the renewal
- It keeps working on devices that go online to fetch a new signature
- It stops receiving push notifications, which the certificate signs
> The App Store re-signs apps with credentials of its own, so an installed App Store app does not depend on the team's distribution certificate. The expiry stops something else: builds signed with that certificate can no longer be uploaded, so the next release needs a new certificate and profile.

?+ An in-house (enterprise) build's distribution certificate is revoked. What happens to the copies that employees installed?
* They stop running, since they depend on the certificate that signed them
- They keep running, since Apple re-signed them as it does for the store
- They keep running, and the revocation stops new installs alone
- They keep running for the membership's grace period, then stop
- They stop running once their profile's expiry date also passes
> In-house apps are not re-signed by Apple: they run under the team's own certificate and profile, and Apple's certificate guide says that users can no longer run apps signed with an in-house certificate that has expired or been revoked. The certificate's date is an outage date for each installed copy.

?+ How can a pipeline see a signing expiry coming instead of failing on it?
* Decode each profile it signs with and warn on its `ExpirationDate`
- Read the expiry from the IPA's `Info.plist`, where the export records it
- Run `pod install --deployment`, which validates the signing assets
- Compare the archive's build number with the one inside the profile
- Wait for the first failed build, whose log reports the date it passed
> A profile's `ExpirationDate` is in the profile itself: `security cms -D -i` removes the signed wrapper and `plutil -extract` reads the date, so a scheduled job can warn weeks ahead. `security find-identity -p codesigning` shows which identities on an agent are still valid.

## Build settings and Info.plist keys that decide whether the app runs {#xcode-build-settings}

Most of a Unity export's settings come from Player Settings and need no attention. A few decide whether the build links, whether the app runs, or whether App Store Connect accepts it, and SDKs and post-processors change them ([[#ios-xcode-postprocess]]). `xcodebuild -showBuildSettings` prints the values that a target builds with, and in a Unity 6.3 export these stood as follows:

| Setting | In Unity 6.3's export | Why it matters |
| --- | --- | --- |
| `IPHONEOS_DEPLOYMENT_TARGET` | 15.0 on each target, the oldest iOS that Unity 6.3 supports | An SDK that needs a newer iOS fails `pod install`, whose message says that the specs it found “required a higher minimum deployment target” |
| `-ObjC` in `OTHER_LDFLAGS` | Set on `UnityFramework` and `GameAssembly` | It loads each member of a static library that holds an Objective-C class or category ([QA1490](https://developer.apple.com/library/archive/qa/qa1490/_index.html)). Without it, a category method in a static library is left out, and calling it raises “selector not recognized” at run time |
| `SWIFT_VERSION` and `ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES` | 5.0 and NO | The Swift runtime has shipped with the OS since iOS 12.2, so an app for iOS 15 embeds none |
| `ENABLE_BITCODE` | NO | Xcode 14 deprecated bitcode, and the App Store stopped accepting it from Xcode 14 on ([Xcode 14 release notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-14-release-notes)). Post-processors that still switch it off are harmless leftovers |

Networking has a policy of its own. [[App Transport Security]] requires connections made through the URL Loading System, `URLSession` and the classes around it, to use HTTPS, unless the [[Info.plist]] declares an exception under `NSAppTransportSecurity` ([Apple's reference](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity)):

| Key | What it allows |
| --- | --- |
| `NSAllowsArbitraryLoads` | Plain HTTP for the whole app: a global exception applies to each connection the app makes, except those to domains listed under `NSExceptionDomains` |
| `NSExceptionDomains` | Settings for named domains, such as `NSExceptionAllowsInsecureHTTPLoads` to allow plain HTTP to one server |
| `NSAllowsLocalNetworking` | Connections to unqualified host names, `.local` names and IP addresses |

Apple's pages add that from iOS 17, ATS no longer allows connections to IP addresses by default, and that IP addresses and ranges can then be listed under `NSExceptionDomains`.

Unity's own requests come under the same policy on iOS, because the Trampoline's `UnityWebRequest` code is built on `NSURLSession`, and Unity puts a check of its own in front of them, whatever the platform. The Player Setting “Allow downloads over HTTP”, [`InsecureHttpOption`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/InsecureHttpOption.html) in scripts, decides whether `UnityWebRequest` may use plain HTTP: `NotAllowed`, the default, `DevelopmentOnly` or `AlwaysAllowed`. Test exports with Unity 6.3 showed what each value writes into the two platforms' projects:

| Value | iOS `Info.plist` | Android project |
| --- | --- | --- |
| `NotAllowed` | Nothing | Nothing |
| `DevelopmentOnly`, release build | Nothing | Nothing |
| `DevelopmentOnly`, development build | `NSAllowsArbitraryLoads` set to true | Nothing |
| `AlwaysAllowed` | `NSAllowsArbitraryLoads` set to true | Nothing |

So the switch that lets `UnityWebRequest` reach one development server over HTTP lifts ATS for the whole iOS app, an SDK's `URLSession` requests included, in each build it applies to. On Android, Unity writes nothing: Android turns cleartext traffic off by default for apps that target Android 9 or later ([Android's behavior changes](https://developer.android.com/about/versions/pie/android-9.0-changes-28)), so a native Android SDK that uses plain HTTP needs its domain allowed in the app's network security configuration. Whether Unity's own request code on Android consults that policy is a question for a device, which these tests did not use. In a project with default settings, a development server over plain HTTP fails on both platforms, at Unity's own check. When it works on one platform and not the other, the difference lies in which client makes the request and which exceptions each platform's build carries.

A narrower exception keeps ATS for everything else. With the setting at `DevelopmentOnly`, a post-processor can replace the global exception that Unity writes into development builds with one for the test server. It removes the global key rather than the whole dictionary, so ATS keys that an SDK added stay:

```csharp
#if UNITY_IOS
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.iOS.Xcode;

// Development builds reach the test server over plain HTTP; other connections keep ATS.
class TestServerAtsException : IPostprocessBuildWithReport
{
    const string TestServer = "dev.example.test";

    public int callbackOrder => 1000;

    public void OnPostprocessBuild(BuildReport report)
    {
        if (report.summary.platform != BuildTarget.iOS) return;
        if ((report.summary.options & BuildOptions.Development) == 0) return;

        string path = Path.Combine(report.summary.outputPath, "Info.plist");
        var plist = new PlistDocument();
        plist.ReadFromFile(path);

        var ats = plist.root["NSAppTransportSecurity"] as PlistElementDict
            ?? plist.root.CreateDict("NSAppTransportSecurity");
        ats.values.Remove("NSAllowsArbitraryLoads");
        var domains = ats["NSExceptionDomains"] as PlistElementDict
            ?? ats.CreateDict("NSExceptionDomains");
        domains.CreateDict(TestServer).SetBoolean("NSExceptionAllowsInsecureHTTPLoads", true);

        plist.WriteToFile(path);
    }
}
#endif
```

Two more keys fail quietly. `LSApplicationQueriesSchemes`, which [[#ios-xcode-postprocess]] edited, lists the URL schemes that the app may test with `canOpenURL`, and for a scheme missing from the list that method returns false, whether or not an app for it is installed. Opening a URL does not need the list. The list has a limit, and each SDK that adds its schemes counts against it: Apple's reference, as read in September 2026, gives 50 entries for apps linked on or after iOS 15, and 25 for apps linked on or after iOS 27. `UIBackgroundModes` declares the kinds of work the app does in the background, such as `audio` or `remote-notification`. Xcode adds a value for each mode chosen under the Background Modes capability, and Unity 6.3's default export declares none.

The last file decides whether App Store Connect accepts the build. A [[privacy manifest]], `PrivacyInfo.xcprivacy`, declares the data that an app or SDK collects, whether it tracks, the domains it tracks through, and its reasons for calling the APIs that Apple lists as required-reason APIs, such as those that read the system's boot time or the free disk space ([Apple's reference](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)). Since May 1, 2024, App Store Connect has refused apps that do not describe their use of those APIs ([Apple's requirement](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)).

Each binary declares for itself. An SDK that calls a required-reason API reports it in its own manifest, which it ships inside its framework or bundle, and it cannot rely on the app's manifest or another SDK's to do so; the SDKs on [Apple's list of commonly used SDKs](https://developer.apple.com/support/third-party-SDK-requirements/) also need a signature when they are added as binaries. Unity 6.3 does the same for the engine: its export places a manifest in `UnityFramework` that gives the engine's reasons for four categories, system boot time, disk space, user defaults and file timestamps. That manifest covers Unity's code. The data that the game collects, and whether it tracks, belong in the app's own manifest, which the team writes. Xcode's privacy report aggregates the manifests of the app and of the SDKs it links, which makes it the place to read them together before a submission.

Exercise: Export your project's iOS build once with its SDKs and once without them, and diff the two `Info.plist` files. For each key that an SDK or a post-processor added, write down what would fail without it. Then generate the build's privacy report in Xcode and match each of its entries to the manifest that it came from.

?? xcode-ats The team sets “Allow downloads over HTTP” to `AlwaysAllowed` so that the game can reach a test server. What does that change in the iOS build, beyond UnityWebRequest's own check?
* Unity adds `NSAllowsArbitraryLoads`, lifting ATS for the whole app
- Unity adds an ATS exception for the domains the game contacts
- Nothing in the `Info.plist`, so URLSession requests keep ATS
- Unity adds `NSAllowsLocalNetworking`, which covers local servers
- Unity lifts ATS inside `UnityFramework` while the app keeps it
> In a test export, `AlwaysAllowed`, and `DevelopmentOnly` in a development build, made Unity write `NSAllowsArbitraryLoads` set to true into the `Info.plist`. That key is a global exception, so each `URLSession` request in the app, an SDK's included, may use plain HTTP, not just UnityWebRequest's.

?+ A native SDK in the iOS build sends events to an `http://` address through `URLSession`, and the requests fail. Unity's HTTP setting is `NotAllowed`. What blocks them?
* App Transport Security, which requires HTTPS for such requests
- Unity's HTTP setting, which governs the requests the app makes
- Android's cleartext policy, which Unity applies to both platforms
- App Review's settings, which block plain HTTP in builds under test
- The `LSApplicationQueriesSchemes` list, which has no `http` entry
> App Transport Security requires HTTPS for requests made through the URL Loading System, `URLSession` included, unless the `Info.plist` declares an exception. Unity's setting is about UnityWebRequest, and with `NotAllowed` it writes no exception, so the SDK's plain HTTP falls under ATS.

?+ A development build must reach one test server over plain HTTP while other connections keep ATS. Which `Info.plist` entry does that?
* An `NSExceptionDomains` entry allowing HTTP to that server
- `NSAllowsArbitraryLoads`, limited to development builds by Unity
- `NSAllowsLocalNetworking`, which covers the servers a build tests
- An `http` entry in `LSApplicationQueriesSchemes` for the server
- `UIBackgroundModes` with `fetch`, which lets downloads skip ATS
> `NSExceptionDomains` holds settings for named domains, and `NSExceptionAllowsInsecureHTTPLoads` under one domain allows plain HTTP to that domain alone. `NSAllowsArbitraryLoads` is a global exception, even when Unity writes it into development builds alone, and `NSAllowsLocalNetworking` covers unqualified names, `.local` names and IP addresses.

?+ In a Unity 6.3 project with default settings, a development server over plain HTTP fails on iOS and on Android alike. Why on both?
* UnityWebRequest refuses plain HTTP until a setting allows it
- Unity writes a cleartext ban into the projects of both platforms
- The build strips `http://` addresses unless they are allowlisted
- Plain HTTP needs a certificate that neither platform trusts yet
- UnityWebRequest needs the scheme in `LSApplicationQueriesSchemes`
> “Allow downloads over HTTP” defaults to `NotAllowed`, under which UnityWebRequest does not use plain HTTP, whatever the platform. Each platform has a policy of its own as well, ATS on iOS and the cleartext default on Android, but in a default project the request stops at Unity's check first.

?? xcode-privacy-manifest An analytics SDK reads the device's free disk space, a required-reason API. Whose privacy manifest has to declare the reason?
* The SDK's own manifest, shipped inside its framework or bundle
- The game's app manifest, which speaks for each SDK the app links
- `UnityFramework`'s manifest, since the SDK is linked into that target
- No manifest, as long as the App Store privacy answers mention it
- The manifest of whichever binary loads first, since iOS reads one
> Apple requires an SDK that calls a required-reason API to report it in its own privacy manifest, and states that the SDK cannot rely on the app's manifest or another SDK's. The SDK ships that manifest inside its framework or bundle, and the app's manifest covers the app's own code.

?+ What does the `PrivacyInfo.xcprivacy` inside Unity 6.3's `UnityFramework` declare?
* The engine's reasons for the required-reason APIs that it calls
- The data the game collects, filled in from the Player Settings
- The tracking domains of the SDKs that the project includes
- A general reason that covers each SDK linked into the build
- The game's answers to the App Tracking Transparency prompt
> Unity's manifest gives reasons for the engine's use of four required-reason API categories: system boot time, disk space, user defaults and file timestamps. It speaks for Unity's code. The data the game collects and whether it tracks belong in the app's own manifest, and each SDK declares for itself.

?+ After an SDK update, App Store Connect reports that the build calls a required-reason API without a declared reason. Where does the fix belong?
* In an SDK version whose own manifest declares a reason for the API
- In the game's manifest, which declares the reason for the SDK
- In the `Info.plist`, as a usage description for the API
- In the App Store privacy answers, which list the SDK's APIs
- In a post-processor that strips the API's symbol from the SDK
> The reason belongs to the binary that calls the API, and Apple says that an SDK cannot rely on the app's manifest to report its use. The SDK's vendor ships its manifest, so the fix is an SDK version whose manifest declares the reason, and until one exists, the previous version.

?+ What does Xcode's privacy report show?
* What the app and its SDKs declare, gathered from their manifests
- The app's own manifest, since each SDK reports to Apple separately
- The APIs the binary calls, found by scanning it for known symbols
- The permissions that testers granted while they ran the app
- The tracking domains that iOS blocked while the app was in review
> Xcode builds the privacy report by aggregating the privacy manifests of the app and of the third-party SDKs that it links. It shows what those manifests declare, which makes it the place to check each SDK's declarations before a submission.

## CocoaPods and dependency resolution on iOS {#xcode-cocoapods}

On Android, an SDK names its libraries with [[Maven coordinates]], and Gradle resolves them ([[#gradle-dependencies]]). On iOS, many SDKs name pods, and [[CocoaPods]] resolves them. In a Unity project, [[EDM4U]] connects an SDK to CocoaPods: the SDK ships a `*Dependencies.xml` file in an Editor folder, and after Unity writes the Xcode project, EDM4U's iOS Resolver writes a Podfile into it and runs `pod install`. The pods come from the SDK's file:

```xml
<dependencies>
  <iosPods>
    <iosPod name="ExampleAnalytics" version="~> 4.2" />
  </iosPods>
</dependencies>
```

`~> 4.2` accepts any version from 4.2 up to, but not including, 5.0. Since Unity 2019.3, EDM4U adds pods to `UnityFramework` by default, the target where the engine and the plugins are linked, and it links them as static frameworks unless its Link Framework Statically setting is turned off. The result is a Podfile along these lines:

```ruby
platform :ios, '15.0'
use_frameworks! :linkage => :static

target 'UnityFramework' do
  pod 'ExampleAnalytics', '~> 4.2'
end
```

`pod install` then writes a Pods project with a target that builds each pod, adds build settings that link `UnityFramework` against the pods' frameworks, and creates `Unity-iPhone.xcworkspace`, a workspace that holds Unity's project and the Pods project together. From then on the workspace is what gets built. In a test with one pod, building `Unity-iPhone.xcodeproj` after `pod install` failed when it linked `UnityFramework`, with `ld: framework 'ProbePod' not found`, because nothing in that build made the pod; the same build through the workspace succeeded. CocoaPods says as much when it finishes, and EDM4U calls this way of working Xcode workspace integration. A CI script archives with `-workspace Unity-iPhone.xcworkspace` wherever pods are involved.

`Podfile.lock` records what resolved: each installed pod with its version, a checksum of each spec and one of the Podfile, and the CocoaPods version. `pod install` installs the versions that the lock names for the pods it lists, while `pod update` looks for newer versions within the Podfile's ranges ([CocoaPods' guide](https://guides.cocoapods.org/using/pod-install-vs-update.html)), and CocoaPods recommends keeping the lock under version control. A Unity export is regenerated, and its lock with it, so each build that runs `pod install` in a fresh export resolves again, and a range such as `~> 4.2` can bring in a newer version than the last build had. Keeping each build's `Podfile.lock` with its archive answers later which versions shipped. For a pipeline that runs `pod install` itself, `--deployment` makes the install fail rather than change the Podfile or the lock.

When two SDKs need incompatible versions of a shared pod, CocoaPods stops. Gradle, in the same situation, picks the highest version requested and builds; CocoaPods' resolver instead reports that it “could not find compatible versions” for the shared pod, prints the chain of requirements behind each version, and installs nothing, so the failure appears at `pod install`, before anything compiles. The fix is a pair of SDK versions whose ranges overlap, found in their release notes or their specs. The generated Podfile is the wrong place for it, since the next build writes the Podfile again.

A second kind of collision passes `pod install`, because CocoaPods sees two different pods: two SDKs that are static libraries or static frameworks, each with its own copy of the same library inside. The linker meets the copies, and what it does depends on `-ObjC`. In a test, two static libraries each held the same object file, with an Objective-C class and a C function in it, and one program used both libraries. Without `-ObjC`, the link succeeded and silently kept the copy from the library listed first, so code from the second SDK ran the first one's copy. With `-ObjC`, which loads each member that holds Objective-C code, the linker loaded both copies and failed with three `duplicate symbol` errors, each naming both libraries. Unity's `UnityFramework` links with `-ObjC`, and CocoaPods added the flag for the static pod in the workspace test, so in a Unity build, copies that hold Objective-C code fail the link. The fix belongs to the SDKs: a build of one without the embedded copy, or versions that take the shared code as a pod of its own.

CI adds three needs. The CocoaPods version is pinned, with a Gemfile that Bundler, Ruby's dependency tool, installs and `bundle exec pod install` runs ([CocoaPods' Gemfile guide](https://guides.cocoapods.org/using/a-gemfile.html)). The agent reaches the spec source, by default CocoaPods' CDN, or has its downloads cached. And the lock is kept, as above. The spec source itself is changing: the CocoaPods maintainers plan to make trunk, the central repository of pod specs, read-only, accepting no new specs from December 2, 2026, while existing builds keep working ([the plan](https://blog.cocoapods.org/CocoaPods-Specs-Repo/), posted in November 2024 and updated in 2025). SDKs also come as Swift packages, which a project references by URL and version: Unity 6.3's `PBXProject` can add one with `AddRemotePackageReferenceAtVersion` and link its product with `AddRemotePackageFrameworkToProject`, and EDM4U's iOS Resolver reads `remoteSwiftPackage` entries beside `iosPod` ones.

Lab exercise: In a copy of a Unity iOS export, write a Podfile with two pods that depend on a third, run `pod install`, and read in `Podfile.lock` which version of the shared pod was installed. Narrow one pod's version range until the two no longer overlap, and read the resolver's message. Then build the export once through the project and once through the workspace, and compare where each build stops.

?? xcode-workspace After EDM4U runs `pod install`, CI builds `Unity-iPhone.xcodeproj`, and linking `UnityFramework` fails because a pod's framework is not found. Why?
* The pods are built by the Pods project, which the workspace adds
- `pod install` removed the frameworks once it had linked them in
- The pods were resolved for the Simulator, which a device build skips
- EDM4U added the pods to `Unity-iPhone`, which the link leaves out
- The frameworks are dynamic, and the project build expects static ones
> `pod install` adds build settings that link `UnityFramework` against the pods' frameworks, and puts the targets that build those frameworks in a Pods project. `Unity-iPhone.xcworkspace` holds both projects; building the `.xcodeproj` alone builds nothing that makes the pods, so the linker finds no framework. Build the workspace.

?+ What does `pod install` add to Unity's exported project?
* A Pods project, a workspace that holds both, and settings that link the pods
- The pods' source files, copied into the `Classes` folder of the export
- A new Unity-iPhone scheme that downloads the pods at each build
- A post-processor in the Unity project that links the pods next time
- A copy of each pod inside `Unity-iPhone.xcodeproj` as a new target
> CocoaPods keeps the pods out of Unity's project: it writes a Pods project with a target for each pod, links `UnityFramework` to their products through build settings, and creates `Unity-iPhone.xcworkspace` to hold the two projects. From then on the workspace is what Xcode and CI build.

?+ By default, which target does EDM4U add an SDK's pods to in a Unity 6.3 export?
* `UnityFramework`, where the engine and the plugins are linked
- `Unity-iPhone`, since the app target embeds the frameworks
- `GameAssembly`, where IL2CPP's C++ is compiled and linked
- Each target, so that the pods are available wherever they are needed
- A new target for each SDK, which the workspace links into the app
> Since Unity 2019.3, EDM4U adds pods to `UnityFramework` by default, the target that holds the engine, Unity's native code and the plugins that call the pods. It links them statically unless its Link Framework Statically setting is turned off.

?? xcode-pod-conflict Two SDKs depend on the same pod, one on `~> 8.0` and the other on `~> 9.1`. What happens when EDM4U runs `pod install`?
* The resolver stops, reporting no compatible versions, and nothing builds
- CocoaPods installs 9.1 for both, as Gradle picks the highest version
- CocoaPods installs both versions, one inside each SDK's framework
- The SDK listed first in the Podfile wins, and the other gets its version
- `pod install` succeeds, and the link fails later with duplicate symbols
> `~> 8.0` accepts 8.0 up to, but not including, 9.0, and `~> 9.1` accepts 9.1 up to 10.0, so no version satisfies both. CocoaPods' resolver then fails with “could not find compatible versions” for the shared pod and prints what required each range; unlike Gradle, it does not pick a winner. The fix is SDK versions whose ranges overlap.

?+ Two static SDK frameworks each carry their own copy of the same library, and linking `UnityFramework` fails with `duplicate symbol` errors. Why did `pod install` pass?
* CocoaPods sees two different pods; the copies meet in the linker
- `pod install` checks symbols when `--deployment` is passed, and CI omitted it
- CocoaPods reads the symbols of dynamic frameworks, and these are static
- The duplicate library is Unity's own, which CocoaPods does not read
- The `Podfile.lock` pinned both SDKs to old versions and hid the clash
> CocoaPods resolves pods by name and version. Two SDKs that each embed the same library inside their own binaries are two different pods to it, so resolution succeeds, and the duplication surfaces when the linker loads both copies into `UnityFramework`.

?+ In a test, two static libraries holding the same Objective-C file linked into a small app without an error, yet the same pair fails in a Unity build. What makes the difference?
* `-ObjC`, which loads each member with Objective-C code, both copies included
- Unity's linker settings treat warnings as errors, and the app's did not
- The small app was a debug build, and debug links allow duplicates
- IL2CPP adds a third copy of the library to the Unity build's link
- The Unity build links for devices, and the small app for the Simulator
> Without `-ObjC`, the linker loads an archive member when it resolves a missing symbol, so it took the first library's copy and left the second unused, silently. `-ObjC` loads each member that holds an Objective-C class or category, so both copies load and collide. Unity's `UnityFramework` links with `-ObjC`.

?+ Two SDKs accept overlapping ranges of a shared pod, and the build succeeds. Where does the team see which version of the shared pod was installed?
* In `Podfile.lock`, which records the version the resolver picked
- In each SDK's `Dependencies.xml`, whose range names the version
- In the Podfile, which EDM4U writes with each pod's exact version
- In a fresh `pod install` from the same commit, which picks it again
- In the app's `Info.plist`, where CocoaPods records the linked pods
> `Podfile.lock` records each installed pod with the version that resolved, while the XML and the Podfile hold ranges. A later `pod install` in a fresh export may resolve a newer version within the same ranges, so the lock kept with each build is the record of what shipped.
