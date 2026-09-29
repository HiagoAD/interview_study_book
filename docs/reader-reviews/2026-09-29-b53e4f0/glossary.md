# Glossary: reader and writing review

Status: glossary complete. Part of Pass 2 of the [review plan](../../reader-review-plan.md#pass-2-the-whole-book).

Source: [glossary.md](../../../content/mobile-platform/glossary.md), read in the working tree at HEAD `d55c2c8cd195ecd648d3451f2904a2d4d7250382` (clean). SHA-256 of the file: `29d61c1090be187a306cb74939cfb0d53935302871024c5eaed6e8d6d708deb8`. This differs from the run's original snapshot (`b53e4f0`): commits `7d2c7e0` and `d55c2c8` both came later, so line numbers below refer to `d55c2c8`.

Coverage: all 76 entries were read in full: summary, aliases, `->` relations and body. Every `[[...]]` link to an entry in chapters 1 to 16 was listed with a script. The script resolves ids and `=` aliases by their letters, as the site does, and skips code spans and fences. The count was 306 links, and all 76 entries have at least one. At each link I read the linking passage to judge whether the entry resolves what the reader needs at that point. `[[#section]]` links and the site's rendering of preview cards were not inspected.

**Learner experience: 8/10. Writing: 8/10.** The glossary works. Each summary gives a usable definition in one paragraph. The bodies nearly always add the consequence that matters at the platform boundary, then point to the section that teaches it. At most links, the preview card answers the reader's actual question, such as what an ABI is when a plugin is missing on some phones, or why an access token is treated as opaque. The weak points are few. The three entries added for chapter 15 (dynamic linker, symbolication, tombstone) are hedged and point only forward, away from the chapters that teach their mechanics. One pattern summary (Observer) contradicts its own body. Some small things escaped Phase 34's link pass or disagree with the book's terminology.

**Preserve:**
- The two-paragraph shape: a definition that stands alone in a preview card, then "what this means for a Unity game" and a section link. Examples: [ANR](../../../content/mobile-platform/glossary.md#L48), [JNI](../../../content/mobile-platform/glossary.md#L264), [Managed code stripping](../../../content/mobile-platform/glossary.md#L314).
- Paired entries that let the reader compare the platforms: Keychain and Android Keystore, AAB and bundletool, CocoaPods and Maven coordinates with EDM4U, Staged rollout and Canary release.
- Entries that say where an idea stops working: Remote configuration ("stops the calls that the game makes, not native code that runs without a call"), Scripting define symbol ("decides what a build contains, not what it does when it runs"), Device attestation ("neither platform presents it as proof"), and Strategy ("A strategy with a single implementation is an interface nobody needed yet").
- Idempotence's statement that "The identity is the whole mechanism". It holds together 18 links across eight chapters, from purchase grants to HTTP methods to queue consumers.

## Ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. The [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports) apply. Scores are editorial judgments, not averages.

| Scope | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Whole glossary (76 entries) | 8 | 8 | 8 | 8 | 7 | 8 | Summaries are self-contained and bodies connect to the sections that teach each term. Style consistency is lower because of the chapter 15 entries' different voice, plain-text chapter mentions and one alias that clashes with the book's main use of a word. |

## Coverage

"Linked from" lists the chapters whose sections link the entry by id or alias. Entries rated "fine" resolve the dependency at every link that was read.

| Entry | Linked from (chapters) | Rating | Reason or finding |
| --- | --- | --- | --- |
| AAB `aab` | 05, 07, 10, 11, 15 | fine | Explains why a bundle is never installed as uploaded, which is what ch10 and ch15 rely on. |
| ABI `abi` | 02, 15, 16 | fine | "fails on the devices that need it and nowhere else" answers ch15's device-family diagnosis. |
| Advertising identifier `advertising-identifier` | 07 | fine | Matches ch07's zeros-until-consent statement. |
| Android Gradle Plugin `android-gradle-plugin` | 05, 07 | fine | Explains why an SDK update can require a newer Unity (ch07's tool-versions row). |
| Android Keystore `android-keystore` | 04, 08, 13 | fine | "holds keys rather than arbitrary data" resolves ch04's "encrypted with a key from". |
| Android vitals `android-vitals` | 07, 10 | fine | Repeats ch07's dated thresholds. This is useful at ch10's link, but the figures have to be kept in step. |
| ANR `anr` | 02, 07, 10, 15 | fine; see RR-GL-09 | Makes the UI thread versus game loop distinction. The chapters give five seconds, the entry does not. |
| App extension `app-extension` | 03 | fine | |
| App Store Connect `app-store-connect` | 06, 07, 10, 11 | fine | Covers the API-key use that ch06 and ch11 need. |
| App Tracking Transparency `app-tracking-transparency` | 07 | fine | |
| App Transport Security `app-transport-security` | 06, 08, 10, 15 | fine | The `UnityWebRequest` versus `HttpClient` split answers ch15's "check the client library". |
| ARC `arc` | 03 | fine | |
| Assembly definition `assembly-definition` | 01 | fine | The second paragraph is dense, but the preview card shows only the summary, which is enough at ch01. |
| bundletool `bundletool` | 05 | fine | |
| Canary release `canary-release` | 14 | fine | |
| CDN `cdn` | 12, 13, 14 | fine | Names files by version or hash, consistent with ch13's live events. |
| Certificate pinning `certificate-pinning` | 08, 15 | fine | The installed-authority proxy case answers ch15's "can reject an inspection proxy". |
| Circuit breaker `circuit-breaker` | 14 | fine | |
| CocoaPods `cocoapods` | 06, 07, 11 | fine | |
| Content provider `content-provider` | 07 | fine | |
| Crash-free users `crash-free-users` | 10, 14 | fine | Its point that a purchase failure leaves the metric unchanged is valuable. |
| Custom Tabs `custom-tabs` | 04 | fine | |
| Deep link `deep-link` | 01, 02, 04 | 7; RR-GL-05 | Unclear referent and version naming in the last sentence. |
| Device attestation `device-attestation` | 08, 14 | fine | |
| Dispatch queue `dispatch-queue` | 03, 07 | fine | |
| dSYM `dsym` | 03, 06, 10, 11, 15 | fine; RR-GL-03 | Plain-text "chapter 11". |
| Dynamic linker `dynamic-linker` | 15 | 6; RR-GL-02 | Points only to ch15. `dyld` is taught in ch03's `ios-frameworks`. |
| Edit Mode and Play Mode tests `play-mode-tests` | 01, 07, 08, 11 | fine | |
| EDM4U `edm4u` | 05, 06, 07, 10, 11 | fine | |
| Entitlements `entitlements` | 03, 04, 06, 10, 15 | fine; RR-GL-04 | The alias `capability` clashes with the book's main use of the word. |
| Error budget `error-budget` | 14 | fine | |
| Expand and contract `expand-and-contract` | 14 | 7; RR-GL-06 | Garden-path last clause. |
| Git LFS `git-lfs` | 11 | fine | Gives the pointer's size and form, which the ch11 symptom row needs. |
| Gradle `gradle` | 02, 05, 07, 10, 11 | fine | |
| Idempotence `idempotence` | 01, 04, 08, 09, 12, 13, 14, 16 | fine | Serves the HTTP-method sense (ch08 and ch09) and the keyed-operation sense (ch12 to ch14). |
| IL2CPP `il2cpp` | 01, 02, 03, 05, 06, 08, 10, 11, 15 | fine | |
| Info.plist `info-plist` | 03, 04, 06, 10 | fine | |
| JNI `jni` | 01, 02, 05, 07 | fine | |
| JSON Web Token `json-web-token` | 08, 12, 13 | fine; RR-GL-08 | ch13 links it for JWS, which the entry does not name. |
| Keychain `keychain` | 04, 08, 13 | fine | |
| Ledger `ledger` | 13, 14, 15, 16 | fine | |
| Load balancer `load-balancer` | 12, 14 | fine | The connection-level versus request-level distinction and draining serve ch12's WebSocket tier and ch14's deploys. |
| Load shedding `load-shedding` | 14 | fine | |
| Logcat `logcat` | 02, 09, 15, 16 | fine | |
| Managed code stripping `managed-code-stripping` | 01, 05, 07, 08, 10, 15, 16 | fine; RR-GL-03 | Plain-text reference to the first book. |
| Maven coordinates `maven-coordinates` | 02, 05, 06 | fine | |
| Method swizzling `method-swizzling` | 07 | fine | |
| OAuth `oauth` | 04, 08 | fine | PKCE is unexpanded here but taught at ch04's link. |
| Object storage `object-storage` | 12, 14 | fine | |
| Observer `observer` | 01 | 5; RR-GL-01 | The summary says the source holds no reference to listeners, which contradicts the body's "retention". |
| OpenAPI `openapi` | 08 | fine | |
| P/Invoke `p-invoke` | 01 | fine | |
| Play App Signing `play-app-signing` | 04, 10, 11, 15 | fine; RR-GL-03 | Plain-text "chapter 5". |
| Privacy manifest `privacy-manifest` | 06, 07, 10 | fine | |
| Provisioning profile `provisioning-profile` | 04, 06, 10, 11 | fine | |
| Pub/sub `pub-sub` | 12, 13, 16 | fine; RR-GL-08 | At ch13:200 the link names Google's managed service rather than the pattern. |
| Push token `push-token` | 01, 03, 04, 08, 10, 13, 15, 16 | fine | |
| R8 `r8` | 01, 02, 05, 07, 10, 11, 15, 16 | fine | |
| Read replica `read-replica` | 12 | fine | |
| Remote configuration `remote-configuration` | 10, 12, 13, 14 | fine | General enough to cover the "Remote Config" product links. |
| Saga `saga` | 12 | fine | |
| Scene delegate `scene-delegate` | 04 | fine | |
| Scripting define symbol `scripting-define-symbol` | 10, 11 | fine | |
| Service level indicator `service-level-indicator` | 14 | 7; RR-GL-07 | "Measured by the clients" reads as a property of every SLI. |
| Service level objective `service-level-objective` | 14 | fine | |
| Sorted set `sorted-set` | 12, 13, 16 | fine | |
| Staged rollout `staged-rollout` | 07, 10, 15, 16 | fine | |
| Strategy `strategy` | 01 | fine; RR-GL-04 | Uses "capability" in the interface sense. |
| Symbolication `symbolication` | 15, 16 | 6; RR-GL-02 | Hedged summary with an unclear "it". Points only to ch15, though ch02 and ch03 teach the tools. |
| TestFlight `testflight` | 03, 06, 07, 10, 11, 15 | fine | |
| Time to live `time-to-live` | 13, 14 | fine | |
| TLS `tls` | 09, 12, 15 | fine | |
| Tombstone `tombstone` | 15, 16 | 6; RR-GL-02 | "Availability depends on…" leaves the reader without a source. ch02 teaches where tombstones come from, but the entry does not link it. |
| Token bucket `token-bucket` | 13, 14 | fine | |
| Unity Gaming Services `unity-gaming-services` | 12, 13 | fine | |
| WebSocket `websocket` | 12, 13, 14 | fine | |

## Findings and proposed changes

### RR-GL-01: The Observer summary contradicts its own body

Medium priority. Scope: glossary. Source: [glossary.md, line 353](../../../content/mobile-platform/glossary.md#L353).

> A source that announces facts, and listeners that react to them, with no reference from the source to any listener.

In the observer pattern, the source holds references to its subscribers, in a list or a C# event's delegate. The body's next paragraph depends on this: "The pattern's usual risks are order, retention and reentrancy", where retention is a listener kept alive by the source's reference. A Unity developer knows about leaks through `event` subscriptions, so this reader has to reconcile the two statements. The only link is from ch01 `platform-events`, which is the book's foundation for buffering and late subscribers. The intended point is decoupling: the source knows nothing about who listens. Proposed summary: "A source that announces facts, and listeners that subscribe to react to them, with the source knowing its listeners only as subscribers, never by their type."

### RR-GL-02: The three entries added for chapter 15 point only forward and read as hedged

Medium priority. Scope: glossary. Sources: [line 192](../../../content/mobile-platform/glossary.md#L192), [line 491](../../../content/mobile-platform/glossary.md#L491), [line 521](../../../content/mobile-platform/glossary.md#L521).

> Availability depends on how the report is collected and the access the device allows.

> A readable stack helps locate the failing operation, though an earlier memory error may have caused it.

> [[#boundary-editor-device]] uses the termination reason to distinguish a library-loading failure from a privacy or application error.

The other entries end by linking the section that teaches the term. These three link only chapter 15, which is the review chapter that assumes the mechanics are known. The teaching is earlier and unlinked:
- ch02 `android-failure-evidence` explains the tombstone file and the `DEBUG` block (lines 658 and 672, "a tombstone file with more"), and teaches `ndk-stack` with build IDs (lines 713 to 721).
- ch03 `ios-frameworks` teaches `dyld` (lines 520 to 527).
- ch03 `ios-failure-evidence` teaches dSYM symbolication.

At ch15:494 ("where available, its [[tombstone]]"), the tombstone card does not say where a tombstone comes from or how to get one. Its only practical sentence is the hedge above. In the Symbolication summary, "it" can refer to the stack or to the crash. The voice also differs from the rest of the glossary, which states mechanisms directly. Proposed changes:
- Tombstone: say that Android writes one for each native crash beside the `DEBUG` block in logcat, and that ch02 shows how to read it, linking `[[#android-failure-evidence]]`. Keep the access caveat as one clause.
- Symbolication: name the tools per platform (`ndk-stack` with build IDs; dSYMs matched by UUID) and link `[[#android-failure-evidence]]` and `[[#ios-failure-evidence]]`. Rewrite the caveat as "The frame that crashed may not be the cause: an earlier memory error can corrupt state that fails later."
- Dynamic linker: link `[[#ios-frameworks]]`, where static and dynamic frameworks teach what `dyld` loads.

Related chapter-side gap: ch02 uses "tombstone" at lines 658, 672 and 743 without a link, and that is its first appearance. Linking the first mention is a chapter-02 prose change, for the chapter 02 report to consider.

### RR-GL-03: Plain-text chapter references survived the Phase 34 link pass

Low priority. Scope: glossary. Sources: [line 187](../../../content/mobile-platform/glossary.md#L187), [line 319](../../../content/mobile-platform/glossary.md#L319), [line 376](../../../content/mobile-platform/glossary.md#L376).

> and chapter 11 archives them for each build.

> which the first book's testing and debugging chapter covers.

> [[#os-deep-links]] depends on it, and chapter 5 covers the two keys.

Phase 34 turned plain-text chapter mentions in chapters 1 to 14 into `[[#id]]` links. The glossary kept three, so these cards are the only ones where the reader has to find the chapter by number. Proposed: `[[#ci-release-automation]]` for the dSYM archive and `[[#gradle-packaging-signing]]` for the two keys. A cross-book link is not supported (links stay within one book), so the first-book reference can stay plain text but could name the section title.

### RR-GL-04: The alias `capability` collides with the book's main sense of the word

Low priority. Scope: glossary (aliases). Source: [line 211](../../../content/mobile-platform/glossary.md#L211).

> = entitlement | capability | capabilities

The book uses "capability" 71 times in chapter files. Most uses are in the chapter 1 sense: a feature the game owns behind an interface ("It writes each capability as an interface in its own vocabulary", ch01:109; "a capability query", ch07). The glossary also uses it that way in Strategy ("inside a capability that is otherwise shared", line 485). With the alias, any future `[[capability]]` link, or a reader's search for the term, lands on Xcode entitlements. The single current link (ch04:453, "the push [[capability]]") is correct. Proposed: remove `capability | capabilities` from the aliases and write that link as `[[entitlements | capability]]`. This is a content change outside the glossary file only for that one link. No progress is affected.

### RR-GL-05: Deep link's last sentence has an unclear referent and a third version spelling

Low priority. Scope: glossary. Source: [line 166](../../../content/mobile-platform/glossary.md#L166).

> [[#os-deep-links]] covers verified links on both platforms, and a gap in Unity 6000.3 through which iOS links reach neither.

The reader has to go back two sentences to find what "neither" refers to (`Application.absoluteURL` and `deepLinkActivated`). The glossary also names the engine three ways: "Unity 6.3" (lines 32, 201, 242, 383, 535), "Unity 6000.3" here, and "6000.3.11f1" in Scene delegate (line 440). Proposed: "…and a gap in Unity 6000.3.11f1 on iOS through which links reach neither the property nor the event." Use "Unity 6.3" elsewhere, and keep the full version only where a patch-level observation needs it, as the chapters do.

### RR-GL-06: "its storage contracts" reads as a noun phrase

Low priority. Scope: glossary. Source: [line 229](../../../content/mobile-platform/glossary.md#L229).

> [[#design-backend-deploys]] renames a field this way, and its storage contracts long before its API does.

In an entry about schemas and APIs, "storage contracts" parses first as a noun ("contracts for storage"), and the sentence then has no verb. Proposed: "…renames a field this way, and finishes the contract phase in its storage long before it does in its API."

### RR-GL-07: The SLI body reads as if every indicator were client-measured

Low priority. Scope: glossary. Source: [line 455](../../../content/mobile-platform/glossary.md#L455).

> Measured by the clients, it also counts the failures that never reach a server.

The participial opening makes client measurement sound like part of the definition. ch14:457 presents it as one choice ("An indicator measured by the clients counts the failures that no server sees"). Proposed: "When the clients measure it, it also counts the failures that never reach a server."

### RR-GL-08: Two links arrive with a narrower meaning than their entries cover

Low priority. Scope: glossary. Sources: [line 274](../../../content/mobile-platform/glossary.md#L274), [line 398](../../../content/mobile-platform/glossary.md#L398). Linking passages: ch13:169 and ch13:200.

> StoreKit gives the client a transaction that the App Store signed as a JSON Web Signature, the signed form that [[JSON Web Token | JSON Web Tokens]] use.

> Google Play's real-time developer notifications are published to a [[pub/sub]] topic that the team sets up in Google's cloud

At ch13:169 the reader hovers to learn what a JSON Web Signature is. The card says "signed or encrypted" but never uses the name JWS, so it does not confirm the connection the sentence makes. One clause fixes it: "a signed token is a JSON Web Signature (JWS)". At ch13:200 the topic belongs to Google's managed service of that name. The card describes the pattern and contrasts Redis with "a log-based system", which leaves the reader unsure which kind Google's service is. Suggest one sentence noting that managed services named Pub/Sub keep a message until each subscription acknowledges it. As a claim about a product, this goes to Phase 35 as an unverified technical referral and should be checked before it is written.

### RR-GL-09: ANR omits the figure that every linking chapter uses

Low priority. Scope: glossary. Source: [line 51](../../../content/mobile-platform/glossary.md#L51).

> most often because an input event went unanswered for too long.

ch02:331 and ch07:36 both give five seconds for an unanswered input, and ch07:764 builds an argument on launch time adding up to that limit. The card's "too long" makes the reader leave it to find the number. Proposed: "…went unanswered for five seconds." Keep the "most often" qualifier, because other ANR triggers exist.

## Terms used without an entry or definition

These were noticed while reading linking passages. The search was not exhaustive.

- **tombstone** in ch02 (lines 658, 672, 743) is the term's first use and is not linked. The entry exists (see RR-GL-02).
- **dyld** is defined inline in ch03:520 ("`dyld`, the dynamic linker") and is not linked to the Dynamic linker entry. That is acceptable, since the inline definition suffices. The entry's body should point back to it (RR-GL-02).
- **PKCE** appears unexpanded in the OAuth entry (line 340). It is taught in full at ch04:545 to 550, where OAuth is linked, so no entry is needed.
- **Player Settings / Player settings**: the chapters use both capitalizations (22 and 36 occurrences), and the glossary uses both (lines 18, 262 and 319 versus 445). This is a book-wide consistency point for the synthesis, not a glossary defect.

No other term at a linking passage required outside help. Terms such as build ID, watchdog, burn rate, composition root and Append build are each defined inline where they first appear.

## Completion and limits

All 76 entries were read, and every linking passage was read at least at sentence level. Wider context was read where the judgment needed it. No technical claim was verified. RR-GL-01 is reported as an internal contradiction between the summary and the body. RR-GL-08's product sentence is an unverified referral to Phase 35. Source review only; no preview cards were rendered. Content, code and the run's `index.md`, `snapshot.json` and `inventory.json` were not changed.
