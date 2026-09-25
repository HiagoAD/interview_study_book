---
book: unity-mobile-platform-engineering
chapter: 11: CI/CD and Jenkins for Unity mobile builds
---

## The shape of a mobile pipeline {#ci-pipeline-shape}

Continuous integration, CI, builds and tests every change on machines that nobody works on, and continuous delivery, CD, carries the builds it makes toward the stores. For a Unity mobile game, one change goes through Unity, then through Gradle for Android ([[#gradle-project]]) and Xcode for iOS, which runs only on macOS ([[#xcode-build-flow]]). A pipeline is the ordered list of those steps, written down so that a machine repeats them, and the machines that run them are called agents. What a developer checks by eye, a message that says the build succeeded or a file in a folder, a pipeline checks in code, because nobody watches it.

A pipeline for a Unity mobile game has these stages. Each one leaves evidence that it did its work, and the stage fails when the evidence is missing:

| Stage | What it does | Evidence it leaves |
| --- | --- | --- |
| Checkout | Fetches the commit, with the files that [[Git LFS]] keeps outside the repository | The commit hash in the log, and real files where the repository holds pointers |
| Toolchain | Selects the Unity version that `ProjectSettings/ProjectVersion.txt` names, the JDK, SDK and NDK installed with it, the Xcode version and the CocoaPods version | Each tool's version, printed in the log |
| License | Activates Unity on the agent | The activation's result in the log |
| Dependencies | Resolves Unity's packages, whose versions `Packages/packages-lock.json` records, and the native dependencies through [[EDM4U]] | Lock files that the resolution left unchanged |
| Tests | Runs [[Edit Mode tests]], and Play Mode tests in the Editor or in a player, with a results file | A results file from this run that counts at least one test |
| Unity build | Runs Unity in batch mode, with a build script that sets the version, the signing and the scripting defines | The exit code, the build report's result, and the output at its path |
| Native build | Runs Gradle inside Unity's Android build, or archives the exported Xcode project | The [[AAB]], or the `.xcarchive` |
| Signing | Signs the app for the channel it goes to | The certificate that signed it, printed |
| Artifacts | Archives the AAB or IPA, the [[dSYM]] files, Android's symbols and R8's mapping file, the logs and the merged manifest | The archived files, named with the build number |
| Distribution | Uploads a release candidate to a test track: Google Play's internal testing track, or [[TestFlight]] | The store's acceptance of the upload |
| Notification | Tells the team the result, with a link to the build | The message |

Unity runs in batch mode, with no window and no dialog waiting for someone to answer it. A small script runs the Editor that the project names, so that every stage starts Unity the same way:

```bash
#!/bin/bash
# ci/unity.sh <log name> <arguments>: runs the Editor that the project names, in batch mode.
set -euo pipefail
version=$(sed -n 's/^m_EditorVersion: //p' ProjectSettings/ProjectVersion.txt)
unity="/Applications/Unity/Hub/Editor/$version/Unity.app/Contents/MacOS/Unity"
if [ ! -x "$unity" ]; then
  echo "Unity $version is not installed on this agent" >&2
  exit 1
fi
if [ -f stamp.env ]; then
  . ./stamp.env    # the build's version and number, from the Prepare stage
fi
log="logs/$1.log"
shift
mkdir -p logs
"$unity" -batchmode -nographics -projectPath "$PWD" -logFile "$log" "$@"
```

`-batchmode` runs the Editor without its window and without prompts, `-nographics` without a graphics device, which an agent may not have, `-projectPath` names the project, and `-logFile` writes the Editor's log to a file that the pipeline keeps. A build adds three more: `-quit` closes the Editor once the other arguments have run, `-buildTarget` selects the platform before the project loads, and `-executeMethod` calls a static method of an Editor script. The script assumes macOS agents with the Hub's default install folder; on another operating system only the path changes.

```bash
ci/unity.sh build-android -quit -buildTarget Android -executeMethod Game.Pipeline.CiBuild.Android
```

The method does what a developer does by hand before a build, from values that the pipeline passes in environment variables:

```csharp
// Assets/Editor/CiBuild.cs
using System;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Game.Pipeline
{
    public static partial class CiBuild
    {
        public static void Android() => Run(() =>
        {
            ApplyStamp(NamedBuildTarget.Android);
            ApplyAndroidSigning();
            EditorUserBuildSettings.buildAppBundle = true;
            BuildPlayer(BuildTarget.Android, "build/Game.aab");
        });

        public static void IOS() => Run(() =>
        {
            ApplyStamp(NamedBuildTarget.iOS);
            BuildPlayer(BuildTarget.iOS, "build/xcode");
        });

        // The pipeline decides the version, the build number and the environment.
        static void ApplyStamp(NamedBuildTarget target)
        {
            PlayerSettings.bundleVersion = Env("GAME_VERSION");
            int buildNumber = int.Parse(Env("GAME_BUILD_NUMBER"));
            PlayerSettings.Android.bundleVersionCode = buildNumber;
            PlayerSettings.iOS.buildNumber = buildNumber.ToString();
            PlayerSettings.SetScriptingDefineSymbols(target, "GAME_ENV_" + Env("GAME_ENVIRONMENT").ToUpperInvariant());
        }

        static void BuildPlayer(BuildTarget target, string path)
        {
            BuildOptions options = BuildOptions.StrictMode;
            if (Env("BUILD_TYPE") == "development")
            {
                options |= BuildOptions.Development;
            }

            BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = EditorBuildSettingsScene.GetActiveSceneList(EditorBuildSettings.scenes),
                locationPathName = path,
                target = target,
                options = options,
            });
            if (report == null || report.summary.result != BuildResult.Succeeded)
            {
                Debug.LogError("Build failed: " + (report == null ? "no report" : report.summary.result.ToString()));
                EditorApplication.Exit(1);
            }
        }

        // Whatever goes wrong, the Editor ends with a failing exit code.
        static void Run(Action build)
        {
            try
            {
                build();
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                EditorApplication.Exit(1);
            }
        }

        static string Env(string name) =>
            Environment.GetEnvironmentVariable(name)
            ?? throw new InvalidOperationException(name + " is not set");
    }
}
```

Every value the build depends on comes from the pipeline, and a missing one stops the build rather than letting it fall back on whatever the project's settings hold. `BuildPipeline.BuildPlayer` fails in three ways, which Unity's reference source for 6000.3 shows. It reports most failures in the result of the `BuildReport` it returns. It returns null after logging some errors that arise during the build. And it throws for others before it starts, such as an output path that the target does not accept, or another build already in progress. The script treats all three as failures and ends the Editor with `EditorApplication.Exit(1)`, as Unity's own code does when an exception it does not expect reaches it. `BuildOptions.StrictMode` fails the build on any error, and the scripting define names the environment, staging or production, which chapter 10 covers.

Chapter 8 of the first book, The Game Layer, “Testing and debugging production behavior”, asked two questions before a green run counts: did the intended tests run, and what do they cover? A pipeline asks the first one of every stage, since zero tests is not a pass. An exit code of 0 says that a process ended without reporting a failure, and a stage has done its work only when its artifact exists and its log shows how it was made. The test stage shows why:

```bash
rm -rf results
ci/unity.sh editmode -runTests -testPlatform EditMode -testResults results/editmode.xml
```

The Test Framework's runner ends the Editor itself when the run is over, so the command has no `-quit`, and the runner sets the exit code. In its source, as read at version 1.4.6 (Unity 6.3 ships 1.6 inside the Editor), a run with a failed test returns 2, a run that could not start, for example because the scripts did not compile, returns 3, and a run that completes without executing any test returns 0, like a run that passed. A filter that matches nothing ends that way, and so does a test assembly that the platform leaves out. The results file follows NUnit's XML format, and its `test-run` element's `total` attribute counts the test cases executed, so the stage checks that it is above zero; the next section shows the Jenkins step that does. The `rm -rf` matters because an agent keeps its workspace between builds, and a stage that reads an old results file reports an old run.

The toolchain is an input of the build, like the code. `ProjectVersion.txt` names the Editor version that the project was saved with, and `ci/unity.sh` runs that version or stops. Unity 6.3's Android module installs the JDK, SDK and NDK that its Gradle project expects ([[#gradle-project]]), and the pipeline builds with those, not with whatever the agent's `PATH` finds. On a Mac with several Xcodes, `xcode-select -switch` selects the default Xcode for the command-line tools and `xcode-select --print-path` shows which one it is; the default belongs to the whole machine, so the pipeline checks it at the start of each build. CocoaPods is pinned through Bundler, as [[#xcode-cocoapods]] describes. Each build prints every tool's version into its log, so a build that broke overnight can be compared with the last one that passed, line by line.

Exercise: Write your pipeline's stages as a table like the one above, with the evidence that each must produce, and mark the stages that pass today on an exit code alone.

?? ci-batchmode-evidence A test stage runs Unity's Test Framework in batch mode, and the Editor exits with code 0. What else does the stage check before it reports a pass?
* That a results file from this run exists and counts more than zero tests
- Nothing more, since the runner returns 0 once tests have run and passed
- That the last lines of the log hold no error, since failures print last
- That the Editor's log file exists, which shows that the test run started
- That the run took longer than a minute, which shows that tests executed
> An exit code of 0 says that the runner found no failure, and a run that executed nothing has none: in the Test Framework's source, a run that completes without executing a test returns the same code as a passing run. A filter that matched nothing ends that way. A results file written by this run, whose `total` is above zero, is the evidence that tests ran.

?+ An Android build stage runs Unity with `-executeMethod` and `-quit`. Unity exits with 0, and `build/` holds no AAB. What does the stage report?
* A failure, since the artifact it exists to produce is missing
- A success, since the exit code shows that the build method ran
- A success with a warning, since the AAB may appear after signing
- A success, since Gradle writes the AAB into the Library folder
- A failure of the agent's disk, since Unity reported no problem
> The exit code says that the Editor ended without an error it reported, not that the method built anything: a method that returned early, or wrote to another path, ends the same way. Each stage names the artifact that it must produce and fails without it, which is why the pipeline tests for the AAB after the build.

?+ Why does the chapter's build script call `EditorApplication.Exit(1)` when `BuildPlayer` returns null or a result other than `Succeeded`?
* So that the stage fails on the build's result, not only on a thrown error
- So that Unity deletes the half-built output before the next stage runs
- Because `BuildPlayer` throws on each failure, and the call rethrows it
- Because a null report means that another build holds the Editor's lock
- So that Jenkins retries the stage, which it does after exit code 1
> `BuildPlayer` reports most failures in the report it returns, returns null after logging some errors, and throws for others, such as an output path that the target does not accept. Returning from the method would leave the exit code to whatever Unity does next, so the script checks the result and exits with 1 itself, as Unity's own code does with an exception that it does not expect.

?? ci-toolchain-pinning `ProjectVersion.txt` names 6000.3.11f1, and one agent has only 6000.3.9f1 installed. What should the pipeline do on that agent?
* Stop before building, and report which Editor version the agent lacks
- Build with 6000.3.9f1, since patch releases of one version build alike
- Build with the newest Editor on the agent, which reads older projects
- Change `ProjectVersion.txt` to 6000.3.9f1 so that the versions agree
- Let the build pick any installed Editor, since the tests check the result
> The file names the version that the project was saved with, which is the one its developers built and tested. Another patch release changes what gets built, so the pipeline selects the Editor by that file and stops when the agent lacks it. The fix is to install that version on the agent, or to upgrade the project on purpose, in a commit.

?+ An iOS build fails on one Mac agent and passes on another, from the same commit, and someone installed a newer Xcode on the failing agent last week. What would have made this quick to find?
* Each build's log printing the versions of Xcode, CocoaPods, Unity and the JDK
- A retry policy for the stage, so that the build would move to the other agent
- A label that names both agents, so that Jenkins picks the one that passes
- An archive of each IPA, so that the two builds' sizes could be compared
- A copy of each agent's Library folder, so that the imports could be compared
> A build's output depends on its tools as much as on its commit. When every build prints each tool's version at its start, two logs of the same commit show the difference in one line. Moving the build to the agent that passes hides the cause, and the next build on the changed agent fails again.

?+ A Mac agent has two versions of Xcode installed. Which one does `xcodebuild` use in a build that does not choose?
* The one that `xcode-select` set as the default for command-line tools
- The newest one in `/Applications`, which `xcodebuild` finds by itself
- The one that Unity's `ProjectVersion.txt` names for the project
- The one that `Podfile.lock` recorded during the last `pod install`
- The one that App Store Connect requires for the current uploads
> `xcode-select` chooses the default Xcode for the command-line tools of the whole machine, and `xcode-select --print-path` shows it. The pipeline sets it or checks it at the start of each build, because another job or a person can change it between builds, and prints it into the log.

## Jenkins pipelines: Jenkinsfile, agents, stages, and parameters {#ci-jenkins-pipeline}

Jenkins runs pipelines on a controller and agents. The controller is the central process: it stores the configuration, loads the plugins that provide the steps pipelines call, and serves the web interface. Agents are the machines that run the builds. Each has executors, one per build it can run at once, and labels, words that group agents by what they can do, such as `macos` for Macs with Xcode. A stage asks for a label, or an expression of labels such as `unity && macos`, and gets any agent that matches, so an iOS stage names a label that only Macs carry. The controller can run builds on its own built-in node too, and Jenkins's documentation advises against it: a build there has the same access to the controller's files as Jenkins itself.

The pipeline is code: a `Jenkinsfile` at the root of the game's repository, reviewed and versioned with the game, so a change to the build has a history like any other change. Jenkinsfiles come in two syntaxes. Declarative pipelines have a fixed structure, which Jenkins can check before it runs them; scripted pipelines are general-purpose Groovy, the language that Jenkinsfiles are written in, and are more flexible and harder to read. A multibranch pipeline runs the Jenkinsfile of each branch that has one, so a branch's changes to the build are tested on that branch, and shared libraries hold pipeline code that several repositories load. The declarative structure has a few parts:

- `pipeline` holds everything, and `agent` says where the pipeline or a stage runs. `agent none` at the top makes each stage name its own agent.
- `parameters` asks for values when someone starts a run, and `params.NAME` reads them.
- `options` sets rules for the run: `buildDiscarder` keeps the logs and artifacts of the last runs, `disableConcurrentBuilds` queues a run behind a running one of the same pipeline, and `timeout` aborts a run that takes too long.
- `environment` sets environment variables for the steps.
- `stages` holds `stage` blocks, and each stage has exactly one of `steps`, `stages` or `parallel`.
- `when` decides whether a stage runs, and `post` runs steps after a stage or the pipeline, chosen by the result.

This Jenkinsfile builds both platforms in parallel, with parameters for the environment and the build type:

```groovy
pipeline {
    agent none

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['staging', 'production'], description: 'The backend that the build talks to')
        choice(name: 'BUILD_TYPE', choices: ['development', 'release'], description: 'A release build also goes to the test tracks')
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '50', artifactNumToKeepStr: '20'))
        disableConcurrentBuilds()
        timeout(time: 2, unit: 'HOURS')
    }

    environment {
        GAME_ENVIRONMENT = "${params.ENVIRONMENT}"
        BUILD_TYPE = "${params.BUILD_TYPE}"
    }

    stages {
        stage('Prepare') {
            agent { label 'unity' }
            steps {
                sh 'ci/version-stamp.sh > stamp.env'
                stash name: 'stamp', includes: 'stamp.env'
            }
        }
        stage('Edit Mode tests') {
            agent { label 'unity' }
            steps {
                sh 'rm -rf results'
                sh 'ci/unity.sh editmode -runTests -testPlatform EditMode -testResults results/editmode.xml'
            }
            post {
                always {
                    nunit testResultsPattern: 'results/editmode.xml'
                    archiveArtifacts artifacts: 'logs/*.log', allowEmptyArchive: true
                }
            }
        }
        stage('Build') {
            parallel {
                stage('Android') {
                    agent { label 'unity && android' }
                    stages {
                        stage('Android build') {
                            steps {
                                unstash 'stamp'
                                withCredentials([
                                    file(credentialsId: 'android-upload-keystore', variable: 'ANDROID_KEYSTORE'),
                                    string(credentialsId: 'android-keystore-password', variable: 'ANDROID_KEYSTORE_PASS'),
                                    usernamePassword(credentialsId: 'android-upload-key',
                                                     usernameVariable: 'ANDROID_KEY_ALIAS',
                                                     passwordVariable: 'ANDROID_KEY_PASS')
                                ]) {
                                    sh 'ci/unity.sh android -quit -buildTarget Android -executeMethod Game.Pipeline.CiBuild.Android'
                                }
                                sh 'test -s build/Game.aab'
                            }
                        }
                        stage('Android upload') {
                            when { expression { params.BUILD_TYPE == 'release' } }
                            steps {
                                withCredentials([file(credentialsId: 'play-upload-account', variable: 'PLAY_KEY')]) {
                                    sh 'ci/play-upload.sh build/Game.aab internal'
                                }
                            }
                        }
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'logs/*.log', allowEmptyArchive: true
                        }
                        success {
                            archiveArtifacts artifacts: 'stamp.env, build/Game.aab, build/*.symbols.zip', fingerprint: true
                        }
                    }
                }
                stage('iOS') {
                    agent { label 'unity && macos' }
                    stages {
                        stage('iOS build') {
                            steps {
                                unstash 'stamp'
                                sh 'ci/unity.sh ios -quit -buildTarget iOS -executeMethod Game.Pipeline.CiBuild.IOS'
                                withCredentials([
                                    file(credentialsId: 'ios-distribution-p12', variable: 'SIGNING_P12'),
                                    string(credentialsId: 'ios-distribution-p12-password', variable: 'SIGNING_P12_PASS'),
                                    file(credentialsId: 'ios-app-store-profile', variable: 'SIGNING_PROFILE')
                                ]) {
                                    sh 'ci/ios-archive-and-export.sh'
                                }
                                sh 'ls build/ipa/*.ipa'
                            }
                        }
                        stage('iOS upload') {
                            when { expression { params.BUILD_TYPE == 'release' } }
                            steps {
                                withCredentials([file(credentialsId: 'app-store-connect-api-key', variable: 'ASC_KEY')]) {
                                    sh 'ci/testflight-upload.sh build/ipa'
                                }
                            }
                        }
                    }
                    post {
                        always {
                            sh 'ci/ios-remove-signing.sh'
                            archiveArtifacts artifacts: 'logs/*.log', allowEmptyArchive: true
                        }
                        success {
                            archiveArtifacts artifacts: 'stamp.env, build/ipa/*.ipa, build/Game.xcarchive/dSYMs/**', fingerprint: true
                        }
                    }
                }
            }
        }
    }

    post {
        failure {
            mail to: 'platform-team@example.com', subject: "Build ${env.BUILD_NUMBER} failed", body: "${env.BUILD_URL}"
        }
    }
}
```

Each stage takes an agent by label: the tests any agent labeled `unity`, Android one labeled both `unity` and `android`, and iOS a Mac. The two branches of `parallel` run at once, each on its own agent with its own workspace, and each runs two stages in order, the build and then the upload, which `when` skips unless the build type is release. A stage inside `parallel` can have its own agent, `when` and nested stages, but not a `parallel` of its own. A stage with its own agent evaluates `when` after it takes the agent, unless `when` holds `beforeAgent true`.

`stash` saves files on the controller for any agent of the same run, and `unstash` brings them into the current workspace. The Prepare stage writes the build's stamp once, and each branch unstashes it, so both platforms get the same version and build number. A stash is discarded when the run ends, and it is meant for small files: Jenkins's help for the step sets no hard limit, advises alternatives from somewhere between 5 and 100 MB, and explains that the controller compresses each stash, which costs it CPU time. That decides how a project moves between agents. The Xcode project that Unity exports, which [[#xcode-build-flow]] archives, holds the game's data and IL2CPP's C++, so this Jenkinsfile keeps the export and the archive on one Mac, and a pipeline that splits them between agents passes the folder through an artifact repository, as the same help suggests for large transfers.

`archiveArtifacts` keeps files on the controller with the build, for as long as the build's log is kept, and fails the stage when it finds nothing to archive, unless `allowEmptyArchive` is set. So `success` archives the artifacts that must exist, and `always` archives the logs, which a failed build may not have written. Test results need a step that reads them. Jenkins's `junit` step reads JUnit's XML format, and Unity's results are NUnit's, so the pipeline uses the NUnit plugin's `nunit` step. By default it fails the build when it finds no results file, or files that hold no result: zero tests is not a pass, in Jenkins's own terms.

The options guard the run as a whole. `timeout` aborts the run when it outlasts its limit, and as a step it can wrap a single block. `disableConcurrentBuilds` queues a second run of the pipeline behind the first, and with `abortPrevious: true` it aborts the running one instead. `retry`, which is a step as well as an option, reruns a block after any exception, up to a count, and does not retry a user's abort. It reruns real failures too, so it suits steps that fail for reasons outside the build, such as a network error during an upload, and not tests.

`post` runs after a stage or the whole pipeline, and its blocks are chosen by the result. `always` runs whatever the result was. `success` and `failure` run for those statuses, `aborted` for a run that someone stopped, `fixed` for a success after a failed or unstable run, `changed` for any change of status from the previous run, `unsuccessful` for anything but success, and `cleanup` after all the others. Jenkins runs them in a fixed order: `always`, `changed`, `fixed`, `regression`, `aborted`, `failure`, `success`, `unstable`, `unsuccessful`, then `cleanup`. Work that must happen whatever the outcome, such as archiving logs and removing signing material, goes under `always` or `cleanup`, since the logs of a failed build are the ones someone needs.

Exercise: Write a declarative Jenkinsfile skeleton for your game with the stages from the previous section, and give each stage the agent label, the `post` blocks and the timeout that it needs.

?? ci-jenkins-agents The iOS stage declares `agent { label 'unity && macos' }`. Which agents can run it?
* Any agent that has both labels, and none that lacks either of them
- Any agent labeled `unity` or `macos`, whichever is free first
- Only the controller's built-in node, which `&&` selects for iOS
- Any agent at all, with Jenkins installing Xcode where it is missing
- The agent that ran the stage before it, since stages keep their agent
> A label expression selects the agents whose labels satisfy it, and `&&` requires both. An administrator labels agents by what they can do, and a Mac with Unity and Xcode carries both. The stage waits for such an agent and never runs on one that lacks a label, and each stage with its own agent can land on a different machine.

?+ A team saves a machine by running its builds on the controller's built-in node. What does Jenkins's documentation warn about?
* Builds there have the same access to the controller's files as Jenkins
- Builds there run slower, because the controller limits their CPU time
- Builds there cannot bind credentials, which only agents can receive
- Builds there share one workspace, so parallel stages overwrite files
- Builds there skip their post blocks, which only agents know how to run
> A build on the built-in node runs on the controller's machine with the same access to its file system as the Jenkins process, which holds the whole configuration. Jenkins's documentation advises running every build on agents instead, so that the controller's own work, scheduling builds and serving the interface, stays apart from them.

?+ Why does the chapter's Jenkinsfile declare `agent none` at the top and an agent in each stage?
* Each stage takes an agent with the tools it needs, only while it runs
- Jenkins copies the workspace between agents when the top agent is none
- Parallel stages need `agent none`, since they must run on the controller
- A Jenkinsfile can name one label, so the stages cannot share a default
- Stages with their own agents share one checkout of the repository
> `agent none` takes no executor for the pipeline as a whole and makes each stage name its own agent, so the tests take any Unity agent, Android an agent with that module and iOS a Mac, each for as long as its stage runs. Each agent has its own workspace, and nothing is copied between them unless the pipeline stashes or archives it.

?+ The Prepare stage writes a 200-byte `stamp.env` that both platform stages need, on other agents. Which step fits?
* `stash` in Prepare, and `unstash` in each platform stage of the same run
- `archiveArtifacts`, which copies the file into each later workspace
- None, since every agent of a run shares the first stage's workspace
- A shared library, which carries files from one stage to the next
- `buildDiscarder`, which keeps the file until the last stage has run
> `stash` saves files on the controller for any node of the same run, and `unstash` brings them into the current workspace; stashes are discarded when the run ends. Archived artifacts stay with the build for people and later runs to download, and nothing reaches another agent's workspace unless a step puts it there.

?+ Why does the Jenkinsfile not `stash` an exported Xcode project to archive it on a different Mac?
* Stashes are meant for small files, and the controller compresses each one
- A stash holds single files, and an exported Xcode project is a folder
- `unstash` restores files only on the agent that created the stash
- Stashes are kept for the whole run, which fills the agent's disk
- A stash expires when its stage ends, before the next stage starts
> Jenkins's help for the step says that stash and unstash are designed for small files and advises alternatives from somewhere between 5 and 100 MB, since each stash is a compressed archive that the controller makes. A Unity export holds the game's data and IL2CPP's C++, so the pipeline keeps the export and the archive on one Mac, or passes large folders through an artifact repository.

?? ci-jenkins-post A stage archives its logs in `post { success { ... } }`. What goes wrong?
* A failed build keeps no logs, and failed builds are the ones to read
- Nothing, since `success` runs whatever the stage's result was
- The logs are archived twice, because `always` runs with `success`
- The logs are empty, because `success` runs before the stage's steps
- The build fails, since `archiveArtifacts` is refused inside `post`
> `success` runs only for a stage or pipeline whose status is success. Logs matter most when a build fails, so they go under `always`, which runs whatever the result, while the artifacts that exist only after a successful build, such as the AAB, go under `success`.

?+ A stage fails. In which order do its `post` blocks `cleanup`, `failure` and `always` run?
* `always`, then `failure`, then `cleanup` after every other condition
- `cleanup` first, so that the later blocks start from a clean workspace
- `failure` first, since it matches the result, and then `always`
- `failure` alone, since a failed stage skips `always` and `cleanup`
- In the order that the Jenkinsfile lists them, from top to bottom
> Jenkins runs post conditions in a fixed order: `always`, `changed`, `fixed`, `regression`, `aborted`, `failure`, `success`, `unstable`, `unsuccessful`, and last `cleanup`, which runs after every other condition has been evaluated, whatever the status. That makes `cleanup` the place for work that must follow all the reporting.

?+ The pipeline's `post { failure { ... } }` sends a message, and a user aborts a run. Does the message go out?
* No: the run's status is aborted, which `failure` does not match
- Yes: Jenkins records every stopped run with the failed status
- Yes, because `failure` matches each status except success
- No, because a pipeline runs no `post` blocks after an abort
- Only if the abort came while a step was already failing
> A run that someone stops has the aborted status, and `aborted` is the condition that matches it; `failure` matches the failed status. `post` still runs after an abort, so a pipeline that should report both uses `unsuccessful`, which matches any status but success, or both conditions.

?+ Which `post` condition sends a message only when a build succeeds after a failed or unstable one?
* `fixed`, which compares this run's status with the previous run's
- `success`, which runs on the first success after a failure
- `changed`, which runs when the status went from bad to good
- `always`, with the message saying whether the build recovered
- `cleanup`, which runs once the failure has been cleaned up
> `fixed` runs when the current run succeeds and the previous one failed or was unstable. `success` runs after each successful run, and `changed` after any change of status, including a success that turns into a failure.

## Secrets, credentials, and signing in CI {#ci-secrets-signing}

A mobile pipeline holds the keys to the game: the upload keystore that Google Play checks ([[#gradle-packaging-signing]]), the distribution certificate and [[provisioning profiles]] that iOS checks ([[#xcode-signing-model]]), and the API keys that upload to the stores. Jenkins keeps them in its credentials store, each under an id, and a pipeline binds one to a variable for the steps that need it, as the Android build step of the previous section's Jenkinsfile does. `withCredentials` binds each credential to an environment variable that exists only inside its block. The `file` binding writes a secret file into a private temporary directory, sets the variable to its path, and deletes the directory when the block ends; `string` sets the variable to a secret text; `usernamePassword` sets two variables, here the key's alias and its password. The `environment` directive has a `credentials()` helper that binds a credential for a whole stage or pipeline, with `NAME_USR` and `NAME_PSW` for a username and password, but a binding around the one step that needs a secret exposes it to fewer steps.

Jenkins replaces a bound secret with asterisks when the log shows it. Masking is a guard against accidents: it matches the secret's text, and the forms in which common shells print it quoted, and nothing else. A secret that a tool prints changed, by one character or encoded with base64, reaches the log in the clear, and Jenkins's documentation adds that anyone who can edit the pipeline can get around the masking and is trusted with its credentials. Build tools in debug mode may print the whole environment. So the pipeline never prints a secret, and it keeps secrets out of Groovy strings: in `sh 'curl -u "$USER_PASS" ...'`, in single quotes, the shell expands the variable, while in a double-quoted Groovy string Groovy writes the value into the command before the shell runs, and the machine's process list can show it.

The rest is discipline. Secrets are bound in the stage that needs them, never echoed and never committed, rotated when someone leaves or a key may have leaked, and given the least privilege that works. An App Store Connect API key has a role that decides what it can do, and a team key reaches every app of the team, so the key that uploads builds gets a role that uploads and nothing more, and a compromised one is revoked in App Store Connect. The account that uploads to Google Play gets the permissions for this app's releases and no others. On Linux, other processes of the same account can read a build's environment, so jobs that use signing secrets do not share agents with jobs that untrusted people control.

The Android build reads its signing values in the build script, the second half of the class from the first section:

```csharp
using UnityEditor;

namespace Game.Pipeline
{
    public static partial class CiBuild
    {
        // The Jenkinsfile binds these four for the Android build step only.
        static void ApplyAndroidSigning()
        {
            PlayerSettings.Android.useCustomKeystore = true;
            PlayerSettings.Android.keystoreName = Env("ANDROID_KEYSTORE");
            PlayerSettings.Android.keystorePass = Env("ANDROID_KEYSTORE_PASS");
            PlayerSettings.Android.keyaliasName = Env("ANDROID_KEY_ALIAS");
            PlayerSettings.Android.keyaliasPass = Env("ANDROID_KEY_PASS");
        }
    }
}
```

The keystore holds the upload key. With [[Play App Signing]], Google signs what players install with a key of its own, so a leaked upload key can be reset, but a leak is still a leak, and the file stays in the credentials store and in the temporary directory that the binding deletes.

iOS signs with identities, a certificate and its private key, that `codesign` finds in a keychain, the macOS database of certificates, keys and passwords. An agent should not keep the team's distribution key in its login keychain between builds, where every later job can use it. The iOS stage makes a keychain for one build instead, with manual signing ([[#xcode-signing-model]]), and the stage's `post` deletes it:

```bash
#!/bin/bash
# ci/ios-archive-and-export.sh: runs inside withCredentials, which binds
# SIGNING_P12, SIGNING_P12_PASS and SIGNING_PROFILE for this step only.
set -euo pipefail
mkdir -p logs
keychain="$(mktemp -d)/signing.keychain-db"
password="$(uuidgen)"                  # protects this keychain, for this build
echo "$keychain" > .signing-keychain   # read by ci/ios-remove-signing.sh

security create-keychain -p "$password" "$keychain"
security set-keychain-settings -lut 3600 "$keychain"   # lock on sleep, and after an hour
security unlock-keychain -p "$password" "$keychain"
security import "$SIGNING_P12" -k "$keychain" -P "$SIGNING_P12_PASS" -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple: -s -k "$password" "$keychain"
security list-keychains -d user -s "$keychain" $(security list-keychains -d user | tr -d '"')

profiles="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
mkdir -p "$profiles"
cp "$SIGNING_PROFILE" "$profiles/ci-game-app-store.mobileprovision"

xcodebuild archive -workspace build/xcode/Unity-iPhone.xcworkspace -scheme Unity-iPhone \
  -destination 'generic/platform=iOS' -archivePath build/Game.xcarchive \
  CODE_SIGNING_ALLOWED=NO > logs/xcodebuild-archive.log 2>&1
xcodebuild -exportArchive -archivePath build/Game.xcarchive \
  -exportOptionsPlist ci/ExportOptions.plist -exportPath build/ipa > logs/xcodebuild-export.log 2>&1
```

Each `security` command does one thing, and the tool's manual explains the choices. The keychain gets a random password, which only this build knows; the manual calls `-p` insecure, since a process listing can show it, and what that exposes is one keychain that lives for one build. `set-keychain-settings -lut` locks it when the machine sleeps and after the timeout. `import` takes the `.p12` file's passphrase with `-P`, because without it the tool asks for the passphrase in a window, which nobody on an agent can answer, and `-T` lets `codesign` use the key. `set-key-partition-list` is the step that is easy to miss: the partition list limits access to a key by the code signature of the program that asks, the manual says that `codesign` needs `apple:` in it, and changing it takes the keychain's password. `list-keychains -s` puts the keychain in the search list, before the ones already there. The profile goes where Xcode 16 and later keep downloaded profiles. The archive is built unsigned, and the export signs it with the team, profile and method that `ci/ExportOptions.plist` names, the property list that [[#xcode-build-flow]] shows.

```bash
#!/bin/bash
# ci/ios-remove-signing.sh: runs in post { always }, whatever the stage did.
if [ -f .signing-keychain ]; then
  keychain="$(cat .signing-keychain)"
  security delete-keychain "$keychain" || true
  rm -rf "$(dirname "$keychain")" .signing-keychain
fi
rm -f "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/ci-game-app-store.mobileprovision"
```

`delete-keychain` deletes the keychain and removes it from the search list. The cleanup runs under `always` because a failed archive ends the stage's steps, and a deletion placed after it would never run; Jenkins deletes the file that it bound, not what a script made from it. Unity itself needs a license on each agent too. Depending on the plan, the pipeline activates Unity from the command line with credentials from the same store and returns the license when the agent is retired, or the agents take seats from a licensing server; Unity's licensing documentation covers both.

Exercise: List every secret your pipeline uses, where it is stored, who can read it, which steps bind it, and how it is rotated.

?? ci-secret-masking A step inside `withCredentials` runs `echo "$TOKEN" | base64`. What does the build log show?
* The encoded token in plain text, since masking matches the secret's text
- Asterisks, since Jenkins masks each encoding of a bound secret
- Nothing, since `withCredentials` blocks commands that print secrets
- An error, since a bound variable cannot be piped into another tool
- Asterisks, because the output of `base64` is masked for credentials
> Masking replaces the secret's own text, and some quoted forms that common shells print, with asterisks. An encoded or otherwise changed secret is a different text, so it reaches the log in the clear, and base64 is trivially decoded. Masking guards against accidents; the pipeline itself never prints a secret.

?+ Why do Jenkins's examples pass a secret to `sh` in single quotes rather than double quotes?
* Single quotes leave the variable to the shell instead of to Groovy
- Double quotes switch off masking for the rest of the step
- Single quotes make the shell encrypt the variable before use
- Groovy refuses double-quoted strings inside `withCredentials`
- Single quotes keep the secret out of the step's environment
> In `sh 'curl -H "Token: $TOKEN" ...'` Groovy passes the text unchanged and the shell reads the variable. In a double-quoted Groovy string, Groovy inserts the value into the command before the shell runs, so the secret becomes part of a command line, which the machine's process listing can show, and a value changed on the way may no longer be masked.

?+ A secret contains a character that a tool escapes when it prints the secret. Is the printed form masked?
* Not reliably: masking knows the exact text and a few shells' quoted forms
- Yes: Jenkins masks any text that it can decode back into the secret
- Yes, because Jenkins stores each escaped variant of each credential
- No, because masking applies to username and password credentials alone
- No, because a tool's escaped output does not reach the build log
> Jenkins masks the secret's text and, on a best-effort basis, the forms in which Bourne shell, Bash, Almquist shell and Windows batch print it. A secret changed by even one character is no longer masked, and other tools' escaping is unknown to it, so the fix is to keep secrets out of printed output, not to trust masking.

?+ Masking is on for every credential. How should the team treat it?
* As a guard against accidents, with nothing printed on purpose
- As protection from anyone who can edit the Jenkinsfile
- As a reason to allow debug logging of the full environment
- As encryption of the bound secret files on the agent's disk
- As a way to share secrets safely through archived artifacts
> Jenkins's documentation says that masking can be circumvented, and it treats anyone who can configure a job or write pipeline steps as trusted with the credentials in scope. Masking prevents accidents in the log and nothing more: a file written from a secret and archived, or a tool in debug mode that prints the environment, exposes the secret.

?? ci-temp-keychain Why does the iOS stage import the distribution certificate into a keychain it creates, rather than into the agent's login keychain?
* The key lives for this build alone, in a keychain whose password it controls
- `codesign` reads identities only from keychains created during the build
- The login keychain can hold development certificates, not distribution ones
- A keychain in a temporary folder makes the archive build faster
- A temporary keychain removes the need for a provisioning profile
> Imported into the login keychain, the team's private key would stay on the agent, usable by every later job. The stage creates a keychain with a random password, unlocks it, imports the certificate, lets `codesign` use the key, and deletes the keychain in `post`, so the key lives for one build.

?+ The archive step fails, and the command that deletes the temporary keychain is the stage's last step. What is left on the agent?
* The keychain with the private key, since the steps after the failure never ran
- Nothing, since Jenkins deletes the keychains that a failed stage created
- Nothing, since the keychain deletes itself once its lock timeout passes
- Only the certificate, since the private key stays in the `.p12` file
- Nothing, since `withCredentials` removes all that its block created
> A failed step ends the stage's steps, so a cleanup step placed after it never runs. Jenkins deletes the secret file that it bound, not what a script made from it, and the keychain's timeout locks it without deleting it. The deletion belongs in `post` under `always` or `cleanup`, which run whatever the result.

?+ After `security import` on an agent, what lets `/usr/bin/codesign` use the imported key, according to the `security` manual?
* `set-key-partition-list`, with `apple:` in the key's partition list
- `set-keychain-settings`, with a lock timeout long enough for the build
- `list-keychains -s`, with the new keychain first in the search list
- `find-identity -p codesigning`, which grants the key to codesign
- `unlock-keychain`, given the password that protects the `.p12` file
> The partition list limits access to a key by the code signature of the program that asks, and the manual says that `apple:` must be in it for `/usr/bin/codesign`. Changing it takes the keychain's password, which the stage chose when it created the keychain. The other commands lock, find or search, and none of them grants access.

?+ `security import cert.p12 -k ci.keychain-db -T /usr/bin/codesign`, with no `-P`, hangs on an agent. Why?
* Without `-P`, the tool asks for the passphrase in a window nobody answers
- The keychain waits for Xcode to start before it accepts a new identity
- `import` waits for Apple to confirm the certificate over the network
- A `.p12` file can be imported only through Xcode's account settings
- The `-T` option waits for a person to approve each listed application
> The manual says that `-P` gives the unwrapping passphrase on the command line, and that by default the tool asks for it through a graphical prompt. On an agent that prompt waits until the stage's timeout. The pipeline passes the passphrase from a bound secret, and runs every step so that nothing asks a person.

## Caching and build speed {#ci-caching}

A clean Unity build does everything once. It imports every asset, compiles the scripts, converts them with [[IL2CPP]] and compiles the C++, runs [[Gradle]] or Xcode, and downloads the dependencies of both. Much of that work produces the same result from one build to the next, and a pipeline that keeps it between builds answers faster. What it keeps, and under which key, decides whether the speed costs correctness.

The largest cache is Unity's `Library` folder: the imported form of the project's assets and the other data that Unity derives from `Assets`, `Packages` and `ProjectSettings`. It is never committed, and deleting it costs a full import. Jenkins leaves a workspace in place after a build, so a job that runs on the same agent finds its `Library` from the last run. A team that builds on many agents, or on fresh ones, restores a saved `Library` at the start of a build, and the Unity Accelerator, Unity's cache server for imported assets, moves that work off the agents and shares it between them and developers.

A cache is safe only when its key names everything that changes its contents. What Unity derives into `Library` depends on the Editor version, on the build target's import settings and on the packages, so its key is the Unity version, the build target and a hash of `Packages/packages-lock.json`. A `Library` made under other conditions can cost a long reimport, or produce errors that look like the project's and disappear when the folder is deleted. The rule follows: when a cached build fails and a clean build of the same commit passes, the pipeline rebuilds the cache and finds what its key leaves out, rather than retrying until something passes.

The native tools keep caches on the agent too. Gradle keeps the dependencies it downloads and a daemon, a process that stays running between builds, and two builds that share them share their state, which the next section returns to. [[CocoaPods]] caches downloads in `~/Library/Caches/CocoaPods`, or where the `CP_CACHE_DIR` variable points. All of them grow, and so do the workspaces and their `Library` folders, and an agent with a full disk fails in whichever step writes next. So a pipeline checks the free space at the start of each build and prunes old caches on a schedule.

Release candidates build clean. Daily builds use the caches; a candidate builds from a fresh checkout, with no `Library` and no output from earlier builds, with `deleteDir()` or a new workspace. Then nothing but the commit and the pinned tools decides what ships, a fault in a cache cannot reach players, and each release proves that the game still builds from its repository alone. It costs one slow build per release.

Exercise: Time each stage of your pipeline with and without its cache, decide which caches pay for themselves, and write down what each one's key must include.

?? ci-cache-key Which key suits a cached `Library` folder for the Android builds of one project?
* The Unity version, the build target and a hash of the package lock file
- The branch name, since each branch needs a Library of its own assets
- The date, so that the cache is rebuilt from nothing once each day
- The commit hash, so that each commit gets a Library of its own
- The agent's name, since each agent imports the assets its own way
> What Unity derives into `Library` depends on the Editor version, the target's import settings and the packages, so a key that names all three restores a `Library` made under the same conditions. A key by commit never matches the next build, and a key by date, branch or agent restores a `Library` made under other conditions.

?+ After the agents moved to a new Unity patch release, cached builds fail with import errors that clean builds do not show. What was wrong with the cache?
* Its key left out the Unity version, so the old Library was restored
- The new release cannot use any cache, so caching has to stop for good
- It was too small for the new release's larger Library folder
- The Unity Accelerator was offline, so the new release imported nothing
- Gradle's daemon kept running with the old release's JDK and settings
> A `Library` made by one Editor version was restored for another, since nothing in its key changed. A key that names the Unity version gives the new release an empty cache, which fills on the first build. A clean build that passes and a cached one that fails point to the cache, not to the project.

?+ A cached build fails, and a clean build of the same commit passes. What should the pipeline do?
* Treat the cache as suspect: rebuild it and find what its key leaves out
- Retry with the same cache until a build passes, and then keep it
- Mark the commit as broken, since the clean build may hide the bug
- Copy the failing Library to the other agents to reproduce the error
- Stop caching Library, since any cache makes the builds unreliable
> The commit builds from source, so the difference lies in what the cache added. Rebuilding the cache gets builds moving, and the key needs whatever changed between the two, such as the Unity version, the target or the packages; retrying with the same cache repeats the failure or hides it.

?? ci-clean-release Daily builds restore a cached `Library`. Why build a release candidate from a fresh checkout with no cache?
* So that only the commit decides what ships, and no cache fault reaches it
- Because the stores reject builds that were made from cached imports
- Because a build from a cache cannot be signed for distribution
- Because a clean build is faster than one that restores a cache
- Because Unity embeds the cache in the app, which makes it larger
> A clean build uses nothing from earlier builds, so what it ships follows from the commit and the pinned tools alone, and it proves that the game still builds from its repository. The cost is one slow build per release; the stores cannot tell how a build was made.

?+ A release candidate built clean behaves differently from yesterday's cached build of the same commit. What does that show?
* The cached build depended on something that the commit does not hold
- The clean build is wrong, since the cached build was the one tested
- Nothing, since clean and cached builds of one commit differ by design
- The store changed the build during processing, after the upload
- The signing key changed between the two builds of the commit
> The two builds had the same commit and tools, so the cache made the difference: a stale import or build output that the commit no longer produces. The clean build is the one that matches the source, and the team finds what the cache carried before it trusts either build.

## Failures that happen only in CI {#ci-only-failures}

A build that passes on a developer's machine and fails on an agent is the most common CI failure, and the cause is a difference between the two machines. These are the usual ones:

- **A clean checkout.** A file that the developer's build relied on but nobody committed, or that `.gitignore` excludes, is missing. A file that [[Git LFS]] stores arrives as a pointer when the agent does not have Git LFS installed or the checkout does not pull LFS files; Jenkins's Git plugin pulls them after the checkout when the job asks it to.
- **Tool versions**, which the first section pins and prints.
- **The environment**: variables that a developer's shell sets, and the locale and time zone, which change how numbers and dates are parsed and printed.
- **No graphics.** Under `-nographics` there is no graphics device, and a test or build step that needs one fails.
- **Signing state**: a locked keychain, or a certificate that expired ([[#xcode-signing-model]]).
- **Network access**: a firewall or proxy between the agent and a package repository.
- **Shared state**: a workspace that keeps the files of earlier builds, two builds that share a Gradle daemon or a `Library`, and full disks.
- **Case-sensitive file systems.** A path written `Hero.png` for a file named `hero.png` works on a case-insensitive file system and fails on a case-sensitive one, as a Linux agent's usually is.
- **File permissions.** Git records whether a file is executable, and a script that runs on the developer's machine fails with `Permission denied` on an agent when the repository has it without that bit.
- **Time limits.** A stage that grows past its timeout is aborted.

The method starts with the whole log. The console's last lines usually hold the last symptom, a message that the build failed, and the first error holds the cause; later errors often follow from it. The pipeline writes Unity's log and `xcodebuild`'s to files and archives them under `always`, so the log of a failed build is complete and in one place. Next, reproduce the failure with the pipeline's exact command in a fresh clone of the same commit, on a machine with the agent's tool versions; because the Jenkinsfile calls scripts in `ci/`, the command is the same one that a developer runs. Compare the tool versions that the failing build printed with those of the last build that passed. And when the pipeline itself changed, bisect it: the Jenkinsfile and its scripts are in the repository, so `git bisect` finds a change to the build as it finds one to the game.

| Symptom | Likely cause | First check |
| --- | --- | --- |
| An asset fails to import, and its file is a few lines of text | A Git LFS pointer instead of the file | The file's first line, which in a pointer names the LFS specification |
| A file is missing on every agent and present on developers' machines | It was never committed, or it is ignored | A fresh clone of the commit |
| A file is missing on a Linux agent only | A path whose case differs from the file's name | The path in the code against the name in the repository |
| `codesign` fails, or waits until the stage's timeout | A locked keychain, a key that `codesign` may not use, or an expired certificate | `security find-identity -p codesigning` on the agent |
| `Permission denied` when a script starts | The script is not executable in the repository | `ls -l` on the script in a fresh clone |
| A test fails on the agent only, around dates or numbers | The agent's locale or time zone | The locale and time zone, printed in the log |
| Steps fail at random with write errors | A full disk | The free space, printed at the start of the build |
| A stage is aborted with no error of its own | Its timeout | The stage's duration over the last builds |

Debugging exercise: Take your last CI failure and reproduce it from a fresh clone of its commit with the pipeline's exact command. Write down what differed from your machine and which row of the table it belongs to.

?? ci-clean-clone A build passes on a developer's machine and fails on every agent with a missing file. What is the first step?
* Run the pipeline's exact command in a fresh clone of the same commit
- Copy the developer's Library folder to the agents and build again
- Retry the build until an agent passes, and then compare the logs
- Compare the Unity preferences of the agents with the developer's
- Reinstall Unity on the agents, since their installation is damaged
> A fresh clone holds what the repository holds and nothing else, like the agent's checkout. If the failure reproduces there, the developer's machine had a file that was never committed or is ignored, and the fix is in the repository, not on the agents.

?+ On an agent only, a texture fails to import, and its file is 130 bytes of text. What is the likely cause?
* The checkout left a Git LFS pointer file where the texture should be
- The agent's Unity version does not support the texture's format
- The agent's file system compressed the texture during checkout
- A cached Library held a stale import of an older version of it
- The texture is larger than the agent's memory allows Unity to load
> Git LFS keeps a pointer file under 1024 bytes in the repository, with a first line that names the LFS specification, and downloads the file itself on checkout. An agent without Git LFS installed, or a checkout that does not pull LFS files, leaves the pointers, which Unity cannot import as textures.

?+ A test stage reads `results/editmode.xml` and passes, though the Unity run crashed before it wrote any results. How?
* The workspace still held the results file of an earlier build
- The crash wrote an empty results file, which counts as a pass
- Jenkins reran the tests after the crash and kept the new results
- The `nunit` step fills in results for the tests that did not report
- The stage read the results that another branch's build left
> Jenkins leaves a workspace in place after a build, so files from earlier builds are still there. A stage that reads an old results file reports an old run, so it deletes the folder before the tests run, as the chapter's Jenkinsfile does, or starts from a clean workspace.

?+ A build passes on developers' Macs and fails on the Linux agent: `Assets/Art/Hero.png` is missing, and the repository holds `Assets/Art/hero.png`. Why did the Macs pass?
* Their file system treated the two names as one, and the agent's does not
- Unity on macOS corrects the case of paths when it imports assets
- Git renamed the file on the Linux agent when it checked it out
- The Linux agent lacks Git LFS, which stores files of that type
- The Macs restored a cached Library that already held the texture
> A case-insensitive file system finds `hero.png` when the code asks for `Hero.png`, and a case-sensitive one, as a Linux agent's usually is, does not. The fix is the case of the path in the code or of the asset's name, and a build on the case-sensitive agent catches the next one.

?? ci-full-log An Android build fails in CI, and the console's last lines say only that the build failed. Where is the cause?
* Further up the full Unity log, at its first error, archived with the build
- In the console's last line, since Unity prints the cause at the end
- In the Jenkins controller's system log, which records build errors
- In the Gradle cache folder on the agent, which keeps failed outputs
- Nowhere yet: the stage has to be rerun with more logging to show it
> The end of a log holds the last symptom, a message that the build failed, and the first error holds the cause; later errors often follow from it. The pipeline writes Unity's log to a file and archives it in `post` under `always`, so the whole log of a failed build is there to read.

?+ A failed Unity build's log holds twelve errors. Which one does the team read first?
* The earliest error, since the later ones often follow from it
- The last error, since Unity reports the cause at the end
- The error that appears most often, since it causes the others
- The first error in the team's own scripts, since packages are tested
- Any of them, since the errors of a build are independent
> A compile or import error early in a build makes later steps fail on missing types or assets, so the log fills with consequences. The earliest error is the likeliest cause, and the last lines of a log, which a console shows, often hold only the final report that the build failed.

?+ A stage was aborted by its timeout with no error of its own. What shows what it was doing?
* The logs archived under `always`, which end at the step that hung
- The exit code, which records the step that was running at the time
- The build number, which Jenkins ties to the step that ran last
- The archived artifacts, which record how far the build got
- The Jenkinsfile, which says how long each step is allowed to take
> An abort ends the stage wherever it is, so the evidence is what the tools wrote until then: the Unity, Gradle or `xcodebuild` log, archived by a `post` block that runs whatever the result. The step at the end of the log, and its duration in earlier builds, show whether it hung or the stage outgrew its limit.

## Automate versions and releases {#ci-release-automation}

Each build carries two version values, which chapter 10 covers in full. The marketing version is the one players see, `versionName` on Android and `CFBundleShortVersionString` on iOS, and the build script sets it from a `VERSION` file in the repository, the one source of truth. The build number identifies each upload: `versionCode` on Android, an integer, and `CFBundleVersion` on iOS, the build string. Google Play refuses an upload whose `versionCode` it has seen before, Android refuses to install a lower `versionCode` over a higher one, and App Store Connect identifies each build by its build string, so each upload needs a new number, and a higher one than the last.

CI derives the build number, because people forget and two branches pick the same one. It comes from one counter that only increases, owned by the job that makes release candidates. Jenkins's `BUILD_NUMBER`, the number of the current run, fits when one job makes every upload, and a base number kept in the repository lets a recreated job continue above the last upload. A timestamp looks like a counter and overflows: Google Play's maximum `versionCode`, 2,100,000,000 as read in September 2026, is smaller than any ten-digit `yyMMddHHmm` stamp from 2021 on. The Prepare stage writes the stamp that every later stage reads:

```bash
#!/bin/bash
# ci/version-stamp.sh: prints the identity that every stage of this run shares.
set -euo pipefail
echo "export GAME_VERSION=$(cat VERSION)"
echo "export GAME_BUILD_NUMBER=$(( $(cat BUILD_NUMBER_BASE) + BUILD_NUMBER ))"
echo "export GAME_COMMIT=$(git rev-parse HEAD)"
```

For a release candidate, the pipeline tags the commit with the version and build number, such as `v1.8.0-512`, archives the artifacts and the symbols, and uploads the candidate to the test tracks. Google Play's Developer API works through an edit: a program creates one, uploads the bundle to it, puts the bundle's version code in a release on a track such as internal testing, and commits the edit. [[App Store Connect]] receives the IPA for TestFlight through one of the upload paths that [[#xcode-build-flow]] lists, with an API key from the credentials store. Promotion to production stays a person's decision, made in the stores' consoles or in a pipeline stage whose `input` waits for someone to approve it, after the candidate has been checked on the test tracks.

Build the candidate once and promote that artifact. On Google Play, a release on a track lists the version codes of bundles already uploaded, so promoting a candidate to production means releasing the same version code there, with no new upload. On the App Store, a version is submitted for review with one of the builds already uploaded, the one testers had in TestFlight. Rebuilding the commit for release makes a new binary that nobody tested: a tool, a cache or a resolved dependency can differ between two runs, and the store needs a new build number for the new upload anyway.

The pipeline uploads and archives the symbols of every build that may reach players, because a crash report arrives with addresses, and only that build's symbols turn them into names. On iOS, the dSYMs are in the archive and go to Apple with the build when the export's `uploadSymbols` option is on ([[#xcode-build-flow]]); a crash-reporting SDK takes its own copy. On Android, [[R8]]'s mapping file and the native debug symbols belong to the version in Play Console ([[#gradle-r8-symbols]]), and the Developer API uploads both as deobfuscation files, one of type ProGuard and one of native debugging symbols. The pipeline also keeps a copy of its own, named by version and build number, outside Jenkins: `buildDiscarder` deletes old runs with their artifacts, while a version stays on players' devices for months, and a [[dSYM]] fits no build but its own. Development builds' artifacts can go after a few weeks; a release's symbols stay as long as any player can run it.

Exercise: Trace a production crash back to its commit and its symbols using only what your pipeline records today, and list what was missing.

?? ci-build-once Candidate 1.8.0 (512) passed its checks on Google Play's internal track. How does it reach production?
* By releasing version code 512 on the production track, the tested bundle
- By rebuilding the commit in release mode and uploading the new bundle
- By uploading bundle 512 again, this time to the production track
- By building 513 from the same commit, since production needs its own
- By exporting the bundle from a tester's phone and uploading that
> A release on a Google Play track lists the version codes of bundles already uploaded, so promotion puts 512 on the production track without a new upload. Google Play refuses an upload whose version code it has seen, and a rebuild is a new binary that nobody tested.

?+ Why is rebuilding a tested commit for release a risk, even with the same Jenkinsfile and tools?
* The rebuild is a new binary that nobody tested, and its inputs can differ
- The stores refuse a second build that was made from the same commit
- A rebuilt app loses the signature that the tested build carried
- A rebuild gives a byte-identical file, so it only wastes time
- A rebuild resets the build number to that of the first build
> A build depends on more than its commit: tool installs, caches and resolved dependencies can change between two runs, and two builds are rarely identical byte for byte. The stores also need a new build number for a new upload, so the binary that shipped would be one that testers never had.

?+ On the App Store, how does the build that TestFlight testers approved become the one that ships?
* The version is submitted with that build, picked from the uploads
- The team uploads the same IPA again, marked for release this time
- App Store Connect rebuilds the app for release from its archive
- TestFlight converts the build into a release build with a new number
- The team exports the archive again, for the `app-store-connect` method
> App Store Connect keeps each uploaded build, and a version is submitted with one of them, chosen in its Build section. TestFlight and the App Store use the same builds, so the one testers approved is submitted as it is; uploading it again would need a new build string.

?? ci-symbol-upload A crash from version 1.7.2 (498) arrives with unreadable frames, and Jenkins discarded build 498 months ago. What should the pipeline have done?
* Uploaded 498's symbols when it built them, and kept a copy outside Jenkins
- Nothing: symbols can be rebuilt later from the commit tagged for 498
- Kept the AAB and IPA, since symbols can be extracted from them later
- Asked the stores for the build's symbols, which they keep for years
- Nothing: the stores name the frames of a crash without its symbols
> A dSYM fits only the binary it was built with, and a release app ships without its symbols, so neither a later rebuild nor the shipped files can replace them. The pipeline uploads symbols with each build that may reach players, and keeps its own copy by version and build number, since Jenkins's build discarder deletes old builds with their artifacts.

?+ A release built with R8 sends crash reports with obfuscated names. What does the pipeline upload with the bundle so that they can be read?
* R8's mapping file for that build, which maps the short names back
- The upload keystore, which Play Console uses to decode stack traces
- The debug build's APK, whose class names are left as written
- The project's source code, from which Play rebuilds the names
- The merged manifest, which lists every class under its full name
> R8 renames classes and methods in minified builds and writes a mapping file for each build ([[#gradle-r8-symbols]]). Uploaded to Play Console for that version, where the Developer API calls it a ProGuard deobfuscation file, it turns the reports' names back, and the pipeline also archives it, since reports keep arriving long after Jenkins has discarded the run.

?+ Where does a pipeline keep each release's symbols, given `buildDiscarder(logRotator(numToKeepStr: '50'))`?
* In storage of their own, by version and build number, outside Jenkins
- In the build's artifacts, which Jenkins keeps as long as the job exists
- In a stash, which lasts until the next release replaces it
- In the agent's workspace, which Jenkins leaves in place between builds
- In the cached Library folder, which keeps build outputs between runs
> The build discarder deletes old builds with their logs and artifacts, and a stash lasts one run, while a version can stay on players' devices for months. The pipeline copies each release's symbols to storage whose retention follows the versions in use, named so that a crash's version and build number find them.
