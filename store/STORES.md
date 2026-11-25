# Store setup for They Live

They Live is set up like Snowball Fight, so the steps are the same ones you
followed then. Things only you can do are marked **You:**.

## Before you publish: the name

Apple and Google can reject an app named after a film. Pick a store title of
your own (for example "Shades On: Lizard Invasion"), use it for the store
listings below, and tell me so I can put it in the game's title screen and
the app name. The bundle and package IDs don't change.

## IDs used by the builds

| | ID |
|---|---|
| Sideload APK ("They Live Dev") | `io.github.barnes1084.theylive.dev` |
| Google Play app | `io.github.barnes1084.theylive` |
| App Store bundle ID | `io.github.barnes1084.theylive` |

The old web version's APK used `io.github.barnes1084.theylive` with a
different signing key: uninstall it before installing the Play version.

## AdMob

The game shows Google's test ads until it has its own ad units.

1. **You:** AdMob → Apps → **Add app**, twice: Android and iOS ("Is the app
   listed?" No). For each: Ad units → a **Banner** and an **Interstitial**.
2. Send me the two app IDs (with `~`) and the four ad unit IDs (with `/`). I
   put them in `project.godot` and `scripts/ads.gd`.
3. **You:** Privacy & messaging: create a GDPR message and an IDFA explainer
   for both apps, as for Snowball Fight.

## Google Play

1. **You:** Play Console → **Create app**, package name
   `io.github.barnes1084.theylive`, free, game.
2. **You:** create an upload key and add the secrets
   `PLAY_UPLOAD_KEYSTORE_BASE64`, `PLAY_UPLOAD_KEYSTORE_PASSWORD` and
   `PLAY_UPLOAD_KEY_ALIAS` to **this** repository (Settings → Secrets and
   variables → Actions). I can generate the key for you, as before.
3. Every push then builds `theylive.aab` (in the run's artifacts) to upload.
4. **You:** the listing, content rating, data safety (same answers as Snowball
   Fight: ads only, Device ID and approximate location collected by AdMob),
   and closed testing with 12 testers for 14 days before production.
   The content rating will be higher than Snowball Fight's: cartoon violence
   with guns (expect Teen / 12+).

## App Store

1. **You:** developer.apple.com → Identifiers → **+** → App ID, bundle ID
   `io.github.barnes1084.theylive`.
2. **You:** App Store Connect → **+** New App with that bundle ID.
3. **You:** add the same four secrets you used for Snowball Fight
   (`APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`) to this
   repository.
4. **You:** Actions → **Build iOS** → Run workflow, with Upload to TestFlight
   ticked. Then TestFlight as before.
5. For review, have the App Review notes and a screen recording ready from the
   start (Apple asked for them on Snowball Fight).

## Privacy policy

`docs/privacy-policy.html` is the policy for this game. Host it like Snowball
Fight's (for example in your site repository) and use its link in both stores.
