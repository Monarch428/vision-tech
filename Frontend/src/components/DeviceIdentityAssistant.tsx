import { useEffect, useRef, useState } from "react";

export type SupportedPlatform = "windows" | "darwin" | "linux";
export type DeviceIdentity = { hostname: string; serialNumber: string; platform: SupportedPlatform };
type Session = { requestId: string; readToken: string; helperUrl: string; expiresAt: string };
const API = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const platformName = (p: SupportedPlatform) => p === "darwin" ? "macOS" : p[0].toUpperCase() + p.slice(1);
const detectPlatform = (): SupportedPlatform => { const ua = `${navigator.userAgent} ${navigator.platform}`.toLowerCase(); return ua.includes("mac") ? "darwin" : ua.includes("linux") ? "linux" : "windows"; };
const parseIdentity = (value: string, fallback: SupportedPlatform): DeviceIdentity => { const x = JSON.parse(value); if (!x || typeof x.hostname !== "string" || typeof x.serialNumber !== "string") throw new Error("invalid"); return { hostname: x.hostname.trim(), serialNumber: x.serialNumber.trim(), platform: ["windows", "darwin", "linux"].includes(x.platform) ? x.platform : fallback }; };

export default function DeviceIdentityAssistant({ onIdentity, onPlatformChange, compact = false, autoFillReady = true }: { onIdentity: (identity: DeviceIdentity) => void; onPlatformChange?: (platform: SupportedPlatform) => void; compact?: boolean; autoFillReady?: boolean }) {
  const [platform, setPlatform] = useState<SupportedPlatform>(detectPlatform), [consent, setConsent] = useState(false), [session, setSession] = useState<Session | null>(null), [message, setMessage] = useState("Choose your platform, approve sharing, then get this computer’s details."), [pasted, setPasted] = useState(""), [starting, setStarting] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null), abortRef = useRef<AbortController | null>(null);
  const cancel = (reason?: string) => { abortRef.current?.abort(); abortRef.current = null; setSession(null); if (reason) setMessage(reason); };
  const apply = (value: string, note = "Device information was filled into this form.") => { const identity = parseIdentity(value, platform); onIdentity(identity); setPlatform(identity.platform); setPasted(""); cancel(); setMessage(note); };
  useEffect(() => { onPlatformChange?.(platform); }, [platform, onPlatformChange]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!session || !autoFillReady) return;
    const controller = new AbortController(); abortRef.current = controller; let timer: number | undefined; const expires = Date.parse(session.expiresAt);
    const poll = async () => {
      if (controller.signal.aborted) return;
      if (Date.now() >= expires) { setSession(null); setMessage("This request expired after ten minutes. Start a new request to try again."); return; }
      try {
        const response = await fetch(`${API}/device-identity/requests/${session.requestId}?token=${encodeURIComponent(session.readToken)}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 404) { setSession(null); setMessage("This request expired or is no longer available. Start a new request."); return; }
        if (!response.ok) throw new Error(); const data = await response.json();
        if (data.status === "completed" && data.result) { onIdentity(data.result); setSession(null); setMessage(data.result.serialNumber ? "Device information was filled automatically. Review it before continuing." : "Hostname was filled automatically, but no serial number was available. Enter it manually before continuing."); return; }
      } catch { if (controller.signal.aborted) return; setMessage("Still waiting for the helper. A temporary connection problem will be retried automatically."); }
      timer = window.setTimeout(poll, 2000);
    }; poll(); return () => { controller.abort(); if (timer) window.clearTimeout(timer); };
  }, [session, autoFillReady, onIdentity]);
  const select = (next: SupportedPlatform) => { cancel(); setPlatform(next); setMessage(`${platformName(next)} selected. Any pending request was cancelled in this tab.`); };
  const start = async () => {
    if (!consent || !API) { setMessage(!API ? "Device identification is unavailable because the website API URL is not configured." : "Approve sharing before continuing."); return; }
    cancel(); setStarting(true); setMessage("Creating a private, ten-minute device request…");
    try { const response = await fetch(`${API}/device-identity/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ platform, consent: true }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not create a request."); setSession(data); setMessage(`Download and run the ${platformName(platform)} helper. This tab will fill itself when it shares the approved details.`); const a = document.createElement("a"); a.href = data.helperUrl; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { setMessage(e instanceof Error ? e.message : "Could not download the helper. Try again."); } finally { setStarting(false); }
  };
  const importFile = async (file?: File) => { if (!file || !consent) return; try { apply(await file.text(), "Device information was imported and filled into this form."); } catch { setMessage("That file is not a valid device-info.json file."); } };
  return <section className={`rounded-xl border border-green-200 bg-green-50 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-green-950">Identify this device</h3><p className="text-xs text-green-900">Only hostname and hardware serial number are shared after approval.</p></div><div className="flex gap-1">{(["windows", "darwin", "linux"] as SupportedPlatform[]).map((item) => <button key={item} type="button" onClick={() => select(item)} className={`rounded-md px-2 py-1 text-xs font-medium ${platform === item ? "bg-green-700 text-white" : "border border-green-200 bg-white text-green-800"}`}>{platformName(item)}</button>)}</div></div>
    <label className="mt-3 flex items-start gap-2 text-xs text-green-950"><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (!e.target.checked) cancel("Consent was withdrawn. No device request is active."); }} className="mt-0.5" />I consent to use this device’s hostname and serial number to configure services for this account.</label>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!consent || starting} onClick={start} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{starting ? "Preparing helper…" : "Get computer info"}</button><button type="button" disabled={!consent} onClick={() => uploadRef.current?.click()} className="rounded-lg border border-green-700 bg-white px-3 py-2 text-xs font-semibold text-green-800 disabled:opacity-50">Import device-info.json</button><button type="button" disabled={!consent} onClick={async () => { try { apply(await navigator.clipboard.readText()); } catch { setMessage("Clipboard access was unavailable. Paste JSON below instead."); } }} className="rounded-lg border border-green-700 bg-white px-3 py-2 text-xs font-semibold text-green-800 disabled:opacity-50">Paste &amp; fill</button>{session && <button type="button" onClick={() => cancel("Request cancelled. No details were received.")} className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-semibold text-gray-700">Cancel request</button>}</div>
    <input ref={uploadRef} hidden type="file" accept="application/json,.json" onChange={(e) => importFile(e.target.files?.[0])} />
    <div className="mt-2"><label className="block text-[11px] font-medium text-green-950" htmlFor="device-details-paste">Or paste copied device details</label><textarea id="device-details-paste" value={pasted} disabled={!consent} onChange={(e) => setPasted(e.target.value)} rows={2} placeholder='{"hostname":"...","serialNumber":"...","platform":"windows"}' className="mt-1 w-full rounded-md border border-green-200 bg-white p-2 font-mono text-[11px] text-green-950 disabled:opacity-50" /><button type="button" disabled={!consent || !pasted.trim()} onClick={() => { try { apply(pasted); } catch { setMessage("Paste complete device-details JSON created by a collector."); } }} className="mt-1 rounded-md border border-green-300 bg-white px-2 py-1 text-[11px] font-semibold text-green-900 disabled:opacity-50">Fill device details</button></div>
    <p className="mt-2 text-[11px] text-green-900">{message} The helper asks for approval again, sends details only to this one-time request, and does not install RMM or antivirus software.</p>
  </section>;
}
