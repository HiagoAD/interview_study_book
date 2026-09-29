# The intent-filter merge variant's correct option is the shortest by 21 characters

**Kind:** Question design. **Priority:** Low. **Touches:** question block, `-` lines only, `content/mobile-platform/05-android-builds.md:170-173`.

## Location

`content/mobile-platform/05-android-builds.md:168-174`, the third variant of `gradle-merge-priority` (“The game's manifest and an SDK's manifest both declare the same activity, each with its own intent filter. What does the merged manifest contain?”):

- `* One activity that holds both intent filters` (43 characters)
- the shortest wrong option, `- A merge error, since two intent filters on one activity conflict` (64); the others are 67, 69 and 71

## Evidence

A script over every single-answer set in chapters 04 to 06 measured how far the correct option falls below the shortest wrong one, and above the longest. This set is the only one in the three chapters with a gap of 10 characters or more either way. The chapter's aggregate figures are within the standard (`npm run guard -- options`: shortest in 22% of 37 sets, medians 70 and 70), but here the one plain statement stands against four options that each carry a reason, so it can be picked by its shape.

The content is right. A run for this read merged a library manifest whose activity has an intent filter into a Unity export's `unityLibrary` manifest that declares the same activity (AGP 8.10.0): the merged manifest had one activity holding the library's filter and the game's attribute.

## Proposed fix

Shorten the wrong options, keeping each one's reason, under `--allow distractors`; no prompt, answer or explanation changes, so no review history is lost:

- `- The game's activity alone, which has priority`
- `- Two activities, which Android rejects at install`
- `- A merge error, since the two filters conflict`
- `- The SDK's activity, which the merge keeps on a match`

## Repeated elsewhere

None.
