# Evidence for chapter 07: Integrating third-party SDKs

What Phase 25 checked the chapter’s claims against, and where the outline was wrong. [PLAN.md](../PLAN.md), under “Decisions: evidence”, says what counts as evidence.

## Checked, and against what

### sdk-evaluation

- The Android manifest merger writes a report of its merge decisions under the module build/outputs/logs directory: confirmed. Source: https://developer.android.com/build/manage-manifests.
- Run Gradle dependencies for each Android module to inspect its resolved dependency tree: confirmed. Source: https://developer.android.com/build/gradle-dependency-resolution.
- APK Analyzer compares the file-size contribution of two Android build artifacts: confirmed. Source: https://developer.android.com/studio/debug/apk-analyzer.
- bundletool get-size total estimates compressed download size for an APK set: confirmed. Source: https://developer.android.com/tools/bundletool.
- An Apple privacy manifest records data collected and required-reason API use by an app or SDK: confirmed. Source: https://developer.apple.com/documentation/BundleResources/privacy-manifest-files.
- Xcode can aggregate app and linked SDK privacy manifests into a privacy report: confirmed. Source: https://developer.apple.com/documentation/BundleResources/describing-data-use-in-privacy-manifests.
- Xcode export can produce an App Thinning Size Report with compressed and uncompressed IPA sizes: confirmed. Source: https://developer.apple.com/documentation/Xcode/reducing-your-app-s-size.
- Apple says apps missing its third-party SDK manifest and signature requirements will not be accepted: confirmed. Source: https://developer.apple.com/news/?id=pvszzano.
- An Android input-dispatch ANR can occur when the app fails to respond to input within five seconds: confirmed. Source: https://developer.android.com/topic/performance/views/vitals/anr-views.
- A foreground app broadcast receiver has a five-second timeout on the cited ANR page: confirmed. Source: https://developer.android.com/topic/performance/views/vitals/anr-views.
- An iOS watchdog can terminate an app that takes too long to launch or respond: confirmed. Source: https://developer.apple.com/documentation/xcode/addressing-watchdog-terminations.
- Firebase documents an Info.plist switch for turning off app delegate method swizzling in native iOS integration: narrowed to The switch is documented for native Apple-platform integration; Firebase says its Unity SDK on iOS needs swizzling for key features. Source: https://firebase.google.com/docs/cloud-messaging/ios/get-started.
- Unity requires a custom activity to extend UnityPlayerActivity or UnityPlayerGameActivity, according to the chosen entry point: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/android-custom-activity.html.
- Unity imports local .unitypackage contents into Assets: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/AssetPackagesImport.html.
- Removing a UPM package removes a direct dependency from the project manifest: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/upm-ui-remove.html.
- Local asset packages need manual asset removal because the Package Manager does not track their imported assets: narrowed to Local .unitypackage imports need manual removal; Unity can remove imported Asset Store assets through Package Manager. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/upm-ui-remove-local.html.
- Unity supports installing a UPM package from a registry, Git URL, or local tarball: narrowed to This receipt confirms the Git URL form; separate registry and tarball receipts follow. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/upm-ui-giturl.html.
- Unity supports installing a UPM package from a registry, Git URL, or local tarball: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/upm-ui-install.html.
- Unity supports installing a UPM package from a registry, Git URL, or local tarball: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/upm-ui-tarball.html.
- Apple applies its privacy manifest and signature requirement to every version of a listed SDK, including a repackaged one: confirmed. Source: https://developer.apple.com/support/third-party-SDK-requirements/.
- Xcode checks that an updated signed third-party SDK came from the same developer: confirmed. Source: https://developer.apple.com/support/third-party-SDK-requirements/.
- Google Play SDK Index extracts an SDK’s target and minimum Android API levels from its published AAR manifest: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/12034434?hl=en.

### sdk-analytics-integration

