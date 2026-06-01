import React from 'react';
import PropTypes from 'prop-types';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';

/**
 * Forbidden page component displayed when a user lacks the required role.
 *
 * @returns {React.ReactElement}
 */
function ForbiddenPage() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
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
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border-2 border-csnp-primary text-csnp-primary bg-transparent hover:bg-csnp-primary hover:text-white focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 transition-colors duration-200"
          >
            Go Back
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-csnp-primary text-white hover:bg-csnp-primary-dark focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 transition-colors duration-200"
          >
            Go to Dashboard
          </a>
        </div>

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
      </div>
    </div>
  );
}

/**
 * Route protection wrapper component.
 * Checks authentication status and role permissions before rendering child routes.
 * Redirects to login if unauthenticated, shows forbidden page if unauthorized.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child routes/components to render if authorized
 * @param {string[]} [props.allowedRoles=[]] - Array of roles allowed to access this route (empty = all authenticated users)
 * @param {string} [props.redirectTo='/login'] - Path to redirect to if unauthenticated
 * @param {boolean} [props.showForbidden=true] - Whether to show the forbidden page (vs redirect) when unauthorized
 * @param {string} [props.forbiddenRedirectTo] - Path to redirect to when unauthorized (used when showForbidden is false)
 * @returns {React.ReactElement}
 */
export default function ProtectedRoute({
  children,
  allowedRoles = [],
  redirectTo = '/login',
  showForbidden = true,
  forbiddenRedirectTo,
}) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth state is being initialized
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner
          size="lg"
          variant="primary"
          text="Verifying authentication..."
        />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location }}
        replace
      />
    );
  }

  // Check role-based access if allowedRoles is specified and non-empty
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRole = user.role;
    const hasRequiredRole = allowedRoles.some(
      (role) => typeof role === 'string' && role.trim() === userRole
    );

    if (!hasRequiredRole) {
      // If showForbidden is false and a redirect path is provided, redirect
      if (!showForbidden && typeof forbiddenRedirectTo === 'string' && forbiddenRedirectTo.trim().length > 0) {
        return (
          <Navigate
            to={forbiddenRedirectTo.trim()}
            replace
          />
        );
      }

      // Show the forbidden page
      return <ForbiddenPage />;
    }
  }

  // User is authenticated and authorized — render children
  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedRoles: PropTypes.arrayOf(PropTypes.string),
  redirectTo: PropTypes.string,
  showForbidden: PropTypes.bool,
  forbiddenRedirectTo: PropTypes.string,
};

ProtectedRoute.defaultProps = {
  allowedRoles: [],
  redirectTo: '/login',
  showForbidden: true,
  forbiddenRedirectTo: undefined,
};