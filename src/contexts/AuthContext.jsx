import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  isAuthenticated as checkIsAuthenticated,
  hasRole as checkHasRole,
  hasAnyRole as checkHasAnyRole,
  getCurrentRole,
  refreshSession,
  getSessionTimeRemaining,
  validateSession,
  isAdmin,
  isCareManager,
  isClaimsProcessor,
  isEnrollmentSpecialist,
  isProvider,
  isMember,
  isAuditor,
} from '../services/authService.js';
import { SESSION_TIMEOUT } from '../utils/constants.js';

/**
 * @typedef {Object} AuthContextValue
 * @property {import('../services/authService.js').AuthUser|null} user - Current authenticated user
 * @property {boolean} isAuthenticated - Whether a user is currently authenticated
 * @property {boolean} loading - Whether auth state is being initialized
 * @property {string|null} error - Most recent auth error message
 * @property {function(string, string): Promise<import('../services/authService.js').AuthResult>} login - Login function
 * @property {function(): void} logout - Logout function
 * @property {function(string): boolean} hasRole - Check if current user has a specific role
 * @property {function(string[]): boolean} hasAnyRole - Check if current user has any of the specified roles
 * @property {function(): string|null} getRole - Get current user's role
 * @property {function(): number} getTimeRemaining - Get remaining session time in seconds
 * @property {function(): void} refresh - Refresh the current session
 * @property {boolean} isAdminUser - Whether current user is an admin
 * @property {boolean} isCareManagerUser - Whether current user is a care manager
 * @property {boolean} isClaimsProcessorUser - Whether current user is a claims processor
 * @property {boolean} isEnrollmentSpecialistUser - Whether current user is an enrollment specialist
 * @property {boolean} isProviderUser - Whether current user is a provider
 * @property {boolean} isMemberUser - Whether current user is a member
 * @property {boolean} isAuditorUser - Whether current user is an auditor
 */

const AuthContext = createContext(null);

/**
 * Session activity check interval in milliseconds.
 * @type {number}
 */
const SESSION_CHECK_INTERVAL = 60000;

/**
 * Activity refresh debounce interval in milliseconds.
 * @type {number}
 */
const ACTIVITY_DEBOUNCE_MS = 30000;

/**
 * Authentication context provider component.
 * Manages authentication state, session monitoring, and provides
 * auth utilities to all child components via the useAuth hook.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastActivityRefreshRef = useRef(0);
  const sessionCheckIntervalRef = useRef(null);

  /**
   * Initializes auth state from localStorage on mount.
   */
  useEffect(() => {
    try {
      const authenticated = checkIsAuthenticated();
      if (authenticated) {
        const currentUser = getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticatedState(true);
        } else {
          setUser(null);
          setIsAuthenticatedState(false);
        }
      } else {
        setUser(null);
        setIsAuthenticatedState(false);
      }
    } catch (err) {
      console.error('AuthContext: failed to initialize auth state:', err);
      setUser(null);
      setIsAuthenticatedState(false);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Periodically checks session validity and updates state if expired.
   */
  useEffect(() => {
    if (!isAuthenticatedState) {
      if (sessionCheckIntervalRef.current !== null) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      return;
    }

    function checkSession() {
      const sessionResult = validateSession();
      if (!sessionResult.valid) {
        setUser(null);
        setIsAuthenticatedState(false);
        setError('Session expired. Please log in again.');
      }
    }

    sessionCheckIntervalRef.current = setInterval(checkSession, SESSION_CHECK_INTERVAL);

    return () => {
      if (sessionCheckIntervalRef.current !== null) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    };
  }, [isAuthenticatedState]);

  /**
   * Refreshes session on user activity (mouse move, key press, click).
   * Debounced to avoid excessive localStorage writes.
   */
  useEffect(() => {
    if (!isAuthenticatedState) {
      return;
    }

    function handleActivity() {
      const now = Date.now();
      if (now - lastActivityRefreshRef.current > ACTIVITY_DEBOUNCE_MS) {
        lastActivityRefreshRef.current = now;
        refreshSession();
      }
    }

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [isAuthenticatedState]);

  /**
   * Authenticates a user with username and password.
   * @param {string} username - The username
   * @param {string} password - The password
   * @returns {Promise<import('../services/authService.js').AuthResult>} The auth result
   */
  const login = useCallback(async (username, password) => {
    setError(null);
    setLoading(true);

    try {
      const result = authLogin(username, password);

      if (result.success && result.user) {
        setUser(result.user);
        setIsAuthenticatedState(true);
        setError(null);
        lastActivityRefreshRef.current = Date.now();
      } else {
        setUser(null);
        setIsAuthenticatedState(false);
        setError(result.error || 'Login failed');
      }

      return result;
    } catch (err) {
      console.error('AuthContext.login: unexpected error:', err);
      const errorMessage = 'An unexpected error occurred during login';
      setUser(null);
      setIsAuthenticatedState(false);
      setError(errorMessage);
      return { success: false, user: null, token: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logs out the current user and clears auth state.
   */
  const logout = useCallback(() => {
    try {
      authLogout();
    } catch (err) {
      console.error('AuthContext.logout: unexpected error:', err);
    } finally {
      setUser(null);
      setIsAuthenticatedState(false);
      setError(null);
    }
  }, []);

  /**
   * Checks whether the current user has a specific role.
   * @param {string} role - The role to check
   * @returns {boolean}
   */
  const hasRole = useCallback((role) => {
    return checkHasRole(role);
  }, []);

  /**
   * Checks whether the current user has any of the specified roles.
   * @param {string[]} roles - Array of roles to check
   * @returns {boolean}
   */
  const hasAnyRole = useCallback((roles) => {
    return checkHasAnyRole(roles);
  }, []);

  /**
   * Returns the current user's role.
   * @returns {string|null}
   */
  const getRole = useCallback(() => {
    return getCurrentRole();
  }, []);

  /**
   * Returns the remaining session time in seconds.
   * @returns {number}
   */
  const getTimeRemaining = useCallback(() => {
    return getSessionTimeRemaining();
  }, []);

  /**
   * Refreshes the current session.
   */
  const refresh = useCallback(() => {
    if (isAuthenticatedState) {
      const refreshed = refreshSession();
      if (!refreshed) {
        setUser(null);
        setIsAuthenticatedState(false);
        setError('Session could not be refreshed. Please log in again.');
      }
    }
  }, [isAuthenticatedState]);

  const contextValue = {
    user,
    isAuthenticated: isAuthenticatedState,
    loading,
    error,
    login,
    logout,
    hasRole,
    hasAnyRole,
    getRole,
    getTimeRemaining,
    refresh,
    isAdminUser: isAuthenticatedState ? isAdmin() : false,
    isCareManagerUser: isAuthenticatedState ? isCareManager() : false,
    isClaimsProcessorUser: isAuthenticatedState ? isClaimsProcessor() : false,
    isEnrollmentSpecialistUser: isAuthenticatedState ? isEnrollmentSpecialist() : false,
    isProviderUser: isAuthenticatedState ? isProvider() : false,
    isMemberUser: isAuthenticatedState ? isMember() : false,
    isAuditorUser: isAuthenticatedState ? isAuditor() : false,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Custom hook to access the authentication context.
 * Must be used within an AuthProvider.
 * @returns {AuthContextValue} The authentication context value
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;