import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
    Rocket,
    Headphones,
    Activity,
    ScanLine,
    Shield,
    LifeBuoy,
    Monitor,
    LayoutDashboard,
    CheckCircle2,
    Ticket,
    AlertTriangle,
    Menu,
    X,
    Zap,
    Clock,
    FileText,
    Users,
    Layers,
    TrendingUp,
    ShieldCheck,
    UserCheck,
    MessageSquare,
    User,
    Lock,
    Bell,
    Cpu,
    Globe,
    Network,
    Puzzle,
    Cloud,
    Grid3x3,
    Link2,
    Boxes,
    ChevronDown,
    ArrowRight,
    Star,
    MapPin,
    Phone,
    Mail,
    LogIn,
    UserPlus,
} from "lucide-react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

import logo from "../../assets/logo.png";
import visionLogo from "../../../../Frontend/public/vision-tech-logo.png";

// Nav links now carry the section id they should scroll to, so every
// header/footer link actually navigates somewhere on the page.
const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Modules", href: "#modules" },
    { label: "Pricing", href: "#pricing" },
    { label: "Security", href: "#security" },
    { label: "FAQ", href: "#faq" },
];

const sidebarLinks = [
    { label: "Dashboard", icon: LayoutDashboard, active: true },
    { label: "Support", icon: Headphones, active: false },
    { label: "Antivirus", icon: Shield, active: false },
    { label: "Self-Help", icon: LifeBuoy, active: false },
    { label: "RMM", icon: Monitor, active: false },
];

const statCards = [
    {
        label: "Active Support Tickets",
        value: "2",
        icon: Headphones,
    },
    {
        label: "System Health",
        value: "98%",
        icon: Activity,
    },
    {
        label: "Last Scan",
        value: "2 hours ago",
        icon: ScanLine,
    },
];

const quickActions = [
    { label: "Book Support", sub: "Schedule one-on-one support", icon: Headphones },
    { label: "Run Antivirus Scan", sub: "Start a full system scan", icon: Shield },
    { label: "View Devices", sub: "Monitoring overview", icon: Activity },
];

const faqItems = [
    {
        question: "What is the SOLO Dashboard Platform?",
        answer:
            "SOLO is a subscription-based platform that unifies IT support ticketing, antivirus management, and remote device monitoring into one secure, self-service portal for individuals and teams.",
    },
    {
        question: "How does subscription billing work?",
        answer:
            "You're billed monthly or yearly through our secure billing portal. Upgrade, downgrade, or cancel at any time — changes apply at the start of your next billing cycle.",
    },
    {
        question: "What is RMM and which plans include it?",
        answer:
            "RMM (Remote Monitoring & Management) keeps a live eye on device health, alerts you to issues in real time, and gives you historical performance reports. It's included starting with the Managed Pro plan, covering up to 25 devices.",
    },
    {
        question: "How secure is my data on SOLO?",
        answer:
            "All data in transit is encrypted with TLS, passwords are hashed and never stored in plaintext, and access is enforced through role-based permissions with full audit logging on every admin action.",
    },
    {
        question: "Can I add extra devices or support hours?",
        answer:
            "Yes. Extra support hours, additional monitored devices, and advanced reporting are all available as à la carte add-ons, billed alongside your existing subscription.",
    },
];


const recentActivity = [
    {
        label: "Antivirus scan completed",
        time: "2 hours ago",
        icon: CheckCircle2,
        tone: "text-emerald-600 bg-emerald-50",
    },
    {
        label: "Support ticket #1234 resolved",
        time: "5 hours ago",
        icon: Ticket,
        tone: "text-emerald-600 bg-emerald-50",
    },
    {
        label: "RMM monitoring started",
        time: "1 day ago",
        icon: Monitor,
        tone: "text-sky-600 bg-sky-50",
    },
    {
        label: "Security update available",
        time: "2 days ago",
        icon: AlertTriangle,
        tone: "text-amber-600 bg-amber-50",
    },
];

const coreFeatures = [
    {
        label: "Support Ticketing",
        description:
            "Submit, track, and resolve IT help requests with full lifecycle visibility and file attachments.",
        icon: Ticket,
        tone: "text-indigo-500 bg-indigo-50",
    },
    {
        label: "Antivirus Management",
        description:
            "Schedule antivirus installations, track protection status, and receive security assistance.",
        icon: Shield,
        tone: "text-emerald-500 bg-emerald-50",
    },
    {
        label: "Remote Monitoring (RMM)",
        description:
            "Monitor device health, receive real-time alerts, and view historical performance summaries.",
        icon: Monitor,
        tone: "text-sky-500 bg-sky-50",
    },
    {
        label: "Self-Help Tools",
        description:
            "Guided browser cleanup, network restart, antivirus scan initiation, and backup start assistance.",
        icon: Zap,
        tone: "text-amber-500 bg-amber-50",
    },
    {
        label: "Support Hour Booking",
        description:
            "Book one-on-one support hours directly from your dashboard with calendar integration.",
        icon: Clock,
        tone: "text-rose-500 bg-rose-50",
    },
    {
        label: "Audit & Reporting",
        description:
            "Full audit trail of admin actions, subscription status, device logs, and activity history.",
        icon: FileText,
        tone: "text-violet-500 bg-violet-50",
    },
];

