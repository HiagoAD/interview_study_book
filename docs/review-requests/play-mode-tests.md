# Review request: Play Mode tests

- **First used:** `content/unity-engineering/02-power-up-design.md:343`, section `powerup-test-matrix`
- **Explained in:** `content/unity-engineering/08-testing-and-debugging.md:14`, section `testing-contracts`
- **Now covered by:** the `play-mode-tests` entry, linked at the first mention

## What the reader meets first

> Use Play Mode tests for the Unity adapter, where you can verify subscriptions during
> enable and disable, along with prefab behavior.

Chapter 02 also says its examples are "NUnit-style tests" and that they "demonstrate rule
tests, not a complete Unity test setup", so the section is already distinguishing two
kinds of test without naming the distinction. Chapter 08 names it: Edit Mode against Play
Mode, and what each one establishes.

## Why this needs a decision

Chapter 02 is where the book first argues that the rule layer should be free of engine
types, and the payoff of that argument is precisely that rules can be tested without
entering play mode. The sentence above is the other half, and the reader cannot weigh
either half without knowing what entering play mode costs.

## Options

1. **Leave it.** The entry covers both modes and what running in a player build adds, and
   points at `testing-contracts`.
2. **One clause in chapter 02**: "Play Mode tests, which run with the engine playing, for
   the Unity adapter". Cheap, and it closes the loop with the paragraph two lines above
   about what the rule tests do not cover.
3. **Move the Test Framework paragraph** from chapter 08 to chapter 02, where the first
   tests in the book are written. This would leave chapter 08 to open with the contract
   argument, which is arguably its stronger opening anyway.
