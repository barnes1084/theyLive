#!/bin/bash
# Installs the emulator build, launches it, and checks it's still running
# after a while. Saves the device log and a screenshot to build/ either way.
# Used by CI inside an Android emulator (reactivecircus/android-emulator-runner).
#
# A freshly booted emulator sometimes changes a device setting just as the
# app opens, and Android then rebuilds the app's screen; Godot quits when
# that happens. That's the emulator, not the game, so the launch gets a
# second try. A real crash (an exception or a native crash) fails at once.
set -u
PKG=io.github.barnes1084.theylive.dev
adb install -r build/emulator.apk || exit 1

# Let the freshly booted emulator settle before launching.
adb shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 1; done'
adb shell input keyevent 82 || true
sleep 15

launch() {
  adb shell am force-stop $PKG
  adb logcat -c
  adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 > /dev/null
  alive=1
  for i in $(seq 1 45); do
    sleep 1
    if [ -z "$(adb shell pidof $PKG | tr -d '\r')" ]; then
      alive=0
      break
    fi
  done
  sleep 2
  adb logcat -d > build/logcat.txt
}

real_crash() {
  grep -qE "FATAL EXCEPTION|Fatal signal|ANR in $PKG" build/logcat.txt
}

for attempt in 1 2; do
  launch
  if [ "$alive" = "1" ] || real_crash; then
    break
  fi
  echo "::warning::Launch $attempt: the app closed after $i seconds without a crash report (emulator relaunch). Trying again."
  cp build/logcat.txt build/logcat-attempt$attempt.txt
done

adb exec-out screencap -p > build/emulator.png || true
echo "----- crash and app log lines -----"
grep -E "FATAL|AndroidRuntime|Exception|godot|Godot|AdMob|Ads|libc " build/logcat.txt | tail -150
if [ "$alive" = "0" ]; then
  echo "::error::The app stopped running (crashed) $i seconds after launch. See build/logcat.txt."
  exit 1
fi
echo "The app was still running 45 seconds after launch."
