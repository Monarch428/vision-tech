const crypto = require('crypto');
const AdmZip = require('adm-zip');
const fs = require('fs');
const DeviceIdentityRequest = require('../../models/device-identity/DeviceIdentityRequest');

const TEN_MINUTES = 10 * 60 * 1000;
const platforms = new Set(['windows', 'darwin', 'linux']);
const tokenHash = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const noStore = (res) => res.set('Cache-Control', 'no-store, private, max-age=0').set('Pragma', 'no-cache');
const callbackBase = () => String(process.env.DEVICE_IDENTITY_PUBLIC_API_URL || '').replace(/\/$/, '');
const validPublicApiUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname));
  } catch { return false; }
};
const safeValue = (value, max = 255) => typeof value === 'string' && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);

exports.createRequest = async (req, res) => {
  const platform = req.body?.platform;
  const publicApiUrl = callbackBase();
  if (!platforms.has(platform) || req.body?.consent !== true) return res.status(400).json({ message: 'Choose a platform and approve sharing before continuing.' });
  if (!validPublicApiUrl(publicApiUrl)) return res.status(503).json({ message: 'Device identification is not configured for this environment.' });
  const readToken = randomToken();
  const writeToken = randomToken();
  const request = await DeviceIdentityRequest.create({
    platform,
    readTokenHash: tokenHash(readToken),
    writeTokenHash: tokenHash(writeToken),
    expiresAt: new Date(Date.now() + TEN_MINUTES),
  });
  noStore(res).status(201).json({
    requestId: request.id,
    readToken,
    expiresAt: request.expiresAt.toISOString(),
    helperUrl: `${publicApiUrl}/device-identity/requests/${request.id}/helper?token=${encodeURIComponent(writeToken)}`,
  });
};

exports.getRequest = async (req, res) => {
  const request = await DeviceIdentityRequest.findOne({ _id: req.params.id, readTokenHash: tokenHash(req.query.token), expiresAt: { $gt: new Date() } }).lean();
  if (!request) return noStore(res).status(404).json({ message: 'This device request has expired or is invalid.' });
  const result = request.status === 'completed' ? { hostname: request.hostname, serialNumber: request.serialNumber || '', platform: request.platform } : null;
  return noStore(res).json({ status: request.status, expiresAt: request.expiresAt, result });
};

exports.submitResult = async (req, res) => {
  const { hostname, serialNumber = '', platform } = req.body || {};
  if (!platforms.has(platform) || !safeValue(hostname) || !hostname.trim() || !safeValue(serialNumber)) {
    return noStore(res).status(400).json({ message: 'Invalid device details.' });
  }
  const request = await DeviceIdentityRequest.findOneAndUpdate(
    { _id: req.params.id, writeTokenHash: tokenHash(req.query.token), status: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { status: 'completed', hostname: hostname.trim(), serialNumber: serialNumber.trim(), collectedAt: new Date() } },
    { new: true },
  );
  if (!request) return noStore(res).status(409).json({ message: 'This device request is expired, invalid, or already completed.' });
  return noStore(res).status(202).json({ status: 'accepted' });
};

