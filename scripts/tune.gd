## Every number in the game, with its range and default. The game reads
## `Tune.v` live, so a change in the settings applies at once (stage layout
## settings apply from the next stage). Values are saved on the device.
## The defaults come from default_settings.cfg (edit that, not `def` below).
class_name Tune

const PATH := "user://tuning.json"

const ITEMS := [
	{group = "GAME"},
	{key = "gameSpeed", label = "Game speed", min = 0.5, max = 1.5, step = 0.05, def = 1, unit = "×"},
	{key = "startStage", label = "New runs start at stage", min = 1, max = 20, step = 1, def = 1},
	{key = "shake", label = "Screen shake", min = 0, max = 2, step = 0.1, def = 1, unit = "×"},
	{key = "vibrate", label = "Vibrate when you're hit", type = "bool", def = true},
	{key = "sfxVolume", label = "Sound effects volume", min = 0, max = 1, step = 0.05, def = 0.8, pct = true},
	{key = "musicVolume", label = "Music volume", min = 0, max = 1, step = 0.05, def = 0.5, pct = true},
	{key = "musicSpeed", label = "Music speed", min = 0.5, max = 2, step = 0.05, def = 1, unit = "×"},
	{key = "bannerAds", label = "Banner ad at the top", type = "bool", def = true, note = "takes effect on the next start"},
	{key = "interstitialEvery", label = "Full-screen ad every", min = 0, max = 10, step = 1, def = 2, unit = "stages", note = "0 = never; shown before the next stage or retry"},
	{group = "CONTROLS"},
	{key = "stickSize", label = "Move stick size", min = 40, max = 160, step = 5, def = 80, unit = "px"},
	{key = "buttonSize", label = "Button size", min = 0.6, max = 1.6, step = 0.05, def = 1, unit = "×"},
	{key = "buttonAlpha", label = "Button visibility", min = 0.2, max = 1, step = 0.05, def = 0.6, pct = true},
	{key = "swapSides", label = "Buttons on the left, stick on the right", type = "bool", def = false},
	{group = "HERO"},
	{key = "maxHearts", label = "Hearts", min = 1, max = 10, step = 1, def = 4},
	{key = "hitDamage", label = "Hearts lost per hit", min = 0, max = 4, step = 1, def = 1, note = "0 = invincible"},
	{key = "pitDamage", label = "Hearts lost falling in a pit", min = 0, max = 4, step = 1, def = 1},
	{key = "innocentDamage", label = "Hearts lost shooting an innocent", min = 0, max = 4, step = 1, def = 1},
	{key = "invTime", label = "Invincible after a hit", min = 0, max = 5, step = 0.1, def = 1.6, unit = "s"},
	{key = "startHardHat", label = "Start each stage with a hard hat", type = "bool", def = false},
	{key = "runSpeed", label = "Run speed", min = 1, max = 2, step = 0.05, def = 1, unit = "×"},
	{key = "jumpPower", label = "Jump power", min = 1, max = 1.5, step = 0.05, def = 1, unit = "×"},
	{key = "gravity", label = "Gravity", min = 0.6, max = 1, step = 0.05, def = 1, unit = "×", note = "lower = floatier"},
	{key = "tackleSpeed", label = "Tackle speed", min = 100, max = 400, step = 5, def = 185},
	{key = "tackleTime", label = "Tackle length", min = 0.1, max = 1, step = 0.02, def = 0.28, unit = "s"},
	{key = "tackleCooldown", label = "Tackle cooldown", min = 0, max = 3, step = 0.05, def = 0.7, unit = "s"},
	{key = "tackleDamage", label = "Tackle damage", min = 1, max = 20, step = 1, def = 3},
	{group = "WEAPONS"},
	{key = "startWeapon", label = "Starting weapon", type = "choice", def = "G", options = {"G": "Spread gun", "M": "Machine gun", "N": "Nail gun", "T": "Torch", "S": "Slugs"}},
	{key = "keepWeapon", label = "Keep weapon after game over", type = "bool", def = false},
	{key = "bulletSpeed", label = "Bullet speed", min = 0.5, max = 2, step = 0.05, def = 1, unit = "×"},
	{key = "bulletRange", label = "Bullet range", min = 0.5, max = 3, step = 0.1, def = 1, unit = "×"},
	{key = "spreadDelay", label = "Spread gun: time between shots", min = 0.05, max = 1, step = 0.01, def = 0.36, unit = "s"},
	{key = "spreadDamage", label = "Spread gun: damage per pellet", min = 0.25, max = 10, step = 0.25, def = 1},
	{key = "spreadPellets", label = "Spread gun: pellets", min = 1, max = 11, step = 1, def = 5},
	{key = "spreadAngle", label = "Spread gun: spread", min = 0.04, max = 0.4, step = 0.01, def = 0.16, unit = "rad"},
	{key = "mgDelay", label = "Machine gun: time between shots", min = 0.03, max = 0.5, step = 0.005, def = 0.075, unit = "s"},
	{key = "mgDamage", label = "Machine gun: damage", min = 0.25, max = 10, step = 0.25, def = 1},
	{key = "mgSweep", label = "Machine gun: scatter", min = 0, max = 0.6, step = 0.01, def = 0.22, unit = "rad"},
	{key = "nailDelay", label = "Nail gun: time between shots", min = 0.03, max = 0.5, step = 0.01, def = 0.1, unit = "s"},
	{key = "nailDamage", label = "Nail gun: damage", min = 0.25, max = 10, step = 0.25, def = 1},
	{key = "torchDelay", label = "Torch: time between puffs", min = 0.02, max = 0.3, step = 0.01, def = 0.05, unit = "s"},
	{key = "torchDamage", label = "Torch: damage", min = 0.05, max = 5, step = 0.05, def = 0.45},
	{key = "slugDelay", label = "Slugs: time between shots", min = 0.1, max = 1.5, step = 0.02, def = 0.42, unit = "s"},
	{key = "slugDamage", label = "Slugs: damage", min = 1, max = 20, step = 0.5, def = 5},
	{key = "slugPierce", label = "Slugs: enemies pierced", min = 0, max = 10, step = 1, def = 2},
	{key = "dropChance", label = "Sewer lizard drop chance", min = 0, max = 1, step = 0.01, def = 0.09, pct = true},
	{group = "SHADES & PORTAL"},
	{key = "shadesTime", label = "Shades last", min = 1, max = 120, step = 1, def = 6, unit = "s"},
	{key = "contactsTime", label = "Shades last with contacts", min = 1, max = 120, step = 1, def = 12, unit = "s"},
	{key = "shadesRecharge", label = "Shades full recharge", min = 0.5, max = 20, step = 0.5, def = 4, unit = "s"},
	{key = "startShades", label = "Start each stage with the shades", type = "bool", def = false},
	{key = "startPortal", label = "Start each stage with the portal", type = "bool", def = false},
	{key = "portalCooldown", label = "Portal cooldown", min = 0, max = 5, step = 0.1, def = 1.2, unit = "s"},
	{group = "LIZARDS"},
	{key = "enemyHp", label = "Lizard health", min = 0.25, max = 5, step = 0.25, def = 1, unit = "×"},
	{key = "enemySpeed", label = "Lizard speed", min = 0.3, max = 2.5, step = 0.05, def = 1, unit = "×"},
	{key = "enemyFireRate", label = "Lizard fire rate", min = 0.25, max = 4, step = 0.05, def = 1, unit = "×"},
	{key = "enemyShotSpeed", label = "Lizard shot speed", min = 0.4, max = 2.5, step = 0.05, def = 1, unit = "×"},
	{key = "waveRate", label = "Sewer ambushes", min = 0.25, max = 4, step = 0.05, def = 1, unit = "×"},
	{key = "revealDistance", label = "Disguise drops within", min = 0, max = 200, step = 5, def = 70, unit = "px"},
	{key = "revealTime", label = "Disguise drops after", min = 0.05, max = 3, step = 0.05, def = 0.45, unit = "s"},
	{key = "snatchRate", label = "Child snatchers", min = 0, max = 3, step = 0.1, def = 1, unit = "×", note = "0 = none"},
	{key = "snatchEscape", label = "Snatcher escapes after running", min = 4, max = 60, step = 1, def = 18, unit = "tiles"},
	{group = "MOLOCH"},
	{key = "bossHp", label = "Idol health", min = 0.1, max = 5, step = 0.05, def = 1, unit = "×"},
	{key = "bossSpeed", label = "Idol speed", min = 0.3, max = 3, step = 0.05, def = 1, unit = "×"},
	{key = "bossAttackRate", label = "Idol attack rate", min = 0.3, max = 3, step = 0.05, def = 1, unit = "×"},
	{key = "cultists", label = "Cultists at the ceremony", min = 0, max = 12, step = 1, def = 0, note = "0 = more each stage, up to 8"},
	{group = "SCORE"},
	{key = "lizardPoints", label = "Points per lizard", min = 0, max = 1000, step = 10, def = 100},
	{key = "savedPoints", label = "Points for saving a child", min = 0, max = 5000, step = 50, def = 500},
	{key = "lostPoints", label = "Penalty for losing a child", min = 0, max = 5000, step = 50, def = 1000},
	{key = "innocentPoints", label = "Penalty for shooting an innocent", min = 0, max = 5000, step = 50, def = 500},
	{key = "bossPoints", label = "Points for destroying the idol", min = 0, max = 20000, step = 500, def = 5000},
]

