## The characters' sprites: one image per pose, cut from the sheets in
## art-source/ by tools/cut_sprites.py, all facing right. Each character is
## drawn so its idle pose stands a set height in world pixels.
class_name Art

## How tall each character's idle pose stands, in world pixels (a tile is 16).
const HEIGHT := {
	hero = 24.0, heroshades = 24.0, grunt = 23.0, gunner = 23.0, snatcher = 23.0,
	zealot = 22.0, priest = 22.0, moloch = 74.0,
}
const PERSON_HEIGHT := 22.5
const KID_HEIGHT := 15.0

static var _meta := {}
static var _textures := {}
static var _scale := {}


static func meta() -> Dictionary:
	if _meta.is_empty():
		_meta = JSON.parse_string(FileAccess.get_file_as_string("res://assets/sprites/meta.json"))
	return _meta


static func has_pose(char_id: String, pose: String) -> bool:
	return meta().has(char_id) and meta()[char_id].has(pose)


static func pose_meta(char_id: String, pose: String) -> Dictionary:
	return meta()[char_id][pose]


static func texture(char_id: String, pose: String) -> Texture2D:
	var key := char_id + "/" + pose
	if not _textures.has(key):
		_textures[key] = load("res://assets/sprites/%s.png" % key)
	return _textures[key]


## World pixels per image pixel for a character.
static func scale_of(char_id: String) -> float:
	if not _scale.has(char_id):
		var m := pose_meta(char_id, "idle") if has_pose(char_id, "idle") else pose_meta(char_id, "dormant")
		var h: float = HEIGHT.get(char_id, KID_HEIGHT if char_id.begins_with("kid") else PERSON_HEIGHT)
		# Lizard civilians share their person's scale, so the swap lines up.
		if char_id.ends_with("liz"):
			return scale_of(char_id.trim_suffix("liz"))
		_scale[char_id] = h / float(m.foot[1] - m.top)
	return _scale[char_id]


## Draws a pose with its feet at `foot` (world pixels), facing `face` (+1 right).
static func draw(ci: CanvasItem, char_id: String, pose: String, foot: Vector2, face: int, modulate := Color.WHITE, extra_scale := 1.0) -> void:
	if not has_pose(char_id, pose):
		pose = "idle" if has_pose(char_id, "idle") else meta()[char_id].keys()[0]
	var m := pose_meta(char_id, pose)
	var s := scale_of(char_id) * extra_scale
	var tex := texture(char_id, pose)
	var off := Vector2(-float(m.foot[0]), -float(m.foot[1])) * s
	var size := Vector2(tex.get_width(), tex.get_height()) * s
	if face < 0:
		ci.draw_set_transform(foot, 0.0, Vector2(-1, 1))
		ci.draw_texture_rect(tex, Rect2(off, size), false, modulate)
		ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	else:
		ci.draw_texture_rect(tex, Rect2(foot + off, size), false, modulate)


## How tall a pose stands above its feet, in world pixels.
static func height_of(char_id: String, pose: String) -> float:
	if not has_pose(char_id, pose):
		pose = "idle"
	var m := pose_meta(char_id, pose)
	return (float(m.foot[1]) - float(m.top)) * scale_of(char_id)
