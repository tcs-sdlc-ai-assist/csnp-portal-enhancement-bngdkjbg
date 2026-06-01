import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import FormField from '../components/common/FormField.jsx';
import Button from '../components/common/Button.jsx';
import Alert from '../components/common/Alert.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import { APP_TITLE, USER_ROLES } from '../utils/constants.js';

/**
 * Returns the default landing path for a given user role.
 * Members land in the member portal; staff in the operations dashboard.
 * @param {string} [role] - The user's role
 * @returns {string} The landing path
 */
function landingPathForRole(role) {
  return role === USER_ROLES.MEMBER ? '/member' : '/dashboard';
}

/**
 * Available demo accounts for the login page.
 * @type {{ username: string, role: string, label: string }[]}
 */
const DEMO_ACCOUNTS = [
  { username: 'admin', role: 'Administrator', label: 'Full system access' },
  { username: 'jsmith_cm', role: 'Care Manager', label: 'Care management & member outreach' },
  { username: 'mwilson_cp', role: 'Claims Processor', label: 'Claims adjudication & processing' },
  { username: 'kbrown_es', role: 'Enrollment Specialist', label: 'Enrollment intake & processing' },
  { username: 'rjones_aud', role: 'Auditor', label: 'Compliance & audit trail review' },
  { username: 'mthompson', role: 'Member', label: 'Member portal — attestation completed' },
  { username: 'rgarcia', role: 'Member', label: 'Member portal — attestation in progress' },
];

/**
 * Login page component for the CSNP Portal.
 * Displays CSNP Portal branding, username/password form, role indicator,
 * error messages for invalid credentials, and redirects to dashboard on success.
 * Professional healthcare-themed design.
 *
 * @returns {React.ReactElement}
 */
export default function LoginPage() {
  const { login, isAuthenticated, loading: authLoading, error: authError, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  /**
   * Redirect to dashboard if already authenticated.
   */
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state && location.state.from ? location.state.from.pathname : landingPathForRole(user && user.role);
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location, user]);

  /**
   * Handles selecting a demo account.
   * @param {Object} account - The demo account object
   */
  const handleSelectAccount = useCallback((account) => {
    setUsername(account.username);
    setPassword('password');
    setSelectedAccount(account);
    setLoginError(null);
  }, []);

  /**
   * Handles username input change.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleUsernameChange = useCallback((e) => {
    setUsername(e.target.value);
    setLoginError(null);

    const matched = DEMO_ACCOUNTS.find(
      (a) => a.username.toLowerCase() === e.target.value.trim().toLowerCase()
    );
    setSelectedAccount(matched || null);
  }, []);

  /**
   * Handles password input change.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handlePasswordChange = useCallback((e) => {
    setPassword(e.target.value);
    setLoginError(null);
  }, []);

  /**
   * Handles form submission.
   * @param {React.FormEvent} e - Form event
   */
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (typeof username !== 'string' || username.trim().length === 0) {
        setLoginError('Username is required');
        return;
      }

      if (typeof password !== 'string' || password.trim().length === 0) {
        setLoginError('Password is required');
        return;
      }

      setSubmitting(true);
      setLoginError(null);

      try {
        const result = await login(username.trim(), password);

        if (result.success) {
          const from = location.state && location.state.from ? location.state.from.pathname : landingPathForRole(result.user && result.user.role);
          navigate(from, { replace: true });
        } else {
          setLoginError(result.error || 'Invalid username or password. Please try again.');
        }
      } catch (err) {
        console.error('LoginPage: login error:', err);
        setLoginError('An unexpected error occurred. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [username, password, login, navigate, location]
  );

  /**
   * Handles Enter key press on password field.
   * @param {React.KeyboardEvent<HTMLInputElement>} e - Keyboard event
   */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner
          size="lg"
          variant="primary"
          text="Initializing..."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-csnp-blue-50 via-white to-csnp-green-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-csnp-primary flex items-center justify-center shadow-card">
              <svg
                width="28"
                height="28"
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
          <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
            {APP_TITLE}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Chronic Condition Special Needs Plan Management
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-200 overflow-hidden">
          {/* Card Header */}
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Sign In
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Enter your credentials to access the portal
            </p>
          </div>

          {/* Session Expired Notice */}
          {location.state && location.state.from && (
            <div className="px-6 pb-3">
              <Alert
                variant="info"
                title="Authentication Required"
                showIcon={true}
                bordered={true}
                size="sm"
              >
                Please sign in to access the requested page.
              </Alert>
            </div>
          )}

          {/* Login Error */}
          {(loginError || authError) && (
            <div className="px-6 pb-3">
              <Alert
                variant="error"
                title="Sign In Failed"
                showIcon={true}
                bordered={true}
                size="sm"
                dismissible={true}
                onDismiss={() => setLoginError(null)}
              >
                {loginError || authError}
              </Alert>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate className="px-6 pb-6">
            <div className="space-y-4">
              {/* Username Field */}
              <FormField
                name="username"
                label="Username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="Enter your username"
                required={true}
                disabled={submitting}
                autoComplete="username"
                autoFocus={true}
                iconLeft={
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
                  >
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
              />

              {/* Password Field */}
              <FormField
                name="password"
                label="Password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter your password"
                required={true}
                disabled={submitting}
                autoComplete="current-password"
                iconLeft={
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
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                }
              />

              {/* Role Indicator */}
              {selectedAccount && (
                <div className="flex items-center gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-csnp-primary flex items-center justify-center">
                    <svg
                      width="14"
                      height="14"
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
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-csnp-primary">
                      {selectedAccount.role}
                    </p>
                    <p className="text-[10px] text-csnp-blue-700">
                      {selectedAccount.label}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth={true}
                loading={submitting}
                loadingText="Signing in..."
                disabled={submitting || username.trim().length === 0 || password.trim().length === 0}
                iconLeft={
                  !submitting ? (
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
                  ) : null
                }
              >
                Sign In
              </Button>
            </div>
          </form>

          {/* Divider */}
          <div className="px-6 pb-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400 uppercase tracking-wider font-medium">
                  Demo Accounts
                </span>
              </div>
            </div>
          </div>

          {/* Demo Account Quick Select */}
          <div className="px-6 pb-6">
            <p className="text-[10px] text-gray-400 mb-3">
              Click an account below to auto-fill credentials. Any non-empty password is accepted.
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((account) => {
                const isSelected = selectedAccount && selectedAccount.username === account.username;
                return (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => handleSelectAccount(account)}
                    disabled={submitting}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-1 ${
                      isSelected
                        ? 'bg-csnp-blue-50 border-csnp-primary shadow-sm'
                        : 'bg-white border-gray-200 hover:border-csnp-primary-light hover:bg-gray-50'
                    } ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isSelected
                        ? 'bg-csnp-primary text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {account.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold ${isSelected ? 'text-csnp-primary' : 'text-gray-900'}`}>
                          {account.username}
                        </p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-csnp-primary text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {account.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {account.label}
                      </p>
                    </div>
                    {isSelected && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-csnp-primary flex-shrink-0"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-3">
          {/* HIPAA Notice */}
          <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
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
            <p className="text-[10px] text-gray-500 leading-relaxed text-left">
              <span className="font-semibold text-csnp-primary">HIPAA Compliant System:</span>{' '}
              This portal contains Protected Health Information (PHI). Unauthorized access is
              strictly prohibited and subject to federal penalties under HIPAA (45 CFR §164.312).
              All access is monitored and logged.
            </p>
          </div>

          {/* Copyright */}
          <p className="text-[10px] text-gray-400">
            &copy; {new Date().getFullYear()} {APP_TITLE}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}