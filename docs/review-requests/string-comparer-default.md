# Review request: why an ID comparer is explicit

- **Kind:** accuracy
- **Priority:** medium
- **Where:** `content/unity-engineering/06-unity-lifecycle.md:218`, section `unity-serialization`, and `content/unity-engineering/09-data-structures.md:154`, section `structures-hash-collections`
- **Touches:** prose only

## What the book says

Chapter 06, after a catalog built with `StringComparer.Ordinal`:

> The explicit comparer matters for the same reason as in the equality section: an ID
> lookup must not depend on the device's language settings.

Chapter 09:

> Choose the string comparer for technical IDs explicitly. Changing the device language
> should not change whether an item ID is found.

## Why it needs changing

Both sentences imply that a `Dictionary<string, T>` built without a comparer depends on
the device language. It does not. The default is `EqualityComparer<string>.Default`, which
compares ordinally. A scratch program run under a Turkish culture confirms it: the default
dictionary finds `"ID"` and not `"id"`, exactly as `StringComparer.Ordinal` would.

The language does bite, but through other doors, and those are the ones worth teaching:

- a culture-aware comparer, such as `StringComparer.CurrentCultureIgnoreCase`;
- normalizing keys with `ToLower` or `ToUpper`: under `tr-TR`, `"id".ToUpper()` is not
  `"ID"`, because the upper case of `i` there is `İ` (confirmed by the same program);
- the culture-sensitive defaults of `string.Compare`, `StartsWith(string)` and
  `IndexOf(string)`, and of sorting strings with the default comparer.

Chapter 04's own advice (line 137) is accurate and makes no such claim, so the two later
sentences attribute to it a reason it never gave.

## Proposed fix

Chapter 06:

> The explicit comparer does not change the result, since a dictionary compares strings
> ordinally by default; it records the rule, so that a later switch to a case-insensitive
> or culture-aware comparer is a visible decision rather than a quiet one. The device's
> language enters through those comparers, and through normalizing IDs with `ToLower`,
> which under a Turkish locale does not map `I` to `i`.

Chapter 09:

> Choose the string comparer for technical IDs explicitly, and do not normalize them with
> `ToLower` or `ToUpper`, which follow the device's language: changing it can then change
> whether an item ID is found. Searching display names can follow a separate rule suited
> to the user's language.

## Also check

No question tests the default comparer, so the questions in both sections
(`unity-serialization-version`, `unity-field-migration`, `structures-set-choice`,
`structures-order-contract`) are unaffected.
