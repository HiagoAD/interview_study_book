# `BuyAsync` calls `PurchaseMapping.ToResult`, which the chapter's mapping class does not define

**Kind:** Accuracy. **Priority:** Low. **Touches:** code (one line of a C# sample, or two lines added to another); no question block.

## Locations

- `content/mobile-platform/01-platform-layer.md:122-131`: `internal static class PurchaseMapping` defines one method, `public static PurchaseStatus ToStatus(VendorCode code)`.
- `content/mobile-platform/01-platform-layer.md:277`: `store.Purchase(product.Value, native => Complete(PurchaseMapping.ToResult(native)));`

## Evidence

Read in the file: the only member of `PurchaseMapping` is `ToStatus`, which takes a `VendorCode` and returns a `PurchaseStatus`, while `Complete` at line 269 takes a `PurchaseResult`. The call at line 277 names a method that does not exist and passes it something that is not shown to be a `VendorCode`. As printed, the two samples do not compile together, and a reader who follows the adapter from its mapping to its use has to guess the missing step, which is the step the section says belongs in the adapter (the table at lines 139 to 143). The reader review of chapters 1 to 3 (`docs/reader-reviews/2026-09-29-b53e4f0/chapter-01.md`, RR-01-03) noticed the same mismatch while reading for clarity.

## Proposed fix

Add the missing step to the mapping class, after `ToStatus`, so line 277 stays as it is:

```csharp
    // VendorPurchase stands for the object the store SDK hands its callback.
    public static PurchaseResult ToResult(VendorPurchase native) =>
        PurchaseResult.From(ToStatus(native.Code), native.ProductId, native.TransactionId);
```

Or, keeping the first sample as it is, change line 277 to

```csharp
    store.Purchase(product.Value, native => Complete(PurchaseResult.From(product, PurchaseMapping.ToStatus(native.Code))));
```

## Repeated in

Nothing else.
