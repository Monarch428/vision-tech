#!/usr/bin/env sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
app="$root/Frontend/public/device-identity/NVT Device Info.app"
contents="$app/Contents"

mkdir -p "$contents/MacOS" "$contents/Resources"
clang -fobjc-arc -framework Cocoa -framework IOKit "$root/DesktopApps/macOS/NVTDeviceInfo.m" -o "$contents/MacOS/NVTDeviceInfo"
cp "$root/DesktopApps/macOS/Info.plist" "$contents/Info.plist"
chmod 755 "$contents/MacOS/NVTDeviceInfo"

cd "$root/Frontend/public/device-identity"
zip -r -q -FS "NVT-Device-Info-macOS-pilot-v0.1.1.zip" "NVT Device Info.app"
echo "Created Frontend/public/device-identity/NVT-Device-Info-macOS-pilot-v0.1.1.zip"
