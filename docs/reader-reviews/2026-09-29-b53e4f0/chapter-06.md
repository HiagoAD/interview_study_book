# Chapter 06: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [06-ios-builds.md](../../../content/mobile-platform/06-ios-builds.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 4 sections, 8 concepts, 30 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 8/10. Writing: 7/10.** Clear build and signing models, with practical commands. Evidence digressions and the lock-file lifecycle need better placement.

**Preserve:** Archive versus export, the profile’s five questions, and resolver failure versus linker failure.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| From Unity to an IPA<br>`xcode-build-flow` | 8 | 7 | 7 | 7 | 7 | 7 | Useful artifact map; compiler warning and export-failure experiments interrupt the main path. |
| Certificates, identifiers, profiles, and entitlements<br>`xcode-signing-model` | 9 | 8 | 9 | 8 | 8 | 8 | The profile table makes unfamiliar signing parts understandable. |
| Build settings and Info.plist keys that decide whether the app runs<br>`xcode-build-settings` | 8 | 8 | 7 | 7 | 8 | 7 | Good settings comparisons; networking dominates a section also covering privacy. |
| CocoaPods and dependency resolution on iOS<br>`xcode-cocoapods` | 7 | 7 | 7 | 7 | 8 | 7 | Workspace mechanism is clear; preserving resolution across exports needs an operational sequence. |

## Findings and proposed changes

### RR-06-01: Separate the happy path from toolchain investigations

Medium priority. Scope: structure. Section: `xcode-build-flow`. Source: [06-ios-builds.md, line 18](../../../content/mobile-platform/06-ios-builds.md#L18).

> All 56 warnings

Present the archive/export commands and artifact map before the IL2CPP deployment-target investigation. Move unsigned-team experiments into a failure table after signing is introduced or link forward. Keep measurements labeled as this probe, not expected output for every project.

### RR-06-02: Explain how a preserved lock reaches a fresh export

Medium priority. Scope: cross-chapter procedure. Section: `xcode-cocoapods`. Source: [06-ios-builds.md, line 411](../../../content/mobile-platform/06-ios-builds.md#L411).

> A Unity export is regenerated, and its lock with it

Archiving Podfile.lock records what shipped, but does not alone reproduce the next clean build. Chapter 7 requires pinned resolutions. Show the sequence: retain the reviewed lock outside generated output, restore it before installation, use deployment mode, and handle intentional updates separately. Explain ownership when EDM4U runs installation automatically. Present as the missing operational bridge, not a claim that the shown range is always wrong.

### RR-06-03: Name the behavior rather than attributing failure to keys

Low priority. Scope: wording and navigation. Section: `xcode-build-settings`. Source: [06-ios-builds.md, line 314](../../../content/mobile-platform/06-ios-builds.md#L314).

> Two more keys fail quietly.

Introduce URL-scheme queries and background modes under a small heading; keys do not themselves fail, and absent background declarations differ from canOpenURL returning false. Give each an observable consequence.

### RR-06-04: Provide controlled local pod fixtures

Medium priority. Scope: lab reproducibility. Section: `xcode-cocoapods`. Source: [06-ios-builds.md, line 419](../../../content/mobile-platform/06-ios-builds.md#L419).

> Narrow one pod's version range until the two no longer overlap

Readers cannot necessarily narrow a transitive vendor dependency by editing a top-level declaration. Supply two tiny local podspecs and a shared dependency with known compatible/incompatible ranges, plus expected resolver output. The archive lab already offers an excellent no-signing-credentials branch; use that model for signing/profile exercises too.

## Exercises and assessment

All variants and explanations were read. Most concepts are well bounded: archive contents, export method, profile binding, expiry, ATS and workspace. Pod conflict appropriately distinguishes resolution from linkage but its lock-record variant tests a different decision; consider separate coverage. Supply a redacted profile fixture for readers without team credentials and an expected UUID comparison for readers without a Mac. Preserve the unsigned export failure path, which makes a realistic limitation teachable.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> Two more keys fail quietly.

After:

> Two other settings affect URL queries and background work.

Before:

> The export takes its team from the archive: the `teamID` option defaults to the team the archive was built with.

After:

> Unless `teamID` is set in the export options, the export uses the team recorded in the archive.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
