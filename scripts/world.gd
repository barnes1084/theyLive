## Draws the game world: the city at dusk, the sewers, the temple of Moloch,
## the tiles, billboards, people, lizards, shots and effects. Everything is
## drawn in world pixels; this node scales them up to the screen and follows
## the camera. With the sunglasses on, the world turns black and white and
## the lizards (and their shots) stay in colour.
class_name World
extends Node2D

const TILE := Stage.TILE
const SHADER := """
shader_type canvas_item;
uniform float truth = 0.0;
void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	float l = dot(c.rgb, vec3(0.3, 0.59, 0.11));
	l = clamp((l - 0.45) * 1.35 + 0.5, 0.0, 1.0);
	COLOR = vec4(mix(c.rgb, vec3(l), truth), c.a);
}
"""

var g: Game
var zoom := 7.5
var view := Vector2(1920, 1080)
var shake_off := Vector2.ZERO
var font: Font
var _truth_amount := 0.0
var gray: ShaderMaterial

var back: Layer
var base: Layer
var truth: Layer
var glow: Layer
var fx: Layer


func _ready() -> void:
	font = load("res://assets/fonts/russo-one.woff2")
	gray = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SHADER
	gray.shader = sh
	back = _layer("back")
	back.material = gray
	base = _layer("base")
	base.material = gray
	truth = _layer("truth")
	glow = _layer("glow")
	var add := CanvasItemMaterial.new()
	add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	glow.material = add
	fx = _layer("fx")


func _layer(kind: String) -> Layer:
	var l := Layer.new()
	l.world = self
	l.kind = kind
	add_child(l)
	return l


## Sizes the view: one lane (9 tiles) fills the screen's height.
func layout(size: Vector2) -> void:
	view = size
	zoom = size.y / float(Stage.LANE_ROWS * TILE)
	if g:
		g.W = size.x / zoom
		g.view_h = Stage.LANE_ROWS * TILE
		g.update_camera(0.0, true)


func world_to_screen(p: Vector2) -> Vector2:
	return (p - g.cam) * zoom + shake_off


func _process(delta: float) -> void:
	if g == null or g.area.is_empty():
		return
	shake_off = Vector2.ZERO
	if g.shake > 0 and Tune.v.shake > 0:
		shake_off = Vector2(randf_range(-1.5, 1.5), randf_range(-1.0, 1.0)) * Tune.v.shake * zoom
	position = -g.cam * zoom + shake_off
	scale = Vector2(zoom, zoom)
	var want := 1.0 if g.glasses.on else 0.0
	_truth_amount = move_toward(_truth_amount, want, delta * 6.0)
	gray.set_shader_parameter("truth", _truth_amount)
	for l in [back, base, truth, glow, fx]:
		l.queue_redraw()


static func h01(i: int) -> float:
	return fposmod(sin(i * 12.9898 + 78.233) * 43758.5453, 1.0)


# ---------- Layers ----------

class Layer:
	extends Node2D
	var world: World
	var kind := ""

	func _draw() -> void:
		var w := world
		if w.g == null or w.g.area.is_empty():
			return
		match kind:
			"back":
				w.draw_background(self)
			"base":
				w.draw_base(self)
			"truth":
				w.draw_truth(self)
			"glow":
				w.draw_glow(self)
			"fx":
				w.draw_fx(self)


# ---------- Backgrounds ----------

func _vgrad(ci: CanvasItem, x0: float, y0: float, x1: float, y1: float, a: Color, b: Color) -> void:
	ci.draw_polygon(PackedVector2Array([Vector2(x0, y0), Vector2(x1, y0), Vector2(x1, y1), Vector2(x0, y1)]), PackedColorArray([a, a, b, b]))


func draw_background(ci: CanvasItem) -> void:
	var cam := g.cam
	var x0 := cam.x - 2
	var x1 := cam.x + g.W + 2
	if g.area.kind == "boss":
		_temple_back(ci, x0, x1)
		return
	if cam.y < Stage.LANE_ROWS * TILE:
		_city_back(ci, x0, x1)
	else:
		_sewer_back(ci, x0, x1)


func _city_back(ci: CanvasItem, x0: float, x1: float) -> void:
	var H := float(Stage.LANE_ROWS * TILE)
	_vgrad(ci, x0, 0, x1, H * 0.45, Color("#1a1038"), Color("#5a2458"))
	_vgrad(ci, x0, H * 0.45, x1, H, Color("#5a2458"), Color("#c8584a"))
	# The setting sun, far away (barely moves).
	var sun := Vector2(g.cam.x + g.W * 0.72 - g.cam.x * 0.02, H * 0.62)
	ci.draw_circle(sun, 30, Color(1, 0.55, 0.35, 0.12))
	ci.draw_circle(sun, 20, Color(1, 0.6, 0.4, 0.25))
	ci.draw_circle(sun, 13, Color("#ffb070"))
	# Three rows of buildings, nearer ones scrolling faster.
	_skyline(ci, x0, x1, 0.15, 14.0, 30.0, 55.0, Color("#2a1a42"), 0.04, 101)
	_skyline(ci, x0, x1, 0.35, 22.0, 40.0, 80.0, Color("#33224e"), 0.12, 202)
	_skyline(ci, x0, x1, 0.6, 30.0, 34.0, 70.0, Color("#3c2a56"), 0.3, 303)


