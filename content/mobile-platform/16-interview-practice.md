---
book: unity-mobile-platform-engineering
chapter: Interview practice for platform roles
---

## Answer “how would you integrate this SDK” {#interview-integration-answer}

This chapter assumes the first book's last chapter. That chapter covers choosing two or three projects whose stories give complementary evidence, and stating metrics and your own part in them honestly. It scores a practice answer from 0 to 2 on requirements, ownership, failure handling, trade-offs and evidence, and spaces a study loop like the site's review queue. This chapter stays on the questions a platform role adds. Each section practises answers aloud, and each answer draws on sections of this book that it names, so a weak answer points to the section to reread.

Platform interviews ask “How would you integrate this SDK?” in one form or another, since SDK work is much of the role, and the answer has a structure. Eight parts cover it, in this order:

| Part | What the answer says | Where this book covers it |
| --- | --- | --- |
| Purpose | What the SDK is for, which feature or decision depends on it, and what success looks like | This section |
| Evaluation | What it adds to the build, how it behaves when it runs, and how it ships | [[#sdk-evaluation]] |
| The boundary | A game-owned interface and result types, with one adapter that names the vendor | [[#platform-interfaces]] |
| Platform work | Initialization, callbacks and their threads, lifecycle events and permissions | Chapters 2 to 4, from [[#android-runtime-model]], [[#ios-runtime-model]] and [[#os-lifecycle]] |
| Build impact | Dependencies and their conflicts, the merged manifest, pods, keep rules and the privacy manifest | Chapters 5 and 6, from [[#gradle-project]] and [[#xcode-build-flow]] |
| Privacy and consent | What is collected before the player answers, and how a refusal reaches the SDK | [[#sdk-consent-init]] |
| Rollout and verification | A release build on devices, a staged rollout, and the metric that halts it | [[#release-rollouts]] |
| Upgrades | Who owns the version, how an upgrade is checked, and how the SDK would be removed | [[#sdk-upgrades]] |

The answer starts with one question. The one that changes the plan most is what the SDK is for, and whether it replaces one the game already has. A replacement runs both vendors side by side for a while and compares their counts, as [[#sdk-analytics-integration]] describes, while a new SDK does not. An SDK whose data feeds advertising adds a consent purpose, and one that the game's purchases or sign-in depend on raises the stakes of the rollout. “Which version should I use?” or “Which scene initializes it?” changes nothing at this stage.

Ask the question, then keep moving. An interviewer may answer it, or may say “what would you assume?”, and a round has no time to wait. State the assumption and its reason, and invite a correction: “I will assume it is new, on both platforms, for product analytics rather than advertising, and that some players must consent first. Tell me if any of that is wrong.” The rest of the answer then rests on something the interviewer can see and change. A string of questions with no answer behind them, or a silent assumption, both leave the interviewer to guess what the design is built on.

Two minutes for eight parts is fifteen seconds each, which is one sentence. That is the right first pass. The structure's job is coverage: it tells the listener that you know where the work is, and it lets them pick the part to open. An answer that spends its two minutes on the boundary alone may be excellent on the boundary and still leave the interviewer unsure whether the candidate has ever shipped an SDK through a store.

Here is a first pass for analytics, one sentence per part: “I would first ask what it is for, and assume new product analytics on both platforms, with some players consenting first. Before adding it, I would diff a release build with and without it, for its libraries, permissions, size and anything that starts itself. Gameplay calls a game-owned `IAnalytics` with the game's own events, so the vendor lives in one adapter. On each platform the adapter initializes the SDK, and any callback it makes is moved to Unity's main thread. The dependency graph, the merged manifest, the pods and a minified release build show what it does to the build. Events wait in a bounded queue until the player answers, and a refusal also turns the SDK's own collection off. It ships in a staged rollout that crash-free users for the new SDK version can halt. The platform team owns its version, and each upgrade gets the same diff before it ships.” That takes about a minute and a half aloud. The interviewer then picks a part to open, and the next table shows what one answer sounds like taken down to its decision.

The same question can be answered at the three depths of the first book's opening chapter. Here they are for analytics:

| Level | Answer to “How would you integrate an analytics SDK?” |
| --- | --- |
| Naming | “Add the vendor's package, initialize it in the first scene, and call its logging method wherever something happens.” |
| Mechanism | “Gameplay calls an `IAnalytics` interface with the game's own events. An adapter turns them into the vendor's calls, and a queue holds events that arrive before the SDK is ready.” |
| Decision | “The game owns the event schema, in a reviewed file, and calls an interface that never names the vendor, so replacing the vendor changes one adapter. Events wait in a bounded queue until the player answers the consent prompt, and a refusal discards them and also turns the SDK's own collection off, because an SDK can start itself from a content provider before any C# runs. Before adding it, I would diff a release build with and without it, and I would ship it in a staged rollout halted by crash-free users for the new SDK version. I rejected calling the SDK from gameplay code, since two hundred call sites would make the vendor part of the game.” |

The third answer states a requirement, an owner, a mechanism with its reason, a check, and a rejected alternative. Each of its sentences also traces to a section of this book: the schema and adapter to [[#sdk-analytics-integration]], the consent queue and the self-starting SDK to [[#sdk-consent-init]], the diff to [[#sdk-evaluation]], and the rollout metric to [[#sdk-upgrades]]. That tracing is the test to run on your own answer. A sentence you cannot trace to something you built or read is a sentence to check before the interview. A reason alone does not make a sentence decision-level: it has to be the requirement the choice serves, and a reason that ignores one, such as initializing early so that no event is lost, fails the test.

Interview exercise: Answer “how would you integrate an analytics SDK?” in two minutes, and record it. Play the recording back and mark each of the eight parts you covered, each sentence at the decision level, and the one question you asked first.

?? interview-integration-depth Asked how they would integrate an analytics SDK, which answer reaches the decision level?
* The game owns the event schema behind an interface, so a vendor change touches one adapter
- Install the vendor's package, initialize it in the first scene, and log events from gameplay
- Initialize the SDK before the first scene loads, so that no tutorial event is lost
- Use the vendor's Unity package rather than its native libraries, so both platforms are covered
- Inject the SDK's client into each system that logs events, so each one can be tested
> A decision-level answer states a choice with the requirement it serves. Owning the schema behind a game-owned interface keeps the vendor in one adapter, which is the reason for the design. The reasons in the other answers do not hold up: initializing before the first scene ignores consent, the choice of package concerns installation rather than the boundary, and injecting the vendor's client spreads its types through the game.

?+ A candidate's analytics answer names an interface, an adapter and a queue for early events. What moves it to the decision level?
* The reason for each choice, and the alternative each one rejected
- More components, such as a factory and a registry for the vendor adapters
- The vendor's exact method names for logging and for flushing events
- A longer list of the events the game will send to the vendor
- The SDK's current version number and the date it was released
> Naming components is the mechanism level. The decision level says which requirement each one serves and what else was considered, such as calling the vendor from gameplay code and why that was rejected.

?+ Which sentence from an SDK answer is at the decision level rather than the mechanism level?
* A refusal also turns the SDK's own collection off, since it can start first
- Events go into a queue until the SDK finishes its initialization
- An adapter turns each game event into the vendor's logging call
- A static class forwards each event from gameplay to the vendor
- The SDK is added to the project through the Package Manager
> A decision states the choice together with the fact that forces it: an SDK that starts itself from a content provider collects before the game's consent code runs, so the refusal has to reach the SDK as well. The other sentences describe what the code does, or how the SDK is installed, without saying why.

?+ A candidate says, “I would wrap the SDK in an interface.” Which next sentence takes the answer to the decision level?
* “Then replacing the vendor changes one adapter, not two hundred call sites.”
- “The interface would have methods for events, for users and for sessions.”
- “The wrapper would be registered as a singleton when the game starts up.”
- “I would name it IAnalytics, to follow the conventions the team already has.”
- “The adapter would call the vendor's logging method once for each event.”
> The decision level gives the requirement a choice serves. Naming what the interface saves, a vendor change confined to one adapter, justifies it. Method lists and registration describe the mechanism, and a naming convention is a reason about style, not about the design.

?? interview-integration-first-question An interviewer asks, “How would you integrate this SDK?” Which first question changes the plan the most?
* What is it for, and does it replace one that the game already has?
- Which version of the SDK should the integration start from?
- Should the adapter be written in C#, or in Java and Objective-C?
- Which scene should call the SDK's initialization method?
- Does the team keep its SDKs in the repository or a registry?
> The purpose decides what depends on the SDK and which consent purposes apply, and a replacement means running two vendors side by side and comparing them. The other questions are details that the plan settles later.

?+ The interviewer answers a clarifying question with “What would you assume?” What is the strongest reply?
* State the assumption and its reason, ask to be corrected, and continue
- Ask the same question again in other words until it is answered
- Cover each possible case in turn before choosing any one design
- Choose the simplest case without saying so, and carry on with it
- Decline to go further until the requirement has been settled
> A stated assumption keeps the answer moving and gives the interviewer something visible to correct. A silent one hides what the design rests on, and waiting or covering each case uses time the round does not have.

?+ A candidate silently assumes that the SDK is new, when the game already has one it replaces. What does that silence cost?
* A design with no plan to run both vendors side by side and compare them
- Nothing, since the interviewer corrects wrong assumptions as they occur
- A lower score for clarity, although the design itself stays sound
- Some time, since the assumption must be restated at the end of the answer
- The interviewer's trust, since any assumption counts as a guess
> A replacement needs a period in which both vendors receive the same events and their counts are compared. Said aloud, the assumption could have been corrected in a sentence; kept silent, the design goes on without the part the situation needed.

?+ A candidate opens an SDK answer with six questions in a row and no design yet. What is the problem?
* The interviewer still does not know what the design will rest on
- Clarifying questions count against the candidate's score for the round
- The interviewer expects the design first and the questions at the end
- Six questions reveal that the candidate has not used this kind of SDK
- The questions should have been sent in writing before the interview
> Questions are useful when their answers change the plan. One question, then a stated assumption, lets the answer continue. A long list with no answer behind it spends the round's time and leaves the design undefined.

## Explain an investigation out loud {#interview-debugging-answer}

A debugging question in an interview has no log to read. The interviewer gives a symptom and listens to how you would work. Chapter 15's [[#boundary-method]] gave the method; aloud, it becomes six steps:

1. Restate the symptom in your own words, with the facts that matter: which build, which platform, which feature, since when.
2. Scope it: how many players, which versions and devices, and what changed around the time it started.
3. Form hypotheses per layer of the call path, from game code to the backend, rather than one favorite.
4. Pick the cheapest observation that splits them.
5. Say what each result of that observation would mean, and what you would look at next.
6. Contain the damage, fix the cause, and prevent the next one.

Here are the six steps for “it works in the Editor and crashes on Android”:

| Step | What you say |
| --- | --- |
| Restate | “So the feature works in Play Mode, and on an Android device the app closes. I would ask whether it is a release build, which feature it is, and whether all devices do it.” |
| Scope | “Say it is a release build, on each device we tried, when the store screen opens and calls a native SDK.” |
| Hypotheses | “The Editor ran a fake or a desktop path, so the difference is in the player build. On the Java side, [[R8]] may have removed a class that the bridge reaches by name. In C#, [[managed code stripping]] may have removed a type a serializer needs. In native code, a library may be missing for the device's [[ABI]]. Or a callback on a Java thread may touch a Unity API.” |
| Cheapest split | “[[Logcat]] separates most of those. I would read the crash buffer first: a `FATAL EXCEPTION` with its Java exception, such as an `UnsatisfiedLinkError` for a library, or a native signal with a [[tombstone]]. Then Unity's log just before it, where an `AndroidJavaException` naming a class or method that was not found, or an exception about the main thread, marks the call that failed first.” |
| Each result | “A missing class sends me to a build with minification off and the keep rules. A missing library sends me to the ABIs packaged for that device. A native signal means [[symbolication]] of the tombstone before anything else, and if it shows a failed JNI class lookup, R8 is back in play. If it is none of those, I would add logs at the adapter and the bridge.” |
| Contain, fix, prevent | “Say logcat showed a missing class. If it shipped, halt the [[staged rollout]] and turn the feature off with its flag. Fix it with a keep rule, and prevent it with a release-configured device test in CI that opens the store screen.” |

Chapter 15's [[#boundary-editor-device]] has the full table of symptoms and first splits. The narration above does not need all of it. It needs one observation that divides the hypotheses, and a plan for each outcome.

An interviewer grades the process, not whether you guessed the cause. Three things show it: what you would look at, why that observation before any other, and what would change your mind. The last one is the easiest to leave out and the most convincing to include. “If the crash is a native signal and no class lookup failed, I set the keep-rule idea aside” tells the listener that the hypothesis is a hypothesis. An answer that jumps from the symptom to “it is R8, add a keep rule” may even be right, and still scores low, because it gives the interviewer nothing to judge except luck.

The interviewer may then ask about a detail you do not know, such as which thread a particular SDK's callback runs on. Say that you do not know, then say how you would find out. The first book's opening chapter makes the same point for any gap, and [[#design-round-method]] makes it for a backend's internals. For a platform detail, the finding-out has two parts: the documentation for the version you ship, and a small check on a device. “I am not sure which thread that callback uses. I would read the SDK's reference for it, and in a device build I would log the thread id at the callback's entry, which answers it for the version we ship.” That answer shows how you work when the documentation is thin, which is most of the job. A confident guess shows something worse, and a general lecture on threading that never returns to the question shows little.

Interview exercise: Narrate chapter 15's [[#boundary-purchase-case | purchase case]] in three minutes, with the book closed: the symptom, the containment, the hypotheses per layer, the observation that split them, the fix, the backlog, and what prevents a repeat.

?? interview-debugging-narration Narrating “works in the Editor, crashes on Android”, what should come right after the hypotheses per layer?
* The cheapest observation that separates them, and what each result means
- The fix for the most likely hypothesis, so that the answer reaches a solution
- A rebuild with each suspect setting changed at once, to save time
- A list of the SDK versions that the game has shipped this year
- A request to reproduce the crash in the Editor before going further
> Hypotheses are useful when an observation can tell them apart. The narration picks the cheapest one that splits them, such as the crash's logcat entry, and says what each outcome would mean before choosing a fix.

?+ Which narration of a device crash would an interviewer grade highest?
* “Logcat's crash entry splits a Java exception from a native signal; I read it first.”
- “This is almost certainly R8, so I would add a keep rule for the plugin's classes.”
- “I would try different build settings until the crash stops, and then ship that build.”
- “I would update each SDK to its latest version and check whether the crash persists.”
- “I would reproduce it in the Editor with the Android platform selected, and debug it there.”
> The interviewer grades the process: what you look at, why, and what it would tell you. Reading the crash entry first is cheap and separates several hypotheses. Jumping to a fix, or changing things until the symptom goes away, shows no reasoning to grade.

?+ A candidate says, “If the crash is a native signal and no class lookup failed, I set the keep-rule idea aside.” What does that sentence show the interviewer?
* What evidence would change the candidate's mind about the hypothesis
- That the candidate has not yet decided which layer to investigate first
- That keep rules have no bearing on crashes in a Unity Android build
- That the candidate expects the interviewer to supply the crash log
- That native signals come from the Unity engine and not from SDKs
> Saying what would disprove a hypothesis shows that it is being tested rather than defended. A keep rule concerns Java classes that R8 removed, so a native signal with no failed class lookup points elsewhere, and the candidate moves on.

?+ Besides fixing the cause of a crash that has already shipped, what completes the narration?
* Containment for players on that build, and a check to catch it next time
- The name of the engineer whose change introduced the defect
- A promise that the team will test more carefully before each release
- A second fix in a nearby layer, in case the first one turns out incomplete
- A rollback on players' devices to the build that they had installed before
> Players who already installed the build stay affected until containment or a new release reaches them, and a fix without prevention leaves the same failure for the next release. A device cannot be moved back to an older build, so the fix ships forward.

?? interview-unknown-detail Asked which thread an SDK's purchase callback runs on, a candidate is not sure. What is the strongest answer?
* Say so, then name the reference to read and the device log to confirm it
- Say the main thread, since most SDKs for Unity dispatch their callbacks there
- Say a background thread, since native SDKs do their work off the main thread
- Ask the interviewer to move on to a question on another topic
- Explain JNI threading in general and leave this SDK's case open
> Admitting the gap and naming how to close it shows how the candidate works when a detail is missing. A guess may be wrong for this SDK and version, and a general lecture does not answer the question.

?+ Why is “I do not know; I would check it this way” a strong answer to a question about a platform detail?
* It shows how the candidate works when a detail is missing, as it often is
- It shows modesty, which interviewers score apart from technical content
- It ends the follow-up, so the round returns to topics the candidate knows
- It moves the round on, since interviewers skip details the candidate lacks
- It signals that the detail is too minor for the role being discussed
> Platform work runs into undocumented and version-specific behavior constantly. Saying where you would look and what small check would settle it demonstrates that method, which a guess does not.

?+ Which follow-through after “I am not sure” helps the answer most?
* “A device build of our version that logs the thread id would settle it.”
- “I would ask the vendor's support, and wait for their reply before going on.”
- “I believe it is fine either way, since Unity handles threads for plugins.”
- “I would search online forums and use the most common answer I find.”
- “I would assume the Editor behaves like the device, and continue from there.”
> A small check on the shipped version answers the question directly and quickly. Waiting on a vendor stalls the work, forum answers may describe another version, and the Editor does not run the device's native code.

## A mock round with rubrics {#interview-platform-mock}

Answer these prompts aloud, one at a time, with a timer set to five minutes each. Score each answer from 0 to 2 on the first book's five dimensions: requirements, ownership, failure handling, trade-offs and evidence. A dimension scores 0 when it is absent, 1 when it is named, and 2 when it is explained with a concrete example. The table gives what a strong answer contains for each prompt and the weak answer that candidates commonly give, and the right-hand column names where this book covers it.

| Prompt | A strong answer contains | The common weak answer | Section |
| --- | --- | --- | --- |
| Integrate analytics | Game-owned schema and interface, one adapter, a queue for early events, consent, a build diff and a staged rollout | Vendor calls from gameplay code, initialized in the first scene | [[#sdk-analytics-integration]] |
| Keep vendor types out of gameplay | Game-owned result and error types, an adapter that maps the vendor's, and assembly references that stop the rest of the game from reaching the SDK | A singleton that wraps the SDK and still returns its types | [[#platform-interfaces]] |
| Different implementations per platform | One interface, with the composition root choosing the Android, iOS, Editor or unavailable implementation | `#if UNITY_ANDROID` in each caller | [[#platform-composition]] |
| Upgrade an SDK safely | Changelog, build diff, a release build on devices, a staged rollout with a halting metric, and the limits of a remote switch | Change the version and test in the Editor | [[#sdk-upgrades]] |
| Two SDKs need incompatible Android dependencies | `dependencyInsight` to see who asks for what, then the lagging SDK updated, a version both accept, the vendors asked with that output, or one SDK dropped | Exclude the duplicate, or force the newer version, and ship | [[#gradle-dependencies]] |
| Works in the Editor, crashes on Android | The six steps of [[#interview-debugging-answer]] | “It is R8; add keep rules” | [[#boundary-editor-device]] |
| Purchases fail in production after an update | Containment, one operation traced from the SDK's raw result to the server, a contract fix, and recovery of the purchases already made | Roll the client back, and fix new purchases alone | [[#boundary-purchase-case]] |
| Design a Jenkins pipeline | Stages, agents chosen by label with Macs for iOS, both platforms in parallel, signing through credentials, and artifacts stamped with their build identity | One job that runs a build script on the controller | [[#ci-jenkins-pipeline]] |
| Token refresh under concurrency | One shared refresh that waiting requests join, a check of which token each request was sent with, and sign-in after a second 401 | Each request that gets a 401 refreshes on its own | [[#http-sessions]] |
| Offline behavior | What each feature does offline, pending operations saved with [[idempotency]] keys before the first send, and the server's answer winning on reconnection | “Cache everything and sync later” | [[#network-offline]] |

The weak answers are not foolish. Most of them work in a demo, and several are what a vendor's quick start says to do. They score low because they leave out the second half of the job: what happens when it fails, who owns it after release, and how anyone would know.

One scored example makes the rubric concrete. The prompt is “upgrade an SDK safely”, and the answer is: “I would update the package, fix any compile errors, check that the sample scene works in the Editor, and ship it.”

| Dimension | Score | Why |
| --- | --- | --- |
| Requirements | 0 | No question about what the SDK does or why it is being upgraded |
| Ownership | 0 | No one is named to watch the rollout or to decide to halt it |
| Failure handling | 0 | Nothing about a crash in the new version, or how to get back |
| Trade-offs | 0 | No alternative, such as waiting for a later patch release |
| Evidence | 1 | A sample scene is a check, but it runs in the Editor, not in a release build on a device |

One point out of ten. The candidate who adds “I would diff the dependency graph and the merged manifest, because an upgrade can move a library under another SDK” and “the release owner stages the rollout and halts it on crash-free users for the new version” raises evidence, ownership and failure handling without changing anything else about the answer.

Interviewers change a constraint mid-answer on purpose. They want to see which parts of the design move, and whether you can say why. The strong response says what changes, what stays, and what the change costs, in that order. Restarting from nothing throws away the parts that still hold, and defending the old answer against the new constraint misses the question.

| Follow-up | What a strong answer changes |
| --- | --- |
| “The vendor's SDK exists for Android alone.” | The interface stays. On iOS the composition root picks an implementation that reports the capability as unavailable, and callers already handle that result |
| “Legal says nothing may be recorded before consent.” | Holding events in the early-event queue is itself recording before consent, so either legal approves that buffering on the device, or events before the answer are dropped and the funnel starts after it |
| “The download must not grow by more than 1 MB.” | The build diff's size row becomes the deciding one, measured per device from the release build, and alternative SDKs are compared on it |
| “Jenkins has one Mac agent.” | Work that needs no Mac moves to other agents, and the iOS stage waits for the one Mac, so its cache matters more |
| “The refresh token can be revoked from another device.” | A refresh that the server refuses ends the session: waiting requests fail together, and the player signs in once, not once per request |

Interview exercise: Run the ten prompts above, recorded, over two or three sessions. Give each five minutes: a two-minute first pass as in [[#interview-integration-answer]], then one part taken deeper. Score each recording on the five dimensions. Then answer one follow-up per prompt aloud: the five in the table, and for the other prompts change one constraint yourself, such as the platform, consent, the download size, build capacity or the server's behavior.

?? interview-mock-rubric For “upgrade an SDK safely”, which answer contains what a strong answer needs?
* Read the changelog, diff the build, test a release build on devices, and stage the rollout
- Update the package, check that the project compiles, and test the new version in Play Mode
- Upgrade the SDK together with the others, so that the team tests one release instead of several
- Upgrade on a branch, and merge once the vendor's sample scene runs in the Editor
- Wait for the vendor's next release, since a new version carries more risk than the current one
> An upgrade can change dependencies, permissions and native behavior that the Editor does not run. The changelog and the build diff show what changed, a release build on devices tests it, and a staged rollout limits who meets a failure.

?+ A candidate answers “token refresh under concurrency” with: each request that gets a 401 refreshes the token and retries. What does a strong answer add?
* One refresh that waiting requests share, and a check of the token each one sent
- A shorter access token lifetime, so that concurrent refreshes happen less often
- A retry loop that refreshes the token again until the request succeeds
- A lock that makes the game send its requests one at a time
- A sign-out on the first 401, so that the player starts a clean session
> Separate refreshes race, and with a rotating refresh token one of them can invalidate the others. A shared refresh, sometimes called single flight, lets each request wait for it, and comparing the token a request was sent with against the current one stops a late 401 from starting another.

?+ For “different implementations per platform”, why does `#if UNITY_ANDROID` in each caller score low on ownership?
* Each caller decides the platform, so no one place owns the choice
- Preprocessor directives cost more at run time than an interface call
- Release builds ignore the directive, so both branches are compiled
- Scripting define symbols are hidden from code in assembly definitions
- Directives stop the adapter from being registered in the composition root
> A composition root that picks the implementation gives the choice one owner and keeps callers on one interface. Directives scattered through gameplay spread the decision across the code, so adding a platform or a fake means editing each caller.

?+ For “design a Jenkins pipeline”, which element separates a strong answer from the common weak one?
* Mac agents chosen by label for iOS, and signing secrets bound to signing steps
- One job that runs the Unity build script on the Jenkins controller itself
- A nightly schedule, so that the builds do not compete with people's daytime work
- Signing files committed to the repository, so that each agent has them
- One stage that builds both platforms in turn on a single agent
> A pipeline answer is judged on where work runs and how secrets reach it. Labels send iOS work to Macs, and credentials bound to the steps that need them keep signing keys out of the repository and out of other stages.

?? interview-mock-followup Midway through an analytics answer, the interviewer says the SDK exists for Android alone. What is the strongest response?
* Keep the interface, and have iOS report the capability as unavailable
- Restart the answer with a design that targets Android from the beginning
- Defend the original design, since the constraint was not stated at first
- Add `#if UNITY_ANDROID` around each analytics call in gameplay code
- Replace the vendor with one that supports both platforms, then go on
> The follow-up tests which parts of the design move. The game-owned interface stays, the composition root picks an implementation that reports the capability as unavailable on iOS, and callers already handle that result.

?+ Why do interviewers change a constraint in the middle of an answer?
* To see which parts of the design move, and whether the candidate knows why
- To test whether the candidate remembers the original constraint afterward
- To shorten the round when the first answer has already run too long
- To signal that the first answer was wrong and should now be dropped entirely
- To find out which vendors the candidate has worked with before
> A changed constraint shows whether the design was reasoned or memorized. A candidate who can say what changes, what stays and what it costs demonstrates the reasoning behind the first answer.

?+ The interviewer adds, “Jenkins has one Mac agent.” What does a strong pipeline answer change?
* Stages that need no Mac move to other agents, and iOS queues for the Mac
- The Android stage moves to the Mac too, so that both platforms share one cache
- The iOS build leaves the pipeline, and someone makes it by hand for releases
- The parallel stages go, since a single agent would have to run them in turn
- The iOS stage runs on a Linux agent that has Xcode's command-line tools
> The Mac is the scarce resource, so it should do the work that only it can do. Other stages run elsewhere in parallel, and the iOS stage queues for the Mac, which makes its cache and build time matter more.

?+ Answering a follow-up that changes a requirement, what should the candidate say first?
* What in the design changes, what stays, and what the change costs
- That the new requirement contradicts what was agreed at the start
- A new design from the beginning, so that the old one does not constrain it
- Which parts of the earlier answer were wrong in light of the change
- A question about whether the change is likely to happen in practice
> A follow-up tests how the design responds to change. Naming the parts that move, the parts that hold and the cost keeps the good work of the first answer and shows the reasoning connecting them.

## Run a system design round {#interview-system-design}

[[#design-round-method]] gave the stages of a design round and a schedule for 45 minutes. This section practises running it. Driving the round means saying the plan aloud at the start, keeping to it, and checking in as each stage ends: “I will spend about ten minutes on requirements and an estimate, then the API and the data, then a diagram, and then go deep wherever you want. Does that work?” The interviewer can then steer a plan instead of rescuing a candidate who has none.

The first ten minutes go to requirements and an estimate, and only then does anything get drawn. The answers to the questions choose the components: how fresh the leaderboard must be, whether players in a party must play together, whether a save may be edited on two devices at once. The estimate says which of those components carry load: a board of 10 million players fits in one in-memory [[sorted set]], and a push to 2 million players that one in ten tap starts 200,000 sessions within minutes, more than a login service sized for the average can take ([[#design-social]]). A candidate who draws first draws the generic diagram of a load balancer, services and a database, and then has to justify boxes they chose before knowing the problem.

A platform engineer draws both the client and the service, and goes deepest where they meet. That is where this book gives you evidence a backend specialist may not have: the contract between client and server and its versions ([[#http-versioning]]), retries and idempotency ([[#network-idempotency]]), what the client does offline and how it reconciles ([[#network-offline]]), purchases verified by the store and granted once ([[#design-economy]]), and the old clients that keep calling for months. Draw the client as a box with its own state, such as its pending operations and its cache, not as an arrow's starting point. Where the round reaches consensus, storage engines or orchestration, name the property the design needs and how you would find out the rest, as chapter 12's first section advises.

The first three prompts below are common in published accounts of game studios' design rounds, and purchases have been reported too; the others are services that chapter 13 designs. None of them is a prediction of what a studio will ask. Each row gives what a strong answer contains and the weak answer that candidates commonly give. The weak answer is usually the same diagram of boxes, with no numbers and no story for a failure.

| Prompt | A strong answer contains | The common weak answer |
| --- | --- | --- |
| A weekly leaderboard with rewards | The reset as a moment in UTC and what it means in each zone, one sorted set per week, ties broken by who reached the score first, scores checked by the server, and rewards granted from a closed board with one idempotent grant per player and week ([[#design-leaderboards]]) | One database table sorted on each read, with no reset or reward story |
| Matchmaking with parties | Tickets, a party as one ticket with a combined rating, rules that widen as a ticket waits, timeouts and cancellation, and a server allocated with a join token ([[#design-matchmaking]]) | A queue that matches the first players in it |
| A live event for millions of players | The event as data, content downloaded ahead and unlocked by server time, a start spread with jitter, and a push paced over minutes ([[#design-live-events]], [[#design-social]]) | A push to everyone at the start, and a download when they tap it |
| Cloud save across devices | One writer per field, balances and items outside the client's save, a version check that turns a second writer into a conflict, and schema versions migrated on read ([[#design-player-data]]) | The whole save uploaded, and the last write wins |
| Purchases and refunds | Verification by the server, a [[ledger]] entry keyed by the store's transaction, the grant and its deduplication in one transaction, then finishing or acknowledging, and refund notifications that write reversals ([[#design-economy]]) | The client reports the purchase, and the server adds the currency |
| Push notifications to a segment | A segment query that produces a job, a queue, sends paced to spread the taps that follow, and a [[push token]] registry that removes tokens the push services report as unregistered ([[#design-social]]) | A loop over the players that calls the push service for each |
| Guild chat | Persistent connections with [[pub/sub]] per guild, a sequence number per channel, stored history with catch-up from the last number seen, and moderation enforced by the server that accepts messages ([[#design-social]]) | Each client polls a table of messages |

The follow-ups move the design, and each has a first thing to say:

| Follow-up | Where a strong answer starts |
| --- | --- |
| Ten times the players | Redo the estimate and name the first box that no longer fits, rather than scaling each box |
| A second region | Which data is per region and which is global, which region is a player's home and takes their writes, and what a cross-region request costs ([[#design-degradation]]) |
| The economy service is down | The shop closes rather than take money for items that cannot arrive, and a purchase already paid for stays unfinished in the store until the grant ([[#design-degradation]]) |
| A cheater at the top of the board | Scores the server checks or computes, limits on what a run can score, and a way to remove the entry before rewards are granted ([[#design-abuse-privacy]]) |

Interview exercise: Run “design a weekly leaderboard with rewards” for 45 minutes against a timer, and record it. Then grade it against the leaderboard row above and the stages of [[#design-round-method]]: which stage overran, which numbers you gave, and which failure you described.

?? interview-design-drive Why spend the first ten minutes of a design round on requirements and an estimate?
* The answers choose the components, and the numbers show which carry load
- Interviewers grade the round on how many requirements the candidate lists
- The diagram goes faster once the interviewer has approved the scope in writing
- An estimate lets the candidate skip the data model in the later stages
- Requirements must be written down before an interviewer allows a diagram
> Requirements decide what the design needs, such as how fresh a total must be, and the estimate decides which parts face real load. A diagram drawn before either is a generic one that the candidate then has to justify.

?+ Five minutes into a design round, a candidate is drawing a load balancer, services and a database, with no numbers yet. What should they do?
* Ask the questions and make the estimate that those boxes depend on
- Finish the diagram, then justify each box when the interviewer asks
- Add a cache and a queue, since most game designs end up needing both
- Label each box with a product name, so that the diagram looks concrete
- Ask the interviewer which components they expect the design to have
> Boxes drawn before the requirements and numbers are guesses. Going back to the questions and the estimate gives each box a reason, or shows that it is not needed.

?+ What does driving a design round mean?
* Saying the plan aloud, keeping to it, and checking in as each stage ends
- Keeping the interviewer from redirecting the deep dives to other areas
- Covering each stage at the same depth, so that nothing is left out
- Finishing the diagram before asking any of the clarifying questions
- Talking without pause, so that the interviewer has no need to steer
> A stated plan lets the interviewer steer the round rather than rescue it. The candidate still follows the interviewer into the deep dives they choose, and checks in so that the time goes where both expect.

?+ A candidate's leaderboard design has no estimate. The interviewer asks whether one sorted set can hold the board. What was missing?
* The number of players and the memory each entry needs, worked out early
- A second sorted set, as a copy in case the first one fills up
- A decision on which cloud vendor would host the in-memory store
- A diagram that shows each of the sorted set's replicas separately
- The sorted set's commands, listed with their stated time complexity
> An estimate of players times bytes per entry answers the question in a line, and it belongs in the first minutes, before the design depends on the answer. Without it, the candidate cannot say whether the central choice holds.

?? interview-design-depth In a system design round, where should a platform engineer go deepest?
* Where client meets service: the contract, retries, offline play, old clients
- The storage engine: how it lays out and compacts the database's pages
- In the load balancer: how it spreads the connections across the servers
- Consensus between the replicas, and how they elect a new leader
- The routing of packets between the data centers of each region
> A platform engineer's evidence is on the client's side of the API: its contract and versions, idempotent retries, offline reconciliation and purchases. The internals in the other options are a backend specialist's depth, named with the property the design needs.

?+ Designing cloud save, which deep dive shows a platform engineer's evidence best?
* Two devices on one save: the version each upload names, and what the loser sees
- How the document store shards player documents across its storage nodes
- How the load balancer's algorithm spreads connections across the servers
- How replication inside the database keeps followers in step with the leader
- Which cloud vendor's document store would host the saves most cheaply
> The conflict between two devices is where the client and the service meet: the client sends the version it read, the server refuses a stale write, and the client merges or asks the player. The other topics are internals or vendor choices.

?+ For purchases and refunds, which part should a platform engineer take down to its mechanism?
* Verification, the grant keyed by the store's transaction, and refunds
- The purchase button's layout, and the text of its confirmation dialog
- The payment networks that carry the charge between the bank and the store
- The storage engine that writes the ledger's rows to the disk
- The exchange rates that the store applies to prices in each country
> The purchase flow crosses the client, the store and the server, and its failures are lost replies and duplicate callbacks. Verification, an idempotent grant keyed by the transaction, and the reversal on refund are the mechanisms that keep money and currency in step.

?+ Why should a platform engineer draw the client as a box with its own state in a design round?
* Its pending operations and cache decide how retries and offline play behave
- It shows where the service's database credentials are kept for the client
- It shows the interviewer which engine and platforms the client targets
- A client box lets the candidate skip the design of the service's API
- Drawing the client lets the candidate leave out the capacity estimate
> The client holds pending operations with their idempotency keys, a cache and a version of the data it read. Those decide what a retry sends, what the player sees offline and how conflicts reach the server, which is the platform engineer's part of the design.

## Build a practice project that gives you evidence {#interview-practice-project}

Reading gives you the words, and a project gives you the stories. The smallest project that gives real experience to talk about is a plugin on both platforms with six parts:

| Part | What it makes you do | Where this book covers it |
| --- | --- | --- |
| A call into native code | Call a Java method from C#, and a C function in an Objective-C file through `DllImport("__Internal")` | [[#android-java-calls]], [[#ios-native-calls]] |
| A callback on another thread | Call back into C# from a Java background thread and from a dispatch queue, then move the result to Unity's main thread | [[#android-callbacks]], [[#ios-callbacks]] |
| A deep link | Open the app from a link on both platforms, cold and warm, and read the URL in C#, with the iOS patch that section describes | [[#os-deep-links]] |
| A post-processor | Add an `Info.plist` key, such as a usage description, from an Editor script after the iOS export | [[#ios-xcode-postprocess]] |
| A keep rule | Build a release with minification, watch the class that the bridge reaches by name disappear, and keep it | [[#gradle-r8-symbols]] |
| A CI script | Build both platforms from one script in batch mode, the way a Jenkins agent would | [[#ci-pipeline-shape]] |

When time is short, build them in that order and stop wherever the time runs out. The call and the callback come first, because they are the bridge that the role is about, and the callback is where most people meet their first real bug: a Unity API called from the wrong thread. The deep link and the post-processor are short, and each touches a platform file you will be asked about, though on iOS the deep link needs chapter 4's patch before Unity sees the URL. The keep rule needs a release build, which makes it the first part to show you a failure that a debug build hides. The CI script comes last because it takes the longest, and because it forces both exports to build without the Editor's windows, which surfaces problems of its own.

For the design round, add a small local service that the project calls: a [[ledger]] with an idempotent grant in SQLite, and a leaderboard in Redis or in a sorted structure in .NET. It is not a production backend, and it does not need to be. It gives you numbers you measured yourself, such as the memory a board takes per player and the time a grant takes, and a failure you caused on purpose, such as the same grant sent twice. The labs of [[#design-economy]] and [[#design-leaderboards]] are that service in pieces.

Keep a short log as you build: what you expected, what happened, the exact error, the cause, and the fix. That log is what you talk about. “The callback crashed because it touched a `GameObject` from a Java thread; the log said so, and I moved the work to the main thread through a queue” is a story with evidence in it. “I followed the tutorial and it worked” is not. When you tell it, say what the project was: a practice project, built to learn, not a shipped game. The first book's advice on honesty about your own part holds here too.

Lab exercise: Build the first two parts, the native call and the callback on another thread, on both platforms. Each is done when a log from a device, an emulator or the Simulator shows the native call's result, the callback arriving on a thread other than Unity's main thread, and the C# handler then running on the main thread. If one platform is out of reach, build the other and write down what the missing one would need. Write down each thing that surprised you, with the error message that showed it, and keep the thread ids you logged as the evidence.

?? interview-practice-evidence With a few evenings before an interview for a Unity platform role, which part of a practice project should come first?
* A native call and a callback on another thread, on both platforms
- A polished demo scene that shows the plugin's results to players
- An integration of several vendors' SDKs by following their quick starts
- A Jenkins server with an agent for each platform and a dashboard
- A backend with accounts, a ledger, a leaderboard and matchmaking
> The bridge is what a platform role centers on, and the callback on another thread produces the first real bug most people meet. Quick starts, polish, a CI server and a large backend take longer and give less to discuss about the boundary.

?+ Why does a release build with minification belong in the practice project?
* It produces the failure that a keep rule fixes, which a debug build hides
- It is needed before a plugin can be called from C# on a device at all
- It makes the practice build small enough to install on older phones
- It lets the Editor run the Android plugin without a connected device
- It turns on the thread checks that catch callbacks on the wrong thread
> R8 removes or renames classes that nothing in Java references, including one that the bridge reaches by name. A debug build without minification does not show that, so a release build is where the keep-rule story comes from.

?+ Which note from a practice project gives the most to talk about in an interview?
* A callback crash off the main thread, with its log line, cause and fix
- The plugin worked the first time, following the vendor's tutorial step by step
- The project has a clean architecture, with an interface for each plugin
- The demo scene has a settings screen and animated transitions between menus
- The code follows the team's style guide and passes each of the linter's checks
> A failure with its evidence, cause and fix is a story an interviewer can probe. A smooth tutorial run, a tidy architecture or a clean lint gives nothing to probe, and polish is not what a platform interview weighs.

?+ For the design round, what does a small local service add to the practice project?
* Measured numbers to quote, such as a board's memory per player
- A backend that the game can ship with once the interview is over
- Proof that the design scales to millions of players with no further work
- A way to skip estimates, since the service's numbers replace them
- Experience with a cloud vendor's console, which interviews ask about
> Numbers you measured, and a duplicate grant you caused and stopped, give a design answer evidence. A local service proves nothing about scale, and it supports estimates rather than replacing them.
