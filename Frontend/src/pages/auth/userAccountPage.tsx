import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import { registerUser, verifyOtp, resendOtp } from "../../services/auth/auth.service";

interface FormState {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    deviceName: string;
    serialNumber: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;
type Step = "form" | "otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

const EMPTY_FORM: FormState = {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    deviceName: "",
    serialNumber: "",
};

const HOSTNAME_COMMANDS: Record<"windows" | "mac" | "linux", { label: string; command: string; note: string }> = {
    windows: {
        label: "Windows",
        command: "hostname",
        note: "Open Command Prompt (search 'cmd' in the Start menu), paste the command, and press Enter. It should return your device's hostname.",
    },
    mac: {
        label: "macOS",
        command: "hostname",
        note: "Open Terminal (Cmd+Space, type 'Terminal'), paste the command, and press Enter. If you'd prefer the friendly device name instead, use 'scutil --get ComputerName'.",
    },
    linux: {
        label: "Linux",
        command: "hostname",
        note: "Open a terminal, paste the command, and press Enter.",
    },
};

// ── Serial number command reference ─────────────────────────────────────────
const SERIAL_COMMANDS: Record<"windows" | "mac" | "linux", { label: string; command: string; note: string }> = {
    windows: {
        label: "Windows",
        command: 'powershell -Command "(Get-CimInstance Win32_BIOS).SerialNumber"',
        note: "Open Command Prompt or PowerShell (search 'cmd' or 'powershell' in the Start menu), paste the command, and press Enter. It should return your device's serial number.",
    },
    mac: {
        label: "macOS",
        command: "system_profiler SPHardwareDataType | awk '/Serial/ {print $4}'",
        note: "Open Terminal (Cmd+Space, type 'Terminal'), paste the command, and press Enter. It should return your Mac's serial number.",
    },
    linux: {
        label: "Linux",
        command: "sudo dmidecode -s system-serial-number",
        note: "Open a terminal, paste the command, and press Enter (you may be prompted for your password). If dmidecode isn't available, try 'cat /sys/class/dmi/id/product_serial' with sudo instead.",
    },
};

function validate(form: FormState): FieldErrors {
    const errors: FieldErrors = {};

    if (!form.name.trim()) errors.name = "Full name is required.";
    else if (form.name.trim().length < 2)
        errors.name = "Name must be at least 2 characters.";

    if (!form.email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email.trim()))
        errors.email = "Enter a valid email address.";

    if (!form.password) errors.password = "Password is required.";
    else if (form.password.length < MIN_PASSWORD_LENGTH)
        errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

    if (!form.confirmPassword)
        errors.confirmPassword = "Please confirm your password.";
    else if (form.password !== form.confirmPassword)
        errors.confirmPassword = "Passwords do not match.";

    if (!form.deviceName.trim())
        errors.deviceName = "Please enter your device's name.";

    if (!form.serialNumber.trim())
        errors.serialNumber = "Please enter your device's serial number.";

    return errors;
}

