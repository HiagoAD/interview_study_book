# User-initiated data transfer jobs run in the app's own process

**Kind:** Accuracy. **Priority:** Low. **Touches:** prose in `network-timeouts`; no question block.

## Location

`content/mobile-platform/09-reliable-networking.md:86`: “Large downloads belong to the platforms, which run them in another process: iOS's background `URLSession`, … and Android's `DownloadManager` and user-initiated data transfer jobs.”

## Evidence

Android's own pages, fetched with `curl` on 2026-09-29:

- `DownloadManager` is in another process: “The download manager is a system service that handles long-running HTTP downloads.” (https://developer.android.com/reference/android/app/DownloadManager)
- A user-initiated data transfer job is not. The app declares its own `JobService` and does the transfer itself: “Also, define a concrete subclass of JobService for your data transfer”, and “Execute the task asynchronously in onStartJob() … If you don't run the task asynchronously, the work runs on the main thread and might block it, which can cause an ANR.” When the user stops the job from the Task Manager, the system “Terminates your app's process immediately”, and the job can be stopped when “The app process is killed due to low device memory.” (https://developer.android.com/develop/background-work/background-tasks/uidt)

The system schedules a user-initiated job and keeps the app running for it, but the transfer code runs in the app's process, so “run them in another process” holds for `URLSession`'s background sessions and `DownloadManager`, and not for these jobs. For a Unity game the difference matters: the plugin has to contain the whole transfer in Java, not just a call to a system service.

## Proposed fix

“Large downloads belong to the platforms: iOS's background `URLSession`, whose transfers continue while the app is suspended, and even after the system terminates it, as [Apple's guide …](…) describes, and Android's `DownloadManager`, a system service that runs the download outside the game's process. Android's user-initiated data transfer jobs are the other option there: the system schedules the job and keeps the app running for it, while the app's own `JobService` performs the transfer.”

## Repeated elsewhere

No question or glossary entry. The outline (`docs/mobile-platform-outline.md`, `network-timeouts`) says only that such APIs are named.
