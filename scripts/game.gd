## The rules: the player, weapons, sunglasses, the portal device, people,
## lizards, child snatchers, the temple of Moloch, and moving on through the
## stages. Pure logic with no drawing, so the tests can run it headless.
## Units are world pixels and seconds; y grows downward.
## Main feeds it input each fixed step and plays the sounds it asks for.
class_name Game
extends RefCounted

const TILE := Stage.TILE
const LANE_ROWS := Stage.LANE_ROWS
const VIEW_H := Stage.ROWS * TILE
const LANE_H := LANE_ROWS * TILE
const STEP := 1.0 / 60.0
const FLOOR_Y := Stage.ARENA_FLOOR * TILE
const ALTAR_X := Stage.ARENA_COLS * TILE / 2.0
const PEDESTAL_H := 10.0

## Shoulder height above the feet, and rifle length, in world pixels.
const SHOULDER := 16.5
const CROUCH_SHOULDER := 10.5
const RIFLE := 12.5

const WEAPON_INFO := {
	G = {name = "SPREAD GUN", delay = "spreadDelay"},
	M = {name = "MACHINE GUN", delay = "mgDelay"},
	N = {name = "NAIL GUN", delay = "nailDelay"},
	T = {name = "TORCH", delay = "torchDelay"},
	S = {name = "SLUGS", delay = "slugDelay"},
}

const AREA_TITLES := {street = "THE STREETS", boss = "THE TEMPLE"}

## play | transition | dying | clear | gameover
var mode := "play"
## World pixels visible across and down (set by Main from the screen).
var W := 256.0
var view_h := float(LANE_H)
var time := 0.0
var run_seed := 1
var stage_num := 1
var stage := {}
var area_key := "street"
var area := {}
var cam := Vector2.ZERO
var player := {}
var actors: Array = []
var bullets: Array = []
var shots: Array = []
var pickups: Array = []
var particles: Array = []
var texts: Array = []
var portal_fx: Array = []
var banner = null
var fade := 0.0
var shake := 0.0
var score := 0
var hearts := 4
var armor := false
var weapon := "G"
var glasses := {have = false, on = false, meter = 1.0, locked = false, contacts = false, taken = false}
var portal := {have = false, cd = 0.0}
var carrier_pending := false
var spawn_index := 0
var wave_timer := 3.0
var snatch_timer := 9.0
var boss = null
var boss_dead_timer := 0.0
var stage_stats := {}
var clear_info := {}
var transition := {}
var dying_timer := 0.0
var ceremony_alarm := false
var using_touch := false
## Sound effects asked for since Main last looked (names), and the music.
var sounds: Array = []
var music_track := "city"
## Things that happened this step that Main may care about (vibration).
var events: Array = []
var rng := RandomNumberGenerator.new()
var _next_id := 1
var input := {held = {}, pressed = {}}


func _init(seed_value := -1) -> void:
	Tune.ensure()
	if seed_value >= 0:
		rng.seed = seed_value
	else:
		rng.randomize()


# ---------- Flow ----------

func new_run(seed_value := -1) -> void:
	run_seed = seed_value if seed_value >= 0 else rng.randi()
	score = 0
	hearts = int(Tune.v.maxHearts)
	armor = false
	weapon = str(Tune.v.startWeapon)
	glasses.contacts = false
	start_stage(int(Tune.v.startStage))


func start_stage(n: int) -> void:
	stage_num = n
	stage = Stage.generate(n, run_seed)
	# The lizards took your shades and the portal device. Find them again.
	glasses.have = Tune.v.startShades
	glasses.on = false
	glasses.meter = 1.0
	glasses.locked = false
	glasses.taken = Tune.v.startShades
	portal = {have = bool(Tune.v.startPortal), cd = 0.0}
	if Tune.v.startHardHat:
		armor = true
	carrier_pending = false
	stage_stats = {lizards = 0, innocents = 0, saved = 0, lost = 0, score = score}
	snatch_timer = 9.0
	enter_area("street")
	banner = {title = "STAGE %d" % n, sub = "FIND THE SUNGLASSES" if n == 1 else "THEY TOOK YOUR SHADES. FIND THEM!", t = 3.0}


## After a game over: the same stage again, with the score it started with.
func retry_stage() -> void:
	score = stage_stats.score
	hearts = int(Tune.v.maxHearts)
	armor = false
	if not Tune.v.keepWeapon:
		weapon = str(Tune.v.startWeapon)
	start_stage(stage_num)


func next_stage() -> void:
	start_stage(stage_num + 1)


func enter_area(key: String) -> void:
	area_key = key
	area = stage[key]
	actors = []
	bullets = []
	shots = []
	particles = []
	texts = []
	portal_fx = []
	boss = null
	boss_dead_timer = 0.0
	pickups = []
	for p in area.pickups:
		var k: Dictionary = p.duplicate()
		k.vy = 0.0
		k.taken = false
		k.dropped = false
		pickups.append(k)
	spawn_index = 0
	wave_timer = 3.0
	cam.x = 0.0
	var start_x: float = area.start_x
	var start_c := int(start_x / TILE)
	player = {
		x = start_x, y = float(area.ground[0][start_c] * TILE), w = 8.0, h = 21.0, vx = 0.0, vy = 0.0, face = 1,
		on_ground = true, ground_tile = Stage.SOLID, crouch = false, planted = false, aim = Vector2(1, 0), fire_cd = 0.0,
		inv = 0.0 if key == "street" else 1.0, drop = 0.0, coyote = 0.0, jump_buf = 0.0, anim = 0.0, firing = 0.0,
		tackle = 0.0, tackle_cd = 0.0, tackle_hit = {}, burst_step = 0,
		# Short timers for the poses: putting the shades on, warping, landing, hurt.
		shades_t = 0.0, portal_t = 0.0, land_t = 0.0, hurt_t = 0.0,
	}
	if key == "boss":
		_start_ceremony()
	update_camera(0.0, true)
	music_track = "boss" if key == "boss" else "city"
	mode = "play"


## Across, the camera follows the player forward only (Contra style), or
## frames the temple. Up and down it shows one world at a time: the city, or
## the sewers once the player portals below.
func update_camera(_dt: float, snap := false) -> void:
	if player.is_empty() or area.is_empty():
		return
	var area_w: float = area.cols * TILE
	if area.kind == "boss":
		cam.x = (area_w - W) / 2.0 if W >= area_w else clampf(player.x - W / 2.0, 0.0, area_w - W)
		cam.y = Stage.ARENA_FLOOR * TILE + TILE - view_h
	else:
		var target := minf(player.x - W * 0.4, area_w - W)
		cam.x = maxf(0.0, target) if snap else maxf(cam.x, target)
		cam.y = Stage.lane_of(player.y) * LANE_H


func transition_to(key: String) -> void:
	mode = "transition"
	transition = {key = key, t = 0.0, done = false}
	_sfx("descend")


func _stage_clear() -> void:
	mode = "clear"
	var bonus := 1000 * stage_num + 500 * int(stage_stats.saved)
	score += bonus
	clear_info = {bonus = bonus}
	_sfx("clear")
	music_track = ""


func _game_over() -> void:
	mode = "gameover"
	_sfx("gameover")
	music_track = ""


# ---------- Helpers ----------

func _sfx(name: String) -> void:
	sounds.append(name)


