## Your progress across runs: the best stage reached and the best score.
class_name Progress

const PATH := "user://save.json"

static var data := {}


static func fresh() -> Dictionary:
	return {best_stage = 0, best_score = 0, runs = 0}


static func load_data() -> void:
	data = fresh()
	if not FileAccess.file_exists(PATH):
		return
	var raw = JSON.parse_string(FileAccess.get_file_as_string(PATH))
	if typeof(raw) != TYPE_DICTIONARY:
		return
	data.best_stage = maxi(0, int(raw.get("best_stage", 0)))
	data.best_score = maxi(0, int(raw.get("best_score", 0)))
	data.runs = maxi(0, int(raw.get("runs", 0)))


static func save() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))


## Records a stage reached and a score, keeping the best of each.
static func record(stage: int, score: int) -> void:
	data.best_stage = maxi(int(data.best_stage), stage)
	data.best_score = maxi(int(data.best_score), score)
	save()
