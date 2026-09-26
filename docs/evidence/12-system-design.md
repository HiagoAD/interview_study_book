# Evidence for chapter 12: System design for game services: method and building blocks

What Phase 30 checked the chapter’s claims against, and where the outline was wrong. [PLAN.md](../PLAN.md), under “Decisions: evidence”, says what counts as evidence.

The documentation was fetched on September 26, 2026. PostgreSQL pages under `/docs/current/` describe major version 18. The Redis commands reference lists version 8.10, the Kafka sources are pinned to 4.3, and the RabbitMQ reference identifies version 4.3.6. The chapter gives Unity's service names and quotas with that date.

## Checked, and against what

### design-round-method

- Published guides report a round of roughly 45 to 60 minutes; this is reported practice, not a guarantee: confirmed. Source: The guides that PLAN.md lists under “Decisions: system design”.
- Published guides report a round of roughly 45 to 60 minutes; this is reported practice, not a guarantee: confirmed. Source: https://www.techgrind.io/system-design/system-design-framework
- A generic guide covers scoping, estimation, API design and deep dives: confirmed. Source: https://www.techgrind.io/system-design/system-design-framework
- A generic guide advises following the interviewer toward two or three hard design problems: confirmed. Source: https://www.techgrind.io/system-design/system-design-framework
- A guide reports grading requirements gathering, the component diagram, scaling reasoning and honest trade-offs: confirmed. Source: The guides that PLAN.md lists under “Decisions: system design”.
- A published game-backend guide reports a leaderboard prompt: confirmed. Source: The guides that PLAN.md lists under “Decisions: system design”.
- A published game-backend guide reports a matchmaking prompt: confirmed. Source: The guides that PLAN.md lists under “Decisions: system design”.
- A published game-backend guide reports a session service with disconnects: confirmed. Source: The guides that PLAN.md lists under “Decisions: system design”.
- A published game-backend guide reports pushing a live event to many clients: confirmed. Source: The guides that PLAN.md lists under “Decisions: system design”.
- A published game-backend guide reports collecting gameplay events for later queries: confirmed. Source: The guides that PLAN.md lists under “Decisions: system design”.
- A candidate's report names a payment system among a game studio's design prompts: confirmed. Source: The guides that PLAN.md lists under “Decisions: system design”.
- The guide mentions an inventory as an object-oriented sketch, not clearly a backend system-design prompt: narrowed to Inventory appears as an object-oriented design exercise in this guide, not as a documented backend prompt. Source: The guides that PLAN.md lists under “Decisions: system design”.
- A mobile-system-design framework asks for offline operation using cached data: confirmed. Source: https://github.com/weeeBox/mobile-system-design
- The mobile framework explicitly calls for conflict resolution: confirmed. Source: https://github.com/weeeBox/mobile-system-design
- The mobile framework includes pagination for long feeds: confirmed. Source: https://github.com/weeeBox/mobile-system-design
- The mobile framework includes real-time notifications: confirmed. Source: https://github.com/weeeBox/mobile-system-design
- The mobile framework recommends idempotency keys for safe request retries: confirmed. Source: https://github.com/weeeBox/mobile-system-design
- The mobile framework raises API rate limiting and backoff as client concerns: confirmed. Source: https://github.com/weeeBox/mobile-system-design
- Important game rules must be enforced server-side because a client can bypass local checks: confirmed. Source: https://cheatsheetseries.owasp.org/cheatsheets/AJAX_Security_Cheat_Sheet.html
- A game server must treat client reports as untrusted: confirmed. Source: https://www.gabrielgambetta.com/client-server-game-architecture.html
- Android warns that the wall clock can be reset and jump unpredictably: confirmed. Source: https://developer.android.com/reference/android/os/SystemClock
- Apple documents that a device user can change the system clock in Settings: confirmed. Source: https://developer.apple.com/documentation/foundation/date/systemclockdidchangemessage
- When uncertain in an interview, say how the fact would be checked: confirmed. Source: `content/unity-engineering/01-architecture.md:50`.

### design-estimation

