---
book: unity-mobile-platform-engineering
chapter: 09: Reliable requests on unreliable networks
---

## Deadlines, timeouts, and cancellation {#network-timeouts}

A request from a phone crosses a radio link, a carrier's network or a Wi-Fi router, the internet, and the backend's gateway, the server in front of its services, before it reaches the service that answers it. Any of them can stall. HTTP does not say how long a client should wait for an answer, so every limit on the wait is one that the client, the server or the gateway chooses, and a game that chooses none leaves a spinner on screen that nothing ends. Chapter 8 covers the requests themselves, made with `UnityWebRequest` or `HttpClient`; this chapter covers what the game does when they do not come back.

There are four limits, and each bounds something different:

| Limit | What it bounds | Where it is set |
| --- | --- | --- |
| Connection | Reaching the server: the DNS lookup, the TCP connection and the [[TLS]] handshake | The HTTP stack. `UnityWebRequest` has no setting of its own for it |
| Attempt | One request and its response | `UnityWebRequest.timeout`, in whole seconds, and `HttpClient.Timeout`, which applies to each call |
| Operation | Every attempt, and the waits between them | The game's own code, as a deadline |
| Server | How long the backend works on the request | The backend. A gateway that stops waiting for a service answers 504 Gateway Timeout |

The attempt and the operation are the pair that matters most. A retry is a new request, and a new request has a new timeout: a `UnityWebRequest` that has been sent refuses a new `timeout`, so each attempt creates its own request, and `HttpClient`'s timeout starts again with each call. A per-attempt timeout therefore bounds one attempt and nothing more. Four attempts with a 10-second timeout, and waits of up to 1, 2 and 4 seconds between them, can hold the player for 47 seconds. In a .NET 8 test against a server that never answered in time, three attempts with a 1-second timeout took 3.0 seconds, while a deadline of 1.5 seconds across the same loop ended it after two attempts, at 1.5 seconds.

A deadline is an absolute time, set once when the operation starts. Each attempt's timeout is the smaller of the attempt's own limit and the time left, no attempt or wait starts after the deadline, and when it passes, the operation ends with a result the feature can show. The deadline is wall-clock time, so the minutes the game spends in the background count against it, as they do for the player.

The numbers come from measurements. The client times each endpoint's requests, as the last section of this chapter describes, and the percentiles of those timings set the limits: the 99th percentile, p99, is the latency that 99 requests in 100 beat. An attempt timeout below an endpoint's p99 cuts off more than one request in a hundred that would have succeeded, and each of those that was a write becomes an unknown outcome to reconcile. So the attempt timeout goes at the percentile beyond which the team is prepared to lose requests, such as the p99 or the p99.9, plus a margin. Timings taken on the client include the radio and the carrier's network, which the server's own timings leave out. The deadline comes from the player's side instead: how long the feature can keep them waiting, which is longer for a purchase being confirmed than for a leaderboard. The server's limit is the shortest of the three, below the client's attempt timeout, so that the server's answer, even a 504, reaches the client before the client stops waiting.

