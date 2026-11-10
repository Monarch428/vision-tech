// utils/auth.ts
import { jwtDecode } from "jwt-decode";
import { refreshAuthToken } from "../services/auth/auth.service";

declare global {
  interface Window {
    _inactivityTimer?: ReturnType<typeof setTimeout>;
  }
}

const redirectToLogin = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.replace("/login");
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

// Sliding session: while the user keeps navigating, swap a token that expires
// within REFRESH_WINDOW_MS for a fresh one. Idle users still time out.
const REFRESH_WINDOW_MS = 5 * 60 * 1000;
let refreshInFlight: Promise<void> | null = null;

export const refreshTokenIfExpiring = (): Promise<void> => {
  const token = localStorage.getItem("token");
  if (!token || refreshInFlight) return refreshInFlight ?? Promise.resolve();

  try {
    const { exp } = jwtDecode<{ exp: number }>(token);
    const msLeft = exp * 1000 - Date.now();
    if (msLeft <= 0 || msLeft > REFRESH_WINDOW_MS) return Promise.resolve();
  } catch {
    return Promise.resolve();
  }

  refreshInFlight = refreshAuthToken(token)
    .then(({ token: fresh }) => localStorage.setItem("token", fresh))
    .catch(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
};