## A row of buildings: each slot `spacing` wide (in its own parallax units),
## with a height between lo and hi above the street line.
func _skyline(ci: CanvasItem, x0: float, x1: float, f: float, spacing: float, lo: float, hi: float, col: Color, lit: float, seed_value: int) -> void:
	var street := 104.0
	var shift := g.cam.x * f
	var i0 := floori((x0 - g.cam.x + shift) / spacing) - 1
	var i1 := ceili((x1 - g.cam.x + shift) / spacing) + 1
	for i in range(i0, i1):
		var r := h01(i * 7 + seed_value)
		var w := spacing * (0.75 + 0.25 * h01(i + seed_value))
		var h := lo + (hi - lo) * r
		var x := g.cam.x + i * spacing - shift
		var top := street - h
		ci.draw_rect(Rect2(x, top, w, h + 40), col)
		if r > 0.7:
			# A water tower or antenna on the tallest.
			ci.draw_rect(Rect2(x + w * 0.5, top - 6, 0.8, 6), col)
			ci.draw_circle(Vector2(x + w * 0.5 + 0.4, top - 6), 0.9, Color(1, 0.3, 0.3, 0.8))
		var cols := maxi(1, int(w / 4))
		var rows := int(h / 5)
		for cy in rows:
			for cx in cols:
				var k := i * 131 + cy * 17 + cx * 7 + seed_value
				if h01(k) < lit:
					var wc := Color("#ffd27a") if h01(k + 3) < 0.6 else Color("#e0a050")
					ci.draw_rect(Rect2(x + 1 + cx * 4, top + 3 + cy * 5, 1.6, 2.2), wc)


func _sewer_back(ci: CanvasItem, x0: float, x1: float) -> void:
	var y0 := float(Stage.LANE_ROWS * TILE)
	var H := float(Stage.LANE_ROWS * TILE)
	_vgrad(ci, x0, y0, x1, y0 + H, Color("#101814"), Color("#1c2a22"))
	# Brick wall, slightly slower than the floor.
	var f := 0.85
	var shift := g.cam.x * (1.0 - f)
	var bw := 12.0
	var bh := 6.0
	var r0 := 0
	var y := y0 + 22.0
	while y < y0 + H - 10:
		var off := bw / 2 if r0 % 2 else 0.0
		var i0 := floori((x0 - shift - off) / bw)
		for i in range(i0, i0 + int(g.W / bw) + 3):
			var x := i * bw + off + shift
			var shade := 0.85 + 0.25 * h01(i * 13 + r0 * 7)
			ci.draw_rect(Rect2(x + 0.4, y + 0.4, bw - 0.8, bh - 0.8), Color(0.16 * shade, 0.2 * shade, 0.17 * shade))
		y += bh
		r0 += 1
	# Big pipes along the wall.
	ci.draw_rect(Rect2(x0, y0 + 40, x1 - x0, 6), Color("#2c3a34"))
	ci.draw_rect(Rect2(x0, y0 + 40, x1 - x0, 1.5), Color("#4a5c52"))
	ci.draw_rect(Rect2(x0, y0 + 52, x1 - x0, 3), Color("#3a2c22"))
	# Arches and lamps, fixed to the wall.
	for lx in lamp_xs():
		ci.draw_rect(Rect2(lx - 1.5, y0 + 30, 3, 4), Color("#3a3a30"))
		ci.draw_circle(Vector2(lx, y0 + 35), 2.2, Color("#ffe8a0"))
	var ai := floori((x0 - shift) / 64.0)
	for i in range(ai, ai + int(g.W / 64.0) + 3):
		var ax := i * 64.0 + shift + 32
		var pts := PackedVector2Array()
		for k in 13:
			var a := PI + PI * k / 12.0
			pts.append(Vector2(ax + cos(a) * 22, y0 + 100 + sin(a) * 26))
		ci.draw_polyline(pts, Color("#0c1210"), 3.0)
		# Drips of slime down the wall.
		ci.draw_rect(Rect2(ax + 9, y0 + 56, 1, 10 + 8 * h01(i)), Color(0.35, 0.7, 0.3, 0.5))


func lamp_xs() -> Array:
	var out := []
	var i0 := floori(g.cam.x / 96.0)
	for i in range(i0, i0 + int(g.W / 96.0) + 3):
		out.append(i * 96.0 + 48)
	return out


