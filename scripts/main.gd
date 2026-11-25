## Runs the game: the fixed-step loop, touch and keyboard controls, the HUD,
## the menus (title, pause, stage clear, game over) and the settings.
extends Node

const KEYS := {
	KEY_LEFT: "left", KEY_A: "left", KEY_RIGHT: "right", KEY_D: "right",
	KEY_UP: "up", KEY_W: "up", KEY_DOWN: "down", KEY_S: "down",
	KEY_Z: "jump", KEY_J: "jump", KEY_SPACE: "jump",
	KEY_X: "fire", KEY_K: "fire",
	KEY_F: "tackle", KEY_H: "tackle",
	KEY_G: "glasses", KEY_C: "glasses", KEY_L: "glasses",
	KEY_V: "portal", KEY_Q: "portal", KEY_E: "portal",
	KEY_SHIFT: "lock", KEY_R: "lock",
}
const NAMES := ["left", "right", "up", "down", "jump", "fire", "tackle", "glasses", "portal", "lock"]
const MOUSE_ID := 99

var screen := "title"
var g: Game
var world: World
var hud: Hud
var menu: Control
var settings: SettingsUI
var acc := 0.0
var touch := DisplayServer.is_touchscreen_available()
var keys := {}
var held := {}
var latch := {}
## Touch: finger id -> {kind = "stick" | "button" | "tap", names, origin, at}
var pointers := {}
var lock_toggle := false
var over_t := 0.0
var inset_left := 0.0
var inset_right := 0.0


func _ready() -> void:
	Tune.ensure()
	Progress.load_data()
	world = World.new()
	add_child(world)
	var hud_layer := CanvasLayer.new()
	hud_layer.layer = 1
	add_child(hud_layer)
	hud = Hud.new()
	hud.main = self
	hud_layer.add_child(hud)
	var menu_layer := CanvasLayer.new()
	menu_layer.layer = 2
	add_child(menu_layer)
	menu = Control.new()
	menu.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu.theme = UI.theme()
	menu.mouse_filter = Control.MOUSE_FILTER_IGNORE
	menu_layer.add_child(menu)
	var settings_layer := CanvasLayer.new()
	settings_layer.layer = 3
	add_child(settings_layer)
	settings = SettingsUI.new()
	settings.visible = false
	settings_layer.add_child(settings)
	settings.changed.connect(_settings_changed)
	Ads.banner_changed.connect(_apply_insets)
	get_viewport().size_changed.connect(_on_resize)
	_apply_insets.call_deferred()
	show_title()
	_on_resize()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--shot="):
			_shot.call_deferred(arg.substr(7))


func _on_resize() -> void:
	world.layout(get_viewport().get_visible_rect().size)
	_apply_insets()


# ---------- Flow ----------

func set_game(game: Game) -> void:
	g = game
	world.g = g
	g.using_touch = touch
	world.layout(get_viewport().get_visible_rect().size)
	_cancel_pointers()


## The title screen plays a stage on autopilot behind the menu.
func demo() -> void:
	var d := Game.new()
	set_game(d)
	d.new_run()
	d.start_stage(1 + randi() % 3)
	d.glasses.have = true
	d.glasses.taken = true


func new_run() -> void:
	Ads.before_match(func():
		var game := Game.new()
		set_game(game)
		game.new_run()
		Progress.data.runs += 1
		Progress.save()
		_play())


func _play() -> void:
	clear_menu()
	screen = "play"
	over_t = 0.0


func show_title() -> void:
	screen = "title"
	Sfx.music("title")
	if g == null or screen != "play":
		demo()
	clear_menu()
	var d := Progress.data
	var box := UI.screen(menu, 900)
	var t := UI.title("THEY LIVE", 120)
	box.add_child(t)
	# Seven quick taps on the title turn developer mode on (or off).
	t.mouse_filter = Control.MOUSE_FILTER_STOP
	t.gui_input.connect(func(e):
		if (e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT) or (e is InputEventScreenTouch and e.pressed):
			_title_tap())
	box.add_child(UI.label("Put on the shades. See the truth.", 30, UI.GOLD))
	box.add_child(UI.label("The loot is below. Find the portal.", 26, UI.PALE))
	box.add_child(_gap(8))
	box.add_child(UI.button("START", new_run, "big"))
	box.add_child(UI.button("SETTINGS", func(): _open_settings(show_title)))
	if Ads.privacy_options_required:
		box.add_child(UI.button("PRIVACY CHOICES", Ads.show_privacy_options))
	if d.best_stage > 0:
		box.add_child(UI.label("Best: stage %d · %d points" % [d.best_stage, d.best_score], 24, UI.PALE))
	if not touch:
		box.add_child(UI.label("Arrows move · Z jump · X fire · F tackle · Shift lock aim · G shades · V portal · P pause", 20, Color(1, 1, 1, 0.6)))


