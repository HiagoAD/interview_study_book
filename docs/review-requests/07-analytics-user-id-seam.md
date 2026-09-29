# The analytics code has no way to set the user id that the prose says the service sets

**Kind:** Consistency · **Priority:** Low · **Touches:** code (chapter 7's `IAnalyticsAdapter` and `AnalyticsService`)

## Locations

- `content/mobile-platform/07-sdk-integration.md:231`: “the service sets it on each adapter after sign-in, so the vendor's data can be joined to the game's own.”
- `content/mobile-platform/07-sdk-integration.md:161-224`: `IAnalyticsAdapter` declares `Send`, `Flush` and `StopCollection`, and `AnalyticsService` has no user-id method.
- `content/mobile-platform/08-backend-clients.md:584`: “Reset the analytics user id that chapter 7's service set on each adapter after sign-in.”

## Evidence

This comes from reading the code blocks against the prose. The only user-id call in chapter 7 is the shim's `SetUserId` (07:505, 07:545), which sits below an adapter. The service and adapter interfaces that the prose and chapter 8's logout step refer to cannot set or reset the id. A reader who writes the interface for the section's exercise, or follows chapter 8's logout list, has nothing in the code to call.

## Proposed fix

Add one member to each, so the prose and chapter 8 have code to point to:

```csharp
public interface IAnalyticsAdapter
{
    void Send(GameEvent gameEvent);
    void Flush();
    void StopCollection();
    void SetUserId(string userId); // null after sign-out
}
```

and in `AnalyticsService`:

```csharp
    // Called after sign-in with the backend's pseudonymous id, and with null at sign-out.
    public void SetUserId(string userId)
    {
        foreach (var adapter in adapters) adapter.SetUserId(userId);
    }
```

The code fence changes, so the chapter's compile check (evidence file, “Added by the session”) should be rerun.

## Repeated elsewhere

No question depends on the method.