const platformModules = [
    {
        label: "User Dashboard",
        icon: Users,
        title: "Your IT Control Center",
        description:
            "A centralized client portal giving you full visibility into your subscription plan, active services, and support activity. Manage profile details, view billing history, and access all platform features from one clean interface.",
        bullets: [
            "Account & subscription overview",
            "Feature access by plan tier",
            "Quick-launch support requests",
            "Billing portal via Stripe",
        ],
    },
    {
        label: "Support Services",
        icon: Ticket,
        title: "Help, Tracked End to End",
        description:
            "Submit and follow IT support tickets from first request to resolution. Attach files, message your technician, and see exactly where each request stands without leaving the dashboard.",
        bullets: [
            "Full ticket lifecycle visibility",
            "File attachments & threaded replies",
            "One-on-one support hour booking",
            "Priority queuing for urgent issues",
        ],
    },
    {
        label: "Antivirus Security",
        icon: Shield,
        title: "Protection You Can See",
        description:
            "Schedule antivirus installations, monitor protection status across every device, and get notified the moment something needs attention. Security stays visible instead of invisible.",
        bullets: [
            "Real-time protection status",
            "Scheduled & on-demand scans",
            "Threat alerts with guided remediation",
            "Device-by-device coverage reports",
        ],
    },
    {
        label: "RMM Monitoring",
        icon: Activity,
        title: "Every Device, Watched Live",
        description:
            "Remote monitoring keeps an eye on device health around the clock, surfacing performance issues before they become outages, with historical summaries to spot patterns over time.",
        bullets: [
            "Live device health monitoring",
            "Real-time performance alerts",
            "Historical uptime & usage reports",
            "Fleet-wide status at a glance",
        ],
    },
];

const howItWorksSteps = [
    {
        label: "Subscribe & Onboard",
        description:
            "Choose a plan, complete checkout via Stripe or Razorpay, and your account is instantly provisioned with role-based access control.",
        icon: ShieldCheck,
    },
    {
        label: "Access Your Dashboard",
        description:
            "Log in to your personalized client portal. View subscription status, active services, and quick-launch any feature from a single interface.",
        icon: UserCheck,
    },
    {
        label: "Request & Track Services",
        description:
            "Raise support tickets, schedule antivirus setup, book one-on-one hours, or enroll devices in RMM monitoring — all from the dashboard.",
        icon: MessageSquare,
    },
    {
        label: "Admins Handle the Rest",
        description:
            "Your IT team manages tickets, uploads diagnostic logs, monitors RMM devices, and tracks billing — through a powerful internal admin dashboard.",
        icon: User,
    },
];

// --- Analytics section data ---
const deviceHealthData = [
    { day: "Mon", healthy: 42, alerts: 44 },
    { day: "Tue", healthy: 44, alerts: 45 },
    { day: "Wed", healthy: 39, alerts: 41 },
    { day: "Thu", healthy: 47, alerts: 48 },
    { day: "Fri", healthy: 45, alerts: 46 },
    { day: "Sat", healthy: 44, alerts: 45 },
    { day: "Sun", healthy: 48, alerts: 49 },
];

const ticketResolutionData = [
    { month: "Jan", resolved: 32 },
    { month: "Feb", resolved: 22 },
    { month: "Mar", resolved: 38 },
    { month: "Apr", resolved: 33 },
    { month: "May", resolved: 40 },
    { month: "Jun", resolved: 47 },
];

const recentTickets = [
    { id: "TK-1042", user: "Sarah M.", issue: "Browser performance issue", status: "Resolved", time: "2h ago" },
    { id: "TK-1041", user: "James R.", issue: "Antivirus scan failed", status: "In Progress", time: "4h ago" },
    { id: "TK-1040", user: "Priya K.", issue: "Network connectivity", status: "Open", time: "6h ago" },
    { id: "TK-1039", user: "Alex T.", issue: "RMM agent offline", status: "Resolved", time: "8h ago" },
];

