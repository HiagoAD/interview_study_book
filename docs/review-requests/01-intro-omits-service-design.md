# Chapter 01's introduction describes the book without its three system design chapters

**Kind:** Consistency. **Priority:** Low. **Touches:** prose only (two paragraphs of `platform-study-method`); no question block.

## Locations

- `content/mobile-platform/01-platform-layer.md:9`: “Behind each of those sit native bridges on Android and iOS, operating-system features, third-party SDKs, two build pipelines, backend clients, and a CI system that builds the result.”
- `content/mobile-platform/01-platform-layer.md:54`: “it goes as deep as an interview for a platform role goes: mechanisms, decisions, and debugging across the boundary, well short of Android or iOS app development.”

## Evidence

The chapter's map of the book otherwise matches the finished 16 chapters: the theme table at lines 42 to 52 lists “System design for game services | 12–14, building on 8 and 9”, and the plain and linked chapter numbers at lines 38, 258 and 476 point at the right sections (`boundary-method`, `android-callbacks`, `ios-callbacks`, `gradle-project`, `release-build-variants` and `boundary-dev-prod` all exist in the chapters named). The two prose paragraphs above predate chapters 12 to 14, though.

- `docs/PLAN.md`, “Decisions: system design”, says Phase 30 “edits chapter 01's prose” only for the chapter numbers (lines 38 and 475 then) and the theme table row. The opening inventory and the depth paragraph were left as Phase 19 wrote them.
- `docs/PLAN.md`, “Feature: second book”, now describes the book as covering “backend clients, the design of the game's own services, CI with Jenkins, and debugging across all of them”, and `docs/mobile-platform-outline.md`, “Scope and reader”, says of chapters 12 to 14 that they “go to a firm middle ground” and “stop where a backend specialist goes further”, a paragraph PLAN.md calls binding.

So the book's first paragraph lists what the layer contains without the game's own services, which three chapters (18 sections) design, and the depth paragraph states the book's limit only against app development, while the design chapters have a different limit that the outline states explicitly. A reader deciding what to study from chapter 01 learns about system design only from one table row.

## Proposed fix

Line 9, second sentence:

> Behind each of those sit native bridges on Android and iOS, operating-system features, third-party SDKs, two build pipelines, backend clients, the game's own services, and a CI system that builds the result.

Line 54, after the last sentence:

> For the game's own services, chapters 12 to 14 go as far as a system design round goes: requirements, estimates, building blocks and their trade-offs, short of a backend specialist's depth.

(The second sentence could link `[[#design-round-method | chapters 12 to 14]]`.) Both sentences need the style guard and the avoid-ai-writing detector.

## Repeated in

Nothing else; the glossary does not describe the book's scope.