- The Site Reliability Workbook recommends converting a whiteboard design into concrete resource estimates: confirmed. Source: https://sre.google/workbook/non-abstract-design/
- Sound assumptions matter more than exact machine counts in an early estimate: confirmed. Source: https://sre.google/workbook/non-abstract-design/
- A rough rate estimate should change decisions about sharding, caching or horizontal scaling: confirmed. Source: https://www.techgrind.io/system-design/system-design-framework
- Synchronized client behavior can cause overload beyond the routine peak: confirmed. Source: https://sre.google/sre-book/reliable-product-launches/
- Overload can cause failures to cascade as fewer servers carry more requests: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- Retries can keep an overloaded backend overloaded: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/

### design-services-state

- The Twelve-Factor App describes application processes as stateless and share-nothing: confirmed. Source: https://12factor.net/processes
- Persistent application state belongs in a stateful backing service: confirmed. Source: https://12factor.net/processes
- The Twelve-Factor App rejects sticky sessions for ordinary stateless application processes: confirmed. Source: https://12factor.net/processes
- Processes designed for disposal can be started or stopped quickly for scaling and deploys: confirmed. Source: https://12factor.net/disposability
- The API gateway is a single entry point for clients: confirmed. Source: https://microservices.io/patterns/apigateway.html
- An API gateway may authenticate the user and pass an access token to the services: confirmed. Source: https://microservices.io/patterns/apigateway.html
- Cloud Save's default player data is readable and writable by the player's own client: confirmed. Source: https://docs.unity.com/en-us/cloud-save/concepts/player-data
- WebSocket provides two-way communication with the remote host: confirmed. Source: https://www.rfc-editor.org/rfc/rfc6455.html
- The HTTP/1.1 WebSocket handshake begins with an Upgrade request: confirmed. Source: https://www.rfc-editor.org/rfc/rfc6455.html
- RFC 8441 defines an extended CONNECT method for WebSocket over HTTP/2: confirmed. Source: https://www.rfc-editor.org/rfc/rfc8441.html
- An HTTP/2 stream is bidirectional within one HTTP/2 connection: confirmed. Source: https://www.rfc-editor.org/rfc/rfc9113.html
- A reverse proxy must explicitly pass WebSocket Upgrade headers: confirmed. Source: https://nginx.org/en/docs/http/websocket.html
- A reverse proxy tunnels a WebSocket connection after the backend accepts the switch: confirmed. Source: https://nginx.org/en/docs/http/websocket.html
- Redis Pub/Sub categorizes published messages into channels without publishers knowing subscribers: confirmed. Source: https://redis.io/docs/latest/develop/pubsub/
- Redis Pub/Sub has at-most-once delivery, so disconnected subscribers can miss messages: confirmed. Source: https://redis.io/docs/latest/develop/pubsub/
- The database-per-service pattern keeps each service’s data private behind its API: confirmed. Source: https://microservices.io/patterns/data/database-per-service.html
- Fowler describes an operational premium for microservices that favors a monolith for simpler applications: confirmed. Source: https://martinfowler.com/bliki/MonolithFirst.html
- Unity names Cloud Code as a service for running game logic in the cloud: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Authentication offers anonymous, platform-specific and custom sign-in: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Cloud Save stores player progress and statistics independent of device: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Economy supports purchases, currencies and inventory: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Cloud Code runs game logic in the cloud: confirmed. Source: https://docs.unity.com/en-us/cloud-code/get-started
- Cloud Save Protected Player Data is readable by its player but writable only from a server: confirmed. Source: https://docs.unity.com/en-us/cloud-save/concepts/player-data
- Unity currently limits Cloud Save Player Data to 2000 key/value pairs per access class per player: confirmed. Source: https://docs.unity.com/en-us/cloud-save/concepts/player-data
- Unity currently limits Cloud Save Player Data to 5 MiB per access class per player: confirmed. Source: https://docs.unity.com/en-us/cloud-save/concepts/player-data
- Unity currently limits Cloud Code Client API requests per player to 600 per minute: confirmed. Source: https://docs.unity.com/en-us/cloud-code/scripts/reference/limits
- The outline’s suggestion to consider Unity Game Server Hosting as an active service is outdated for Unity 6.3: its upgrade guide gives a March 31, 2026 shutdown: contradicted: Do not list Multiplay Hosting as a currently available Unity service; the Unity 6.3 upgrade guide states its shutdown date. Source: https://docs.unity.com/en-us/engine/6000.3/manual/upgrade-guides/upgrade-guide-unity63
- Unity Leaderboards provides customizable real-time leaderboards: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Remote Config can change feature behavior without an app update: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Lobby helps players connect before or during play: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Relay connects players without a dedicated game server: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Matchmaker is a low-latency matchmaking service: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Friends supports social player connections: confirmed. Source: https://docs.unity.com/en-us/services
- Unity Analytics covers game performance and player behavior: confirmed. Source: https://docs.unity.com/en-us/services
- Unity calls its communication service Vivox Voice & Text Chat: confirmed. Source: https://docs.unity.com/en-us/services

