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

The acceptance table is worth seeing filled in, because its value is in the rows nobody thinks to write:

| Situation | Agreed behavior | Who confirmed it |
| --- | --- | --- |
| Magnet collected while one is active | Remaining time resets to the full duration | Design |
| Run ends during an attraction | Coins in flight are not awarded | Design and QA |
| Two magnets collected in the same frame | One activation; the second is absorbed | Engineering |
| Player pauses with 3 s remaining | Still 3 s remaining on resume | Design |
| Effect icon while the HUD is hidden | Rebuilt from state when the HUD returns | Engineering and UI |
| Magnet definition missing from content | Pickup does nothing; the content build fails | Engineering |

The third column is the one that makes the table work. A behavior with no name against it has not been agreed; it has been assumed by whoever wrote the row. Reviewing that column before implementation is faster than discovering the disagreement in a bug report two weeks later.

Note how many rows describe something other than the feature working. Four of the six describe an interruption, a conflict, or missing content, which is the usual proportion. A specification that covers only the intended path has described the smallest part of the work.

Exercise: Build this table for a feature currently in development, and take it to design with the third column empty. The rows they cannot fill immediately are the real requirements conversation.

?? collaboration-shared-examples A designer asks for a “more generous” magnet. What is the most useful next step?
* Agree on concrete pickup, timing, and feedback examples that express the intended feel.
- Ask the designer to specify the exact radius and duration values.
- Add a tuning slider for every magnet parameter and hand it over.
- Ask which competing game's magnet the designer has in mind.
- Schedule the change for after the current milestone, when there is time.
> Engineering can translate qualitative intent into testable examples while preserving the designer's goal.

?? collaboration-vertical-slice Why demonstrate a small complete feature path early?
* It reveals how feel, assets, authoring, and code work together before the team commits to full production.
- It gives the team a demo that can be shown to stakeholders.
- It lets the engineer validate the architecture before writing tests.
- It produces code the final implementation can build on directly.
- It establishes the frame budget the finished feature will need.
> One complete interaction gives the team something concrete to evaluate. Identify which parts remain temporary and which problems still need work.

## Make content authoring safe and fast {#collaboration-tools}

Authoring tools are part of the feature's production cost. If adding one mission needs a programmer to edit three source files, improving that workflow may matter more than refining an already adequate runtime design.

Give designers the controls they need, with units, valid ranges, defaults, and explanations. “Refill fall speed, tiles per second” is clearer than “speed.” Expose meaningful choices; showing every internal variable can make invalid combinations easier to create.

A validation error should identify the asset, field, invalid value, and a way to fix it. “Mission winter-07 has target 0; use a positive target or select an objective type that has no count” tells the author what to change. “Invalid config” leaves them to find both the problem and its remedy.

Let designers work with readable assets and previews, then convert those assets into validated runtime definitions. Batch validation should catch missing references, duplicate IDs, impossible prerequisites, and unsupported combinations before the content reaches players.

A preview should reproduce the relevant game behavior. If it ignores pause rules, device limits, or event availability, it may make invalid content look ready to ship. Show the constraints the author needs for the current decision.

Authoring a puzzle level is where that earns its keep. A designer building level 312 needs to know whether it can be solved at all, how many moves the solution takes, and whether its special tiles interact the way the level intends. A preview that lays the board out correctly but resolves cascades by different rules than the game will approve a level nobody can finish, and that mistake is then found by players rather than by the team.

Editor tools need undo support and predictable saving. Decide who owns generated assets and which files are authored versus generated. Silently modifying shared assets can surprise other team members and create source-control conflicts.

Evaluate a tool through iteration time and error rate. Fewer repeated requests for programmer help, clearer validation messages, and safer common edits are concrete production improvements.

Tool work competes with feature work, so make the case in the same units. If adding one mission currently takes a designer 20 minutes and they add 12 per week, that is 4 hours weekly. A tool that reduces it to 5 minutes saves 3 hours weekly, so 2 days of engineering, about 16 hours, pays for itself in under six weeks and continues afterward.

The error rate usually matters more than the minutes, and it is easier to forget. Count how often a content mistake reaches a build, and what each one costs: the designer's time, the engineer's time investigating, the build that had to be remade, and occasionally a hotfix. A validation message that catches the mistake at authoring time removes the whole chain, and the chain is where the real cost was.