## The settings players see. Everything else is a developer setting: hidden
## and fixed at its default unless developer mode is on. Developer mode is
## always on in the sideload APK (export feature "dev_build"), never in the
## store builds ("play_store", "app_store"), and toggled by tapping the title 7 times
## anywhere else (the editor, desktop).
const PLAYER_KEYS := ["sfxVolume", "musicVolume", "vibrate", "shake", "stickSize", "buttonSize", "buttonAlpha", "swapSides"]

## Developer mode: every setting is shown and saved changes to them apply.
static var dev := false

## The default settings, editable without touching code. Every value in it
## replaces the `def` above; settings missing from it keep `def`.
const DEFAULTS_PATH := "res://default_settings.cfg"
static var _file_defaults := {}

## The current values, by key. Read as `Tune.v.gravity`.
static var v := {}
static var _loaded := false


static func items() -> Array:
	return ITEMS


static func ensure() -> void:
	if not _loaded:
		load_values()


## The sideload APK: every developer setting, always.
static func is_dev_build() -> bool:
	return OS.has_feature("dev_build")


## A store build (Google Play or the App Store): only the player settings,
## never developer mode.
static func is_store_build() -> bool:
	return OS.has_feature("play_store") or OS.has_feature("app_store")


## Whether developer mode can be switched on and off (tapping the title).
static func can_toggle_dev() -> bool:
	return not is_dev_build() and not is_store_build()


