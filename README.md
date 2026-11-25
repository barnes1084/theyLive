# They Live

A Contra-style run-and-gun for Android and iPhone, inspired by the cult film.
Built with [Godot 4](https://godotengine.org/), the same way as Snowball Fight:
same project layout, settings system, tests, builds and store pipeline.

You're a drifter construction worker with a wrestler's build, a blond mullet,
a white tank top and a spread gun. Somewhere on the street is a pair of
sunglasses. Put them on and the city turns black and white, the billboards
show their real messages (OBEY, CONSUME, SLEEP), and some of the people
around you turn out to be lizards.

## How it plays

Every stage is randomly generated, and the stages never end. Each stage has
two worlds along the same street: the **city**, and the **sewers** underneath
it. The screen shows the one you're in.

1. **The city.** People walk around, and some of them are lizards in
   disguise. Find the sunglasses (in a box outside a church) to tell them
   apart. Shooting an innocent person costs a heart. Pits are full of wet cement.
2. **The portal device.** One disguised lizard is carrying it; with the
   glasses on, it's the one with purple brackets. Kill it and grab the device,
   then use it to warp between the city and the sewers (it recharges between jumps).
3. **The sewers.** This is where all the **weapons and hearts** are. Down
   here the lizards don't bother hiding, and they keep coming while you're below.
4. **Child snatchers.** Kids play on the street, and every so often a lizard
   portals up next to one, grabs them and warps down to the sewers. Shoot it
   before it warps, or follow it down and shoot it there. Saved kids are
   beamed home (+500); if a snatcher gets away, the child is gone (-1000).
5. **The temple of Moloch.** The door at the end of either lane leads to a
   ceremony: robed lizard cultists chanting before a bronze idol. Start
   shooting and they fight back (zealots rush you, priests lob fireballs).
   The idol can't be hurt while any of them live. Kill them all and Moloch
   comes to life: it stomps after you, spits fireballs from its furnace belly,
   breathes fire, leaps to send shockwaves along the floor and calls in more
   cultists, getting angrier when badly hurt. Destroy it to clear the stage.

The lizards take back your shades and the portal device at the start of
every stage, so you have to find them again.

- **The sunglasses** (shades button, or G) drain a headache meter. If it runs
  out they come off until it's half recharged. Disguised lizards give
  themselves away now and then: they stop and stare, and the mask slips. Get
  too close and they attack; shoot one still in disguise for a **SPOTTED!**
  bonus. A hidden stash in the sewers only shows with the shades on.
- **Pickups** (all in the sewers, apart from what lizards drop): **M**
  machine gun, **N** nail gun, **T** torch (passes through enemies), **S**
  slugs (pierce two), hearts, a hard hat (absorbs one hit), **C** contact
  lenses (shades last twice as long), and **P** the portal device.
- **Tackle** is a quick shoulder charge: you can't be hurt during it, it
  flattens most lizards, never hurts bystanders, and knocks a child loose
  from a snatcher.

### Controls

| | Touch | Keyboard |
|---|---|---|
| Move / aim (8 directions) | Stick on the left (it appears where your thumb lands) | Arrows or WASD |
| Jump (down + jump drops through scaffolding) | **A** | Z, J or Space |
| Fire (hold) | **B** | X or K |
| Tackle | **TACKLE** | F or H |
| Lock: stand still, the stick only aims | **LOCK** (tap on, tap off) | Hold Shift or R |
| Sunglasses | **SHADES** (once you have them) | G, C or L |
| Portal device | **PORTAL** (once you have it) | V, Q or E |
| Pause | ❚❚ at the top right, or the back button | P or Esc |

Roll your thumb from **B** onto **A** to keep firing while you jump.
Left-handed? Swap the sides in the settings.

## Settings

**SETTINGS** on the title screen and the pause menu. Store builds show only
the player settings (sound, music, vibration, screen shake, control sizes and
sides). The sideload APK shows every developer setting: game speed, hearts,
damage, run speed, jump, gravity, the tackle, every weapon, the shades and
portal, the lizards, the snatchers, Moloch, and the scores. Tapping the title
seven times toggles developer mode in the editor and on desktop.

The defaults live in `default_settings.cfg`: edit a number and the next build
uses it (or tune on the phone and tap COPY AS DEFAULTS, then paste over the
file). After adding a setting, rewrite the file with
`godot --headless --path . -s res://tools/write_default_settings.gd`.

## Builds

Exactly as in Snowball Fight:

- **Android** (`.github/workflows/android.yml`): every push runs the tests and
  the touch check, builds the sideload APK ("They Live Dev",
  `io.github.barnes1084.theylive.dev`, signed with `android/theylive.jks`) and
  the Google Play bundle (`io.github.barnes1084.theylive`, signed with your
  upload key once the `PLAY_UPLOAD_*` secrets are set). Pushes to `main` also
  publish the APK as a GitHub release.
- **iOS** (`.github/workflows/ios.yml`, started by `ios-dispatch.yml`):
  exports the Xcode project, builds it, launches it on a simulator, and with
  the `APPLE_TEAM_ID` and `ASC_*` secrets signs it and uploads it to TestFlight.
- **Version:** the `VERSION` file is the version players see on both stores.

See `store/STORES.md` for setting up Google Play, the App Store and AdMob.

### Install the sideload APK

1. On your phone, open the latest release of this repository and download
   **theylive.apk**.
2. Open it and allow installs from your browser if asked, then **Install**.
   (It's a different app from the old web version: uninstall that one if you
   still have it.)

## Running and testing

```sh
godot --path .                                           # play on desktop
godot --headless --path . -s res://tests/run_tests.gd    # the tests
godot --path . -- --shot=play,1,/tmp/shot.png            # a screenshot (title, play, truth, sewer, boss, awake; add ,touch for the controls)
godot --path . -- --shot=input,1                         # the touch check
```

The tests check every setting is used and sane, every stage (80 of them
across four runs) is deterministic and can be finished in both lanes, the
core rules (shades, innocents, disguises, the portal, snatchers, the idol),
that every pose the game draws has art, and that the game plays on autopilot.

## Art and sound

- **Characters**: the sheets in `art-source/` are cut into one image per pose
  by `python3 tools/cut_sprites.py` (writes `assets/sprites/` and
  `meta.json`). Each sheet's layout is listed at the top of that script.
- **Icon**: `python3 tools/make_icon.py`.
- **Music and sound effects**: `python3 tools/make_audio.py` renders them all:
  original metal loops (title, streets, sewers, temple) played by a
  synthesized band, plus every sound effect.
- **Font**: Russo One, under the SIL Open Font License (`assets/fonts/OFL.txt`).

## Layout

- `scripts/stage.gd`: the endless stage generator (two lanes per street, and the temple)
- `scripts/game.gd`: the rules: player, weapons, shades, portal, people, lizards, snatchers, Moloch, the flow, and the autopilot
- `scripts/world.gd`: draws the world: city, sewers, temple, tiles, billboards, characters, shots, effects, the black-and-white truth view
- `scripts/art.gd`: loads and draws the character sprites
- `scripts/main.gd`: the loop, touch and keyboard controls, the HUD and the menus
- `scripts/tune.gd`, `scripts/settings_ui.gd`: every setting, and the settings screen
- `scripts/sfx.gd`, `scripts/ads.gd`, `scripts/ui.gd`, `scripts/progress.gd`: sound, ads, menu look, best scores
- `tests/run_tests.gd`: the tests