func add_text(x: float, y: float, s: String, color := Color("#fcfcfc"), life := 1.0) -> void:
	texts.append({x = x, y = y, text = s, color = color, life = life, max = life})


func burst(x: float, y: float, color: Color, n := 8, speed := 80.0) -> void:
	for i in n:
		var a := rng.randf() * TAU
		var s := speed * (0.3 + rng.randf())
		particles.append({x = x, y = y, vx = cos(a) * s, vy = sin(a) * s - 30, life = 0.3 + rng.randf() * 0.4, color = color, size = 2.0 if rng.randf() < 0.3 else 1.0})


func add_score(n: int) -> void:
	score = maxi(0, score + n)


## Takes `amount` hearts; `force` ignores invincibility and the hard hat.
func _hurt_player(force := false, amount := -1) -> void:
	if amount < 0:
		amount = int(Tune.v.hitDamage)
	var p := player
	if not force and (p.inv > 0 or p.tackle > 0):
		return
	if mode != "play" or amount <= 0:
		return
	shake = 0.25
	if armor and not force:
		armor = false
		p.inv = maxf(1.2, Tune.v.invTime)
		_sfx("hit")
		add_text(p.x, p.y - 28, "HARD HAT!", Color("#f8d800"))
		burst(p.x, p.y - 20, Color("#f8d800"), 6)
		return
	hearts = maxi(0, hearts - amount)
	p.inv = Tune.v.invTime
	p.vy = -126.0
	p.hurt_t = 0.3
	_sfx("hurt")
	events.append("hurt")
	burst(p.x, p.y - 12, Color("#d82800"), 10)
	if hearts <= 0:
		mode = "dying"
		dying_timer = 1.6
		p.vy = -173.0


func _standable_column(c: int, lane: int) -> bool:
	if c < 0 or c >= area.cols:
		return false
	var gr: int = area.ground[lane][c]
	return gr >= 0 and not Stage.is_solid(Stage.tile_at(area, c, gr - 1)) and not Stage.is_solid(Stage.tile_at(area, c, gr - 2))


func _safe_column(c: int, lane: int) -> int:
	for i in range(maxi(c, 0), area.cols):
		if _standable_column(i, lane):
			return i
	return c


func lane_of_player() -> int:
	return Stage.lane_of(player.y) if area.kind == "street" else 0


func _respawn_player(lane: int) -> void:
	var p := player
	var c := _safe_column(int((cam.x + 24) / TILE), lane)
	p.x = c * TILE + TILE / 2.0
	p.y = float(area.ground[lane][c] * TILE)
	p.vx = 0.0
	p.vy = 0.0
	p.inv = 2.0


# ---------- Tile physics ----------

func _blocked(x: float, y: float) -> bool:
	return Stage.is_solid(Stage.tile_at(area, floori(x / TILE), floori(y / TILE)))


## Moves a body across; returns true if it hit a wall.
func _move_x(b: Dictionary, dx: float) -> bool:
	if dx == 0:
		return false
	b.x += dx
	var top: float = b.y - b.h + 1
	var bottom: float = b.y - 1
	var edge: float = b.x + b.w / 2 - 0.001 if dx > 0 else b.x - b.w / 2
	var c := floori(edge / TILE)
	for r in range(floori(top / TILE), floori(bottom / TILE) + 1):
		if Stage.is_solid(Stage.tile_at(area, c, r)):
			b.x = c * TILE - b.w / 2 if dx > 0 else (c + 1) * TILE + b.w / 2
			return true
	return false


## Moves a body up or down, landing on floors and one-way platforms.
func _move_y(b: Dictionary, dy: float) -> void:
	var prev_bottom: float = b.y
	b.y += dy
	b.on_ground = false
	var c0 := floori((b.x - b.w / 2 + 0.001) / TILE)
	var c1 := floori((b.x + b.w / 2 - 0.001) / TILE)
	if dy > 0:
		var r := floori((b.y - 0.001) / TILE)
		for c in range(c0, c1 + 1):
			var t := Stage.tile_at(area, c, r)
			var oneway: bool = t == Stage.ONEWAY and prev_bottom <= r * TILE + 0.01 and not (b.get("drop", 0.0) > 0)
			if Stage.is_solid(t) or oneway:
				b.y = float(r * TILE)
				b.vy = 0.0
				b.on_ground = true
				b.ground_tile = t
				return
	elif dy < 0:
		var r := floori((b.y - b.h) / TILE)
		for c in range(c0, c1 + 1):
			if Stage.is_solid(Stage.tile_at(area, c, r)):
				b.y = (r + 1) * TILE + b.h
				b.vy = 0.0
				return


func _physics(b: Dictionary, dt: float, gravity := Stage.GRAVITY) -> bool:
	b.vy = minf(b.vy + gravity * dt, 340.0)
	var hit_wall := _move_x(b, b.vx * dt)
	_move_y(b, b.vy * dt)
	if b.get("drop", 0.0) > 0:
		b.drop -= dt
	return hit_wall


## Is there floor just ahead of a walker's feet?
func _floor_ahead(b: Dictionary, dir: float) -> bool:
	var x: float = b.x + dir * (b.w / 2 + 2)
	var t := Stage.tile_at(area, floori(x / TILE), floori((b.y + 2) / TILE))
	return Stage.is_solid(t) or t == Stage.ONEWAY


static func overlap(a: Dictionary, b: Dictionary) -> bool:
	return absf(a.x - b.x) * 2 < a.w + b.w and a.y - a.h < b.y and b.y - b.h < a.y


static func point_in(b: Dictionary, x: float, y: float, pad := 0.0) -> bool:
	return x > b.x - b.w / 2 - pad and x < b.x + b.w / 2 + pad and y > b.y - b.h - pad and y < b.y + pad


# ---------- Portal device ----------

## Warps to the other lane, at the nearest spot on screen to stand on.
func _use_portal() -> void:
	var p := player
	if not portal.have or area.kind != "street" or portal.cd > 0:
		return
	var to := 1 - Stage.lane_of(p.y)
	var c0 := int(p.x / TILE)
	var target := -1
	for d in 16:
		for c in [c0 + d, c0 - d]:
			var x: float = c * TILE + TILE / 2.0
			if x > cam.x + 8 and x < cam.x + W - 8 and _standable_column(c, to):
				target = c
				break
		if target >= 0:
			break
	if target < 0:
		add_text(p.x, p.y - 30, "NO SIGNAL", Color("#9878f8"))
		return
	portal_fx.append({x = p.x, y = p.y - 11, t = 0.0})
	burst(p.x, p.y - 11, Color("#9878f8"), 12, 60)
	p.x = target * TILE + TILE / 2.0
	p.y = float(area.ground[to][target] * TILE)
	p.vx = 0.0
	p.vy = 0.0
	p.inv = maxf(p.inv, 0.6)
	portal_fx.append({x = p.x, y = p.y - 11, t = 0.0})
	burst(p.x, p.y - 11, Color("#9878f8"), 12, 60)
	portal.cd = Tune.v.portalCooldown
	p.portal_t = 0.4
	_sfx("portal")
	music_track = "tunnel" if to == 1 else "city"


# ---------- Glasses ----------