func _temple_back(ci: CanvasItem, x0: float, x1: float) -> void:
	var top := g.cam.y
	var floor_y := Game.FLOOR_Y
	_vgrad(ci, x0, top, x1, floor_y, Color("#160808"), Color("#3a1410"))
	# Stone blocks.
	for r in range(0, 12):
		var yy := floor_y - 12 - r * 12.0
		var off := 8.0 if r % 2 else 0.0
		for i in range(-1, 22):
			var x := i * 16.0 + off
			var s := 0.8 + 0.3 * h01(i * 5 + r * 11)
			ci.draw_rect(Rect2(x + 0.5, yy + 0.5, 15, 11), Color(0.2 * s, 0.09 * s, 0.07 * s))
	# Columns and torches.
	for cx in [40.0, 112.0, 208.0, 280.0]:
		ci.draw_rect(Rect2(cx - 7, top, 14, floor_y - top), Color("#2a1410"))
		ci.draw_rect(Rect2(cx - 7, top, 2, floor_y - top), Color("#3a2016"))
		ci.draw_rect(Rect2(cx - 9, floor_y - 6, 18, 6), Color("#3a1c14"))
		ci.draw_rect(Rect2(cx - 2, floor_y - 52, 4, 8), Color("#4a3020"))
		_flame(ci, Vector2(cx, floor_y - 52), 4.0)
	# A great hanging banner behind the idol, with the horned sign.
	var bx := Game.ALTAR_X
	ci.draw_rect(Rect2(bx - 26, top + 4, 52, 62), Color("#5a0c10"))
	ci.draw_rect(Rect2(bx - 26, top + 4, 52, 2), Color("#c08030"))
	var horns := PackedVector2Array([Vector2(bx - 14, top + 22), Vector2(bx - 8, top + 34), Vector2(bx, top + 38), Vector2(bx + 8, top + 34), Vector2(bx + 14, top + 22)])
	ci.draw_polyline(horns, Color("#c08030"), 2.5)
	ci.draw_circle(Vector2(bx, top + 46), 6, Color("#c08030"))
	ci.draw_circle(Vector2(bx, top + 46), 4, Color("#5a0c10"))
	# The pedestal and fire pit.
	if g.boss != null and g.boss.state == "dormant":
		ci.draw_rect(Rect2(bx - 24, floor_y - Game.PEDESTAL_H, 48, Game.PEDESTAL_H), Color("#4a3a30"))
		ci.draw_rect(Rect2(bx - 24, floor_y - Game.PEDESTAL_H, 48, 2), Color("#6a5a48"))


func _flame(ci: CanvasItem, at: Vector2, s: float) -> void:
	var t := g.time * 9.0 + at.x
	var flick := 1.0 + 0.15 * sin(t) + 0.1 * sin(t * 2.3)
	ci.draw_circle(at + Vector2(0, -s * 0.8), s * 1.1 * flick, Color("#f87800"))
	ci.draw_circle(at + Vector2(0, -s * 1.1), s * 0.7 * flick, Color("#f8d800"))
	ci.draw_circle(at + Vector2(0, -s * 1.3), s * 0.35, Color("#fff8e0"))


# ---------- Tiles, decor, pickups, people ----------

func draw_base(ci: CanvasItem) -> void:
	if g.area.kind == "street":
		_decor(ci)
	_tiles(ci)
	_pickups(ci, false)
	var truth_on: bool = g.glasses.on
	# The idol first (it's big and behind), then everyone else.
	if g.boss != null:
		_draw_boss(ci, g.boss)
	for a in g.actors:
		if a.type == "boss" or a.carried_by != null:
			continue
		if truth_on and _shows_lizard(a):
			continue
		_draw_actor(ci, a, false)
	_draw_player(ci)
	_draw_bullets(ci)


## Whether the shades show this actor as a lizard (drawn in colour on top).
func _shows_lizard(a: Dictionary) -> bool:
	return Game.is_lizard(a) and a.type != "boss"


func draw_truth(ci: CanvasItem) -> void:
	if g.glasses.on:
		for a in g.actors:
			if a.carried_by == null and a.type != "boss" and _shows_lizard(a):
				_draw_actor(ci, a, true)
		_pickups(ci, true)
	_draw_shots(ci)


