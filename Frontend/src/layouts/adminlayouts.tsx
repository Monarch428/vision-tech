import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { checkTokenValidity } from '../utils/auth'; // ← add this

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation(); // ← add this

  const stored = localStorage.getItem('user');
  const authUser = stored ? JSON.parse(stored) : null;

  // ← add this — checks token on every route change
  useEffect(() => {
    checkTokenValidity();
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg width="18" height="18" fill="none" stroke="#374151" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-800 hidden sm:block">
              Welcome back, <span className="text-green-600">{authUser?.name || 'Administrator'}!</span>
            </span>
            <span className="text-sm font-semibold text-gray-800 sm:hidden">Welcome back!</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative p-2 bg-gray-50 border border-gray-200 rounded-full cursor-pointer hover:bg-gray-100 transition-colors">
              <svg width="15" height="15" fill="none" stroke="#374151" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white" />
            </div>

            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 border border-gray-200 rounded-full bg-white cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold">
                {authUser?.name?.slice(0, 2).toUpperCase() || 'SA'}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[11px] font-semibold text-gray-900 leading-none">{authUser?.name || 'System Administrator'}</span>
                <span className="text-[10px] text-gray-400">{authUser?.email || 'sysadmin@example.com'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* All child pages render here */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}