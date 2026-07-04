import { useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

type OS = "windows" | "mac";

const STEPS: Record<OS, string[]> = {
    windows: [
        "Save any open work - a network restart will briefly disconnect you from the internet.",
        "Close any applications that are actively transferring files or streaming.",
        "Click the Start menu, then Settings > Network & Internet.",
        "Under 'Advanced network settings', click 'Network reset'.",
        "Click 'Reset now', then confirm when prompted. Windows will restart in about 5 minutes.",
        "Alternatively: unplug your router and modem from power for 30 seconds, then plug them back in - modem first, router second.",
        "Wait for the modem's lights to stabilize (1-2 minutes), then the router's (1-2 minutes).",
        "Reconnect to your Wi-Fi network from the taskbar icon, or plug the ethernet cable back in.",
        "Open a browser or run a speed test to confirm the connection is restored.",
        "If the issue persists, contact support with your router model and ISP details.",
    ],
    mac: [
        "Save any open work - a network restart will briefly disconnect you from the internet.",
        "Close any applications that are actively transferring files or streaming.",
        "Click the Apple menu, then System Settings > Network.",
        "Select Wi-Fi in the sidebar, click the three-dot menu, and choose 'Turn Wi-Fi Off'.",
        "Wait 10 seconds, then turn Wi-Fi back on from the same menu.",
        "Alternatively: unplug your router and modem from power for 30 seconds, then plug them back in - modem first, router second.",
        "Wait for the modem's lights to stabilize (1-2 minutes), then the router's (1-2 minutes).",
        "Reconnect to your Wi-Fi network from the menu bar icon, or plug the ethernet cable back in.",
        "Open Safari or run a speed test to confirm the connection is restored.",
        "If the issue persists, contact support with your router model and ISP details.",
    ],
};

const OS_LABEL: Record<OS, string> = {
    windows: "Windows",
    mac: "Mac",
};

const ArrowLeftIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function NetworkRestartGuide() {
    const [activeOs, setActiveOs] = useState<OS>("windows");
    const navigate = useNavigate();

    const handleDownloadPdf = () => {
        const doc = new jsPDF();
        const marginX = 15;

        (["windows", "mac"] as OS[]).forEach((os, osIndex) => {
            if (osIndex > 0) doc.addPage();
            let y = 20;

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text(`Network Restart - Instructions (${OS_LABEL[os]})`, marginX, y);
            y += 10;

            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.text(
                "Follow these steps to manually restart your network connection.",
                marginX,
                y
            );
            y += 12;

            STEPS[os].forEach((step, i) => {
                const lines = doc.splitTextToSize(`${i + 1}. ${step}`, 180);
                doc.text(lines, marginX, y);
                y += lines.length * 7 + 3;

                if (y > 270 && i < STEPS[os].length - 1) {
                    doc.addPage();
                    y = 20;
                }
            });
        });

        doc.save("network-restart-instructions.pdf");
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sticky top bar with back button */}
            <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-200 px-4 sm:px-6 py-3">
                <div className="mx-auto">
                    <button
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-md shadow-sm transition-colors"
                    >
                        <ArrowLeftIcon />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                </div>
            </div>

            <div className="px-4 sm:px-6 py-6 sm:py-10 mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Network Restart - Instructions
                </h1>
                <p className="text-gray-700 mt-2 text-sm sm:text-md">
                    Follow these steps to manually restart your network connection.
                </p>

                {/* OS tabs */}
                <div className="mt-6 flex w-full sm:w-auto sm:inline-flex bg-gray-200 rounded-xl p-1">
                    {(["windows", "mac"] as OS[]).map((os) => (
                        <button
                            key={os}
                            onClick={() => setActiveOs(os)}
                            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${activeOs === os
                                ? "bg-white text-green-700 shadow-sm"
                                : "text-gray-600 hover:text-gray-800"
                                }`}
                        >
                            {OS_LABEL[os]}
                        </button>
                    ))}
                </div>

                <ol className="mt-8 flex flex-col gap-4">
                    {STEPS[activeOs].map((step, i) => (
                        <li key={i} className="flex gap-3 items-start">
                            <span className="shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 font-semibold text-sm flex items-center justify-center">
                                {i + 1}
                            </span>
                            <p className="text-gray-800 text-sm sm:text-base leading-relaxed">{step}</p>
                        </li>
                    ))}
                </ol>

                <button
                    onClick={handleDownloadPdf}
                    className="mt-10 w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-3 px-6 rounded-xl transition-colors"
                >
                    Download as PDF (Windows &amp; Mac)
                </button>
            </div>
        </div>
    );
}