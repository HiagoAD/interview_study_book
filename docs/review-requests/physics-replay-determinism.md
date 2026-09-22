# Review request: what a physics replay needs besides its inputs

- **Kind:** accuracy, an omission that makes the sentence misleading
- **Priority:** medium
- **Where:** `content/unity-engineering/06-unity-lifecycle.md:94`, section `unity-update-time`
- **Touches:** prose only

## What the book says

> If a replay of the same shot has to land in the same place, the shot must be described
> by what was fed into that step, the impulse and the step it was applied on, rather than
> by the positions observed afterward.

## Why it needs changing

Recording the impulse and its step is necessary, and the paragraph is right to prefer it
to recorded positions. It is not sufficient, and the sentence reads as though it were.

Unity's built-in 3D physics is NVIDIA PhysX, and the PhysX guide calls what it offers
“limited determinism”. Identical results need the application to “recreate the scene in
the exact same order each time”, and even then results “can vary between platforms due to
differences in hardware maths precision and differences in how the compiler reorders
instructions during optimization”, including “between optimized and unoptimized builds” on
the same platform (PhysX 5.1 guide, Best Practices, determinism section). Unity's support
article on 2D physics says the same of Box2D: it “can be deterministic on the same
machine, but not across different machines”.

Unity's Physics settings cover part of the gap. The 6.0 manual lists **Enable Enhanced
Determinism** on the GameObject tab: “Simulation in the scene is consistent regardless the
actors present, provided that the game inserts the actors in a deterministic order. This
mode sacrifices some performance to ensure this additional determinism.” It keeps one shot
from depending on unrelated bodies in the scene; it does not make results match across
devices.

Chapter 03 (line 87) and chapter 10 (line 237) both make this point about simulation in
general, so the slingshot is the one place in the book that implies the opposite.
Determinism is a common follow-up in a physics interview, and “record the inputs” is the
half of the answer candidates already give.

## Proposed fix

Add after the sentence:

> Even then, the built-in physics repeats itself only on the same build and platform, with
> the scene assembled in the same order. Enable Enhanced Determinism in the Physics
> settings keeps a shot from depending on unrelated bodies in the scene, at some cost in
> performance, but a replay that must match across devices either records outcomes as
> well or runs a simulation designed to be deterministic.

## Also check

`algorithms-fixed-determinism` (chapter 10) already tests that a fixed timestep alone does
not make a simulation identical across platforms, so the question bank agrees with the
fix.