The owner of an operation can end it before any limit does: the player leaves the screen, and the object that asked for the data is destroyed. The `destroyCancellationToken` of [[#platform-results-threads]] is cancelled when its `MonoBehaviour` is destroyed, and passing it down to the request lets the owner abort the attempt in flight. Unity's source marks `UnityWebRequest.Abort` as safe to call from any thread, so registering it on the token is enough:

```csharp
// One attempt: its own timeout, clipped to the operation's deadline, and aborted with its owner.
static async Awaitable<UnityWebRequest> SendAttemptAsync(
    Func<UnityWebRequest> create, int attemptSeconds, DateTime deadlineUtc, CancellationToken token)
{
    token.ThrowIfCancellationRequested();
    double secondsLeft = (deadlineUtc - DateTime.UtcNow).TotalSeconds;
    if (secondsLeft < 1)
        throw new TimeoutException("The operation's deadline has passed.");

    UnityWebRequest request = create();                           // a new request for every attempt
    request.timeout = (int)Math.Min(attemptSeconds, secondsLeft); // whole seconds
    using (token.Register(request.Abort))
    {
        await request.SendWebRequest();
    }
    if (token.IsCancellationRequested)
    {
        request.Dispose();
        throw new OperationCanceledException(token);
    }
    return request; // the caller reads the result, then disposes the request
}
```

A timeout and a cancellation must stay apart, because a policy may retry the first and never the second: the player who left the screen is not waiting for another attempt. `HttpClient` makes the difference easy to lose, since both surface as an `OperationCanceledException`. On .NET 8 a timeout also nests a `TimeoutException`, but the dependable test is the owner's token, which does not depend on the runtime: an `OperationCanceledException` while the owner's token is not cancelled is a timeout.

Cancellation ends the client's waiting and not the server's work. A request that has reached the server runs to its end there: in the same .NET test, the server finished both requests whose client had stopped waiting, one by its timeout and one by its token. A cancelled write is therefore an unknown outcome, just as a timed-out one is. Its pending record stays, as the section on idempotency keys below describes, and a purchase screen that closed while it was verifying cannot conclude that nothing happened.

Suspension is the mobile form of the same problem. As [[#os-lifecycle]] describes, iOS suspends a game shortly after it moves to the background, and a suspended app runs no code. Its connections do not reliably survive either: an archived Apple technical note on networking and multitasking says that the system may reclaim the sockets of a suspended app and close their connections, so a request in flight when the player switched away can fail when the game resumes, with an unknown outcome if it was a write. The retry policy treats it as a failed attempt, and the deadline, which kept running in the background, decides whether another is made. Large downloads belong to the platforms, which run them in another process: iOS's background `URLSession`, whose transfers continue while the app is suspended, and even after the system terminates it, as [Apple's guide to background downloads](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background) describes, and Android's `DownloadManager` and user-initiated data transfer jobs. A game reaches them through a native plugin, over the bridges of [[#android-java-calls]] and [[#ios-native-calls]].

Exercise: For one operation in your game, write down the per-attempt timeout, the overall deadline, and what the player sees when each runs out. Then compare the per-attempt timeout with the endpoint's measured p99.

?? network-deadline A purchase check has a 10-second timeout per attempt and makes up to four attempts, with waits of up to 1, 2 and 4 seconds between them. How long can the player wait?
* About 47 seconds, since each attempt has a timeout of its own
- About 10 seconds, since the timeout covers the whole check
- About 17 seconds, one timeout plus the three waits between attempts
- About 40 seconds, since the waits overlap with the attempts
- About 14 seconds, since the last wait replaces the timeout
> A per-attempt timeout bounds one attempt. A retry is a new request with a new timeout, so four attempts of up to 10 seconds and waits of up to 1, 2 and 4 seconds add up to 47. Only a deadline, set once for the operation, bounds what the player waits.

?+ An operation's deadline is 4 seconds away, and its policy gives each attempt 10 seconds. What timeout does the next attempt get?
* 4 seconds, the smaller of its own limit and the time left
- 10 seconds, its own limit, since each attempt stands alone
- 14 seconds, its own limit plus the time left
- 2 seconds, half the time left, to leave room for a retry
- 6 seconds, its own limit minus the time left
> The deadline bounds the operation, so each attempt's timeout is clipped to the time that remains. A 10-second attempt started 4 seconds before the deadline would outlive the operation it belongs to, and the player would wait past the limit the feature promised.

?+ An `HttpClient` call throws `OperationCanceledException`, and the owner's token is not cancelled. What happened, and what may the policy do?
* The call's own timeout ran out, and the policy may retry it
- The player left the screen, and the policy must stop at once
- The server cancelled the request, and the policy must stop
- The response was not valid JSON, and the policy must stop
- The connection was refused, and the policy may retry at once
> A timeout and the owner's cancellation both surface as `OperationCanceledException`. The owner's token tells them apart: when it is not cancelled, the call's own timeout ran out, which the policy may retry within its deadline. A cancelled token means the owner is gone, and nothing retries for it.

?+ The player closes the purchase screen, and `destroyCancellationToken` aborts the verification request in flight. What does the game know about the purchase?
* Its outcome is unknown, so its pending record stays until settled
- It failed, since an aborted request does not reach the server
- It succeeded, since the server answers before an abort arrives
- It was undone, since the server stops the work with the connection
- It can be sent again safely, under a new idempotency key of its own
> Cancelling ends the client's waiting, not the server's work. A request that reached the server runs to its end there, as a .NET test showed when its server finished both requests whose client had stopped waiting. The record stays pending, with its key, until an answer settles it.

?? network-timeout-values An endpoint's latency, timed on clients, is 300 ms at the median, 2.5 s at p99 and 6 s at p99.9. A 1-second attempt timeout is proposed, to fail fast. What does it do?
* It cuts off more than 1 request in 100 that would have succeeded
- It cuts off 1 request in 1,000, the ones slower than the p99.9
- It cuts off half the requests, those slower than the median
- It cuts off nothing, since a timeout applies to failed requests
- It cuts off the requests that would have failed anyway, and no others
> More than one request in a hundred takes longer than a second, since the p99 is 2.5 s, and every one of them times out, with each write among them becoming an unknown outcome. An attempt timeout belongs at the percentile beyond which the team is prepared to lose requests, plus a margin.

?+ Why should the server's own time limit be shorter than the client's attempt timeout?
* Its answer, even a 504, arrives before the client gives up
- The client then retries sooner, before the server has finished
- A longer server limit makes the gateway retry the client's request
- The server then processes each of the requests faster on average
- The client's timeout then covers the connection time as well
> If the client stops waiting first, the server may finish work that the client has already written off, and the client is left with an unknown outcome. With the limits ordered from the server outward, a slow request ends with an answer the client can act on, a success or a 504.

?+ Where should the latency figures behind an attempt timeout come from?
* The client's own timings per endpoint, radio and carrier included
- The server's handler timings, which leave out mobile network noise
- Play Mode in the Editor, where the network is fast and stable
- The HTTP stack's default timeout, which suits most endpoints
- The backoff schedule, whose cap is the longest a request takes
> The attempt timeout limits what the client waits for: the device's radio, the carrier's network and the internet as well as the server's work. Timings taken on the server leave all of that out, so a timeout chosen from them cuts off requests on slow networks.

?+ How is an operation's deadline chosen, as opposed to its attempt timeout?
* From how long the feature can keep the player waiting
- From the endpoint's measured p99 latency, with a margin added
- From the attempt timeout multiplied by the number of attempts
- From the server's own limit, so that both run out together
- From the backoff cap, so that the longest wait fits inside
> The attempt timeout comes from measured latency, and the deadline from the player's side: how long a purchase confirmation or a leaderboard can hold them. The attempts and the waits then fit inside the deadline, with each attempt's timeout clipped to the time left.

## Retries that help instead of hurt {#network-retries}

*The Game Layer*, the first book, set out the schedule in its chapter “LiveOps, persistence, and safe releases”: exponential backoff with full jitter and a cap, in which the wait before each retry is drawn at random between zero and a limit that doubles with each attempt up to the cap, so that clients that failed together do not retry together, and a deadline on the whole sequence. This section takes up two questions the schedule leaves open: which failures deserve a retry, and what retries do when several layers have them.

A retry helps when two things hold: the failure may pass, and a second copy of the request does no harm. The second depends on the method. HTTP defines GET, HEAD, PUT and DELETE as [[idempotent]], meaning that sending one twice has the same intended effect as sending it once, and POST as not ([RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods)). The RFC asks clients not to retry a non-idempotent request unless they know that it is idempotent all the same, or that it was never applied. A POST that carries an idempotency key, the subject of the next section, counts as idempotent here:

| What happened | Retry? | Why |
| --- | --- | --- |
| The request was never sent: the host name did not resolve, or the connection was refused | Yes | The server never saw it |
| No answer arrived: a timeout, or a connection lost after sending | Only an idempotent request | The server may have done the work |
| 502 Bad Gateway, 504 Gateway Timeout | Only an idempotent request | A gateway may have forwarded the request before it failed |
| 408 Request Timeout | Yes | The server did not receive the whole request, and HTTP lets the client repeat it |
| 429 Too Many Requests, 503 Service Unavailable | Yes, after the wait that `Retry-After` gives, or the backoff | The server declined the request for now |
| 400, 403, 404, 409, 422 | No | The same request gets the same answer, so the game fixes the request or tells the player |
| 401 Unauthorized | No, but the session is refreshed | The request lacked valid credentials |

A 401 means that the request was not applied because its credentials were missing or no longer valid, usually an access token that has expired. The session layer, which chapter 8 describes, refreshes the access token once and sends the request once more, and a second 401 sends the player to sign in again. The one 409 that is retried is the one that a backend following the idempotency draft returns for a key whose first request is still running, which the next section covers.

`Retry-After` gives either a number of seconds or an HTTP date. The policy waits at least that long, and when the wait would end after the operation's deadline, it stops now, since an attempt made after the deadline serves nobody. For `UnityWebRequest`, both of the first two rows are failures without an HTTP answer, and chapter 8 describes how its `result` and `error` report them. A policy that cannot tell whether a failed request left the device treats it as the second row, an unknown outcome.

Retries multiply across layers. Suppose a backend SDK makes up to three attempts inside, the game's policy wraps the SDK's call in three attempts of its own, and the backend's gateway makes up to three attempts at the service behind it. Each layer repeats the whole of the layer below, so one player action that keeps failing reaches the service 3 × 3 × 3 = 27 times. Counted in retries rather than attempts, the figure grows: three retries after a first attempt are four attempts per layer, and 4 × 4 × 4 = 64.

The figure is for one player action, and what it leaves out is when it happens. Layers retry when the service is failing, and during an outage every player's game is retrying at once, so the service receives up to 27 times its load at the moment it can least absorb it. Jitter spreads those attempts in time and does not reduce their number. Three things limit the multiplication:

- One layer retries: the layer that knows the operation, its deadline and its key, which is the game's HTTP layer. The layers below it retry less, or not at all, where their settings allow, and an SDK's documentation says what it does on its own.
- A retry budget caps retries as a share of traffic, such as one retry for every ten first attempts in a sliding minute, and beyond it a failure is returned at once. Retries then help while failures are rare and stop when failures are the norm, which is when they hurt.
- A circuit breaker stops sending to an endpoint for a while after repeated failures. After a run of failures it opens and fails requests at once, without sending them; after a cool-down it lets one trial request through, and closes again if that one succeeds. While it is open, the feature shows its offline state instead of a spinner, and the service gets time to recover.

The policy lives in one place and is set per endpoint, so that no feature carries a loop of its own:

```csharp
// Each endpoint's rules, in one table that the HTTP layer reads; feature code never loops.
public sealed class RetryPolicy
{
    public int MaxAttempts;
    public int AttemptSeconds;
    public int DeadlineSeconds;
    public bool Idempotent; // a GET or a PUT, or a write that carries an idempotency key
}

public static class RetryRules
{
    static readonly Dictionary<string, RetryPolicy> Policies = new Dictionary<string, RetryPolicy>
    {
        ["GET /inventory"] = new RetryPolicy { MaxAttempts = 4, AttemptSeconds = 5, DeadlineSeconds = 20, Idempotent = true },
        ["POST /rewards/claim"] = new RetryPolicy { MaxAttempts = 4, AttemptSeconds = 10, DeadlineSeconds = 30, Idempotent = true },
        ["POST /analytics/events"] = new RetryPolicy { MaxAttempts = 2, AttemptSeconds = 10, DeadlineSeconds = 15, Idempotent = false },
    };

    public static RetryPolicy For(string endpoint) => Policies[endpoint];

    // status is 0 when no HTTP answer arrived; sent is false only when the request never left the device.
    public static bool ShouldRetry(RetryPolicy policy, long status, bool sent)
    {
        if (status == 0)
            return !sent || policy.Idempotent;
        if (status == 408 || status == 429 || status == 503)
            return true;              // after Retry-After, or the backoff
        if (status == 502 || status == 504)
            return policy.Idempotent; // a gateway may have forwarded the request
        return false;                 // a success, or an answer that a retry would repeat
    }
}
```

Exercise: Find every retry loop in a codebase, including those inside SDKs, whose documentation says what each one retries and how often. Then compute the worst-case number of attempts that one player action can make at the backend.

?? network-retry-classes A reward claim, a POST without an idempotency key, fails. After which failure can the policy resend it without risking a second reward?
* The host name did not resolve, so no connection was made
- The attempt timed out after the request had been sent
- The gateway in front of the service answered 504 Gateway Timeout
- The gateway in front of the service answered 502 Bad Gateway
- The connection dropped while the response was arriving
> Only a request that never reached the server is certainly unapplied. A timeout, a lost connection, a 502 and a 504 all leave the outcome unknown, since the server, or the service behind a gateway, may have done the work. An idempotency key would make those retries safe as well.

?+ The backend answers a claim with 422 Unprocessable Content. What does the policy do?
* It stops, since the same request would get the same answer
- It retries with backoff, since a 4xx is often transient
- It refreshes the session, then sends the request once more
- It waits for `Retry-After`, then sends it again
- It resends the request at once on a new connection
> A 422 says that the server understood the request and could not process what it asked for. Nothing about that changes with time, so a retry repeats it, and the game fixes the request or tells the player. A refresh answers 401, and `Retry-After` belongs to 429 and 503.

?+ A request comes back 401 Unauthorized. What does the client do?
* It refreshes the token once, then resends the request once
- It retries with backoff until the operation's deadline passes
- It shows the player a permission error, as it would for a 403
- It resends the request with a new idempotency key, as a new operation
- It signs the player out at once, without trying a refresh first
> A 401 means that the request was not applied because its credentials were missing or no longer valid, usually an expired access token. One refresh and one resend settle that case, and a second 401 sends the player to sign in again. A 403 is different: the credentials were valid and the answer is no.

?+ A request gets 429 with `Retry-After: 120`, and the operation's deadline is 30 seconds away. What does the policy do?
* It stops now, since the server's wait ends after the deadline
- It retries at once, since a 429 means the request was not applied
- It waits 120 seconds, since the server's wait overrides the deadline
- It retries after the backoff's next delay, ignoring the header
- It retries with a new idempotency key, so the server counts it apart
> `Retry-After` tells the client how long to wait before the next request, and the policy waits at least that long. Here the wait would end after the deadline, so the policy ends the operation now and shows its result, rather than ignore the server or make an attempt that nobody is waiting for.

?? network-retry-amplification A backend SDK makes up to three attempts, the game wraps the SDK's call in three attempts, and the gateway makes up to three attempts at the service. How many times can one failing player action reach the service?
* 27, since each layer repeats the attempts of the layer below
- 9, since the three layers' attempts are added together
- 10, a first attempt plus three retries at each layer
- 3, since all three layers retry one and the same request
- 81, since the first attempt counts once more at each layer
> Layers multiply: each of the game's three attempts runs the SDK's three, and each of those runs the gateway's three, so 3 × 3 × 3 = 27 attempts reach the service. The layers do not share a count, so adding them up understates the load.

?+ The same three layers are each set to “retry three times”. What is the worst case at the service?
* 64, since three retries make four attempts at each layer
- 27, since retries and attempts are the same thing
- 12, the four attempts of each layer added together
- 9, the three retries of each layer added together
- 30, twenty-seven attempts plus the three first ones
> Retries follow a first attempt, so three retries are four attempts, and four attempts at each of three layers make 4 × 4 × 4 = 64 at the service. Counting attempts rather than retries avoids the ambiguity, which is why a policy table counts attempts.

?+ What does the worst case of 27 attempts per player action leave out?
* That an outage makes all players' games retry at the same time
- That backoff delays reduce how many attempts are made
- That idempotency keys stop the extra attempts before the service
- That jitter spreads the attempts and so removes the multiplication
- That the gateway's attempts do not count, since they are internal
> The figure is per player action. Layers retry when the service is failing, which is when every player's game is failing too, so the service receives up to 27 times its normal load when it can least absorb it. Delays and jitter change when attempts arrive, not how many, and a key prevents duplicate effects, not attempts.

?+ Which change removes the multiplication, rather than spreading it out or shrinking it?
* Retrying in a single layer, the one that knows the operation
- Adding full jitter to the backoff schedule of each of the layers
- Cutting each layer to two attempts instead of three
- Raising each layer's timeout so that fewer of the attempts fail
- Giving each attempt at each layer an idempotency key of its own
> With one layer retrying, the worst case is that layer's attempt count, 3 instead of 27. Two attempts per layer still multiply, to 8; jitter spreads the attempts in time; longer timeouts keep them open longer; and a new key per attempt turns each one into a new operation.

## Idempotency keys over HTTP {#network-idempotency}

The first book's chapter “Missions, rewards, and feature boundaries” gave each reward claim a stable identity, saved the pending claim with it before sending anything, and had the service record each result under that identity, so that a retry after a lost response got the recorded result instead of a second reward. Over HTTP, the identity travels as an [[idempotency]] key: a value the client creates once for an operation and sends with every attempt of it, which the server uses to recognize the attempts as one.

Its usual carrier is the `Idempotency-Key` request header. The header is defined by an [Internet-Draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) of the IETF's HTTP APIs working group, a proposal rather than a standard, whose repository, read in September 2026, held version 06, from February 2025. Servers that accept a key each document their own rules, and the draft describes the common ground. It recommends a random UUID, a 128-bit identifier, or a similar random value, and it makes the header's value a string in HTTP's structured-field syntax, which is why the key travels in double quotes:

```http
POST /rewards/claim HTTP/1.1
Host: api.example.com
Content-Type: application/json
Idempotency-Key: "5f0c7a52-3d6e-4f3a-9b8e-2a41c7d9e613"

{"missionInstance":"m-2291","tier":2}
```

A backend written before the draft may expect the key without quotes, or in a header with a name of its own, and its documentation decides. A server that follows the draft keeps each key with the result of its request, and answers:

| The server receives | It answers |
| --- | --- |
| A key it has not seen | It processes the request and stores the result under the key |
| The same key and payload, after the first request finished | The stored result, success or error, without processing again |
| The same key while the first request is still running | 409 Conflict, and the client retries later, unchanged |
| The same key with a different payload | 422 Unprocessable Content |
| No key, on an endpoint that requires one | 400 Bad Request |

The client's half comes down to four rules.

The key belongs to one logical operation. It is created once, when the player acts, and every attempt of that operation carries it; a key made per attempt, per screen or per session breaks the link between the attempts. In a .NET test, a fake server committed a write and closed the connection without answering; the retry with the same key got the recorded result and the server applied the write once, while a retry with a new key made the server apply it a second time.

The key is saved before the first send. A key that exists only in memory dies with the process. If the game is killed after sending and before the answer, the claim resent at the next launch needs the key the server may already have seen, so the pending operation, key included, is saved before the first attempt, which is the first book's rule carried over.

The payload is the same every time. A server that follows the draft compares each request's payload with the one stored under its key, and answers 422 when they differ. The client builds the body once, stores it with the key, and resends the stored body; anything that changes from one attempt to the next, such as an attempt number or a send time, goes in a header.

The key's lifetime is shorter than the server's. The draft lets a server expire keys, and asks it to publish its expiry policy; a backend might keep them for a day. Past that window, a resent request is a new operation to the server. So the client resends a pending operation only within the window, and after it asks the server what became of the operation, which the backend's API has to make possible, instead of resending it.

A key is never reused for a different operation. Reused for a second purchase of the same item with in-game coins, where the payload is the same, it returns the first purchase's stored result, and the second purchase silently does nothing; with a different payload, it gets 422. Where the client can name the operation's result itself, the address can carry the identity instead of a header: a `PUT /claims/{claimId}`, with an id the client chose, is idempotent by HTTP's definition of PUT.

```csharp
[Serializable]
public sealed class PendingOperation
{
    public string Key;       // created once, when the player acts
    public string Endpoint;  // such as "POST /rewards/claim"
    public string Body;      // the JSON of the first attempt, resent unchanged
    public long CreatedUtcTicks;
}

public static class Operations
{
    // When the player acts: build the operation once, and save it before anything is sent.
    public static PendingOperation Create(string endpoint, string body) => new PendingOperation
    {
        Key = Guid.NewGuid().ToString(),
        Endpoint = endpoint,
        Body = body,
        CreatedUtcTicks = DateTime.UtcNow.Ticks,
    };

    // Every attempt, including those after a restart, sends the same key and body.
    public static UnityWebRequest CreateAttempt(PendingOperation operation, string url)
    {
        UnityWebRequest request = UnityWebRequest.Post(url, operation.Body, "application/json");
        request.SetRequestHeader("Idempotency-Key", "\"" + operation.Key + "\"");
        return request;
    }
}
```

The feature creates the operation, saves it with the game's other pending records, and hands it to the HTTP layer, which calls `CreateAttempt` for each attempt under the endpoint's policy from the previous section.

Lab exercise: Add an idempotency key to one write in a sample client, and test the lost-response case against a fake server that commits the write and then closes the connection without answering. Check that the retry gets the recorded result and that the server applied the write once. Then give the retry a new key, and watch the second write appear.

?? network-key-persistence The client saves the pending claim, with its idempotency key, before the first send. Which failure does that order protect against?
* The game dies after sending, and the claim is resent at the next launch
- The attempt times out, and the retry follows a few seconds later
- The server rejects the claim with 422, and the player corrects the request
- The player taps twice, and the button sends the claim twice
- The server forgets the key once its retention window has ended
> A key held in memory survives a timeout and a retry within the same session. What it does not survive is the process: a claim resent after a crash with a fresh key is a new claim to the server. Saving the operation, key included, before the first send closes that window.

?+ A retry loop creates a new idempotency key for each attempt. What happens when the first attempt's response is lost after the server applied it?
* The server sees a new operation, and applies the write again
- The server matches the two payloads and treats them as one
- The server answers 422, since the payload arrived under a new key
- The server answers 409 until the first attempt's key expires
- The HTTP stack resends the first attempt with its original key
> The key is how the server recognizes a retry. A new key tells it that this is a new operation, so it applies the write again; in a .NET test, a retry with a new key made a fake server apply a second write. The key belongs to the operation, not to the attempt.

?+ The backend keeps idempotency keys for 24 hours. A claim stays pending on a phone that is offline for three days. What does the client do when it reconnects?
* It asks the server for the claim's state instead of resending it
- It resends the claim with the same key, which the server still knows
- It resends the claim with a new key, since the old one has expired
- It drops the claim, since the server discards claims after a day
- It resends the claim without a key, since an expired key means nothing
> Past the retention window, the server no longer knows the key, so a resent claim would be processed as new, whatever key it carries, even if the first attempt was applied. The client resends only within the window, and after it reconciles by asking the server what became of the claim.

?? network-key-payload A retry rebuilds the claim's body from the game's current state, with a fresh client timestamp, and sends it with the original key. The server answers 422. Why?
* The key came with a payload unlike the one stored under it
- The key expired while the game was rebuilding the body
- The first request under that key is still running
- The key lacks quotes that the rebuilt request left out
- The timestamp is too far from the server's clock
> A server that follows the draft keeps each key with its request's payload and refuses the key with any other payload, since it cannot tell a retry from a different operation. The fix is to store the body with the key and resend it unchanged, with anything that varies per attempt in a header. A request still running would get 409.

?+ A retry of a claim gets 409 Conflict from a server that follows the idempotency draft. What does the client do?
* It waits, then sends the same key and body again, unchanged
- It creates a new key, since the old one is in conflict
- It stops, since a conflict repeats whenever it is retried
- It refreshes the session, as the token is in conflict
- It changes the body so that it no longer conflicts
> Under the draft, 409 means that the first request with this key is still running. The client corrects nothing: it waits and retries with the same key and body, and gets the stored result once the first request finishes. A new key would start a second operation.

?+ A shop helper reuses one idempotency key for every purchase of the same item with in-game coins. What happens on the second purchase?
* The server returns the first purchase's result, and nothing more
- The server answers 422, and the player sees an error message
- The server processes it as usual, since keys matter for retries alone
- The server merges both purchases into one of double quantity
- The server takes the coins twice and grants the item once
> With the same key and the same payload, the server takes the second purchase for a retry of the first and returns the stored result, so the player's second purchase silently does nothing. A key identifies one operation, and a second purchase is a second operation with a key of its own.

?+ Besides the key, what does a server that follows the draft compare to tell a retry from a reused key?
* The request's payload, against the one stored with the key
- The client's IP address, against the first request's
- The time of the request, which must fall within a second
- The correlation id, which must match the first attempt's
- The TLS session, which must be the first connection's
> The draft lets a server fingerprint the payload and keep it with the key: the same key with the same payload is a retry, and with a different payload it is a reused key, answered with 422. A retry may come much later, from another network, on a new connection, so none of the others can be required to match.

## Offline play and reconciliation {#network-offline}

`Application.internetReachability` returns a `NetworkReachability`: `NotReachable`, `ReachableViaCarrierDataNetwork` or `ReachableViaLocalAreaNetwork`. Its values name the kind of route the device has, a carrier's data network or Wi-Fi and cable, and none of them says whether the game's server answers. The platforms draw the same line in their own APIs. On Android, a network with the `INTERNET` capability is one set up to reach the internet, which says nothing about whether it does; `VALIDATED` is the capability the system adds when its own probe finds actual access, and a network behind a captive portal lacks it ([Android's guide to network state](https://developer.android.com/develop/connectivity/network-ops/reading-network-state)). On iOS, a satisfied network path is one on which connections can be made. A route can lead to a hotel's sign-in page, to a network whose DNS does not resolve, or to a server that is down.

So the game uses reachability as a hint: it can put up an offline banner early, or hold back a large download on a carrier network, while the request itself is the only test of whether the server answers.

A captive portal is the page that a hotel, airport or café network shows until the user signs in or accepts its terms. Until then, the network intercepts traffic, forging DNS or HTTP answers so that requests land on its own page. The device keeps its Wi-Fi connection the whole time. Android detects the portal and shows a notification inviting the user to sign in, and until the user does, the network has the `INTERNET` and `CAPTIVE_PORTAL` capabilities and not `VALIDATED`. The IETF's architecture for captive portals notes that interception generally works as intended only for browsers and breaks other applications, such as a game's HTTP client. What the game's requests see depends on the scheme:

- Over HTTPS, the portal cannot answer in the server's name. An intercepted connection fails the [[TLS]] certificate check with a host name mismatch, so the request ends as a connection error, which the game treats as being offline.
- Over plain HTTP, such as a development server's `http://` address in a build that allows it, the portal can answer with its own page, as a 200 with HTML.

Either way, a response is not trusted until it is shown to be the server's: the status is one the endpoint returns, `Content-Type` is the JSON it sends, and the body parses into the response's data type with its required fields present. A body that fails any of those checks counts as a failed attempt, and it must not reach the save, a cache or the player's balance. The same checks catch anything else that answers in the server's place.

Offline behavior is decided for each feature, since each can afford a different loss:

| Feature | Offline | Why |
| --- | --- | --- |
| Purchases | Blocked, with a message that says so | The platform's store and the backend both have to confirm, so nothing can be granted offline |
| Analytics | Queued in a bounded queue that drops the oldest events first | Losing a few events costs little, and filling the device's storage costs more |
| Progress and rewards | Queued as pending operations with idempotency keys, sent in order on reconnection | They must arrive exactly once, and the player sees them as pending until they do |
| Cloud save | Local first, reconciled on reconnection | Play continues offline, and conflicts are settled when both copies can be compared |

When two devices changed the same save while apart, reconnecting finds a conflict, which the game settles in one of three ways. Last writer wins is simple and discards the other device's progress. A merge applies rules the game defines, such as keeping the union of unlocked items and the higher of two best scores; currencies are the exception, since no rule applied to two balances can tell what each device spent, so a server-side ledger owns them. Asking the player shows what each copy holds and lets them choose.

HTTP's conditional requests make the conflict visible instead of silent. The server gives each version of the save an `ETag`, a tag that changes whenever the save does. The client keeps the tag of the version it last downloaded and uploads with `If-Match` set to it. If another device saved in between, the tags differ, and the server answers 412 Precondition Failed instead of overwriting, so the client downloads the newer version and merges it or asks the player. Without `If-Match`, the upload replaces the other device's save: the lost update that conditional requests exist to prevent.

The interface says what the game knows. An operation is pending from the moment it is saved until the server answers, confirmed once the server has applied it, and failed when the server refused it. A write whose deadline passed without an answer stays pending, since the server may have applied it, and reconciliation settles it later. A pending reward shows as pending until the server confirms it, and a failed one says why and what the player can do. These are the first book's pending, confirmed and rejected states, shown to the player.

Exercise: In airplane mode, go through three parts of your game, such as a purchase, a reward claim and a cloud save, and write down what each does and what it should do. Then join a network with a captive portal without signing in, and repeat.

?? network-reachability `Application.internetReachability` returns `ReachableViaLocalAreaNetwork`. What does the game know?
* The device has a Wi-Fi or cable route, nothing about the server
- The game's server answered the last connectivity check
- The device has internet access that the platform has validated
- Requests will succeed unless the game's own server is down
- The network is unmetered, so large downloads are welcome
> The property names the kind of route the device has, a carrier's network or Wi-Fi and cable. A route can end at a captive portal, at a network without working DNS, or at a server that is down, so only the request itself shows whether the server answers.

?+ A game sends a request whenever `internetReachability` is anything other than `NotReachable`. What does that check leave open?
* Whether the route leads to the server, which may still not answer
- Nothing, since the property checks the game's server address
- Whether the device is on a carrier's network or on Wi-Fi
- Whether the device has any route to a network at all
- Nothing, since Unity holds requests until the server answers
> Reachability describes the device's route, not the far end. The route can end at a server that is down, at a network whose DNS does not resolve, or at a sign-in page, so the request can still fail, and whatever comes back still has to be checked.

?+ A native plugin reads Android's `NetworkCapabilities` for the current network. Which capability says that the system found actual internet access?
* `NET_CAPABILITY_VALIDATED`, which the system adds after its probe succeeds
- `NET_CAPABILITY_INTERNET`, which the network gets when it can reach servers
- `NET_CAPABILITY_NOT_METERED`, which marks a network with full access
- `NET_CAPABILITY_TRUSTED`, which the network gets once the probe passes
- `NET_CAPABILITY_NOT_VPN`, which marks a direct route to the internet
> `NET_CAPABILITY_INTERNET` describes how the network is set up, and a network behind a captive portal has it. `NET_CAPABILITY_VALIDATED` is what the system adds when its own probe finds actual access, which is the closest the platform comes to the question, and even a validated network can lose its connection a moment later.

?+ What is `internetReachability` useful for in a game?
* A hint: an early offline banner, or a large download held back
- Deciding whether a purchase request can be trusted to succeed
- Detecting a captive portal before the first request is sent
- Proving to the backend that the device was online at the time
- Choosing how many attempts the retry policy makes for a request
> The property is cheap and immediate, which suits a banner or a choice between networks for a large download. It cannot say whether the server answers, so it gates nothing that depends on the server: a route can end at a server that is down or at a sign-in page.

?? network-captive-portal A player on hotel Wi-Fi has not signed in to its captive portal. The game's requests go to its backend over HTTPS. What does the game see?
* A TLS failure: the portal has no certificate for the game's host
- A 200 with the portal's HTML, which the parser reads as game data
- A 401, since the portal asks the player for credentials
- A 503 with `Retry-After`, until the player signs in
- A normal answer, since HTTPS traffic passes the portal untouched
> A portal intercepts the connection, and an intercepted HTTPS connection fails the certificate check with a host name mismatch. The request ends as a connection error, which the game treats as offline. A cleartext request, by contrast, can get the portal's own page. A portal that drops HTTPS traffic instead produces timeouts, and either way no answer comes from the server.

?+ A development build that allows plain HTTP talks to an `http://` test server over a café's Wi-Fi, whose captive portal the tester has not accepted. What can the build receive?
* The portal's own page, as a 200 with HTML
- A certificate error, since the portal's certificate is wrong
- Nothing at all, since portals intercept HTTPS alone
- The server's answer, held until the tester signs in
- The test server's answer, sent once the portal times out
> Over cleartext HTTP, the portal can answer in anyone's name, and its sign-in page arrives as if the test server had sent it. Unless the build checks the content type and the schema, it may take that page for data, which is why every response is checked before it is used.

?+ Which check stops a captive portal's page from being saved as game data?
* Checking `Content-Type` and parsing the body into its data type
- Checking that the status code is 200 before reading the body
- Checking `internetReachability` before the request is sent
- Checking that the response arrived within the attempt timeout
- Checking the response's `ETag` against the last one received
> A portal's page can arrive with a 200, quickly, on a network that reports a normal route. What it cannot do is look like the endpoint's JSON: a body with the wrong content type, or one that does not parse into the expected type with its required fields, is a failed attempt.

?+ Android shows its sign-in notification for a captive portal. Which capabilities does the network have until the user signs in?
* `INTERNET` and `CAPTIVE_PORTAL`, without `VALIDATED`
- `INTERNET` and `VALIDATED`, without `CAPTIVE_PORTAL`
- None at all, until the user has signed in
- `VALIDATED` alone, since the probe reached the portal
- `CAPTIVE_PORTAL` alone, without `INTERNET`
> The network is set up for the internet, so it has `INTERNET`, and the probe found a portal, so it has `CAPTIVE_PORTAL`. It lacks `VALIDATED` until the user signs in, when it gains `VALIDATED` and loses `CAPTIVE_PORTAL`.

## Trace a request: ids, logs, and privacy {#network-observability}

When a player reports that a reward never arrived, support needs the request's story from both sides: what the game sent, and what the server did with it. A correlation id joins the two. The client creates it when the operation starts, sends it as a header with every attempt, and writes it into every log line about the operation, and the server logs it with its own lines. Searching either side's logs for the id then finds the other side's.

The client creates the id because the cases that need it most are those in which no answer arrived. A timed-out claim has no server-assigned id in the client's logs, while the id the client sent is in the server's logs if the request got there, beside the record of whether it was applied. The header's name is the team's choice, such as `X-Request-Id`; for distributed tracing, the W3C Trace Context specification defines a `traceparent` header that tracing systems read. One id per operation, the same on every attempt, with the attempt number logged beside it, lets the server's logs show attempts 1, 2 and 3 of one operation rather than three unrelated requests.

Each line carries the build's identity, meaning the app version, the build number and the platform, and the versions of the SDKs involved, so that an error rate can be split by build, and a regression found in the build that introduced it. The lines are structured: fields rather than sentences, so that a query can count by any of them.

```json
{"event": "http_result", "operation": "reward_claim", "correlationId": "0b7e41c2-5a9d-4c3e-8f21-6d0a9e7b3c54",
 "attempt": 2, "endpoint": "POST /rewards/claim", "status": 504, "category": "gateway_timeout",
 "ms": 10012, "build": "2.14.0 (4211)", "platform": "Android", "sdks": {"analytics": "7.3.1"}}
```

The error categories are the classes of the retry section: never sent, no answer, declined for now, refused, and a body that failed its checks. Aggregated per endpoint and client version, the lines give the latency percentiles and error rates that set the timeouts of the first section, and show which build started a rise.

Some things are never logged in production. An access token in a log is a session that anyone who reads the log can use until it expires, and a refresh token is a longer one. Personal data, such as an email address, a name or a precise location, puts the log under the rules for personal data, and whole payloads carry both. [OWASP's logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) lists session identifiers, access tokens and sensitive personal data among what is removed, masked, hashed or encrypted before anything is logged. On Android, the device's log is a shared resource that apps holding the `READ_LOGS` permission can read, and Android's security guidance asks apps to limit logging in production; [[Logcat]] is where a Unity game's `Debug.Log` output goes.

Redaction belongs in one place, the HTTP layer's logger, and works from an allowlist: the logger writes the headers and fields that are named as safe, and drops the rest, so a new field stays out until someone decides it is safe. A denylist of known secrets leaks the first secret that nobody listed. High-volume events are sampled, keeping every failure and a fraction of the successes, such as one in a hundred, with the rate logged so that counts can be scaled back up.

Exercise: Design the client's and the server's log lines for one request so that they can be joined, and check that neither holds a token or a personal field.

?? network-correlation-id Why does the client, rather than the server, create a request's correlation id?
* A request with no answer still has an id in the client's logs
- The server would be too slow to generate unique ids at scale
- It saves the server a database write for each request it handles
- It lets the client choose which requests the server logs
- The platform's store requires an id generated by the app
> The requests that support most needs to trace are those whose answer never arrived. A server-assigned id would exist only on the server, while the id the client sent is in both sets of logs, and shows whether the request arrived and what became of it.

?+ A claim is attempted three times. Which correlation ids should the attempts carry?
* One id for the operation, and the attempt number logged beside it
- A new id for each attempt, so that the server logs them apart
- The hash of the session token, so that support can find the player
- The device's identifier, which stays the same across operations
- No id on the retries, since the first attempt already carried it
> One id per operation lets the server's logs show attempts 1, 2 and 3 of the same claim, and the attempt number tells them apart. A new id per attempt splits the story into unrelated requests, and ids built from tokens or device identifiers put sensitive values in every line.

?+ Support has the correlation id of a claim that timed out on the client. What can the server's logs tell them?
* Whether the request arrived, and whether the claim was applied
- Why the client's attempt timeout was set to the value that it had
- The player's device model, which the id encodes in its digits
- Nothing, since the client gave up before the server logged it
- The network the player was on, read from the prefix of the id
> A timeout on the client says nothing about the server, which may have received and applied the claim. The id the client sent is in the server's lines if the request arrived, beside what the server did with it, which is the question support needs answered.

?? network-log-redaction Which of these belongs in a production log line for a failed request?
* The endpoint, status, error category and correlation id
- The `Authorization` header, to diagnose problems with tokens
- The whole response body, to show exactly what the server said
- The player's email address, to find their account quickly
- The request body, so that the request can be replayed later
> The endpoint, the status, the category and the id say what failed and join the line to the server's, without carrying anything a reader could misuse. A token in a log is a session anyone can use, and bodies and email addresses bring personal data into the log.

?+ Why does the HTTP layer's logger use an allowlist of fields rather than a denylist?
* A new field stays out until someone decides it is safe to log
- An allowlist is faster to evaluate than a denylist on a device
- Unity's logger refuses fields that have not been declared
- A denylist is unable to match header names that differ in case
- An allowlist lets the server decide what the client logs
> With a denylist, every field that nobody thought to list is logged, so the first new secret leaks. An allowlist fails the other way: an unlisted field is dropped, and someone adds it once they have decided it is safe to keep.

?+ A client logs one line per successful request, and those lines dominate the backend's log volume. What is the fix?
* Sample the successes, keep all failures, and log the rate
- Drop the correlation ids, to make each of the lines shorter
- Log on Android alone, where writing to the device's log costs less
- Batch each session's lines into one payload and log it whole
- Raise the log level so that nothing is written in production
> Successes are many and alike, so a fraction of them shows the same latency and volume, once the logged rate scales the counts back up. Failures are few and each one matters, so all of them are kept. Turning logging off loses the failures along with the noise.

?+ What makes an access token in a log dangerous?
* Anyone who reads the log can act as the player until it expires
- It makes each line too long for the backend's log parser to read
- It breaks the format of the correlation id beside it
- It invalidates the token on the server once it is logged
- It is a problem when the token is a refresh token, and not otherwise
> An access token is proof of a session, and whoever holds it can call the backend as the player until it expires. Logs are copied, shipped and read by many people and tools, so a token in one is a session handed to all of them.
