# Evidence for chapter 13: Designing core game services

What Phase 31 checked the chapter’s claims against, and where the outline was wrong. [plan-history.md](../plan-history.md), under “Decisions: evidence”, says what counts as evidence.

The documentation was read on September 26, 2026. The Redis command pages are the current reference at that date. The Addressables pages below are pinned to package 2.9. Numerical service limits and store windows are dated to this read.

Codex (GPT-6 Sol, `xhigh`) gathered the first 102 receipts and drafted this file, then stopped at its usage limit after 23 minutes and 278,177 tokens, before its final answer. Its working receipts file held all 102, and each passes on re-fetch. The session added 76 receipts under rule A, for the claims that Codex left unverified and for the chapter's own wording, with the sentences pulled out of the pages by a script; each of those passes as well. The bullets below give the durable sources, and the receipts themselves stayed in the phase's scratch folder.

## Checked, and against what

### design-player-data

- Anonymous sign-in creates a player without asking for credentials: confirmed. Source: https://docs.unity.com/en-us/authentication/use-anon-sign-in
- An unlinked anonymous account cannot be recovered after its session token is lost: confirmed. Source: https://docs.unity.com/en-us/authentication/use-anon-sign-in
- A platform identity can be linked to the anonymous player so progress can be recovered on another device: confirmed. Source: https://docs.unity.com/en-us/authentication/anonymous-auth-and-linking
- A platform identity already linked to another player causes an account-link conflict: confirmed. Source: https://docs.unity.com/en-us/authentication/identity-management
- Force-linking removes the identity from the first account and may leave that account unrecoverable: confirmed. Source: https://docs.unity.com/en-us/authentication/identity-management
- The player should choose whether to keep the current account, switch to the existing account, or cancel: confirmed. Source: https://docs.unity.com/en-us/authentication/identity-management
- Unity Authentication account deletion leaves other Unity Gaming Services data for the game to delete: narrowed to DeleteAccountAsync deletes only the Authentication account; the game must delete associated data in other Unity Gaming Services. Source: https://docs.unity.com/en-us/authentication/delete-accounts
- Apple requires in-app initiation of account deletion for apps that support account creation; its stated start date was June 30, 2022: confirmed. Source: https://developer.apple.com/support/offering-account-deletion-in-your-app
- Apple expects deletion of the account and associated data unless retention is legally required: confirmed. Source: https://developer.apple.com/support/offering-account-deletion-in-your-app
- An app using Sign in with Apple should revoke user tokens when the account is deleted: confirmed. Source: https://developer.apple.com/support/offering-account-deletion-in-your-app
- Google Play requires an in-app account and data deletion path and a web resource for deletion requests: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en
- A valid erasure request reaches backup systems as well as live systems: confirmed. Source: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
- Cloud Save Player Data is limited to 2,000 key/value pairs per access class per player and 5 MiB total per class, as read September 26, 2026: confirmed. Source: https://docs.unity.com/en-us/cloud-save/concepts/player-data
- A stale Cloud Save write lock produces a conflict error instead of overwriting the newer value: confirmed. Source: https://docs.unity.com/en-us/cloud-save/concepts/write-locks
- Unity Authentication names the linked-identity conflict AccountAlreadyLinked: confirmed. Source: https://docs.unity.com/en-us/authentication/common-errors
- Game Center teamPlayerID identifies a player across apps from the same developer team when scoped IDs persist: confirmed. Source: https://developer.apple.com/documentation/gamekit/gkplayer/teamplayerid
- A Play Games authorization code can be exchanged by the server for an access token: confirmed. Source: https://developers.google.com/android/reference/com/google/android/gms/games/GamesSignInClient
- Sign in with Apple's user identifiers are scoped to the developer team, and an app transfer migrates them to the new team: confirmed. Source: https://developer.apple.com/documentation/technotes/tn3159-migrating-sign-in-with-apple-users-for-an-app-transfer
- A server verifies Apple's identity token: its signature with Apple's public key, its issuer, its audience, which is the app's client id, and its expiry: confirmed. Source: https://developer.apple.com/documentation/signinwithapple/verifying-a-user
- Backed-up data that cannot be overwritten at once is put beyond use: confirmed. Source: the ICO page above.
- The right to erasure does not apply where data is kept to comply with a legal obligation, and California's right to delete excepts information that a business is legally required to keep: confirmed. Sources: the ICO page above and https://oag.ca.gov/privacy/ccpa
- The GDPR gives rights to erasure, of access, and to data portability in a machine-readable format: confirmed, from the European Commission's page for individuals, https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en. The chapter names the rights without article numbers.
- California's privacy law gives rights to know and to delete: confirmed. Source: https://oag.ca.gov/privacy/ccpa
- Guideline 5.1.1(v), Account Sign-In, has an app that supports account creation offer account deletion within the app, and Google Play's web page serves players who have already uninstalled the app: confirmed. Sources: https://developer.apple.com/app-store/review/guidelines/ and the Google Play page above.
- Linking an identity that another account already holds fails on the identity table's primary key: confirmed by a run (Runs, 3).

