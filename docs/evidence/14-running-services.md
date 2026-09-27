# Evidence for chapter 14: Running game services at scale

What Phase 32 checked the chapter’s claims against, and where the outline was wrong. [PLAN.md](../PLAN.md), under “Decisions: evidence”, says what counts as evidence.

The documentation was read on September 27, 2026. Figures that change with time, such as Kubernetes's defaults and the status of the stores' age-range APIs, are dated to this read, and the chapter states them in prose alone.

Codex (GPT-6 Sol, `xhigh`) gathered 100 receipts in 26 minutes and 279,222 tokens and drafted this file. Its working file held ten more, with shorter quotes, which were kept. The session added 38 receipts under rule A, for the sentences that the chapter leans on and Codex had not quoted, pulled out of the pages by a script. All 148 passed on re-fetch; the resumed session checked them again against the saved pages, with no failures. One more receipt, fetched during completion, verifies PostgreSQL's null-safe comparison used by the corrected backfill, bringing the total to 149. The bullets below give the durable sources, and the receipts stayed in the phase's scratch folder.

## Checked, and against what

### design-spikes

- Reactive autoscaling periodically changes desired capacity to match observed load: confirmed. Source: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
- The Kubernetes horizontal autoscaler has a default synchronization interval of 15 seconds: confirmed. Source: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
- The Kubernetes horizontal autoscaler has a 300-second default scale-down stabilization window: confirmed. Source: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
- Provisioning new capacity takes time, so a sudden spike can outpace reactive scaling: confirmed. Source: https://learn.microsoft.com/en-us/azure/architecture/patterns/throttling
- Predictive scaling can launch capacity before forecast demand so instances have time to become ready: confirmed. Source: https://docs.aws.amazon.com/autoscaling/ec2/userguide/predictive-scaling-policy-overview.html
- Scheduled scaling raises or lowers capacity at a known date and time: confirmed. Source: https://docs.aws.amazon.com/autoscaling/ec2/userguide/scaling-overview.html
- A virtual waiting room holds excess users before they overwhelm the origin; the chapter can use this as a login admission pattern: confirmed. Source: https://developers.cloudflare.com/waiting-room/
- A service can impose both per-customer and global limits: confirmed. Source: https://learn.microsoft.com/en-us/azure/architecture/patterns/throttling
- A token bucket allows a bounded burst and refills at a steady rate: confirmed. Source: https://learn.microsoft.com/en-us/azure/architecture/patterns/throttling
- As utilization rises, overload handling can reject lower-criticality requests first: confirmed. Source: https://sre.google/sre-book/handling-overload/
- Cheap rejection is essential: when rejecting costs nearly as much as processing, rejection can consume unacceptable resources: confirmed. Source: https://sre.google/sre-book/handling-overload/
- A server should check remaining deadline before doing more work on a multi-stage request: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- A long backlog can contain stale requests whose clients have already given up: confirmed. Source: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_fail_fast.html
- A cascading service can recover by admitting a small fraction of traffic, letting servers become healthy, then gradually ramping load: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- Load tests should include gradual and sudden traffic patterns: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- Load tests should examine how a component behaves after overload as it returns to normal traffic: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- A load test should inspect whether popular clients queue work during an outage and use randomized backoff: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- Health checks that fail during overload can prevent the service from stabilizing: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/

- A survey of launch incidents describes a login queue as admission control that protects the database tier, admitting players at a rate that the storage layer can absorb: confirmed. Source: the survey of launch incidents that PLAN.md lists under “Decisions: system design”.
- The same survey describes a 2021 outage of about 73 hours on a large game platform that ended with capacity restored in slices, since a cold fleet that accepts each client at once produces a thundering herd: confirmed. Source: the same survey.
- The survey describes a weekend before a launch whose stated purpose was to push the live infrastructure until something gave: confirmed. Source: the same survey.
- Servers that spend resources on requests that will exceed their deadlines on the client are a common theme of cascading outages: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- Load tests push components until they break, and a small first load warms the caches before more traffic follows: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/

### design-degradation