- Unity sends OnApplicationPause when a playing application pauses or resumes after losing or regaining focus: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.OnApplicationPause.html.
- On Android, OnApplicationFocus(false) is not a reliable substitute for OnApplicationPause when Home is pressed with the on-screen keyboard open: narrowed to Use OnApplicationPause for a pause flush; focus loss can also mean the on-screen keyboard. Source: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.OnApplicationFocus.html.
- The iOS app delegate has five seconds to finish work after entering the background; a background task can request additional time: confirmed. Source: https://developer.apple.com/documentation/uikit/extending-your-app-s-background-execution-time.
- Debug.isDebugBuild is true for development builds and always true in the Editor: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Debug-isDebugBuild.html.
- Application.isEditor reports whether the game is running inside the Unity Editor: confirmed. Source: 6000.3.11f1/Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/UnityEngine.CoreModule.xml:537.
- Firebase Analytics DebugView shows raw events from development devices near real time: confirmed. Source: https://firebase.google.com/docs/analytics/debugview.
- Firebase Analytics normally batches events for about one hour before uploading: confirmed. Source: https://firebase.google.com/docs/analytics/debugview.
- Firebase Analytics debug mode can be enabled on iOS through the -FIRDebugEnabled Xcode launch argument: confirmed. Source: https://firebase.google.com/docs/analytics/debugview.
- Firebase Analytics debug mode can be enabled on Android through the debug.firebase.analytics.app adb property: confirmed. Source: https://firebase.google.com/docs/analytics/debugview.
- Firebase Analytics permits up to 500 distinct event types and 25 unique parameters per type: confirmed. Source: https://firebase.google.com/docs/reference/cpp/group/event-names.
- Firebase Analytics event names can be at most 40 characters and must follow its allowed character rules: confirmed. Source: https://firebase.google.com/docs/reference/cpp/group/event-names.
- Firebase Analytics user IDs must not contain information a third party can use to identify an individual: confirmed. Source: https://firebase.google.com/docs/analytics/userid.
- Google Analytics policy prohibits sending personally identifiable information: confirmed. Source: https://support.google.com/analytics/answer/6004245?hl=en.

### sdk-consent-init

- Android calls Application.onCreate before activities, services, and receivers, while explicitly excluding content providers from that order: narrowed to The reference excludes providers from the Application.onCreate order; ContentProvider.onCreate runs on the main thread at launch, and the player activity starts later. Source: https://developer.android.com/reference/android/app/Application.
- Android calls a registered content provider on the main thread at app launch, so expensive provider initialization delays startup: confirmed. Source: https://developer.android.com/reference/android/content/ContentProvider.
- Jetpack App Startup uses InitializationProvider to discover and call initializers: confirmed. Source: https://developer.android.com/topic/libraries/app-startup.
- Jetpack App Startup documents tools:node="remove" for removing an initializer from merged manifests: confirmed. Source: https://developer.android.com/topic/libraries/app-startup.
- FirebaseInitProvider is merged into Android manifests by default and runs at app launch: confirmed. Source: https://firebase.google.com/docs/reference/android/com/google/firebase/FirebaseApp.
- Firebase Analytics can start with collection disabled on Android by setting firebase_analytics_collection_enabled to false in the manifest: confirmed. Source: https://firebase.google.com/docs/analytics/android/configure-data-collection.
- Firebase Analytics can start with collection disabled on iOS by setting FIREBASE_ANALYTICS_COLLECTION_ENABLED to NO in Info.plist: confirmed. Source: https://firebase.google.com/docs/analytics/ios/configure-data-collection.
- Firebase Analytics can re-enable collection after consent through its collection-enabled method: confirmed. Source: https://firebase.google.com/docs/analytics/android/configure-data-collection.
- Firebase consent mode supports per-purpose consent settings and persists them across sessions: confirmed. Source: https://firebase.google.com/docs/reference/swift/firebaseanalytics/api/reference/Categories/FIRAnalytics%28Consent%29.
- Firebase consent mode defaults to granted, so a chapter policy of unknown until a decision requires explicit configuration: narrowed to Unknown, granted and denied are an app-owned state model; Firebase documents granted and denied values, with granted as default. Source: https://firebase.google.com/docs/reference/swift/firebaseanalytics/api/reference/Categories/FIRAnalytics%28Consent%29.
- Apps using the Google Play services advertising ID and targeting Android 13 or higher must declare AD_ID: confirmed. Source: https://developer.android.com/about/versions/13/behavior-changes-13.
- An app must ask permission through App Tracking Transparency to track users or access the advertising identifier: confirmed. Source: https://developer.apple.com/app-store/user-privacy-and-data-use/.
- Without tracking authorization, Apple says the device advertising identifier is all zeros: confirmed. Source: https://developer.apple.com/app-store/user-privacy-and-data-use/.
- App Tracking Transparency requests display a prompt only while the iOS app is active: confirmed. Source: /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.0.sdk/System/Library/Frameworks/AppTrackingTransparency.framework/Headers/ATTrackingManager.h:97.
- Unity 6000.3 lists iOS 14 Advertising Support 1.2.0 as a released compatible package: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.ads.ios-support.html.
- The iOS 14 Advertising Support package exposes a request for the tracking permission dialogue: confirmed. Source: https://docs.unity3d.com/Packages/com.unity.ads.ios-support@1.2/api/Unity.Advertisement.IosSupport.ATTrackingStatusBinding.html.
- Google Play requires certified ads SDKs for ads shown to children or users of unknown age: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/9893335?hl=en.
- Apple says Kids Category apps should generally exclude third-party analytics and advertising: confirmed. Source: https://developer.apple.com/app-store/review/guidelines/.
- App Store privacy details must describe what linked third-party SDK code collects and whether it tracks users: confirmed. Source: https://developer.apple.com/app-store/user-privacy-and-data-use/.
- Firebase’s Unity Crashlytics getting-started guide initializes it in Start, so “crash reporting before all consent work” is a design decision rather than a documented universal ordering: narrowed to Firebase documents initialization in a Unity Start method; consent and crash collection settings need their own review. Source: https://firebase.google.com/docs/crashlytics/unity/get-started.
- Android vitals considers cold startup of five seconds, warm startup of two seconds, and hot startup of one and a half seconds excessive: confirmed. Source: https://developer.android.com/google/play/vitals/launch-time.
- App Tracking Transparency has notDetermined, restricted, denied and authorized statuses: confirmed. Source: /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.0.sdk/System/Library/Frameworks/AppTrackingTransparency.framework/Headers/ATTrackingManager.h:72.
- An iOS app using App Tracking Transparency must provide NSUserTrackingUsageDescription: confirmed. Source: https://developer.apple.com/documentation/apptrackingtransparency/attrackingmanager/requesttrackingauthorization(completionhandler:).
- Google Play Data safety disclosures include data handled through third-party libraries or SDKs: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en.
- Google Play says apps solely targeting children must not contain SDKs unapproved for primarily child-directed services: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/9893335?hl=en.