exports.downloadHelper = async (req, res) => {
  const request = await DeviceIdentityRequest.findOne({ _id: req.params.id, writeTokenHash: tokenHash(req.query.token), expiresAt: { $gt: new Date() } }).lean();
  if (!request) return noStore(res).status(404).send('This device request has expired or is invalid.');
  const endpoint = `${callbackBase()}/device-identity/requests/${request._id}/result?token=${encodeURIComponent(req.query.token)}`;
  const ps1 = `# NVT Device Info — launched by Run NVT Device Info.cmd\n# Do not double-click this file: Windows may associate .ps1 files with Notepad.\n$ErrorActionPreference = 'Stop'\nAdd-Type -AssemblyName PresentationFramework\n$choice = [System.Windows.MessageBox]::Show('Share this computer''s hostname and hardware serial number with Vision Tech?', 'NVT Device Info', 'YesNo', 'Question')\nif ($choice -ne 'Yes') { exit 0 }\ntry {\n  $serial = ''\n  try { $serial = (Get-CimInstance -ClassName Win32_BIOS -ErrorAction Stop).SerialNumber } catch {}\n  $body = @{ hostname = $env:COMPUTERNAME; serialNumber = [string]$serial; platform = 'windows' } | ConvertTo-Json -Compress\n  Invoke-RestMethod -Method Post -Uri '${endpoint}' -ContentType 'application/json' -Body $body | Out-Null\n  [System.Windows.MessageBox]::Show('Device details shared. Return to the Vision Tech browser tab.', 'NVT Device Info', 'OK', 'Information') | Out-Null\n} catch {\n  [System.Windows.MessageBox]::Show(\"Could not share device details. Check your connection and start a new request in Vision Tech.\\n\\n$($_.Exception.Message)\", 'NVT Device Info', 'OK', 'Error') | Out-Null\n  exit 1\n}\n`;
  if (request.platform === 'windows' && process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH && fs.existsSync(process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH)) {
    const zip = new AdmZip();
    zip.addFile('NVTDeviceInfo.exe', fs.readFileSync(process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH), '', 0o755);
    zip.addFile('Run NVT Device Info.cmd', Buffer.from(`@echo off\r\nset "NVT_DEVICE_INFO_CALLBACK=${endpoint}"\r\nstart "" "%~dp0NVTDeviceInfo.exe"\r\n`), '', 0o644);
    noStore(res).type('application/zip'); res.attachment('NVT-Device-Info-Windows.zip');
    return res.send(zip.toBuffer());
  }
  if (request.platform === 'windows') {
    // A bare .ps1 download is often opened in Notepad. This package gives the
    // user one obvious launcher and retains failures long enough to inspect.
    const zip = new AdmZip();
    zip.addFile('NVT Device Info.ps1', Buffer.from(ps1), '', 0o644);
    zip.addFile('Run NVT Device Info.cmd', Buffer.from('@echo off\r\nPowerShell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0NVT Device Info.ps1"\r\nif errorlevel 1 pause\r\n'), '', 0o644);
    zip.addFile('README.txt', Buffer.from('1. Extract this ZIP before running it.\r\n2. Double-click "Run NVT Device Info.cmd". Do not open the .ps1 file directly.\r\n3. Choose Yes in the approval dialog. The original Vision Tech browser tab will fill automatically.\r\n'), '', 0o644);
    noStore(res).type('application/zip'); res.attachment('NVT-Device-Info-Windows.zip');
    return res.send(zip.toBuffer());
  }
  const sh = `#!/usr/bin/env sh\nset -eu\nprintf 'Share this computer hostname and hardware serial number with Vision Tech? Type YES to continue: ' >&2\nread answer\n[ "$answer" = YES ] || { echo 'No details were shared.'; exit 0; }\nhostname_value="$(hostname 2>/dev/null || uname -n)"\nserial_number="$(cat /sys/class/dmi/id/product_serial 2>/dev/null || true)"\n[ "$(uname -s)" = Darwin ] && serial_number="$(system_profiler SPHardwareDataType 2>/dev/null | awk '/Serial/ {print $4; exit}')"\njson_escape() { printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g'; }\nbody=$(printf '{"hostname":"%s","serialNumber":"%s","platform":"${request.platform}"}' "$(json_escape "$hostname_value")" "$(json_escape "$serial_number")")\ncurl --fail --silent --show-error -X POST -H 'Content-Type: application/json' --data "$body" '${endpoint}'\necho 'Details shared. Return to the Vision Tech tab.'\n`;
  if (request.platform === 'darwin') {
    // A .app bundle lets Finder launch the collector as an app instead of
    // opening a downloaded .sh file in the user's editor.
    const script = `#!/bin/sh
choice=$(osascript -e 'button returned of (display dialog "Share this Mac’s hostname and hardware serial number with Vision Tech?" buttons {"Cancel", "Share"} default button "Share" with icon caution)')
[ "$choice" = "Share" ] || exit 0
hostname_value="$(scutil --get ComputerName 2>/dev/null || hostname)"
serial_number="$(ioreg -l | awk -F'"' '/IOPlatformSerialNumber/ {print $4; exit}')"
json_escape() { printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g'; }
body=$(printf '{"hostname":"%s","serialNumber":"%s","platform":"darwin"}' "$(json_escape "$hostname_value")" "$(json_escape "$serial_number")")
if curl --fail --silent --show-error -X POST -H 'Content-Type: application/json' --data "$body" '${endpoint}'; then
  osascript -e 'display dialog "Device details shared. Return to the Vision Tech browser tab." buttons {"OK"} default button "OK"'
else
  osascript -e 'display dialog "Could not share device details. Check your connection and start a new request in Vision Tech." buttons {"OK"} default button "OK" with icon stop'
fi
`;
    const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleDisplayName</key><string>NVT Device Info</string><key>CFBundleExecutable</key><string>NVTDeviceInfo</string><key>CFBundleIdentifier</key><string>com.nvtse.device-info.request</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>1.0</string></dict></plist>`;
    const zip = new AdmZip();
    zip.addFile('NVT Device Info.app/Contents/Info.plist', Buffer.from(plist), '', 0o644);
    zip.addFile('NVT Device Info.app/Contents/MacOS/NVTDeviceInfo', Buffer.from(script), '', 0o755);
    noStore(res).type('application/zip'); res.attachment('NVT-Device-Info-macOS.zip');
    return res.send(zip.toBuffer());
  }
  noStore(res).type('text/x-shellscript; charset=utf-8');
  res.attachment(request.platform === 'darwin' ? 'NVT-Device-Info-macOS.sh' : 'NVT-Device-Info-linux.sh');
  return res.send(sh);
};
