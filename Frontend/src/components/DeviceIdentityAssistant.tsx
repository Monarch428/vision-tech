import { useEffect, useRef, useState } from "react";

export type SupportedPlatform = "windows" | "darwin" | "linux";
export type DeviceIdentity = { hostname: string; serialNumber: string; platform: SupportedPlatform };

const collectorFiles: Record<SupportedPlatform, { href?: string; filename: string; label: string; instruction: string }> = {
  windows: { filename: "NVT-Device-Info.ps1", label: "Download Windows app", instruction: "Run the downloaded PowerShell file. It will collect this device's details and return to this page to fill the fields automatically." },
  darwin: { href: "/device-identity/NVT-Device-Info-macOS-pilot-v0.1.1.zip", filename: "NVT-Device-Info-macOS-pilot-v0.1.1.zip", label: "Download macOS app", instruction: "Open the ZIP, then Control-click NVT Device Info.app and choose Open (it is an unsigned pilot). Approve the consent prompt; it will return to this page and fill the fields automatically." },
  linux: { filename: "NVT-Device-Info.sh", label: "Download Linux app", instruction: "Make the downloaded file executable and run it. It will collect this device's details and return to this page to fill the fields automatically." },
};

const detectPlatform = (): SupportedPlatform => {
  const value = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (value.includes("mac")) return "darwin";
  if (value.includes("linux")) return "linux";
  return "windows";
};

function platformName(platform: SupportedPlatform) { return platform === "darwin" ? "macOS" : platform[0].toUpperCase() + platform.slice(1); }

function parseDeviceIdentity(value: string, fallbackPlatform: SupportedPlatform): DeviceIdentity {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed.hostname !== "string" || typeof parsed.serialNumber !== "string") throw new Error("invalid");
  const filePlatform = (["windows", "darwin", "linux"] as string[]).includes(parsed.platform) ? parsed.platform as SupportedPlatform : fallbackPlatform;
  return { hostname: parsed.hostname.trim(), serialNumber: parsed.serialNumber.trim(), platform: filePlatform };
}

const callbackPrefix = "nvt-device-info-callback:";
const callbackHashKey = "nvt-device-info=";