### design-economy

- The App Store Server API returns signed transaction and subscription renewal information: confirmed. Source: https://developer.apple.com/documentation/appstoreserverapi
- The App Store Server API can fetch one transaction or a customer transaction history: confirmed. Source: https://developer.apple.com/documentation/appstoreserverapi
- StoreKit finish indicates purchased content was delivered or the service enabled: confirmed. Source: https://developer.apple.com/documentation/storekit/transaction/finish()
- StoreKit says to finish only after delivering the purchased content or service: confirmed. Source: https://developer.apple.com/documentation/storekit/transaction/finish()
- Unfinished StoreKit transactions remain available for processing until finish is called: confirmed. Source: https://developer.apple.com/documentation/storekit/transaction/unfinished
- For a current Google Play one-time purchase, the backend fetches the purchase token using purchases.productsv2.getproductpurchasev2: confirmed. Source: https://developer.android.com/google/play/billing/lifecycle/one-time
- Google Play says to grant a one-time purchase only in the PURCHASED state: confirmed. Source: https://developer.android.com/google/play/billing/lifecycle/one-time
- For a non-consumable purchase, Google Play directs the backend to acknowledge delivery: confirmed. Source: https://developer.android.com/google/play/billing/lifecycle/one-time
- A Google Play purchase not acknowledged within three days is refunded and revoked, as read September 26, 2026: confirmed. Source: https://developer.android.com/google/play/billing/lifecycle/one-time
- Google Play advises server verification through the Developer API: confirmed. Source: https://developer.android.com/google/play/billing/security
- A Google Play order ID is unsuitable as a deduplication key because some purchases have none: confirmed. Source: https://developer.android.com/google/play/billing/security
- Google Play recommends deduplicating real-time notifications by message ID: confirmed. Source: https://developer.android.com/google/play/billing/backend
- Google Play one-time notifications carry a purchase token that the backend uses to fetch current purchase state: confirmed. Source: https://developer.android.com/google/play/billing/lifecycle/one-time
- Apple version 2 server notification payloads are signed JWS: confirmed. Source: https://developer.apple.com/documentation/appstoreserverapi/signedpayload
- SQLite ON CONFLICT DO NOTHING skips a conflicting insert, which can guard a purchase transaction ID: confirmed. Source: https://www.sqlite.org/lang_upsert.html
- SQLite changes() reports how many rows the most recent INSERT, UPDATE or DELETE changed: confirmed. Source: https://www.sqlite.org/lang_corefunc.html
- An App Store decoded transaction has an environment that distinguishes sandbox from production: confirmed. Source: https://developer.apple.com/documentation/appstoreserverapi/jwstransactiondecodedpayload
- Apple reports a refunded transaction through its server notification types: confirmed. Source: https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
- A decoded transaction names the app's bundle id, and its revocation date records a refund or a revocation from Family Sharing: confirmed. Sources: https://developer.apple.com/documentation/appstoreserverapi/jwstransactiondecodedpayload and https://developer.apple.com/documentation/appstoreserverapi/revocationdate
- `appAccountToken` is a UUID that the app sets when the purchase starts and that the App Store returns in the transaction: confirmed. Sources: https://developer.apple.com/documentation/appstoreserverapi/appaccounttoken and https://developer.apple.com/documentation/storekit/product/purchaseoption/appaccounttoken(_:)
- Google Play Billing's obfuscated account id is set when the purchase starts and returned by the Developer API: confirmed. Sources: https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.Builder and https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2
- Google Play marks a purchase from a license testing account as a test, and the productsv2 purchase carries a test purchase context that is set for test purchases alone: confirmed. Sources: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products and the productsv2 page above.
- The purchase lookup is made for the package name of the app the product was sold in: confirmed. Source: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2/getproductpurchasev2
- A pending purchase is one whose payment the user has not completed; the app verifies before granting; the backend checks that a purchase token has not been used, so that nothing is granted twice; consuming fulfills the acknowledgement requirement; and acknowledging within three days avoids the refund: confirmed. Source: https://developer.android.com/google/play/billing/integrate
- Apple retries a version 2 notification that gets no success response five times, at 1, 12, 24, 48 and 72 hours after the previous attempt, as read on September 26, 2026: confirmed. Source: https://developer.apple.com/documentation/appstoreservernotifications/responding-to-app-store-server-notifications
- `REVOKE` reports a purchase no longer available through Family Sharing, and `DID_RENEW` a renewed subscription: confirmed. Source: https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
- Real-time developer notifications are published to a Pub/Sub topic: confirmed. Source: https://developer.android.com/google/play/billing/rtdn-reference. The chapter describes the topic by category.
- The Voided Purchases API lists voided purchases, from refunds, cancellations and chargebacks: confirmed. Source: https://developers.google.com/android-publisher/voided-purchases
- A server verifies a signed transaction with the information in its header, or with the App Store Server Library's `verifyAndDecodeTransaction`: confirmed. Source: https://developer.apple.com/documentation/appstoreserverapi/jwstransaction
- Unfinished transactions reach the app's updates listener once, right after it launches, and version 2 notifications go to a server URL set in App Store Connect: confirmed. Sources: https://developer.apple.com/documentation/storekit/transaction/updates and the page on responding to notifications above.
- A purchase that is acknowledged and not consumed still appears when the app queries the player's purchases, which the guide has it do when it resumes, and the app checks whether a purchase was already acknowledged: confirmed. Sources: https://developer.android.com/reference/com/android/billingclient/api/BillingClient and the integration guide above.
- The chapter's ledger grants once, and its refund reverses once: confirmed by a run (Runs, 3).