export default function CreateAccountPage() {
    const [step, setStep] = useState<Step>("form");
    const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();

    // ── Hostname command reference state ────────────────────────────────────
    const [activeOS, setActiveOS] = useState<"windows" | "mac" | "linux">("windows");
    const [copied, setCopied] = useState(false);
    const activeCommand = HOSTNAME_COMMANDS[activeOS];

    // ── Serial number command reference state ───────────────────────────────
    const [activeSerialOS, setActiveSerialOS] = useState<"windows" | "mac" | "linux">("windows");
    const [serialCopied, setSerialCopied] = useState(false);
    const activeSerialCommand = SERIAL_COMMANDS[activeSerialOS];

    // ── OTP step state ──────────────────────────────────────────────────────
    const [otp, setOtp] = useState("");
    const [otpError, setOtpError] = useState("");
    const [otpLoading, setOtpLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMessage, setResendMessage] = useState("");
    const otpInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (step === "otp") otpInputRef.current?.focus();
    }, [step]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormState]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const handleCopyCommand = async () => {
        try {
            await navigator.clipboard.writeText(activeCommand.command);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    const handleCopySerialCommand = async () => {
        try {
            await navigator.clipboard.writeText(activeSerialCommand.command);
            setSerialCopied(true);
            setTimeout(() => setSerialCopied(false), 2000);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorMessage("");

        const validationErrors = validate(formData);
        if (Object.keys(validationErrors).length) {
            setErrors(validationErrors);
            return;
        }

        setLoading(true);
        try {
            const res = await registerUser({
                name: formData.name.trim(),
                email: formData.email.trim(),
                password: formData.password,
                source: "usercreated",
                deviceName: formData.deviceName.trim() ? [formData.deviceName.trim()] : [],
                serialNumber: formData.serialNumber.trim() ? [formData.serialNumber.trim()] : []
            });

            if (res?.requiresOtp) {
                setStep("otp");
                setResendCooldown(RESEND_COOLDOWN_SECONDS);
            } else {
                // fallback in case OTP is ever disabled server-side
                navigate("/login", {
                    state: { message: "Account created successfully. Please sign in." },
                });
            }
        } catch (error: any) {
            const res = error?.response?.data;
            setErrorMessage(res?.message || "Couldn't create account. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
        setOtp(digitsOnly);
        if (otpError) setOtpError("");
    };

    const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setOtpError("");

        if (otp.length !== OTP_LENGTH) {
            setOtpError(`Enter the ${OTP_LENGTH}-digit code sent to your email.`);
            return;
        }

        setOtpLoading(true);
        try {
            await verifyOtp({ email: formData.email.trim(), otp });

            navigate("/login", {
                state: { message: "Account verified successfully. Please sign in." },
            });
        } catch (error: any) {
            const res = error?.response?.data;
            setOtpError(res?.message || "Invalid or expired code. Please try again.");
        } finally {
            setOtpLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendCooldown > 0 || resendLoading) return;
        setResendMessage("");
        setOtpError("");
        setResendLoading(true);
        try {
            await resendOtp({ email: formData.email.trim() });
            setResendMessage("A new code has been sent to your email.");
            setResendCooldown(RESEND_COOLDOWN_SECONDS);
        } catch (error: any) {
            const res = error?.response?.data;
            setOtpError(res?.message || "Couldn't resend code. Please try again.");
        } finally {
            setResendLoading(false);
        }
    };

    const inputCls = (err?: string) => `
    w-full rounded-xl border bg-gray-100
    px-3 outline-none h-7 text-xs xs:h-10 sm:h-10 sm:px-4
    transition-all duration-200
    ${err
            ? "border-red-400 bg-red-50 focus:border-red-500"
            : "border-gray-200 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
        }
  `;

    return (
        <div className="min-h-screen w-full bg-[#eef5ef] flex items-center justify-center p-4">
            <div className="w-full max-w-full xs:max-w-sm sm:max-w-[460px]">
                <div className="bg-white rounded-2xl shadow-md px-4 py-5 xs:px-6 xs:py-6 sm:px-7 sm:py-6">

                    {/* Logo */}
                    <div className="flex justify-center mb-2 sm:mb-3">
                        <img
                            src={logo}
                            alt="newVISIONtech"
                            className="h-6 xs:h-7 sm:h-8 w-auto object-contain"
                        />
                    </div>

                    {step === "form" ? (
                        <>
                            {/* Heading */}
                            <div className="text-center mb-4 sm:mb-5">
                                <h1 className="text-md xs:text-xl sm:text-xl font-semibold text-black leading-tight">
                                    Create your account
                                </h1>
                                <p className="mt-0.5 text-[11px] xs:text-xs sm:text-sm text-gray-500">
                                    Sign up to get started with SOLO
                                </p>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-2.5">

                                {/* Full Name */}
                                <div>
                                    <label className="block mb-1 text-xs sm:text-sm font-semibold text-black">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className={inputCls(errors.name)}
                                    />
                                    {errors.name && (
                                        <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>
                                    )}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block mb-1 text-xs sm:text-sm font-semibold text-black">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="your@email.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={inputCls(errors.email)}
                                    />
                                    {errors.email && (
                                        <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>
                                    )}
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block mb-1 text-xs sm:text-sm font-semibold text-black">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={inputCls(errors.password)}
                                    />
                                    {errors.password && (
                                        <p className="mt-1 text-[11px] text-red-500">{errors.password}</p>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="block mb-1 text-xs sm:text-sm font-semibold text-black">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        placeholder="Re-enter your password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className={inputCls(errors.confirmPassword)}
                                    />
                                    {errors.confirmPassword && (
                                        <p className="mt-1 text-[11px] text-red-500">{errors.confirmPassword}</p>
                                    )}
                                </div>

                                {/* ── Device Name ─────────────────────────────────────────── */}
                                <div className="pt-1">
                                    <label className="block mb-1 text-xs sm:text-sm font-semibold text-black">
                                        Device Name
                                    </label>
                                    <p className="text-[11px] xs:text-xs text-gray-500 mb-2">
                                        This helps us match your device to your antivirus records.
                                        Run the command below, then paste the result.
                                    </p>

                                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-2">
                                        {(Object.keys(HOSTNAME_COMMANDS) as Array<keyof typeof HOSTNAME_COMMANDS>).map((os) => (
                                            <button
                                                key={os}
                                                type="button"
                                                onClick={() => setActiveOS(os)}
                                                className={`px-3 py-1 rounded-md text-[11px] xs:text-xs font-semibold transition-colors ${
                                                    activeOS === os ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                                                }`}
                                            >
                                                {HOSTNAME_COMMANDS[os].label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="bg-gray-900 text-gray-100 rounded-lg p-2.5 font-mono text-[11px] xs:text-xs flex items-center justify-between gap-2 mb-1.5">
                                        <code className="break-all">{activeCommand.command}</code>
                                        <button
                                            type="button"
                                            onClick={handleCopyCommand}
                                            className="text-[11px] xs:text-xs font-semibold text-green-400 hover:text-green-300 shrink-0"
                                        >
                                            {copied ? "Copied!" : "Copy"}
                                        </button>
                                    </div>

                                    <p className="text-[10px] xs:text-[11px] text-gray-500 mb-2">
                                        {activeCommand.note}
                                    </p>

                                    <input
                                        type="text"
                                        name="deviceName"
                                        placeholder="e.g. DESKTOP-4J8K2QP"
                                        value={formData.deviceName}
                                        onChange={handleChange}
                                        className={inputCls(errors.deviceName)}
                                    />
                                    {errors.deviceName && (
                                        <p className="mt-1 text-[11px] text-red-500">{errors.deviceName}</p>
                                    )}
                                </div>

                                {/* ── Serial Number ───────────────────────────────────────── */}
                                <div className="pt-1">
                                    <label className="block mb-1 text-xs sm:text-sm font-semibold text-black">
                                        Serial Number
                                    </label>
                                    <p className="text-[11px] xs:text-xs text-gray-500 mb-2">
                                        This helps us uniquely identify your device. Run the
                                        command below, then paste the result.
                                    </p>

                                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-2">
                                        {(Object.keys(SERIAL_COMMANDS) as Array<keyof typeof SERIAL_COMMANDS>).map((os) => (
                                            <button
                                                key={os}
                                                type="button"
                                                onClick={() => setActiveSerialOS(os)}
                                                className={`px-3 py-1 rounded-md text-[11px] xs:text-xs font-semibold transition-colors ${
                                                    activeSerialOS === os ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                                                }`}
                                            >
                                                {SERIAL_COMMANDS[os].label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="bg-gray-900 text-gray-100 rounded-lg p-2.5 font-mono text-[11px] xs:text-xs flex items-center justify-between gap-2 mb-1.5">
                                        <code className="break-all">{activeSerialCommand.command}</code>
                                        <button
                                            type="button"
                                            onClick={handleCopySerialCommand}
                                            className="text-[11px] xs:text-xs font-semibold text-green-400 hover:text-green-300 shrink-0"
                                        >
                                            {serialCopied ? "Copied!" : "Copy"}
                                        </button>
                                    </div>

                                    <p className="text-[10px] xs:text-[11px] text-gray-500 mb-2">
                                        {activeSerialCommand.note}
                                    </p>

                                    <input
                                        type="text"
                                        name="serialNumber"
                                        placeholder="e.g. 5CD1234ABC"
                                        value={formData.serialNumber}
                                        onChange={handleChange}
                                        className={inputCls(errors.serialNumber)}
                                    />
                                    {errors.serialNumber && (
                                        <p className="mt-1 text-[11px] text-red-500">{errors.serialNumber}</p>
                                    )}
                                </div>

                                {/* Error */}
                                {errorMessage && (
                                    <p className="text-[11px] xs:text-xs font-medium text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">
                                        {errorMessage}
                                    </p>
                                )}

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="
                    w-full rounded-xl bg-green-500 font-semibold text-white
                    h-7 text-sm xs:h-10 sm:h-10
                    transition-all duration-200
                    hover:bg-green-600 active:scale-[0.98]
                    disabled:cursor-not-allowed disabled:opacity-70
                  "
                                >
                                    {loading ? "Creating Account..." : "Create Account"}
                                </button>
                            </form>

                            {/* Back to sign in */}
                            <p className="text-center text-[11px] xs:text-xs sm:text-sm text-gray-500 mt-4">
                                Already have an account?{" "}
                                <button
                                    type="button"
                                    onClick={() => navigate("/login")}
                                    className="text-blue-600 underline underline-offset-2 hover:text-blue-800 transition-colors font-medium"
                                >
                                    Sign in
                                </button>
                            </p>
                        </>
                    ) : (
                        <>
                            {/* OTP heading */}
                            <div className="text-center mb-4 sm:mb-5">
                                <h1 className="text-md xs:text-xl sm:text-xl font-semibold text-black leading-tight">
                                    Verify your email
                                </h1>
                                <p className="mt-0.5 text-[11px] xs:text-xs sm:text-sm text-gray-500">
                                    Enter the {OTP_LENGTH}-digit code sent to{" "}
                                    <span className="font-medium text-black">{formData.email}</span>
                                </p>
                            </div>

                            <form onSubmit={handleVerifyOtp} className="space-y-2.5">
                                <div>
                                    <label className="block mb-1 text-xs sm:text-sm font-semibold text-black">
                                        Verification Code
                                    </label>
                                    <input
                                        ref={otpInputRef}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="123456"
                                        value={otp}
                                        onChange={handleOtpChange}
                                        className={`${inputCls(otpError)} text-center tracking-[0.5em] font-semibold`}
                                    />
                                    {otpError && (
                                        <p className="mt-1 text-[11px] text-red-500">{otpError}</p>
                                    )}
                                </div>

                                {resendMessage && (
                                    <p className="text-[11px] xs:text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                                        {resendMessage}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={otpLoading}
                                    className="
                    w-full rounded-xl bg-green-500 font-semibold text-white
                    h-7 text-sm xs:h-10 sm:h-10
                    transition-all duration-200
                    hover:bg-green-600 active:scale-[0.98]
                    disabled:cursor-not-allowed disabled:opacity-70
                  "
                                >
                                    {otpLoading ? "Verifying..." : "Verify & Continue"}
                                </button>
                            </form>

                            <p className="text-center text-[11px] xs:text-xs sm:text-sm text-gray-500 mt-4">
                                Didn't get a code?{" "}
                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={resendCooldown > 0 || resendLoading}
                                    className="text-blue-600 underline underline-offset-2 hover:text-blue-800 transition-colors font-medium disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                                >
                                    {resendLoading
                                        ? "Sending..."
                                        : resendCooldown > 0
                                            ? `Resend in ${resendCooldown}s`
                                            : "Resend code"}
                                </button>
                            </p>

                            <p className="text-center text-[11px] xs:text-xs sm:text-sm text-gray-500 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setStep("form")}
                                    className="text-gray-500 underline underline-offset-2 hover:text-gray-700 transition-colors"
                                >
                                    Back to edit details
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}