- Overload is the most common cause of cascading failures: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- When one cluster fails, its load can move to another and exhaust that cluster: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- Overloaded queues raise latency and memory use: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- Bulkheads isolate resources into pools so one failure does not stop all service paths: confirmed. Source: https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead
- Separate connection pools keep one failing dependency from exhausting calls to another: confirmed. Source: https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead
- A circuit breaker stops calling a failing dependency after failures cross a threshold: confirmed. Source: https://martinfowler.com/bliki/CircuitBreaker.html
- A server-wide retry budget can stop retries from amplifying an overload: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- A service can return a degraded result when a dependency fails instead of failing the whole request: confirmed. Source: https://sre.google/sre-book/handling-overload/
- Regions and zones are distinct failure domains whose resources can fail independently: confirmed. Source: https://docs.cloud.google.com/architecture/infra-reliability-guide/building-blocks
- Asynchronous PostgreSQL log shipping can lose transactions that have not reached a standby: confirmed. Source: https://www.postgresql.org/docs/18/warm-standby.html
- Synchronous PostgreSQL replication makes commits wait for confirmation from a standby: confirmed. Source: https://www.postgresql.org/docs/18/warm-standby.html
- Recovery time objective is the maximum acceptable delay before service restoration: confirmed. Source: https://docs.aws.amazon.com/wellarchitected/2024-06-27/framework/rel_planning_for_recovery_objective_defined_recovery.html
- Recovery point objective is the maximum acceptable time since the last recoverable data point: confirmed. Source: https://docs.aws.amazon.com/wellarchitected/2024-06-27/framework/rel_planning_for_recovery_objective_defined_recovery.html
- Redundant instances across independent failure domains can improve availability: confirmed. Source: https://docs.cloud.google.com/architecture/infra-reliability-guide/building-blocks

- A cascading failure grows over time as a result of positive feedback: a part that fails makes other parts more likely to fail: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- Killing tasks that fail their health checks while overloaded can make the service unhealthy: confirmed. Source: https://sre.google/sre-book/addressing-cascading-failures/
- The bulkhead pattern is named after the partitions of a ship's hull: confirmed. Source: https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead
- The least that a synchronous commit waits is the round trip between the primary and the standby: confirmed. Source: https://www.postgresql.org/docs/18/warm-standby.html
- Long-lived kill switches let operators degrade functionality that is not vital under unusually high load: confirmed. Source: https://martinfowler.com/articles/feature-toggles.html

### design-backend-deploys

- Live changes are a major outage source, with one published SRE policy attributing roughly 70 percent of its outages to them: confirmed. Source: https://sre.google/workbook/error-budget-policy/
- Both binary and configuration changes can be rolled out progressively to small fractions of traffic: confirmed. Source: https://sre.google/sre-book/service-best-practices/
- Rollouts need monitoring and should roll back promptly when unexpected behavior appears: confirmed. Source: https://sre.google/sre-book/service-best-practices/
- A rolling deployment gradually reduces old replicas and adds new ones: confirmed. Source: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Kubernetes rolling deployments default maxUnavailable and maxSurge to 25 percent: confirmed. Source: https://kubernetes.io/docs/reference/using-api/deprecation-guide/
- Graceful termination should drain active connections when instances are upgraded or scaled down: confirmed. Source: https://kubernetes.io/docs/tutorials/services/pods-and-endpoint-termination-flow/
- Blue-green deployment uses two production environments and switches traffic to the prepared one: confirmed. Source: https://martinfowler.com/bliki/BlueGreenDeployment.html
- Switching back can quickly roll back the code path, but transactions made while the new environment was live still require a data plan: confirmed. Source: https://martinfowler.com/bliki/BlueGreenDeployment.html
- Canary deployment compares a changed population with a control population: confirmed. Source: https://sre.google/workbook/canarying-releases/
- Expand and contract breaks an incompatible interface change into expand, migrate, and contract phases: confirmed. Source: https://martinfowler.com/bliki/ParallelChange.html
- The contract phase waits until old clients have migrated away from the old interface: confirmed. Source: https://martinfowler.com/bliki/ParallelChange.html
- PostgreSQL ALTER TABLE takes an ACCESS EXCLUSIVE lock unless a subform documents another lock: confirmed. Source: https://www.postgresql.org/docs/18/sql-altertable.html
- Adding a nullable PostgreSQL column does not require a table rewrite: confirmed. Source: https://www.postgresql.org/docs/18/sql-altertable.html
- Adding a column with a volatile default rewrites the table and its indexes in PostgreSQL: confirmed. Source: https://www.postgresql.org/docs/18/sql-altertable.html
- PostgreSQL CREATE INDEX CONCURRENTLY avoids locks that block writes: confirmed. Source: https://www.postgresql.org/docs/18/sql-createindex.html
- Large data migrations can run as batched background migrations: confirmed. Source: https://docs.gitlab.com/development/database/batched_background_migrations/
- A configuration change needs semantic validation as well as syntax validation: confirmed. Source: https://sre.google/workbook/configuration-design/
- The ability to roll back a bad configuration can shorten an incident: confirmed. Source: https://sre.google/workbook/configuration-design/
- Unity Gaming Services Remote Config has separate environments for settings and overrides: confirmed. Source: https://docs.unity.com/en-us/remote-config/environments
- A Unity Gaming Services Game Override can target a percentage of players: confirmed. Source: https://docs.unity.com/en-us/remote-config/game-overrides-and-settings
- Operations toggles let operators control production behavior when a feature needs to be disabled or degraded: confirmed. Source: https://martinfowler.com/articles/feature-toggles.html

