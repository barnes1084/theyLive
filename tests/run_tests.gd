## Headless checks: every setting is used and sane, stages are deterministic
## and can always be finished, the core rules work (shades, innocents,
## disguised lizards, the portal, snatchers, the idol), every pose the game
## draws exists, and the game plays on autopilot without getting stuck.
## Run: godot --headless --path . -s res://tests/run_tests.gd
extends SceneTree

var failures := 0
const TILE := Stage.TILE


func check(cond: bool, msg: String) -> void:
	if not cond:
		failures += 1
		printerr("  FAIL: ", msg)


func test(name: String, fn: Callable) -> void:
	var before := failures
	# Each test returns true at its end, so a crash part-way counts as a failure.
	if fn.call() != true:
		failures += 1
		printerr("  FAIL: crashed")
	print(("ok   " if failures == before else "FAIL ") + name)


## The rule tests use the reference values in scripts/tune.gd (`def`), not
## default_settings.cfg, so tuning the game never breaks them.
func use_reference_values() -> void:
	Tune._file_defaults.clear()
	Tune.dev = false
	Tune.reset()


## A game on a fixed seed, already playing stage n.
func game_at(n := 1, seed_value := 3) -> Game:
	var g := Game.new(seed_value)
	g.new_run(seed_value)
	if n != 1:
		g.start_stage(n)
	g.banner = null
	return g


func idle() -> Dictionary:
	return {held = {}, pressed = {}}


func press(name: String) -> Dictionary:
	return {held = {name: true}, pressed = {name: true}}


