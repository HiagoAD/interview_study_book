---
book: unity-mobile-platform-engineering
chapter: 13: Designing core game services
---

## Accounts, identity, and player data {#design-player-data}

Chapter 12 set out the method of a design round and its building blocks, from [[#design-round-method]] to [[#design-consistency]]. This chapter puts them to work on the services that most game backends hold, one worked design to a section, at interview depth: the requirements, the data model, the operations, the failure cases, and what a platform engineer adds from the client's side. The account comes first, since every other service keys its data by the account's id.

A game account is identified by an id that the game's backend issues, such as a random UUID, and by nothing that a platform owns. The ways of signing in are linked to it: Sign in with Apple, Game Center, Google Play Games, an email login, and the guest credential of a player who has not signed in yet. Each gives the player an id of its own, and the backend keeps one row for each link:

```sql
CREATE TABLE account (
  player_id TEXT PRIMARY KEY,       -- the game's own id, such as a random UUID
  created_at TEXT NOT NULL
);

CREATE TABLE identity (
  provider TEXT NOT NULL,           -- guest, apple, game-center, play-games
  provider_user_id TEXT NOT NULL,   -- the id that the provider gives this player
  player_id TEXT NOT NULL REFERENCES account (player_id),
  PRIMARY KEY (provider, provider_user_id)
);
```

Keying every service's data by the game's own id lets a player add or remove a way of signing in without moving any data, and keeps each provider's id where it belongs, as a way in. Those ids have scopes of their own. Game Center's `teamPlayerID` identifies a player across the games that one developer account distributes, and Sign in with Apple's user identifiers are scoped to the developer team, so that moving the game to another team means migrating them, as Apple's technote on app transfers describes. An account keyed by either would depend on the team that publishes the game. The server takes none of these ids from the client as it stands. It verifies each sign-in: Apple's identity token is a [[JSON Web Token]] that Apple signs, and the server checks its signature with Apple's public key, its issuer, its expiry, and its audience, which must be the app's own client id; Google Play Games gives the client a one-time code that the server exchanges with Google for an access token. An id that arrives unverified is one more value from an untrusted client, like the score of [[#design-round-method]].

Most mobile games start the player as a guest. The first launch creates an account and a credential for it on the device, so that the player is playing within seconds, and asks for a sign-in later. The credential lives on the device, stored as chapter 4 stores secrets, in the [[Keychain]] or encrypted under a key from the [[Android Keystore]], and the guest account lasts as long as the credential does. The anonymous sign-in of Unity Authentication, part of [[Unity Gaming Services]], works this way, and its documentation warns that an anonymous account that was never linked cannot be recovered once its session token is lost. A lost phone, a reset, or cleared app data on Android ends the player's own way into a guest account; on iOS, a Keychain item may move to a new phone restored from a backup, unless it is marked `ThisDeviceOnly`. The account itself stays on the server, where support alone can reach it. So the game asks the player to link a platform sign-in at the moments when losing the account would hurt: after the first purchase, after a few days of play, and in the settings, where a player about to change phones looks.

Linking is where two accounts can collide. A player who has played for a year on an old phone installs the game on a new one, plays the tutorial as a new guest, and then taps “Sign in with Apple”. The server verifies the token and inserts the link, and the primary key refuses it: that Apple id already belongs to the year-old account. Two accounts now claim one person:

| | The old account | The new guest |
| --- | --- | --- |
| Way in | Apple, linked a year ago | The guest credential on the new phone |
| Progress | Level 212, 4,000 gems, 31 purchases | The tutorial and 50 gems |

The server does not choose between them. It answers the link with a conflict that summarizes both accounts, and the player decides, since the player alone knows which progress is theirs. The usual choice is to switch to the old account, which leaves the guest's few minutes behind. The other is to keep the guest and move the Apple id to it, which leaves the old account with no way in, and the game says so before the player confirms. Unity Authentication reports this case as `AccountAlreadyLinked` when the link is attempted, and its force-link option moves the identity from the other player to the current one, which its documentation warns can leave the other account unrecoverable; it recommends letting the player choose to keep the current account, switch to the other, or cancel. Merging the two is the design to avoid. Adding their balances creates currency, which a player could farm by linking one guest account after another, and every item and purchase would need a merge rule of its own.

A linked account is recovered by signing in the same way on the new phone, which is why the prompt to link matters. A guest account whose phone is gone can be recovered by support alone, from evidence the player still holds: the stores' records of their purchases, which the game's [[ledger]], the subject of the next section, keeps under the account with each purchase's store id. One player on two devices at once writes to one account from two places, and the version check of [[#design-consistency]] settles it: both devices hold valid sessions, each upload names the version it read, and the second writer gets a conflict to merge or to show the player, as [[#network-offline]] describes. A game that wants one device at a time ends the older session when a new one signs in, and the older device says that the account is in use elsewhere.

The player's data is a document keyed by the player's id ([[#design-storage]]): a profile, progress, an inventory and settings. Three rules keep it healthy:

- Each field has one writer. Settings, a cosmetic loadout and the tutorial's flags may be written by the client. Balances, items of value, purchases and ranks are written by the server's own operations, a grant or a spend, so an upload from the client cannot carry them. Keeping the two kinds in separate records also keeps them from contending for one version, so a grant from the server does not turn the client's next upload of its settings into a conflict. Cloud Save, Unity's service for player data, draws the same line with its access classes, as [[#design-services-state]] notes: default player data is writable by the player's client, protected data by a server alone.
- The document records the version of its schema, apart from the version that counts its writes. When the server reads a document at schema version 3 and its code is at version 5, it runs the migrations from 3 to 4 and from 4 to 5 in memory, and saves version 5 at the next write. Documents are migrated as they are read, so no job rewrites millions of them at once, and each migration stays in the code for as long as a document at its version may still be read. The shapes that old clients read are chapter 8's problem, which [[#http-versioning]] covers.
- The server enforces a size limit on the document, so that a bug that appends to a list forever fails one write instead of growing a save that each load then pays for. In September 2026, Cloud Save allowed each player 2,000 keys and 5 MiB in each access class.

Both stores require a way to delete the account from inside the app, when the app lets players create one. Apple's [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) have required it since June 30, 2022, in guideline 5.1.1(v), and Apple's page on offering account deletion asks for the account and the data associated with it to be deleted, apart from what the law requires the developer to keep. An app that uses Sign in with Apple also revokes the player's tokens through Apple's REST API when the account is deleted. Google Play asks for a path inside the app and for a web page where a player who has already uninstalled the game can ask for the same. A button that removes the account's row meets neither in substance, because the player's data has gone to more places than that row:

- the services that key data by the player's id: the player document, the ledger, leaderboard entries, friends and chat, and the registry of [[push token | push tokens]];
- the analytics pipeline and its warehouse, where the player's events are stored under the player's id;
- the backups, which are not rewritten one player at a time: the data stays in them, out of use, until they expire on their schedule, which the UK's data protection regulator describes as putting the data beyond use, and a restore applies again the deletions made since the backup, from a log that keeps the deleted ids;
- the third parties the data went to, such as an analytics SDK's vendor, each through its own deletion request.

Unity Authentication's deletion removes the player's sign-in account and leaves the data in the game's other Unity services for the game to delete, the same list in miniature. Records that another law requires the company to keep, such as the financial records of purchases, stay, since erasure laws make exceptions for data kept to comply with a legal obligation. Privacy law also gives the other direction. The GDPR, the European Union's data protection regulation, gives a person the right to have their data erased, the right of access to it, and the right to receive it in a machine-readable format and take it to another provider, and California's privacy law gives rights to know and to delete. An export walks the same list as a deletion, reading instead of erasing, so the places that hold a player's data are kept as one list, and a service that starts storing player data adds itself to it.

Exercise: Draw the account model for a game with guest play and two platform sign-ins. Then walk a player who reinstalls on a new phone, plays as a guest, and signs in with the method their old account used: what the server stores, what the player sees, and what each of their choices leaves behind.

?? design-account-linking A player on a new phone plays the tutorial as a guest, then signs in with Apple, whose id is linked to their year-old account. What does the game do?
* Shows both accounts' progress, and the player picks which to keep
- Merges the guest's progress into the old account, then signs in there
- Links the Apple id to the guest, since it is the account in use now
- Signs in to the old account, and deletes the guest without asking
- Refuses the sign-in, and tells the player to contact support
> The player alone knows which progress is theirs, so the server reports the conflict with a summary of each account and the player chooses. A merge adds balances together, which creates currency, and moving the Apple id without asking strands the old account. Deleting the guest or refusing the sign-in decides for the player, or not at all.

?+ Which constraint lets the server notice that an identity already belongs to another account?
* A primary key on the provider and the provider's id for the player
- A unique index on the player id in the table of linked identities
- A foreign key from each linked identity to the account it belongs to
- A unique email address on each account, checked at each sign-in
- A check that each identity was created after the account it joins
> The link table holds one row for each provider and provider id, so a second account's attempt to link the same Apple id fails the key. A unique player id would stop an account from holding two ways of signing in, a foreign key says only that the account exists, and neither an email address nor a creation time identifies a provider's player.

?+ Why is merging the two accounts' progress the design to avoid?
* Adding their balances creates currency that a player can farm with guests
- The linked identities would point to two accounts after the merge
- Store purchases belong to a device, so they stay behind in a merge
- The two saves have different formats, which do not combine
- The merge would take longer than the request's deadline allows
> A merge that adds balances lets a player link guest after guest into one account, each bringing its starting currency, and every item and purchase would need a rule of its own. The identities, the purchases and the formats could all be handled, and a merge could run in the background; the economy is what it breaks.

?+ Why does every service key its data by an id that the game issues, rather than by the player's Apple or Google id?
* A player can add or remove a way of signing in without moving data
- The game's ids are shorter, so the indexes on them take less memory
- Platform ids are secret, so the backend is not allowed to store them
- Platform ids change at each sign-in, so they identify nobody for long
- A game-issued id lets the server trust the id that the client sends
> Each sign-in method is a link to the account, so adding Game Center or removing Apple changes a row in the link table and nothing else moves. The backend stores the providers' ids in that table, they stay the same for the player, and whatever the key, each sign-in is verified with its provider.

?+ A player who never linked a sign-in loses their phone, which had no backup. What can recover the account?
* Support, matching the store purchases recorded under the account
- The player, by signing in with Apple on the new phone
- The server, from the advertising identifier of the new phone
- The game, by asking the new phone's store for the old account
- Nothing, since the server deletes a guest account when its phone is lost
> The guest credential lived on the lost phone, so nothing the player holds opens the account, and the server does not know that the phone is gone. The stores' records of the player's purchases, which the ledger kept under the account, let support identify it. Apple was never linked, and a new phone's identifiers point to nothing.

?? design-account-deletion A player deletes their account from the game's settings. Beyond the account's own rows, what must the deletion reach?
* The warehouse's events, the copies in backups, and the SDK vendors
- Nothing more, since the other records point to the account's rows
- The player document, since the rest is anonymous once it is gone
- The save on the device, since the server's copies expire by themselves
- The store's purchase history, which the game asks the store to erase
> The player's data went to each service that keys by their id, to the analytics pipeline, to the backups and to the third parties the game sent it to, and deletion walks that list. Other records do not disappear with the account's row, a warehouse keeps events under the player's id rather than anonymously, and the stores' records belong to the stores.

?+ Last week's backups hold a player who has now deleted their account. What does the design do?
* Leaves them to expire, and applies logged deletions after any restore
- Restores each backup, deletes the player, and takes the backup again
- Deletes the backups that hold the player, and takes a new full backup
- Keeps the backups as they are, since data in a backup is not in use
- Stops backing up the tables that hold data about deleted players
> A backup is not rewritten for one player: the data stays in it, out of use, until it expires on its schedule. A restore would bring the player back, so the service keeps a log of deleted ids and applies it again after restoring. Rewriting or dropping backups for each deletion costs far more and weakens recovery, and doing nothing lets the next restore bring the player back.

?+ Why does the backend keep one list of the places that hold a player's data?
* Deletion and export both walk it, and a place left off keeps the data
- The list sets the order in which services restart after an outage
- Analytics reads it to choose which events to sample for each player
- The backup job reads it to skip the tables of players who have left
- Support reads it to decide which account wins a linking conflict
> A deletion has to reach each place that the player's data went, and an export under privacy law has to read each of them. One list serves both, a service that starts storing player data adds itself to it, and a place that nobody listed keeps the data after the player was told that it was gone.

?+ Which record may stay after a player's account is deleted?
* The financial record of a purchase, which another law requires keeping
- The player document, kept in case the player comes back later
- The player's events in the warehouse, since they are anonymous
- The friends list, so that friends can still see the player's name
- The push token, so that the game can invite the player back
> Erasure laws make exceptions for data that another law requires the company to keep, such as financial records, which stay, kept apart from the profile for that purpose alone. Keeping the document for a return, events under the player's id, a visible name or a token for invitations each keeps data that the deletion was meant to erase.

## Economy and purchases: the server owns the ledger {#design-economy}

The economy follows the untrusted client of [[#design-round-method]] to its end: the client asks, and the server checks and grants. “Buy offer 12” and “claim the reward of mission m-2291” are requests, and the server looks up the price or the reward, checks that the player may have it, and records the result. The first book, *The Game Layer*, granted a mission's reward this way in its chapter on missions and rewards: one operation saved the reward together with a record of the claim's id, so that a retried claim returned the recorded result instead of a second reward. The economy does the same for each change to each balance.

Balances come from a [[ledger]]. Each change is an entry that is appended and never updated: the player, the currency, a signed amount, the operation's id, a reason and a source. A grant adds a positive entry, a spend a negative one, and a correction is a new entry that reverses an old one. The balance is the sum of the player's entries. Two things follow. Each balance can be explained entry by entry, which is what support needs when a player writes that their gems vanished, and what finance needs to reconcile the game's revenue with the stores' reports. And each grant is [[idempotent]] for its operation's id, since the id is unique in the ledger itself, which puts chapter 12's `GrantOnce`, with its record of processed ids and its grant, into one table:

```sql
CREATE TABLE ledger (
  entry_id INTEGER PRIMARY KEY,
  player_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount INTEGER NOT NULL,            -- positive for a grant, negative for a spend or a reversal
  operation_id TEXT NOT NULL UNIQUE,  -- the operation that wrote the entry: one entry each
  reason TEXT NOT NULL,               -- purchase, refund, mission, shop
  source TEXT NOT NULL,               -- what caused it: a product, a mission, an offer
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Summing a long history at each spend grows slow, so a design can keep the running balance in a wallet row as well, changed in the same transaction as each entry. A spend debits the wallet with an `UPDATE` whose condition, that the balance covers the price, makes it change no row when the player is short. The rule sits on the spend rather than on the wallet, where the `CHECK` constraint of [[#design-storage]] would put it, because a refund's reversal, later in this section, has to be recorded even when it takes the balance below zero. The ledger stays the record: a job that compares each wallet with the sum of its entries finds any code that wrote one without the other.

A store purchase adds the store to the operation, and the order of its steps decides what a failure costs:

```text
client    buy gems_500 through the store's SDK              -> App Store or Google Play
store     a signed transaction, or a purchase token         -> client
client    POST /purchases with it                           -> game backend
backend   look the purchase up with the store's server API  -> App Store or Google Play
backend   record the store's id and grant, one transaction  -> database
backend   the grant                                         -> client
client    finish the transaction, or acknowledge it         -> store
```

The server verifies before it grants. On iOS, StoreKit gives the client a transaction that the App Store signed as a JSON Web Signature, the signed form that [[JSON Web Token | JSON Web Tokens]] use. The server verifies the signature, from the information in its header or with Apple's App Store Server Library, or it fetches the transaction again by its id through the [App Store Server API](https://developer.apple.com/documentation/appstoreserverapi). It then checks the fields that say what was bought and where: the app's bundle id, the product id, the environment, which says Sandbox or Production, and whether a revocation date says that the App Store refunded or revoked it. On Android, the client sends the purchase token, and the server looks it up through the Google Play Developer API for the game's own package name, currently with `purchases.productsv2.getproductpurchasev2`. Google Play's guide says to check that the purchase is in the purchased state, since a pending purchase is one whose payment the player has not completed. The server then records the store's id for the purchase, the transaction id on iOS and the purchase token on Android, and grants, in one database transaction; Google Play's guide has the backend check that each purchase token has not been used before, so that nothing is granted twice. Google Play's order id is the wrong key for it, since some purchases have none.

Then the client finishes. StoreKit's `finish()` tells the App Store that the app delivered what was bought, and Apple's documentation says to call it after delivering. Until then the transaction stays unfinished, and StoreKit hands it to the app again, at the next launch if need be. Google Play needs each purchase acknowledged, or consumed if it is a consumable, which fulfills the acknowledgement as well, and its guide describes either as telling Google Play that the app has granted the purchase, whether the client or the backend does it. A purchase left unacknowledged for three days is refunded and revoked, by [Google Play's integration guide](https://developer.android.com/google/play/billing/integrate) in September 2026.

Each other order loses something:

| Order | What a failure between two steps costs |
| --- | --- |
| Finish or consume first, then call the server | The server is down or the game is closed: StoreKit does not hand a finished transaction over again, and a consumed purchase leaves the list of the player's purchases, so the player has paid for nothing |
| Grant, then verify | A forged token, or one from another app, is granted before the check refuses it |
| Grant and record the store's id in separate steps | A crash between them, or a retried request, grants twice or records a purchase that nothing granted |
| Grant, and never finish or acknowledge | Google Play refunds the purchase, so the player keeps the gems and the money, and StoreKit hands the transaction over again at each launch |

Acknowledging first is less final on Google Play than consuming: a purchase that is acknowledged and not consumed still appears when the game queries the player's purchases, which Google Play's guide has it do when it resumes, so the grant can still follow, although Google Play has already been told that it happened.

The order that works also recovers by itself. When the game is closed after the server granted and before the client finished, StoreKit hands over the unfinished transaction at the next launch, the client sends it again, and the server finds the store's id already recorded and answers with the grant it recorded, not with an error. The client then finishes it. On Android, the unacknowledged purchase shows up again when the game queries the player's purchases, and takes the same path. The store's id is the idempotency key of [[#network-idempotency]], chosen by the store and the same on each attempt.

A purchase can be undone after the grant. Players ask the stores for refunds, a purchase shared with a family can be revoked, and subscriptions renew and lapse. Both stores tell the server. Apple's App Store Server Notifications post a signed payload to a URL that the team sets, with a type such as `REFUND`, `REVOKE` or `DID_RENEW`, and Apple sends a notification again when the server does not answer it with success, five more times over the following days by its documentation in September 2026. Google Play's real-time developer notifications are published to a [[pub/sub]] topic that the team sets up in Google's cloud; a notification about a one-time purchase carries its purchase token, which the server looks up for the purchase's current state, and Google Play recommends removing duplicate notifications by their message id. Google Play also lists voided purchases, those refunded, canceled or charged back, through its Voided Purchases API, which a server reads to catch any that it missed. A refund is written to the ledger as a reversal, with an operation id made from the purchase's, so a notification delivered twice reverses the grant once:

```sql
-- A refund notification for transaction 2000000912345678: reverse what it granted, once.
INSERT INTO ledger (player_id, currency, amount, operation_id, reason, source)
SELECT player_id, currency, -amount, 'refund:' || operation_id, 'refund', source
FROM ledger
WHERE operation_id = 'app-store:2000000912345678'
ON CONFLICT (operation_id) DO NOTHING;
```

The purchase's own entry was written under the operation id `app-store:2000000912345678`, the store's name and its transaction id. The reversal is written whatever the balance, since the store has refunded the money already. What happens when the player has spent the gems is a policy that the game chooses and writes down: the balance goes below zero and the shop refuses spends until it recovers, or the items bought with the gems are taken back, or small amounts are written off, each recorded as entries of their own.

The same design stops the usual frauds:

- A replayed purchase: the second request carries a store id that the ledger already holds, and grants nothing.
- A purchase from another app: Apple's signed transaction names the app's bundle id, and Google Play's lookup is made for the game's own package name, so another app's purchase fails the check.
- A sandbox or test purchase sent to production: Apple's transaction states its environment, and Google Play marks a purchase made from a license testing account as a test, so production grants neither, except to the team's own accounts.
- One player's purchase sent from another account: the game gives the store an identifier of the player's account when the purchase starts, `appAccountToken` in StoreKit and an obfuscated account id in Google Play Billing, and both stores return it with the purchase, so the server checks it against the account that sends the purchase.
- A grant claimed with no purchase: the server grants from purchases that the store confirmed, and from nothing else.

Chapter 15's first worked case follows this flow as it fails in production.

Lab exercise: Model the ledger in SQLite with the table above. Grant a purchase, send the same purchase again, and check that the second insert changed no row. Spend part of the gems, apply the refund twice, and check that one reversal was written and what the balance became. Then write down the policy your game would apply to that balance.

?? design-purchase-grant-order A player buys gems. In which order do the server and the client handle the purchase?
* Verify with the store, record its id and grant, then finish it
- Finish it, then verify and grant, so that the store stops resending it
- Grant at once, then verify in the background, so that nobody waits
- Verify, finish, then grant when the client confirms the receipt
- Record its id and finish it, then verify and grant in a nightly job
> The server verifies the purchase with the store's server API, records the store's id and grants in one transaction, and then the client finishes the transaction or acknowledges the purchase. Finishing first loses the purchase if anything fails before the grant, granting first rewards forged tokens, and a nightly job keeps the player waiting for what they paid for.

?+ The client finishes the StoreKit transaction as soon as the purchase succeeds, then calls the server, which is down, and the player closes the game. What happens?
* The player has paid, has nothing, and StoreKit will not resend it
- StoreKit hands the transaction over again at the next launch
- The App Store refunds it, since no server confirmed the delivery
- The purchase stays pending in the store until the server answers
- The client's next purchase of the same item includes the lost one
> Finishing tells the App Store that the content was delivered, so StoreKit does not hand the transaction over again, and the one copy the game had was in memory when it closed. The player paid and has nothing until support steps in. Finishing after the server's grant keeps the transaction unfinished through any failure, and StoreKit hands it over again.

?+ The game is closed after the server granted the gems and before the client finished the transaction. What happens at the next launch?
* StoreKit resends it, and the server answers with its recorded grant
- The player loses the gems, since the client did not finish it
- The server grants the gems again, since the transaction came back
- The App Store refunds it, since the transaction was left unfinished
- The client finishes it without asking the server, since it was paid
> An unfinished transaction is handed to the app again, so the client sends it to the server, which finds the store's id already recorded and returns the grant it made, and the client then finishes it. The store's id is the idempotency key: nothing is lost, and nothing is granted twice.

?+ Why does the server record the store's id for a purchase in the same database transaction as the grant?
* So that a resent purchase finds its id there and grants nothing
- So that the store can read the id back when it sends a notification
- So that the grant is written faster than two separate statements
- So that the client can finish the transaction before the grant
- So that the id can be deleted when the purchase is later refunded
> The id and the grant commit together or not at all. A request retried after a lost response, or a transaction that StoreKit hands over again, finds the id and returns the recorded grant, while with the two in separate steps a crash between them grants twice or leaves an id with no grant. A refund adds a reversal and deletes nothing.

?+ A Google Play purchase is granted and then never acknowledged. What happens?
* Google Play refunds it, though the gems were already granted
- Google Play acknowledges it by itself once the purchase completes
- The purchase is held for review until the developer acknowledges it
- Google Play charges the player again when the window runs out
- Nothing, since acknowledging is optional for one-time products
> Google Play requires each purchase to be acknowledged, or consumed, and refunds and revokes one that stays unacknowledged past its window. The player gets the money back for gems already granted, which the server then has to reverse. The backend acknowledges after the grant, or the client does once the server confirms it.

?? design-refund-notification Apple's server notification of a refund for a gem purchase arrives twice. What does the server write?
* One reversal, keyed by the purchase's id, so the second changes nothing
- Two reversals, since each notification reports a separate refund
- Nothing, since the store reverses the grant in the game by itself
- A deletion of the purchase's ledger entry, made once by its id
- One reversal, after checking that the player still holds the gems
> Notifications can be delivered more than once, so the reversal's operation id is made from the purchase's, and the second insert finds it and changes nothing. The ledger is appended to, not edited, so the purchase's entry stays and the reversal cancels it. The store refunds the money and knows nothing of the gems, and a reversal written only while the gems remain lets a player spend them first.

?+ The player spent the gems before the refund arrived. What does the ledger record?
* The reversal, whatever the balance, and a policy handles the deficit
- Nothing, since there are no gems left to take back from the player
- The reversal, once the player has earned enough gems to cover it
- The reversal, with the spends of those gems deleted from the ledger
- A note on the account, with the balance left as it was before
> The store has refunded the money whatever the game does, so the ledger records the full reversal, and the balance may go below zero. What follows is a policy that the game chose: spends refused until the balance recovers, items taken back, or small amounts written off, each recorded as entries of their own.

?+ Which source tells the server of a refund within minutes of it?
* The store's server notification, which reaches the game's backend
- The client, when the player next opens the game after the refund
- The store's monthly financial report, which lists each refund
- A daily job that checks each purchase with the store's server API
- The support ticket that the player files with the game's team
> The stores push refunds, revocations and renewals to the game's backend as they happen, Apple through its App Store Server Notifications and Google Play through its real-time developer notifications, with Google Play's list of voided purchases to catch any that were missed. Reports and daily checks come hours or weeks late, and the player may not open the game again.

?+ Why is a refund written as a new ledger entry instead of deleting the purchase's entry?
* The history then explains each balance: the grant and its reversal
- Deleting a row is slower than inserting one in most databases
- The purchase's entry is locked until the end of the financial year
- A deleted entry comes back when the next backup is restored
- The store's notification asks for an entry to be added, not deleted
> The ledger is appended to and never edited, so each balance is the sum of entries that each say what happened. A player's history then shows the purchase and its refund, which support and finance both need, while a deleted entry would leave the balance right and the history wrong.

## Leaderboards {#design-leaderboards}

A leaderboard answers five queries: submit a score, show the top N, show a player's rank, show the players around a player, and show a board of the player's friends. [[#design-storage]] chose the store for the first four, the [[sorted set]], and this section builds the board on Redis's. Each board is one sorted set whose members are player ids and whose scores are what the board ranks by:

| Query | Command | Time for N members |
| --- | --- | --- |
| Submit a score, keeping each player's best | `ZADD board GT CH score player` | O(log N) |
| The top N | `ZRANGE board 0 N-1 REV WITHSCORES` | O(log N + M) for M entries |
| A player's rank | `ZREVRANK board player` | O(log N) |
| The players around a player | `ZRANGE board from to REV WITHSCORES` | O(log N + M) |
| A friends' board | `ZMSCORE board friend friend …` | O(F) for F friends |

`GT` changes a member only when the new score is greater, and still adds a member that was not there, so the board keeps each player's best; a board that keeps the latest score uses a plain `ZADD`, and one that adds scores up uses `ZINCRBY`. `CH` makes the reply count the entries that changed, which tells the service whether the run set a new best. `ZREVRANK` counts from the highest score, starting at 0, and the players around rank r are the range from r − 5 to r + 5, with the start held at 0 near the top, since a negative index counts from the end of the set. Older examples use `ZREVRANGE`, which Redis's reference marks as deprecated in favor of `ZRANGE` with `REV`. Each command's time complexity is the one that [Redis's command reference](https://redis.io/docs/latest/commands/zadd/) states for it.

The sorted set is an index over the scores, and the database keeps the record. Each accepted score is written first to a table in the database, with the run it came from, and reaches the set through the outbox of [[#design-caches-queues]], so that a crash between the two writes delays the update instead of losing it; a job can read a period's scores back into a new key if the Redis node is lost. Redis can persist its data, with snapshots and an append-only file, but a snapshot loses the writes made since it was taken, while a board rebuilt from the database is exact. The database's copy also answers what the set cannot: which run produced a score, and whether it passed its checks.

Equal scores need a rule. Redis orders members with equal scores lexicographically, by the member itself, so in a reverse range “p-b” ranks above “p-a”, for no reason a player would accept. The usual rule is that whoever reached the score first ranks higher, and the time goes into the stored value. For a weekly board, with t the seconds since the week began:

```text
stored = score × 1,000,000 + (999,999 − t)
```

A week has 604,800 seconds, so t fits in the last six digits, and an earlier time leaves a larger remainder, which ranks higher in a reverse range. The score is the stored value divided by a million, rounded down. Sorted-set scores are 64-bit floating-point numbers, which hold each integer up to 2^53, about 9 × 10^15, exactly, so this encoding holds scores up to about 9 billion. Past 2^53, in this chapter's run, odd stored values came back rounded to an even neighbor: 9,100,000,000,999,997 was stored as 9,100,000,000,999,996, the value of a time one second away, so two times became one value. With `GT`, a player who reaches the same score again later leaves the earlier entry in place, since a later time makes a smaller value. The run's commands, for a week that began on Monday, September 21, 2026:

```bash
# p-17 scores 1,520 at t = 3,600 s, and p-42 scores 1,520 at t = 7,200 s.
redis-cli ZADD lb:week:2026-09-21 GT CH 1520996399 p-17   # 1: added
redis-cli ZADD lb:week:2026-09-21 GT CH 1520992799 p-42   # 1: added, below p-17
redis-cli ZADD lb:week:2026-09-21 GT CH 1520979999 p-17   # 0: the same score, reached later
redis-cli ZRANGE lb:week:2026-09-21 0 9 REV WITHSCORES    # the top 10, best first
redis-cli ZREVRANK lb:week:2026-09-21 p-42 WITHSCORE      # 1 and its value: second place
redis-cli ZMSCORE lb:week:2026-09-21 p-17 p-99            # a nil for a friend with no score
```

Daily, weekly and seasonal boards are separate keys, such as `lb:week:2026-09-21` for the week that begins that Monday. The reset is a moment in UTC, and the design says what it means in each time zone: a weekly reset at 00:00 UTC on Monday falls at 5 p.m. on Sunday in California in summer and at 9 a.m. on Monday in Japan, so the board's last hours come at a different part of each player's day. At the reset, new scores go to the next week's key, and a job closes the old board once: it takes the final standings from the database's scores, the complete copy, rather than from the set, which may still be applying the last updates, archives them, pays each player's reward under an operation id made of the board and the player, so that a rerun of the job pays nobody twice, and gives the old key an expiry with `EXPIREAT`, which takes a time in Unix seconds. Unity's Leaderboards service offers resets on a schedule that keep an archive of the previous scores.

How much memory a board takes is the estimate of [[#design-estimation]], which assumed 100 bytes per entry. In this chapter's run on Redis 8.10.2, built with the macOS allocator, `MEMORY USAGE` counted a board of a million players at 77 bytes per entry with ten-character player ids and at 109 with 36-character UUIDs, and a board of 10 million ten-character ids at 895 MB, 89 bytes per entry. A server with another allocator gives somewhat different figures, and the estimate holds: one weekly board of 10 million players fits in one node's memory.

A board outgrows one node when a game keeps many of them, or writes to one faster than one node takes, and a key does not spread over nodes: Redis Cluster places each key in one hash slot, which one node serves. Two designs go further. The first splits a board into shards by player id, each a sorted set on its own node: the top N is the merge of the shards' top N, and a player's rank is the sum, over the shards, of the players with a higher stored value, one `ZCOUNT` on each; two players with equal stored values, which the time makes rare, then share a rank, where one board would order them by member. The second changes the product. Players are placed in cohorts of fifty to a hundred, each with a small board of its own. Each board is then bounded, a cohort of a hundred stays in Redis's compact encoding at 22 bytes per entry in the same run, and nothing needs merging. It also gives each player a race they can win. At rank 3,456,789 of 9 million, a better run changes nothing the player can see, while fifth of a hundred is a place that a good evening can change, and rewards are paid by place in the cohort. Unity's Leaderboards calls these buckets: with a bucket size of 100, each player sees 99 others. Placing each player in a cohort at their first score of the period fills cohorts with players who are playing now, rather than with accounts that stopped months ago.

A cohort design gives up the exact global rank, and an approximate one is what a player deep in a board wants anyway: “top 38%”. A histogram of scores answers it: a count of players in each bucket of, say, 100 points, updated when a player's best moves from one bucket to another. The share of players above a score is the count in the buckets above it, plus a share of the player's own bucket, divided by the total, and a few hundred counters answer it for any number of players.

A friends' board reads the friends' scores when it is asked for, with `ZMSCORE`, sorts them in the service, and caches the result for a minute. The call grows with the friends list, which suits lists in the hundreds. A board kept for each player and updated whenever a friend scores would multiply each score's writes by the number of friends.

The score itself is the board's weakest point, since it comes from the client ([[#design-round-method]]). The server computes it from what the run recorded, or checks it against what the run allows: the run's duration, the level's highest possible score, the player's history. It limits how often a player can submit, and refuses values outside a plausible range. A player removed for cheating leaves the board with `ZREM`, their scores in the database are marked with the reason, and the end-of-period job passes over them, so the rewards go to the players below.

Lab exercise: Implement submit, top N, rank and around-me against a local Redis, or in .NET with a sorted structure if you have no Redis, with ties broken by the time a score was reached. Test two players who reach the same score a minute apart, a player who repeats their best score later, and a stored value past 2^53.

?? design-leaderboard-structure Which pair serves a weekly leaderboard of 10 million players?
* A sorted set for ranks, and a database that holds each accepted score
- A sorted set on its own, saved to disk by a snapshot once an hour
- A relational table with an index on the score, counted for each rank
- A key-value store holding each player's rank, rewritten at each score
- A document for the board, sorted by score and replaced at each submission
> A sorted set answers rank and range queries in logarithmic time, and the database keeps each score with the run it came from, so the set can be rebuilt exactly. An hourly snapshot loses up to an hour of scores, counting rows grows with the rank, stored ranks change for many players at each score, and a document for the whole board is rewritten at each submission.

?+ The Redis node holding the weekly board is lost. How does the board come back?
* A job reads the week's scores from the database into a new key
- The clients send their best scores again when they next open the game
- The board starts again empty, since a lost node's data is gone
- The board is loaded from last week's archive and played forward
- The CDN's cached copy of the top page is written back into Redis
> The sorted set is an index over the scores, and the database holds each accepted score, so a rebuild reads the week's scores back into a new key, exactly. Clients sending scores again would bring back the players who return and nobody else, an empty board wipes out the week, and last week's archive or a cached page holds other data.

?+ Two players reach 1,520 points, one on Monday and one on Friday. How does the board rank Monday's player first?
* The stored value combines the score with the time it was reached
- Redis ranks equal scores by the order in which they were added
- The service sorts equal scores by time after reading the range
- The database breaks the tie when the week's rewards are paid
- A second sorted set holds the times, and the two sets are merged
> Redis orders equal scores by member, not by time, so the time goes into the value: the score times a million, plus a remainder that is larger for an earlier time. Each query, the rank included, then sees the tie broken. Sorting a page in the service fixes the page and not the rank, and breaking ties at payout leaves the board wrong all week.

?+ A board keeps each player's best score this week. Which update does the service send?
* `ZADD` with `GT`, which changes an entry when the score is higher
- `ZADD` with no option, which stores each run's score as it comes
- `ZINCRBY`, which adds each run's score to the player's entry
- `ZADD` with `NX`, which writes a player's first score of the week
- `ZADD` with `XX`, which updates the players already on the board
> `GT` adds new players and changes an existing entry when the new score is greater, so a worse run leaves the best in place. A plain `ZADD` lets a worse run lower the entry, `ZINCRBY` sums the runs, `NX` keeps the first score all week, and `XX` does not add a player who has no entry yet.

?+ How does the service show the ten players around a player?
* It reads the player's rank, then the range of ranks around it
- It reads the whole board, then finds the player in the service
- It reads the players whose scores are within ten points of theirs
- It reads the top ten, then adds the player below them on the page
- It stores each player's neighbors, updated whenever a score changes
> `ZREVRANK` finds the player's rank in logarithmic time, and `ZRANGE` with `REV` reads the ranks around it, five above and five below. Reading the whole board takes time in the board's size, a window of scores returns any number of players, and stored neighbors change for many players at each score.

?? design-leaderboard-cohorts Why put players into cohorts of about a hundred instead of ranking them on one global weekly board?
* Each board stays small, and each player gets a race they can win
- A sorted set slows down past a million members, and cohorts avoid it
- Cohorts let the server accept scores without checking them first
- A global board needs a database copy, and cohort boards do not
- Cohorts spread the reset over the week, one cohort at a time
> A cohort bounds each board, which then needs no merge across nodes, and it turns rank 3,456,789, which a good evening does not change, into fifth of a hundred, which it can. A sorted set stays logarithmic at millions of members, each board's scores are still checked and stored, and the reset stays one moment in UTC.

?+ When is a player placed in a cohort for the week?
* At their first score of the week, into a cohort still filling
- At install, into a cohort that they keep for as long as they play
- At the reset, with all the accounts ever created spread over cohorts
- At the end of the week, when the final scores decide the cohort
- At each score, moving the player to the cohort nearest their score
> Placing players when they first score in the week fills each cohort with players who are playing now, so the race is real. Spreading accounts that stopped playing months ago leaves cohorts of empty entries, a cohort fixed at install ages with its players, and moving players between cohorts during the week makes the race meaningless.

?+ What does a cohort design give up?
* An exact global rank, which becomes an approximate share
- The durable copy of the scores, which cohorts keep in memory alone
- Checking scores, since a cohort of a hundred is too small to cheat in
- The weekly reset, since each cohort ends when it has filled up
- Rewards by rank, since a cohort's places are too close to reward
> Each player is ranked within their cohort, so the game no longer says exactly where they stand among millions, and a histogram of scores gives an approximate share instead. The scores are still stored and checked, the week still ends at the reset, and rewards are paid by place in the cohort.

?+ In a cohort design, how does the game still tell a player where they stand among all players?
* From counts of players per score bucket, as an approximate share
- From the sum of the player's ranks in each cohort they have been in
- From a global sorted set that the cohorts' boards are merged into
- From the player's rank in their cohort, multiplied by the cohorts
- From the top 100 of the game, compared with the player's own score
> A histogram counts the players in each bucket of scores, so the share above a player is the count in the higher buckets, plus a share of their own, over the total, from a few hundred counters. Multiplying a cohort's rank by the number of cohorts assumes that the cohorts are alike, and a merged global set brings back the board that the cohorts replaced.

## Matchmaking and game sessions {#design-matchmaking}

Matchmaking turns players who want to play into matches that are fair, quick to form and playable from where each player is. Each player, or each party playing together, is a ticket: the players' ids, the mode, the party's size, a skill rating with its uncertainty, and the latency that the client measured to each region where the game runs servers. The client creates the ticket, the matchmaker places it in a pool with the tickets that could share a match, and a loop that runs every second or so forms matches under the pool's rules and removes the tickets it used. Unity's Matchmaker, one of the [[Unity Gaming Services]], has the same parts: tickets that carry attributes such as a mode and a skill value, pools that group tickets by filters, and rules that form matches within each pool.

A rule such as “skill within 50 points, latency under 60 ms” gives fair matches and, at 4 a.m. or for the best players, slow ones, since few players online are that close. So the rules widen as a ticket waits: the skill window grows by 25 points every 10 seconds up to 300, and the latency limit rises from 60 ms to 120 ms after a minute. Unity's Matchmaker calls these relaxations, triggered by a ticket's age. Wait time against fairness is the trade-off to state aloud, with the cost of each end: narrow limits give even matches and long queues at quiet hours, and wide ones give quick matches that one side wins easily. Which limit relaxes first depends on the game. A shooter keeps latency tight the longest, since latency spoils each second of a match, while a slower game can reach a farther region first.

Tickets end. A ticket that has waited past its timeout, two minutes for instance, is removed, and the client offers to search again. A player who leaves the queue cancels the ticket, which Unity's Matchmaker lets the client do, and a cancellation that races the matchmaker can lose, so the client handles a match that arrives after the player pressed cancel. The client learns of its match in one of two ways. It polls the ticket, which is simple and costs requests: 50,000 players in the queue, polling every two seconds, send 25,000 requests a second that do nothing but wait. Or it hears over the persistent connection of [[#design-services-state]], which costs the connection tier and delivers the match at once.

An interview asks for the rating system by name. Elo gives each player a single rating, with no measure of how reliable it is. Glicko extends it with a ratings deviation, which measures the rating's uncertainty: each game lowers it, and time away from rated games raises it. TrueSkill models each player's skill as a mean and an uncertainty, and infers each player's skill from the results of teams. The design needs two numbers for each player, a rating and its uncertainty: a new player's uncertainty is high, so the matchmaker can place them across a wide range, and their first results move the rating quickly to where it belongs.

A party is one ticket for several players, rated by combining its members' ratings and matched so that its members play together. Three players who queue together coordinate better than three strangers with the same ratings, so a mode that allows parties can match parties against parties first and widen to solo players later. A match that loses a player asks for a replacement through backfill: the match's server opens a ticket for the empty slot, with the match's region and ratings, and the matchmaker fills it from the pool, as Unity's Matchmaker does.

After a match forms, the backend gets it a place to run: a game server in the chosen region, or a relay for a match that a player hosts, which the next section compares. Each client receives the address and a join token, signed by the backend for this match and this player and valid for minutes, which the server checks before it admits anyone. A player who drops can come back within a grace period, a minute for instance, while the server holds their place and accepts the same token. Unity's session service lets a player who disconnected, and who is still a member of the session, reconnect to it.

The result goes to the backend from the authority, the server that ran the match, once per match and [[idempotent]] for the match's id. The backend records the id with the result under a unique constraint, applies the ratings and the rewards in the same transaction, and answers a repeated report with the recorded result, since a server that timed out waiting for the answer sends it again. The clients do not report results. Each would report its own view, two clients can disagree after a disconnection, and a modified client reports whatever wins. In a match that a player hosts, the host is itself a client, so its report is a claim to check, against the other players' reports and against what the match allows, and a disputed match stays out of the ratings.

Much of mobile multiplayer needs no real-time server. In a turn-based game, or one in which a player attacks another player's stored base, the defender is not online: the backend stores a snapshot of the base, the attacker's client plays against it, and the client sends the result, or better, the inputs that produced it. The server replays the inputs through the same simulation, which must then give the same result on any machine, or checks the result against what the attack allows, and records it. That costs storage and HTTP requests, far less than a fleet of servers running matches.

Interview exercise: Design matchmaking for a million daily players with parties of up to three. Estimate the tickets waiting at the peak, state the rules and how they widen, and say what you would relax first when queues grow, and what that costs.

?? design-matchmaking-widening Why does a matchmaker widen a ticket's skill range as the ticket waits?
* To trade some fairness for a shorter wait when few peers are online
- To give new players easy matches until their rating settles down
- To keep tickets from timing out, since widened tickets stay in the pool
- To spread the load of the matching loop more evenly over the pools
- To match parties with solo players, which a narrow range keeps apart
> Close matches need close players, and at quiet hours or at the top of the ratings there are few. Widening the range over time lets a ticket that has waited take a less even match rather than wait on. A new player's wide range comes from their uncertainty, tickets still time out, and parties follow a rule of their own.

?+ At 4 a.m., the top-rated players wait ten minutes for a match. Which change shortens the wait?
* Widening their skill range sooner, accepting less even matches
- Narrowing their range, so that each match found is a closer one
- Polling the ticket more often, so that matches are found sooner
- Adding servers in their region, so that each match starts sooner
- Raising their tickets' priority above the other players' tickets
> The wait comes from too few players near their rating, and a wider range is what finds more. Polling reports a match sooner once it exists and does not form one, servers do not add players, and priority does not create opponents. The cost is less even matches at that hour, which is the trade-off to state.

?+ What does a ticket carry so that the matchmaker can form a fair match that plays well?
* A rating and its uncertainty, the party size, and latency by region
- The player's coin balance, so that matches pair players of equal wealth
- The player's full match history, so the matchmaker can rate them
- The player's friends list, so that friends are matched against each other
- The player's IP address, so the matchmaker can pick the nearest server
> The rating and its uncertainty decide who is close, the party size decides how teams fill, and the latencies that the client measured decide where the match can run. Ratings are computed elsewhere from match history, an IP address says little about latency to each region, and a balance has nothing to do with a fair match.

?+ A new player's rating has a high uncertainty. How does the matchmaker use it?
* It matches them across a wider range while their rating settles
- It keeps them waiting until the rating's uncertainty has fallen
- It matches them against the highest-rated players to measure them
- It ignores the uncertainty, since the rating alone decides matches
- It places them with bots until their first hundred matches end
> Uncertainty says how far the rating may be from the player's skill. For a new player, a close match by rating means little, so the matchmaker accepts a wider range, and the first results move the rating quickly to where it belongs. Waiting for certainty would keep new players out of play, and certainty comes from playing.

?+ A ticket has waited past its timeout. What happens to it?
* It leaves the pool, and the client offers the player another try
- It waits on, with its limits widened until any match is accepted
- It is matched with the next ticket, whatever the two ratings are
- It moves to the next region's pool, and its wait starts again
- It stays in the pool, and the client stops polling it
> A timeout ends the wait that the player sees, and the client says so and offers to search again or play something else. Widening without end, or matching any pair, hands out matches that nobody enjoys, and a ticket that nobody polls can be matched with players who then wait for someone who has gone.

?? design-match-results A match ran on a dedicated server. Who reports its result to the backend?
* The server that ran the match, once, keyed by the match's id
- Each client, and the backend takes the result that most report
- The winning team's clients, since the losers have no reason to
- The client of the player who stayed in the match the longest
- The matchmaker, which reads the result from the game server's log
> The server that ran the match saw what happened and is in no player's hands, so it reports, and the match id makes a repeated report harmless. Clients report their own view, disagree, and can be modified to report a win, and a majority of clients can be a party that cheats together.

?+ The match server reports a result, times out waiting for the answer, and sends it again. What stops the ratings from changing twice?
* The match id, recorded with the result, makes the repeat do nothing
- The server waits a minute before resending, so the first report lands
- The backend applies the latest report and discards the earlier one
- The matchmaker deletes the match when its first report arrives
- The ratings service locks the players until the match is archived
> The backend records the match id under a unique constraint, in the transaction that applies the ratings and the rewards, and answers a repeat with the recorded result. Waiting does not stop a second report from being applied, and applying the latest report still applies the result a second time.

?+ Why does the backend not let each client report its own result?
* A modified client can report a win, and two clients can disagree
- Clients would send too many requests to the backend as each match ends
- Clients do not know the final score until the server tells them
- The stores do not allow clients to send results to a server
- Clients' clocks differ, so their reports carry different times
> A result decides ratings and rewards, so it comes from a party that no player controls. A client's report is a claim, and a modified client claims a win, while two honest clients can disagree after a disconnection. Request volume, the stores and clocks have nothing to do with it.

?+ In an asynchronous attack on another player's stored base, how does the server trust the result?
* It replays the attacker's inputs, or checks the result against the attack
- It accepts the result, since no other player was online to dispute it
- It asks the defender's client to confirm the result at its next launch
- It trusts a result signed with a key compiled into the game
- It averages the result with the losses the defender was expected to take
> With no server running the match, the client played it, so its result is a claim. The server replays the inputs through the same simulation, which must give the same result on any machine, or checks the result against what the attack allows. The defender was offline, and a key in the build is in each copy of the game.

?+ A match that a player hosted reports that the host's team won. What does the backend do with the report?
* Checks it against the others' reports and what the match allows
- Applies it at once, since the host ran the match's authority
- Discards it, since results from hosts that are players are refused
- Applies it, and reverses it if another player files a complaint
- Asks the matchmaker to replay the match and report the result
> The host is a player whose device ran the match, so its report is one more claim. The backend compares it with what the other players' clients saw and with what the match allows, and a disputed match stays out of the ratings. Accepting it outright trusts a modified host, and a replay needs inputs that nobody kept.

## Real-time multiplayer at the system level {#design-realtime-multiplayer}

A real-time match needs a place for its state to live, and the three places give three topologies:

| Topology | Where the authority runs | Cost | Cheating | When the host leaves | Latency |
| --- | --- | --- | --- | --- | --- |
| Peer to peer | On each player's device, for what it owns | No servers | Each peer can lie about what it owns | What it owned leaves with it | Direct between players, where their networks allow it |
| Client host | On one player's device, which also plays | A relay's traffic at most | The host holds the authority and can change anything | The match ends, unless the host's role moves to another player | None for the host, a round trip through the relay for the others |
| Dedicated server | On a machine that the studio runs | A fleet of servers, and people to run it | Clients send inputs, and the server decides | No player hosts | Even for all, chosen by region |

A phone makes a fragile host. The operating system suspends a game that goes to the background, so a host who answers a call pauses the match for everyone, and both players are often behind network address translation, NAT, which lets a device open connections outward and rejects unsolicited incoming traffic. Two players behind NAT can sometimes still connect directly, by a technique called hole punching, and [RFC 5128](https://www.rfc-editor.org/rfc/rfc5128.html) records that it does not work across NATs of one kind, those with endpoint-dependent mapping. A relay, a server that both players connect out to and that forwards their packets, is the most reliable way through NAT and the least efficient, in the RFC's words, since each packet takes the longer path through the relay and its traffic has to be paid for.

Unity's options map onto the table. Netcode for GameObjects offers two topologies. Client-server uses a server authority model, with a dedicated server or with a listen server that one player's game hosts, and [its documentation](https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.9/manual/terms-concepts/network-topologies.html) notes that a dedicated server is much more resilient to compromised clients, while a listen server fails as a whole if its host is compromised. In distributed authority, the players' game instances share the ownership of the match's objects. Unity's Relay connects players to a player who hosts, without dedicated game servers: the other players use the host's join code to join the host's allocation on a Relay server, and exchange messages with the host through it. Unity's multiplayer services can migrate a session that a player hosts to a new host when the old one leaves. Unity's own game server hosting shut down on March 31, 2026, as [[#design-services-state]] records, so a Unity game on dedicated servers runs them on another provider's hosting or on its own.

In the authoritative design, the server simulates the match, and the clients send inputs, such as “move left” or “fire at tick 4,512”, never positions or hits. The server advances its simulation a fixed number of times a second, the tick rate, and sends each client the state at a send rate that may be lower; the tick rate of Netcode for GameObjects defaults to 30. Bandwidth follows the formula of [[#design-estimation]], state size × send rate × players. A match of 10 whose server sends each player a 1,000-byte update 20 times a second sends 200 KB a second, and each phone receives 20 KB a second, which a mobile network carries. The same match at 60 updates of 3,000 bytes sends each phone 180 KB a second, nine times as much, and the server's outbound traffic grows by the same factor.

Four techniques make an authoritative server playable across a round trip of 50 to 150 ms, the subject of [a series of articles on client-server game architecture](https://www.gabrielgambetta.com/client-server-game-architecture.html). In an interview each is worth a paragraph, and implementing them is outside this book.

Client-side prediction hides the round trip for the player's own actions. The client applies its inputs at once, as the server will apply them, so the character moves when the player presses instead of a round trip later. Server reconciliation corrects what prediction got wrong. Each state the server sends says which of the client's inputs it has applied, and the client resets its player to that state and applies again the inputs that the server has not yet seen. A misprediction, such as a collision with a player whose move the client had not yet heard of, shows as a correction: the character snaps to where the server put it, unless the client smooths the move over a few frames, which is a rendering choice on top of reconciliation.

Entity interpolation smooths the other players. Their states arrive 20 times a second, unevenly, so the client draws them slightly in the past, between the two latest states it holds, and they move smoothly at the cost of being shown a tenth of a second late or so.

Lag compensation makes aiming at what the player sees work. When a shot arrives, the server rewinds the other players to where the shooter saw them, by the shooter's latency and interpolation delay, and checks the hit there. The shooter's view decides, and the target pays for it, now and then hit after reaching cover.

Deterministic lockstep drops the state altogether. Each client runs the same simulation, and the clients exchange only their inputs for each turn, so the traffic stays small however many units the game moves. It needs the simulation to give identical results on each device, which floating-point code does not do across compilers and processor architectures without deliberate work, and the game advances at the pace of the slowest player's inputs.

Together they explain why a shooter and a card game need different servers. A competitive shooter needs dedicated servers near its players at a high tick rate, with prediction, interpolation and lag compensation, because the authority has to stay out of the players' hands and each millisecond shows. A turn-based card battler needs no real-time server: each move is an HTTP request that the backend checks against the rules, and the opponent learns of it over the persistent connection or by a push. Between them, a co-op builder can run on a client host through a relay, since players who cooperate have little to gain by cheating each other, with the world saved to the backend so that it outlives its host.

Exercise: Choose a topology for a real-time shooter, a co-op builder and a turn-based card battler, and justify each in two sentences: one on where the authority runs, and one on what the choice costs.

?? design-topology-choice A competitive real-time shooter with ranked play. Which topology fits?
* Dedicated servers, so that no player holds the authority
- A client host through a relay, since it costs the least to run
- Peer to peer, since players connect directly with the least latency
- Deterministic lockstep between clients, since its traffic is small
- A client host with host migration, so the match survives the host
> Ranked play makes cheating worth the effort, so the authority belongs on a server that no player holds, near the players, at a high tick rate. A host or a peer holds authority it can abuse, lockstep makes each player wait for the slowest one's inputs, and host migration keeps a match alive without making it fair.

?+ A four-player co-op builder on a small budget. Which topology fits?
* A client host through a relay: cheating gains co-op players little
- Dedicated servers in each region, since any client can be modified
- Peer to peer without a relay, since four players are few to connect
- A dedicated server for each match, since co-op needs low latency
- No real-time server, with each action sent to the backend over HTTP
> Players who cooperate have little to gain from cheating each other, so a client host is enough, and the relay reaches hosts behind NAT without a fleet of servers. Dedicated servers cost more than the cheating they would stop, direct connections fail on some players' networks, and a request for each action is too slow for real-time play.

?+ Why does a match hosted on a player's phone need a plan for the host leaving?
* The host's app can be suspended or closed, taking the authority with it
- The host's phone runs out of storage for the match's state quickly
- The relay closes its allocation when the host's battery runs low
- The other players' inputs reach a host on Wi-Fi more slowly
- The stores reject games whose matches depend on one player's device
> On a phone, a call or a switch to another app suspends the game, and the operating system may end it later, so the match's authority leaves with the host. Without host migration, which moves the host's role and the session's data to another player, the match ends for everyone.

?+ What does a relay add to a client-hosted game?
* A path to the host for players behind NAT, with no port forwarding
- Authority over the match, which moves from the host to the relay
- Lower latency than a direct connection between the two players
- Protection against a host that changes the match's state to win
- Storage for the match's state, so that the match survives the host
> Players are often behind NAT, which rejects unsolicited incoming traffic, so both connect out to the relay, which forwards their packets. The host keeps the authority and its chance to cheat, the path through the relay is longer than a direct one, and the relay stores nothing of the match.

?+ A turn-based card battler. What does it need from the backend during a match?
* No real-time server: each move is a request that the rules check
- A dedicated server at a high tick rate, to keep the turns in step
- A client host through a relay, so that the players' moves stay private
- Deterministic lockstep, so that both clients compute the same board
- Lag compensation, so that a slow player's moves count at the right time
> A turn is one request: the backend checks each move against the rules and the state it keeps, and the opponent learns of it over the persistent connection or by a push. A real-time server would idle between turns, a client host would hold the authority over the cards, and lag compensation is for aiming at moving targets.

?? design-prediction-purpose What does client-side prediction hide from the player?
* The round trip to the server, for the player's own inputs
- The gaps between the server's updates about the other players
- The time a shot takes to reach the server and be checked
- The packets that are lost between the client and the server
- The difference between the server's tick rate and its send rate
> The client applies its own inputs at once, as the server will, so the character moves when the player presses instead of a round trip later. Smoothing other players between updates is interpolation, checking shots against the past is lag compensation, and none of the three recovers lost packets.

?+ The server's state disagrees with where the client predicted its own player. What does reconciliation do?
* Takes the server's state and replays the inputs it has not seen
- Keeps the client's position, since the player saw it happen already
- Moves to the server's state, and drops the inputs sent since then
- Averages the two positions, so that the correction is not visible
- Asks the server to accept the client's position for this one tick
> The server's state is the truth as of the last input it applied, which it names. The client resets to it and applies again the inputs sent since, so the player keeps what they did and the error is corrected. Keeping the client's view ignores the authority, and dropping the later inputs throws away what the player did.

?+ Why does the server tell each client which of its inputs it has applied?
* So that the client knows which inputs to replay on that state
- So that the client can draw the other players at that same moment
- So that the client can slow its send rate to match the server's
- So that the server's log of the match can be replayed afterward
- So that the client can stop predicting until the server catches up
> Each state from the server reflects the inputs up to a certain one. The client needs that number to reset to the state and apply the inputs after it, which is the whole of reconciliation. Other players are drawn by interpolation, and pausing prediction would bring back the round trip that prediction hides.

?+ Another player blocks the path that the client predicted for its own player. What does the player see?
* A correction, as the server's state replaces the prediction
- A frozen character until the server's state arrives to replace it
- Nothing, since the server accepts the path the client predicted
- The other player moved back to where the prediction assumed
- A restart of the match, since the two states no longer agree
> The client predicted without knowing about the other player, and the server's state, which did know, puts the character where it is. Reconciliation applies the later inputs on top, so the player sees the character moved to the server's position, a visible snap unless the client smooths it, and the server's state is not bent to fit the prediction. Nothing freezes while the correction arrives.

?+ Which game gains least from client-side prediction?
* A turn-based card game, where each move waits for the server anyway
- A racing game, where the car must answer the steering at once
- A shooter, where the player's movement must follow the stick
- A fighting game, where each input must show on the next frame
- A co-op platformer, where each jump must feel instant to the player
> Prediction hides the round trip between an input and its result, which matters when the player acts continuously and watches the result at once. A card game's move is one discrete request whose result can wait a fraction of a second, so there is little to hide, while steering, movement, fighting and jumps feel wrong with any delay.

## Social: friends, presence, chat, and notifications {#design-social}

Social features are small tables with a large fan-out: a friends list is a few hundred rows, and one player coming online reaches each friend who is watching.

Friends are a relationship with states. A request from A to B waits until B accepts or declines it, and accepted friends see each other. A block by A hides B from A and stops B's requests, messages and invitations to A, and it is checked before any other rule. Each state is a row indexed by player, and limits, a few hundred friends and a few dozen pending requests, bound each operation that fans out over them. Unity's Friends service, one of the [[Unity Gaming Services]], shows presence only between friends who have not blocked each other.

Presence says who is online, in a match or away, and it comes from heartbeats: small messages that the client sends over its persistent connection, the [[WebSocket]] of [[#design-services-state]], every 30 seconds. On each heartbeat, the node that holds the connection sets `presence:p-17` with a [[time to live]] of 90 seconds, which the next heartbeat renews. When the heartbeats stop, the key expires and the player is offline. Nobody sends a logout, because on a phone hardly anyone logs out: the operating system suspends the game when the player switches apps and may end it later, a train enters a tunnel, a battery dies. A presence cleared at logout would show those players online for hours. The time to live is two or three heartbeats long, so that one late heartbeat does not flick a player offline and back, and it bounds how long the stored presence of a player who vanished stays online. Redis deletes an expired key when a client tries to read it, or when a periodic test of a few keys at random finds it, and its notification of the expiry fires at that deletion, which can come after the time to live ran out, so a service that reacts to players going offline allows for the delay.

A change of presence is published to the friends who are online, through the player channels of [[#design-services-state]], and its cost is the changes a second times the online friends who receive each. With 500,000 players online at the peak, an invented figure, each changing state every 10 minutes, the service handles about 830 changes a second; with 10 friends online each, that is 8,300 messages a second. Doubling the friend limit doubles the messages, which is why the limit is part of the design. A client that opens its friends list asks once for the state of each friend, and then receives the changes.

Chat is channels: a global channel split into rooms of a few hundred players, a guild's channel, and direct conversations. Messages keep one order within a channel: the chat service gives each message the next sequence number of its channel when it stores it, and clients show messages by that number, while nothing needs an order across channels. The history lives in a store keyed by channel and ordered by sequence number, kept for a set time, a week for a guild. Delivery follows [[#design-services-state]]: a message is stored first and published second, and a client that reconnects asks for the messages after the last sequence number it holds, since Redis's [[pub/sub]] delivers each message at most once and a subscriber that was away misses it.

Moderation has three tools. A filter checks each message before it is stored, for words, links and personal data such as phone numbers. Reports let players flag a message, with the messages around it, for a moderator to judge. Rate limits cap the messages of each player in each channel, with a [[token bucket]] that allows a short burst. Rules for minors decide what young players see at all. In the United States, COPPA requires verifiable parental consent before a service directed to children under 13 collects their personal information. In the European Union, most online services need a parent's consent to process a child's data on the grounds of consent, up to an age that each member state sets between 13 and 16. A game that knows a player's age turns open chat off below the age it has chosen, or limits it to preset phrases.

Push notifications leave the backend through a send service. The client registers its [[push token]] at each launch, as [[#os-notifications]] describes, and a registry holds each player's tokens by device, with the platform and, for APNs, the environment. A feature that wants to notify a player puts a message on a queue, with an id that makes it [[idempotent]], and moves on. The send service takes messages at the rate the providers accept, applies each player's cap, three a day and none at night in the player's time zone for instance, looks up the tokens, and sends through APNs or Firebase Cloud Messaging, the last hop. It reads their answers. APNs answers 410 with the reason `Unregistered` for a token that is no longer active for the app, with the time at which it found it so, and FCM answers `UNREGISTERED` for a token that is no longer valid; the service removes those tokens from the registry. APNs's 400 `BadDeviceToken`, in [Apple's list of APNs responses](https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns), is different: [[#os-notifications]] traces it to a token sent to the other environment's host, so it calls for a check of the routing before any token is dropped. FCM's guidance also has the server drop tokens whose app has not connected for a month, which FCM calls stale.

A send to each player at once is a spike that the send service causes itself. A push to 2 million players sent in one minute brings the players who tap it in the same few minutes: if one in ten taps, 200,000 sessions start together, each with the sign-in and loading of [[#design-estimation]]. Sent in slices over 20 minutes, the same taps arrive at a twentieth of the rate, and FCM's own guidance warns that sudden, unsmoothed changes in traffic cause spikes. Chapter 14 takes up the spike that such a push still causes.

Exercise: Design chat for guilds of fifty with a week of history. Estimate its messages a second at the peak, and say how a member who was offline for a day catches up, and how a guild officer's mute reaches each member's client.

?? design-presence-ttl Why does presence expire on a timer instead of being cleared when the player logs out?
* Sessions end in suspension, crashes and lost signal, not in logouts
- A logout request costs too much to send at the end of each session
- Redis removes a key faster when it expires than when it is deleted
- A timer lets the player appear online after they have closed the game
- The stores block requests from apps that are in the middle of closing
> A phone suspends a game when the player switches apps and may end it later, the signal drops in a tunnel, the battery dies, and none of these sends a logout. Heartbeats that stop let the key expire, so the player goes offline whatever ended the session. A deletion costs no more than an expiry.

?+ A player's phone loses its signal in the middle of a session. With a presence key whose time to live is 90 seconds, what do their friends see?
* Online until the key expires, then offline once that change reaches them
- Offline at once, since the connection tier notices the lost signal
- Online until the player opens the game again and logs out
- Offline at once, since the phone sends a last heartbeat as it drops
- Online until a friend sends a message and it fails to arrive
> The last heartbeat renewed the key and nothing removes it early, so the stored presence stays online until it expires, up to the time to live, and the friends see the change once it reaches them, which Redis's expiry notification can delay. A phone that lost its signal sends nothing more, and the connection node may take as long to notice.

?+ Heartbeats are sent every 30 seconds. Why is the presence key's time to live 90 seconds rather than 30?
* One late or lost heartbeat must not show the player offline
- A shorter time to live would put too much load on Redis's expiry
- The time to live has to be a multiple of the connection's timeout
- Friends' clients refresh presence at 90-second intervals, not 30
- Redis rounds each time to live up to the next full minute
> With a time to live equal to the interval, a heartbeat that arrives a moment late lets the key expire, and the player flickers offline and back. Two or three intervals absorb a late or lost heartbeat, at the cost of showing a vanished player online a little longer.

?+ Redis's notification that a presence key expired comes later than its time to live. Why?
* It is sent when Redis deletes the key, which may be later
- Redis batches expiry notifications and sends them once a minute
- The time to live counts from the key's last read, not its last write
- Pub/Sub delays each message until the subscribers are all connected
- The connection node's clock runs behind the clock of the Redis server
> An expired key is deleted when something reads it or when a background cycle finds it, and the notification is sent at that deletion. A service that reacts to players going offline allows for that delay, while a read of the key after its time to live finds it gone.

?? design-push-fanout A push goes to all 2 million players. Why does the send service spread it over minutes?
* Players who tap arrive together, and the backend takes the spike
- Pushes sent together are merged into one by the operating system
- Players read a push more often when it arrives in the evening
- The push tokens expire if one send reaches them all at once
- The queue holds the pushes in order and sends one each second
> The players who tap a push open the game within a few minutes of receiving it, so a push to all players sent at once is a synchronized spike of sign-ins and loads. Sent in slices over twenty minutes, the same taps arrive at a twentieth of the rate. The providers' own guidance also warns against sudden jumps in traffic.

?+ The backend takes 2,000 sign-ins a second, and one player in ten taps a push within seconds of its arrival. About how fast can the send service push to all 2 million players?
* About 20,000 pushes a second, which bring about 2,000 sign-ins a second
- About 2,000 pushes a second, one for each sign-in that the backend takes
- About 200 pushes a second, a tenth of the rate that the backend takes
- About 200,000 pushes a second, since nine players in ten do not tap
- All 2 million in the first second, since most players do not tap at all
> One push in ten brings a sign-in within seconds, so the sign-ins run at a tenth of the send rate: 20,000 pushes a second bring about 2,000 sign-ins a second, and the whole send takes 100 seconds. At 2,000 pushes a second the backend runs at a tenth of its capacity for 1,000 seconds, and a send all at once brings 200,000 sign-ins in the same few seconds.

?+ Why is the push send service fed by a queue instead of being called directly by each feature?
* Features go on at once, and the queue feeds the providers at their pace
- The queue stores each push so that the player can read it in the game
- The providers accept pushes from a server that drains a queue alone
- A queue delivers each push once, so no player receives it twice
- Features would otherwise need each player's push token to send
> The queue decouples the features from the providers: a feature adds a message and moves on, and the send service takes messages at the rate that the providers and the caps allow, through spikes and provider outages. Queues deliver at least once, which is why each message carries an id that makes a repeat harmless.

?+ How does the design stop a player from receiving twenty notifications in one evening?
* A cap per player, applied by the send service before each send
- A cap per feature, since each feature knows how often it sends
- The operating system, which shows one notification per app an hour
- The player's settings, which the client applies to each push
- The client, which hides pushes that arrive too close together
> Many features notify the same player, and none knows what the others sent, so the cap lives where each push passes: the send service, which counts each player's sends, holds or drops those over the cap, and keeps quiet hours in the player's time zone. A push that the client hides has still woken the phone, and the operating system does not cap a game's notifications for it.

## Live events, content, and telemetry {#design-live-events}

A live event is data, which the game runs without a new build. Its record holds an id, a start and an end in UTC, the players it targets by platform, app version or segment, a configuration version, which holds its rules and rewards, and a content version, which names its art and levels. The client's code knows the kinds of event the game has, and the data says which one runs, when, and for whom. The configuration reaches clients through [[remote configuration]], within the environment of [[#release-environments]]. Unity's Remote Config expresses an event as a Game Override: settings for a targeted group of players, with a start and an end in UTC and a priority that decides between overrides that overlap.

The event's start is compared with the server's time, not the device's, since the player can set the device's clock ([[#design-round-method]]). The client takes the server's time from its responses, keeps its offset from a clock that counts from the device's start and that the player cannot set, such as Android's monotonic `elapsedRealtime()` or Swift's `ContinuousClock`, and computes the server's time from the two without asking again.

An event's art and levels go to a [[CDN]] as versioned, immutable files. A file's name carries its version or a hash of its content, so a change is a new file under a new name, and a published file is not replaced. The CDN and the device can then keep each file for as long as they like, which HTTP states with `Cache-Control: max-age` and, from [RFC 8246](https://www.rfc-editor.org/rfc/rfc8246.html), `immutable`. A catalog names the files that a client needs. Addressables, Unity's system for loading content by address, builds a remote catalog for this, and can append each bundle's hash to its file name; the client checks for a newer catalog, which replaces the one built into the app when its hash changes, asks for the download size of what an event needs, and downloads it in advance. Each AssetBundle can be checked with a CRC before it is loaded. Asset bundles hold asset data and no code, as the Addressables documentation points out, so content that needs code from a newer app does not work in an older one: each app version is given the catalog built for it, and an old client receives only content it can read.

The event's start is the synchronized moment that [[#design-estimation]] sized, and three things take the spike out of it. The content is downloaded ahead: it ships in the days before the start, hidden, and the start unlocks it by server time, so that 670,000 players do not each fetch 150 MB in the same five minutes and wait while they do. Requests at the start are spread with jitter: each client waits a random few seconds before its first refresh after the start, as [[#network-retries]] recaps. And caches are warm before the start: the event's configuration and state are loaded into the caches in front of the database, so that the first minute's reads do not all miss.

Telemetry is the last pipeline of the chapter, and the one that loses and repeats data by design:

```text
client       events with ids and times, in batches  -> ingestion endpoint
ingestion    validate, add the arrival time         -> queue
consumers    drop repeated ids, check the schema    -> warehouse, by event time
```

The client gives each event an id and the time it happened, keeps it in the bounded queue of [[#network-offline]], and sends batches on a timer and when the game goes to the background, since a paused game may not run again ([[#os-lifecycle]]). Unity's Analytics works this way: its SDK fills in each event's id and timestamp and uploads batches every 60 seconds. A batch whose response is lost is sent again with the same ids, and the queue delivers at least once ([[#design-caches-queues]]), so the consumers remove duplicates by the event's id; Unity's Analytics ingestion describes its `eventUUID` as the way to prevent duplicates after a network timeout. The id is made on the device, because the device alone knows that a batch is a resend. Each event names the version of its schema, so that the warehouse can read the events of clients that are months old, and events that no consumer understands go to a dead-letter store instead of vanishing. High-volume events, such as frame times, are sampled by session, one session in a hundred for instance, with the rate recorded so that counts can be scaled back up. And consent comes first: as [[#sdk-consent-init]] sets out, nothing is collected before the player's answer where the law asks for consent, and Unity's Analytics records its standard events once consent is given.

Exercise: Trace one analytics event from a tap to a dashboard, marking each place where it can be lost or counted twice, and what prevents each.

?? design-event-prefetch An event's new content is 150 MB. Why do clients download it days before the event starts?
* At the start, the players would all download at once and wait to play
- The CDN charges less for downloads made outside of event hours
- Prefetching lets an old app use content that needs newer code
- Old clients need days to read the new content's file format
- The stores review downloaded content before it can be played
> A synchronized start sends the players to the CDN in the same minutes, and each waits for 150 MB before the event opens for them. Downloading ahead, with the content hidden until server time unlocks it, turns the start into a flag that flips. Prices and file formats have nothing to do with it, and content that needs newer code does not work in an old app however early it arrives.

?+ The event's content was downloaded ahead of time. What unlocks it at the start?
* The server's time, passing the start in the event's schedule
- The device's clock, passing the start in the player's time zone
- A push notification, sent to each player at the start
- A new catalog, published at the start with the content in it
- An app update, released through the stores at the start
> The schedule is data, and its start is compared with the server's time, which the client keeps from the server's responses, since the player can move the device's clock. A push does not reach everyone, a catalog published at the start brings the download back to the start, and an app update cannot be timed to the minute.

?+ A player opens the game a minute after the start, and the content never downloaded. What does the client do?
* Downloads it then, as the fallback that the prefetch made rare
- Shows the event as ended, since the prefetch window has passed
- Starts the event without its content, and loads it next session
- Skips the event, since its content is fetched ahead or not at all
- Asks the player to reinstall the game to get the event's content
> Prefetching moves most downloads before the start, and the few players who missed it, such as those who were offline all week, download at the start. That is a small load next to the whole player base at once. The event is data with a schedule, and a missed prefetch delays one player and leaves the event on time.

?+ Besides downloading ahead, what keeps the first minute of an event from overwhelming the backend?
* Jitter on each client's first refresh, and caches warmed before the start
- A longer time to live on the event's configuration, set at the start
- More read replicas, added when the first minute's errors appear
- A push at the start, so that the players arrive in a known order
- A queue in front of the CDN, so that downloads are taken in turn
> Jitter spreads the clients' first requests over seconds instead of one instant, and warm caches answer them without each missing to the database. A time to live set at the start begins with an empty cache, replicas added after errors come too late, and a push brings players together rather than apart.

?? design-telemetry-dedup A client's batch upload times out, and it sends the batch again. How does the pipeline avoid counting those events twice?
* Each event has an id made on the device, and consumers drop repeats
- The endpoint refuses a batch that is the same size as the last one
- The warehouse keeps the first event of each type in each session
- The client deletes a batch from its queue before sending it again
- The queue delivers each event once, so the second batch is dropped
> The first upload may have arrived before its response was lost, so the second repeats events that the pipeline holds. The device gave each event an id, so the resend carries the same ids, and the consumers drop the ones they have seen. Queues deliver at least once, and dropping by size or type would lose real events.

?+ Why does each event get its id on the device rather than at the ingestion endpoint?
* A resent batch has to carry the same ids, which the device alone knows
- The ingestion endpoint is too busy to generate ids for each event
- The device's ids are shorter and take less space in the warehouse
- The warehouse sorts events by id, and devices number them in order
- Ids from the endpoint would reveal which server received each batch
> The endpoint sees a resend as new events and would give them new ids, so the duplicates would look distinct. The device knows that the batch is the same one, and ids made there stay the same across each attempt. The warehouse orders events by their time, and the endpoint's workload is not the reason.

?+ The ingestion endpoint acknowledged the batch. Why can the consumers still see an event twice?
* The queue behind it delivers at least once
- The endpoint writes each event to two partitions for durability
- The warehouse replays each day's events at midnight to rebuild tables
- The client sends each event twice, once live and once in a batch
- Consumers read each message twice, once to check and once to load
> A consumer that crashes after loading an event and before acknowledging it receives the event again, so repeats happen with each part working as designed. The consumers therefore remove duplicates by event id wherever they come from, a resend by the client or a redelivery by the queue.

?+ How long must the consumers remember event ids to catch duplicates?
* As long as a resend or a redelivery can still arrive after the first
- One minute, since a resend follows its timeout within seconds
- Until the warehouse's nightly load, after which repeats do not matter
- As long as the batch's first upload took to be acknowledged
- One session, since a resend comes from the session that made it
> Duplicates arrive as late as the latest retry: a phone that was offline for a week sends its queue a week later, and a resend of a lost batch can come in the next session. The window of remembered ids has to cover that horizon, or the late repeat is counted.
