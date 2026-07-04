import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import { registerUser } from "../../services/auth/auth.service";

interface FormState {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

const EMPTY_FORM: FormState = {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
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

    return errors;
}

export default function CreateAccountPage() {
    const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormState]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
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
            await registerUser({
                name: formData.name.trim(),
                email: formData.email.trim(),
                password: formData.password,
            });

            navigate("/login", {
                state: { message: "Account created successfully. Please sign in." },
            });
        } catch (error: any) {
            const res = error?.response?.data;
            setErrorMessage(res?.message || "Couldn't create account. Please try again.");
        } finally {
            setLoading(false);
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
            <div className="w-full max-w-full xs:max-w-sm sm:max-w-[420px]">
                <div className="bg-white rounded-2xl shadow-md px-4 py-5 xs:px-6 xs:py-6 sm:px-7 sm:py-6">

                    {/* Logo */}
                    <div className="flex justify-center mb-2 sm:mb-3">
                        <img
                            src={logo}
                            alt="newVISIONtech"
                            className="h-6 xs:h-7 sm:h-8 w-auto object-contain"
                        />
                    </div>

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
                </div>
            </div>
        </div>
    );
}