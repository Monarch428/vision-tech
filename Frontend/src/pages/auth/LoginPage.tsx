import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, loginTimer } from "../../services/auth/authService";
import { setupAutoLogout, clearAutoLogout } from "../../utils/auth";
import logo from "../../assets/logo.png";
import { jwtDecode } from "jwt-decode";

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [maxAttempts, setMaxAttempts] = useState<number>(10);

  const [locked, setLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  // Redirect if already logged in with valid token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const decoded: any = jwtDecode(token);
      if (decoded.exp * 1000 > Date.now())
        navigate("/user/dashboard", { replace: true });
    } catch {
      localStorage.removeItem("token");
    }
  }, []);

  // Check lock status when email changes (debounced)
  useEffect(() => {
    if (!formData.email) return;

    const check = async () => {
      try {
        const data = await loginTimer(formData.email);
        if (data.locked && data.lockUntil) {
          startLockCountdown(new Date(data.lockUntil).getTime());
        } else {
          setLocked(false);
          setAttemptsLeft(data.attemptsLeft);
          setMaxAttempts(data.maxAttempts);
        }
      } catch {}
    };

    const debounce = setTimeout(check, 600);
    return () => clearTimeout(debounce);
  }, [formData.email]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startLockCountdown = (lockUntilMs: number) => {
    setLocked(true);
    if (countdownRef.current) clearInterval(countdownRef.current);

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((lockUntilMs - Date.now()) / 1000),
      );
      setLockCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setLocked(false);
        setAttemptsLeft(5);
        setAttemptsLeft(maxAttempts);
        setErrorMessage("");
      }
    };

    update();
    countdownRef.current = setInterval(update, 1000);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (locked) return;
    setErrorMessage("");
    setLoading(true);

    try {
      const data = await loginUser(formData);
      clearAutoLogout();
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setupAutoLogout(); // ← arm inactivity timer right after login
      navigate("/user/dashboard");
    } catch (error: any) {
      const res = error?.response?.data;

      if (res?.locked) {
        startLockCountdown(new Date(res.lockUntil).getTime());
        setErrorMessage(
          "Too many failed attempts. Account locked for 10 minutes.",
        );
      } else {
        setAttemptsLeft(res?.attemptsLeft ?? null);
        setErrorMessage(res?.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#eef5ef] flex items-center justify-center px-3 py-3 sm:px-6 sm:py-8">
      <div className="w-full max-w-[460px]">
        <div className="bg-white rounded-2xl shadow-md px-4 py-4 sm:px-8 sm:py-7">
          {/* Logo */}
          <div className="flex justify-center mb-2 sm:mb-3">
            <img
              src={logo}
              alt="newVISIONtech"
              className="h-6 sm:h-9 w-auto object-contain"
            />
          </div>

          {/* Heading */}
          <div className="text-center mb-3 sm:mb-4">
            <h1 className="text-base sm:text-2xl font-semibold text-black leading-tight">
              Welcome to SOLO
            </h1>
            <p className="mt-0.5 text-[11px] sm:text-sm text-gray-500">
              Sign in to access your dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
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
                required
                className="w-full h-8 sm:h-10 rounded-xl border border-gray-200 bg-gray-100 px-3 sm:px-4 text-xs sm:text-sm outline-none transition-all duration-200 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block mb-1 text-xs sm:text-sm font-semibold text-black">
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={locked}
                className="w-full h-8 sm:h-10 rounded-xl border border-gray-200 bg-gray-100 px-3 sm:px-4 text-xs sm:text-sm outline-none transition-all duration-200 focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="mt-1 text-right">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-[11px] sm:text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Attempts warning */}
            {!locked && attemptsLeft !== null && attemptsLeft < maxAttempts && (
              <p className="text-[11px] font-medium text-orange-500 bg-orange-50 px-3 py-1.5 rounded-lg">
                ⚠️ {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} left
                before account is locked.
              </p>
            )}

            {/* Lock countdown */}
            {locked && (
              <div className="text-center bg-red-50 border border-red-200 rounded-lg px-3 py-3">
                <p className="text-xs font-semibold text-red-600">
                  🔒 Account Locked
                </p>
                <p className="text-2xl font-bold text-red-500 mt-1">
                  {formatCountdown(lockCountdown)}
                </p>
                <p className="text-[11px] text-red-400 mt-0.5">
                  Try again when the timer reaches 00:00
                </p>
              </div>
            )}

            {/* Error */}
            {errorMessage && !locked && (
              <p className="text-[11px] font-medium text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">
                {errorMessage}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || locked}
              className="w-full h-8 sm:h-10 rounded-xl bg-green-500 text-xs sm:text-sm font-semibold text-white transition-all duration-200 hover:bg-green-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading
                ? "Signing In..."
                : locked
                  ? `Locked (${formatCountdown(lockCountdown)})`
                  : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