- Canarying is a partial and time-limited deployment of a change in a service and its evaluation, which decides whether the rollout proceeds: confirmed. Source: https://sre.google/workbook/canarying-releases/
- In PostgreSQL, changing a column's type normally rewrites the table and its indexes: confirmed. Source: https://www.postgresql.org/docs/18/sql-altertable.html

### design-slos

- An SLI is a quantitative measure of service delivered: confirmed. Source: https://sre.google/sre-book/service-level-objectives/
- An SLO is a target value or range for an SLI: confirmed. Source: https://sre.google/sre-book/service-level-objectives/
- An SLA is a user contract with consequences when service objectives are met or missed: confirmed. Source: https://sre.google/sre-book/service-level-objectives/
- Indicators should be chosen from what users care about, including the client-side view where it can be measured: confirmed. Source: https://sre.google/sre-book/service-level-objectives/
- An event-based SLI can be expressed as good events divided by total events: confirmed. Source: https://sre.google/workbook/implementing-slos/
- An error budget is one minus the SLO: confirmed. Source: https://sre.google/workbook/error-budget-policy/
- An exhausted error budget can pause releases while reliability work proceeds: confirmed. Source: https://sre.google/sre-book/embracing-risk/
- The four golden signals are latency, traffic, errors, and saturation: confirmed. Source: https://sre.google/sre-book/monitoring-distributed-systems/
- Alert rules should detect urgent, actionable, user-visible conditions: confirmed. Source: https://sre.google/sre-book/monitoring-distributed-systems/
- Latency of successful and failed requests should be separated: confirmed. Source: https://sre.google/sre-book/monitoring-distributed-systems/
- Average latency can conceal slow tail requests: confirmed. Source: https://sre.google/sre-book/monitoring-distributed-systems/
- The workbook table pages at a 14.4 burn rate, corresponding to 2 percent of budget spent in one hour: confirmed. Source: https://sre.google/workbook/alerting-on-slos/
- The workbook burn-rate examples use a 30-day error budget: confirmed. Source: https://sre.google/workbook/alerting-on-slos/
- Multiwindow alerts use a shorter window to confirm that the budget is still burning: confirmed. Source: https://sre.google/workbook/alerting-on-slos/
- W3C Trace Context uses traceparent to identify the incoming request across tracing systems: confirmed. Source: https://www.w3.org/TR/trace-context/
- The incident commander holds the incident state and assigns work: confirmed. Source: https://sre.google/sre-book/managing-incidents/
- Incident response should stabilize service before pursuing root cause: confirmed. Source: https://sre.google/sre-book/effective-troubleshooting/
- A postmortem records impact, mitigation, root causes, and follow-up actions: confirmed. Source: https://sre.google/sre-book/postmortem-culture/
- A blameless postmortem focuses on contributing causes instead of blaming individuals or teams: confirmed. Source: https://sre.google/sre-book/postmortem-culture/

