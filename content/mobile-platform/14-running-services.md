---
book: unity-mobile-platform-engineering
chapter: 14: Running game services at scale
---

## Spikes: launches, resets, and event starts {#design-spikes}

Chapter 13 designed the game's services one at a time, for an ordinary day. This chapter keeps them running on the other days: when players arrive together, when a dependency fails, while a deploy replaces the code, when something breaks at night, and when some players attack the service itself. It keeps to the depth of chapter 12, the mechanisms and what each one costs, and names the places where a backend specialist goes further.

A game's heaviest load arrives in synchronized spikes, and each has a cause that the design can name:

| Moment | Why the players arrive together | What it strains first |
| --- | --- | --- |
| Launch day, or a launch in a new region | Each player is new, with an account, a first download and a first save to create | Sign-up, the database's writes, and the [[CDN]] |
| The daily reset | Rewards and missions renew at one moment in UTC ([[#design-round-method]]) | Sign-in, and the writes of each first claim |
| An event's start | A third of the players in five minutes, by the estimate of [[#design-estimation]] | The event's configuration and state, until the caches are warm |
| A push sent to all players | The players who tap it open the game within minutes ([[#design-social]]) | Sign-in |
| The end of an outage | Each player who tried during the outage is still trying, and their clients retry | All of it at once, behind caches that are empty |

An autoscaler adds instances when a metric, such as CPU use or requests per instance, passes a threshold, and removes them when it falls back. It acts on what has already happened. It reads the metric at an interval and starts instances when the metric calls for them, and each new instance then boots, starts its process, opens its connections and passes its health check before the [[load balancer]] sends it anything. Kubernetes's autoscaler, one example, checks a deployment's metrics and adjusts its size every 15 seconds by default, by its documentation in September 2026, and the instances it adds start after that. An event start that climbs from the peak hour's 4,000 requests a second to 20,000 within a minute has done its damage before the new capacity serves. Autoscaling follows the day's slow rise and fall well. A spike measured in seconds needs one of two things: capacity in place before it arrives, or admission control.

Moments that are on the calendar get capacity scheduled for them. The fleet is scaled up before the daily reset and before each event's start, which a cloud vendor's autoscaling does from a schedule; some also offer predictive scaling, which launches instances ahead of the demand it forecasts so that they have time to boot. The caches are warmed before the start, as [[#design-live-events]] warms them. Launch day is sized from the estimate and from load tests, with room for the estimate to be wrong. The moments that nobody schedules, such as the end of an outage or a video that brings a million new players in a day, meet admission control, which decides who gets in while capacity catches up:

```text
phone
  -> login queue   admits sign-ins at the rate that the database tier takes
  -> gateway       rate limits: a bucket for each player, and one for each endpoint
  -> service       sheds the least valuable requests first when it is busy
  -> database
```

A login queue protects the database tier. Signing in reads and writes the player's records, the costly part of starting a session, so the front door admits players at the rate that load tests showed the database takes, and the others wait their turn instead of all failing slowly at once. A survey of launch incidents describes the queues of large online games the same way: admission control that protects the database tier, letting players in at a rate that the storage can absorb. Queue eligibility can be represented by two counters; the service also tracks redeemed tickets. Each arriving client is handed the next ticket number, signed by the queue service so that a modified client cannot write itself a better one, and a “now serving” number rises at the admission rate, 2,000 a second for the sign-ins of [[#design-estimation]]. A client whose ticket is at or below the number now served may ask to enter. Redeeming it still passes the gateway's aggregate sign-in limit, which admits no more than the current database budget and consumes each ticket once. Eligibility alone is not admission: clients that return from the background together must not spend a minute of accumulated tickets in a second. While its ticket is ahead of the number now served, the client shows the difference as its position, with an estimate of the wait. Once eligible, it waits for the gateway to admit it. It polls with jitter and keeps its ticket when the game goes to the background, so that answering a message does not send the player to the back of the line. A CDN vendor's waiting room, which holds a website's excess visitors so that they do not overwhelm its servers, works on the same idea.

Rate limits sit at the gateway of [[#design-services-state]], in two kinds. A limit for each player, a [[token bucket]] of 20 requests that refills at 5 a second for instance, stops one client, whether a script or a build with a bug that loops, from taking more than a player's share. A limit for each endpoint in total caps what reaches a service however many players ask, at the rate that the service's load test sustained. A request over a limit is answered 429 Too Many Requests, or 503 Service Unavailable while the service as a whole is refusing, with a `Retry-After` header, which chapter 9's retry policy waits for ([[#network-retries]]). The gateway varies that wait from one answer to the next, between 20 and 40 seconds for instance. Told to wait 30 seconds, the clients refused in one second would come back together, 30 seconds later.

Inside each service, [[load shedding]] decides which requests to refuse when the service is busy. Refused at random, a purchase is lost as readily as a telemetry batch, so each endpoint carries a priority and the least valuable work goes first. Google's SRE book does the same in its chapter on [handling overload](https://sre.google/sre-book/handling-overload/), with a criticality on each request: as a backend fills up, it starts rejecting requests by criticality, with higher thresholds for the more critical ones. For a game, the order runs from telemetry to money:

- first, telemetry batches and content prefetches, which the client keeps and sends again later, so that refusing them costs nothing but time ([[#design-live-events]]);
- then leaderboard pages and friends' presence, which the client can show from what it cached;
- then gameplay and sign-in;
- last, purchases and grants, since the player has paid.

The check needs a count of the requests in flight and a limit for each priority:

```csharp
using System.Threading;

// Which requests an instance refuses first when it is busy.
public enum Priority { Critical, Normal, Sheddable } // purchases and grants; sign-in and play; telemetry

public sealed class Admission
{
    readonly int _capacity; // requests in flight at the most that the instance's load test sustained
    int _inFlight;

    public Admission(int capacity) => _capacity = capacity;

    // Called before any work that costs something, such as a database read or a call to another service.
    public bool TryEnter(Priority priority)
    {
        int limit = priority switch
        {
            Priority.Sheddable => _capacity * 6 / 10, // refused from 60% busy
            Priority.Normal => _capacity * 9 / 10,    // refused from 90% busy
            _ => _capacity,                           // refused at capacity alone
        };
        int current = Volatile.Read(ref _inFlight);
        while (current < limit)
        {
            int seen = Interlocked.CompareExchange(ref _inFlight, current + 1, current);
            if (seen == current)
                return true;
            current = seen; // another request got in first: check the limit again
        }
        return false; // the caller answers 503 with a Retry-After, having done nothing else
    }

    public void Exit() => Interlocked.Decrement(ref _inFlight);
}
```

The caller pairs each successful `TryEnter` with one `Exit` in a `finally` block, including when the request fails or is canceled. It does not call `Exit` after a refusal.

Three details make it work. The priority comes from the endpoint, in the server's own configuration, and not from a header that the client sets, since a modified client would mark each of its requests critical. The check comes before the work: the SRE book warns of cases in which rejecting a request costs nearly as much as processing it, and a service that reads the database before it refuses has already spent what refusing was meant to save. And a request that has waited inside the service for longer than its client's timeout ([[#network-timeouts]]) is dropped unserved, since nobody is still waiting for the answer. The SRE book counts servers that spend resources on requests that will exceed their deadlines on the client as a common theme of cascading outages, and has the server check the deadline left at each stage before it does more work.

The end of an outage is the largest spike of all, and it meets the backend at its weakest. Suppose the backend of the book's game goes down for an hour at its evening peak. When it returns, half a million players still have the game open, a figure invented for the estimate, and each client retries its sign-in about twice a minute, as its jittered backoff reaches its cap ([[#network-retries]]): about 17,000 sign-ins a second, eight times the 2,000 that the event start was sized for. Each cache is empty, so each of those sign-ins reads the database, and new instances answer slowly until their own caches and connections are warm. A backend that opens its doors at once is knocked over by the herd it lets in, and the outage begins again. The survey of launch incidents describes an outage of about 73 hours on one large game platform in 2021, which ended with capacity restored in slices, since a cold fleet that accepts each client at once produces a thundering herd that knocks it over again.

Restoring in slices is the SRE book's own advice for a service whose servers crash as soon as they become healthy: remove what triggered the failure, such as by adding capacity; cut the load until the crashing stops, if need be by letting through 1% of the traffic; let most of the servers become healthy; then raise the load gradually. The small first load warms the caches, and more traffic follows once they are warm. A game does it at its front door. The login queue's admission rate starts low and rises, or the gateway admits the players whose ids hash into the first 1%, then 5%, 25% and all of them. A hash of the id keeps each admitted player admitted as the share grows, where a draw at random on each request would let a player's sign-in through and refuse their next call. Each step waits until the database's load, the caches' hit rate and the error rate have settled at the current share, and the players outside the share see a position in the queue rather than an error. The client does the other half: backoff with jitter and a cap, a [[circuit breaker]] whose open state shows the game's offline screen rather than a spinner, and no retry loop of its own around a sign-in that the queue already paces.

A load test finds what the estimate cannot: which component fails first, at what load, and how. Its clients behave like the real ones, with the event start's mix of requests at the rates of [[#design-estimation]], their timeouts, their retries with backoff, and their reconnections when a connection node restarts. A test whose clients do not retry measures a backend that no player uses, since in production each failure brings its retries. The SRE book asks for load tests that push components until they break, with both gradual and sudden rises in load, and that watch how a component behaves as the load returns to normal after going well beyond it; it also asks whether the popular clients queue work while the service is down, and whether they back off with randomness on errors. For a game, two tests matter most: the event start at twice its estimated load, and the end of an outage, played by stopping the database under load for a minute and watching whether the backend comes back by itself or its clients' retries keep it down. The survey describes a weekend before one game's launch whose stated purpose was to push the live infrastructure until something gave.

Exercise: List your game's synchronized moments: its resets, its event starts, its pushes to all players, and the end of an outage. Beside each, write the load it brings, from your estimate, and what protects the backend at that moment: capacity scheduled ahead, the login queue, rate limits or shedding.

?? design-autoscaling-lag An event starts at 00:00 UTC, and the requests rise fivefold within a minute. Why does autoscaling not absorb the rise?
* It reacts after the metric rises, and new instances take time to serve
- It absorbs it, since new instances start within a second of the rise
- It adds instances when health checks fail, and a busy fleet passes them
- It is paused during events, so that no deploy can overlap with them
- It scales on memory use, which stays flat when requests arrive faster
> An autoscaler reads a metric at an interval and starts instances once the metric has risen, and each new instance boots, starts its process and passes its health check before it serves. A spike measured in seconds does its damage first. Health checks remove instances rather than add them, and nothing pauses an autoscaler for events.

?+ Which prepares the backend for the daily reset at 00:00 UTC?
* Capacity scaled up on a schedule before it, and caches warmed
- An autoscaling threshold set lower, so that it reacts to the rise sooner
- More retries on the clients, so that requests that fail succeed later
- A time to live on each cached entry that expires at the reset itself
- A push at the reset, so that players learn that the new day has begun
> The reset's time is known, so capacity can be in place before it: a scale-up on a schedule, and caches loaded with the new day's configuration. A lower threshold still reacts after the rise, retries add load when the backend is busiest, entries that expire together at the reset leave a cold cache, and a push adds a spike of its own.

?+ A video brings a million new players in a day, with no warning. What protects the database while capacity is added?
* A login queue that admits players at the rate the database takes
- A higher autoscaling maximum, so that the fleet can grow without limit
- A cache in front of sign-up, so that new accounts are served from it
- A retry on each failed sign-up, until the new player gets through
- A read replica for sign-ups, so that the primary keeps its capacity
> Nobody scheduled the moment, so admission control carries it: the queue lets players in at the rate that load tests showed the database tier takes, and the rest wait with a position. More instances add no database capacity, a new account is a write that no cache or replica serves, and retries multiply the load.

?+ At an event's start, a service is full before new instances are up. Which requests does it refuse first?
* Telemetry batches, which the client keeps and sends again later
- Purchases, since the store hands an unfinished transaction over again
- Sign-ins, since a player who is not in yet has lost nothing so far
- Requests picked at random, so that each player loses the same share
- Requests from old client versions, which are the next to be retired
> Shedding refuses the least valuable work first, and a telemetry batch costs nothing to refuse, since the client's queue keeps it and sends it later. Purchases are refused last, since the player has paid, sign-in is the door to the game, and a refusal at random loses a purchase as readily as a batch.

?+ When a service sheds load, where does it take each request's priority from?
* The endpoint it calls, as the server's own configuration maps it
- A header that the client sets on each request that it sends
- The client's app version, so that the newest builds are served first
- The request's size, since large requests cost the most to serve
- The order of arrival, so that the earliest requests are served first
> The server maps each endpoint to a priority, so a purchase and a telemetry batch are told apart by what they are. A header from the client lets a modified client mark each request critical, and a version, a size or an arrival time measures something other than what the request is worth.

?+ A service reads the player's record from the database, then finds itself too busy and refuses the request. What is wrong?
* The refusal came after the work that it was meant to save
- Nothing, since the refusal still frees a worker for the next request
- The service should have queued the request rather than refusing it
- The refusal should come from the database, which knows its own load
- The service should have answered 200 with an empty body instead
> Shedding relieves a service when refusing costs less than serving, so the check comes first, before the database read or any call to another service. Queuing a request that the service has no capacity for delays the refusal, a refusal from the database comes after the service has asked it, and an empty 200 tells the client that the request succeeded.

?? design-restore-in-slices The backend is fixed after an hour's outage at the evening peak. Why does it let players back in slices rather than all at once?
* All at once, the waiting players and their retries meet empty caches
- All at once, the players would be matched with opponents far away
- In slices, the database can check the data written before the outage
- The clients' jittered backoff spreads them, so all at once is safe
- In slices, the players who joined first can be let back in first
> Each player who tried during the outage is still trying, their clients retry, and each cache is empty, so each request reaches the database: opening at once lets in a herd that knocks the backend over again. A small share first warms the caches, and more follows once they are warm. Jitter spreads the attempts in time without making them fewer.

?+ The gateway lets in 5% of players, then 25%. Why does it choose them by a hash of the player's id?
* A player let in at 5% stays in, and each of their requests passes
- A hash lets the gateway admit the players who waited longest first
- A hash hides the player's id from the gateway's own logs
- A hash is faster to compute than a draw from a random number
- A hash lets the players predict when their turn to play will come
> The hash puts each player on the same side of the line on each request, so the players admitted at 5% are still admitted at 25%. A random draw on each request would let a player's sign-in through and refuse their next call, which leaves players stuck halfway into the game while the share holds steady.

?+ The gateway lets in 5% of players. What decides when it lets in more?
* The database's load, cache hits and errors, settled at 5%
- A timetable fixed before the outage, with ten minutes between steps
- The length of the queue, so that the longest waits end first
- The autoscaler, which raises the share as it adds instances
- The players' posts, which show how many of them are waiting
> Each step tests the backend at a new load, so the next one waits until the database's load, the caches' hit rate and the error rate have settled at the current share. A timetable ignores what the backend shows, the queue's length measures demand rather than capacity, and new instances add no database capacity.

?+ During a recovery, the gateway answers each refused client 429 with `Retry-After: 30`, and the clients wait that long. What happens 30 seconds later?
* The clients refused in the same second come back together
- The clients spread themselves out, since their clocks differ a little
- Nothing, since clients do not retry a request after a 429 answer
- The gateway lets them in first, since they have waited the longest
- The clients come back one at a time, in the order they were refused
> The header sets the wait, so clients refused together return together, a new spike 30 seconds after each earlier one. The gateway varies the value from one answer to the next, between 20 and 40 seconds for instance, so that their return is spread. A 429 is retried after the wait it gives, and nothing orders the clients as they return.

?+ A load test's clients do not retry failed requests. What does the test miss?
* The retries that multiply the load once requests start failing
- The network's latency between the phones and the backend's region
- The share of players who close the game when a request fails
- The time that the autoscaler takes to add instances under load
- The CDN's traffic, which a load test of the backend leaves out
> In production, each failure brings its retries, so a backend under stress receives more requests than its players make, which is what keeps it down at the end of an outage. A test whose clients do not retry measures a backend that no player uses. The SRE book asks, of the popular clients, whether they back off with randomness on errors.

## Failure isolation and graceful degradation {#design-degradation}

Each dependency fails at some point: the Redis node that holds the leaderboards, the chat service, a store's server API, the push provider, the database's primary while its standby takes over. The design decides ahead of time what the game does while each is down, feature by feature, and keeps the core loop playable, whatever that loop is: a run, a match, a turn, a building to upgrade. Chapter 9 gave the client its part: timeouts, a retry budget, and a [[circuit breaker]] whose open state shows the feature as offline rather than as a spinner ([[#network-retries]]). The rest is a table, written before the outage:

| Down | What the player sees | What keeps working |
| --- | --- | --- |
| Leaderboards | The run's own score, with ranks to follow once the service is back | Play and scoring: the client keeps the score and sends it later, [[idempotent]] for the run's id |
| Chat | A chat tab that says that chat is unavailable | Everything else |
| Live events | The event's last configuration, cached, until its scheduled end | The event's play; rewards are claimed once the service is back |
| The economy | A closed shop | Play; a purchase already paid for stays unfinished in the store until the grant ([[#design-economy]]) |
| Sign-in | Nothing, for players who hold a valid session; a queue for new sessions | Play for the players signed in, and any offline mode |
| The push provider | Nothing: notifications arrive late | Everything; the send queue keeps its messages ([[#design-social]]) |
| Analytics ingestion | Nothing | Everything; the clients keep their events and send them later |

The rows fall into two kinds. Some work can wait, such as telemetry, notifications and updates to the boards, which are queued and delivered late with little that the player notices. Other features fail in the player's view, such as the shop and chat, and each gets a state that says so and lets the player go on. No row holds a spinner that never ends, or a sign-out. The client's adapters return “unavailable” as a result that the interface knows how to show ([[#platform-results-threads]]), and the game has decided what that looks like before any service goes down. The operators get switches for the same states: an article on feature toggles, published on Martin Fowler's site, describes long-lived kill switches that let them degrade features that are not vital while the system is under unusually high load.

Sign-in's row rests on a choice made in [[#design-services-state]]. A gateway that checks each access token by its signature needs nothing from the sign-in service, so the players already in keep playing until their access tokens expire and a refresh fails, while new sessions wait. With opaque tokens looked up in a shared store, each request fails with that store.

Inside the backend, each service calls others, and chapter 9's tools apply again at each call: a timeout taken from the request's own deadline, so that no call outlives the request that needs it; retries at one layer, within a budget, which the SRE book extends to a retry budget for the whole server; and a circuit breaker for each dependency. What they protect is the caller's own capacity, because a slow dependency is worse than a dead one. A dead one refuses at once, and a slow one holds each call open for as long as it takes. In steady state, the average number of calls in flight is the average arrival rate times the average time each call takes, which is Little's law, named here. A profile service that calls the leaderboard service 100 times a second, at 50 ms a call, averages 5 of those calls in flight. At 10 seconds a call, sustaining that arrival rate would require an average of 1,000 calls in flight. If the profile service serves each request on one of 200 workers, the leaderboard's calls take all 200, and requests that never touch the leaderboard wait behind them: the profile service has stopped answering, although nothing in it failed.

A bulkhead, named after the partitions that divide a ship's hull, gives each dependency a pool of its own, such as 20 of the workers, or a connection pool of 20, for calls to the leaderboard. A slow leaderboard fills its own pool, the calls beyond it fail at once, and the other 180 workers go on serving. A timeout shortens that average occupancy: at the same average arrival rate, a timeout of 1 second brings it to at most 100 workers on average. Bursts can still fill the pool. The bulkhead supplies the hard limit of 20 concurrent calls.

Overload spreads. Google's SRE book, in its chapter on [cascading failures](https://sre.google/sre-book/addressing-cascading-failures/), defines a cascading failure as a failure that grows over time as a result of positive feedback: part of a system fails, and that makes it more likely that other parts fail. Its most common cause is overload. Four instances share the load at 75% of their capacity each, and one fails; the other three take its share and run at 100%, with no room left, and slow down. Their callers' requests take longer, so more of them are in flight at once. Clients time out and retry, which adds load. And a scheduler that restarts instances when they fail their health checks restarts the overloaded ones, which the SRE book describes as health checking that makes the service unhealthy, and their share moves onto the rest. Each step makes the next more likely, and the overload moves from the failed instance to its neighbors and up to the tiers that call them. The breaks in that loop are those of this chapter and chapter 9: [[load shedding]], so that an instance refuses what it cannot serve instead of slowing down for everyone; timeouts and bulkheads, so that a slow dependency holds a bounded share of its callers; retry budgets and circuit breakers, so that failures do not turn into load; health checks that ask whether an instance can serve at all, not how fast it serves at the moment; and room in each instance for a neighbor's share.

Redundancy decides how much a single failure takes. A cloud vendor divides its locations into failure domains, regions and the zones inside each region, so that a zone can fail without the others in its region. A service runs its instances in several zones, and its database keeps a standby in another zone, so that losing a zone costs a share of the fleet rather than all of it. The survivors take the lost zone's share, so capacity is planned for it. With three zones, each carries a third of the load, and after one fails, the other two carry half each, one and a half times as much. Two-thirds is the mathematical boundary, at which the two surviving zones reach 100%. Normal load must stay below that boundary, with enough room after a failure for bursts and retries. Load tests set the operating target; running each zone at 50%, for example, leaves the survivors at 75%.

A second region answers two other needs: latency for players on another continent, whose matches need a server near them ([[#design-matchmaking]]), and survival when a whole region fails, which is rare and long. It costs more than instances do, because the player data has to be in both regions. Replication between them is asynchronous, so that a failover loses the writes that had not crossed yet, or synchronous, so that each commit waits until the other region confirms it; PostgreSQL's documentation gives the round trip between the primary and the standby as the least that a synchronous commit waits. Many game backends give each player a home region, which holds their data and takes their writes, and replicate it to another region to recover from. A design in which two regions accept writes for the same player needs a way to settle writes that conflict, which is where a backend specialist goes further, in the way [[#design-round-method]] describes such limits.

Backups are the last line, and two objectives say what they promise. The recovery point objective, RPO, is how much data the game accepts losing, measured in time: an RPO of five minutes accepts losing the last five minutes of writes. The recovery time objective, RTO, is how long the service may be down between the failure and its return. Both are set for each store by what a loss costs. The [[ledger]] needs an RPO near zero, which takes a synchronous standby and the continuous archiving of the database's log ([[#design-storage]]); a leaderboard's matters little, since it is rebuilt from the database ([[#design-leaderboards]]); telemetry can lose an hour. The RTO is a target, and a restore test measures whether the restore meets it: restoring chapter 12's 200 GB of player data and replaying its log takes as long as the test shows, and until someone has run it, the RTO is a guess. Backups also answer the failures that replication copies, such as a deploy that corrupted saves, as [[#design-storage]] set out.

Exercise: Take one service that your game depends on, and write what each client feature does while it is down: what the player sees, what waits to be sent later, and what the game must not do then, such as sign the player out.

?? design-degradation-plan The leaderboard service is down when a player finishes a run. What does the results screen show?
* The run's score, with ranks to follow once the service is back
- A spinner that retries until the service answers with the rank
- An error that asks the player to submit the score again later
- The rank that the player held before the run, shown as the new one
- A sign-in screen, since the error may come from an expired session
> The client keeps the score and sends it when the service returns, idempotent for the run's id, so the screen shows what it knows and says that the rank will follow. A spinner holds the player on a screen that may not finish, an error hands the player the backend's work, and an old rank shown as new is wrong.

?+ Chat, friends and leaderboards are all down. What does the game do?
* It lets players play, and shows each of those screens as unavailable
- It shows a maintenance screen until the three services are back
- It signs players out, so that nobody reaches a screen that fails
- It retries each service each second, so that they return sooner
- It closes, since an online game needs each of its services to run
> None of the three is part of the core loop, so the game keeps the loop playable and gives each social screen a state that says it is unavailable. A maintenance screen or a closed game turns a partial outage into a full one, signing players out adds a sign-in spike to the recovery, and retries each second add load to services that are down.

?+ The sign-in service is down, and access tokens, checked at the gateway by their signature, last an hour. Who can play?
* The players signed in already, until their access tokens expire
- Nobody, since each request needs the sign-in service to answer
- Each player, since the game falls back to its guest accounts
- The players on the newest build, which caches their credentials
- The players who signed in with Apple, whose tokens Apple checks
> The gateway checks each token with the backend's key and asks the sign-in service nothing, so the players already in keep playing until their tokens expire and a refresh fails, while new sessions wait. A guest's credential still goes through the sign-in service, and Apple's token is exchanged at sign-in rather than checked on each request.

?+ The economy service is down. What happens to the shop?
* It closes, and purchases already paid for wait unfinished in the store
- It stays open, and the client grants the items until the service returns
- It stays open, and the client finishes each purchase to keep it safe
- It closes, and the client refunds the purchases made in the last hour
- It stays open, and the items come from the client's cached catalog
> Nothing can verify and grant a purchase while the economy is down, so the shop closes rather than take money for items that cannot arrive. A purchase already paid for stays unfinished, since the client finishes it after the grant, and the store hands it over again once the service is back. A client that grants or finishes on its own loses the purchase or trusts itself.

?+ A plan for losing a database sets a recovery point objective for each store. How do the ledger's and the telemetry store's differ?
* The ledger's is near zero, while telemetry can lose an hour
- They are the same, since one backup schedule covers each store
- Telemetry's is near zero, since its events are the record of play
- The ledger's can be a day, since the stores keep each purchase
- Neither needs one, since the replicas hold a copy of each write
> The objective is set by what a loss costs: a lost ledger entry is money granted or spent without a record, while an hour of lost telemetry leaves a gap in a chart. The stores keep their purchases and not the game's grants, spends and refunds, and replicas copy a bad write as faithfully as a good one.

?? design-cascading-failure Four instances each run at 75% of their capacity, and one of them fails. What happens next?
* The three left run at 100%, slow down, and may fail in turn
- The three left run at 100%, which holds until the load rises
- The load balancer holds the failed share until a new instance starts
- The three left stay at 75%, since the failed instance's share is lost
- Nothing that players notice, since the autoscaler replaces the instance
> The failed instance's share moves to the other three, which now run at 100% with no room left: their latency rises, clients time out and retry, and an instance restarted for failing its health checks moves its share onward. That feedback is a cascading failure, which is why each instance keeps room for a neighbor's share.

?+ The leaderboard service slows to 10 seconds a call, and the profile service, which shares nothing with it but those calls, stops answering. Why?
* Calls waiting on the leaderboard hold all of the profile's workers
- The leaderboard's slowness spreads through the network they share
- The load balancer sends the leaderboard's traffic to the profile service
- The profile service's database locks while the leaderboard is slow
- The profile service's circuit breaker opens and refuses each request
> Sustaining 100 calls a second at 10 seconds per call would require an average of 1,000 calls in flight, more than a pool of 200 workers holds, so calls fill the pool and requests that never touch the leaderboard wait too. A pool of its own for those calls, a bulkhead, and a timeout on each call bound what one slow dependency holds.

?+ What does a bulkhead give a service that calls several dependencies?
* A pool of workers or connections for each, so a slow one fills its own
- A copy of each dependency's data, served while that dependency is down
- A limit on each player's requests, so that no player fills a pool
- A standby of each dependency in a second region, ready to take over
- A queue in front of each dependency, which holds the calls in order
> Named after the partitions of a ship's hull, a bulkhead gives each dependency its own workers or connections, so a slow one fills its own pool, the calls beyond it fail at once, and the rest of the service goes on serving. Copies, rate limits and standbys solve other problems, and a queue delays calls without bounding what they hold.

?+ Three equally sized zones share the load. Which capacity plan leaves room for bursts after losing one zone?
* Below two-thirds per zone, with headroom checked under failure load
- Exactly two-thirds per zone, since reaching full capacity leaves room
- All of it, since the autoscaler replaces a lost zone's instances
- Up to three-quarters, since a lost zone adds a quarter to each
- Up to about 90%, since a zone's failure is rare and soon over
> Losing one of three equally loaded zones multiplies each survivor's load by one and a half. Two-thirds therefore becomes 100%, leaving no room for bursts or retries. A lower operating target, checked in load tests with a zone missing, preserves that room; 50% normally becomes 75% after the failure.

?+ A health check fails any instance that takes more than a second to answer, and the scheduler restarts it. What does that do during a spike?
* It restarts busy instances, and their load moves onto the rest
- It protects the fleet, since slow instances stop taking requests
- It sends busy instances fewer requests, which lets them catch up
- It stops checking during the spike, since checks pause under load
- It tells the autoscaler to add instances before the spike grows
> Under a spike each instance answers slowly, so a check that counts slowness as failure restarts instances, and their share moves to the others, which slow down and fail in turn; the SRE book describes health checking that makes the service unhealthy this way. A check asks whether an instance can serve at all, and overload is handled by shedding.

## Deploying and evolving a live backend {#design-backend-deploys}

The example [[error budget]] policy in Google's SRE workbook puts changes at roughly 70% of its outages, and the SRE book's advice is to apply each change, a binary or a configuration, to small fractions of the traffic at a time, to watch it, and when it misbehaves, to roll back first and diagnose afterward. A game's backend changes each week in three ways, by deploys of its code, changes to its configuration and migrations of its data, and each is made the same way.

A deploy replaces running code, and three strategies do it:

| Strategy | How it runs | How it rolls back | What it costs |
| --- | --- | --- | --- |
| Rolling | Instances are replaced a few at a time, so the old and new versions serve side by side until the last one is replaced | A rolling deploy of the old version | Little extra capacity; two versions answer at once |
| Blue-green | The new version starts as a second, complete fleet, and the [[load balancer]] moves the traffic to it at once | The traffic moves back, in seconds, to the old fleet, still running | Twice the fleet during the switch; both fleets share the database |
| Canary | The new version serves a small share first, one instance or 1% of requests, and is compared with the old version before the rollout goes on | The canary is removed | Metrics split by version, and enough traffic to compare |

Each of them drains what it removes: an instance leaving the load balancer finishes the requests it holds before it stops. A connection node closes its [[WebSocket | WebSockets]] as it drains, and its clients reconnect to other nodes after the random delay of [[#design-services-state]]. Blue-green's rollback is quick for the code and not for the data: Martin Fowler's description of it notes the transactions that the new fleet took while it was live, which the old fleet has to be able to read.

A [[canary release]] meets real traffic before the whole of it. The SRE workbook defines canarying as a partial and time-limited deployment of a change in a service, together with its evaluation, which decides whether the rollout goes on. The evaluation assigns comparable traffic to the canary and the old version serving at the same time, the control. It compares those versions rather than using yesterday, since traffic, content and devices differ from one day to the next; chapter 10's halting criteria compare a release with the previous one over the same hours for the same reason ([[#release-rollouts]]). A canary on 1% of requests that doubles their error rate exposes that share of requests to the higher error rate until it is removed. That does not bound the affected players to 1%: a player making many requests may reach both versions. A rollout meant to limit players uses a stable cohort selected by player id.

Flags on the server separate a deploy from a release. New code ships turned off, and a flag turns it on for a share of players, then for all of them, without a deploy, and off again the same way. An operations flag, the kill switch of [[#release-rollouts]], stops an operation for each client version at once, since the server stops performing it.

A server can roll back where a client cannot. A release on the stores cannot be taken back ([[#release-rollouts]]), while a backend deploy can, in minutes, provided that the data written in between still reads. Rolling back reverts the code and not the data: a new version that writes a record in a new shape leaves records that the old version, once restored, fails to read. So a change of shape ships in two deploys. The first teaches the code to read both shapes while it still writes the old one, and the second writes the new one. Rolling back the second leaves the first, which reads all that was written.

The same order governs each change to a schema or an API, because nothing changes everywhere at once. During a rolling deploy, old and new servers answer side by side and share one database, and the clients calling them are of each version still installed, some released months ago ([[#http-versioning]]). A breaking change, such as renaming a field, is made in three phases, which Martin Fowler describes as [parallel change](https://martinfowler.com/bliki/ParallelChange.html), also called [[expand and contract]]: expand, by adding the new form beside the old; migrate, by moving the data and its readers to the new form; and contract, by removing the old form once everything has moved. A rename in one step, with `ALTER TABLE … RENAME COLUMN`, breaks each server still running the old code the moment it commits, since their queries name the old column. Renaming a player's `name` to `display_name`, in the profile table and in its API:

| Phase | What changes | What must be true first |
| --- | --- | --- |
| Expand | `display_name` is added, empty; new servers write both columns in one transaction, keep reading `name`, and return both API fields from it | Old servers ignore the added column; `name` stays authoritative while any old writer remains |
| Migrate | A background job reconciles every differing `display_name` from `name`, including non-null stale copies; reads switch after it finishes | Each writer updates both columns in one transaction, and old writers cannot return through rollback |
| Contract the storage | Servers read and write `display_name` alone, and later `name` is dropped | No server that reads or writes `name` is running, or will be rolled back to |
| Contract the API | The response loses `name` | No supported client reads it: the minimum version of [[#http-versioning]] has passed the last build that did |

The storage contracts once the servers have moved, which a deploy does in hours, while the API contracts once the clients have, which for a mobile game takes months: the time until the minimum supported version passes the last build that reads the old field. Until then the response copies `name` from `display_name`, since the API's fields are a contract with clients, and the storage's columns are the server's own ([[#http-dtos]]).

The migration runs in the background, in batches:

```sql
-- One batch of the backfill: copies the name into the new column for up to 1,000 players.
-- The job runs it until it changes no row, and pauses between batches to leave the database to the players.
UPDATE profile
SET display_name = name
WHERE player_id IN (
  SELECT player_id FROM profile
  WHERE display_name IS DISTINCT FROM name
  LIMIT 1000
);
```

Three properties make it safe on a live database. Each batch is small, so it holds its row locks briefly, and the pause between batches leaves capacity for the players. It is [[idempotent]]: a row already copied no longer matches the condition, so running a batch again, or the whole job, changes nothing that was done. And it resumes where it stopped after a crash, since the condition finds the rows that remain, with no record of progress to lose. In this chapter's run on SQLite, 2,500 players, one already synchronized and one with a non-null stale copy left by an old writer, took batches of 1,000, 1,000 and 499, a batch of 0 ended the job, and a second run changed nothing. During expansion, an old server can overwrite `name` after a new server has written both columns, leaving a non-null stale copy in `display_name`. Reading `name` keeps that player's current value visible. Once old writers are retired, including as rollback targets, the job repairs null and non-null differences alike. Both-column writes stay atomic during the job, and readers move to `display_name` after reconciliation completes. Adding the column is cheap too. In PostgreSQL, a column added with no default is null in each row, with no rewrite of the table, while some changes, such as a column's type, normally rewrite the table and its indexes, and `ALTER TABLE` takes a lock that keeps other sessions out of the table unless its documentation says otherwise for that form. Schema changes therefore add, and backfill in batches.

A configuration change is a deploy, and it is made the same way. Prices, rewards and the flags that turn features on are data that changes the game for everyone at once, often with fewer checks than code gets: an event's reward of 10,000 gems typed as 1,000,000 is paid to each player who claims it within minutes, and the reversals in the [[ledger]] ([[#design-economy]]) then take back gems that players may have spent. So a change is validated before it is saved, against a schema and against ranges, such as a price above zero and a reward below a limit, which the SRE workbook calls semantic validation, beyond the syntax; staged, to the team's environment first and then to a share of players; and versioned, so that one step restores the previous version, since rolling back a bad configuration mitigates an outage faster than a temporary fix does. Unity's [[remote configuration | Remote Config]] keeps separate environments, which [[#release-environments]] sets up, and a Game Override can apply to a rollout percentage of the players.

Exercise: Plan renaming a field in the player document without breaking a client released six months ago. List each deploy, the migration and its batches, what must be true before each contract step, and what a rollback at each step would leave.

?? design-expand-contract A field in the player API is renamed. Clients released six months ago still read the old name. What does the server do?
* Returns both names, until no supported client reads the old one
- Returns the new name, since clients skip the fields they do not know
- Returns the new name, and the old clients show an empty field
- Returns the old name, until the next release of the client ships
- Forces an update, so that each client reads the new name at once
> The response gains the new field beside the old one and keeps the old one until the minimum supported version has passed the last client that reads it, which for a mobile game takes months. A tolerant reader skips a field it does not know, and still needs the one it does, and forcing an update to rename a field stops players for nothing.

?+ The job that fills the new column starts while some servers still run the old version, which writes the old column alone. What goes wrong?
* A player renamed by an old server after the job's pass keeps a stale copy
- The job copies each row twice, once for each version of the server
- The old servers fail, since the new column is unknown to their queries
- Nothing, since the job reads the old column again in each batch
- The database locks the table until each server runs the new version
> An old server can change the old column after a batch passes, leaving the new copy stale again. The job starts after old writers and their rollback paths are retired; current writers change both columns atomically. It reconciles non-null differences as well as empty copies, and reads stay on the old column until it finishes. Old servers ignore added columns that their queries do not name.

?+ The migration job stops halfway, after a crash. What happens when it starts again?
* It copies the rows that remain, since its condition finds those alone
- It copies each row again from the start, and the names are doubled
- It needs a record of its progress, or it starts from the beginning
- It rolls back its finished batches, then starts from the beginning
- It stops, since a half-migrated table is restored from a backup
> Each batch picks rows whose new column differs from the old one, treating null as a comparable value, so the rows done no longer match, and a restart continues where the crash left the job, with no record of progress to lose. Copying a name again would change nothing, since the job sets a value rather than adding to one, and committed batches stay committed.

?+ Why does the old column leave the database long before the old field leaves the API?
* Servers move off the column in a deploy; clients leave over months
- The API's field is read from the column, so the column goes first
- Dropping a column is faster than changing the API's documentation
- The stores review the API's fields, which delays the API's change
- The column takes space in each row, while the field costs nothing
> The column is read by servers, which a deploy moves to the new column, while the API's field is read by installed clients, which leave as the minimum supported version passes them. The response keeps the old field by copying it from the new column, so the storage contracts long before the API does.

?+ A new server version writes each player record in a new shape and turns out to be broken. Why can rolling it back break the service further?
* The old version fails on the records written in the new shape
- A rollback reinstalls the old version on each player's device
- The old version's configuration was removed when the new one shipped
- A server rollback needs the stores to review the old version again
- The load balancer keeps sending requests to both versions for a day
> A rollback restores code and not data, so records that the new version wrote keep its shape, and the old code fails on them. A change of shape therefore ships in two deploys: the first reads both shapes and writes the old one, the second writes the new one, and rolling back the second leaves a version that reads everything.

?? design-canary A new version of the economy service takes 1% of requests first. What decides whether the rollout goes on?
* Its errors and latency next to the old version's, over the same minutes
- Its errors and latency next to yesterday's, at the same time of day
- Whether players report a problem in the first hour of the rollout
- Whether its instances pass their health checks for the first ten minutes
- Whether the service's total error rate stays under the day's alert level
> The canary and control serve at the same moment. With comparable traffic assigned to each, their error and latency differences help isolate the change. Yesterday can differ in traffic, content and devices; reports come late and few, health checks miss wrong answers, and 1% of requests barely moves a total.

?+ Why does a canary start with a small share of the requests?
* A bad version serves few requests before the comparison catches it
- A small share keeps the canary's instances from needing to scale
- The comparison needs few requests, so a larger share adds nothing
- A small share lets the old and new versions share one database
- The load balancer can route a small share to new instances alone
> The canary's share is what a bad version costs before its errors show against the control, so it starts small and grows as the comparison holds. It still needs enough requests to compare, so a service with little traffic keeps its canary for longer rather than giving it a larger share at once.

?+ The canary's errors double against the control's. Why is rolling it back cheap?
* The old version still serves the other 99%, and takes the 1% back
- The canary's instances restart the old version from their own disk
- The stores roll the clients back to the version the old one served
- The database restores itself to the moment the canary started
- The canary's requests are replayed on the old version afterward
> A canary leaves the old version running for all but its share, so rolling back moves that share to instances that are already serving, and nothing new starts. A full deploy that failed would have to be rolled back instance by instance. The stores and the database take no part in it.

?+ New code ships behind a flag that is off. What does turning the flag on for 1% of players give that a deploy does not?
* A release that widens or turns off without a new deploy
- A release that skips the canary, since the code was deployed before
- A release that reaches old clients sooner than a deploy would
- A release whose data changes roll back when the flag is turned off
- A release that the stores approve faster than a new client version
> The code is deployed already and dark, so the flag turns it on for a share, widens it as the comparison holds, and turns it off in seconds if not, with no deploy. Turning the flag off stops the code and undoes none of the data that it wrote, which is why data changes follow the expand-and-contract order.

?+ A configuration change sets an event's reward to 1,000,000 gems instead of 10,000. Which practice would have caught it before players claimed it?
* A range check on the value, then staging it to the team and to 1%
- A cache on the configuration for an hour, so the change lands slowly
- A check in the client of each reward against the value in its build
- A quick revert, once the ledger shows how many players claimed it
- A review of the code, since configuration ships with each deploy
> A configuration change is a deploy: validated against a schema and its ranges, then staged to the team's environment and to a share of players, as a canary is, and kept as a version that one step restores. A cache delays the damage, a check in the client ties rewards to builds, and a revert after the claims leaves the ledger's reversals to clean up.

## Observability, service levels, and incidents {#design-slos}

A backend learns whether players can play from a few numbers, chosen from the player's side. A [[service level indicator]], SLI, measures one aspect of the service that players feel, as the share of events that went well: sign-ins that succeeded out of those attempted, purchases granted within 10 seconds out of those verified, tickets matched within a minute out of those created. The SRE book advises choosing a few indicators from what users want from the system, rather than making one of each metric that monitoring can track, and the SRE workbook writes each as good events divided by the total. An indicator measured by the clients counts the failures that no server sees, such as sign-ins that failed on the network before they reached the [[load balancer]], which the client's telemetry reports ([[#network-observability]]); the SRE book notes that the latency the client sees is often the one that matters more to users.

A [[service level objective]], SLO, is a target for an indicator over a window: 99.9% of sign-ins succeed, measured over 30 days. A service level agreement, SLA, is a contract with users that says what happens when its objectives are met or missed, which a game seldom signs with its players. The objective stays below 100% on purpose. The SRE book points out that a user on a smartphone that is itself 99% reliable cannot tell 99.99% from 99.999%, and that each increment of reliability may cost a hundred times the one before it. Past what players can feel, reliability costs more than it gives.

The gap below 100% is the [[error budget]]: 1 minus the objective, 0.1% of sign-ins. The book's game has 2 million daily players who play 3 sessions a day, 180 million sign-ins in 30 days, so 180,000 of them may fail. The budget turns an argument about risk into arithmetic. While it lasts, the team ships features and takes the risks that come with them. Once a bad deploy or an outage spends it, releases stop, other than urgent and security fixes, until the indicator is back within its objective, as the example policy in the SRE workbook has it. An hour without sign-in at the evening peak, three times the average hour's 250,000 sign-ins, fails 750,000 of them, about four months of budget in an hour.

Each service's dashboard shows what the SRE book's chapter on [monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/) calls the four golden signals: latency, traffic, errors, and saturation, which is how full the service is, such as its workers in use or its database's connections. Latency is read as percentiles, since an average hides the slowest requests; the SRE book's example is a service whose average of 100 ms leaves 1% of its requests at 5 seconds. Failed requests are counted apart, since a failure that returns quickly lowers the average latency of a service that has stopped working. Each figure is split three ways: by endpoint, since a failing purchase endpoint disappears in a service's total; by region; and by client version, since a new build that sends a malformed request fails in its own line, which is where chapter 10's halting criteria read it ([[#release-rollouts]]). Chapter 9's correlation id, carried from the client through the gateway to each service in a header such as the `traceparent` of W3C Trace Context, follows one failed request across the services it crossed and joins them to the client's own logs ([[#network-observability]]).

An alert pages a person, and the SRE book separates what is broken, the symptom, from why, the cause. “Sign-ins are failing” is a symptom, which players feel whatever its cause. “CPU at 90% on one instance” is a cause, which may hurt nobody, and it belongs on a dashboard or in a ticket for working hours. A page is for a condition that is urgent, that someone can act on, and that users see now or will soon, and the SRE book holds that each page should call for an action, since pages that ask for nothing teach the person on call to ignore the next one. The error budget gives the page its threshold. The SRE workbook's chapter on [alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) alerts on the burn rate, how fast the budget is being spent, and one of its examples pages when an hour spends 2% of a 30-day budget, a burn rate of 14.4, with a shorter window that checks that the budget is still burning when the alert fires, while a slower leak opens a ticket. For the sign-in objective, a burn rate of 14.4 is 1.44% of sign-ins failing.

An incident runs in an order: detect, mitigate, find the cause, learn. Detection comes from the pages, and at times from players posting before any page fires, a gap that the incident's review then closes. Mitigation comes before diagnosis. The SRE book tells the responder in a major outage to ignore the instinct to find the root cause first, and to make the system work as well as it can under the circumstances: roll back the deploy that preceded the symptom, turn the feature off with its flag, shed load, fail over to the standby. The cause is found once players can play. In a large incident, roles keep the work apart. An incident commander holds the high-level state and assigns the work, an operations team is the only group that changes the systems during the incident, and one person communicates, with players and with the rest of the company. Afterward comes a postmortem, which the SRE book defines as a written record of an incident, its impact, the actions taken to mitigate or resolve it, its root causes, and the follow-up actions that prevent it from recurring. A blameless postmortem assumes that each person involved had good intentions and did the right thing with the information they had, and looks for the contributing causes without indicting anyone, so that people bring problems to light instead of hiding them.

The platform engineer brings three things to an incident. Evidence from the client's side: crash reports and [[crash-free users]] by build, the client's error telemetry, and its logs with their correlation ids, which show the failures that never reached the backend. The kill switches of [[#release-rollouts]], which turn off a failing feature in each client version at once. And the forced update: when a client build is the cause, raising its platform's minimum version ([[#http-versioning]]) sends its players to the store. It comes last, since it stops each of those players until they update. Chapter 15 follows such an investigation through each layer of the call path.

Exercise: Write three indicators for your game's backend, each as good events over the total, with its objective, the error budget that the objective gives over 30 days at your game's traffic, and the burn rate at which it pages someone.

?? design-sli-choice Which indicator tells the team that players cannot sign in?
* The share of sign-in attempts that succeed, as the clients see them
- The CPU use of the sign-in service's instances, averaged each minute
- The number of sign-in instances that pass their health checks
- The sign-in service's average response time for its successful requests
- The count of accounts created each day, compared with last week's
> An indicator measures what players feel, as good events out of the total: sign-ins that succeeded out of those attempted, counted by the clients so that failures before the load balancer count too. CPU, healthy instances and the latency of successes can all look normal while sign-ins fail, and a daily count arrives a day late.

?+ Why is the time to grant a purchase read at the 99th percentile rather than as an average?
* An average hides the slowest grants, which some players wait through
- The 99th percentile is cheaper to compute than an average of all grants
- An average counts the failed grants, which makes the figure look worse
- The stores report their times as percentiles, and the two must match
- An average changes too slowly to show a problem in the first hour
> A 99th percentile of 8 seconds says that one grant in a hundred takes longer, which an average of 1 second hides; the SRE book's example is a service whose average of 100 ms leaves 1% of its requests at 5 seconds. For a player who has paid, the slow tail is what they remember, and failed grants are counted apart.

?+ The gateway reports successful sign-ins, but some clients fail before they reach it. Which indicator includes those players?
* Successful sign-ins over attempts, measured and reported by clients
- Successful gateway responses over requests that reached the gateway
- Healthy sign-in instances over the instances scheduled to serve them
- Issued access tokens over accounts that have signed in this month
- Completed database reads over reads requested by the sign-in service
> Client measurements include attempts that failed before reaching the gateway. A server can count the requests it sees, but its success ratio leaves those missing attempts out. Instance health, issued tokens and database reads measure parts of the path rather than whether a player signed in.

?+ Players pay successfully but wait minutes for their items. Which indicator measures that failure?
* Verified purchases granted within the target time, over all verified
- Successful store verification calls, over all calls made to the store
- Purchase requests answered with HTTP 200, over all purchase requests
- Grants eventually completed, over purchases received during the day
- Purchase workers in use, over the workers available in the service
> The player needs the item, so the indicator counts verified purchases granted within the target time. Successful verification or a quick HTTP response does not show that the grant arrived, and eventual completion hides the wait. Worker use helps diagnose saturation but does not measure delivery to the player.

?+ Matchmaking's servers respond quickly, but players wait too long for opponents. Which indicator fits the player's experience?
* Tickets matched within the target wait, over all tickets created
- Ticket creation calls answered quickly, over all ticket creation calls
- Successful matchmaker health checks, over all checks sent to it
- Matches completed without a crash, over all matches that started
- Matchmaker workers below their CPU limit, over all active workers
> Creating a ticket is the start of the wait. The indicator follows it until a match is found and counts tickets matched within the target time against all tickets created. Fast creation, healthy workers and completed matches can all look good while players remain in the queue.

?? design-alert-symptoms Which condition should page the on-call engineer at 3 a.m.?
* Sign-ins failing at a rate that spends 2% of the budget in an hour
- One instance's CPU above 90% for five minutes, with no errors at all
- A read replica running ten seconds behind its primary at night
- One of twelve instances failing its health check and being replaced
- A dependency's latency rising, while the players' requests succeed
> A page is for a symptom that players feel and that needs action now: sign-ins failing at a burn rate of 14.4, which would spend the month's budget in about two days. A busy CPU, a lagging replica, a replaced instance and a slower dependency are causes that may hurt nobody, so they go to dashboards and tickets.

?+ One instance's CPU stays at 95% while each request meets its objective. What should happen?
* A ticket or a dashboard to look at, since players feel nothing yet
- A page, since the instance may fail soon and take requests with it
- A restart of the instance by a script, to bring its CPU back down
- A rollback of the last deploy, since it may be the cause of the load
- Nothing, since CPU is a figure that no one needs to watch
> Players are unaffected, so the cause goes where someone looks during the day, as saturation on the service's dashboard. A page for it wakes a person who has nothing to do, and a restart or a rollback acts on a guess. Saturation still matters: it is one of the four golden signals, and it warns of the next symptom.

?+ Sign-ins start failing twenty minutes after a deploy, and the page fires. What does the on-call engineer do first?
* Rolls back the deploy, then looks for the cause once sign-ins recover
- Reads the deploy's changes until the line that broke sign-in is found
- Waits for the error budget to show whether the failures are serious
- Deploys a fix forward, since a rollback loses the deploy's features
- Opens a postmortem, so that the timeline is written while it is fresh
> Mitigation comes before diagnosis: the deploy is the likeliest cause and the cheapest thing to undo, and players sign in again while the team finds out why, as the SRE book's rule to roll back first and diagnose afterward has it. Reading the diff first keeps players out while the search lasts, and a fix forward is a second change made under pressure.

?+ Why should each page ask for an action?
* A page that needs nothing trains the person on call to ignore pages
- The paging service charges for each page, so idle pages cost money
- Pages without an action are dropped by the phone's operating system
- The postmortem lists each page, and idle pages make it harder to read
- A page without an action stays open, since nobody is there to close it
> A page is an interruption, often at night, and pages that ask for nothing teach the person on call to treat the next one the same way, which the SRE book answers by holding that each page should call for an action. Signals that need no action now go to dashboards and tickets.

?+ The sign-in alert fires, and the dashboard shows the failures in one client build alone, released yesterday. What stops them fastest?
* Halting that build's rollout, and turning the failing call off with a flag
- Rolling back the backend, since the backend answers the failing requests
- Raising the minimum version to that build, so that its players update
- Waiting for the build's crash reports, since the failures come from it
- Asking the stores to withdraw the build from the players who have it
> A failure confined to one build points at the client: its rollout is halted so that no more players receive it, and a flag turns off the failing call, or its feature, for those who have it. Forcing updates onto the broken build helps nobody, the stores cannot take back an installed version, and a failure that does not crash sends no crash report.

## Abuse, cheating, and privacy at the service {#design-abuse-privacy}

The client is untrusted ([[#design-round-method]]), and at a game's scale some players test that each day. Each request is checked on the server before it changes anything, for ownership, for rate and for plausibility.

Ownership comes first. A request names objects by their ids, such as “sell item i-9” or “claim mail m-44”, and the server checks that each one belongs to the caller, the player named in the verified access token, never a player id taken from the request's body. The OWASP API Security Top 10, a list of API risks that security teams work from, puts [broken object level authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) first in its 2023 edition: each endpoint that receives an object's id and acts on the object should check that the caller may act on it. The check can sit in the statement that changes the data, as the version check of [[#design-consistency]] does:

```sql
-- p-17 sells item i-9; p-17 comes from the verified token, never from the request.
DELETE FROM inventory_item
WHERE item_id = 'i-9' AND player_id = 'p-17';
-- One row deleted: grant the price in the same transaction. None: not theirs, or sold already.
```

Rate comes next. Limits per account catch one account used faster than the game can be played: 500 runs an hour, in a game whose runs last three minutes, is a script. OWASP lists rate limiting against the unrestricted use of resources, and asks, separately, which business flows would harm the business if they were used excessively, such as claiming a gift. Accounts cost nothing, though, and a player farming a starting gift makes a new guest account for each claim ([[#design-player-data]]), so some limits are kept per device as well. The platforms help there. Apple's DeviceCheck lets the backend set and read two bits for each device, kept on Apple's server, which Apple suggests for marking devices that have already taken a promotional offer. Google Play's device recall, in beta in September 2026, gives each developer account three values per device, which its documentation says the app can recall even after it is reinstalled or the device is reset.

Plausibility is last: values are checked against what the game allows, as the leaderboard checks a score against the run's duration, the level's highest possible score and the player's history ([[#design-leaderboards]]). A result that passes those checks and still looks wrong, such as a win rate far above what the player's rating predicts, is replayed on the server from its inputs, as the asynchronous attacks of [[#design-matchmaking]] are.

[[Device attestation]] adds a signal to those checks ([[#http-sessions]]). Under this game's policy, a verdict that the app or the device is not genuine raises the checks on that account, with stricter limits or a review, and does not ban it by itself. Google's guidance is to use Play Integrity alongside other signals and not as the sole defense against abuse, and Apple's warns that one compromised device can serve assertions to many subscribers, and that no single policy eliminates all fraud.

When the evidence holds, a ban does more than refuse the sign-in. It removes the player's entries from the boards and marks their scores, so that the end-of-period job passes over them and the rewards go to the players below ([[#design-leaderboards]]). It withholds the rewards not yet paid, and it reverses through the [[ledger]] what the exploit granted. It keeps the evidence, since players appeal and support has to answer them. A ban on the account alone brings the player back as a new guest, which the limits per device slow down.

The same backend holds data about people, and privacy law and the stores decide what it may keep. Three rules apply from the start of each feature:

- Collect what the feature needs. A regional leaderboard needs the player's region, not their location, and a support tool needs the player's id, not their email address in each log line. Data minimization is one of the GDPR's principles, in the European Commission's words collecting and processing only the personal data necessary for the purpose, and Apple's App Review Guidelines ask apps to collect and use only the data that the task in hand requires.
- Keep it for a stated period. Each store of player data gets its retention when it is created: request logs for 30 days, for instance; raw telemetry for a year, then only as aggregates that name nobody; chat history for a week ([[#design-social]]); the financial records of purchases for as long as the law requires. Logs count: they hold IP addresses and device identifiers, and the European Commission's examples of personal data include an IP address and a phone's advertising identifier. The GDPR's principle of storage limitation keeps personal data for no longer than its purposes need, and both stores ask the privacy policy to state the developer's retention and deletion policy. The storage enforces the period, so that expiry needs nobody to remember it: logs in daily partitions or files that are dropped whole when they reach their age, the lifecycle rules of [[object storage]], a [[time to live]] on keys.
- Make deletion reach each copy. Chapter 13's list of the places that hold a player's data drives deletion and export, backups included ([[#design-player-data]]). A processor, a company that processes the data on the game's behalf, such as the vendor behind an analytics SDK, receives the deletion through a request of its own, as chapter 13's list has it.

Two kinds of rule vary with where the player is and how old they are, and a platform engineer names them and leaves their reading to the company's lawyers. Regional data rules: the GDPR requires safeguards for personal data transferred out of the European Economic Area, which bears on the choice of regions in [[#design-degradation]], and other countries have rules of their own about where their residents' data may go. Children's data: COPPA in the United States and the GDPR's age of consent, which [[#design-social]] set out, and what the stores require of apps for children. Apple's guidelines say that apps in the Kids category should not include third-party analytics or third-party advertising, and Google Play's Families policy asks apps to disclose the personal and sensitive information they collect from children, including through APIs and SDKs. In September 2026 both stores also offer an age range for a user: Apple's Declared Age Range, available worldwide from iOS 26, returns a range without the exact birthdate, and Google Play's Age Signals API, in beta, returns ranges such as 13 to 15.

The fields that the backend stores also feed the stores' privacy disclosures. Apple's privacy details count data as collected when it is transmitted off the device and kept for longer than it takes to serve the request, and ask for all of the data that the app or its third-party partners collect, and Google Play's policy asks for the same openness about user data. A list of each field, with the feature that needs it, its retention and what deletes it, is the source for both forms, for the deletion walk of chapter 13, and for this section's exercise.

Exercise: List the fields that your backend stores for each player. Beside each, write the feature that needs it, where it is stored, how long it is kept, and what deletes it when that time passes.

?? design-server-validation A request asks to sell item i-9 for player p-17. What does the server check before it sells?
* That i-9 belongs to the player named in the verified access token
- That the request's body names p-17 as the owner of the item i-9
- That the item's id is well formed, since random ids are hard to guess
- That the client showed p-17 the item in its inventory screen first
- That p-17's session began less than an hour before the request
> An API that acts on any object whose id a request supplies has broken object level authorization, first on OWASP's list of API risks. The owner comes from the verified token, and the check can sit in the statement that sells, a `WHERE` that names the item and the player. A body's claim is the client's word, and an id that is hard to guess still reaches clients who have seen it.

?+ Where does the server take the player's id from when it applies a request?
* The access token that it verified, whatever the request's body says
- The request's body, since the client acts on the player's behalf
- A header that the client adds with the player's id to each request
- The device's advertising identifier, which the platform provides
- The last player id that the gateway saw from the same IP address
> The token was issued by the backend and checked at the gateway, so the id inside it is the one that the server trusts. A body or a header says whatever the client wants, an advertising identifier names a device rather than an account, and many players share one IP address on mobile networks.

?+ Scores arrive from one account 40 times a minute, in a game whose runs last three minutes. What catches it?
* A rate limit per account, set from how fast the game can be played
- The rate limit on the endpoint in total, which caps what reaches it
- The score's plausibility check against the level's highest score
- Device attestation, whose verdict fails when a device sends too often
- The board's `GT` option, which keeps the best of the scores it gets
> A player finishes no more runs than the runs' length allows, so a limit per account, set from the game itself, catches a script that submits as fast as it can. A limit on the endpoint in total lets one account take its share, each score can be plausible on its own, and attestation says whether the app is genuine rather than how often it is used.

?+ A player farms a starting gift with a new guest account for each claim. Which limit slows it?
* A limit per device, which a new account on the same device still meets
- A limit per account, which each new account starts again from zero
- A rate limit on the gift's endpoint, which each account uses once
- A check that the gift's value matches the game's configuration
- A captcha checked in the client, with no proof sent to the backend
> Accounts cost nothing, so a limit per account resets with each new one. A limit tied to the device survives new accounts, and the platforms offer signals for it: DeviceCheck keeps two bits per device, which Apple suggests for devices that have already taken an offer. Each claim is valid for its own account, and a captcha whose result the backend never verifies is the client's to skip. A server-verified captcha can be another useful control.

?+ Play Integrity reports a failed device integrity check. Under this game's policy of combining abuse signals before enforcement, what happens next?
* Weighs it with its other signals, as stricter limits or a review
- Bans the account at once, since the verdict proves that it cheats
- Ignores it, since the client can forge the verdict before sending it
- Refuses each request from the device until a later verdict passes
- Deletes the account's progress, since the device may have altered it
> Google's guidance is to use Play Integrity alongside other signals rather than as the sole defense against abuse, and a device that fails can belong to an honest player with a modified phone. Under the game's stated policy, the backend raises its checks and combines the evidence. Other policies may temporarily deny access on a failed verdict without declaring the player a cheater. The server verifies the verdict rather than trusting the client's report.

?+ A cheater is banned. What else does the ban do?
* Removes their board entries, withholds rewards, and reverses gains
- Deletes their account, so that no record of the cheating remains
- Resets their progress to zero, and leaves their purchases as they were
- Blocks their IP address, so that new accounts from it are refused
- Nothing more, since blocking the sign-in stops the cheating itself
> A ban also undoes what the cheating earned: board entries are removed and passed over at payout, so the rewards go to the players below, and the ledger reverses what the exploit granted. The evidence is kept for appeals, and one IP address is shared by many players on mobile networks.

?? design-data-retention Request logs hold each player's IP address and device identifier. How long does the backend keep them?
* For a stated period that their purpose needs, then they are deleted
- For as long as storage is cheap, since logs help with later debugging
- For as long as the player keeps the account, then with the account
- For seven years, the period that tax law sets for financial records
- Until the backup that holds them expires, which is when logs are read
> IP addresses and device identifiers can identify a person, and the GDPR's principle of storage limitation keeps personal data for no longer than its purpose needs. The backend sets the period when it creates the store, 30 days for request logs for instance, and the storage deletes them as they reach it. Tax law covers purchase records, not logs.

?+ A regional leaderboard is planned. What does the backend store to place each player?
* A region for each player, which is what the board needs
- The player's GPS location, so that regions can be redrawn later
- The player's IP address, kept so the region can be checked again
- The player's billing address, taken from the purchase records
- The player's time zone and precise location, for the reset's time
> Data minimization keeps what a feature needs: the board needs a region, so the backend stores a region. A location or an IP address kept for later is data that a breach can expose and that the privacy disclosures have to declare, with no feature that uses it, and a billing address answers a question that the board does not ask.

?+ How does the backend make sure that logs kept for 30 days are gone after 30 days?
* The storage drops each day's partition or files once they reach 30 days
- A monthly job reads each log line and deletes the old ones one by one
- A support engineer deletes old logs when a player asks for deletion
- The players' clients ask for their logs to be deleted when they update
- The logs are kept in memory, which clears when the instances restart
> Retention that the storage enforces works whether anyone remembers it: logs in daily partitions or files, dropped whole by their age, or object storage's lifecycle rules. A job that deletes line by line is slow and can fail unnoticed, a deletion request covers one player rather than a period, and logs in memory vanish before anyone can read them.

?+ The backend starts storing players' email addresses for a newsletter. What else has to change?
* The stores' privacy disclosures, which cover what the backend keeps
- Nothing, since the disclosures cover what the app's SDKs collect
- The app's permissions, since email addresses need a permission prompt
- The minimum client version, since old clients do not send the address
- The age rating, since collecting email addresses raises the rating
> Apple counts data as collected when it leaves the device and is kept for longer than it takes to serve the request, and Google Play asks for the same openness about user data, so an address that the backend stores enters both stores' disclosures. The list of fields, with their purposes and retention, is the source for both forms.

?+ The game adds a mode for children under 13 in the United States. Which rule changes what the backend may collect from them?
* COPPA, which asks for a parent's verifiable consent before collecting
- The GDPR, which sets one age of consent across the European Union
- Apple's Kids category, which bans games in it from running servers
- None, since children's data follows the rules for adults' data
- Google Play's Data safety form, which bans collecting children's data
> COPPA covers online services directed to children under 13 and asks for a parent's verifiable consent before their personal information is collected, so the mode collects less. The GDPR lets each member state set its age between 13 and 16, Apple's Kids category restricts third-party analytics and advertising rather than servers, and the Data safety form asks for disclosure.