func _init() -> void:
	Tune.ensure()
	use_reference_values()

	# ---------- Settings ----------

	test("every setting is read by the game", func():
		var src := ""
		for f in DirAccess.get_files_at("res://scripts/"):
			if f.ends_with(".gd") and f != "tune.gd":
				src += FileAccess.get_file_as_string("res://scripts/" + f) + "\n"
		# Weapon delays are looked up by name from Game.WEAPON_INFO.
		var dynamic := []
		for w in Game.WEAPON_INFO.values():
			dynamic.append(w.delay)
		var unused := []
		for t in Tune.ITEMS:
			if t.has("key") and t.key not in dynamic:
				if RegEx.create_from_string("\\." + t.key + "\\b").search(src) == null:
					unused.append(t.key)
		check(unused.is_empty(), "unused settings: %s" % [unused])
		return true)
	test("every setting has a sane range and default", func():
		for t in Tune.ITEMS:
			if t.has("key") and not t.has("type"):
				check(t.min <= t.def and t.def <= t.max, t.key)
		return true)
	test("default_settings.cfg is valid", func():
		var unknown := Tune.load_defaults_file()
		check(unknown.is_empty(), "unknown or invalid settings in default_settings.cfg: %s" % [unknown])
		var cfg := ConfigFile.new()
		check(cfg.load(Tune.DEFAULTS_PATH) == OK, "default_settings.cfg loads")
		Tune.reset()
		var again := ConfigFile.new()
		check(again.parse(Tune.defaults_text()) == OK, "the written defaults parse")
		check(again.get_section_keys("defaults").size() == Tune.ITEMS.filter(func(t): return t.has("key")).size(), "the written defaults hold every setting")
		use_reference_values()
		return true)
	test("players can only change the player settings", func():
		Tune.apply_saved({runSpeed = 1.8, sfxVolume = 0.2, _dev = false})
		check(is_equal_approx(Tune.v.runSpeed, 1.0), "a saved developer setting is ignored outside developer mode")
		check(is_equal_approx(Tune.v.sfxVolume, 0.2), "a saved player setting applies")
		check(Tune.visible_items().size() == Tune.PLAYER_KEYS.size(), "only the player settings are shown")
		Tune.apply_saved({runSpeed = 1.8, _dev = true})
		check(is_equal_approx(Tune.v.runSpeed, 1.8), "developer mode applies developer settings")
		use_reference_values()
		return true)

	# ---------- Stages ----------

	test("the jump clears what the stages ask of it", func():
		var jump_rows := Stage.JUMP_V * Stage.JUMP_V / (2 * Stage.GRAVITY) / TILE
		var jump_cols := 2 * Stage.JUMP_V / Stage.GRAVITY * Stage.RUN_SPEED / TILE
		check(jump_rows >= 3.2, "jump height %.2f rows is too low for 3-row steps" % jump_rows)
		check(jump_cols * TILE >= 3 * TILE + 8, "jump length %.2f cols is too short for 3-col gaps" % jump_cols)
		return true)
	test("stages are deterministic and can always be finished", func():
		var checked := 0
		for seed_value in [1, 42, 1234567, 987654321]:
			for n in range(1, 21):
				var s := Stage.generate(n, seed_value)
				var again := Stage.generate(n, seed_value)
				check(s.street.tiles == again.street.tiles, "stages must be deterministic")
				var street: Dictionary = s.street
				var at := "seed %d stage %d" % [seed_value, n]
				var start_col := int(street.start_x / TILE)
				check(exit_reachable(street, start_col, street.exit.c0, 0, Stage.LANE_ROWS - 1), at + ": city exit unreachable")
				check(exit_reachable(street, start_col, street.exit.c0, Stage.LANE_ROWS, Stage.ROWS - 1), at + ": sewer exit unreachable")
				check(exit_reachable(s.boss, int(s.boss.start_x / TILE), s.boss.cols - 3, 0, Stage.ROWS - 1), at + ": temple broken")
				var on_floor := func(x: float, y: float, what: String):
					var c := int(x / TILE)
					var r := y / TILE
					check(is_equal_approx(r, roundf(r)) and standable(street, c, int(r)), "%s: %s floating at col %d row %.1f" % [at, what, c, r])
				on_floor.call(street.glasses.x, street.glasses.y, "glasses")
				check(Stage.lane_of(street.glasses.y) == 0, at + ": the glasses belong on the street")
				for sp in street.spawns:
					on_floor.call(sp.x, sp.y, sp.type)
					check(Stage.lane_of(sp.y) == sp.lane, "%s: %s in the wrong lane" % [at, sp.type])
					if sp.lane == 1:
						check(not sp.get("disguised", false) and sp.type != "civilian", at + ": nobody pretends in the sewers")
				for p in street.pickups:
					on_floor.call(p.x, p.y, "pickup " + p.kind)
					check(Stage.lane_of(p.y) == 1, at + ": loot belongs in the sewers")
				check(street.pickups.filter(func(p): return p.kind == "+").size() >= 2, at + ": not enough hearts")
				check(street.pickups.filter(func(p): return p.kind in Stage.WEAPONS).size() >= 3, at + ": not enough weapons")
				var carriers: Array = street.spawns.filter(func(sp): return sp.get("carrier", false))
				check(carriers.size() == 1, at + ": exactly one lizard carries the portal device")
				if carriers.size() == 1:
					check(carriers[0].disguised and carriers[0].x > street.glasses.x, at + ": the carrier is disguised, after the glasses")
				check(street.spawns.filter(func(sp): return sp.type == "child").size() >= 4, at + ": too few children")
				for c in street.cols:
					check(Stage.is_solid(Stage.tile_at(street, c, Stage.LANE_ROWS)), "%s: lanes connect at col %d" % [at, c])
					if street.ground[0][c] < 0:
						check(Stage.tile_at(street, c, Stage.LANE_ROWS - 1) == Stage.SLUDGE, "%s: bottomless city pit at col %d" % [at, c])
					var gr: int = street.ground[1][c]
					if gr >= 0:
						var open := 0
						var r := gr - 1
						while r >= Stage.LANE_ROWS and Stage.tile_at(street, c, r) != Stage.SOLID:
							open += 1
							r -= 1
						check(open >= 5, "%s: sewer ceiling too low at col %d" % [at, c])
				checked += 1
		check(Stage.generate(1, 1).street.tiles != Stage.generate(1, 2).street.tiles, "different runs get different stages")
		print("     %d stages checked" % checked)
		return true)

	# ---------- Rules ----------

	test("the sunglasses show the truth, then give you a headache", func():
		var g := game_at()
		var gl: Dictionary = g.area.glasses
		g.player.x = gl.x
		g.player.y = gl.y
		g.step(idle())
		check(g.glasses.have and g.glasses.on, "walking onto the box gets the shades, on")
		for i in int(Tune.v.shadesTime * 60) + 30:
			g.step(idle())
			g.player.inv = 1.0
		check(not g.glasses.on and g.glasses.locked, "they come off with a headache when the meter runs out")
		g.step(press("glasses"))
		check(not g.glasses.on, "and can't go back on straight away")
		for i in int(Tune.v.shadesRecharge * 60):
			g.step(idle())
			g.player.inv = 1.0
		g.step(press("glasses"))
		check(g.glasses.on, "they go back on once recharged")
		return true)
	test("shooting an innocent costs a heart and points; a disguised lizard is a bonus", func():
		var g := game_at()
		var p := g.player
		var civ := g._spawn_actor({type = "civilian", x = p.x + 30, y = p.y, look = 1, lane = 0})
		var hearts := g.hearts
		g._damage_actor(civ, 5.0)
		check(civ.dead and g.hearts == hearts - int(Tune.v.innocentDamage), "an innocent costs a heart")
		check(g.stage_stats.innocents == 1, "and is counted")
		var liz := g._spawn_actor({type = "grunt", x = p.x + 30, y = p.y, look = 2, disguised = true, lane = 0})
		var score := g.score
		g._damage_actor(liz, 5.0)
		check(liz.dead and g.score >= score + int(Tune.v.lizardPoints) + 200, "a lizard shot in disguise is SPOTTED for a bonus")
		return true)
	test("disguised lizards drop the act when you get close", func():
		var g := game_at()
		var p := g.player
		var liz := g._spawn_actor({type = "gunner", x = p.x + 20, y = p.y, look = 0, disguised = true, lane = 0})
		for i in int((Tune.v.revealTime + 0.2) * 60):
			g.step(idle())
		check(liz.revealed, "a lizard right next to you reveals itself")
		return true)
	test("the portal device warps between the street and the sewers", func():
		var g := game_at(2)
		g.portal.have = true
		g.player.x = 300.0
		g.update_camera(0, true)
		var c := g._safe_column(int(g.player.x / TILE), 0)
		g.player.x = c * TILE + 8.0
		g.player.y = float(g.area.ground[0][c] * TILE)
		g.step(press("portal"))
		check(g.lane_of_player() == 1, "warped down to the sewers")
		g.step(press("portal"))
		check(g.lane_of_player() == 1, "the device needs to recharge")
		for i in int(Tune.v.portalCooldown * 60) + 5:
			g.step(idle())
		g.step(press("portal"))
		check(g.lane_of_player() == 0, "and warps back up")
		return true)
	test("a snatcher takes a child unless it's stopped", func():
		var g := game_at()
		var p := g.player
		var kid := g._spawn_actor({type = "child", x = p.x + 60, y = p.y, look = 0, lane = 0})
		var s := g._spawn_actor({type = "snatcher", x = p.x + 70, y = p.y, lane = 0})
		s.target = kid
		s.state = "approach"
		var grabbed := false
		for i in 60 * 30:
			g.step(idle())
			g.player.inv = 1.0
			if kid.carried_by != null:
				grabbed = true
			if g.stage_stats.lost > 0:
				break
		check(grabbed, "the snatcher grabs the child")
		check(g.stage_stats.lost == 1, "and gets away with them")
		var g2 := game_at()
		var kid2 := g2._spawn_actor({type = "child", x = g2.player.x + 60, y = g2.player.y, look = 0, lane = 0})
		var s2 := g2._spawn_actor({type = "snatcher", x = g2.player.x + 60, y = g2.player.y, lane = 0})
		kid2.carried_by = s2
		s2.child = kid2
		s2.state = "grab"
		g2._damage_actor(s2, 10.0)
		check(g2.stage_stats.saved == 1 and kid2.carried_by == null, "shooting the snatcher saves the child")
		return true)
	test("the idol is stone until the cultists are gone, then must be destroyed", func():
		var g := game_at()
		g.enter_area("boss")
		var b: Dictionary = g.boss
		var hp: float = b.hp
		g._damage_actor(b, 10.0)
		check(b.hp == hp, "the dormant idol can't be hurt")
		for a in g.actors:
			if a.type == "cultist":
				a.dead = true
		for i in 60 * 3:
			g.step(idle())
			g.player.inv = 1.0
		check(b.state == "awake", "it wakes when the cultists are dead")
		g._damage_actor(b, b.hp + 1)
		for i in 60 * 4:
			g.step(idle())
		check(g.mode == "clear", "destroying it clears the stage")
		return true)

	# ---------- Art ----------

	test("every pose the game draws exists", func():
		var src := FileAccess.get_file_as_string("res://scripts/world.gd")
		var re := RegEx.create_from_string("\"([a-z]+[0-9]?)\"")
		var meta := Art.meta()
		var all_poses := {}
		for who in meta:
			for pose in meta[who]:
				all_poses[pose] = true
		for who in ["hero", "heroshades", "grunt", "gunner", "snatcher", "zealot", "priest", "moloch", "civ1", "civ1liz", "kid1"]:
			check(meta.has(who), "sprites for %s" % who)
		for i in range(1, 7):
			check(meta.has("civ%d" % i) and meta.has("civ%dliz" % i), "civilian %d and its lizard" % i)
			if meta.has("civ%d" % i):
				check(meta["civ%d" % i].keys() == meta["civ%dliz" % i].keys(), "civilian %d's lizard has the same poses" % i)
		for pose in ["idle", "run1", "run6", "runup3", "rundown3", "aimup", "aimupfwd", "aimdownfwd", "crouch", "jump", "ball", "fall", "land", "tackle", "hit", "down", "shades", "portal", "victory"]:
			check(Art.has_pose("hero", pose) and Art.has_pose("heroshades", pose), "hero pose %s" % pose)
		for pose in ["dormant", "waking", "idle", "walk4", "spit", "breath", "leapcrouch", "leapair", "slam", "summon", "hurt", "rage", "crumble"]:
			check(Art.has_pose("moloch", pose), "Moloch pose %s" % pose)
		for m in re.search_all(src):
			var name := m.get_string(1)
			if name.begins_with("walk") or name.begins_with("run") or name.begins_with("carry") or name.begins_with("chant") or name.begins_with("flee"):
				check(all_poses.has(name), "pose %s is drawn but has no art" % name)
		return true)

	# ---------- Playing ----------

	test("the game plays on autopilot without errors or getting stuck", func():
		for seed_value in [1, 2, 3, 4]:
			var g := game_at(1 + seed_value % 3, seed_value)
			var best := 0.0
			for i in 60 * 120:
				if g.mode in ["gameover", "clear"]:
					break
				g.step(g.autopilot())
				best = maxf(best, g.player.x)
			check(best > 200, "seed %d: the autopilot got somewhere (%.0f)" % [seed_value, best])
			print("     seed %d: %s, area %s, got to x %.0f, score %d" % [seed_value, g.mode, g.area_key, best, g.score])
		# The temple, too.
		var g := game_at(2, 9)
		g.enter_area("boss")
		for i in 60 * 120:
			if g.mode in ["gameover", "clear"]:
				break
			g.step(g.autopilot())
		check(g.mode in ["gameover", "clear", "play"], "the temple plays")
		print("     temple on autopilot: %s, idol %s" % [g.mode, g.boss.state if g.boss else "-"])
		return true)

	print("\n%s" % ("all passed" if failures == 0 else "%d failed" % failures))
	quit(1 if failures else 0)