- The example policy halts changes and releases other than P0 issues or security fixes once the budget of the preceding four weeks is exceeded: confirmed. Source: https://sre.google/workbook/error-budget-policy/
- A few indicators are chosen from what users want, rather than one for each metric that monitoring can track: confirmed. Source: https://sre.google/sre-book/service-level-objectives/
- A user on a 99% reliable smartphone cannot tell 99.99% from 99.999%, and each increment of reliability may cost 100 times the previous one: confirmed. Source: https://sre.google/sre-book/embracing-risk/
- Monitoring asks what is broken, the symptom, and why, the cause, and each page should be actionable: confirmed. Source: https://sre.google/sre-book/monitoring-distributed-systems/
- In a major outage, the responder makes the system work as well as it can under the circumstances before looking for the root cause: confirmed. Source: https://sre.google/sre-book/effective-troubleshooting/
- A blameless postmortem assumes that everyone involved had good intentions and did the right thing with the information they had: confirmed. Source: https://sre.google/sre-book/postmortem-culture/

### design-abuse-privacy

- The server should authorize each request against the object it names: confirmed. Source: https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/
- A request rate limit is one control for unrestricted resource consumption: confirmed. Source: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/
- Sensitive business flows should be identified for protection against excessive use: confirmed. Source: https://api-security.owasp.org/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/
- App Attest is a fraud signal, not a guarantee that a device is uncompromised: confirmed. Source: https://developer.apple.com/documentation/devicecheck
- DeviceCheck can store two per-device binary values for server queries and updates: confirmed. Source: https://developer.apple.com/documentation/devicecheck/accessing-and-modifying-per-device-data
- Play Integrity device recall remained beta in the documentation checked in September 2026: confirmed. Source: https://developer.android.com/google/play/integrity/device-recall
- Play Integrity device recall exposes three values per device across apps under one developer account: confirmed. Source: https://developer.android.com/google/play/integrity/device-recall
- Apple requires apps to collect only data needed for the relevant task: confirmed. Source: https://developer.apple.com/app-store/review/guidelines/
- Apple requires privacy policies to explain data retention, deletion, and how users request deletion: confirmed. Source: https://developer.apple.com/app-store/review/guidelines/
- Google Play requires disclosure of user-data collection and use, including device information: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/10144311?hl=en
- Google Play requires a privacy policy to state the developer data retention and deletion policy: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/10144311?hl=en
- GDPR data minimisation limits collection to what a purpose requires: confirmed. Source: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en
- GDPR storage limitation says personal data must not be kept longer than necessary for its purpose: confirmed. Source: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en
- The European Commission lists IP addresses and phone advertising identifiers as personal-data examples: narrowed to The Commission lists IP addresses and phone advertising identifiers as examples; whether a particular log field identifies someone depends on context. Source: https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en
- A processor handles personal data on behalf of a controller: confirmed. Source: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en
- Online erasure workflows must notify other websites that have received the data where reasonable: confirmed. Source: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en
- Personal-data transfers outside the European Economic Area require special safeguards: confirmed. Source: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/rules-international-data-transfers_en
- Apps in the App Store Kids Category should generally avoid third-party analytics and advertising: confirmed. Source: https://developer.apple.com/app-store/review/guidelines/
- Google Play Families policy requires disclosure of personal and sensitive information collected from children, including through SDKs: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/9893335?hl=en
- COPPA applies to online services directed to children under 13 that collect, use, or disclose personal information: confirmed. Source: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Apple Declared Age Range can return a range without collecting an exact birthdate: confirmed. Source: https://developer.apple.com/documentation/declaredagerange/requesting-people-share-their-age-range-with-your-app
- Apple documented Declared Age Range as available worldwide on iOS 26 and later: confirmed. Source: https://developer.apple.com/news/?id=8jzbigf4
- Google Play Age Signals was documented as beta in September 2026: confirmed. Source: https://developer.android.com/google/play/age-signals/use-age-signals-api
- Google Play Data safety declarations include data handled by libraries and SDKs: confirmed. Source: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
- Apple App Review guideline 5.1.4 restricts asking for birthdate and parental contact information to legal compliance purposes: confirmed. Source: https://developer.apple.com/app-store/review/guidelines/
- The Play Age Signals release notes identify version 0.0.4 as the July 2026 release: confirmed. Source: https://developer.android.com/google/play/age-signals/release-notes

