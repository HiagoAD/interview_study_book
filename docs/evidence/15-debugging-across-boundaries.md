# Evidence for chapter 15: Debugging across boundaries

What Phase 33 checked the chapter's claims against, and where the outline was wrong. [PLAN.md](../PLAN.md), under “Decisions: evidence”, says what counts as evidence.

The sources were read on September 27, 2026. Unity documentation is pinned to 6000.3, and the installed tools are from 6000.3.11f1. The native packaging reference is pinned to Android Gradle Plugin 8.10, the version used by the probe's exports. The two worked incidents and their diagnostic records are explicitly invented teaching cases, not reports of device tests.

The delegated evidence CLI could not initialize inside the filesystem sandbox. Automatic approval review rejected the external retry because its prompt would send repository-derived material outside the machine. The phase therefore used the plan's inline Rule A fallback for evidence and its inline teacher's read for review. No delegated model ran successfully, and no delegated token usage was reported. The same rejected invocation was not retried for review.

The session fetched public documentation without sending repository contents, extracted passages with Python, and saved 72 receipts: 70 documentation receipts and two local command-output receipts. Each quote was checked with `docs/evidence/codex/check_receipts.py`, then the public pages were fetched again into a fresh cache and checked again; none failed. The receipt JSON, fetched pages and command logs are scratch artifacts outside the repository. The durable sources and the limits of their support follow.

## Checked, and against what

### boundary-method

- Hypothesis testing, comparison of observed state, controlled changes and bisection along component communication paths: confirmed by the SRE troubleshooting chapter, https://sre.google/sre-book/effective-troubleshooting/. The book's cost-and-information ordering is an application of that method, not a numerical optimization algorithm or a promise that one check is cheapest in every incident.
- Preserve failure evidence while mitigating: confirmed by that same chapter. The separate operations, coordination and communication responsibilities build on chapter 14 and https://sre.google/sre-book/managing-incidents/.
- Logcat's `threadtime` format reports date, invocation time, priority, tag, process id and thread id: confirmed, https://developer.android.com/tools/logcat. The chapter makes no claim that clocks on separate machines are synchronized.
- For an issue without a crash, the OS console is useful evidence: confirmed, https://developer.apple.com/documentation/xcode/acquiring-crash-reports-and-diagnostic-logs.
- Certificate pinning constrains the accepted certificate chain, and Android debug CA overrides depend on `android:debuggable`: confirmed, https://developer.android.com/privacy-and-security/security-config. The chapter does not claim that an arbitrary packet capture decrypts TLS or that a proxy failure proves the production endpoint is broken.
- Operation and attempt ids, sensitive-data exclusion, and uncertainty after a missing response reuse the distinctions in chapters 8 and 9. The chapter's deductions from complete, paired observations are worked examples. A missing log remains inconclusive until the search scope and instrumentation are checked.

### boundary-editor-device