## Cells (c, r) the player can stand on: a floor tile with two free rows above.
func standable(area: Dictionary, c: int, r: int) -> bool:
	var t := Stage.tile_at(area, c, r)
	if not (Stage.is_solid(t) or t == Stage.ONEWAY):
		return false
	return r >= 2 and not Stage.is_solid(Stage.tile_at(area, c, r - 1)) and not Stage.is_solid(Stage.tile_at(area, c, r - 2))


func can_reach(a: Vector2i, b: Vector2i) -> bool:
	var rise := a.y - b.y
	var dc := absi(b.x - a.x)
	if rise > 3:
		return false
	if rise == 3:
		return dc <= 3
	if rise >= 1:
		return dc <= 4
	return dc <= 4 + int(-rise / 2)


## Can the player walk and jump from start_col to goal_col, staying in rows r0..r1?
func exit_reachable(area: Dictionary, start_col: int, goal_col: int, r0: int, r1: int) -> bool:
	var cells: Array[Vector2i] = []
	for c in area.cols:
		for r in range(r0, r1 + 1):
			if standable(area, c, r):
				cells.append(Vector2i(c, r))
	var start = null
	for p in cells:
		if p.x >= start_col:
			start = p
			break
	if start == null:
		return false
	var seen := {start: true}
	var queue: Array = [start]
	while queue.size():
		var p: Vector2i = queue.pop_front()
		if p.x >= goal_col:
			return true
		for q in cells:
			if not seen.has(q) and absi(q.x - p.x) <= 6 and can_reach(p, q):
				seen[q] = true
				queue.append(q)
	return false
