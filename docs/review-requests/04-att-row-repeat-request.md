# The App Tracking Transparency row of the repeat-request table does not say what a repeat request does

**Kind:** Accuracy. **Priority:** Low. **Touches:** prose (the table at `04-os-integration.md:172-176`).

## Location

`content/mobile-platform/04-os-integration.md:170-176`:

> The rules for repeating an iOS permission request depend on the resource:
>
> | Resource | A new request after the player answered | Exception |
> […]
> | Tracking (App Tracking Transparency) | Uses its own prompt and its own purpose string, `NSUserTrackingUsageDescription` | In the European Union, Apple's reference lets an app ask again after a year (checked in September 2026) |

## Evidence

The middle column answers “what does a new request do after the player answered?” for notifications (“Returns the recorded answer, with no prompt”) and location (“Does nothing”). For tracking it gives a different fact, which prompt and key the request uses, so a reader comparing the three rows learns nothing about the one they are asked to compare. The Exception column then describes a repeat that the middle column never set up.

Apple's pages, read on 2026-09-29 from `developer.apple.com/tutorials/data/documentation/apptrackingtransparency/…`:

- `ATTrackingManager.trackingAuthorizationStatus`: “If the status is `notDetermined`, call one of the tracking-request methods to present the tracking-authorization prompt and ask the person for permission.”
- `requestTrackingAuthorization(completionHandler:)`: “The status is `notDetermined` if the system dismisses the prompt without a decision from the person; in this scenario, your app needs to call the method again to receive an authorization answer from the person. In some cases, the system doesn’t display the prompt and instead runs your completion handler immediately.” Under “Prompt again after a year”: “In the European Union, if a person answers the prompt, the system notes the date and doesn’t allow the prompt to display again until a year passes.”

So a request after an answer returns the recorded status without a prompt, a request after a dismissal prompts again, and the European Union adds the yearly repeat. The purpose-string fact is true (the evidence file's permissions-13 receipt) but belongs outside the comparison.

## Proposed fix

Replace the tracking row:

> | Tracking (App Tracking Transparency) | Returns the recorded status, with no prompt; a prompt dismissed without an answer can be shown again | In the European Union, Apple's reference lets an app ask again after a year (checked in September 2026) |

and add the purpose string to the prose after the table, after the sentence ending “does nothing.” at line 178:

> Tracking has a prompt and a purpose string of its own, `NSUserTrackingUsageDescription`, and the game reads `ATTrackingManager.trackingAuthorizationStatus` before asking.

## Repeated in

The glossary's App Tracking Transparency entry (`glossary.md:73`) names the key and the four statuses and makes no claim about repeats; nothing to change there.