### sdk-platform-differences

- Unity says JNI calls through either C# API are resource intensive and should be kept few: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/android-call-java-kotlin-code-best-practices.html.
- AndroidJavaObject calls made from a custom worker thread require the thread to be attached to the JVM first: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AndroidJavaObject.html.
- R8 cannot see Java calls made by native code through dynamic JNI lookup and may break those methods without keep rules: confirmed. Source: https://developer.android.com/topic/performance/app-optimization/keep-rules-overview.
- The probe Unity export keeps Unity player classes in proguard-unity.txt, but this does not establish keep rules for every SDK class called only from C#: narrowed to The exported file keeps Unity player classes; SDK plug-in classes need their own consumer or app keep rules where R8 cannot see usage. Source: PlatformLayerProbe/Exports/Android-GameActivity/unityLibrary/proguard-unity.txt:2.
- Unity 6000.3 lists proguard-unity.txt as a Unity-specific ProGuard configuration file: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/android-gradle-project-structure.html.
- On iOS, App Store review prompts are limited to at most three displays in a 365-day period under the stated condition: confirmed. Source: https://developer.apple.com/documentation/storekit/appstore/requestreview(in:)-1q8qs.
- Google Play In-App Review uses an undisclosed quota that can change without notice: confirmed. Source: https://developer.android.com/guide/playcore/in-app-review.

### sdk-upgrades

