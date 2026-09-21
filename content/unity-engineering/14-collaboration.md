---
book: Unity Game Engineering
chapter: 14: Working with designers, artists, and engineers
---

## Turn ambiguous intent into shared examples {#collaboration-discovery}

Different disciplines often begin with different views of the same feature. Design considers the player experience; art considers visual composition and how assets are produced. QA looks for observable cases, while engineering considers state, dependencies, and failure. A shared design needs those views to meet.

Start with what the player should notice or do. “The magnet should feel generous” is a useful design goal. Turn it into examples the team can discuss: pickup radius, attraction acceleration, behavior outside the screen, duration feedback, and how overlapping effects are shown.

Build an acceptance table with the team. Include normal play, interruptions, missing content, and edge cases. A short conversation about ending a run during a reward animation can prevent gameplay and UI from implementing different assumptions.

Show a small, complete interaction early, using temporary art where needed. This vertical slice reveals timing, authoring, and integration problems that separate unfinished subsystems may hide. Identify the temporary parts, so nobody treats a prototype shortcut as the final production behavior.

Explain decisions in language the whole team can use: “The reward is saved before the celebration begins, so closing the screen will not lose it.” That states what the transaction rule means for the player without requiring everyone to understand its implementation.

Document unresolved questions with an owner and a decision date. Otherwise, several people may build on conflicting assumptions before anyone notices.

?? collaboration-shared-examples A designer asks for a “more generous” magnet. What is the most useful next step?
* Agree on concrete pickup, timing, and feedback examples that express the intended feel.
- Choose a larger constant privately and declare the requirement complete.
- Ask the designer to design the entire class hierarchy first.
- Reject the request because it is not already a technical specification.
> Engineering can translate qualitative intent into testable examples while preserving the designer's goal.

?? collaboration-vertical-slice Why demonstrate a small complete feature path early?
* It reveals how feel, assets, authoring, and code work together before the team commits to full production.
- It proves every edge case is already solved.
- It eliminates the need for acceptance criteria.
- It makes temporary prototype code automatically production-ready.
> One complete interaction gives the team something concrete to evaluate. Identify which parts remain temporary and which problems still need work.

## Make content authoring safe and fast {#collaboration-tools}

Authoring tools are part of the feature's production cost. If adding one mission needs a programmer to edit three source files, improving that workflow may matter more than refining an already adequate runtime design.

Give designers the controls they need, with units, valid ranges, defaults, and explanations. “Attraction acceleration, meters per second squared” is clearer than “strength.” Expose meaningful choices; showing every internal variable can make invalid combinations easier to create.

A validation error should identify the asset, field, invalid value, and a way to fix it. “Mission winter-07 has target 0; use a positive target or select an objective type that has no count” tells the author what to change. “Invalid config” leaves them to find both the problem and its remedy.

Let designers work with readable assets and previews, then convert those assets into validated runtime definitions. Batch validation should catch missing references, duplicate IDs, impossible prerequisites, and unsupported combinations before the content reaches players.

A preview should reproduce the relevant game behavior. If it ignores pause rules, device limits, or event availability, it may make invalid content look ready to ship. Show the constraints the author needs for the current decision.

Editor tools need undo support and predictable saving. Decide who owns generated assets and which files are authored versus generated. Silently modifying shared assets can surprise other team members and create source-control conflicts.

Evaluate a tool through iteration time and error rate. Fewer repeated requests for programmer help, clearer validation messages, and safer common edits are concrete production improvements.

?? collaboration-validation-message Which validation message is most useful to a content author?
* “Mission winter-07: target must be positive; current value is 0.”
- “Something went wrong.”
- “Null.”
- “The engineer should inspect the whole project.”
> A useful message identifies the location, failed rule, and relevant value so the author can act.

?? collaboration-exposed-controls Should an Inspector expose every internal implementation variable?
* No; expose the choices authors need, with valid ranges and clear explanations.
- Yes; more fields always improve iteration speed.
- Only if every field has an obscure abbreviation.
- No fields should ever be configurable.
> Give authors controls for intentional content decisions, and help them avoid invalid values. They do not need access to every implementation detail.

## Negotiate visual and performance budgets together {#collaboration-art-budgets}

A performance discussion should connect a measured cost to a player goal. “This effect is too expensive” is incomplete. “On the minimum device, six overlapping smoke layers add 4 ms of GPU time during the hazard sequence; we have 1 ms available” gives the team a constraint to solve.

Bring several ways to meet the budget: reduce transparent overlap, tighten particle bounds, simplify the shader, reduce distant density, or keep the main effect while simplifying the background. Ask the artist which choices preserve what the player needs to see.

Agree on asset budgets early, using measurements from target devices and representative scenes. Cover texture sizes and formats, material variants, relevant bone counts, concurrent effects, audio duration and loading, and how many instances may exist together.

Measure an asset in the scene where it will be used. One effect can be cheap alone, yet expensive when ten overlap with UI, shadows, and post-processing. Provide a test scene or capture for the busiest situation the game normally permits.

Repeated content errors may reveal missing tools. If artists often create unintended material instances or oversized textures, consider validation, presets, and previews that catch the problem earlier. Manual review may still be needed, but should not be the only protection against a common mistake.

Requirements change as the team learns more about the game. Make the cost of those changes visible early, offer practical options, and keep expected variations easy to implement. Treat design and art concerns as part of the engineering problem.