func _update_glasses(dt: float) -> void:
	var gl := glasses
	if not gl.have:
		return
	if input.pressed.get("glasses", false):
		if gl.on:
			gl.on = false
			_sfx("glasses_off")
		elif not gl.locked:
			gl.on = true
			player.shades_t = 0.35
			_sfx("glasses_on")
		else:
			add_text(player.x, player.y - 30, "HEADACHE...", Color("#fc7460"))
	if gl.on:
		gl.meter -= dt / (Tune.v.contactsTime if gl.contacts else Tune.v.shadesTime)
		if gl.meter <= 0:
			gl.meter = 0.0
			gl.on = false
			gl.locked = true
			shake = 0.3
			_sfx("headache")
			add_text(player.x, player.y - 30, "HEADACHE!", Color("#fc7460"), 1.5)
	else:
		gl.meter = minf(1.0, gl.meter + dt / Tune.v.shadesRecharge)
		if gl.locked and gl.meter >= 0.5:
			gl.locked = false


# ---------- Player ----------

## 'ball' in the air (somersault), 'crouch' when ducking or tackling, else 'stand'.
func hero_pose() -> String:
	var p := player
	if not p.on_ground and not (p.tackle > 0):
		return "ball"
	if p.crouch or p.tackle > 0:
		return "crouch"
	return "stand"


## Where shots leave the rifle, for the hero's current pose.
func muzzle() -> Vector2:
	var p := player
	var pose := hero_pose()
	var s := Vector2(p.x, p.y - 11) if pose == "ball" else Vector2(p.x + p.face * 0.5, p.y - (CROUCH_SHOULDER if pose == "crouch" else SHOULDER))
	var length := 8.0 if pose == "ball" else RIFLE
	return s + p.aim * length


func _held(n: String) -> bool:
	return input.held.get(n, false)


func _pressed(n: String) -> bool:
	return input.pressed.get(n, false)


func _update_player(dt: float) -> void:
	var p := player
	var T := Tune.v
	var dir_x := (1 if _held("right") else 0) - (1 if _held("left") else 0)
	var dir_y := (1 if _held("down") else 0) - (1 if _held("up") else 0)

	# Holding lock plants your feet: the stick only aims.
	p.planted = _held("lock") and p.on_ground
	p.crouch = p.on_ground and dir_y > 0 and dir_x == 0
	p.h = 13.0 if p.crouch else 21.0
	p.vx = 0.0 if p.crouch or p.planted else dir_x * Stage.RUN_SPEED * T.runSpeed
	if dir_x != 0:
		p.face = dir_x

	# Tackle: a shoulder charge that plows through lizards.
	p.tackle_cd -= dt
	if _pressed("tackle") and p.tackle_cd <= 0 and p.tackle <= 0:
		p.tackle = T.tackleTime
		p.tackle_cd = T.tackleCooldown
		p.tackle_hit = {}
		p.crouch = false
		p.h = 21.0
		_sfx("tackle")
	if p.tackle > 0:
		p.tackle -= dt
		p.vx = p.face * T.tackleSpeed
		p.planted = false
		if p.vy > 0:
			p.vy = 0.0  # a midair tackle carries straight across
		if rng.randf() < 0.6:
			burst(p.x - p.face * 6, p.y - 2, Color("#bcbcbc"), 1, 30)

	p.coyote = 0.08 if p.on_ground else p.coyote - dt
	p.jump_buf = 0.12 if _pressed("jump") else p.jump_buf - dt
	if p.jump_buf > 0 and p.coyote > 0:
		p.jump_buf = 0.0
		p.coyote = 0.0
		if dir_y > 0 and p.ground_tile == Stage.ONEWAY:
			p.drop = 0.25
			p.y += 2
		else:
			p.vy = -Stage.JUMP_V * T.jumpPower
			_sfx("jump")
	# Let go of jump early for a short hop.
	if not _held("jump") and p.vy < 0:
		p.vy += Stage.GRAVITY * T.gravity * dt * 1.2

	var was_ground: bool = p.on_ground
	_physics(p, dt, Stage.GRAVITY * T.gravity)
	if p.on_ground and not was_ground:
		p.land_t = 0.12
		_sfx("land")
	for k in ["shades_t", "portal_t", "land_t", "hurt_t"]:
		p[k] = maxf(0.0, p[k] - dt)

	if p.tackle > 0:
		_tackle_hits()

	# Contra rules: the screen only scrolls forward.
	var min_x: float = cam.x + p.w / 2 + 1
	if p.x < min_x:
		p.x = min_x
	p.anim += dt * (1.0 if p.vx != 0 else 0.0)

	# Aiming in eight directions.
	var ax: float = p.face
	var ay := 0.0
	if dir_y < 0:
		ax = dir_x
		ay = -1.0
	elif dir_y > 0 and (not p.on_ground or dir_x != 0):
		ax = dir_x
		ay = 1.0
	p.aim = Vector2(ax, ay).normalized()

	p.fire_cd -= dt
	p.firing -= dt
	if _held("fire") and p.fire_cd <= 0:
		_fire()
	if p.inv > 0:
		p.inv -= dt

	if _pressed("portal"):
		_use_portal()

	# The temple door is at the end of both lanes.
	if area.kind == "street" and p.x >= area.exit.c0 * TILE + 8:
		transition_to("boss")
		return
	# Wet cement in the city pits, sludge in the sewer pits.
	var lane := lane_of_player()
	var sunk := _in_sludge(p)
	if p.y > VIEW_H + 24 or sunk:
		if sunk:
			burst(p.x, p.y - 4, Color("#58d854") if lane else Color("#bcbcbc"), 12)
		p.inv = 0.0
		_hurt_player(true, int(T.pitDamage))
		if mode == "play":
			_respawn_player(lane)


func _in_sludge(b: Dictionary) -> bool:
	return Stage.tile_at(area, floori(b.x / TILE), floori((b.y - 2) / TILE)) == Stage.SLUDGE


func _tackle_hits() -> void:
	var p := player
	var box := {x = p.x + p.face * 4, y = p.y, w = p.w + 10, h = p.h}
	for a in actors:
		if a.dead or a.carried_by != null or is_innocent(a) or p.tackle_hit.has(a.id) or not overlap(box, a):
			continue
		p.tackle_hit[a.id] = true
		shake = maxf(shake, 0.15)
		burst(a.x, a.y - 12, Color("#fcfcfc"), 8, 90)
		if a.type == "boss":
			_damage_actor(a, Tune.v.tackleDamage + 1)
			p.tackle = 0.0
			p.vx = -p.face * 120.0
			p.vy = -142.0
			continue
		# Knocks a snatcher's grip loose so the child can run for it.
		if a.child != null:
			_free_child(a)
		a.x += p.face * 12
		a.vy = -126.0
		_damage_actor(a, Tune.v.tackleDamage)
		if not a.dead:
			a.flash = 0.2