### design-storage

- The Redis commands reference checked here lists Redis 8.10 as its latest command reference: confirmed. Source: https://redis.io/docs/latest/commands/
- A Redis sorted set has unique string members ordered by score: confirmed. Source: https://redis.io/docs/latest/develop/data-types/sorted-sets/
- Redis ZADD is O(log N) for each member added: confirmed. Source: https://redis.io/docs/latest/commands/zadd/
- Redis ZINCRBY is O(log N): confirmed. Source: https://redis.io/docs/latest/commands/zincrby/
- Redis ZSCORE is O(1): confirmed. Source: https://redis.io/docs/latest/commands/zscore/
- Redis ZRANK is O(log N): confirmed. Source: https://redis.io/docs/latest/commands/zrank/
- Redis ZREVRANK is O(log N): confirmed. Source: https://redis.io/docs/latest/commands/zrevrank/
- Redis ZRANGE by rank is O(log N + M), with M returned members: confirmed. Source: https://redis.io/docs/latest/commands/zrange/
- The current PostgreSQL documentation checked here describes major version 18 as of September 2026: confirmed. Source: https://www.postgresql.org/docs/current/tutorial-transactions.html
- PostgreSQL transactions bundle several steps into an all-or-nothing operation: confirmed. Source: https://www.postgresql.org/docs/current/tutorial-transactions.html
- A PostgreSQL CHECK constraint requires a column value to satisfy a Boolean expression: confirmed. Source: https://www.postgresql.org/docs/current/ddl-constraints.html
- A PostgreSQL UNIQUE constraint ensures a column or group of columns is unique among rows: confirmed. Source: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL INSERT ON CONFLICT DO NOTHING skips an insert that would conflict: confirmed. Source: https://www.postgresql.org/docs/current/sql-insert.html
- Redis Cluster uses hash slots rather than consistent hashing: narrowed to Describe consistent hashing as a separate design pattern; Redis Cluster itself uses hash slots. Source: https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/
- Redis Cluster uses 16,384 hash slots with CRC16 modulo 16,384 for key placement: confirmed. Source: https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/
- Karger and coauthors define consistent hashing as changing minimally as the range changes: confirmed. Source: https://people.csail.mit.edu/karger/Papers/web.pdf.
- PostgreSQL streaming replication is asynchronous by default, so committed primary changes appear later on standbys: confirmed. Source: https://www.postgresql.org/docs/current/warm-standby.html
- The delay is typically under one second when the standby keeps up with the load: confirmed. Source: https://www.postgresql.org/docs/18/warm-standby.html
- Adding a node to Redis Cluster moves some hash slots to it: confirmed. Source: https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/
- A hot standby can return an older result than the primary: confirmed. Source: https://www.postgresql.org/docs/current/hot-standby.html
- Read Your Writes is a named session guarantee that reads reflect earlier writes in the session: confirmed. Source: https://www.cs.cornell.edu/courses/cs734/2000FA/cached%20papers/SessionGuaranteesPDIS_1.html
- PostgreSQL point-in-time recovery depends on a continuous sequence of archived WAL files: confirmed. Source: https://www.postgresql.org/docs/current/continuous-archiving.html
- Google SRE describes periodic restore exercises to check whether backups can meet the recovery target: confirmed. Source: https://sre.google/sre-book/data-integrity/
- Google's SRE book quotes the saying that nobody wants backups, and people want restores: confirmed. Source: https://sre.google/sre-book/data-integrity/

