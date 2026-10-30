# They Live

A 16-bit, Contra-style run-and-gun for Android, inspired by the cult film.
You're a drifter construction worker with a wrestler's build, a blond mullet, a white tank top and a spread gun. Somewhere on the street is a pair
of sunglasses. Put them on and the city turns black and white, the billboards
show their real messages (OBEY, CONSUME, SLEEP), and some of the people around
you turn out to be lizards.

## How it plays

Every stage is randomly generated, and the stages never end. Each stage has
two worlds along the same street: the **city**, and the **sewers** underneath
it. The screen shows the one you're in.

1. **The city.** Pedestrians walk around, and some of them are lizards in
   disguise. Find the sunglasses (in a box outside a church) to tell them apart.
   Shooting an innocent person costs a heart. Pits are full of wet cement.
2. **The portal device.** One disguised lizard is carrying it. With the glasses
   on you can see it glowing purple in its hand. Kill that lizard and grab the
   device, then use it to warp between the city and the sewers as often as you
   like (it needs a moment to recharge between jumps).
3. **The sewers.** This is where all the **weapons and hearts** are. Down here
   the lizards don't bother hiding, and they keep coming, Contra style, while
   you're below. Watch out for the sludge.
4. **Child snatchers.** Kids play on the street, and every so often a lizard
   portals up next to one, grabs them and warps back down to the sewers, then
   runs for its nest. Shoot it before it warps (it holds still for a moment
   while the child struggles), or follow it down with the portal device and
   shoot it there. Saved kids are beamed home safe (+500 and a bigger stage
   bonus). If a snatcher gets away, the child is gone (-1000). The stage-clear
   screen counts children saved and taken.
5. **The temple of Moloch.** A door at the end of either lane leads to a
   sacrifice ceremony: robed lizard cultists chanting before a stone idol of
   Moloch. Start shooting and they fight back (zealots rush you, priests lob
   fireballs). The idol can't be hurt while any of them live. Kill them all
   and Moloch comes to life: it stomps after you, spits fireballs from its
   furnace belly, breathes fire, leaps to send shockwaves along the floor and
   calls in more cultists, getting faster when badly hurt. Destroy it to clear
   the stage.

Then the next stage starts, a bit harder. The lizards take back your shades
and the portal device at the start of every stage, so you have to find them again.

### The sunglasses

- Toggle them on and off (**G** key, or the shades button).
- Wearing them drains the **headache meter**. If it runs out, they come off and
  you can't use them again until it's half recharged.
- Disguised lizards give themselves away now and then: they stop and stare at
  you, and their mask slips for a moment.
- Get too close to a disguised lizard and it attacks. Shoot it while it's still
  in disguise for a **SPOTTED!** bonus.
- The lizard carrying the portal device has purple brackets.
- A hidden stash in the sewers (a heart, a hard hat or contact lenses) only
  shows up with the glasses on.

### Pickups

All of these are in the sewers, apart from what lizards drop. You start every
run with the **spread gun**, a wide five-pellet fan; a weapon pickup replaces
it until you grab another. Most lizards go down in one or two hits.

| Pickup | What it does |
|---|---|
| **P** Portal device | Warp between the city and the sewers (dropped by one lizard) |
| **M** Machine gun | Rapid fire that sweeps straight, angled up, angled down, and repeats |
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
| Tackle | **TACKLE** | F or H |
| Lock and aim: stand still, the stick only aims | **LOCK** (tap to turn on, tap again to turn off) | Hold Shift or R |
| Sunglasses | Shades button | G, C or L |
| Portal device | Purple portal button (appears once you have it) | V, Q or E |
| Pause | ❚❚ at the top right | P or Esc |

Hold down to crouch under shots that fly straight at you.

**Tackle** is a quick shoulder charge. You can't be hurt during it, it
flattens most lizards in one hit, and tackling a snatcher knocks the child out
of its grip so they can run away. It recharges in under a second and works in
midair too.

### View

The screen shows one world at a time, up close: the city, or the sewers once
you portal below. If a snatcher drags a child into the other world, a red
"HELP!" arrow at the screen edge points to it.

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

- `web/js/stage.js`: endless stage generator, two lanes per level (shared with the tests)
- `web/js/game.js`: game rules (player, weapons, glasses, portal device, enemies, boss, flow)
- `web/js/render.js`: drawing at twice the world resolution, parallax backgrounds, sewer lighting, the black-and-white "truth" view, HUD and menus
- `web/js/sprites.js`: pixel-art sprites and palettes, the Scale2x/Scale3x smoothing and automatic shading that give them their 16-bit look, detailed tiles, and the pixel font
- `web/js/audio.js`: chiptune music and sound effects made with Web Audio
- `web/js/input.js`: keyboard and touch controls
- `test/stage.test.mjs`: checks both lanes of every stage can be finished with the player's jump
- `android/`: Android app that bundles `web/` into a full-screen WebView
- `tools/icons.mjs`: generates the launcher and web icons