func _decor(ci: CanvasItem) -> void:
	var c0 := floori(g.cam.x / TILE) - 8
	var c1 := ceili((g.cam.x + g.W) / TILE) + 2
	var truth_on: bool = g.glasses.on
	for b in g.area.billboards:
		if b.c + b.w < c0 or b.c > c1:
			continue
		var x: float = b.c * TILE
		var y: float = b.r * TILE
		var w: float = b.w * TILE
		var h: float = b.h * TILE
		var ground_y: float = 104.0
		for px in [x + w * 0.25, x + w * 0.75]:
			ci.draw_rect(Rect2(px - 1, y + h, 2, ground_y - y - h), Color("#2a2430"))
		ci.draw_rect(Rect2(x - 1.5, y - 1.5, w + 3, h + 3), Color("#1a1620"))
		if truth_on:
			ci.draw_rect(Rect2(x, y, w, h), Color("#f4f4f0"))
			_text_fit(ci, b.truth, Rect2(x + 2, y + 2, w - 4, h - 4), Color("#101010"))
		else:
			var col := Color.from_hsv(h01(b.c) , 0.65, 0.75)
			ci.draw_rect(Rect2(x, y, w, h), col)
			ci.draw_rect(Rect2(x, y, w, h * 0.35), col.lightened(0.15))
			_text_fit(ci, b.ad, Rect2(x + 2, y + 2, w - 4, h - 4), Color("#fff8e0"))
	# The church, and the box with the sunglasses outside it.
	var gl: Dictionary = g.area.glasses
	if not gl.is_empty():
		var cx: float = gl.x + 26
		var gy: float = gl.y
		ci.draw_rect(Rect2(cx - 18, gy - 44, 36, 44), Color("#6a5a50"))
		ci.draw_colored_polygon(PackedVector2Array([Vector2(cx - 21, gy - 44), Vector2(cx, gy - 60), Vector2(cx + 21, gy - 44)]), Color("#3a2c28"))
		ci.draw_rect(Rect2(cx - 4, gy - 76, 8, 18), Color("#6a5a50"))
		ci.draw_rect(Rect2(cx - 0.6, gy - 84, 1.2, 8), Color("#d8c8a0"))
		ci.draw_rect(Rect2(cx - 3, gy - 81, 6, 1.2), Color("#d8c8a0"))
		ci.draw_rect(Rect2(cx - 6, gy - 18, 12, 18), Color("#2a1c18"))
		for wx in [-12.0, 8.0]:
			ci.draw_rect(Rect2(cx + wx, gy - 36, 4, 9), Color("#e0b060"))
		if not g.glasses.taken:
			ci.draw_rect(Rect2(gl.x - 6, gy - 7, 12, 7), Color("#b08850"))
			ci.draw_rect(Rect2(gl.x - 6, gy - 7, 12, 1.5), Color("#d0a870"))
			# The shades peeking out.
			ci.draw_rect(Rect2(gl.x - 4.5, gy - 9.5, 4, 2.6), Color("#101018"))
			ci.draw_rect(Rect2(gl.x + 0.5, gy - 9.5, 4, 2.6), Color("#101018"))
			ci.draw_rect(Rect2(gl.x - 1, gy - 9, 2, 0.8), Color("#101018"))
			var pulse := 0.5 + 0.5 * sin(g.time * 5)
			ci.draw_circle(Vector2(gl.x, gy - 12), 3 + pulse, Color(1, 0.95, 0.5, 0.25 * pulse))
	# The temple door at the end of both lanes.
	var ex: float = g.area.exit.c0 * TILE
	for lane in 2:
		var gr: int = g.area.ground[lane][mini(g.area.exit.c0 + 1, g.area.cols - 1)]
		if gr < 0:
			continue
		var fy := float(gr * TILE)
		ci.draw_rect(Rect2(ex - 4, fy - 40, 40, 40), Color("#3a2a24"))
		ci.draw_rect(Rect2(ex + 6, fy - 30, 20, 30), Color("#100404"))
		var pulse := 0.5 + 0.5 * sin(g.time * 3)
		ci.draw_rect(Rect2(ex + 8, fy - 28, 16, 28), Color(0.7, 0.1, 0.05, 0.35 + 0.25 * pulse))
		ci.draw_colored_polygon(PackedVector2Array([Vector2(ex - 6, fy - 40), Vector2(ex + 16, fy - 52), Vector2(ex + 38, fy - 40)]), Color("#2a1c18"))


