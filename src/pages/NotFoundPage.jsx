import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Button from '../components/common/Button.jsx';
import { APP_TITLE } from '../utils/constants.js';

/**
 * 404 Not Found page component.
 * Displays CSNP Portal branding, a helpful message indicating the page
 * was not found, and navigation links back to the dashboard or login.
 *
 * @returns {React.ReactElement}
 */
export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-csnp-blue-50 via-white to-csnp-green-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-csnp-primary flex items-center justify-center shadow-card">
            <svg
              width="32"
              height="32"
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
        </div>

        {/* 404 Indicator */}
        <div className="mb-6">
          <p className="text-7xl font-bold text-csnp-primary tracking-tight">
            404
          </p>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Page Not Found
        </h1>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-8 leading-relaxed max-w-sm mx-auto">
          The page you are looking for doesn&apos;t exist or has been moved.
          Please check the URL or navigate back to the {isAuthenticated ? 'dashboard' : 'login page'}.
        </p>

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

        {/* CMS Compliance Notice */}
        <div className="mt-10">
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
              Access to this portal is restricted based on role-based access control (RBAC)
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