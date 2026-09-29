# A dyld distractor may be a correct check for a missing system framework (unverified)

**Kind:** Question design. **Priority:** Low. **Touches:** question block, one `-` line (line 191).

**Status: partly unverified.** The documentation quoted below covers only embedded frameworks; what would settle it is a run, or an Apple page, showing the dyld report for a system framework that the device's iOS version lacks.

## Location

`content/mobile-platform/15-debugging-across-boundaries.md:186-192`, concept `boundary-platform-mechanisms`:

```text
?? boundary-platform-mechanisms An iOS launch report names `dyld` and a missing framework. Which check fits that evidence?
* Inspect the framework's embedding and dependencies in the built app
...
- Compare the app's minimum iOS version with the framework's requirement
```

## Evidence

Apple's page on this crash (https://developer.apple.com/tutorials/data/documentation/xcode/addressing-missing-framework-crashes.json, fetched September 29, 2026) is about an app's own frameworks: “If an app links a framework but doesn't embed it, the app crashes at launch, because the dynamic linker can't locate the missing framework.” That supports the correct option.

The prompt does not say whose framework is missing. The book's own glossary entry for Dynamic linker (`content/mobile-platform/glossary.md:192`) says “a missing framework or an unavailable imported symbol can stop an app before its game code runs”, and a system framework that is newer than the device's iOS, linked strongly by an SDK while the app's deployment target is older, fails the same way at launch. For that case, comparing the minimum iOS version with the framework's requirement is the right check, so the distractor is arguably correct. Chapter 15's own Android table makes the same distinction (line 511, native APIs unavailable on older OS versions).

## Proposed fix

Replace line 191 (a distractors pass) with an option that no reading of the prompt makes right:

`- Compare the app's push entitlement with the environment of its token`

Or, with the user's consent, narrow the prompt to the app's own framework: “An iOS launch report names `dyld` and one of the app's own frameworks as missing.” That edits a prompt and needs the decision the README describes; the variant's history is kept.

## Repeated in

Line 132's table row names the dynamic linker message without saying whose framework; it can stay.
