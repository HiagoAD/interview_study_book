# The iOS signing scripts use one fixed profile name per agent, which a concurrent build deletes

**Kind:** Accuracy. **Priority:** Low. **Touches:** two `bash` code fences in `ci-secrets-signing`, and one sentence of prose; no question block.

## Location

- `content/mobile-platform/11-ci-and-jenkins.md:566`: `cp "$SIGNING_PROFILE" "$profiles/ci-game-app-store.mobileprovision"`
- `content/mobile-platform/11-ci-and-jenkins.md:604`: `rm -f "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/ci-game-app-store.mobileprovision"`
- `content/mobile-platform/11-ci-and-jenkins.md:562`: `security list-keychains -d user | xargs security list-keychains -d user -s "$keychain"`

## Evidence

Read against the chapter's own Jenkinsfile and prose; not run, since the local Jenkins of Phase 29 had no agents (`docs/evidence/11-ci-and-jenkins.md`, “Not checked”).

- The chapter says an agent has “executors, one per build it can run at once” (line 231) and that a multibranch pipeline runs each branch's Jenkinsfile (line 233); `disableConcurrentBuilds` (line 289) queues runs of one job only, and each branch is a job of its own (chapter 10, line 283). So two iOS stages can run at once on one Mac that has two executors.
- Both builds copy their profile to the same file name in the user's one profiles folder, and the first to finish runs `ci/ios-remove-signing.sh` from `post { always }`, whose `rm -f` of that fixed path deletes the file the other build copied. If the other build has not yet exported, its `-exportArchive` no longer finds the profile.
- The search list is per user too. Line 562 reads the list and writes it back with the new keychain first; two builds doing this at nearly the same time can each write a list without the other's keychain, and `codesign` in that build then finds no identity. The chapter's table of CI-only failures (line 745) names shared workspaces and daemons but not this.

What would settle it as observed rather than read: two copies of the script run at once on one Mac under two workspaces, as Phase 29's keychain test did for one.

## Proposed fix

- Name the profile per build: `cp "$SIGNING_PROFILE" "$profiles/ci-$BUILD_TAG.mobileprovision"`, record that path in `.signing-keychain`'s neighbor file (or a second line), and have `ci/ios-remove-signing.sh` delete the recorded path rather than a fixed name. `BUILD_TAG` is one of Jenkins's environment variables (`jenkins-<job>-<number>`), unique per run.
- Add one sentence after the table at line 591: “The profile's file name and the search list belong to the user, not to the workspace, so an agent that signs iOS builds runs one of them at a time: give it one executor, or a lock around the signing steps.”

## Repeated elsewhere

No question depends on the file name; `ci-temp-keychain` (lines 643 to 673) tests the keychain's lifecycle and stays correct.
