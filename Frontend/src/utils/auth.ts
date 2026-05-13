// utils/auth.ts
import { jwtDecode } from "jwt-decode";

declare global {
  interface Window {
    _inactivityTimer?: ReturnType<typeof setTimeout>;
  }
}

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000; // 5 minutes of no activity

const redirectToLogin = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.replace("/login");
};

// ← Resets the inactivity timer on every user action
const resetInactivityTimer = () => {
  if (window._inactivityTimer) clearTimeout(window._inactivityTimer);

  window._inactivityTimer = setTimeout(() => {
    console.log("💤 User inactive for 5 mins, logging out...");
    redirectToLogin();
  }, INACTIVITY_LIMIT_MS);
};

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown",
  "touchstart", "scroll", "click"
];

export const setupAutoLogout = () => {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const decoded: any = jwtDecode(token);
    if (decoded.exp * 1000 < Date.now()) {
      redirectToLogin();
      return;
    }

    // Start inactivity timer
    resetInactivityTimer();

    // Reset timer on any user activity
    ACTIVITY_EVENTS.forEach(event =>
      window.addEventListener(event, resetInactivityTimer)
    );

    console.log("✅ Inactivity logout armed — 5 mins of no activity = logout");

  } catch {
    redirectToLogin();
  }
};

export const clearAutoLogout = () => {
  if (window._inactivityTimer) clearTimeout(window._inactivityTimer);
  ACTIVITY_EVENTS.forEach(event =>
    window.removeEventListener(event, resetInactivityTimer)
  );
};

export const checkTokenValidity = (): boolean => {
  const publicPaths = ["/login", "/forgot-password", "/reset-password"];
  if (publicPaths.some(p => window.location.pathname.startsWith(p))) return true;

  const token = localStorage.getItem("token");
  if (!token) { redirectToLogin(); return false; }

  try {
    const decoded: any = jwtDecode(token);
    if (decoded.exp * 1000 < Date.now()) { redirectToLogin(); return false; }
    return true;
  } catch {
    redirectToLogin();
    return false;
  }
};