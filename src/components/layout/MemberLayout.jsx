import React, { useState, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { MemberProvider, useMember } from '../../contexts/MemberContext.jsx';
import { APP_TITLE } from '../../utils/constants.js';

/**
 * Member portal navigation items.
 * @type {{ to: string, label: string, end?: boolean, icon: React.ReactElement }[]}
 */
const MEMBER_NAV = [
  {
    to: '/member',
    label: 'Home',
    end: true,
    icon: (
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z" />
    ),
  },
  {
    to: '/member/account',
    label: 'My Account',
    icon: (
      <>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  },
  {
    to: '/member/pcp',
    label: 'Change PCP',
    icon: (
      <>
        <path d="M11 2a2 2 0 00-2 2v1H8a2 2 0 00-2 2v0a2 2 0 002 2h1v1a2 2 0 002 2h0a2 2 0 002-2v-1h1a2 2 0 002-2v0a2 2 0 00-2-2h-1V4a2 2 0 00-2-2z" />
        <path d="M5 21v-1a5 5 0 015-5h4a5 5 0 015 5v1" />
      </>
    ),
  },
  {
    to: '/member/documents',
    label: 'Documents',
    icon: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </>
    ),
  },
  {
    to: '/member/notifications',
    label: 'Notifications',
    icon: (
      <>
        <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </>
    ),
  },
];

/**
 * A single member-nav link with active styling.
 * @param {Object} props
 * @param {Object} props.item - The nav item
 * @returns {React.ReactElement}
 */
function MemberNavLink({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light ${
          isActive
            ? 'bg-csnp-primary text-white'
            : 'text-gray-600 hover:text-csnp-primary hover:bg-csnp-blue-50'
        }`
      }
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {item.icon}
      </svg>
      <span className="hidden sm:inline">{item.label}</span>
    </NavLink>
  );
}

/**
 * The member portal chrome: top bar with branding, navigation, member
 * identity, and sign-out. Renders the active member page via <Outlet />.
 *
 * @returns {React.ReactElement}
 */
function MemberShell() {
  const { user, logout } = useAuth();
  const { member } = useMember();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const displayName = member
    ? `${member.firstName} ${member.lastName}`
    : (user ? `${user.firstName} ${user.lastName}` : 'Member');
  const initials = `${(member?.firstName || user?.firstName || 'M').charAt(0)}${(member?.lastName || user?.lastName || '').charAt(0)}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Branding */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-csnp-primary flex items-center justify-center">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold text-csnp-primary">{APP_TITLE}</p>
                <p className="text-[10px] text-gray-400 -mt-0.5">Member Portal</p>
              </div>
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {MEMBER_NAV.map((item) => (
                <MemberNavLink key={item.to} item={item} />
              ))}
            </nav>

            {/* Identity + sign out */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
                <div className="leading-tight text-right">
                  <p className="text-xs font-semibold text-gray-900">{displayName}</p>
                  <p className="text-[10px] text-gray-400">Member</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-csnp-primary hover:text-csnp-primary focus:outline-none focus:ring-2 focus:ring-csnp-primary-light transition-colors duration-150"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="hidden sm:inline">Sign Out</span>
              </button>
              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light"
                aria-label="Toggle navigation menu"
                aria-expanded={menuOpen}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {menuOpen ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {menuOpen && (
            <nav className="md:hidden flex flex-col gap-1 pb-3" onClick={() => setMenuOpen(false)}>
              {MEMBER_NAV.map((item) => (
                <MemberNavLink key={item.to} item={item} />
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Member portal layout. Wraps the member chrome in a MemberProvider so all
 * member pages can access the current member record via useMember().
 *
 * @returns {React.ReactElement}
 */
export default function MemberLayout() {
  return (
    <MemberProvider>
      <MemberShell />
    </MemberProvider>
  );
}
