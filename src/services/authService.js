/**
 * Authentication and authorization service for the CSNP Portal.
 * Provides JWT simulation with localStorage-based session management,
 * role-based access control, and audit logging of auth events.
 * @module authService
 */

import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem, removeItem } from '../utils/storage.js';
import { STORAGE_KEYS, USER_ROLES, AUDIT_ACTIONS, SESSION_TIMEOUT } from '../utils/constants.js';
import { logAction } from './auditLogger.js';

/**
 * localStorage key for users collection.
 * @type {string}
 */
const USERS_KEY = 'csnp_users';

/**
 * Simulated JWT token prefix.
 * @type {string}
 */
const TOKEN_PREFIX = 'csnp_jwt_';

/**
 * @typedef {Object} AuthUser
 * @property {string} id - Unique user identifier
 * @property {string} username - Username
 * @property {string} firstName - First name
 * @property {string} lastName - Last name
 * @property {string} email - Email address
 * @property {string} role - User role from USER_ROLES
 * @property {boolean} active - Whether user is active
 */

/**
 * @typedef {Object} AuthResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {AuthUser|null} user - The authenticated user, or null on failure
 * @property {string|null} token - The simulated JWT token, or null on failure
 * @property {string} [error] - Error message if operation failed
 */

/**
 * Generates a simulated JWT token string.
 * @param {Object} user - The user object to encode
 * @returns {string} A simulated JWT token
 */
function generateToken(user) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: Date.now(),
    exp: Date.now() + (SESSION_TIMEOUT * 1000),
    jti: uuidv4(),
  }));
  const signature = btoa(`${TOKEN_PREFIX}${user.id}_${Date.now()}`);
  return `${header}.${payload}.${signature}`;
}

/**
 * Decodes a simulated JWT token and returns the payload.
 * @param {string} token - The JWT token to decode
 * @returns {Object|null} The decoded payload, or null if invalid
 */
function decodeToken(token) {
  if (typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Checks whether a token is expired.
 * @param {string} token - The JWT token to check
 * @returns {boolean} Whether the token is expired
 */
function isTokenExpired(token) {
  const payload = decodeToken(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }

  return Date.now() > payload.exp;
}

/**
 * Retrieves all users from localStorage.
 * @returns {Object[]} Array of user objects
 */
function getUsers() {
  const users = getItem(USERS_KEY, []);
  if (!Array.isArray(users)) {
    return [];
  }
  return users;
}

/**
 * Finds a user by username (case-insensitive).
 * @param {string} username - The username to search for
 * @returns {Object|null} The user object, or null if not found
 */
function findUserByUsername(username) {
  if (typeof username !== 'string' || username.trim().length === 0) {
    return null;
  }

  const users = getUsers();
  const normalizedUsername = username.trim().toLowerCase();
  const found = users.find(
    (user) => user.username && user.username.toLowerCase() === normalizedUsername
  );
  return found || null;
}

/**
 * Finds a user by ID.
 * @param {string} userId - The user ID to search for
 * @returns {Object|null} The user object, or null if not found
 */
function findUserById(userId) {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return null;
  }

  const users = getUsers();
  const found = users.find((user) => user.id === userId);
  return found || null;
}

/**
 * Creates a sanitized user object safe for storage and return.
 * Strips any sensitive fields and returns only public user data.
 * @param {Object} user - The raw user object
 * @returns {AuthUser} Sanitized user object
 */
function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    // Member-role users are linked to a member record in `csnp_members`.
    memberId: user.memberId || null,
    active: user.active !== undefined ? user.active : true,
  };
}

/**
 * Updates the session expiry timestamp in localStorage.
 * @returns {void}
 */
function refreshSessionExpiry() {
  const expiry = new Date(Date.now() + (SESSION_TIMEOUT * 1000)).toISOString();
  setItem(STORAGE_KEYS.SESSION_EXPIRY, expiry);
  setItem(STORAGE_KEYS.LAST_ACTIVITY, new Date().toISOString());
}

/**
 * Checks whether the current session has expired based on stored expiry.
 * @returns {boolean} Whether the session is expired
 */
function isSessionExpired() {
  const expiry = getItem(STORAGE_KEYS.SESSION_EXPIRY, null);
  if (!expiry || typeof expiry !== 'string') {
    return true;
  }

  try {
    const expiryDate = new Date(expiry);
    if (isNaN(expiryDate.getTime())) {
      return true;
    }
    return Date.now() > expiryDate.getTime();
  } catch {
    return true;
  }
}

/**
 * Authenticates a user with username and password.
 * In this simulation, any password is accepted for existing active users.
 * Logs the authentication event to the audit trail.
 * @param {string} username - The username to authenticate
 * @param {string} password - The password (accepted for any non-empty value in simulation)
 * @returns {AuthResult} The authentication result
 */
