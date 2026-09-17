import { useEffect, useState } from "react";
import { Eye, EyeOff, User, Mail, Lock, Monitor, HelpCircle, Hash, X, Plus } from "lucide-react";
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

  const [deviceNames, setDeviceNames] = useState<string[]>([]);
  const [deviceNameInput, setDeviceNameInput] = useState("");
  const [showDeviceHelp, setShowDeviceHelp] = useState(false);

  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [serialNumberInput, setSerialNumberInput] = useState("");
  const [showServiceHelp, setShowServiceHelp] = useState(false);

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

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
      setDeviceNames(data.deviceNames ?? []);
      setSerialNumbers(data.serialNumbers ?? []);
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

  // ── Device names (multi) ──────────────────────────────────────────────
  const addDeviceName = () => {
    const value = deviceNameInput.trim();
    if (!value) return;
    if (deviceNames.some((d) => d.toLowerCase() === value.toLowerCase())) {
      setDeviceNameInput("");
      return;
    }
    setDeviceNames([...deviceNames, value]);
    setDeviceNameInput("");
  };

  const removeDeviceName = (value: string) => {
    setDeviceNames(deviceNames.filter((d) => d !== value));
  };

  const handleDeviceNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addDeviceName();
    }
  };

  // ── Serial numbers (multi) ────────────────────────────────────────────
  const addSerialNumber = () => {
    const value = serialNumberInput.trim();
    if (!value) return;
    if (serialNumbers.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSerialNumberInput("");
      return;
    }
    setSerialNumbers([...serialNumbers, value]);
    setSerialNumberInput("");
  };

  const removeSerialNumber = (value: string) => {
    setSerialNumbers(serialNumbers.filter((s) => s !== value));
  };

  const handleSerialNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSerialNumber();
    }
  };

  const handleSubmit = async () => {
  const wantsPasswordChange =
    form.currentPassword || form.newPassword || form.confirmPassword;

  if (wantsPasswordChange) {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      alert("Please fill all password fields.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
  }

  // Pick up values still typed in the input
  const pendingDeviceName = deviceNameInput.trim();
  const finalDeviceNames = pendingDeviceName
    ? Array.from(new Set([...deviceNames, pendingDeviceName]))
    : deviceNames;

  const pendingSerialNumber = serialNumberInput.trim();
  const finalSerialNumbers = pendingSerialNumber
    ? Array.from(new Set([...serialNumbers, pendingSerialNumber]))
    : serialNumbers;

  // REQUIRED VALIDATION
  if (finalDeviceNames.length === 0) {
    alert("Please add at least one device name.");
    return;
  }

  if (finalSerialNumbers.length === 0) {
    alert("Please add at least one serial number.");
    return;
  }

  try {
    setLoading(true);

    const payload: Record<string, any> = {
      name: user.name,
      email: user.email,
      deviceNames: finalDeviceNames,
      serialNumbers: finalSerialNumbers,
    };

    if (wantsPasswordChange) {
      payload.currentPassword = form.currentPassword;
      payload.password = form.newPassword;
    }

    await updateUser(user.id, payload);

    setDeviceNames(finalDeviceNames);
    setDeviceNameInput("");
    setSerialNumbers(finalSerialNumbers);
    setSerialNumberInput("");

    alert(
      wantsPasswordChange
        ? "Profile updated and password changed."
        : "Profile updated."
    );

    setForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  } catch (err) {
    console.error(err);
    alert("Unable to update profile.");
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

        {/* Device Names (multiple) */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="font-semibold">
  Device Names <span className="text-red-500">*</span>
</label>
            <button
              type="button"
              onClick={() => setShowDeviceHelp(!showDeviceHelp)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600"
            >
              <HelpCircle size={14} />
              How do I find this?
            </button>
          </div>

          {deviceNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {deviceNames.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full pl-3 pr-2 py-1 text-sm text-gray-800"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => removeDeviceName(d)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`Remove ${d}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Monitor className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                name="deviceName"
                placeholder="e.g. JOHNS-LAPTOP"
                value={deviceNameInput}
                onChange={(e) => setDeviceNameInput(e.target.value)}
                onKeyDown={handleDeviceNameKeyDown}
                className="w-full border rounded-lg pl-10 pr-3 py-3"
              />
            </div>
            <button
              type="button"
              onClick={addDeviceName}
              disabled={!deviceNameInput.trim()}
              className="flex items-center gap-1 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Add one device at a time — press Enter or click Add. You can register multiple devices.
          </p>

          {showDeviceHelp && (
            <div className="mt-3 bg-gray-50 border rounded-lg p-4 text-sm text-gray-700 space-y-3">
              <div>
                <p className="font-semibold mb-1">Windows</p>
                <p>
                  Settings → System → About → look under "Device name".
                  Or open Command Prompt and run:
                </p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  hostname
                </code>
              </div>
              <div>
                <p className="font-semibold mb-1">macOS</p>
                <p>
                  Apple menu → System Settings → General → About → look under "Name".
                  Or open Terminal and run:
                </p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  scutil --get ComputerName
                </code>
              </div>
              <div>
                <p className="font-semibold mb-1">Linux</p>
                <p>Open a terminal and run:</p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  hostname
                </code>
                <p className="mt-1">
                  or, for more detail:
                </p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  hostnamectl
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Service Numbers (multiple) */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
           <label className="font-semibold">
  Serial Numbers <span className="text-red-500">*</span>
</label>
            <button
              type="button"
              onClick={() => setShowServiceHelp(!showServiceHelp)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600"
            >
              <HelpCircle size={14} />
              How do I find this?
            </button>
          </div>

          {serialNumbers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {serialNumbers.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full pl-3 pr-2 py-1 text-sm text-gray-800"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSerialNumber(s)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`Remove ${s}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                name="serialNumber"
                placeholder="e.g. 5CD1234ABC"
                value={serialNumberInput}
                onChange={(e) => setSerialNumberInput(e.target.value)}
                onKeyDown={handleSerialNumberKeyDown}
                className="w-full border rounded-lg pl-10 pr-3 py-3"
              />
            </div>
            <button
              type="button"
              onClick={addSerialNumber}
              disabled={!serialNumberInput.trim()}
              className="flex items-center gap-1 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Add one serial number at a time — press Enter or click Add. You can register multiple devices.
          </p>

          {showServiceHelp && (
            <div className="mt-3 bg-gray-50 border rounded-lg p-4 text-sm text-gray-700 space-y-3">
              <div>
                <p className="font-semibold mb-1">Windows</p>
                <p>
                  Open PowerShell and run:
                </p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  powershell -Command "(Get-CimInstance Win32_BIOS).SerialNumber"
                </code>
                <p className="mt-1">or, using the older WMIC tool:</p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  wmic bios get serialnumber
                </code>
              </div>
              <div>
                <p className="font-semibold mb-1">macOS</p>
                <p>
                  Apple menu → About This Mac → look under "Serial number".
                  Or open Terminal and run:
                </p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  system_profiler SPHardwareDataType | grep "Serial Number"
                </code>
                <p className="mt-1">or, using ioreg:</p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  ioreg -l | grep IOPlatformSerialNumber
                </code>
              </div>
              <div>
                <p className="font-semibold mb-1">Linux</p>
                <p>Open a terminal and run:</p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  sudo dmidecode -s system-serial-number
                </code>
                <p className="mt-1">or, without sudo (may show "Not Specified" on VMs):</p>
                <code className="block bg-white border rounded px-2 py-1 mt-1 text-xs">
                  cat /sys/class/dmi/id/product_serial
                </code>
              </div>
            </div>
          )}
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
          {loading ? "Saving..." : "Save"}
        </button>

      </div>
    </div>
  );
}