## Text squeezed into a box (billboards), in world pixels.
func _text_fit(ci: CanvasItem, s: String, r: Rect2, col: Color) -> void:
	var words := s.split(" ")
	var lines: Array = [s] if s.length() <= 10 or words.size() == 1 else [" ".join(words.slice(0, (words.size() + 1) / 2)), " ".join(words.slice((words.size() + 1) / 2))]
	var size := 64
	var widest := 0.0
	for l in lines:
		widest = maxf(widest, font.get_string_size(l, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x)
	var k := minf(r.size.x / widest, r.size.y / (lines.size() * size * 1.05))
	ci.draw_set_transform(Vector2(r.position.x + r.size.x / 2, r.position.y + r.size.y / 2 - lines.size() * size * k * 0.5), 0.0, Vector2(k, k))
	for i in lines.size():
		var w := font.get_string_size(lines[i], HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
		ci.draw_string(font, Vector2(-w / 2, size * (i + 0.82)), lines[i], HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _tiles(ci: CanvasItem) -> void:
	var area: Dictionary = g.area
	var c0 := floori(g.cam.x / TILE) - 1
	var c1 := ceili((g.cam.x + g.W) / TILE) + 1
	var r0 := floori(g.cam.y / TILE)
	var r1 := mini(Stage.ROWS - 1, r0 + Stage.LANE_ROWS + 1)
	var boss: bool = area.kind == "boss"
	for r in range(r0, r1 + 1):
		var sewer := r >= Stage.LANE_ROWS and not boss
		for c in range(c0, c1 + 1):
			if c < 0 or c >= area.cols:
				continue
			var t := Stage.tile_at(area, c, r)
			if t == Stage.AIR:
				continue
			var x := float(c * TILE)
			var y := float(r * TILE)
			var top := not Stage.is_solid(Stage.tile_at(area, c, r - 1)) and Stage.tile_at(area, c, r - 1) != Stage.SLUDGE
			match t:
				Stage.SOLID:
					if boss:
						_temple_tile(ci, x, y, top, c, r)
					elif sewer:
						_sewer_tile(ci, x, y, top, c, r)
					else:
						_city_tile(ci, x, y, top, c, r)
				Stage.CRATE:
					ci.draw_rect(Rect2(x, y, TILE, TILE), Color("#8a5a2c"))
					ci.draw_rect(Rect2(x + 1, y + 1, TILE - 2, TILE - 2), Color("#a8743c"))
					ci.draw_line(Vector2(x + 2, y + 2), Vector2(x + TILE - 2, y + TILE - 2), Color("#6a4420"), 1.5)
					ci.draw_line(Vector2(x + TILE - 2, y + 2), Vector2(x + 2, y + TILE - 2), Color("#6a4420"), 1.5)
					ci.draw_rect(Rect2(x, y, TILE, TILE), Color("#4a2c14"), false, 1.0)
				Stage.ONEWAY:
					ci.draw_rect(Rect2(x, y, TILE, 3.5), Color("#c88a20") if not sewer else Color("#6a6a58"))
					ci.draw_rect(Rect2(x, y, TILE, 1), Color("#f0c050") if not sewer else Color("#8a8a78"))
					ci.draw_line(Vector2(x + 2, y + 3.5), Vector2(x + 8, y + 10), Color("#5a5a60"), 1.0)
					ci.draw_line(Vector2(x + 14, y + 3.5), Vector2(x + 8, y + 10), Color("#5a5a60"), 1.0)
					if c % 2 == 0:
						ci.draw_rect(Rect2(x + 7.4, y + 3.5, 1.2, 12.5), Color("#4a4a52"))
				Stage.SLUDGE:
					var wob := sin(g.time * 3 + c) * 0.8
					if sewer:
						ci.draw_rect(Rect2(x, y + 4 + wob, TILE, TILE - 4 - wob), Color("#3c9a30"))
						ci.draw_rect(Rect2(x, y + 4 + wob, TILE, 1.5), Color("#8af060"))
						if h01(c * 3 + int(g.time * 2)) < 0.15:
							ci.draw_circle(Vector2(x + 8, y + 7), 1.5, Color("#a8f880"))
					else:
						ci.draw_rect(Rect2(x, y + 5 + wob * 0.5, TILE, TILE - 5), Color("#8c8c90"))
						ci.draw_rect(Rect2(x, y + 5 + wob * 0.5, TILE, 1.2), Color("#b8b8bc"))


func _city_tile(ci: CanvasItem, x: float, y: float, top: bool, c: int, r: int) -> void:
	if top:
		ci.draw_rect(Rect2(x, y, TILE, TILE), Color("#5a3a24"))
		ci.draw_rect(Rect2(x, y, TILE, 5), Color("#b0b0b8"))
		ci.draw_rect(Rect2(x, y, TILE, 1), Color("#d8d8e0"))
		ci.draw_rect(Rect2(x, y + 5, TILE, 1.5), Color("#707078"))
		if c % 2 == 0:
			ci.draw_rect(Rect2(x, y + 1, 0.6, 4), Color("#8a8a92"))
	else:
		ci.draw_rect(Rect2(x, y, TILE, TILE), Color("#4a2e1c") if (c + r) % 2 else Color("#52341f"))
		if h01(c * 31 + r) < 0.4:
			ci.draw_rect(Rect2(x + 3 + 8 * h01(c + r), y + 4 + 6 * h01(c * r + 1), 1.5, 1.2), Color("#6a4a30"))


func _sewer_tile(ci: CanvasItem, x: float, y: float, top: bool, c: int, r: int) -> void:
	var floor_side := r > Stage.LANE_ROWS + 3
	var base_col := Color("#28322c") if (c + r) % 2 else Color("#2e3a32")
	ci.draw_rect(Rect2(x, y, TILE, TILE), base_col)
	ci.draw_rect(Rect2(x, y + 7.5, TILE, 1), Color("#1a221c"))
	ci.draw_rect(Rect2(x + (0.0 if r % 2 else 7.5), y, 1, 7.5), Color("#1a221c"))
	ci.draw_rect(Rect2(x + (7.5 if r % 2 else 0.0), y + 8.5, 1, 7.5), Color("#1a221c"))
	if top and floor_side:
		ci.draw_rect(Rect2(x, y, TILE, 3), Color("#4a5a4c"))
		ci.draw_rect(Rect2(x, y, TILE, 1), Color("#6a8a5c"))
		if h01(c * 7) < 0.5:
			ci.draw_rect(Rect2(x + 3, y + 3, 4, 1.5), Color(0.35, 0.6, 0.25, 0.8))
	elif not floor_side and not Stage.is_solid(Stage.tile_at(g.area, c, r + 1)):
		# The ceiling's underside, dripping.
		ci.draw_rect(Rect2(x, y + TILE - 2, TILE, 2), Color("#141a16"))
		if h01(c * 11) < 0.3:
			var drip := fposmod(g.time * 0.7 + h01(c), 1.0)
			ci.draw_rect(Rect2(x + 8, y + TILE + drip * 40, 0.8, 1.8), Color(0.5, 0.8, 0.4, 0.7 * (1 - drip)))


func _temple_tile(ci: CanvasItem, x: float, y: float, top: bool, c: int, r: int) -> void:
	ci.draw_rect(Rect2(x, y, TILE, TILE), Color("#2a1612") if (c + r) % 2 else Color("#321a14"))
	ci.draw_rect(Rect2(x, y, TILE, TILE), Color("#160a08"), false, 0.8)
	if top:
		ci.draw_rect(Rect2(x, y, TILE, 2.5), Color("#6a3020"))


func _pickups(ci: CanvasItem, hidden_layer: bool) -> void:
	for k in g.pickups:
		if k.taken or bool(k.hidden) != hidden_layer:
			continue
		if not hidden_layer and k.hidden:
			continue
		var bob := sin(g.time * 4 + k.x) * 1.2
		var c := Vector2(k.x, k.y - 7 + bob)
		match k.kind:
			"+":
				_heart(ci, c, 5.0, Color("#e83040"))
			"H":
				_hard_hat(ci, c, 6.0)
			_:
				var cols := {M = Color("#2860d8"), N = Color("#d83020"), T = Color("#e87818"), S = Color("#c02060"), C = Color("#20a8b8"), P = Color("#7050f0")}
				var col: Color = cols.get(k.kind, Color.GRAY)
				ci.draw_circle(c, 6.2, Color(col, 0.25))
				ci.draw_rect(Rect2(c.x - 6, c.y - 4, 12, 8), Color("#101018"))
				ci.draw_rect(Rect2(c.x - 5.2, c.y - 3.2, 10.4, 6.4), col)
				ci.draw_rect(Rect2(c.x - 5.2, c.y - 3.2, 10.4, 2), col.lightened(0.3))
				_text_center(ci, k.kind, c + Vector2(0, 0.2), 6.5, Color.WHITE)


func _text_center(ci: CanvasItem, s: String, at: Vector2, h: float, col: Color) -> void:
	var size := 64
	var k := h / size
	var w := font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	ci.draw_set_transform(at, 0.0, Vector2(k, k))
	ci.draw_string_outline(font, Vector2(-w / 2, size * 0.36), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 10, Color(0, 0, 0, 0.8))
	ci.draw_string(font, Vector2(-w / 2, size * 0.36), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


static func _heart(ci: CanvasItem, c: Vector2, r: float, col: Color) -> void:
	ci.draw_circle(c + Vector2(-r * 0.45, -r * 0.2), r * 0.55, col)
	ci.draw_circle(c + Vector2(r * 0.45, -r * 0.2), r * 0.55, col)
	ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-r, 0), c + Vector2(r, 0), c + Vector2(0, r * 0.95)]), col)
	ci.draw_circle(c + Vector2(-r * 0.5, -r * 0.35), r * 0.18, Color(1, 1, 1, 0.6))


