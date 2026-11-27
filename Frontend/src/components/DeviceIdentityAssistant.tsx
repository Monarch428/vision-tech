import { useEffect, useRef, useState } from "react";

export type SupportedPlatform = "windows" | "darwin" | "linux";
export type DeviceIdentity = { hostname: string; serialNumber: string; platform: SupportedPlatform };
type Session = { requestId: string; readToken: string; helperUrl: string; expiresAt: string };
const API = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const detectPlatform = (): SupportedPlatform => { const ua = `${navigator.userAgent} ${navigator.platform}`.toLowerCase(); return ua.includes("mac") ? "darwin" : ua.includes("linux") ? "linux" : "windows"; };
const platformName: Record<SupportedPlatform, string> = { windows: "Windows", darwin: "macOS", linux: "Linux" };
const helperLabel: Record<SupportedPlatform, string> = { windows: "Download Windows helper", darwin: "Download macOS helper", linux: "Download Linux helper" };

export default function DeviceIdentityAssistant({ onIdentity, onPlatformChange, compact = false, autoFillReady = true }: { onIdentity: (identity: DeviceIdentity) => void; onPlatformChange?: (platform: SupportedPlatform) => void; compact?: boolean; autoFillReady?: boolean }) {
  const [platform, setPlatform] = useState<SupportedPlatform>(detectPlatform), [consent, setConsent] = useState(false), [session, setSession] = useState<Session | null>(null), [message, setMessage] = useState("Approve sharing, then get this computer’s details."), [starting, setStarting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancel = (reason?: string) => { abortRef.current?.abort(); abortRef.current = null; setSession(null); if (reason) setMessage(reason); };
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
  const start = async () => {
    if (!consent || !API) { setMessage(!API ? "Device identification is unavailable because the website API URL is not configured." : "Approve sharing before continuing."); return; }
    cancel(); setStarting(true); setMessage("Creating a private, ten-minute device request…");
    try { const response = await fetch(`${API}/device-identity/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ platform, consent: true }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not create a request."); setSession(data); setMessage(`Your private request is ready. Select “${helperLabel[platform]}” below, then run it. The form will fill automatically.`); } catch (e) { setMessage(e instanceof Error ? e.message : "Could not create the helper request. Try again."); } finally { setStarting(false); }
  };
  return <section className={`rounded-xl border border-green-200 bg-green-50 ${compact ? "p-3" : "p-4"}`}>
    <div><h3 className="text-sm font-semibold text-green-950">Identify this device</h3><p className="text-xs text-green-900">Only hostname and hardware serial number are shared after approval.</p></div>
    <label className="mt-3 flex items-start gap-2 text-xs text-green-950"><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (!e.target.checked) cancel("Consent was withdrawn. No device request is active."); }} className="mt-0.5" />I consent to use this device’s hostname and serial number to configure services for this account.</label>
    <label className="mt-3 block text-xs font-medium text-green-950">Operating system<select aria-label="Operating system" value={platform} disabled={starting || !!session} onChange={(e) => setPlatform(e.target.value as SupportedPlatform)} className="mt-1 block rounded-lg border border-green-300 bg-white px-2 py-1.5 text-xs text-slate-900 disabled:opacity-50"><option value="windows">Windows</option><option value="darwin">macOS</option><option value="linux">Linux</option></select></label>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!consent || starting || !!session} onClick={start} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{starting ? "Preparing…" : `Get ${platformName[platform]} device details`}</button>{session && <a href={session.helperUrl} className="rounded-lg bg-green-800 px-3 py-2 text-xs font-semibold text-white">{helperLabel[platform]}</a>}{session && <button type="button" onClick={() => cancel("Request cancelled. No details were received.")} className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-semibold text-gray-700">Cancel</button>}</div>
    <p className="mt-2 text-[11px] text-green-900">{message}{session && " The helper sends details only to this one-time request and does not install RMM or antivirus software."}</p>
  </section>;
}