func clear_menu() -> void:
	for c in menu.get_children():
		c.queue_free()


static func _gap(h: float) -> Control:
	var c := Control.new()
	c.custom_minimum_size.y = h
	return c


func pause() -> void:
	if screen != "play":
		return
	screen = "paused"
	_cancel_pointers()
	clear_menu()
	var box := UI.screen(menu, 760)
	box.add_child(UI.title("PAUSED", 80))
	box.add_child(UI.label("Stage %d · %s" % [g.stage_num, Game.AREA_TITLES[g.area_key]], 26, UI.PALE))
	box.add_child(UI.button("RESUME", resume, "big"))
	box.add_child(UI.button("SETTINGS", func(): _open_settings(func():
		screen = "play"
		pause())))
	box.add_child(UI.button("QUIT RUN", show_title))


func resume() -> void:
	screen = "play"
	clear_menu()


func _show_clear() -> void:
	screen = "clear"
	clear_menu()
	Ads.match_finished()
	Progress.record(g.stage_num, g.score)
	var s: Dictionary = g.stage_stats
	var box := UI.screen(menu, 960)
	box.add_child(UI.title("STAGE %d CLEAR!" % g.stage_num, 84, UI.GOLD))
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 34)
	for pair in [[s.lizards, "lizards"], [s.saved, "children saved"], [s.lost, "children taken"], [s.innocents, "innocents hit"]]:
		var v := VBoxContainer.new()
		v.add_theme_constant_override("separation", 0)
		v.add_child(UI.label(str(pair[0]), 52))
		v.add_child(UI.label(pair[1], 20, UI.PALE))
		v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_child(v)
	box.add_child(grid)
	box.add_child(UI.label("Stage bonus +%d · Score %d" % [g.clear_info.bonus, g.score], 30, UI.GOLD))
	box.add_child(UI.button("GO TO STAGE %d" % (g.stage_num + 1), func():
		Ads.before_match(func():
			g.next_stage()
			_play()), "big"))
	box.add_child(UI.button("TITLE", show_title))


func _show_game_over() -> void:
	screen = "gameover"
	clear_menu()
	Ads.match_finished()
	Progress.record(g.stage_num - 1, g.score)
	var box := UI.screen(menu, 860)
	box.add_child(UI.title("GAME OVER", 96, Color("#ff7070")))
	box.add_child(UI.label("Stage %d · Score %d" % [g.stage_num, g.score], 30, UI.PALE))
	box.add_child(UI.button("RETRY STAGE %d" % g.stage_num, func():
		Ads.before_match(func():
			g.retry_stage()
			_play()), "big"))
	box.add_child(UI.button("NEW RUN", new_run))
	box.add_child(UI.button("TITLE", show_title))


func _settings_changed() -> void:
	Sfx.apply()


func _open_settings(back: Callable) -> void:
	clear_menu()
	settings.open()
	for c in settings.closed.get_connections():
		settings.closed.disconnect(c.callable)
	settings.closed.connect(back, CONNECT_ONE_SHOT)


var _taps := 0
var _tap_at := 0


func _title_tap() -> void:
	var now := Time.get_ticks_msec()
	_taps = _taps + 1 if now - _tap_at < 900 else 1
	_tap_at = now
	if _taps >= 7 and Tune.can_toggle_dev():
		_taps = 0
		Tune.set_dev(not Tune.dev)
		_settings_changed()
		Sfx.play("pickup")
		_toast("Developer settings ON" if Tune.dev else "Developer settings OFF")


func _toast(text: String) -> void:
	var l := UI.label(text, 30, UI.GOLD)
	l.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	l.position.y -= 90
	l.position.x -= 300
	l.custom_minimum_size.x = 600
	menu.add_child(l)
	var tw := create_tween()
	tw.tween_interval(1.5)
	tw.tween_property(l, "modulate:a", 0.0, 0.5)
	tw.tween_callback(l.queue_free)


