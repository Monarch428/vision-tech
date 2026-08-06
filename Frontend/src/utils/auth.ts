// utils/auth.ts
import { jwtDecode } from "jwt-decode";

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