static func _hard_hat(ci: CanvasItem, c: Vector2, r: float) -> void:
	var pts := PackedVector2Array()
	for i in 13:
		var a := PI + PI * i / 12.0
		pts.append(c + Vector2(cos(a) * r * 0.75, sin(a) * r * 0.7 + r * 0.2))
	ci.draw_colored_polygon(pts, Color("#f8c800"))
	ci.draw_rect(Rect2(c.x - r, c.y + r * 0.15, r * 2, r * 0.25), Color("#d8a800"))
	ci.draw_rect(Rect2(c.x - r * 0.08, c.y - r * 0.5, r * 0.16, r * 0.6), Color("#d8a800"))


# ---------- Characters ----------

const CIV := ["civ1", "civ2", "civ3", "civ4", "civ5", "civ6"]
const KIDS := ["kid1", "kid2", "kid3", "kid4"]


func _cycle(frames: Array, t: float, fps := 8.0):
	return frames[int(t * fps) % frames.size()]


func _flash(a: Dictionary) -> Color:
	return Color(2.2, 2.2, 2.2) if a.flash > 0 else Color.WHITE


func _draw_actor(ci: CanvasItem, a: Dictionary, lizard_view: bool) -> void:
	var foot := Vector2(a.x, a.y)
	var moving: bool = absf(a.vx) > 1
	var face: int = a.face
	var t: float = a.anim
	match a.type:
		"civilian", "grunt", "gunner":
			if a.type == "civilian" or (a.disguised):
				var who: String = CIV[int(a.look) % CIV.size()]
				var liz: bool = lizard_view or (a.type != "civilian" and a.revealed)
				var pose := "idle"
				if a.flash > 0:
					pose = "hit"
				elif a.get("panic", false):
					pose = _cycle(["flee1", "flee2", "flee3"], t, 10)
				elif a.type != "civilian" and a.revealed:
					if a.get("shot_t", 0.0) > 0 or absf(a.x - g.player.x) < 22:
						pose = "attack"
					elif moving:
						pose = _cycle(["flee1", "flee2", "flee3"], t, 10)
				elif a.get("glance", 0.0) > 0:
					pose = "stare"
				elif moving:
					pose = _cycle(["walk1", "walk2", "walk3"], t, 6)
				# Disguised lizards' masks slip now and then, when they stare.
				if not liz and a.type != "civilian" and a.get("glance", 0.0) > 0 and fmod(t, 0.5) < 0.12:
					liz = true
				Art.draw(ci, who + ("liz" if liz else ""), pose, foot, face, _flash(a))
				if a.get("carrier", false) and lizard_view:
					var pulse := 0.5 + 0.5 * sin(g.time * 6)
					var top: float = a.y - 26
					for s in [-1, 1]:
						ci.draw_rect(Rect2(a.x + s * 8 - (2 if s > 0 else 0), top, 2, 6), Color(0.6, 0.4, 1, 0.6 + 0.4 * pulse))
						ci.draw_rect(Rect2(a.x + s * 8 - (2 if s > 0 else 0), a.y - 6, 2, 6), Color(0.6, 0.4, 1, 0.6 + 0.4 * pulse))
					ci.draw_circle(Vector2(a.x + face * 5, a.y - 11), 2.5 + pulse, Color(0.6, 0.4, 1, 0.5))
			elif a.type == "grunt":
				var pose := "idle"
				if a.flash > 0:
					pose = "hit"
				elif t < 0.35 and a.get("charging", false):
					pose = "emerge"
				elif absf(a.x - g.player.x) < 20 and absf(a.y - g.player.y) < 20:
					pose = "attack"
				elif moving:
					pose = _cycle(["run1", "run2", "run3", "run4"], t, 10) if absf(a.vx) > 30 else _cycle(["walk1", "walk2", "walk3"], t, 7)
				Art.draw(ci, "grunt", pose, foot, face, _flash(a))
			else:
				var pose := "aim"
				if a.flash > 0:
					pose = "hit"
				elif a.get("shot_t", 0.0) > 0:
					pose = "shoot"
				elif g.player.y < a.y - 24:
					pose = "aimup"
				elif moving:
					pose = _cycle(["walk1", "walk2", "walk3", "walk4"], t, 7)
				Art.draw(ci, "gunner", pose, foot, face, _flash(a))
		"snatcher":
			var pose := "idle"
			match a.state:
				"emerge":
					pose = "emerge"
				"approach":
					pose = _cycle(["run1", "run2", "run3", "run4"], t, 10)
				"grab":
					pose = "warp" if a.timer < 0.25 else "grab"
				_:
					pose = _cycle(["carry1", "carry2", "carry3", "carry4"], t, 10) if a.child != null else _cycle(["run1", "run2", "run3", "run4"], t, 10)
			if a.flash > 0:
				pose = "hit"
			# The child under its arm, drawn behind.
			if a.child != null:
				var kid: Dictionary = a.child
				Art.draw(ci, KIDS[int(kid.look) % 4], "carried", Vector2(a.x + face * 4, a.y - 6), face, Color.WHITE)
			Art.draw(ci, "snatcher", pose, foot, face, _flash(a))
		"child":
			var who: String = KIDS[int(a.look) % 4]
			var pose := "idle"
			var hunted := false
			for s in g.actors:
				if s.type == "snatcher" and s.target == a and s.state == "approach":
					hunted = true
			if hunted:
				pose = "scared"
			elif a.panic:
				pose = _cycle(["run1", "run2", "run3"], t, 10)
			elif moving:
				pose = _cycle(["walk1", "walk2", "walk3", "walk4"], t, 7)
			else:
				# Playing: bouncing a ball or hopscotch, by who they are.
				pose = _cycle(["ball", "idle"] if int(a.look) % 2 == 0 else ["hop", "idle"], t, 2.5)
			Art.draw(ci, who, pose, foot, face, _flash(a))
		"cultist":
			var who: String = "priest" if a.role == "priest" else "zealot"
			var pose := "idle"
			if a.flash > 0:
				pose = "hit"
			elif a.chanting:
				pose = _cycle(["chant1", "chant2"], t, 1.6)
			elif a.get("shot_t", 0.0) > 0 or (who == "zealot" and absf(a.x - g.player.x) < 22):
				pose = "attack"
			elif moving:
				pose = _cycle(["run1", "run2", "run3", "run4"], t, 10) if who == "zealot" else _cycle(["walk1", "walk2", "walk3", "walk4"], t, 7)
			Art.draw(ci, who, pose, foot, face, _flash(a))


