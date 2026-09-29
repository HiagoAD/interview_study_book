# Chapter 7 says R8, stripping and signing act only in a release-configured build

**Kind:** Accuracy (and Consistency with chapter 10) · **Priority:** Medium · **Touches:** prose (one clause)

## Location

- `content/mobile-platform/07-sdk-integration.md:659`, step 4 of the upgrade procedure in `sdk-upgrades`:
  “a smoke test of a release-configured build on a device, since [[R8]], [[stripping]] and signing act only there.”

## Evidence

Only one of the three differs by build configuration. Chapter 10 of this book establishes the other two, from its own Unity 6.3 test exports:

- `content/mobile-platform/10-variants-and-releases.md:45`: “The scripting backend, the managed code stripping level, IL2CPP's code generation … are Player settings, which both builds share … Android signing is shared too. In the exported Gradle project, the `debug` and `release` build types both signed with the debug key when no keystore was set and with the upload key when one was.”
- The committed true-or-false variant at `10-variants-and-releases.md:80` (“Turning on Development Build also lowers the managed stripping level …”) is false, and its explanation (line 82) says the stripping level is shared between development and release builds.
- Unity's manual (https://docs.unity3d.com/6000.3/Documentation/Manual/managed-code-stripping-configure.html) makes the level a Player setting, with no mention of development builds: “Minimal … This is the default setting if you use the IL2CPP scripting backend.”

So managed stripping runs in every IL2CPP player build, development builds included, and signing is the same in both Gradle build types. R8 is the one item that depends on the configuration: Unity's Minify switches are separate for Release and Debug. A reader who takes chapter 7's clause at face value learns the misconception that chapter 10's question is written to catch, and that the Editor is the only place stripping is missing. The step's advice (smoke-test a release-configured build on a device) is still right, but the reason given is wrong.

## Proposed fix

Replace the clause with:

“… and a smoke test of a release-configured build on a device, since the Editor neither strips nor runs [[IL2CPP]], and [[R8]] runs only where the release build's minify switch turns it on ([[#release-build-variants]]).”

## Repeated elsewhere

No question or glossary entry repeats the clause. The `stripping` glossary entry (glossary.md:314 to 319) is consistent with chapter 10.
