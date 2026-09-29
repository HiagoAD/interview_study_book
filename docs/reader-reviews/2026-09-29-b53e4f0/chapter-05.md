# Chapter 05: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [05-android-builds.md](../../../content/mobile-platform/05-android-builds.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 5 sections, 11 concepts, 39 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 8/10. Writing: 8/10.** One of the clearest chapters: artifacts and concrete failures explain the build mechanisms. A few absolute statements and inaccessible labs need refinement.

**Preserve:** Module/template tables, dependency tree with arrows, runtime-versus-build failure distinctions, and wrong-mapping-file demonstration.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| From Unity to an APK or AAB: the generated Gradle project<br>`gradle-project` | 8 | 8 | 8 | 7 | 8 | 8 | Strong generated-project model; customization options need a choice guide. |
| Manifest merging and the permissions nobody asked for<br>`gradle-manifest-merge` | 9 | 9 | 9 | 8 | 8 | 9 | Priority, conflict markers and provenance form a clear causal sequence. |
| Dependencies, conflicts, and resolution<br>`gradle-dependencies` | 9 | 8 | 9 | 8 | 8 | 8 | Concrete resolution tree explains why a successful build can still fail. |
| R8, keep rules, and symbol files<br>`gradle-r8-symbols` | 9 | 8 | 9 | 8 | 8 | 8 | Bridge and mapping experiments directly support the lesson. |
| APK, AAB, and the Play signing key<br>`gradle-packaging-signing` | 8 | 8 | 7 | 8 | 8 | 8 | Signing model is clear; API levels introduce a second organizing topic at the end. |

## Findings and proposed changes

### RR-05-01: Help the reader choose a customization mechanism

Medium priority. Scope: instructional structure. Section: `gradle-project`. Source: [05-android-builds.md, line 28](../../../content/mobile-platform/05-android-builds.md#L28).

> Unity 6.3 has three mechanisms for making them.

The following explanations tell how each works but leave the first choice implicit. Add a small need/preferred mechanism/reason table: existing vendor template integration, typed incremental modification, and legacy post-generation editing. Keep the existing drift warnings.

### RR-05-02: Replace the absolute opening with the build’s actual distinction

Low priority. Scope: wording. Section: `gradle-manifest-merge`. Source: [05-android-builds.md, line 102](../../../content/mobile-platform/05-android-builds.md#L102).

> An installed app has one manifest, and nobody writes it by hand.

Readers do write source manifests, as the chapter soon demonstrates. Say the build assembles the installed manifest from source manifests. The point is provenance, not that nobody ever writes a manifest.

### RR-05-03: Distinguish compatibility risk from inevitable breakage

Medium priority. Scope: precision. Section: `gradle-dependencies`. Source: [05-android-builds.md, line 243](../../../content/mobile-platform/05-android-builds.md#L243).

> `strictly` on the lower version chooses which SDK breaks

Earlier text correctly makes NoSuchMethodError conditional on an API change. Here the wording turns that risk into certainty. Say which SDK must run against an unrequested version, then require evidence of compatibility. Keep the strong warning without implying every forced downgrade fails.

### RR-05-04: Specify how the lab creates the failure

Medium priority. Scope: lab determinism. Section: `gradle-r8-symbols`. Source: [05-android-builds.md, line 402](../../../content/mobile-platform/05-android-builds.md#L402).

> turn on minify for development builds, call the bridge from C# on a device, and read the exception

An existing bridge may already carry consumer rules, so enabling minify need not produce an exception. Provide a controlled minimal bridge with rules deliberately omitted, and a trace/mapping pair as an offline alternative. Similarly supply the two-SDK dependency fixture rather than requiring a real graph that happens to conflict.

### RR-05-05: Give API-level policy its own internal heading

Low priority. Scope: navigation. Section: `gradle-packaging-signing`. Source: [05-android-builds.md, line 503](../../../content/mobile-platform/05-android-builds.md#L503).

> The last part of a build's identity is three

The transition from installed signatures to min/target/compile SDK is substantial. A heading and one sentence tying target selection to reproducibility would make this material easier to find without adding a new top-level section or changing progress IDs.

## Exercises and assessment

All variants were read. The concept pools largely match the taught decisions, and the multi-select and true/false variants test useful distinctions. The wrong mapping-file experiment is especially valuable because a plausible result is not proof of a match. Lab fixtures should ensure the intended error actually occurs. The signing exercise needs a mock fingerprint-registration inventory for students without Play Console access; it can assess the same reasoning without modifying a live service.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> An installed app has one manifest, and nobody writes it by hand.

After:

> The build assembles the installed app’s manifest from the source manifests in the project.

Before:

> `strictly` on the lower version chooses which SDK breaks

After:

> `strictly` on the lower version makes the SDK requesting the newer version run against the older one

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
