import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import logo from "../../assets/logo.png";
import { verifyOtp, resendOtp } from "../../services/auth/auth.service";

export default function OtpVerificationPage() {
    const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [resendCooldown, setResendCooldown] = useState(60);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const email: string = location.state?.email ?? "";
    const name: string = location.state?.name ?? "there";

    // Guard — no email means they didn't come through login
    useEffect(() => {
        if (!email) {
            console.warn("No email in state:", location.state); // ← add this
            navigate("/login", { replace: true });
            return;
        }
        startCooldown();
        inputRefs.current[0]?.focus();
        return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
    }, []);

    const maskedEmail = email
        ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) =>
            a + "*".repeat(Math.min(b.length, 5)) + c)
        : "";

    const startCooldown = () => {
        setResendCooldown(60);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
            setResendCooldown((prev) => {
                if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const handleChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, "").slice(-1);
        const updated = [...otp];
        updated[index] = digit;
        setOtp(updated);
        setErrorMessage("");
        if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0)
            inputRefs.current[index - 1]?.focus();
        if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
        if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!pasted) return;
        const updated = [...otp];
        pasted.split("").forEach((char, i) => { updated[i] = char; });
        setOtp(updated);
        inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const code = otp.join("");
        if (code.length < 6) {
            setErrorMessage("Please enter the complete 6-digit code.");
            return;
        }
        setLoading(true);
        setErrorMessage("");
        try {
            const data = await verifyOtp({ email, otp: code });

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            Cookies.set("user", JSON.stringify(data.user), { expires: 7, path: "/" });

            navigate("/user/dashboard", { replace: true });

        } catch (error: any) {
            const res = error?.response?.data;
            setErrorMessage(res?.message || "Invalid OTP. Please try again.");
            setOtp(Array(6).fill(""));
            inputRefs.current[0]?.focus();

            // Session dead — kick back to login
            if (error?.response?.status === 410 || error?.response?.status === 429) {
                setTimeout(() => navigate("/login", { replace: true }), 2500);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || resending) return;
        setResending(true);
        setErrorMessage("");
        setSuccessMessage("");
        try {
            await resendOtp({ email });
            setSuccessMessage("A new code has been sent to your email.");
            startCooldown();
            setOtp(Array(6).fill(""));
            inputRefs.current[0]?.focus();
        } catch (error: any) {
            const res = error?.response?.data;
            setErrorMessage(res?.message || "Failed to resend OTP. Please try again.");
            if (error?.response?.status === 401) {
                setTimeout(() => navigate("/login", { replace: true }), 2500);
            }
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#eef5ef] flex items-center justify-center p-4">
            <div className="w-full max-w-full xs:max-w-sm sm:max-w-[420px]">
                <div className="bg-white rounded-2xl shadow-md px-4 py-5 xs:px-6 xs:py-6 sm:px-7 sm:py-6">

                    {/* Logo */}
                    <div className="flex justify-center mb-2 sm:mb-3">
                        <img src={logo} alt="SOLO" className="h-6 xs:h-7 sm:h-8 w-auto object-contain" />
                    </div>

                    {/* Email icon badge */}
                    <div className="flex justify-center mb-3">
                        <div className="w-12 h-12 rounded-full bg-green-50 border-2 border-green-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                    </div>

                    {/* Heading */}
                    <div className="text-center mb-4 sm:mb-5">
                        <h1 className="text-md xs:text-xl sm:text-xl font-semibold text-black leading-tight">
                            Verify your identity
                        </h1>
                        <p className="mt-1 text-[11px] xs:text-xs sm:text-sm text-gray-500 leading-relaxed">
                            Hi <span className="font-semibold text-gray-700">{name}</span>, we sent a 6-digit code to
                        </p>
                        <p className="text-[11px] xs:text-xs sm:text-sm font-semibold text-green-600">
                            {maskedEmail || "your email"}
                        </p>
                    </div>

                    {/* OTP Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* OTP Boxes */}
                        <div className="flex justify-center gap-2 xs:gap-2.5">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => { inputRefs.current[index] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    onPaste={handlePaste}
                                    className="
                    w-9 h-10 xs:w-10 xs:h-11 sm:w-11 sm:h-12
                    text-center text-base xs:text-lg font-bold text-black
                    rounded-xl border-2 bg-gray-100 outline-none
                    transition-all duration-200 border-gray-200
                    focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100
                    caret-green-500
                  "
                                />
                            ))}
                        </div>

                        {/* Success */}
                        {successMessage && (
                            <p className="text-[11px] xs:text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-center">
                                ✅ {successMessage}
                            </p>
                        )}

                        {/* Error */}
                        {errorMessage && (
                            <p className="text-[11px] xs:text-xs font-medium text-red-500 bg-red-50 px-3 py-1.5 rounded-lg text-center">
                                {errorMessage}
                            </p>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading || otp.join("").length < 6}
                            className="
                w-full rounded-xl bg-green-500 font-semibold text-white
                h-7 text-sm xs:h-10 sm:h-10
                transition-all duration-200
                hover:bg-green-600 active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-70
              "
                        >
                            {loading ? "Verifying..." : "Verify OTP"}
                        </button>
                    </form>

                    {/* Resend */}
                    <div className="mt-3 text-center">
                        <p className="text-[11px] xs:text-xs text-gray-500">
                            Didn't receive the code?{" "}
                            {resendCooldown > 0 ? (
                                <span className="text-gray-400 font-medium">Resend in {resendCooldown}s</span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={resending}
                                    className="text-blue-600 underline underline-offset-2 hover:text-blue-800 transition-colors font-medium disabled:opacity-50"
                                >
                                    {resending ? "Sending..." : "Resend OTP"}
                                </button>
                            )}
                        </p>
                    </div>

                    {/* Back to login */}
                    <div className="mt-2 text-center">
                        <button
                            type="button"
                            onClick={() => navigate("/login")}
                            className="text-[11px] xs:text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            ← Back to Sign In
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}