Two cautions keep this honest. Estimate from observation rather than from what the workflow is supposed to be, since the actual process usually contains steps nobody documented. And include the tool's own maintenance, because a tool that breaks whenever the content schema changes has ongoing cost that the original calculation ignored.

Exercise: Time yourself performing the most repetitive content task in your project, then multiply by how often the team does it in a month. Compare that with your estimate of automating it.

?? collaboration-validation-message Which validation message is most useful to a content author?
* “Mission winter-07: target must be positive; current value is 0.”
- “Validation failed for 1 of 48 missions.”
- “Invalid target value. See the content authoring guide.”
- “Mission validation error at index 6, field 3.”
- “Target must be positive.”
> A useful message identifies the location, failed rule, and relevant value so the author can act.

?? collaboration-exposed-controls Should an Inspector expose every internal implementation variable?
* No; expose the choices authors need, with valid ranges and clear explanations.
- Yes, provided each field has a tooltip explaining its purpose.
- Yes, but grouped into a foldout so the Inspector stays readable.
- Yes; hiding fields forces authors to request programmer changes.
- No; authors should edit a text file rather than the Inspector.
> Give authors controls for intentional content decisions, and help them avoid invalid values. They do not need access to every implementation detail.

## Negotiate visual and performance budgets together {#collaboration-art-budgets}

A performance discussion should connect a measured cost to a player goal. “This effect is too expensive” is incomplete. “On the minimum device, six overlapping smoke layers add 4 ms of GPU time during the hazard sequence; we have 1 ms available” gives the team a constraint to solve.

Bring several ways to meet the budget: reduce transparent overlap, tighten particle bounds, simplify the shader, reduce distant density, or keep the main effect while simplifying the background. Ask the artist which choices preserve what the player needs to see.

Agree on asset budgets early, using measurements from target devices and representative scenes. Cover texture sizes and formats, material variants, relevant bone counts, concurrent effects, audio duration and loading, and how many instances may exist together.

Measure an asset in the scene where it will be used. One effect can be cheap alone, yet expensive when ten overlap with UI, shadows, and post-processing. Provide a test scene or capture for the busiest situation the game normally permits.

Repeated content errors may reveal missing tools. If artists often create unintended material instances or oversized textures, consider validation, presets, and previews that catch the problem earlier. Manual review may still be needed, but should not be the only protection against a common mistake.

Requirements change as the team learns more about the game. Make the cost of those changes visible early, offer practical options, and keep expected variations easy to implement. Treat design and art concerns as part of the engineering problem.

How the budget is delivered decides whether it reads as a constraint to solve or a veto to resent. Three habits help. Bring the measurement and the target rather than a verdict. Bring more than one option, so the conversation is about choosing rather than about accepting. And be explicit that the visual goal is not in question, only the way it is achieved.

A menu is the practical form of that:

| Option | Saving | Visual cost |
| --- | --- | --- |
| Halve the particle count in the background layer | about 1.6 ms | Slightly thinner smoke at distance |
| Reduce the smoke texture to a cheaper shader variant | about 1.2 ms | Softer edges, no lighting response |
| Cut two of the six overlapping layers | about 2.4 ms | Noticeably less depth in the hazard |
| Cut two layers and halve the background particles | about 3.2 ms, measured together | Less depth, thinner smoke at distance |
| Keep as authored | 0 ms | The hazard sequence drops to about 50 FPS, or to 30 where the display holds vsync |

Only the combined row sheds the 3 ms the effect is over budget, and its figure is measured rather than added, because two changes to the same pixels save less together than their separate savings suggest.

The last row belongs in the table. Leaving it out turns the conversation into a demand; including it makes the tradeoff visible and lets the artist weigh it. Sometimes the answer is that the sequence matters enough to spend the frame time, and that is a legitimate outcome of a discussion you framed correctly.

It also helps to say what you are not measuring. A GPU figure says nothing about whether the effect communicates danger, and the artist is the one who can judge that. Being explicit about the limits of your evidence makes the evidence you do have easier to accept.