- The Editor can execute compatible native plugins, including in Play Mode: confirmed, https://docs.unity3d.com/6000.3/Documentation/Manual/plug-in-inspector.html. This corrects the outline's blanket statement that the Editor does not run native code. The relevant gap is the mobile player implementation and environment.
- Unity 6000.3 Minimal managed stripping preserves user-written code while searching UnityEngine and .NET class libraries. It is not disabled stripping; the Disabled option is restricted to Mono: confirmed, https://docs.unity3d.com/6000.3/Documentation/Manual/managed-code-stripping-configure.html.
- Reflection can hide managed dependencies from static analysis, and `link.xml` or preservation annotations can retain those dependencies: confirmed, https://docs.unity3d.com/6000.3/Documentation/Manual/managed-code-stripping-preserving.html. A Minimal comparison is diagnostic evidence; the proposed fix is verified with the original release setting.
- R8 can rename or remove Java or Kotlin members accessed through reflection or JNI string lookup: confirmed, https://developer.android.com/topic/performance/app-optimization/keep-rules-overview. Disabling R8 does not establish which member was removed or exclude an optimization-sensitive timing defect. The chapter explicitly asks for the packaged class and keep rules to be inspected.
- Android StreamingAssets resides in the compressed APK, its path is a URL, and Unity directs access through UnityWebRequest: confirmed, https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Application-streamingAssetsPath.html. The chapter distinguishes filename case from using a filesystem API on a URL.
- Android's network configuration can restrict cleartext traffic. ATS requires HTTPS for connections through the URL Loading System, including URLSession: confirmed, https://developer.android.com/privacy-and-security/security-config and https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity. The chapter requires identifying the networking implementation before assigning either policy as the cause.
- Camera access requires `NSCameraUsageDescription`, and missing protected-resource purpose strings can cause access failure or termination: confirmed, https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription and https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources. The correct current capture guide is https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media; a guessed URL containing `capture-setup/` returned 404 and was discarded.
- A missing framework can produce a termination description identifying `dyld` and the dependency: confirmed, https://developer.apple.com/documentation/xcode/identifying-the-cause-of-common-crashes. The table follows the reported reason rather than treating every iOS launch failure as missing privacy configuration.
- AndroidJavaProxy runs on the calling Java thread; most Unity APIs require the Unity main thread: confirmed, https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AndroidJavaProxy.html and https://docs.unity3d.com/6000.3/Documentation/Manual/async-awaitable-continuations.html. Thread correctness and ownership lifetime remain separate checks.
- Device memory terminations and their evidence are recapped from the native failure sections of chapters 2 and 3. The new section prescribes inspection rather than claiming a reproduced phone memory limit.

### boundary-dev-prod

- App signing and upload signing have different roles; identity providers can register package names with certificate fingerprints: confirmed, https://developer.android.com/studio/publish/app-signing. That page also documents key upgrades that use the new key for newer Android devices and the old key for earlier versions. Inspecting the affected installed artifact avoids assuming one signing certificate across all devices.
- Internal app sharing re-signs uploads with an Internal App Sharing key: confirmed, https://support.google.com/googleplay/android-developer/answer/9844679?hl=en. It does not establish the identity of an APK delivered through a release track.
- `aps-environment` selects the APNs registration environment and is set from provisioning; production and prerelease provisioning use production by default: confirmed, https://developer.apple.com/documentation/bundleresources/entitlements/aps-environment. The chapter asks the reader to inspect the signed entitlement, token registration and sender destination together.
- TestFlight purchases run in the sandbox: confirmed, https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/. This is kept separate from the distribution build's APNs environment.
- Test-track membership does not make billing free, and license testers have test payment methods that avoid charges: confirmed, https://developer.android.com/google/play/billing/test. The prose specifies both the license tester and the test payment method.
- Debug certificate overrides can differ from release trust rules: confirmed by the Android Network Security Configuration page above. The table does not assume that every Unity networking implementation obeys that Android setting.
- Release configuration, environment stamps, old saved data, store delivery, device-specific APKs and a final test under the original failing configuration build on chapter 10. Fresh-install and upgrade comparisons are diagnostic recommendations, not device observations made during this phase.

### boundary-purchase-case

