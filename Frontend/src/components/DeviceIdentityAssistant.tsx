import { useEffect, useRef, useState } from "react";

export type SupportedPlatform = "windows" | "darwin" | "linux";
export type DeviceIdentity = { hostname: string; serialNumber: string; platform: SupportedPlatform };

const commands: Record<SupportedPlatform, { hostname: string; serial: string }> = {
  windows: { hostname: "hostname", serial: 'powershell -NoProfile -Command "(Get-CimInstance Win32_BIOS).SerialNumber"' },
  darwin: { hostname: "scutil --get ComputerName", serial: "system_profiler SPHardwareDataType | awk '/Serial/ {print $4}'" },
  linux: { hostname: "hostnamectl --static", serial: "cat /sys/class/dmi/id/product_serial" },
};

const detectPlatform = (): SupportedPlatform => {
  const value = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (value.includes("mac")) return "darwin";
  if (value.includes("linux")) return "linux";
  return "windows";
};

function platformName(platform: SupportedPlatform) {
  return platform === "darwin" ? "macOS" : platform[0].toUpperCase() + platform.slice(1);
}

export default function DeviceIdentityAssistant({
  onIdentity,
  onPlatformChange,
  compact = false,
}: {
  onIdentity: (identity: DeviceIdentity) => void;
  onPlatformChange?: (platform: SupportedPlatform) => void;
  compact?: boolean;
}) {
  const [platform, setPlatform] = useState<SupportedPlatform>(detectPlatform);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("Your operating system was detected from this browser.");
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => { onPlatformChange?.(platform); }, [platform, onPlatformChange]);
  const setSelectedPlatform = (value: SupportedPlatform) => { setPlatform(value); setMessage(`${platformName(value)} selected.`); };
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setMessage("Command copied. Run it in Terminal/Command Prompt, then paste the result.");
  };
  const importFile = async (file?: File) => {
    if (!file || !consent) return;
    try {
      const value = JSON.parse(await file.text());
      if (typeof value.hostname !== "string" || typeof value.serialNumber !== "string") throw new Error("invalid");
      onIdentity({ hostname: value.hostname.trim(), serialNumber: value.serialNumber.trim(), platform });
      setMessage("Device information was imported and filled into this form. Review it before continuing.");
    } catch { setMessage("That file is not a valid device-info.json file."); }
  };

  return <section className={`rounded-xl border border-green-200 bg-green-50 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold text-green-950">Identify this device</h3><p className="text-xs text-green-900">Only share hostname and serial number after you approve.</p></div>
      <div className="flex gap-1">{(["windows", "darwin", "linux"] as SupportedPlatform[]).map((item) => <button key={item} type="button" onClick={() => setSelectedPlatform(item)} className={`rounded-md px-2 py-1 text-xs font-medium ${platform === item ? "bg-green-700 text-white" : "bg-white text-green-800 border border-green-200"}`}>{platformName(item)}</button>)}</div>
    </div>
    <label className="mt-3 flex items-start gap-2 text-xs text-green-950"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />I consent to use this device’s hostname and serial number to configure RMM and antivirus for this account.</label>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={!consent} onClick={() => uploadRef.current?.click()} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Import device-info.json</button>
      {platform === "windows" && <a href="/NVT-Device-Web-v1.3/NVT-Device-Web.exe" download="NVT-Device-Web.exe" className={`rounded-lg border border-green-700 px-3 py-2 text-xs font-semibold text-green-800 ${consent ? "" : "pointer-events-none opacity-50"}`}>Download Windows helper</a>}
      <button type="button" disabled={!consent} onClick={() => copy(commands[platform].hostname)} className="rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-semibold text-green-900 disabled:opacity-50">Copy hostname command</button>
      <button type="button" disabled={!consent} onClick={() => copy(commands[platform].serial)} className="rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-semibold text-green-900 disabled:opacity-50">Copy serial command</button>
    </div>
    <input ref={uploadRef} hidden type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} />
    <p className="mt-2 text-[11px] text-green-900">{message} The included helper is Windows-only and runs only when you start it. Deleting it stops local reads; deleting an installed RMM or Bitdefender agent requires reinstalling that product separately.</p>
  </section>;
}