## A setting's default: from default_settings.cfg if it's there, else `def`.
static func def_of(t: Dictionary):
	return _file_defaults.get(t.key, t.def)


## Reads default_settings.cfg. Returns the keys in it that aren't settings.
static func load_defaults_file(path := DEFAULTS_PATH) -> Array:
	_file_defaults.clear()
	var unknown := []
	var cfg := ConfigFile.new()
	if cfg.load(path) != OK or not cfg.has_section("defaults"):
		return unknown
	var by_key := {}
	for t in ITEMS:
		if t.has("key"):
			by_key[t.key] = t
	for key in cfg.get_section_keys("defaults"):
		if not by_key.has(key):
			unknown.append(key)
			continue
		var t: Dictionary = by_key[key]
		var value = cfg.get_value("defaults", key)
		if t.get("type", "") == "" and typeof(value) not in [TYPE_INT, TYPE_FLOAT]:
			unknown.append(key)
			continue
		_file_defaults[key] = _norm(t, value)
	return unknown


## Every setting as default_settings.cfg text, with the current values:
## paste it over that file to make them the defaults.
static func defaults_text() -> String:
	var lines := [
		"; They Live: default settings.",
		";",
		"; Every value here is the setting's default: what a new player gets, and",
		"; what RESET puts it back to. Change a number, save, and the next build",
		"; uses it. A setting left out of this file uses the default in",
		"; scripts/tune.gd. Values outside a setting's range are clamped.",
		";",
		"; Tip: tune the game on your phone in the APK (developer settings), then",
		"; tap COPY AS DEFAULTS in the settings and paste over this whole file.",
		"",
		"[defaults]",
	]
	for t in ITEMS:
		if not t.has("key"):
			lines.append("")
			lines.append("; ---------- %s ----------" % t.group)
			continue
		var about: String = t.label
		match t.get("type", ""):
			"bool":
				about += " (true / false)"
			"choice":
				about += " (%s)" % ", ".join(t.options.keys().map(func(o): return "\"%s\"" % o))
			_:
				if t.get("pct", false):
					about += " (%s to %s, as a fraction: 0.01 = 1%%)" % [_num(t.min), _num(t.max)]
				else:
					about += " (%s to %s%s)" % [_num(t.min), _num(t.max), " " + t.unit if t.has("unit") else ""]
		if t.has("note"):
			about += ": " + t.note
		lines.append("; " + about)
		var val = v.get(t.key, def_of(t))
		var text := ""
		match t.get("type", ""):
			"bool":
				text = "true" if val else "false"
			"choice":
				text = "\"%s\"" % val
			_:
				text = _num(val)
		lines.append("%s=%s" % [t.key, text])
	return "\n".join(lines) + "\n"