### design-leaderboards

- ZADD has O(log N) time complexity per item added: confirmed. Source: https://redis.io/docs/latest/commands/zadd/
- ZINCRBY has O(log N) time complexity: confirmed. Source: https://redis.io/docs/latest/commands/zincrby/
- ZSCORE has O(1) time complexity: confirmed. Source: https://redis.io/docs/latest/commands/zscore/
- ZMSCORE has O(N) time complexity for N requested members: confirmed. Source: https://redis.io/docs/latest/commands/zmscore/
- ZRANK has O(log N) time complexity: confirmed. Source: https://redis.io/docs/latest/commands/zrank/
- ZREVRANK has O(log N) time complexity: confirmed. Source: https://redis.io/docs/latest/commands/zrevrank/
- ZRANGE has O(log N + M) time complexity for M returned elements: confirmed. Source: https://redis.io/docs/latest/commands/zrange/
- ZCOUNT has O(log N) time complexity: confirmed. Source: https://redis.io/docs/latest/commands/zcount/
- ZCARD has O(1) time complexity: confirmed. Source: https://redis.io/docs/latest/commands/zcard/
- ZREM has O(M log N) time complexity for M removed members: confirmed. Source: https://redis.io/docs/latest/commands/zrem/
- ZUNIONSTORE has O(N) + O(M log M) time complexity for N input and M result members: confirmed. Source: https://redis.io/docs/latest/commands/zunionstore/
- Redis sorted-set members with equal scores are ordered lexicographically, so a time tie-break needs explicit encoding: confirmed. Source: https://redis.io/docs/latest/develop/data-types/sorted-sets/
- MEMORY USAGE reports a key and value RAM footprint, not just the payload size: confirmed. Source: https://redis.io/docs/latest/commands/memory-usage/
- Redis supports RDB snapshots and an append-only file; it is not inherently nonpersistent: confirmed. Source: https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/
- A Redis Cluster node owns a subset of hash slots, so one board key maps to one slot rather than automatically spanning nodes: confirmed. Source: https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/
- Unity Leaderboards supports scheduled resets and optional archives of prior scores: confirmed. Source: https://docs.unity.com/en-us/leaderboards/concepts/resets
- Unity Leaderboards buckets group a large board into smaller cohorts; a configured size of 100 shows each player 99 peers, as read September 26, 2026: confirmed. Source: https://docs.unity.com/en-us/leaderboards/concepts/buckets
- Unity Leaderboards offers tiers for classifying players by results: confirmed. Source: https://docs.unity.com/en-us/leaderboards/features
- ZREVRANGE is deprecated in favor of ZRANGE with REV: confirmed. Source: https://redis.io/docs/latest/commands/zrevrange/
- Redis sorted-set scores represent integers exactly from minus 2^53 through plus 2^53: confirmed. Source: https://redis.io/docs/latest/commands/zadd/
- ZADD NX adds only new members and XX updates only existing ones: confirmed. Source: https://redis.io/docs/latest/commands/zadd/
- EXPIREAT sets expiry by an absolute Unix timestamp, suitable for UTC period boundaries: confirmed. Source: https://redis.io/docs/latest/commands/expireat/
- `GT` updates an existing member when the new score is greater and does not prevent adding new members, and `CH` makes `ZADD` count changed members: confirmed. Source: https://redis.io/docs/latest/commands/zadd/
- `ZRANGE` indexes can be negative and count from the end of the set, so the range around a player near the top starts at 0: confirmed. Source: https://redis.io/docs/latest/commands/zrange/
- Bytes per entry, the compact encoding of a cohort, equal values in member order, rounding past 2^53, and the chapter's command block: confirmed by runs (Runs, 1 and 2).

