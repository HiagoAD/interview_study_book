# Evidence for chapter 11: CI/CD and Jenkins for Unity mobile builds

What Phase 29 checked the chapter’s claims against, and where the outline was wrong. [PLAN.md](../PLAN.md), under “Decisions: evidence”, says what counts as evidence. Phase 29 ran in a cloud container, without Codex, the Unity Editor, the probe project, Xcode, macOS or a device, so the session gathered the evidence itself under rule A of the brief, on 2026-09-25. The container could not reach jenkins.io, Jenkins’s update and download sites, docs.unity3d.com, Unity’s package registry, docs.gradle.org, git-scm.com, git-lfs.com, guides.cocoapods.org, developers.google.com or support.apple.com. The sources of Jenkins’s pages (the jenkins-infra/jenkins.io repository) and of its plugins (the jenkinsci repositories, at master) stand in for jenkins.io; Unity’s C# reference source at the tag `6000.3.11f1` stands in for the Editor’s assemblies; a mirror of the Test Framework package at version 1.4.6 stands in for its documentation and runner; Apple’s open-source `security` man page stands in for the tool’s manual; and Google’s discovery document for the Play Developer API stands in for its reference. The receipts, 139 of them, all passed `check_receipts.py`. Everything that needs the unreachable hosts or a Mac is listed under “To check on the Mac”.

## Checked, and against what

### ci-pipeline-shape

