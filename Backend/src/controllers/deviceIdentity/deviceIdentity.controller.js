const crypto = require('crypto');
const AdmZip = require('adm-zip');
const fs = require('fs');
const DeviceIdentityRequest = require('../../models/device-identity/DeviceIdentityRequest');

const TEN_MINUTES = 10 * 60 * 1000;
const platforms = new Set(['windows', 'darwin', 'linux']);
const tokenHash = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const CALLBACK_CODE_LENGTH = 6;
const CALLBACK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCallbackCode = () => Array.from(crypto.randomBytes(CALLBACK_CODE_LENGTH), (byte) => CALLBACK_CODE_ALPHABET[byte % CALLBACK_CODE_ALPHABET.length]).join('');
const noStore = (res) => res.set('Cache-Control', 'no-store, private, max-age=0').set('Pragma', 'no-cache');
const callbackBase = () => String(process.env.DEVICE_IDENTITY_PUBLIC_API_URL || '').replace(/\/$/, '');
const validPublicApiUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname));
  } catch { return false; }
};
const safeValue = (value, max = 255) => typeof value === 'string' && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const windowsHelperFilename = (callbackCode) => `NVT-Device-Info-${callbackCode}.exe`;

exports.createRequest = async (req, res) => {
  const platform = req.body?.platform;
  const publicApiUrl = callbackBase();
  if (!platforms.has(platform) || req.body?.consent !== true) return res.status(400).json({ message: 'Choose a platform and approve sharing before continuing.' });
  if (!validPublicApiUrl(publicApiUrl)) return res.status(503).json({ message: 'Device identification is not configured for this environment.' });
  const readToken = randomToken();
  const writeToken = randomToken();
  // Six characters provide 1,073,741,824 possible values. The unique index
  // makes a collision harmless; retrying also keeps the code fixed at six.
  let request;
  for (let attempt = 0; attempt < 5 && !request; attempt += 1) {
    try {
      request = await DeviceIdentityRequest.create({
        platform,
        readTokenHash: tokenHash(readToken),
        writeTokenHash: tokenHash(writeToken),
        callbackCode: randomCallbackCode(),
        expiresAt: new Date(Date.now() + TEN_MINUTES),
      });
    } catch (error) {
      if (error?.code !== 11000 || attempt === 4) throw error;
    }
  }
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

exports.submitResultByCallbackCode = async (req, res) => {
  const { hostname, serialNumber = '', platform } = req.body || {};
  if (!platforms.has(platform) || !safeValue(hostname) || !hostname.trim() || !safeValue(serialNumber)) {
    return noStore(res).status(400).json({ message: 'Invalid device details.' });
  }
  const request = await DeviceIdentityRequest.findOneAndUpdate(
    { callbackCode: req.params.callbackCode, platform: 'windows', status: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { status: 'completed', hostname: hostname.trim(), serialNumber: serialNumber.trim(), collectedAt: new Date() } },
    { new: true },
  );
  if (!request) return noStore(res).status(409).json({ message: 'This device request is expired, invalid, or already completed.' });
  return noStore(res).status(202).json({ status: 'accepted' });
};

exports.downloadHelper = async (req, res) => {
  const request = await DeviceIdentityRequest.findOne({ _id: req.params.id, writeTokenHash: tokenHash(req.query.token), expiresAt: { $gt: new Date() } }).lean();
  if (!request) return noStore(res).status(404).send('This device request has expired or is invalid.');
  // Non-Windows helpers receive their signed one-time callback in their
  // generated script/bundle. The Windows EXE obtains its callback code from
  // its filename instead, so its release binary can remain unchanged.
  const endpoint = `${callbackBase()}/device-identity/requests/${request._id}/result?token=${encodeURIComponent(req.query.token)}`;
  if (request.platform === 'windows' && process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH && fs.existsSync(process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH)) {
    const filename = windowsHelperFilename(request.callbackCode);
    noStore(res).type('application/vnd.microsoft.portable-executable'); res.attachment(filename);
    return res.send(fs.readFileSync(process.env.DEVICE_IDENTITY_WINDOWS_HELPER_PATH));
  }
  if (request.platform === 'windows') {
    return noStore(res).status(503).json({ message: 'The Windows device-info application is not configured on this server.' });
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
