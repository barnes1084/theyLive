## The settings screen: one tab per group, a slider, switch or choice for
## every value. Changes apply at once and are saved; changed values turn gold
## and get a ↺ button to put them back.
class_name SettingsUI
extends Control

signal changed
signal closed

var _rows := []  # {t, update}
var _pages := []
var _tabs := []
var _scroll: ScrollContainer
var _col: VBoxContainer
var _built_dev := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = UI.theme()
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.07, 0.18, 0.97)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 36)
	add_child(margin)
	var col := VBoxContainer.new()
	margin.add_child(col)
	_col = col
	_build()


## Builds the screen for the current mode: just the player settings on one
## page, or (in developer mode) every setting, one tab per group.
func _build() -> void:
	for c in _col.get_children():
		c.queue_free()
	_rows.clear()
	_pages.clear()
	_tabs.clear()
	_built_dev = Tune.dev
	var col := _col
	var head := HBoxContainer.new()
	var h := UI.title("DEVELOPER SETTINGS" if Tune.dev else "SETTINGS", 54)
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	h.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(h)
	if Tune.dev:
		var copy := UI.button("COPY AS DEFAULTS", func(): pass)
		copy.pressed.connect(func():
			DisplayServer.clipboard_set(Tune.defaults_text())
			copy.text = "COPIED!"
			get_tree().create_timer(2.5).timeout.connect(func():
				if is_instance_valid(copy):
					copy.text = "COPY AS DEFAULTS"))
		head.add_child(copy)
	if Tune.dev and Tune.can_toggle_dev():
		head.add_child(UI.button("LEAVE DEVELOPER MODE", func():
			Tune.set_dev(false)
			changed.emit()
			_build()
			_fit_columns()))
	if Ads.privacy_options_required:
		head.add_child(UI.button("PRIVACY CHOICES", Ads.show_privacy_options))
	head.add_child(UI.button("RESET ALL", _reset_all))
	head.add_child(UI.button("DONE", close, "big"))
	col.add_child(head)
	var tabs := HBoxContainer.new()
	if Tune.dev:
		var tabs_scroll := ScrollContainer.new()
		tabs_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		tabs_scroll.custom_minimum_size.y = 96
		tabs_scroll.add_child(tabs)
		col.add_child(tabs_scroll)
	_scroll = ScrollContainer.new()
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(_scroll)
	var pages := MarginContainer.new()
	pages.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pages.add_theme_constant_override("margin_right", 20)
	_scroll.add_child(pages)
	var items := Tune.visible_items()
	if not Tune.dev:
		items = [{group = "SETTINGS"}] + items
	for t in items:
		if t.has("group"):
			var idx := _pages.size()
			if Tune.dev:
				var tab := UI.button(t.group, func(): show_page(idx))
				tab.add_theme_font_size_override("font_size", 24)
				tabs.add_child(tab)
				_tabs.append(tab)
			var grid := GridContainer.new()
			grid.columns = 3
			grid.add_theme_constant_override("h_separation", 16)
			grid.add_theme_constant_override("v_separation", 16)
			grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			pages.add_child(grid)
			_pages.append(grid)
		else:
			_pages[-1].add_child(_row(t))
	if not resized.is_connected(_fit_columns):
		resized.connect(_fit_columns)
	show_page(0)


func _fit_columns() -> void:
	var n := clampi(int(size.x / 560), 1, 4)
	for g in _pages:
		g.columns = n


func show_page(i: int) -> void:
	for j in _pages.size():
		_pages[j].visible = j == i
		if j >= _tabs.size():
			continue
		UI.style_button(_tabs[j], UI.RED if j == i else Color("#2c4a8a"), UI.GOLD if j == i else Color(1, 1, 1, 0.3))
	_scroll.scroll_vertical = 0


func open() -> void:
	if _built_dev != Tune.dev:
		_build()
	for r in _rows:
		r.update.call()
	_fit_columns()
	visible = true


func close() -> void:
	visible = false
	closed.emit()


func _save() -> void:
	Tune.save()
	changed.emit()


