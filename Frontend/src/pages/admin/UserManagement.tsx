import { useState, useEffect, useRef } from "react";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../../services/admin/userManagementService";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "support";
  status: "active" | "paused" | "cancelled" | "expired" | "inactive";
  isActive: boolean;
  lastLoginText: string;
  subscription: string;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
}

interface ImportedUser {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
  _rowError?: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
  { value: "support", label: "Support" },
];
const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEPS = ["Basic Info", "Role & Status", "Review"];
const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  role: "",
  status: "active",
};

const inputCls = (err?: string) =>
  `w-full h-10 rounded-lg border px-3 text-sm outline-none transition-all ${
    err
      ? "border-red-400 bg-red-50 focus:border-red-500"
      : "border-gray-200 bg-gray-50 focus:border-green-500 focus:bg-white"
  }`;

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const avatarColor = "bg-green-500 text-white";

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep1(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "Full name is required.";
  else if (form.name.trim().length < 2)
    errors.name = "Name must be at least 2 characters.";
  if (!form.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(form.email.trim()))
    errors.email = "Enter a valid email address.";
  return errors;
}

function validateStep1Add(form: FormState,minPasswordLength: number): FieldErrors {
  const errors = validateStep1(form);
  if (!form.password) errors.password = "Password is required.";
  else if (form.password.length < minPasswordLength)
    errors.password = `Password must be at least ${minPasswordLength} characters.`;
  if (!form.role) errors.role = "Please select a role.";
  return errors;
}

function validateStep2(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.role) errors.role = "Please select a role.";
  if (!form.status) errors.status = "Please select a status.";
  return errors;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): ImportedUser[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));

  const nameIdx = headers.findIndex((h) =>
    ["name", "fullname", "full_name"].includes(h),
  );
  const emailIdx = headers.findIndex((h) => h === "email");
  const passwordIdx = headers.findIndex((h) =>
    ["password", "pass"].includes(h),
  );
  const roleIdx = headers.findIndex((h) => h === "role");
  const statusIdx = headers.findIndex((h) => h === "status");

  return lines.slice(1).map((line) => {
    // Handle quoted CSV values
    const cols: string[] = [];
    let cur = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());

    const user: ImportedUser = {
      name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
      email: emailIdx >= 0 ? cols[emailIdx] || "" : "",
      password: passwordIdx >= 0 ? cols[passwordIdx] || "" : "",
      role: roleIdx >= 0 ? (cols[roleIdx] || "").toLowerCase() : "user",
      status: statusIdx >= 0 ? (cols[statusIdx] || "").toLowerCase() : "active",
    };

    const errs: string[] = [];
    if (!user.name.trim()) errs.push("name missing");
    if (!user.email.trim() || !EMAIL_RE.test(user.email))
      errs.push("invalid email");
    if (!user.password || user.password.length < 6)
      errs.push("password too short");
    if (!["admin", "user", "support"].includes(user.role))
      errs.push(`invalid role "${user.role}"`);
    if (!["active", "inactive", "suspended"].includes(user.status))
      errs.push(`invalid status "${user.status}"`);
    if (errs.length) user._rowError = errs.join("; ");

    return user;
  });
}

// ─── Download Template ────────────────────────────────────────────────────────

function downloadTemplate() {
  const csv = [
    "name,email,password,role,status",
    "John Doe,john@example.com,password123,user,active",
    "Jane Admin,jane@example.com,securepass,admin,active",
    "Bob Support,bob@example.com,support123,support,inactive",
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-blue-50 text-blue-600 border-blue-200",
    user: "bg-green-50 text-green-700 border-green-200",
    support: "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${styles[role] || "bg-gray-50 text-gray-600 border-gray-200"}`}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
        isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {status}
    </span>
  );
}

// ─── Actions Menu ─────────────────────────────────────────────────────────────