export function login(username, password) {
  if (typeof username !== 'string' || username.trim().length === 0) {
    return { success: false, user: null, token: null, error: 'Username is required' };
  }

  if (typeof password !== 'string' || password.trim().length === 0) {
    return { success: false, user: null, token: null, error: 'Password is required' };
  }

  try {
    const user = findUserByUsername(username);

    if (!user) {
      logAction(AUDIT_ACTIONS.LOGIN, 'unknown', {
        targetType: 'session',
        targetId: '',
        description: `Failed login attempt for username: ${username.trim()}`,
        metadata: { reason: 'user_not_found', username: username.trim() },
        ipAddress: '127.0.0.1',
      }, 'auth');

      return { success: false, user: null, token: null, error: 'Invalid username or password' };
    }

    if (!user.active) {
      logAction(AUDIT_ACTIONS.LOGIN, user.id, {
        targetType: 'session',
        targetId: user.id,
        description: `Failed login attempt for inactive user: ${user.username}`,
        metadata: { reason: 'account_inactive', username: user.username },
        ipAddress: '127.0.0.1',
      }, 'auth');

      return { success: false, user: null, token: null, error: 'Account is inactive. Please contact an administrator.' };
    }

    const token = generateToken(user);
    const sanitizedUser = sanitizeUser(user);

    setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    setItem(STORAGE_KEYS.USER, sanitizedUser);
    setItem(STORAGE_KEYS.USER_ROLE, user.role);
    refreshSessionExpiry();

    logAction(AUDIT_ACTIONS.LOGIN, user.id, {
      targetType: 'session',
      targetId: user.id,
      description: `${user.firstName} ${user.lastName} logged in`,
      metadata: { username: user.username, role: user.role },
      ipAddress: '127.0.0.1',
    }, 'auth');

    return { success: true, user: sanitizedUser, token };
  } catch (error) {
    console.error('authService.login: unexpected error:', error);
    return { success: false, user: null, token: null, error: 'An unexpected error occurred during login' };
  }
}

/**
 * Logs out the current user by clearing all session data from localStorage.
 * Logs the logout event to the audit trail.
 * @returns {boolean} Whether the logout succeeded
 */
export function logout() {
  try {
    const currentUser = getCurrentUser();

    if (currentUser) {
      logAction(AUDIT_ACTIONS.LOGOUT, currentUser.id, {
        targetType: 'session',
        targetId: currentUser.id,
        description: `${currentUser.firstName} ${currentUser.lastName} logged out`,
        metadata: { username: currentUser.username, role: currentUser.role },
        ipAddress: '127.0.0.1',
      }, 'auth');
    }

    removeItem(STORAGE_KEYS.AUTH_TOKEN);
    removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    removeItem(STORAGE_KEYS.USER);
    removeItem(STORAGE_KEYS.USER_ROLE);
    removeItem(STORAGE_KEYS.SESSION_EXPIRY);
    removeItem(STORAGE_KEYS.LAST_ACTIVITY);

    return true;
  } catch (error) {
    console.error('authService.logout: unexpected error:', error);
    return false;
  }
}

/**
 * Returns the currently authenticated user from localStorage.
 * Returns null if no user is authenticated or the session has expired.
 * @returns {AuthUser|null} The current user, or null if not authenticated
 */
export function getCurrentUser() {
  try {
    const token = getItem(STORAGE_KEYS.AUTH_TOKEN, null);
    if (!token) {
      return null;
    }

    if (isTokenExpired(token) || isSessionExpired()) {
      clearSessionData();
      return null;
    }

    const user = getItem(STORAGE_KEYS.USER, null);
    if (!user || typeof user !== 'object' || !user.id) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('authService.getCurrentUser: unexpected error:', error);
    return null;
  }
}

/**
 * Checks whether a user is currently authenticated with a valid session.
 * @returns {boolean} Whether the user is authenticated
 */
export function isAuthenticated() {
  try {
    const token = getItem(STORAGE_KEYS.AUTH_TOKEN, null);
    if (!token) {
      return false;
    }

    if (isTokenExpired(token) || isSessionExpired()) {
      clearSessionData();
      return false;
    }

    const user = getItem(STORAGE_KEYS.USER, null);
    if (!user || typeof user !== 'object' || !user.id) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('authService.isAuthenticated: unexpected error:', error);
    return false;
  }
}

/**
 * Checks whether the current user has a specific role.
 * @param {string} role - The role to check from USER_ROLES
 * @returns {boolean} Whether the current user has the specified role
 */
export function hasRole(role) {
  if (typeof role !== 'string' || role.trim().length === 0) {
    return false;
  }

  try {
    const user = getCurrentUser();
    if (!user) {
      return false;
    }

    return user.role === role.trim();
  } catch (error) {
    console.error('authService.hasRole: unexpected error:', error);
    return false;
  }
}

/**
 * Checks whether the current user has any of the specified roles.
 * @param {string[]} roles - Array of roles to check from USER_ROLES
 * @returns {boolean} Whether the current user has any of the specified roles
 */
export function hasAnyRole(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return false;
  }

  try {
    const user = getCurrentUser();
    if (!user) {
      return false;
    }

    return roles.some((role) => typeof role === 'string' && user.role === role.trim());
  } catch (error) {
    console.error('authService.hasAnyRole: unexpected error:', error);
    return false;
  }
}

/**
 * Returns the current user's role.
 * @returns {string|null} The user's role, or null if not authenticated
 */