func _format(t: Dictionary, value: float) -> String:
	if t.get("auto", false) and value == 0:
		return "AUTO"
	if t.get("pct", false):
		var p := value * 100.0
		if is_equal_approx(p, roundf(p)):
			return "%d%%" % roundi(p)
		return "%.1f%%" % p
	var step := str(t.step)
	var dec := step.length() - step.find(".") - 1 if "." in step else 0
	var n := ("%." + str(dec) + "f") % value
	var unit: String = t.get("unit", "")
	if unit == "×":
		return n + "×"
	return n + (" " + unit if unit != "" else "")


func _row(t: Dictionary) -> Control:
	var panel := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color(1, 1, 1, 0.06)
	box.set_corner_radius_all(22)
	box.set_border_width_all(2)
	box.border_color = Color(1, 1, 1, 0.08)
	box.set_content_margin_all(20)
	panel.add_theme_stylebox_override("panel", box)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	panel.add_child(v)
	var top := HBoxContainer.new()
	v.add_child(top)
	var names := VBoxContainer.new()
	names.add_theme_constant_override("separation", 2)
	names.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var name := UI.label(t.label, 24, Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT)
	names.add_child(name)
	if t.has("note"):
		names.add_child(UI.label(t.note, 17, Color("#9ab4e0"), HORIZONTAL_ALIGNMENT_LEFT))
	top.add_child(names)
	var value := UI.label("", 26, Color.WHITE, HORIZONTAL_ALIGNMENT_RIGHT)
	value.autowrap_mode = TextServer.AUTOWRAP_OFF
	top.add_child(value)
	var reset := UI.button("↺", func(): pass)
	reset.add_theme_font_size_override("font_size", 26)
	top.add_child(reset)

	# Lambdas copy locals when created, so they share `ref` to reach `ref.update`.
	var ref := {}
	var kind: String = t.get("type", "")
	if kind == "bool":
		var b := UI.button("", func(): pass)
		b.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		b.custom_minimum_size.x = 140
		b.pressed.connect(func():
			Tune.v[t.key] = not Tune.v[t.key]
			ref.update.call()
			_save())
		v.add_child(b)
		ref.update = func():
			b.text = "ON" if Tune.v[t.key] else "OFF"
			UI.style_button(b, UI.RED if Tune.v[t.key] else Color("#2c4a8a"), UI.GOLD if Tune.v[t.key] else Color(1, 1, 1, 0.3))
			value.text = ""
	elif kind == "choice":
		var flow := HFlowContainer.new()
		v.add_child(flow)
		var buttons := {}
		for opt in t.options:
			var b := UI.button(t.options[opt], func():
				Tune.v[t.key] = opt
				ref.update.call()
				_save())
			b.add_theme_font_size_override("font_size", 22)
			flow.add_child(b)
			buttons[opt] = b
		ref.update = func():
			for opt in buttons:
				var on: bool = Tune.v[t.key] == opt
				UI.style_button(buttons[opt], UI.RED if on else Color("#2c4a8a"), UI.GOLD if on else Color(1, 1, 1, 0.3))
			value.text = ""
	else:
		var s := HSlider.new()
		s.min_value = t.min
		s.max_value = t.max
		s.step = t.step
		s.custom_minimum_size.y = 44
		s.focus_mode = Control.FOCUS_NONE
		s.value_changed.connect(func(x):
			if is_equal_approx(float(Tune.v[t.key]), x):
				return
			Tune.v[t.key] = x
			ref.update.call()
			_save())
		v.add_child(s)
		ref.update = func():
			s.set_value_no_signal(Tune.v[t.key])
			value.text = _format(t, Tune.v[t.key])
	var base: Callable = ref.update
	ref.update = func():
		base.call()
		var dflt := Tune.is_default(t)
		reset.modulate.a = 0.0 if dflt else 1.0
		reset.disabled = dflt
		var c := Color.WHITE if dflt else Color("#f8d040")
		name.add_theme_color_override("font_color", c)
		value.add_theme_color_override("font_color", c)
	reset.pressed.connect(func():
		Tune.v[t.key] = Tune._norm(t, Tune.def_of(t))
		ref.update.call()
		_save())
	_rows.append({t = t, update = ref.update})
	ref.update.call()
	return panel


func _reset_all() -> void:
	for t in Tune.visible_items():
		if t.has("key"):
			Tune.v[t.key] = Tune._norm(t, Tune.def_of(t))
	for r in _rows:
		r.update.call()
	_save()
