# Review request: code samples that do not do what the prose says

- **Kind:** accuracy
- **Priority:** medium for the first two, low for the rest
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

## 5. The energy refill drops partial progress (low)

`10-game-algorithms.md:250`: `min(cap, stored + floor(elapsed / interval))` is right for
the count, but a reader implementing it will reset the refill timestamp to now and lose up
to one interval on every resume. Add that the stored timestamp advances by the whole
intervals granted, and moves to now only when the cap is reached.
