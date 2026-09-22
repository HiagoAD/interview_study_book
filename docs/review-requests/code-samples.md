# Review request: code samples that do not do what the prose says

- **Kind:** accuracy
- **Priority:** medium
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
