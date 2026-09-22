---
book: Unity Game Engineering
chapter: 08: Testing and debugging production behavior
---

## Build tests around observable contracts {#testing-contracts}

Test what callers and players can observe: the resulting balance, an allowed state transition, a resource's owner, or an output. These checks catch changes in behavior while allowing a refactor to change private fields and helper calls.

Test timers, reward calculations, mission progress, and eligibility as plain rules. Supply the time, random source, and storage interface from the test. A timer test should be able to say “now is exactly the deadline” without waiting for real time to pass.

Use integration tests to check how real parts work together: saving and loading the same data, converting content, recovering from persistence failure, and coordinating collaborating objects. Use engine tests for component lifecycles, scene bindings, physics behavior, and prefab references.

Unity's Test Framework provides Edit Mode and Play Mode environments. Edit Mode suits many rule tests and editor tools. Play Mode exercises runtime behavior, while running tests in a target player adds evidence about that platform. Setup depends on the installed package; the [Unity Test Framework's mode guide](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/edit-mode-vs-play-mode-tests.html) describes these environments.

Keep the behavior you want to test real. If a mock wallet is configured to return success, a test that only checks whether the feature returns success may tell you little about the wallet rules. A small real wallet with fake storage can instead reveal duplicate grants and invalid arithmetic.

Choose test doubles by purpose:

| Double | Purpose | Example |
| --- | --- | --- |
| Stub | Supply a controlled answer | A fixed clock value |
| Fake | Simplified working implementation | In-memory progress storage |
| Spy | Record observations | Captured diagnostic events |
| Mock | Verify a specified interaction contract | A platform call must be made once |

Choose test doubles for a specific purpose. Large numbers of tests that depend on private call sequences can make refactoring difficult without catching player-visible failures. Prioritize rules that must always hold, previous bugs, and operations where failure could lose state or apply a reward twice.

One filter decides most of what to write: would this test fail for a reason I would want to be told about? A test that breaks when a private helper is renamed answers no, and it will be deleted or weakened the first time it gets in the way. A test that breaks when a duplicate collection grants a second reward answers yes, and it will be trusted.

Name the test after the rule rather than the method. `ExpiresAtTheExactDeadline` states a behavior a reader can check against the design; `TestIsActive2` states only that someone wrote a second test. When such a test fails in a run you did not start, the name is usually all the information you get, so it should carry the rule.

The cost side is real and worth stating, because a test suite is code the team maintains. Tests that reach into private state, assert on log text, or depend on the order of a collection with no ordering contract will fail during changes that broke nothing. Each of those failures spends someone's attention and teaches the team to distrust the suite. A smaller suite that fails only for real reasons protects the code better than a larger one that cries often.

Exercise: Pick three tests from a project you know and answer the filter question for each. Any test that would fail for a reason you do not care about is a candidate for rewriting or deletion.

?? testing-observable-contract Which assertion best protects the collection requirement?
* Repeating collection for the same spawn leaves the balance unchanged after the first grant.
- The reward service receives exactly one call for that spawn.
- The collection method returns without throwing when it is called twice.
- The coin's collected flag is set after the first call.
- The balance is greater than zero after the first collection.
> A test of the resulting balance catches duplicate grants and still works when private implementation details change.

?? testing-engine-boundary Which behavior most clearly needs Unity runtime integration evidence?
* A pooled component unsubscribes and resets when it is disabled and reused.
- A reward calculation that rounds a float to the nearest integer.
- A mission predicate that compares a counter with its target.
- A save migration that converts one schema version to the next.
- A weighted selection that draws from a fixed table.
> The test needs actual component disable and reuse behavior. Plain rule tests help, but do not verify that Unity callbacks are connected correctly.

## Derive a test matrix from state and failure boundaries {#testing-matrix}

List the states and transitions first, then test values at their boundaries. A purchase might be idle, pending, completed, rejected, or awaiting confirmation of an unknown outcome. Test an exact balance and an insufficient balance. Also cover repeated requests, timeouts before and after commitment, closing the view, and restoring state after a restart.

