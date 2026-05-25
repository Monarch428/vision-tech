import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import AdminLayout from "./layouts/adminlayouts";
import Dashboard from "./pages/user/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import Subscriptions from "./pages/admin/Subscriptions";
import Systemlogs from "./pages/admin/SystemLogs";
import Support from "./pages/user/Support";
import SelfHelp from "./pages/user/Selfhelp";
import AdminManagement from "./pages/admin/adminManagement";
import ServiceRequest from "./pages/admin/ServiceRequest";
import Antivirus from "./pages/user/Antivirus";
import BillingSub from "./pages/user/BillingSub";
import SystemConfig from "./pages/system/systemConfig";
import { useEffect, useRef } from "react";

function App() {
 const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
  }, []);
  
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected — all get sidebar + topbar from AdminLayout */}
        <Route element={<AdminLayout />}>
          <Route path="/user/dashboard" element={<Dashboard />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/subscriptions" element={<Subscriptions />} />
          <Route path="/admin/Systemlogs" element={<Systemlogs />} />
          <Route path="/user/support" element={<Support />} />
          <Route path="/admin/serviceRequest" element={<ServiceRequest />} />
          <Route path="/user/selfhelp" element={<SelfHelp />} />
          <Route path="/user/antivirus" element={<Antivirus />} />
          <Route path="/user/billingsubscriptions" element={<BillingSub />} />
          <Route path="/system" element={<SystemConfig />} />
          <Route path="/admin/adminManagement" element={<AdminManagement />} />
        </Route>

        {/* Redirects */}
        <Route
          path="/user-management"
          element={<Navigate to="/admin/users" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
