# Review request: what the site's review queue does

- **Kind:** accuracy, about this site rather than about Unity
- **Priority:** high
- **Where:** `content/unity-engineering/15-interview-practice.md:327`, section `interview-study-loop`
- **Touches:** prose only, unless the site should change instead

## What the book says

> Review a concept the day after you first meet it, then after three days, then after a
> week, then after two. A concept you got wrong restarts the schedule; a concept you got
> right but guessed moves back one step rather than forward. This site's review queue
> implements that pattern, so the practical instruction is to open it before starting new
> material rather than after, since due reviews are worth more than new sections and are
> easier to skip.

## Why it is wrong

The queue does not do what the paragraph says it does (`src/engine/scheduling.ts:47-53`,
and PROJECT.md under Spaced repetition):

- Only a wrong answer enters the queue. A concept answered correctly the first time never
  becomes due, so “the day after you first meet it” happens only for misses.
- There is no guessed answer. A choice question records right or wrong, and nothing moves
  back one step. The only overrule is on short answers, and it moves the other way, from
  wrong to right.
- The intervals are 1, 3, 7, 14 and 30 days, and a correct review in the last box removes
  the concept. The paragraph stops at two weeks.

The consequence is the one that matters in a study book: a reader who trusts this
paragraph leaves lucky guesses alone, expecting the queue to bring them back, and it never
will. Line 323 gives the right instruction (“Revisit correct answers you guessed as
well”), and line 327 then contradicts it.

## Options

1. **Describe the queue as it is (recommended).** For example:

   > This site's review queue implements the first half of that pattern. A concept you
   > answer wrongly comes back after one day, then three, seven, fourteen and thirty for
   > as long as you keep answering it correctly, and a wrong answer sends it back to the
   > start. A concept you answer correctly the first time never enters the queue, and the
   > site cannot tell a guess from knowledge, so practise again the sections whose right
   > answers you guessed. Open the queue before starting new material rather than after,
   > since due reviews are worth more than new sections and are easier to skip.

2. **Change the site so the paragraph becomes true.** Queuing every first answer, or
   offering a “guessed” choice after a right one, changes the Spaced repetition section of
   PROJECT.md and `applyAnswer`. That is a product decision for the plan, not an editing
   pass.