- A client callback alone does not authorize a grant. Server verification, eligibility, player association and a durable purchase-token uniqueness check are documented: confirmed, https://developer.android.com/google/play/billing/security. The fictional server rejects the request shape before those checks; the chapter explicitly limits what that trace proves.
- A pending purchase must reach PURCHASED before entitlement is granted: confirmed, https://developer.android.com/google/play/billing/integrate. Purchase queries after connecting recover updates the application missed while disconnected or stopped.
- Google Play requires acknowledgement within three days after a purchase reaches PURCHASED, with refund and revocation for missed acknowledgement; consumption satisfies acknowledgement for consumables: confirmed in the same integration guide. The figure is dated in prose and is never a correct answer.
- Acknowledgement is not presented as a novel requirement of the imaginary SDK update. Its history is documented in https://developer.android.com/google/play/billing/release-notes. The actual invented defect is the integration's serialization of an SDK object into a stable backend contract.
- License-test unacknowledged purchases use an accelerated refund interval: confirmed, https://developer.android.com/google/play/billing/test. The chapter gives no test interval as a production deadline.
- Real-time developer notifications signal a change and require a Developer API query for complete purchase status: confirmed, https://developer.android.com/google/play/billing/rtdn-reference. The current state, rather than the age or arrival order of a callback, determines recovery.
- Voided-purchase handling can require entitlement revocation; a refund without the revoke option is distinct and is not returned by that API: confirmed, https://developers.google.com/android-publisher/voided-purchases. The chapter makes no blanket claim that all refunds have identical entitlement consequences.
- StoreKit `finish()` follows content delivery or service enablement: confirmed, https://developer.apple.com/documentation/storekit/transaction/finish(). Play's acknowledgement deadline is not applied to Apple transactions.
- Grant plus deduplication in one durable transaction, recovery of a committed result, and a subsequent store completion step reuse chapter 13's ledger design. No distributed transaction across the store and the game's database is claimed. The chapter tells the reader to persist and reconcile the completion outcome after a lost response.
- The alias-compatible request parser, rejection of conflicting fields, unchanged verification, and old-client regression run apply chapters 8 and 14's contract-compatibility rules. No real SDK is claimed to rename this field, and no backend was patched during this phase.
- Halting expansion while preserving recovery, the minimal fixture, the store-installed smoke test and the monitoring recommendations are the worked incident's response plan. No purchases were made, refunded or acknowledged during the phase.

### boundary-crash-case

- Native Android reports carry signal, backtrace and binary identity information. Tombstones add other threads, memory maps and related process evidence: confirmed, https://source.android.com/docs/core/tests/debug/native-crash. Raw reports are kept apart by build and failure kind; the exposed-population denominator is an explicit analytic choice.
- `ndk-stack` requires unstripped libraries and uses the opening line of asterisks when parsing a crash log: confirmed, https://developer.android.com/ndk/guides/ndk-stack. The installed tool accepts both `-sym` and `-dump`, checked locally below.
- Native libraries have ABI-specific APK paths, and an APK can be inspected as a zip file: confirmed, https://developer.android.com/ndk/guides/abis. The chapter asks for the complete delivered split set where necessary.
- Strong references to unavailable native APIs can cause load failure on older OS versions: confirmed, https://developer.android.com/ndk/guides/using-newer-apis. A correctly declared minimum API level prevents installation below it: confirmed, https://developer.android.com/guide/topics/manifest/uses-sdk-element. These differ from a later native bad-memory-access crash.
- Android documents duplicate native paths failing a native-library merge task: confirmed, https://developer.android.com/studio/projects/gradle-external-native-builds. The evidence supports a possible build-time failure, not a universal claim about every pair of same-named files regardless of path or configuration.
- `pickFirsts` packages the first native library found for a matching APK entry path: confirmed, https://developer.android.com/reference/tools/gradle-api/8.10/com/android/build/api/dsl/JniLibsPackaging. Its documented selection behavior does not promise ABI or version compatibility with every consumer. An initial read of the 8.13 reference was replaced by the matching 8.10 reference for the book link.
- Native library compatibility includes memory page size, alignment and runtime assumptions: confirmed, https://developer.android.com/guide/practices/page-sizes. The chapter adds this device-clustering dimension to the outline; no store submission deadline is taught or tested.
- A symbolicated frame can show the later use of memory corrupted elsewhere: confirmed, https://developer.apple.com/documentation/xcode/investigating-memory-access-crashes. This is why a top SDK frame alone does not establish vendor fault.
- Apple binary and dSYM build UUIDs must match, and `dwarfdump --uuid` retrieves the symbol file's UUID: confirmed, https://developer.apple.com/documentation/xcode/locating-a-missing-debug-symbol-file. Current Apple documentation moved this detail out of the general symbolication guide, https://developer.apple.com/documentation/xcode/adding-identifiable-symbol-names-to-a-crash-report.
- Full OS crash reports are preferred, and sensitive information should be redacted when sharing: confirmed, https://developer.apple.com/documentation/xcode/acquiring-crash-reports-and-diagnostic-logs. The minimal reproduction instructions retain failure conditions, diagnostic binary identities and exact versions while excluding player data and secrets.
- The callback-error-path defect and the result of restoring its handoff are fictional observations inside the labeled worked case. Their mechanism is grounded in Unity's thread requirements, but no actual SDK defect, crash frequency or on-device fix is asserted.