# ---------- Insets (banner ad, notches) ----------

func _apply_insets() -> void:
	var view := get_viewport().get_visible_rect().size
	var top := Ads.banner_inset(view.y)
	var safe := safe_area_insets(view)
	inset_left = safe.x
	inset_right = safe.y
	top = maxf(top, safe.z)
	hud.position = Vector2(inset_left, top)
	hud.size = view - Vector2(inset_left + inset_right, top)
	for c in [menu, settings]:
		c.offset_left = inset_left
		c.offset_right = -inset_right
		c.offset_top = top


static func safe_area_insets(view: Vector2) -> Vector3:
	if not OS.has_feature("mobile"):
		return Vector3.ZERO
	var win := Vector2(DisplayServer.window_get_size())
	var safe := Rect2(DisplayServer.get_display_safe_area())
	if win.x <= 0 or win.y <= 0 or safe.size.x <= 0:
		return Vector3.ZERO
	var k := view.x / win.x
	return Vector3(
		clampf(safe.position.x, 0, win.x * 0.2) * k,
		clampf(win.x - safe.end.x, 0, win.x * 0.2) * k,
		clampf(safe.position.y, 0, win.y * 0.2) * (view.y / win.y))


# ---------- Input ----------

## The touch buttons: name -> {center, radius, label}, in HUD coordinates.
func buttons() -> Dictionary:
	var s: float = Tune.v.buttonSize
	var w := hud.size.x
	var h := hud.size.y
	var out := {}
	var place := func(name: String, x_from_right: float, y_from_bottom: float, r: float, label: String):
		var x := w - x_from_right * s
		if Tune.v.swapSides:
			x = x_from_right * s
		out[name] = {center = Vector2(x, h - y_from_bottom * s), radius = r * s, label = label}
	place.call("fire", 190, 200, 96, "B")
	place.call("jump", 400, 130, 80, "A")
	place.call("tackle", 160, 430, 64, "TACKLE")
	if g and g.glasses.have:
		place.call("glasses", 390, 345, 62, "SHADES")
	if g and g.portal.have and g.area_key == "street":
		place.call("portal", 590, 150, 62, "PORTAL")
	place.call("lock", 585, 330, 52, "LOCK")
	return out


func _stick_side(pos: Vector2) -> bool:
	var left := pos.x < hud.size.x * 0.42
	return left != bool(Tune.v.swapSides)


func _button_at(pos: Vector2) -> String:
	var best := ""
	var bd := INF
	for name in buttons():
		var b: Dictionary = buttons()[name]
		var d := pos.distance_to(b.center)
		if d < b.radius * 1.25 and d < bd:
			bd = d
			best = name
	return best


func _press(id: int, pos: Vector2) -> void:
	pos -= hud.position
	if Rect2(hud.pause_rect()).has_point(pos):
		pause()
		return
	var b := _button_at(pos)
	if b != "":
		if b == "lock":
			lock_toggle = not lock_toggle
			pointers[id] = {kind = "tap"}
			return
		pointers[id] = {kind = "button", names = [b]}
		latch[b] = true
	elif _stick_side(pos):
		pointers[id] = {kind = "stick", origin = pos, at = pos}


func _move(id: int, pos: Vector2) -> void:
	pos -= hud.position
	if not pointers.has(id):
		return
	var p: Dictionary = pointers[id]
	if p.kind == "stick":
		p.at = pos
	elif p.kind == "button":
		# Rolling a thumb from one button onto another holds both (fire and
		# jump together); rolling back off lets the first go.
		var b := _button_at(pos)
		if b != "" and b != "lock" and b not in p.names:
			p.names.append(b)
			latch[b] = true
		while p.names.size() > 2:
			p.names.pop_front()
		if b != "" and p.names.size() == 2 and b == p.names[0]:
			p.names.pop_back()


func _release(id: int, _pos: Vector2) -> void:
	pointers.erase(id)


func _cancel_pointers() -> void:
	pointers.clear()


## The stick as a direction, -1..1 each way.
func stick_vector() -> Vector2:
	for p in pointers.values():
		if p.kind == "stick":
			var r: float = Tune.v.stickSize * hud.size.y / 540.0
			var v: Vector2 = (p.at - p.origin) / r
			return v.limit_length(1.0) if v.length() > 0.25 else Vector2.ZERO
	return Vector2.ZERO