- OWASP's 2023 list puts broken object level authorization first, as API1: confirmed. Source: https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/
- Google's guidance uses Play Integrity alongside other signals and not as the sole anti-abuse mechanism: confirmed. Source: https://developer.android.com/google/play/integrity/overview
- Apple warns of one compromised device serving assertions to many subscribers: confirmed. Source: https://developer.apple.com/documentation/devicecheck/assessing-fraud-risk
- Apple suggests DeviceCheck's two bits for identifying devices that have already taken a promotional offer: confirmed. Source: https://developer.apple.com/documentation/devicecheck
- Device recall data survives a reinstall of the app and a reset of the device: confirmed. Source: https://developer.android.com/google/play/integrity/device-recall
- Apple counts data as collected when it is transmitted off the device and kept longer than it takes to serve the request, and asks for all of the data that the app or its third-party partners collect: confirmed. Source: https://developer.apple.com/app-store/app-privacy-details/
- Google Play Age Signals returns default ranges of 0 to 12, 13 to 15, 16 to 17, and 18 and over: confirmed. Source: https://developer.android.com/google/play/age-signals/use-age-signals-api

## Rests on documentation alone

- The Kubernetes autoscaler, rolling deployment and termination behavior; cloud scaling and waiting room behavior; PostgreSQL lock and replication behavior; service level practice; store policies; and age signal status are documentation claims. No cluster, cloud account, production workload or store account was used to test them. The source URLs above are the receipts.