const statusTones: Record<string, { bg: string; text: string; dot: string }> = {
    Resolved: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
    "In Progress": { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    Open: { bg: "bg-indigo-500/10", text: "text-indigo-400", dot: "bg-indigo-400" },
};

// --- Security & Compliance section data ---
const securityFeatures = [
    {
        label: "HTTPS / TLS Encryption",
        description:
            "All data in transit is encrypted end-to-end using TLS. No plaintext communication leaves the system.",
        icon: Lock,
        dark: true,
    },
    {
        label: "Hashed Passwords",
        description:
            "Passwords are stored using industry-standard hashing algorithms. We never store plaintext credentials.",
        icon: Shield,
        dark: false,
    },
    {
        label: "Role-Based Access Control",
        description:
            "Strict RBAC enforces least-privilege access for End Users, Admins, and System Admins at every endpoint.",
        icon: Users,
        dark: false,
    },
    {
        label: "Full Audit Logging",
        description:
            "Every admin action is recorded in an immutable audit trail — who did what, when, and from where.",
        icon: FileText,
        dark: false,
    },
    {
        label: "Email OTP / MFA",
        description:
            "Multi-factor authentication via email OTP protects all accounts. Login activity is audited in real time.",
        icon: Bell,
        dark: false,
    },
    {
        label: "Rate Limiting & Abuse Prevention",
        description:
            "OTP abuse prevention, file upload validation, and rate limiting harden the platform against common attacks.",
        icon: Cpu,
        dark: false,
    },
];

// --- Integrations section data ---
// Three concentric "orbits". Each node has an angle (deg, 0 = east, clockwise)
// and a radius (% of the container). Positions are precomputed from angle/radius
// so we don't need trig at runtime.
const integrationOrbits = [
    {
        id: "outer",
        radiusPct: 45,
        durationS: 150,
        nodes: [
            { icon: Network, left: 75.8, top: 13.1, color: "text-sky-400" },
            { icon: Zap, left: 57.8, top: 94.3, color: "text-amber-400" },
        ],
    },
    {
        id: "mid",
        radiusPct: 32,
        durationS: 110,
        nodes: [
            { icon: Boxes, left: 52.8, top: 18.1, color: "text-slate-200" },
            { icon: MessageSquare, left: 80.9, top: 58.3, color: "text-blue-400" },
            { icon: Layers, left: 19.1, top: 58.3, color: "text-rose-400" },
            { icon: Puzzle, left: 44.4, top: 81.5, color: "text-violet-400" },
        ],
    },
    {
        id: "inner",
        radiusPct: 18,
        durationS: 75,
        nodes: [
            { icon: Cloud, left: 50, top: 32, color: "text-indigo-400" },
            { icon: Grid3x3, left: 32.6, top: 45.3, color: "text-orange-400" },
            { icon: Link2, left: 66.9, top: 56.2, color: "text-emerald-400" },
        ],
    },
];

// --- Pricing section data ---
const pricingPlans = [
    {
        name: "Basic Support",
        description: "Essential IT help for individuals and small teams.",
        monthlyPrice: 29,
        cta: "Start Free Trial",
        highlight: false,
        features: [
            "Help request ticket system",
            "Limited support hours (2/mo)",
            "Self-help tools access",
            "Email notifications",
            "Billing portal",
        ],
    },
    {
        name: "Security Plus",
        description: "Full security coverage with priority support access.",
        monthlyPrice: 59,
        cta: "Get Started",
        highlight: true,
        badge: "Most Popular",
        features: [
            "Everything in Basic",
            "Antivirus setup & management",
            "Priority support queue",
            "Security assistance team",
            "10 support hours/month",
            "Diagnostic log uploads",
        ],
    },
    {
        name: "Managed Pro",
        description: "Complete IT operations with full RMM monitoring.",
        monthlyPrice: 99,
        cta: "Contact Sales",
        highlight: false,
        features: [
            "Everything in Security Plus",
            "RMM device monitoring (up to 25)",
            "Real-time health alerts",
            "Historical metric reports",
            "Unlimited support hours",
            "Advanced audit logging",
            "Dedicated account admin",
        ],
    },
];

// --- Footer data ---
// Reuses navLinks so header and footer always point at the same sections.
const footerLinks = navLinks;

const contactDetails = [
    { icon: MapPin, label: "99 Main St. Nyack NY 10960" },
    { icon: Phone, label: "+1 (888) 661-2048" },
    { icon: Mail, label: "support@newvtech.com" },
];

const legalLinks = ["Privacy Policy", "Terms & Conditions"];

const SoloLandingPage: React.FC = () => {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [activeModule, setActiveModule] = useState(platformModules[0].label);
    const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

    const currentModule =
        platformModules.find((m) => m.label === activeModule) ?? platformModules[0];

    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggle = (index: number) => {
        setOpenIndex((prev) => (prev === index ? null : index));
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
            {/* Header */}
            <header className="border-b border-slate-100 relative">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/new-user" className="flex items-center gap-3">
                        <img
                            src={logo}
                            alt="SOLO Logo"
                            className="h-10 w-auto object-contain"
                        />

                        <div className="leading-tight">
                            <div className="font-bold text-base">
                                SOLO
                                <span className="block text-[12px] font-normal text-slate-400 -mt-1">
                                    Dashboard
                                </span>
                            </div>
                        </div>
                    </Link>

                    {/* Desktop nav */}
                    <nav className="hidden md:flex items-center font-semibold gap-8 text-md text-gray-900">
                        {navLinks.map(({ label, href }) => (
                            <a
                                key={label}
                                href={href}
                                className="hover:text-emerald-600 transition-colors"
                            >
                                {label}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        {/* Sign In - green accent, outlined */}
                        <Link
                            to="/login"
                            className="hidden sm:flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg border border-emerald-600 hover:bg-emerald-700 transition-colors"
                        >
                            Sign In
                        </Link>

                        {/* Sign Up - white background, green text */}
                        <Link
                            to="/new-user"
                            className="hidden sm:flex items-center gap-2 bg-white text-green-600 text-sm font-medium px-4 py-2.5 rounded-lg border border-green-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                        >
                            Sign Up
                        </Link>
                        <Link
                            to="/new-user"
                            className="hidden sm:flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 hover:text-emerald-400 transition-colors"
                        >
                            <Rocket className="w-4 h-4" />
                            Get Started
                        </Link>
                        {/* Mobile menu toggle */}
                        <button
                            onClick={() => setMobileNavOpen((prev) => !prev)}
                            aria-expanded={mobileNavOpen}
                            aria-label="Toggle navigation menu"
                            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown */}
                <div
                    className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t border-slate-100 ${mobileNavOpen ? "max-h-[36rem] opacity-100" : "max-h-0 opacity-0 border-t-0"
                        }`}
                >
                    <nav className="px-6 py-3 flex flex-col divide-y divide-slate-100">
                        {navLinks.map(({ label, href }) => (
                            <a
                                key={label}
                                href={href}
                                onClick={() => setMobileNavOpen(false)}
                                className="py-3 text-sm font-semibold text-gray-900 hover:text-emerald-600 transition-colors"
                            >
                                {label}
                            </a>
                        ))}

                        {/* Sign In / Sign Up - now visible on mobile too */}
                        <div className="flex flex-col gap-2 pt-3 mb-1">
                            <Link
                                to="/login"
                                onClick={() => setMobileNavOpen(false)}
                                className="flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg border border-emerald-600 hover:bg-emerald-700 transition-colors"
                            >
                                <LogIn className="w-4 h-4" />
                                Sign In
                            </Link>
                            <Link
                                to="/new-user"
                                onClick={() => setMobileNavOpen(false)}
                                className="flex items-center justify-center gap-2 bg-white text-green-600 text-sm font-medium px-4 py-2.5 rounded-lg border border-green-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                            >
                                <UserPlus className="w-4 h-4" />
                                Sign Up
                            </Link>
                            <Link
                                to="/new-user"
                                onClick={() => setMobileNavOpen(false)}
                                className="flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 hover:text-emerald-400 transition-colors"
                            >
                                <Rocket className="w-4 h-4" />
                                Get Started
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section className="max-w-4xl mx-auto px-6 pt-2 sm:pt-16 pb-10 text-center">
                <h1 className="text-2xl md:text-5xl font-bold tracking-tight text-slate-900">
                    The IT dashboard
                    <br />
                    your team deserves
                </h1>

                <p className="mt-6 text-slate-600 max-w-xl mx-auto leading-relaxed">
                    SOLO is a subscription-based platform that unifies IT support
                    ticketing, antivirus management, and remote device monitoring into
                    one secure, self-service portal.
                </p>

                <div className="mt-8 flex items-center justify-center gap-3">
                    <Link
                        to="/new-user"
                        className="flex items-center gap-2 bg-slate-900 text-white text-xs sm:text-sm font-medium px-3 py-2 sm:px-5 py-3 rounded-lg hover:bg-slate-800 hover:text-emerald-400 transition-colors"
                    >
                        <Rocket className="w-4 h-4" />
                        Start free trial
                    </Link>
                    <a
                        href="#features"
                        className="text-xs sm:text-sm font-medium px-5 py-3 rounded-lg border border-slate-300 hover:bg-slate-50 hover:text-emerald-600 transition-colors"
                    >
                        Explore features
                    </a>
                </div>
            </section>

            {/* App preview */}
            <section className="max-w-6xl mx-auto px-6 pb-24">
                <div className="rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/60 overflow-hidden bg-slate-900">
                    {/* Browser chrome */}
                    <div className="flex items-center gap-1.5 px-4 py-3">
                        <span className="w-3 h-3 rounded-full bg-slate-600" />
                        <span className="w-3 h-3 rounded-full bg-slate-600" />
                        <span className="w-3 h-3 rounded-full bg-slate-600" />
                        <span className="mx-auto text-[11px] text-slate-400">
                            app.solo-dashboard.com
                        </span>
                    </div>

                    {/* App body */}
                    <div className="bg-white rounded-t-2xl overflow-x-auto flex">
                        {/* Sidebar */}
                        <aside className="w-52 shrink-0 border-r border-slate-100 py-6 px-4 hidden sm:block">
                            <div className="flex items-center gap-2 px-2 mb-8">
                                <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
                                    <span className="text-white text-[10px] font-bold">V</span>
                                </div>
                                <div className="leading-tight">
                                    <div className="text-[10px] text-slate-400 -mb-0.5">
                                        VISIONtech
                                    </div>
                                    <div className="font-bold text-sm">
                                        SOLO
                                        <span className="block text-[9px] font-normal text-slate-400 -mt-1">
                                            Dashboard Platform
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <nav className="space-y-1">
                                {sidebarLinks.map(({ label, icon: Icon, active }) => (
                                    <a
                                        key={label}
                                        href="#"
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${active
                                            ? "bg-emerald-50 text-emerald-600 font-medium"
                                            : "text-slate-500 hover:bg-slate-50"
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {label}
                                    </a>
                                ))}
                            </nav>
                        </aside>

                        {/* Main */}
                        <main className="flex-1 p-4 sm:p-6 bg-slate-50/50">
                            <p className="text-sm text-slate-400">Welcome back, John Doe!</p>
                            <h2 className="text-lg sm:text-xl font-bold mt-1">Dashboard</h2>
                            <p className="text-sm text-slate-400 mt-0.5">
                                Overview of your account and services
                            </p>

                            {/* Stat cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                                {statCards.map(({ label, value, icon: Icon }) => (
                                    <div
                                        key={label}
                                        className="bg-white rounded-xl border border-slate-100 p-4 flex items-center justify-between"
                                    >
                                        <div>
                                            <p className="text-xs text-slate-400">{label}</p>
                                            <p className="text-lg font-bold mt-1">{value}</p>
                                        </div>
                                        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                            <Icon className="w-4 h-4 text-emerald-500" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Quick actions */}
                            <div className="bg-white rounded-xl border border-slate-100 p-4 mt-4">
                                <p className="text-sm font-semibold">Quick Actions</p>
                                <p className="text-xs text-slate-400">
                                    Common tasks you can perform
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                                    {quickActions.map(({ label, sub, icon: Icon }) => (
                                        <button
                                            key={label}
                                            className="flex items-center gap-2.5 border border-slate-100 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center shrink-0">
                                                <Icon className="w-3.5 h-3.5 text-emerald-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium">{label}</p>
                                                <p className="text-[10px] text-slate-400">{sub}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Subscription + activity */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-4">
                                    <p className="text-sm font-semibold">Subscription</p>
                                    <p className="text-xs text-slate-400">
                                        Your current plan and usage
                                    </p>

                                    <div className="flex items-center justify-between mt-4">
                                        <p className="text-sm font-semibold">Pro Plan</p>
                                        <span className="text-[10px] bg-emerald-50 text-emerald-600 font-medium px-2 py-0.5 rounded-full">
                                            Active
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Monthly subscription
                                    </p>

                                    <div className="mt-4 space-y-3">
                                        <div>
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                <span>Support hours used</span>
                                                <span>3 / 10 hours</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-slate-100">
                                                <div className="h-1.5 rounded-full bg-slate-900 w-[30%]" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                <span>Devices monitored</span>
                                                <span>2 / 5 devices</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-slate-100">
                                                <div className="h-1.5 rounded-full bg-slate-900 w-[40%]" />
                                            </div>
                                        </div>
                                    </div>

                                    <button className="w-full mt-4 text-xs font-medium border border-slate-200 rounded-lg py-2 hover:bg-slate-50 transition-colors">
                                        Manage Subscription
                                    </button>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-100 p-4">
                                    <p className="text-sm font-semibold">Recent Activity</p>
                                    <p className="text-xs text-slate-400">
                                        Your latest actions and updates
                                    </p>

                                    <div className="mt-4 space-y-3">
                                        {recentActivity.map(({ label, time, icon: Icon, tone }) => (
                                            <div key={label} className="flex items-start gap-2.5">
                                                <div
                                                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tone}`}
                                                >
                                                    <Icon className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs leading-tight">{label}</p>
                                                    <p className="text-[10px] text-slate-400">{time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </main>
                    </div>
                </div>

                {/* Trusted by */}
                <section className="max-w-6xl mx-auto px-6 pb-8 sm:pb-20 mt-4">
                    <p className="font-semibold text-center text-sm text-gray-900 mb-8">
                        Trusted by 2,000+ teams, startups and creators
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-60 grayscale">
                        <span className="text-xl font-semibold text-slate-400 tracking-tight">
                            logo <span className="font-normal">ipsum</span>
                        </span>
                        <span className="text-xl font-bold text-slate-400 tracking-tight">
                            Logoipsum
                        </span>
                        <span className="text-xl font-serif italic text-slate-400 tracking-tight">
                            LOGOIPSUM
                        </span>
                        <span className="text-xl font-semibold text-slate-400 tracking-tight">
                            Logoipsum
                        </span>
                        <span className="text-xl font-medium text-slate-400 tracking-tight">
                            Logoipsum
                        </span>
                        <span className="text-lg font-bold text-slate-400 tracking-widest">
                            LOGOIP/UM
                        </span>
                    </div>
                </section>
            </section>

            {/* Core Features */}
            <section id="features" className="max-w-6xl mx-auto px-6 pb-24 scroll-mt-6">
                <div className="text-center max-w-2xl mx-auto">
                    <span className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-full">
                        <Zap className="w-3.5 h-3.5" />
                        Core Features
                    </span>

                    <h2 className="mt-6 text-xl md:text-5xl font-bold tracking-tight text-slate-900">
                        Everything IT support needs
                    </h2>

                    <p className="mt-2 sm:mt-5 text-slate-600 leading-relaxed">
                        SOLO standardizes your IT workflows across support, security, and
                        monitoring all under one subscription.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6 sm:mt-12">
                    {coreFeatures.map(({ label, description, icon: Icon, tone }) => (
                        <div
                            key={label}
                            className="rounded-2xl border border-slate-300 p-6 hover:shadow-lg hover:shadow-slate-100 transition-shadow"
                        >
                            <div className="flex items-center gap-3 sm:block">
                                <div
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}
                                >
                                    <Icon className="w-5 h-5" />
                                </div>

                                <p className="font-bold text-slate-900 sm:mt-5">{label}</p>
                            </div>

                            <p className="mt-4 text-sm text-gray-700 leading-relaxed">
                                {description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Platform Modules */}
            <section id="modules" className="max-w-6xl mx-auto px-6 pb-24 scroll-mt-6">
                <div className="text-center max-w-2xl mx-auto">
                    <span className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-full">
                        <Layers className="w-3.5 h-3.5" />
                        Platform Modules
                    </span>

                    <h2 className="mt-6 text-xl md:text-5xl font-bold tracking-tight text-slate-900">
                        Built around how IT actually works
                    </h2>

                    <p className="mt-2 sm:mt-5 text-slate-600 leading-relaxed">
                        Four purpose-built modules that cover every layer of managed IT
                        service delivery.
                    </p>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-2 gap-3 mt-8 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
                    {platformModules.map(({ label, icon: Icon }) => {
                        const isActive = label === activeModule;
                        return (
                            <button
                                key={label}
                                onClick={() => setActiveModule(label)}
                                className={`flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-full border transition-colors ${isActive
                                    ? "bg-green-500 text-white border-green-500"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mt-14">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900">
                            {currentModule.title}
                        </h3>
                        <p className="mt-4 text-slate-600 leading-relaxed">
                            {currentModule.description}
                        </p>

                        <div className="mt-6 space-y-3">
                            {currentModule.bullets.map((bullet) => (
                                <div key={bullet} className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="text-sm text-slate-700">{bullet}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute -inset-4 bg-emerald-50 rounded-3xl blur-2xl opacity-60 -z-10" />
                        <div className="rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/60 overflow-hidden bg-slate-900 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] text-slate-400">
                                    Users: Last 7 days using median
                                </span>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Monitor className="w-3.5 h-3.5" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: "Load Time vs Bounce Rate", value: "57.1%" },
                                    { label: "Start Render vs Bounce Rate", value: "1.02s" },
                                ].map(({ label, value }) => (
                                    <div
                                        key={label}
                                        className="bg-slate-800/60 rounded-lg p-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] text-slate-400">
                                                {label}
                                            </span>
                                        </div>
                                        <div className="flex items-end gap-[3px] h-16 mt-2">
                                            {Array.from({ length: 14 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="flex-1 rounded-sm bg-cyan-400/80"
                                                    style={{
                                                        height: `${20 + ((i * 37) % 80)}%`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <div className="mt-1 text-[10px] font-semibold text-emerald-400">
                                            {value}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-3 gap-3 mt-3">
                                {[
                                    { label: "Page Load (LUX)", value: "0.7s", color: "text-sky-400" },
                                    { label: "Page Views (LUX)", value: "2.7Mpvs", color: "text-fuchsia-400" },
                                    { label: "Bounce Rate (LUX)", value: "40.6%", color: "text-rose-400" },
                                    { label: "Sessions (LUX)", value: "479K", color: "text-emerald-400" },
                                    { label: "Session Length (LUX)", value: "17min", color: "text-amber-400" },
                                    { label: "PVs Per Session (LUX)", value: "2pvs", color: "text-cyan-400" },
                                ].map(({ label, value, color }) => (
                                    <div
                                        key={label}
                                        className="bg-slate-800/60 rounded-lg p-2.5"
                                    >
                                        <p className="text-[8px] text-slate-400 leading-tight">
                                            {label}
                                        </p>
                                        <p className={`text-sm font-bold mt-1 ${color}`}>
                                            {value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="max-w-6xl mx-auto px-6 pb-24 scroll-mt-6">
                <div className="text-center max-w-2xl mx-auto">
                    <span className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-full">
                        <TrendingUp className="w-3.5 h-3.5" />
                        How It Works
                    </span>

                    <h2 className="mt-6 text-xl md:text-5xl font-bold tracking-tight text-slate-900">
                        From signup to fully managed
                    </h2>

                    <p className="mt-2 sm:mt-5 text-slate-600 leading-relaxed">
                        SOLO gets your team operational in minutes, not weeks.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6 sm:mt-12">
                    {howItWorksSteps.map(({ label, description, icon: Icon }) => (
                        <div
                            key={label}
                            className="rounded-2xl border border-slate-300 p-6 hover:shadow-lg hover:shadow-slate-100 transition-shadow"
                        >
                            <div className="flex items-center gap-4 sm:block">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-900 flex-shrink-0">
                                    <Icon className="w-5 h-5 text-white" />
                                </div>

                                <h3 className="font-bold text-slate-900 text-lg sm:mt-5">
                                    {label}
                                </h3>
                            </div>

                            <p className="mt-4 text-sm text-gray-700 leading-relaxed">
                                {description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Live Analytics */}
            <section id="analytics" className="bg-slate-950 py-24 scroll-mt-6">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <span className="inline-flex items-center gap-2 bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-full border border-slate-700">
                        <Activity className="w-3.5 h-3.5" />
                        Live Analytics
                    </span>

                    <h2 className="mt-6 text-2xl md:text-5xl font-bold tracking-tight text-white">
                        Intelligence at every layer
                    </h2>

                    <p className="mt-2 sm:mt-5 text-slate-400 max-w-xl mx-auto leading-relaxed">
                        Real-time dashboards give admins and users clear visibility into
                        support trends and device health.
                    </p>
                </div>

                <div className="max-w-6xl mx-auto px-6 mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Device Health Overview */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-white font-semibold text-sm">
                                    Device Health Overview
                                </p>
                                <p className="text-slate-500 text-xs mt-0.5">
                                    Healthy vs. Alerts — Last 7 days
                                </p>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-0.5 rounded-full bg-indigo-400 inline-block" />
                                    Healthy
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-0.5 rounded-full bg-amber-400 inline-block" />
                                    Alerts
                                </span>
                            </div>
                        </div>

                        <div className="h-64 mt-4 -ml-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={deviceHealthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="healthyFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: "#e2e8f0" }}
                                        itemStyle={{ color: "#e2e8f0" }}
                                    />
                                    <Area type="monotone" dataKey="healthy" stroke="#818cf8" strokeWidth={2} fill="url(#healthyFill)" dot={false} />
                                    <Area type="monotone" dataKey="alerts" stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 3" fill="transparent" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Ticket Resolution Rate */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <p className="text-white font-semibold text-sm">Ticket Resolution Rate</p>
                        <p className="text-slate-500 text-xs mt-0.5">Open vs. Resolved — Last 6 months</p>

                        <div className="h-64 mt-4 -ml-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ticketResolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: "#e2e8f0" }}
                                        itemStyle={{ color: "#e2e8f0" }}
                                        cursor={{ fill: "#1e293b" }}
                                    />
                                    <Bar dataKey="resolved" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Recent Support Tickets */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-5">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
                        <p className="text-white font-semibold text-sm mb-4">Recent Support Tickets</p>

                        {/* --- MOBILE VIEW: Card Stack (Visible on screens smaller than md) --- */}
                        <div className="md:hidden space-y-3">
                            {recentTickets.map(({ id, user, issue, status, time }) => {
                                const tone = statusTones[status];
                                return (
                                    <div
                                        key={id}
                                        className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-3"
                                    >
                                        {/* Header: ID, Status, & Time */}
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs font-semibold text-slate-300">
                                                {id}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${tone.bg} ${tone.text}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                                                    {status}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    {time}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content: User & Issue Description */}
                                        <div>
                                            <p className="text-xs font-medium text-slate-300 mb-1">{user}</p>
                                            <p className="text-sm text-slate-400 line-clamp-2">{issue}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* --- DESKTOP VIEW: Data Table (Hidden on mobile, visible on md+) --- */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-xs text-slate-500 border-b border-slate-800">
                                        <th className="pb-3 font-normal">Ticket ID</th>
                                        <th className="pb-3 font-normal">User</th>
                                        <th className="pb-3 font-normal">Issue</th>
                                        <th className="pb-3 font-normal">Status</th>
                                        <th className="pb-3 font-normal text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/70">
                                    {recentTickets.map(({ id, user, issue, status, time }) => {
                                        const tone = statusTones[status];
                                        return (
                                            <tr key={id}>
                                                <td className="py-3.5 text-sm font-mono text-slate-200 whitespace-nowrap">
                                                    {id}
                                                </td>
                                                <td className="py-3.5 text-sm text-slate-300 whitespace-nowrap">
                                                    {user}
                                                </td>
                                                <td className="py-3.5 text-sm text-slate-400">
                                                    {issue}
                                                </td>
                                                <td className="py-3.5">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${tone.bg} ${tone.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 text-sm text-slate-500 text-right whitespace-nowrap">
                                                    {time}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security & Compliance */}
            <section id="security" className="max-w-6xl mx-auto px-6 py-24 scroll-mt-6">
                <div className="text-center max-w-2xl mx-auto">
                    <span className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-full">
                        <Lock className="w-3.5 h-3.5" />
                        Security & Compliance
                    </span>

                    <h2 className="mt-6 text-2xl md:text-5xl font-bold tracking-tight text-slate-900">
                        Enterprise-ready from day one
                    </h2>

                    <p className="mt-2 sm:mt-5 text-slate-600 leading-relaxed">
                        SOLO is built with security as a first principle, not an afterthought.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6 sm:mt-12">
                    {securityFeatures.map(({ label, description, icon: Icon, dark }) => (
                        <div
                            key={label}
                            className={`rounded-2xl border p-6 transition-shadow hover:shadow-lg ${dark
                                ? "bg-slate-900 border-slate-900 hover:shadow-slate-300"
                                : "bg-white border-slate-200 hover:shadow-slate-100"
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${dark ? "bg-white" : "bg-slate-900"
                                        }`}
                                >
                                    <Icon
                                        className={`w-5 h-5 ${dark ? "text-slate-900" : "text-white"
                                            }`}
                                    />
                                </div>

                                <h3
                                    className={`text-md font-bold ${dark ? "text-white" : "text-slate-900"
                                        }`}
                                >
                                    {label}
                                </h3>
                            </div>

                            <p
                                className={`mt-4 text-sm leading-relaxed ${dark ? "text-slate-300" : "text-gray-700"
                                    }`}
                            >
                                {description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Integrations */}
            <section id="integrations" className="max-w-6xl mx-auto px-6 pb-24 scroll-mt-6">
                <style>{`
        @keyframes solo-orbit-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes solo-orbit-spin-reverse {
            from { transform: rotate(0deg); }
            to { transform: rotate(-360deg); }
        }
    `}</style>

                <div className="text-center max-w-2xl mx-auto">
                    <span className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-full">
                        <Globe className="w-3.5 h-3.5" />
                        Integration
                    </span>

                    <h2 className="mt-6 text-xl md:text-5xl font-bold tracking-tight text-slate-900">
                        Seamless integration
                        <br />
                        for enhanced efficiency
                    </h2>

                    <p className="mt-2 sm:mt-5 text-slate-600 leading-relaxed">
                        Connect SOLO with the tools your team already relies on, so
                        tickets, alerts, and device data flow into one place without
                        extra manual work.
                    </p>
                </div>

                {/* Container sized down on mobile (max-w-[280px]) and original size on desktop (sm:max-w-[560px]) */}
                <div className="relative mx-auto mt-6 sm:mt-12 w-full max-w-[280px] sm:max-w-[560px] aspect-square">
                    {/* Static orbit rings */}
                    {integrationOrbits.map(({ id, radiusPct }) => {
                        const inset = 50 - radiusPct;
                        return (
                            <div
                                key={`ring-${id}`}
                                className="absolute rounded-full border border-gray-600"
                                style={{
                                    top: `${inset}%`,
                                    left: `${inset}%`,
                                    right: `${inset}%`,
                                    bottom: `${inset}%`,
                                }}
                            />
                        );
                    })}

                    {/* Center hub - responsive dimensions */}
                    <div
                        className="absolute w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200 flex items-center justify-center"
                        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
                    >
                        <Cpu className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>

                    {/* Rotating orbit groups */}
                    {integrationOrbits.map(({ id, durationS, nodes }) => (
                        <div
                            key={`orbit-${id}`}
                            className="absolute inset-0"
                            style={{ animation: `solo-orbit-spin ${durationS}s linear infinite` }}
                        >
                            {nodes.map(({ icon: Icon, left, top, color }, i) => (
                                <div
                                    key={`${id}-node-${i}`}
                                    className="absolute w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-slate-900 shadow-lg shadow-slate-300/40 flex items-center justify-center"
                                    style={{
                                        left: `${left}%`,
                                        top: `${top}%`,
                                        transform: "translate(-50%, -50%)",
                                    }}
                                >
                                    <div
                                        style={{
                                            animation: `solo-orbit-spin-reverse ${durationS}s linear infinite`,
                                        }}
                                        className="flex items-center justify-center"
                                    >
                                        <Icon className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${color}`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </section>


            {/* Pricing */}
            <section id="pricing" className="max-w-6xl mx-auto px-6 pb-24 scroll-mt-6">
                <div className="text-center max-w-2xl mx-auto">
                    <span className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-full">
                        <Star className="w-3.5 h-3.5" />
                        Pricing
                    </span>

                    <h2 className="mt-6 text-xl md:text-5xl font-bold tracking-tight text-slate-900">
                        Simple, transparent pricing
                    </h2>

                    <p className="mt-2 sm:mt-5 text-slate-600 leading-relaxed">
                        Start with what you need. Upgrade as your IT requirements grow.
                    </p>
                </div>

                {/* Billing toggle */}
                <div className="mt-8 flex justify-center">
                    <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full p-1">
                        <button
                            onClick={() => setBillingPeriod("monthly")}
                            className={`text-sm font-medium px-4 py-2 rounded-full transition-colors ${billingPeriod === "monthly"
                                ? "bg-slate-900 text-white"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingPeriod("yearly")}
                            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-colors ${billingPeriod === "yearly"
                                ? "bg-slate-900 text-white"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            Yearly
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">
                                Save 20%
                            </span>
                        </button>
                    </div>
                </div>

                {/* Plan cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 sm:mt-12 items-stretch">
                    {pricingPlans.map(({ name, description, monthlyPrice, cta, highlight, badge, features }) => {
                        const displayPrice =
                            billingPeriod === "yearly"
                                ? Math.round(monthlyPrice * 0.8)
                                : monthlyPrice;

                        return (
                            <div
                                key={name}
                                className={`relative rounded-2xl p-6 flex flex-col h-full ${highlight
                                    ? "bg-green-600 text-white shadow-lg shadow-green-200/50 sm:shadow-2xl sm:shadow-green-200"
                                    : "bg-white border border-slate-200"
                                    }`}
                            >
                                {badge && (
                                    <span className="absolute top-6 right-6 text-[10px] font-semibold bg-slate-900 text-white px-3 py-1 rounded-full">
                                        {badge}
                                    </span>
                                )}

                                <h3 className={`font-bold text-lg ${highlight ? "text-white" : "text-slate-900"}`}>
                                    {name}
                                </h3>
                                <p className={`mt-1.5 text-xs leading-relaxed ${highlight ? "text-emerald-50" : "text-slate-500"}`}>
                                    {description}
                                </p>

                                <div className="mt-6 flex items-end gap-1">
                                    <span className={`text-4xl font-bold tracking-tight ${highlight ? "text-white" : "text-slate-900"}`}>
                                        ${displayPrice}
                                    </span>
                                    <span className={`text-sm mb-1 ${highlight ? "text-emerald-100" : "text-slate-400"}`}>
                                        /mo
                                    </span>
                                </div>

                                <div className="mt-6 space-y-3 flex-1">
                                    {features.map((feature) => (
                                        <div key={feature} className="flex items-start gap-2.5">
                                            <CheckCircle2
                                                className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? "text-white" : "text-green-500"
                                                    }`}
                                            />
                                            <span className={`text-sm ${highlight ? "text-green-50" : "text-slate-700"}`}>
                                                {feature}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <Link
                                    to="/new-user"
                                    className={`w-full mt-8 flex items-center justify-center text-sm font-semibold px-4 py-2.5 rounded-lg border transition-colors ${highlight
                                        ? "bg-white text-green-600 border-white hover:bg-green-50"
                                        : "text-green-600 border-green-600 hover:bg-green-50"
                                        }`}
                                >
                                    {cta}
                                </Link>
                            </div>
                        );
                    })}
                </div>

                {/* Add-ons note */}
                <div className="mt-6 rounded-2xl border border-gray-300 px-6 py-5 text-center">
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Need more? Add <span className="font-semibold text-gray-900">extra support hours</span>,{" "}
                        <span className="font-semibold text-gray-900">additional monitored devices</span>, or{" "}
                        <span className="font-semibold text-gray-900">advanced reporting</span> as à la carte
                        add-ons. All billed with your subscription.
                    </p>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 scroll-mt-6">
                <div className="text-center max-w-2xl mx-auto">
                    <span className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-full">
                        <Star className="w-3.5 h-3.5" />
                        FAQ
                    </span>

                    <h2 className="mt-6 text-xl md:text-5xl font-bold tracking-tight text-slate-900">
                        Common questions
                    </h2>
                </div>

                <div className="mt-6 sm:mt-12 space-y-4">
                    {faqItems.map(({ question, answer }, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <div
                                key={question}
                                className="rounded-2xl border border-slate-200 overflow-hidden transition-colors hover:border-slate-300"
                            >
                                <button
                                    onClick={() => toggle(index)}
                                    aria-expanded={isOpen}
                                    className="w-full flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5 text-left"
                                >
                                    <span className="font-semibold text-sm sm:text-base text-slate-900">
                                        {question}
                                    </span>
                                    <ChevronDown
                                        className={`w-4 h-4 text-emerald-600 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""
                                            }`}
                                    />
                                </button>

                                <div
                                    className={`grid transition-all duration-300 ease-in-out ${isOpen
                                        ? "grid-rows-[1fr] opacity-100"
                                        : "grid-rows-[0fr] opacity-0"
                                        }`}
                                >
                                    <div className="overflow-hidden">
                                        <p className="px-4 sm:px-6 pb-4 sm:pb-5 text-sm text-slate-600 leading-relaxed">
                                            {answer}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* CTA Banner */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
                <div
                    className="relative overflow-hidden rounded-2xl sm:rounded-3xl px-6 py-14 sm:px-12 sm:py-20 text-center"
                    style={{
                        background:
                            "linear-gradient(135deg, #0f5e2e 0%, #16a34a 45%, #22c55e 75%, #10d876 100%)",
                    }}
                >
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                        Ready to modernize your IT support?
                    </h2>

                    <p className="mt-4 sm:mt-5 text-sm sm:text-base text-emerald-50/90 max-w-xl mx-auto leading-relaxed">
                        Join IT teams using SOLO to deliver faster, more reliable managed
                        services — with full visibility from first ticket to resolved.
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto sm:mx-auto">
                        <Link
                            to="/new-user"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-slate-900 text-sm font-semibold px-6 py-3 rounded-full hover:bg-emerald-50 transition-colors"
                        >
                            Start free trial
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <button className="w-full sm:w-auto flex items-center justify-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-full border border-white/70 hover:bg-white/10 transition-colors">
                            Explore the platform
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-950 text-slate-400">
                <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">
                    <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-8">
                        {/* Brand */}
                        <div>
                            <Link to="/new-user" className="inline-block">
                                <img
                                    src={visionLogo}
                                    alt="VISIONtech Logo"
                                    className="h-16 sm:h-24 w-auto object-contain"
                                />
                            </Link>

                            <p className="mt-5 text-sm leading-relaxed max-w-xs">
                                Empowering businesses by providing exceptional IT support that
                                drives growth, ensures robust cybersecurity, and guarantees
                                data integrity.
                            </p>
                        </div>

                        {/* Links + Contact */}
                        <div className="flex flex-col gap-10 lg:contents">
                            {/* Links */}
                            <div>
                                <h3 className="text-white font-bold text-base">
                                    Links
                                </h3>

                                <nav className="mt-5 flex flex-col gap-3">
                                    {footerLinks.map(({ label, href }, index) => (
                                        <a
                                            key={label}
                                            href={href}
                                            className={`text-sm hover:text-emerald-400 transition-colors w-fit ${index === 0
                                                ? "text-white font-medium"
                                                : "text-slate-400"
                                                }`}
                                        >
                                            {label}
                                        </a>
                                    ))}
                                </nav>
                            </div>

                            {/* Contact */}
                            <div>
                                <h3 className="text-white font-bold text-base">
                                    Contact Us
                                </h3>

                                <div className="mt-5 flex flex-col gap-3.5">
                                    {contactDetails.map(({ icon: Icon, label }) => (
                                        <div
                                            key={label}
                                            className="flex items-start gap-2.5"
                                        >
                                            <Icon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                            <span className="text-sm">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="mt-12 border-t border-slate-800" />

                    {/* Bottom Bar */}
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
                        <p className="text-slate-500 text-center sm:text-left">
                            © 2026 New Vision Technologies. All rights reserved.
                        </p>

                        <div className="flex items-center gap-6">
                            {legalLinks.map((link) => (
                                <a
                                    key={link}
                                    href="#"
                                    className="text-slate-400 hover:text-emerald-400 transition-colors"
                                >
                                    {link}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
};

export default SoloLandingPage;