function callbackUrl() {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

function downloadText(filename: string, text: string, type = "text/plain") {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function windowsCollector(returnUrl: string) {
  const encodedUrl = returnUrl.replace(/'/g, "''");
  return `# NVT Device Info - runs only after you start this downloaded file\n$ErrorActionPreference = 'Stop'\n$serialNumber = ''\ntry { $serialNumber = (Get-CimInstance -ClassName Win32_BIOS -ErrorAction Stop).SerialNumber } catch {}\n$info = [ordered]@{ hostname = $env:COMPUTERNAME; serialNumber = [string]$serialNumber; platform = 'windows'; collectedAt = (Get-Date).ToUniversalTime().ToString('o') }\n$json = $info | ConvertTo-Json -Compress\n$desktop = [Environment]::GetFolderPath('Desktop'); if ([string]::IsNullOrWhiteSpace($desktop)) { $desktop = (Get-Location).Path }\n$json | Set-Content -Path (Join-Path $desktop 'device-info.json') -Encoding UTF8\ntry { Set-Clipboard -Value $json } catch {}\n$payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)).TrimEnd('=').Replace('+','-').Replace('/','_')\nStart-Process ('${encodedUrl}#nvt-device-info=' + $payload)\n`;
}

function linuxCollector(returnUrl: string) {
  const quotedUrl = returnUrl.replace(/'/g, "'\\''");
  return `#!/usr/bin/env sh\n# NVT Device Info - runs only after you start this downloaded file\nset -eu\nhostname_value="$(hostname 2>/dev/null || uname -n)"\nserial_number="$(cat /sys/class/dmi/id/product_serial 2>/dev/null || true)"\njson_escape() { printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g'; }\njson=$(printf '{"hostname":"%s","serialNumber":"%s","platform":"linux","collectedAt":"%s"}' "$(json_escape "$hostname_value")" "$(json_escape "$serial_number")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")\nprintf '%s\\n' "$json" > "$HOME/Downloads/device-info.json"\nprintf '%s' "$json" | { command -v wl-copy >/dev/null 2>&1 && wl-copy || command -v xclip >/dev/null 2>&1 && xclip -selection clipboard || true; }\npayload=$(printf '%s' "$json" | base64 | tr -d '\\n' | tr '+/' '-_' | tr -d '=')\nxdg-open '${quotedUrl}#nvt-device-info='"$payload" 2>/dev/null || sensible-browser '${quotedUrl}#nvt-device-info='"$payload" 2>/dev/null || true\n`;
}

export default function DeviceIdentityAssistant({ onIdentity, onPlatformChange, compact = false, autoFillReady = true }: { onIdentity: (identity: DeviceIdentity) => void; onPlatformChange?: (platform: SupportedPlatform) => void; compact?: boolean; autoFillReady?: boolean }) {
  const [platform, setPlatform] = useState<SupportedPlatform>(detectPlatform);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("Your operating system was detected from this browser.");
  const [showInstructions, setShowInstructions] = useState(false);
  const [pastedDetails, setPastedDetails] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => { onPlatformChange?.(platform); }, [platform, onPlatformChange]);
  useEffect(() => {
    if (!autoFillReady) return;
    const value = window.location.hash.startsWith(`#${callbackHashKey}`) ? window.location.hash.slice(callbackHashKey.length + 1) : "";
    if (!value) return;
    try {
      const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
      applyIdentity(new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))));
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      setMessage("Device information was collected and filled automatically. Review it before continuing.");
    } catch { setMessage("The device app returned invalid details. Run it again or import device-info.json."); }
  // The callback is consumed after its form has loaded existing values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFillReady]);
  const setSelectedPlatform = (value: SupportedPlatform) => { setPlatform(value); setMessage(`${platformName(value)} selected.`); };
  const applyIdentity = (value: string) => {
    const identity = parseDeviceIdentity(value, platform);
    setPlatform(identity.platform); onIdentity(identity); setPastedDetails("");
    setMessage("Device information was pasted and filled into this form. Review it before continuing.");
  };
  const importFile = async (file?: File) => {
    if (!file || !consent) return;
    try { applyIdentity(await file.text()); setMessage("Device information was imported and filled into this form. Review it before continuing."); }
    catch { setMessage("That file is not a valid device-info.json file."); }
  };
  const pasteFromClipboard = async () => {
    if (!consent) return;
    try { applyIdentity(await navigator.clipboard.readText()); }
    catch { setMessage("Clipboard access was unavailable or did not contain device details. Paste the copied JSON in the box below, then select Fill device details."); }
  };
  const handlePastedDetails = (value: string) => { setPastedDetails(value); try { applyIdentity(value); } catch { /* Wait until the complete JSON has been pasted. */ } };
  const downloadCollector = async () => {
    if (!consent) return;
    const returnUrl = callbackUrl();
    if (platform === "darwin") {
      try { await navigator.clipboard.writeText(`${callbackPrefix}${returnUrl}`); }
      catch { setMessage("The macOS app downloaded, but this browser could not prepare its automatic return link. Use Paste & fill device details after it runs."); }
      window.location.assign(collectorFiles.darwin.href!);
      setShowInstructions(true);
      return;
    }
    downloadText(collectorFiles[platform].filename, platform === "windows" ? windowsCollector(returnUrl) : linuxCollector(returnUrl));
    setShowInstructions(true);
  };

  return <section className={`rounded-xl border border-green-200 bg-green-50 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold text-green-950">Identify this device</h3><p className="text-xs text-green-900">Only share hostname and serial number after you approve.</p></div>
      <div className="flex gap-1">{(["windows", "darwin", "linux"] as SupportedPlatform[]).map((item) => <button key={item} type="button" onClick={() => setSelectedPlatform(item)} className={`rounded-md px-2 py-1 text-xs font-medium ${platform === item ? "bg-green-700 text-white" : "bg-white text-green-800 border border-green-200"}`}>{platformName(item)}</button>)}</div>
    </div>
    <label className="mt-3 flex items-start gap-2 text-xs text-green-950"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />I consent to use this device’s hostname and serial number to configure RMM and antivirus for this account.</label>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={!consent} onClick={() => uploadRef.current?.click()} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Import device-info.json</button>
      <button type="button" disabled={!consent} onClick={downloadCollector} className="rounded-lg border border-green-700 px-3 py-2 text-xs font-semibold text-green-800 disabled:opacity-50">{collectorFiles[platform].label}</button>
      <button type="button" disabled={!consent} onClick={pasteFromClipboard} className="rounded-lg border border-green-700 bg-white px-3 py-2 text-xs font-semibold text-green-800 disabled:opacity-50">Paste &amp; fill device details</button>
    </div>
    <input ref={uploadRef} hidden type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} />
    {showInstructions && <p className="mt-2 rounded-md bg-white p-2 text-[11px] text-green-950">{collectorFiles[platform].instruction} Return here and select <strong>Paste &amp; fill device details</strong>; if your browser blocks clipboard access, paste the copied JSON below instead.</p>}
    <div className="mt-2">
      <label className="block text-[11px] font-medium text-green-950" htmlFor="device-details-paste">Or paste copied device details</label>
      <textarea id="device-details-paste" value={pastedDetails} disabled={!consent} onChange={(event) => handlePastedDetails(event.target.value)} rows={2} placeholder='{"hostname":"...","serialNumber":"...","platform":"windows"}' className="mt-1 w-full rounded-md border border-green-200 bg-white p-2 font-mono text-[11px] text-green-950 disabled:opacity-50" />
      <button type="button" disabled={!consent || !pastedDetails.trim()} onClick={() => { try { applyIdentity(pastedDetails); } catch { setMessage("Paste the complete device-details JSON created by the collector."); } }} className="mt-1 rounded-md border border-green-300 bg-white px-2 py-1 text-[11px] font-semibold text-green-900 disabled:opacity-50">Fill device details</button>
    </div>
    <p className="mt-2 text-[11px] text-green-900">{message} The collector creates a local file only after you run it. It returns the details in the browser URL fragment, which is removed immediately and is not sent to our server. Deleting it stops local reads; deleting an installed RMM or Bitdefender agent requires reinstalling that product separately.</p>
  </section>;
}
