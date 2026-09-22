# Review request: option sets that give the answer away or defend a wrong option

- **Kind:** question design
- **Priority:** medium for the first two defensible options, low for the rest
- **Where:** fourteen questions, listed below
- **Touches:** `-` lines only, a questions-pass change, except the last two sections

The book's distractor standard is that a wrong option must not be eliminable by its
wording alone, and must be wrong. These sets miss one or the other.

## Yes and No

Three choice questions are phrased as yes-or-no, so the first word of every option carries
the answer:

| Question | Correct begins | Wrong options that begin the same way |
| --- | --- | --- |
| `liveops-time-authority` (13:50) | No | 0 of 4 |
| `unity-field-migration` (06:232) | No | 1 of 4 |
| `collaboration-exposed-controls` (14:87) | No | 1 of 4 |

With four options shown, `liveops-time-authority` always shows one “No” among three “Yes”,
and the other two do so whenever their single “No” distractor is not drawn, one time in
four. The prompts lean the same way (“by itself”, “automatically”, “every”), which is the
surface heuristic the standard was written against.

Fix: add one or two “No, because …” options with a wrong reason, as
`unity-field-migration` already has one. For the clock offset, for example:
`- No, because the offset drifts too far to be useful after a day.` and
`- No, because the offset has to be measured again at each launch.` Keep new options clear
of the standard's word list, or the heuristic wins them back.

## Wrong options that a careful reader can defend

| Question | Option marked wrong | Why it can be defended |
| --- | --- | --- |
| `performance-ui-updates` (11:155) | “Cache the formatted string and reassign it each frame.” | Both uGUI `Text.text` and `TMP_Text.text` return early when the new string equals the old one (installed 6000.3 package source, `Text.cs:215` and `TMP_Text.cs:127`), so a cached string reassigned each frame causes no rebuild. Caching it also means knowing when the score changed, which is the correct answer. |
| `csharp-result-vs-exception` (04:395) | “The platform billing SDK had not finished initializing before the call.” | An uninitialized store is an ordinary, expected state on mobile, and chapter 12 models it as a result: `PurchaseStatus.Unavailable`, “Billing is not ready. Retry later.” |
| `interview-performance-prompt` (15:288) | “Ask what changed in the most recent release, then inspect that code.” | Chapter 08 (line 126) recommends exactly this, as version bisection, when no hypothesis exists. |
| `interview-metric-honesty` (15:58) | “Give a conservative estimate, noting that it is approximate.” | A labelled estimate is not the invented precise figure the section rules out. |
| `architecture-encapsulation` (01:172) | “Callers read the intent from a verb more easily than from an assignment.” | True, and a benefit; it is only not the main one. |
| `missions-shadow-mode`, second variant (03:234) | “Record the difference and continue, since shadow results do not reach players.” | Recording and continuing is what shadow evaluation does; only the “since” clause is wrong. |
| `oop-composition-benefit`, second variant (05:107) | “Give both fields a default policy that does nothing, so the enemy still runs.” | The variant's own explanation says “Factories, defaults, and validation help”. |

The first two are worth fixing now, because they are Unity and C# facts and the second
contradicts chapter 12. The rest can wait for the next questions pass. For each, replace
the `-` line with a mistake that is wrong on the section's own terms, and check it against
the standard's word list and the median option length.

## Questions that test arithmetic rather than the section

Three concepts ask only for a multiplication the prompt sets up:

- `missions-scale-estimate` (03:274): 20 × 100.
- `structures-pair-count` (09:46): 1,000 × 1,000.
- `performance-work-frequency` (11:147): 0.02 × 1,000.

Each section's point is what the product means, or does not: “It does not claim that every
predicate has equal cost”, “Reducing how many candidates need checking may help much
more”, “Small per-entity work can exceed an entire frame budget”. A reader can answer all
three without reading the section. Changing that needs more than `-` lines: a new prompt
on the same concept, or a `?+` variant that asks what the figure does not establish.
Leaving them costs little; they are easy review, not wrong review.

## One accepted-answer list

`performance-60-budget` (11:42) accepts only `16.67`. A reader who types the unit,
`16.67 ms`, is marked wrong, because the check removes spaces and compares `16.67ms`, and
has to press **I was right**. Adding `16.67ms` to the `=` line would accept both
spellings. The `=` line is outside what a questions pass may change, so this is a decision
rather than a fix.
