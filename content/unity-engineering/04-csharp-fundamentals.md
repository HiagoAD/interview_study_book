---
book: Unity Game Engineering
chapter: 04: C# semantics that affect gameplay correctness
---

## Value types, reference types, and copying {#csharp-value-reference}

A variable of a value type contains a value; assignment normally copies that value. A variable of a reference type contains a reference; assignment copies the reference, so two variables can refer to the same object. A struct can contain references, and copying it copies those references rather than cloning their objects. [Microsoft's value-type reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types) describes these copy semantics.

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

This is why “struct means deep copy” is incorrect. It is also why “structs live on the stack and classes live on the heap” is a poor design rule. A struct can be a field of a heap object, an element of an array, or boxed. Choose by semantics, size, mutation, and measured usage rather than by that slogan.

Small immutable values suit coordinates, IDs, and compact command results. Shared mutable entities suit reference identity and controlled ownership. Large structs can be expensive to copy. A `readonly struct` prevents reassignment of its instance fields but does not make an object referenced by a field immutable.

A method parameter also receives a copy by default. Passing a class reference lets the method mutate the referenced object, but assigning that parameter to another object does not replace the caller's variable. `ref` exposes the caller's storage; `out` requires assignment before normal return; `in` is a readonly reference with subtleties around defensive copies. Choose these modifiers for the passing semantics you need, then measure any claimed performance benefit.

With `List<T>`, indexing a struct returns a value. To update an ordinary mutable struct element, copy it, modify the copy, and assign it back. An array element can behave differently because it is a variable location. Prefer immutable updates when they make ownership clearer.

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

Identity asks whether two references represent the same object. Value equality asks whether two values represent the same logical value. A mission ID should usually compare by its identifier value; two scene components are not interchangeable merely because their visible properties match.

Hash collections require a contract: values considered equal must have equal hash codes. Unequal values may collide. A hash code is therefore not a globally unique ID, and runtime hash codes should not be saved as persistent identifiers.

Microsoft's [GetHashCode contract](https://learn.microsoft.com/en-us/dotnet/api/system.object.gethashcode) documents these equality and persistence restrictions.

Never mutate fields used for equality or hashing while an object is a key in a dictionary or set. Its current hash can lead to a different bucket than the one used when it was inserted, making lookup or removal fail.

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

The hash function can collide; the collection resolves equality using the key's fields. This example omits domain checks such as valid slot bounds. Generation wraparound must also be considered for extremely long-lived pools; a wider generation or a policy that prevents stale identities surviving wraparound can address it.

For string IDs, specify a comparer such as `StringComparer.Ordinal` when identifiers are case-sensitive technical tokens. User-facing language comparisons are a different problem. A case-insensitive identifier scheme is possible, but must be consistent in authoring, storage, and lookup.

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

Generics allow a collection or algorithm to retain its element type. A `List<int>` stores integers without boxing each one as `object`. Boxing a value type to `object`, or to an implemented interface reference, ordinarily creates a managed object containing a copy. Unboxing expects the boxed value's actual type; a boxed `int` cannot be directly unboxed as `long`. [Microsoft's conversions guide](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/conversions) explains the conversion rules.

```csharp
int count = 7;
object boxed = count;
count = 8;
int recovered = (int)boxed; // 7: boxing captured a copy.
long widened = (int)boxed; // Unbox int, then widen to long.
```

Interface-based architecture does not inherently allocate on every call. A class reference converted to an interface reference does not box the object. A struct assigned to an interface variable may box. Constrained generic calls can avoid some boxing, depending on the operation and generated code. Measure the relevant build instead of banning interfaces.

Other common allocation sources include closures that capture state, new arrays, string formatting, iterator state machines, and collection capacity growth. The exact behavior depends on the API and compiler/runtime combination. Small allocations add up when the operation runs for every object on every frame.

For example, allocating 128 bytes per active object per frame across 500 objects at 60 frames per second produces 3,840,000 bytes per second of allocation traffic. That is about 3.84 MB/s in decimal units, not necessarily a 3.84 MB increase in retained memory each second. Garbage collection may reclaim those objects.

Check how often the query runs. A LINQ query during rare setup may cost little enough to keep; the same query in every object's `Update` deserves measurement. Introduce pooling only when its saved work justifies the additional cleanup and ownership rules.

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

A delegate represents a callable target. An event exposes subscription while restricting invocation to the declaring type's implementation. Events help describe notifications, but they do not define delivery durability, thread safety, or error isolation.

An instance-method subscription retains a reference to the subscriber through the delegate. If the publisher outlives the subscriber's intended scope, unsubscribe at that scope boundary. An anonymous lambda is difficult to remove unless the exact delegate instance is retained. Microsoft documents the retention and unsubscription concerns in its [event subscription guide](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/events/how-to-subscribe-to-and-unsubscribe-from-events).

For a view that listens only while visible, pair binding and unbinding. In Unity that can be `OnEnable` and `OnDisable` if the reference is ready and visibility matches the subscription lifetime. An explicitly bound presenter may instead expose `Bind(model)` and `Unbind()`.

