#!/usr/bin/env sh
# Runs locally after the customer explicitly downloads and starts it.
# It creates device-info.json in Downloads (or the current directory). It does
# not upload any data.
set -eu

platform="linux"
hostname_value="$(hostname 2>/dev/null || uname -n)"
serial_number=""

if [ "$(uname -s)" = "Darwin" ]; then
  platform="darwin"
  hostname_value="$(scutil --get ComputerName 2>/dev/null || hostname)"
  serial_number="$(system_profiler SPHardwareDataType 2>/dev/null | awk '/Serial/ {print $4; exit}')"
else
  serial_number="$(cat /sys/class/dmi/id/product_serial 2>/dev/null || true)"
fi

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
output_dir="${HOME}/Downloads"
[ -d "$output_dir" ] || output_dir="$(pwd)"
output="$output_dir/device-info.json"

printf '{\n  "hostname": "%s",\n  "serialNumber": "%s",\n  "platform": "%s",\n  "collectedAt": "%s"\n}\n' \
  "$(json_escape "$hostname_value")" "$(json_escape "$serial_number")" "$platform" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$output"
if command -v pbcopy >/dev/null 2>&1; then
  pbcopy < "$output"
elif command -v wl-copy >/dev/null 2>&1; then
  wl-copy < "$output"
elif command -v xclip >/dev/null 2>&1; then
  xclip -selection clipboard < "$output"
elif command -v xsel >/dev/null 2>&1; then
  xsel --clipboard --input < "$output"
else
  printf 'Created %s (clipboard utility unavailable; import this file in NVT).\n' "$output"
  exit 0
fi
printf 'Created %s and copied device details to the clipboard. Return to NVT and use Paste & fill device details.\n' "$output"
