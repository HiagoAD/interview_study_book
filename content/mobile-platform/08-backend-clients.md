---
book: unity-mobile-platform-engineering
chapter: 08: Backend clients: HTTP, sessions, and data contracts
---

## HTTP semantics a game client relies on {#http-semantics}

The last link of the call path is the game's own backend, and the client reaches it over HTTP. Whichever library sends the bytes, what the client may do after each exchange is decided by HTTP's semantics, which [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines: whether a request can be sent twice, what each status code says about the server's state, and which headers carry what a retry, a token refresh or a cache needs. A client that reads those rules can decide on its own what to do next. One that treats each failure alike either repeats what must not be repeated or gives up on what would have worked a second later.

Methods come first. RFC 9110 calls a method safe when its meaning is essentially read-only, so that the client neither asks for nor expects a change on the server; GET and HEAD are safe. It calls a method [[idempotent]] when several identical requests have the same intended effect as one, and it names PUT, DELETE and the safe methods. POST is neither. The difference matters at the worst moment, when a request went out and no answer came back. The RFC says that an idempotent request can be repeated after such a communication failure, and that a client should not repeat a request with a non-idempotent method unless it knows the request is idempotent by design or that the first one was never applied. For a game's endpoints, that reads:

| Request | Method and path | Sent twice |
| --- | --- | --- |
| Read the player's profile | `GET /v1/players/me` | Harmless: nothing changes |
| Replace the player's settings | `PUT /v1/players/me/settings` | Harmless: the second request writes the same settings |
| Remove a device's push registration | `DELETE /v1/devices/{id}` | Harmless: the device stays removed |
| Claim the daily reward | `POST /v1/rewards/daily/claim` | Two claims, unless the server recognizes the second |

A server can make a POST harmless to repeat by recognizing a repeat, usually through a key the client sends with it. That is idempotence carried over HTTP, and chapter 9 builds it.

A response's status says what happened on the server, and the client's reaction follows from it:

| Status | What the server says | What the client does |
| --- | --- | --- |
| 200 OK, 201 Created | The request succeeded; 201 adds that it created a resource | Reads the body |
| 204 No Content | It succeeded, and there is nothing to send back | Reads nothing: a 204 carries no content |
| 304 Not Modified | The copy the client holds is still current | Uses its stored copy |
| 400 Bad Request | The request is malformed | Reports a defect: the same bytes get the same answer |
| 401 Unauthorized | The request lacks valid credentials | Refreshes its access token once, and retries once |
| 403 Forbidden | The server understood the request and refuses it | Tells the player, without refreshing anything |
| 404 Not Found | Nothing current exists at that address, or the server will not say | Treats the resource as absent, or the path as a defect |
| 409 Conflict | The request conflicts with the resource's current state | Reloads that state, then decides |
| 412 Precondition Failed | A condition the client attached, such as `If-Match`, was false | Reloads and merges before writing again |
| 422 Unprocessable Content | The syntax is right, and the server cannot act on the content | Shows the reason, such as a value outside the allowed range |
| 429 Too Many Requests | The client has sent too many requests | Waits as long as `Retry-After` says |
| 500 Internal Server Error | The server failed unexpectedly | Retries later, if the request is harmless to repeat |
| 502, 503, 504 | A gateway got a bad answer or none, or the service is unavailable | Retries later with the same caution; a 503 may carry `Retry-After` |

Two cases in that list need more than the table says. The first is 401 against 403, which look alike and ask for opposite reactions. A 401 says the request was not applied because it lacked valid credentials, and the server has to send a `WWW-Authenticate` header with it. For the bearer tokens a game's session uses, [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html) names the error `invalid_token` for an access token that expired, was revoked or is malformed, and says the client may obtain a new access token and retry. A 403 says the server understood the request and refuses to carry it out. If the request carried credentials, the server judged them insufficient, and RFC 9110 says the client should not repeat the request with the same ones; RFC 6750's `insufficient_scope` comes with a 403. So a 401 calls for a refresh and a 403 does not. A refreshed token belongs to the same player and carries the same permissions, and a client that refreshes on each 403 loops. A 403 is a state of the product: the account is suspended, the feature is closed in the player's region, the item belongs to someone else.

The second case is not in the table at all: no response. It happens when a request times out, when a connection drops, or when the game goes to the background mid-request, and the client does not know whether the server never received the request, failed while handling it, or applied it and sent an answer that was lost on the way. For a GET the uncertainty costs nothing, and the client asks again. For a POST it is the unknown outcome of [[#platform-results-threads]], and the next step is to find out rather than to guess: read the state the request would have changed, or repeat it with the same idempotency key, which chapter 9 covers. A request can even fail after the server has answered. In a Unity 6.3 test for this chapter, a request whose timeout fired while the response body was still arriving ended as a connection error with status 200: the server had received the request and started a successful answer, and the client had half of it.

An installed client also meets status codes it has never seen. RFC 9110 requires a client to understand the class of any status, its first digit, and to treat a code it does not recognize as the x00 code of that class, so a client written before its server started sending 451 treats it as a 400. A mapping that falls back by class stays correct for codes the server has not started sending yet:

```csharp
// Game-owned: what an answered request means for the code that sent it.
public enum HttpOutcome
{
    Ok,              // 200, 201, 204: use the body, if there is one
    NotModified,     // 304: the stored copy is current
    SignInRequired,  // 401, after the session layer's one refresh and one retry
    Refused,         // 403: tell the player; a refresh changes nothing
    NotFound,        // 404
    Conflict,        // 409, 412: reload, then merge or ask
    Rejected,        // 400, 422: the request is wrong, and resending it changes nothing
    RateLimited,     // 429: wait as long as Retry-After says
    ServerError,     // 5xx: retry later, if the request is harmless to repeat
    Unknown,         // anything else
}

public static class HttpStatusMapping
{
    public static HttpOutcome ToOutcome(int status) => status switch
    {
        200 or 201 or 204 => HttpOutcome.Ok,
        304 => HttpOutcome.NotModified,
        401 => HttpOutcome.SignInRequired,
        403 => HttpOutcome.Refused,
        404 => HttpOutcome.NotFound,
        409 or 412 => HttpOutcome.Conflict,
        400 or 422 => HttpOutcome.Rejected,
        429 => HttpOutcome.RateLimited,
        // RFC 9110: a code the client does not recognize counts as the x00 code of its class.
        _ => (status / 100) switch
        {
            2 => HttpOutcome.Ok,
            4 => HttpOutcome.Rejected,
            5 => HttpOutcome.ServerError,
            _ => HttpOutcome.Unknown,
        },
    };
}
```

No response has no status, so it has no place in that mapping; the transport reports it separately, as the next section shows.

Headers carry the rest. `Content-Type` says what the body is, `application/json` for most game APIs, and `Accept` says which media types the client wants back. `Authorization` carries the credentials, here the word `Bearer` and the access token. `Retry-After`, on a 429 or a 503, holds either a number of seconds or a date, and the client waits at least that long before it tries again. `ETag` holds an entity tag, an opaque label for the version of the resource that the response describes, and two request headers put it to work:

- `If-None-Match` with the tag makes a GET conditional. When the resource has not changed, the server answers 304 with no body, and the client uses the copy it stored under that tag. A store catalog or a remote configuration that changes once a week then costs a few hundred bytes at each launch instead of its whole size.
- `If-Match` with the tag makes a write conditional. The server applies the PUT while the resource still has that tag, and answers 412 once it has changed. RFC 9110 names the problem this prevents, the lost update, in which one client overwrites the work of another that was acting in parallel. A cloud save written from a phone and a tablet is that case exactly, and `If-Match` turns the second write into a 412 that the game resolves, by merging or by asking the player, instead of a silent loss.

Exercise: List the status codes that each endpoint your game calls can return, and write down the client's reaction to each, including its reaction to no response at all.

?? http-401-403 A request made with an unexpired access token comes back 403. What should the client do?
* Treat the request as refused, tell the player why, and keep the token as it is
- Refresh the access token, then send the same request again with the new token
- Sign the player out, since a 403 means that the session is no longer valid
- Send the request again after a short delay, in case the refusal was temporary
> A 403 means the server understood the request and refuses it; when credentials came with it, the server judged them insufficient, and HTTP says the client should not repeat the request with the same ones. A refreshed token belongs to the same player and carries the same permissions, so a refresh changes nothing, and a client that refreshes on each 403 loops. The refusal is a state of the product, such as a suspended account or a closed feature, and the game shows it.

?+ A request comes back 401, and its `WWW-Authenticate` header carries `error="invalid_token"`. What does the client do?
* Refresh the access token once, then send the request once more
- Tell the player that this action is not allowed for their account
- Send the same request again with the same token after a short wait
- Sign the player out at once and return to the title screen
> A 401 means the request was not applied because it lacked valid credentials, and the bearer token error `invalid_token` covers an access token that expired, was revoked or is malformed. The client can get a new access token with its refresh token and retry. Repeating the request with the same token gets the same answer, and signing out throws away a session that one refresh would have restored.

?+ A refresh succeeds, and the retried request comes back 401 again. What should the client do next?
* Stop retrying and treat the session as over, so that the player signs in again
- Refresh the token again, and keep retrying until one of the requests succeeds
- Treat the 401 as a 403, and tell the player that the action was refused
- Ignore the 401, and send the next request with the same new token
> The rule is one refresh and one retry for each request. A second 401 with a token the server has just issued means that a refresh does not restore this session, whether it was revoked or the account itself is rejected, and refreshing again loops. Showing it as a refusal hides a sign-in problem behind a message about permissions.

?? http-unknown-outcome A POST that claims the daily reward times out, and no response arrives. What does the client know about the claim?
* Nothing yet: the server may have applied it, failed, or not received it at all
- That it failed, since a server discards a request whose client stopped waiting
- That it succeeded, since a server applies a request before it starts to answer
- That it did not arrive, since a timeout means the connection was not made
> Without a response, the client cannot tell a request that never arrived from one that was applied and whose answer was lost. It records the outcome as unknown and finds out: it reads the state the claim would have changed, or repeats the claim with the same idempotency key, so that the server can recognize the repeat. Treating the timeout as a failure invites a second claim, and treating it as a success can show a reward that was never granted.

?+ Why may a client repeat a PUT after a connection failure, but not a POST?
* The PUT is idempotent: two identical requests have the effect of one
- The PUT is safe: it asks the server to change nothing on its side
- The PUT is answered from a cache, so a repeat reaches no server
- The POST would be refused by HTTP itself on a repeat, with a 409
> RFC 9110 defines PUT, DELETE and the safe methods as idempotent, and says that such a request can be repeated after a communication failure. A PUT is not safe, since it changes the resource, but it replaces it with the same content each time. A POST has no such property, so a client repeats it when the server has made it idempotent, for example with a key, and HTTP itself refuses nothing on a repeat.

?+ A request's timeout fires while the response body is still arriving, and UnityWebRequest reports a connection error with status 200. What happened on the server?
* It received the request and began a successful answer before the transfer broke off
- It did not see the request, since a connection error happens before anything is sent
- It rejected the request, and Unity reports that rejection as a status of 200
- Nothing yet, since a server acts on a request after its answer is fully sent
> The status comes from the first line of the response, which had arrived, so the server had received the request and was answering it with success; the transfer then stopped before the body was complete. A connection error therefore does not mean that nothing happened on the server. For a request that changes state, the client knows less than the server does and finds out before it acts.

?+ A claim request got no response. What should happen before the game shows the player any result?
* The client reads the state the claim would change, or repeats it with the same key
- The game shows that the claim failed, and lets the player press the button again
- The game shows the reward as granted, and corrects it at the next launch if it was not
- The client sends the claim again as a new request, since the first one was lost
> The outcome is unknown, so the game finds out instead of guessing. Reading the player's state shows whether the claim was applied, and a repeat that carries the same idempotency key lets the server recognize it and answer without granting twice. A new request, or a second press of the button, can claim twice, and a result shown before anything is known is right by luck.

## UnityWebRequest and HttpClient in a Unity client {#http-unity-clients}

A Unity game has two HTTP clients to choose from. `UnityWebRequest` is Unity's own, available on each platform Unity builds for, and it is the client Unity's documentation and most of Unity's packages use. `HttpClient` is .NET's, from the class libraries that ship with the scripting runtime. Both can talk to a game's backend, and they differ in threads, in cancellation, and in what stands between them and the network.

`UnityWebRequest` belongs to the main thread. The transfer itself runs elsewhere, but the object is created, started and read on the main thread. In a test with Unity 6.3, creating one on a worker thread threw a `UnityException` saying that `Create` can only be called from the main thread, and reading `result` from a worker thread after the request had finished failed the same way for `get_result`. `SendWebRequest` starts the transfer, once per object, since a second call throws, and returns an asynchronous operation. A coroutine yields on it, and in Unity 6.3 `await` works on it too: an extension method that the reference leaves out turns any `AsyncOperation` into an `Awaitable`, and each awaiting method in the tests resumed on the main thread. `Awaitable.FromAsyncOperation` does the same and takes a cancellation token, and cancelling that token aborted the request itself, not only the wait.

When the transfer ends, `result` says how it ended, and it is read before `responseCode`:

| `result` | What it means | Seen in this chapter's tests, in the Editor |
| --- | --- | --- |
| `Success` | The request succeeded | 200, 204, and a 304 with an empty body |
| `ProtocolError` | The server answered with an error status | 401, 404, 500 and 503, each with its status and error body readable |
| `ConnectionError` | The exchange with the server did not complete | A refused connection, an unknown host, a timeout, an abort, an unrecognized content encoding |
| `DataProcessingError` | The server answered, and the data could not be processed | A JSON body given to a texture's download handler |

Three details in the table decide how an adapter reads it. A 304 is a `Success` with no body, so a client that sends `If-None-Match` uses its stored copy rather than parse an empty string. A `ProtocolError` carries the server's error body in `downloadHandler.text`, which is where a backend explains a 409 or a 422. And `responseCode` is not the verdict. The connection error in the previous section came with status 200, because the timeout fired while the body was arriving, and an adapter that checked for 200 alone would have taken half a response for a whole one.

`timeout` is a number of seconds, and 0, the default, sets no limit. [Unity's reference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Networking.UnityWebRequest-timeout.html) describes it as the time after which the request is aborted if no response has been received, and the error then reads “Request timeout”. In the Editor, Unity 6.3 applied it to the whole transfer: a body that arrived ten bytes a second was cut off at two seconds with `timeout` set to 2. On iOS, the Trampoline's request code hands the same number to the `timeoutInterval` of an `NSURLRequest`, which [Apple defines](https://developer.apple.com/documentation/foundation/nsurlrequest/timeoutinterval) as how long the request may stay idle. The property is then a guard against a stalled request rather than a deadline, and it may not bound the same interval on each platform; the game measures its deadlines itself, as chapter 9 shows.

`Abort` stops a request at any point. In the tests, its result became a `ConnectionError` whose error read “Request aborted”, and an `await` on the aborted request threw an `OperationCanceledException`. `Dispose` releases the request's native resources, and [the reference for `Dispose`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Networking.UnityWebRequest.Dispose.html) says to call it once the request is finished with, whether it succeeded or failed, in a `using` statement so that an exception cannot skip it. A request that is never disposed is not leaked for good: its finalizer, read in the module's IL, disposes its handlers and destroys the native request. That happens when the garbage collector gets to it, though, and a game that polls every few seconds accumulates native requests between collections. Disposing also destroys the download handler, since `disposeDownloadHandlerOnDispose` defaults to true, and in the tests, reading `downloadHandler.text` after the `using` block threw a `NullReferenceException` saying that the handler had already been destroyed. Copy the text or the bytes out inside the block.

`CertificateHandler` is where [[certificate pinning]] goes. Unity calls its `ValidateCertificate` with each leaf certificate the server presents, and the request continues if it returns true; [Unity's reference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Networking.CertificateHandler.html) lists Android, iOS and desktop platforms among those where custom validation is implemented. Pinning is a promise that installed clients keep. A client pinned to a key that the backend later retires stops connecting until it updates, so teams pin more than one key, one of them a backup that is not yet in use, and plan the rotation before the first release that pins.

`HttpClient` works another way. It is not tied to the main thread, its methods take a `CancellationToken`, and one instance is meant to serve many requests: [Microsoft's guidelines](https://learn.microsoft.com/en-us/dotnet/fundamentals/networking/http/httpclient-guidelines) say to reuse instances for as many requests as possible, so as not to exhaust ports. Its `Timeout` defaults to 100 seconds, and a timeout arrives as a `TaskCanceledException`, the same type that the caller's own cancellation raises, so code that must tell them apart checks the caller's token. An `await` that starts on the main thread resumes there, through Unity's synchronization context, and `ConfigureAwait(false)` gives that up, after which the rest of the method runs on a worker thread and Unity's main-thread APIs are out of reach.

Two facts about `HttpClient` in Unity come from Unity's class libraries. The first is that the Editor and a device do not run the same code under it. In the Unity 6.3 Editor, `HttpClientHandler` hands requests to `SocketsHttpHandler`, while in the class libraries that [[IL2CPP]] builds use, for Android and iOS alike, it creates a `MonoWebRequestHandler`, built on the older `HttpWebRequest`, so a test in the Editor exercises other code than a phone runs. The second is that neither handler is the platform's HTTP stack, so the rules that stand in front of `UnityWebRequest` do not reach it:

- Unity's “Allow downloads over HTTP” setting is a check inside `UnityWebRequest`. In the Editor, with the setting at its default, `NotAllowed`, `UnityWebRequest` refused a plain HTTP address on the local network with an `InvalidOperationException` reading “Insecure connection not allowed”, and `HttpClient` fetched the same address.
- [[App Transport Security]] governs the URL Loading System, and [Apple's page on insecure connections](https://developer.apple.com/documentation/security/preventing-insecure-network-connections) says that it does not apply to lower-level networking interfaces.
- Android honors its cleartext setting on a best-effort basis, and [Android's reference](https://developer.android.com/guide/topics/manifest/application-element) says the Socket API is not expected to honor it.

A game that uses `HttpClient` therefore enforces HTTPS itself, in the one place that builds its URLs.

The same Editor test explains how plain HTTP can work in the Editor and fail on a phone. With the setting at `NotAllowed`, the check let `127.0.0.1` and `localhost` through and refused the machine's network address. A development server on the developer's own machine is reachable at `localhost` from the Editor, and a phone has to use the network address, which the check refuses. [[#xcode-build-settings]] covers the setting's other values and what each one writes into the iOS and Android projects. On Android, Unity's player sends `UnityWebRequest` through libcurl, compiled into `libunity.so`, and neither that library nor Unity's Java classes refers to Android's cleartext policy; whether the policy stops it on a device was not tested for this book.

Whichever client the game uses, it sits behind an interface the game owns, like any platform capability in [[#platform-interfaces]]. The rest of the client, the session layer included, sees requests and responses in its own types, and tests use a fake transport:

```csharp
// Game-owned: a request as the rest of the client describes it.
public sealed class ApiRequest
{
    public string Method { get; }
    public string Path { get; }
    public string JsonBody { get; }
    public IReadOnlyDictionary<string, string> Headers { get; }

    public ApiRequest(string method, string path, string jsonBody = null,
        IReadOnlyDictionary<string, string> headers = null)
    {
        Method = method;
        Path = path;
        JsonBody = jsonBody;
        Headers = headers ?? new Dictionary<string, string>();
    }

    public ApiRequest WithHeader(string name, string value)
    {
        var headers = new Dictionary<string, string>();
        foreach (var header in Headers) headers[header.Key] = header.Value;
        headers[name] = value;
        return new ApiRequest(Method, Path, JsonBody, headers);
    }
}

// Game-owned: what came back. Status 0 means no response the game can act on.
public sealed class ApiResponse
{
    public int Status { get; }
    public string Body { get; }
    public string RetryAfter { get; }
    public string ETag { get; }
    public string Date { get; }
    public string Error { get; }

    private ApiResponse(int status, string body, string retryAfter, string etag, string date, string error)
    {
        Status = status;
        Body = body;
        RetryAfter = retryAfter;
        ETag = etag;
        Date = date;
        Error = error;
    }

    public static ApiResponse Answered(int status, string body, string retryAfter, string etag, string date) =>
        new ApiResponse(status, body, retryAfter, etag, date, null);

    public static ApiResponse NoResponse(string error) =>
        new ApiResponse(0, null, null, null, null, error);
}

public interface IHttpTransport
{
    /// Completes on the main thread. Error statuses and network failures come back
    /// as responses, not exceptions; the caller's cancellation throws.
    Task<ApiResponse> SendAsync(ApiRequest request, CancellationToken cancel);
}

public sealed class UnityWebRequestTransport : IHttpTransport
{
    private readonly string baseUrl;   // https, from the environment's configuration
    private readonly int stallSeconds; // a guard against a stalled request, not a deadline

    public UnityWebRequestTransport(string baseUrl, int stallSeconds)
    {
        this.baseUrl = baseUrl;
        this.stallSeconds = stallSeconds;
    }

    public async Task<ApiResponse> SendAsync(ApiRequest request, CancellationToken cancel)
    {
        using var web = new UnityWebRequest(baseUrl + request.Path, request.Method);
        web.downloadHandler = new DownloadHandlerBuffer();
        if (request.JsonBody != null)
        {
            web.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(request.JsonBody));
            web.SetRequestHeader("Content-Type", "application/json");
        }
        web.SetRequestHeader("Accept", "application/json");
        // Who is calling, for the server's decisions and counts; the last section explains.
        web.SetRequestHeader("X-Client-Version", Application.version);
        web.SetRequestHeader("X-Client-Platform", Application.platform.ToString());
        foreach (var header in request.Headers) web.SetRequestHeader(header.Key, header.Value);
        web.timeout = stallSeconds;

        try
        {
            // Cancelling the token aborts the request, and the await throws.
            await Awaitable.FromAsyncOperation(web.SendWebRequest(), cancel);
        }
        catch (OperationCanceledException) when (!cancel.IsCancellationRequested)
        {
            // Aborted by something other than this caller: the result below says so.
        }

        return web.result switch
        {
            // The server answered. Copy what is needed before the using block ends.
            UnityWebRequest.Result.Success or UnityWebRequest.Result.ProtocolError =>
                ApiResponse.Answered((int)web.responseCode, web.downloadHandler.text,
                    web.GetResponseHeader("Retry-After"), web.GetResponseHeader("ETag"),
                    web.GetResponseHeader("Date")),
            // ConnectionError or DataProcessingError: nothing to act on, even when
            // responseCode holds a status.
            _ => ApiResponse.NoResponse(web.error),
        };
    }
}

// For Edit Mode tests: answers from a script, and records what was sent.
public sealed class FakeTransport : IHttpTransport
{
    private readonly Queue<ApiResponse> answers = new Queue<ApiResponse>();
    public List<ApiRequest> Sent { get; } = new List<ApiRequest>();

    public void Answer(ApiResponse response) => answers.Enqueue(response);

    public Task<ApiResponse> SendAsync(ApiRequest request, CancellationToken cancel)
    {
        cancel.ThrowIfCancellationRequested();
        Sent.Add(request);
        return Task.FromResult(answers.Dequeue());
    }
}
```

The adapter decides the one question every later layer depends on: did the server answer? A `ProtocolError` is an answer, with a status the caller maps through `HttpStatusMapping`. A `ConnectionError` is not, even with a status set, and neither is a `DataProcessingError`, whose data the game could not read. The fake lets an [[Edit Mode tests|Edit Mode test]] script a 401 followed by a 200, or no response at all, and check what the session layer of the next section does with them, with no server and no network.

Lab exercise: Wrap one request of your game in a function that returns a game-owned result for each `result` value and for a timeout. Test the timeout against a local server that waits before it answers, and a second time against one that sends its body slowly.

?? http-request-result A POST that grants a reward finishes with `ConnectionError`. What does that mean for a retry?
* The server may have applied it, so the client checks first or repeats it with its key
- The request did not reach the server, so sending it again as a new request is harmless
- The server refused it, so the client shows the error and does not send it again
- Unity retried it already, so the client waits for the result of that second attempt
> A connection error covers each way the exchange can fail to complete: a refused connection, a timeout, an abort, or a transfer cut off after the server answered. Some of those happen before the server sees anything and some after it has acted, and the result does not say which. For a request that changes state, the outcome stays unknown until the client reads the state or repeats the request with an idempotency key the server recognizes.

?+ A request finishes with `ProtocolError` and status 400. Should the client retry it?
* No: the server answered and rejected it, and the same bytes get the same answer
- Yes: a protocol error means the connection broke before the server could answer
- Yes, after a delay, since the server may accept the request once it is less busy
- No: a protocol error means the outcome is unknown, so it may already be applied
> A protocol error means that the exchange completed and the server answered with an error status. A 400 says that the request itself is malformed, so repeating it unchanged gets the same 400, and it is a defect to report. Whether a protocol error is worth a retry depends on its status: a 429 or a 503 is where waiting helps.

?+ A request finishes with `ConnectionError`, and its `responseCode` is 200. How can that be?
* The response had begun to arrive when a timeout or an error cut the transfer short
- The server sent a 200 with an error in its body, which Unity reports as a connection error
- The request was answered from Unity's cache, so no connection to the server was opened
- Unity sets each request's status to 200 until a response replaces it
> The status comes from the first line of the response, which had arrived; the result reflects that the transfer did not finish, for example because the request's timeout fired while the body was still downloading. That is why an adapter reads `result` before `responseCode`: a check for 200 alone takes half a body for a complete answer.

?+ A catalog request sent with `If-None-Match` finishes with `Success`, status 304 and an empty body. What does the client do?
* Keeps the catalog it stored with that tag, since the server says it is current
- Treats the empty body as an error, since a successful request carries a catalog
- Parses the empty body as an empty catalog, and shows the player no items
- Sends the request again without `If-None-Match` to get the full catalog back
> A 304 answers a conditional GET: the resource has not changed since the version whose tag the client sent, so its stored copy is current, and the response has no body. Unity reports it as `Success`, so an adapter that parses the body whenever the result is a success turns a saving into an empty catalog.

?+ `HttpClient` throws a `TaskCanceledException`. How does the adapter tell a timeout from the caller's own cancellation?
* It checks the caller's token: if it was not cancelled, the timeout fired
- It reads the exception's message, which names the timeout that was exceeded
- It treats both as the caller's cancellation, since the two are reported alike
- It reads the status of the response, which is 408 when a request times out
> `HttpClient` implements its timeout by cancelling the request, so a timeout and a cancellation arrive as the same exception type. The caller's token is what the adapter knows for certain: if it was cancelled, the caller stopped waiting; if not, the timeout fired, which is a request with no response and an unknown outcome. A request that timed out has no status to read.

?? http-request-dispose A helper returns `request.downloadHandler` from inside a `using` block, and its caller then reads `.text`. What happens?
* The read throws, since disposing the request destroyed its download handler
- The read works, since the handler's data lives until the garbage collector runs
- The read returns an empty string, since disposing clears the downloaded bytes
- The read works, since the request disposes its upload handler and not this one
> Disposing a `UnityWebRequest` also disposes its download handler, because `disposeDownloadHandlerOnDispose` defaults to true; in Unity 6.3 the later read threw a `NullReferenceException` saying the handler had already been destroyed. The fix is to copy the text or the bytes out inside the `using` block, or to set that property to false and dispose the handler where it is last used.

?+ A game polls its backend every five seconds with a new `UnityWebRequest` and disposes none of them. What happens?
* Each request holds its native resources until the garbage collector finalizes it
- Nothing, since Unity disposes each request once its result has been read
- The polls fail after the first, since Unity allows one undisposed request at a time
- The connections stay open for good, and pile up until the app is restarted
> Unity's reference says to call `Dispose` once a request is finished with, whether it succeeded or failed. An undisposed request is released by its finalizer, which runs when the garbage collector collects the object, so native memory and handles build up between collections instead of being returned at once. A `using` statement returns them as each request ends, including when an exception leaves the block.

?+ Which way of sending a request disposes it on each path, including an exception thrown while the response is read?
* A `using` statement around the request, with the body copied out inside it
- A call to `Dispose` on the line after the one that reads the response's text
- A call to `Abort` in the method's `finally` block, once the request has ended
- A `using` statement around the download handler, created before the request
> A `using` statement calls `Dispose` when the block ends, however it ends, so an exception while the body is parsed still releases the request. A `Dispose` call written after the read is skipped when the read throws. `Abort` stops a transfer and releases nothing, and disposing the handler alone leaves the request to its finalizer.

?+ When does disposing a `UnityWebRequest` leave its download handler readable?
* When `disposeDownloadHandlerOnDispose` is false, and the code that keeps the handler disposes it
- When the request finished with `Success`, since Unity keeps a successful response's handler
- When the handler is a `DownloadHandlerBuffer`, whose data lives in managed memory
- When the request is disposed on the main thread, where handlers last until the next frame
> The property defaults to true, and then the handler goes with the request. Setting it to false before disposing hands the handler's lifetime to the code that keeps it, which reads it and then disposes it; in Unity 6.3 the handler's text was still readable after its request was disposed. The request's result and the handler's type make no difference.

## Sessions and tokens {#http-sessions}

Chapter 4's sign-in ends with a credential: a platform's identity token, or an authorization code with the verifier that goes with it ([[#os-auth-callbacks]]). The game's backend checks it with the platform or the identity provider and turns it into a session of its own, which it returns as two tokens in the form that [[OAuth]] 2.0 gives them:

- An access token, which goes with each request. It is short-lived, and the response that issues it says for how many seconds it is valid.
- A refresh token, which the client sends to a refresh endpoint for a new access token when the old one expires, without the player signing in again. It lives longer than the access token, and it is the credential the client most needs to keep from leaking.

The access token may be a [[JSON Web Token]] whose claims the client could decode, but [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html) describes an access token as usually opaque to the client, and the client does well to treat it that way. Its format belongs to the backend, which can change it, so the expiry the client relies on is the lifetime the response states, not a claim read out of the token.

The token is attached in one place. The HTTP layer adds the `Authorization` header to each request and handles what follows from it, and call sites ask for data and never see a token. That keeps tokens out of gameplay code and out of logs, and it puts the rules below where one set of tests covers them.

On a 401, the layer refreshes once and retries once; a second 401 for the same request is the answer, and the player signs in again. The hard case is concurrency. Suppose three requests are in flight when the access token expires, and all three come back 401. If each one starts its own refresh, the backend receives the same refresh token three times. A backend may rotate refresh tokens: each refresh returns a new refresh token and invalidates the one it used. [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), OAuth's current security practice, requires rotation for public clients such as games, unless the refresh token is bound to the device by other means. Rotation is there to catch a stolen token. When an invalidated refresh token comes back, the server cannot tell whether the thief or the player sent it, so it revokes the active token as well, and the player has to sign in again. The client's own second and third refreshes look exactly like that theft, and the game signs its player out by itself.

So concurrent 401s share one refresh, a pattern called single flight. The first request that needs a refresh starts it, each request that needs one while it runs waits for the same one, and each then retries with the new token. One more case completes the pattern. A request that went out with the old token and whose 401 arrives after the refresh has finished must not start another, since its token has already been replaced, and comparing the token a request was sent with against the current one catches it:

```csharp
// The refresh response on the wire.
[Serializable]
public sealed class TokenResponseDto
{
    public string accessToken;
    public string refreshToken;
    public int expiresIn; // seconds, counted from when the server answered
}

[Serializable]
public sealed class RefreshRequestDto
{
    public string refreshToken;
}

public sealed class Session
{
    public string AccessToken { get; }
    public string RefreshToken { get; }
    public DateTime ExpiresServerUtc { get; }

    public Session(string accessToken, string refreshToken, DateTime expiresServerUtc)
    {
        AccessToken = accessToken;
        RefreshToken = refreshToken;
        ExpiresServerUtc = expiresServerUtc;
    }
}

// The Keychain on iOS; a file encrypted with an Android Keystore key on Android.
public interface ISessionStore
{
    Session Current { get; }
    void Save(Session session);
    void Clear();
}

public interface IServerClock
{
    DateTime ServerUtcNow { get; }
    void Observe(ApiResponse response);
}

public sealed class SessionClient
{
    private static readonly TimeSpan RefreshMargin = TimeSpan.FromMinutes(2);
    private enum Refresh { Done, Rejected, Unavailable }

    private readonly IHttpTransport transport;
    private readonly ISessionStore store;
    private readonly IServerClock clock;
    private Task<Refresh> refreshing; // the refresh in flight, shared by each request that needs one

    public SessionClient(IHttpTransport transport, ISessionStore store, IServerClock clock)
    {
        this.transport = transport;
        this.store = store;
        this.clock = clock;
    }

    public async Task<ApiResponse> SendAsync(ApiRequest request, CancellationToken cancel)
    {
        var session = store.Current;
        if (session == null) return SignedOut;

        // Ahead of expiry, in the server's time.
        if (clock.ServerUtcNow >= session.ExpiresServerUtc - RefreshMargin)
        {
            if (await RefreshAsync(session) == Refresh.Rejected) return SignedOut;
            session = store.Current;
            if (session == null) return SignedOut;
        }

        var response = await SendWithAsync(request, session, cancel);
        if (response.Status != 401) return response;

        // One refresh and one retry. A second 401 goes back to the caller as the answer.
        switch (await RefreshAsync(session))
        {
            case Refresh.Rejected: return SignedOut;
            case Refresh.Unavailable: return ApiResponse.NoResponse("session refresh unavailable");
        }
        var fresh = store.Current;
        return fresh == null ? SignedOut : await SendWithAsync(request, fresh, cancel);
    }

    private async Task<ApiResponse> SendWithAsync(ApiRequest request, Session session, CancellationToken cancel)
    {
        var response = await transport.SendAsync(
            request.WithHeader("Authorization", "Bearer " + session.AccessToken), cancel);
        clock.Observe(response);
        return response;
    }

    // Main thread only, like UnityWebRequest, so one field shares the refresh without a lock.
    private Task<Refresh> RefreshAsync(Session sentWith)
    {
        var current = store.Current;
        if (current == null) return Task.FromResult(Refresh.Rejected);  // signed out meanwhile
        if (current.AccessToken != sentWith.AccessToken)
            return Task.FromResult(Refresh.Done);                       // refreshed meanwhile
        if (refreshing == null || refreshing.IsCompleted)
            refreshing = RefreshOnceAsync(current.RefreshToken);
        return refreshing;
    }

    private async Task<Refresh> RefreshOnceAsync(string refreshToken)
    {
        var body = JsonUtility.ToJson(new RefreshRequestDto { refreshToken = refreshToken });
        var response = await transport.SendAsync(
            new ApiRequest("POST", "/v1/session/refresh", body), CancellationToken.None);
        clock.Observe(response);

        if (response.Status == 200)
        {
            var dto = JsonUtility.FromJson<TokenResponseDto>(response.Body);
            store.Save(new Session(dto.accessToken, dto.refreshToken,
                clock.ServerUtcNow.AddSeconds(dto.expiresIn)));
            return Refresh.Done;
        }
        if (response.Status == 400 || response.Status == 401)
        {
            store.Clear(); // the refresh token is spent or revoked: sign in again
            return Refresh.Rejected;
        }
        return Refresh.Unavailable; // no response, or a server error: keep the session
    }

    private static ApiResponse SignedOut => ApiResponse.Answered(401, null, null, null, null);
}
```

Everything in this class runs on the main thread, as `UnityWebRequest` requires, so a plain field shares the refresh without a lock: the code that checks the field and the code that sets it never run at the same moment. A session layer built on `HttpClient`, whose continuations can run on worker threads, puts a lock or a `SemaphoreSlim` around it. The check for a task that has already completed matters as well. A refresh that finishes at once, as one does against the fake transport, would otherwise stay in the field and answer each later refresh with its old result.

A refresh that gets no response, because the device lost its connection during it, leaves the session as it was. Nothing says that the refresh token is bad, and signing the player out because of a tunnel would throw away a session that works again a minute later. The server's refusal of the refresh ends the session: a 400, the status OAuth gives its `invalid_grant` error for a spent or revoked refresh token, or a 401 from the refresh endpoint.

Refreshing before expiry saves a round trip, since a request sent with a token about to expire fails and has to be sent again. The lifetime in the response counts from when the server generated it, and the device's clock can be wrong by minutes or by days, since players can move it forward to skip timers. The client therefore measures expiry in the server's time. Each response's `Date` header carries the time at which the server produced it, and the clock records the offset between that and the device's clock:

```csharp
// The device's clock, corrected by the offset to the Date header of the latest response.
public sealed class ServerClock : IServerClock
{
    private TimeSpan offset;

    public DateTime ServerUtcNow => DateTime.UtcNow + offset;

    public void Observe(ApiResponse response)
    {
        if (DateTime.TryParseExact(response.Date, "r", CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var serverUtc))
            offset = serverUtc - DateTime.UtcNow;
    }
}
```

The estimate is off by the time the response took to arrive and by the header's resolution, which is one second, and the two-minute margin covers both; the 401 path remains for whatever the estimate misses.

The tokens need a store on the device, and `PlayerPrefs` is the wrong one. [Unity's reference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PlayerPrefs.html) says `PlayerPrefs` data is stored without encryption and is not for sensitive data. On Android it is an XML file among the app's shared preferences, and on iOS it goes through `NSUserDefaults`. Android adds a second problem. Unity's Android export leaves `android:allowBackup` at its default, true, and [Auto Backup](https://developer.android.com/identity/data/autobackup) includes shared preferences files by default, so a refresh token kept there travels in the player's backup to another device. The platforms' secure stores are the place for it. On iOS that is the [[Keychain]], where an item whose accessibility setting ends in `ThisDeviceOnly` [does not migrate](https://developer.apple.com/documentation/security/ksecattraccessiblewhenunlockedthisdeviceonly) to a new device. On Android it is a file encrypted with a key from the [[Android Keystore]], which is built to make keys hard to extract from the device. Chapter 4 kept a pending sign-in attempt in the same two places.

From the backend's side, nothing in the client is secret. An API key, a signing key or a salt compiled into the game ships in every copy, and anyone can extract it from one of them; RFC 8252, which chapter 4 applied to client secrets, says that secrets built into an app that many users receive are not to be treated as confidential. A key in the build identifies which app the caller claims to be, and it proves nothing about who is calling or whether the client has been modified. The backend decides with what it controls: the player's session, and its own rules about what that player may do.

[[Device attestation]] raises the cost of faking a client without making it impossible. The Play Integrity API on Android and App Attest on iOS let the backend ask the platform whether a request comes from the genuine app on a genuine device, and neither platform presents the answer as proof. [Google's overview](https://developer.android.com/google/play/integrity/overview) says Play Integrity works best alongside other signals and not as the sole anti-abuse mechanism. [Apple's guide to App Attest](https://developer.apple.com/documentation/devicecheck/assessing-fraud-risk) warns that one compromised device can serve assertions to many users. The backend weighs the verdict with its other evidence, such as the rate and the pattern of a player's requests.

Signing out, or switching accounts on a shared device, undoes what the session set up, on the backend and on the device, in an order that matters, since the first step still needs the session:

- While the session is valid, ask the backend to detach the device's [[push token]] from the account, as [[#os-notifications]] set out, so that the next player on the device does not receive the last one's notifications, and to revoke the refresh token. On iOS, [Apple's reference for `unregisterForRemoteNotifications`](https://developer.apple.com/documentation/uikit/uiapplication/unregisterforremotenotifications%28%29) names logging out of an account associated with notifications as a time to call it.
- Cancel the requests still in flight, since their answers belong to the previous player.
- Clear the tokens from the secure store.
- Reset the analytics user id that chapter 7's service set on each adapter after sign-in.
- Clear the caches kept per player: stored responses and their ETags, the local copy of the save, anything keyed by the old account.

Exercise: Trace what happens to three requests in flight when the access token expires between them: which ones get a 401, how many refreshes the backend receives, and what each request's caller finally sees. Then trace it again with the device losing its connection during the refresh.

?? http-single-flight-refresh Three requests come back 401 at once, and the backend rotates refresh tokens. What happens if each starts its own refresh?
* The second refresh presents a spent token, and the server may revoke the whole session
- Each refresh returns a new pair of tokens, and the client keeps the pair that arrives last
- The server merges the three refreshes, since they carry the same refresh token
- The first refresh succeeds, and the other two fail with a harmless 429 status
> With rotation, each refresh invalidates the refresh token it used. When an invalidated token is presented again, the server cannot tell the player from someone who stole the token, and current OAuth security practice has it revoke the active refresh token as well. The client's own second refresh looks like that replay, so the player is signed out. One shared refresh avoids it.

?+ A request gets a 401 while a refresh that another request started is still running. What does the session layer do?
* It waits for the running refresh, then retries once with the new access token
- It starts a second refresh, so that this request does not depend on the other one
- It returns the 401 to its caller at once, since the other request will retry for both
- It retries at once with the old token, in case the refresh has finished by now
> Concurrent requests that need a new token share one refresh: the first starts it, the others wait for the same one, and each retries with the token it produced. A second refresh would present a refresh token that the first may already have rotated. Returning the 401 to the caller turns an expired token into an error the player sees.

?+ A request sent with the old access token gets a 401 after another request's refresh has finished. What does the session layer do?
* It retries with the current access token, without starting another refresh
- It starts a new refresh, since each 401 means that the current token has expired
- It signs the player out, since the refresh was supposed to prevent this 401
- It returns the 401, since a request retries once for a refresh it started itself
> The session layer compares the token the request was sent with against the current one. They differ, so the 401 is about a token that has already been replaced, and the request retries with the new one. Starting a refresh here would spend the new refresh token for nothing, and on a backend that rotates tokens a needless refresh is one more chance to race.

?+ Why is a plain field enough to share the refresh in flight in a session layer built on `UnityWebRequest`?
* Its requests start and finish on the main thread, so no two pieces of it run at once
- UnityWebRequest queues refreshes itself, so the field serves as a cache and no more
- The field is read inside `SendWebRequest`, which Unity locks for each request
- A refresh takes one frame, so two requests do not overlap in practice
> `UnityWebRequest` is created and read on the main thread, and the session layer's `await` continuations resume there, so the code that checks and sets the field runs one piece at a time. A session layer whose continuations run on worker threads, such as one built on `HttpClient` with `ConfigureAwait(false)`, needs a lock or a `SemaphoreSlim` around it.

?? http-client-secrets A game sends an API key compiled into its build with each request, and the backend rejects requests without it. What does the key prove?
* Little: anyone can extract the key from a copy of the game and send it
- That the request comes from an unmodified copy of the game on a real device
- That the player is signed in, since the backend issues each account its key
- That the traffic is private, since the key encrypts each request on the wire
> A key in the build ships in every copy, and anyone who unpacks one copy has it; OAuth's guidance for native apps says that such secrets are not to be treated as confidential. The key can say which app a request claims to come from, and nothing about whether the client was modified or who the player is. The backend decides with the player's session and its own rules.

?+ Why should the refresh token not be kept in `PlayerPrefs`?
* Unity stores `PlayerPrefs` unencrypted, and Android's Auto Backup copies them by default
- `PlayerPrefs` values are limited to a few hundred characters, which is too short for tokens
- `PlayerPrefs` is cleared at each update of the app, which would sign the player out
- Other apps on the device can read `PlayerPrefs`, which the device shares between apps
> Unity's reference says `PlayerPrefs` data is stored without encryption and is not for sensitive data. On Android it is a shared preferences file, which Auto Backup includes by default, so the token would travel to another device in a backup. The Keychain on iOS, and a file encrypted with an Android Keystore key, keep it out of both.

?+ The backend checks a Play Integrity verdict or an App Attest assertion with each purchase request. What can it conclude from a check that passes?
* That the request more likely comes from the genuine app on a genuine device
- That the player is the account's owner, since the platform signed the request
- That the values in the request are correct, since a genuine app sends correct values
- That the device is uncompromised, since the platform checked it for this request
> Attestation is a signal for the backend to weigh. Google recommends Play Integrity alongside other signals rather than as the sole defense, and Apple warns that a single compromised device can serve assertions to many users. A genuine app can still send values the player manipulated through its own interface, and the check says nothing about who the player is, which is the session's job.

## JSON, DTOs, and the game's domain {#http-dtos}

A backend's JSON and the game's model of the same thing change for different reasons. The JSON changes when the backend team adds a field, renames one in a new API version or splits a response; the game's model changes when the game's rules do. Keeping them as two types lets each change without the other:

- A data transfer object, a DTO, mirrors one response or request on the wire. Its field names are the JSON's, its types are ones the serializer handles, it has no behavior, and it belongs to one version of the API.
- A domain type holds what the game means. Its names are the game's, its invariants are checked when it is built, such as an amount that is positive or a reward kind the game knows, and gameplay uses it and nothing else.

A mapper turns one into the other at the boundary. It is the adapter of [[#platform-interfaces]] applied to the backend: the backend's vocabulary stays on the backend's side, and a change on the wire changes the DTO and the mapper, not gameplay.

```csharp
// The wire: GET /v1/offers/daily, version 1, named and typed as the JSON has it.
[Serializable]
public sealed class DailyOffersDto
{
    public DailyOfferDto[] offers; // JsonUtility reads an object at the top, not an array
}

[Serializable]
public sealed class DailyOfferDto
{
    public string offerId;    // ids travel as strings
    public string rewardKind; // "coins", "gems" or "item"; a newer server may add more
    public int amount;
    public string itemId;     // set when rewardKind is "item"
    public int priceGems;
    public string endsAt;     // UTC, in RFC 3339 form: "2026-10-01T00:00:00Z"
}

// The game's own types: its vocabulary, with invariants checked once.
public enum RewardKind { Unknown, Coins, Gems, Item }

public sealed class DailyOffer
{
    public string Id { get; }
    public RewardKind Kind { get; }
    public int Amount { get; }
    public string ItemId { get; }
    public int PriceGems { get; }
    public DateTime EndsUtc { get; }

    public DailyOffer(string id, RewardKind kind, int amount, string itemId, int priceGems, DateTime endsUtc)
    {
        Id = id;
        Kind = kind;
        Amount = amount;
        ItemId = itemId;
        PriceGems = priceGems;
        EndsUtc = endsUtc;
    }
}

public static class DailyOfferMapping
{
    public static List<DailyOffer> ToDomain(DailyOffersDto dto)
    {
        var offers = new List<DailyOffer>();
        if (dto?.offers == null) return offers;
        foreach (var offer in dto.offers)
        {
            // An offer this client cannot show is skipped, not shown half right.
            if (TryMap(offer, out var mapped)) offers.Add(mapped);
        }
        return offers;
    }

    public static bool TryMap(DailyOfferDto dto, out DailyOffer offer)
    {
        offer = null;
        var kind = ToKind(dto.rewardKind);
        if (kind == RewardKind.Unknown || string.IsNullOrEmpty(dto.offerId)) return false;
        if (dto.amount <= 0 || dto.priceGems < 0) return false;
        if (kind == RewardKind.Item && string.IsNullOrEmpty(dto.itemId)) return false;
        if (!DateTimeOffset.TryParse(dto.endsAt, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal, out var ends)) return false;
        offer = new DailyOffer(dto.offerId, kind, dto.amount, dto.itemId, dto.priceGems, ends.UtcDateTime);
        return true;
    }

    private static RewardKind ToKind(string value) => value switch
    {
        "coins" => RewardKind.Coins,
        "gems" => RewardKind.Gems,
        "item" => RewardKind.Item,
        _ => RewardKind.Unknown, // a kind added by a server newer than this client
    };
}
```

The DTO's shape follows from its serializer. Unity's `JsonUtility` uses the serializer that the Inspector uses, and [Unity's serialization rules](https://docs.unity3d.com/6000.3/Documentation/Manual/script-serialization-rules.html) decide what a DTO for it can hold:

- Fields, public or marked `[SerializeField]`. Properties are not serialized, and neither is `DateTime`.
- No dictionaries, no multidimensional or jagged arrays, and no containers nested in containers.
- An object at the top level. In a test for this chapter, `JsonUtility.FromJson` refused a top-level array with an `ArgumentException` saying the JSON must represent an object type, and `ToJson` given an array wrote `{}`. The response wraps its list in an object, which also leaves room for a field the backend adds later.
- No polymorphism from the wire. A field whose type is a base class keeps only the base class's fields and comes back as an instance of the base class, and `[SerializeReference]` writes a format of Unity's own, with reference ids and type names, which a backend would have to produce on purpose. For a response whose shape depends on a type field, [Unity's page on JSON serialization](https://docs.unity3d.com/6000.3/Documentation/Manual/json-serialization.html) suggests reading the common fields first, then reading the JSON again into the type they name.

`JsonUtility` can be called from a background thread, so a large response can be parsed off the main thread once its text has been copied out of the request. It is also forgiving in ways that hide mistakes. In the same test, fields missing from the JSON kept the values their initializers had set, as [the reference for `FromJson`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/JsonUtility.FromJson.html) documents; fields the DTO did not have were skipped; a JSON `null` became 0 in an `int` and an empty string in a `string`, so a DTO cannot tell a `null` from a 0 or an empty string; the string `"12"` filled an `int`, and 5.7 filled it with 5; and names matched only in the same case, so `"Id"` left `id` untouched.

Json.NET, which Unity packages as `com.unity.nuget.newtonsoft-json`, covers what `JsonUtility` does not: properties, dictionaries, nullable values, custom converters, and type information when both sides agree on a format for it. [Version 3.2.2 of the package](https://docs.unity3d.com/Packages/com.unity.nuget.newtonsoft-json@3.2/manual/index.html) corresponds to Newtonsoft.Json 13.0.2 and carries a second build of the library for AOT platforms. Its defaults differ from `JsonUtility`'s. In a .NET 8 test with the package's own assembly, it ignored fields it did not know, matched member names in any case, and threw on a `null` for an `int` instead of making it 0.

Json.NET finds a DTO's members through reflection, and that is where [[IL2CPP]] builds bite. The default [[managed code stripping]] level for IL2CPP is Minimal, which [removes nothing](https://docs.unity3d.com/6000.3/Documentation/Manual/managed-code-stripping-configure.html) from code the game's team wrote; at Medium and High, and at Low for assemblies that no scene references, Unity's linker searches those assemblies too, and [Unity's manual](https://docs.unity3d.com/6000.3/Documentation/Manual/managed-code-stripping-preserving.html) warns that it cannot always detect uses of reflection. A DTO member that only Json.NET reaches can then be missing from a release build while the Editor, which strips nothing, keeps working. The fix is to keep the DTOs whole, with a `link.xml` under `Assets` that lists each DTO type with `preserve="all"`, or with `[Preserve]` on each member that Json.NET fills, since the attribute on a type keeps only the type and its default constructor; the first book's chapter on testing and debugging introduced both. Then run the mapping tests in a device build with the stripping level the release uses. For generics, the cost is speed: for generic instances IL2CPP did not find at build time, such as one created through reflection, [Unity's page on IL2CPP's limitations](https://docs.unity3d.com/6000.3/Documentation/Manual/scripting-restrictions.html) says it generates shared code that works with any type argument and runs more slowly.

A client that stays installed for months reads responses from servers newer than itself, so it has to be a tolerant reader:

- Unknown fields are ignored. Both serializers do that by default. Json.NET's `MissingMemberHandling.Error` turns it off, and with it an old client fails on the first field a newer server adds: in the test, it threw a `JsonSerializationException` saying it could not find the new member.
- Missing fields get a default that the mapper chooses, not whatever the serializer happens to produce.
- A value the client does not know maps to an explicit unknown, and the domain decides what unknown means: skip the offer, show a generic reward, hide the button.

Enums are where the third rule fails most often. Suppose a newer server adds the reward kind `"chest"`, and the DTO declares its kind as the game's enum. In the tests, Json.NET threw on the unknown name, and the whole response was lost with it. `JsonUtility` does not read enum names at all, since it stores enums as numbers: it left the field at 0 even for a name the enum has. Keeping the kind as a string in the DTO, and mapping it in one `switch` with a default case, as `ToKind` does above, avoids both.

Numbers, dates and money need a contract that each reader in the pipeline can keep:

- Integers above $2^{53}$ travel as strings. [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html), the JSON standard, says implementations agree exactly on integers from $-(2^{53}-1)$ to $2^{53}-1$, because so many hold numbers as IEEE 754 doubles. Json.NET and `JsonUtility` both kept 9007199254740993 exact in a `long`, while a `double` field turned it into 9007199254740992, and so does any tool on the way that holds numbers as doubles, a JavaScript dashboard among them. Account ids, transaction ids and any other value used to look something up travel as strings.
- Dates travel as UTC in the format of [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339.html), the Internet's profile of ISO 8601, with a `Z` for UTC: `2026-10-01T00:00:00Z`. Json.NET read that text as a UTC `DateTime`, and the same text without the `Z` as a time of unspecified kind, which the device's time zone can later shift. `JsonUtility` does not serialize `DateTime`, so its DTO keeps the string and the mapper parses it.
- Money travels as an integer count of the currency's minor units, with the currency's code: 199 and `"EUR"`, not 1.99. A binary floating-point number cannot hold most decimal fractions exactly: `JsonUtility` wrote the `float` 0.1 as 0.10000000149011612, and in `double` arithmetic 0.1 + 0.2 is 0.30000000000000004. Google Play Billing reports prices the same way, as a `long` in micro-units, a million to one unit of the currency.

Mapping tests read recorded responses. Save real responses from each API version the client talks to, with the fields the client ignores left in, as files beside the tests, and give each kind of server change its own recording: a field added, an enum value added, a field that stopped arriving. An [[Edit Mode tests|Edit Mode test]] reads each file through the DTO and the mapper and checks the domain values that come out. When a server change would break the client, a recording taken from the staging server shows it before a player does.

Exercise: Take one response from your game's backend. Write its DTO and its domain type, and list three server changes the mapping must survive, with the value each one maps to.

?? http-dto-mapping A new API version renames the JSON field `coins` to `softCurrency`. In a client that maps DTOs at the boundary, what changes?
* The DTO for that version and its mapper, while gameplay keeps using the domain type
- Each gameplay class that reads coins, since the domain type follows the wire's names
- Nothing, since the serializer matches the renamed field to the old one by position
- The domain type's field name, so that it goes on matching what the server sends
> The DTO mirrors the wire, so a new name is a new DTO field, and the mapper reads it into the same domain value as before. Gameplay depends on the domain type, which names things in the game's vocabulary and does not follow the JSON. JSON serializers match fields by name, not by position.

?+ Why does gameplay code use a domain type rather than the DTO that the serializer fills?
* The DTO follows the wire and its versions, while the domain type keeps the game's rules
- The DTO is slower to read, since serializers add a check to each access of its fields
- The DTO is released after parsing, so gameplay that kept one would read freed memory
- The domain type is what the backend sends, and the DTO is a copy made for the Inspector
> A DTO has the backend's names, the serializer's types and no invariants, and it changes with each API version. The domain type is built once, by the mapper, which checks its invariants and translates the backend's values into the game's, so gameplay never holds a half-valid object or a wire format. DTOs are ordinary objects, with no special rules for their memory.

?+ A DTO parsed with `JsonUtility` has a `Dictionary<string, int>` field, and the field is always empty. Why?
* `JsonUtility` uses Unity's serializer, which does not serialize dictionaries
- The JSON object's keys need a different quoting to become dictionary keys
- `JsonUtility` fills dictionaries on the frame after the parse has finished
- The field has to be a property with a setter for the serializer to fill it
> `JsonUtility` follows Unity's serialization rules, and those leave out dictionaries, along with properties, multidimensional and jagged arrays, and containers nested in containers. A DTO for `JsonUtility` holds such data in a form it supports, such as an array of key and value pairs, or the team reads that response with Json.NET.

?+ A release build with the Managed Stripping Level at High fails to read responses through Json.NET, and the Editor reads them. Where does the team look first?
* At DTO members the linker removed because it does not see Json.NET's reflection
- At the device's network settings, since the Editor and the device use other servers
- At Json.NET's AOT build, which does not support DTOs made of public fields
- At the backend, which sends release builds a different JSON format than the Editor
> Unity's linker removes code that its static analysis finds unused, and at High it searches the game's own assemblies; Unity's manual warns that it does not always detect uses of reflection. A member that Json.NET alone reaches can be stripped, while the Editor, which strips nothing, keeps it. A `link.xml` entry with `preserve="all"` for each DTO type, or `[Preserve]` on each member Json.NET fills, keeps them; the attribute on a type alone keeps its default constructor and not its members.

?+ A backend stores account ids as 64-bit integers. How should they travel in JSON?
* As strings, since readers that hold numbers as doubles lose integers above $2^{53}$
- As numbers, since JSON sets no limit on a number's size and readers keep them whole
- As numbers split into two 32-bit halves, which each JSON reader can hold exactly
- As numbers with a decimal point, which makes readers keep them at full precision
> JSON itself sets no limit, but implementations agree exactly on integers up to $2^{53}-1$ in size, because many hold numbers as IEEE 754 doubles. A C# `long` keeps the value, and a JavaScript tool or a `double` field on the way does not. A string keeps the id intact in each reader, and ids are not used for arithmetic.

?+ A backend sends the price of an offer in real money. Which JSON form keeps it exact?
* An integer count of the currency's minor units, with the currency's code
- A number with two decimal places, such as 1.99, read into a `double`
- A number with two decimal places, read into a `float` to save memory
- A formatted string such as “€1.99”, which the client parses for its number
> A binary floating-point number cannot hold most decimal fractions exactly, so 1.99 arrives as the nearest value it can hold, and sums drift from there. An integer number of minor units, 199 with `"EUR"`, is exact in each reader. A formatted string mixes the amount with a presentation that depends on the locale, which is the client's job, not the wire's.

?? http-tolerant-reader A newer server adds the reward kind `"chest"`. Which client keeps working?
* One whose DTO keeps the kind as a string, which its mapper turns into Unknown
- One whose DTO declares the kind as a C# enum, which Json.NET fills from the name
- One that tells Json.NET to report unknown values to the team
- One that retries the request until the server sends a kind that the client knows
> An unknown value has to survive parsing and reach code that can decide what it means. With the kind declared as an enum, Json.NET throws on the new name and the whole response is lost, and `JsonUtility` does not read enum names at all. A string field and a mapper with a default case turn the new kind into Unknown, which the game can skip or show generically.

?+ An old client sets Json.NET's `MissingMemberHandling` to `Error`, and a newer server adds a field to a response. What happens?
* Deserialization throws, so a change meant to be harmless breaks the old client
- The new field is added to the DTO at run time, and the client then ignores it
- The field is logged as a warning, and the rest of the response is read as usual
- Nothing, since that setting is about fields that are missing, not fields that are new
> With that setting, a JSON member that the DTO lacks is an error, and in a test Json.NET threw a `JsonSerializationException` on the new field. The default, `Ignore`, skips unknown members, which is what a client that stays installed for months needs, since servers add fields without asking the clients already installed.

?+ A field of a DTO read with `JsonUtility` is missing from the response. What value does the field get?
* The value that its field initializer or the class's constructor assigned
- The default of its type, since `JsonUtility` skips constructors while reading
- `null`, since `JsonUtility` clears each field the JSON does not mention
- None: `FromJson` throws when a field of the DTO is absent from the JSON
> Unity's reference for `FromJson` says that field initializers and the default constructor run during deserialization, and that fields missing from the JSON keep the values they assigned. A DTO can therefore state its defaults for missing fields in its initializers, and the mapper decides what those defaults mean.

?+ Why does the DTO keep the reward kind as a string rather than as the game's enum?
* So that a value added by a newer server survives parsing, and the mapper decides its meaning
- So that kinds compare without regard to case, which the enum's names do not allow
- Because JSON has no enum type, so serializers fail on each field declared as an enum
- Because a string compares faster than an enum in the mapper's `switch` statement
> A string holds any value the server sends, including values this client has never seen, and the mapper turns each known string into the domain's enum and the rest into Unknown. Json.NET can fill an enum from its name and throws on a name it does not know, and `JsonUtility` fills enums from numbers. The choice is about a server that may be versions ahead, not about speed or case.

## API versions and clients that never update {#http-versioning}

A release does not replace the client in players' hands. Players turn automatic updates off, devices below a new release's minimum OS version keep the last build they could install, and some players rarely open the store. The first book's chapter on LiveOps and releases started from the same fact, that several binary versions are live at once, and moved its content through expand-and-contract stages that each of those versions could read. For a backend, it means that each response stays readable by each client version it still supports, and that the requests those clients send keep working.

The API's version can go in one of three places:

| Where | Example | What it costs |
| --- | --- | --- |
| The path | `GET /v2/offers/daily` | Visible in logs, routing and caches; a new version is a new address, which a client moves to all at once |
| A header | `Api-Version: 2` | Addresses stay stable, and each cache in between has to vary its entries by the header |
| The media type | `Accept: application/vnd.example.game.v2+json` | Versions each representation on its own, and is the hardest to try by hand |

The `vnd.` prefix marks the vendor tree, which [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838.html) sets aside for media types that belong to publicly available products, a game among them.

Most changes need no new version, as long as they are additive: a new optional field in a response, a new endpoint, a new optional parameter, or a new value where the supported clients map values they do not know, as the previous section's mapper does. Other changes break old clients whatever the version scheme says:

- Removing or renaming a field that old clients read.
- Changing a field's type, unit or meaning: an amount that was coins and becomes gems, a duration that was seconds and becomes milliseconds.
- Reusing a field for something new. An old client reads the new meaning with its old logic, and nothing fails that could warn anyone.
- Making an optional request field required, or tightening a validation that old clients' requests then fail.

A breaking change ships as a new version beside the old one, and the old one goes when the clients that use it have gone. The backend measures it: it counts requests per client version and per API version, and the counts decide when a field or an endpoint can go. HTTP has headers to tell clients what is coming. The `Deprecation` header of [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html) says a resource will be or has been deprecated, and the `Sunset` header of [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html) says when it is expected to stop answering. A client that logs them shows the team which of its releases depend on something scheduled to go.

The client says who it is. Each request carries the client's version and platform in headers of the game's own, such as `X-Client-Version: 1.4.0` and `X-Client-Platform: Android`, which the transport of [[#http-unity-clients]] adds in one place. `Application.version` returns the Version field of Player Settings on each platform. `User-Agent` is the wrong carrier: Unity sets it itself, to `UnityPlayer/6000.3.11f1 (UnityWebRequest/1.0, libcurl/8.10.1-DEV)` on the Editor's requests in this chapter's tests, and [the reference for `SetRequestHeader`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Networking.UnityWebRequest.SetRequestHeader.html) recommends against giving it a custom value. With those headers, the server can adapt a response for an old client, refuse a request with an error the client can show, or ask for an update.

The client asks, too. At start-up, before anything that depends on the API, it requests its platform's policy from a small endpoint: a minimum version, below which it can no longer work with the backend, and a recommended version, below which an update is suggested. Below the minimum, the game shows a screen that sends the player to the store and offers nothing else; below the recommended version, it shows a prompt the player can dismiss. On Android, [Google Play's in-app updates](https://developer.android.com/guide/playcore/in-app-updates) offer both forms: an immediate flow that fills the screen until the player updates and restarts, and a flexible flow that downloads in the background. On iOS, the game opens its page in the App Store.

```csharp
// The one response each client version reads, the oldest included. Fields are added, never changed.
[Serializable]
public sealed class ClientPolicyDto
{
    public string minimumVersion;     // below it, the backend no longer serves this client
    public string recommendedVersion; // below it, the game suggests an update
}

public enum UpdateVerdict { UpToDate, UpdateSuggested, UpdateRequired }

public static class ClientPolicy
{
    public static async Task<UpdateVerdict> CheckAsync(IHttpTransport transport, CancellationToken cancel)
    {
        var response = await transport.SendAsync(new ApiRequest("GET", "/v1/client-policy"), cancel);
        if (response.Status != 200) return UpdateVerdict.UpToDate; // fail open, by the team's choice
        try
        {
            return Decide(Application.version, JsonUtility.FromJson<ClientPolicyDto>(response.Body));
        }
        catch (ArgumentException)
        {
            return UpdateVerdict.UpToDate; // a body this client cannot parse: fail open as well
        }
    }

    public static UpdateVerdict Decide(string installed, ClientPolicyDto policy)
    {
        if (policy == null || !TryParse(installed, out var current)) return UpdateVerdict.UpToDate;
        if (TryParse(policy.minimumVersion, out var minimum) && current < minimum)
            return UpdateVerdict.UpdateRequired;
        if (TryParse(policy.recommendedVersion, out var recommended) && current < recommended)
            return UpdateVerdict.UpdateSuggested;
        return UpdateVerdict.UpToDate;
    }

    private static bool TryParse(string text, out Version version)
    {
        version = null;
        if (!Version.TryParse(text, out var parsed)) return false;
        // "1.4" and "1.4.0" name the same release.
        version = new Version(parsed.Major, parsed.Minor, Math.Max(parsed.Build, 0), Math.Max(parsed.Revision, 0));
        return true;
    }
}
```

The check is the one part of the API that each client version depends on, the oldest included, so two rules apply to it:

- Its shape does not change. New fields for newer clients are additive, and the old fields keep their meaning for as long as any client reads them. A check that the oldest client cannot parse cannot tell that client to update.
- Its failure goes in a direction someone chose. When the check gets no response, the game can let the player in, which is failing open, or keep them out, which is failing closed. Failing open is the usual choice, since a failed check is more likely a bad connection than an unsupported version, and failing closed turns each bad connection at launch into a locked game. `CheckAsync` above fails open, and so it needs a backstop.

The backstop is on the server. When a version must stop at once, say for a security flaw, the backend refuses each API request from it with an error that the client has known how to show since its first release: a response that means “update required” and nothing else, which the client routes to the update screen. That response has to exist in the first release that shipped. A client runs the code it was built with, so a way of stopping it that arrives in a later build does not reach the builds that need stopping.

Two ideas keep the contract from drifting, and they are named here as ideas. A shared schema, such as an [[OpenAPI]] document, can generate the client's DTOs and the server's handlers from one description, so the two sides read a field's name and type from the same place. Contract tests record what each supported client version sends and expects, and replay those expectations against each server build, so a change that would break an old client fails the server's build instead of reaching players.

Exercise: Take the last ten changes to an API your game uses. Mark each one that would break the oldest client version still supported, and say what would have made it additive.

?? http-additive-change Which change to a response can ship without breaking clients that stay on old versions?
* Adding an optional field that the old clients do not know and skip
- Renaming a field so that its name matches the game's vocabulary
- Changing an amount's unit from seconds to milliseconds, for precision
- Turning a number field into a string, to keep large values exact
> Old clients ignore fields they do not know, so an optional new field reaches the new clients and leaves the old ones as they were. A rename removes the field that old clients read, a new unit changes the meaning of a value they still read, and a new type makes their parsing fail or produce a wrong value.

?+ A team wants to reuse the unused response field `bonus` to carry a multiplier. What does that do to old clients?
* They go on reading it as a bonus, applying the new value with the old logic
- Nothing, since old clients stopped reading `bonus` when the server stopped filling it
- They fail to parse the response, which tells the team to roll the change back
- They receive the multiplier under the old name, and apply it as a multiplier
> A field the server stopped filling can still be read by clients: builds that shipped with the old meaning read the field and act on it. The new value fits the old type, so nothing fails, and the mistake shows up as wrong rewards rather than as a crash. A new meaning gets a new field.

?+ When can the server stop sending a field that old clients read?
* When requests from the versions that read it fall to a level the team accepts
- When the newest client release no longer reads it, since players update within days
- When the field has been marked deprecated in the API's documentation for one release
- When the staged rollout of the newest client version reaches its final stage
> Removing the field breaks each client that still reads it, so the decision rests on who still sends requests: the backend counts requests per client version, and the field goes when the versions that depend on it are few enough to accept losing. Documentation and the newest release describe intentions, and players on old builds are bound by neither.

?+ A server starts sending a new value in a response's `kind` field. When is that change additive?
* When the supported client versions map kinds they do not know to a fallback
- When the new value is added at the end of the list, after the existing values
- When the schema file that describes the response lists the new value
- When the field is documented as an enum, which clients know can grow
> A new value is harmless to clients that read unknown values tolerantly, and it breaks those that throw on them or misread them. Whether the change is additive therefore depends on the oldest supported client's mapping, which is why that mapping belongs in the first release. Documenting the value tells people about it and changes nothing in the installed code.

?? http-min-version The start-up version check gets no response. What should the game do?
* Follow the direction the team chose in advance, usually letting the player in
- Keep the player out until the check succeeds, since the version may be unsupported
- Retry the check in a loop at launch, and let the player in once it answers
- Show the update screen, since a check that fails suggests an outdated client
> A check that fails has to fail in a direction someone chose. Failing open lets players in during a connection problem, which is the likelier cause, and failing closed locks the game on each bad connection at launch. The backstop is on the server, which refuses the requests of a version that must stop with a response the client already knows how to show.

?+ Why must the response of the minimum-version endpoint keep its shape?
* The oldest clients read it, including the ones it has to tell to update
- The store reviews it, and a changed shape delays the game's next release
- It is cached on devices for months, so a change would reach no one
- The newest client reads it before it knows its own version number
> The check is the one endpoint that each supported client reads, and its most important readers are the oldest, since those are the ones it may have to stop. A shape they cannot parse leaves them unable to learn that they must update. New fields can be added for newer clients, and the old fields keep their meaning.

?+ A security flaw means that version 1.2 must stop talking to the backend at once. What makes that possible for copies already installed?
* An error that 1.2 already knows how to show, which the server sends to its requests
- A forced update pushed through the store, which installs over 1.2 on each device
- A remote flag that tells 1.2 to close, added to the next release of the game
- A new format for the minimum-version response, which 1.2 downloads at its next launch
> An installed client runs the code it shipped with, so the responses it can act on are those it already understands. A server that answers 1.2 with an “update required” error that each version has handled since the first release stops it at its next request. A store installs an update when the player or the device's settings allow it, and a flag added to a later release does not reach the build that needs stopping.

?+ What does the client send with each request so that the server can adapt, refuse or ask for an update?
* Its version and its platform, in request headers that the game defines
- Its version, in the `User-Agent` header, whose text it replaces with its own
- Its install date, from which the server works out which build it has
- Nothing extra: the server infers the version from the shape of each request
> Headers such as `X-Client-Version` and `X-Client-Platform`, added to each request by the transport, let the server decide request by request and let the team count requests per version. Unity sets `User-Agent` itself and recommends against replacing it, and inferring the version from a request's shape stops working once two versions send the same shape.

?+ The installed version is above the minimum and below the recommended version. What does the game show?
* A prompt that suggests the update and that the player can dismiss
- A screen that keeps the player out until the update is installed
- Nothing, since the recommended version is for the store listing
- A message asking the player to reinstall the game from the store
> Below the minimum, the backend no longer serves the client, and the game sends the player to the store. Between the minimum and the recommended version, the client still works, so the game suggests the update and lets play continue. On Android, Google Play's in-app updates offer a flexible flow for this case and an immediate one for the required update.
