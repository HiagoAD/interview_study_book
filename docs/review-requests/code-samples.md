# Review request: code samples that do not do what the prose says

- **Kind:** accuracy
- **Priority:** medium for the first three, low for the rest
- **Touches:** prose and code fences only; no question quotes these samples

## 1. The migration chain applies the wrong step (medium)

`13-liveops-and-releases.md:101-107`, section `liveops-save-migration`:

```text
migrations = [ v1_to_v2, v2_to_v3, v3_to_v4 ]
...
    while doc.version < CurrentVersion:
        doc = migrations[doc.version].Apply(doc)
```

Read with the zero-based indexing the book's C# uses everywhere else, a version 1 save
gets `migrations[1]`, which is `v2_to_v3`, and skips its own step. The section is about
migrations that are correct by construction, so an off-by-one in its model code is worth
removing. Use `migrations[doc.version - 1]`, or key the steps by the version they start
from.

## 2. The lazy-deletion example still leaks (medium)

`09-data-structures.md:192-207`, section `structures-specialized`. The text says that
removing the marker as the entry is dropped “keeps the cancelled set from growing without
limit”. It does not cover the late cancel: `Cancel(taskId)` for a task that has already
been popped and run adds a marker that no entry will ever meet, and it stays forever. That
is the stale callback this book warns about in every other chapter, arriving at the
scheduler. `Cancel` needs to ignore an id that is no longer pending, through a set of
pending ids or a state on the task, and the sentence should say which case the marker
removal covers.

## 3. The wallet's invariant is half enforced (medium)

`05-principles-and-patterns.md:22-41`, section `oop-encapsulation`. The comment says
“Balance is never negative and never exceeds Maximum”, and the text says “The invariant is
one comment and two conditions.” But `Maximum` has no constructor or setter, so it is
always 0; there is no way to add money; and nothing checks the upper bound. The two
conditions in `TrySpend` protect only the lower one. Either add a constructor and a
`TryGrant` that checks `Maximum`, following the `TryGrant` in chapter 04 at line 367, or
drop the `Maximum` half of the comment. The paragraph's argument, that the guarantee comes
from the absence of any other way in, is unaffected.

## 4. `Start` does not run inside `SetActive` (low)

`06-unity-lifecycle.md:42`:

```csharp
instance.SetActive(true);   // Awake, then OnEnable, then Start run from here.
```

`Awake` and `OnEnable` run inside that call; `Start` runs later, before the component's
first `Update`. The table at line 56 has it right. Suggested comment:
`// Awake and OnEnable run inside this call; Start runs before the first Update.`

## 5. The energy refill drops partial progress (low)

`10-game-algorithms.md:250`: `min(cap, stored + floor(elapsed / interval))` is right for
the count, but a reader implementing it will reset the refill timestamp to now and lose up
to one interval on every resume. Add that the stored timestamp advances by the whole
intervals granted, and moves to now only when the cap is reached.

## 6. `CollectResult` cannot be constructed (low)

`02-power-up-design.md:280-285`: a `readonly struct` with get-only properties and no
constructor, so every instance holds default values. Add the constructor, or a comment
saying it is omitted, as chapter 04 marks its “Illustrative fragment”.

## 7. A discarded task in the cancellation example (low)

`07-async-and-assets.md:109`: `_ = LoadArtworkAsync(item, generation, cts.Token);`
discards the task, the pattern line 23 of the same chapter warns against (“Give callers a
way to observe failure”). One comment makes it deliberate:
`// LoadArtworkAsync catches and logs its own failures.`