### design-caches-queues

- The RabbitMQ documentation checked here is version 4.3.6: confirmed. Source: https://www.rabbitmq.com/docs
- Cache-aside reads from the cache first, then the primary on a miss, and stores the result in cache: confirmed. Source: https://redis.io/docs/latest/develop/use-cases/cache-aside/
- Cache-aside writes the primary and invalidates the corresponding cache key: confirmed. Source: https://redis.io/docs/latest/develop/use-cases/cache-aside/
- A cache entry’s TTL bounds how long stale data can be served: confirmed. Source: https://redis.io/docs/latest/develop/use-cases/cache-aside/
- Expiry of a popular cache entry can send many simultaneous reads to the database: confirmed. Source: https://redis.io/docs/latest/develop/use-cases/cache-aside/
- Redis documents mutex locks and probabilistic early refresh as stampede mitigations: confirmed. Source: https://redis.io/docs/latest/develop/use-cases/cache-aside/
- Apache Kafka 4.3 documents at-least-once delivery by default: confirmed. Source: https://kafka.apache.org/43/design/design/
- With manual acknowledgements, RabbitMQ requeues unacknowledged deliveries after channel or connection closure: confirmed. Source: https://www.rabbitmq.com/docs/confirms
- Kafka describes each stream partition as a totally ordered sequence mapped to a topic partition: confirmed. Source: https://kafka.apache.org/43/streams/architecture/
- Kafka writes events with the same key to the same partition, and a consumer reads a partition's events in the order written; the guarantee is per partition: confirmed. Source: https://kafka.apache.org/43/getting-started/introduction/
- RabbitMQ dead-lettering republishes a queue message to an exchange under documented conditions: confirmed. Source: https://www.rabbitmq.com/docs/dlx
- A quorum queue dead-letters a message returned more times than its delivery limit: confirmed. Source: https://www.rabbitmq.com/docs/dlx
- The transactional outbox stores the event in the database transaction that changes business state, then a separate relay publishes it: confirmed. Source: https://microservices.io/patterns/data/transactional-outbox.html
- An outbox relay may publish a message more than once, so its consumer remains idempotent: confirmed. Source: https://microservices.io/patterns/data/transactional-outbox.html
- SQLite UPSERT omits an insert whose conflict target uniqueness constraint fails with DO NOTHING: confirmed. Source: https://www.sqlite.org/lang_upsert.html
- SQLite added UPSERT in version 3.24.0: confirmed. Source: https://www.sqlite.org/lang_upsert.html
- SQLite changes() returns the number of rows changed by the most recent insert, delete or update: confirmed. Source: https://www.sqlite.org/lang_corefunc.html
- SQLite serializes writes, allowing one writer at a time to a database: confirmed. Source: https://www.sqlite.org/isolation.html

### design-consistency

