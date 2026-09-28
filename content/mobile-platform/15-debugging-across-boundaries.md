---
book: unity-mobile-platform-engineering
chapter: Debugging across boundaries
---

## Follow one operation through every layer {#boundary-method}

A player sees “Purchase failed”. The store may have charged them, the backend may have granted the item, and the screen may have missed the reply. Start by naming the outcome that is wrong and the operation it belongs to. “The confirmation screen timed out” is an observation. “The payment failed” is a conclusion that needs evidence from the store.

Use the path from [[#platform-study-method]] as a map, following the request outward and the result back:

```text
game -> interface -> adapter -> bridge -> native SDK -> OS -> network -> backend
     <- game result <- mapped result <- callback or response <-
```

Some SDKs make their own network requests; others return a token that the game sends to its backend. Draw the path the failing operation takes, including those branches. Chapter 9's operation id joins attempts of one logical action, while an attempt id distinguishes its individual requests ([[#network-observability]]). Carry those ids through the parts you own. When a store or SDK does not accept your id, record the association between its transaction reference and your operation in a protected record.

| Boundary | Evidence to compare for the same operation |
| --- | --- |
| Game to adapter | Requested product, selected implementation, completion state, exception |
| Adapter to bridge | Method name, argument shape, request id, outbound thread |
| Bridge to native SDK and back | Initialization state, raw result category, callback thread and time |
| SDK to OS | Permission state, foreground state, native error and device console |
| Client to network | Destination, request schema, elapsed time, transport error or HTTP status |
| Gateway to backend | Request acceptance, validation result, durable grant and response |
| Result back to the game | Mapping, dispatch, completion, and whether the original screen still exists |

Compare shapes and categories without copying tokens, credentials or complete purchase payloads into logs. On Android, [[logcat]] with `threadtime` includes process and thread ids; on iOS, use the device console alongside the crash report when there is one. A traffic capture shows the body only if the connection can be inspected: [[TLS]] encrypts it, and [[certificate pinning]] can reject an inspection proxy. A proxy failure may be a property of the debugging setup. Application and server logs remain useful without weakening the release's trust rules.

The first book's bisection method divides the remaining possibilities with each observation. Here, look for the last boundary where the relevant state was right and the first where it was wrong. [The SRE troubleshooting chapter](https://sre.google/sre-book/effective-troubleshooting/) applies the same method to communication between components. If the backend has committed a grant and the game reports a failure, investigate response delivery, mapping and presentation. That evidence moves the search past payment collection. If the native callback contains a token and the outgoing request lacks its required field, inspect the adapter's serialization.

A missing log is weaker evidence. Check the environment, process, retention, sampling and id propagation before concluding that a layer was never reached. Clocks on a phone and a server can disagree; use ids to join events and elapsed times measured within each process for durations. A shared wall-clock timestamp alone does not establish causality.

Choose the next check by the possibilities it separates, its cost and the state it might destroy. Reading a request's validation result costs less than rebuilding two platforms. Clearing app data can erase the pending purchase record you need. Write a hypothesis as a prediction: “If the callback arrived but dispatch was lost, the native entry will exist and the main-thread dequeue will not.” Then preserve the logs and make the smallest controlled change that tests it. During an incident, containment proceeds alongside this investigation, as [[#design-slos]] describes.

Debugging exercise: Take a recent bug and write one observation for each boundary you inspected, one assumption you made, and the cheapest check that would separate that assumption from a competing explanation.

?? boundary-last-good-layer A store callback contains a purchase token, but the adapter's serialized verification request lacks the required token field. Which boundary should you inspect next?
* The adapter's conversion from callback data to the request body
- The store's transition from a pending payment to a paid purchase
- The backend's transaction that applies a verified currency grant
- The game's refresh of the wallet after a successful grant reply
- The operating system's permission to open the purchase sheet
> The token exists in the callback and is missing from the serialized request. Comparing those two representations locates the observed loss in the adapter's conversion, before the backend can verify the purchase.

?+ The backend records a committed grant for the same operation that the client calls failed. Where should the investigation move?
* Along the response, mapping and display path back to the player
- Into the store's payment collection before the callback arrived
- Into the product catalog used before the purchase sheet opened
- Into the backend credentials used to verify the store purchase
- Into the database operation that first creates the grant record
> A committed grant establishes that the backend processed this operation. The client can still lose the reply, map it incorrectly, or update a screen that has gone. Trace the return path before treating the purchase as unpaid.

?+ A client log has a request id, but a backend search finds no matching entry. What conclusion does that observation support?
* The backend search has not yet established whether the request arrived
- The request stopped at the device's network permission check
- The gateway rejected the request before it reached the backend
- The backend received the request with a different product identifier
- The client sent the request to the production endpoint successfully
> A missing match may come from a wrong environment, missing id propagation, sampling or retention, as well as a request that never arrived. Check the coverage of the evidence before assigning the failure to a boundary.

?+ A native callback and main-thread dispatch both completed. The scene had unloaded, and the purchase screen was destroyed before dispatch. What is the next boundary to inspect?
* Delivery of the completed result to its surviving game owner
- Delivery of the initial purchase call across the native bridge
- Collection of payment while the operating system showed the sheet
- Lookup of the Java class when the SDK first initialized
- Selection of the backend URL before verification started
> The recorded callback and dispatch move the search to the result's owner. A screen can disappear while the operation continues, so the durable purchase record and the screen's presentation lifetime must be considered separately.

?+ The client received and parsed a successful verification reply, but its awaiting game operation remains pending. Which boundary is next?
* The handoff from the parsed response to the operation's completion
- The bridge call that first opened the native purchase sheet
- The store query that the server used to verify the purchase
- The request-body mapping before the verification request was sent
- The network connection that carried the reply back to the client
> Receiving and parsing the successful reply moves the search to completion of the waiting operation. Check its identity, completion source and dispatch, rather than reopening stages already accounted for by that reply.

?? boundary-cheapest-check A verification failure includes a request id and an HTTP validation error. Which next check gives useful separation at low cost?
* Read the backend's validation reason for that request
- Build a new player with a different managed stripping level
- Remove the SDK and repeat the release build from a clean export
- Clear the app's saved state and repeat the purchase from sign-in
- Upgrade the native dependencies and repeat the device smoke test
> The request already has a backend validation result. Reading that result can distinguish a missing field, an invalid value and an authorization problem without a rebuild or loss of the client's saved evidence.

?+ A bug occurs after a background and resume. A teammate suggests clearing app data before collecting logs. What should happen first?
* Preserve the logs and pending operation records from the failed run
- Delete the app's files to remove differences between the test devices
- Replace the affected account with a fresh account on the same build
- Reinstall the previous build and recreate its default configuration
- Restart the backend workers to remove requests left in their queues
> Clearing state can remove the lifecycle and pending-operation evidence that distinguishes the hypotheses. Preserve the failing run before testing whether a clean state changes the symptom.

?+ A request succeeds directly but fails through a traffic inspection proxy. Which check should come before changing the server API?
* Inspect the client's certificate trust and pinning failure
- Compare the server's request-body schema with the saved fixture
- Change the adapter's mapping of the server's success response
- Rebuild the player with a different product catalog bundled in it
- Compare the wallet grant rows created by repeated verification
> An inspection proxy changes the certificate chain presented to the client. A trust or pinning rejection can explain the proxy-specific failure before any HTTP request reaches the server.

?+ Two hypotheses remain: the callback never arrived, or it arrived and was lost before the main-thread queue drained. Which observation separates them directly?
* Paired callback-entry and queue-drain records for the operation
- Total purchase attempts grouped by the current client version
- The timestamp when the SDK dependency was added to the project
- The number of products returned by the initial catalog request
- A screenshot of the purchase screen before the player left it
> Callback-entry and queue-drain records place the same operation on both sides of the handoff. Aggregate counts or a screenshot may describe the symptom but do not separate these two paths.

?+ An intermittent failure already has preserved logs and two plausible causes. How should a diagnostic build be chosen?
* Change one relevant condition and compare the predicted observation
- Update the SDK, backend URL and stripping level in the same build
- Remove the logging so the next run matches release performance
- Restore the default build settings before reproducing the failure
- Repeat successful Editor tests until the symptom appears there
> A controlled change tests a prediction about a cause. Changing several relevant conditions together can make the failure disappear while leaving which condition mattered unresolved.

## Works in the Editor, fails on the device {#boundary-editor-device}

An Editor success establishes what the selected Editor implementation did. It may have called a fake, loaded a desktop plugin, or sent a request through the desktop's network stack. Unity's [plugin configuration documentation](https://docs.unity3d.com/6000.3/Documentation/Manual/plug-in-inspector.html) explicitly allows native plugins that run in the Editor. The gap is the mobile player path: its Android or iOS libraries, [[IL2CPP]], [[managed code stripping]], platform packaging, and the phone's operating system and hardware.

Write down the implementation that ran in each environment before comparing them. A fake that completes on the next frame does not test the SDK's callback thread, a permission denial or a process killed while a sheet is open. A desktop with ample memory does not reproduce a phone's memory pressure. Device file locations also differ; a path that happens to work on a case-insensitive development filesystem may be wrong elsewhere. On Android, `StreamingAssets` is packaged inside the APK and its path is a URL; [Unity's reference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Application-streamingAssetsPath.html) directs access through `UnityWebRequest` rather than an ordinary file read.

The first observation should separate mechanisms. A build with several settings changed at once makes a poor comparison. The rows below name observations to collect before deciding the fix:

| Symptom | First useful split | What the split does and does not establish |
| --- | --- | --- |
| Java class or method not found | Same build settings with [[R8]] minification off, then inspect the packaged class and keep rules | A change in behavior implicates optimization or its effects; a missing plugin or wrong name remains possible |
| JSON fields become empty in an IL2CPP player | Inspect the received body, then compare the same serializer at Minimal managed stripping | Separates an empty payload from a deserialization problem; a stripping-sensitive result needs a preservation fix |
| A request fails before an HTTP response | Read the final URL and the platform's transport error | An `http` URL suggests a cleartext policy check; HTTPS can still fail through DNS, certificates or connectivity |
| iOS closes at launch or first protected API call | Read the termination reason and native log | A [[dynamic linker]] message about a framework differs from a privacy message naming a missing purpose string |
| A callback works in the Editor and fails on a phone | Record callback entry and dispatch with their thread ids | Establishes whether the game API was reached on the expected thread |
| A bundled file loads on desktop and not on Android | Compare the exact name and the API used to read its runtime path | Distinguishes spelling and case from a URL being treated as a filesystem path |
| One Android device family fails | Compare [[ABI]], OS API level, native library packaging and device logs | A manufacturer label groups reports but does not establish the cause |
| A session disappears under memory pressure | Inspect the OS exit evidence and memory measurements | An OS termination needs different evidence from a caught C# exception |

Minimal is a diagnostic setting with a specific meaning. In Unity 6000.3, [Minimal stripping](https://docs.unity3d.com/6000.3/Documentation/Manual/managed-code-stripping-configure.html) preserves user-written managed code while searching engine and .NET class libraries for unused code. It still performs stripping. If a reflection-based serializer works there and fails at the release's higher setting with the same input, identify the members it needs and preserve them as in [[#http-dtos]]. Restore the release setting and verify the fix. R8 operates on a different part of the program: the Java or Kotlin code. Its keep rules do not preserve C# DTOs, and `link.xml` does not preserve Java classes ([[#gradle-r8-symbols]]).

Network policy also belongs to a particular implementation. Android's Network Security Configuration can restrict cleartext traffic; on iOS, [[App Transport Security]] applies to the URL Loading System, including `URLSession`. Check the client library and its underlying stack before assigning the error to either policy ([[#http-unity-clients]]). Changing an endpoint to HTTPS with valid certificates fixes a different problem from disabling validation.

For callback failures, compare the recorded native thread with the dispatch into Unity. `AndroidJavaProxy` runs on the Java thread that called it, and most Unity APIs require the main thread ([[#android-callbacks]]). Preserve the result and move the game work through the handoff the adapter promises. A disappearance after resume may instead be a lifetime problem: the thread can be right while the original owner is gone.

Debugging exercise: Choose a device-only bug. List the rows one unchanged release-configured run can investigate, then name the single build setting you would change if those observations leave two explanations.

?? boundary-first-split A Java class lookup fails in a device build. Which comparison most directly tests whether minification contributes?
* Repeat the lookup with R8 off and the other build settings held fixed
- Repeat the lookup after lowering C# stripping and changing the SDK version
- Repeat the lookup in the Editor using the existing platform fake
- Repeat the lookup after changing the backend environment to staging
- Repeat the lookup after increasing the adapter's request timeout
> R8 can remove or rename Java members reached by string lookup. A comparison that changes minification alone tests its contribution; the result still needs inspection of the packaged class and its keep rules.

?+ A device receives the expected JSON body, but a reflection-based DTO is empty at a higher stripping level and populated at Minimal. What should the next change target?
* Preservation of the managed members the serializer accesses
- R8 keep rules for the Java class that initializes the SDK
- Certificate trust for the request that delivered the JSON body
- The product catalog stored in the operating system's cache
- The request timeout used before the response was downloaded
> The input is present and deserialization changes with managed stripping. Preserve the required managed members and retest at the release setting. R8 rules affect Java or Kotlin code rather than C# DTO metadata.

?+ A request that works on desktop fails on Android before returning an HTTP status. Its configured URL begins with `http`. What should be checked first?
* The final URL, transport error and applicable cleartext policy
- The backend's JSON parsing of the response it sent to the device
- The correct mapping of a successful purchase result to the screen
- The database constraint that prevents repeated reward grants
- The managed fields preserved for deserializing a completed response
> A cleartext URL makes transport policy a useful early split. The platform's error and the networking stack decide whether that policy caused the failure; the URL alone does not prove it.

?+ An iOS launch report names `dyld` and a missing framework. Which check fits that evidence?
* Inspect the framework's embedding and dependencies in the built app
- Add a camera purpose string to the app's source property list
- Increase the timeout of the first backend request made at launch
- Preserve the C# fields used by the first JSON response at sign-in
- Change the backend endpoint selected by the release configuration
> A dynamic linker report naming a missing framework directs the investigation to the built app's native dependencies. A privacy termination naming a purpose string would direct it to a different configuration.

?+ An iOS termination message explicitly names a missing camera usage description. What should be inspected?
* The built app's `NSCameraUsageDescription` and the camera call path
- The debug symbols archived for the previous successful app version
- The APNs destination used by the production notification sender
- The native library's exported names used by the purchase bridge
- The Java keep rules packaged with the updated analytics dependency
> The privacy message names the configuration the camera API requires. Inspect the built app and why the SDK reached that API, including whether a newly enabled feature is intended to use it.

?+ A callback updates a Unity object from a Java worker thread on the phone. The fake calls it from the main thread. Which comparison addresses the failure?
* Callback and dispatch thread ids in the real adapter and fake
- Callback payload sizes before and after JSON serialization
- Native library versions before and after the latest SDK upgrade
- The SDK initialization order on the phone and in the Editor
- The completion timeout used by the real adapter and the fake
> The fake and the native adapter differ in their callback thread. Logging the handoff tests whether the game work reaches Unity's main thread as the interface promises.

?+ A `System.IO` read of an Android `StreamingAssets` path fails, while the desktop read succeeds. What is the first useful inspection?
* Whether the runtime path is an APK URL requiring another access API
- Whether managed stripping renamed the string containing the file path
- Whether Play App Signing removed the file while signing the APK
- Whether the backend response omitted the file's local directory name
- Whether the SDK's worker thread has permission to open a purchase sheet
> Android StreamingAssets is inside the compressed APK and the path is a URL. Inspect the path, exact filename and access API before treating the failure as an ordinary missing desktop file.

?+ Reports name one Android manufacturer. Which next comparison can turn that grouping into a testable hypothesis?
* Compare OS level, process ABI and packaged libraries across the reports
- Attribute the failure to the manufacturer's OS changes in the issue title
- Reclassify the reports as a store outage until another brand is affected
- Replace the SDK across platforms before collecting a native error
- Increase network retries for that manufacturer in the production config
> Manufacturer alone is a grouping label. OS level, ABI and library evidence can reveal a compatibility difference that predicts which devices fail, and therefore something a controlled reproduction can test.

## Works in development, fails in production {#boundary-dev-prod}

A development build and a store release differ in more than compiler optimization. Chapter 10 records those differences in the build identity ([[#release-build-variants]]). Start an investigation by comparing the failing artifact with the successful one: commit, Unity and SDK versions, resolved dependencies, signing identity, stripping and minification, configuration version, store channel and installed data. “Same code” leaves most of that comparison unanswered.

| Symptom | Difference to investigate | First check |
| --- | --- | --- |
| Sign-in works in a local APK and fails after a Play install | Certificate registered with the identity provider | Compare the installed app's signing certificate with the package and fingerprint registration |
| iOS push works from Xcode and fails in distribution | APNs environment and token registration | Inspect the signed app's `aps-environment`, the new token registration and the sender's destination |
| An SDK callback vanishes in release | [[R8]], [[managed code stripping]], or debug-only initialization | Compare the generated artifacts and the code that each build compiles |
| Verification fails for one environment | Backend URL, API credentials, product identifiers or feature flags | Read the build's environment stamp and the server's validation reason |
| A native library is absent on a subset of phones | Device-specific APK selection from the [[AAB]] | Inspect the APKs delivered for the affected device's [[ABI]] |
| A request trusts an inspection proxy in development but fails in release | Debug-specific certificate configuration | Inspect the trust configuration that the release networking stack uses |
| A fresh install works and an update fails | Persistent state from the previous version | Compare an upgrade with a fresh install of the same candidate |

With [[Play App Signing]], API registrations must recognize the certificate used to sign the APK delivered to that device. An upload certificate identifies uploads; it need not be the certificate on the installed app. Key upgrades can also make the installed certificate depend on the device's Android version, so inspect the affected artifact rather than copying a fingerprint from a developer's machine ([[#gradle-packaging-signing]]).

APNs has a similar distinction in a different place. The signed [[entitlements]] select the development or production environment. Distribution and beta provisioning normally select production, so the sender must use the destination appropriate to the newly registered [[push token]] ([[#os-notifications]]). This says nothing about the purchase environment: [[TestFlight]] purchases use the App Store sandbox. Keep those service environments separate in the investigation.

Reproduce with the candidate's release settings and distribution channel. On Android, use Google Play's internal testing track to exercise the app signing and APK delivery path. Internal app sharing uses its own signing key, so a success there does not validate the release's certificate registration. On iOS, use TestFlight for the distribution build and record which integrations remain in a test environment. [[#release-verification]] describes the checklist.

Install over the previous release as well as testing a clean install. Use a license tester's test payment method for the Play purchase run; joining a test track alone does not make purchases free. Preserve the failing artifact and its symbols before building the diagnostic variant. If a minification-off build succeeds, bring the targeted fix back to the release-configured candidate and test it through the same track. The altered diagnostic build has answered a hypothesis, but the candidate is what the player will receive.

Exercise: Write a development-against-production difference list for one integration, giving the artifact or log that checks each difference and the store-installed test that confirms the fix.

?? boundary-dev-prod-diff Sign-in succeeds in a locally signed APK but fails in the APK delivered by Google Play. Which difference should be checked first?
* The installed certificate against the identity provider's registration
- The Editor's selected scene against the production player's startup scene
- The backend's grant table against the client's displayed currency balance
- The device's free memory against the development machine's available memory
- The request's response fields against the serializer's managed keep rules
> A provider may identify an Android app by package name and signing certificate fingerprint. Play's delivered APK can carry a different certificate from the local build, so compare the installed certificate with the registration.

?+ Push works in an Xcode development install but fails in the distributed iOS build. What comparison addresses the environment difference?
* Signed APNs entitlement, registered token and sender destination
- Purchase receipt environment, product identifier and grant status
- C# stripping level, Java keep rules and request-body field names
- Store display version, release notes and the locale of the tester
- App bundle size, device free space and the upload signing timestamp
> The aps-environment entitlement selects the APNs environment at registration. The token and sender must belong to the matching environment; the store purchase environment is a separate setting.

?+ An SDK initializes in development but its initialization code is absent from the release player. Which difference is most directly implicated?
* Conditional compilation or code removal in the release build
- Certificate registration at the production identity provider
- Propagation of a server request id through the gateway's logs
- The device's entitlement to receive a previously granted purchase
- The APNs environment chosen by the notification provider connection
> Code can be excluded by compilation conditions or removed during optimization. Inspect the generated player and build settings to establish which happened before changing runtime credentials or backend behavior.

?+ A release works after clearing app data but fails when installed over the previous version. What should the next comparison hold fixed?
* The candidate binary while comparing old and newly created app state
- The app state while updating the SDK and the backend environment
- The previous binary while replacing its signed identity and store track
- The Editor fake while changing the production product catalog
- The latest logs while discarding the failing installation's saved data
> Using the same candidate with old and new app state isolates an upgrade-related difference. Keep the failing state so migration, cached configuration and persisted operations can be inspected.

?? boundary-release-repro A purchase fix passes in a local development build. Which run best checks the path that failed in the Play release?
* A release-configured candidate installed from the internal testing track
- A development APK signed locally with the key used for uploading bundles
- An Editor run against the production backend with the platform fake selected
- A minification-off APK installed directly after clearing the app's saved data
- An internal app sharing upload tested against a newly registered signing key
> The internal testing track exercises Play delivery and app signing with the candidate's release configuration. The other runs change conditions that may have caused the production failure.

?+ A candidate succeeds through internal app sharing. Why is a track install still needed for a signing-sensitive integration?
* Internal app sharing signs uploads with a separate sharing key
- Internal app sharing turns off the candidate's managed stripping level
- Internal app sharing replaces the native SDK with the Editor implementation
- Internal app sharing restores the saved state from the last production build
- Internal app sharing selects the production backend credentials for the app
> Internal app sharing re-signs uploads with its own key. Its successful install therefore does not establish that the integration accepts the certificate used for a testing or production track.

?+ A release fails with R8 enabled and succeeds with R8 disabled. Which result is needed before accepting a keep-rule fix?
* The store-installed candidate passes with R8 enabled and the targeted rule
- The Editor fake passes the adapter's success-result mapping test
- The diagnostic APK passes with R8 disabled on a second device
- The release build completes after skipping the failing SDK's initialization
- The backend returns a successful response to a manually constructed request
> Turning R8 off provides diagnostic evidence. A keep-rule fix must survive the original release configuration and distribution path, because those are the conditions the fix is meant to support.

?+ A team schedules a purchase test on a Play internal testing track. What setup avoids treating track membership as payment isolation?
* Use a configured license tester and its test payment method
- Register the tester's upload certificate with the purchase backend
- Turn off R8 so the store identifies the player as a developer
- Upload through internal app sharing using the same product catalog
- Lower managed stripping to Minimal before opening the purchase sheet
> A tester on a testing track can still make real purchases. A configured license tester's test payment method provides the intended billing test path; a build setting or track membership does not.

## Worked case: purchases fail in production after an SDK update {#boundary-purchase-case}

This case is invented. After an Android SDK update, players on the new release report that payment completes but currency does not arrive. The previous client version is still succeeding. The purchase-start count is normal, while grants per started purchase fall for the new version. Separate store cancellations and pending payments from verified purchases without a grant; a single “purchase error” total conceals those differences.

The incident owner halts the [[staged rollout]] and disables new purchase starts on affected clients through an existing flag, while keeping purchase recovery and the backend's reconciliation worker running. Players already on the release remain affected after a rollout halt. The client explains that completion is delayed and does not invite another purchase to repair the first. Preserve the release's binary, symbols, configuration snapshot, dependency diff and logs, following [[#design-slos]].

The update is a lead. Several mechanisms fit its timing:

| Hypothesis | Evidence that would separate it |
| --- | --- |
| The adapter maps a newly exposed result to failure | A raw SDK result and the game's mapped result disagree for one operation |
| [[R8]] removed a class reached by name | A minified release reports a class lookup failure before the native operation completes |
| Purchase completion was omitted during integration | Verified grants exist, but consumption or acknowledgement remains outstanding |
| The store installation changes identity or packaging | The candidate differs between a local install and the internal testing track |
| The verification request changed shape | The server rejects a field that the updated adapter now serializes differently |
| Production uses incompatible configuration | The failing build's endpoint, app identity or credential registration differs from the successful run |

Trace a failed operation before choosing one. The following diagnostic records are fictional and abbreviated. `purchase_ref` is an opaque reference to a protected purchase record; it is not the store token, which stays out of these logs. Field names are logged, but their sensitive values are not.

```text
client op=p41 attempt=a1 build=new env=production stage=purchase-start
native op=p41 stage=callback state=PURCHASED purchase_ref=r17
client op=p41 attempt=a1 stage=verify-send fields=productId,token
server op=p41 attempt=a1 route=verify-v1 result=400 missing=purchaseToken
server op=p41 purchase_ref=r17 grant=absent
client op=p41 stage=adapter-result result=verification-failed
```

The native callback reached the client. The server received the verification request and rejected its shape. This narrows the immediate failure to the adapter's outgoing contract. It does not establish that the store token is valid or that the purchase belongs to this player; validation has not reached those checks yet. It also gives no reason to alter R8 rules for this operation.

The integration copied the updated SDK object's `token` property into the request by serializing that object directly. The backend's existing contract still expects `purchaseToken`. A recorded, sanitized fixture reproduces the mismatch without starting another payment. The fix maps the SDK result into the game's stable request DTO, as [[#http-dtos]] recommends. An SDK's internal object is not the game's network contract.

A compatible backend patch can also accept either field while affected clients remain installed, rejecting conflicting values and applying the same authentication, store verification, ownership and duplicate-grant checks to both forms. That is an explicit compatibility path, not acceptance of an unverified receipt. Keep the old field working for older clients and retire the temporary input only under the compatibility policy from [[#http-versioning]].

Fixing new attempts leaves purchases from the incident unresolved. Use the durable records from [[#design-economy]], client purchase queries and store notifications to identify them. A Google Play real-time notification says that state changed; the backend queries the Developer API for the current state before acting. For the one-time consumable in this case, the recovery sequence is:

1. Associate the purchase with the intended player and product, and verify its current state with the store. A client timeout is not a store verdict.
2. If it is pending, retain it for reconciliation without granting currency. If it is a valid purchased item, pass the entitlement and ownership checks.
3. Commit the grant and its deduplication record in one transaction. Use the store purchase identity to recognize a repeat, as the [[ledger]] in chapter 13 does. A retry's new attempt id must not create a new grant.
4. Consume the successfully granted consumable through the store API and durably record the outcome. If the reply is lost, reconcile that outcome and retry according to the API's state; do not repeat the currency grant. A non-consumable uses acknowledgement instead.
5. Refresh the client's authoritative balance. A committed grant with a lost response needs delivery of the result, not another credit.

Google Play's [billing integration guide](https://developer.android.com/google/play/billing/integrate), checked September 27, 2026, requires acknowledgement within three days of a purchase reaching `PURCHASED`; consumption satisfies that requirement for consumables. The window does not run while payment is `PENDING`. This requirement predates this imaginary SDK update. The test environment uses an accelerated interval, so test timing is not evidence of the production deadline.

Work through the backlog promptly, before acknowledgement deadlines expire. An expired, refunded or revoked purchase needs its current store state reconciled with any existing grant; do not credit it as a newly verified paid purchase merely because an old client log says `PURCHASED`. If a grant already exists, apply the refund and entitlement policy, keeping an audit record. If the player paid but received neither content nor a refund, track the case to delivery or a refund through support. A gesture of compensation is a separate recorded decision. There is no single “refund window” that settles these cases across stores. On iOS, verified delivery precedes finishing the StoreKit transaction; apply Apple's transaction and revocation states rather than copying Play's acknowledgement deadline.

Verify the fix with the release-configured candidate on the internal testing track. Follow a test purchase from callback through server verification, one durable grant and successful consumption. Repeat recovery after a lost response and a restart, and send a duplicate callback for the same purchase through a controlled test. Check the balance and grant record, not just the screen's success message. Also run an old-client request against the compatible backend.

Prevention follows the observed cause and the nearby risks. Keep a contract fixture from the SDK response through the outgoing DTO, a server test that accepts the supported request shapes, and a store-installed purchase smoke test. Review resolved dependencies and the merged manifest when an SDK changes, because a request-contract fix says nothing about a new native dependency or permission. Monitor verified purchases without grants and grants awaiting store completion so that the next incident has a count and an owner.

Interview exercise: Tell this investigation aloud for “push notifications stopped arriving on iOS after a release”. State the symptom, contain the impact, follow one token registration and send attempt, and name the observation that separates the signed environment from the sender's configuration.

?? boundary-purchase-first-check Purchases appear to fail after an SDK update, while the previous client version succeeds. What should the first diagnostic comparison establish?
* Which stage first differs in a traced operation from each client version
- Which R8 rule to add for the class whose SDK version changed
- Which timeout to increase before another purchase attempt is made
- Which new acknowledgement rule the updated SDK introduced
- Which backend service to restart before preserving the failed requests
> The release correlation narrows scope but leaves several mechanisms possible. Compare one operation across its boundaries to distinguish callback, mapping, request, validation, grant and completion failures.

?+ A native callback says `PURCHASED`, and the server rejects the same attempt for a missing request field. What has the trace established?
* Verification stopped at the outgoing request's contract mismatch
- The store completed verification of ownership for the logged-in player
- The purchase failed because the native callback class was stripped
- The backend granted currency and lost its successful reply in transit
- The SDK's acknowledgement deadline expired before payment completed
> The server received a request whose shape violated its contract. Store verification and ownership checks have not yet run, so the callback alone does not establish a valid entitlement.

?+ The client logs `verification-failed` after processing an HTTP reply. Which paired evidence distinguishes response mapping from a backend rejection?
* The backend response category and the adapter's mapped result
- The SDK initialization result and the configured product catalog
- The expected request schema and the previous release's request body
- The backend grant totals and the number of active client sessions
- The current SDK version and the version of the native bridge
> Comparing the received response with the game result shows whether the adapter changed a successful response into a failure. A recorded backend rejection instead directs the investigation to its stated cause.

?+ Several SDK-related hypotheses fit the release timeline. One failed request already has a server validation error. What should guide the next diagnostic action?
* The rejected field and the adapter code that constructed it
- The new SDK's reflection rules before examining that request
- The release certificate before reading the validation reason
- The callback dispatch thread before inspecting the request body
- The store's acknowledgement status before locating the rejection
> A concrete validation error identifies a violated contract. Inspecting that field's construction tests the evidence in hand; choosing a package or device from broad correlations does not yet explain this rejection.

?? boundary-purchase-recovery The store currently verifies a purchased consumable, the player association is valid, and no grant exists. What should recovery do?
* Commit a deduplicated grant, then consume and record completion
- Consume the item, discard its record and ask the player to try again
- Grant again for each notification that reports the same purchase
- Wait for the player to make another purchase before granting this one
- Treat the old client timeout as evidence that the payment was cancelled
> A valid purchase without a grant still needs delivery. Commit the grant with its deduplication record, then complete consumption and retain enough state to recover a lost response without crediting again.

?+ A grant is committed, but the client timed out before receiving the result. What should a repeat verification return?
* The recorded outcome with the current authoritative balance
- A new currency grant identified by the retry's new attempt id
- A payment cancellation inferred from the client's timeout message
- A request to buy the same item again so the balance can be repaired
- A pending-payment status inferred from the missing client response
> The durable grant establishes that delivery was committed. A repeat uses the store purchase identity to recover that outcome and refresh the balance, rather than treating the retry as another purchase.

?+ A notification arrives twice for a purchase that still needs recovery. Which identity should prevent a duplicate currency grant?
* The verified store purchase identity in the durable grant record
- The current request attempt id created for each notification handler
- The timestamp when the latest callback reached the game thread
- The session identifier assigned when the player last opened the app
- The app version printed in the client's original purchase-start log
> Attempts, sessions and notifications can change while the underlying purchase stays the same. A durable uniqueness check on the verified purchase identity prevents another grant for that purchase.

?+ The store's current state is pending and no grant exists. What does recovery do now?
* Retain the operation and wait for a verified purchased state
- Grant the currency and consume before the payment completes
- Start the acknowledgement deadline from the client's first tap
- Mark the purchase cancelled because there is no grant record
- Create a new purchase to replace the one awaiting payment
> Pending payment does not yet authorize entitlement. Keep the operation available for later reconciliation; Play's acknowledgement window begins when the purchase reaches PURCHASED.

?+ An old callback reports `PURCHASED`, but a fresh store query shows revocation. What should decide recovery?
* Reconcile the current store state with the recorded grant and policy
- Grant the old callback's amount because it predates the revocation
- Acknowledge the old callback before querying the existing grant record
- Use the new attempt id to bypass the purchase's previous grant record
- Treat the server notification as a replacement for checking store state
> Recovery must use current verified state and the durable grant record. A historical callback can predate a refund or revocation; it is insufficient to authorize a fresh paid grant.

?+ The team disables the purchase feature during an incident. Which behavior must remain available to recover money already spent?
* Reconciliation and delivery for existing purchase records
- Creation of new purchase attempts when a previous attempt timed out
- Deletion of old pending records when the player returns to the menu
- Regranting currency whenever a duplicate store callback arrives
- Acceptance of client purchase success without backend verification
> Stopping new purchase starts limits further impact, while existing purchases may still need verification, delivery and store completion. Turning off recovery would strand those purchases rather than resolve them.

?? boundary-prevention-check A release broke because the adapter serialized an SDK object directly into the backend request. Which regression test addresses that cause?
* A sanitized SDK fixture mapped into the supported request DTO
- A fake that returns success without constructing a verification body
- A check that the purchase button is visible in the startup scene
- A comparison of the app's total binary size before and after the update
- A test that the development build can download the product catalog
> The defect crossed the SDK-to-network-contract boundary. A fixture that passes through the mapping and asserts the supported request shape catches that boundary changing again.

?+ A request-contract test passes after the fix. Which additional test covers release packaging and the store path it does not exercise?
* A store-installed release purchase followed through grant and consumption
- A second Editor run against a fake that uses the same response fixture
- A serializer test with a different product name in the same request shape
- A backend test that manually inserts a completed grant for the test player
- A local script that sends the expected JSON directly to the verification API
> A contract test checks the transformation it runs. A release-configured store install also exercises native packaging, signing, callbacks and billing completion, which the fixture does not reach.

?+ A team tests recovery by interrupting the response after a committed grant, then restarts and retries. Which assertion checks the recovery invariant?
* One purchase has one grant, and the client recovers the balance
- The second request uses the same transport connection as the first
- The callback reaches the screen before the backend writes its grant
- The retried request has a lower latency than the initial request
- The client shows success before it queries the authoritative balance
> Recovery succeeds when the existing purchase is delivered once and its outcome is recovered. Connection reuse, timing and presentation order do not establish that the currency was not duplicated.

?+ A compatibility patch accepts the old and new request field names. What should its regression suite include?
* Both shapes with identical verification and duplicate-grant checks
- The new shape with ownership validation skipped during the rollout
- The old shape with its grant recorded under a different purchase key
- Both shapes with the first received field trusted when values disagree
- The new shape with a fresh grant for each client retry after timeout
> Accepting another input shape must preserve authentication, ownership, store verification and deduplication. Conflicting aliases need rejection; compatibility is not a reason to weaken the entitlement checks.

## Native crashes after an SDK update: a second case {#boundary-crash-case}

In this second invented case, crashes rise after an Android SDK update. The reports come mostly from one device family, and the first stack shown in the dashboard ends in a native SDK library. The rollout owner halts expansion while the team checks the rate among users of the new version. A popular device can dominate raw report counts without having a higher failure rate, so compare affected users or sessions with the exposed population for each group.

Group reports by build, signal or exception, stack signature, OS level and [[ABI]]. Keep launch-time library load failures apart from native signals after a successful launch, [[ANR|ANRs]] and OS memory terminations. Inspect device configuration within a group, including native memory page size where relevant. Android's [page-size guidance](https://developer.android.com/guide/practices/page-sizes), checked September 27, 2026, describes devices with 16 KB pages and the need for compatible native libraries and packaging. A manufacturer's name is too coarse to identify that property.

Collect the full native report from [[logcat]] and, where available, its [[tombstone]]. It contains more evidence than a dashboard's first frame. Preserve the opening line of asterisks if using `ndk-stack`, because its parser uses that line. [[Symbolication]] turns addresses into function names and, when the debug information includes them, source lines. It needs the matching native symbols for the crashed library and ABI, as [[#android-failure-evidence]] explains.

The following commands inspect saved artifacts; they do not require connecting a phone. Run them with the Android NDK tools on the path, replacing the example filenames with those from the failed build:

```bash
llvm-readelf -n symbols/arm64-v8a/libexample.so
ndk-stack -sym symbols/arm64-v8a -dump crash.txt
unzip -l delivered-arm64.apk
```

The first command prints notes including the build ID, the linker's identifier for that binary. Compare it with the report before using the symbols. The second resolves frames for which matching symbols are available. The last lists the files in a saved device APK, so you can inspect its `lib/arm64-v8a/` entries; inspect the device's other installed splits too when the library may be there. A newly rebuilt copy of the same commit does not establish a symbol match. Archive the files from the shipped build, including vendor symbols that Unity's own symbol archive does not supply.

Now rank hypotheses against the kind of failure:

| Hypothesis | Evidence to seek |
| --- | --- |
| The SDK has no binary for the affected ABI | Missing library in the delivered APK set and a corresponding load error |
| The SDK uses native APIs unavailable on older OS versions | A loader error naming an unavailable symbol, checked against the library's supported minimum OS |
| Two dependencies supply the same native library path | The dependency and package contents, plus the native merge task's output and packaging rules |
| Native page-size assumptions differ from the device | The affected device's page size and the packaged libraries' alignment and runtime assumptions |
| A callback reaches a Unity API from a worker thread | The callback thread and the bridge's dispatch record for the crashed operation |
| Native memory has already been corrupted | The full stack, object lifetime evidence and a reproduction under a suitable memory diagnostic tool |

A missing library commonly produces a load failure; it does not explain a later bad-memory-access stack merely by appearing in the same release. A raised, correctly declared minimum OS can instead prevent installation on older devices. Identify what the installed app did before grouping these symptoms together.

Duplicate native files also have two different stages. Android's build documentation shows a native merge failure for two files with the same APK path. A `pickFirsts` packaging rule can select one of them, as the [Android Gradle Plugin reference](https://developer.android.com/reference/tools/gradle-api/8.10/com/android/build/api/dsl/JniLibsPackaging) specifies, but that selection proves nothing about its compatibility with both callers. Inspect which file was selected and the versions each SDK expects. Prefer a compatible dependency set to hiding a collision with a broad packaging rule.

In this case, the evidence eventually shows a worker-thread callback entering a Unity object API. The previous adapter queued that work; the update bypassed the queue on an error path. A minimal project reproduces the same stack when that error is triggered, and restoring the handoff removes the failure across repeated runs on the affected configuration. This is the case's evidence for the fix. The top SDK frame alone was not: a library can crash while using a pointer corrupted or freed by its caller. Apple's [memory-access crash guide](https://developer.apple.com/documentation/xcode/investigating-memory-access-crashes) explains why the offending write may be absent from the stack at the later crash.

On iOS, use the complete OS crash report and read its exception and termination reason before its frames. A [[dynamic linker]] failure, a watchdog termination, a memory termination and a bad memory access need different investigations ([[#ios-failure-evidence]]). Locate each binary's [[dSYM]] by the UUID in the report, checking it with `dwarfdump --uuid`. Apple's [symbol-file guide](https://developer.apple.com/documentation/xcode/locating-a-missing-debug-symbol-file) requires the binary and dSYM UUIDs to match. A device report needs the device build's symbols; a simulator reproduction can help isolate code without replacing that evidence.

If the SDK still appears responsible, prepare a minimal project before escalation. Keep the exact SDK, Unity and build-tool versions, the relevant stripping and packaging settings, and the lifecycle or callback sequence that reproduces it. Remove unrelated gameplay in steps, rerunning after each reduction so the failure remains. Give the vendor the expected and observed behavior, affected OS and ABI, steps and frequency, complete symbolicated reports, binary identities and the comparison with the last working version. Redact player data and credentials without removing the stack, identity or configuration evidence needed to reproduce. An SDK stack frame makes a useful investigation lead; a reproducible failure under its documented contract makes a useful vendor report.

Lab exercise: Reduce one SDK problem to a minimal project while preserving its failure. Keep a short record of each removed component and rerun, then assemble the version list, reproduction steps and matching crash artifacts another engineer would need.

?? boundary-crash-cluster Most crash reports come from the most popular device model. What comparison should precede attributing the regression to that model?
* Failures relative to exposure within each build and device group
- Raw report counts sorted by device manufacturer across app versions
- The total install count for the app across the entire release history
- The number of symbols resolved in the first report for each model
- The packaged size of the updated SDK compared with other SDKs
> A large exposed population can produce many reports at an ordinary failure rate. Compare rates within the new build and device groups, then use OS, ABI and stack evidence to explain an elevated group.

?+ An Android native report has addresses but few useful function names. What must be checked before trusting a newly symbolicated stack?
* The library build ID and ABI against the archived symbol files
- The source branch name against the branch used by the latest build
- The store display version against the SDK's package version string
- The device model against the workstation used to compile the symbols
- The upload certificate against the key used for the internal test track
> Symbolication needs symbols for the binary that crashed. Build identity and ABI establish the match; rebuilding a branch or matching a display version does not establish that the resulting addresses belong to the same binary.

?+ A new SDK fails to load on older Android versions with an unavailable native symbol. Which hypothesis fits that group most directly?
* The library references a native API missing on those OS versions
- The game's verification DTO changed one of its JSON field names
- The backend's production credential registration uses an old fingerprint
- The store's purchase notification arrived after the client stopped waiting
- The SDK callback reached the correct Unity thread after the scene unloaded
> A loader error naming an unavailable native symbol points to native API compatibility with the affected OS versions. Inspect the library's minimum requirements and imports before attributing it to an unrelated request or callback path.

?+ A build log reports two native files with the same APK entry path. What does adding a matching `pickFirsts` rule establish?
* One matching file is selected for packaging
- Both SDKs receive their preferred version at runtime
- The two native implementations are binary-compatible
- The duplicate is removed from the dependency graph
- The selected library supports the older device's OS APIs
> pickFirsts selects a file for that APK path. It does not establish compatibility with both consumers, remove the dependency conflict, or verify the selected file's OS support.

?+ A crash's top frame is inside an SDK, but the caller may have freed the object it passed. What conclusion should guide investigation?
* The frame locates the failing access, while the earlier lifetime remains suspect
- The frame proves the SDK violated its contract independently of the caller
- The frame eliminates callback thread and ownership as possible causes
- The frame establishes that the packaged library came from the intended SDK
- The frame shows that changing the SDK version will repair the caller's lifetime
> A stack records the code executing when the crash surfaced. The memory may have been corrupted or freed earlier, so the caller's ownership and thread behavior remain relevant even when the final access is inside the SDK.

?? boundary-vendor-repro Which report gives a vendor the best starting point for an SDK crash investigation?
* A minimal reproducer, exact versions and a matching symbolicated report
- A screenshot of the failure dialog and the latest available SDK package
- A source branch name and a stack decoded with a fresh local rebuild
- A list of affected manufacturers without the build or reproduction steps
- A complete gameplay project with player credentials left in its logs
> A minimal reproducer with exact versions and matching crash evidence lets another engineer reproduce the same failure. A screenshot, ambiguous build identity or unnecessary private data makes the cause harder to isolate.

?+ Removing the app's background-and-resume step makes the minimal project stop crashing. What should the reproduction retain?
* The lifecycle step and the callback state that carries across it
- The smaller project as proof that the SDK has no lifecycle defect
- The latest SDK in place of the version from the failing release
- A fresh account in place of the preserved callback and timing records
- The crash screenshot in place of the now-removed reproduction step
> Reduction is useful while it preserves the failure. A lifecycle step that makes the difference is part of the reproduction and helps the vendor investigate callback lifetime or dispatch behavior.

?+ An iOS report needs symbolication. A teammate supplies a dSYM from a rebuild of the same source revision. What should the report author do?
* Compare its UUID with the crashed binary before using its symbols
- Accept it because source revision equality establishes address equality
- Accept it if its filename matches the app's current display name
- Replace the report's build identity with the rebuilt binary's UUID
- Use the simulator's dSYM if the device dSYM resolves fewer frames
> A dSYM is compatible with a binary when their build UUIDs match. A rebuild from the same revision may produce another binary; its symbols cannot be assumed to describe the one in the report.

?+ A vendor requests the full crash report. Which preparation preserves useful evidence while protecting the player?
* Redact personal data and secrets while retaining diagnostic identities and frames
- Remove the library names and binary identities but retain the player's account
- Replace the report with the first SDK frame and omit the triggering sequence
- Upload the app's signing files beside the crash report to identify the build
- Regenerate the stack with symbols from the latest SDK before sharing it
> The vendor needs frames, binary identities and reproduction context. Player data, secrets and signing files are unnecessary; symbols must still match the original crashed build.

?+ A team can reproduce a crash only with the release's packaging rule and callback order. What should accompany the minimal project?
* Those settings and the steps that preserve the observed sequence
- Default packaging settings to make the project easier to build
- A simplified callback that completes synchronously in the Editor
- The SDK's latest package version even though the failure used another
- A screenshot replacing the native report to keep the attachment small
> A minimal project must preserve the conditions that cause the failure. Exact packaging settings and callback steps are part of that evidence, even if removing them makes the project simpler.