func _draw_boss(ci: CanvasItem, b: Dictionary) -> void:
	var pose := "idle"
	var enraged: bool = b.hp < b.max_hp * 0.5
	match b.state:
		"dormant":
			pose = "dormant"
		"waking":
			pose = "waking"
		_:
			if b.dead:
				pose = "crumble"
			elif b.flash > 0:
				pose = "hurt"
			else:
				match b.pattern:
					"fireballs":
						pose = "spit"
					"flame":
						pose = "breath"
					"stomp":
						pose = "leapcrouch" if b.count == 0 else ("leapair" if not b.on_ground else "slam")
					"summon":
						pose = "summon"
					_:
						if absf(b.vx) > 1 and b.on_ground:
							pose = _cycle(["walk1", "walk2", "walk3", "walk4"], b.anim, 5)
						else:
							pose = "rage" if enraged else "idle"
	var foot := Vector2(b.x, b.y)
	if b.state == "dormant" or b.state == "waking":
		foot.y = Game.FLOOR_Y - Game.PEDESTAL_H
	Art.draw(ci, "moloch", pose, foot, b.face, Color(1.6, 1.6, 1.6) if b.flash > 0 else Color.WHITE)


func _draw_player(ci: CanvasItem) -> void:
	var p := g.player
	if p.is_empty():
		return
	# Blink while invincible.
	if p.inv > 0 and g.mode == "play" and fmod(g.time, 0.16) < 0.06:
		return
	var who := "heroshades" if g.glasses.on else "hero"
	var pose := "idle"
	var ay: float = p.aim.y
	var ax: float = absf(p.aim.x)
	var foot := Vector2(p.x, p.y)
	if g.mode == "dying" or g.mode == "gameover":
		pose = "down"
	elif g.mode == "clear":
		pose = "victory"
	elif p.hurt_t > 0:
		pose = "hit"
	elif p.tackle > 0:
		pose = "tackle"
	elif not p.on_ground:
		pose = "jump" if p.vy < -150 else ("ball" if p.vy < 120 else "fall")
	elif p.land_t > 0:
		pose = "land"
	elif p.crouch:
		pose = "crouch"
	elif p.shades_t > 0:
		pose = "shades"
	elif p.portal_t > 0:
		pose = "portal"
	elif absf(p.vx) > 1:
		if ay < -0.1:
			pose = _cycle(["runup1", "runup2", "runup3"], p.anim, 9)
		elif ay > 0.1:
			pose = _cycle(["rundown1", "rundown2", "rundown3"], p.anim, 9)
		else:
			pose = _cycle(["run1", "run2", "run3", "run4", "run5", "run6"], p.anim, 12)
	elif ay < -0.1:
		pose = "aimup" if ax < 0.1 else "aimupfwd"
	elif ay > 0.1:
		pose = "aimdownfwd"
	Art.draw(ci, who, pose, foot, p.face)
	if g.armor:
		var head := foot + Vector2(p.face * 1.5, -Art.height_of(who, pose) + 1.5)
		_hard_hat(ci, head, 4.2)