Use a compact matrix:

| Dimension | Representative cases |
| --- | --- |
| Numeric boundary | Zero, one, exact threshold, maximum valid, overflow |
| Lifetime | Before bind, active, disabled, destroyed, reused |
| Timing | Before deadline, at deadline, after deadline |
| Delivery | Once, duplicate, delayed, out of order |
| Persistence | Old schema, truncated file, failed write, recovery |
| Content | Missing ID, duplicate ID, unknown revision, invalid reference |

You do not need to test every possible combination in the matrix. Choose combinations whose behaviors can affect each other, along with cases for known bugs. For example, combine a late asynchronous result with [[object pool|pool]] reuse: the same object can now represent a different item.

Property-style tests generate many inputs and check a rule that should hold for all of them. Examples include a wallet never becoming negative, a shuffle preserving each element exactly once, or a capped mission count never exceeding its target. Use reproducible seeds and report the inputs that failed. A seeded board is the cheapest version of this: a match-3 level generated from a fixed seed gives every run of the test the same starting grid, so a failure can be reported as a seed rather than as a screenshot, and the fix can be proved against the board that broke.

When an exact expected answer is difficult to calculate, a metamorphic test compares related executions. A modifier that does nothing should leave damage unchanged. Processing a deduplicated event twice should give the same result as processing it once. Check that the relationship itself is a valid gameplay rule before using it as a test.

Control asynchronous completion with a fake loader, so the test can decide which request finishes first. Advance a fake clock to test time rules. Depending on real network delays or sleeping for an arbitrary duration makes the result depend on the test machine's timing.

Choosing combinations has a method, and it is cheaper than it sounds. Take the dimensions in the table and pair only those whose mechanisms actually touch. Timing and delivery interact, because a duplicate that arrives after a deadline is a different case from one that arrives before. Lifetime and timing interact, because a result arriving after the owner is gone is this book's recurring defect. Numeric boundary and content do not interact for a launched projectile, because an invalid ID is rejected before any arithmetic runs.

For the slingshot launch of chapter 6, that yields a short and high-value list:

| Combination | Case worth a test |
| --- | --- |
| Timing and delivery | A second launch arriving exactly as the first shot commits |
| Lifetime and timing | The level restarts with a shot still in flight |
| Delivery and persistence | A duplicate impact arriving after the save that recorded the first |
| Numeric boundary alone | A launch at the maximum allowed impulse |
| Content alone | An unknown projectile ID from an older save |

Five tests, each of which can fail for a distinct reason. Compare that with the full cross product of the six dimensions, which is in the thousands and mostly combinations no mechanism connects.

Add a row whenever a bug is found, and write what the bug proved rather than only the case that triggered it. “A late callback after pool reuse rewarded the wrong coin” identifies an interaction the matrix was missing, so it belongs in the matrix and not only in a regression test.

Exercise: Build this table for a feature you own. Cross out every pair whose mechanisms do not touch, and write a test only for what remains.

?? testing-controlled-order How should a test reproduce two artwork loads completing in reverse order?
* Use a controllable fake loader and explicitly complete the second request first.
- Start both requests and assert on whichever result arrives first.
- Issue the second request from a coroutine, so it yields before the first.
- Reduce the first request's asset size, so it finishes sooner.
- Run the test repeatedly until the desired order occurs.
> Completing requests in a chosen order makes the race repeatable. Guessing how long each request will take can make the test pass or fail unpredictably.

?? testing-property Which property is appropriate for a shuffle of a list with unique IDs?
* Every input ID appears exactly once in the output.
- The output order differs from the input order.
- Each element ends at a position different from where it started.
- Repeated shuffles of the same list produce a different order each time.
- The first and last elements swap at least once across many shuffles.
> A correct shuffle preserves membership. The original order is itself a valid random outcome.

## Debug by narrowing a hypothesis {#debugging-method}

