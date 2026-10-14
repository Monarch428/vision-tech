import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { downloadInvoiceAsStaff, getAdminPayments, refundPayment } from "../../services/admin/payments.service";
import type { AdminPayment, PaymentFilters, PaymentsPage } from "../../services/admin/payments.service";

const GATEWAY_LABELS: Record<string, string> = { paypal: "PayPal", stripe: "Card (Stripe)" };
const money = (n: number) => `$${n.toFixed(2)}`;
const errorText = (e: unknown, fallback: string) => (isAxiosError(e) && e.response?.data?.message) || fallback;

const STATUS_STYLES: Record<string, string> = {
  success: "bg-green-50 text-green-700 border-green-200",
  refunded: "bg-blue-50 text-blue-700 border-blue-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-300 rounded-2xl px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function RefundDialog({ payment, onClose, onDone }: { payment: AdminPayment; onClose: () => void; onDone: (message: string) => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await refundPayment(payment.id, reason);
      onDone(result.message);
    } catch (e) {
      setError(errorText(e, "The refund failed."));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={saving ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3">
        <h2 className="text-lg font-bold text-gray-900">Refund {payment.invoiceNumber}</h2>
        <p className="text-sm text-gray-700">
          Refund <strong>{money(payment.amount)}</strong> to {payment.customer?.email} via{" "}
          {GATEWAY_LABELS[payment.paymentMethod] || payment.paymentMethod}. This is a full refund and can't be undone.
        </p>
        <p className="text-sm text-amber-700">
          If this is the customer's latest payment, their account moves to the Free plan immediately.
        </p>
        <label className="block text-xs font-semibold text-gray-700">
          Reason (kept in the log)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="e.g. Customer request"
            className="mt-1 w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-normal"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? "Refunding…" : "Refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Staff view of every payment from both gateways, with totals and refunds.
export default function Payments() {
  const [filters, setFilters] = useState<PaymentFilters>({ gateway: "", status: "", search: "", from: "", to: "", page: 1 });
  const [search, setSearch] = useState("");
  const [data, setData] = useState<PaymentsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<AdminPayment | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    getAdminPayments(filters)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => !cancelled && setError(errorText(e, "Couldn't load payments.")));
    return () => { cancelled = true; };
  }, [filters, reloadKey]);

  const set = (patch: Partial<PaymentFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const t = data?.totals;
  const input = "h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-md text-gray-700 mt-0.5">PayPal and card (Stripe) payments, refunds and invoices</p>
      </div>

      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Received" value={money(t.received.amount)} sub={`${t.received.count} payments`} />
          <Stat label="Card (Stripe)" value={money(t.stripe.amount)} sub={`${t.stripe.count} payments`} />
          <Stat label="PayPal" value={money(t.paypal.amount)} sub={`${t.paypal.count} payments`} />
          <Stat label="Refunded" value={money(t.refunded.amount)} sub={`${t.refunded.count} refunds`} />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-2">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer or invoice" className={`flex-1 ${input}`} />
        <select value={filters.gateway} onChange={(e) => set({ gateway: e.target.value })} className={input}>
          <option value="">All gateways</option>
          <option value="stripe">Card (Stripe)</option>
          <option value="paypal">PayPal</option>
        </select>
        <select value={filters.status} onChange={(e) => set({ status: e.target.value })} className={input}>
          <option value="">Any status</option>
          <option value="success">Paid</option>
          <option value="refunded">Refunded</option>
          <option value="failed">Failed</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={input} aria-label="From date" />
        <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className={input} aria-label="To date" />
      </div>

      {notice && <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-xl">{notice}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      <div className="bg-white border border-gray-300 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Invoice</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Gateway</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>
            ) : data.payments.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">No payments match these filters.</td></tr>
            ) : (
              data.payments.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">{new Date(p.paidAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 font-semibold text-gray-900">{p.invoiceNumber || "—"}</td>
                  <td className="px-4 py-2">
                    <p className="text-gray-900">{p.customer?.name || "—"}</p>
                    <p className="text-xs text-gray-500">{p.customer?.email}</p>
                  </td>
                  <td className="px-4 py-2 capitalize">{p.planName || "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{GATEWAY_LABELS[p.paymentMethod] || p.paymentMethod}</td>
                  <td className="px-4 py-2 text-right font-semibold">{money(p.amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[p.status] || ""}`}>
                      {p.status === "success" ? "paid" : p.status}
                    </span>
                    {p.refundedAt && (
                      <p className="text-xs text-gray-400 mt-1" title={p.refundReason || undefined}>
                        {new Date(p.refundedAt).toLocaleDateString()}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => downloadInvoiceAsStaff(p.id, p.invoiceNumber).catch(() => setError("Couldn't download the invoice."))}
                      className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 mr-1"
                    >
                      Invoice
                    </button>
                    {p.refundable && (
                      <button
                        type="button"
                        onClick={() => setRefunding(p)}
                        className="h-8 px-3 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={data.page <= 1} onClick={() => set({ page: data.page - 1 })} className="h-8 px-3 rounded-lg border border-gray-200 disabled:opacity-40">Previous</button>
          <span className="text-gray-600">Page {data.page} of {data.pages}</span>
          <button type="button" disabled={data.page >= data.pages} onClick={() => set({ page: data.page + 1 })} className="h-8 px-3 rounded-lg border border-gray-200 disabled:opacity-40">Next</button>
        </div>
      )}

      {refunding && (
        <RefundDialog
          payment={refunding}
          onClose={() => setRefunding(null)}
          onDone={(message) => {
            setRefunding(null);
            setNotice(message);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
