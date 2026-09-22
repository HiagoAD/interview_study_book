# Review request: worked numbers that do not add up

- **Kind:** accuracy
- **Priority:** medium; each item is a one-line fix
- **Touches:** prose only

Four worked examples, each in a section whose point is that the arithmetic can be trusted.
Every figure below was recomputed from the section's own numbers.

## 2. Payback time for a tool

`14-collaboration.md:71`, section `collaboration-tools`:

> A tool that reduces it to 5 minutes saves 3 hours weekly, so 2 days of engineering pays
> for itself in about three weeks and continues afterward.

Two days is about 16 hours; at 3 hours saved a week, that is between five and six weeks.
The paragraph is about making the case in the same units, so the units have to work.
Either “1 day of engineering pays for itself in about three weeks” or “2 days of
engineering pays for itself in under six weeks”.

## 3. The budget menu does not meet its own budget

`14-collaboration.md:97` and `:113-118`, section `collaboration-art-budgets`. The effect
costs 4 ms against 1 ms available, so it must shed 3 ms. The menu's options save 1.6, 1.2
and 2.4 ms, none of them meets the target alone, and the text never says that options
combine. The last row says keeping the effect “drops to about 40 FPS”, but 3 ms over a
16.67 ms frame is about 19.7 ms, roughly 51 FPS, or 30 on a display that holds strict
vsync; 40 FPS would need a 25 ms frame.

Fix the numbers or the framing: give at least one option, or a combination the table
names, a saving of 3 ms or more, and write the last row as “The hazard sequence drops to
about 50 FPS, or to 30 where the display holds vsync”. The paragraph after the table then
describes a real choice.

## 4. The one-page note has eleven lines

`15-interview-practice.md:44`: “Twelve lines, and most interview questions about that
project land on one of them.” The form above it (lines 31 to 41) has eleven: System,
Context, My role, Constraints, Sketch, Traced op, Hard failure, Alternative, Validation,
Result, Would change. Change the word, or add the twelfth line the form is arguably
missing: a `Metric:` line would suit the section's own advice on numbers you can support.