### design-matchmaking

- Unity Matchmaker relaxes rules as tickets wait to form matches faster when population is low: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/matchmaking/rule-relaxations
- A relaxation is triggered by ticket age, which makes wait time the control for match quality: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/matchmaking/rule-relaxations
- A Unity Matchmaker pool groups tickets by filters and applies matching logic to that group: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/matchmaking/queues-pools
- Unity Matchmaker tickets can carry attributes such as mode and player skill: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/matchmaking/get-started-mm
- Unity’s Matchmaker sample has a cancellation method that cancels its token source: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/matchmaking/get-started-mm
- Unity Matchmaker backfill fills open slots on an existing server: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/matchmaking/mm-toc
- A player who remains a session member can reconnect after a disconnection: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/join-session
- Relay joins a player to a host allocation and lets them exchange messages: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/advanced-config/allocating-binding-joining
- TrueSkill models rating uncertainty and infers individual skill from team results: confirmed. Source: https://proceedings.neurips.cc/paper/2007/hash/9f53d83ec0691550f7d2507d57f4f5a2-Abstract.html
- Glicko's ratings deviation measures a rating's uncertainty, games lower it and time without rated games raises it, and Elo's rating has no measure of its reliability: confirmed. Source: Mark Glickman's description of the Glicko system, https://www.glicko.net/glicko/glicko.pdf, read through its text extracted with PDFKit.
- Relay connects players without dedicated game servers, and joining players use the host's join code: confirmed. Sources: https://docs.unity.com/en-us/mps-sdk and https://docs.unity.com/en-us/mps-sdk/advanced-config/allocating-binding-joining

