import type { JSX } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Cookies from "js-cookie";
import { clearCache } from "../../src/hooks/useCacheStorage";
import { currentUserRole } from '../../src/services/admin/userManagement.service';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const PLATFORM_ITEMS = [
  { id: 'dashboard',            label: 'Dashboard',             path: '/user/dashboard',            icon: 'dashboard' },
  { id: 'support',              label: 'Support',               path: '/user/support',              icon: 'support'   },
  { id: 'antivirus',            label: 'Antivirus',             path: '/user/antivirus',            icon: 'antivirus' },
  { id: 'selfhelp',             label: 'Self-Help',             path: '/user/selfhelp',             icon: 'selfhelp'  },
  { id: 'billingsubscriptions', label: 'Billing Subscriptions', path: '/user/billingsubscriptions', icon: 'card'      },
];

const ADMIN_ITEMS = [
  { id: 'admin dashboard', label: 'Admin Dashboard', path: '/admin/adminManagement', icon: 'dashboard'   },
  { id: 'users',           label: 'User Management', path: '/admin/users',           icon: 'users'       },
  { id: 'subscriptions',   label: 'Subscriptions',   path: '/admin/subscriptions',  icon: 'card'        },
  { id: 'servicerequest',  label: 'Service Request', path: '/admin/serviceRequest', icon: 'settings'    },
  { id: 'supportBookings', label: 'Support Booking', path: '/admin/supportBookings', icon: 'booking'    },
  { id: 'Systemlogs',      label: 'System Logs',     path: '/admin/Systemlogs',     icon: 'system-logs' },
];

const SYSTEM_ITEMS = [
  { id: 'System config', label: 'System Configuration', path: '/system', icon: 'users' },
];

type Role = 'admin' | 'support' | 'user' | null;

function getNavGroups(role: Role) {
  switch (role) {
    case 'support':
      return [
        { section: 'Platform', items: PLATFORM_ITEMS },
        { section: 'Admin',    items: ADMIN_ITEMS    },
        { section: 'System',   items: SYSTEM_ITEMS   },
      ];
    case 'user':
      return [
        { section: 'Platform', items: PLATFORM_ITEMS.slice(0, 4) },
      ];
    case 'admin':
      return [
        { section: 'Platform', items: PLATFORM_ITEMS },
        { section: 'Admin',    items: ADMIN_ITEMS    },
      ];
    default:
      return [];
  }
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    dashboard:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    support:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>,
    antivirus:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    selfhelp:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    users:        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    card:         <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
    settings:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    booking:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
    'system-logs':<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M8 6h8M8 12h8M8 18h8"/></svg>,
  };
  return icons[name] || null;
}

// Chevron icons for the toggle button
function ChevronLeft() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [role, setRole]           = useState<Role>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isLg, setIsLg]           = useState(false);

  // Track whether we're on a large screen
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsLg(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsLg(e.matches);
      if (!e.matches) setCollapsed(false); // always expand on small screens
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    currentUserRole()
      .then((res) => setRole(res.data.data.role as Role))
      .catch(() => setRole(null));
  }, []);

  const navGroups = getNavGroups(role);
  // Only apply collapsed state on large screens
  const isCollapsed = isLg && collapsed;

  const handleNav = (path: string) => { navigate(path); onClose(); };

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    Cookies.remove('user');
    await clearCache();
    navigate('/login');
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen bg-white border-r border-gray-300
          flex flex-col z-50 transition-all duration-300 overflow-hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:h-screen lg:flex-shrink-0
          ${isCollapsed ? 'w-[60px]' : 'w-[240px]'}
        `}
      >
        {/* ── Logo + Toggle ── */}
        <div className="flex items-center border-b border-gray-200 px-3 py-4 flex-shrink-0">

          {/* NVT badge — always visible */}
          <div className="bg-green-50 rounded-lg px-2 py-1.5 flex-shrink-0">
            <span className="text-[11px] font-bold text-green-800 tracking-tight">NVT</span>
          </div>

          {/* SOLO text — hidden when collapsed */}
          {!isCollapsed && (
            <div className="ml-3 overflow-hidden flex-1 min-w-0">
              <h2 className="text-[17px] font-bold text-gray-900 leading-none whitespace-nowrap">SOLO</h2>
              <p className="text-[10px] font-semibold text-gray-700 mt-0.5 whitespace-nowrap">Dashboard Platform</p>
            </div>
          )}

          {/* Collapse toggle — only rendered on lg screens */}
          {isLg && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="
                flex-shrink-0 flex items-center justify-center
                w-6 h-6 rounded-full border border-gray-400 bg-white
                text-gray-500 hover:text-green-600 hover:border-green-300
                shadow-sm transition-colors ml-auto
              "
            >
              {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
            </button>
          )}
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {role === null ? (
            <p className={`px-4 text-[12px] text-gray-400 ${isCollapsed ? 'hidden' : ''}`}>Loading…</p>
          ) : (
            navGroups.map((group, gi) => (
              <div key={group.section} className="mb-1">

                {/* Section label */}
                {!isCollapsed && (
                  <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-700 uppercase tracking-widest">
                    {group.section}
                  </p>
                )}

                {/* Thin divider between groups when collapsed */}
                {isCollapsed && gi > 0 && (
                  <div className="mx-3 my-2 h-px bg-gray-100" />
                )}

                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <div key={item.id} className="relative group/navitem">
                      <button
                        onClick={() => handleNav(item.path)}
                        className={`
                          w-full flex items-center gap-2.5 text-[13.5px] font-semibold text-left
                          transition-all
                          ${isCollapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5'}
                          ${isActive
                            ? 'bg-green-50 text-green-800 border-r-2 border-green-600'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          }
                        `}
                      >
                        <span className="w-4 h-4 flex-shrink-0">
                          <Icon name={item.icon} />
                        </span>
                        {!isCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </button>

                      {/* Hover tooltip — only when collapsed */}
                      {isCollapsed && (
                        <div className="
                          pointer-events-none absolute left-full top-1/2 -translate-y-1/2
                          ml-2 z-[999]
                          bg-gray-900 text-white text-[11px] font-medium
                          rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg
                          opacity-0 group-hover/navitem:opacity-100
                          transition-opacity duration-150
                        ">
                          {item.label}
                          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {!isCollapsed && gi < navGroups.length - 1 && (
                  <div className="mx-4 my-2 h-px bg-gray-100" />
                )}
              </div>
            ))
          )}
        </nav>

        {/* ── Sign out ── */}
        <div className={`border-t border-gray-200 flex-shrink-0 ${isCollapsed ? 'p-2' : 'p-4'}`}>
          <div className="relative group/signout">
            <button
              onClick={handleLogout}
              className={`
                w-full flex items-center gap-2 text-xs text-red-500
                hover:bg-red-50 rounded-lg transition-colors font-medium
                ${isCollapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'}
              `}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {!isCollapsed && 'Sign Out'}
            </button>

            {/* Sign out tooltip when collapsed */}
            {isCollapsed && (
              <div className="
                pointer-events-none absolute left-full top-1/2 -translate-y-1/2
                ml-2 z-[999]
                bg-gray-900 text-white text-[11px] font-medium
                rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg
                opacity-0 group-hover/signout:opacity-100
                transition-opacity duration-150
              ">
                Sign Out
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}