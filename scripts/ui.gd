## The look of the menus: a theme with the Russo One font, rounded panels and
## chunky buttons, plus small helpers for building screens in code.
class_name UI

const NAVY := Color("#14101c")
const GOLD := Color("#f8d800")
const RED := Color("#b81e1e")
const GREEN := Color("#2f9a4a")
const PALE := Color("#d8cce8")

static var _theme: Theme
static var font: Font


static func theme() -> Theme:
	if _theme:
		return _theme
	font = load("res://assets/fonts/russo-one.woff2")
	var t := Theme.new()
	t.default_font = font
	t.default_font_size = 30
	t.set_stylebox("panel", "PanelContainer", panel_box())
	t.set_stylebox("panel", "Panel", panel_box())
	for state in ["normal", "hover", "pressed", "disabled", "focus"]:
		t.set_stylebox(state, "Button", button_box(Color("#3a2c48"), Color(1, 1, 1, 0.3), state))
	t.set_color("font_color", "Button", Color.WHITE)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", Color(1, 1, 1, 0.35))
	t.set_color("font_focus_color", "Button", Color.WHITE)
	t.set_color("font_color", "Label", Color.WHITE)
	t.set_constant("separation", "VBoxContainer", 14)
	t.set_constant("separation", "HBoxContainer", 14)
	# Sliders.
	var track := StyleBoxFlat.new()
	track.bg_color = Color(1, 1, 1, 0.18)
	track.set_corner_radius_all(6)
	track.content_margin_top = 6
	track.content_margin_bottom = 6
	var fill := track.duplicate()
	fill.bg_color = Color("#e04020")
	t.set_stylebox("slider", "HSlider", track)
	t.set_stylebox("grabber_area", "HSlider", fill)
	t.set_stylebox("grabber_area_highlight", "HSlider", fill)
	var grab := _circle_texture(34, Color.WHITE)
	t.set_icon("grabber", "HSlider", grab)
	t.set_icon("grabber_highlight", "HSlider", grab)
	# Scrollbars.
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.25)
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 6
	sb.content_margin_right = 6
	t.set_stylebox("grabber", "VScrollBar", sb)
	t.set_stylebox("grabber_highlight", "VScrollBar", sb)
	t.set_stylebox("grabber_pressed", "VScrollBar", sb)
	t.set_stylebox("scroll", "VScrollBar", StyleBoxEmpty.new())
	_theme = t
	return t


static func _circle_texture(size: int, col: Color) -> Texture2D:
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var c := (size - 1) / 2.0
	for y in size:
		for x in size:
			var d := Vector2(x - c, y - c).length()
			var a := clampf(c - d + 0.5, 0.0, 1.0)
			var shade := col.darkened(0.25) if d > c - 3 else col
			img.set_pixel(x, y, Color(shade, a))
	return ImageTexture.create_from_image(img)


static func panel_box(bg := Color(0.08, 0.05, 0.1, 0.94)) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = bg
	b.set_corner_radius_all(40)
	b.set_border_width_all(4)
	b.border_color = Color(1, 1, 1, 0.18)
	b.shadow_color = Color(0, 0, 0, 0.45)
	b.shadow_size = 30
	b.shadow_offset = Vector2(0, 12)
	b.set_content_margin_all(36)
	return b


static func button_box(bg: Color, border: Color, state := "normal") -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = bg
	match state:
		"hover":
			b.bg_color = bg.lightened(0.12)
		"pressed":
			b.bg_color = bg.darkened(0.2)
		"disabled":
			b.bg_color = Color(bg, 0.4)
		"focus":
			b.draw_center = false
	b.set_corner_radius_all(24)
	b.set_border_width_all(3)
	b.border_color = border
	# A darker lip under the button, for a chunky look.
	b.border_width_bottom = 8
	if state != "focus":
		b.border_color = border
	b.content_margin_left = 30
	b.content_margin_right = 30
	b.content_margin_top = 16
	b.content_margin_bottom = 18
	return b


static func style_button(btn: Button, bg: Color, border: Color) -> void:
	for state in ["normal", "hover", "pressed", "disabled"]:
		btn.add_theme_stylebox_override(state, button_box(bg, border, state))


static func button(text: String, cb: Callable, kind := "") -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func():
		Sfx.play("tick")
		cb.call())
	match kind:
		"big":
			style_button(b, RED, GOLD)
			b.add_theme_font_size_override("font_size", 38)
			b.add_theme_color_override("font_color", Color("#fff6d0"))
		"buy":
			style_button(b, GREEN, Color(1, 1, 1, 0.35))
	return b


static func label(text: String, size := 30, color := Color.WHITE, align := HORIZONTAL_ALIGNMENT_CENTER) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


static func title(text: String, size := 76, color := Color.WHITE) -> Label:
	var l := label(text, size, color)
	l.add_theme_color_override("font_shadow_color", Color("#8a1010"))
	l.add_theme_constant_override("shadow_offset_x", 0)
	l.add_theme_constant_override("shadow_offset_y", 7)
	l.add_theme_constant_override("outline_size", 0)
	return l


## A dimmed full-screen overlay with a centred panel; returns the panel's VBox.
static func screen(parent: Control, width := 900.0) -> VBoxContainer:
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.01, 0.04, 0.6)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	parent.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	parent.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = width
	center.add_child(panel)
	var box := VBoxContainer.new()
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	panel.add_child(box)
	return box
