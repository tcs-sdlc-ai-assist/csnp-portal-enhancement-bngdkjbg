import React from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import { APP_TITLE } from '../../utils/constants.js';

/**
 * Application footer component.
 * Displays copyright notice, version info, CMS compliance notice,
 * and links to privacy policy and terms of service.
 *
 * Only renders when the user is authenticated.
 *
 * @returns {React.ReactElement|null}
 */
export default function Footer() {
  const { isAuthenticated } = useAuth();
  const { sidebarCollapsed } = useApp();

  if (!isAuthenticated) {
    return null;
  }

  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`border-t border-gray-200 bg-white transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'ml-16' : 'ml-64'
      }`}
    >
      <div className="px-4 md:px-6 lg:px-8 py-6">
        {/* CMS Compliance Notice */}
        <div className="mb-4 p-3 bg-csnp-blue-50 border border-csnp-blue-100 rounded-lg">
          <p className="text-xs text-csnp-blue-700 leading-relaxed">
            <span className="font-semibold">CMS Compliance Notice:</span>{' '}
            This portal is designed for use with Chronic Condition Special Needs Plans (C-SNP)
            in compliance with Centers for Medicare &amp; Medicaid Services (CMS) regulations.
            All member data is handled in accordance with HIPAA privacy and security requirements.
            Unauthorized access or misuse of this system is strictly prohibited.
          </p>
        </div>

        {/* Footer Content */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Copyright and Version */}
          <div className="flex flex-col sm:flex-row items-center gap-2 text-xs text-gray-500">
            <span>&copy; {currentYear} {APP_TITLE}. All rights reserved.</span>
            <span className="hidden sm:inline text-gray-300" aria-hidden="true">|</span>
            <span className="text-gray-400">Version 1.0.0</span>
          </div>

          {/* Center: Links */}
          <nav className="flex items-center gap-4" aria-label="Footer navigation">
            <button
              type="button"
              className="text-xs text-csnp-primary-light hover:text-csnp-primary focus:outline-none focus:underline transition-colors duration-200"
              onClick={() => {
                // Privacy policy placeholder - no external navigation in simulation
              }}
            >
              Privacy Policy
            </button>
            <span className="text-gray-300" aria-hidden="true">|</span>
            <button
              type="button"
              className="text-xs text-csnp-primary-light hover:text-csnp-primary focus:outline-none focus:underline transition-colors duration-200"
              onClick={() => {
                // Terms of service placeholder - no external navigation in simulation
              }}
            >
              Terms of Service
            </button>
            <span className="text-gray-300" aria-hidden="true">|</span>
            <button
              type="button"
              className="text-xs text-csnp-primary-light hover:text-csnp-primary focus:outline-none focus:underline transition-colors duration-200"
              onClick={() => {
                // Accessibility statement placeholder - no external navigation in simulation
              }}
            >
              Accessibility
            </button>
          </nav>

          {/* Right: Regulatory Info */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-gray-400"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>HIPAA Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}