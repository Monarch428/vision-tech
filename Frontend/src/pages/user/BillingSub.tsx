import { useCallback, useEffect, useState } from "react";
import { capturePaypalOrder, createPaypalOrder, createSubscription, downloadInvoice, getMyInvoices, getMySubscription, updateSubscription } from "../../services/user/billingSub.service";
import {
  PayPalScriptProvider,
  PayPalButtons,
} from "@paypal/react-paypal-js";

interface Subscription {
  _id: string;
  sub_id: string;
  user: string;
  planName: "free" | "pro" | "enterprise";
  status: "active" | "paused" | "expired" | "cancelled";
  startDate: string;
  endDate: string | null;
  nextRenewalDate: string | null;
}

interface Invoice {
  _id: string;
  invoiceNumber?: string;
  amount: number;
  status: "success" | "failed" | "pending";
  paymentMethod: string;
  paidAt: string;
  user?: {
    _id: string;
    name: string;
    email: string;
  };
  subscription?: {
    _id: string;
    status?: string;
    plan?: {
      _id?: string;
      name?: string;
      price?: number;
      billingCycle?: string;
    };
  };
}

const PLANS = [
  {
    name: "free" as const,
    label: "Free",
    price: 0,
    display: "$0",
    period: "forever",
    color: "from-slate-400 to-slate-500",
    features: [
      "1 Device monitoring",
      "Basic support",
      "Self-help tools",
      "Community access",
    ],
  },
  {
    name: "pro" as const,
    label: "Pro",
    price: 49.99,
    display: "$49.99",
    period: "/month",
    color: "from-emerald-400 to-green-500",
    features: [
      "5 Devices monitoring",
      "Priority support – 10 hrs",
      "Antivirus services",
      "RMM included",
    ],
  },
  {
    name: "enterprise" as const,
    label: "Enterprise",
    price: 149.99,
    display: "$149.99",
    period: "/month",
    color: "from-violet-500 to-purple-600",
    features: [
      "Unlimited devices",
      "24/7 dedicated support",
      "Full antivirus suite",
      "Advanced RMM",
      "Custom integrations",
    ],
  },
];

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 49.99,
  enterprise: 149.99,
};

const CheckIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    className="animate-spin"
    width="16"
    height="16"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

// ─── Plan Change Wizard ───────────────────────────────────────────────────────

