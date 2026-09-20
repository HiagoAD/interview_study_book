---
book: Unity Game Engineering
chapter: 08: Testing and debugging production behavior
---

## Build tests around observable contracts {#testing-contracts}

Assert the required balance, transition, ownership rule, or output. Those checks catch behavior changes while allowing private fields and helper-call sequences to change during a refactor.

Use plain rule tests for timers, reward calculations, mission progression, and eligibility. Inject current time, randomness, and storage boundaries. The test should be able to say “now is exactly the deadline” without waiting in real time.

Use integration tests for boundaries: serialization round trips, content conversion, persistence recovery, and interactions among real collaborators. Use engine tests for component lifecycles, scene bindings, physics-dependent behavior, and prefab wiring.

Unity's Test Framework distinguishes Edit Mode and Play Mode execution environments. Edit Mode is useful for many rule and editor-tool tests; Play Mode exercises runtime behavior, and target-player execution adds platform evidence. The exact setup depends on the installed package. [Unity Test Framework's mode guide](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/edit-mode-vs-play-mode-tests.html) explains those environments.

Avoid substituting mocks for the behavior you intend to verify. If a test configures a mock wallet to return success and then asserts that the feature returns success, it may only verify the mock setup. A real small wallet plus a fake persistence boundary can expose duplicate grants and invalid arithmetic.

Choose test doubles by purpose:

| Double | Purpose | Example |
| --- | --- | --- |
| Stub | Supply a controlled answer | A fixed clock value |
| Fake | Simplified working implementation | In-memory progress storage |
| Spy | Record observations | Captured diagnostic events |
| Mock | Verify a specified interaction contract | A platform call must be made once |

Choose those doubles carefully. A hundred fragile interaction tests can make refactoring harder without catching player-visible failures. Prioritize invariants, previous regressions, and boundaries where a failure could lose state or apply work twice.

?? testing-observable-contract Which assertion best protects the collection requirement?
* Repeating collection for the same spawn leaves the balance unchanged after the first grant.
- The implementation calls a private helper exactly three times.
- The model contains exactly four fields.
- Every test double was constructed in alphabetical order.
> Observable outcomes survive safe refactoring and detect meaningful regressions.

?? testing-engine-boundary Which behavior most clearly needs Unity runtime integration evidence?
* A pooled component unsubscribes and resets when it is disabled and reused.
- Integer addition in a pure reward calculator.
- Comparing two immutable mission IDs.
- Computing a deterministic threshold from ordinary values.
> Engine lifecycle behavior depends on actual component activation and reuse. Plain rule tests remain useful but do not establish the integration.

## Derive a test matrix from state and failure boundaries {#testing-matrix}

Start with states and transitions, then add boundary values. For a purchase, the core states might be idle, pending, completed, rejected, and outcome-unknown. The important cases include exact balance, insufficient balance, duplicate request, timeout before commitment, timeout after commitment, cancellation of the view, and restoration after restart.

Use a compact matrix:

| Dimension | Representative cases |
| --- | --- |
| Numeric boundary | Zero, one, exact threshold, maximum valid, overflow |
| Lifetime | Before bind, active, disabled, destroyed, reused |
| Timing | Before deadline, at deadline, after deadline |
| Delivery | Once, duplicate, delayed, out of order |
| Persistence | Old schema, truncated file, failed write, recovery |
| Content | Missing ID, duplicate ID, unknown revision, invalid reference |

Do not blindly multiply every dimension into an unmanageable Cartesian product. Select combinations that can interact, plus targeted tests for known defects. For example, stale asynchronous completion and pooled reuse deserve a combined case because they share an identity hazard.

Property-style tests assert invariants across generated inputs: a wallet never becomes negative, a shuffle preserves every element exactly once, and a clamped mission count never exceeds its target. Use reproducible seeds and report the failing inputs.

Metamorphic tests compare related executions when an exact expected answer is inconvenient. Applying a no-op modifier should not change damage; replaying a deduplicated event twice should match replaying it once. These relations must themselves be valid product rules.

For asynchronous tests, control completion order with a fake loader rather than hoping a real network request finishes late. For temporal rules, advance a fake clock rather than sleeping. A test that depends on machine speed is likely to be flaky.

?? testing-controlled-order How should a test reproduce two artwork loads completing in reverse order?
* Use a controllable fake loader and explicitly complete the second request first.
- Depend on live network latency to produce the order.
- Sleep for an arbitrary time and assume the first request is slower.
- Disable the assertion whenever the test machine is busy.
> Controlled scheduling makes a race reproducible. Timing guesses create flaky evidence.

?? testing-property Which property is appropriate for a shuffle of a list with unique IDs?
* Every input ID appears exactly once in the output.
- The output must always differ from the input order.
- The first element must always move to the last position.
- Every individual shuffle must produce all possible permutations.
> A correct shuffle preserves membership. The original order is itself a valid random outcome.

## Debug by narrowing a hypothesis {#debugging-method}

Begin with a precise symptom: “After restarting during a magnet attraction, the next run sometimes receives a coin from the previous run.” Record the build, content revision, device, steps, expected result, actual result, and frequency.

Test competing explanations: the coin registry failed to reset, a subscriber survived, or an old coroutine completed against a reused object. Inspect registry contents after restart, count subscriptions, and record the generation attached to each callback.

At collection, record the run ID, spawn ID, generation, operation ID, phase, and command result. Correlate a logical operation across callbacks. Logging “collect called” in ten places creates noise; logging “run 12 rejected spawn 4:8 from run 11” gives evidence.

