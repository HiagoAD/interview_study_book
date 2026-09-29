# The consumer lab's third case ends the program before its numbers can be read

**Kind:** Accuracy. **Priority:** Low (a lab that does not run as written). **Touches:** prose only (the lab's text, and optionally the setup code fence).

## Location

`content/mobile-platform/12-system-design.md:530`, the lab exercise of `design-caches-queues`:

> Third, deliver `m3` for a player `p2` who has no wallet: `GrantOnce` throws, the coins of `p1` stay at 200, and the table still holds two rows, so no id was recorded for `m3`. Last, remove the insert into `processed_message`, repeat the first case with a new message id, and watch the second grant appear.

## Evidence

The lab's `Deliver` (line 520) calls `GrantOnce` without a `try`, and the text never tells the reader to catch the exception. A .NET 8 console project built as lines 509 to 528 describe (the chapter's `GrantOnce` and `AddParameter` without `public`, Microsoft.Data.Sqlite, an in-memory database, and the setup block), running the cases in order, printed:

```text
case1: coins=150 rows=1
case2a: coins=200 rows=2
case2b: coins=200 rows=2
Unhandled exception. System.InvalidOperationException: No wallet for player p2
   at Program.<<Main>$>g__GrantOnce|0_4(...)
   at Program.<<Main>$>g__Deliver|0_2(...)
```

The first two cases give the chapter's numbers. The third ends the process. The reader cannot then read `p1`'s coins or the row count, which the case asks them to check, and the in-memory database is gone. The design is right: the exception rolls back the id and leaves the message unacknowledged. The lab text is what fails. The probe is in the scratch folder `p35-g5/lab/`.

## Proposed fix

Change the third case to say how to catch the exception:

> Third, deliver `m3` for a player `p2` who has no wallet, inside `try { … } catch (InvalidOperationException e) { Console.WriteLine(e.Message); }`, since an exception that nothing catches ends the program: `GrantOnce` throws, `m3` is not acknowledged, the coins of `p1` stay at 200, and the table still holds two rows, so no id was recorded for `m3`.

## Repeated elsewhere

No question block repeats the lab's cases.
