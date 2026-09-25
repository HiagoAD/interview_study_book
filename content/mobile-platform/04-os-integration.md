---
book: unity-mobile-platform-engineering
chapter: 04: Lifecycle, permissions, links, notifications, and sign-in
---

## Two lifecycles: the OS's app states and Unity's callbacks {#os-lifecycle}

A Unity game runs inside two lifecycles. The operating system decides when the app runs, when it stops running, and when its process ends, and Unity turns those decisions into a few callbacks that C# can hear. The rest of this chapter hangs off these moments: permissions are checked again when the game returns, links and notifications arrive while it is starting or away, and a sign-in can outlive the process that began it. So this section starts with what each side promises, and with what neither does.

On Android, the unit is the activity, which moves through created, started, resumed, paused, stopped and destroyed, and the process that holds it matters more. [Android's activity lifecycle guide](https://developer.android.com/guide/components/activities/activity-lifecycle) ranks processes by how likely the system is to kill them: least likely with a resumed activity in front of the player, more likely with a paused one that is still visible, more again with a stopped one in the background, and most likely when the process is empty. A game the player has left is a stopped activity in a cached process, and Android reclaims cached processes when it needs memory, without running anything in them. [Its page on processes](https://developer.android.com/guide/components/activities/process-lifecycle) adds that `onDestroy()` is not guaranteed to be called when the system kills a process.

When the player comes back to a game whose process was killed, Android starts a new process and creates the activity again, passing it the state that the old activity saved in a `Bundle`. Unity's two activities hand that bundle to their Android superclass and nothing more: in an exported project, `UnityPlayerActivity` and `UnityPlayerGameActivity` call `super.onCreate(savedInstanceState)` and create a new player, and no C# API in Unity 6.3 receives saved instance state. The new process starts Unity from its first scene, so whatever the game needs after a restart is whatever it wrote down itself.

On iOS, [Apple's life-cycle guide](https://developer.apple.com/documentation/uikit/managing-your-app-s-life-cycle) describes an app that is not running, inactive, active, in the background or suspended, and an app that uses scenes gets those events for each scene. Unity 6.3 uses scenes: the [[Info.plist]] it exports names `UnityScene` as the [[scene delegate]], which forwards each change to `UnityAppController`. An app entering the background has about five seconds to return from its handler, by Apple's reference for `applicationDidEnterBackground:`, and `beginBackgroundTask` asks for more time, which is also finite. Then the app is suspended. A suspended app gets no CPU time, and when the system needs its memory it ends the process without waking it: Apple's reference describes `applicationWillTerminate:` for an app running in the background, not for a suspended one.

Unity reports these states through a few callbacks, and its reference is careful about what each one promises:

- `OnApplicationPause(bool)` reports that the player loop stops or starts again. The first call comes just after `Awake`, with `false`, and later calls come at each pause and resume.
- `OnApplicationFocus(bool)`, and the `Application.focusChanged` event for code outside a `MonoBehaviour`, report input focus, which is not the same as leaving. On Android, [the reference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.OnApplicationFocus.html) notes that opening the on-screen keyboard reports a loss of focus.
- `OnApplicationQuit` and `Application.quitting` are not for saving. The reference says not to rely on the first to save state on mobile platforms, and the second is not raised when the player is forced to quit or crashes. The first book's chapter on mobile graphics, memory, and platform constraints drew the conclusion: design so that losing everything after the last pause is acceptable.
- `Application.lowMemory` warns of memory pressure while the app is in the foreground, and not otherwise, and Unity 6.3 adds `Application.memoryUsageChanged`, which reports levels of pressure. Neither is notice that the process is about to end.

Nothing promises an order between focus and pause. On iOS, `UnityAppController` handles `applicationWillResignActive:` by taking focus from the player and then pausing it, unless the project enables custom background behaviors. UIKit resigns an app for temporary interruptions, such as a system alert or an incoming call, as well as on its way to the background, so on iOS a permission prompt pauses the game, and `OnApplicationPause(true)` does not mean that the app is in the background. On Android, the pause follows the activity and the focus follows its window, two separate paths. The probe project logged this in the iOS Simulator with Unity 6000.3.11f1:

```text
launch             OnApplicationPause(False)    OnApplicationFocus(True)     frame 0
to another app     OnApplicationFocus(False)    OnApplicationPause(True)     frame 584
                   (a plugin heard didEnterBackground 2.4 s later)
back to the game   OnApplicationFocus(True)                                  frame 584
                   a message a plugin sent while the game was away           frame 585
                   OnApplicationPause(False)                                 frame 585
```

At launch the pause callback comes first, and on the way back the focus callback does. Code that assumes one of them runs before the other is right on one path and wrong on the next, so a game gives each job a single signal: the pause for saving and for anything that follows the app out of the foreground and back, and the focus for input alone.

Native code stops with the app. A suspended app runs no code at all, so its timers do not fire and the requests it runs itself make no progress; a transfer handed to the system in a background `URLSession` is the exception, since another process carries it. Apple's guide to [preparing for the background](https://developer.apple.com/documentation/uikit/preparing-your-ui-to-run-in-the-background) has apps invalidate their timers before they get there. Messages from native code to C# wait as well. [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/ios-native-plugin-call-back.html) says that `UnitySendMessage` calls are asynchronous, with a delay of one frame, and a paused player runs no frames: in the run above, a message that a plugin sent from `didEnterBackground:` ran on the first frame after the game returned, before `OnApplicationPause(false)`. Callbacks that pile up while the game is away arrive in its first frames back, ahead of the game's own resume code, so their handlers do not assume that it has run.

What the game does at each edge follows from these limits:

- On pause, it saves. It persists the operations still pending at the boundary, such as a purchase waiting for its grant or a score not yet sent, writes the save file, and moves queued analytics events to storage for the next session to send. A network flush may not finish before the app is suspended, so it is a bonus and not the plan.
- On resume, it checks what may have changed while it was away: the permissions that the player can change in the system settings, tokens that expired, purchases that completed in the store (the query on resume from [[#platform-events]]), and the [[push token]], which it sends again.

A small component turns the callbacks into those two signals, raised once per change whatever order the platform uses:

```csharp
using System;
using UnityEngine;

// Raises Paused and Resumed once per change. Save on Paused; check permissions,
// tokens and purchases on Resumed. A loss of focus alone does not mean the app is leaving.
public sealed class AppLifecycle : MonoBehaviour
{
    public event Action Paused;
    public event Action Resumed;

    bool paused;

    void OnApplicationPause(bool pauseStatus)
    {
        if (pauseStatus == paused) return; // the first call, after Awake, reports false
        paused = pauseStatus;
        if (paused) Paused?.Invoke();
        else Resumed?.Invoke();
    }
}
```

Lab exercise: Log every lifecycle callback on both platforms, with the frame number and the time, while you send the game to the background, lock the screen, pull down the notification shade or Control Center, answer a permission prompt, and swipe the game away. Compare the order with the table above, and list the callbacks that did not arrive at all.

?? os-resume-recheck The player turned off the game's notifications in the system settings while the game was in the background. What should the game do when it resumes?
* Read the notification permission again, and turn off what depends on it
- Keep the answer read at startup, which stays valid for the life of the process
- Wait for a callback, which the platform sends to the game when a setting changes
- Request the permission again at once, which restores the choice made at install
- Register for push again, which turns notifications back on for this player
> A setting can change while the game is away, and nothing reports the change to it. The game reads the permission again on resume and before each use, and treats the current answer as the truth.

?+ The game's session token expired while the game spent a day in the background. When should the client find out?
* On resume, by checking the token's expiry before the first call that needs it
- When a request fails mid-match, since an expiry is unknown until the server says so
- At the next cold start, since a token's lifetime restarts with each new process
- Not at all, since the platform refreshes the tokens of suspended apps for them
- When `OnApplicationFocus(true)` arrives, which carries the token's new expiry
> Time passes while a game is suspended, and a token can expire with no code running. Checking the expiry on resume, and refreshing the token before the first call that needs it, keeps the failure out of the middle of play.

?+ Which of these belongs in the game's resume handler?
* Checks of state that can change while the game is away, such as permissions
- Reloading the first scene, since iOS unloads the scenes of a suspended app
- Initializing each SDK again, since suspension resets their native state
- Reading PlayerPrefs again, since the system clears them for suspended apps
- A full save, since the pause handler runs too late to write anything
> A resumed game continues where it paused, with its scenes and SDKs intact. What changed is the world outside it: permissions, tokens, purchases and push registration can all change while the game is away, so the resume handler checks them.

?? os-lifecycle-order A game resumes its music in `OnApplicationPause(false)` and restarts its match timer in `OnApplicationFocus(true)`, and relies on the pause callback coming first. What is wrong?
* Unity documents no order between the two, and it differs from one path to another
- Focus callbacks are raised on a background thread, so they run before pause ones
- The pause callback runs once per session, so the music resumes after launch alone
- The two callbacks share one message, so the second overwrites the first one's work
- Unity raises focus callbacks in the Editor alone, so the timer does not restart
> Neither Unity nor the platforms promise an order between focus and pause, and a run on iOS showed the pause first at launch and the focus first on the way back from another app. Each job listens to one signal and does not depend on the other having run.

?+ Which callback should a mobile game use to save the player's progress?
* `OnApplicationPause(true)`, since the process can end later with no other callback
- `OnApplicationQuit`, which Unity calls before the system ends a suspended app
- `Application.quitting`, which Unity raises when the system reclaims the process
- `OnDestroy` on a persistent object, which runs as the process shuts down
- `Application.lowMemory`, which arrives before the system reclaims a background app
> A suspended iOS app and a cached Android process are ended without running more code, so the quit callbacks do not arrive, and `lowMemory` is raised in the foreground and not otherwise. The pause is the last moment the game can count on, so it saves there.

?+ On Android, a game opens its pause menu and saves whenever `OnApplicationFocus(false)` arrives, and players report that opening the chat keyboard pauses the match. Why?
* The on-screen keyboard takes focus from the game while it stays on screen
- The keyboard runs in a separate activity, which pauses Unity's player loop
- Focus is lost at each frame on Android, and the menu opens on the first one
- The chat field raises `OnApplicationPause(true)`, which Unity reports as focus
- Android sends each focus change twice, and the second one opens the menu
> Focus and pause mean different things. Unity's reference notes that on Android the on-screen keyboard causes a loss of focus while the game is still on screen and running, so a pause menu belongs on the pause callback.

?+ On iOS, callbacks that a native SDK sent with `UnitySendMessage` while the game was in the background run as it resumes. What can their handlers assume?
* Nothing about order: they can run before the game's own resume code has run
- That `OnApplicationPause(false)` has run, since Unity delivers it before messages
- That they arrive one per frame, spread over the first seconds after resume
- That they are fresh, since Unity drops the messages sent while it is paused
- That the scene has reloaded, since queued messages arrive after a reload
> A paused player runs no frames, so the messages wait, and in a run on iOS a message sent while the app was in the background ran before `OnApplicationPause(false)`. A handler that needs the game's resume work done checks for it instead of assuming it.

## Permissions and usage descriptions {#os-permissions}

Both platforms guard the camera, the microphone, location, contacts and notifications behind the player's consent, and both let the player say no. They differ in what happens when a build gets the setup wrong, and iOS is the stricter: an app that asks for the camera or the microphone without its purpose string is ended, and a location request without one does nothing.

On Android, a permission's protection level decides how it is granted. [Android's overview](https://developer.android.com/guide/topics/permissions/overview) separates install-time permissions, granted from the manifest when the app is installed, from runtime permissions, which the system gives the dangerous protection level. A runtime permission is declared in the manifest too, and is then requested while the app runs, through a system dialog. The manifest that counts is the merged one, and a library can add a permission to it that nobody on the team chose, which chapter 5 covers.

[Android's guide to requesting permissions](https://developer.android.com/training/permissions/requesting) sets out the flow. Check whether the app holds the permission every time it performs the operation. If it does not, call `shouldShowRequestPermissionRationale()`, and when that returns true, show the game's own explanation first. Then request. Denial has a limit: on Android 11 and later, if the player taps Deny for the same permission more than once, the system no longer shows its dialog when the app asks again, and the request ends as denied with nothing on screen. From then on, the app's page in the system settings is the one place to grant it, and the game can open that page with the `ACTION_APPLICATION_DETAILS_SETTINGS` intent when the player asks it to. Notifications have their own runtime permission, `POST_NOTIFICATIONS`, since Android 13 (API level 33).

Unity wraps the flow in `UnityEngine.Android.Permission`: `HasUserAuthorizedPermission`, `ShouldShowRequestPermissionRationale`, and `RequestUserPermission` or `RequestUserPermissions` with a `PermissionCallbacks` object, whose events are `PermissionGranted`, `PermissionDenied`, `PermissionDeniedAndDontAskAgain` and `PermissionRequestDismissed`. In 6000.3 the third is marked obsolete as unreliable, and its note points to `PermissionDenied` and the rationale check instead. Unity also asks on its own. [Its manual](https://docs.unity3d.com/6000.3/Documentation/Manual/android-permissions-in-unity.html) says that the first time a game uses `LocationService`, `WebCamTexture` or `Microphone`, Unity requests the permission that it added to the manifest for it, at that moment. The `unityplayer.SkipPermissionsDialog` meta-data in the manifest turns those requests off, so that the game asks when it chooses, after its own explanation.

The request itself, for a code scanner that the game can do without:

```csharp
#if UNITY_ANDROID
using System;
using UnityEngine.Android;

public enum CameraAccess { Granted, Denied, Dismissed }

// Asked when the player opens the code scanner, which is optional: every outcome leaves the game playable.
public static class CameraPermission
{
    // True when Android suggests explaining the feature before asking again.
    public static bool ShouldExplain => Permission.ShouldShowRequestPermissionRationale(Permission.Camera);

    public static void Request(Action<CameraAccess> done)
    {
        if (Permission.HasUserAuthorizedPermission(Permission.Camera))
        {
            done(CameraAccess.Granted);
            return;
        }
        var callbacks = new PermissionCallbacks();
        callbacks.PermissionGranted += _ => done(CameraAccess.Granted);
        callbacks.PermissionDenied += _ => done(CameraAccess.Denied);
        callbacks.PermissionRequestDismissed += _ => done(CameraAccess.Dismissed);
        Permission.RequestUserPermission(Permission.Camera, callbacks);
    }
}
#endif
```

On iOS, each protected resource needs a purpose string: a key in the [[Info.plist]] whose text the system shows in its prompt, such as `NSCameraUsageDescription` for the camera and `NSMicrophoneUsageDescription` for the microphone. Apple's guide to [requesting capture authorization](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media) says that without the key, the system terminates the app. That is the failure in which a feature works on Android and closes the game on iOS: the Android build shows its dialog, and the iOS build ends the first time it touches the camera, with the evidence that [[#ios-failure-evidence]] describes. Unity writes the camera, microphone and location keys from the Camera Usage Description, Microphone Usage Description and Location Usage Description fields of the iOS Player Settings, and a key that a plugin needs is set by a post-processor, as in [[#ios-xcode-postprocess]].

For notifications and location, iOS asks once: after the player answers, a new notification request returns the recorded answer without a prompt, as [Apple's notification guide](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications) says, and a new location request does nothing. The rules belong to each API, and two of them soften that. Location's Allow Once grants a temporary authorization that ends when the app is no longer in use, after which the app can ask again. Provisional notification authorization skips the prompt and delivers notifications quietly, so the player decides with a real notification in front of them. App Tracking Transparency has a prompt of its own and requires its own purpose string, `NSUserTrackingUsageDescription`, and in the European Union, Apple's reference lets an app ask again after a year (checked in September 2026). After a denial, the game can open its page in Settings through `UIApplication.openSettingsURLString` when the player asks to, and checks the authorization again when the player returns. In C#, `Application.RequestUserAuthorization` asks for the camera or the microphone on iOS, and `Application.HasUserAuthorization` reads the answer.

The rules that follow are the same on both platforms:

- Ask at the moment of need. A camera request when the player taps the scanner makes sense to them. One at first launch is a question without context, and a “no” there can close the feature for good.
- Treat denial as a normal state. The feature says what it needs and how to turn it on, and the rest of the game carries on.
- Never block core play on an optional permission.
- Check again, on resume and before each use, since the player can change any answer in the system settings while the game is away.

Exercise: Map each permission your game uses to the moment it is requested, the explanation shown before it, and what the game does when it is denied or dismissed, on Android and on iOS. Mark each permission that a library added rather than a feature asked for.

?? os-permission-denied On a recent Android phone, a player tapped Deny twice for the camera, which the game's optional code scanner needs. What can the game still do?
* Explain the scanner, and offer to open the game's page in the system settings
- Request the camera again at the next launch, when the system shows the dialog again
- Ask at each launch until the player agrees, since the count resets with each restart
- Open the camera through a plugin, which reaches it without the runtime permission
- Nothing, since after two denials the player has no way left to grant the permission
> After a permission is denied twice, Android stops showing its dialog for it. The player can still grant it on the app's page in the system settings, which the game opens when the player asks, and the rest of the game works without the scanner.

?+ On iOS, the player denied location, and the event map uses it to show events nearby. What should the game do?
* Show the events without distances, with a note on turning location on in Settings
- Show the system prompt again at the next launch, which iOS allows after a denial
- Block the event map until the player grants location, since the map depends on it
- Estimate the position from the network address, and carry on as if it were granted
- Remove the event map for this player, so that the player is not asked a second time
> A denial is a normal state, and an optional feature degrades rather than blocks. iOS does not show the location prompt again once the player has answered, so the game explains how to change it in Settings and checks the authorization when the player returns.

?+ Why does a game ask for the camera when the player taps the scanner, rather than at first launch?
* The player sees why it is needed, and a refusal closes that feature alone
- Android refuses runtime requests made before the first scene finishes loading
- iOS shows the camera prompt once the camera is running, and not before it
- Unity queues early requests until the tutorial ends, and they time out there
- A refusal at launch counts twice, which ends the dialog for that permission
> At the moment of need the player knows what the permission is for, so the request gets a considered answer, and a “no” closes one optional feature rather than souring the player on later requests.

?? os-usage-description A new build adds a QR scanner. It works on Android, and on iOS the game closes as soon as the scanner opens, with no exception in C#. What is missing?
* The camera's usage description in the `Info.plist`, without which iOS ends the app
- The `CAMERA` permission in the Android manifest, which iOS reads from the export
- A call to `Application.RequestUserAuthorization` before the camera starts
- The camera capability in the Xcode project, which grants access to the device
- An entry for the scanner in `LSApplicationQueriesSchemes`, which lists features
> iOS requires a purpose string for the camera, and Apple's guide says the system terminates an app that asks for capture without it. Android has no such string, which is why the same feature works there.

?+ Where does a Unity project set the text that iOS shows in its camera prompt?
* In the Camera Usage Description field of the iOS Player Settings
- In a `camera_rationale` string resource placed under `Assets/Plugins/iOS`
- In the `PermissionCallbacks` object, whose constructor takes the prompt's text
- In the Android manifest's permission entry, which Unity copies to the export
- In the call itself, since `RequestUserAuthorization` takes a message string
> Unity writes `NSCameraUsageDescription` into the exported `Info.plist` from the Camera Usage Description field of the iOS Player Settings. The system shows that text in the prompt, and a build without it is ended when it asks for the camera.

?+ An SDK needs a purpose string that the Player Settings have no field for. Where does the team add it?
* In a post-processor that sets the key in the `Info.plist` after each build
- In the exported `Info.plist` by hand, which each later build leaves in place
- In the SDK's Android manifest, which Unity merges into the Xcode project
- In a C# attribute on the SDK's adapter, which Unity turns into the key
- In the SDK's `.bundle` of resources, whose strings iOS shows in the prompt
> A Replace build writes the Xcode project again, so a hand edit does not survive a clean build. A post-processor sets the key on each build, and when it runs last, its text wins if two SDKs write the same key.

?+ Why can the same missing purpose string go unnoticed on Android?
* Android has no purpose strings, and its dialog needs the manifest declaration alone
- Android shows a default purpose string, which Unity fills from the product name
- Android reads the iOS key from the shared `Info.plist` that Unity also exports
- Android ends the app as well, but not until the first scene has loaded
- Android checks purpose strings at install, so the store would reject the build
> The requirement is iOS's: a key in the `Info.plist` for each protected resource. An Android build shows its runtime dialog with the manifest declaration alone, so testing on Android does not reveal the missing iOS key.

## Deep links and verified links {#os-deep-links}

A [[deep link]] opens the game at a place: an invite, an event, a gift, the redirect at the end of a sign-in. It comes in two forms, and the difference between them is who can answer it.

A custom scheme, such as `examplegame://invite/K7Q2`, is a name the app declares, and any other app can declare the same one. Apple's page on [defining a custom URL scheme](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app) says that when several apps register a scheme, the app the system targets is undefined, and on Android, another app registering it puts a chooser in front of the player. A custom-scheme link is therefore a request to whichever app claims the name, with no proof of which one that is.

A verified link is an https URL on a domain the team controls, and the platform checks the association between the app and the domain against a file on that domain:

- Android App Links. The intent filter for the https host carries `android:autoVerify="true"`, and the site serves `/.well-known/assetlinks.json`, which names the package and the SHA-256 fingerprints of the certificate that signs the app players install. With [[Play App Signing]], Google signs that app with the app signing key, so the fingerprint to publish is that key's, which Play Console shows together with a ready statement, and not the upload key's; chapter 5 explains the two keys. On Android 12 and later, an https link whose verification failed opens in the browser. [Android's guide to the file](https://developer.android.com/training/app-links/configure-assetlinks) has the details.
- iOS universal links. The app's Associated Domains [[entitlements|entitlement]] lists `applinks:` and the domain, and the site serves `apple-app-site-association` from `/.well-known/`, over https with a valid certificate and no redirects, listing the app identifiers (the team prefix and the bundle ID) and the paths the app handles, as Apple's page on [supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains) describes. When the file is missing or wrong, the link opens in the browser.

The three pieces, for invites on `play.example.com`:

```xml
<!-- In the Unity activity of a custom main manifest: https links under /invite on play.example.com. -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="play.example.com" android:pathPrefix="/invite" />
</intent-filter>
```

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.example.game",
    "sha256_cert_fingerprints": ["<the app signing key's SHA-256 fingerprint, from Play Console>"]
  }
}]
```

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["ABCDE12345.com.example.game"],
        "components": [{ "/": "/invite/*" }]
      }
    ]
  }
}
```

What verification protects is the destination: the link reaches the app that the domain names and no other, and a player without the game lands on the web page instead, which a custom scheme has no way to offer. It says nothing about the sender. Anyone can post a verified link with any path and parameters.

Unity receives links through `Application.absoluteURL`, which holds the URL that launched or activated the app, and `Application.deepLinkActivated`, raised when a link arrives while the app runs, with `absoluteURL` updated. On Android, a link reaches the running activity through `onNewIntent`, as [[#android-activity-integration]] showed. On iOS, `UnityAppController` sets the URL from `application:openURL:options:` for a custom scheme, from `application:continueUserActivity:restorationHandler:` for a universal link, and at launch from the options passed to `application:willFinishLaunchingWithOptions:`.

In Unity 6000.3.11f1, iOS calls none of them. The exported [[Info.plist]] declares a scene manifest with `UnityScene` as the [[scene delegate]], and for an app with scenes, iOS delivers links to the scene: at launch in the connection options of `scene:willConnectToSession:options:`, and while the app runs or is suspended to `scene:openURLContexts:` for a custom scheme and `scene:continueUserActivity:` for a universal link. The launch options that the application delegate receives are nil. `UnityScene` implements four lifecycle methods and none of those three. In the probe project, custom-scheme links sent in the iOS Simulator reached nothing: at a cold start `absoluteURL` was empty and stayed empty, and while the game ran, no `deepLinkActivated` was raised and no listener's `onOpenURL:` was called. Apple's [TN3187](https://developer.apple.com/documentation/technotes/tn3187-migrating-to-the-uikit-scene-based-life-cycle) says the scene life cycle will be required in the next major release after iOS 26, for apps built with the latest SDK.

A category on `UnityScene` closes the gap. It adds the three methods and hands each link to the controller, which sets `absoluteURL`, raises `deepLinkActivated` and notifies listeners as it does for links that reach it:

```objective-cpp
#import <UIKit/UIKit.h>
#include "UnityAppController.h"
#include "UI/UnityScene.h"

// Defined in UnityAppController.mm, and not declared in its header.
@interface UnityAppController (SceneLinks)
- (void)initUnityApplicationNoGraphics;
@end

// UnityScene in 6000.3 implements none of these, so this category adds them rather than replacing any.
@implementation UnityScene (Links)

// Cold start: the link that launched the app comes with the scene's connection options.
- (void)scene:(UIScene*)scene willConnectToSession:(UISceneSession*)session options:(UISceneConnectionOptions*)options
{
    if (options.URLContexts.count == 0 && options.userActivities.count == 0)
        return;
    // The controller's own launch path starts the engine this far before it sets a URL.
    [GetAppController() initUnityApplicationNoGraphics];
    [self scene:scene openURLContexts:options.URLContexts];
    for (NSUserActivity* activity in options.userActivities)
        [self scene:scene continueUserActivity:activity];
}

// A custom-scheme link while the app runs or is suspended.
- (void)scene:(UIScene*)scene openURLContexts:(NSSet<UIOpenURLContext*>*)contexts
{
    for (UIOpenURLContext* context in contexts)
        [GetAppController() application:UIApplication.sharedApplication openURL:context.URL options:@{}];
}

// A universal link.
- (void)scene:(UIScene*)scene continueUserActivity:(NSUserActivity*)activity
{
    [GetAppController() application:UIApplication.sharedApplication continueUserActivity:activity
                 restorationHandler:^(NSArray<id<UIUserActivityRestoring>>* objects) {}];
}

@end
```

With the category, a cold link was in `absoluteURL` before the first `RuntimeInitializeOnLoadMethod` ran, and a link sent to the running game raised `deepLinkActivated` with `absoluteURL` updated. Universal links take the controller method that the Trampoline already implements, and were not run, since they need a signed build with the entitlement. The category patches Unity's code, at two costs. It calls `initUnityApplicationNoGraphics`, which the controller's header does not declare. And if a later Unity version implements these methods in `UnityScene`, [Apple's guide to categories](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/CustomizingExistingClasses/CustomizingExistingClasses.html) says it is undefined which implementation runs. So each Unity upgrade starts with a look at `Classes/UI/UnityScene.mm` in the export, and the category goes when Unity's own methods arrive.

A link is untrusted input, whichever kind it is and however it arrives. Anyone can put one in a chat message, on a web page or in another app, with the path and parameters they like, and [Android's guidance on deep links](https://developer.android.com/privacy-and-security/risks/unsafe-use-of-deeplinks) asks apps to validate them. So the game:

- Accepts known routes. A parser turns the URL into one of the routes the game knows, with parameters of the expected form, and drops everything else.
- Grants nothing from a link. A gift link carries the id of a gift, and the game asks its server whether this player may claim it; an amount in a link is a request the server ignores.
- Routes when the game can act, through the inbox of [[#platform-events]]. With the category above, a link that opened the running game reached C# while the player was still paused, before `OnApplicationPause(false)`.
- Expects the same link twice. A player taps twice, or a link read at launch is read again after a scene reload, and an invite accepted once stays accepted once, which takes the server's record of the invite's id: an [[idempotence|idempotent]] claim.

```csharp
using System;
using System.Collections.Generic;

// Maps an untrusted link to a route the game knows, or rejects it. It grants nothing:
// the router asks the server what an invite or a gift id is worth.
public static class GameLinks
{
    static readonly HashSet<string> Routes = new HashSet<string> { "invite", "event", "gift" };

    public static bool TryParse(string url, out string route, out string id)
    {
        route = id = null;
        if (!Uri.TryCreate(url, UriKind.Absolute, out Uri uri)) return false;

        // examplegame://invite/K7Q2 and https://play.example.com/invite/K7Q2 name the same place.
        string path;
        if (uri.Scheme == "examplegame") path = uri.Host + uri.AbsolutePath;
        else if (uri.Scheme == "https" && uri.Host == "play.example.com") path = uri.AbsolutePath.TrimStart('/');
        else return false;

        string[] parts = path.Split('/');
        if (parts.Length != 2 || !Routes.Contains(parts[0])) return false;
        if (parts[1].Length < 1 || parts[1].Length > 16) return false;
        foreach (char c in parts[1])
            if (!(c >= 'A' && c <= 'Z') && !(c >= '0' && c <= '9')) return false;

        route = parts[0];
        id = parts[1];
        return true;
    }
}
```

To test, `adb shell am start -W -a android.intent.action.VIEW -d "<url>" <package>` sends a link to a package, at a cold start or while it runs. Since it names the package, it proves the routing and not the verification, which `adb shell pm get-app-links <package>` shows and `adb shell pm verify-app-links --re-verify <package>` runs again. On iOS, `xcrun simctl openurl <device> <url>` sends a link in the Simulator, which asks for confirmation before it opens the app, as it does when one app opens another's custom scheme; a UI test can tap Open. A universal link needs a signed build with its entitlement.

Exercise: Send your game a link at a cold start, in a menu, and during a run, on both platforms, and record where each one lands and when the game acts on it. On iOS, first check that a link reaches C# at all.

?? os-link-trust A marketing link `examplegame://reward?gems=500` grants 500 gems when the game opens it. What is wrong?
* Anyone can write that link, so what it grants has to be decided by the server
- Custom schemes drop query parameters on iOS, so the gems are lost there
- The link should carry a signature made with a key in the game's own code
- The link should use https instead, which makes its parameters safe to act on
- The grant should run once per session, which stops players from repeating it
> A link is untrusted input that anyone can create and send, and a key inside the game can be extracted from it. The link can name a reward, and the server decides whether this player may claim it, once.

?+ Which check belongs in the game's link parser?
* The route is one the game knows, and its parameters have the expected form
- The link came from a trusted app, which the platform records in the URL
- The link carries the signature that the platform adds to verified links
- The URL differs from the last one received, which is how repeats are caught
- The player confirmed the link, which Unity records in `absoluteURL`
> A parser allow-lists: it maps the URL to one of the routes the game knows, checks the form of each parameter, and drops the rest. Nothing in a link proves who wrote it, and granting anything stays with the server.

?+ The same invite link reaches the game twice, from two taps. What keeps the invite from being accepted twice?
* The server records the invite's id, and a second claim changes nothing
- A flag in the link inbox that ignores links for the rest of the session
- Clearing `Application.absoluteURL` after the first link has been handled
- The platform's filter, which drops a link that repeats within a minute
- Comparing each link with the previous one, and dropping it when they match
> Duplicates are recognized by identity, and the durable record is the server's: the invite ids it has accepted. A flag or a comparison in memory fails at the next launch, or when another link arrives in between.

?? os-verified-links What does an Android App Link protect that a custom-scheme link does not?
* It opens the app that the domain's `assetlinks.json` names, and no other app
- It proves who sent the link, so its parameters can be acted on directly
- It encrypts the link's path, so that other apps on the device see none of it
- It installs the game from Google Play when a player without it taps the link
- It lets the game skip checking routes, since Google has reviewed them
> Verification ties the link to the app that the domain names, so another app that claims the same host is not offered it, while any app can register a custom scheme. It says nothing about the sender, so the parameters are still untrusted.

?+ After the team moved to Play App Signing, App Links open the browser for players who installed the game from Google Play, while the team's own builds open the game. Why?
* `assetlinks.json` lists the upload key's fingerprint, not the app signing key's
- Google Play removes `autoVerify` from the manifest of the apps that it signs
- The team's builds are debuggable, and Android verifies debuggable apps alone
- The site serves `assetlinks.json` over https, where Android expects plain http
- Store installs verify their links once, and that verification expired
> Google signs the app that players install with the app signing key, and verification compares that certificate with the fingerprints in `assetlinks.json`. Builds that the team signs with the upload key match the published fingerprint, and store installs do not.

?+ What does an iOS universal link need besides the code in the app that handles it?
* An `applinks:` entitlement entry, and the association file on the site
- A custom URL scheme with the same name as the domain, listed in the `Info.plist`
- A usage description for links in the `Info.plist`, which the first link shows
- A review of the domain by Apple before each release that adds new paths
- The domain's TLS certificate, embedded in the app bundle when it is built
> iOS verifies the pair from both sides: the entitlement names the domain, and the `apple-app-site-association` file on the domain names the app and its paths. With either missing, the link opens in the browser.

?+ A verified link opens the game. What can the game conclude from that?
* That it is the app the domain names, and nothing about who sent the link
- That the sender is signed in on the domain, so the parameters can be trusted
- That the link came from the game's website, since the platform refuses others
- That the platform checked the path against the routes the game accepts
- That the link is new, since the platform delivers each verified link once
> Verification is about the destination. Anyone can post a verified link with any path and parameters, so the game parses it like any other link and asks its server before it grants anything.

## Local and push notifications {#os-notifications}

A notification reaches a player who is not playing, which makes it one of the few features that work while the game is closed. There are two kinds. A local notification is scheduled on the device by the game itself: the energy is full, the event starts in an hour. A remote notification, or push, is sent by the backend through the platform's push service, Firebase Cloud Messaging (FCM) for Android and the Apple Push Notification service (APNs) for iOS, to the [[push token]] that the device registered.

Unity's [Mobile Notifications package](https://docs.unity3d.com/Packages/com.unity.mobile.notifications@2.5/manual/index.html) schedules local notifications on both platforms; 2.5.0 is the version released for Unity 6.3. On Android it posts through a channel that the game registers first, and after a tap, `AndroidNotificationCenter.GetLastNotificationIntent` returns the notification that opened the game, or null when something else did. On iOS it asks for authorization with an `AuthorizationRequest` that names the options it wants, such as alerts, badges and sounds, and `iOSNotificationCenter.QueryLastRespondedNotification` finds the notification the player tapped. It receives no remote notifications on Android, where FCM's own SDK does. On iOS, its Enable Push Notifications setting adds the push [[capability]] to the Xcode project and sets `UNITY_USES_REMOTE_NOTIFICATIONS` to 1 in the Trampoline, where it is 0 by default and compiles out the device-token notification of [[#ios-xcode-postprocess]]; the game then reads the token from an `AuthorizationRequest` created with `registerForRemoteNotifications`.

Tokens change. FCM's documentation lists a new token when the app is restored on a new device, reinstalled, or has its data cleared, and calls `onNewToken` whenever one is generated. Apple's page on [registering with APNs](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns) lists a restore from a backup, a new device and a reinstalled operating system, and asks apps to register at each launch rather than cache the token. So the client:

- sends the current token to the backend at each launch and whenever the platform reports a new one, with the signed-in player's id, the platform and, on iOS, the APNs environment;
- asks the backend to remove the token from the player's account at sign-out, before the session ends, so that the next player on the device does not receive the last one's notifications.

The backend keeps the latest token for each device and player, and drops a token that the push service rejects.

On Android, every notification belongs to a channel from Android 8.0 (API level 26), and the player controls each channel's behavior once the game has created it; notifications need the `POST_NOTIFICATIONS` permission of [[#os-permissions]]. FCM delivers two kinds of message, and [its guide to receiving them](https://firebase.google.com/docs/cloud-messaging/android/receive-messages) sets out where each goes. With the app in the foreground, notification messages, data messages and messages carrying both reach `onMessageReceived`. In the background, a notification message goes to the system tray, a data message still reaches `onMessageReceived`, and the data of a message carrying both arrives in the extras of the launcher activity's intent when the player taps it. A game that reads payloads in its listener alone misses each notification tapped while it was in the background.

On iOS, APNs has two environments, development, the sandbox at `api.sandbox.push.apple.com`, and production at `api.push.apple.com`, and a token belongs to one of them. The `aps-environment` entitlement decides which: its value is `development` or `production`, and Xcode sets it from the [[provisioning profile]] that the build is signed with. A build signed for development gets a sandbox token, and Unity's Development Build checkbox, which changes the player and not the signature, has no say in it. A token sent to the other environment's host fails with `BadDeviceToken`, whose description in [Apple's list of APNs responses](https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns) asks to check that the token matches the environment. The backend stores the environment with each token and sends to the matching host.

A tap opens or resumes the game with the notification's data, and the game treats that data like a link: the same parser, the same allow-list, the same inbox. Payloads carry no secrets and no rewards. Apple's page on generating a remote notification says not to put customer information or sensitive data in a payload, which passes through systems the game does not control, and a gift notification says “open gift 812”, leaving the server to decide what gift 812 is and whether this player has claimed it.

One push, with the identity that each step uses:

```text
game, at launch    token, player id, environment   -> game backend
game backend       payload, token                  -> APNs or FCM
push service       notification                    -> the device that holds the token
the player         a tap on the notification       -> game, with the payload
game               the route the payload names     -> game backend, which decides what it is
```

Exercise: Trace one push in your game from the backend to the player's tap, naming each component and the identity it uses: the player id, the token, the environment, the app's bundle ID or package name. Then find where the token is removed when the player signs out.

?? os-push-token When should the client send its push token to the backend?
* At each launch, and whenever the platform reports a new token
- Once at install, since the token lasts as long as the app stays installed
- When the player opens the notification settings, where tokens are refreshed
- When the backend asks for it, which it does after each failed delivery
- Once a week, which matches how often the push services rotate their tokens
> Tokens change after a reinstall, a restore or a move to a new device, and the platform reports a new token when it issues one. Sending the current token at each launch and on each change keeps the backend's copy current, and Apple asks apps not to cache it.

?+ A player signs out, and a friend signs in on the same phone. What should happen to the push token?
* The client asks the backend to unlink it from the first player at sign-out
- Nothing, since the platform issues a new token when a different player signs in
- The friend's sign-in sends it again, and the backend keeps both players on it
- The client deletes its local copy, which stops the backend from using it
- The client requests a new token, which the platform issues at each sign-in
> The token identifies the app on the device, not the player. Unless the first player's account lets go of it at sign-out, the backend keeps sending that player's notifications to a phone that someone else is using.

?+ After restoring a phone from a backup, a player receives no pushes. What most likely changed?
* The platform issued a new token, and the backend still holds the old one
- The backup restored the old token, which the push service had revoked
- Notifications are turned off after each restore until the player opts in
- The restore removed the push capability from the game's entitlements
- The game's channel was deleted, and pushes go to a channel that is gone
> A restore from a backup is one of the events after which the push service issues a new token. A client that sends its token at each launch repairs this at its next start.

?? os-apns-environment The backend sends each iOS token to the production host of APNs. Testers' builds, signed with a development provisioning profile, receive nothing, and APNs answers `BadDeviceToken`. Why?
* Their `aps-environment` is development, so their tokens belong to the sandbox
- Builds signed for development lack push, so their tokens are placeholders
- Production rejects tokens from devices that also have a store build installed
- The backend's certificate expired, which APNs reports as a bad device token
- Sandbox tokens are longer, and the backend cuts them to production's length
> A token belongs to the APNs environment its build registered with, which the `aps-environment` entitlement sets. A build signed for development gets a sandbox token, and sending it to the production host fails with `BadDeviceToken`.

?+ Where does an iOS build's APNs environment come from?
* The `aps-environment` entitlement, which Xcode sets from the provisioning profile
- Unity's Development Build checkbox, which switches the app to the sandbox
- The backend's choice of host, which registers the token again when it differs
- The bundle identifier, since a `.dev` suffix routes the app to the sandbox
- The `Info.plist` key that the Mobile Notifications package writes at build time
> The entitlement is `development` or `production`, and Xcode takes it from the profile that the build is signed with. Unity's Development Build setting changes the player, not the signature, so it does not decide the environment.

?+ What should the backend store with each iOS push token?
* The APNs environment it was issued for, so that it sends to the matching host
- The device's model, which APNs needs to choose the notification's layout
- The app's version, since APNs rejects tokens from builds older than the last
- The player's password hash, which APNs uses to authenticate the delivery
- The provisioning profile's name, which APNs checks against the token
> Sandbox and production tokens go to different hosts, and each host refuses the other's tokens. The client reports its environment with the token, and the backend sends each notification to the host that matches.

## Sign-in callbacks and external authentication {#os-auth-callbacks}

A game signs a player in in one of two ways. Platform sign-in uses the operating system's own account service, such as Sign in with Apple, through a native API. Web sign-in sends the player to an identity provider's pages, the game's own account service or a third party's, and brings the result back to the app. Both end in a credential that the game's backend turns into a session of its own, which chapter 8 covers.

Apple's [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) put a condition on the choice in guideline 4.8, Login Services. An app that uses a third-party or social login service to set up or authenticate the player's primary account must also offer an equivalent login service that limits data collection to the name and email address, lets the player keep the email address private, and collects no interactions with the app for advertising without consent. The guideline lists exceptions, and a team reads its current text before each release rather than a summary of it.

Web sign-in in a native app follows [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html), [[OAuth]] 2.0 for native apps:

- An external user agent. The app opens the provider's page in the system browser, or in a browser tab that the browser runs over the app, [[Custom Tabs]] on Android and `ASWebAuthenticationSession` on iOS, and not in an embedded web view. A web view belongs to the app, which could read the password as the player types it and the provider's cookies, and it shares no signed-in session with the browser; RFC 8252 says native apps must not use one for authorization.
- The authorization code flow with PKCE, from [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html). For each attempt the app makes a random code verifier, sends its SHA-256 hash, the code challenge, with the authorization request, and receives a code at its redirect URI. Whoever redeems the code at the token endpoint must present the verifier.
- A redirect URI that the app can receive: a claimed https URL, which is an App Link or a universal link; a private-use scheme built from a domain the team owns, in reverse order, such as `com.example.game:/oauth`; or a loopback address, which suits desktop apps.
- A `state` value, random for each attempt, which comes back unchanged with the response and is compared with the pending attempt before anything else happens.
- No client secret in the app. A secret compiled into each copy of a distributed app can be extracted from any of them, and RFC 8252 says such secrets are not to be treated as confidential.

State and PKCE protect against different things. PKCE protects the code: another app that registered the same private-use scheme, or saw the redirect some other way, holds a code it has no way to redeem without the verifier, which never left the game. State protects the game: a response that does not carry the state of an attempt the game started is not an answer to anything it asked, and the game discards it, which is the protection against cross-site request forgery that [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html) requires of a redirect endpoint.

One attempt's secrets fit in a small class. For RFC 7636's sample verifier, it computes the challenge that the RFC's Appendix B gives:

```csharp
using System;
using System.Security.Cryptography;
using System.Text;

// One sign-in attempt: the state ties the redirect to this attempt, and the verifier
// proves that whoever redeems the code is the one who started it.
public sealed class PkceAttempt
{
    public string State { get; }
    public string Verifier { get; }
    public string Challenge => Base64Url(Sha256(Verifier));

    public PkceAttempt() : this(Base64Url(RandomBytes(16)), Base64Url(RandomBytes(32))) { }
    public PkceAttempt(string state, string verifier) { State = state; Verifier = verifier; }

    static byte[] RandomBytes(int count)
    {
        var bytes = new byte[count];
        using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
        return bytes;
    }

    static byte[] Sha256(string ascii)
    {
        using (var sha = SHA256.Create()) return sha.ComputeHash(Encoding.ASCII.GetBytes(ascii));
    }

    // Base64 with the URL-safe alphabet and no padding.
    static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
```

The redirect arrives differently on each platform. On Android, the browser opens the redirect URI, which is a link to the game, so it arrives like any other link: through `onNewIntent` and `Application.deepLinkActivated`, or in `Application.absoluteURL` at a cold start. On iOS, `ASWebAuthenticationSession` hands the callback URL to the completion handler of the session that started the attempt. It does not pass through the app's URL handlers or `deepLinkActivated`, it reports `canceledLogin` when the player cancels, and an https callback needs its domain among the app's associated domains. Either way, the game compares the state, then sends the code and the verifier to its backend, which redeems them at the provider's token endpoint and creates the game's session.

Android can end the game's process while the browser is in front. During sign-in the game is a background app in a cached process, and the process lifecycle from the first section of this chapter applies: the redirect may then start a new process, which launches the game from its first scene with the link in `absoluteURL`. A pending attempt kept in memory is gone, and a game that looks for the state in memory rejects the one correct answer it will get. Two designs survive it:

- Persist the attempt before opening the browser: the state, the verifier and the time, encrypted with a key from the [[Android Keystore]] on Android or stored in the [[Keychain]] on iOS, deleted once it is used, and refused after a few minutes.
- Or treat a redirect with no matching attempt as a failed attempt, and start the flow again cleanly, with a message that says so.

A browser tab that the player closes returns no sign-in result. With a Custom Tab, the game comes back to the front with no redirect, and a callback it registered can at most report that the tab was hidden, which answers nothing about the attempt. So the game needs its own end to it: when it resumes and no redirect arrives within a short time, it ends the attempt and shows the sign-in button again. [Auth Tab](https://developer.chrome.com/docs/android/custom-tabs/guide-auth-tab), a Custom Tabs variant made for authentication, returns a canceled result instead, and `ASWebAuthenticationSession` reports its cancellation, so those paths get an explicit answer. Android's developer option that destroys activities tests their recreation, not process death, since the process survives it.

Exercise: Diagram your game's sign-in from the button to the backend session. Mark each place where the process could die, what survives it and where that is stored, and what the player sees when the browser closes without an answer. On Android, run it with `adb shell am kill <package>` while the browser is in front, then finish the sign-in.

?? os-auth-pkce-state Another app registered the game's private-use redirect scheme and received a player's authorization code. What stops it from using the code?
* It lacks the PKCE verifier, which redeeming the code requires
- The state value, which the provider checks before it issues a code
- The client secret, which the game ships inside its own binary
- The order of registration, which gives the first app the scheme
- Android's check of the scheme against the provider's domain
> With PKCE, the token endpoint accepts the code together with the verifier whose hash went out with the request, and the verifier never left the game. A code seen by another app is of no use to it.

?+ What does the `state` value protect against?
* A response the game did not ask for, since it must match a pending attempt
- Interception of the code, since the provider hashes state like a verifier
- Replay of the access token, since state expires when the token does
- Phishing pages, since the browser checks state against the site's certificate
- A lost redirect, since the provider resends the response until state matches
> The game makes a random state for each attempt and compares the response's state with it before anything else, so a response it did not start, forged or replayed, is discarded. That is the protection against cross-site request forgery that RFC 6749 requires.

?+ Why does a mobile game hold no OAuth client secret?
* Each copy of the app ships the same bytes, so anyone can extract the secret
- The platform keeps the secret in the Keychain or the Keystore for the app
- Providers refuse secrets from apps, and sign in any app that asks them
- PKCE encrypts the secret, so the request no longer needs to carry it
- The redirect URI brings the secret back to the game after sign-in
> A secret compiled into a distributed app can be read out of it, and RFC 8252 says such secrets are not to be treated as confidential. The app is a public client, and PKCE protects its codes instead.

?? os-auth-process-death On Android, the player finishes signing in, and the game restarts from its first scene with the redirect in `Application.absoluteURL`. The game rejects the redirect as unknown. Why?
* The pending attempt was in memory, and it ended with the old process
- The redirect's state is hashed, and a new process computes another hash
- The provider revokes codes whose redirect arrives at a cold start
- `absoluteURL` holds launch links, and redirects arrive as an event
- Unity strips the query of a link that launches the game cold
> While the browser was in front, Android ended the game's cached process, and the redirect started a new one. An attempt kept in memory died with the first process, so the state had nothing to match.

?+ What should the game store before it opens the browser for sign-in?
* The attempt's state and verifier, protected and with an expiry
- The access token, which the provider returns before it shows its page
- The player's password, so the game can sign in again if the process ends
- Nothing, since Android keeps a game's process alive while a tab is open
- The authorization code, which the game receives before the browser opens
> A redirect can arrive in a new process, and the stored attempt is what it is checked against. Encrypted with a Keystore key on Android or kept in the Keychain on iOS, it survives the process, and an expiry and single use keep it from being replayed.

?+ An Android game stores its pending sign-in attempt until a redirect matches it. The player closes the Custom Tab without signing in. What ends the attempt?
* The game's own expiry, since closing the tab brings back no sign-in result
- A redirect with an error, which the provider sends when the tab is closed
- `OnApplicationQuit`, which runs as the tab closes in the game's process
- The provider, which reports the abandoned attempt through `deepLinkActivated`
- The Keystore, which deletes the attempt's key when the tab closes
> A Custom Tab returns no sign-in result when the player closes it; a callback the app registered can at most report that the tab was hidden. The stored attempt, kept so that it survives a dead process, needs an expiry of its own, and the game ends it when it resumes and no redirect arrives.

?+ How can a team test sign-in when the process dies during it?
* Kill the game's process while the browser is in front, then finish signing in
- Turn on the developer option that destroys activities, which ends the process
- Rotate the device during sign-in, which recreates the process on Android
- Put the game in the background for a minute, which Android treats as a kill
- Sign in twice in a row, which makes the provider end the first process
> The developer option that destroys activities recreates them in the same process, so an attempt kept in memory survives it. A killed process, for example with `adb shell am kill` while the browser is in front, shows whether the game recovers.
