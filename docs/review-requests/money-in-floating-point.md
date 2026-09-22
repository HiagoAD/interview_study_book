# Review request: double for time, integers for money

- **Kind:** accuracy, with a Unity name the paragraph needs
- **Priority:** medium
- **Where:** `content/unity-engineering/02-power-up-design.md:164`, section `powerup-expiration`
- **Touches:** prose only

## What the book says

> Use `float` for positions and velocities, where its range and cost fit; prefer `double`
> for accumulated time and for money-like quantities you compare exactly.

## Why it needs changing

The first half is right, and so is the arithmetic before it: the spacing between `float`
values is 2⁻¹² s (about 0.00024) near 3,600 and 2⁻⁸ s (about 0.004) near 36,000.

The second half is the classic mistake. No binary floating-point type represents most
decimal amounts exactly, 0.1 included, so a `double` balance compared exactly is the
defect rather than the fix. The book already knows this elsewhere: `CollectResult` holds
`long Balance` and `int Awarded` (chapter 02, line 283), chapter 04 says coins “are
discrete quantities and suit integer units” (line 356), and its `TryGrant` works on
`long`. A reader who repeats this sentence in an interview will be corrected.

The paragraph also recommends `double` for time without saying that Unity's own clock is a
`float`. `Time.time`, `Time.deltaTime` and `Time.unscaledTime` are all `float`, so a
reader who follows the advice by writing `double now = Time.time;` keeps the precision
problem the paragraph describes. Unity provides `Time.timeAsDouble`,
`Time.unscaledTimeAsDouble` and `Time.realtimeSinceStartupAsDouble`, present in the
installed 2022.3 and 6000.3 Editors and so in the 6.0 baseline, and those are what the
model's caller should pass.

## Proposed fix

> Use `float` for positions and velocities, where its range and cost fit, and `double` for
> accumulated time. Unity's own `Time.time` is a `float`, so read `Time.timeAsDouble` when
> a clock value will be compared against a deadline late in a session. Keep money in
> integers of its smallest unit, as the wallet in this book does, because no binary
> floating-point type represents most decimal amounts exactly, and an exact comparison is
> then the defect.

## Also check

- [unity-api-names.md](unity-api-names.md) adds the same members to the time-domain table
  in chapter 06.
