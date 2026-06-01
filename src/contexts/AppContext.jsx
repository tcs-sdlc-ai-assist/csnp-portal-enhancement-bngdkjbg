import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';

/**
 * @typedef {'success' | 'warning' | 'error' | 'info'} NotificationType
 */

/**
 * @typedef {Object} Notification
 * @property {string} id - Unique notification identifier
 * @property {NotificationType} type - Notification type
 * @property {string} title - Notification title
 * @property {string} [message] - Optional notification message body
 * @property {number} [duration] - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
 * @property {string} timestamp - ISO timestamp of when the notification was created
 */

/**
 * @typedef {Object} AppContextValue
 * @property {Notification[]} notifications - Active notifications
 * @property {function(NotificationType, string, string=, number=): string} addNotification - Add a notification, returns notification ID
 * @property {function(string): void} removeNotification - Remove a notification by ID
 * @property {function(): void} clearNotifications - Clear all notifications
 * @property {boolean} globalLoading - Whether a global loading state is active
 * @property {string|null} globalLoadingMessage - Optional message for the global loading state
 * @property {function(string=): void} setGlobalLoading - Set global loading state with optional message
 * @property {function(): void} clearGlobalLoading - Clear global loading state
 * @property {boolean} sidebarCollapsed - Whether the sidebar is collapsed
 * @property {function(): void} toggleSidebar - Toggle sidebar collapsed state
 * @property {function(boolean): void} setSidebarCollapsed - Set sidebar collapsed state directly
 * @property {string} theme - Current theme ('light' or 'dark')
 * @property {function(string): void} setTheme - Set the theme
 * @property {function(): void} toggleTheme - Toggle between light and dark themes
 * @property {Object.<string, boolean>} loadingStates - Map of named loading states
 * @property {function(string): void} startLoading - Start a named loading state
 * @property {function(string): void} stopLoading - Stop a named loading state
 * @property {function(string): boolean} isLoading - Check if a named loading state is active
 */

const AppContext = createContext(null);

/**
 * Default auto-dismiss duration for notifications in milliseconds.
 * @type {number}
 */
const DEFAULT_NOTIFICATION_DURATION = 5000;

/**
 * Maximum number of notifications to display at once.
 * @type {number}
 */
const MAX_NOTIFICATIONS = 10;

