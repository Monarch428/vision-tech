import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Mail } from "lucide-react";

import logo from "../../assets/logo.png";

// NOTE: This is a temporary/placeholder policy generated from the content
// already on the SOLO marketing site (footer contact details, Security &
// Compliance section, pricing/billing copy). Have this reviewed by an
// attorney before treating it as your real Privacy Policy.

const sections = [
    {
        heading: "1. Information We Collect",
        body: [
            {
                sub: "Account Information",
                text: "When you register for SOLO, we collect information such as your name, email address, phone number, billing address, and payment details.",
            },
            {
                sub: "Device & Monitoring Data",
                text: "If you enroll devices in our RMM service, we collect technical information about those devices, including device health metrics, performance data, uptime and usage statistics, and diagnostic logs.",
            },
            {
                sub: "Support & Ticketing Data",
                text: "When you submit a support ticket, we collect the content of your request, any file attachments you provide, and communications between you and our support team.",
            },
            {
                sub: "Usage Data",
                text: "We automatically collect information about how you interact with the Service, including login activity, feature usage, and session data.",
            },
            {
                sub: "Payment Information",
                text: "Subscription payments are processed through our payment partners, Stripe and Razorpay. We do not store full payment card details on our own servers.",
            },
        ],
    },
    {
        heading: "2. How We Use Your Information",
        list: [
            "Provide, operate, and maintain the Service, including support ticketing, antivirus management, and RMM monitoring",
            "Process subscription billing and manage your account",
            "Send you service notifications, security alerts, and administrative messages",
            "Detect, investigate, and prevent fraudulent transactions and other unlawful or abusive activity",
            "Maintain audit logs of administrative actions for security and compliance purposes",
            "Improve and develop new features for the Service",
        ],
    },
    {
        heading: "3. How We Protect Your Information",
        list: [
            "Encryption in Transit — all data transmitted between your device and our servers is encrypted using TLS",
            "Password Hashing — passwords are never stored in plaintext; they use industry-standard hashing algorithms",
            "Role-Based Access Control — access is restricted by role (End User, Admin, System Admin) on a least-privilege basis",
            "Multi-Factor Authentication — email OTP-based MFA is available, and login activity is audited",
            "Audit Logging — administrative actions are recorded in an audit trail",
            "Rate Limiting & Abuse Prevention — rate limiting and file upload validation reduce the risk of abuse",
        ],
        note: "No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.",
    },
    {
        heading: "4. Sharing of Information",
        text: "We do not sell your personal information. We may share information with:",
        list: [
            "Service providers who help us operate the Service, including payment processors (Stripe, Razorpay) and infrastructure/hosting providers",
            "Law enforcement or regulators where required by law or to protect our rights, users, or the public",
            "Successors in the event of a merger, acquisition, or sale of assets, subject to standard confidentiality protections",
        ],
    },
    {
        heading: "5. Data Retention",
        text: "We retain account information, support ticket history, device monitoring data, and audit logs for as long as your account is active or as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce our agreements.",
    },
    {
        heading: "6. Your Choices & Rights",
        text: "Depending on your location, you may have rights to access, correct, delete, or export your personal information, and to object to or restrict certain processing. To exercise these rights, contact us using the details below.",
    },
    {
        heading: "7. Children's Privacy",
        text: "The Service is not directed to individuals under the age of 18, and we do not knowingly collect personal information from children.",
    },
    {
        heading: "8. Changes to This Policy",
        text: "We may update this Privacy Policy from time to time. Material changes will be communicated via the Service or by email prior to taking effect.",
    },
];

const contactDetails = [
    { icon: MapPin, label: "99 Main St. Nyack NY 10960" },
    { icon: Phone, label: "+1 (888) 661-2048" },
    { icon: Mail, label: "support@newvtech.com" },
];

const PrivacyPolicy: React.FC = () => {
    return (
        <div className="min-h-screen bg-white text-slate-900">
            {/* Header */}
            <header className="border-b border-slate-100">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3">
                        <img src={logo} alt="SOLO Logo" className="h-9 w-auto object-contain" />
                        <div className="font-bold text-base">
                            SOLO
                            <span className="block text-[11px] font-normal text-slate-400 -mt-1">
                                Dashboard
                            </span>
                        </div>
                    </Link>

                    <Link
                        to="/"
                        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to home
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
                <span className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-full">
                    Legal
                </span>

                <h1 className="mt-6 text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">
                    Privacy Policy
                </h1>

                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    This is a temporary placeholder policy. Have it reviewed by a qualified
                    attorney before relying on it as your live Privacy Policy.
                </div>

                <p className="mt-8 text-slate-600 leading-relaxed">
                    New Vision Technologies ("New Vision Technologies," "we," "us," or "our")
                    operates the SOLO Dashboard Platform (the "Service"), which provides IT
                    support ticketing, antivirus management, and remote monitoring and
                    management (RMM) services. This Privacy Policy explains how we collect,
                    use, disclose, and safeguard information when you use the Service.
                </p>

                <div className="mt-10 space-y-10">
                    {sections.map((section) => (
                        <section key={section.heading}>
                            <h2 className="text-xl font-bold text-slate-900">{section.heading}</h2>

                            {section.text && (
                                <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                                    {section.text}
                                </p>
                            )}

                            {section.body && (
                                <div className="mt-4 space-y-4">
                                    {section.body.map((item) => (
                                        <div key={item.sub}>
                                            <p className="font-semibold text-sm text-slate-900">
                                                {item.sub}
                                            </p>
                                            <p className="mt-1 text-sm sm:text-base text-slate-600 leading-relaxed">
                                                {item.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {section.list && (
                                <ul className="mt-4 space-y-2">
                                    {section.list.map((item) => (
                                        <li key={item} className="flex items-start gap-2.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                                            <span className="text-sm sm:text-base text-slate-600 leading-relaxed">
                                                {item}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {section.note && (
                                <p className="mt-4 text-sm text-slate-500 italic">{section.note}</p>
                            )}
                        </section>
                    ))}

                    <section>
                        <h2 className="text-xl font-bold text-slate-900">9. Contact Us</h2>
                        <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                            If you have questions about this Privacy Policy, please contact us:
                        </p>
                        <div className="mt-4 space-y-2.5">
                            {contactDetails.map(({ icon: Icon, label }) => (
                                <div key={label} className="flex items-center gap-2.5">
                                    <Icon className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="text-sm text-slate-600">{label}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default PrivacyPolicy;