- Dynamic Gradle versions can change the resolved dependency and break builds unexpectedly: confirmed. Source: https://docs.gradle.org/current/userguide/dependency_locking.html.
- Gradle dependency locking saves resolved versions and transitive versions for reproducibility: confirmed. Source: https://docs.gradle.org/current/userguide/dependency_locking.html.
- Gradle stores a project or subproject lock state in gradle.lockfile: confirmed. Source: https://docs.gradle.org/current/userguide/dependency_locking.html.
- CocoaPods pod update requests newer versions for selected pods: confirmed. Source: https://guides.cocoapods.org/using/pod-install-vs-update.html.
- CocoaPods writes installed pod versions to Podfile.lock: confirmed. Source: https://guides.cocoapods.org/using/pod-install-vs-update.html.
- Unity Package Manager saves a successful dependency resolution in Packages/packages-lock.json: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/upm-conflicts-auto.html.
- Google Play staged rollouts expose an update to a percentage of users that can be increased: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/6346149?hl=en.
- Halting a Google Play staged rollout stops new delivery but users who already updated keep that version: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/6346149?hl=en.
- Android blocks installing an APK whose versionCode is lower than the version currently installed: confirmed. Source: https://developer.android.com/studio/publish/versioning.
- App Store phased release spans seven days and targets users with automatic updates enabled: confirmed. Source: https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases.
- App Store phased release can be paused for up to 30 days: confirmed. Source: https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases.
- Apple identifies a build by bundle ID, version number and build string: confirmed. Source: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information.
- Google Play Android vitals flags an overall user-perceived crash rate at or above 1.09 percent of daily active users: confirmed. Source: https://developer.android.com/google/play/vitals/crash.
- Google Play Android vitals flags an overall user-perceived ANR rate at or above 0.47 percent of daily active users: confirmed. Source: https://developer.android.com/google/play/vitals/anr.
- Crashlytics defines crash-free users as engaged users with no crash during the selected period: confirmed. Source: https://firebase.google.com/docs/crashlytics/crash-free-metrics.
- As checked on 2026-09-25, Google Play requires new Android apps and updates to target Android 16 API level 36, with listed device-form exceptions: confirmed. Source: https://developer.android.com/google/play/requirements/target-sdk.
- As checked on 2026-09-25, Apple requires App Store Connect uploads to be built with Xcode 26 or later using an SDK from the 26 generation: confirmed. Source: https://developer.apple.com/news/upcoming-requirements/.
- Google Play Billing Library versions have a two-year deprecation cycle: confirmed. Source: https://developer.android.com/google/play/billing/deprecation-faq.
- Users can manually download an App Store update during phased release: confirmed. Source: https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases.
- Android lint GradleDynamicVersion warns that plus-sign dependency versions can make builds unpredictable and unrepeatable: confirmed. Source: https://googlesamples.github.io/android-custom-lint-rules/checks/GradleDynamicVersion.md.html.
- CocoaPods pod install resolves only pods not already listed in Podfile.lock: confirmed. Source: https://guides.cocoapods.org/using/pod-install-vs-update.html.

### sdk-conflicts

- POSIX sigaction assigns one current action per signal and can return the prior action for explicit chaining: confirmed. Source: macOS man 2 sigaction.
- Android has a process default uncaught exception handler that an app can set: confirmed. Source: https://developer.android.com/reference/java/lang/Thread.
- The shipped Android UnityPlayer static initializer saves the prior default uncaught exception handler and installs a new one: confirmed. Source: 6000.3.11f1/PlaybackEngines/AndroidPlayer/Variations/il2cpp/Release/Classes/classes.jar, javap com.unity3d.player.UnityPlayer.
- The shipped Android Unity handler saves a prior handler and invokes it on an uncaught exception: confirmed. Source: 6000.3.11f1/PlaybackEngines/AndroidPlayer/Variations/il2cpp/Release/Classes/classes.jar, javap com.unity3d.player.a.Q.
- The iOS Trampoline saves the prior Objective-C uncaught exception handler and invokes it after its own handler: narrowed to The installation occurs when ENABLE_OBJC_UNCAUGHT_EXCEPTION_HANDLER is enabled; this does not establish all signal-handler behavior. Source: 6000.3.11f1/PlaybackEngines/iOSSupport/Trampoline/Classes/CrashReporter.mm:85.
- Apple says to assign UNUserNotificationCenter.delegate before app launch finishes so the app handles actionable notifications: confirmed. Source: https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/delegate.
- Firebase Cloud Messaging receives Android messages through a FirebaseMessagingService declared with MESSAGING_EVENT: confirmed. Source: https://firebase.google.com/docs/cloud-messaging/android/receive-messages.
- Android may choose any matching service when an intent does not identify a particular service: confirmed. Source: https://developer.android.com/reference/android/content/Context.
- Unresolved Android manifest attribute conflicts cause a merger error that needs an explicit instruction in the higher-priority manifest: confirmed. Source: https://developer.android.com/build/manage-manifests.
- Android tools:replace chooses the higher-priority manifest value for named attributes: confirmed. Source: https://developer.android.com/build/manage-manifests.
- Unity PostProcessBuildAttribute callbacks run in specified order starting at zero, so post-processors that write one Info.plist key need agreed ordering or one owner: confirmed. Source: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Callbacks.PostProcessBuildAttribute.html.
- Unity 6000.3 lists Mobile Notifications 2.5.0 as released; whether its iOS code assigns UNUserNotificationCenter.delegate remains to be checked in that package version: narrowed to Package availability is documented, but its delegate ownership is unverified until the matching package source is inspected. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.mobile.notifications.html.

