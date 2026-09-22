# Review request: the Addressables summary promises too much

- **Kind:** accuracy, in a glossary summary, which is what a preview card shows
- **Priority:** medium
- **Where:** `content/unity-engineering/glossary.md:21`, entry `addressables`
- **Touches:** a glossary summary

## What the entry says

> Unity's package for loading assets by address rather than through a direct reference,
> returning handles it reference counts. Each acquisition has a matching release, and the
> memory is freed when nothing holds the asset any more.

## Why it needs changing

The last clause is the misconception chapter 07 sets out to correct. Releasing the last
handle to an asset does not by itself free that asset while the bundle it came from stays
loaded, and a bundle stays loaded while anything else in it, or anything that depends on
it, is still held. Chapter 07 says so (line 155: “Releasing a handle may not free all
associated memory immediately, because other references, dependencies, or bundles can keep
it loaded”), and the entry's own third paragraph says so again.

Unity's documentation states it outright. Addressables 2.10, the version released for
Unity 6.0, in its page on managing asset memory: “Unity doesn't unload released assets
from memory immediately, because the memory that an asset uses isn't freed until the
AssetBundle it belongs to is also unloaded.” The 1.21 memory page chapter 07 links adds
the one exception: nothing in a bundle unloads until the bundle does, except through
`Resources.UnloadUnusedAssets`, which it calls “a slow operation”. The “by itself” in the
proposed summary leaves room for that exception.

The summary is the only part a hover shows, so a reader who never opens the entry takes
the wrong model from the one sentence they read.

## Proposed fix

> Unity's package for loading assets by address rather than through a direct reference,
> returning handles it reference counts. Each acquisition needs a matching release, and
> releasing the last handle does not by itself free an asset whose bundle is still loaded.

About 250 characters, inside the 400-character limit `npm run check` enforces on a
summary.
