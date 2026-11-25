## Endless stage generator. A stage is two areas played in order:
##   street - one long level with two lanes: the city on top, where lizards
##            walk around disguised as people, and the sewers below, where
##            they run around in their true form and the weapons and hearts
##            are. A portal device, carried by one disguised lizard, lets the
##            player warp between the lanes. Children play on the street;
##            snatchers portal up to take them.
##   boss   - a temple at the end of the street, where cultists hold a
##            ceremony before an idol of Moloch that comes to life.
## Everything comes from (stage number, run seed), so the same pair always
## gives the same stage. The tests check every stage can be finished.
## Units are world pixels: a tile is 16, y grows downward.
class_name Stage

const TILE := 16
const LANE_ROWS := 9
const ROWS := LANE_ROWS * 2

## Player physics live here so the generator and the tests agree with the
## game about how far the player can jump: a floaty, unhurried arc, about
## 3.6 tiles high and 3.7 tiles long.
const GRAVITY := 560.0
const JUMP_V := 255.0
const RUN_SPEED := 65.0

enum { AIR, SOLID, ONEWAY, CRATE, SLUDGE }

const WEAPONS := ["M", "N", "T", "S"]

const BILLBOARD_ADS := ["BUY NOW", "NEW CAR", "COLA", "VACATION", "TV 24/7", "SALE", "BANK ON US", "DIET", "MOVIES"]
const BILLBOARD_TRUTH := ["OBEY", "CONSUME", "SLEEP", "CONFORM", "NO THOUGHT", "SUBMIT", "WATCH TV", "STAY ASLEEP", "BUY", "DO NOT QUESTION", "MARRY AND REPRODUCE"]
const BOSS_NAMES := ["MOLOCH", "MOLOCH THE DEVOURER", "MOLOCH OF THE FURNACE", "THE BRONZE GOD", "MOLOCH, LORD OF FIRE", "THE HORNED IDOL"]

## About one screen wide, so the boss fight is always fully in view.
const ARENA_COLS := 20
const ARENA_FLOOR := 16


## Seeded random numbers with the helpers the generator uses.
class Rng:
	var r := RandomNumberGenerator.new()

	func _init(seed_value: int) -> void:
		r.seed = seed_value

	func next() -> float:
		return r.randf()

	## Integer in [lo, hi], inclusive.
	func int_in(lo: int, hi: int) -> int:
		return r.randi_range(lo, hi)

	func chance(p: float) -> bool:
		return r.randf() < p

	func pick(list: Array):
		return list[r.randi() % list.size()]


## Mixes integers into one non-negative seed.
static func mix(a: int, b: int) -> int:
	return hash([a, b, 0x5bd1e995]) & 0x7fffffff


## Bigger numbers are harder; levels off after stage 10.
static func difficulty(stage: int) -> Dictionary:
	var s := mini(stage, 10) - 1
	return {
		length = 130 + 10 * s,
		disguise_ratio = minf(0.3 + 0.04 * s, 0.6),
		max_gap = 2 if stage == 1 else 3,
		sewer_spacing = [maxi(4, 8 - s / 2), maxi(6, 11 - s / 2)],
		wave_delay = maxf(1.0, 2.8 - 0.18 * s),
		enemy_speed = 38.0 + 2 * s,
		fire_delay = maxf(1.1, 2.2 - 0.11 * s),
		boss_hp = 45.0 + 18 * (stage - 1),
	}


static func generate(stage: int, run_seed := 1) -> Dictionary:
	var seed_value := mix(run_seed, stage)
	var diff := difficulty(stage)
	return {
		stage = stage,
		seed = seed_value,
		diff = diff,
		boss_name = BOSS_NAMES[mix(seed_value, 7) % BOSS_NAMES.size()],
		street = _street(Rng.new(mix(seed_value, 1)), Rng.new(mix(seed_value, 2)), diff),
		boss = _boss_area(),
	}


static func tile_at(area: Dictionary, c: int, r: int) -> int:
	if c < 0 or c >= area.cols:
		return SOLID
	if r < 0 or r >= ROWS:
		return AIR
	return area.tiles[r * area.cols + c]


static func is_solid(t: int) -> bool:
	return t == SOLID or t == CRATE


## 0 for the top lane (city), 1 for the bottom lane (sewers), from a y in pixels.
static func lane_of(y: float) -> int:
	return 0 if y <= LANE_ROWS * TILE else 1


static func _area(kind: String, cols: int) -> Dictionary:
	var tiles := PackedByteArray()
	tiles.resize(cols * ROWS)
	var g0 := PackedInt32Array()
	var g1 := PackedInt32Array()
	g0.resize(cols)
	g1.resize(cols)
	g0.fill(-1)
	g1.fill(-1)
	return {kind = kind, cols = cols, tiles = tiles, ground = [g0, g1], spawns = [], pickups = [], billboards = [],
		exit = {}, start_x = 2.0 * TILE, glasses = {}}