### design-realtime-multiplayer

- Unity names Relay and Distributed Authority as client-hosted networking solutions: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/manage-session-network-connection
- Unity Multiplayer Services uses host data migration to preserve a client-hosted session after host loss: confirmed. Source: https://docs.unity.com/en-us/mps-sdk/session-host-migration
- An authoritative server receives client inputs and determines the game state: confirmed. Source: https://www.gabrielgambetta.com/client-server-game-architecture.html
- Client-side prediction makes local movement responsive despite network delay: confirmed. Source: https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
- Server reconciliation applies an authoritative state and replays unprocessed inputs: confirmed. Source: https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
- Entity interpolation renders other entities from real server data slightly in the past: confirmed. Source: https://www.gabrielgambetta.com/entity-interpolation.html
- Lag compensation lets the server evaluate a shot against past game state: confirmed. Source: https://www.gabrielgambetta.com/lag-compensation.html
- Netcode for GameObjects has a documented default tick rate of 30: confirmed. Source: https://mp-docs.dl.it.unity3d.com/netcode/current/components/networktransform/
- Deterministic lockstep sends inputs instead of world state: confirmed. Source: https://gafferongames.com/post/deterministic_lockstep/
- Netcode for GameObjects 2.9, the version that Unity 6000.3.11f1 bundles: client-server uses a server authority model, with a dedicated server or a listen server; a dedicated server is much more resilient to compromised clients, while a listen server fails if its host is compromised; in distributed authority, game instances share the ownership of objects: confirmed. Source: https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.9/manual/terms-concepts/network-topologies.html
- NAT rejects unsolicited incoming traffic, both peers behind NAT is increasingly common, hole punching does not work across NATs with endpoint-dependent mapping, and relaying is the most reliable and least efficient method: confirmed. Source: https://www.rfc-editor.org/rfc/rfc5128.html
- Floating-point code does not give identical results across compilers or architectures without deliberate work: confirmed. Source: https://gafferongames.com/post/floating_point_determinism/

### design-social

- Redis expired notifications fire when a key is deleted, which can be later than the instant its TTL reaches zero: confirmed. Source: https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/
- Redis Pub/Sub is at-most-once and a disconnected subscriber permanently misses a message: confirmed. Source: https://redis.io/docs/latest/develop/pubsub/
- APNs returns 410 Unregistered when a token is inactive for the topic: confirmed. Source: https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns
- For a 410 response APNs includes the time it confirmed the token invalid: confirmed. Source: https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns
- APNs BadDeviceToken means the supplied device token is invalid: confirmed. Source: https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns
- FCM HTTP v1 UNREGISTERED may indicate an invalid or expired registration: confirmed. Source: https://firebase.google.com/docs/cloud-messaging/manage-tokens
- FCM INVALID_ARGUMENT implies token removal only when the payload itself is valid: confirmed. Source: https://firebase.google.com/docs/cloud-messaging/manage-tokens
- FCM advises a timestamped registration and a staleness threshold; its default stale threshold is a month, as read September 26, 2026: confirmed. Source: https://firebase.google.com/docs/cloud-messaging/manage-tokens
- FCM warns that abrupt unsmoothed traffic changes create spikes: confirmed. Source: https://firebase.google.com/docs/cloud-messaging/scale-fcm
- COPPA generally requires verifiable parental consent before collecting personal information from children under 13: confirmed. Source: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Unity Friends limits presence visibility to friends who have not blocked one another: confirmed. Source: https://docs.unity.com/en-us/friends/faq
- Redis expires keys passively when a client accesses them, and actively by testing a few keys at random: confirmed. Source: https://redis.io/docs/latest/commands/expire/
- In the European Union, the age up to which a parent's consent is needed is set by each member state between 13 and 16: confirmed. Source: the Commission's page for individuals above.
- For `BadDeviceToken`, Apple's list says to check that the token is valid and matches the environment, so the chapter treats the answer as a routing error to check rather than a token to drop: confirmed. Source: the APNs responses page above.

