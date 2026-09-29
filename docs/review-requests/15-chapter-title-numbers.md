# Chapters 15 and 16 lack the number every other chapter title carries

**Kind:** Consistency. **Priority:** Low. **Touches:** front matter only (chapter titles); no question block.

## Location

- `content/mobile-platform/15-debugging-across-boundaries.md:3`: `chapter: Debugging across boundaries`
- `content/mobile-platform/16-interview-practice.md:3`: `chapter: Interview practice for platform roles`

## Evidence

Every other chapter of both books starts its title with its number, for instance `content/mobile-platform/14-running-services.md:3`: `chapter: 14: Running game services at scale` (checked with `grep -n '^chapter:' content/*/*.md`). The Book page lists `chapter.title` as written (`src/pages/Book.tsx:26`), so the second book's contents show “13: …”, “14: …”, then two unnumbered titles.

`docs/content-format.md:11` says titles of chapters can change freely: progress is stored by book, section and concept id, so the fix costs no review history.

## Proposed fix

- `chapter: 15: Debugging across boundaries`
- `chapter: 16: Interview practice for platform roles`

## Repeated in

Nothing else.
