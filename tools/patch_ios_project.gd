## Links the Google Mobile Ads Swift packages into an exported iOS Xcode
## project. The AdMob plugin does this itself in the editor, but only after
## the export finishes, which a command-line export never reaches.
##   godot --headless --path . -s res://tools/patch_ios_project.gd -- build/ios/TheyLive.xcodeproj
extends SceneTree

const PbxprojService := preload("res://addons/admob/internal/services/pbxproj_service.gd")


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() != 1:
		printerr("usage: ... -s res://tools/patch_ios_project.gd -- path/to/Name.xcodeproj")
		quit(1)
		return
	var pbx := args[0].path_join("project.pbxproj")
	if not FileAccess.file_exists(pbx):
		printerr("not found: ", pbx)
		quit(1)
		return
	PbxprojService.patch(ProjectSettings.globalize_path(pbx) if pbx.begins_with("res://") else pbx)
	var text := FileAccess.get_file_as_string(pbx)
	if not "PoingGodotAdMobDeps" in text:
		printerr("the Xcode project wasn't patched")
		quit(1)
		return
	print("Linked the AdMob Swift packages into ", pbx)
	quit()
