---
book: Unity Game Engineering
chapter: 04: C# semantics that affect gameplay correctness
---

## Value types, reference types, and copying {#csharp-value-reference}

A value-type variable holds a value, and assignment normally copies it. A reference-type variable holds a reference to an object; assignment copies that reference, so two variables can refer to the same object. A struct can contain reference fields too. Copying the struct copies those references, leaving both structs pointing to the same referenced objects. [Microsoft's value-type reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types) describes these copy semantics.

```csharp
using System.Collections.Generic;

public struct BoardSnapshot
{
    public int MovesLeft;
    public List<string> Boosters;
}

// Inside a method:
// var a = new BoardSnapshot {
//     MovesLeft = 10, Boosters = new List<string> { "striped" }
// };
// var b = a;
// b.MovesLeft = 20;
// b.Boosters.Add("wrapped");
// a.MovesLeft is still 10, but a.Boosters now contains both boosters.
```

The example shows why “struct means deep copy” is incorrect: the integer is copied, but both structs still refer to the same list. The rule “structs live on the stack and classes live on the heap” is also too simple to guide a design. A struct can be a field in a heap object, an array element, or a boxed value. Choose a type based on how it should be copied and changed, its size, and how the program uses it.

Small immutable values work well for coordinates, IDs, and compact command results. Use reference identity and clear ownership for mutable entities that several callers share. Large structs can cost more to copy. Also remember the limit of `readonly struct`: its instance fields cannot be reassigned, but an object referenced by one of those fields may still be mutable.

By default, a method parameter receives a copy. If that copy is a reference, the method can change the referenced object. Assigning a different object to the parameter, however, does not replace the caller's variable. The parameter modifiers change this contract: `ref` exposes the caller's storage, `out` requires assignment before a normal return, and `in` passes a readonly reference. Some uses of `in` still cause defensive copies. Choose the passing behavior you need first, then measure any expected performance benefit.

Reading a struct through a `List<T>` index returns a value. To change an ordinary mutable struct in that list, copy the element, change the copy, and assign it back. An array element can behave differently because it is itself a variable location. Immutable updates can make ownership easier to follow when they fit the problem.

Iteration makes the same copy quietly. A `foreach` over a collection of structs hands you a copy of each element, and C# forbids assigning to that copy precisely because the assignment would be lost:

```csharp
// Given: struct Cell { public int Blocker; }
// List<Cell> cells;

foreach (var cell in cells)
    cell.Blocker -= 1;    // Compile error: the iteration variable is read only.

for (int i = 0; i < cells.Count; i++)
{
    var copy = cells[i];
    copy.Blocker -= 1;
    cells[i] = copy;      // The write back is what makes the change survive.
}
```

The compiler error is the helpful case. The same mistake through a method is silent: if `Cell` has a `Weaken` method, `cells[i].Weaken()` compiles for a `List<T>` and for an array alike, and only the array keeps the change. An array element is a storage location, so the method changes it in place; a list indexer is a property that returns a copy, so the method changes a temporary that is thrown away at the end of the statement. Two containers that look interchangeable behave differently, and neither behavior is a bug.

A related copy appears around `readonly`. Calling an ordinary instance method on a `readonly` field of a mutable struct type makes a defensive copy first, so any change the method makes is discarded. Where the project's language version supports it, marking such members `readonly` removes the copy and makes the intent explicit. This is the same mechanism behind the defensive copies mentioned above for `in` parameters.

A practical rule falls out of all of this: make a struct immutable, or keep it in an array you index directly, but do not write a mutable struct and then store it where only copies can be reached. The third combination is where the surprising cases live.

Exercise: Predict what `cells[i].Weaken()` leaves in element `i` for an array and for a list, then run both. Where your prediction and the result differ, you have found the rule worth memorizing.

?? csharp-shallow-copy A struct contains an integer and a `List<string>`. After copying the struct, what is shared?
* The list object referenced by both copies.
- The integer field, since both copies read the same storage.
- The list's contents, but not the list object itself.
- Both fields, because a struct assignment copies the reference to the struct.
- Neither, because the assignment copies the struct into new storage.
> Struct copying copies each field's value. A reference field's value is the reference, so the referenced object remains shared.

?+ A method receives a class instance without `ref` and assigns its parameter to a new object. What happens to the caller's variable?
* It still references the original object.
- It references the new object, because class instances are passed by reference.
- It references the new object once the method returns.
- It keeps the original reference until the next garbage collection.
- It becomes null, because the parameter was rebound inside the method.
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
- 1, because reassigning `second` restores the original list.
- 3, counting the element added to the replacement list as well.
- 9, printing the value held in the reassigned list.
- 0, because `first` was replaced when `second` was reassigned.
> Both variables first reference the same list, so adding through second changes that list. Reassigning second afterward does not change first's reference.

## Equality, hashing, and stable identifiers {#csharp-equality-hashing}

Object identity asks whether two references point to the same object. Value equality asks whether two values mean the same thing. Board coordinates and card identifiers should usually compare by value. Two scene components, however, do not become interchangeable just because their visible properties match.

Hash collections depend on one rule: values that compare equal must have equal hash codes. Different values can still have the same hash; that is a collision. A hash code is therefore unsuitable as a globally unique ID. Runtime hash codes should not be saved as persistent identifiers either.

Microsoft's [GetHashCode contract](https://learn.microsoft.com/en-us/dotnet/api/system.object.gethashcode) documents these equality and persistence restrictions.

While an object is a key in a dictionary or set, keep the fields used for equality and hashing unchanged. If those fields change, a lookup may calculate a different bucket from the one used at insertion. The collection can then fail to find or remove a key that it still contains.

A [[object pool|pooled]] entity key can combine its slot and generation:

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

Two details of that `SpawnId` are worth naming, because both are commonly missed.

First, implementing `IEquatable<T>` is not decoration. `Dictionary<TKey, TValue>` reaches for `EqualityComparer<TKey>.Default`, which uses the strongly typed `Equals(T)` when the type provides it and falls back to `Equals(object)` otherwise. The fallback takes a struct key as `object`, which boxes it, so every lookup on a hot path allocates. This is the same boxing described in the next section, arriving through a door that looks like an ordinary dictionary read.

Second, a struct that overrides nothing still has working equality, and that is the trap. The default implementation inherited from `ValueType` can fall back to a reflection-based comparison of fields. It is correct, and it can be far slower than the few lines written above. Code that works perfectly with a hundred entries and becomes a profiler entry at ten thousand often has exactly this cause.

Note also what the example deliberately does not provide: an `==` operator. Writing `first == second` on this struct will not compile. Add the operators when callers want that syntax, and implement them in terms of `Equals` so the two can never disagree.

| Member | Effect if omitted |
| --- | --- |
| `Equals(T)` via `IEquatable<T>` | Dictionary lookups box the key |
| `Equals(object)` override | Inconsistent results between call sites |
| `GetHashCode` override | Reflection-based default, and a contract risk if `Equals` was overridden |
| `==` and `!=` operators | Reference comparison for classes, compile error for structs |

Exercise: Take an identifier type from your own code and check which of those four rows it provides. Then decide whether each omission is deliberate.

?? csharp-hash-contract Which hashing rule must an equality comparer satisfy?
* Equal values must produce equal hash codes.
- Unequal values should produce unequal hash codes.
- A hash code should stay the same between application versions.
- A hash code should be derived from each field the type declares.
- Values that compare equal should return the same string representation.
> Hashing narrows the search; equality establishes a match. Collisions are expected, while inconsistent hashes for equal keys break lookup assumptions.

?+ Two unequal spawn IDs produce the same hash code. What should a correct dictionary do?
* Use equality to distinguish them and allow both keys.
- Replace the existing entry, since that bucket is already occupied.
- Store both under one entry and return the first match on lookup.
- Rehash the collection with a different seed until the collision disappears.
- Reject the second insertion and report a duplicate key.
> Hash collisions are valid. Equality resolves candidates within the relevant hash structure.

?? csharp-mutable-key Why is changing a dictionary key's equality fields dangerous?
* Its new hash may no longer identify the bucket where it was inserted.
- The dictionary rehashes on the next insertion, which is expensive.
- The key's previous value is retained, so the entry holds more memory than expected.
- The comparer does not observe the change until the dictionary is enumerated.
- Equality still matches, but the entry moves to the end of the enumeration order.
> Hash-based lookup relies on the key's equality and hash behavior remaining stable while it is stored.

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

Apply the same reasoning to queries. A LINQ query used during occasional setup may cost little enough to keep. The same query in every object's `Update` needs measurement. [[object pool|Pooling]] is another tradeoff: use it when the saved work justifies the extra rules for ownership and cleanup.

Because the answer depends on the generated code, the useful skill is checking rather than predicting. Three methods, in increasing order of effort: read the allocation column of a Profiler capture in a player build, with a `ProfilerMarker` around the suspect call or with allocation call stacks recorded; inspect the compiled IL for the method and look for `box` instructions; or write a short benchmark that runs the call many times and measures allocated bytes. The first is usually enough to decide whether the question matters at all.

One rule is worth carrying, because it explains most of the surprising cases. When a generic method constrains its parameter with `where T : struct` or with an interface the struct implements directly, the compiler can emit a constrained call that invokes the struct's implementation without boxing. When the same value reaches a parameter typed as the interface itself, the conversion happens at the call site and the box is created there. The difference is visible in the signature:

```csharp
// May avoid boxing: T is known to the call site.
static int Compare<T>(T left, T right) where T : System.IComparable<T> =>
    left.CompareTo(right);

// Boxes each struct argument: the parameter type is the interface.
static int Compare(System.IComparable left, System.IComparable right) =>
    left.CompareTo(right);
```

Both lines read the same in calling code. Prefer the generic form for value types on a frequently executed path, and keep the interface form where the caller is already working with reference types or where clarity matters more than the allocation.

Exercise: Estimate the allocation of one boxed `int` per entity per frame for 500 entities at 60 frames per second, taking a boxed `int` as about 24 bytes on a 64-bit runtime: a 16-byte object header, the 4-byte value, and padding. Then decide whether that figure would change your design before you measured it.

?? csharp-boxing-copy What value does `recovered` contain in the boxing example?
* 7.
- 8, because the box holds a reference to `count`.
- 0, because unboxing resets the value.
- Whatever `count` holds at the moment the cast runs.
- The cast throws, because `object` cannot be unboxed to `int`.
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
- Calling `CompareTo` on the value through its concrete type.
- Declaring `Counter` as a struct rather than a class.
- Creating the `Counter` value with `new`.
- Returning `0` from `CompareTo` as an `int`.
> Converting a struct value to an interface reference ordinarily boxes a copy. Merely implementing an interface does not allocate an instance.

## Delegates, events, closures, and lifetime {#csharp-events-lifetime}

A delegate represents a callable target. An event lets other code subscribe, while leaving invocation under the control of the declaring type's implementation. That makes events useful for notifications, but does not guarantee reliable delivery, thread safety, or isolation between handler errors.

When you subscribe an instance method, its delegate keeps a reference to the subscriber. If the publisher lives longer than the intended subscription, unsubscribe when that subscription should end. For an anonymous lambda, keep the exact delegate instance if you will need to remove it later. Microsoft documents these concerns in its [event subscription guide](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/events/how-to-subscribe-to-and-unsubscribe-from-events).

Pair subscription and unsubscription with the period during which a view should listen. In Unity, `OnEnable` and `OnDisable` can work if the model reference is ready and the view should listen whenever it is enabled. A presenter with an explicit binding lifetime may instead use `Bind(model)` and `Unbind()`.

A closure captures variables, which may change before the callback runs. If callbacks created in a `for` loop each need their own index value, copy the index into a new local variable inside each iteration. Also check which objects the closure keeps alive. A lambda that references a large owner can retain that owner and everything still reachable through it.

Event data should describe what happened at the time of the event. If it contains a mutable collection that changes later, observers may see different versions of the same event. Copy the required values, or use immutable data, when observers need a lasting snapshot.

Whichever binding method you use, ensure each subscription is added only once. Repeated activation can attach the same handler again and cause duplicate callbacks. Test enable-disable-enable sequences, as well as switching a view to another model. A report that “The event fires twice” may come from duplicate subscriptions.

The advice to keep the delegate instance deserves a demonstration, because the failure is silent rather than loud:

```csharp
// Subscribing and unsubscribing with separate lambda expressions.
model.Changed += () => Refresh(item);
model.Changed -= () => Refresh(item);   // Removes nothing. No error, no warning.

// Keeping the instance.
System.Action handler = () => Refresh(item);
model.Changed += handler;
model.Changed -= handler;               // Removes the subscription.
```

The second `-=` in the first pair creates a second delegate, finds no match in the invocation list, and returns without complaint. The two lambdas share one closure object, because they capture variables from the same scope, but each compiles to its own method, and delegate equality compares the method as well as the target. Repeat that binding cycle ten times and the handler runs ten times per event, which is a frequent cause of the “the event fires twice” report described above. Compiler behavior around non-capturing lambdas can differ, so do not rely on any lambda being removable; store the instance whenever you intend to unsubscribe.

Raising an event has its own small contract. `Changed?.Invoke()` reads the field once and then invokes, which avoids a race where the last subscriber unsubscribes between the null check and the call. It does not make delivery thread safe in general, and it does not stop a handler that throws from preventing the handlers after it from running. Where every observer must be attempted, invoke the invocation list yourself and decide what a failing handler should do.

Exercise: In a view you have written, count the paths that subscribe and the paths that unsubscribe. If the two numbers differ, trace the difference before assuming the extra path is unreachable.

?? csharp-event-retention Why can a long-lived publisher retain an otherwise unused subscriber?
* Its event delegate references the subscriber's instance method target.
- The subscriber holds a reference back to the publisher it subscribed to.
- The delegate copies the subscriber's fields when the handler is attached.
- The event retains the arguments from the last time it was raised.
- The subscriber stays reachable until its `OnDestroy` has run.
> A delegate can keep the subscriber reachable, so garbage collection cannot reclaim it. Unsubscribe when the subscriber should stop listening.

?? csharp-closure-index Several callbacks created in a `for` loop all use the final index. What is a direct fix?
* Capture a distinct local copy of the index for each iteration.
- Declare the loop variable outside the loop, so each callback sees a stable value.
- Mark the callbacks as `static`, so they do not capture the loop variable.
- Copy the list of callbacks before invoking them.
- Invoke the callbacks in reverse order, so the last index is consumed first.
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

Changing a typical list during a `foreach` loop invalidates its enumerator. A match-3 cascade is where this usually bites, because the pass that walks the matched cells is the same pass that wants to clear them. You can instead collect the removals and apply them afterward, or walk indices backward when removing elements. Other collections may support different rules for changes during iteration. Check the contract of the collection and runtime you use.

Walking backward prevents removal from skipping an element that shifts into an earlier index. Each `RemoveAt` can still move data, though. For a large filtering pass, it may be cheaper to compact the surviving elements once. If order does not matter, move the last element into the removed slot instead; this is swap-back removal, and any stored index mappings must be updated.

Check for hidden repeated enumeration. A method that accepts `IEnumerable<T>` cannot assume that calling `Count()` and then looping over the sequence is cheap or free of side effects. If appropriate, collect the values once. If the method requires a count and indexed access, consider requesting a more specific read-only collection type.

The declared type of the variable you loop over also decides whether the loop allocates. `List<T>` returns a struct enumerator, so iterating a `List<T>`-typed variable copies that struct onto the stack and allocates nothing. Iterating the same list through a variable typed `IEnumerable<T>` calls the interface method instead, which boxes the enumerator and produces one allocation per loop:

```csharp
List<Cell> cells = board.Filled;
foreach (var cell in cells) { }         // No enumerator allocation.

IEnumerable<Cell> asSequence = cells;
foreach (var cell in asSequence) { }    // Boxes the struct enumerator.
```

One allocation per loop is irrelevant at startup and is worth knowing about in a method that runs for every entity every frame. It also gives a concrete reason to choose parameter types deliberately. Accepting `IEnumerable<T>` is the most permissive signature and the least informative one: the callee cannot count cheaply, cannot index, cannot know whether enumerating twice is free, and will box the enumerator of the most common concrete argument. Accepting `IReadOnlyList<T>` keeps the caller free to pass an array or a list while giving the callee a count and an indexer. Accepting the concrete `List<T>` gives up flexibility for the struct enumerator.

Where the project's compatibility profile provides them, a `Span<T>` or `ReadOnlySpan<T>` parameter expresses “a contiguous run of elements I will read now and not retain” more precisely than any of these. Check availability in the project rather than assuming it, in the same way chapter 9 treats newer collection APIs such as `PriorityQueue<TElement, TPriority>`.

Exercise: Find a method in your code that takes `IEnumerable<T>` and enumerate its body. If it calls `Count()` and then loops, decide whether the signature or the body should change.

?? csharp-deferred-query When does a deferred filtering query usually evaluate its predicate?
* When the sequence is enumerated.
- When the query variable is assigned.
- When the first element is requested, after which the result is cached.
- When the source collection is next modified.
- When the query is passed to a method that accepts `IEnumerable<T>`.
> Deferred execution separates describing a query from performing its work. Source changes before enumeration can change the result.

?? csharp-snapshot-depth A list of player references is copied with `ToArray`. What has been snapshotted?
* The sequence of references, not the mutable fields inside each player.
- Each player's field values at the moment the array was created.
- The list's count, but not the elements themselves.
- The references, along with the fields of any player not modified afterward.
- A copy of each player, so later changes stay isolated from the array.
> `ToArray` records which references are in the sequence at that moment. It does not copy the player objects, whose fields can still change.

## Errors, cleanup, and numeric boundaries {#csharp-errors-numbers}

Distinguish normal rejection from a failure that needs recovery. Insufficient currency, an incomplete mission, or a cancelled view load can be expected outcomes. A missing required dependency or a corrupt definition means an assumption is broken. An I/O error needs a policy for retrying, reporting failure, or otherwise recovering.

For frequent, expected rejection, return a result or use a `Try...` method. Use an exception when normal execution cannot continue at that layer. Catch it where you can recover, explain it in terms the caller understands, or add debugging context before rethrowing. Logging every exception and then returning success leaves the caller unable to tell what happened.

Use `using` or `try/finally` to clean up resources at a defined point. Garbage collection handles managed memory that is no longer reachable. It does not replace closing a file handle, disposing a native allocation, or releasing an asset handle according to a package's rules.

Define the valid numeric inputs and what happens at their limits. Coins, for example, are discrete quantities and suit integer units, but integers can still overflow. Validate ranges, use checked arithmetic where appropriate, and decide whether an excessive amount is rejected or capped. Reject negative spend amounts, so corrupt or malicious input cannot turn spending into a grant.

Floating-point calculations produce approximations. For computed geometry, choose comparison tolerances that fit the scale and purpose of the calculation. A tolerance is not appropriate for every rule, however. A timer with a precise clock contract may correctly use an exact comparison against its deadline.

Check non-finite values explicitly. For `NaN`, a comparison such as `value <= 0` is false, so that test alone cannot establish that a duration is positive and finite. Positive infinity also passes a positivity check. Validate all the allowed values for content and external input.

Integer arithmetic in C# is unchecked by default, which is worth stating plainly: an addition that exceeds the range of its type wraps around silently rather than throwing. A balance near the maximum can therefore become negative in a single grant, and the clamp applied afterward will faithfully preserve the wrapped value.

Check before the operation rather than after it:

```csharp
public bool TryGrant(long amount, out long balance)
{
    balance = this.balance;
    if (amount < 0)
        return false;                          // Spending is a separate operation.
    if (amount > long.MaxValue - this.balance)
        return false;                          // Would overflow; reject rather than wrap.

    this.balance += amount;
    balance = this.balance;
    return true;
}
```

The subtraction in the second check is the pattern to remember: rearrange the comparison so the dangerous addition never happens. A `checked` block is the other option, and it converts the same condition into an `OverflowException`; choose according to whether an out-of-range grant is an expected rejection or a broken assumption, using the distinction this section opened with.

Decide the limit from the product rather than from the type. If the design says no player can hold more than one billion coins, validate against one billion and reject clearly, rather than allowing values up to the maximum of `long` and discovering later that the save format, the UI, and the server disagree about the ceiling.

Exercise: Find the arithmetic in your code that changes a player's balance. Write down the largest value it accepts, and then check whether the save format and the display can both represent that value.

?? csharp-nan-validation Why does `duration <= 0` alone fail to validate a positive finite duration?
* `NaN` does not satisfy that comparison, and positive infinity also passes it.
- Negative zero passes the comparison, although it is not a positive duration.
- Values below the type's epsilon round to zero before the comparison.
- Comparing a `float` against an integer literal promotes it, which changes the result.
- The check rejects zero, which some content needs as a valid instant duration.
> Check for `NaN` and infinity explicitly, as well as checking the sign and allowed range.

?? csharp-result-vs-exception Which outcome is normally best represented as an expected purchase rejection?
* The player lacks the required currency.
- The wallet reference was not assigned when the screen was constructed.
- The content schema for the reward table could not be parsed.
- An internal assertion about the sign of the balance was violated.
- Writing the new balance to local storage failed with an I/O error.
> Insufficient funds is ordinary product behavior. A clear result lets the caller show the intended response without treating routine rejection as an exceptional crash.