func _fire() -> void:
	var p := player
	var T := Tune.v
	var o := muzzle()
	var base_angle: float = atan2(p.aim.y, p.aim.x)
	var shoot := func(angle: float, speed: float, life: float, dmg: float, kind: String, pierce := 0):
		var a := base_angle + angle
		speed *= T.bulletSpeed
		life *= T.bulletRange / T.bulletSpeed
		bullets.append({x = o.x, y = o.y, vx = cos(a) * speed, vy = sin(a) * speed, life = life, dmg = dmg, kind = kind, pierce = pierce, hit = {}})
	p.fire_cd = T[WEAPON_INFO[weapon].delay]
	p.firing = 0.08
	match weapon:
		"G":
			# Spread gun: pellets in a wide fan.
			var n := int(T.spreadPellets)
			for i in n:
				shoot.call((i - (n - 1) / 2.0) * T.spreadAngle + (rng.randf() - 0.5) * 0.04, 280 + rng.randf() * 30, 0.42, T.spreadDamage, "pellet")
			_sfx("shotgun")
			shake = maxf(shake, 0.05)
		"M":
			# Machine gun: rapid fire that sweeps straight, up, down, and repeats.
			var sweep := [0.0, -T.mgSweep, T.mgSweep]
			shoot.call(sweep[p.burst_step % 3], 340.0, 0.8, T.mgDamage, "bullet")
			p.burst_step += 1
			_sfx("mg")
		"N":
			shoot.call((rng.randf() - 0.5) * 0.06, 320.0, 0.7, T.nailDamage, "nail")
			_sfx("nail")
		"T":
			shoot.call((rng.randf() - 0.5) * 0.35, 150 + rng.randf() * 40, 0.32, T.torchDamage, "flame", 99)
			if fmod(time, 0.15) < STEP:
				_sfx("torch")
		_:
			shoot.call(0.0, 340.0, 0.9, T.slugDamage, "slug", int(T.slugPierce))
			_sfx("slug")
			shake = maxf(shake, 0.08)
	burst(o.x, o.y, Color("#f8d800"), 4 if weapon == "G" else 1, 40)
	if area.kind == "boss":
		ceremony_alarm = true
	# Gunfire sends people running.
	for a in actors:
		if is_innocent(a) and absf(a.x - p.x) < 160 and absf(a.y - p.y) < 80:
			a.panic = true


# ---------- People and lizards ----------

static func is_innocent(a: Dictionary) -> bool:
	return a.type == "civilian" or a.type == "child"


static func is_lizard(a: Dictionary) -> bool:
	return a.type in ["grunt", "gunner", "snatcher", "cultist", "boss"]


func _spawn_actor(sp: Dictionary) -> Dictionary:
	var tunnel: bool = area.kind == "boss" or sp.get("lane", 0) == 1
	var kid: bool = sp.type == "child"
	var tough: bool = sp.type == "gunner" or sp.type == "snatcher" or tunnel
	var a := {
		id = _next_id, type = sp.type, x = sp.x, y = sp.y, w = 6.0 if kid else 8.0, h = 14.0 if kid else 21.0,
		vx = 0.0, vy = 0.0, face = 1 if rng.randf() < 0.5 else -1, on_ground = true, ground_tile = Stage.SOLID, drop = 0.0,
		look = sp.get("look", 0), disguised = sp.get("disguised", false), revealed = not sp.get("disguised", false),
		# A few hits at most: this is a shoot-'em-up.
		hp = 1.0 if kid else (2.0 if tough else 1.0) * Tune.v.enemyHp,
		walk = 0, timer = 1 + rng.randf() * 2, fire_timer = 1 + rng.randf() * stage.diff.fire_delay / Tune.v.enemyFireRate,
		glance = 0.0, alert = 0.0, anim = rng.randf() * 2, flash = 0.0, panic = false, carrier = sp.get("carrier", false),
		dead = false, gone = false, caught = false, carried_by = null, child = null, target = null, state = "", fled = 0.0,
		charging = false, chanting = false, role = "", warned = false, in_tunnel = tunnel,
	}
	_next_id += 1
	# The carrier got away earlier, so another lizard picks up the device.
	if carrier_pending and a.disguised:
		a.carrier = true
		carrier_pending = false
	actors.append(a)
	return a


func _spawn_from_list() -> void:
	var list: Array = area.spawns
	while spawn_index < list.size() and list[spawn_index].x < cam.x + W + 24:
		var sp: Dictionary = list[spawn_index]
		spawn_index += 1
		if sp.x > cam.x - 8:
			_spawn_actor(sp)


## Lizards keep pouring out of the dark while you're in the sewers.
func _spawn_wave(dt: float) -> void:
	if area.kind != "street" or lane_of_player() != 1:
		return
	wave_timer -= dt
	if wave_timer > 0:
		return
	wave_timer = stage.diff.wave_delay / Tune.v.waveRate * (0.7 + rng.randf() * 0.6)
	if cam.x + W > (area.exit.c0 - 4) * TILE:
		return
	var behind := rng.randf() < 0.2
	var x := cam.x + 4 if behind else cam.x + W + 8
	var c := int(x / TILE)
	if c < 0 or c >= area.cols:
		return
	var gr: int = area.ground[1][c]
	if gr < 0:
		return
	var a := _spawn_actor({type = "grunt", x = x, y = float(gr * TILE), lane = 1})
	a.face = 1 if behind else -1
	a.charging = true


func _reveal(a: Dictionary) -> void:
	if a.revealed:
		return
	a.revealed = true
	a.alert = 0.0
	_sfx("reveal")
	add_text(a.x, a.y - 30, "!", Color("#fc7460"), 0.8)


func _kill_actor(a: Dictionary, by_player := true) -> void:
	a.dead = true
	if a.child != null:
		_free_child(a)
	if is_innocent(a):
		burst(a.x, a.y - 12, Color("#d82800"), 12)
		_sfx("innocent")
		stage_stats.innocents += 1
		add_score(-int(Tune.v.innocentPoints))
		var lost := int(Tune.v.innocentDamage)
		add_text(a.x, a.y - 30, ("INNOCENT! -%d HEART%s" % [lost, "S" if lost > 1 else ""]) if lost else "INNOCENT!", Color("#fc7460"), 1.6)
		_hurt_player(true, lost)
		return
	burst(a.x, a.y - 12, Color("#58d854"), 14, 100)
	_sfx("die")
	if not by_player:
		return
	stage_stats.lizards += 1
	var points := roundi(Tune.v.lizardPoints * (1.5 if a.type == "gunner" else 1.0))
	if a.caught:
		points += 200
		add_text(a.x, a.y - 30, "SPOTTED! +%d" % points, Color("#58d854"))
	else:
		add_text(a.x, a.y - 30, "+%d" % points, Color("#fcfcfc"), 0.7)
	add_score(points)
	if a.carrier:
		pickups.append({kind = "P", x = a.x, y = a.y - 8, vy = -160.0, hidden = false, taken = false, dropped = true})
		add_text(a.x, a.y - 40, "IT DROPPED SOMETHING!", Color("#9878f8"), 1.5)
		return
	# In the sewers they sometimes drop something.
	if Stage.lane_of(a.y) == 1 and rng.randf() < Tune.v.dropChance:
		var kind: String = (["+", "H"] + Stage.WEAPONS + Stage.WEAPONS)[rng.randi() % 10]
		pickups.append({kind = kind, x = a.x, y = a.y - 8, vy = -120.0, hidden = false, taken = false, dropped = true})


func _damage_actor(a: Dictionary, dmg: float) -> void:
	if a.type == "boss":
		if a.hp <= 0:
			return
		if a.state != "awake":
			# Still stone: shots just spark off.
			burst(a.x + (rng.randf() - 0.5) * 20, a.y - 20 - rng.randf() * 40, Color("#fcfcfc"), 2, 50)
			if not a.warned:
				a.warned = true
				add_text(a.x, a.y - 76, "THE IDOL IS STONE... FOR NOW", Color("#bcbcbc"), 2.0)
			return
		a.hp -= dmg
		a.flash = 0.06
		_sfx("hit")
		if a.hp <= 0:
			_kill_boss()
		return
	if not is_innocent(a):
		# Shot before it dropped the act: bonus points.
		if not a.revealed:
			a.caught = true
		_reveal(a)
	a.hp -= dmg
	a.flash = 0.08
	if a.hp <= 0:
		_kill_actor(a)
	else:
		_sfx("hit")


