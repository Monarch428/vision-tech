import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Mail } from "lucide-react";

import logo from "../../assets/logo.png";

// NOTE: This is a temporary/placeholder Terms & Conditions document generated
// from the content already on the SOLO marketing site (pricing plans, billing
// providers, security features). Have this reviewed by an attorney before
// treating it as your real Terms.

const sections = [
    {
        heading: "1. The Service",
        text: "SOLO is a subscription-based platform that provides:",
        list: [
            "Support Ticketing — submitting, tracking, and resolving IT help requests",
            "Antivirus Management — scheduling installations and monitoring protection status",
            "Remote Monitoring & Management (RMM) — live device health monitoring, alerts, and historical reporting",
            "Self-Help Tools — guided browser cleanup, network restart, scan initiation, and backup assistance",
            "Support Hour Booking — scheduling one-on-one support sessions",
        ],
    },
    {
        heading: "2. Accounts",
        text: "You must provide accurate and complete information when creating an account and keep your login credentials secure. You are responsible for all activity that occurs under your account. Notify us immediately at support@newvtech.com if you suspect unauthorized access.",
    },
    {
        heading: "3. Subscriptions & Billing",
        list: [
            "Plans are billed on a monthly or yearly basis through our payment processors, Stripe and Razorpay",
            "Yearly billing is offered at a discount compared to monthly billing, as displayed at checkout",
            "You may upgrade, downgrade, or cancel your subscription at any time; changes take effect at the start of your next billing cycle",
            "Additional support hours, monitored devices, and advanced reporting may be purchased as à la carte add-ons and will be billed alongside your subscription",
            "Fees are non-refundable except as required by law or as otherwise stated at the time of purchase",
        ],
    },
    {
        heading: "4. Plan Tiers",
        text: "We offer multiple plan tiers (e.g., Basic Support, Security Plus, Managed Pro), each with different feature sets, support hour allotments, and device limits, as described on our pricing page. Features available to you depend on your active plan.",
    },
    {
        heading: "5. Acceptable Use",
        text: "You agree not to:",
        list: [
            "Use the Service for any unlawful purpose or in violation of any applicable law",
            "Attempt to gain unauthorized access to any part of the Service, other accounts, or connected devices",
            "Interfere with or disrupt the integrity or performance of the Service",
            "Upload malicious code, files, or content designed to harm the Service or other users",
            "Circumvent rate limits, security controls, or access restrictions",
        ],
        note: "We reserve the right to suspend or terminate accounts that violate these Terms.",
    },
    {
        heading: "6. Device Monitoring & Data",
        text: "By enrolling a device in RMM monitoring or requesting antivirus services, you authorize us to collect device health, performance, and diagnostic data as necessary to provide the Service. You are responsible for ensuring you have the right to enroll any device you connect to the Service, including devices owned by a third party (e.g., an employer).",
    },
    {
        heading: "7. Security",
        text: "We implement safeguards including TLS encryption, password hashing, role-based access control, audit logging, and multi-factor authentication. However, no platform can guarantee absolute security, and you use the Service at your own risk with respect to matters outside our reasonable control.",
    },
    {
        heading: "8. Intellectual Property",
        text: "The Service, including its software, design, and content, is owned by New Vision Technologies and protected by intellectual property laws. These Terms do not grant you any ownership rights in the Service.",
    },
    {
        heading: "9. Disclaimers",
        text: 'The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee that the Service will be uninterrupted, error-free, or completely secure.',
    },
    {
        heading: "10. Limitation of Liability",
        text: "To the fullest extent permitted by law, New Vision Technologies shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or business arising from your use of the Service.",
    },
    {
        heading: "11. Termination",
        text: "We may suspend or terminate your access to the Service at any time for violation of these Terms or for non-payment. You may cancel your subscription at any time through your account or by contacting support.",
    },
    {
        heading: "12. Changes to These Terms",
        text: "We may update these Terms from time to time. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.",
    },
    {
        heading: "13. Governing Law",
        text: "These Terms shall be governed by the laws of the State of New York, without regard to its conflict of law principles. [Confirm and update this jurisdiction with legal counsel.]",
    },
];

const contactDetails = [
    { icon: MapPin, label: "99 Main St. Nyack NY 10960" },
    { icon: Phone, label: "+1 (888) 661-2048" },
    { icon: Mail, label: "support@newvtech.com" },
];

const TermsAndConditions: React.FC = () => {
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
                    Terms &amp; Conditions
                </h1>

                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    This is a temporary placeholder document. Have it reviewed by a
                    qualified attorney before relying on it as your live Terms &amp;
                    Conditions.
                </div>

                <p className="mt-8 text-slate-600 leading-relaxed">
                    These Terms &amp; Conditions ("Terms") govern your access to and use
                    of the SOLO Dashboard Platform (the "Service"), operated by New Vision
                    Technologies ("New Vision Technologies," "we," "us," or "our"). By
                    creating an account or using the Service, you agree to be bound by
                    these Terms.
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
                        <h2 className="text-xl font-bold text-slate-900">14. Contact Us</h2>
                        <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                            Questions about these Terms should be directed to:
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

export default TermsAndConditions;