Begin with a precise symptom: “After restarting during a magnet attraction, the next run sometimes receives a coin from the previous run.” Record the build, content revision, device, steps, expected result, actual result, and frequency.

List explanations that could produce the symptom. Perhaps the coin registry failed to reset, a subscription survived the restart, or an old coroutine finished after its object was reused. Check each one: inspect the registry after restart, count subscriptions, and record the generation attached to each callback.

At collection, record the run ID, spawn ID, generation, operation ID, phase, and result. Use those IDs to follow one operation through its callbacks. Logging “collect called” in ten places tells you little about which coin was involved. A message such as “run 12 rejected spawn 4:8 from run 11” identifies the rejected work.

Reduce the steps needed to reproduce the bug. Remove unrelated effects, use a fixed input sequence, and force completion at the point you suspect. If the bug remains, there is less code to inspect. If it disappears, add the removed dependencies back one at a time.

Choose the tool that can answer the current question. A debugger shows control flow and state; profiler markers show timing. Memory snapshots reveal retained objects, and platform logs help investigate native failures. A stack trace shows where a failure surfaced, but the invalid state may have been created earlier.

Write a regression test before or alongside the fix. Where practical, show that it reproduces the old failure and passes with the correction. Also test nearby valid cases, such as normal completion and cancellation. Discarding every result would stop a stale-result bug, but also stop valid requests from working.

State the cause as a sequence the reader can follow: a callback from the previous run kept a [[object pool|pool]] slot, the slot was reused, and the callback applied its result without checking the generation. That explanation makes the reason for the fix clear.

When you cannot form a hypothesis, bisect instead. The question changes from “what is wrong” to “on which side of this line is the problem”, and each answer halves the remaining space. A known-good commit and a known-bad one give you a version bisection, and twenty commits are resolved by about five builds. The same technique works on content, by halving the set of loaded definitions, and on a scene, by disabling half the objects. Bisection is slower to start and far more reliable than inspection, and it does not require understanding the system first.

Some defects stop reproducing when you observe them. Adding a log can change timing enough to hide a race, and a debugger breakpoint changes it much more. When that happens, the fact itself is evidence: a defect sensitive to timing is a race, a defect sensitive to a build configuration is about stripping or optimization, and a defect that disappears in the Editor is about something the Editor supplies that the player does not. Record the observation instead of removing it, and switch to a technique that does not perturb the system, such as writing to a preallocated ring buffer and dumping it after the failure.

For a defect you cannot reproduce at all, spend the effort on making the next occurrence legible rather than on guessing. Add the identifiers the chapter lists, record the build and content revision, and ensure the failure path writes something durable. A bug that happens twice a week is solvable once the second occurrence arrives with its state attached.

Exercise: Take the last difficult bug you fixed and write which technique actually found it: inspection, bisection, or a log you had added earlier. The answer usually suggests what to add before the next one.

?? debugging-hypothesis Which diagnostic record best investigates a reward arriving after restart?
* Run identity, spawn generation, operation identity, and acceptance or rejection reason.
- The stack trace captured at the moment the reward was applied.
- The number of coins collected during the previous run.
- The time in seconds since the application started.
- The name of the scene that was active when the reward arrived.
> These IDs let you follow one collection across a restart. They help distinguish a stale callback from a duplicate request or an incorrect state owner.

?? debugging-regression A fix stops stale artwork by discarding every completed load. Why is that insufficient?
* It removes the symptom while also breaking valid current requests.
- It moves the failure from the view layer into the loader.
- It makes the defect depend on timing, so it reproduces less often.
- It requires the loader to know which view requested each asset.
- It adds a branch that the existing tests already cover.
> A regression check must preserve the intended happy path as well as reject the invalid one.

## Diagnose common Unity production failures {#debugging-unity-scenarios}

For each symptom below, gather evidence that distinguishes the possible causes.

If an event fires twice, check for repeated subscriptions, duplicate persistent services, several colliders reporting the same entity, and retries. Log the identities of both publisher and subscriber. A global boolean may hide the duplicate while also suppressing a later event that should be handled.