func _walk_around(a: Dictionary, dt: float, speed: float) -> void:
	a.timer -= dt
	if a.timer <= 0:
		a.timer = 1.5 + rng.randf() * 3
		a.walk = 0 if rng.randf() < 0.3 else (1 if rng.randf() < 0.5 else -1)
	if a.walk != 0:
		a.face = a.walk
		if not _floor_ahead(a, a.walk):
			a.walk = -a.walk
	a.vx = a.walk * speed


func _update_civilian(a: Dictionary, dt: float) -> void:
	var kid: bool = a.type == "child"
	if a.panic:
		var dir := -1 if a.x < player.x else 1
		a.face = dir
		a.vx = dir * (42.0 if kid else 54.0)
		if a.on_ground and not _floor_ahead(a, dir):
			a.vy = -205.0
	else:
		_walk_around(a, dt, 11.0 if kid else 14.0)
	if _physics(a, dt) and a.on_ground:
		a.vy = -205.0


# ---------- Child snatchers ----------
# Now and then a lizard portals up next to a child on the street, grabs
# them and portals back down to the sewers, then runs for its nest. Shoot
# it to save the child; if it gets away, the child is gone.

func on_screen(a: Dictionary, margin := 8.0) -> bool:
	return a.x > cam.x + margin and a.x < cam.x + W - margin


## Nearest column near c where someone can stand in a lane, on screen.
func _stand_near(c: int, lane: int, span := 16) -> int:
	for d in span + 1:
		for cc in [c + d, c - d]:
			if _standable_column(cc, lane) and on_screen({x = cc * TILE + 8.0}):
				return cc
	return -1


func _try_snatch(dt: float) -> void:
	if area.kind != "street" or Tune.v.snatchRate <= 0:
		return
	snatch_timer -= dt
	if snatch_timer > 0:
		return
	var n := stage_num
	snatch_timer = maxf(8.0, 17.0 - n) / Tune.v.snatchRate * (0.8 + rng.randf() * 0.4)
	var active := actors.filter(func(a): return a.type == "snatcher").size()
	if active >= (2 if n >= 4 else 1):
		return
	var kids := actors.filter(func(a): return a.type == "child" and a.carried_by == null and on_screen(a, 24) and Stage.lane_of(a.y) == 0)
	if kids.is_empty():
		return
	var kid: Dictionary = kids[rng.randi() % kids.size()]
	var side := 1 if kid.x > player.x else -1
	var c := _stand_near(int((kid.x + side * 40) / TILE), 0, 6)
	if c < 0:
		return
	var a := _spawn_actor({type = "snatcher", x = c * TILE + 8.0, y = float(area.ground[0][c] * TILE), lane = 0})
	a.target = kid
	a.state = "emerge"
	a.timer = 0.5
	a.face = -1 if kid.x < a.x else 1
	portal_fx.append({x = a.x, y = a.y - 11, t = 0.0})
	_sfx("portal")
	add_text(kid.x, kid.y - 24, "HELP!", Color("#fc7460"), 1.2)


func _free_child(a: Dictionary) -> void:
	var kid: Dictionary = a.child
	a.child = null
	kid.carried_by = null
	stage_stats.saved += 1
	add_score(int(Tune.v.savedPoints))
	if Stage.lane_of(a.y) == 1 or area.kind != "street":
		# Down in the sewers: beam them home.
		kid.dead = true
		portal_fx.append({x = a.x, y = a.y - 30, t = 0.0})
		burst(a.x, a.y - 30, Color("#fcfcfc"), 14, 60)
	else:
		kid.x = a.x
		kid.y = a.y
		kid.vy = -158.0
		kid.panic = true
	_sfx("found")
	add_text(a.x, a.y - 44, "CHILD SAVED! +%d" % int(Tune.v.savedPoints), Color("#88ff70"), 1.6)


func _child_lost(a: Dictionary) -> void:
	var kid = a.child
	if kid == null:
		return
	a.child = null
	kid.dead = true
	stage_stats.lost += 1
	add_score(-int(Tune.v.lostPoints))
	portal_fx.append({x = a.x, y = a.y - 11, t = 0.0})
	_sfx("innocent")
	banner = {title = "A CHILD WAS TAKEN", sub = "DRAGGED DOWN TO THE NEST. -%d" % int(Tune.v.lostPoints), t = 2.5}


func _update_snatcher(a: Dictionary, dt: float) -> void:
	a.timer -= dt
	if a.state == "emerge":
		a.vx = 0.0
		if a.timer <= 0:
			a.state = "approach"
	elif a.state == "approach":
		var kid = a.target
		if kid == null or kid.dead or kid.carried_by != null:
			a.state = "flee"
			a.fled = 0.0
		else:
			var dir := -1 if kid.x < a.x else 1
			a.face = dir
			a.vx = dir * 54.0
			if absf(kid.x - a.x) < 8 and absf(kid.y - a.y) < 12:
				kid.carried_by = a
				a.child = kid
				a.state = "grab"
				a.timer = 0.8
				a.vx = 0.0
				add_text(a.x, a.y - 44, "NO!", Color("#fc7460"), 1.0)
	elif a.state == "grab":
		# A moment to struggle: the player's chance to stop it in the street.
		a.vx = 0.0
		if a.timer <= 0:
			var c := _stand_near(int(a.x / TILE), 1)
			if c >= 0:
				portal_fx.append({x = a.x, y = a.y - 11, t = 0.0})
				a.x = c * TILE + 8.0
				a.y = float(area.ground[1][c] * TILE)
				a.vy = 0.0
				portal_fx.append({x = a.x, y = a.y - 11, t = 0.0})
				_sfx("portal")
			a.state = "flee"
			a.fled = 0.0
			a.face = 1
	else:
		# Run for the den.
		a.vx = a.face * (stage.diff.enemy_speed * Tune.v.enemySpeed + 5)
		a.fled += absf(a.vx) * dt
		if a.fled > Tune.v.snatchEscape * TILE:
			_child_lost(a)
			a.gone = true
			return
	var hit_wall := _physics(a, dt)
	if a.on_ground and a.vx != 0 and (hit_wall or not _floor_ahead(a, signf(a.vx))):
		a.vy = -228.0


func _update_disguised(a: Dictionary, dt: float) -> void:
	var p := player
	# Tells: now and then they stop and stare, and the mask slips.
	if a.glance > 0:
		a.glance -= dt
		a.vx = 0.0
		a.face = -1 if p.x < a.x else 1
	else:
		_walk_around(a, dt, 14.0)
		if rng.randf() < dt / 4.0:
			a.glance = 0.9
	_physics(a, dt)
	# Get too close and they drop the act.
	var near: bool = absf(p.x - a.x) < Tune.v.revealDistance and absf(p.y - a.y) < 40
	if near:
		a.alert += dt
		if a.alert > Tune.v.revealTime:
			_reveal(a)
	else:
		a.alert = maxf(0.0, a.alert - dt)


func _same_lane(a: Dictionary) -> bool:
	return area.kind != "street" or Stage.lane_of(a.y) == Stage.lane_of(player.y)


