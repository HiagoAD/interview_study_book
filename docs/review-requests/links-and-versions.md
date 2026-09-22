# Review request: documentation links and the reference version

- **Kind:** consistency, with two links that show the wrong version's content and one that cites a page for something it does not say
- **Priority:** medium
- **Where:** 28 external links across chapters 02, 04 to 08, 11 and 12
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
2. **A mirror page is a beta snapshot.** `07:12` is labelled “Unity 6 Beta”, while the
   international 6000.0 page is labelled “Unity 6.0” and has been reorganized. The two
   claims the book cites it for are on the international “Introduction to Awaitable” page:
   “The pooling of `Awaitable` instances means it's never safe to `await` more than once
   on an `Awaitable` instance”, and “Continuation runs synchronously when completion is
   triggered”.
3. **Two links are pinned to later versions.** `06:88` points at 6000.6, and `11:66` at
   6000.7, which is a beta. Both topics have 6000.0 pages with the same content: the
   fixed-updates page describes the same backlog and catch-up (“There is a maximum
   timestep period beyond which Unity will not attempt to catch up with the simulation”),
   and the markers page documents `Gfx.WaitForPresentOnGfxThread`.
4. **The Addressables pages are for a version Unity 6.0 does not offer.** Unity 6.0's
   package page says “Package version 2.10.3 is released for Unity Editor version 6000.0”,
   and lists 2.10, 2.11, 3.0, 3.1 and 4.0 as the versions available; 1.21 is not among
   them. In 2.10 the memory page is only an index, and the sentence chapter 07 relies on
   is on its child page “Managing asset memory”: “Unity doesn't unload released assets
   from memory immediately, because the memory that an asset uses isn't freed until the
   AssetBundle it belongs to is also unloaded.”
5. **One link cites a page for something it does not say.** `07:157` sends the reader to
   the operation-handle page for the lifetimes of `Object.Instantiate` clones and of
   Addressables instances, but that page, in 1.21 and in 2.10 alike, never mentions
   `Object.Instantiate`, `InstantiateAsync` or `ReleaseInstance`. The 2.10
   `InstantiateAsync` API page is the one that describes the tracked-instance lifetime: “a
   reference from the instance to the handle is stored and released via
   ReleaseInstance(GameObject)”. The book's own explanation of clones is right, and
   matches what Unity's 1.17 memory page said of `GameObject.Instantiate`: “the
   Addressables system has no knowledge of how many instances you created”.
6. **One link reaches its page through two redirects.** `08:162`
   (`…/ManagedCodeStripping.html`) redirects to `…/managed-code-stripping.html`; link the
   address it lands on.

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
| `06:10` | `https://docs.unity3d.com/6000.0/Documentation/ScriptReference/MonoBehaviour.Awake.html` |
| `06:88` | `https://docs.unity3d.com/6000.0/Documentation/Manual/fixed-updates.html` |
| `07:12` | `https://docs.unity3d.com/6000.0/Documentation/Manual/async-awaitable-introduction.html` |
| `07:155` | `https://docs.unity3d.com/Packages/com.unity.addressables@2.10/manual/memory-assets.html` |
| `07:157` | `https://docs.unity3d.com/Packages/com.unity.addressables@2.10/api/UnityEngine.AddressableAssets.Addressables.InstantiateAsync.html` |
| `08:162` | `https://docs.unity3d.com/6000.0/Documentation/Manual/managed-code-stripping.html` |
| `11:14` | `https://docs.unity3d.com/6000.0/Documentation/Manual/ProfilerHighlights.html` |
| `11:66` | `https://docs.unity3d.com/6000.0/Documentation/Manual/profiler-markers.html` |
| `11:167` | `https://docs.unity3d.com/6000.0/Documentation/Manual/performance-incremental-garbage-collection.html` |
| `11:171` | `https://docs.unity3d.com/6000.0/Documentation/Manual/performance-optimizing-arrays.html` |

Two link texts in chapter 07 change with their targets: line 155's “Addressables 1.21
memory guide” becomes the 2.10 guide to managing asset memory, and line 157's
“Addressables operation-handle guide” becomes the `InstantiateAsync` reference.

One note beyond the links: the book's 6.0 baseline is now several releases behind the
documentation's current version, 6.6. Whether to move the baseline is a decision about the
book rather than its links, but it is why pinning matters, since every unversioned Unity
link follows the current release.
