# Chapter 04: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [04-os-integration.md](../../../content/mobile-platform/04-os-integration.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 5 sections, 10 concepts, 34 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 8/10. Writing: 7/10.** Strong lifecycle reasoning; version-specific investigations sometimes bury the portable learning path.

**Preserve:** Lifecycle trace, link destination-versus-sender distinction, push identity trace and process-death sign-in scenario.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Two lifecycles: the OS's app states and Unity's callbacks<br>`os-lifecycle` | 9 | 8 | 9 | 8 | 8 | 8 | Trace makes callback-order limits concrete. |
| Permissions and usage descriptions<br>`os-permissions` | 8 | 7 | 8 | 7 | 8 | 7 | Permission exceptions need a comparison table. |
| Deep links and verified links<br>`os-deep-links` | 7 | 7 | 6 | 6 | 7 | 6 | Long Unity patch interrupts routing and trust fundamentals. |
| Local and push notifications<br>`os-notifications` | 8 | 8 | 8 | 7 | 8 | 8 | Useful identity sequence; dense delivery cases. |
| Sign-in callbacks and external authentication<br>`os-auth-callbacks` | 8 | 8 | 8 | 7 | 8 | 8 | Well-motivated security distinctions; promised sample vector absent. |

## Findings and proposed changes

### RR-04-01: Separate link design from a version-specific workaround

Medium priority. Scope: structure. Section: `os-deep-links`. Source: [04-os-integration.md, line 288](../../../content/mobile-platform/04-os-integration.md#L288).

> In Unity 6000.3.11f1, iOS calls none of them.

Teach validation, readiness and duplicate handling before a labeled Unity 6000.3.11f1 integration note. Keep the category and its upgrade-removal condition together, explicitly distinguishing tested custom schemes from untested signed universal links.

### RR-04-02: Tabulate permission-specific exceptions

Medium priority. Scope: presentation. Section: `os-permissions`. Source: [04-os-integration.md, line 170](../../../content/mobile-platform/04-os-integration.md#L170).

> For notifications and location, iOS asks once

The paragraph immediately qualifies this with Allow Once, provisional notifications and a tracking rule. A resource/request/denial/recheck table prevents asks-once becoming a universal rule.

### RR-04-03: Show delivery as a matrix

Medium priority. Scope: presentation. Section: `os-notifications`. Source: [04-os-integration.md, line 450](../../../content/mobile-platform/04-os-integration.md#L450).

> FCM delivers two kinds of message

Use payload-kind rows and foreground, background and tap-handling columns; retain the intent-extras warning.

### RR-04-04: Supply the promised PKCE vector

Medium priority. Scope: worked example. Section: `os-auth-callbacks`. Source: [04-os-integration.md, line 532](../../../content/mobile-platform/04-os-integration.md#L532).

> For RFC 7636's sample verifier, it computes the challenge

Neither sample verifier nor expected challenge is provided locally. Add the invocation and expected string, then a button/browser/redirect/backend timeline labeling state, challenge, code and verifier.

### RR-04-05: Scope pause as the normal background save opportunity

Medium priority. Scope: guarantee wording. Section: `os-lifecycle`. Source: [04-os-integration.md, line 108](../../../content/mobile-platform/04-os-integration.md#L108).

> The pause is the last moment the game can count on

This explanation sounds unconditional despite crashes and forced endings discussed in the chapter. Say normal background transition, and mention durable checkpoints for important progress as it occurs. No new persistence subsystem is required.

## Exercises and assessment

All variants and explanations were read. Most pools assess coherent distinctions. Deep-link questions assess generic trust and verification rather than the extensive scene patch: treat it as version-specific reference. Provide callback logs, permission scenarios and a mock auth trace for readers without hardware. Preserve the process-kill lab, which distinguishes activity recreation from process death.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> For notifications and location, iOS asks once:

After:

> The rules for repeating an iOS permission request depend on the resource:

Before:

> So this section starts with what each side promises, and with what neither does.

After:

> The first step is to distinguish the callbacks the game can use from events it may never receive.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
