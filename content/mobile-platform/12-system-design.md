---
book: unity-mobile-platform-engineering
chapter: 12: System design for game services: method and building blocks
---

## How a game system design round runs {#design-round-method}

The [[#platform-study-method | call path]] ends at the backend, and chapters 8 and 9 stopped at its door: they built the client that talks to it and treated whatever answers as a box behind a documented API. This chapter and the next two open the box. Platform engineers at game studios often own the game's services or share them with backend engineers, and interviews for platform roles include a system design round on game services. This chapter gives the method and the building blocks, chapter 13 designs the core services with them, such as the leaderboard, matchmaking and the economy, and chapter 14 keeps those services running through launches, failures and deploys. The depth is an interview's: the mechanisms, what each choice costs, and numbers from estimates, with the places where a backend specialist goes further named as such.

A design round moves through requirements and scope, estimates, an API and a data model, a diagram, deep dives, and failures and trade-offs. The interviewer steers the deep dives, and a generic guide advises the candidate to drive toward the two or three hardest problems in the design as well. The table below is a schedule to rehearse pacing against, for a round of 45 minutes; the planned column adds up to 45, and the range beside it is the room each stage has. The ranges cannot all be used at their upper ends at once, since together they total 38 to 54 minutes, so a stage that runs long takes its time from another. The split leaves the most time for the deep dives, where most of the judgment shows:

| Stage | What you produce | Planned minutes | Range |
| --- | --- | --- | --- |
| Requirements and scope | The features in and out of scope, the number of players, and the latency and consistency each feature needs | 6 | 5 to 8 |
| Estimates | Requests a second at the average and at the peak, storage and bandwidth, each rounded and with its assumptions | 4 | 3 to 5 |
| API and data model | The calls the client makes, and the records each service keeps, with their keys | 6 | 5 to 8 |
| Diagram | Boxes that each own something, with one request drawn through them | 6 | 5 to 8 |
| Deep dives | Two or three parts that the interviewer picks, taken down to their mechanisms | 18 | 15 to 20 |
| Failures and trade-offs | What fails first, what degrades, and what each choice cost | 5 | About 5 |

The schedule comes from guides to the design rounds of game studios, built from candidates' reports, which describe a round of about an hour, and from generic guides to system design interviews, which plan for 45 minutes. It is what they report rather than a promise any studio makes, and each interviewer bends it.

Candidates report four areas that are graded: gathering the requirements, a clear component diagram, reasoning about scale, and honesty about trade-offs. In practice, that means questions whose answers change the design, a diagram in which each box owns something, numbers behind each claim about scale, and each trade-off stated with what it costs. A box owns something when nothing else touches its data or makes its decision: the economy service is the one writer of the wallet, and the connection tier the one holder of open connections. A box labeled “backend”, with every arrow pointing into it, shows an interviewer that the candidate has not yet decided where anything lives.

The prompts reported for game studios are the game's own services: a leaderboard for millions of players, matchmaking with short waits, a session service that assigns players to servers and handles their disconnects, one live event pushed to millions of connected clients at nearly the same moment, gameplay events collected from clients and made queryable for designers, and, in one candidate's report, a payment system. Chapter 13 designs most of them, with the player data, economy and social features that the same backends hold. The mobile form of the round asks the same kind of prompt from the client's side: what the app does offline, how it syncs and settles conflicts, what it caches, how it pages through a long list, how it learns of changes, and how it retries without doing anything twice or overwhelming its own backend, as [a framework for mobile design rounds](https://github.com/weeeBox/mobile-system-design) lays out. A platform engineer draws both sides and goes deepest where they meet: the API, the retry and [[idempotency]] contract of [[#network-idempotency]], and the versions that old clients still call ([[#http-versioning]]).

A game prompt differs from a generic one in six ways, and each changes the design:

| What is true of a game | What it changes |
| --- | --- |
| The client is untrusted | The server computes or checks each value that matters, such as a score, a balance or a purchase, and the client sends what the player did rather than what it concluded |
| Load arrives in synchronized spikes | The daily reset, an event's start and a push to every player bring huge numbers of players in the same minutes, so capacity is planned for the spike, and work that can wait is queued |
| Old clients stay installed for months | Each API version stays until the clients that call it have gone, as chapter 8 describes |
| Players are in every time zone | “Daily” needs a definition: one reset at a fixed UTC time is simple and brings every player at once, while a reset at each player's local midnight spreads the load and ends the leaderboard's day at a different time in each zone |
| Purchases and progress must not be lost | Money and progress get durable, transactional storage and idempotent writes, while telemetry can afford to lose a little |
| Latency budgets differ by feature | A leaderboard can lag by seconds, while a real-time match cannot lag without the player feeling it, so each feature gets the cheapest design that meets its own budget |

A game's code runs on the player's device, where it can be decompiled, patched or replaced, and its requests can be read, changed and replayed through a proxy. [[TLS]] protects a request from the network, not from the device's owner, and a key compiled into the build proves no more than which app the caller claims to be, as [[#http-sessions]] shows. So the design assumes that any value in a request can be anything: a score of two billion, a negative price, a reward claimed twice, a timestamp from next week. The device's clock is one of those values. Android's reference for `SystemClock` says that the wall clock can be set by the user or by the phone network, so its time can jump backward or forward, and Apple's documentation counts a change that the person using the device makes in Settings among the events that change the system clock. So the server keeps its own time for timers, cooldowns and resets. A request that states the player's intent, such as “claim the reward of mission m-2291”, leaves the server to compute the result from its own records. A request that states a result, such as “set my coins to 5,000”, leaves it nothing to check.

Questions come first because their answers choose the components. Take “design a community event”: for a weekend, each match a player finishes adds points to one shared goal, and rewards unlock for everyone who took part as the total passes each threshold. Five questions change that design the most:

| Question | An answer | What it changes |
| --- | --- | --- |
| How exact and how fresh must the shared total be? | A few seconds behind is fine | Matches add to many counters that are summed every few seconds, instead of all writing one counter |
| Does the event start at the same moment for everyone? | Yes, at 00:00 UTC | The start is a spike to plan for, and the push that announces it goes out over several minutes |
| How many players take part, and how often do they score? | 2 million players, a few matches a day each | The rate of writes to the total, and whether one counter could take it |
| Who is rewarded at a threshold, and how soon? | Everyone who took part, within the hour | A queue of grants, each idempotent for its player and threshold, rather than one loop over millions of players |
| Must players see their own points at once? | Yes | Their own points come from their own record, which is exact, while the shared total lags |

A good question is one whose answer moves a box or an arrow. “Which language will the services be written in?” moves nothing at this stage, while “how fresh must the total be?” decides between a single counter, which every match contends for, and a design that spreads the writes.

The round will reach the edge of what you know, often on purpose. Asked how the database elects a new leader, or how its storage engine lays out pages, the answer that scores is short: name the concept, state the property the design needs from it, and say how you would find out the rest. “That is consensus, and I have not implemented it. This design needs one leader at a time for each player's data, so that two nodes never accept conflicting writes for the same player; I would check how our database elects a leader and what it does with writes during an election.” The first book's opening chapter gives the same advice for any gap: saying that you do not know, and then how you would find out, tells the listener how you work. The properties worth naming are few: whether a committed write survives a crash, which is durability; whether one node at a time accepts the writes for a piece of data, which is a single leader; and whether messages arrive in the order they were sent.

Interview exercise: For “design a weekly leaderboard”, write the five questions you would ask first. Beside each, write two answers an interviewer might give and how each answer would change the design.

?? design-first-questions In “design a community event”, each finished match adds points to one shared goal. Which question changes the design most?
* How exact and how fresh must the shared total be at each moment?
- Which language will the event's services be written in?
- Should the event's banner count down to the start in the client?
- Which HTTP status should the server return for a late match?
- How many engineers will be on call during the event weekend?
> The answer decides between one counter that each match writes, which becomes the design's bottleneck, and counters spread over many keys and summed every few seconds. The language, the banner, a status code and the rota all matter later, and none of them moves a component.

?+ In a cloud save design, which answer from the interviewer changes the design most?
* One account can be played on two devices at once
- Saves are stored as JSON rather than in a binary format
- The save screen shows when the last upload finished
- Each save is compressed before the client uploads it
- The client uploads a save when the player leaves a level
> Two devices writing one account's save means concurrent writers, so the design needs a version on each save and a rule for the conflicts the versions reveal. The format, the timestamp, compression and the moment of upload change the client's code, and none of them adds a component or a rule to the backend.

?+ The interviewer says that ranks on the weekly leaderboard may lag by up to a minute. What does that answer allow?
* Batching score updates into the ranking, instead of one write per score
- Keeping the ranking in object storage, rewritten once a day
- Skipping the check of each score against what a run allows
- Dropping the weekly reset, since the ranks lag in any case
- Serving each player's rank from the client's own copy of the board
> A minute of lag lets the service collect scores and apply them to the ranking in batches, which takes load off the ranking's store. A daily rewrite lags far more than a minute, and validation, the reset and the server's ownership of the ranking stay, since the answer concerns freshness and nothing else.

?+ Why does a candidate ask questions before drawing the first box?
* The answers decide which components the design needs
- The number of questions asked is what the interviewer counts
- The interviewer expects the prompt to be repeated back in full
- The requirements are graded apart from the design that follows
- Questions leave less time for the deep dives, which are risky
> Each answer adds or removes a component: how many players, how fresh a value must be, what is in scope. Drawing first commits to a design that the answers may then contradict. Interviewers grade questions by what they change, not by how many there are.

?? design-untrusted-client At the end of a run, the client sends the run's score to the leaderboard service. What does the design assume about the value?
* A modified client can send any number, so the server checks it
- It is accurate, since the request carries a valid access token
- It is accurate, since TLS keeps anyone from changing it in transit
- It is accurate, since IL2CPP compiles the game into native code
- It is accurate once the client signs it with a key in the build
> The client runs on a device that its owner controls, where code can be patched and requests replayed. A token proves who the player is, TLS protects the request from the network, native code is harder to read but not to change, and a key in the build ships in every copy. The server checks the score against what a run can reach.

?+ A daily reward unlocks 24 hours after the last claim. Which clock decides when the player may claim again?
* The server's, since the player can set the device's clock
- The device's, since it knows the player's own time zone
- The device's, checked against the time of the last push
- Whichever of the two is later, so that neither claims early
- The device's, rounded to the hour to allow for clock drift
> A device's wall clock can be set by the player or by the network, and moving it forward is how a timer is skipped. The server records each claim's time by its own clock and compares the next claim with that. The player's time zone decides when a day starts, which the server can know without trusting the device's clock.

?+ Which request suits a client that the server does not trust?
* `POST /missions/m-2291/claim`, and the server works out the reward
- `PUT /wallet` with the balance that the client computed afterward
- `POST /wallet/add` with the amount the client read from its config
- `PATCH /inventory` with the items the client says the player earned
- `POST /scores`, accepted because the hash the client computed matches
> A request that states the player's intent leaves the result to the server, which looks up the mission, checks that it was completed and not yet claimed, and grants what its own records say. A balance, an amount or a list of items states a result that the server would have to take on trust, and a hash computed by the client proves that the client knew a key, which ships in every copy of the build.

?+ The client reports a completed store purchase, with the purchase's token. What does the server do before granting the items?
* Verifies the purchase with the store's server API
- Grants them, since the store's SDK issued the token
- Grants them if the token parses and has the right fields
- Grants them if the device passes an attestation check
- Grants them after checking the price the client sent
> A token from the client is a claim until the store confirms it, and Google Play's guidance is to verify each purchase through its Developer API on the backend before granting anything. Attestation says that the app and the device look genuine, not that a purchase happened, and a price sent by the client is one more value to check.

## Estimate before you draw {#design-estimation}

An estimate turns “millions of players” into figures that decide the design. It takes a few minutes of the round, it is done aloud, and each figure in it is either an assumption you state or arithmetic on those assumptions. Three formulas cover most of it:

- Requests a second, on average: daily players × sessions per player × requests per session, divided by the 86,400 seconds of a day.
- Storage: bytes per player × players, plus what grows with time, such as telemetry and match history, over its retention period.
- Bandwidth for real-time play: bytes per state update × updates a second × the players who receive them.

The average is the figure that undersizes a backend. Play is not spread evenly over the day: the busiest hour runs at several times the average, and a synchronized moment, such as a daily reset, an event's start or a push sent to every player, multiplies it again for a minute or two; Google's SRE book counts synchronized client behavior among the causes of overload, with machine outages and attacks. A backend that handles the average and fails at the peak fails when the most players are watching, so capacity is planned for the peak and for the spike above it.

Take the book's game with 2 million daily players, 3 sessions a day each, and 20 requests a session, all of them figures invented for the estimate. Its event starts at 00:00 UTC, and a third of the players open the game in the five minutes that follow, each making 10 of a session's requests in that time: sign-in, configuration, profile, inventory, the event's state and its first actions, of which three write, such as the session record and the player's entry into the event:

| Figure | Arithmetic | About |
| --- | --- | --- |
| Requests a day | 2 million players × 3 sessions × 20 requests | 120 million |
| Average | 120 million / 86,400 seconds | 1,400 a second |
| Peak hour | 3 × the average, an assumption to state aloud | 4,000 a second |
| Event start | 670,000 players × 10 requests / 300 seconds | 20,000 a second |
| Writes at the event start | 670,000 players × 3 writes / 300 seconds | 7,000 a second |
| Sign-ins at the event start | 670,000 sign-ins / 300 seconds | 2,000 a second |

The event's first minutes run at about 15 times the day's average and 5 times its busiest hour. Each figure is rounded to one or two significant figures, since the inputs are guesses, and a decision turns on whether a figure is 5,000 or 50,000, not on whether it is 5,000 or 5,300. Rounding also keeps the arithmetic in your head: a day's 86,400 seconds round to 100,000, which gives an average of 1,200 a second instead of 1,400 and changes no decision below. Saying each assumption aloud lets the interviewer correct one input, such as the peak hour's multiple, instead of doubting the whole result. Google's Site Reliability Workbook works through designs the same way in its chapter on [non-abstract large system design](https://sre.google/workbook/non-abstract-design/), turning a whiteboard design into estimates of resources at each step, and it says that the reasoning and the assumptions matter more than any final value.

An estimate is worth its minutes only when a figure decides something. These decide four things:

- Whether one database primary takes the writes: seven thousand writes a second at the event start is a question for the team's own load test, not for a rule of thumb. If the last test put the primary at 5,000, the design spreads the writes over several databases, queues the ones that can wait, or removes some, since the player's entry into the event need not be a write of its own.
- Whether reads need a cache or [[read replica | read replicas]]: most of the event start's reads fetch what every player shares, the event's configuration and its state, so a cache in front of them turns 670,000 database reads into one read of each key each time its cached copy expires.
- Whether a leaderboard fits in one node's memory: a weekly board of 10 million players, at an assumed 100 bytes per entry, holds about 1 GB, which fits; keeping a year of weekly boards in memory would take about 52 GB for data that nobody updates, which argues for moving past weeks to cheaper storage. [[#design-leaderboards | Chapter 13]] measures the bytes per entry.
- How long a queue takes to drain: a queue that ends a spike with 600,000 reward grants waiting, whose consumers process 2,000 a second while 500 a second still arrive, shrinks by 1,500 a second and is empty in about 400 seconds, some 7 minutes. If arrivals do not fall below the consumers' rate, the queue does not empty, and the estimate says so before the players do.

The other two formulas decide where data goes. Profiles, inventories and saves at 20 KB a player, for 10 million players who have ever played, come to 200 GB, which one database holds. Telemetry grows with time instead: 2 million players sending 200 events a day of 300 bytes each add 120 GB a day, about 40 TB a year, which is why events go to an append-only log and [[object storage]], where a retention period bounds the size. For real-time play, a match of 10 players whose server sends each of them a 1,000-byte update 20 times a second sends 200 KB a second; 10,000 matches at once send 2 GB a second, 16 gigabits, a figure that shapes the hosting plan before any code is written.

Exercise: Estimate the peak writes a second at your game's daily reset, with each assumption written beside its figure, and name the component that would fail first.

?? design-average-peak A team sizes its API tier for the daily average: 2 million players × 3 sessions × 20 requests / 86,400 s, about 1,400 requests a second. What does that figure leave out?
* The busiest hour, and synchronized minutes far above even that hour
- The players who install the game and do not open it on a given day
- The size of each request, which matters more than the request count
- The requests' API versions, which split the traffic between services
- Nothing, since the load balancer spreads requests evenly over the day
> The average spreads the day's requests over 86,400 seconds, and players do not. The busiest hour runs at several times the average, and a reset, an event start or a push to all players multiplies that again for minutes. A load balancer spreads requests over instances, not over time.

?+ A third of 2 million players open the game in the five minutes after an event starts, and each makes 10 requests in that time. About how many requests a second reach the backend?
* About 20,000: 670,000 players × 10 requests over 300 seconds
- About 1,400: the day's total is unchanged, so the average holds
- About 2,000: one request for each of the players opening the game
- About 80: 670,000 players × 10 requests over the day's 86,400 s
- About 110,000: 670,000 players × 10 requests in the first minute
> Nearly 7 million requests arrive in 300 seconds, about 22,000 a second, which rounds to 20,000, some 15 times the day's average. Spreading them over the day, or taking the day's total as the guide, hides the minutes that the backend has to survive.

?+ Why is a daily reset at 00:00 UTC harder on the backend than a reset at each player's local midnight?
* It brings players from all time zones in the same few minutes
- UTC timestamps take more storage than local ones on the server
- Local resets let the server skip its nightly reset job entirely
- Players are asleep at 00:00 UTC, so their clients retry at dawn
- The push service throttles sends that are scheduled for 00:00 UTC
> One fixed moment turns the day's players into one spike, while local midnights spread the resets over 24 hours. The price of spreading them is a day that ends at different times for different players, which a global leaderboard has to account for.

?+ The busiest hour runs at three times the daily average. What sends the rate of requests above even that hour's rate?
* A reset, an event start or a push to all players, for a few minutes
- The hour's slowest requests, which hold their connections open longer
- The requests of old clients, which the hour's figure leaves out
- The sessions in the hour, which the figure counts as requests
- Players in several time zones, whose evenings fall in that same hour
> The busiest hour is itself an average, over 3,600 seconds. A synchronized moment brings a large share of the players in a minute or two, well above the hour's rate. Slow requests raise how many are open at once, not how many arrive, and the hour's rate already counts every client version and every time zone that plays in it.

?? design-estimate-purpose An estimate puts a weekly leaderboard at 10 million entries of about 100 bytes each. Which decision does the figure settle?
* Whether the whole board fits in the memory of one node
- Whether each player may see their own rank on the board
- Which sorted-set commands the service is going to call
- How often the client refreshes the board's first page
- Whether the server checks the scores that clients send
> About 1 GB fits in one node's memory, so the board needs no split across nodes, while a year of weekly boards, about 52 GB, would argue for moving past weeks out of memory. Whether players see their rank is a requirement, and the commands, the refresh rate and the checks follow from other decisions.

?+ Writes at an event's start come to about 7,000 a second, and the team's last load test put its database primary at 5,000. What does the estimate settle?
* One primary will not take them, so they are spread, queued or cut
- The primary will take them, since load tests understate capacity
- A read replica will take the writes that the primary has no room for
- A cache in front of the database will absorb the extra writes
- Nothing yet, until the figure is known to three significant figures
> The estimate is above the measured capacity by more than its own error, so the design changes: the writes go to several databases, the ones that can wait go through a queue, or some are removed. A replica and a cache-aside cache serve reads, not writes, and more precision would not change the answer.

?+ Why is precision past one or two significant figures wasted in an interview estimate?
* The inputs are guesses, and decisions turn on the order of magnitude
- Interviewers take marks off for arithmetic that is too exact to follow
- Servers are sold in sizes that go up in powers of ten from the smallest
- Rounding errors cancel out over the several steps of an estimate
- Exact figures take longer to write on the diagram beside each box
> Daily players, sessions and requests are assumptions, so a fourth figure of precision is invented. What an estimate decides, whether one database takes the writes or one node holds the board, depends on the order of magnitude, which rounding keeps.

?+ A spike leaves 600,000 reward grants in a queue. Arrivals fall to 500 a second, and the consumers process 2,000 a second. About how long until the queue is empty?
* About 7 minutes, since the backlog shrinks by 1,500 a second
- About 5 minutes, at the consumers' rate of 2,000 a second
- About 20 minutes, at the arrivals' rate of 500 a second
- About 4 minutes, at the combined rate of 2,500 a second
- It does not empty until the arrivals stop coming in altogether
> The backlog falls by the consumers' rate minus the arrival rate: 2,000 − 500 = 1,500 a second, so 600,000 grants take 400 seconds, about 7 minutes. The figure decides whether more consumers are needed before the players notice the wait.

## Stateless services and where state lives {#design-services-state}

A game's backend has a few tiers, and a request crosses them in order. The first question to ask of each tier is what it keeps between requests:

```text
API calls: any instance can answer
  phone
    -> load balancer
    -> gateway
       (TLS, token, limits, API version)
    -> service instance
       (profile, economy, leaderboard)
    -> databases, caches, queues

Pushed messages: one node holds each connection
  phone <-> connection node (WebSocket)
  connection node <- pub/sub <- any service
```

Clients reach the API through a [[load balancer]], which spreads connections over the instances behind it and stops sending to an instance that fails its health check, and a gateway, the single entry point for clients, which in this design does the work that every request needs before any service sees it. The gateway terminates [[TLS]], checks the access token of [[#http-sessions]], applies rate limits for each player, and routes each request by the API version of [[#http-versioning]]. When the access token is a [[JSON Web Token]] signed by the backend, any gateway instance can check its signature with the backend's key and needs nothing from its neighbors; an opaque token is looked up in a session store that all the instances share. The rate limits are state as well: counts kept in each instance let a player whose requests spread over ten instances send ten times the limit, so a gateway that enforces an exact limit keeps its counts in a shared store. The services behind the gateway receive requests that are already authenticated and within their limits.

A service is stateless when it keeps nothing between requests that another instance could not provide: no session in memory, no file on its own disk, no work waiting in a local list. Any instance can then answer any request, so adding instances adds capacity, and losing one loses only the requests it had in flight, which clients retry under their [[idempotency]] keys ([[#network-idempotency]]). The Twelve-Factor App, a methodology for building services, puts it as processes that are stateless and share nothing, with any data that has to persist kept in a stateful backing service, typically a database. The state lives in databases, caches and queues, which are fewer, run with more care, and scaled by the means the next sections describe.

What makes an instance unsafe to remove is whatever state it holds alone:

- A session kept in its memory: the player's next request lands on another instance and is treated as signed out.
- Writes buffered in memory before they reach the database, which removing the instance loses.
- A scheduled job that runs inside each instance, such as the daily reset: four instances run it four times, so it needs one owner outside them, such as a scheduler, or a lease that one instance takes in the database.
- A file written to its own disk, such as an uploaded save, which no other instance can read.

A cache of data that also lives in the database is safe: an instance that starts empty reads the data again.

One kind of state cannot be moved out of the instance that holds it: an open connection. A game that pushes messages to players, such as chat, an event's start or a friend coming online, keeps a [[WebSocket]] or a long-lived HTTP/2 stream open from each phone. The connection lives on one node of a connection tier for as long as it stays open, since a load balancer keeps each connection on the node it chose, so a message for a player has to reach that node. There are two ways to get it there:

- A routing table: when a player connects, the node records that it holds the player, with an expiry that it renews while the connection stays open, and a sender looks the player up and hands the message to that node.
- [[Pub/sub]]: each node subscribes to a channel for each player it holds, and a sender publishes to the player's channel without knowing where the player is connected.

Redis's Pub/Sub, a common choice for the second, delivers each message at most once: a message published while nobody is subscribed to the channel, such as while the player's phone is between connections, is lost. So a message that has to arrive, such as a chat message, is stored first and pushed second, and a client that reconnects asks for what it missed since the last message it has.

Sticky routing, which sends each of a player's requests to the same instance, is the wrong tool for API calls: it ties each player to one instance, so that removing the instance disturbs its players, and it undoes the point of a stateless tier. The Twelve-Factor App calls sticky sessions a violation of its rules. A connection needs no sticky routing either. It stays on the node that accepted it for as long as it lives, and when it closes, the player's next connection can land on any node, which records the player in the routing table or subscribes to the player's channel. A match is different, since its state lives on one game server, and matchmaking tells each player which server to connect to. When a connection node is shut down in a deploy, its connections close, and its clients would all reconnect in the same second. So each client waits a random delay before reconnecting, the jittered backoff that [[#network-retries]] recaps, which spreads the node's thousands of players over its neighbors.

How many deployables the backend has is a decision about the team more than about the diagram. A modular monolith is one deployable whose modules own their data and call each other through interfaces, which gives a small team one thing to build, deploy and debug. Separate services let teams deploy on their own schedules and let one service fail without the others, at the price of network calls between them, versioned APIs inside the backend, and more to run. Martin Fowler describes that cost as a premium for managing a suite of services, one that slows a team down and favors a monolith for simpler applications. A small team runs a few larger services well. Either way, each service or module owns its data, and no two of them write the same table: the economy is the one writer of the wallet, and a leaderboard that shows names asks the profile service for them, or keeps a copy that the profile's change events update.

Some of the backend can be bought. A managed game backend sells the common services ready-made. Unity's is [[Unity Gaming Services]], whose catalog in September 2026 listed Authentication, Cloud Save, Economy, Leaderboards, [[remote configuration | Remote Config]], Lobby, Relay, Matchmaker and Friends, with Cloud Code for the game's own logic, run in Unity's cloud as serverless functions; other vendors sell similar suites. Buying saves the building and the running, and it constrains the design in return. Before choosing one, check:

- that its data model fits the game's queries, such as a leaderboard's weekly resets and tiers, or an economy's currencies and purchases;
- its documented limits against the estimate's peak: in September 2026, Cloud Save allowed each player 5 MiB of data in each access class, and Cloud Code's client API allowed each player 600 requests a minute;
- the price at the game's daily players and at its peak, and what happens above a quota;
- that the rules the client is not trusted with can live on the server: Cloud Save's default player data is writable by the player's own client, and its protected class is writable from a server alone, which suits a value such as a balance;
- how the data can be exported, in which regions it is stored, and what happens if a service is withdrawn, as Unity's game server hosting was on March 31, 2026, by the upgrade guide for Unity 6.3;
- what its SDK adds to the build, as [[#sdk-evaluation]] checks for any SDK.

Exercise: Draw the tiers of a game backend you know, and mark where each kind of state lives: sessions, player data, caches, queued work and open connections. Then circle the instances that could be removed at any moment without losing anything.

?? design-stateless-scaling An API service keeps each signed-in player's session in its own memory. The load balancer sends the player's next request to a different instance. What happens?
* That instance has no such session, and the player is treated as signed out
- The load balancer forwards the session along with the request
- The instance copies the session from its neighbor, a little later
- The gateway routes the request back to the first instance
- The request waits in a queue until the first instance is free
> The session exists in one instance's memory, and the request reached another. Nothing in a load balancer or a gateway copies memory between instances, so the fix is to keep sessions in a shared store, or in a signed token that any instance can check.

?+ Which of these makes an API instance unsafe to remove at a moment's notice?
* Score writes buffered in its memory, not yet in the database
- A copy of the shop's catalog, which the database also holds
- A pool of open connections to the database that it reads from
- The public keys it uses to check access tokens, fetched at start
- The thread pool that it uses to handle requests in parallel
> Buffered writes exist nowhere else until they are flushed, so removing the instance loses them. A cached catalog and fetched keys are loaded again by the next instance, and connections and threads hold no data of their own.

?+ The daily reset runs on a timer inside each API instance. With four instances running, what happens at the reset?
* It runs four times, once inside each instance
- It runs once, since all four instances read the same clock
- It runs on the first instance to start, and the others skip it
- It runs once, on the instance that the load balancer picks
- It runs on none of them until a request arrives to trigger it
> Each instance runs its own copy of the timer, so the job runs once per instance. A job that has to run once needs one owner: a scheduler outside the instances, or a lease that one instance takes in the database before it starts.

?+ An instance crashes with requests in flight. In a stateless design, what happens to those requests?
* They fail, and clients retry them elsewhere under the same keys
- They are lost for good, along with the data the instance held
- They finish on a standby that mirrors the instance's memory
- They wait in the gateway until the instance is restarted
- They continue on another instance, which resumes their progress
> A stateless instance holds nothing that another instance cannot provide, so a crash costs its requests in flight and nothing more. Their clients see errors or timeouts and retry, and the idempotency keys make a retry of a write that had been applied return its recorded result.

?? design-connection-routing Player A sends a chat message to player B. A's WebSocket is held by node 1 and B's by node 7. How does the message reach B?
* Through a channel for B, which node 7 subscribed to when B connected
- Node 1 opens a connection to B's phone and sends it directly
- The load balancer copies it to the node that B's traffic used last
- B's client fetches it from node 1 over the connection it keeps
- Node 1 stores it until B's next session reaches node 1 instead
> A connection lives on one node, so a message for B has to reach node 7. Pub/sub does it without the sender knowing where B is: node 7 subscribed to B's channel when B connected, and pushes whatever arrives down B's connection. The backend does not open connections to phones, and B keeps no connection to node 1.

?+ What does the connection tier record when a player connects, so that services can reach them later?
* The node holding the connection, with an expiry it keeps renewing
- The phone's IP address, so that a service can connect to the phone
- The load balancer's address, which forwards messages to the player
- The access token, so that any node can send messages to the player
- The time of the connection, so stale connections can be found
> A message for the player has to reach the node that holds the connection, so the tier records which node that is, and the expiry cleans up after a node that dies without removing its entries. Each phone opens its own connection and the backend does not connect to phones, while a token proves identity, not location.

?+ A message is published while its recipient's phone is between connections. With Redis's Pub/Sub, what happens to it?
* It is lost, so a chat stores each message before it publishes it
- It waits in the channel until the recipient subscribes again
- It moves to the recipient's next node when they reconnect
- It is delivered twice, once to each of the recipient's nodes
- It is refused, and the sender retries until someone listens
> Redis's Pub/Sub delivers each message at most once, to the subscribers of that moment, and keeps nothing for those who are away. Anything that has to arrive is written to storage first, and a client that reconnects asks for what it missed.

?+ A player's WebSocket drops, and the client reconnects to a different node. What keeps messages reaching the player?
* The new node records the player, or subscribes to the player's channel
- The load balancer sends the player back to the node that held the connection
- The old node forwards each message to the new node from then on
- The connection resumes on the new node from where it left off
- Services send the messages to the phone's new IP address directly
> A closed connection ends on its node, and the next one can land on any node. The node that accepts it registers the player, in the routing table or by subscribing to the player's channel, so that senders reach the new node, and the client asks for what it missed. A WebSocket does not move between nodes, and the backend does not connect to phones.

## Storage chosen by access pattern {#design-storage}

A design picks its stores from its queries, not from the products the team likes best. A game's backend asks five kinds of question of its data, and each has stores that fit it:

| Access pattern | Examples | A store that fits |
| --- | --- | --- |
| By player id | Profile, inventory, cloud save, settings | A key-value or document store keyed by player id, or a relational table with the player id as its key |
| By rank | Leaderboards | An in-memory [[sorted set]], such as Redis's |
| By time | Telemetry, logs, match history | An append-only log, then [[object storage]] and a warehouse that queries it by time |
| By relationship | Friends, guilds, blocks | Relational tables indexed on both players' ids, or a graph store where queries go several hops deep |
| Money that moves atomically | Wallets, purchases, trades | A relational database with transactions and constraints, such as PostgreSQL |

Most of a game's data is read and written by player id: one player's profile, inventory or save, whole or in part, found by one key. A key-value or document store does that well at any scale, and so does a relational table whose key is the player id. Ranks are different, because each new score changes the ranks of the players below it. A sorted set keeps unique members ordered by a score, as [Redis's description of the type](https://redis.io/docs/latest/develop/data-types/sorted-sets/) puts it. In Redis, adding or updating a member (`ZADD`) and finding a member's rank (`ZREVRANK`, which counts from the highest score) each take O(log N) time for N members, and reading a page of M entries from the top (`ZRANGE` with `REV`) takes O(log N + M). A relational query that counts the players above a score does work that grows with the rank, which is the difference that matters on a board of millions. [[#design-leaderboards | Chapter 13]] builds the leaderboard on a sorted set.

Money is the other special case. A purchase that debits coins and grants an item has to happen whole or not at all, and a balance must not go below zero, whatever order two spends arrive in. A relational database gives both: a transaction bundles several statements into one all-or-nothing operation, as [PostgreSQL's tutorial](https://www.postgresql.org/docs/18/tutorial-transactions.html) explains, and a `CHECK` constraint refuses a negative balance inside it. That constraint is the rule for spending, which is all that this chapter's examples need. [[#design-economy | Chapter 13]] refines it once refunds enter: a refund of coins that were already spent has to be recorded even when it leaves a balance below zero, so there the rule moves from the wallet to the spend, and the two designs answer two different requirements. Telemetry needs the opposite: its events are appended as they arrive, never updated, and read in bulk by time range, which is what an append-only log and files in object storage are built for. Arrival order is not event order, since a phone that was offline uploads its queued events late, so queries select by the time each event records and allow for stragglers.

One database serves the game until the estimate says it will not: more writes than one primary takes, or more data than one machine holds. The data is then split into partitions, also called shards, each on its own node, and a record's key decides which partition holds it. Partitioning by player id spreads the players evenly and keeps all of one player's operations on one partition, where a transaction still works. Operations between players cross partitions: a trade, a gift, a guild's shared bank. Each needs a design of its own, and two are common. One owner takes the operation over, such as a trade service that holds both players' items while the trade runs. Or the operation becomes two [[idempotent]] steps, a debit from one player and a credit to the other, each recorded under the operation's key, with a record of which steps are done, so that a failure halfway can be finished or undone: a [[saga]], which the last section of this chapter returns to.

Partitions spread load only as well as the keys do. A hot key is a single key that takes a large share of the traffic, and the one node that holds it takes that share alone: a global counter that every match adds to, one guild with a hundred thousand members, the top page of a global leaderboard that every results screen reads. The fix depends on the direction of the traffic. Writes to a hot counter are spread over many sub-counters, one chosen at random for each write and all of them summed when the total is read, which is how the community event of [[#design-round-method]] lets its shared total lag by seconds. Reads of a hot page are cached, so that the store sees one read each time the cached copy expires.

### Which node holds a key

Which node holds a key is decided by hashing the key. The simplest rule is `hash(key) mod N`, where N is the number of nodes. Take twelve keys whose hashes are 0 to 11, on three nodes: key 7 goes to node 1, since 7 mod 3 is 1. Add a fourth node, and the rule becomes mod 4, so key 7 goes to node 3. Only keys 0, 1 and 2 stay where they were, and the other nine move. That is the problem with the rule: adding a node makes most of the data change hands. In a simulation with 200,000 keys, adding an eleventh node to ten moved 91% of them.

Consistent hashing, named here, places the nodes and the keys on one ring of hash values, and each key belongs to the next node along the ring. Take a ring of positions 0 to 99 with node A at 10, node B at 40 and node C at 70. Keys at 5, 20, 35, 50, 65 and 90 belong to A, B, B, C, C and A, since the ring wraps from 99 back to 0. Add node D at 55. Only the keys between B and D can change owner, which here is the key at 50, and it moves from C to D; the other five stay. A new node takes over only the keys between it and its neighbor: 8% of the keys in the same simulation, all of them moving to the new node.

One point on the ring for each node gives uneven shares, since the gaps between points differ: in the example, C holds the stretch from 41 to 70 and B only the stretch from 11 to 40. So each node takes many points on the ring, and the gaps average out. In the simulation, with one point each the eleven nodes held between 0.3% and 31% of the keys, and with 100 points each, between 7.5% and 11.2%. Redis Cluster, whose documentation says that it does not use consistent hashing, reaches the same end with hash slots: each key hashes to one of 16,384 slots, and adding a node moves some whole slots to it.

### Replicas and backups

A partition is copied to [[read replica | replicas]], to survive the loss of its node and to serve reads. Replication is usually asynchronous: the primary commits a write and sends it to the replicas afterward, so a replica runs behind the primary, by under a second in [PostgreSQL's description of streaming replication](https://www.postgresql.org/docs/18/warm-standby.html) when the replica keeps up with the load, and by more when it does not. A read from a replica can therefore miss a write that has already succeeded. A player saves, the save commits on the primary, the reload is served by a replica that has not applied it yet, and the player sees the old save: the design has broken read your writes, the guarantee that a session's reads reflect its own earlier writes. Two fixes are common. Reads of a player's own data go to the primary, and the replicas serve what other players see, such as profiles and leaderboard pages. Or reads compare versions: each write raises a version number kept with the record, the client sends the number its last write created, and a service that finds a lower number on a replica reads the primary instead. The `ETag` of chapter 8 is opaque to the client, which can compare two tags for equality and nothing more, so the ordering needs a number that the server assigns, which it may also put inside the tag.

Replication copies mistakes as faithfully as it copies writes: a bad deploy that corrupts saves writes the corruption to every replica within a second. Backups keep the past. A periodic base backup, plus the log of every write since, lets [PostgreSQL's point-in-time recovery](https://www.postgresql.org/docs/18/continuous-archiving.html) restore a database to a chosen moment, such as the minute before that deploy. Google's SRE book quotes the saying that nobody wants to make backups, and what people want are restores, and its teams test their restores on a schedule. A restore that has never been tried is not a backup, since nobody knows how long it takes or whether it works.

Exercise: List the ten queries your game's backend runs most, and write beside each the store and the key it needs. Then mark the ones that would cross partitions if the data were split by player id.

?? design-storage-access-pattern The results screen shows each player's rank among 5 million players on this week's board. Which store answers it well?
* An in-memory sorted set, where a rank lookup takes logarithmic time
- A relational table, counting the rows with a higher score each time
- A key-value store keyed by player id, holding each player's rank
- Object storage, with the whole board rewritten as one file an hour
- A document store that keeps the board as one document, sorted by score
> A sorted set keeps its members in score order, so finding one member's rank takes O(log N) time, and a new score updates one entry. Counting rows does work that grows with the rank, stored ranks change for many players at each score, an hourly file is an hour stale, and one sorted document is rewritten whole at each score.

?+ Which store suits a player's coin balance and the record of each change to it?
* A relational database, with each change and its record in one transaction
- An in-memory sorted set, with each balance stored as a player's score
- A cache with a time to live, written back to the database each minute
- Object storage, with one file per player that each spend replaces
- A document store that any service granting coins writes to directly
> A spend debits the balance and records why in one all-or-nothing step, and a constraint refuses a balance below zero, which a relational database gives. A cache written back each minute can lose a minute of spending, and several services writing one store leave nobody owning its rules.

?+ The game's 2 million players send 200 telemetry events a day each. Where do the events go?
* A log appended as events arrive, then object storage queried by time
- The player database, one row for each event under the player's id
- A sorted set per player, with each event scored by its timestamp
- The cache, with a time to live of one day on each of the events
- The wallet's ledger, so that each event is kept inside a transaction
> Telemetry is appended as it arrives, is not updated, and is read in bulk by time range, which is what logs and object storage serve. In the player database, 400 million rows a day would compete with the writes that players are waiting for.

?+ Which access pattern does cloud save follow?
* By player id: one key finds the one save that is read and written
- By rank: saves are ordered by how far each player has progressed
- By time: saves are read back in the order in which they were written
- By relationship: a save is found through the player's friends list
- By atomic money: each save moves currency between two accounts
> A save belongs to one player and is read and written through that player's id, so a key-value or document store, or a table keyed by the player id, serves it. Concurrent writers to the same save are handled with a version on each save.

?? design-read-your-writes A player saves, reloads at once, and sees the old save. The server's logs show that the save committed on the primary and that the reload was read from a replica. What happened?
* The replica had not applied the write when it served the read
- The primary lost the write after it had committed and replied
- The client's cache returned the save it held before the upload
- The replica refused the write, since replicas take no writes
- The load balancer sent the reload to a server in another region
> Replication is asynchronous: the primary commits first and sends the change afterward, so a replica runs behind it, and a read that reaches the replica in that window misses the player's own write. The logs rule out a cache or a lost write, and replicas receive their writes from the primary rather than from clients.

?+ [multi] A player's reload is served by a lagging replica and misses the save they just made. Which two changes stop that?
* Reading the player's own data from the primary
* Reading the primary when the replica is behind the last write
- Adding more replicas, so that each of them carries less of the load
- Retrying the save until a replica reports that it holds the write
- Lengthening the cache's time to live for the saves that it holds
> The problem is a read that reaches a copy behind the player's own write. Reading one's own data from the primary avoids the copies, and comparing the replica's version with the client's last write detects a copy that is behind. More replicas lag just as much, a retried save writes again without changing where the read goes, and a longer cache holds stale data longer.

?+ Which read can a replica serve without the player noticing its lag?
* Another player's public profile, a few seconds old
- The player's balance, just before the shop approves a spend
- The save the player uploaded a moment ago, on the reload
- Whether this purchase token has been granted already
- The player's inventory, right after they claim a reward
> A replica runs behind the primary, so it suits data that nobody has just written and expects to see: another player's name or avatar is the same a few seconds later. The others are the player's own writes, or checks that a stale answer would get wrong.

?+ How does comparing versions stop a player from reading an old copy of their own save?
* Reads that find a copy behind the client's write go to the primary
- The replica waits for the primary to confirm each read before it answers
- The primary refuses reads that name a version older than its latest one
- The client throws away any response whose version it has not seen before
- The replica raises its own version on each read to stay in step
> The client knows the version number its last write created. A service that reads a replica and finds a lower number knows the copy is behind, and reads the primary instead, while other players' reads stay on the replicas.

## Caches, queues, and events {#design-caches-queues}

A cache keeps copies of data in memory, nearer and faster than the store that owns it. A common arrangement is cache-aside, as [Redis's guide to the pattern](https://redis.io/docs/latest/develop/use-cases/cache-aside/) describes it. On a read, the service looks in the cache first; on a miss, it reads the database and stores the result in the cache with a time to live, after which the entry expires. On a write, it updates the database and deletes the cache entry, so that the next read loads the new value. The time to live bounds how stale an entry can get when an invalidation is missed, such as a price that a support tool changes in the database without touching the cache.

What may be served stale is decided for each kind of data, by what a stale value costs:

| Data | Cached? | Why |
| --- | --- | --- |
| Configuration, [[remote configuration]] and catalogs | Yes, for minutes | Many players read them, they change rarely, and a change can wait for the expiry |
| Leaderboard pages | Yes, for seconds | Everyone reads the top, and a rank a few seconds old harms nobody |
| Other players' profiles | Yes, for a minute | A name or an avatar a minute old is still right in all that matters |
| A balance before a spend | No | The spend checks the balance in the database, inside the transaction that debits it |
| Whether a purchase was granted | No | A stale “not yet” grants the purchase twice |

A hot key's expiry is a small spike of its own. When the cached entry for the event's configuration expires, each request that misses in the next moment reads the database, and a thousand requests a second become a thousand database reads in the same second: a cache stampede. Two fixes prevent it. Coalescing lets one request load the value while the others wait for its result, the single flight that [[#http-sessions]] uses for the token refresh. Refreshing early reloads a hot entry shortly before it expires, so that it never goes missing. Serving the stale value while one request loads the new one combines the two. A [[CDN]] is a cache as well, for static content at the edge of the network, close to players: asset bundles, images, downloadable content. [[#design-live-events | Chapter 13]] puts the game's remote content on one.

A queue sits between a producer and a consumer. The producer adds a message and goes on with its work, and the consumer takes messages at its own rate. That decouples the two in time: a spike of 20,000 reward grants a second is absorbed by the queue, and the consumers work through it at the rate the database can take. The consumers' rate sets the drain time, the backlog divided by how much faster the consumers go than the arrivals, as [[#design-estimation]] works out. A backlog that grows faster than it drains is an outage in slow motion: nothing fails, and players wait a little longer each minute for rewards that have not arrived.

A queue that must not lose messages delivers them at least once. The consumer acknowledges each message after processing it, and a message whose acknowledgement never comes, because the consumer crashed or lost its connection first, is delivered again. Kafka's documentation, for one, gives at-least-once delivery as its default. So a message can arrive twice when every part works as designed: the consumer granted the reward, then died before it acknowledged the message. The consumer is therefore [[idempotent]] for the message's id, which is the key of [[#network-idempotency]] applied on the server. It records each id it processes, in the same transaction as the work, and a second delivery finds the id and changes nothing:

```sql
CREATE TABLE wallet (
  player_id TEXT PRIMARY KEY,
  coins INTEGER NOT NULL
);

CREATE TABLE processed_message (
  message_id TEXT PRIMARY KEY
);
```

```csharp
// Grants a message's reward once, however many times the queue delivers the message.
public static bool GrantOnce(DbConnection db, string messageId, string playerId, int coins)
{
    using DbTransaction transaction = db.BeginTransaction();

    using DbCommand mark = db.CreateCommand();
    mark.Transaction = transaction;
    mark.CommandText = "INSERT INTO processed_message (message_id) VALUES (@id) ON CONFLICT (message_id) DO NOTHING";
    AddParameter(mark, "@id", messageId);
    if (mark.ExecuteNonQuery() == 0)
        return false; // a repeat: the reward was granted before, so nothing changes

    using DbCommand grant = db.CreateCommand();
    grant.Transaction = transaction;
    grant.CommandText = "UPDATE wallet SET coins = coins + @coins WHERE player_id = @player";
    AddParameter(grant, "@coins", coins);
    AddParameter(grant, "@player", playerId);
    if (grant.ExecuteNonQuery() != 1)
        throw new InvalidOperationException("No wallet for player " + playerId); // rolls back the id as well

    transaction.Commit(); // the id and the coins commit together, or neither does
    return true;
}

static void AddParameter(DbCommand command, string name, object value)
{
    DbParameter parameter = command.CreateParameter();
    parameter.ParameterName = name;
    parameter.Value = value;
    command.Parameters.Add(parameter);
}
```

The consumer acknowledges the message after `GrantOnce` returns, whichever value it returns: a repeat is acknowledged too, or the queue would deliver it again and again. An exception acknowledges nothing. The transaction rolls back, taking the recorded id with it, so a message for a player with no wallet is delivered again rather than marked as done, until the dead-letter queue below takes it. The code is written against ADO.NET's `DbConnection` and runs here against SQLite, and PostgreSQL's documentation gives the same `ON CONFLICT … DO NOTHING` clause.

Order holds within a partition, not across partitions. Kafka writes events with the same key to the same partition, and a consumer of that partition reads them in the order they were written; the guarantee is stated per partition. So messages that must stay in order, such as one player's grants and spends, share a partition key, the player id. A message that fails each time it is processed, a poison message, would block its partition or go round forever; after a set number of attempts, the queue moves it to a dead-letter queue, where it waits for a person or a tool, and the messages behind it move on. A dead-letter queue that nobody watches is where rewards disappear, so its size is an alert.

[[Pub/sub]] fans one message out to many subscribers: a completed purchase is one event, and the ledger, the analytics pipeline and the notification service each receive their own copy. The hard part is publishing it at all. A service that commits the purchase to its database and then publishes the event can die between the two, and the event is lost; one that publishes first and commits second can announce a purchase that never happened. The outbox pattern, named here, closes the gap: the service writes the state change, and the event as a row of an outbox table, in one transaction, and a relay reads the table and publishes each row. A process that dies between the two loses neither, since the event sits in the database beside the change. The relay can publish a row twice, when it dies after publishing and before marking the row as sent, so the consumers of an outbox are idempotent too.

### Lab: run the consumer locally

The lab needs no message broker. A queue's job here is only to deliver a message, wait for an acknowledgement and deliver again if none comes, and a few lines of your own code can do that. Create a console project (`dotnet new console`), add the SQLite provider for .NET (`dotnet add package Microsoft.Data.Sqlite`, a one-time download), and put `GrantOnce` and `AddParameter` from above in the same `Program.cs`, below the setup code that follows and without the `public` on `GrantOnce`, since in a file of top-level statements both become local functions and C# refuses `public` there, with `using System.Data.Common;` and `using Microsoft.Data.Sqlite;` at the top. A test setup opens an in-memory database, which lives as long as its connection stays open, and creates the two tables:

```csharp
using SqliteConnection db = new SqliteConnection("Data Source=:memory:");
db.Open();
// Run the two CREATE TABLE statements above with db.CreateCommand() and ExecuteNonQuery().
// Then insert one wallet: INSERT INTO wallet (player_id, coins) VALUES ('p1', 100)

var acknowledged = new HashSet<string>(); // stands in for the queue's record of finished messages

// One delivery: process the message, then acknowledge it, unless the consumer "crashes" first.
void Deliver(string messageId, string playerId, int coins, bool crashBeforeAck = false)
{
    GrantOnce(db, messageId, playerId, coins);
    if (!crashBeforeAck)
        acknowledged.Add(messageId);
}
```

A message that is not in `acknowledged` is one the queue would deliver again, so a test redelivers it by calling `Deliver` a second time. Read the results back with `SELECT coins FROM wallet WHERE player_id = 'p1'` and `SELECT COUNT(*) FROM processed_message`. The invariant is that each message changes the wallet at most once and leaves its id recorded exactly when it did.

Lab exercise: Run these cases and check the numbers. First, with the wallet at 100 coins, deliver message `m1` for 50 coins to `p1` twice: the coins read 150 after both deliveries, and `processed_message` holds one row. Second, deliver `m2` for 50 coins with `crashBeforeAck` set to true, then deliver `m2` again as the queue would: the coins go from 150 to 200 on the first delivery and stay at 200 on the second, the message is acknowledged only by the second, and the table holds two rows, `m1` and `m2`. Third, deliver `m3` for a player `p2` who has no wallet: `GrantOnce` throws, the coins of `p1` stay at 200, and the table still holds two rows, so no id was recorded for `m3`. Last, remove the insert into `processed_message`, repeat the first case with a new message id, and watch the second grant appear.

?? design-cache-staleness Which read may a cache serve a minute out of date?
* The top 100 of the global leaderboard, on the home screen
- The coin balance that the shop checks just before a spend
- Whether a purchase token has already been granted its items
- The player's own inventory, straight after a purchase lands
- The count of a limited offer's remaining stock, before a sale
> The top of a leaderboard is read by many players, and ranks a minute old mislead nobody about anything that matters. A balance before a spend, a grant check and a remaining stock decide what the server does next, and a player's own inventory after a purchase is a write they expect to see.

?+ The shop reads a player's balance from the cache, and then debits the database. What goes wrong?
* A stale balance approves a spend larger than the coins the player has
- The cache's copy of the balance is refreshed twice for each spend
- Nothing, since the cache entry expires within its time to live
- The debit is written to the cache in place of the database
- The spend takes longer than a read from the database would
> The cached balance may predate the player's last spend, so the check passes on coins that are gone. The check belongs in the database, in the same transaction as the debit, with a constraint that refuses a balance below zero.

?+ The cached configuration of an event expires, and 3,000 requests miss in the same second. What stops all of them reaching the database?
* One load for the misses, or a refresh before the entry expires
- A longer time to live, so that the hot entry expires less often
- More read replicas, so that the database can take all the misses
- A retry with backoff in the client whenever the read is slow
- Deleting the entry on each write, so that the value stays current
> Coalescing turns the misses into one load, and an early refresh keeps the entry from going missing at all. A longer time to live makes the stampede rarer, not smaller, replicas spread the same 3,000 reads, and retries add to them.

?+ A support tool changes an offer's price directly in the database, and the server's cache-aside entry for the offer is left alone. How long can players see the old price?
* Until the entry's time to live runs out, since nothing deleted it
- Until the next deploy, which restarts the cache with empty entries
- Not at all, since a cache-aside read goes through to the database
- Until each player restarts the game and clears the client's copy
- Until the replicas catch up with the primary, within a second
> Cache-aside reads the database on a miss, and there is no miss while the entry lives. The service's own writes delete the entry, and a write made around the service does not, so the time to live is what bounds the staleness.

?? design-at-least-once Why must a queue's consumer tolerate receiving the same message twice?
* A message whose acknowledgement is lost is delivered again, done or not
- Producers send each message twice, so that the queue loses none of them
- Queues copy each message to two partitions to keep them in order
- Consumers read each message once to check it and once to process it
- Queues deliver each message to all consumers, including earlier ones
> A queue that must not lose messages redelivers any message it has not seen acknowledged, and it cannot tell a consumer that crashed before the work from one that crashed after it. So a message can arrive twice even when each part behaves as designed, and the consumer makes the second delivery harmless.

?+ A consumer grants a reward, commits, and crashes before it acknowledges the message. What happens next?
* It is delivered again, and without a record of its id it is granted twice
- The queue drops the message, since the consumer's connection closed
- The queue moves the message to its dead-letter queue straight away
- The queue holds the message until that same consumer is back up
- The database rolls back the grant, since the message was not acknowledged
> The queue saw no acknowledgement, so it delivers the message to a consumer again, and the commit has already happened. A consumer that records the message id in the grant's transaction finds it on the second delivery and does nothing.

?+ Which change makes a reward consumer safe when a message arrives twice?
* A unique constraint on the message id, written in the grant's transaction
- Acknowledging each message first, and granting its reward afterward
- Keeping the ids of processed messages in the consumer's memory
- Waiting a second before each grant, so that duplicates arrive first
- Retrying each grant until the database reports that it succeeded
> The constraint makes the second insert of an id do nothing, and the transaction ties that insert to the grant, so both happened or neither did. Acknowledging first loses the reward when the consumer crashes, ids in memory vanish with the process and differ between consumers, and waiting does not stop a later duplicate.

?+ An outbox relay publishes an event and dies before it marks the row as sent. What happens when the relay restarts?
* It publishes the event again, so its consumers receive it twice
- It skips the event, since the queue already holds a copy of it
- It rolls back the state change that the event describes
- It loses the event, since the relay's memory held the row
- It waits until each consumer confirms before it publishes again
> The row still says unsent, so the relay publishes it again: the outbox turns a lost event into a repeated one. That is why the consumers of an outbox record the ids they have processed, like any consumer of a queue that delivers at least once.

## Consistency, concurrency, and the trade-off said aloud {#design-consistency}

Consistency is chosen per feature, because its cost differs from one feature to the next. A strongly consistent read returns the latest committed write. An eventually consistent read may return an older value, and returns the latest once writes stop and the copies catch up, which is how Werner Vogels defined eventual consistency in 2008. Strong consistency costs latency, and availability during failures; eventual consistency costs the moments in which players see different values. A game needs both:

| Feature | Consistency | What the player sees where it is relaxed |
| --- | --- | --- |
| Balances, purchases, inventory | Strong | Nothing: a spend reads the balance it debits, in one transaction |
| Leaderboards | Eventual | A rank a few seconds old |
| Friend and follower counts | Eventual | A count that catches up within seconds |
| Presence | Eventual | A friend shown online for a moment after leaving |
| Cloud save | Strong for the player's own writes, with a version check | A conflict to settle instead of a silent overwrite |

CAP names the limit behind the choice. Gilbert and Lynch proved in 2002 that in an asynchronous network, where messages can be lost, a replicated read and write store cannot guarantee both an answer to every request and atomic consistency, under which each read sees the latest completed write. During a network partition, when copies of the data cannot reach each other, each side either answers, and may then disagree with the other, or waits, and stays consistent. Eric Brewer, who first stated the conjecture, later stressed that the choice arises during partitions, which are rare, and that at other times a system need not give up either. PACELC, Daniel Abadi's extension of CAP and named here, adds the normal case: if there is a Partition, a system trades Availability against Consistency; Else, when nothing is broken, it trades Latency against Consistency, since keeping copies in step costs time on each write.

Most conflicts in a game are not partitions but concurrent writers to one player's data: the player's phone and tablet, a server job that grants the season's rewards, a support agent restoring lost items. A read-modify-write, in which a writer reads a record, changes it in memory and writes it back, loses an update when two of them overlap: both read version 7, both write, and the second write erases the first. RFC 9110 calls it the lost update, and the `If-Match` of [[#http-semantics]] is how HTTP prevents it.

Optimistic concurrency detects the overlap when it writes, instead of preventing it. Each record carries a version, and a write succeeds only if the version is still the one the writer read:

```sql
-- The phone read save version 7 and uploads its change.
UPDATE save
SET data = '{"level":12}', version = version + 1
WHERE player_id = 'p-1' AND version = 7;
-- One row changed: saved as version 8. No row changed: another writer saved first.
```

No row changed means that another writer got there first. The service answers 412 Precondition Failed, as a PUT with `If-Match` gets in chapter 8, and the client loads version 8, then merges or asks the player, as [[#network-offline]] describes. The check works because the database tests the condition and writes in one step. At [PostgreSQL's default isolation level](https://www.postgresql.org/docs/18/transaction-iso.html), Read Committed, an `UPDATE` whose row was changed by a concurrent transaction waits for that transaction to finish, then evaluates its `WHERE` clause again against the new version of the row, so the second writer's `version = 7` no longer matches and it changes nothing. The same default does not protect a read-modify-write done in the service's code: two instances that each read the coins with a `SELECT` and write their own total back with an unconditional `UPDATE` both succeed, and one grant is lost. An increment written as `coins = coins + 50` is safe for the same reason that the version check is.

Pessimistic locking, named here, prevents the overlap instead: in PostgreSQL, `SELECT … FOR UPDATE` locks the rows it reads until its transaction ends, and other writers of those rows wait. It suits short transactions on the server over rows that many writers contend for. It does not suit a cloud save, in which the time between the read and the write is a player's session, far longer than any lock should be held.

A transaction covers one database. An operation that crosses services, such as a purchase that the economy records and the inventory fulfills, is a series of local transactions, each [[idempotent]], with a compensating step for each one that undoes it if a later step fails: a [[saga]], named here. Where the compensations would be hard to write, the better design often keeps the whole operation inside one service and one database.

An interviewer listens for each choice stated with its cost: “this choice costs X to protect Y”, with both concrete. “Reading each player's own save from the primary costs the primary those reads, and protects players from reloading a save older than the one they just made.” “Letting the leaderboard lag by up to ten seconds costs players a rank that is briefly out of date, and protects the score path from a write to the [[sorted set]] for every match.” A choice stated without its cost, such as “we use the right consistency for each feature”, gives the interviewer nothing to grade.

Interview exercise: For three features of a game you know, state the consistency each needs, what that costs, and what the player sees where it is relaxed, each in the form “this choice costs X to protect Y”.

?? design-consistency-per-feature Which of these needs a strongly consistent read?
* The coin balance that a shop purchase is about to debit
- The number of friends shown on a player's profile page
- The online dot shown beside a friend's name in a list
- The top 100 of this week's leaderboard on the home screen
- The count of players who have joined this weekend's event
> A spend that reads a stale balance can take coins the player no longer has, so the read and the debit happen together, strongly consistent. The other four can lag by seconds without harm, and relaxing them keeps them cheap under load.

?+ A weekly leaderboard is eventually consistent. What does the player see, and what does the game gain?
* A rank seconds out of date, and score writes kept cheap under load
- A final result that may be wrong, and a board that needs no storage
- Scores that go missing, and a board that loads faster than before
- No difference at all, since ranks settle before the page loads
- Last week's ranks, and no need for the job that resets the board
> An eventually consistent board shows a rank that has not yet caught up with the latest scores. In return, scores can be applied in batches and read from copies, which keeps them cheap when a spike arrives. The final standings are still computed once the writes stop.

?+ A network partition cuts two copies of a store off from each other. What can a store that keeps answering on both sides promise?
* An answer to each request, which may disagree with the other side's
- Consistent answers on both sides, at the price of higher latency
- An answer from the side that holds a majority of the copies alone
- The latest write on both sides, since each side forwards its writes
- Consistent answers from both sides, merged once the link is back
> While the sides are cut off, a write on one cannot reach the other, so a store that answers on both sides answers some reads with old values. Staying consistent means that one side, or both, waits until the partition heals, which is the choice CAP says a replicated store has to make.

?+ What does PACELC add to CAP?
* That with no partition, stronger consistency still costs latency
- That a partition forces a store to choose latency over availability
- That consistency and availability both hold during a partition
- That a store that tolerates partitions gives up durability as well
- That latency matters for reads, and writes are free of that cost
> CAP describes the choice during a partition. PACELC adds the normal case: keeping copies in step costs a round trip on each write, so even when nothing is broken, a system trades latency against consistency.

?+ Which sentence states a trade-off the way an interviewer listens for?
* Primary reads of a player's own save cost capacity and stop stale reloads
- We use the consistency that each feature needs, strong or eventual
- Strong consistency is the safest choice, so all of the data uses it
- Eventual consistency scales better, so the wallet and the board use it
- The database's defaults handle consistency, so the design follows them
> The sentence names what the choice costs, the primary's capacity for those reads, and what it protects, a reload that shows an older save than the one just made. The others state no cost, choose one consistency for data that needs different ones, or leave the decision to defaults nobody has examined.

?? design-optimistic-concurrency A phone and a tablet each download save version 7, change it, and upload the whole save with no version check. What happens?
* The second upload replaces the first, and one device's progress is lost
- The database merges the two uploads, since both started from version 7
- The second upload fails, since the save changed after it was read
- Both uploads are kept, and the next download returns the newer one
- The first upload wins, since the database keeps the earliest write
> Without a condition, each upload is a plain write, and the later one overwrites the earlier one whole: the lost update. A version check, or `If-Match` over HTTP, turns the second upload into a conflict that the game settles by merging or by asking the player.

?+ The tablet's `UPDATE save … WHERE player_id = 'p-1' AND version = 7` changes no row. What does the service do?
* Answers 412, and the client loads version 8, then merges or asks the player
- Retries the same update until it changes one row, then answers 200
- Writes the save without the condition, since the tablet's is the newer one
- Answers 500, since the database failed to apply the requested write
- Answers 404, since no save matched the player's id in the database
> No row changed means that the save is no longer at version 7: another writer saved first. The service reports the conflict, as HTTP's 412 Precondition Failed does for `If-Match`, and the client resolves it against the newer version instead of overwriting it.

?+ Two instances read a player's coins with a `SELECT` before either writes, each adds 50 in memory, and each writes its total back with an `UPDATE`, at PostgreSQL's default isolation level. What happens?
* One grant is lost, since each writes a total computed from the same read
- Both grants apply, since the second update waits for the first to commit
- The second update fails with an error that reports a serialization failure
- The database merges both totals, and the player ends with 100 more coins
- The second update is skipped, since the row changed after it was read
> At Read Committed, the second update waits for the first and then writes its own total, computed from the value both instances read, so one grant of 50 disappears. An increment in the `UPDATE` itself, `coins = coins + 50`, applies both, and a version check makes the second write change nothing, so that its writer reloads and tries again. The serialization error belongs to the stricter Repeatable Read level.

?+ When does a pessimistic lock fit better than a version check?
* A short server transaction on a heavily contended row
- A cloud save that the player edits for minutes before an upload
- A profile edited from two devices on different days of the week
- A leaderboard entry that many players read and one server writes
- An upload from an old client that sends no version with its save
> A lock makes other writers wait, which is cheap for a transaction that lasts milliseconds on a contended row, and costly for anything that spans a player's session. A cloud save or a profile holds its read for minutes or days, which a version check handles without holding anything.

?+ What do `If-Match` over HTTP and `WHERE version = 7` in SQL have in common?
* Both write while the record is still at the version read
- Both lock the record from the moment of the read until the write
- Both merge the concurrent changes on the server before writing
- Both make the write idempotent for the key that the client sent
- Both reject the writes of clients that run an old app version
> Each is a condition on the write: `If-Match` names the entity tag the client read, and the `WHERE` clause the version. When the record has moved on, the write does nothing and the conflict is reported, so no lock is held and nothing is merged behind the client's back.