func _update_grunt(a: Dictionary, dt: float) -> void:
	var p := player
	if not _same_lane(a):
		_walk_around(a, dt, 25.0)
		_physics(a, dt)
		return
	var dir: int = a.face if a.charging else (-1 if p.x < a.x else 1)
	if not a.charging:
		a.face = dir
	# Charging grunts run past the player, Contra style, until they turn.
	if a.charging and absf(p.x - a.x) > 120 and signf(p.x - a.x) != a.face:
		a.charging = false
	a.vx = dir * stage.diff.enemy_speed * Tune.v.enemySpeed
	var hit_wall := _physics(a, dt)
	if a.on_ground and (hit_wall or (not _floor_ahead(a, dir) and rng.randf() < 0.7)):
		a.vy = -228.0


func _update_gunner(a: Dictionary, dt: float) -> void:
	var p := player
	a.face = -1 if p.x < a.x else 1
	a.vx = 0.0
	_physics(a, dt)
	a.fire_timer -= dt
	var seen: bool = a.x > cam.x and a.x < cam.x + W
	if a.fire_timer <= 0 and seen and _same_lane(a) and absf(p.x - a.x) < W * 0.7:
		a.fire_timer = stage.diff.fire_delay / Tune.v.enemyFireRate * (0.8 + rng.randf() * 0.4)
		a.shot_t = 0.25
		var ox: float = a.x + a.face * 7
		var oy: float = a.y - 15
		var dx: float = p.x - ox
		var dy: float = p.y - 12 - oy
		var v: Vector2
		if absf(dy) < 14:
			# Level shots fly at chest height, so crouching dodges them.
			v = Vector2(a.face * 105.0 * Tune.v.enemyShotSpeed, 0)
		else:
			v = Vector2(dx, dy).normalized() * 95.0 * Tune.v.enemyShotSpeed
		shots.append({x = ox, y = oy, vx = v.x, vy = v.y, life = 4.0, r = 2.0, g = 0.0, fire = false})
		_sfx("plasma")


# ---------- The temple of Moloch ----------
# The boss fight is a sacrifice ceremony. Robed cultists chant before a
# bronze idol of Moloch; while any of them live the idol is only stone.
# Kill them all and the idol wakes, steps off its pedestal and fights.

func _start_ceremony() -> void:
	var d: Dictionary = stage.diff
	ceremony_alarm = false
	boss = {
		id = _next_id, type = "boss", x = ALTAR_X, y = FLOOR_Y - PEDESTAL_H, w = 34.0, h = 62.0, vx = 0.0, vy = 0.0, face = -1,
		on_ground = true, ground_tile = Stage.SOLID, drop = 0.0, hp = d.boss_hp * Tune.v.bossHp, max_hp = d.boss_hp * Tune.v.bossHp,
		flash = 0.0, state = "dormant", pattern = "walk", timer = 0.0, count = 0, step = 0.0, name = stage.boss_name, next = "",
		dead = false, gone = false, carried_by = null, child = null, anim = 0.0, warned = false, revealed = true,
	}
	_next_id += 1
	actors.append(boss)
	var n := int(Tune.v.cultists) if Tune.v.cultists > 0 else mini(8, 5 + stage_num / 2)
	for i in n:
		# Two arcs of worshippers either side of the altar.
		var side := 1 if i % 2 else -1
		var rank := i / 2
		var x := ALTAR_X + side * (36 + rank * 18)
		var a := _spawn_actor({type = "cultist", x = x, y = FLOOR_Y})
		a.role = "priest" if i % 5 == 1 or i % 5 == 4 else "zealot"
		a.chanting = true
		a.face = 1 if x < ALTAR_X else -1
		a.anim = i * 0.7


func _lob(x: float, y: float, tx: float, ty: float, flight := 0.9, gravity := 300.0) -> void:
	# Faster shots get there sooner, on a flatter arc.
	flight /= Tune.v.enemyShotSpeed
	gravity /= Tune.v.enemyShotSpeed
	shots.append({x = x, y = y, vx = (tx - x) / flight, vy = (ty - y - 0.5 * gravity * flight * flight) / flight, g = gravity, life = 4.0, r = 3.0, fire = true})


func _update_cultist(a: Dictionary, dt: float) -> void:
	var p := player
	var d: Dictionary = stage.diff
	if a.chanting:
		a.vx = 0.0
		a.face = 1 if a.x < ALTAR_X else -1
		_physics(a, dt)
		if ceremony_alarm or absf(p.x - a.x) < 32:
			ceremony_alarm = true
			a.chanting = false
			a.fire_timer = 0.4 + rng.randf()
		return
	var dx: float = p.x - a.x
	a.face = -1 if dx < 0 else 1
	if a.role == "priest":
		# Keep some distance and lob fireballs.
		a.vx = -a.face * d.enemy_speed * Tune.v.enemySpeed * 0.6 if absf(dx) < 60 else 0.0
		a.fire_timer -= dt
		if a.fire_timer <= 0:
			a.fire_timer = d.fire_delay / Tune.v.enemyFireRate * (0.9 + rng.randf() * 0.4)
			a.shot_t = 0.35
			_lob(a.x + a.face * 6, a.y - 16, p.x, p.y - 8)
			_sfx("plasma")
		if _physics(a, dt):
			a.vx = 0.0
	else:
		a.vx = a.face * d.enemy_speed * Tune.v.enemySpeed * 1.1
		if _physics(a, dt) and a.on_ground:
			a.vy = -228.0


func cultists_left() -> int:
	return actors.filter(func(a): return a.type == "cultist" and not a.dead).size()