### design-live-events

- Unity Remote Config Game Overrides target user groups with different settings: confirmed. Source: https://docs.unity.com/en-us/remote-config/game-overrides-and-settings
- Unity Remote Config Game Overrides can have a UTC start timestamp: confirmed. Source: https://docs.unity.com/en-us/remote-config/game-overrides-and-settings
- Unity Remote Config Game Overrides can have an end timestamp: confirmed. Source: https://docs.unity.com/en-us/remote-config/game-overrides-and-settings
- Unity Remote Config uses priority to resolve competing active overrides: confirmed. Source: https://docs.unity.com/en-us/remote-config/game-overrides-and-settings
- Unity Analytics batches SDK events and uploads them automatically every 60 seconds, as read September 26, 2026: confirmed. Source: https://docs.unity.com/en-us/analytics/events/record-event
- Unity Analytics populates event timestamp and UUID fields in SDK events: confirmed. Source: https://docs.unity.com/en-us/analytics/events/record-event
- Unity Analytics REST ingestion says eventUUID prevents accidental duplicate inserts after a network timeout: confirmed. Source: https://docs.unity.com/en-us/analytics/rest-api/record-event-rest-api
- Unity Analytics standard events are recorded on consent or at initialization when consent was already granted: confirmed. Source: https://docs.unity.com/en-us/analytics/events/record-event
- A remote Addressables catalog with a changed hash replaces the built-in local catalog: confirmed. Source: https://docs.unity3d.com/Packages/com.unity.addressables@2.9/manual/build-content-catalogs.html
- Addressables provides CheckForCatalogUpdates to find new content updates: confirmed. Source: https://docs.unity3d.com/Packages/com.unity.addressables@2.9/manual/content-update-builds-check.html
- Addressables can download dependencies before an event and report their download size: confirmed. Source: https://docs.unity3d.com/Packages/com.unity.addressables@2.9/api/UnityEngine.AddressableAssets.Addressables.html
- Addressables can append the bundle content hash to a filename, enabling immutable versioned URLs: confirmed. Source: https://docs.unity3d.com/Packages/com.unity.addressables@2.9/manual/ContentPackingAndLoadingSchema.html
- Addressables offers an AssetBundle CRC integrity check before loading: confirmed. Source: https://docs.unity3d.com/Packages/com.unity.addressables@2.9/manual/ContentPackingAndLoadingSchema.html
- HTTP immutable lets a server identify a resource that will not change during its freshness lifetime: confirmed. Source: https://www.rfc-editor.org/rfc/rfc8246.html
- Android's `elapsedRealtime()` counts from boot, including deep sleep, and is monotonic, and Swift's `ContinuousClock` keeps incrementing while the system is asleep: confirmed. Sources: https://developer.android.com/reference/android/os/SystemClock and https://developer.apple.com/documentation/swift/continuousclock
- AssetBundles hold asset data and cannot include code changes: confirmed. Source: https://docs.unity3d.com/Packages/com.unity.addressables@2.9/manual/content-update-builds-overview.html

## Rests on documentation alone

- The stores' purchase lifecycles, notifications and deletion rules, Unity's services, the push providers' responses, the multiplayer techniques and Addressables' content delivery rest on the documentation above: there is no store account, production backend, device or push provider here.
- The laws are cited from a regulator's and the European Commission's plain-language pages rather than from the regulations' text. EUR-Lex answered Codex with HTTP 202 and refused the session's connections.
- Chapter 12 already checked Cloud Save's access classes, PostgreSQL's transactions and constraints, Redis's main sorted-set commands, a queue's at-least-once delivery and server authority, and this chapter builds on those checks.

