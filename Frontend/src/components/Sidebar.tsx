import type { JSX } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV_GROUPS = [
  {
    section: 'Platform',
    items: [
      { id: 'dashboard', label: 'Dashboard',  path: '/user/dashboard',   icon: 'dashboard'  },
      { id: 'support',   label: 'Support',    path: '/user/support',     icon: 'support'    },
      { id: 'antivirus', label: 'Antivirus',  path: '/user/antivirus',   icon: 'antivirus'  },
      { id: 'selfhelp', label: 'Self-Help', path: '/user/selfhelp', icon: 'selfhelp' },
      { id: 'billingsubscriptions', label: 'Billing Subscriptions', path: '/user/billingsubscriptions', icon: 'card' },
      { id: 'rmm',       label: 'RMM',        path: '/rmm',         icon: 'monitor'    },
    ],
  },
  {
    section: 'Admin',
    items: [
      { id: 'admin dashboard', label: 'Admin Dashboard',  path: '/admin/adminManagement',   icon: 'dashboard'  },
      { id: 'users',         label: 'User Management', path: '/admin/users',         icon: 'users'    },
      { id: 'subscriptions', label: 'Subscriptions',   path: '/admin/subscriptions', icon: 'card'     },
      { id: 'servicerequest',      label: 'Service Request',        path: '/admin/serviceRequest',      icon: 'settings' },
      { id: 'Systemlogs', label: 'System Logs',   path: '/admin/Systemlogs', icon: 'system-logs'     }
    ],
  },
  {
    section: 'System',
    items: [
      { id: 'System config',         label: 'System Configuration', path: '/system',         icon: 'users'    },
    ],
  },
];

function Icon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    dashboard: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    support:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>,
    antivirus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    selfhelp:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    monitor:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    users:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    card:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
    settings:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    "system-logs": <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M8 6h8M8 12h8M8 18h8"/></svg>
  };
  return icons[name] || null;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => { navigate(path); onClose(); };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`
        fixed top-0 left-0 h-screen w-[240px] bg-white border-r border-gray-100
        flex flex-col z-50 transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:h-screen lg:flex-shrink-0
      `}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
          <div className="bg-green-50 rounded-lg px-2 py-1.5">
            <span className="text-[11px] font-bold text-green-600 tracking-tight">NVT</span>
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 leading-none">SOLO</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Dashboard Platform</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.section} className="mb-1">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                {group.section}
              </p>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button key={item.id} onClick={() => handleNav(item.path)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-medium text-left transition-all
                      ${isActive ? 'bg-green-50 text-green-700 border-r-2 border-green-500' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                  >
                    <span className="w-4 h-4 flex-shrink-0"><Icon name={item.icon} /></span>
                    {item.label}
                  </button>
                );
              })}
              {gi < NAV_GROUPS.length - 1 && <div className="mx-4 my-2 h-px bg-gray-100" />}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