- The survey of launch incidents that PLAN.md lists under Decisions: system design (https://www.cgmagonline.com/articles/how-online-games-stay-up) supplies context for login queues and staged recovery. It is a survey, so the design claims above use software documentation as their primary evidence. No incident name from that survey belongs in the chapter.

- The SRE book describes restoring a cascading service by allowing a small share of traffic, waiting for servers to recover, and raising traffic gradually. The survey supplies an incident example. The chapter can describe that mechanism without identifying any game, studio or publisher.

## Narrowed or cut

- The measured 15-second autoscaler synchronization interval and 300-second scale-down stabilization window are Kubernetes defaults, not a promise that new capacity serves traffic within either interval. Provisioning, scheduling, booting and readiness add time. No fixed instance startup time was found, so do not print one.

- A virtual waiting room protects the origin from excess arrivals. It protects a database tier only if admission is placed before the path that reaches that tier and the admitted rate fits database capacity. Treat that last relationship as a design calculation.

- The cited priority guidance supports rejecting less critical work first. The particular ordering of telemetry and purchases is a chapter design choice. Purchases can depend on external acknowledgement and durable grant work, so the writer should avoid making it a promise that every purchase completes during overload.

- PostgreSQL asynchronous replication can lose writes that have not reached a standby. Synchronous replication makes a commit wait for confirmation. A second region therefore has a durability and latency tradeoff; neither mode supplies a universal recovery point.

- A server rollback changes routing or code, but data written while new code ran can remain. The old version must read those writes or the rollout must provide a compatible data path. Blue-green switching alone does not reverse transactions.

- A Unity Gaming Services Remote Config Game Override can reach a percentage of user IDs and environments have separate settings. This is client-consumed configuration, not evidence that a server feature flag has already been implemented.

- DeviceCheck exposes two per-device bits and Play Integrity device recall was marked beta on the page checked in September 2026. Neither provides a general, precise device rate-limit counter by itself. App Attest is one signal in a broader risk assessment.

- The Commission lists IP addresses and phone advertising identifiers as personal-data examples. Assess each log field in context. The evidence supports retention limits and erasure duties, but it does not prescribe one retention period for all fields.

- The age-range APIs return signals, not a universal proof of exact age. The Apple documentation describes Declared Age Range availability on iOS 26 and later; the Google Play documentation labels Age Signals beta and its July 2026 release notes identify version 0.0.4. The stores still place children’s data and disclosure duties on the app.

- No zone's round-trip time is given: no source for it was read, and the chapter says only that zones are separate failure domains within a region.
- The SRE book's point about what users can feel is that a user on a 99% reliable smartphone cannot tell 99.99% from 99.999%, not from 100%, and the chapter states it that way.
- DeviceCheck's pages do not say that the bits survive a reinstall. The chapter states what Apple suggests them for, devices that already took a promotional offer, and gives the reinstall and reset for Play Integrity's device recall alone, whose page says so.
- The share of outages caused by changes, roughly 70%, comes from the example error budget policy in the SRE workbook, and the chapter names that source rather than stating it as a general finding.
- The figures for the end of an outage, half a million players retrying about twice a minute, are invented for the estimate and say so. Their arithmetic, 500,000 over 30 seconds, gives about 17,000 sign-ins a second.

## Where the outline fell short

- Launches, daily resets, event starts, broadcasts and mass reconnections are candidate synchronized moments. The chapter should have the reader estimate each moment, including retry traffic, because the sources do not give a universal shape or peak.

- Health checks require separate process and service semantics under overload. Killing an overloaded instance can shift work to its peers and worsen a cascade. The chapter should distinguish readiness or traffic removal from restarting the process.

- The examples of leaderboards, chat and events failing are feature decisions. Define which cached or absent result the client shows, whether core play continues, and which request paths are allowed during recovery.

- Dashboards split by endpoint, region and client version are useful proposed views, not a rule in the SRE text. The service should choose dimensions that isolate user-visible failure and avoid logging unnecessary personal data.

- Ownership and plausible-value validation, replaying suspicious results, and bans that revoke rewards or remove board entries require the service’s authority model and rules. OWASP supports object authorization, bounded resource use and protected business flows, but no cited source defines the chapter’s exact anti-cheat policy.

- The outline gives no deletion procedure for backups or processors in this chapter. Chapter 13 already covers account deletion and backup handling. This chapter should connect its retention table to those workflows and avoid promising immediate physical removal from immutable backups.

- The outline asks for incidents from published postmortems. The chapter describes what the survey that PLAN.md lists reports, a login queue's purpose, a 2021 outage restored in slices and a weekend of load before a launch, without naming a game, studio or publisher, and takes the mechanism of each from the SRE book. No primary postmortem was needed.
- The outline gives the login queue, rate limits and load shedding no concept of their own. The chapter tests them as variants of `design-autoscaling-lag`, since they are the admission control that the outline pairs with scheduled capacity as the answer to autoscaling's lag.

## Runs

- The session compiled the chapter's `Admission` class as printed, in a .NET 8 console project with warnings as errors. With a capacity of 100, sheddable requests were admitted up to 60 in flight, normal ones up to 90 and critical ones up to 100, and each class was refused beyond its limit. With a capacity of 5 and eight threads, three million requests never put more than 5 in flight, and the sheddable third was refused far more often than the critical third: 999,992 against 964,136 of a million each.
- After review, the resumed session ran the corrected backfill on SQLite 3.51.0 against 2,500 profiles, one already synchronized and one with a non-null stale copy left by an old writer. The batches changed 1,000, 1,000 and 499 rows, then 0; a second run changed nothing. A separate run closed and reopened the database after the first committed batch and interleaved an atomic dual write on an unprocessed row: batches were 1,000, 1,000 and 498, then 0. Assertions checked the stale copy, nulls on either side, equal nulls, restart, and repeat execution. Python's row-count result for SQL preceded by comments was -1, so the harness removed comments before counting; the SQL statement itself was unchanged. These runs check migration logic, not PostgreSQL concurrency or locking.
- The chapter's arithmetic was checked by hand: four instances at 75% leave three at 100%; with three zones, losing one multiplies survivor load by 1.5, so two-thirds is the full-capacity boundary and 50% normal load becomes 75%; 100 calls a second in flight for 10 seconds, 50 ms and 1 second are 1,000, 5 and 100; 0.1% of 180 million sign-ins is 180,000; the peak hour's 3 × 250,000 is 750,000; a burn rate of 14.4 on a 0.1% budget is 1.44% of sign-ins failing, and 2% of the budget an hour spends all of it in 50 hours.
- Codex's .NET 8 harness also compiled an admission check and a token bucket and passed its own tests of shedding by priority, limits per player and in total, and refill. It is a single-process example; a fleet of instances needs a shared count for a limit in total, as the gateway's limits are.
- Codex's SQLite harness ran a smaller backfill, which resumed after a stop and changed nothing on a repeat. SQLite shows the SQL's logic, not PostgreSQL's locks, rewrites or concurrent index builds, which rest on its documentation.
- No Unity, Editor, cloud or Redis run was needed for this chapter.

## Blind review and completion

The GPT-6 Astra review (`xhigh`) completed successfully after the writing session stopped. Its status file records 09:16:57 to 12:26:30 on September 27, 2026, 189 minutes 33 seconds of wall time; its log reports 207,032 tokens. It read the draft, all 52 variants and the then-current 143 receipts. All ten reported problems held and were resolved before the first commit:

1. **Migration:** reading a non-null new column during mixed-version writes can expose an old value. The old column now remains authoritative until old writers and their rollback paths retire. Writers update both columns atomically; the backfill repairs every difference before reads switch. PostgreSQL documents `IS DISTINCT FROM` as “Not equal, treating null as a comparable value.” Source: https://www.postgresql.org/docs/18/functions-comparison.html. The SQLite regression above reproduces the old-writer case and verifies the repair.
2. **Login admission:** a ticket marks eligibility, not a reserved unit of future database capacity. Redemption now consumes a ticket once and passes the current aggregate sign-in budget, including clients returning from the background.
3. **Little's law:** concurrency calculations are averages, not peak bounds. The timeout example now says so, and the bulkhead supplies the hard bound.
4. **Canary exposure:** a request share is not a player share. The chapter distinguishes the two; a stable player cohort is needed to bound the latter. The glossary also qualifies the comparison by requiring comparable traffic.
5. **Zone capacity:** two-thirds normal utilization leaves survivors at 100%, with no burst allowance. The question and prose require headroom below that boundary, checked under failure load.
6. **Attestation distractor:** temporary denial is a defensible policy. The question now explicitly asks about this game's policy of combining signals, and the explanation distinguishes denial from proof of cheating.
7. **Captcha distractor:** a server-verified captcha can slow automation. The wrong option now specifies a client check with no proof sent to the backend.
8. **Cache lifetime:** starting a TTL does not empty a cache. The wrong option now expires entries together at the reset.
9. **Concept scope:** three variants under `design-sli-choice` tested budget arithmetic, release policy and SLO selection. They now test indicator choice for client-visible sign-in failures, delayed grants and matchmaking waits. Budgets and objectives remain in prose and the exercise; the outline's ten concept ids and 52 variants remain.
10. **Outage statistic:** the unsupported generalization that most outages begin with a change was removed; the attributed SRE example remains.

The writer's queued precision fixes were also applied, including 429 for the retry question, urgent and security exceptions to the example release freeze, rolling deploy capacity, processor deletion wording and incident roles. The admission sample now states how the caller pairs successful entry and exit in `finally`.

Final automated checks: 675 tests, content parsing/rendering, the self-contained build, style, question preservation against `4c3b742` accepting chapter 14 alone, and six new links returning 200 without redirects. The no-brand search found no forbidden names. The detector ran section by section and on the seven new glossary entries in technical/rendered-Markdown mode through its bundled engine, since the skill's thin CLI wrapper does not accept the source-mode flag. Scores were 2–3 for the sections and 0 for each entry. Its remaining flags are section-link ids read as hashtags, narrow technical vocabulary, the noun “features” misread as a verb, and “genuine” describing app integrity rather than intensifying a claim. The judgment-only read found no further writing issue.
