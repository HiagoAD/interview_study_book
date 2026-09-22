# Review request: documentation links and the reference version

- **Kind:** consistency, with one link that shows the wrong version's content
- **Priority:** medium
- **Where:** four links in chapter 11, of the book's 28
- **Touches:** link targets and link text in prose

## What chapter 01 promises

> The explanations use Unity 6.0 as their reference version. Package APIs, platform
> capabilities, and C# support can differ between Editor and package versions; links to
> versioned documentation are included where those differences matter.

## What an online check found (2026-09-22)

Every one of the 28 links loads. Each returned HTTP 200 with a page whose title matches
what the book cites it for, so none is a disguised “not found” page. Five go to
Microsoft's .NET documentation and one to Android's, and those six are fine. The other 22
go to Unity's documentation, on three hosts:

| Host | Links | Versions |
| --- | --- | --- |
| `docs.unity3d.com/6000.0/…` | 11 | 6000.0 |
| `docs.unity3d.com/Packages/…` | 4 | Addressables 1.21 (two), Test Framework 1.4, Memory Profiler 1.1 |
| `docs.unity.com/en-us/engine/…` | 5 | 6000.0 (three), **6000.6** at `06:88`, **6000.7** at `11:66` |
| `docs.unity.cn/…` | 2 | 6000.0 at `07:12`, unversioned at `11:167` |

`docs.unity.com` is Unity's newer documentation platform, currently serving 6.3, 6.6 and a
6.7 beta. `docs.unity3d.com` is still live, carries 6000.0 through 6000.6, and shows no
notice that it has moved; its unversioned manual now describes 6.6. This check found no
announcement of a move, so both hosts are current, and only `docs.unity3d.com` had a
6000.0 page for every topic the book links. `docs.unity.cn` is Unity's China site.

## What needs changing

1. **An unpinned link now shows Unity 2022.3.** `11:167` has no version in its path, and
   the unversioned manual on `docs.unity.cn` is the 2022.3 LTS manual, so the book's
   incremental-collection citation describes a Unity two years older than its baseline.
3. **A link pinned to a later version.** `11:66` points at 6000.7, which is a beta. The
   topic has a 6000.0 page with the same content: the markers page documents
   `Gfx.WaitForPresentOnGfxThread`.

Two package links are right as they are, which corrects the first version of this request:

- **Test Framework 1.4 (`08:14`): keep it.** Unity 6.0's core-package page now links the
  1.6 documentation, and the installed 6000.3 Editor bundles 1.6.0. But the 1.6
  documentation has no Edit Mode versus Play Mode page (it returns 404), because from
  Unity 6.2 the Test Framework guide lives in the Unity Manual, and the 6.0 manual has no
  such page either. The 1.4 page is the only one that covers the topic for a 6.0 project.
- **Memory Profiler 1.1 (`12:50`): keep it.** Unity 6.0's package page gives 1.1.12 as the
  version released for 6000.0.

## How to close it

Move every Unity link to `docs.unity3d.com`, pinned to 6000.0 and to the Addressables
version released for it. Each replacement below was checked to load, and to carry the
content the book cites it for:

| At | Replace with |
| --- | --- |
| `11:14` | `https://docs.unity3d.com/6000.0/Documentation/Manual/ProfilerHighlights.html` |
| `11:66` | `https://docs.unity3d.com/6000.0/Documentation/Manual/profiler-markers.html` |
| `11:167` | `https://docs.unity3d.com/6000.0/Documentation/Manual/performance-incremental-garbage-collection.html` |
| `11:171` | `https://docs.unity3d.com/6000.0/Documentation/Manual/performance-optimizing-arrays.html` |

One note beyond the links: the book's 6.0 baseline is now several releases behind the
documentation's current version, 6.6. Whether to move the baseline is a decision about the
book rather than its links, but it is why pinning matters, since every unversioned Unity
link follows the current release.