If a reference appears null after a scene transition, find out whether it was never assigned, its engine object was destroyed, or a persistent object kept an old scene reference. Check the variable's declared type too, because it affects whether Unity's special null comparison is used.

If a collision or trigger does not fire, first confirm whether the objects use 2D or 3D physics. Check colliders, Rigidbody configuration, enabled state, layer filtering, trigger settings, and how the objects move. In 3D physics, trigger messages need a `Rigidbody` on at least one of the two objects, and collision messages need one of the colliders to have a non-kinematic `Rigidbody` attached. Teleporting a transform can behave differently from simulated Rigidbody movement. Consult the versioned physics API before treating the symptom as an engine bug.

If an effect hitches on first use, add markers around asset loading, prefab creation, shader or pipeline preparation, animation initialization, and managed allocations. Identify the expensive step before prewarming it. Then measure the effect of that prewarming on startup time and memory.

If a feature works in the Editor but fails in a player build, compare the [[scripting backend]], stripping, platform symbols, included assets, filesystem assumptions, native plugins, and content versions. Managed stripping can remove code that is accessed dynamically. Preserve the required types or members, then retest, rather than disabling every optimization. List them in a `link.xml` file under `Assets`, which may name a package's assemblies but cannot live inside a package, or mark them in code with the `[Preserve]` attribute from `UnityEngine.Scripting`. [Unity's stripping manual](https://docs.unity3d.com/6000.0/Documentation/Manual/managed-code-stripping.html) explains the mechanism.

A mobile crash may leave no managed exception. Check native crash reports, memory pressure, platform lifecycle events, graphics drivers, and SDK integrations. The absence of a C# exception does not establish that the game was healthy.

Choose the next check by what it can rule out. A missing callback, an invalid binding, and a failed native operation need different observations.

Order the checks by what they cost, not by what feels most likely. Reading a value you already record is free, reproducing is minutes, and a device capture or a bisection is an hour. Each symptom also has one question that splits the space fastest:

| Symptom | The question that splits fastest |
| --- | --- |
| The event fires twice | Are there two publishers, or one publisher with two subscriptions? |
| The reference is null after a transition | Was it ever assigned, or was it assigned and then destroyed? |
| The trigger does not fire | Is either object moving through physics, or is a transform being set directly? |
| It hitches on first use only | Does a second use also hitch? |
| It works in the Editor only | Does it still fail with managed stripping at Minimal? |

The last two rows are worth noticing, because both replace a hypothesis with a single observation. If the second use also hitches, the problem is not first-use initialization and everything you were about to prewarm is irrelevant. If the player build still fails at Minimal, which removes none of the game's own code, the game's types were not stripped, and the difference is elsewhere: stripping inside the engine or the .NET libraries, ahead-of-time compilation, the content, or the filesystem. Where the platform allows the Mono backend, a Mono build with stripping disabled removes the first two at once, so if that build works, the cause is one of them. A development build answers none of these questions, because it keeps the stripping level and the scripting backend of the release build; use it for the logs and the profiler once you know where to look.

Write the answer down before running the next check. A debugging session that produces no record tends to revisit the same possibilities, particularly when it spans more than one day or more than one person.

Exercise: For a bug you are currently carrying, write the one question that would split its possible causes most evenly. Then answer only that question.

?? debugging-duplicate-event Why is a global “already handled” boolean a risky first fix for duplicate events?
* It can hide duplicate ownership while suppressing valid future operations.
- A boolean cannot be reset safely from more than one thread.
- The flag would need to be serialized so it survives a scene reload.
- Reading a static boolean each frame costs more than an identity check.
- The flag would have to be cleared in `OnDestroy`, which may not run.
> Recognize duplicate work using its logical identity and the period in which that identity is valid. A single global flag may also block unrelated future events.

?? debugging-first-use Which first step best investigates a one-time effect hitch?
* Measure loading, creation, shader preparation, and allocation phases separately.
- Warm the effect during the loading screen and check whether the hitch moves.
- Profile the effect's first use in the Editor, where the capture is easiest to take.
- Force a garbage collection before the effect is first used.
- Compare the hitch against a capture taken from a previous build.
> Separate candidate costs before choosing a mitigation. First-use stalls can come from several unrelated systems.

## Report validation as evidence with limits {#testing-evidence}

First confirm that the intended tests actually ran. Then inspect their failures, skipped tests, and saved results. For Unity batch runs, check both the process exit status and the generated test report. A compilation or startup failure may prevent the suite from running at all.

Record enough information to repeat the validation: commit or build identity, Editor and relevant package versions, target platform, [[scripting backend]], content revision, and test selection. Explain what the run covers. Editor tests alone do not establish device performance or correct native integration.

Match the checks to what changed. A content edit may need parsing, rendering, link or image checks, and a production build. Gameplay rules need tests with controlled inputs. Lifecycle changes need engine checks, and optimizations need repeatable measurements on target devices.

Use a failing test to revisit the explanation of the bug. If results vary between runs, check whether the test makes an unsafe timing assumption or is revealing a real race. Repeating it until it passes leaves the earlier failures unexplained.

Communicate unresolved limits plainly: “The rule tests and Android smoke run passed; iOS purchase integration was not exercised.” That statement helps the team decide what remains. It is more useful than “everything should work.”

In an interview, distinguish validation you completed on a real project from tests you would propose for a hypothetical design. Describe proposed checks as future work.

A written example makes the shape of an evidence statement concrete:

```text
Change:   Claim retry uses a durable pending record.
Build:    9f3c21a, content revision 184, Unity 6000.0.28f1.
Ran:      412 Edit Mode tests, 28 Play Mode tests. All passed.
          Android smoke on a mid-range device: startup, full run, claim, background, resume.
Covers:   Retry after process kill, duplicate response, rejected claim.
Does not: iOS purchase integration, low-memory termination, real server latency.
Open:     The reconciliation path is exercised with a fake authority only.
```

The two most valuable lines are the last two, and they are the ones usually omitted. A reviewer reading “all tests passed” learns almost nothing, because they cannot tell which risks were addressed. A reviewer reading that iOS purchases were not exercised knows exactly what to decide.

The same structure is useful in an interview. Describing what your validation covered and what it did not is a stronger signal than describing a suite as comprehensive, and it matches the distinction this chapter opened with, between checking that tests ran and knowing what they establish.

Exercise: Write this block for the last change you shipped. If the “does not” line is empty, you have not yet found the limits of your validation.

?? testing-zero-tests A test command exits successfully but reports zero discovered tests. What can you conclude?
* The intended behavior has not been validated by that run.
- The test assembly compiled, since the runner started and exited cleanly.
- The tests ran, but the report was written to a different location.
- The suite is unchanged, since no failures were reported.
- The run can be treated as a pass for the purposes of the release gate.
> A successful process without the intended tests is not evidence of behavioral correctness.

?+ A suite passes in the Editor, but the defect depends on native iOS callbacks after resume. What evidence is still needed?
* A relevant target-platform integration check covering resume and callback lifetime.
- A Play Mode run in the Editor that simulates the resume callback.
- A longer Editor run that exercises the same code path many times.
- An Android device run covering the same resume sequence.
- A unit test that calls the callback handler directly with a fake payload.
> Exercise the native callback after resume on the relevant platform. Editor rule tests cannot verify that callback's timing and lifetime.

?? testing-evidence-scope What does a passing plain C# timer test establish?
* The tested timer rules for the supplied inputs.
- That the timer behaves correctly for inputs outside the tested range.
- That the component using the timer unsubscribes when it is disabled.
- That the timer's clock source advances correctly in a build.
- That expiry notifications reach the HUD in the intended order.
> The timer test checks the supplied inputs and expected results. Integration and platform checks provide separate evidence about the parts it does not exercise.
