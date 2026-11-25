## Rewrites default_settings.cfg from the current defaults (the file's own
## values, plus `def` in scripts/tune.gd for settings not in it yet), with a
## comment on every setting. Run after adding a setting:
##   godot --headless --path . -s res://tools/write_default_settings.gd
extends SceneTree


func _init() -> void:
	var unknown := Tune.load_defaults_file()
	if unknown.size():
		print("Dropping unknown or invalid entries: ", ", ".join(unknown))
	Tune.reset()
	var f := FileAccess.open(Tune.DEFAULTS_PATH, FileAccess.WRITE)
	f.store_string(Tune.defaults_text())
	f.close()
	print("Wrote ", ProjectSettings.globalize_path(Tune.DEFAULTS_PATH))
	quit()
