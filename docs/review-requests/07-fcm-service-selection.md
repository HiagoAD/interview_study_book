# The reason given for two push services losing a message cites the wrong Android rule

**Kind:** Accuracy · **Priority:** Low · **Touches:** prose (one sentence)

## Location

- `content/mobile-platform/07-sdk-integration.md:762`, **Push** under `sdk-conflicts`: “when more than one service matches an intent that names none in particular, [Android's reference](https://developer.android.com/reference/android/content/Context) says that any of them may be used.”

## Evidence

The sentence cited from `Context.startService` (fetched 2026-09-29) applies to intents that name no package:

> “The Intent should either contain the complete class name of a specific service implementation to start, or a specific package name to target. If the Intent is less specified, it logs a warning about this. In this case any of the multiple matching services may be used.”

Firebase Cloud Messaging does not send such an intent. `javap -c -p` of `com.google.firebase.messaging.ServiceStarter` in `firebase-messaging-24.1.0.aar` (downloaded from Google's Maven repository into the scratch folder) shows that it builds the `com.google.firebase.MESSAGING_EVENT` intent, calls `Intent.setPackage` with the app's own package, then calls `PackageManager.resolveService(intent, 0)` once per process (`resolveServiceClassName`, cached in the field `firebaseMessagingServiceClassName`), and sets the resolved class with `Intent.setClassName`. The [PackageManager reference](https://developer.android.com/reference/android/content/pm/PackageManager) describes `resolveService` as: “Determine the best service to handle for a given Intent.”

So the outcome is not arbitrary. One service is chosen, the best match by the usual intent-resolution order (with intent-filter priority deciding between two in the same app), and every message goes to that one service. The chapter's conclusion stands: the other SDK's service receives nothing, with no error. What changes is the reason. A reader who says in an interview that Android picks a random service is wrong.

## Proposed fix

Replace the sentence's second half with:

“… and its library resolves that action within the app to one service, the best match that `PackageManager.resolveService` returns, and sends every message there. Two SDKs that each handle push …”

Then drop the link to the `Context` reference, or keep it only for the general rule about implicit service intents.

## Repeated elsewhere

`sdk-single-owner` (07:778 to 783) says “Android uses one of them”, which stays true, and its distractor about priorities (“so each message reaches both in turn”) stays wrong. No change is needed in the question block.
