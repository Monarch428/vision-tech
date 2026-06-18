import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface Credential {
  username: string;
  password: string;
}

interface ServiceCard {
  id: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  sso?: boolean;
  credentials?: Credential;
  portalUrl?: string;
}

const CloudIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const MonitorIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
); 

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const services: ServiceCard[] = [
  {
    id: "backup",
    icon: <CloudIcon />,
    tag: "Backup",
    title: "Backup Management Portal",
    description: "Manage client backup policies, schedules, and restore operations.",
    credentials: {
      username: "admin@solo.tech",
      password: "supersecret123",
    },
    portalUrl: "#",
  },
  {
    id: "security",
    icon: <ShieldIcon />,
    tag: "Security",
    title: "Antivirus Admin Console",
    description: "Central antivirus policy management, threat reports, and device enrollment.",
    sso: true,
    portalUrl: "https://cloudap.gravityzone.bitdefender.com/",
  },
  {
    id: "rmm",
    icon: <MonitorIcon />,
    tag: "RMM",
    title: "RMM Vendor Dashboard",
    description: "Extended RMM controls — patch management, remote sessions, and scripts.",
    sso: true,
    portalUrl: "#",
  },
];

function CredentialRow({
  label,
  value,
  isPassword,
}: {
  label: string;
  value: string;
  isPassword?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500 min-w-[64px]">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-800 tracking-wide">
          {isPassword && !visible ? "••••••••••" : value}
        </span>
        {isPassword && (
          <button
            onClick={() => setVisible((v) => !v)}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded"
            title={visible ? "Hide" : "Show"}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
        <button
          onClick={handleCopy}
          className={`p-1 transition-colors rounded ${copied ? "text-green-600" : "text-slate-400 hover:text-slate-600"}`}
          title="Copy"
        >
          <CopyIcon />
        </button>
      </div>
    </div>
  );
}

function ServiceCardComponent({ service }: { service: ServiceCard }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col gap-3 shadow-sm">
      {/* Card Header */}
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 flex-shrink-0">
          {service.icon}
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
          {service.tag}
        </span>
      </div>

      {/* Title & Description */}
      <div>
        <h2 className="text-base sm:text-[17px] font-bold text-slate-900 leading-snug">
          {service.title}
        </h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          {service.description}
        </p>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 mt-1">
        {/* SSO Badge */}
        {service.sso && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3.5 py-2.5">
            <span className="text-green-600 flex-shrink-0">
              <CheckCircleIcon />
            </span>
            <span className="text-sm text-green-700 font-medium">
              Single Sign-On supported
            </span>
          </div>
        )}

        {/* Credentials */}
        {service.credentials && (
          <div className="border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2.5 bg-gray-50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Access Credentials
            </p>
            <CredentialRow label="Username" value={service.credentials.username} />
            <CredentialRow label="Password" value={service.credentials.password} isPassword />
          </div>
        )}

        {/* Open Portal Button */}
        <a
          href={service.portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold py-2.5 px-5 rounded-xl transition-colors"
        >
          <ExternalLinkIcon />
          Open Portal
        </a>
      </div>
    </div>
  );
}

export default function ExternalServiceAccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const container =
      document.querySelector("main") ||
      document.querySelector("[class*='overflow-y']") ||
      document.documentElement;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-stone-100 px-4 py-6 sm:py-10 font-sans">
      <div className="max-w-5xl mx-auto flex flex-col gap-6 sm:gap-7">

        {/* Back Button */}
        <button
          onClick={() => navigate("/admin/adminManagement")}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all duration-200 w-fit group"
        >
          <ArrowLeftIcon className="transition-transform duration-200 group-hover:-translate-x-0.5" />
          Back to Admin Management
        </button>

        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            External Service Access
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quick-access links to external service portals and secure technician credentials.
          </p>
        </div>

        {/* Warning Banner */}
        <div className="flex items-start sm:items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
          <span className="text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0">
            <LockIcon />
          </span>
          <p className="text-sm text-amber-800 leading-relaxed">
            Credentials displayed here are for authorized technicians only. Do not share externally. Access is logged.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {services.map((service) => (
            <ServiceCardComponent key={service.id} service={service} />
          ))}
        </div>

      </div>
    </div>
  );
}