import { useEffect, useState } from "react";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react";
import {
  getUserById,
  updateUser,
} from "../../services/admin/userManagement.service";
import { jwtDecode } from "jwt-decode";

export default function Profile() {

  const [user, setUser] = useState({
    id: "",
    name: "",
    email: "",
  });

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  localStorage.getItem("user");
  localStorage.getItem("token")
  Object.keys(localStorage)

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("No token found in localStorage.");
      return;
    }

    let userId: string | undefined;
    try {
      const decoded: any = jwtDecode(token);
      userId = decoded.id ?? decoded._id ?? decoded.userId ?? decoded.sub;
    } catch (err) {
      console.error("Failed to decode token:", err);
      return;
    }

    if (!userId) {
      console.error("Could not find a user id in the decoded token.");
      return;
    }

    try {
      const res = await getUserById(userId);
      const data = res.data.data ?? res.data;
      setUser({
        id: data.id ?? data._id,
        name: data.name,
        email: data.email,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      alert("Please fill all fields.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await updateUser(user.id, {
        name: user.name,
        email: user.email,
        currentPassword: form.currentPassword,
        password: form.newPassword,
      });

      alert("Password changed successfully.");

      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      console.error(err);
      alert("Unable to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow border p-8">

        <h1 className="text-3xl font-bold mb-8">My Profile</h1>

        {/* Name */}
        <div className="mb-5">
          <label className="font-semibold block mb-2">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              value={user.name}
              readOnly
              className="w-full border rounded-lg pl-10 py-3 bg-gray-100"
            />
          </div>
        </div>

        {/* Email */}
        <div className="mb-5">
          <label className="font-semibold block mb-2">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              value={user.email}
              readOnly
              className="w-full border rounded-lg pl-10 py-3 bg-gray-100"
            />
          </div>
        </div>

        {/* Current Password */}
        <div className="mb-5">
          <label className="font-semibold block mb-2">Current Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type={showCurrent ? "text" : "password"}
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              className="w-full border rounded-lg pl-10 pr-10 py-3"
            />
            <button
              type="button"
              className="absolute right-3 top-3"
              onClick={() => setShowCurrent(!showCurrent)}
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="mb-5">
          <label className="font-semibold block mb-2">New Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type={showNew ? "text" : "password"}
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              className="w-full border rounded-lg pl-10 pr-10 py-3"
            />
            <button
              type="button"
              className="absolute right-3 top-3"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="mb-8">
          <label className="font-semibold block mb-2">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full border rounded-lg pl-10 pr-10 py-3"
            />
            <button
              type="button"
              className="absolute right-3 top-3"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-green-600 text-white px-6 py-3 rounded-lg"
        >
          {loading ? "Changing..." : "Change Password"}
        </button>

      </div>
    </div>
  );
}