static func _put(area: Dictionary, c: int, r: int, t: int) -> void:
	if c >= 0 and c < area.cols and r >= 0 and r < ROWS:
		area.tiles[r * area.cols + c] = t


## Lays out exactly `length` columns of floor heights in chunks: flats,
## steps, gaps, scaffolding and crate stacks, ending on a long flat. Every
## chunk ends on enough flat floor to take off from.
static func _layout_floor(rng: Rng, length: int, min_g: int, max_g: int, max_gap: int) -> Dictionary:
	var ground: Array = []
	var platforms: Array = []
	var crates: Array = []
	var g := max_g
	var body := length - 14
	for i in 14:
		ground.append(g)
	while ground.size() < body:
		var roll := rng.next()
		if roll < 0.22:
			for i in rng.int_in(4, 9):
				ground.append(g)
		elif roll < 0.42:
			g = clampi(g + rng.pick([-2, -1, 1, 2]), min_g, max_g)
			for i in rng.int_in(3, 6):
				ground.append(g)
		elif roll < 0.62:
			var w := rng.int_in(2, max_gap)
			for i in w:
				ground.append(-1)
			# The wider the gap, the less the far side may rise.
			g = clampi(g + rng.int_in(-1 if w >= 3 else -2, 2), min_g, max_g)
			for i in rng.int_in(3, 6):
				ground.append(g)
		elif roll < 0.82:
			var c0 := ground.size()
			var w := rng.int_in(7, 10)
			for i in w:
				ground.append(g)
			platforms.append({c0 = c0 + 2, c1 = c0 + w - 3, r = g - 3})
		else:
			var c0 := ground.size()
			for i in rng.int_in(6, 8):
				ground.append(g)
			var height := rng.int_in(1, 2)
			var width := rng.int_in(1, 2)
			for c in range(c0 + 2, c0 + 2 + width):
				for k in height:
					crates.append({c = c, r = g - 1 - k})
	# Cut back to the body (a chunk may have run over), then finish flat.
	ground.resize(body)
	while ground[ground.size() - 1] < 0:
		ground.pop_back()
	g = ground[ground.size() - 1]
	while ground.size() < length:
		ground.append(g)
	return {
		ground = ground,
		platforms = platforms.filter(func(p): return p.c1 < body and p.r >= 2),
		crates = crates.filter(func(k): return k.c < body),
	}


## Writes a lane's layout into the area. Rows in `layout` are lane rows.
static func _apply_lane(area: Dictionary, lane: int, layout: Dictionary, pit_fill: int) -> void:
	var top := lane * LANE_ROWS
	var bottom := top + LANE_ROWS - 1
	var ground: Array = layout.ground
	for c in ground.size():
		var g: int = ground[c]
		if g < 0:
			_put(area, c, bottom, pit_fill)
			continue
		area.ground[lane][c] = top + g
		for r in range(top + g, bottom + 1):
			_put(area, c, r, SOLID)
	for p in layout.platforms:
		for c in range(p.c0, p.c1 + 1):
			_put(area, c, top + p.r, ONEWAY)
	for k in layout.crates:
		_put(area, k.c, top + k.r, CRATE)


## Floor columns of a lane with nothing on top, between c0 and c1.
static func open_floor(area: Dictionary, lane: int, c0: int, c1: int) -> Array:
	var out := []
	for c in range(maxi(c0, 0), mini(c1, area.cols - 1) + 1):
		var g: int = area.ground[lane][c]
		if g >= 0 and tile_at(area, c, g - 1) == AIR and tile_at(area, c, g - 2) == AIR:
			out.append(c)
	return out


static func _pickup(area: Dictionary, kind: String, c: int, r: int, hidden := false) -> void:
	area.pickups.append({kind = kind, x = c * TILE + TILE / 2.0, y = float(r * TILE), hidden = hidden})


