# Evidence for chapter 09: Reliable requests on unreliable networks

What Phase 27 checked the chapter’s claims against, and where the outline was wrong. [PLAN.md](../PLAN.md), under “Decisions: evidence”, says what counts as evidence. Phase 27 ran in a cloud container, without Codex, the Unity Editor, the probe project, Xcode or a device, so the session gathered the evidence itself under rule A of the brief, on 2026-09-25. The container could not reach docs.unity3d.com, rfc-editor.org, datatracker.ietf.org, learn.microsoft.com, w3.org or owasp.org. Unity's C# reference source at the tag `6000.3.11f1` stands in for the Editor's assemblies, and the documents' own repositories on GitHub stand in for the RFC Editor, the IETF and OWASP; each is pinned to a commit in the receipts. Everything that needs the unreachable hosts is listed under “To check on the Mac”.

## Checked, and against what

### network-timeouts

- `UnityWebRequest.timeout` is an `int` in whole seconds, stored as milliseconds, and a sent request refuses a new value (`UnityWebRequest has already been sent; cannot modify the timeout`): confirmed. [UnityWebRequest.bindings.cs](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/6000.3.11f1/Modules/UnityWebRequest/Public/UnityWebRequest.bindings.cs), lines 621 to 633.
- `UnityWebRequest` has one timeout and no separate connection timeout: confirmed for the C# API; the same file has no other timeout member. What the one timeout covers, from sending to the last byte or less, is native code: narrowed to “one timeout for the request”.
- `Abort` is `[NativeMethod(IsThreadSafe = true)]`, so a cancellation callback on another thread may call it: confirmed, same file, line 295.
- `MonoBehaviour.destroyCancellationToken` exists and is cancelled from native code when the object is destroyed: confirmed. [MonoBehaviour.bindings.cs](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/6000.3.11f1/Runtime/Export/Scripting/MonoBehaviour.bindings.cs), lines 29 to 48. `AsyncOperation` is awaitable through `AsyncOperationAwaitableExtensions.GetAwaiter`, and `Awaitable<T>` has an async method builder: [Awaitable.AsyncOperation.cs](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/6000.3.11f1/Runtime/Export/Scripting/Awaitable.AsyncOperation.cs) and `AwaitableT.cs`, line 14. `UnityWebRequest.Post(string, string, string contentType)` exists: `WebRequestExtensions.cs`, line 197.
- `HttpClient.Timeout` defaults to 100 seconds and applies to each call on the instance; a caller's token also applies, and the shorter wins: confirmed by the [API docs source](https://github.com/dotnet/dotnet-api-docs/blob/main/xml/System.Net.Http/HttpClient.xml), lines 3498 to 3504, and by the .NET 8 probe below.
- A timeout and a caller's cancellation throw the same type, `TaskCanceledException`, an `OperationCanceledException`; on .NET 8 a timeout nests a `TimeoutException` and leaves the caller's token uncancelled: confirmed by the probe. The chapter tells them apart by the caller's token, which does not depend on the nested exception that Unity's class libraries may not add.
- Cancellation stops the client's waiting and not the server's work: confirmed by the probe, in which the server finished both requests that the client had abandoned, one by timeout and one by its token.
- A per-attempt timeout does not bound an operation that retries, and a deadline does: confirmed by the probe, with 3.0 s for three attempts of 1 s each, and 1.5 s and two attempts under a 1.5 s deadline.
- A gateway that gives up on its upstream answers 504: confirmed, RFC 9110, section 15.6.5, read in the HTTP working group's copy of the RFC.
- iOS gives `applicationDidEnterBackground(_:)` five seconds and then suspends the app: confirmed, Apple, [Extending your app’s background execution time](https://developer.apple.com/documentation/uikit/extending-your-app-s-background-execution-time). While the app is suspended the system may reclaim its sockets and close their connections: confirmed, Apple's archived [TN2277](https://developer.apple.com/library/archive/technotes/tn2277/_index.html).
- Background transfers: a background `URLSession` configuration lets transfers continue while the app is suspended or terminated ([Apple](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background(withidentifier:))); Android has `DownloadManager` for long-running HTTP downloads ([reference](https://developer.android.com/reference/android/app/DownloadManager)) and user-initiated data transfer jobs ([data transfer options](https://developer.android.com/develop/background-work/background-tasks/data-transfer-options)): confirmed, and named only.

### network-retries

- PUT, DELETE and the safe methods are idempotent, and a client should not retry a non-idempotent request unless it knows the request is idempotent or was never applied: confirmed, RFC 9110, section 9.2.2.
- 408 lets the client repeat the request; 502 and 504 come from a gateway that had forwarded the request; 503 means the server is unable to handle the request for now; `Retry-After` holds seconds or an HTTP date: confirmed, RFC 9110, sections 15.5.9, 15.6.3, 15.6.4, 15.6.5 and 10.2.3. 429 and its optional `Retry-After`: RFC 6585, section 4.
- 401 means the request was not applied for lack of valid credentials; 403 that the server understood and refuses; 409 a conflict with the resource's state; 422 content the server could not process: confirmed, RFC 9110, section 15.5.
- The recap of backoff with full jitter, a cap and a deadline: the first book's chapter 13, `content/unity-engineering/13-liveops-and-releases.md`, lines 257 to 282.
- Retry budgets exist in practice: gRPC's client retry design disables retries when a client's ratio of failures to successes passes a threshold ([proposal A6](https://github.com/grpc/proposal/blob/master/A6-client-retries.md)). The chapter describes a budget without naming a library.

### network-idempotency

- The `Idempotency-Key` header is an Internet-Draft of the IETF HTTPAPI working group, not a standard: confirmed from the working group's [repository](https://github.com/ietf-wg-httpapi/idempotency), whose latest change, on 2025-02-26, followed version 06. Its current status on the datatracker is for the Mac.
- The draft's rules, all confirmed in the repository's copy at commit `dab060c`: the key is unique and never reused with a different payload; a UUID or similar random identifier is recommended; the value is a Structured Field String, so it travels in double quotes; the server may expire keys and should publish the policy; a retry after completion gets the recorded result, success or error; a retry while the original is in flight gets 409; a key reused with another payload gets 422; a missing required key gets 400; after a 409 the client retries without changing the request.
- The first book's rule that the pending record is saved before the request is sent: `content/unity-engineering/03-missions-and-rewards.md`, lines 157 to 175.
- The lost-response case: the probe's raw socket server committed each write and closed the first connection without answering. With the same key, the retry returned the recorded result and the server applied one write; with a new key for the retry, it applied a second.

### network-offline

- `Application.internetReachability` returns “the type of Internet reachability currently possible on the device”, and `NetworkReachability` has `NotReachable`, `ReachableViaCarrierDataNetwork` and `ReachableViaLocalAreaNetwork`: confirmed from the source comments, [Application.bindings.cs](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/6000.3.11f1/Runtime/Export/Application/Application.bindings.cs), line 453, and `Application.cs`, lines 42 to 51. The reference page's own wording was not reachable.
- Android separates a network set up for the internet from one where the system found actual access: `NET_CAPABILITY_INTERNET` “is about setup and not actual ability to reach public servers”, a network behind a captive portal lacks `NET_CAPABILITY_VALIDATED`, and a validated network can still lose connectivity: confirmed, Android, [Read network state](https://developer.android.com/develop/connectivity/network-ops/reading-network-state).
- On iOS, a satisfied `NWPath` is one “available to establish connections and send data”: confirmed, [Apple](https://developer.apple.com/documentation/network/nwpath/status-swift.enum/satisfied).
- Captive portals forge DNS or HTTP responses; an intercepted TLS connection gives a host name mismatch; and portals work as intended only with browsers, breaking other applications: confirmed, the capport architecture draft 10, which became RFC 8952, in the working group's [repository](https://github.com/capport-wg/architecture).
- `If-Match` guards a state-changing request against a lost update, and a failed condition answers 412: confirmed, RFC 9110, sections 13.1.1 and 15.5.13.
- The bounded offline queue and the pending, confirmed and rejected states: the first book, chapter 13, line 263, and chapter 3, lines 171 to 175.

### network-observability

- W3C Trace Context's `traceparent` header identifies a request in a tracing system: confirmed in the specification's [repository](https://github.com/w3c/trace-context), `spec/20-http_request_header_format.md`.
- Session identifiers, access tokens and sensitive personal data should be removed, masked, sanitized, hashed or encrypted rather than logged: confirmed, OWASP's Logging Cheat Sheet in its [repository](https://github.com/OWASP/CheatSheetSeries).
- On Android, logs are a shared resource available to apps with `READ_LOGS`, and Android advises limiting logs in production: confirmed, Android, [Security tips](https://developer.android.com/privacy-and-security/security-tips).

## Rests on documentation alone

- The HTTP semantics rest on RFC 9110 and RFC 6585, and the key's behavior on the draft. Servers differ: the draft says what a server SHOULD do, and the chapter sends the reader to the backend's own documentation for its rules and retention window.
- iOS suspension, socket reclaim and background sessions rest on Apple's pages; TN2277 is an archived note from iOS 4. No device was run.
- Android's capabilities, `DownloadManager` and user-initiated jobs rest on Android's pages.
- Choosing timeouts from latency percentiles, the order of timeouts from server to deadline, retry amplification, budgets, circuit breakers, correlation ids and the per-feature offline strategies are design reasoning that the chapter shows, not facts about a platform. The amplification figures are arithmetic.

## Narrowed or cut

- “Its requests fail on resume” became: a suspended app runs no code, and the system may reclaim its sockets, so a request in flight can fail when the app resumes, with an unknown outcome.
- What `UnityWebRequest.timeout` covers, and which `result` a timeout or an `Abort` gives, is native code and documentation that could not be read here. The chapter says only that the request has one timeout, set before sending, and decides cancellation by the owner's token.
- The chapter does not state what a `UnityWebRequest` does with a captive portal's redirect, nor what `internetReachability` reads on a portal's network: on Android that depends on whether Unity's player checks `NET_CAPABILITY_VALIDATED`, which is native code. The reachability questions rest on the property's definition alone.
- A 502 can come from a gateway that never reached its upstream, so the chapter says a gateway “may have forwarded” the request.
- W3C Trace Context is called a specification, since its status page on w3.org could not be read.
- A background `URLSession` keeps transfers going after the system terminates the app, and Apple's page adds that a user's force quit cancels them, so the chapter says “after the system terminates it”.
- The header's status is stated as the repository shows it, with the date read.

## Where the outline fell short

- **Retry amplification.** Three layers that “each retry three times” make four attempts each, 4 × 4 × 4 = 64 at the bottom; 27 is the figure for three attempts each. The chapter counts attempts and gives both.
- **The captive portal's 200.** A portal can answer a cleartext request with its own page. An HTTPS request cannot be answered in the server's name: interception gives a host name mismatch, so the game sees a TLS failure, a connection error. The chapter teaches both cases and keeps the check of content type and schema for anything that answers in the server's place.
- **The list of retryable failures.** 502 and 504 come from a gateway that had already forwarded the request, and a connection can drop after the request was sent, so for a POST without a key they are unknown outcomes, like a timeout. The chapter retries them only for idempotent or keyed requests, and retries a connection error for any method only when it happened before the request was sent.
- **The header's syntax.** The draft makes the key a Structured Field String, so the header carries it in double quotes. The outline did not say so.
- **Timeouts at each layer.** `UnityWebRequest` has no connection timeout of its own, so the connection is inside the one attempt timeout.

## Runs

- A .NET 8 console probe (SDK 8.0.131, Ubuntu's `dotnet-sdk-8.0`) with an `HttpListener` server and a raw socket server on the loopback interface: the default timeout, a timeout, a caller's cancellation and the server's work after it, three attempts with a per-attempt timeout, the same loop under a deadline, and the lost response with the same key and with a new key. Its output is quoted in the receipts.
- The chapter's C# samples were compiled with .NET 8 against stubs of the Unity types they use, copied in signature from the reference source at `6000.3.11f1`, with warnings as errors. This checks the C# and the API shapes, not Unity's behavior.

## To check on the Mac

- **Unity's reference, 6000.3** (docs.unity3d.com was blocked): the wording of [`Application.internetReachability`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Application-internetReachability.html), whose note on actual connectivity the chapter paraphrases from the source comment; what [`UnityWebRequest.timeout`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Networking.UnityWebRequest-timeout.html) covers; and which `result` a timeout and an `Abort` give. Settled by fetching the pages, or by the Editor's `UnityEngine.UnityWebRequestModule.xml` and `UnityEngine.CoreModule.xml`.
- **The C# samples** against 6000.3's assemblies, with `UNITY_ANDROID` and `UNITY_IOS` defined, in the brief's C# harness.
- **The draft's status**: whether a version after 06, or an RFC, exists, on the [datatracker](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/). If it has become an RFC, the chapter's sentence on its status changes, and no question depends on it.
- **The links the container could not fetch**, for `npm run guard -- links`: `https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods`, `https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/` and `https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html`.
- **`internetReachability` behind a captive portal** on an Android device, and whether Unity's player reads `NET_CAPABILITY_VALIDATED`. No question depends on it.
- **A device check**, optional: a `UnityWebRequest` in flight when an iPhone locks and the app is suspended, to record what the request reports on resume.
- **Unity's `HttpClient`**: whether a timeout under Mono and IL2CPP nests a `TimeoutException`. The chapter's code does not depend on it.
