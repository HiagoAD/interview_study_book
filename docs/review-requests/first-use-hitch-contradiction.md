# Review request: the first check for a first-use hitch

- **Kind:** question design; the prose and a question disagree
- **Priority:** medium
- **Where:** `content/unity-engineering/08-testing-and-debugging.md:175` and `:178`, against the question at `:192`, section `debugging-unity-scenarios`
- **Touches:** one `-` line, or prose

## The disagreement

The table in the section gives the fastest first check for this symptom:

> | It hitches on first use only | Does a second use also hitch? |

and line 178 explains why that observation comes first.

The question in the same section asks:

> Which first step best investigates a one-time effect hitch?

and marks this option wrong:

> - Trigger the effect twice at startup and measure the second occurrence.

A reader who has just read the table chooses it, and is told they are wrong by the section
they followed. The question predates the table: its correct option (“Measure loading,
creation, shader preparation, and allocation phases separately.”) matches line 160, which
was the section's only advice on the symptom when the question was written.

The two can be reconciled, since the prompt says the hitch is already known to be
one-time, which is what the table's check would establish. Nothing in the option set says
so, though, and the distractor reads as the table's own check.

## Options

1. **Replace the distractor (recommended).** One `-` line, a questions-pass change, with
   the rest of the variant byte-identical. The set already has “Warm the effect during the
   loading screen and check whether the hitch moves.”, so choose a different wrong move,
   for example:
   `- Profile the effect's first use in the Editor, where the capture is easiest to take.`
   It is wrong on chapter 11's terms (line 94), and it contains none of the words the
   distractor standard screens for.
2. **Reframe the table row** as confirming the premise before the breakdown, for example
   “Is it really first use only? Check a second use, then break down the first.” That
   leaves the distractor as it is, and wrong for a reader who reads the prompt closely,
   which is a weaker fix than option 1.