function ActionsMenu({
  onEdit,
  onToggleActive,
  isActive,
  onDeleteUser,
}: {
  onEdit: () => void;
  onToggleActive: () => void;
  onDeleteUser: () => void;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const label = isActive ? "Deactivate" : "Activate";

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownHeight = 88;
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < dropdownHeight) {
        setPos({ top: rect.top - dropdownHeight - 4, left: rect.right - 144 });
      } else {
        setPos({ top: rect.bottom + 4, left: rect.right - 144 });
      }
    }
    setOpen((o) => !o);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-gray-500"
        >
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[999]"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed z-[1000] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-36"
              style={{ top: pos.top, left: pos.left }}
            >
              <button
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit User
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onToggleActive();
                }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "text-red-500 hover:bg-red-50"
                    : "text-green-600 hover:bg-green-50"
                }`}
              >
                {isActive && (
                  <svg
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                  </svg>
                )}
                {label}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onDeleteUser();
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

// ─── Import Preview Table ─────────────────────────────────────────────────────

function ImportPreviewTable({
  users,
  onRemove,
}: {
  users: ImportedUser[];
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-56 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {["Name", "Email", "Role", "Status", ""].map((h) => (
                <th
                  key={h}
                  className="text-left px-3 py-2 text-gray-500 font-semibold whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u, i) => (
              <tr
                key={i}
                className={u._rowError ? "bg-red-50" : "hover:bg-gray-50/60"}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {u._rowError && (
                      <svg
                        width="11"
                        height="11"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    )}
                    <span
                      className={`font-medium truncate max-w-[80px] ${u._rowError ? "text-red-700" : "text-gray-800"}`}
                    >
                      {u.name || "—"}
                    </span>
                  </div>
                  {u._rowError && (
                    <p className="text-[10px] text-red-500 mt-0.5 leading-tight">
                      {u._rowError}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600 truncate max-w-[120px]">
                  {u.email || "—"}
                </td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">
                    {u.role || "—"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`px-1.5 py-0.5 rounded capitalize font-semibold ${
                      u.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {u.status || "—"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onRemove(i)}
                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg
                      width="10"
                      height="10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserManagement() {
  useEffect(() => {
    const container =
      document.querySelector("main") ||
      document.querySelector("[class*='overflow-y']") ||
      document.documentElement;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await fetch("http://localhost:5000/api/system-config/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        setMinPasswordLength(data.config?.security?.minimumPasswordLength || 6);
      } catch (err) {
        console.error("Failed to fetch system config:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [minPasswordLength, setMinPasswordLength] = useState<number>(6);
  const [roleFilter, setRoleFilter] = useState("");

  // Add modal — tabs: "manual" | "import"
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState<"manual" | "import">("manual");
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
  const [addErrors, setAddErrors] = useState<FieldErrors>({});
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Import state
  const [importedUsers, setImportedUsers] = useState<ImportedUser[]>([]);
  const [importDragOver, setImportDragOver] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit wizard
  const [showEdit, setShowEdit] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editFetching, setEditFetching] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getAllUsers();
      setUsers(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!roleFilter || u.role === roleFilter);
  });

  const stats = [
    { label: "Total Users", value: users.length, color: "text-blue-600" },
    {
      label: "Active",
      value: users.filter((u) => u.status === "active").length,
      color: "text-green-600",
    },
    {
      label: "Admins",
      value: users.filter((u) => u.role === "admin").length,
      color: "text-purple-600",
    },
    {
      label: "Pro Users",
      value: users.filter((u) => u.subscription?.toLowerCase().includes("pro"))
        .length,
      color: "text-orange-500",
    },
  ];

  // ── Manual create ──
  const handleCreate = async () => {
    const errors = validateStep1Add(addForm,minPasswordLength ?? 6);
    if (Object.keys(errors).length) {
      setAddErrors(errors);
      return;
    }
    try {
      setAddLoading(true);
      setAddError("");
      setAddErrors({});
      await createUser(addForm);
      setShowAdd(false);
      setAddForm(EMPTY_FORM);
      fetchUsers();
    } catch (err: any) {
      setAddError(err?.response?.data?.message || "Failed to create user.");
    } finally {
      setAddLoading(false);
    }
  };

  // ── File parsing ──
  const handleFile = (file: File) => {
    setImportError("");
    setImportSuccess("");
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setImportError(
        "Only CSV files are supported. Please download the template.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed.length) {
        setImportError(
          "No valid rows found. Make sure the file has a header row and data rows.",
        );
        return;
      }
      setImportedUsers(parsed);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const removeImportRow = (idx: number) => {
    setImportedUsers((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Bulk import submit ──
  const handleBulkImport = async () => {
    const validUsers = importedUsers.filter((u) => !u._rowError);
    if (!validUsers.length) {
      setImportError(
        "No valid users to import. Fix errors or remove invalid rows.",
      );
      return;
    }
    setImportLoading(true);
    setImportError("");
    setImportSuccess("");
    let succeeded = 0;
    let failed = 0;
    for (const u of validUsers) {
      try {
        await createUser({
          name: u.name,
          email: u.email,
          password: u.password,
          role: u.role,
          status: u.status,
        });
        succeeded++;
      } catch {
        failed++;
      }
    }
    setImportLoading(false);
    if (succeeded > 0) {
      setImportSuccess(
        `✓ ${succeeded} user${succeeded > 1 ? "s" : ""} imported successfully.${failed > 0 ? ` ${failed} failed.` : ""}`,
      );
      setImportedUsers([]);
      fetchUsers();
    } else {
      setImportError(
        `All ${failed} imports failed. Check if emails already exist.`,
      );
    }
  };

  // ── Edit ──
  const openEdit = async (id: string) => {
    setShowEdit(true);
    setEditId(id);
    setEditStep(0);
    setEditError("");
    setEditErrors({});
    setEditFetching(true);
    try {
      const res = await getUserById(id);
      const u: User = res.data.data;
      setEditForm({
        name: u.name,
        email: u.email,
        password: "",
        role: u.role,
        status: u.status,
      });
    } catch {
      setEditError("Failed to load user details.");
      setShowEdit(false);
    } finally {
      setEditFetching(false);
    }
  };

  const nextStep = () => {
    let errors: FieldErrors = {};
    if (editStep === 0) errors = validateStep1(editForm);
    if (editStep === 1) errors = validateStep2(editForm);
    if (Object.keys(errors).length) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    setEditError("");
    setEditStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prevStep = () => {
    setEditErrors({});
    setEditError("");
    setEditStep((s) => Math.max(s - 1, 0));
  };

  const handleUpdate = async () => {
    try {
      setEditLoading(true);
      setEditError("");
      const payload: Partial<FormState> = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.password) payload.password = editForm.password;
      await updateUser(editId, payload);
      setShowEdit(false);
      fetchUsers();
    } catch (err: any) {
      setEditError(err?.response?.data?.message || "Failed to update user.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string, action: "toggle" | "delete") => {
    try {
      await deleteUser(id, action);
      fetchUsers();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete user.");
    }
  };

  const validImportCount = importedUsers.filter((u) => !u._rowError).length;
  const errorImportCount = importedUsers.filter((u) => u._rowError).length;

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-100 rounded-xl p-4"
          >
            <p className="text-xs text-gray-400 font-medium mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>
              {loading ? "—" : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
        <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-green-400 focus-within:bg-white transition-all">
          <svg
            width="15"
            height="15"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none border border-gray-200 rounded-xl pl-4 pr-9 py-2.5 text-sm text-gray-600 bg-gray-50 outline-none cursor-pointer focus:border-green-400 focus:bg-white transition-all"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-3 top-3.5 pointer-events-none"
            width="12"
            height="12"
            fill="none"
            stroke="#6b7280"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <button
          onClick={() => {
            setShowAdd(true);
            setAddError("");
            setAddErrors({});
            setAddForm(EMPTY_FORM);
            setAddTab("manual");
            setImportedUsers([]);
            setImportError("");
            setImportSuccess("");
          }}
          className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
        >
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add User
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
          {error}
          <button onClick={fetchUsers} className="ml-auto text-xs underline">
            Retry
          </button>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-1/4" />
                <div className="h-2.5 bg-gray-100 rounded w-1/3" />
              </div>
              <div className="h-6 bg-gray-100 rounded-full w-16" />
              <div className="h-6 bg-gray-100 rounded w-20" />
              <div className="h-6 bg-gray-100 rounded w-16" />
              <div className="h-6 bg-gray-100 rounded w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Desktop table */}
      {!loading && (
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  "User",
                  "Role",
                  "Subscription",
                  "Status",
                  "Last Active",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => (
                <tr
                  key={u._id}
                  className="hover:bg-gray-50/60 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor}`}
                      >
                        {getInitials(u.name)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {u.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700 font-medium">
                    {u.subscription || "Free"}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {u.lastLoginText || "Never"}
                  </td>
                  <td className="px-5 py-4">
                    <ActionsMenu
                      onEdit={() => openEdit(u._id)}
                      onToggleActive={() => handleDelete(u._id, "toggle")}
                      onDeleteUser={() => handleDelete(u._id, "delete")}
                      isActive={u.isActive}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!loading && (
        <div className="sm:hidden divide-y divide-gray-50">
          {filtered.map((u) => (
            <div key={u._id} className="p-4 flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor}`}
              >
                {getInitials(u.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {u.name}
                </p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <RoleBadge role={u.role} />
                  <StatusBadge status={u.status} />
                </div>
              </div>
              <ActionsMenu
                onEdit={() => openEdit(u._id)}
                onToggleActive={() => handleDelete(u._id, "toggle")}
                onDeleteUser={() => handleDelete(u._id, "delete")}
                isActive={u.isActive}
              />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="py-16 text-center text-gray-400 text-sm">
          No users found.
        </div>
      )}

      {/* ── Add User Modal ──────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Add New User</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex px-6 pb-3 gap-1 flex-shrink-0">
              <button
                onClick={() => setAddTab("manual")}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  addTab === "manual"
                    ? "bg-green-500 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Add User
              </button>
              <button
                onClick={() => setAddTab("import")}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  addTab === "import"
                    ? "bg-green-500 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <svg
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import CSV
              </button>
            </div>

            {/* ── Manual Tab ── */}
            {addTab === "manual" && (
              <>
                <div className="overflow-y-auto flex-1 px-6">
                  <div className="space-y-3 pb-2">
                    <Field label="Full Name" error={addErrors.name}>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={addForm.name}
                        onChange={(e) => {
                          setAddForm((p) => ({ ...p, name: e.target.value }));
                          if (addErrors.name)
                            setAddErrors((p) => ({ ...p, name: undefined }));
                        }}
                        className={inputCls(addErrors.name)}
                      />
                    </Field>
                    <Field label="Email" error={addErrors.email}>
                      <input
                        type="email"
                        placeholder="john@example.com"
                        value={addForm.email}
                        onChange={(e) => {
                          setAddForm((p) => ({ ...p, email: e.target.value }));
                          if (addErrors.email)
                            setAddErrors((p) => ({ ...p, email: undefined }));
                        }}
                        className={inputCls(addErrors.email)}
                      />
                    </Field>
                    <Field label="Password" error={addErrors.password}>
                      <input
                        type="password"
                        placeholder="Min. 6 characters"
                        value={addForm.password}
                        onChange={(e) => {
                          setAddForm((p) => ({
                            ...p,
                            password: e.target.value,
                          }));
                          if (addErrors.password)
                            setAddErrors((p) => ({
                              ...p,
                              password: undefined,
                            }));
                        }}
                        className={inputCls(addErrors.password)}
                      />
                    </Field>
                    <Field label="Role" error={addErrors.role}>
                      <select
                        value={addForm.role}
                        onChange={(e) => {
                          setAddForm((p) => ({ ...p, role: e.target.value }));
                          if (addErrors.role)
                            setAddErrors((p) => ({ ...p, role: undefined }));
                        }}
                        className={inputCls(addErrors.role)}
                      >
                        <option value="">Select a role</option>
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        value={addForm.status}
                        onChange={(e) =>
                          setAddForm((p) => ({ ...p, status: e.target.value }))
                        }
                        className={inputCls()}
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  {addError && (
                    <p className="mt-3 mb-2 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                      {addError}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 px-6 py-4 flex-shrink-0 border-t border-gray-100">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="flex-1 h-10 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={addLoading}
                    className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {addLoading ? "Creating..." : "Create User"}
                  </button>
                </div>
              </>
            )}

            {/* ── Import Tab ── */}
            {addTab === "import" && (
              <>
                <div className="overflow-y-auto flex-1 px-6">
                  {/* Template download */}
                  <div className="mb-3 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-blue-700">
                        CSV Template
                      </p>
                      <p className="text-[11px] text-blue-500 mt-0.5">
                        name, email, password, role, status
                      </p>
                    </div>
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <svg
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </button>
                  </div>

                  {/* Accepted values hint */}
                  <div className="mb-3 bg-gray-50 rounded-xl px-4 py-3 text-[11px] text-gray-500 space-y-1">
                    <p>
                      <span className="font-semibold text-gray-700">role:</span>{" "}
                      admin · user · support
                    </p>
                    <p>
                      <span className="font-semibold text-gray-700">
                        status:
                      </span>{" "}
                      active · inactive · suspended
                    </p>
                    <p>
                      <span className="font-semibold text-gray-700">
                        password:
                      </span>{" "}
                      min. 6 characters
                    </p>
                  </div>

                  {/* Drop zone */}
                  {importedUsers.length === 0 && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setImportDragOver(true);
                      }}
                      onDragLeave={() => setImportDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                        importDragOver
                          ? "border-green-400 bg-green-50"
                          : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                          <svg
                            width="18"
                            height="18"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-700">
                          {importDragOver
                            ? "Drop to import"
                            : "Drop your CSV here"}
                        </p>
                        <p className="text-xs text-gray-400">
                          or click to browse · .csv files only
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* Preview table */}
                  {importedUsers.length > 0 && (
                    <div className="space-y-3">
                      {/* Summary bar */}
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                          <svg
                            width="11"
                            height="11"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {validImportCount} valid
                        </span>
                        {errorImportCount > 0 && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-lg">
                            <svg
                              width="11"
                              height="11"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {errorImportCount} errors
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setImportedUsers([]);
                            setImportError("");
                            setImportSuccess("");
                          }}
                          className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                        >
                          Clear & re-upload
                        </button>
                      </div>

                      <ImportPreviewTable
                        users={importedUsers}
                        onRemove={removeImportRow}
                      />
                    </div>
                  )}

                  {/* Success */}
                  {importSuccess && (
                    <div className="mt-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-xs font-semibold text-green-700 flex items-center gap-2">
                      <svg
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {importSuccess}
                    </div>
                  )}

                  {/* Error */}
                  {importError && (
                    <p className="mt-3 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                      {importError}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-6 py-4 flex-shrink-0 border-t border-gray-100">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="flex-1 h-10 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkImport}
                    disabled={importLoading || validImportCount === 0}
                    className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {importLoading ? (
                      <>
                        <svg
                          className="animate-spin"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Importing...
                      </>
                    ) : (
                      `Import ${validImportCount > 0 ? validImportCount : ""} User${validImportCount !== 1 ? "s" : ""}`
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Wizard Modal ───────────────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Edit User</h2>
              <button
                onClick={() => setShowEdit(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 px-6 pb-4 flex-shrink-0">
              {STEPS.map((label, idx) => (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      idx < editStep
                        ? "bg-green-500 text-white"
                        : idx === editStep
                          ? "bg-green-500 text-white ring-4 ring-green-100"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {idx < editStep ? (
                      <svg
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-medium whitespace-nowrap ${idx === editStep ? "text-green-600" : "text-gray-400"}`}
                  >
                    {label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-px ${idx < editStep ? "bg-green-400" : "bg-gray-200"}`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6">
              {editFetching ? (
                <div className="space-y-3 animate-pulse pb-2">
                  {[1, 2].map((i) => (
                    <div key={i}>
                      <div className="h-3 bg-gray-100 rounded w-1/4 mb-2" />
                      <div className="h-10 bg-gray-100 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pb-2">
                  {editStep === 0 && (
                    <div className="space-y-3">
                      <Field label="Full Name" error={editErrors.name}>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => {
                            setEditForm((p) => ({
                              ...p,
                              name: e.target.value,
                            }));
                            if (editErrors.name)
                              setEditErrors((p) => ({ ...p, name: undefined }));
                          }}
                          className={inputCls(editErrors.name)}
                        />
                      </Field>
                      <Field label="Email" error={editErrors.email}>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => {
                            setEditForm((p) => ({
                              ...p,
                              email: e.target.value,
                            }));
                            if (editErrors.email)
                              setEditErrors((p) => ({
                                ...p,
                                email: undefined,
                              }));
                          }}
                          className={inputCls(editErrors.email)}
                        />
                      </Field>
                      <Field
                        label="New Password (leave blank to keep current)"
                        error={editErrors.password}
                      >
                        <input
                          type="password"
                          placeholder="Min. 6 characters"
                          value={editForm.password}
                          onChange={(e) => {
                            setEditForm((p) => ({
                              ...p,
                              password: e.target.value,
                            }));
                            if (editErrors.password)
                              setEditErrors((p) => ({
                                ...p,
                                password: undefined,
                              }));
                          }}
                          className={inputCls(editErrors.password)}
                        />
                      </Field>
                    </div>
                  )}
                  {editStep === 1 && (
                    <div className="space-y-3">
                      <Field label="Role" error={editErrors.role}>
                        <select
                          value={editForm.role}
                          onChange={(e) => {
                            setEditForm((p) => ({
                              ...p,
                              role: e.target.value,
                            }));
                            if (editErrors.role)
                              setEditErrors((p) => ({ ...p, role: undefined }));
                          }}
                          className={inputCls(editErrors.role)}
                        >
                          <option value="">Select a role</option>
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Status" error={editErrors.status}>
                        <select
                          value={editForm.status}
                          onChange={(e) => {
                            setEditForm((p) => ({
                              ...p,
                              status: e.target.value,
                            }));
                            if (editErrors.status)
                              setEditErrors((p) => ({
                                ...p,
                                status: undefined,
                              }));
                          }}
                          className={inputCls(editErrors.status)}
                        >
                          <option value="">Select a status</option>
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                  {editStep === 2 && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                      {[
                        {
                          label: "Name",
                          value: editForm.name,
                          ok: !!editForm.name,
                        },
                        {
                          label: "Email",
                          value: editForm.email,
                          ok: EMAIL_RE.test(editForm.email),
                        },
                        {
                          label: "Password",
                          value: editForm.password ? "••••••••" : "Unchanged",
                          ok: true,
                        },
                        {
                          label: "Role",
                          value:
                            ROLES.find((r) => r.value === editForm.role)
                              ?.label || editForm.role,
                          ok: !!editForm.role,
                        },
                        {
                          label: "Status",
                          value:
                            STATUSES.find((s) => s.value === editForm.status)
                              ?.label || editForm.status,
                          ok: !!editForm.status,
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between"
                        >
                          <span className="text-gray-400 text-xs font-medium">
                            {row.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-800 text-xs">
                              {row.value || "—"}
                            </span>
                            {row.ok ? (
                              <svg
                                width="12"
                                height="12"
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth="2.5"
                                viewBox="0 0 24 24"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg
                                width="12"
                                height="12"
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {editError && (
                <p className="mt-3 mb-2 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                  {editError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 flex-shrink-0 border-t border-gray-100">
              {editStep > 0 && (
                <button
                  onClick={prevStep}
                  className="flex-1 h-10 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              )}
              {editStep < STEPS.length - 1 ? (
                <button
                  onClick={nextStep}
                  className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleUpdate}
                  disabled={
                    editLoading ||
                    !editForm.name ||
                    !EMAIL_RE.test(editForm.email) ||
                    !editForm.role ||
                    !editForm.status
                  }
                  className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
