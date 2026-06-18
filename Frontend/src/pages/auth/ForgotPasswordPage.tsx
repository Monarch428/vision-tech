import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import axios from "axios";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/api/auth/forgot-password", {
        email,
      });
      setSuccessMessage("Reset link sent! Check your inbox.");
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.message ||
          "Failed to send reset link. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#eef5ef] flex items-center justify-center px-4">
      <div className="w-full max-w-[90vw] sm:max-w-[480px] lg:max-w-[600px rounded-[24px] bg-white px-6 py-8 shadow-sm sm:px-8 md:px-10">
        <div className="mb-5 flex justify-center">
          <img
            src={logo}
            alt="newVISIONtech"
            className="h-12 w-auto object-contain sm:h-14"
          />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-black sm:text-2xl">
            Forgot Password
          </h1>
          <p className="mt-2 text-base text-gray-500 sm:text-md">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-base font-semibold text-black sm:text-lg">
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 w-full rounded-2xl bg-gray-100 px-5 text-base outline-none sm:h-12"
            />
          </div>

          {errorMessage && (
            <p className="text-sm font-medium text-red-500">{errorMessage}</p>
          )}
          {successMessage && (
            <p className="text-sm font-medium text-green-600">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-2xl bg-green-500 text-base font-semibold text-white transition hover:bg-green-600 disabled:opacity-70 sm:h-12 sm:text-lg"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full text-center text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800"
          >
            Back to Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