## Narrowed or cut

- `DeleteAccountAsync()` deletes the Unity Authentication account alone, and the game deletes the player's data in the other Unity Gaming Services itself.
- Google Play's one-time purchase lifecycle calls `purchases.productsv2.getproductpurchasev2` for the purchase's status, while acknowledging and consuming still name `purchases.products`. The chapter names the lookup, and names a field of the older response only where that reference states it: the license testing flag.
- The purchase's key is the purchase token on Android and the transaction id on iOS. Google Play's guidance rules out the order id, since some purchases have none.
- Apple's pages say to finish a transaction after delivering it, and that a transaction stays unfinished until then. None says that Apple refunds or revokes an unfinished transaction, so the chapter says only that StoreKit hands it over again.
- Redis persists with snapshots and an append-only file. Keeping the scores in a database and rebuilding the sorted set from them is the chapter's design choice, for exact rebuilds and for auditing scores, not a claim that Redis cannot persist.
- Equal scores sort by member, so the chapter encodes the time into the stored value within the exact integer range. Cohorts of fifty to a hundred are the chapter's design range; Unity's bucket size of 100 is one product's example.
- FCM's `INVALID_ARGUMENT` marks a bad token only when the payload is valid, so the chapter names `UNREGISTERED` as the answer that removes a token.
- Relay: the chapter says that players join the host's allocation with the host's join code, without dedicated servers. Regions and port forwarding are not claimed of Relay; NAT's behavior comes from RFC 5128.
- Netcode for GameObjects: the first draft's "a Unity service coordinates the session" was cut, and distributed authority is described as shared ownership of objects, in the documentation's words.
- Addressables: "an old client receives only content it can read" rests on bundles carrying no code, so content that needs newer code goes with the catalog built for that app version. The pages promise nothing about loading bundles across Unity versions, and the chapter claims nothing about it.
- Elo: the first draft's update rule, a move by how surprising the result was, had no receipt and was cut. The chapter says that Elo keeps one rating with no measure of its reliability, which Glicko's paper states.
- The GDPR's article numbers and Article 20's wording were cut, and the rights are named from the Commission's page. The consent age for children is the Commission's range, 13 to 16, set by each member state.
- Unity Analytics uploads its batches every 60 seconds. The chapter's upload when the game goes to the background is the design of chapter 4's lifecycle, not a claim about the SDK.

## Where the outline fell short

- The outline's evidence list covers prediction, interpolation and lag compensation through Gambetta's articles. Deterministic lockstep needed Glenn Fiedler's articles, the rating systems Glickman's paper, and NAT RFC 5128, none of which it listed.
- The outline asks for the acknowledgement window and the stores' deletion rules to be verified: Google Play's window is three days, Apple's rule dates from June 30, 2022, and Google Play asks for an in-app path and a web page. Each appears in prose with its date, and no question asks for it.
- The outline leaves the refund policy open. The chapter records the reversal whatever the balance and lists the policies a game chooses from, since a check on the balance would let a player spend refunded currency first.
- The ledger, the migrations, the archive job, the friend limits, the moderation rules, the result reports and the event schedule are designs the chapter specifies; no product prescribes them, and the estimates in the prose are invented figures that say so.

## Runs

Redis 8.10.2 was installed from Homebrew at the user's choice when the phase started. It ran on 127.0.0.1 with persistence off, in the scratch folder, and was stopped after each run.

