# Review request: cross-references, placement, and naming

- **Kind:** consistency
- **Priority:** medium for the first item, low for the rest
- **Where:** seven places, listed below
- **Touches:** prose, and one glossary heading

1. **A wrong pointer.** `08-testing-and-debugging.md:78`: “For the slingshot launch of the
   previous chapter”. The slingshot is in chapter 6 (`unity-update-time`, line 94, with
   the `Launch` method and `ProjectileDefinition` catalog that follow it). Chapter 7, the
   previous one, is set in a level-based puzzle. It is almost certainly a leftover from
   the genre revision. Write “of chapter 6”.
2. **Exercises in the middle of a section.** `02-power-up-design.md:208` and `:210`: in
   `powerup-stacking`, the `Exercise:` and `Design exercise:` lines are followed by four
   more paragraphs and the modifier-pipeline code block. It is the only section in the
   book whose closing device does not close it; a script checked the other 79. Move both
   lines to the end, before the first `??`.
3. **A vague pointer.** `04-csharp-fundamentals.md:328`: “in the same way the later
   chapter treats newer collection APIs”. That is chapter 9, line 182; name it. (If
   [unity-api-names.md](unity-api-names.md) adds the `PriorityQueue` fact there, the
   pointer gains something to point at.)
4. **A chapter number in words.** `03-missions-and-rewards.md:268`: “as chapter one
   suggests”. The book writes chapter numbers as digits everywhere else (“chapters 1 to
   3”, the table in chapter 15).
5. **Hyphen and en dash.** `10-game-algorithms.md:195` writes “Fisher-Yates”; lines 152,
   178 and 201 write “Fisher–Yates”.
6. **A product name.** `08-testing-and-debugging.md:220`: “Android smoke on Pixel 6a”. The
   book names no commercial product anywhere else, and chapter 11 (line 20) deliberately
   writes “on device X”. “on a mid-range Android device” keeps the example concrete.
7. **A glossary heading narrower than its entry.** `glossary.md:166`: the entry is headed
   “Play Mode tests” and lists “Edit Mode tests” among its other names, so the glossary
   filter shows one kind of test under the other's name. Heading it “Edit Mode and Play
   Mode tests” reads correctly, and keeps the id `play-mode-tests`, so every link still
   resolves.
