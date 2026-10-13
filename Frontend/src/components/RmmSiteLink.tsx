import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { getRmmSites, linkRmmSite, unlinkRmmSite } from "../services/user/rmm.service";
import type { RmmSite } from "../services/user/rmm.service";

// Staff control: links a customer account to its Tactical RMM Site, which decides
// which devices the customer sees. Changes save immediately.
export default function RmmSiteLink({ userId }: { userId: string }) {
  const [sites, setSites] = useState<RmmSite[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const current = sites.find((s) => s.linkedUser?.id === userId) || null;

  const applySites = (list: RmmSite[]) => {
    setSites(list);
    const linked = list.find((s) => s.linkedUser?.id === userId);
    setSelected(linked ? String(linked.id) : "");
  };

  useEffect(() => {
    let cancelled = false;
    getRmmSites()
      .then((list) => !cancelled && applySites(list))
      .catch(() => !cancelled && setMessage({ text: "Couldn't load RMM sites.", error: true }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await action();
      setMessage({ text: success, error: false });
      applySites(await getRmmSites());
    } catch (error) {
      const apiMessage = isAxiosError(error) ? error.response?.data?.message : undefined;
      setMessage({ text: apiMessage || "Something went wrong.", error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2">
      <p className="text-sm font-semibold text-gray-900">Device group (RMM Site)</p>
      <p className="text-xs text-gray-500">
        {loading
          ? "Loading…"
          : current
          ? `Linked to "${current.name}" (${current.agentCount} device${current.agentCount === 1 ? "" : "s"})`
          : "Not linked: this customer can't see devices or add new ones yet."}
      </p>

      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={loading || saving}
        className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm"
      >
        <option value="">Select a site</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id} disabled={Boolean(s.linkedUser && s.linkedUser.id !== userId)}>
            {s.name} ({s.agentCount}){s.linkedUser && s.linkedUser.id !== userId ? ` — linked to ${s.linkedUser.email}` : ""}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!selected || saving || String(current?.id ?? "") === selected}
          onClick={() => run(() => linkRmmSite(userId, Number(selected)), "Site linked.")}
          className="flex-1 h-9 rounded-xl bg-green-500 text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Link site"}
        </button>
        {current && (
          <button
            type="button"
            disabled={saving}
            onClick={() => run(() => unlinkRmmSite(userId), "Site unlinked.")}
            className="h-9 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-50"
          >
            Unlink
          </button>
        )}
      </div>

      {message && (
        <p className={`text-xs ${message.error ? "text-red-500" : "text-green-600"}`}>{message.text}</p>
      )}
    </div>
  );
}
