# The Info.plist glossary entry says every missing usage description ends the app, which chapter 4 corrects for location

**Kind:** Accuracy. **Priority:** Low. **Touches:** glossary (`glossary.md:262`).

## Location

`content/mobile-platform/glossary.md:262` (Info.plist):

> A missing usage description ends the app the first time it asks for the protected resource, which [[#ios-failure-evidence]] covers.

against `content/mobile-platform/04-os-integration.md:128`:

> […] and iOS is the stricter: an app that asks for the camera or the microphone without its purpose string is ended, and a location request without one does nothing.

## Evidence

Phase 22's teacher's read narrowed chapter 4 on this point, citing `CLLocationManager.h` in the iOS 27.0 SDK (lines 484 to 486), where a location request without `NSLocationWhenInUseUsageDescription` “will do nothing” (`docs/evidence/04-os-integration.md`, “Teacher's read”); the evidence receipt permissions-10 records Apple's capture guide for the termination, scoped to camera and microphone. Chapter 3 is already scoped: “A protected resource, such as the camera, the microphone or the contacts, needs a usage description […] and without one iOS ends the app at the request” (`03-ios-bridge.md:854`). The glossary entry, which a hover card shows from the `[[Info.plist]]` links in chapters 3, 4, 6 and 10, states it for every resource, so a reader who opens the card in chapter 4's permissions section (`04-os-integration.md:168`) reads the opposite of that section's opening.

## Proposed fix

Replace the sentence at `glossary.md:262`:

> A missing usage description ends the app when it asks for a resource such as the camera, the microphone or the contacts, which [[#ios-failure-evidence]] covers, while a location request without one does nothing, as [[#os-permissions]] notes.

## Repeated in

No question states the general rule: `os-usage-description` (`04-os-integration.md:213-243`) and the chapter 3 variant at `03-ios-bridge.md:904-909` are about the camera.
