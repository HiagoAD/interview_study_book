# When the backfill may start: two rules for retiring old writers

**Kind:** Consistency. **Priority:** Low. **Touches:** prose only.

## Location

- `content/mobile-platform/14-running-services.md:343` (the Migrate row's precondition): “Each writer updates both columns in one transaction, and old writers cannot return through rollback”.
- `content/mobile-platform/14-running-services.md:349`: “It is safe on a live database only under the conditions of the table above: … and old writers are retired, including as rollback targets, before the job's result is trusted.”
- `content/mobile-platform/14-running-services.md:389` (explanation of a committed `?+` variant of `design-expand-contract`): “The job starts after old writers and their rollback paths are retired”.

## Evidence

The table and the explanation say the job starts once old writers and their rollback targets are gone. Line 349 says instead that they must be gone before the job's *result is trusted*, which permits starting while old writers still run, and line 365 (“Once old writers are retired, the job repairs null and non-null differences alike”) reads the same way. Both orders are safe, since the job reconciles every difference and can be run again, but the section states two rules for one step, and the review question teaches the stricter one.

## Proposed fix

Line 349, end the sentence as the table does: “… and old writers are retired, including as rollback targets, before the job starts. A run begun earlier does no harm, since the job reconciles every difference, but only a run after their retirement leaves the column complete.”

No question block changes.

## Repeated in

Line 389's explanation, which already matches the fix.