function PlanChangeWizard({
  targetPlan,
  currentSub,
  onConfirm,
  onClose,
}: {
  targetPlan: (typeof PLANS)[0];
  currentSub: Subscription | null;
  onConfirm: (activateNow: boolean) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [selected, setSelected] = useState<"now" | "later" | null>(null);

  const currentPrice = PLAN_PRICES[currentSub?.planName || "free"];
  const isDowngrade = targetPlan.price < currentPrice;

  const renewalDate = currentSub?.nextRenewalDate
    ? new Date(currentSub.nextRenewalDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    : "end of billing period";

  const daysLeft = currentSub?.nextRenewalDate
    ? Math.max(
      0,
      Math.ceil(
        (new Date(currentSub.nextRenewalDate).getTime() - Date.now()) /
        86400000,
      ),
    )
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[360px] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isDowngrade
                ? "bg-amber-50 text-amber-500"
                : "bg-green-50 text-green-500"
                }`}
            >
              {isDowngrade ? (
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                  <polyline points="17 18 23 18 23 12" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {isDowngrade ? "Downgrade" : "Upgrade"} to {targetPlan.label}
              </p>
              <p className="text-[11px] text-gray-400 leading-tight">
                {currentSub?.planName
                  ? currentSub.planName.charAt(0).toUpperCase() +
                  currentSub.planName.slice(1)
                  : "Free"}{" "}
                → {targetPlan.label} · {targetPlan.display}
                {targetPlan.period}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-2 flex-shrink-0"
          >
            <svg
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Step 1 – Choose */}
        {step === "choose" && (
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-gray-500">
              When should the{" "}
              <strong className="text-gray-800">{targetPlan.label} plan</strong>{" "}
              take effect?
            </p>

            <div
              onClick={() => setSelected("now")}
              className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${selected === "now"
                ? "border-green-500"
                : "border-gray-300 hover:border-gray-200"
                }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`w-[17px] h-[17px] rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${selected === "now" ? "border-green-500" : "border-gray-300"
                    }`}
                >
                  {selected === "now" && (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Activate now
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Current plan is cancelled immediately.{" "}
                    <span className="text-red-500 font-medium">No refund</span>{" "}
                    for unused days.
                  </p>
                </div>
              </div>
            </div>

            <div
              onClick={() => setSelected("later")}
              className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${selected === "later"
                ? "border-green-500"
                : "border-gray-300 hover:border-gray-200"
                }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`w-[17px] h-[17px] rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${selected === "later"
                    ? "border-green-500"
                    : "border-gray-300"
                    }`}
                >
                  {selected === "later" && (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Activate after current plan ends
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Keep your current plan until{" "}
                    <strong className="text-gray-700">{renewalDate}</strong>,
                    then switch automatically.
                  </p>
                </div>
              </div>
            </div>

            {selected === "now" && (
              <div className="flex gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
                <svg
                  width="13"
                  height="13"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  className="flex-shrink-0 mt-0.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-xs text-red-600 leading-relaxed">
                  Your{" "}
                  <strong>
                    {currentSub?.planName
                      ? currentSub.planName.charAt(0).toUpperCase() +
                      currentSub.planName.slice(1)
                      : "current"}
                  </strong>{" "}
                  plan will be cancelled immediately.
                  {daysLeft > 0 && (
                    <>
                      {" "}
                      You have <strong>{daysLeft} days</strong> remaining — no
                      refund will be issued.
                    </>
                  )}
                </p>
              </div>
            )}
            {selected === "later" && (
              <div className="flex gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                <svg
                  width="13"
                  height="13"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  className="flex-shrink-0 mt-0.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="text-xs text-blue-600 leading-relaxed">
                  No changes today. You'll keep full access until {renewalDate},
                  then {targetPlan.label} billing begins automatically.
                </p>
              </div>
            )}

            <button
              disabled={!selected}
              onClick={() => setStep("confirm")}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${selected
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2 – Confirm */}
        {step === "confirm" && (
          <div className="px-5 py-4 space-y-3">
            <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">New plan</span>
                <span className="font-semibold">
                  {targetPlan.label} · {targetPlan.display}
                  {targetPlan.period}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Activates</span>
                <span className="font-semibold">
                  {selected === "now" ? "Immediately" : renewalDate}
                </span>
              </div>
              {selected === "now" && (
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Refund</span>
                  <span className="font-semibold text-red-500">None</span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              {selected === "now"
                ? `Your current plan will be cancelled immediately with no refund. ${targetPlan.label} billing starts today.`
                : `You keep your current plan until ${renewalDate}. ${targetPlan.label} billing begins on that date.`}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setStep("choose")}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => onConfirm(selected === "now")}
                className="flex-[2] py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Confirm & Pay with PayPal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium ${type === "success" ? "bg-gray-900 text-white" : "bg-red-500 text-white"
        }`}
    >
      {type === "success" ? (
        <CheckIcon size={15} />
      ) : (
        <svg
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <svg
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function EmptyInvoices() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 mb-3">
        <svg
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-500">No invoices yet</p>
      <p className="text-xs text-gray-400 mt-1">
        Your payment history will appear here
      </p>
    </div>
  );
}

// ─── BillingSub Page ──────────────────────────────────────────────────────────

export default function BillingSub() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subLoading, setSubLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Wizard + PayPal state
  const [wizardPlan, setWizardPlan] = useState<(typeof PLANS)[0] | null>(null);
  const [activateNow, setActivateNow] = useState<boolean>(true);
  const [paypalPlan, setPaypalPlan] = useState<(typeof PLANS)[0] | null>(null);

  const stored = localStorage.getItem("user");
  const authUser = stored ? JSON.parse(stored) : null;

  const isPausedByAdmin = sub?.status === "paused";

  const showToast = (message: string, type: "success" | "error" = "success") =>
    setToast({ message, type });

  const isCancelled = sub?.status === "cancelled";
  const isWithinCancelledPeriod =
    sub?.status === "cancelled" && sub?.nextRenewalDate
      ? new Date() < new Date(sub.nextRenewalDate)
      : false;

  const displayStatus = subLoading
    ? "—"
    : isWithinCancelledPeriod
      ? "Deactivated"
      : sub?.status
        ? sub.status.charAt(0).toUpperCase() + sub.status.slice(1)
        : "None";

  const billingBadgeClass = isWithinCancelledPeriod
    ? "bg-red-100 text-red-700"
    : isCancelled
      ? "bg-amber-100 text-amber-700"
      : sub?.status === "active"
        ? "bg-green-100 text-green-700"
        : "bg-gray-100 text-gray-500";

  const daysRemaining = (date: string | null) => {
    if (!date) return 0;
    return Math.max(
      0,
      Math.ceil(
        (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const getNextBilling = () => {
    if (!sub?.startDate || sub.planName === "free") return "N/A";
    if (sub.nextRenewalDate) {
      return new Date(sub.nextRenewalDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    const start = new Date(sub.startDate);
    const next = new Date(start);
    const now = new Date();
    while (next <= now) next.setMonth(next.getMonth() + 1);
    return next.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  useEffect(() => {
    const container =
      document.querySelector("main") ||
      document.querySelector("[class*='overflow-y']") ||
      document.documentElement;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const getPlanActionType = (targetPlanName: string) => {
    const currentPrice = PLAN_PRICES[sub?.planName || "free"];
    const targetPrice = PLAN_PRICES[targetPlanName];
    if (targetPrice > currentPrice) return "upgrade";
    if (targetPrice < currentPrice) return "downgrade";
    return "same";
  };

  const handlePlanActionClick = (plan: (typeof PLANS)[0]) => {
    if (getPlanActionType(plan.name) === "same") return;
    setWizardPlan(plan);
  };

  const handleWizardConfirm = (now: boolean) => {
    setActivateNow(now);
    setPaypalPlan(wizardPlan);
    setWizardPlan(null);
  };

  const fetchSub = useCallback(async () => {
    try {
      setSubLoading(true);
      const data = await getMySubscription();
      setSub(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setSub(null);
      } else {
        showToast(
          err.response?.data?.message || "Could not load subscription",
          "error",
        );
      }
    } finally {
      setSubLoading(false);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      const data = await getMyInvoices();
      setInvoices(data);
    } catch {
      // silent
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSub();
    fetchInvoices();
  }, [fetchSub, fetchInvoices]);

  const handleCancel = async () => {
    if (
      !sub ||
      !window.confirm(
        "Are you sure? You can still use the plan until the billing period ends.",
      )
    )
      return;
    try {
      setCancelling(true);
      const data = await updateSubscription(sub._id, {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      });
      setSub(data);
      showToast("Subscription cancelled. Active until billing period ends.");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to cancel", "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    if (!sub) return;
    try {
      setReactivating(true);
      const data = await updateSubscription(sub._id, { status: "active" });
      setSub(data);
      showToast("Subscription reactivated successfully!");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to reactivate", "error");
    } finally {
      setReactivating(false);
    }
  };

  const handlePayPalSuccess = useCallback(async () => {
    if (!paypalPlan) throw new Error("No plan selected");

    let data: Subscription;

    if (!sub) {
      data = await createSubscription({
        user: authUser?._id || authUser?.id,
        planName: paypalPlan.name,
        startDate: new Date().toISOString(),
      });
    } else if (activateNow) {
      data = await updateSubscription(sub._id, {
        planName: paypalPlan.name,
        status: "active",
        cancelledAt: new Date().toISOString(),
      });
    } else {
      data = await updateSubscription(sub._id, {
        pendingPlanName: paypalPlan.name,
        status: sub.status,
      });
    }

    setSub(data);
    await fetchInvoices();
    showToast(
      activateNow
        ? `Successfully activated ${paypalPlan.label} plan!`
        : `${paypalPlan.label} plan scheduled — activates after your current plan ends.`,
    );
    setPaypalPlan(null);
  }, [paypalPlan, sub, activateNow, authUser, fetchInvoices]);

  const currentPlan = PLANS.find((p) => p.name === sub?.planName) || PLANS[0];

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {wizardPlan && (
        <PlanChangeWizard
          targetPlan={wizardPlan}
          currentSub={sub}
          onConfirm={handleWizardConfirm}
          onClose={() => setWizardPlan(null)}
        />
      )}

      {paypalPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPaypalPlan(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[400px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                Pay with PayPal
              </h3>
              <button
                onClick={() => setPaypalPlan(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              You're subscribing to the{" "}
              <strong>{paypalPlan.label}</strong> plan for{" "}
              <strong>{paypalPlan.display}/month</strong>
            </p>
            <PayPalScriptProvider
              options={{
                clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
                currency: "USD",
              }}
            >
              <PayPalButtons
                style={{ layout: "vertical", shape: "rect" }}
                createOrder={async () => {
                  const res = await createPaypalOrder(paypalPlan.price);
                  return res.id;
                }}
                onApprove={async (data) => {
                  await capturePaypalOrder(data.orderID);
                  await handlePayPalSuccess();
                }}
                onError={(err) => {
                  console.error("PayPal error", err);
                  showToast("PayPal payment failed. Please try again.", "error");
                }}
                onCancel={() => {
                  showToast("Payment cancelled.", "error");
                  setPaypalPlan(null);
                }}
              />
            </PayPalScriptProvider>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Header with back button */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Billing & Subscription
            </h1>
            <p className="text-md text-gray-700 mt-0.5">
              Manage your subscription and billing information
            </p>
          </div>
        </div>

        {/* Current Plan Summary */}
        <div className="bg-white border border-gray-700 rounded-2xl p-6">
          {subLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-5 bg-gray-100 rounded w-1/4" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {currentPlan.label} Plan
                  </p>
                  <p className="text-md text-gray-700">
                    Your current subscription · Started{" "}
                    {sub
                      ? new Date(sub.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                      : "—"}
                  </p>
                </div>
                <span
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${billingBadgeClass}`}
                >
                  {sub?.status === "active" && !isWithinCancelledPeriod && (
                    <CheckIcon />
                  )}
                  {displayStatus}
                </span>
              </div>

              {isCancelled && sub?.nextRenewalDate && (
                <div className="flex items-center justify-between gap-4 p-4 mb-5 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                      <svg
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        Plan deactivates on
                      </p>
                      <p className="text-xs text-amber-600 font-medium">
                        {new Date(sub.nextRenewalDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                        {" · "}
                        {daysRemaining(sub.nextRenewalDate)} days remaining
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleReactivate}
                    disabled={reactivating}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                  >
                    {reactivating && <SpinnerIcon />}
                    {reactivating ? "Reactivating..." : "Reactivate Plan"}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {[
                  {
                    label: "Monthly Cost",
                    value:
                      currentPlan.name === "free" ? "$0" : currentPlan.display,
                    bg: "bg-green-50 text-green-600",
                    icon: (
                      <svg
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    ),
                  },
                  {
                    label: isCancelled ? "Deactivates On" : "Next Billing Date",
                    value:
                      isCancelled && sub?.nextRenewalDate
                        ? new Date(sub.nextRenewalDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )
                        : getNextBilling(),
                    bg: isCancelled
                      ? "bg-amber-50 text-amber-600"
                      : "bg-blue-50 text-blue-600",
                    icon: (
                      <svg
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    ),
                  },
                  {
                    label: "Payment Method",
                    value:
                      invoices.length > 0
                        ? `via ${invoices[0].paymentMethod}`
                        : "N/A",
                    bg: "bg-purple-50 text-purple-600",
                    icon: (
                      <svg
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <rect x="1" y="4" width="22" height="16" rx="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                    ),
                  },
                ].map((item) => (
                  <div key={item.label} className="border rounded-lg">
                    <div
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl"
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bg}`}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-[14px] text-gray-700 font-medium">
                          {item.label}
                        </p>
                        <p className="text-sm font-bold text-gray-900">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!isCancelled ? (
                <div className="flex flex-wrap gap-2">
                  <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors">
                    Update Payment Method
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex items-center gap-2 px-4 py-2 border border-red-400 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {cancelling && <SpinnerIcon />}
                    {cancelling ? "Cancelling..." : "Cancel Subscription"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <svg
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    className="text-red-500 flex-shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      Subscription Cancelled
                    </p>
                    <p className="text-xs text-red-500">
                      Use "Reactivate Plan" above or select a new plan below
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Available Plans */}
        <div className="bg-white border border-gray-700 rounded-2xl p-6">
          <h2 className="text-base font-bold text-gray-900">Available Plans</h2>
          <p className="text-md text-gray-700 mb-5 mt-0.5">
            Choose the plan that fits your needs
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = sub?.planName === plan.name;
              const isCurrentDeactivated = isCurrent && isWithinCancelledPeriod;
              const isDisabled =
                isCurrent &&
                (sub?.status === "active" || isWithinCancelledPeriod);
              const isDowngrade =
                PLAN_PRICES[plan.name] < PLAN_PRICES[sub?.planName || "free"];

              return (
                <div
                  key={plan.name}
                  className={`relative p-5 rounded-2xl border-2 transition-all ${isCurrent && !isCancelled
                    ? "border-green-500 bg-green-50/30"
                    : isCurrent && isCancelled
                      ? "border-amber-300 bg-amber-50/20"
                      : "border-gray-300 bg-white hover:border-gray-700"
                    }`}
                >
                  {isCurrent && sub?.status === "active" && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">
                      Current
                    </span>
                  )}
                  {isCurrentDeactivated && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                      Deactivated
                    </span>
                  )}
                  {isCurrent && isCancelled && !isWithinCancelledPeriod && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                      Cancelled
                    </span>
                  )}

                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r ${plan.color} text-white text-xs font-semibold mb-3`}
                  >
                    {plan.label}
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold text-gray-900">
                      {plan.display}
                    </span>
                    <span className="text-xs text-gray-400">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-xs text-gray-600"
                      >
                        <span className="text-green-500 mt-0.5 flex-shrink-0">
                          <CheckIcon />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={isDisabled || isPausedByAdmin}
                    title={isPausedByAdmin ? "Disabled by admin" : ""}
                    onClick={() => {
                      if (isDisabled || isPausedByAdmin) return;
                      handlePlanActionClick(plan);
                    }}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${isPausedByAdmin
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : isDisabled
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : isCancelled
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : isDowngrade
                            ? "border-2 border-gray-300 text-gray-600 hover:bg-gray-50"
                            : "bg-green-500 hover:bg-green-600 text-white"
                      }`}
                  >
                    {isPausedByAdmin
                      ? "Paused by admin"
                      : isDisabled
                        ? "Current Plan"
                        : isCancelled
                          ? "Reactivate with PayPal"
                          : isDowngrade
                            ? "Downgrade"
                            : "Upgrade with PayPal"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invoice History */}
        <div className="bg-white border border-gray-700 rounded-2xl p-6">
          <h2 className="text-base font-bold text-gray-900">Invoice History</h2>
          <p className="text-xs text-gray-400 mb-5 mt-0.5">
            Your past invoices and payments
          </p>
          {invoicesLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-gray-400 rounded-xl" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <EmptyInvoices />
          ) : (
            <div className="space-y-3">
              {invoices.map((inv, index) => (
                <div
                  key={inv._id}
                  className="flex items-center gap-3 p-3.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center text-green-600 flex-shrink-0">
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <rect x="1" y="4" width="22" height="16" rx="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {inv.subscription?.plan?.name || "Plan"} Plan – Monthly
                    </p>
                    <p className="text-xs text-gray-400">
                      {inv.invoiceNumber ||
                        `INV-${String(index + 1).padStart(3, "0")}`}{" "}
                      ·{" "}
                      {new Date(inv.paidAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        ${inv.amount.toFixed(2)}
                      </p>
                      <span
                        className={`flex items-center justify-end gap-1 text-[11px] font-medium ${inv.status === "success"
                          ? "text-green-600"
                          : inv.status === "failed"
                            ? "text-red-500"
                            : "text-amber-500"
                          }`}
                      >
                        {inv.status === "success" && <CheckIcon />}
                        {inv.status}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        downloadInvoice(inv._id, inv.invoiceNumber).catch(
                          (err) => {
                            console.error("Invoice download failed:", err);
                          },
                        )
                      }
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                    >
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
