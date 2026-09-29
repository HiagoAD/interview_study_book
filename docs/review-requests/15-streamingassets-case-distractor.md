# A StreamingAssets distractor is a check the chapter itself recommends

**Kind:** Question design. **Priority:** Low. **Touches:** question block, one `-` line (line 213).

## Location

`content/mobile-platform/15-debugging-across-boundaries.md:210-216`, concept `boundary-first-split` (a `?+` variant):

```text
?+ A `System.IO` read of an Android `StreamingAssets` path fails, while the desktop read succeeds. What is the first useful inspection?
* Whether the runtime path is an APK URL requiring another access API
...
- Whether the file's name differs in letter case from the requested one
...
> Android StreamingAssets is inside the compressed APK and the path is a URL. Inspect the path, exact filename and access API before treating the failure as an ordinary missing desktop file.
```

## Evidence

The explanation tells the reader to inspect the exact filename, and the section's table does too (line 134: “A bundled file loads on desktop and not on Android | Compare the exact name and the API used to read its runtime path | Distinguishes spelling and case from a URL being treated as a filesystem path”), and line 123 names case sensitivity as a device difference. So the distractor on line 213 is a check the chapter endorses for this very symptom, and a reader who picks it has followed the text. The correct option is still the better first check, since a `System.IO` read of a URL fails whatever the case, but the set asks the reader to rank two recommended checks without saying why one comes first.

## Proposed fix

Replace line 213 (a distractors pass, `--allow distractors`) with a mistake that the chapter rejects:

`- Whether managed stripping removed the file from the player's data folder`

Stripping removes code, not assets, so the option is wrong for a reason the reader can state, and it keeps the length and grammar of the set. No other line changes, and the variant's review history is kept.

Alternatively, with the user's consent, keep the option and add a sentence to the explanation: “A letter-case mismatch matters only once the file is read through the right API.” That changes an explanation and needs the decision the README describes, with no loss of history.

## Repeated in

Nothing else.