Reduce the reproduction. Remove unrelated effects, use a fixed input sequence, and force completion at the suspect boundary. If the problem remains, you have a smaller system to inspect. If it disappears, reintroduce dependencies deliberately.

Use a debugger for control flow and state, profiler markers for timing, memory snapshots for retention, and platform logs for native failures. Each tool answers a different question. A stack trace names where failure surfaced, which may be downstream of the original invalid state.

After finding the cause, write the regression test before or with the fix. Reproduce the failure on the old behavior where practical, then show that the corrected behavior passes. Verify adjacent paths such as normal completion and cancellation; a fix that discards every result can hide the original symptom while breaking the feature.

End the bug report with the cause: a previous-run callback retained a pool slot, the slot was reused, and the callback lacked a generation check. The fix follows from that chain.

?? debugging-hypothesis Which diagnostic record best investigates a reward arriving after restart?
* Run identity, spawn generation, operation identity, and acceptance or rejection reason.
- Only the current average FPS.
- Only the visible coin color.
- A log line saying “something happened” in every update.
> Context that follows the logical operation distinguishes stale work from duplicate work and incorrect ownership.

?? debugging-regression A fix stops stale artwork by discarding every completed load. Why is that insufficient?
* It removes the symptom while also breaking valid current requests.
- It proves all cancellation paths are correct.
- It is always the best performance optimization.
- It guarantees the asset handles are released.
> A regression check must preserve the intended happy path as well as reject the invalid one.

## Diagnose common Unity production failures {#debugging-unity-scenarios}

For each symptom below, gather evidence that distinguishes the possible causes.

An event fires twice. Inspect repeated subscriptions, duplicate persistent services, multiple colliders reporting the same logical entity, and retries. Log publisher and subscriber identity. Do not just add a global boolean; that may suppress legitimate subsequent events.

A reference appears null after a scene transition. Determine whether it was never assigned, its native object was destroyed, or a persistent owner retained a scene binding. Check the declared variable type when Unity's null semantics matter.

A collision or trigger does not fire. Confirm the correct 2D or 3D physics system, collider and Rigidbody configuration, enabled state, layer filtering, trigger settings, and how the object moves. Check the versioned physics API before assuming an engine bug. A transform teleport and a simulated Rigidbody motion are not equivalent.

The first use of an effect hitches. Separate asset loading, prefab creation, shader or pipeline preparation, animation initialization, and managed allocations with markers. Prewarm only the identified cost, then remeasure startup memory and time.

The player build fails while the Editor works. Compare backend, code stripping, platform symbols, asset inclusion, filesystem assumptions, native plugins, and content versions. Managed stripping can remove dynamically used code unless it is retained appropriately; preserve the necessary surface rather than disabling every optimization. [Unity's stripping manual](https://docs.unity3d.com/6000.0/Documentation/Manual/ManagedCodeStripping.html) explains that mechanism.

A mobile crash has no managed exception. Examine native crash information, memory pressure, platform lifecycle, graphics drivers, and SDK integrations. Absence of a C# exception is not evidence that the game was healthy.

Choose the next check by what it can rule out. A missing callback, an invalid binding, and a failed native operation need different observations.

?? debugging-duplicate-event Why is a global “already handled” boolean a risky first fix for duplicate events?
* It can hide duplicate ownership while suppressing valid future operations.
- Booleans cannot be used in Unity.
- Duplicate subscriptions are impossible.
- Every duplicate event must originate in the physics engine.
> Deduplication should use the appropriate logical identity and lifecycle. A global flag can conceal rather than repair the cause.

?? debugging-first-use Which first step best investigates a one-time effect hitch?
* Measure loading, creation, shader preparation, and allocation phases separately.
- Pool every object in the project without measuring.
- Lower all texture resolutions immediately.
- Assume the largest script file is responsible.
> Separate candidate costs before choosing a mitigation. First-use stalls can come from several unrelated systems.

## Report validation as evidence with limits {#testing-evidence}

Confirm that the intended tests ran, then check their failures, skips, and result artifact. For Unity batch execution, check the process exit status and the generated test results; compilation or startup problems can prevent the intended suite from executing.

Record what was tested: commit or build identity, Editor version, relevant package versions, target platform, scripting backend, content revision, and test selection. Do not imply that Editor tests establish device performance or native integration correctness.

Match validation to the change. A content-only edit may need parsing, rendering, link or asset checks, and a production build. Test gameplay rules with controlled inputs; exercise lifecycle changes in the engine. An optimization needs repeatable target-device measurements.

Use failures to revise the hypothesis. If a test is flaky, determine whether its timing assumptions are wrong or it is exposing an actual race. Re-running until green without explaining the earlier failures weakens the evidence.

Communicate unresolved limits plainly: “The rule tests and Android smoke run passed; iOS purchase integration was not exercised.” That statement helps the team decide what remains. It is more useful than “everything should work.”

In an interview, report the validation you performed on your own project. If a hypothetical design includes tests you would add, label them as proposed rather than completed.

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
> Validation must reach the failing boundary. Editor rule tests cannot establish native platform lifecycle behavior.

?? testing-evidence-scope What does a passing plain C# timer test establish?
* The tested timer rules for the supplied inputs.
- Correct native SDK integration on every platform.
- Absence of GPU bottlenecks.
- Correct lifecycle wiring for every prefab.
> Evidence has a scope. Layered validation combines rule, integration, and platform checks without conflating them.
