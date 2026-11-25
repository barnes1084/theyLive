#!/bin/bash
# Installs the simulator build on an iPhone Simulator, launches it, and checks
# it's still running a while later. Saves a screenshot and the app's log to
# build/ either way. Used by the iOS GitHub workflow on a Mac.
set -u
BUNDLE=io.github.barnes1084.theylive

# Runs a command with a time limit (macOS has no `timeout`): the simulator
# sometimes hangs on a first install or launch.
limit() {
  local secs=$1; shift
  perl -e 'alarm shift; exec @ARGV or die "exec: $!"' "$secs" "$@"
}
APP=$(find build/dd/Build/Products -maxdepth 2 -name "*.app" -path "*iphonesimulator*" | head -1)
if [ -z "$APP" ]; then
  echo "::error::No simulator .app was built."
  exit 1
fi
echo "App: $APP"

# The newest available iPhone simulator.
DEVICE=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devs = json.load(sys.stdin)["devices"]
best = None
for runtime, items in devs.items():
    if "iOS" not in runtime:
        continue
    for d in items:
        if d["name"].startswith("iPhone"):
            best = d["udid"]
print(best or "")')
if [ -z "$DEVICE" ]; then
  echo "::error::No iPhone simulator available."
  exit 1
fi
echo "Simulator: $DEVICE"
limit 60 xcrun simctl boot "$DEVICE" || true
limit 240 xcrun simctl bootstatus "$DEVICE" -b || true
installed=0
for attempt in 1 2 3; do
  if limit 120 xcrun simctl install "$DEVICE" "$APP"; then
    installed=1
    break
  fi
  echo "Install attempt $attempt failed or hung; restarting the simulator."
  limit 60 xcrun simctl shutdown "$DEVICE" || true
  limit 60 xcrun simctl boot "$DEVICE" || true
  limit 240 xcrun simctl bootstatus "$DEVICE" -b || true
done
if [ "$installed" = "0" ]; then
  echo "::error::Couldn't install the app on the simulator."
  exit 1
fi
started=$(date -u +"%Y-%m-%d %H:%M:%S")
if ! limit 120 xcrun simctl launch "$DEVICE" "$BUNDLE"; then
  echo "::error::The simulator couldn't launch the app."
  exit 1
fi

app_pid() {
  limit 20 xcrun simctl spawn "$DEVICE" launchctl list | awk -v b="$BUNDLE" '$3 ~ b {print $1}' | head -1
}
# Under Rosetta (Godot's simulator engine is Intel-only) the app can take
# half a minute to show up as running: wait for it first.
pid=""
for i in $(seq 1 90); do
  pid=$(app_pid)
  case "$pid" in ''|-) sleep 1 ;; *) break ;; esac
done
alive=1
case "$pid" in ''|-) alive=0; i=0 ;; esac
if [ "$alive" = "1" ]; then
  for i in $(seq 1 45); do
    sleep 1
    pid=$(app_pid)
    if [ -z "$pid" ] || [ "$pid" = "-" ]; then
      alive=0
      break
    fi
  done
fi

mkdir -p build
limit 60 xcrun simctl io "$DEVICE" screenshot build/ios-sim.png || true
limit 120 xcrun simctl spawn "$DEVICE" log show --start "$started" --style compact \
  --predicate 'process CONTAINS "TheyLive" OR eventMessage CONTAINS "TheyLive"' > build/ios-sim-log.txt 2>&1 || true
echo "----- app log (last lines) -----"
tail -80 build/ios-sim-log.txt
if [ "$alive" = "0" ]; then
  echo "::error::The app stopped running (crashed) $i seconds after it started (or never started). See build/ios-sim-log.txt."
  exit 1
fi
echo "The app was still running 45 seconds after launch."
