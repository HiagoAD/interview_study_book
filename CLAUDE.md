# InterviewWebsite

A website that runs entirely on the user's device. Nothing is deployed or hosted, and nothing leaves the machine.

## Constraints

- **Local only.** The site is opened from the local filesystem or a local dev server (`localhost`). Do not add deployment configs, hosting, or CI/CD for publishing.
- **No network dependencies at runtime.** Do not load scripts, stylesheets, fonts, or images from CDNs or third-party URLs. Vendor any library into the repo.
- **No external services.** No analytics, telemetry, trackers, remote APIs, or backends. Data persists only in the browser (e.g. `localStorage`, IndexedDB) or in local files.
- **Works offline.** Any change must keep the site fully usable with networking disabled.

## What the project is

An interactive study textbook: portions of content followed by questions, loaded from local files. [PROJECT.md](PROJECT.md) is the source of truth for scope and behaviour; read it before making changes.

## Project status

Newly initialized; no stack chosen yet. Update this file with the stack, how to run it, and the project layout once they exist.