func _update_boss(b: Dictionary, dt: float) -> void:
	var p := player
	var n := stage_num
	b.flash -= dt
	b.timer -= dt
	if b.state == "dormant":
		if cultists_left() == 0:
			b.state = "waking"
			b.timer = 2.2
			shots = []
			shake = 0.6
			_sfx("roar")
			banner = {title = "MOLOCH AWAKENS!", sub = "DESTROY THE IDOL", t = 2.5}
		return
	if b.state == "waking":
		shake = maxf(shake, 0.1)
		if rng.randf() < dt * 10:
			burst(b.x + (rng.randf() - 0.5) * 30, b.y - rng.randf() * 60, Color("#bcb8b0"), 3, 40)
		if b.timer <= 0:
			b.state = "awake"
			_sfx("explode")
			b.face = -1 if p.x < b.x else 1
			b.vy = -200.0
			b.vx = b.face * 40.0
			b.pattern = "walk"
			b.timer = 2.0
		return
	# Awake.
	var enraged: bool = b.hp < b.max_hp * 0.5
	var speed: float = (24 + 2 * n) * (1.5 if enraged else 1.0) * Tune.v.bossSpeed
	var mouth := Vector2(b.x + b.face * 14, b.y - 50)
	var belly := Vector2(b.x + b.face * 8, b.y - 26)
	var next := func():
		var pool := ["fireballs", "flame", "stomp"]
		if n >= 2 or enraged:
			pool.append("summon")
		b.pattern = "walk"
		b.timer = (1.4 if enraged else 2.2) / Tune.v.bossAttackRate
		b.next = pool[rng.randi() % pool.size()]
		b.count = 0
	match b.pattern:
		"walk":
			b.face = -1 if p.x < b.x else 1
			b.vx = b.face * speed if absf(p.x - b.x) > 30 else 0.0
			b.step -= dt
			if b.vx != 0 and b.on_ground and b.step <= 0:
				# Heavy footsteps.
				b.step = 0.55
				shake = maxf(shake, 0.08)
				_sfx("stomp")
			if b.timer <= 0:
				b.pattern = b.next if b.next != "" else "fireballs"
				b.timer = 0.4
				b.count = 0
		"fireballs":
			b.vx = 0.0
			if b.timer <= 0:
				_lob(belly.x, belly.y, p.x + (rng.randf() - 0.5) * 40, p.y - 6, 0.8 + rng.randf() * 0.3)
				_sfx("torch")
				b.timer = (0.3 if enraged else 0.45) / Tune.v.bossAttackRate
				b.count += 1
				if b.count >= (6 if enraged else 4):
					next.call()
		"flame":
			b.vx = 0.0
			b.face = -1 if p.x < b.x else 1
			if b.timer <= 0:
				var ang := atan2(p.y - 12 - mouth.y, p.x - mouth.x) + (rng.randf() - 0.5) * 0.2
				shots.append({x = mouth.x, y = mouth.y, vx = cos(ang) * 140 * Tune.v.enemyShotSpeed, vy = sin(ang) * 140 * Tune.v.enemyShotSpeed, life = 0.9, r = 2.0, g = 0.0, fire = true})
				if b.count % 4 == 0:
					_sfx("torch")
				b.timer = 0.06
				b.count += 1
				if b.count >= (26 if enraged else 18):
					next.call()
		"stomp":
			if b.count == 0 and b.on_ground and b.timer <= 0:
				b.vy = -250.0
				b.vx = (-1 if p.x < b.x else 1) * 50.0
				b.count = 1
			elif b.count == 1 and b.on_ground and b.vy == 0:
				b.vx = 0.0
				shake = 0.4
				_sfx("explode")
				for dir in [-1, 1]:
					shots.append({x = b.x + dir * 18, y = FLOOR_Y - 4, vx = dir * 120 * Tune.v.enemyShotSpeed, vy = 0.0, life = 3.0, r = 3.0, g = 0.0, fire = true, wave = true})
				next.call()
		"summon":
			b.vx = 0.0
			if b.timer <= 0:
				for side in [-1, 1]:
					var a := _spawn_actor({type = "cultist", x = 2.0 * TILE if side < 0 else (Stage.ARENA_COLS - 2) * TILE, y = FLOOR_Y})
					a.role = "zealot"
					a.chanting = false
				_sfx("roar")
				next.call()
	_physics(b, dt)
	if overlap(b, p):
		_hurt_player()


func _kill_boss() -> void:
	var b: Dictionary = boss
	b.hp = 0.0
	b.dead = true
	boss_dead_timer = 2.5
	add_score(int(Tune.v.bossPoints))
	add_text(b.x, b.y - 70, "+%d" % int(Tune.v.bossPoints), Color("#f8d800"), 2.0)
	_sfx("explode")
	shots = []
	for a in actors:
		if a != b and not is_innocent(a) and not a.dead:
			_kill_actor(a, false)


# ---------- Bullets, shots, pickups ----------

func _update_bullets(dt: float) -> void:
	for b in bullets:
		b.x += b.vx * dt
		b.y += b.vy * dt
		b.life -= dt
		if b.kind == "flame":
			b.vy -= 60 * dt
			b.vx *= 0.97
		if _blocked(b.x, b.y):
			b.life = 0.0
			burst(b.x, b.y, Color("#f87800") if b.kind == "flame" else Color("#fcfcfc"), 2, 30)
			continue
		for a in actors:
			if a.dead or a.carried_by != null or b.hit.has(a.id) or b.life <= 0:
				continue
			if not point_in(a, b.x, b.y, 3.0 if b.kind == "flame" else 1.0):
				continue
			b.hit[a.id] = true
			_damage_actor(a, b.dmg)
			b.pierce -= 1
			if b.pierce < 0:
				b.life = 0.0
	bullets = bullets.filter(func(b): return b.life > 0)


func _update_shots(dt: float) -> void:
	var p := player
	var hitbox := {x = p.x, y = p.y, w = p.w - 2, h = p.h - 2}
	for s in shots:
		if s.g:
			s.vy += s.g * dt
		s.x += s.vx * dt
		s.y += s.vy * dt
		s.life -= dt
		if _blocked(s.x, s.y):
			s.life = 0.0
		elif mode == "play" and point_in(hitbox, s.x, s.y, s.r - 1):
			s.life = 0.0
			_hurt_player()
	shots = shots.filter(func(s): return s.life > 0 and s.x > cam.x - 40 and s.x < cam.x + W + 40 and s.y < VIEW_H + 20)


func _update_pickups(dt: float) -> void:
	var p := player
	var gl := glasses
	if area.kind == "street" and not gl.taken:
		var box := {x = area.glasses.x, y = area.glasses.y, w = 14.0, h = 14.0}
		if overlap(box, p):
			gl.taken = true
			gl.have = true
			gl.on = true
			gl.meter = 1.0
			_sfx("found")
			banner = {title = "SUNGLASSES!", sub = "TAP THE SHADES BUTTON TO SEE THE TRUTH" if using_touch else "PRESS G TO PUT THEM ON AND OFF", t = 3.5}
	for k in pickups:
		if k.taken:
			continue
		if k.dropped:
			var body := {x = k.x, y = k.y, w = 8.0, h = 8.0, vx = 0.0, vy = k.vy, on_ground = false, ground_tile = 0, drop = 0.0}
			_physics(body, dt)
			k.y = body.y
			k.vy = body.vy
			if k.y > VIEW_H + 20 or _in_sludge(k):
				k.taken = true
				if k.kind == "P":
					carrier_pending = true
		if k.hidden and not gl.on:
			continue
		if not overlap({x = k.x, y = k.y, w = 10.0, h = 12.0}, p):
			continue
		k.taken = true
		_sfx("pickup")
		_collect(k)


func _collect(k: Dictionary) -> void:
	var p := player
	if WEAPON_INFO.has(k.kind):
		weapon = k.kind
		add_text(p.x, p.y - 30, WEAPON_INFO[k.kind].name, Color("#f8d800"), 1.2)
	elif k.kind == "+":
		if hearts < int(Tune.v.maxHearts):
			hearts += 1
			add_text(p.x, p.y - 30, "+1 HEART", Color("#fc7460"))
		else:
			add_score(500)
			add_text(p.x, p.y - 30, "+500", Color("#fcfcfc"))
	elif k.kind == "H":
		armor = true
		add_text(p.x, p.y - 30, "HARD HAT", Color("#f8d800"))
	elif k.kind == "P":
		portal.have = true
		banner = {title = "PORTAL DEVICE!", sub = "TAP THE PORTAL BUTTON TO WARP BELOW" if using_touch else "PRESS V TO WARP BETWEEN STREET AND SEWER", t = 3.5}
	elif k.kind == "C":
		if glasses.contacts:
			add_score(1000)
			add_text(p.x, p.y - 30, "+1000", Color("#fcfcfc"))
		else:
			glasses.contacts = true
			banner = {title = "CONTACT LENSES!", sub = "SHADES HURT HALF AS MUCH", t = 2.5}


func _update_particles(dt: float) -> void:
	for q in particles:
		q.x += q.vx * dt
		q.y += q.vy * dt
		q.vy += 300 * dt
		q.life -= dt
	particles = particles.filter(func(q): return q.life > 0)
	for t in texts:
		t.y -= 18 * dt
		t.life -= dt
	texts = texts.filter(func(t): return t.life > 0)