Exercise: Take a performance problem you are carrying and write three options with their savings and their visual cost. Notice how the conversation changes once the options exist.

?? collaboration-performance-conversation Which feedback best supports an artist-engineer decision?
* A target-device measurement, the available budget, and visual alternatives that preserve the effect's purpose.
- A profiler capture from the effect running alone in an empty scene.
- A statement of the frame budget, without a measurement of the effect.
- A measurement taken on the highest-end device the team owns.
- A request to reduce the effect by half, with the reason left out.
> Shared evidence and alternatives turn a conflict into a concrete design decision.

?+ An artist cannot keep an effect within budget using your first suggestion. What is the strongest next step?
* Revisit the visual goal together and compare alternative implementations with measurements.
- Implement your suggestion anyway and show the artist the result.
- Ask for a version at half the cost, without discussing the goal.
- Escalate to the producer for a decision on the schedule.
- Defer the effect to a later milestone and move on.
> Keep the visual goal in the discussion while testing other ways to achieve it. Measurements let both disciplines assess the tradeoffs.

?? collaboration-context-measurement Why test an effect alongside its expected simultaneous scene content?
* Overlap and shared workload can make the combined cost much higher than an isolated preview suggests.
- An isolated preview uses a different shader variant from the full scene.
- The effect's cost varies with the camera angle used in the preview.
- Isolated previews run at a higher frame rate, which changes the timing.
- The preview scene lacks the lighting setup the effect was authored for.
> Isolated tests identify individual costs; representative combinations establish whether the product meets its budget.

## Review code and handle disagreement with evidence {#collaboration-review}

Explain the consequence of a review finding. “This subscription survives scene unload and can notify a destroyed view” identifies a problem the author can investigate. “I dislike this pattern” states a preference. Distinguish correctness issues, architectural concerns, measured performance costs, and style choices.

Give reviewers the context needed to judge the change: player-visible behavior, key design decisions, compatibility effects, and validation. For a bug fix, describe the trigger and what happens before and after the fix. For a refactor, specify which behavior must remain the same.

Before debating solutions, confirm the goal and constraints. One engineer may be planning for next week's release while another assumes six months of framework work. Making those assumptions explicit can explain why their designs differ.

Compare alternatives with a small prototype, profiler capture, or written decision. Set a time limit when evidence can be gathered cheaply. If the team must decide before every uncertainty is resolved, record the assumptions and what would prompt a review of the decision.

Ask for help early with a bounded description: what you tried, what you observed, and which uncertainty blocks progress. “The callback arrives after scene unload; I can reproduce it with this sequence and suspect the adapter owns no cancellation scope” invites useful assistance.

A senior engineer helps teammates understand and maintain the system, reviews risky interactions, and improves the process that allowed defects through. Making the code depend on one person's knowledge creates a maintenance problem.

Label the severity, because the author cannot read your mind about what blocks. Four labels cover almost everything:

| Label | Meaning | Author's obligation |
| --- | --- | --- |
| Blocking | Correctness, data loss, or compatibility | Must be resolved before merge |
| Should | A real cost, but the change can ship | Address or reply with a reason |
| Consider | A suggestion worth a moment's thought | May decline without justifying it |
| Note | Information, no action implied | None |

Most review friction comes from unlabeled comments being read at the wrong severity. A reviewer's passing thought read as a requirement wastes a day; a genuine correctness problem read as a preference ships a bug. One word at the front of the comment removes both failures.

Keep the ratio honest. A review where everything is blocking teaches the author to argue with all of it, and a review where nothing is teaches them to skim. If a change genuinely has six blocking problems, that is usually a signal to talk rather than to keep typing, because the disagreement is probably about the approach rather than about the lines.

Receiving review has a discipline too. Answer the finding rather than defending the code: “you are right, the handler leaks on the reopen path, fixed in the next commit” closes a thread that a justification would extend. Where you disagree, say what you would need to see to change your mind, which keeps the exchange about evidence instead of about who is more senior.

Exercise: Look back at the last review you gave and assign one of the four labels to each comment. Count how many you would have labeled differently than the author probably read them.

