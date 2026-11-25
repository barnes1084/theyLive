## Plays the sound effects and the music: a menacing riff on the title
## screen, a gallop in the streets, thrash in the sewers and a crushing
## half-time riff in the temple.
extends Node

## Effect name -> how many variants (name0.wav, name1.wav, ...); 0 = one file, no number.
const EFFECTS := {
	shotgun = 0, mg = 0, nail = 0, torch = 0, slug = 0, plasma = 0, jump = 0, land = 0, hit = 0, hurt = 0,
	die = 3, innocent = 0, reveal = 0, portal = 0, glasses_on = 0, glasses_off = 0, headache = 0, found = 0,
	pickup = 0, tackle = 0, explode = 0, stomp = 0, descend = 0, roar = 0, clear = 0, gameover = 0, tick = 0,
}
const TRACKS := ["title", "city", "tunnel", "boss"]

var _streams := {}
var _last := {}
var _pool: Array[AudioStreamPlayer] = []
var _next := 0
var _music: AudioStreamPlayer
var _track := ""
var _fade := 0.0


func _ready() -> void:
	Tune.ensure()
	process_mode = Node.PROCESS_MODE_ALWAYS
	for name in EFFECTS:
		var count: int = EFFECTS[name]
		var list := []
		if count == 0:
			list.append(load("res://assets/audio/%s.wav" % name))
		else:
			for i in count:
				list.append(load("res://assets/audio/%s%d.wav" % [name, i]))
		_streams[name] = list
	for t in TRACKS:
		var song: AudioStreamWAV = load("res://assets/audio/%s.wav" % t)
		song.loop_mode = AudioStreamWAV.LOOP_FORWARD
		song.loop_begin = 0
		song.loop_end = int(song.get_length() * song.mix_rate)
		_streams["music_" + t] = [song]
	for i in 16:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_pool.append(p)
	_music = AudioStreamPlayer.new()
	add_child(_music)
	music("title")
	apply()


func _db(v: float) -> float:
	return linear_to_db(maxf(0.0001, v))


## Applies the volume and music-speed settings.
func apply() -> void:
	_music.volume_db = _db(Tune.v.musicVolume * 0.75)
	_music.pitch_scale = Tune.v.musicSpeed
	_music.stream_paused = Tune.v.musicVolume <= 0


## Switches the music to a track (one of TRACKS), with a quick fade.
func music(track: String) -> void:
	if track == _track:
		return
	_track = track
	_fade = 1.0
	_music.stream = _streams["music_" + track][0]
	_music.play()
	apply()
	_music.volume_db -= 18.0


func _process(delta: float) -> void:
	if _fade > 0:
		_fade = maxf(0.0, _fade - delta * 3.0)
		_music.volume_db = _db(Tune.v.musicVolume * 0.75) - 18.0 * _fade


## Plays a random variant of an effect (never the same one twice in a row).
func play(name: String, gain := 1.0, pitch := 1.0) -> void:
	if Tune.v.sfxVolume <= 0 or not _streams.has(name):
		return
	var list: Array = _streams[name]
	var i := randi() % list.size()
	if list.size() > 1 and i == _last.get(name, -1):
		i = (i + 1) % list.size()
	_last[name] = i
	var p := _pool[_next]
	_next = (_next + 1) % _pool.size()
	p.stream = list[i]
	p.volume_db = _db(Tune.v.sfxVolume * gain)
	p.pitch_scale = pitch * randf_range(0.93, 1.07)
	p.play()