# ---------- Main update ----------

func _update_actors(dt: float) -> void:
	for a in actors:
		if a.dead:
			continue
		if a.flash > 0:
			a.flash -= dt
		if a.get("shot_t", 0.0) > 0:
			a.shot_t -= dt
		a.anim += dt
		if a.carried_by != null:
			# Held under the snatcher's arm.
			a.x = a.carried_by.x + a.carried_by.face * 3
			a.y = a.carried_by.y - 10
			a.face = a.carried_by.face
			continue
		if a.type == "boss":
			_update_boss(a, dt)
		elif is_innocent(a):
			_update_civilian(a, dt)
		elif a.type == "snatcher":
			_update_snatcher(a, dt)
		elif a.type == "cultist":
			_update_cultist(a, dt)
		elif not a.revealed:
			_update_disguised(a, dt)
		elif a.type == "grunt":
			_update_grunt(a, dt)
		else:
			_update_gunner(a, dt)
		if a.type != "boss" and not is_innocent(a) and a.revealed and overlap(a, player):
			_hurt_player()
		# Sunk, gone off the bottom, or left far behind.
		if a.y > VIEW_H + 30 or (a.type != "boss" and (_in_sludge(a) or a.x < cam.x - 48 or a.x > cam.x + W + 160)):
			a.gone = true
			if a.carrier and not portal.have:
				carrier_pending = true
			if a.child != null:
				_child_lost(a)
	actors = actors.filter(func(a): return not a.dead and not a.gone and not (a.carried_by != null and (a.carried_by.dead or a.carried_by.gone)))


func _update_play(dt: float) -> void:
	if portal.cd > 0:
		portal.cd -= dt
	for f in portal_fx:
		f.t += dt
	portal_fx = portal_fx.filter(func(f): return f.t < 0.5)
	_update_glasses(dt)
	_update_player(dt)
	if mode != "play" and mode != "dying":
		return
	update_camera(dt)
	if area_key != "boss":
		_spawn_from_list()
		_spawn_wave(dt)
		_try_snatch(dt)
	_update_actors(dt)
	_update_bullets(dt)
	_update_shots(dt)
	_update_pickups(dt)
	if boss != null and boss.dead:
		boss_dead_timer -= dt
		if rng.randf() < dt * 12:
			var cols := [Color("#f87800"), Color("#f8d800"), Color("#a8743c"), Color("#7c7870")]
			burst(boss.x + (rng.randf() - 0.5) * 40, boss.y - rng.randf() * 60, cols[rng.randi() % 4], 10, 120)
			if rng.randf() < 0.3:
				_sfx("explode")
		if boss_dead_timer <= 0:
			_stage_clear()


## Advances the game by one fixed step with this input:
## {held = {name: bool}, pressed = {name: bool}} for left, right, up, down,
## jump, fire, tackle, glasses, portal, lock.
func step(inp: Dictionary) -> void:
	input = inp
	var dt: float = STEP * Tune.v.gameSpeed
	if hearts > int(Tune.v.maxHearts):
		hearts = int(Tune.v.maxHearts)
	time += dt
	if shake > 0:
		shake -= dt
	if banner != null:
		banner.t -= dt
		if banner.t <= 0:
			banner = null
	match mode:
		"play":
			_update_play(dt)
			_update_particles(dt)
		"dying":
			var p := player
			p.vy += Stage.GRAVITY * dt
			p.y += p.vy * dt
			dying_timer -= dt
			_update_shots(dt)
			_update_particles(dt)
			if dying_timer <= 0:
				_game_over()
		"transition":
			var tr := transition
			tr.t += dt
			fade = tr.t / 0.6 if tr.t < 0.6 else maxf(0.0, 1.0 - (tr.t - 0.9) / 0.6)
			if tr.t >= 0.9 and not tr.done:
				tr.done = true
				enter_area(tr.key)
				mode = "transition"
				banner = {title = AREA_TITLES[tr.key], sub = "STOP THE CEREMONY" if tr.key == "boss" else "", t = 2.5}
			if tr.t >= 1.5:
				fade = 0.0
				mode = "play"
			_update_particles(dt)


# ---------- Autopilot (the title screen's demo, and the tests) ----------

## Input that plays the game reasonably: runs right, jumps gaps and walls,
## shoots lizards (and spares people), puts the shades on, uses the portal
## to dodge pits it can't jump, and fights the temple from range.
func autopilot() -> Dictionary:
	var held := {}
	var pressed := {}
	var p := player
	if p.is_empty():
		return {held = held, pressed = pressed}
	var c := int(p.x / TILE)
	var lane := lane_of_player()
	held.right = true
	# Jump at the edge of a pit, at a wall, or up a step just ahead.
	var front: float = p.x + p.face * (p.w / 2 + 3)
	var cf := floori(front / TILE)
	var gap := false
	var step_up := false
	if area.kind == "street" and cf >= 0 and cf < area.cols:
		var gr: int = area.ground[lane][cf]
		gap = gr < 0
		step_up = gr >= 0 and gr * TILE < p.y - 1
	var wall := Stage.is_solid(Stage.tile_at(area, cf, int((p.y - 4) / TILE))) or Stage.is_solid(Stage.tile_at(area, cf, int((p.y - 18) / TILE)))
	if (gap or wall or step_up) and p.on_ground:
		held.jump = true
		pressed.jump = true
	elif not p.on_ground and p.vy < 0:
		held.jump = true
	# Shoot what's dangerous and on screen; never at people.
	var target = null
	var best := 1e9
	for a in actors:
		if a.dead or a.carried_by != null or is_innocent(a) or not on_screen(a) or not _same_lane(a):
			continue
		if not a.revealed and not glasses.on:
			continue
		if a.type == "boss" and a.state != "awake":
			continue
		var d: float = absf(a.x - p.x)
		if d < best:
			best = d
			target = a
	if target != null:
		held.fire = true
		if target.x < p.x:
			held.right = false
			held.left = best < 40
			if not held.left:
				# Turn round on the spot to shoot behind.
				held.left = true
				held.lock = true
		elif best < 50 and area.kind == "boss":
			held.right = false
			held.left = true
			held.lock = false
		var dy: float = target.y - 10 - (p.y - SHOULDER)
		if dy < -14:
			held.up = true
		elif dy > 14 and not p.on_ground:
			held.down = true
	# Hold fire while a person is anywhere in the line of fire (the spread
	# gun fans out, and people run about).
	if target != null:
		var dir := signf(target.x - p.x)
		for a in actors:
			if is_innocent(a) and not a.dead and a.carried_by == null and absf(a.y - p.y) < 40 and (a.x - p.x) * dir > -10 and absf(a.x - p.x) < 200:
				held.fire = false
	# Up close, a tackle: it never hurts people standing by.
	if target != null and best < 34 and p.tackle_cd <= 0 and target.type != "boss":
		held.left = target.x < p.x
		held.right = target.x >= p.x
		pressed.tackle = true
	if glasses.have and not glasses.on and not glasses.locked and glasses.meter > 0.9:
		pressed.glasses = true
	if glasses.on and glasses.meter < 0.15:
		pressed.glasses = true
	if area.kind == "boss" and boss != null and boss.state == "awake" and absf(boss.x - p.x) < 60 and p.on_ground:
		held.jump = true
		pressed.jump = true
	return {held = held, pressed = pressed}