- Gilbert and Lynch’s 2002 theorem concerns availability and atomic consistency in an asynchronous network where messages may be lost: narrowed to The original PDF was checked, but its text layer did not yield a verifiable quote; this exact theorem statement is in an HTML transcription. Keep the theorem’s atomic-consistency and partition scope. Source: https://mwhittaker.github.io/papers/html/gilbert2002brewer.html
- Brewer’s later explanation says CAP rules out perfect availability and consistency during partitions, not all ordinary operation: confirmed. Source: https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/
- Abadi’s PACELC adds a latency-versus-consistency trade-off when there is no partition: confirmed. Source: https://dbmsmusings.blogspot.com/2010/04/problems-with-cap-and-yahoos-little.html
- Vogels defines eventual consistency: absent new updates, accesses eventually return the last updated value: confirmed. Source: https://www.allthingsdistributed.com/2008/12/eventually_consistent.html
- Read Committed is the default isolation level in PostgreSQL 18: confirmed. Source: https://www.postgresql.org/docs/current/transaction-iso.html
- At Read Committed, an updater waits for a concurrent updater of its target row to finish: confirmed. Source: https://www.postgresql.org/docs/current/transaction-iso.html
- At Read Committed, PostgreSQL re-evaluates an UPDATE search condition against the updated row: confirmed. Source: https://www.postgresql.org/docs/current/transaction-iso.html
- Repeatable Read rolls back an update of a row changed after the transaction began with a serialization error: confirmed. Source: https://www.postgresql.org/docs/current/transaction-iso.html
- SELECT FOR UPDATE blocks other row changes and locks until the current transaction ends: confirmed. Source: https://www.postgresql.org/docs/current/explicit-locking.html
- RFC 9110 says If-Match prevents accidental overwrites, the lost-update problem: confirmed. Source: https://www.rfc-editor.org/rfc/rfc9110.html
- Garcia-Molina and Salem describe compensating transactions to amend a partial saga execution: confirmed. Source: https://www.cs.princeton.edu/research/techreps/598
- Across services, a saga failure triggers compensating transactions that undo earlier steps: confirmed. Source: https://microservices.io/patterns/data/saga.html
- A saga spans a sequence of local transactions: confirmed. Source: https://microservices.io/patterns/data/saga.html

## Rests on documentation alone

- The reported interview format and prompts, mobile design topics, service catalog, Redis commands, PostgreSQL behavior, queue guarantees, RFC behavior, CAP, PACELC, eventual consistency and sagas rest on the linked documentation. The guides report interview practice, not a guaranteed round format.
- There is no live backend, device, or production traffic trace in this evidence. The SQLite duplicate-message lab was run locally and its output is in the receipt JSON.

## Narrowed or cut

- The accessible guides support leaderboard, matchmaking, sessions with disconnects, live events and telemetry as reported prompts. The inventory mention is an object-oriented sketch. Chat, friends, cloud save and economy were not verified as studio-specific system design prompts by a fetchable guide.
- Redis Cluster uses 16,384 hash slots and explicitly does not use consistent hashing. Consistent hashing remains a separate partitioning example.
- The Unity 6.3 upgrade guide gives March 31, 2026 as the Multiplay Hosting shutdown date. Do not present it as an active Unity service.
- Kafka documents at-least-once delivery by default, and RabbitMQ documents redelivery after an unacknowledged consumer disconnect. “Most queues” is broader than these receipts establish.
- CAP is an impossibility result for availability and atomic consistency under partitions. It does not force one permanent two-of-three product label.

## Where the outline fell short

- The gateway roles of TLS termination, token validation, per-player rate limiting and version routing are deployment choices. The API gateway pattern establishes an entry point and routing, but these additional policies need an implementation or configuration before they can be stated as deployed behavior.
- Cloud Save Player Data has client-writable default and public access classes. Protected access or service access controls are needed for values the server must own.
- Read-after-write through a lagging replica can be stale. The chapter should specify a primary read or a version-aware read strategy instead of assuming all reads are current.
- Connection routing, player-key partitioning, per-feature staleness budgets and which store fails first are design decisions to establish from requirements. The linked protocol and product pages do not prescribe one backend topology or universal latency target.
- A cached balance is not authority for a spend. The writer should describe an authoritative transaction or conditional write at the owner of the balance rather than relying on the cache time to live.
- The worked traffic figures are invented estimates and should show their assumptions and arithmetic. They are not measurements or vendor limits.

## Runs

Codex's sandbox ran one: a SQLite script in which a primary key on the message id and `ON CONFLICT DO NOTHING` let a duplicate message grant its reward once. The session ran the rest in its scratchpad, outside the repository.