func _touch_held() -> Dictionary:
	var out := {}
	var v := stick_vector()
	if v != Vector2.ZERO:
		# Eight directions: 22.5 degrees either side of each.
		var a := v.angle()
		var s := sin(a)
		var c := cos(a)
		out.right = c > 0.38
		out.left = c < -0.38
		out.down = s > 0.38
		out.up = s < -0.38
	for p in pointers.values():
		if p.kind == "button":
			for n in p.names:
				out[n] = true
	return out


func _unhandled_input(e: InputEvent) -> void:
	if screen != "play" or settings.visible:
		if e is InputEventScreenTouch or e is InputEventMouseButton:
			_cancel_pointers()
		return
	if e is InputEventScreenTouch:
		if not touch:
			touch = true
			g.using_touch = true
		if e.pressed:
			_press(e.index, e.position)
		else:
			_release(e.index, e.position)
	elif e is InputEventScreenDrag:
		_move(e.index, e.position)
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and e.device != InputEvent.DEVICE_ID_EMULATION:
		if e.pressed:
			_press(MOUSE_ID, e.position)
		else:
			_release(MOUSE_ID, e.position)
	elif e is InputEventMouseMotion and e.device != InputEvent.DEVICE_ID_EMULATION:
		_move(MOUSE_ID, e.position)


func _unhandled_key_input(e: InputEvent) -> void:
	if settings.visible:
		return
	var k: int = e.keycode
	if e.pressed and not e.echo and k in [KEY_P, KEY_ESCAPE]:
		if screen == "play":
			pause()
		elif screen == "paused":
			resume()
		return
	if e.pressed and not e.echo and k == KEY_ENTER and screen == "title":
		new_run()
		return
	if KEYS.has(k):
		var name: String = KEYS[k]
		if e.pressed and not e.echo:
			latch[name] = true
		keys[name] = e.pressed


## This step's input for the game: what's held, and what went down since the last step.
func _input_state() -> Dictionary:
	var th := _touch_held()
	var now := {}
	var pressed := {}
	for n in NAMES:
		now[n] = keys.get(n, false) or th.get(n, false) or (n == "lock" and lock_toggle)
		pressed[n] = (now[n] and not held.get(n, false)) or latch.get(n, false)
	held = now
	latch.clear()
	return {held = now, pressed = pressed}


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_WM_GO_BACK_REQUEST:
			if settings.visible:
				settings.close()
			elif screen == "play":
				pause()
			elif screen == "paused":
				resume()
			elif screen in ["clear", "gameover"]:
				show_title()
			else:
				get_tree().quit()
		NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_APPLICATION_FOCUS_OUT:
			pause()


# ---------- Loop ----------

func _process(delta: float) -> void:
	if g == null:
		return
	var running := not settings.visible and screen in ["play", "title"]
	if running:
		acc += minf(delta, 0.1)
		while acc >= Game.STEP:
			var inp := g.autopilot() if screen == "title" else _input_state()
			g.step(inp)
			acc -= Game.STEP
		if screen == "play":
			for s in g.sounds:
				Sfx.play(s)
			for e in g.events:
				if e == "hurt" and Tune.v.vibrate:
					Input.vibrate_handheld(90)
			Sfx.music(g.music_track if g.music_track != "" else "title")
		g.sounds.clear()
		g.events.clear()
		if screen == "play" and g.mode in ["clear", "gameover"]:
			over_t += delta
			if over_t > (1.2 if g.mode == "clear" else 0.6):
				if g.mode == "clear":
					_show_clear()
				else:
					_show_game_over()
		if screen == "title" and g.mode in ["clear", "gameover"]:
			demo()
	else:
		acc = 0.0
	hud.queue_redraw()


# ---------- Screenshots and checks ----------