## Rests on documentation alone

Mobile runtime behavior, store signing and delivery, purchase recovery, APNs, privacy termination, page-size compatibility and full crash symbolication were not exercised on a device or store account. The phase did not build, install or modify the Unity probe. It checked two local NDK commands against the installed Editor, but did not manufacture a crash and present it as device evidence. Shell filenames in the chapter are named placeholders for saved crash artifacts.

The glossary entries for Dynamic linker, Symbolication and Tombstone summarize the cited Apple and Android documentation. Their backlinks point to this chapter. No glossary entry changes progress.

## Narrowed or cut

- “The Editor does not run native code” becomes a comparison of the selected desktop or fake path with the mobile player path.
- Minification off and Minimal stripping are diagnostic comparisons, not confirmed causes or release fixes.
- No modern SDK update is claimed to introduce Play acknowledgement. It is an existing obligation whose completion can regress during an integration change.
- “Grant within the refund window” becomes current-state verification, prompt delivery and store completion, plus explicit handling of pending, already granted, refunded and revoked outcomes. There is no cross-store universal refund window.
- Duplicate `.so` paths can fail packaging; selecting one with `pickFirsts` does not establish compatibility. Missing ABI and minimum-OS failures are distinguished from native memory crashes.
- No crash's first SDK frame is treated as proof of vendor fault. Vendor escalation preserves full reports and a reproducible sequence.

## Where the outline fell short

The section and concept ids, five sections and ten concepts remain as specified. The chapter adds missing-log uncertainty, clock differences, inspection-proxy limits, an upgrade-versus-clean-install comparison, the distinction between TestFlight purchase and APNs environments, and page-size compatibility. These qualify the existing diagnostic method rather than introducing new concepts.

The purchase example has one explicit invented cause, the adapter's request-contract mismatch. It carries investigation through mitigation, compatibility for installed clients, recovery of earlier purchases and tests of duplicate delivery. The crash example similarly reaches an explicit invented dispatch defect rather than stopping at a list of possible causes.

## Runs

- Local NDK command check: `PlaybackEngines/AndroidPlayer/NDK/ndk-stack --help` under the 6000.3.11f1 Editor lists `-sym SYMBOL_DIR` and `-i INPUT, -dump INPUT, --dump INPUT`. Exit status was zero.
- Local artifact inspection: that NDK's `toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-readelf -n` read the Editor's `Variations/il2cpp/Release/Libs/arm64-v8a/libunity.so` and printed build ID `83c8828ffe8996adaf7ba658122aa8d7f487b8f6`. Exit status was zero. This checks command use and binary identity, not a crash's source location.
- Receipt checker: 72 receipts, zero failures. The rejected guessed Apple URL never became a receipt or book link.
- Inline teacher's read: checked all prose, 50 variants, explanations, glossary additions and evidence. Replaced an off-concept timestamp-ordering variant with a completion-boundary variant. Replaced implausible distractors in three variants with competing diagnostic actions. Replaced a loose chapter cross-reference for StreamingAssets with the exact Unity API reference. Checked that every correct answer avoids changeable version numbers, dates and limits, and that explanations distinguish evidence from hypotheses.
- Prose detector: ran the bundled engine per section and per added glossary entry with technical context and rendered-Markdown source mode. The CLI wrapper lacks the source-mode flag, so a scratch Node script supplied both options directly. The final section scores were all 1; glossary scores were zero. Remaining flags were narrow technical vocabulary. The earlier section-id hashtag flag disappeared when the StreamingAssets cross-reference was replaced for accuracy. The judgment-only read found no further justified prose edit.

Automated completion figures are recorded in the Phase 33 log in PLAN.md. The user's manual reading and answering of the chapter remains the plan's manual check.
