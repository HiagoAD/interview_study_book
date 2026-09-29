# The id horizon example treats a late first upload as a duplicate

**Kind:** Accuracy. **Priority:** Low (misleading reasoning, where the rule it states is sound). **Touches:** prose at line 767, and the explanation of one committed question block at line 833.

## Locations

`content/mobile-platform/13-game-services.md:767`, in `design-live-events`:

> Take a phone that records an event on Monday and loses its connection before the upload. The queue of [[#network-offline]] holds the batch, and the phone sends it on the following Sunday, and if that response is lost as well, once more in the next session. The first upload was counted on Sunday. A consumer that forgot the id after a day counts the resend as new, so the horizon of remembered ids has to cover the longest time the client keeps a batch, plus the time a queue may take to redeliver.

`content/mobile-platform/13-game-services.md:833`, the explanation of the `?+` variant of `design-telemetry-dedup` that asks “How long must the consumers remember event ids to catch duplicates?” (line 827):

> Duplicates arrive as late as the latest retry: a phone that was offline for a week sends its queue a week later, and a resend of a lost batch can come in the next session. …

## Evidence

This rests on reasoning about the pipeline the section describes. No documentation is needed.

A consumer can only remember an id from the moment it first sees it. In the example, the first upload reaches the pipeline on Sunday. Nothing that happened between Monday and Sunday can produce a duplicate, because the pipeline had not seen the event before Sunday. The week offline makes the event late, and a late event is not a repeated one. Whether a one-day memory counts the resend twice depends on the gap between Sunday's upload and the next session, and the example does not give that gap. The conclusion, “the longest time the client keeps a batch”, then mixes two different spans:

- If ids are remembered for a time counted from their first arrival, the horizon has to cover the time from a batch's first upload to its last resend, plus redelivery. The week the phone was offline plays no part.
- If ids are dropped by the event's own time, for example with a warehouse partitioned by event date, the horizon also has to cover the time the phone held the batch before its first upload. The week does matter then, but the paragraph does not say that this is the model it means.

The question's explanation repeats the same confusion: “a phone that was offline for a week sends its queue a week later” describes a late first delivery, which is not a duplicate. A reader who reviews this concept for months learns that the dedup window has to cover the time a client was offline, and that only holds under the second model.

The paragraph came in with the reader review in commit `7d2c7e0`, after the blind review of Phase 31.

## Proposed fix

Prose, line 767, from “Take a phone” to the end of the paragraph:

> Take a phone that uploads a batch on Sunday and loses the response. The queue of [[#network-offline]] keeps the batch, and the phone sends it again at its next session, which for a player who plays only at weekends is the following Saturday. A consumer that remembers each id for a day after it first saw it counts that resend as new. So the horizon, counted from an id's first arrival, has to cover the longest time a client keeps a batch it has already sent, plus the time a queue may take to redeliver. A consumer that drops ids by the event's own time instead, as one that deduplicates within each day of a warehouse partitioned by event date does, has to add the time a phone held the batch before its first upload, which is a week for a phone that was offline for one.

Question block, line 833 (explanation only; the prompt, the `*` option and the `-` options stay):

> Duplicates arrive as late as the latest retry: a resend of a batch whose response was lost comes at the client's next session, which can be days later, and a queue can redeliver after that. The window of remembered ids, counted from each id's first arrival, has to cover that horizon, or the late repeat is counted.

**Cost to review history:** changing an explanation keeps the concept id `design-telemetry-dedup` and its schedule. The concept is not split and no variant moves, so the reader loses no history. `npm run guard -- questions` reports the changed explanation, so the edit needs the user's consent and an allowance for that one line.

## Repeated elsewhere

The other variants of `design-telemetry-dedup` (lines 803 to 825) and the glossary do not state the horizon.
