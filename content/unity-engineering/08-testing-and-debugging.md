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

?? testing-observable-contract Which assertion best protects the collection requirement?
* Repeating collection for the same spawn leaves the balance unchanged after the first grant.
- The implementation calls a private helper exactly three times.
- The model contains exactly four fields.
- Every test double was constructed in alphabetical order.
> A test of the resulting balance catches duplicate grants and still works when private implementation details change.

?? testing-engine-boundary Which behavior most clearly needs Unity runtime integration evidence?
* A pooled component unsubscribes and resets when it is disabled and reused.
- Integer addition in a pure reward calculator.
- Comparing two immutable mission IDs.
- Computing a deterministic threshold from ordinary values.
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

You do not need to test every possible combination in the matrix. Choose combinations whose behaviors can affect each other, along with cases for known bugs. For example, combine a late asynchronous result with pool reuse: the same object can now represent a different item.

Property-style tests generate many inputs and check a rule that should hold for all of them. Examples include a wallet never becoming negative, a shuffle preserving each element exactly once, or a capped mission count never exceeding its target. Use reproducible seeds and report the inputs that failed.

When an exact expected answer is difficult to calculate, a metamorphic test compares related executions. A modifier that does nothing should leave damage unchanged. Processing a deduplicated event twice should give the same result as processing it once. Check that the relationship itself is a valid gameplay rule before using it as a test.

Control asynchronous completion with a fake loader, so the test can decide which request finishes first. Advance a fake clock to test time rules. Depending on real network delays or sleeping for an arbitrary duration makes the result depend on the test machine's timing.

?? testing-controlled-order How should a test reproduce two artwork loads completing in reverse order?
* Use a controllable fake loader and explicitly complete the second request first.
- Depend on live network latency to produce the order.
- Sleep for an arbitrary time and assume the first request is slower.
- Disable the assertion whenever the test machine is busy.
> Completing requests in a chosen order makes the race repeatable. Guessing how long each request will take can make the test pass or fail unpredictably.

?? testing-property Which property is appropriate for a shuffle of a list with unique IDs?
* Every input ID appears exactly once in the output.
- The output must always differ from the input order.
- The first element must always move to the last position.
- Every individual shuffle must produce all possible permutations.
> A correct shuffle preserves membership. The original order is itself a valid random outcome.

## Debug by narrowing a hypothesis {#debugging-method}

Begin with a precise symptom: “After restarting during a magnet attraction, the next run sometimes receives a coin from the previous run.” Record the build, content revision, device, steps, expected result, actual result, and frequency.

List explanations that could produce the symptom. Perhaps the coin registry failed to reset, a subscription survived the restart, or an old coroutine finished after its object was reused. Check each one: inspect the registry after restart, count subscriptions, and record the generation attached to each callback.

At collection, record the run ID, spawn ID, generation, operation ID, phase, and result. Use those IDs to follow one operation through its callbacks. Logging “collect called” in ten places tells you little about which coin was involved. A message such as “run 12 rejected spawn 4:8 from run 11” identifies the rejected work.

Reduce the steps needed to reproduce the bug. Remove unrelated effects, use a fixed input sequence, and force completion at the point you suspect. If the bug remains, there is less code to inspect. If it disappears, add the removed dependencies back one at a time.

Choose the tool that can answer the current question. A debugger shows control flow and state; profiler markers show timing. Memory snapshots reveal retained objects, and platform logs help investigate native failures. A stack trace shows where a failure surfaced, but the invalid state may have been created earlier.

Write a regression test before or alongside the fix. Where practical, show that it reproduces the old failure and passes with the correction. Also test nearby valid cases, such as normal completion and cancellation. Discarding every result would stop a stale-result bug, but also stop valid requests from working.

State the cause as a sequence the reader can follow: a callback from the previous run kept a pool slot, the slot was reused, and the callback applied its result without checking the generation. That explanation makes the reason for the fix clear.

?? debugging-hypothesis Which diagnostic record best investigates a reward arriving after restart?
* Run identity, spawn generation, operation identity, and acceptance or rejection reason.
- Only the current average FPS.
- Only the visible coin color.
- A log line saying “something happened” in every update.
> These IDs let you follow one collection across a restart. They help distinguish a stale callback from a duplicate request or an incorrect state owner.

?? debugging-regression A fix stops stale artwork by discarding every completed load. Why is that insufficient?
* It removes the symptom while also breaking valid current requests.
- It proves all cancellation paths are correct.
- It is always the best performance optimization.
- It guarantees the asset handles are released.
> A regression check must preserve the intended happy path as well as reject the invalid one.

## Diagnose common Unity production failures {#debugging-unity-scenarios}

For each symptom below, gather evidence that distinguishes the possible causes.

