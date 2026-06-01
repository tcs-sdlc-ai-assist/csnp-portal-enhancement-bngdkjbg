/**
 * Custom React hook for localStorage-backed state management.
 * Syncs React state with localStorage, handles JSON serialization/deserialization,
 * provides loading states, and supports removal of stored values.
 * @module useLocalStorage
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getItem, setItem, removeItem, hasItem } from '../utils/storage.js';

/**
 * @typedef {Object} UseLocalStorageReturn
 * @property {*} value - The current value from localStorage (parsed)
 * @property {function(*): void} setValue - Sets a new value in both state and localStorage
 * @property {function(): void} remove - Removes the value from both state and localStorage, resetting to defaultValue
 * @property {boolean} loading - Whether the initial value is still being loaded from localStorage
 * @property {boolean} exists - Whether the key currently exists in localStorage
 * @property {string|null} error - Error message if the last operation failed, or null
 */

/**
 * Custom React hook that synchronizes React state with localStorage.
 * Handles JSON serialization/deserialization automatically and provides
 * loading states for initial hydration from localStorage.
 *
 * @param {string} key - The localStorage key to use
 * @param {*} [defaultValue=null] - Default value if key does not exist in localStorage
 * @returns {UseLocalStorageReturn} The localStorage state and control functions
 *
 * @example
 * const { value, setValue, remove, loading, exists, error } = useLocalStorage('csnp_theme', 'light');
 */
export function useLocalStorage(key, defaultValue = null) {
  const [value, setValueState] = useState(() => {
    try {
      const stored = getItem(key, undefined);
      if (stored !== undefined) {
        return stored;
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exists, setExists] = useState(() => {
    try {
      return hasItem(key);
    } catch {
      return false;
    }
  });

  const keyRef = useRef(key);
  const defaultValueRef = useRef(defaultValue);

  // Update refs when key or defaultValue changes
  useEffect(() => {
    keyRef.current = key;
    defaultValueRef.current = defaultValue;
  }, [key, defaultValue]);

  // Initial load from localStorage
  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const keyExists = hasItem(key);
      setExists(keyExists);

      if (keyExists) {
        const stored = getItem(key, defaultValue);
        setValueState(stored);
      } else {
        setValueState(defaultValue);
      }
    } catch (err) {
      console.error(`useLocalStorage: failed to read key "${key}":`, err);
      setError(`Failed to read from localStorage: ${err.message || 'Unknown error'}`);
      setValueState(defaultValue);
      setExists(false);
    } finally {
      setLoading(false);
    }
  }, [key, defaultValue]);

  /**
   * Sets a new value in both React state and localStorage.
   * Supports functional updates (like useState).
   * @param {*} newValue - The new value, or a function that receives the previous value and returns the new value
   */
  const setValue = useCallback((newValue) => {
    setError(null);

    try {
      setValueState((prevValue) => {
        const resolvedValue = typeof newValue === 'function' ? newValue(prevValue) : newValue;

        const saved = setItem(keyRef.current, resolvedValue);
        if (!saved) {
          setError('Failed to write to localStorage');
          console.error(`useLocalStorage: failed to write key "${keyRef.current}"`);
        } else {
          setExists(true);
        }

        return resolvedValue;
      });
    } catch (err) {
      console.error(`useLocalStorage: unexpected error writing key "${keyRef.current}":`, err);
      setError(`Failed to write to localStorage: ${err.message || 'Unknown error'}`);
    }
  }, []);

  /**
   * Removes the value from both React state and localStorage,
   * resetting the state to the default value.
   */
  const remove = useCallback(() => {
    setError(null);

    try {
      const removed = removeItem(keyRef.current);
      if (!removed) {
        setError('Failed to remove from localStorage');
        console.error(`useLocalStorage: failed to remove key "${keyRef.current}"`);
      }

      setValueState(defaultValueRef.current);
      setExists(false);
    } catch (err) {
      console.error(`useLocalStorage: unexpected error removing key "${keyRef.current}":`, err);
      setError(`Failed to remove from localStorage: ${err.message || 'Unknown error'}`);
    }
  }, []);

  // Listen for storage events from other tabs/windows
  useEffect(() => {
    function handleStorageEvent(event) {
      if (event.key === null) {
        // localStorage was cleared
        setValueState(defaultValueRef.current);
        setExists(false);
        return;
      }

      if (event.key !== keyRef.current) {
        return;
      }

      try {
        if (event.newValue === null) {
          // Key was removed
          setValueState(defaultValueRef.current);
          setExists(false);
        } else {
          try {
            const parsed = JSON.parse(event.newValue);
            setValueState(parsed);
            setExists(true);
          } catch {
            setValueState(event.newValue);
            setExists(true);
          }
        }
      } catch (err) {
        console.error(`useLocalStorage: error handling storage event for key "${keyRef.current}":`, err);
        setError(`Failed to sync from storage event: ${err.message || 'Unknown error'}`);
      }
    }

    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  return {
    value,
    setValue,
    remove,
    loading,
    exists,
    error,
  };
}

export default useLocalStorage;