# Chapter 15 credits chapter 9 with an “operation id” and “attempt id” it does not name

**Kind:** Consistency. **Priority:** Low. **Touches:** prose only.

## Location

`content/mobile-platform/15-debugging-across-boundaries.md:17`: “Chapter 9's operation id joins attempts of one logical action, while an attempt id distinguishes its individual requests ([[#network-observability]]).”

## Evidence

The linked section never says “operation id” or “attempt id” (`grep -c -i 'operation id' content/mobile-platform/09-reliable-networking.md` gives 0). It calls the id a correlation id, and logs an attempt number beside it (`09-reliable-networking.md:554-556`): “A correlation id joins the two. The client creates it when the operation starts, sends it as a header with every attempt … One id per operation, the same on every attempt, with the attempt number logged beside it”. Chapter 14 uses chapter 9's name (`14-running-services.md:463`, “Chapter 9's correlation id”). A reader following the link finds no term that matches, and the book now has three names for one id (correlation id, operation id, and the “request id” of chapter 15's questions at lines 55 and 79).

## Proposed fix

Line 17: “Chapter 9's correlation id, one per operation and the same on every attempt, joins the attempts of one logical action, and the attempt number logged beside it tells the individual requests apart ([[#network-observability]]). This chapter calls them the operation id and the attempt id.”

The committed questions at lines 55 and 79 say “request id”, which chapter 9's `X-Request-Id` header name makes readable; they need no change.

## Repeated in

The trace fences at lines 338-343 use `op=` and `attempt=`, which the proposed sentence then introduces.