- A project records the Editor version it was saved with in `ProjectSettings/ProjectVersion.txt`, as `m_EditorVersion`: confirmed in a Unity sample project’s file, [ProjectVersion.txt](https://raw.githubusercontent.com/Unity-Technologies/BoatAttack/master/ProjectSettings/ProjectVersion.txt), which is from 2020.3; the probe’s file on the Mac settles 6000.3.
- The Test Framework’s command line: `-runTests`, `-testPlatform` (Edit Mode when omitted), `-testResults`, with `-batchmode` to remove the need for input, and results in NUnit’s XML format: confirmed. [reference-command-line.md](https://raw.githubusercontent.com/needle-mirror/com.unity.test-framework/master/Documentation~/reference-command-line.md), version 1.4.6. Its example has no `-quit`.
- The runner’s return codes, 0 for a pass, 2 for failed tests, 3 for a run error such as scripts that did not compile, and 0 for a run that executed no test: confirmed in [Executer.cs](https://raw.githubusercontent.com/needle-mirror/com.unity.test-framework/master/UnityEditor.TestRunner/CommandLineTest/Executer.cs) at 1.4.6. Unity 6.3 ships 1.6 inside the Editor, so the chapter states the codes as read in 1.4.6, and no correct answer depends on them.
- NUnit’s `test-run` element carries `total`, the number of test cases executed: confirmed in NUnit’s [result format](https://raw.githubusercontent.com/nunit/docs/master/docs/articles/nunit/technical-notes/usage/Test-Result-XML-Format.md).
- `BuildPipeline.BuildPlayer(BuildPlayerOptions)` returns a `BuildReport`; it throws before building for an invalid output path or when a build is in progress, returns null after logging an `ArgumentException` from the build, and logs any other exception and calls `EditorApplication.Exit(1)`; it derives the target group from the target when it is unset: confirmed in [BuildPipeline.bindings.cs](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/6000.3.11f1/Editor/Mono/BuildPipeline.bindings.cs), lines 296 to 425. `BuildOptions.StrictMode`, “Force the build to fail when any errors are encountered”, line 105.
- The build script’s API: `EditorApplication.Exit(int)`, `BuildSummary.result` and `BuildResult.Succeeded`, `EditorBuildSettingsScene.GetActiveSceneList` and `EditorBuildSettings.scenes`, `PlayerSettings.SetScriptingDefineSymbols(NamedBuildTarget, string)`, `NamedBuildTarget.Android` and `.iOS`, `PlayerSettings.bundleVersion`, `PlayerSettings.Android.bundleVersionCode` (an `int`), `PlayerSettings.iOS.buildNumber` (a `string`) and `EditorUserBuildSettings.buildAppBundle`: confirmed in the reference source at `6000.3.11f1`, files named in the receipts.
- The Android symbols setting is now `UnityEditor.Android.UserBuildSettings.DebugSymbols.level`: narrowed to its name, from the obsolete message on `EditorUserBuildSettings.androidCreateSymbols`.
- `xcode-select -switch` chooses the default Xcode for the command-line tools, and `--print-path` shows it: confirmed in [TN2339](https://developer.apple.com/library/archive/technotes/tn2339/_index.html).

### ci-jenkins-pipeline

- Controller, label, executor, node and workspace: confirmed in Jenkins’s [glossary source](https://raw.githubusercontent.com/jenkins-infra/jenkins.io/master/content/doc/book/glossary/index.adoc). Builds on the built-in node have the controller’s file access, and Jenkins advises agents instead: [controller-isolation.adoc](https://raw.githubusercontent.com/jenkins-infra/jenkins.io/master/content/doc/book/security/controller-isolation.adoc).
- The declarative syntax used by the chapter’s Jenkinsfile: `agent` with a label or a label expression, `agent none`, `parameters`, `options` (`buildDiscarder`, `disableConcurrentBuilds` with its queueing and `abortPrevious`, `timeout`), `environment`, `when` with `beforeAgent`, `parallel`, sequential `stages` inside a parallel branch, one of `steps`, `stages`, `parallel` or `matrix` per stage, `post` and the order and meaning of its conditions, and `input`: confirmed in [syntax.adoc](https://raw.githubusercontent.com/jenkins-infra/jenkins.io/master/content/doc/book/pipeline/syntax.adoc).
- `stash` keeps files for the same run only, is discarded at its end, is meant for small files with no hard limit but alternatives advised from somewhere between 5 and 100 MB, and costs the controller CPU because it is a compressed archive: confirmed in the step’s [help](https://raw.githubusercontent.com/jenkinsci/workflow-basic-steps-plugin/master/src/main/resources/org/jenkinsci/plugins/workflow/support/steps/stash/StashStep/help.html). `unstash` brings a stash from the controller into the workspace: [jenkinsfile.adoc](https://raw.githubusercontent.com/jenkins-infra/jenkins.io/master/content/doc/book/pipeline/jenkinsfile.adoc).
- `archiveArtifacts` saves files on the controller, keeps them as long as the build’s log, and fails the build when it archives nothing unless `allowEmptyArchive` is set: confirmed in core’s help files.
- `junit` reads JUnit XML and fails on no report files or no results unless `allowEmptyResults` is set: confirmed in the plugin’s [messages](https://raw.githubusercontent.com/jenkinsci/junit-plugin/master/src/main/resources/hudson/tasks/junit/Messages.properties) and `JUnitResultArchiver.java`. The NUnit plugin’s `nunit` step publishes NUnit results, and its `failIfNoResults`, on by default, aborts on no files and fails the build when the reports hold no result: [NUnitPublisher.java](https://raw.githubusercontent.com/jenkinsci/nunit-plugin/master/src/main/java/hudson/plugins/nunit/NUnitPublisher.java).
- `timeout` aborts the build when its limit passes; `retry` reruns its block on any exception and does not catch a user’s abort: the steps’ help files. Multibranch pipelines, shared libraries and scripted pipelines: their pages’ sources. The declarative linter exists: [development.adoc](https://raw.githubusercontent.com/jenkins-infra/jenkins.io/master/content/doc/book/pipeline/development.adoc).

### ci-secrets-signing

- `withCredentials` binds each credential to an environment variable inside its block; single quotes leave the expansion to the shell, and Groovy interpolation exposes the value to process listings; printed secrets are masked; masking can be circumvented by anyone who can edit the pipeline, and mangled forms are masked on a best-effort basis for common shells; build tools in debug mode may print the environment; on Linux, other processes of the account can read it: confirmed in the step’s [help](https://raw.githubusercontent.com/jenkinsci/credentials-binding-plugin/master/src/main/resources/org/jenkinsci/plugins/credentialsbinding/impl/BindingStep/help.html).
- A transformed secret is not masked: confirmed. The [blog post](https://raw.githubusercontent.com/jenkins-infra/jenkins.io/master/content/blog/2019/02/2019-02-21-credentials-masking.adoc) prints a password through `base64`, and `jenkinsfile.adoc` says that a mangled credential is no longer masked.
- A secret file is written to a private temporary directory, deleted when the block ends: [AbstractOnDiskBinding.java](https://raw.githubusercontent.com/jenkinsci/credentials-binding-plugin/master/src/main/java/org/jenkinsci/plugins/credentialsbinding/impl/AbstractOnDiskBinding.java). The `credentials()` helper and its `_USR` and `_PSW` variables: `syntax.adoc`.
- `PlayerSettings.Android.useCustomKeystore`, `keystoreName`, `keystorePass`, `keyaliasName` and `keyaliasPass`: confirmed in [PlayerSettingsAndroid.bindings.cs](https://raw.githubusercontent.com/Unity-Technologies/UnityCsReference/6000.3.11f1/Editor/Mono/PlayerSettingsAndroid.bindings.cs), lines 624 to 680.
- The temporary keychain’s commands, `create-keychain` (its `-p` called insecure), `set-keychain-settings -lut`, `unlock-keychain`, `import` with `-k`, `-P` (a GUI prompt without it) and `-T`, `set-key-partition-list` (codesign needs `apple:` in the list, and the keychain’s password is required), `list-keychains -s` and `delete-keychain` (which also removes it from the search list): confirmed in Apple’s [security.1](https://raw.githubusercontent.com/apple-oss-distributions/Security/main/SecurityTool/macOS/security.1). No command was run.
- Xcode 16 keeps downloaded profiles in `~/Library/Developer/Xcode/UserData/Provisioning Profiles`: confirmed in the [Xcode 16 release notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-16-release-notes). App Store Connect API keys carry a role, team keys reach all apps, and a compromised key is revoked: [Apple’s page](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api).

### ci-caching

- CocoaPods caches downloads in `~/Library/Caches/CocoaPods` unless `CP_CACHE_DIR` moves it: confirmed in [config.rb](https://raw.githubusercontent.com/CocoaPods/CocoaPods/master/lib/cocoapods/config.rb).
- Jenkins leaves workspaces in place after a build unless a cleanup policy removes them: the glossary.
- Unity’s `Library` folder, the Unity Accelerator and IL2CPP’s cache: not checked, see below.

### ci-only-failures

- Git LFS keeps a pointer file under 1024 bytes, starting with its spec’s version line, in place of the file: confirmed in the [spec](https://raw.githubusercontent.com/git-lfs/git-lfs/main/docs/spec.md). Jenkins’s Git plugin pulls LFS files after checkout when asked to, and each agent needs `git lfs`: the behavior’s [help](https://raw.githubusercontent.com/jenkinsci/git-plugin/master/src/main/resources/hudson/plugins/git/extensions/impl/GitLFSPull/help.html).
- Git stores a file’s executable bit: narrowed to the LFS spec’s requirement that pointer files keep it.
- `deleteDir` deletes the current directory: its help.

### ci-release-automation

- Google Play refuses a `versionCode` used before, it usually increases with each release, and its maximum was 2100000000 when read: confirmed on [Android’s versioning page](https://developer.android.com/studio/publish/versioning).
- App Store Connect identifies a build by its build string, `CFBundleVersion` is required by the App Store, a submission selects one of the uploaded builds, and each version has one build: confirmed on Apple’s [upload](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds) and [build selection](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit) pages and the [CFBundleVersion](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion) reference.
- The Play Developer API: an edit, a bundle uploaded to it, a track updated, the edit committed; a release lists the version codes of bundles already uploaded; deobfuscation files, ProGuard mappings or native debugging symbols, are uploaded for a version: confirmed in Google’s [discovery document](https://raw.githubusercontent.com/googleapis/google-api-go-client/main/androidpublisher/v3/androidpublisher-api.json).
- `BUILD_NUMBER` and `BUILD_URL`: the environment list in `jenkinsfile.adoc`.

## Rests on documentation alone

- Everything about Jenkins rests on its documentation and its plugins’ sources at master, read in September 2026; no Jenkins ran, and the Jenkinsfile was checked against the syntax reference.
- The keychain steps rest on the `security` manual. Nothing ran on a Mac.
- The stores’ rules rest on Google’s and Apple’s pages and Google’s API description.
- Building once, clean release candidates, cache keys, reproducing a failure in a clean clone, and the table of failures and first checks are design reasoning that the chapter shows, not facts about a platform.

## Narrowed or cut

- **The Editor’s command-line arguments.** The chapter names `-batchmode`, `-nographics`, `-quit`, `-projectPath`, `-buildTarget`, `-executeMethod` and `-logFile` with a short purpose each, and no question turns on a flag’s exact behavior. The page was not reachable.
- **Unity’s license, the package lock file, `Library` and the Unity Accelerator.** Stated in a sentence each, as what a pipeline handles, with no mechanism and no question turning on them.
- **IL2CPP’s build cache.** The outline asked for its location, which no reachable source states; the chapter does not give one.
- **Gradle’s caches and daemon.** Gradle’s pages were not reachable; the chapter says only that Gradle’s downloads and daemon live on the agent between builds, and names them in the caching section without a path.
- **The Test Framework’s exit codes** are stated as read in version 1.4.6.
- **Case-sensitive file systems.** Stated as a difference between agents, without a claim about any operating system’s default.

## Where the outline fell short

- **Unity’s results are NUnit XML.** The outline named Jenkins’s `junit` step, which reads JUnit XML. The chapter publishes Unity’s results with the NUnit plugin’s `nunit` step, whose default fails a build with no files or no results.
- **Zero tests exit with 0.** In the Test Framework’s runner, a run that executed no test returns the success code, which makes the first book’s “zero tests is not a pass” a check the pipeline has to make itself.
- **`BuildPlayer` fails in three ways.** It returns a report, returns null, or throws, and exits the Editor itself on an unexpected exception. The build script handles all three.
- **No `-quit` for tests.** The Test Framework’s runner ends the Editor itself, and its example omits `-quit`.
- **A `versionCode` from a timestamp overflows.** Google Play’s maximum, 2100000000 when read, is smaller than any ten-digit `yyMMddHHmm` stamp from 2021 on, so the chapter derives build numbers from a counter.
- **Handing the project between agents.** Chapter 6 promised it. `stash` is meant for small files, so the chapter hands over only the build’s stamp, keeps the Unity export and the archive on one Mac, and names an artifact repository for large handovers.

## Runs

To be filled in after the chapter’s samples are compiled.

## To check on the Mac

- **Unity’s manual, 6000.3** (docs.unity3d.com was blocked): the [command-line arguments](https://docs.unity3d.com/6000.3/Documentation/Manual/EditorCommandLineArguments.html) the chapter names; the package lock file; activating and returning a license from the command line; `Library` as derived data and the Unity Accelerator. Settled by fetching the pages.
- **The Test Framework 1.6 runner** in the Editor’s built-in package: whether a run that executed no test still returns 0. Settled by the grep in the receipts’ `runs_needed`.
- **The probe’s `ProjectVersion.txt`**, for the 6000.3 format, and the Hub’s default install folder, which the chapter’s `unity.sh` assumes.
- **The keychain script**, run on a throwaway keychain with a self-signed identity: that `codesign` signs without a prompt after `set-key-partition-list -S apple-tool:,apple:`, that `list-keychains -s` with the old list appended keeps the login keychain, that a profile copied into the Xcode 16 folder is found by `-exportArchive`, and that the cleanup script leaves nothing behind.
- **Android symbols**: where 6000.3 writes the symbols zip and R8’s mapping file when Unity runs Gradle itself, since the Jenkinsfile archives `build/*.symbols.zip`.
- **The C# build script** against 6000.3’s assemblies, with `UNITY_ANDROID` and `UNITY_IOS` defined and warnings as errors, in the brief’s C# harness.
- **The Jenkinsfile** through Jenkins’s declarative linter, since no Jenkins could be downloaded here.
- **IL2CPP’s cache**: where the probe’s `Library` keeps IL2CPP’s output after a build, if the chapter is to name it.
- **The links the container could not fetch**, for `npm run guard -- links`, listed after the chapter is written.
- **The no-brand search**, run when the branch is merged.