/**
 * Global application state context provider.
 * Manages notifications, loading states, sidebar toggle, and theme preferences.
 * Provides the useApp hook for consuming components.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function AppProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [globalLoading, setGlobalLoadingState] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    const stored = getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, false);
    return stored === true;
  });
  const [theme, setThemeState] = useState(() => {
    const stored = getItem(STORAGE_KEYS.THEME, 'light');
    return typeof stored === 'string' && (stored === 'light' || stored === 'dark') ? stored : 'light';
  });
  const [loadingStates, setLoadingStates] = useState({});
  const notificationTimersRef = useRef({});

  /**
   * Adds a notification to the notification list.
   * @param {NotificationType} type - Notification type
   * @param {string} title - Notification title
   * @param {string} [message=''] - Optional notification message body
   * @param {number} [duration] - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
   * @returns {string} The notification ID
   */
  const addNotification = useCallback((type, title, message, duration) => {
    const id = uuidv4();
    const validTypes = ['success', 'warning', 'error', 'info'];
    const notificationType = validTypes.includes(type) ? type : 'info';
    const autoDismiss = typeof duration === 'number' ? duration : DEFAULT_NOTIFICATION_DURATION;

    const notification = {
      id,
      type: notificationType,
      title: typeof title === 'string' ? title : '',
      message: typeof message === 'string' ? message : '',
      duration: autoDismiss,
      timestamp: new Date().toISOString(),
    };

    setNotifications((prev) => {
      const updated = [notification, ...prev];
      if (updated.length > MAX_NOTIFICATIONS) {
        const removed = updated.slice(MAX_NOTIFICATIONS);
        for (const removedNotification of removed) {
          if (notificationTimersRef.current[removedNotification.id]) {
            clearTimeout(notificationTimersRef.current[removedNotification.id]);
            delete notificationTimersRef.current[removedNotification.id];
          }
        }
        return updated.slice(0, MAX_NOTIFICATIONS);
      }
      return updated;
    });

    if (autoDismiss > 0) {
      notificationTimersRef.current[id] = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        delete notificationTimersRef.current[id];
      }, autoDismiss);
    }

    return id;
  }, []);

  /**
   * Removes a notification by ID.
   * @param {string} notificationId - The notification ID to remove
   */
  const removeNotification = useCallback((notificationId) => {
    if (typeof notificationId !== 'string' || notificationId.trim().length === 0) {
      return;
    }

    if (notificationTimersRef.current[notificationId]) {
      clearTimeout(notificationTimersRef.current[notificationId]);
      delete notificationTimersRef.current[notificationId];
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  /**
   * Clears all notifications.
   */
  const clearNotifications = useCallback(() => {
    const timerIds = Object.keys(notificationTimersRef.current);
    for (const timerId of timerIds) {
      clearTimeout(notificationTimersRef.current[timerId]);
    }
    notificationTimersRef.current = {};
    setNotifications([]);
  }, []);

  /**
   * Sets the global loading state with an optional message.
   * @param {string} [message] - Optional loading message
   */
  const setGlobalLoading = useCallback((message) => {
    setGlobalLoadingState(true);
    setGlobalLoadingMessage(typeof message === 'string' ? message : null);
  }, []);

  /**
   * Clears the global loading state.
   */
  const clearGlobalLoading = useCallback(() => {
    setGlobalLoadingState(false);
    setGlobalLoadingMessage(null);
  }, []);

  /**
   * Toggles the sidebar collapsed state.
   */
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const newValue = !prev;
      setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, newValue);
      return newValue;
    });
  }, []);

  /**
   * Sets the sidebar collapsed state directly.
   * @param {boolean} collapsed - Whether the sidebar should be collapsed
   */
  const setSidebarCollapsed = useCallback((collapsed) => {
    const value = collapsed === true;
    setSidebarCollapsedState(value);
    setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, value);
  }, []);

  /**
   * Sets the application theme.
   * @param {string} newTheme - The theme to set ('light' or 'dark')
   */
  const setTheme = useCallback((newTheme) => {
    const validThemes = ['light', 'dark'];
    const themeValue = validThemes.includes(newTheme) ? newTheme : 'light';
    setThemeState(themeValue);
    setItem(STORAGE_KEYS.THEME, themeValue);
  }, []);

  /**
   * Toggles between light and dark themes.
   */
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      setItem(STORAGE_KEYS.THEME, newTheme);
      return newTheme;
    });
  }, []);

  /**
   * Starts a named loading state.
   * @param {string} key - The loading state key
   */
  const startLoading = useCallback((key) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      return;
    }
    setLoadingStates((prev) => ({ ...prev, [key.trim()]: true }));
  }, []);

  /**
   * Stops a named loading state.
   * @param {string} key - The loading state key
   */
  const stopLoading = useCallback((key) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      return;
    }
    setLoadingStates((prev) => {
      const updated = { ...prev };
      delete updated[key.trim()];
      return updated;
    });
  }, []);

  /**
   * Checks if a named loading state is active.
   * @param {string} key - The loading state key
   * @returns {boolean}
   */
  const isLoading = useCallback((key) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      return false;
    }
    return loadingStates[key.trim()] === true;
  }, [loadingStates]);

  const contextValue = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    globalLoading,
    globalLoadingMessage,
    setGlobalLoading,
    clearGlobalLoading,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    theme,
    setTheme,
    toggleTheme,
    loadingStates,
    startLoading,
    stopLoading,
    isLoading,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Custom hook to access the global application context.
 * Must be used within an AppProvider.
 * @returns {AppContextValue} The application context value
 */
export function useApp() {
  const context = useContext(AppContext);
  if (context === null) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;