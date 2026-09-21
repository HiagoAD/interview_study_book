---
book: Unity Game Engineering
kind: glossary
---

## Observer {#observer}
= observer pattern | observers

A source that announces facts, and listeners that react to them, with no reference from the source to any listener. UI and audio reacting to a reward that has already been granted is the usual gameplay case.

The value is direction. The wallet does not know the HUD exists, so the HUD can be deleted, duplicated, or opened from two screens without the wallet changing. That is also the risk: the source no longer knows who runs, in what order, or whether anyone is still listening.

Three problems are worth naming before an interviewer names them. Order: listeners run in subscription order, which is an accident of scene load, so no listener may depend on another having run first. Retention: a subscription keeps the listener alive, so a view that forgets to unsubscribe leaks and keeps reacting after it is closed. Reentrancy: a listener that causes the same event to fire again re-enters the source mid-notification, where half the state has been updated and half has not.

Announce facts that have already happened, rather than requests. “Reward granted” can be handled by any number of listeners in any order. “Grant reward” cannot, because two listeners would grant it twice.

## State {#state-pattern}
= state | state object

One object per phase of a run, each holding the behavior for that phase and the moves out of it. It replaces a growing switch when the phases have substantial behavior of their own.

A run that is ready, running, paused, dead, or finished can be an enum and a switch, and for three short phases that is usually the clearest thing to write. The pattern earns its place when each phase carries real behavior: its own update, its own entry and exit work, its own input handling.

The cost is navigation. Five classes and an interface replace one readable switch, and the transition table that used to sit in one place is now spread across the classes that perform the moves. Keeping the allowed transitions in one table, even when the behavior lives in state objects, is what holds that cost down.

Draw the transitions before choosing, as [[#patterns-selection]] suggests: ready to running, running to paused, paused to running, running to dead, and dead to revived or finished. If the drawing is small and the phases are thin, the enum wins.

## Strategy {#strategy}
= strategy pattern | strategies
-> state-pattern

One interchangeable rule behind a small interface, so a caller can run the rule without knowing which one it holds. Aim selection, reward selection, and difficulty curves are the usual gameplay cases.

A strategy separates the rule from the moment it is chosen. The caller keeps a reference to the interface and calls it, while which implementation sits behind that reference is decided elsewhere, usually where the object is built.

```csharp
public interface IAimPolicy
{
    Transform Choose(IReadOnlyList<Transform> targets);
}

public sealed class Turret
{
    private readonly IAimPolicy aim;

    public Turret(IAimPolicy aim) => this.aim = aim;
}
```

What justifies it is variation that already exists: two aim rules, a reward table per event, a difficulty curve per platform. Naming that variation is what separates a strategy from indirection nobody needed. One fixed rule behind an interface costs a file, a reference, and a call, and buys nothing until the second rule arrives.

Testing is the other common reason. A policy with no engine references can be exercised with plain values, which is harder when the rule is a private method on a MonoBehaviour.

The pattern says nothing about where the choice is made. A factory, a preset asset, or the composition root can all supply it, and that decision is usually more interesting than the interface itself.
