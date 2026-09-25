<!-- Template for the evidence run in docs/PLAN.md, “Delegated evidence”. The session replaces each {{…}} and deletes this comment. -->
# Evidence for chapter {{NN}} of The Platform Layer

You gather evidence for a chapter that someone else will write from your results. You do not write the chapter. You check claims and return receipts, and a script verifies every receipt before anyone trusts it: each `quote` is searched for, after whitespace, entity and quote-mark normalization, in the page at its `url`, in the file at its `file` from its `line`, or in the output at its `log`. A quote that is not found counts as a failed receipt. So copy quotes exactly: one contiguous passage, never paraphrased, never two sentences joined across a gap, no ellipses. A quote must state the claim, not just name its subject: a bare setting or API name proves that the name exists and nothing more, so quote the sentence that says what the claim says.

## Where things are

- The site's repo is the working directory, `~/Documents/InterviewWebsite`. The book is `content/mobile-platform/`. Do not read the chapter files; this brief holds what you need. The project's evidence rules are in `docs/PLAN.md` under “Decisions: evidence”.
- Reference version: Unity 6000.3.11f1, installed at `/Applications/Unity/Hub/Editor/6000.3.11f1/` (call it `$E`).
  - iOS Trampoline sources: `$E/PlaybackEngines/iOSSupport/Trampoline/` (`Classes/UnityAppController.mm`, `Classes/UI/UnityScene.mm`, `Classes/PluginBase/`, `Classes/Preprocessor.h`, `Info.plist`).
  - Android: `$E/PlaybackEngines/AndroidPlayer/`: `Tools/GradleTemplates/`, `Variations/il2cpp/Release/Classes/classes.jar`, `OpenJDK/bin/javap` and `javac`, `SDK/platforms/android-NN/android.jar` (use the highest NN present).
  - Managed engine assemblies with their API doc comments beside them: `$E/Unity.app/Contents/Resources/Scripting/Managed/UnityEngine/*.xml` (plus the `.dll`s). The XML files are text with line numbers, so they make good receipts for API existence and wording. `$E/Unity.app/Contents/Resources/Scripting/MonoBleedingEdge/bin/monodis <dll>` prints IL when behavior matters.
  - The iOS SDK's headers, under `$(xcrun --sdk iphoneos --show-sdk-path)/System/Library/Frameworks/`, document behavior in their comments.
- The probe project `~/Documents/PlatformLayerProbe` (Unity 6000.3.11f1) holds generated projects: `Exports/Android-GameActivity` and `Exports/Android-Activity` (Gradle) and `Exports/iOS` and `Exports/iOS-Simulator` (Xcode). Its README lists what else it holds. Read anything there. Write nothing there: the session's runs use it.
- Your scratch folder is `{{SCRATCH}}/codex/`. Put every script, fetched page and log there.

## Rule A: evidence, cheapest first

1. Official documentation, fetched and quoted. Unity: `https://docs.unity3d.com/6000.3/Documentation/Manual/…` and `…/ScriptReference/…`, and packages under `https://docs.unity3d.com/Packages/<package>@<version>/`. Android: `developer.android.com`. Firebase: `firebase.google.com/docs`. Apple: `developer.apple.com`; its documentation pages render in JavaScript, so fetch the JSON at `https://developer.apple.com/tutorials/data/documentation/<path>.json` and cite the human URL `https://developer.apple.com/documentation/<path>`; quote text that appears inside the JSON's text runs. RFCs: `https://www.rfc-editor.org/rfc/rfcNNNN.html`.
   - Fetch with `curl -s -H 'Accept-Language: en-US,en;q=0.9'`, and without `-L` first: the book links only URLs that return 200 with no redirect, so when a URL redirects, cite the final URL instead and check that it returns 200 directly.
   - Pull the sentences you need out with a script (Python or Node). Never print a whole page or a whole file into your context.
2. The Editor's shipped sources and binaries: the Trampoline, the Gradle templates, the generated projects in the probe's `Exports/`, the XML doc comments, IL through `monodis`, `javap -p -c` on `classes.jar`, and the SDK headers.
3. A run, only when 1 and 2 are silent or disagree about something a question's answer would depend on. Your sandbox cannot run Unity, `xcodebuild` or the Simulator: put each run you need in `runs_needed`, with exact commands, and the session batches them. {{RUNS_IN_HAND}}

Code samples will be compiled on their own, not through project builds. Set up the harnesses the chapter needs in `{{SCRATCH}}/codex/harness/` and report each in `harnesses` with a command you ran and its output:
- C#: a scratch project (dotnet 8 is at `/usr/local/share/dotnet`) that compiles `.cs` files against the Unity assemblies the chapter uses, with the platform defines set (such as `UNITY_ANDROID`) and warnings as errors.
- Java: `javac` from the Editor's OpenJDK against `android.jar` and `classes.jar`.
- Objective-C: `xcrun -sdk iphonesimulator clang -fsyntax-only -fobjc-arc` with `-I` for the Trampoline's `Classes` folder, and an include folder in which `UnityFramework` links to `Classes/PluginBase`, since `UnityAppController.h` imports `<UnityFramework/RenderPluginDelegate.h>`.

## Limits

- In the repo, write only `docs/evidence/{{NN}}-{{SLUG}}.md`. Change no other repo file and run no git command that changes anything.
- Never read `~/Library/Developer/Xcode/UserData/Provisioning Profiles`, keychains, or signing files.
- Names: platforms, their stores and their first-party services by name (Android, Google Play, Firebase Cloud Messaging, iOS, the App Store, APNs, Sign in with Apple); third-party SDK vendors by category (“an analytics SDK”); never a game, studio or publisher, in the evidence file or in your answer.
- Versions, API levels, dates and limits: record each with the page or file it came from. The chapter states them only in prose, with that source.
- Aim for 60 to 100 claim entries. Stop when every bullet of the outline below has its entries and the extra questions under it are answered or marked unverified.

## The outline's chapter {{NN}}, verbatim

{{OUTLINE_SECTION}}

## What the writer also needs, section by section

{{EXTRA_QUESTIONS}}

## The evidence file

Write `docs/evidence/{{NN}}-{{SLUG}}.md` in this form, in plain English prose and bullets, with no em dashes and no contractions:

```
# Evidence for chapter {{NN}}: {{TITLE}}

What Phase {{PHASE}} checked the chapter’s claims against, and where the outline was wrong. [PLAN.md](../PLAN.md), under “Decisions: evidence”, says what counts as evidence.

## Checked, and against what

### <section id>
- <claim>: <confirmed | narrowed to … | contradicted: …>. <Source: a full URL, or an Editor path relative to `6000.3.11f1/` with its line, or an export path relative to the probe project.>
(one subsection per section id, in the outline's order)

## Rests on documentation alone
## Narrowed or cut
## Where the outline fell short
## Runs
To be filled in after the runs.
```

Cite durable sources in the file: URLs, Editor paths and export paths. Your scratch logs vanish, so they appear only in your JSON answer.

## Your final answer

Return JSON matching the schema you were given, one entry per claim and source. Paths in `source.file` and `source.log` are absolute. `source.url` is the human URL of the page. For a quote from `javap` or `monodis` output, the source is the `command` and the `log` it wrote, and `evidence_kind` is `shipped file`.
