# They Live

An 8-bit, Contra-style run-and-gun for Android, inspired by the cult film.
You're a construction worker with a shotgun. Somewhere on the street is a pair
of sunglasses. Put them on and the city turns black and white, the billboards
show their real messages (OBEY, CONSUME, SLEEP), and some of the people around
you turn out to be lizards.

## How it plays

Every stage is randomly generated, and the stages never end. Each one has three parts:

1. **The streets.** Pedestrians walk around, and some of them are lizards in
   disguise. Find the sunglasses (in a box outside a church) to tell them apart.
   Shooting an innocent person costs a heart.
2. **The sewers.** Drop down the open manhole. Down here the lizards don't
   bother hiding, and they keep coming, Contra style. Watch out for the sludge.
3. **The lair.** A boss on a hover pod, who gets new attack patterns as you go deeper.

Then the next stage starts, a bit harder. The lizards take your shades at the
start of every stage, so you have to find them again.

### The sunglasses

- Toggle them on and off (**G** key, or the shades button).
- Wearing them drains the **headache meter**. If it runs out, they come off and
  you can't use them again until it's half recharged.
- Disguised lizards give themselves away now and then: they stop and stare at
  you, and their mask slips for a moment.
- Get too close to a disguised lizard and it attacks. Shoot it while it's still
  in disguise for a **SPOTTED!** bonus.
- Hidden stashes (extra hearts, hard hats, weapons, contact lenses) only show up
  with the glasses on.

### Pickups

| Pickup | What it does |
|---|---|
| **N** Nail gun | Fast fire, long range |
| **T** Torch | Short-range flamethrower that passes through enemies |
| **S** Slugs | Hard-hitting shots that pass through up to two enemies |
| Heart | Restores one heart |
| Hard hat | Absorbs one hit |
| **C** Contact lenses | The glasses drain half as fast for the rest of the run |

### Controls

| | Touch | Keyboard |
|---|---|---|
| Move / aim (8 directions) | Stick on the left | Arrows or WASD |
| Jump (down + jump drops through scaffolding) | **A** | Z, J or Space |
| Fire (hold) | **B** | X or K |
| Sunglasses | Shades button | G, C or L |
| Pause | ❚❚ at the top right | P or Esc |

Hold down to crouch under shots that fly straight at you.

## Install on Android (APK)

Every push to `main` builds a signed APK and publishes it as a GitHub Release.

1. On your phone, open <https://github.com/barnes1084/theyLive/releases/latest>
   and download **theylive.apk**.
2. Open the downloaded file. The first time, Android asks you to allow installs
   from your browser or file manager: allow it, then tap **Install**.
3. Later builds install over the old one and keep your best score.

Pushes to other branches build the APK too; it's attached to the
**Build Android APK** workflow run as the `theylive-apk` artifact (it downloads
as a zip).

The app is a thin WebView wrapper (`android/`) around the game in `web/`, so
there's one codebase for the phone and the browser. To build it yourself with
the Android SDK installed: `cd android && ./gradlew assembleRelease`.

### Signing

APKs are signed with `android/app/theylive.jks`, which is committed so every
build has the same signature and updates install in place. Anyone with this
repo can sign an APK as this app. That's fine for a personal, sideloaded game,
but use a private key before publishing it anywhere.

## Run locally

```sh
npm start      # serves web/ at http://localhost:8080
npm test       # checks generated stages can always be finished
npm run icons  # redraws the app icons
```

## Layout

- `web/js/stage.js`: endless stage generator (shared with the tests)
- `web/js/game.js`: game rules (player, weapons, glasses, enemies, boss, flow)
- `web/js/render.js`: drawing, the black-and-white "truth" view, HUD and menus
- `web/js/sprites.js`: pixel-art sprites, palettes and the 3x5 pixel font
- `web/js/audio.js`: chiptune music and sound effects made with Web Audio
- `web/js/input.js`: keyboard and touch controls
- `test/stage.test.mjs`: checks every stage's exits can be reached with the player's jump
- `android/`: Android app that bundles `web/` into a full-screen WebView
- `tools/icons.mjs`: generates the launcher and web icons