1. Hash placement: a Python simulation hashed 200,000 keys with SHA-256 and added an eleventh node to ten. With `hash mod N`, 90.8% of the keys changed node. On a ring, 8.8% moved with one point per node and 8.4% with 100, all of them to the new node; with one point per node the eleven nodes held between 0.3% and 30.7% of the keys, and with 100 points, between 7.5% and 11.2%.
2. The reward consumer: the chapter's C# block, copied byte for byte into a .NET 8 console project with Microsoft.Data.Sqlite (bundled SQLite 3.53.3), compiled with warnings as errors and ran against the chapter's schema. A second delivery returned false and granted nothing; a crash before the commit left neither the id nor the coins, and the redelivery granted once; without the insert into `processed_message`, two deliveries granted twice; two deliveries at once, on two connections, granted once; and, after the review's first problem, a message for a player with no wallet threw and left no id recorded.
3. Concurrency: in the same project, the chapter's version-check `UPDATE` changed one row for the first writer and none for the second, leaving version 8; two read-modify-writes of +50 from 100 left 150, and two increments in the `UPDATE` itself left 200. SQLite runs one writer at a time, so this shows the logic of the version check, while PostgreSQL's behavior under concurrency rests on its documentation of Read Committed.
4. The chapter's two SQL blocks ran as printed in the system's `sqlite3` 3.51.0, where the second insert of an id changed no row and the tablet's update changed none.
5. The estimates of the second section were computed by hand and rechecked: 120 million requests a day, about 1,400 a second on average, 22,000 at the event start (rounded to 20,000), 6,700 writes (7,000) and 2,200 sign-ins (2,000) a second, 120 GB of telemetry a day, and a backlog of 600,000 that drains at 1,500 a second in 400 seconds.

No PostgreSQL, Redis or queue server is installed, so none ran; the chapter says where it rests on their documentation.

## The teacher’s read

The blind review (GPT-6 Astra, `xhigh`) ran after the session's edits, in 10 minutes and 183,839 tokens, and reported 10 problems. Nine held and are fixed:

- The reward consumer recorded the message id even when no wallet row existed, so the grant changed nothing, the message was acknowledged, and the reward was lost. `GrantOnce` now throws unless the `UPDATE` changes one row, which rolls the id back and leaves the message unacknowledged, and the lab gives the player a wallet and tries a player without one.
- The trade-off sentence said that reading balances from the primary stops overspending, while two concurrent spends can both read enough coins; the constraint and the conditional debit do that. The example is now a player's own save read from the primary, which protects against a stale reload.
- An explanation said that a version check applies both concurrent grants. It rejects the second writer, which reloads and retries; the increment in the `UPDATE` applies both.
- A distractor, a score sent with a hash, contradicted the section's own teaching that the server checks a submitted score. It is now a score accepted because the client's hash matches.
- The version comparison used the `ETag`, which chapter 8 calls opaque and RFC 9110 compares for equality. The comparison now uses a version number that the server assigns and may put inside the tag.
- The prose said that connections need sticky routing. An open connection stays on its node, and a reconnection can land on any node, which registers the player; the question about sticky routing was replaced with one about reconnecting.
- Telemetry was said to arrive in time order, while chapter 9's offline queue uploads old events late. The prose now separates arrival order from event time.
- A distractor, spare capacity for the garbage collector, was a defensible reason to size above the busiest hour. The stem now asks what sends the request rate above that hour's rate.
- Glossary terms were unlinked at their first mention in three sections. A script then checked every section, and one more, Remote Config, is linked.

The one that did not hold: the Remote configuration entry, written with chapter 10, names Firebase. The book's names rule names the platforms' first-party services, as the briefs name Firebase Cloud Messaging, and the rule against naming cloud products is written for chapters 12 to 14, whose text names none.

The avoid-ai-writing detector, run per section in technical mode and on the nine new glossary entries, before and after the review's fixes, rated each “Minimal AI signals”. What it flagged were known false positives: `{#id}` and `[[#id]]` read as hashtags, “features” as a verb where it is a noun, “genuine” as an intensifier where it means authentic, and low vocabulary diversity. The read for its judgment-only patterns removed a false range, a self-label, a cliché and a “What matters is” lead, and turned period-ended list labels into colon labels.