## Rests on documentation alone

- Firebase Analytics event limits, DebugView, consent defaults, and collection switches are documentation claims. A real SDK integration must verify its own pre-consent behavior and debug output.
- Store privacy rules, rollout limits, target API and Xcode requirements, Android vitals thresholds, and review-prompt quotas are official policy or product documentation. They can change after the 2026-09-25 check.
- The contract suite, migration comparison, launch-thread profile, and release-configured device smoke test remain engineering checks for the writer. No device result is claimed here.

## Narrowed or cut

- The blanket claim that a .unitypackage cannot be removed as a unit is too broad. Unity tracks imported Asset Store assets for removal. Local asset package imports need manual removal because Package Manager does not track them.
- Firebase documents FirebaseAppDelegateProxyEnabled for native Apple integration, but its Unity iOS guidance says not to disable swizzling for key Firebase features.
- Unknown, granted, and denied are a useful app-owned consent model. Firebase consent mode documents granted and denied, with granted as its default until configured.
- The proposed crash-reporter-first sequence is an architectural choice. Firebase Unity Crashlytics documents initialization in Start; collection settings and consent still need product review.
- OnApplicationFocus(false) is not a universal background signal on Android. The on-screen keyboard can trigger it, while Home with that keyboard open triggers OnApplicationPause instead.
- A remote switch can stop calls made by app code, but the shipped native SDK stays in the artifact. Replacing or removing it requires another build. This is an artifact inference, not a claim that a remote switch can reverse a store rollout.
- Whether Mobile Notifications 2.5.0 assigns UNUserNotificationCenter.delegate is unverified until its matching source is resolved and inspected.

## Where the outline fell short

- The evaluation sheet must record the exact SDK version and its own compatibility matrix. The probe Android export uses Android Gradle Plugin 8.10.0 at PlatformLayerProbe/Exports/Android-GameActivity/build.gradle:6 and minSdk 25 with targetSdk 36 at PlatformLayerProbe/Exports/Android-GameActivity/launcher/build.gradle:25. Those are probe settings, not SDK requirements.
- Apple requires a privacy manifest and a signature for listed SDKs used as binary dependencies, including repackaged listed SDKs. An Xcode privacy report combines app and SDK manifests. A missing listed SDK manifest or signature can block upload.
- The Android merged manifest and its merger report, both Gradle module dependency trees, and platform-specific artifact sizes need a before-and-after build. Documentation alone cannot state the delta.
- Firebase Analytics normally batches events. A pause callback offers an opportunity to request a flush, but iOS background execution has a finite budget. The adapter contract must define what happens to unsent events.
- A capability query should express platform availability without implying parity in prompt timing or quotas. App Tracking Transparency is an iOS API; App Store and Google Play review prompts have different documented limits.
- One push callback owner must route to other consumers. On Android an implicit intent can select any matching service; on iOS the notification center has one delegate property. Unity player crash-handler chaining is version-specific and does not make arbitrary SDK handler combinations safe.

## Runs

The session ran the three runs Codex asked for on 2026-09-25, each on disposable copies in its scratch folder; the probe project was only read.

