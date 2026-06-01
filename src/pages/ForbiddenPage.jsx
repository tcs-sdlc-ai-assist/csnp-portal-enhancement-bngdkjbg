import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Button from '../components/common/Button.jsx';
import { APP_TITLE } from '../utils/constants.js';

/**
 * 403 Forbidden page component.
 * Displayed when a user lacks the required role to access a route.
 * Shows an access denied message, the user's current role, the
 * requested path, and navigation links back to the dashboard or login.
 *
 * @returns {React.ReactElement}
 */
export default function ForbiddenPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Handles logout action.
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-csnp-blue-50 via-white to-csnp-green-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Forbidden Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-csnp-alert-error"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
        </div>

        {/* 403 Indicator */}
        <div className="mb-4">
          <p className="text-7xl font-bold text-csnp-alert-error tracking-tight">
            403
          </p>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Access Denied
        </h1>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          You do not have permission to access this page.
          {user && (
            <span>
              {' '}Your current role (<strong>{user.role ? user.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown'}</strong>) does not have the required permissions.
            </span>
          )}
        </p>

        {/* Attempted Path */}
        <div className="mb-6 p-3 bg-gray-100 rounded-lg">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
            Requested Path
          </p>
          <p className="text-sm font-mono text-gray-700 truncate" title={location.pathname}>
            {location.pathname}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={() => window.history.back()}
            iconLeft={
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
                <polyline points="15 18 9 12 15 6" />
              </svg>
            }
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
            iconLeft={
              isAuthenticated ? (
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
                  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
                </svg>
              ) : (
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
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              )
            }
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Go to Login'}
          </Button>
        </div>

        {/* Sign Out Option */}
        {isAuthenticated && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-csnp-primary-light hover:text-csnp-primary focus:outline-none focus:underline transition-colors duration-200"
            >
              Sign out and log in with a different account
            </button>
          </div>
        )}

        {/* CMS Compliance Notice */}
        <div className="mt-8">
          <div className="flex items-start gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100 text-left">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-csnp-primary flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
              <span className="font-semibold">HIPAA Security:</span>{' '}
              Access to this resource is restricted based on role-based access control (RBAC)
              per HIPAA security requirements (45 CFR §164.312). This access attempt has been
              logged in the audit trail.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-[10px] text-gray-400">
          &copy; {new Date().getFullYear()} {APP_TITLE}. All rights reserved.
        </p>
      </div>
    </div>
  );
}