export function getCurrentRole() {
  try {
    const user = getCurrentUser();
    if (!user) {
      return null;
    }

    return user.role || null;
  } catch (error) {
    console.error('authService.getCurrentRole: unexpected error:', error);
    return null;
  }
}

/**
 * Returns the current authentication token.
 * @returns {string|null} The auth token, or null if not authenticated
 */
export function getToken() {
  try {
    const token = getItem(STORAGE_KEYS.AUTH_TOKEN, null);
    if (!token || typeof token !== 'string') {
      return null;
    }

    if (isTokenExpired(token)) {
      clearSessionData();
      return null;
    }

    return token;
  } catch (error) {
    console.error('authService.getToken: unexpected error:', error);
    return null;
  }
}

/**
 * Refreshes the current session by extending the expiry time.
 * Should be called on user activity to keep the session alive.
 * @returns {boolean} Whether the session was refreshed
 */
export function refreshSession() {
  try {
    if (!isAuthenticated()) {
      return false;
    }

    const user = getCurrentUser();
    if (!user) {
      return false;
    }

    const newToken = generateToken(user);
    setItem(STORAGE_KEYS.AUTH_TOKEN, newToken);
    refreshSessionExpiry();

    return true;
  } catch (error) {
    console.error('authService.refreshSession: unexpected error:', error);
    return false;
  }
}

/**
 * Returns the remaining session time in seconds.
 * @returns {number} Remaining seconds, or 0 if session is expired or not authenticated
 */
export function getSessionTimeRemaining() {
  try {
    const expiry = getItem(STORAGE_KEYS.SESSION_EXPIRY, null);
    if (!expiry || typeof expiry !== 'string') {
      return 0;
    }

    const expiryDate = new Date(expiry);
    if (isNaN(expiryDate.getTime())) {
      return 0;
    }

    const remaining = Math.floor((expiryDate.getTime() - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch (error) {
    console.error('authService.getSessionTimeRemaining: unexpected error:', error);
    return 0;
  }
}

/**
 * Checks whether the current user is an admin.
 * @returns {boolean}
 */
export function isAdmin() {
  return hasRole(USER_ROLES.ADMIN);
}

/**
 * Checks whether the current user is a care manager.
 * @returns {boolean}
 */
export function isCareManager() {
  return hasRole(USER_ROLES.CARE_MANAGER);
}

/**
 * Checks whether the current user is a claims processor.
 * @returns {boolean}
 */
export function isClaimsProcessor() {
  return hasRole(USER_ROLES.CLAIMS_PROCESSOR);
}

/**
 * Checks whether the current user is an enrollment specialist.
 * @returns {boolean}
 */
export function isEnrollmentSpecialist() {
  return hasRole(USER_ROLES.ENROLLMENT_SPECIALIST);
}

/**
 * Checks whether the current user is a provider.
 * @returns {boolean}
 */
export function isProvider() {
  return hasRole(USER_ROLES.PROVIDER);
}

/**
 * Checks whether the current user is a member.
 * @returns {boolean}
 */
export function isMember() {
  return hasRole(USER_ROLES.MEMBER);
}

/**
 * Checks whether the current user is an auditor.
 * @returns {boolean}
 */
export function isAuditor() {
  return hasRole(USER_ROLES.AUDITOR);
}

/**
 * Clears all session-related data from localStorage.
 * Used internally when a session is detected as expired.
 * @returns {void}
 */
function clearSessionData() {
  try {
    removeItem(STORAGE_KEYS.AUTH_TOKEN);
    removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    removeItem(STORAGE_KEYS.USER);
    removeItem(STORAGE_KEYS.USER_ROLE);
    removeItem(STORAGE_KEYS.SESSION_EXPIRY);
    removeItem(STORAGE_KEYS.LAST_ACTIVITY);
  } catch (error) {
    console.error('authService.clearSessionData: unexpected error:', error);
  }
}

/**
 * Validates that the current session is still valid and the user exists.
 * Useful for periodic session validation checks.
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateSession() {
  try {
    const token = getItem(STORAGE_KEYS.AUTH_TOKEN, null);
    if (!token) {
      return { valid: false, reason: 'No authentication token found' };
    }

    if (isTokenExpired(token)) {
      clearSessionData();
      return { valid: false, reason: 'Authentication token has expired' };
    }

    if (isSessionExpired()) {
      clearSessionData();
      return { valid: false, reason: 'Session has expired due to inactivity' };
    }

    const user = getItem(STORAGE_KEYS.USER, null);
    if (!user || typeof user !== 'object' || !user.id) {
      clearSessionData();
      return { valid: false, reason: 'No valid user data found in session' };
    }

    const storedUser = findUserById(user.id);
    if (!storedUser) {
      clearSessionData();
      return { valid: false, reason: 'User account no longer exists' };
    }

    if (!storedUser.active) {
      clearSessionData();
      return { valid: false, reason: 'User account has been deactivated' };
    }

    return { valid: true };
  } catch (error) {
    console.error('authService.validateSession: unexpected error:', error);
    return { valid: false, reason: 'Session validation failed due to an unexpected error' };
  }
}