## For automated checks: `-- --shot=<what>,<stage>,<file>` sets up a screen,
## lets it run, saves a screenshot and quits. what: title, play, truth,
## sewer, boss, awake, clear, input.
func _shot(spec: String) -> void:
	var parts := spec.split(",")
	var what := parts[0]
	var stage := int(parts[1]) if parts.size() > 1 else 1
	var file := parts[2] if parts.size() > 2 else "user://shot.png"
	# A fourth part "touch" shows the touch controls.
	if parts.size() > 3 and parts[3] == "touch":
		touch = true
	if what == "input":
		await _input_check()
		return
	var wait := 1.5
	if what != "title":
		var game := Game.new(7)
		set_game(game)
		game.new_run(11)
		if stage != 1:
			game.start_stage(stage)
		_play()
		game.banner = null
		match what:
			"play", "truth":
				# Walk in a little way, to where people are.
				game.player.x = 300.0
				game.update_camera(0, true)
				if what == "truth":
					game.glasses.have = true
					game.glasses.taken = true
					game.glasses.on = true
					game.glasses.meter = 1.0
			"sewer":
				game.player.x = 420.0
				var c := int(game.player.x / Stage.TILE)
				game.player.y = float(game.area.ground[1][game._safe_column(c, 1)] * Stage.TILE)
				game.player.x = game._safe_column(c, 1) * Stage.TILE + 8.0
				game.weapon = "M"
				game.portal.have = true
				game.update_camera(0, true)
			"boss", "awake":
				game.enter_area("boss")
				if what == "awake":
					for a in game.actors:
						if a.type == "cultist":
							a.dead = true
					wait = 4.5
		game.banner = null
	if what in ["play", "truth", "sewer", "boss", "awake"]:
		# Let it play on autopilot, so things are happening.
		var until := Time.get_ticks_msec() + int(wait * 1000)
		while Time.get_ticks_msec() < until:
			await get_tree().process_frame
			if g.mode == "play":
				for i in 2:
					g.step(_shot_input())
	else:
		await get_tree().create_timer(wait).timeout
	await get_tree().process_frame
	await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(file)
	get_tree().quit()


func _shot_input() -> Dictionary:
	var inp := g.autopilot()
	inp.held.right = false
	return inp


## Plays touches through the real input path and reports whether moving,
## jumping and firing work.
func _input_check() -> void:
	await get_tree().create_timer(0.5).timeout
	var start_btn: Button = null
	for b in menu.find_children("*", "Button", true, false):
		if b.text == "START":
			start_btn = b
	var c := start_btn.get_global_rect().get_center()
	for down in [true, false]:
		var e := InputEventScreenTouch.new()
		e.index = 0
		e.position = c
		e.pressed = down
		Input.parse_input_event(e)
		await get_tree().process_frame
	await get_tree().create_timer(0.3).timeout
	var menu_ok := screen == "play"
	if not menu_ok:
		new_run()
		await get_tree().process_frame
	g.banner = null
	var p := g.player
	var x0: float = p.x
	var view := get_viewport().get_visible_rect().size
	var touch_ev := func(i: int, pos: Vector2, down: bool):
		var e := InputEventScreenTouch.new()
		e.index = i
		e.position = pos
		e.pressed = down
		Input.parse_input_event(e)
	var drag_ev := func(i: int, pos: Vector2):
		var e := InputEventScreenDrag.new()
		e.index = i
		e.position = pos
		Input.parse_input_event(e)
	# Finger 1: the stick, pushed right and held.
	var st := Vector2(view.x * 0.15, view.y * 0.7)
	touch_ev.call(1, st, true)
	await get_tree().process_frame
	drag_ev.call(1, st + Vector2(140, 0))
	await get_tree().create_timer(0.8).timeout
	var moved: float = g.player.x - x0
	# Finger 2: fire, held for a moment.
	var fire_at: Vector2 = buttons().fire.center + hud.position
	var thrown := false
	touch_ev.call(2, fire_at, true)
	for i in 20:
		await get_tree().process_frame
		if not g.bullets.is_empty():
			thrown = true
	touch_ev.call(2, fire_at, false)
	# Finger 3: jump.
	var jump_at: Vector2 = buttons().jump.center + hud.position
	touch_ev.call(3, jump_at, true)
	var jumped := false
	for i in 30:
		await get_tree().process_frame
		if not g.player.on_ground:
			jumped = true
	touch_ev.call(3, jump_at, false)
	touch_ev.call(1, st + Vector2(140, 0), false)
	await get_tree().process_frame
	var released := pointers.is_empty()
	var ok := menu_ok and moved > 4 and thrown and jumped and released
	print("INPUT CHECK menu_tap=%s moved=%.1f fired=%s jumped=%s released=%s -> %s" % [menu_ok, moved, thrown, jumped, released, "ok" if ok else "FAILED"])
	get_tree().quit(0 if ok else 1)


