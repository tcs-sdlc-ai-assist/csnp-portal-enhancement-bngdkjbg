import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useApp } from '../../contexts/AppContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { USER_ROLES } from '../../utils/constants.js';

/**
 * @typedef {Object} NavItem
 * @property {string} label - Display label
 * @property {string} path - Route path
 * @property {string} icon - SVG icon path data
 * @property {string[]} roles - Roles that can see this item (empty = all roles)
 */

/**
 * SVG icon paths for navigation items.
 * Using Heroicons-style 24x24 path data.
 */
const ICONS = {
  dashboard:
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
  eligibility:
    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  enrollment:
    'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  benefits:
    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  providers:
    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  careManagement:
    'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  claims:
    'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z',
  compliance:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  auditLogs:
    'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  settings:
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  settingsInner:
    'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

/**
 * Navigation items configuration with role-based visibility.
 * An empty roles array means the item is visible to all authenticated users.
 * @type {NavItem[]}
 */
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'dashboard',
    roles: [],
  },
  {
    label: 'Eligibility',
    path: '/eligibility',
    icon: 'eligibility',
    roles: [
      USER_ROLES.ADMIN,
      USER_ROLES.ENROLLMENT_SPECIALIST,
      USER_ROLES.CARE_MANAGER,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: 'Enrollment',
    path: '/enrollment',
    icon: 'enrollment',
    roles: [
      USER_ROLES.ADMIN,
      USER_ROLES.ENROLLMENT_SPECIALIST,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: 'Benefits',
    path: '/benefits',
    icon: 'benefits',
    roles: [
      USER_ROLES.ADMIN,
      USER_ROLES.ENROLLMENT_SPECIALIST,
      USER_ROLES.CARE_MANAGER,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: 'Providers',
    path: '/providers',
    icon: 'providers',
    roles: [
      USER_ROLES.ADMIN,
      USER_ROLES.CARE_MANAGER,
      USER_ROLES.ENROLLMENT_SPECIALIST,
      USER_ROLES.PROVIDER,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: 'Care Management',
    path: '/care-management',
    icon: 'careManagement',
    roles: [
      USER_ROLES.ADMIN,
      USER_ROLES.CARE_MANAGER,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: 'Claims',
    path: '/claims',
    icon: 'claims',
    roles: [
      USER_ROLES.ADMIN,
      USER_ROLES.CLAIMS_PROCESSOR,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: 'Compliance',
    path: '/compliance',
    icon: 'compliance',
    roles: [
      USER_ROLES.ADMIN,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: 'Audit Logs',
    path: '/audit-logs',
    icon: 'auditLogs',
    roles: [
      USER_ROLES.ADMIN,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: 'settings',
    roles: [
      USER_ROLES.ADMIN,
    ],
  },
];

/**
 * Renders an SVG icon for a navigation item.
 * @param {Object} props
 * @param {string} props.name - Icon name from ICONS map
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
function NavIcon({ name, className }) {
  const baseClass = 'flex-shrink-0';
  const combinedClass = className ? `${baseClass} ${className}` : baseClass;

  if (name === 'settings') {
    return (
      <svg
        className={combinedClass}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICONS.settings} />
        <path d={ICONS.settingsInner} />
      </svg>
    );
  }

  const iconPath = ICONS[name];
  if (!iconPath) {
    return null;
  }

  return (
    <svg
      className={combinedClass}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPath} />
    </svg>
  );
}

NavIcon.propTypes = {
  name: PropTypes.string.isRequired,
  className: PropTypes.string,
};

NavIcon.defaultProps = {
  className: '',
};

/**
 * Collapsible sidebar navigation component with module icons and labels.
 * Highlights the active route, supports role-based menu visibility,
 * and integrates with AppContext for collapse state and AuthContext for role checks.
 *
 * @returns {React.ReactElement}
 */
export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useApp();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  /**
   * Filters navigation items based on the current user's role.
   * Items with an empty roles array are visible to all authenticated users.
   */
  const visibleNavItems = useMemo(() => {
    if (!isAuthenticated || !user) {
      return [];
    }

    const userRole = user.role;

    return NAV_ITEMS.filter((item) => {
      if (item.roles.length === 0) {
        return true;
      }
      return item.roles.includes(userRole);
    });
  }, [isAuthenticated, user]);

  /**
   * Determines if a nav item is currently active based on the route.
   * @param {string} path - The nav item path
   * @returns {boolean}
   */
  function isActive(path) {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard');
    }
    return location.pathname.startsWith(path);
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-screen bg-csnp-primary-dark text-white transition-all duration-300 ease-in-out flex flex-col ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
      aria-label="Main navigation"
    >
      {/* Header / Logo Area */}
      <div className={`flex items-center h-16 border-b border-csnp-blue-800 ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!sidebarCollapsed && (
          <span className="text-lg font-bold tracking-tight text-white truncate">
            CSNP Portal
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-csnp-blue-300 hover:text-white hover:bg-csnp-blue-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {sidebarCollapsed ? (
              <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4" aria-label="Sidebar navigation">
        <ul className="space-y-1 px-2">
          {visibleNavItems.map((item) => {
            const active = isActive(item.path);

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`flex items-center rounded-lg transition-colors duration-200 group ${
                    sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                  } ${
                    active
                      ? 'bg-csnp-primary text-white shadow-sm'
                      : 'text-csnp-blue-200 hover:bg-csnp-blue-800 hover:text-white'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <NavIcon
                    name={item.icon}
                    className={active ? 'text-white' : 'text-csnp-blue-300 group-hover:text-white'}
                  />
                  {!sidebarCollapsed && (
                    <span className="ml-3 text-sm font-medium truncate">
                      {item.label}
                    </span>
                  )}
                  {active && !sidebarCollapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-csnp-secondary-light flex-shrink-0" />
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info Footer */}
      {user && (
        <div className={`border-t border-csnp-blue-800 p-3 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          {sidebarCollapsed ? (
            <div
              className="w-8 h-8 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white"
              title={`${user.firstName} ${user.lastName}`}
            >
              {user.firstName ? user.firstName.charAt(0).toUpperCase() : ''}
              {user.lastName ? user.lastName.charAt(0).toUpperCase() : ''}
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {user.firstName ? user.firstName.charAt(0).toUpperCase() : ''}
                {user.lastName ? user.lastName.charAt(0).toUpperCase() : ''}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-csnp-blue-300 truncate">
                  {user.role ? user.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}