If an event fires twice, check for repeated subscriptions, duplicate persistent services, several colliders reporting the same entity, and retries. Log the identities of both publisher and subscriber. A global boolean may hide the duplicate while also suppressing a later event that should be handled.

If a reference appears null after a scene transition, find out whether it was never assigned, its engine object was destroyed, or a persistent object kept an old scene reference. Check the variable's declared type too, because it affects whether Unity's special null comparison is used.

If a collision or trigger does not fire, first confirm whether the objects use 2D or 3D physics. Check colliders, Rigidbody configuration, enabled state, layer filtering, trigger settings, and how the objects move. Teleporting a transform can behave differently from simulated Rigidbody movement. Consult the versioned physics API before treating the symptom as an engine bug.

If an effect hitches on first use, add markers around asset loading, prefab creation, shader or pipeline preparation, animation initialization, and managed allocations. Identify the expensive step before prewarming it. Then measure the effect of that prewarming on startup time and memory.

If a feature works in the Editor but fails in a player build, compare the scripting backend, stripping, platform symbols, included assets, filesystem assumptions, native plugins, and content versions. Managed stripping can remove code that is accessed dynamically. Preserve the required types or members, then retest, rather than disabling every optimization. [Unity's stripping manual](https://docs.unity3d.com/6000.0/Documentation/Manual/ManagedCodeStripping.html) explains the mechanism.

A mobile crash may leave no managed exception. Check native crash reports, memory pressure, platform lifecycle events, graphics drivers, and SDK integrations. The absence of a C# exception does not establish that the game was healthy.

Choose the next check by what it can rule out. A missing callback, an invalid binding, and a failed native operation need different observations.

?? debugging-duplicate-event Why is a global “already handled” boolean a risky first fix for duplicate events?
* It can hide duplicate ownership while suppressing valid future operations.
- Booleans cannot be used in Unity.
- Duplicate subscriptions are impossible.
- Every duplicate event must originate in the physics engine.
> Recognize duplicate work using its logical identity and the period in which that identity is valid. A single global flag may also block unrelated future events.

?? debugging-first-use Which first step best investigates a one-time effect hitch?
* Measure loading, creation, shader preparation, and allocation phases separately.
- Pool every object in the project without measuring.
- Lower all texture resolutions immediately.
- Assume the largest script file is responsible.
> Separate candidate costs before choosing a mitigation. First-use stalls can come from several unrelated systems.

## Report validation as evidence with limits {#testing-evidence}

First confirm that the intended tests actually ran. Then inspect their failures, skipped tests, and saved results. For Unity batch runs, check both the process exit status and the generated test report. A compilation or startup failure may prevent the suite from running at all.

Record enough information to repeat the validation: commit or build identity, Editor and relevant package versions, target platform, scripting backend, content revision, and test selection. Explain what the run covers. Editor tests alone do not establish device performance or correct native integration.

Match the checks to what changed. A content edit may need parsing, rendering, link or image checks, and a production build. Gameplay rules need tests with controlled inputs. Lifecycle changes need engine checks, and optimizations need repeatable measurements on target devices.

Use a failing test to revisit the explanation of the bug. If results vary between runs, check whether the test makes an unsafe timing assumption or is revealing a real race. Repeating it until it passes leaves the earlier failures unexplained.

Communicate unresolved limits plainly: “The rule tests and Android smoke run passed; iOS purchase integration was not exercised.” That statement helps the team decide what remains. It is more useful than “everything should work.”

In an interview, distinguish validation you completed on a real project from tests you would propose for a hypothetical design. Describe proposed checks as future work.

?? testing-zero-tests A test command exits successfully but reports zero discovered tests. What can you conclude?
* The intended behavior has not been validated by that run.
- Every test passed implicitly.
- The code is guaranteed to be production-ready.
- Performance has been measured on every device.
> A successful process without the intended tests is not evidence of behavioral correctness.

?+ A suite passes in the Editor, but the defect depends on native iOS callbacks after resume. What evidence is still needed?
* A relevant target-platform integration check covering resume and callback lifetime.
- Only another identical run of the pure arithmetic tests.
- A higher code-coverage percentage without exercising the callback path.
- A screenshot proving the Editor opened.
> Exercise the native callback after resume on the relevant platform. Editor rule tests cannot verify that callback's timing and lifetime.

?? testing-evidence-scope What does a passing plain C# timer test establish?
* The tested timer rules for the supplied inputs.
- Correct native SDK integration on every platform.
- Absence of GPU bottlenecks.
- Correct lifecycle wiring for every prefab.
> The timer test checks the supplied inputs and expected results. Integration and platform checks provide separate evidence about the parts it does not exercise.
