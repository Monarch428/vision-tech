import { useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "../../assets/logo.png";
import { resetPassword } from "../../services/auth/auth.service";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccessMessage("Password updated. Redirecting to sign in…");
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (error) {
      const apiMessage = isAxiosError(error) ? error.response?.data?.message : undefined;
      setErrorMessage(apiMessage || "Could not reset password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-12 w-full rounded-2xl bg-gray-100 px-5 text-base outline-none sm:h-12";

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#eef5ef] flex items-center justify-center px-4">
      <div className="w-full max-w-[90vw] sm:max-w-[480px] lg:max-w-[600px] rounded-[24px] bg-white px-6 py-8 shadow-sm sm:px-8 md:px-10">
        <div className="mb-5 flex justify-center">
          <img
            src={logo}
            alt="newVISIONtech"
            className="h-12 w-auto object-contain sm:h-14"
          />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-black sm:text-2xl">
            Set a New Password
          </h1>
          <p className="mt-2 text-base text-gray-700 sm:text-md">
            Choose a new password for your account
          </p>
        </div>

        {!token ? (
          <div className="space-y-4 text-center">
            <p className="text-sm font-medium text-red-500">
              This reset link is invalid. Please request a new one.
            </p>
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="h-12 w-full rounded-2xl bg-green-500 text-base font-semibold text-white transition hover:bg-green-600"
            >
              Request New Link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-base font-semibold text-black sm:text-lg">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-2 block text-base font-semibold text-black sm:text-lg">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={inputClass}
              />
            </div>

            {errorMessage && (
              <p className="text-sm font-medium text-red-500">{errorMessage}</p>
            )}
            {successMessage && (
              <p className="text-sm font-medium text-green-600">{successMessage}</p>
            )}

            <button
              type="submit"
              disabled={loading || Boolean(successMessage)}
              className="h-12 w-full rounded-2xl bg-green-500 text-base font-semibold text-white transition hover:bg-green-600 disabled:opacity-70 sm:h-12 sm:text-lg"
            >
              {loading ? "Saving..." : "Reset Password"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full text-center text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800"
            >
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
