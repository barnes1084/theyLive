## Ads, through Google AdMob (the Poing Studios AdMob plugin in addons/admob):
## a banner across the top of the screen and a full-screen ad between stages
## every few stages. On anything but an Android or iOS device (the editor,
## desktop, the tests) there are no ads and every call here does nothing.
##
## Real ads (the IDs below) are shown only in the store builds: Google Play
## (export feature "play_store") and the App Store ("app_store"). The
## sideload APK, debug builds and anything else show Google's test ads:
## clicking real ads in your own app can get your AdMob account suspended.
## The AdMob app IDs are the project settings admob/general/android/app_id
## and admob/general/ios/app_id.
extends Node

## Your ad unit IDs from AdMob (they contain a "/"), per platform. Empty
## means Google's test ads.
## They Live has no AdMob ad units yet: every build shows test ads until
## these are filled in (and the app IDs in project.godot replaced).
const BANNER_ID := ""
const INTERSTITIAL_ID := ""
const IOS_BANNER_ID := ""
const IOS_INTERSTITIAL_ID := ""

## Google's test ad units, safe to use any time.
const TEST_BANNER_ID := "ca-app-pub-3940256099942544/6300978111"
const TEST_INTERSTITIAL_ID := "ca-app-pub-3940256099942544/1033173712"
const IOS_TEST_BANNER_ID := "ca-app-pub-3940256099942544/2934735716"
const IOS_TEST_INTERSTITIAL_ID := "ca-app-pub-3940256099942544/4411468910"

## Emitted when the banner appears or goes, so the HUD can make room.
signal banner_changed

## How much room the banner takes at the top, in screen pixels.
var banner_height_px := 0.0
## True once the consent check is done and ads may be requested.
var ready_for_ads := false
## True when Google says this player must be offered a "privacy choices" button
## (players in the EU, UK and some US states).
var privacy_options_required := false

var _banner: AdView
var _sdk_ready := false
var _interstitial: InterstitialAd
var _loading_interstitial := false
var _matches_since_ad := 0
var _after_ad: Callable


func enabled() -> bool:
	return OS.get_name() in ["Android", "iOS"] and Engine.has_singleton("PoingGodotAdMob")


func is_ios() -> bool:
	return OS.get_name() == "iOS"


## A store build: real ads (unless it's a debug build).
func _store_build() -> bool:
	return (OS.has_feature("play_store") or OS.has_feature("app_store")) and not OS.is_debug_build()


func _ready() -> void:
	Tune.ensure()
	if not enabled():
		return
	# Let the game finish starting before any ad work.
	await get_tree().create_timer(1.5).timeout
	_check_consent()


# ---------- Consent (required by Google for players in the EU, UK and elsewhere) ----------

func _check_consent() -> void:
	var params := ConsentRequestParameters.new()
	# The game is for players 13 and over, so no under-age-of-consent tag.
	params.tag_for_under_age_of_consent = false
	UserMessagingPlatform.consent_information.update(params, _on_consent_info, _on_consent_error)


func _on_consent_info() -> void:
	var info := UserMessagingPlatform.consent_information
	if info.get_is_consent_form_available() and info.get_consent_status() == ConsentInformation.ConsentStatus.REQUIRED:
		UserMessagingPlatform.load_consent_form(
			func(form: ConsentForm): form.show(func(_err): _start_ads()),
			func(_err): _start_ads())
	else:
		_start_ads()


func _on_consent_error(_err) -> void:
	# Try anyway: the SDK serves only what the stored consent allows.
	_start_ads()


## Shows Google's privacy options form (for the "privacy choices" button).
func show_privacy_options() -> void:
	if enabled():
		UserMessagingPlatform.show_privacy_options_form(func(_err): pass)


# ---------- Start ----------

func _start_ads() -> void:
	if ready_for_ads:
		return
	ready_for_ads = true
	var info := UserMessagingPlatform.consent_information
	privacy_options_required = info.get_privacy_options_requirement_status() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
	# Content suitable for teens and up; the game is not directed at children.
	var config := RequestConfiguration.new()
	config.max_ad_content_rating = RequestConfiguration.MAX_AD_CONTENT_RATING_T
	MobileAds.set_request_configuration(config)
	# iOS: pause the game while a full-screen ad has taken over the screen.
	MobileAds.set_ios_app_pause_on_background(true)
	# The SDK starts on a background thread; ads may only be requested once
	# it says it's ready.
	var listener := OnInitializationCompleteListener.new()
	listener.on_initialization_complete = func(_status): _on_sdk_ready.call_deferred()
	MobileAds.initialize(listener)


func _on_sdk_ready() -> void:
	if _sdk_ready:
		return
	_sdk_ready = true
	if Tune.v.bannerAds:
		_create_banner()
	_load_interstitial()


func _unit(real: String, test: String) -> String:
	return real if real != "" and _store_build() else test


# ---------- Banner ----------

func _create_banner() -> void:
	var unit := _unit(IOS_BANNER_ID, IOS_TEST_BANNER_ID) if is_ios() else _unit(BANNER_ID, TEST_BANNER_ID)
	_banner = AdView.new(unit, AdSize.BANNER, AdPosition.TOP)
	var listener := AdListener.new()
	listener.on_ad_loaded = func():
		banner_height_px = float(_banner.get_height_in_pixels())
		banner_changed.emit()
	listener.on_ad_failed_to_load = func(_err):
		banner_height_px = 0.0
		banner_changed.emit()
	_banner.ad_listener = listener
	_banner.load_ad(AdRequest.new())


## How much of the 1080-high game screen the banner covers.
func banner_inset(view_height: float) -> float:
	if banner_height_px <= 0:
		return 0.0
	var window_h := float(DisplayServer.window_get_size().y)
	return banner_height_px * view_height / maxf(1.0, window_h)


# ---------- Full-screen ads between stages ----------

func _load_interstitial() -> void:
	if _loading_interstitial or _interstitial != null:
		return
	_loading_interstitial = true
	var cb := InterstitialAdLoadCallback.new()
	cb.on_ad_loaded = func(ad: InterstitialAd):
		_loading_interstitial = false
		_interstitial = ad
	cb.on_ad_failed_to_load = func(_err):
		_loading_interstitial = false
	var unit := _unit(IOS_INTERSTITIAL_ID, IOS_TEST_INTERSTITIAL_ID) if is_ios() else _unit(INTERSTITIAL_ID, TEST_INTERSTITIAL_ID)
	InterstitialAdLoader.new().load(unit, AdRequest.new(), cb)


## Call when a match ends.
func match_finished() -> void:
	_matches_since_ad += 1


## Call before starting the next match: shows a full-screen ad first if it's
## time for one, then calls `then`. Without an ad, `then` runs straight away.
func before_match(then: Callable) -> void:
	var every := int(Tune.v.interstitialEvery)
	if not enabled() or not _sdk_ready or every <= 0 or _matches_since_ad < every or _interstitial == null:
		then.call()
		return
	_matches_since_ad = 0
	_after_ad = then
	var ad := _interstitial
	_interstitial = null
	var done := func():
		ad.destroy()
		_load_interstitial()
		var next := _after_ad
		_after_ad = Callable()
		if next.is_valid():
			next.call()
	ad.full_screen_content_callback.on_ad_dismissed_full_screen_content = done
	ad.full_screen_content_callback.on_ad_failed_to_show_full_screen_content = func(_err): done.call()
	ad.show()
