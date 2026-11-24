import { useEffect, useState } from "react";
import { generateInstaller, getDevices, type GenerateInstallerPayload } from "../services/user/rmm.service";

const detectInstaller = (): GenerateInstallerPayload => {
  const ua = navigator.userAgent.toLowerCase();
  const mac = ua.includes("mac");
  const linux = !mac && ua.includes("linux");
  const arm = /arm|aarch64/.test(ua);
  return { plat: mac ? "darwin" : linux ? "linux" : "windows", arch: mac || linux ? (arm ? "arm64" : "amd64") : "amd64", agentType: "workstation", rdp: true, ping: false };
};

export default function RmmOnboarding() {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [installer, setInstaller] = useState<{ url?: string; cmd?: string; plat?: string } | null>(null);
  const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
  const dismissedKey = user?.id ? `nvt-rmm-onboarding-${user.id}` : "";

  useEffect(() => {
    if (!user?.id || user.role !== "user" || localStorage.getItem(dismissedKey)) return;
    getDevices().then(({ devices }) => { if (!devices.length) setOpen(true); }).catch(() => setOpen(true));
  }, [dismissedKey, user?.id, user?.role]);

  const prepare = async () => {
    setBusy(true); setError("");
    try {
      const payload = detectInstaller();
      const result = await generateInstaller(payload);
      setInstaller({ url: result.url || result.downloadUrl, cmd: result.cmd || result.command, plat: payload.plat });
    } catch (e: any) {
      setError(e?.response?.data?.message || "We could not prepare the monitoring installer yet. Please try again shortly.");
    } finally { setBusy(false); }
  };
  const postpone = () => { if (dismissedKey) sessionStorage.setItem(dismissedKey, "1"); setOpen(false); };
  const startDownload = () => {
    if (!installer?.url) return;
    if (dismissedKey) localStorage.setItem(dismissedKey, "1");
    window.location.assign(installer.url);
  };
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
    <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">NVT Essentials setup</p>
      <h2 className="mt-1 text-xl font-bold text-slate-950">Protect this computer</h2>
      {!installer ? <>
        <p className="mt-3 text-sm text-slate-700">We detected <strong>{detectInstaller().plat === "windows" ? "Windows" : detectInstaller().plat === "darwin" ? "macOS" : "Linux"}</strong> and will prepare the correct monitoring agent for this account.</p>
        <p className="mt-2 text-xs text-slate-500">The installer is linked to your NVT Essentials device group. Windows may ask for permission to run it.</p>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button onClick={prepare} disabled={busy} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Preparing installer…" : "Prepare installer"}</button><button onClick={postpone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Not now</button></div>
      </> : <>
        <p className="mt-3 text-sm text-slate-700">Your installer is ready. Download it, then approve the Windows/UAC prompts to finish adding this computer.</p>
        {installer.plat === "windows" && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Windows SmartScreen:</strong> select <strong>More info</strong>, then <strong>Run anyway</strong>. When Windows asks for administrator permission, select <strong>Yes</strong>.</div>}
        <div className="mt-5 flex flex-wrap gap-3"><button onClick={startDownload} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">Download &amp; install</button><button onClick={postpone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">I’ll do this later</button></div>
      </>}
    </section>
  </div>;
}