A closure captures variables, not necessarily their values at the point you imagine. In a `for` loop that creates callbacks, copy the index into a per-iteration local if each callback should retain a distinct value. Also consider what the closure retains: a lambda that references a large owner object can keep its entire reachable graph alive.

Define event payloads as facts. A payload containing a mutable collection that changes after publication can make observers see inconsistent history. Copy the necessary values or use an immutable representation when a durable snapshot is required.

Whichever binding method you choose, subscribe once. Repeated activation can attach the same handler repeatedly, resulting in duplicate callbacks. Test enable-disable-enable sequences and bind-to-another-model transitions. “The event fires twice” often begins with a lifecycle defect rather than a faulty dispatcher.

?? csharp-event-retention Why can a long-lived publisher retain an otherwise unused subscriber?
* Its event delegate references the subscriber's instance method target.
- C# garbage collection never collects classes.
- Every event permanently stores all local variables in the program.
- Unloading a scene always removes every C# delegate automatically.
> Reachability through a delegate is still reachability. End subscriptions when the subscriber's intended binding ends.

?? csharp-closure-index Several callbacks created in a `for` loop all use the final index. What is a direct fix?
* Capture a distinct local copy of the index for each iteration.
- Increase the list capacity.
- Change every callback into a static event.
- Invoke garbage collection before the callbacks run.
> A captured loop variable can be shared among callbacks. A per-iteration local provides separate captured storage.

## Enumeration, deferred execution, and mutation {#csharp-enumeration}

An `IEnumerable<T>` describes how to enumerate values; it does not promise a materialized snapshot. Many LINQ operations defer work until enumeration. Enumerating the same query twice can repeat work and observe different source state.

```csharp
// Illustrative fragment; players is a collection of player models.
// var alive = players.Where(player => player.IsAlive);
// ChangePlayerState();
// foreach (var player in alive) { ... }
// The predicate sees state at enumeration, not query construction.
```

Call `ToArray` or `ToList` when a snapshot of the membership is required, while acknowledging the allocation and copy cost. A shallow snapshot of references does not freeze each referenced object's fields.

Changing a typical list while enumerating it with `foreach` invalidates its enumerator. Safe alternatives include gathering removals for a second pass, walking indices backward for removals, or using a data structure and algorithm with an explicit mutation contract. Do not generalize one collection's behavior to every collection or runtime version.

Backward index removal avoids skipping shifted entries, but each `RemoveAt` can still shift data. A large filtering pass may be better implemented by compacting survivors once. If order is irrelevant, swap-back removal can avoid shifting, provided any index mappings are repaired.

Repeated enumeration is another hidden cost. A method accepting `IEnumerable<T>` should not assume that `Count()` and then a second pass are cheap or side-effect-free. Materialize once when appropriate, or require a more specific read-only collection contract if the method needs count and indexing.

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
> Materializing a reference sequence copies its membership at that moment. It does not deep-copy the referenced models.

## Errors, cleanup, and numeric boundaries {#csharp-errors-numbers}

Separate expected rejection from exceptional failure. Insufficient currency, a mission that is not complete, and a cancelled view load can be normal outcomes. A missing required dependency or corrupt definition is a broken precondition. An I/O failure is an operational failure requiring a recovery policy.

Return a result or use a `Try...` method for frequent expected rejection. Use exceptions when normal execution cannot continue at that layer. Catch where you can recover, translate the error into the caller's terms, or add diagnostic context before rethrowing. A catch-all that logs and returns success destroys the caller's ability to reason about state.

`using` and `try/finally` establish deterministic cleanup for owned resources. Garbage collection manages reachability of managed memory; it does not replace releasing a file handle, disposing a native allocation, or releasing a package-specific asset handle.

Numeric behavior is also part of the contract. Use integer units for discrete quantities such as coins. An integer type can still overflow. Validate ranges, use checked arithmetic where appropriate, and decide whether excessive input rejects or saturates. Never let a malicious or corrupt negative amount turn a spend operation into a grant.

Floating-point values represent approximations. Do not use arbitrary exact comparisons for computed geometry. Choose tolerances based on scale and purpose. Conversely, do not introduce a vague epsilon into every rule: a timer boundary with an explicit clock contract may legitimately use an exact comparison against its deadline.

`NaN` needs explicit attention. Comparisons such as `value <= 0` are false for `NaN`, so that check alone does not validate a positive finite duration. Infinity can similarly pass a positivity test. Validate the whole domain of content and external inputs.

?? csharp-nan-validation Why does `duration <= 0` alone fail to validate a positive finite duration?
* `NaN` does not satisfy that comparison, and positive infinity also passes it.
- All floating-point values are negative.
- C# converts `NaN` to zero before comparison.
- Every duration requires a string representation.
> Domain validation must explicitly handle non-finite values as well as sign and range.

?? csharp-result-vs-exception Which outcome is normally best represented as an expected purchase rejection?
* The player lacks the required currency.
- A supposedly required wallet dependency is missing.
- The content schema cannot be parsed at all.
- A programming invariant is violated internally.
> Insufficient funds is ordinary product behavior. A clear result lets the caller show the intended response without treating routine rejection as an exceptional crash.