static func _street(city_rng: Rng, sewer_rng: Rng, diff: Dictionary) -> Dictionary:
	var length: int = diff.length
	var area := _area("street", length)
	area.exit = {c0 = length - 6}

	# ---- Top lane: the city. Pits are full of wet cement.
	var city := _layout_floor(city_rng, length, 5, 7, diff.max_gap)
	_apply_lane(area, 0, city, SLUDGE)
	var b := city_rng.int_in(6, 10)
	while b < length - 10:
		area.billboards.append({c = b, r = 1, w = 6, h = 3, ad = city_rng.pick(BILLBOARD_ADS), truth = city_rng.pick(BILLBOARD_TRUTH)})
		b += city_rng.int_in(14, 22)

	# ---- Bottom lane: the sewers, with a low ceiling and sludge in the pits.
	var sewer := _layout_floor(sewer_rng, length, 6, 7, diff.max_gap)
	_apply_lane(area, 1, sewer, SLUDGE)
	var under := {}
	for p in sewer.platforms:
		for c in range(p.c0 - 1, p.c1 + 2):
			under[c] = true
	var ceil_rows := 1
	for c in length:
		if c % 6 == 0:
			ceil_rows = sewer_rng.int_in(1, 2)
		var g: int = sewer.ground[c]
		# Leave room for a full jump everywhere, and above the scaffolding.
		var rows := mini(ceil_rows, g - 5) if g >= 0 and not under.has(c) else 1
		for r in maxi(1, rows):
			_put(area, c, LANE_ROWS + r, SOLID)

	# ---- People on the street. Some of them are lizards in disguise.
	var early := open_floor(area, 0, int(length * 0.1), int(length * 0.25))
	var gc: int = city_rng.pick(early)
	area.glasses = {x = gc * TILE + TILE / 2.0, y = float(area.ground[0][gc] * TILE)}

	var open := {}
	for c in open_floor(area, 0, 0, length):
		open[c] = true
	var c := 20
	while c < area.exit.c0 - 6:
		if open.has(c) and absi(c - gc) > 2:
			var look := city_rng.int_in(0, 5)
			var y := float(area.ground[0][c] * TILE)
			var x := c * TILE + 8.0
			if city_rng.chance(diff.disguise_ratio):
				area.spawns.append({type = "grunt" if city_rng.chance(0.55) else "gunner", x = x, y = y, disguised = true, look = look, lane = 0})
			else:
				area.spawns.append({type = "civilian", x = x, y = y, look = look, lane = 0})
		c += city_rng.int_in(3, 6)
	# Children playing on the street. Snatchers portal up to grab them.
	var kids := mini(6, 4 + length / 160)
	var kid_cols := open_floor(area, 0, 24, area.exit.c0 - 10).filter(func(kc):
		for sp in area.spawns:
			if absf(sp.x - (kc * TILE + 8)) < TILE:
				return false
		return true)
	for i in kids:
		if kid_cols.is_empty():
			break
		var kc: int = kid_cols[int((i + 0.5) / kids * kid_cols.size())]
		area.spawns.append({type = "child", x = kc * TILE + 8.0, y = float(area.ground[0][kc] * TILE), look = city_rng.int_in(0, 3), lane = 0})

	# One disguised lizard after the glasses carries the portal device.
	var zone: Array = area.spawns.filter(func(s): return s.type != "child" and s.x > (gc + 8) * TILE and s.x < length * TILE * 0.55)
	var carrier = null
	for s in zone:
		if s.get("disguised", false):
			carrier = s
			break
	if carrier == null and zone.size():
		carrier = zone[0]
	if carrier == null:
		var adults: Array = area.spawns.filter(func(s): return s.type != "child")
		carrier = adults[adults.size() - 1]
	carrier.type = "grunt"
	carrier.disguised = true
	carrier.carrier = true

	# ---- Lizards in the sewers.
	var open_below := {}
	for oc in open_floor(area, 1, 0, length):
		open_below[oc] = true
	c = 18
	while c < area.exit.c0 - 6:
		if open_below.has(c):
			area.spawns.append({type = "grunt" if sewer_rng.chance(0.6) else "gunner", x = c * TILE + 8.0, y = float(area.ground[1][c] * TILE), lane = 1})
		c += sewer_rng.int_in(diff.sewer_spacing[0], diff.sewer_spacing[1])
	for p in sewer.platforms:
		if sewer_rng.chance(0.7):
			area.spawns.append({type = "gunner", x = ((p.c0 + p.c1) >> 1) * TILE + 8.0, y = float((LANE_ROWS + p.r) * TILE), lane = 1})
	area.spawns.sort_custom(func(a1, a2): return a1.x < a2.x)

	# ---- The loot is all down in the sewers.
	var floor_cols := open_floor(area, 1, 16, area.exit.c0 - 4)
	var loot := [sewer_rng.pick(WEAPONS), "+", sewer_rng.pick(WEAPONS), "H", "+", sewer_rng.pick(WEAPONS)]
	for i in loot.size():
		var lc: int = floor_cols[int((i + 0.5) / loot.size() * floor_cols.size())]
		_pickup(area, loot[i], lc, area.ground[1][lc])
	for p in sewer.platforms.slice(0, 2):
		_pickup(area, sewer_rng.pick(["+"] + WEAPONS), p.c1, LANE_ROWS + p.r)
	# A stash only the sunglasses can see.
	var sc: int = sewer_rng.pick(floor_cols)
	_pickup(area, "C" if sewer_rng.chance(0.35) else sewer_rng.pick(["+", "H"]), sc, area.ground[1][sc], true)
	return area


static func _boss_area() -> Dictionary:
	var area := _area("boss", ARENA_COLS)
	for c in ARENA_COLS:
		area.ground[0][c] = ARENA_FLOOR
		for r in range(ARENA_FLOOR, ROWS):
			_put(area, c, r, SOLID)
	for r in ARENA_FLOOR:
		_put(area, 0, r, SOLID)
		_put(area, ARENA_COLS - 1, r, SOLID)
	# Enter at the far left, away from the ceremony.
	area.start_x = 1.75 * TILE
	return area