1. Memory: sorted sets filled by `EVAL` loops and measured with `MEMORY USAGE … SAMPLES 0`, on macOS with the libc allocator. A cohort of 100 stayed in the listpack encoding at 2,235 bytes, 22 per entry, with ten-character ids, and 4,835 bytes, 48 per entry, with UUIDs. A board of a million took 77,726,914 bytes, 77 per entry, with ten-character ids and 109,788,402 bytes, 109 per entry, with UUIDs, both in the skip list encoding. A board of 10 million ten-character ids took 894,661,122 bytes, 89 per entry. `INFO`'s `used_memory` rose by 67, 99 and 78 bytes per entry for the three large boards. Chapter 12's assumption of 100 bytes per entry, and about 1 GB for 10 million players, holds.
2. The lab: the chapter's encoding, `score × 1,000,000 + (999,999 − t)`, with `ZADD … GT CH` gave 1 for new entries and new bests, and 0 for a worse score and for the same score reached later. `ZREVRANK … WITHSCORE`, `ZRANGE … REV WITHSCORES` and `ZMSCORE` behaved as the chapter says, and the chapter's `bash` block, run as printed against a server on port 6379, printed what its comments give. Two equal stored values came back in member order, `p-b` above `p-a` in a reverse range. Past 2^53, 9,100,000,000,999,999 was stored as 9,100,000,001,000,000, while 9,100,000,000,999,998 stayed exact. A second run, after the review, stored five consecutive values: 9,100,000,000,999,997 came back as 9,100,000,000,999,996, and 9,100,000,000,999,999 as 9,100,000,001,000,000, so values a second apart became one.
3. SQLite 3.51.0, the system's `sqlite3`: the chapter's identity schema, with a second account linking the same Apple id, failed with `UNIQUE constraint failed: identity.provider, identity.provider_user_id`. The chapter's ledger, with the purchase's grant sent twice (1 row, then 0), a spend of 300, and the refund applied twice (1 row, then 0), ended at a balance of −300. Codex's SQL and .NET 8 harnesses gave the same replay and reversal results.

## The teacher's read

Codex's usage limit reset at 01:23, a little over two hours after it stopped, so the blind review was scheduled for the reset in a background command, as **When Codex is blocked** allows, after the session's own edits and the detector's pass. It ran from 01:24 to 01:36 (GPT-6 Astra, `xhigh`, 200,236 tokens) and reported 13 problems. All 13 held and are fixed:

- The wallet refused a balance below zero with a `CHECK` constraint, while the refund's reversal has to be recorded whatever the balance; the review's own in-memory SQLite run of a 500 grant, a 300 spend and a 500 refund failed the constraint. The condition now sits on the spend's `UPDATE`, and the wallet may go below zero through a reversal.
- A score written to the database and then to the sorted set could be lost from the set by a crash between the two, and the payout job read the set. Scores now reach the set through chapter 12's outbox, and the job takes the final standings from the database.
- The table of orders treated acknowledging on Google Play as final. Consuming is: an acknowledged purchase that is not consumed still appears when the game queries the player's purchases. The table now names finishing and consuming, and a sentence covers acknowledgement.
- The range around a player, r − 5 to r + 5, went negative near the top, which Redis reads from the end of the set; it now starts at 0.
- A rank summed across shards counted strictly higher values, so equal stored values share a rank there, unlike one board's member order. The prose now says so.
- `BadDeviceToken` was among the answers that remove a token, while chapter 4 traces it to the wrong environment; it now calls for a check of the routing.
- A lost credential was said to end a guest account for good, while the next paragraph recovers it through support; it now ends the player's own way in.
- A presence question promised that friends see a vanished player offline within the time to live, while the offline change is pushed after Redis's expiry notification, which can lag. The answer now separates the key's expiry from the change reaching the friends.
- Reconciliation was said to show a small correction rather than a jump, which the algorithm does not promise; a correction is a snap unless the client smooths it, in the prose and in its question.
- A distractor, that content loads faster from disk, was a defensible reason to prefetch. It is now the misconception that prefetching lets an old app use content that needs newer code.
- Two times a second apart were said to have become one value past 2^53, which the first run did not show; the second run above shows it.
- A question about APNs's 410 sat under the concept of spreading a send over minutes. It became a question on the send rate that keeps the taps within the backend's sign-in capacity.
- Three first mentions lacked their glossary links (push tokens, JSON Web Tokens, idempotent). A script then checked the first mention of every glossary term in every section, and found no other.