?? collaboration-review-finding Which review comment is most actionable?
* “This handler is never removed when the view unbinds, so reopening can register it twice; add lifecycle cleanup and a reopen test.”
- “This subscription is not removed when the view unbinds.”
- “Consider extracting this into a separate presenter class.”
- “There is a bug in the binding lifecycle here.”
- “This does not match how the other views handle subscriptions.”
> The comment identifies the missing cleanup, explains the duplicate subscription it can cause, and suggests a check for the fix.

?? collaboration-disagreement What should a team clarify before debating two architectures?
* The requirements, time horizon, constraints, and evidence each proposal is optimizing for.
- Which proposal requires fewer changes to the existing code.
- Which proposal the team's most experienced engineer prefers.
- Whether either proposal has already been prototyped.
- Which proposal fits the current milestone's schedule.
> Two designs may look incompatible because their authors assumed different requirements or schedules. Agree on the decision criteria before comparing them.

## Prepare a credible cross-disciplinary interview story {#collaboration-story}

Choose a real situation that required engineering judgment across disciplines. It might involve unclear behavior, a limitation in the asset pipeline, a performance budget, a late scope change, or responsibility shared between teams.

Explain the shared objective first, then the disagreement or missing information. Describe what you did, the tradeoff the team chose, and the result. Be clear about your own contribution and your collaborators' work. Finish with what you learned and changed afterward.

A hypothetical example:

“Design wanted a reward celebration to survive a scene transition, while the original UI owned both the animation and the grant. I mapped the interruption cases with design and QA, moved the grant into a persistent claim operation, and made the animation reconstruct from the result. Art retained the important celebration beat, and we added resume and double-tap tests. The remaining cost was a more explicit binding lifecycle.”

Use facts from your own experience with this structure. If no reliable metric is available, describe concrete evidence: fewer manual steps, a reproduced bug that was fixed, a completed release, or a class of content errors the tool now catches.

If a difficult interaction involved changing requirements, explain why those requirements changed and what feedback led to the change. A phrase such as “designers kept changing their minds” leaves out that reasoning. Describe how you made later changes easier, or made their cost visible sooner, while remaining candid about the difficulty.

Prepare to explain what the other discipline needed, what you initially misunderstood, which compromise was hardest, and what you would change now. Those details show how collaboration affected your engineering decisions.

The structure in that example has a common name, STAR, for situation, task, action, result, and it is worth knowing because interviewers use the word and are often listening for its parts. Situation sets the constraints, task states what was yours to solve, action describes what you did, and result gives the outcome and the evidence. The order matters less than the completeness; most weak answers are missing the task, so the listener cannot tell what the speaker actually owned.

Budget the length. Two to three minutes is right for a behavioral answer, which is roughly four or five sentences per part. Longer answers tend to lose the task and the result, which are the parts being assessed, in favor of the situation, which is the part that is easiest to describe. Practise with a timer once; almost everyone's first attempt runs long.

Prepare at least one story whose result was not good, because you will be asked. A project cancelled, a design you argued for that turned out worse than the alternative, or a bug you shipped are all usable material when the action and the learning are specific. “We missed it because nobody had tested a save from the previous version, so I added historical save fixtures to the suite and they have caught two regressions since” is a stronger answer than any success story told vaguely. Avoid the failure that is a disguised strength, since interviewers recognize it and it costs you the credibility that a real answer would have earned.

Exercise: Write your least successful project as a four-part story, and make sure the action section describes what you did rather than what the situation did to you.

?? collaboration-story-accountability Which statement best demonstrates your contribution without inventing credit?
* Describe the decision or tool you owned, the collaborators involved, and the observed outcome.
- Describe the team's achievement, so no individual claim is overstated.
- Describe the technical design in detail, leaving ownership implicit.
- Describe your role by job title and the systems it covered.
- Describe what you would have done if the decision had been yours.
> State what you owned, what teammates contributed, and what evidence supports the result.

?? collaboration-story-learning Why include what you initially misunderstood?
* It shows how feedback changed your model and improved the final decision.
- It shows humility, which interviewers assess separately from skill.
- It fills time when the technical details are confidential.
- It shifts attention away from a result that was not strong.
- It shows you can recall details from a long time ago.
> Explain the assumption you corrected and how that correction changed the work. This shows how you use feedback when making decisions.