?? collaboration-performance-conversation Which feedback best supports an artist-engineer decision?
* A target-device measurement, the available budget, and visual alternatives that preserve the effect's purpose.
- “Artists always make expensive assets.”
- “The frame rate is bad, so remove every effect.”
- “It ran on my workstation, so no budget is needed.”
> Shared evidence and alternatives turn a conflict into a concrete design decision.

?+ An artist cannot keep an effect within budget using your first suggestion. What is the strongest next step?
* Revisit the visual goal together and compare alternative implementations with measurements.
- Treat the rejected suggestion as proof that collaboration is impossible.
- Ship the over-budget effect without recording the impact.
- Remove the effect privately and let the team discover the change later.
> Keep the visual goal in the discussion while testing other ways to achieve it. Measurements let both disciplines assess the tradeoffs.

?? collaboration-context-measurement Why test an effect alongside its expected simultaneous scene content?
* Overlap and shared workload can make the combined cost much higher than an isolated preview suggests.
- Isolated tests are never useful for any purpose.
- Every effect has identical GPU cost.
- Scene context changes only the asset's filename.
> Isolated tests identify individual costs; representative combinations establish whether the product meets its budget.

## Review code and handle disagreement with evidence {#collaboration-review}

Explain the consequence of a review finding. “This subscription survives scene unload and can notify a destroyed view” identifies a problem the author can investigate. “I dislike this pattern” states a preference. Distinguish correctness issues, architectural concerns, measured performance costs, and style choices.

Give reviewers the context needed to judge the change: player-visible behavior, key design decisions, compatibility effects, and validation. For a bug fix, describe the trigger and what happens before and after the fix. For a refactor, specify which behavior must remain the same.

Before debating solutions, confirm the goal and constraints. One engineer may be planning for next week's release while another assumes six months of framework work. Making those assumptions explicit can explain why their designs differ.

Compare alternatives with a small prototype, profiler capture, or written decision. Set a time limit when evidence can be gathered cheaply. If the team must decide before every uncertainty is resolved, record the assumptions and what would prompt a review of the decision.

Ask for help early with a bounded description: what you tried, what you observed, and which uncertainty blocks progress. “The callback arrives after scene unload; I can reproduce it with this sequence and suspect the adapter owns no cancellation scope” invites useful assistance.

A senior engineer helps teammates understand and maintain the system, reviews risky interactions, and improves the process that allowed defects through. Making the code depend on one person's knowledge creates a maintenance problem.

?? collaboration-review-finding Which review comment is most actionable?
* “This handler is never removed when the view unbinds, so reopening can register it twice; add lifecycle cleanup and a reopen test.”
- “This feels wrong.”
- “Use my favorite pattern everywhere.”
- “The implementation has too many characters.”
> The comment identifies the missing cleanup, explains the duplicate subscription it can cause, and suggests a check for the fix.

?? collaboration-disagreement What should a team clarify before debating two architectures?
* The requirements, time horizon, constraints, and evidence each proposal is optimizing for.
- Which engineer has the longest job title.
- Whether both proposals have the same number of interfaces.
- Which diagram uses more technical vocabulary.
> Two designs may look incompatible because their authors assumed different requirements or schedules. Agree on the decision criteria before comparing them.

## Prepare a credible cross-disciplinary interview story {#collaboration-story}

Choose a real situation that required engineering judgment across disciplines. It might involve unclear behavior, a limitation in the asset pipeline, a performance budget, a late scope change, or responsibility shared between teams.

Explain the shared objective first, then the disagreement or missing information. Describe what you did, the tradeoff the team chose, and the result. Be clear about your own contribution and your collaborators' work. Finish with what you learned and changed afterward.

A hypothetical example:

“Design wanted a reward celebration to survive a scene transition, while the original UI owned both the animation and the grant. I mapped the interruption cases with design and QA, moved the grant into a persistent claim operation, and made the animation reconstruct from the result. Art retained the important celebration beat, and we added resume and double-tap tests. The remaining cost was a more explicit binding lifecycle.”

Use facts from your own experience with this structure. If no reliable metric is available, describe concrete evidence: fewer manual steps, a reproduced bug that was fixed, a completed release, or a class of content errors the tool now catches.

If a difficult interaction involved changing requirements, explain why those requirements changed and what feedback led to the change. A phrase such as “designers kept changing their minds” leaves out that reasoning. Describe how you made later changes easier, or made their cost visible sooner, while remaining candid about the difficulty.

Prepare to explain what the other discipline needed, what you initially misunderstood, which compromise was hardest, and what you would change now. Those details show how collaboration affected your engineering decisions.

?? collaboration-story-accountability Which statement best demonstrates your contribution without inventing credit?
* Describe the decision or tool you owned, the collaborators involved, and the observed outcome.
- Present a hypothetical example as a project you shipped.
- Attribute every success to yourself and every problem to design.
- Avoid explaining any personal action.
> State what you owned, what teammates contributed, and what evidence supports the result.

?? collaboration-story-learning Why include what you initially misunderstood?
* It shows how feedback changed your model and improved the final decision.
- It proves that preparation is unnecessary.
- It replaces the need to explain the result.
- It makes every disagreement the other person's responsibility.
> Explain the assumption you corrected and how that correction changed the work. This shows how you use feedback when making decisions.
