# Review request: where a Play Mode write to a ScriptableObject goes

- **Kind:** accuracy
- **Priority:** medium
- **Where:** `content/unity-engineering/02-power-up-design.md:55`, section `powerup-data-model`, and the `scriptableobject` entry, `content/unity-engineering/glossary.md:189`
- **Touches:** prose and a glossary body

## What the book says

Chapter 02:

> Changes written into a ScriptableObject asset during Play Mode can persist in the Editor
> after you stop, because the asset on disk was modified.

The glossary:

> a write during play mode can persist on disk after play stops

## Why it needs changing

The lesson is right and worth keeping: in the Editor the write survives Play Mode, and in
a player it does not. The mechanism is not. A script that assigns a field changes the
loaded asset object, not the file. Leaving Play Mode does not reload assets, so the change
stays visible for the rest of the Editor session. It reaches the `.asset` file only if
something later saves that asset, and a plain field assignment does not even mark it
dirty. Restart the Editor before a save and the change is gone.

Unity's 6.0 manual page on ScriptableObject, the one chapter 02 links, says the same. “In
the Unity Editor, you can save data to ScriptableObjects in Edit mode and Play mode. In a
standalone Player at runtime, you can only read saved data from the ScriptableObject
assets.” And: “Unity doesn't automatically save changes to a ScriptableObject made via
script in Edit mode”, so a script calls `EditorUtility.SetDirty` for the change to be
saved; without it, “the change to highScore appears in memory, but if you close and reopen
the Editor the value reverts to its previous value.” The manual states this for Edit mode.
The reasoning carries over to a write made in Play Mode, since the script changes the same
loaded object and nothing marks it for saving, but that step is this review's inference
rather than Unity's sentence.

The difference explains the two symptoms a reader will actually meet: a value that “stuck”
for a day and then vanished after a restart, and a value that turns up in a commit nobody
meant to make, because an unrelated Inspector edit dirtied the asset and saved the runtime
write along with it.

## Proposed fix

Chapter 02:

> Changes written into a ScriptableObject asset during Play Mode can persist in the Editor
> after you stop, because the Editor keeps the loaded asset rather than reloading it. The
> change reaches the file on disk only if the asset is saved afterward, which can happen
> by accident when someone edits it in the Inspector.

The glossary, in the same sentence:

> a write during play mode stays in the loaded asset after play stops, and can reach disk
> the next time that asset is saved, while the same write in a player build lands in a
> loaded copy that disappears with the process.

## Also check

The entry's sentence is in its body, not its summary, so the 400-character limit does not
apply. No question tests where the write goes.
