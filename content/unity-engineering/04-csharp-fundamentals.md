---
book: Unity Game Engineering
chapter: 04: C# semantics that affect gameplay correctness
---

## Value types, reference types, and copying {#csharp-value-reference}

A value-type variable holds a value, and assignment normally copies it. A reference-type variable holds a reference to an object; assignment copies that reference, so two variables can refer to the same object. A struct can contain reference fields too. Copying the struct copies those references, leaving both structs pointing to the same referenced objects. [Microsoft's value-type reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types) describes these copy semantics.

```csharp
using System.Collections.Generic;

public struct InventorySnapshot
{
    public int Coins;
    public List<string> Items;
}

// Inside a method:
// var a = new InventorySnapshot {
//     Coins = 10, Items = new List<string> { "magnet" }
// };
// var b = a;
// b.Coins = 20;
// b.Items.Add("shield");
// a.Coins is still 10, but a.Items now contains both items.
```

The example shows why “struct means deep copy” is incorrect: the integer is copied, but both structs still refer to the same list. The rule “structs live on the stack and classes live on the heap” is also too simple to guide a design. A struct can be a field in a heap object, an array element, or a boxed value. Choose a type based on how it should be copied and changed, its size, and how the program uses it.

Small immutable values work well for coordinates, IDs, and compact command results. Use reference identity and clear ownership for mutable entities that several callers share. Large structs can cost more to copy. Also remember the limit of `readonly struct`: its instance fields cannot be reassigned, but an object referenced by one of those fields may still be mutable.

By default, a method parameter receives a copy. If that copy is a reference, the method can change the referenced object. Assigning a different object to the parameter, however, does not replace the caller's variable. The parameter modifiers change this contract: `ref` exposes the caller's storage, `out` requires assignment before a normal return, and `in` passes a readonly reference. Some uses of `in` still cause defensive copies. Choose the passing behavior you need first, then measure any expected performance benefit.

Reading a struct through a `List<T>` index returns a value. To change an ordinary mutable struct in that list, copy the element, change the copy, and assign it back. An array element can behave differently because it is itself a variable location. Immutable updates can make ownership easier to follow when they fit the problem.

?? csharp-shallow-copy A struct contains an integer and a `List<string>`. After copying the struct, what is shared?
* The list object referenced by both copies.
- The storage location of the integer field.
- Every field through automatic deep cloning.
- Nothing, because structs cannot contain references.
> Struct copying copies each field's value. A reference field's value is the reference, so the referenced object remains shared.

?+ A method receives a class instance without `ref` and assigns its parameter to a new object. What happens to the caller's variable?
* It still references the original object.
- It necessarily references the new object.
- It becomes null.
- It is converted into a value type.
> The parameter holds a copy of the reference. Reassigning that copy does not reassign the caller's variable.

?+ What does this method print?
```csharp
static void Example()
{
    var first = new System.Collections.Generic.List<int> { 1 };
    var second = first;
    second.Add(2);
    second = new System.Collections.Generic.List<int> { 9 };
    System.Console.WriteLine(first.Count);
}
```
* 2.
- 1.
- 3.
- 9.
> Both variables first reference the same list, so adding through second changes that list. Reassigning second afterward does not change first's reference.

## Equality, hashing, and stable identifiers {#csharp-equality-hashing}

Object identity asks whether two references point to the same object. Value equality asks whether two values mean the same thing. Mission IDs should usually compare by identifier value. Two scene components, however, do not become interchangeable just because their visible properties match.

Hash collections depend on one rule: values that compare equal must have equal hash codes. Different values can still have the same hash; that is a collision. A hash code is therefore unsuitable as a globally unique ID. Runtime hash codes should not be saved as persistent identifiers either.

Microsoft's [GetHashCode contract](https://learn.microsoft.com/en-us/dotnet/api/system.object.gethashcode) documents these equality and persistence restrictions.

While an object is a key in a dictionary or set, keep the fields used for equality and hashing unchanged. If those fields change, a lookup may calculate a different bucket from the one used at insertion. The collection can then fail to find or remove a key that it still contains.

A pooled entity key can combine its slot and generation:

```csharp
using System;

public readonly struct SpawnId : IEquatable<SpawnId>
{
    public int Slot { get; }
    public uint Generation { get; }

    public SpawnId(int slot, uint generation)
    {
        Slot = slot;
        Generation = generation;
    }

    public bool Equals(SpawnId other) =>
        Slot == other.Slot && Generation == other.Generation;

    public override bool Equals(object obj) =>
        obj is SpawnId other && Equals(other);

    public override int GetHashCode()
    {
        unchecked { return (Slot * 397) ^ (int)Generation; }
    }
}
```

This hash function can produce collisions. The collection uses the key's fields to check equality and distinguish those keys. The example leaves out validation, such as checking whether a slot is in range. Very long-lived pools also need a plan for generation numbers wrapping around: use a wider number, or ensure that old identities cannot survive until a generation is reused.

Choose a comparer explicitly for string IDs. `StringComparer.Ordinal`, for example, fits case-sensitive technical identifiers. Comparing text for display to a user is a different task. Case-insensitive IDs can also work, provided authoring, storage, and lookup all follow the same rule.

?? csharp-hash-contract Which hashing rule must an equality comparer satisfy?
* Equal values must produce equal hash codes.
- Different values must always produce different hash codes.
- A hash code must remain stable across all application versions.
- Hash collisions prove the collection is corrupted.
> Hashing narrows the search; equality establishes a match. Collisions are expected, while inconsistent hashes for equal keys break lookup assumptions.

?? csharp-mutable-key Why is changing a dictionary key's equality fields dangerous?
* Its new hash may no longer identify the bucket where it was inserted.
- Dictionaries automatically deep-copy every key.
- Mutable keys always throw during assignment.
- It changes the dictionary into a list.
> Hash-based lookup relies on the key's equality and hash behavior remaining stable while it is stored.

?+ Two unequal spawn IDs produce the same hash code. What should a correct dictionary do?
* Use equality to distinguish them and allow both keys.
- Treat them as the same key solely because their hashes match.
- Corrupt both entries automatically.
- Require every key to receive a globally unique hash.
> Hash collisions are valid. Equality resolves candidates within the relevant hash structure.

## Generics, boxing, and allocation claims {#csharp-generics-boxing}

Generics let a collection or algorithm keep its element type. A `List<int>`, for example, stores integers without boxing each one as an `object`. Converting a value type to `object`, or to an interface reference that it implements, ordinarily creates a managed object containing a copy; this is boxing. Unboxing must recover the actual boxed type. A boxed `int` cannot be directly unboxed as `long`. [Microsoft's conversions guide](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/conversions) explains the conversion rules.

```csharp
int count = 7;
object boxed = count;
count = 8;
int recovered = (int)boxed; // 7: boxing captured a copy.
long widened = (int)boxed; // Unbox int, then widen to long.
```

Using an interface does not necessarily allocate an object on each call. Converting a class reference to an interface reference does not box the object. Assigning a struct to an interface variable may box it, while some constrained generic calls can avoid boxing. The result depends on the operation and generated code, so measure the relevant build before deciding to remove interfaces.

Allocations can also come from captured variables in closures, new arrays, string formatting, iterator state machines, and collections growing their capacity. The details depend on the API, compiler, and runtime. Check how often the work happens: a small allocation repeated for every object in every frame can add up quickly.

Suppose 500 active objects each allocate 128 bytes per frame at 60 frames per second. That produces 3,840,000 bytes of allocations per second, or about 3.84 MB/s in decimal units. It does not necessarily add 3.84 MB to retained memory every second: the garbage collector may reclaim those objects.

Apply the same reasoning to queries. A LINQ query used during occasional setup may cost little enough to keep. The same query in every object's `Update` needs measurement. Pooling is another tradeoff: use it when the saved work justifies the extra rules for ownership and cleanup.

?? csharp-boxing-copy What value does `recovered` contain in the boxing example?
* 7.
- 8.
- A reference to `count`.
- An undefined value because integers cannot be boxed.
> Boxing copies the current value into a managed object. Later changes to the original variable do not change that boxed copy.

?? csharp-interface-allocation [tf] Calling any interface method necessarily allocates a new object.
* false
> Interface calls on existing class objects do not inherently allocate. Boxing can occur when value types are converted to interface references, and other work inside the method may allocate.

?+ Which conversion is an ordinary boxing case?
```csharp
struct Counter : System.IComparable<Counter>
{
    public int CompareTo(Counter other) { return 0; }
}
// Inside a method:
// Counter value = new Counter();
// System.IComparable<Counter> reference = value;
```
* Assigning the struct value to the interface-typed variable.
- Declaring the interface implementation on the struct by itself.
- Declaring a local integer inside a synchronous method.
- Assigning an existing class instance to its implemented interface.
> Converting a struct value to an interface reference ordinarily boxes a copy. Merely implementing an interface does not allocate an instance.

## Delegates, events, closures, and lifetime {#csharp-events-lifetime}

A delegate represents a callable target. An event lets other code subscribe, while leaving invocation under the control of the declaring type's implementation. That makes events useful for notifications, but does not guarantee reliable delivery, thread safety, or isolation between handler errors.

When you subscribe an instance method, its delegate keeps a reference to the subscriber. If the publisher lives longer than the intended subscription, unsubscribe when that subscription should end. For an anonymous lambda, keep the exact delegate instance if you will need to remove it later. Microsoft documents these concerns in its [event subscription guide](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/events/how-to-subscribe-to-and-unsubscribe-from-events).

Pair subscription and unsubscription with the period during which a view should listen. In Unity, `OnEnable` and `OnDisable` can work if the model reference is ready and the view should listen whenever it is enabled. A presenter with an explicit binding lifetime may instead use `Bind(model)` and `Unbind()`.

A closure captures variables, which may change before the callback runs. If callbacks created in a `for` loop each need their own index value, copy the index into a new local variable inside each iteration. Also check which objects the closure keeps alive. A lambda that references a large owner can retain that owner and everything still reachable through it.

Event data should describe what happened at the time of the event. If it contains a mutable collection that changes later, observers may see different versions of the same event. Copy the required values, or use immutable data, when observers need a lasting snapshot.

Whichever binding method you use, ensure each subscription is added only once. Repeated activation can attach the same handler again and cause duplicate callbacks. Test enable-disable-enable sequences, as well as switching a view to another model. A report that “The event fires twice” may come from duplicate subscriptions.

?? csharp-event-retention Why can a long-lived publisher retain an otherwise unused subscriber?
* Its event delegate references the subscriber's instance method target.
- C# garbage collection never collects classes.
- Every event permanently stores all local variables in the program.
- Unloading a scene always removes every C# delegate automatically.
> A delegate can keep the subscriber reachable, so garbage collection cannot reclaim it. Unsubscribe when the subscriber should stop listening.

?? csharp-closure-index Several callbacks created in a `for` loop all use the final index. What is a direct fix?
* Capture a distinct local copy of the index for each iteration.
- Increase the list capacity.
- Change every callback into a static event.
- Invoke garbage collection before the callbacks run.
> Several callbacks may capture the same loop variable and read its later value. A local variable created in each iteration gives each callback a separate value to capture.

## Enumeration, deferred execution, and mutation {#csharp-enumeration}

An `IEnumerable<T>` describes how to visit a sequence of values. It does not guarantee that the values have already been collected into a snapshot. Many LINQ operations wait until enumeration to do their work. Enumerating the same query twice can therefore repeat that work and read different source state.

```csharp
// Illustrative fragment; players is a collection of player models.
// var alive = players.Where(player => player.IsAlive);
// ChangePlayerState();
// foreach (var player in alive) { ... }
// The predicate sees state at enumeration, not query construction.
```

Use `ToArray` or `ToList` when you need to capture which elements are in a sequence at a particular moment. That allocates storage and copies the elements. If the elements are references, the copy still points to the original objects; it does not freeze their fields.

Changing a typical list during a `foreach` loop invalidates its enumerator. You can instead collect the removals and apply them afterward, or walk indices backward when removing elements. Other collections may support different rules for changes during iteration. Check the contract of the collection and runtime you use.

Walking backward prevents removal from skipping an element that shifts into an earlier index. Each `RemoveAt` can still move data, though. For a large filtering pass, it may be cheaper to compact the surviving elements once. If order does not matter, move the last element into the removed slot instead; this is swap-back removal, and any stored index mappings must be updated.

Check for hidden repeated enumeration. A method that accepts `IEnumerable<T>` cannot assume that calling `Count()` and then looping over the sequence is cheap or free of side effects. If appropriate, collect the values once. If the method requires a count and indexed access, consider requesting a more specific read-only collection type.

?? csharp-deferred-query When does a deferred filtering query usually evaluate its predicate?
* When the sequence is enumerated.
- Necessarily when the query variable is assigned.
- Only when garbage collection runs.
- Only when the source list is first created.
> Deferred execution separates describing a query from performing its work. Source changes before enumeration can change the result.

?? csharp-snapshot-depth A list of player references is copied with `ToArray`. What has been snapshotted?
* The sequence of references, not the mutable fields inside each player.
- Every player's entire reachable object graph.
- Only the list capacity.
- Future membership changes in the original list.
> `ToArray` records which references are in the sequence at that moment. It does not copy the player objects, whose fields can still change.

## Errors, cleanup, and numeric boundaries {#csharp-errors-numbers}

Distinguish normal rejection from a failure that needs recovery. Insufficient currency, an incomplete mission, or a cancelled view load can be expected outcomes. A missing required dependency or a corrupt definition means an assumption is broken. An I/O error needs a policy for retrying, reporting failure, or otherwise recovering.

For frequent, expected rejection, return a result or use a `Try...` method. Use an exception when normal execution cannot continue at that layer. Catch it where you can recover, explain it in terms the caller understands, or add debugging context before rethrowing. Logging every exception and then returning success leaves the caller unable to tell what happened.

Use `using` or `try/finally` to clean up resources at a defined point. Garbage collection handles managed memory that is no longer reachable. It does not replace closing a file handle, disposing a native allocation, or releasing an asset handle according to a package's rules.

Define the valid numeric inputs and what happens at their limits. Coins, for example, are discrete quantities and suit integer units, but integers can still overflow. Validate ranges, use checked arithmetic where appropriate, and decide whether an excessive amount is rejected or capped. Reject negative spend amounts, so corrupt or malicious input cannot turn spending into a grant.

Floating-point calculations produce approximations. For computed geometry, choose comparison tolerances that fit the scale and purpose of the calculation. A tolerance is not appropriate for every rule, however. A timer with a precise clock contract may correctly use an exact comparison against its deadline.

Check non-finite values explicitly. For `NaN`, a comparison such as `value <= 0` is false, so that test alone cannot establish that a duration is positive and finite. Positive infinity also passes a positivity check. Validate all the allowed values for content and external input.

?? csharp-nan-validation Why does `duration <= 0` alone fail to validate a positive finite duration?
* `NaN` does not satisfy that comparison, and positive infinity also passes it.
- All floating-point values are negative.
- C# converts `NaN` to zero before comparison.
- Every duration requires a string representation.
> Check for `NaN` and infinity explicitly, as well as checking the sign and allowed range.

?? csharp-result-vs-exception Which outcome is normally best represented as an expected purchase rejection?
* The player lacks the required currency.
- A supposedly required wallet dependency is missing.
- The content schema cannot be parsed at all.
- A programming invariant is violated internally.
> Insufficient funds is ordinary product behavior. A clear result lets the caller show the intended response without treating routine rejection as an exceptional crash.
