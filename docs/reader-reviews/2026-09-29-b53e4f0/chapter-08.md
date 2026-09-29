# Chapter 08: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [08-backend-clients.md](../../../content/mobile-platform/08-backend-clients.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 5 sections, 10 concepts, 42 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 7/10. Writing: 7/10.** Strong explanations of uncertain outcomes and compatibility need clearer internal stages, especially in section 2.

**Preserve:** Result/status distinction, late-401 case, explicit unknown enum mapping and first-release update backstop.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HTTP semantics a game client relies on<br>`http-semantics` | 8 | 8 | 8 | 7 | 8 | 8 | Decision tables work well; attribution occasionally interrupts. |
| UnityWebRequest and HttpClient in a Unity client<br>`http-unity-clients` | 7 | 7 | 6 | 6 | 7 | 6 | Threads, results, disposal, pinning and a full adapter need internal headings. |
| Sessions and tokens<br>`http-sessions` | 7 | 7 | 7 | 7 | 8 | 7 | Concurrency motivation is clear; implementation needs a trace and lifecycle limits. |
| JSON, DTOs, and the game's domain<br>`http-dtos` | 8 | 7 | 8 | 7 | 7 | 7 | Strong mapper anchor; serializer experiments accumulate in prose. |
| API versions and clients that never update<br>`http-versioning` | 8 | 8 | 8 | 8 | 8 | 8 | Compatibility leads naturally to update policy. |

## Findings and proposed changes

### RR-08-01: Name the usable-response distinction

Medium priority. Scope: wording. Section: `http-unity-clients`. Source: [08-backend-clients.md, line 309](../../../content/mobile-platform/08-backend-clients.md#L309).

> The adapter decides the one question every later layer depends on: did the server answer?

The table says DataProcessingError follows an answer; ConnectionError can retain 200. The adapter distinguishes a complete usable response, not whether the server answered. Clarify the NoResponse shorthand accordingly.

### RR-08-02: Stage section 2 around its decisions

Medium priority. Scope: structure. Section: `http-unity-clients`. Source: [08-backend-clients.md, line 158](../../../content/mobile-platform/08-backend-clients.md#L158).

> Three details in the table decide how an adapter reads it.

Add internal headings for result interpretation, lifetime/cancellation, client choice/platform limits and the adapter. Introduce the interface invariant before the full types. Put measured handler and finalizer evidence beside the relevant rule as supporting notes. Preserve the iOS timeout and HTTPS caveats.

### RR-08-03: Guard the session against an old refresh completing after sign-out

High priority. Scope: worked example. Section: `http-sessions`. Source: [08-backend-clients.md, line 558](../../../content/mobile-platform/08-backend-clients.md#L558).

> Cancel the requests still in flight, since their answers belong to the previous player.

RefreshOnceAsync uses CancellationToken.None and later saves unconditionally. The example does not show how a completed old-account refresh is prevented from restoring a cleared session or overwriting a new one. Add an account-generation check or equivalent lifecycle guard, with a sign-out/refresh timeline. Coordinate with Chapter 9’s deadline finding: cancelling one waiter and invalidating an account are different operations. This is a visible teaching gap, not an executed application test.

### RR-08-04: Compare serializer behavior in a table

Medium priority. Scope: presentation. Section: `http-dtos`. Source: [08-backend-clients.md, line 709](../../../content/mobile-platform/08-backend-clients.md#L709).

> It is also forgiving in ways that hide mistakes.

The following sentence combines missing fields, unknown fields, null and numeric coercion, and case matching. Show input, serializer result and mapper policy in a table; retain platform/version provenance in a note.

### RR-08-05: State where invariants are enforced

Medium priority. Scope: example explanation. Section: `http-dtos`. Source: [08-backend-clients.md, line 654](../../../content/mobile-platform/08-backend-clients.md#L654).

> public DailyOffer(string id, RewardKind kind, int amount, string itemId, int priceGems, DateTime endsUtc)

The prose says invariants are checked when the domain type is built; the public constructor only assigns fields, while the mapper validates. State the assumption that callers use the mapper, or constrain construction.

### RR-08-06: Supply an alternative contract-change history

Medium priority. Scope: exercise access. Section: `http-versioning`. Source: [08-backend-clients.md, line 887](../../../content/mobile-platform/08-backend-clients.md#L887).

> Take the last ten changes to an API your game uses.

Provide a small JSON change set for readers without API history. Section 2’s timeout lab similarly needs a delayed/slow-body server recipe.

## Exercises and assessment

All options and explanations were read. Outcome and refresh questions reinforce causal distinctions. The http-dto-mapping pool mixes architecture, serialization, linker preservation, numeric precision and currency; http-client-secrets mixes embedded keys, storage and attestation. One sampled variant does not establish all those skills. Audit grouping before consented question changes. Add a late-401 and account-switch timeline to the useful session exercise.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> The adapter decides the one question every later layer depends on: did the server answer?

After:

> The adapter decides whether the exchange produced a complete response the game can use.

Before:

> Two facts about `HttpClient` in Unity come from Unity's class libraries.

After:

> Unity’s class libraries reveal two limits to what an Editor test of `HttpClient` can establish.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
