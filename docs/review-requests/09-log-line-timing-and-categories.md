# The sample log line contradicts the chapter's own timeouts and error categories

**Kind:** Accuracy. **Priority:** Medium (a worked example that does not add up). **Touches:** prose and a `json` code fence in `network-observability`; no question block.

## Location

- `content/mobile-platform/09-reliable-networking.md:561-563`, the sample line:
  `"attempt": 2, "endpoint": "POST /rewards/claim", "status": 504, "category": "gateway_timeout", "ms": 10012`
- `content/mobile-platform/09-reliable-networking.md:566`: “The error categories are the classes of the retry section: never sent, no answer, declined for now, refused, and a body that failed its checks.”

## Evidence

Read against the chapter itself:

1. `network-retries` gives `POST /rewards/claim` `AttemptSeconds = 10` (line 199). `SendAttemptAsync` (lines 29 to 47) cancels the attempt with `CancelAfter` at that limit, clipped to the deadline, and turns the cancellation into `ApiResponse.NoResponse("attempt timed out")`. An attempt of this endpoint therefore ends at 10,000 ms at the latest, and a 504 that arrives after 10,012 ms is never seen by the client: the line it would log is a status-0 “no answer”, not a 504. The chapter's Unity run confirms the timer's precision: attempts ended at 1.01 s for a 1-second limit (`docs/evidence/09-reliable-networking.md`, “Runs”, run 3).
2. `network-timeouts` (line 23) sets the rule that the server's limit is below the client's attempt timeout, “so that the server's answer, even a 504, reaches the client before the client stops waiting”. The sample shows the opposite ordering.
3. The category list at line 566 names five classes, none of which is the 5xx row of the retry table (line 164: 500, 502, 503, 504, “The status does not say whether the work was done”). The sample's `gateway_timeout` is outside the list the next sentence says it is drawn from, and a reader building the categories from line 566 has nowhere to put a 5xx answer.

## Proposed fix

- In the sample, change `"ms": 10012` to a value below the attempt limit that fits a gateway limit below 10 s, such as `"ms": 8014`, and `"category": "gateway_timeout"` to the name of the class, such as `"category": "server_error"`.
- Line 566: “The error categories are the classes of the retry section: never sent, no answer, a server error whose outcome is unknown, declined for now, refused, and a body that failed its checks.”

## Repeated elsewhere

No question or glossary entry repeats the figure or the list.