# ---------- HUD ----------

class Hud:
	extends Control
	var main

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func pause_rect() -> Rect2:
		return Rect2(size.x - 130, 20, 110, 110)

	func _draw() -> void:
		var g: Game = main.g
		if g == null or main.screen not in ["play", "paused", "clear", "gameover"]:
			_draw_texts(g)
			return
		var font: Font = UI.font if UI.font else load("res://assets/fonts/russo-one.woff2")
		var W := size.x
		var H := size.y
		var w: World = main.world
		# Darker edges in the sewers and the temple.
		if g.area.kind == "boss" or g.cam.y > 0:
			for i in 6:
				var a := 0.06 * (6 - i)
				draw_rect(Rect2(0, 0, 18 + i * 16, H), Color(0, 0, 0, a * 0.5))
				draw_rect(Rect2(W - 18 - i * 16, 0, 18 + i * 16, H), Color(0, 0, 0, a * 0.5))
		_draw_texts(g)
		# Hearts and the hard hat.
		var hx := 40.0
		for i in int(Tune.v.maxHearts):
			var full := i < g.hearts
			World._heart(self, Vector2(hx + i * 62, 66), 24, Color("#e83040") if full else Color(0.2, 0.15, 0.2, 0.8))
		if g.armor:
			World._hard_hat(self, Vector2(hx + int(Tune.v.maxHearts) * 62 + 8, 64), 30)
		# The shades meter, or what to look for.
		if g.glasses.have:
			var r := Rect2(30, 110, 250, 22)
			draw_rect(r.grow(4), Color(0, 0, 0, 0.6))
			var col := Color("#fc7460") if g.glasses.locked else (Color("#58d8f8") if g.glasses.on else Color("#a8a8c0"))
			draw_rect(Rect2(r.position, Vector2(r.size.x * g.glasses.meter, r.size.y)), col)
			_text(font, "SHADES" if not g.glasses.locked else "HEADACHE", Vector2(r.position.x + 8, r.end.y - 3), 20, Color.WHITE)
		elif g.area_key == "street":
			_text(font, "FIND THE SHADES", Vector2(30, 132), 26, UI.GOLD)
		# Stage, score and weapon.
		var title := "STAGE %d · %s" % [g.stage_num, "THE TEMPLE" if g.area_key == "boss" else ("SEWERS" if g.cam.y > 0 else "STREETS")]
		_text_c(font, title, Vector2(W / 2, 56), 34, Color.WHITE)
		_text_r(font, "%07d" % g.score, Vector2(W - 160, 60), 40, Color.WHITE)
		_text_r(font, Game.WEAPON_INFO[g.weapon].name, Vector2(W - 160, 98), 24, UI.GOLD)
		# Pause button.
		if main.screen == "play":
			var pr := pause_rect()
			draw_circle(pr.get_center(), 50, Color(0, 0, 0, 0.45))
			draw_rect(Rect2(pr.get_center() + Vector2(-17, -20), Vector2(12, 40)), Color.WHITE)
			draw_rect(Rect2(pr.get_center() + Vector2(5, -20), Vector2(12, 40)), Color.WHITE)
		# The idol's health.
		if g.boss != null and g.boss.state == "awake" and not g.boss.dead:
			var br := Rect2(W / 2 - 400, 92, 800, 26)
			draw_rect(br.grow(4), Color(0, 0, 0, 0.7))
			draw_rect(Rect2(br.position, Vector2(br.size.x * maxf(0.0, g.boss.hp / g.boss.max_hp), br.size.y)), Color("#e05020"))
			_text_c(font, g.boss.name, Vector2(W / 2, 150), 26, Color("#f8d0a0"))
		elif g.boss != null and g.boss.state == "dormant" and main.screen == "play":
			_text_c(font, "CULTISTS LEFT: %d" % g.cultists_left(), Vector2(W / 2, 100), 26, Color("#f8d0a0"))
		_lane_alert(g, font)
		# The banner.
		if g.banner != null:
			var a := clampf(g.banner.t * 2.0, 0.0, 1.0)
			draw_rect(Rect2(0, H * 0.3, W, 160), Color(0, 0, 0, 0.55 * a))
			_text_c(font, g.banner.title, Vector2(W / 2, H * 0.3 + 80), 72, Color(1, 0.9, 0.3, a))
			if g.banner.sub != "":
				_text_c(font, g.banner.sub, Vector2(W / 2, H * 0.3 + 134), 30, Color(1, 1, 1, a))
		if g.fade > 0:
			draw_rect(Rect2(-100, -100, W + 200, H + 200), Color(0, 0, 0, minf(1.0, g.fade)))
		if main.screen == "play" and main.touch:
			_draw_controls(g, font)

	## Floating texts from the game (score, HIT, SPOTTED...), at their world spots.
	func _draw_texts(g: Game) -> void:
		if g == null:
			return
		var font: Font = UI.font if UI.font else load("res://assets/fonts/russo-one.woff2")
		var w: World = main.world
		for t in g.texts:
			var at: Vector2 = w.world_to_screen(Vector2(t.x, t.y)) - position
			var c: Color = t.color
			c.a = clampf(t.life * 3, 0, 1)
			_text_c(font, t.text, at, 30, c)

	## A red arrow at the screen edge when a child is being dragged off in the other lane.
	func _lane_alert(g: Game, font: Font) -> void:
		if g.area_key != "street":
			return
		var lane := g.lane_of_player()
		for a in g.actors:
			if a.type == "snatcher" and a.child != null and Stage.lane_of(a.y) != lane:
				var y := size.y - 80.0 if lane == 0 else 150.0
				var pulse := 0.6 + 0.4 * sin(g.time * 8)
				_text_c(font, "HELP! ▼" if lane == 0 else "HELP! ▲", Vector2(size.x / 2, y), 40, Color(1, 0.35, 0.3, pulse))
				return

	func _draw_controls(g: Game, font: Font) -> void:
		var alpha: float = Tune.v.buttonAlpha
		var held: Dictionary = main.held
		for name in main.buttons():
			var b: Dictionary = main.buttons()[name]
			var on: bool = held.get(name, false) or (name == "lock" and main.lock_toggle)
			var col := Color(1, 1, 1, 0.22 * alpha) if not on else Color(1, 0.85, 0.3, 0.5 * alpha)
			if name == "portal":
				col = Color(0.55, 0.4, 1, (0.5 if on else 0.32) * alpha) if g.portal.cd <= 0 else Color(0.3, 0.3, 0.3, 0.2 * alpha)
			if name == "glasses" and g.glasses.on:
				col = Color(0.35, 0.85, 1, 0.45 * alpha)
			draw_circle(b.center, b.radius, col)
			draw_arc(b.center, b.radius, 0, TAU, 48, Color(1, 1, 1, 0.6 * alpha), 4, true)
			var fs := int(b.radius * (0.75 if b.label.length() <= 1 else 0.3))
			_text_c(font, b.label, b.center + Vector2(0, fs * 0.36), fs, Color(1, 1, 1, 0.9 * alpha), false)
		# The stick, where the thumb is or resting faintly.
		var r: float = Tune.v.stickSize * size.y / 540.0
		var origin := Vector2(size.x * (0.84 if Tune.v.swapSides else 0.14), size.y - r - 80)
		var knob := origin
		var a := 0.35
		for p in main.pointers.values():
			if p.kind == "stick":
				origin = p.origin
				knob = origin + main.stick_vector() * r
				a = 1.0
		draw_circle(origin, r, Color(0, 0, 0, 0.2 * a * alpha))
		draw_arc(origin, r, 0, TAU, 48, Color(1, 1, 1, 0.5 * a * alpha), 4, true)
		draw_circle(knob, r * 0.42, Color(1, 1, 1, 0.45 * a * alpha))

	func _text(font: Font, s: String, at: Vector2, fs: int, col: Color) -> void:
		draw_string_outline(font, at, s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 8, Color(0.03, 0.02, 0.06, col.a * 0.9))
		draw_string(font, at, s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)

	func _text_c(font: Font, s: String, at: Vector2, fs: int, col: Color, outline := true) -> void:
		var w := font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var p := at - Vector2(w / 2, 0)
		if outline:
			draw_string_outline(font, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 8, Color(0.03, 0.02, 0.06, col.a * 0.9))
		draw_string(font, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)

	func _text_r(font: Font, s: String, at: Vector2, fs: int, col: Color) -> void:
		var w := font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		_text(font, s, at - Vector2(w, 0), fs, col)