static func _num(x) -> String:
	var f := float(x)
	if is_equal_approx(f, roundf(f)):
		return str(int(roundf(f)))
	return str(snappedf(f, 0.0001))


static func reset() -> void:
	for t in ITEMS:
		if t.has("key"):
			v[t.key] = _norm(t, def_of(t))


static func _norm(t: Dictionary, value):
	match t.get("type", ""):
		"bool":
			return bool(value)
		"choice":
			return str(value) if t.options.has(str(value)) else str(t.def)
		_:
			return clampf(float(value), float(t.min), float(t.max))


static func load_values() -> void:
	_loaded = true
	load_defaults_file()
	reset()
	dev = is_dev_build()
	if not FileAccess.file_exists(PATH):
		return
	var data = JSON.parse_string(FileAccess.get_file_as_string(PATH))
	if typeof(data) == TYPE_DICTIONARY:
		apply_saved(data)


## Applies saved values (as stored by save()).
static func apply_saved(data: Dictionary) -> void:
	reset()
	dev = is_dev_build() or (can_toggle_dev() and bool(data.get("_dev", false)))
	for t in ITEMS:
		# Outside developer mode, only the player settings are taken from the save.
		if t.has("key") and data.has(t.key) and (dev or t.key in PLAYER_KEYS):
			var value = data[t.key]
			var old_defs = data.get("_defaults", {})
			if typeof(old_defs) == TYPE_DICTIONARY and old_defs.has(t.key) and str(old_defs[t.key]) == str(value):
				continue
			if t.get("type", "") == "" and typeof(value) not in [TYPE_INT, TYPE_FLOAT]:
				continue
			v[t.key] = _norm(t, value)


static func save() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		var data := v.duplicate()
		data["_dev"] = dev
		# The defaults at the time, so values never changed from them follow
		# new defaults in a later version.
		var defs := {}
		for t in ITEMS:
			if t.has("key"):
				defs[t.key] = _norm(t, def_of(t))
		data["_defaults"] = defs
		f.store_string(JSON.stringify(data))


## Turns developer mode on or off. Turning it off puts every developer
## setting back to its default.
static func set_dev(on: bool) -> void:
	if not can_toggle_dev():
		return
	dev = on
	if not on:
		for t in ITEMS:
			if t.has("key") and t.key not in PLAYER_KEYS:
				v[t.key] = _norm(t, def_of(t))
	save()


## The items the settings screen shows right now.
static func visible_items() -> Array:
	if dev:
		return ITEMS
	return ITEMS.filter(func(t): return t.has("key") and t.key in PLAYER_KEYS)


static func is_default(t: Dictionary) -> bool:
	var d = _norm(t, def_of(t))
	if typeof(d) == TYPE_FLOAT:
		return is_equal_approx(float(v[t.key]), d)
	return v[t.key] == d