func _draw_bullets(ci: CanvasItem) -> void:
	for b in g.bullets:
		var at := Vector2(b.x, b.y)
		match b.kind:
			"pellet":
				ci.draw_circle(at, 1.3, Color("#f8d800"))
				ci.draw_circle(at, 0.7, Color("#fffbe0"))
			"bullet":
				ci.draw_circle(at, 1.2, Color("#ffe080"))
			"nail":
				var d := Vector2(b.vx, b.vy).normalized() * 3
				ci.draw_line(at - d, at, Color("#d8d8e0"), 1.0)
			"flame":
				var life: float = b.life
				ci.draw_circle(at, 2.5 + (0.32 - life) * 8, Color(1, 0.5 + life, 0.1, 0.55))
			_:
				ci.draw_circle(at, 1.9, Color("#ff7090"))
				ci.draw_circle(at, 1.0, Color.WHITE)


func _draw_shots(ci: CanvasItem) -> void:
	for s in g.shots:
		var at := Vector2(s.x, s.y)
		if s.fire:
			var r: float = s.r
			ci.draw_circle(at, r + 1.5, Color(1, 0.4, 0.05, 0.4))
			ci.draw_circle(at, r, Color("#f87800"))
			ci.draw_circle(at, r * 0.55, Color("#f8e060"))
		else:
			ci.draw_circle(at, 3.2, Color(0.7, 0.3, 1, 0.35))
			ci.draw_circle(at, 2.0, Color("#c070ff"))
			ci.draw_circle(at, 1.0, Color.WHITE)


func draw_glow(ci: CanvasItem) -> void:
	var soft := _soft()
	var lit := func(at: Vector2, r: float, col: Color):
		ci.draw_texture_rect(soft, Rect2(at - Vector2(r, r), Vector2(r, r) * 2), false, col)
	if g.area.kind == "street" and g.cam.y >= Stage.LANE_ROWS * TILE:
		for lx in lamp_xs():
			lit.call(Vector2(lx, Stage.LANE_ROWS * TILE + 36), 40.0, Color(0.45, 0.4, 0.2, 0.5))
		for k in g.area.cols:
			pass
	elif g.area.kind == "boss":
		for cx in [40.0, 112.0, 208.0, 280.0]:
			lit.call(Vector2(cx, Game.FLOOR_Y - 56), 36.0 + 3 * sin(g.time * 7 + cx), Color(0.6, 0.25, 0.05, 0.5))
	for s in g.shots:
		lit.call(Vector2(s.x, s.y), 10.0, Color(0.6, 0.3, 0.05, 0.5) if s.fire else Color(0.4, 0.15, 0.6, 0.5))
	for b in g.bullets:
		if b.kind == "flame":
			lit.call(Vector2(b.x, b.y), 10.0, Color(0.6, 0.3, 0.05, 0.4))
	var p := g.player
	if not p.is_empty() and p.firing > 0:
		lit.call(g.muzzle(), 9.0, Color(0.9, 0.7, 0.3, 0.7))


func draw_fx(ci: CanvasItem) -> void:
	for f in g.portal_fx:
		var k: float = f.t / 0.5
		ci.draw_arc(Vector2(f.x, f.y), 4 + k * 16, 0, TAU, 24, Color(0.6, 0.45, 1, 1 - k), 2.0)
		ci.draw_arc(Vector2(f.x, f.y), 2 + k * 9, 0, TAU, 18, Color(0.85, 0.75, 1, 1 - k), 1.2)
	for q in g.particles:
		var s: float = q.size
		ci.draw_rect(Rect2(q.x - s / 2, q.y - s / 2, s, s), Color(q.color, clampf(q.life * 3, 0, 1)))


static var _soft_tex: Texture2D


static func _soft() -> Texture2D:
	if _soft_tex == null:
		var gr := Gradient.new()
		gr.set_color(0, Color(1, 1, 1, 1))
		gr.set_color(1, Color(1, 1, 1, 0))
		var t := GradientTexture2D.new()
		t.gradient = gr
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(1.0, 0.5)
		t.width = 64
		t.height = 64
		_soft_tex = t
	return _soft_tex