- Android build diff: the probe's `Exports/Android-GameActivity`, copied twice, one copy with `implementation 'com.google.firebase:firebase-analytics:22.4.0'` added to `unityLibrary/build.gradle`, both built with the Editor's Gradle 8.13 (`OpenJDK/bin/java -classpath Tools/gradle/lib/gradle-launcher-8.13.jar org.gradle.launcher.GradleMain :launcher:assembleRelease` and the two `dependencies` tasks). The release runtime classpath grew from 62 to 82 distinct modules and the release APK from 17,334,817 to 19,073,316 bytes. The merged manifest gained `INTERNET`, `WAKE_LOCK`, `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`, `com.google.android.gms.permission.AD_ID`, `ACCESS_ADSERVICES_ATTRIBUTION` and `ACCESS_ADSERVICES_AD_ID`; the services `AppMeasurementService`, `AppMeasurementJobService` and `ComponentDiscoveryService`; the receiver `AppMeasurementReceiver`; the activity `GoogleApiActivity`; and the provider `com.google.firebase.provider.FirebaseInitProvider` with `android:initOrder="100"`, which `launcher/build/outputs/logs/manifest-merger-release-report.txt` records as added from `com.google.firebase:firebase-common:21.0.0`, a transitive dependency. The first attempt failed because the brief's script called a `Tools/gradle/bin/gradle` that 6000.3.11f1 does not ship.
- iOS pod diff: the probe's `Exports/iOS`, copied twice, one copy with a Podfile naming `FirebaseAnalytics` for the `UnityFramework` target and `use_frameworks! :linkage => :static`. `pod install --repo-update` (CocoaPods 1.16.2) resolved FirebaseAnalytics 12.19.0 to nine pods: FirebaseAnalytics, FirebaseCore, FirebaseCoreInternal, FirebaseInstallations, GoogleAdsOnDeviceConversion 3.7.0, GoogleAppMeasurement, GoogleUtilities 8.1.3 (with its `AppDelegateSwizzler` and `MethodSwizzler` subspecs), nanopb and PromisesObjC. Six pod sources hold a `PrivacyInfo.xcprivacy`; the exported `Info.plist` did not change. Without `use_frameworks!`, `pod install` refused to integrate the Swift pod FirebaseCoreInternal as a static library. The unsigned archive of the unchanged copy succeeded; that of the copy with the pods failed in Xcode 27, because GoogleAdsOnDeviceConversion, GoogleUtilities and nanopb declare an iOS deployment target of 12.0 and PromisesObjC of 9.0, outside the 15.0 to 27.0 that Xcode supports. No size comparison was made, and the chapter states none for iOS.
- Mobile Notifications: a copy of the probe with `com.unity.mobile.notifications` 2.5.0, resolved by the Editor in batch mode. Its `Runtime/iOS/Plugins/UnityNotificationLifeCycleManager.mm:57` sets `[UNUserNotificationCenter currentNotificationCenter].delegate = manager;` in the observer for `kUnityWillFinishLaunchingWithOptions`, and `UnityNotificationWrapper.m:57` sets it too. This settles the claim left unverified above: the package makes itself the notification center's delegate as the app finishes launching.

## Added by the session

- The chapter's code compiles: C# against `UnityEngine.CoreModule.dll` and `UnityEngine.AndroidJNIModule.dll` of 6000.3.11f1 with `UNITY_ANDROID` and then `UNITY_IOS` defined and warnings as errors; Java with the Editor's OpenJDK against `android-36/android.jar`; Objective-C++ with `xcrun -sdk iphoneos clang++ -fobjc-arc -Wall -Werror`. Stand-ins, which the chapter's comments name, supply `VendorAnalytics` (Java class and Objective-C header), `CrashLog`, `EventSchema`, `TrackingStatus` and chapter 1's `ProductId`.
- Devices without the Play Store lack Google Play services: https://developers.google.com/android/guides/setup, “You should check for the presence of Google Play services on a device using the isGooglePlayServicesAvailable() method before attempting to use Google APIs, as devices without the Google Play Store do not have it installed.”
- Cut: that neither store tells the app whether its review prompt appeared. The cached in-app review page states no such sentence, so the chapter keeps the documented limits and treats a request as not a display, a design rule.
- Narrowed after the blind review: removing a package removes the project's direct dependency, and the package leaves the project only when no other installed package depends on it (https://docs.unity3d.com/6000.3/Documentation/Manual/upm-ui-remove.html, “The package itself and all its functionality is still installed in your project”). Cut: that most SDK failures happen in calls the game makes, which nothing measured; the chapter says a remote switch covers failures in calls the game controls. Reworded: an ANR is a responsiveness timeout, not a deadline on launch, so a long start on the main thread risks one through an unanswered input.
- The App Startup example in the chapter follows the pattern the App Startup page documents for one initializer (`tools:node="merge"` on the provider, `tools:node="remove"` on the initializer's `meta-data`), with a placeholder initializer name.
