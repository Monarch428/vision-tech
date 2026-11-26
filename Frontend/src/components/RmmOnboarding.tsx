import { useEffect, useState } from "react";
import { generateInstaller, getDevices, type GenerateInstallerPayload } from "../services/user/rmm.service";
import { getBitdefenderDownloadLink } from "../services/user/selfhelp.service";

type Platform = "windows" | "darwin" | "linux";
type SetupDownload = { rmmUrl: string; bitdefenderUrl: string | null; platform: Platform };

const detectInstaller = (): GenerateInstallerPayload => {
  // navigator.platform remains useful for Safari and managed browsers whose
  // user-agent string may be reduced or overridden. Prefer an explicit Mac
  // signal before considering Linux.
  const browser = navigator as Navigator & { userAgentData?: { platform?: string; architecture?: string } };
  const fingerprint = `${browser.userAgentData?.platform || ""} ${navigator.platform || ""} ${navigator.userAgent || ""}`.toLowerCase();
  const mac = /mac|darwin/.test(fingerprint);
  const linux = !mac && /linux|x11/.test(fingerprint);
  const arm = /arm|aarch64/.test(fingerprint);
  return { plat: mac ? "darwin" : linux ? "linux" : "windows", arch: mac || linux ? (arm ? "arm64" : "amd64") : "amd64", agentType: "workstation", rdp: true, ping: false };
};

const platformName: Record<Platform, string> = { windows: "Windows", darwin: "macOS", linux: "Linux" };
const bitdefenderPlatform: Record<Platform, "windows" | "mac" | "linux"> = { windows: "windows", darwin: "mac", linux: "linux" };

const download = (url: string) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

export default function RmmOnboarding() {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [approved, setApproved] = useState(false);
  const [error, setError] = useState(""), [warning, setWarning] = useState("");
  const [setup, setSetup] = useState<SetupDownload | null>(null);
  const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
  const dismissedKey = user?.id ? `nvt-rmm-onboarding-${user.id}` : "";
  const platform = detectInstaller().plat as Platform;

  useEffect(() => {
    if (!user?.id || user.role !== "user" || localStorage.getItem(dismissedKey)) return;
    getDevices().then(({ devices }) => { if (!devices.length) setOpen(true); }).catch(() => setOpen(true));
  }, [dismissedKey, user?.id, user?.role]);

  const prepare = async () => {
    if (!approved) return;
    setBusy(true); setError(""); setWarning("");
    const payload = detectInstaller();
    try {
      // The API creates/links the user's private RMM Site when required.
      // Links are prepared only after the customer explicitly approves setup.
      const [rmmResult, antivirusResult] = await Promise.allSettled([
        generateInstaller(payload),
        getBitdefenderDownloadLink(),
      ]);
      if (rmmResult.status !== "fulfilled") throw rmmResult.reason;
      const rmmUrl = rmmResult.value.url || rmmResult.value.downloadUrl;
      if (!rmmUrl) throw new Error("The monitoring installer could not be prepared.");
      const bitdefenderUrl = antivirusResult.status === "fulfilled"
        ? antivirusResult.value[bitdefenderPlatform[platform]]
        : null;
      if (!bitdefenderUrl) setWarning("The RMM installer is ready. Bitdefender could not be prepared right now, so you can download it later from Self Help.");
      setSetup({ rmmUrl, bitdefenderUrl, platform });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "We could not prepare the monitoring installer yet. Please try again shortly.");
    } finally { setBusy(false); }
  };

  const postpone = () => { if (dismissedKey) localStorage.setItem(dismissedKey, "1"); setOpen(false); };
  const startDownloads = () => {
    if (!setup) return;
    // Both links are started by this explicit user action. The OS still
    // controls installation and administrator approval.
    download(setup.rmmUrl);
    if (setup.bitdefenderUrl) download(setup.bitdefenderUrl);
    if (dismissedKey) localStorage.setItem(dismissedKey, "1");
  };

  if (!open) return null;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="device-protection-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">NVT Essentials setup</p>
      <h2 id="device-protection-title" className="mt-1 text-xl font-bold text-slate-950">Protect this computer</h2>
      {!setup ? <>
        <p className="mt-3 text-sm text-slate-700">No RMM device is set up for this account. We detected <strong>{platformName[platform]}</strong> and will create or link your private device group automatically.</p>
        <p className="mt-2 text-xs text-slate-500">With your approval, we will prepare the correct RMM and Bitdefender installers. Nothing is installed until you run the downloaded installers and approve your operating system prompts.</p>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-800"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} className="mt-0.5" />I approve downloading the RMM and Bitdefender installers for this {platformName[platform]} computer.</label>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button onClick={prepare} disabled={!approved || busy} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Preparing secure installers…" : "Prepare protection setup"}</button><button onClick={postpone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">I’ll do this later</button></div>
      </> : <>
        <p className="mt-3 text-sm text-slate-700">Your {platformName[setup.platform]} installers are ready. Download them, then run the RMM installer followed by the Bitdefender installer.</p>
        {setup.platform === "windows" && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Windows SmartScreen:</strong> select <strong>More info</strong>, then <strong>Run anyway</strong>. When Windows asks for administrator permission, select <strong>Yes</strong>.</div>}
        {warning && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button onClick={startDownloads} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">{setup.bitdefenderUrl ? "Download RMM & Bitdefender" : "Download RMM agent"}</button><button onClick={postpone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">I’ll do this later</button></div>
      </>}
    </section>
  </div>;
}
