# Review request: managed wrapper and engine object

- **Kind:** forward reference
- **First used:** `content/unity-engineering/01-architecture.md:196`, section `architecture-dependencies`, and the sequence at `:220-224`
- **Explained in:** `content/unity-engineering/06-unity-lifecycle.md:242`, section `unity-destruction`
- **Distance:** five chapters
- **Now covered by:** nothing. There is no glossary entry, and neither chapter 01 mention carries a link.

## What the reader meets first

> Check any service that keeps a reference to an object with a shorter lifetime. A static
> event, for example, can keep a scene HUD's managed wrapper reachable after the scene
> unloads.

and, a few paragraphs later, the sequence the section uses to make its point:

> The service still holds the delegate, so the managed HUD stays reachable.
> Mute changes. The delegate runs against a HUD whose engine object is gone.

## Why this needs a decision

It is the one forward reference found by the second read that the glossary does not cover,
because the first read's list of terms did not include it.

The sequence only makes sense to a reader who knows that a Unity object is two objects: a
C# wrapper that stays reachable while anything refers to it, and the engine object that
`Destroy` or a scene unload removes. Without that, “the managed HUD stays reachable” and
“whose engine object is gone” read as a contradiction, and the lifetime lesson of the
section rests on exactly that pair of lines. Chapter 06 explains the split properly,
together with the overloaded `==` that makes a destroyed object compare equal to null,
which is the other half of the same fact.

Unity engineers often know this as “fake null”, but it is less universal than prefab or
Inspector, and it is an interview question in its own right, so the vocabulary argument
that closed the coroutine and singleton requests in Phase 11 is weaker here.

## Options

1. **Add a glossary entry and link the first mention (recommended).** The book's rule is
   to link a section where one explains the term, but `unity-destruction` is the fifth of
   six sections in chapter 06, locked for a reader still in chapter 01, so a section link
   would preview a locked notice. An entry is always reachable. For example
   `## Destroyed Unity object {#destroyed-unity-object}`, with
   `= managed wrapper | fake null | Unity null`, and a summary such as:

   > A `UnityEngine.Object` is a C# wrapper around an object the engine owns. Destroying
   > it, or unloading its scene, removes the engine object while the wrapper stays
   > reachable, and Unity's overloaded `==` then reports the wrapper as null, although
   > `is null`, `?.` and `??` do not.

   ending, as the other forward-reference entries do, with a pointer to
   `[[#unity-destruction]]`. Then link `[[managed wrapper]]` at line 196.
2. **Say it in chapter 01.** One clause at line 196: “can keep a scene HUD's managed
   wrapper, the C# half of a Unity object, reachable after the scene unloads and destroys
   the engine half.” Costs a clause and needs no entry.
3. **Leave it.** Defensible only on the vocabulary argument, which is weaker here than for
   coroutine or singleton, because the chapter 01 sequence depends on the detail rather
   than using the word in passing.
