# Chapter 10: reader and writing review

Status: chapter complete. Review order: descending chapters; sections read in their normal order.

Source: [10-variants-and-releases.md](../../../content/mobile-platform/10-variants-and-releases.md). Snapshot: [snapshot.json](snapshot.json).
Coverage: 5 sections, 10 concepts, 45 variants; all prose, tables, code, exercises, options and explanations read.

**Learner experience: 8/10. Writing: 7/10.** The chapter has a coherent path from build variants to release verification, with useful concrete mistakes and strong comparison tables. Readability suffers when probe narration occupies the place where a short rule or checklist would serve the learner better.

**Preserve:** The assertion-with-side-effects example and correction; separating environment selection from remote configuration; the version-field mapping; explaining why halting does not undo installed builds; the store-installed candidate checklist.

## Section ratings

L = learner experience; R = readability; S = structure; C = conciseness; V = style consistency; W = overall writing. Scores use the [shared anchors](../../reader-review-plan.md#ratings-and-chapter-reports), as editorial judgments rather than averages.

| Section | L | R | S | C | V | W | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Development and release builds differ on purpose<br>`release-build-variants` | 8 | 7 | 7 | 6 | 8 | 7 | The assertion example teaches immediately; the practical settings table should precede the export investigation (RR-10-01). |
| Environment-specific configuration<br>`release-environments` | 8 | 7 | 8 | 6 | 8 | 7 | A clear compile-time decision and guard; the enumerated probe results interrupt the explanation (RR-10-02). |
| Versions and build identity<br>`release-versioning` | 8 | 7 | 7 | 7 | 8 | 7 | Useful mapping and stamp, but needs an example of the final diagnostic record and explicit code scope (RR-10-03). |
| Store tracks and staged rollouts<br>`release-rollouts` | 8 | 8 | 8 | 7 | 8 | 8 | Halting and sampling are memorable; the threshold table needs precise units and a worked decision (RR-10-04). |
| Verify the build the store will ship<br>`release-verification` | 9 | 8 | 9 | 8 | 8 | 9 | An actionable whole-chain checklist with a good automation exercise; no material structural finding. |

## Findings and proposed changes

### RR-10-01: Lead with the settings comparison, then explain the evidence

Medium priority. Scope: prose structure and conciseness. Section: `release-build-variants`. Source: [10-variants-and-releases.md, line 10](../../../content/mobile-platform/10-variants-and-releases.md#L10).

> A new Unity 6.3 project, exported once with the option and once without for each platform, showed where the two builds part:

The learner first walks the author's export investigation and implementation details before reaching the table answering what Development Build actually changes. Move the table earlier, follow with the assertion bug, then give concise supporting platform notes. Preserve settings that do not follow the toggle and qualifications about profile overrides. Put exact generated-file evidence after the practical explanation.

### RR-10-02: Turn the guard validation narrative into a readable case table

Medium priority. Scope: prose and example presentation. Section: `release-environments`. Source: [10-variants-and-releases.md, line 189](../../../content/mobile-platform/10-variants-and-releases.md#L189).

> In a Unity 6.3 test, it passed a store profile that defined `ENV_PRODUCTION`,

The paragraph enumerates passed and failed profiles in a long series, making it hard to compare conditions. Use a profile/defines/development/result table with a short rationale for the guard. Retain both the inherited-project-defines case and the no-profile case, which are useful edge cases rather than disposable detail.

### RR-10-03: Show the artifact the build stamp is meant to produce

Medium priority. Scope: prose and code presentation. Section: `release-versioning`. Source: [10-variants-and-releases.md, line 342](../../../content/mobile-platform/10-variants-and-releases.md#L342).

> At start-up the game loads the stamp and logs it in one line with `BuildEnvironment.Name`,

The reader sees the data class and build script but no sample JSON or resulting log. Supply one minimal stamp and the corresponding startup line so each field's source and diagnostic use can be checked. Explicitly label StoreBuild as a focused version-stamping example and link to Chapter 11's more complete failure handling; otherwise two build wrappers with different completeness appear to be interchangeable.

### RR-10-04: Make threshold units and sample decisions explicit

Medium priority. Scope: prose table and exercise. Section: `release-rollouts`. Source: [10-variants-and-releases.md, line 432](../../../content/mobile-platform/10-variants-and-releases.md#L432).

> | Purchases completed per purchase started | The backend, by client version | 5% or more below the previous version |

The table uses percentage points for crash-free users but “5% below” for conversion funnels. State whether that is a relative drop or five percentage points, then give a baseline/candidate example. Show why 500 independent sessions at a 0.1% failure probability give roughly 1 − 0.999^500 ≈ 39% chance of seeing at least one failure, with the simplifying assumption stated. The exercise asks the reader to choose samples, so provide an example sample policy rather than only warning that small samples mislead.

## Exercises and assessment

All 45 variants were read, including true/false and multiple-select variants. They largely map to the two concepts per section and check meaningful misunderstandings. Repeating the halt/no-rollback fact as both a scenario and true/false is acceptable retrieval practice, though the latter alone gives weaker evidence of application. The final exercise can be completed from the supplied checklist without a store account; earlier project exercises would benefit from offering the book's imaginary game as a default. Build-profile and environment examples are well connected to prior chapters.

## Representative wording revisions

Proposals only; source files remain unchanged.

Before:

> What the Development Build option changes is narrower than its name suggests.

After:

> Development Build changes specific compilation and debugging settings. It does not choose every setting used by a release variant.

Before:

> The criteria also name who may halt.

After:

> The release criteria also name the people authorized to halt the rollout.

## Completion and limits

No technical correction is asserted. API behavior and commands were not executed. Source review only; no rendered-page inspection. Cross-chapter comparisons remain provisional until the synthesis. Chapter revisions can be planned from the findings above without rereading this conversation. Committed question changes require the separate consent described in the shared plan.
