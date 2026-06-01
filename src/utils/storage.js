/**
 * localStorage abstraction layer for the CSNP Portal.
 * Provides JSON-aware get/set/remove, error handling, data export/import,
 * storage size monitoring, and seed data initialization.
 * @module storage
 */

import { initializeSeedData, isSeedDataInitialized } from '../data/seedData.js';

/**
 * Retrieves an item from localStorage and parses it as JSON.
 * Returns the raw string if JSON parsing fails.
 * @param {string} key - The localStorage key
 * @param {*} [defaultValue=null] - Value to return if key does not exist or on error
 * @returns {*} The parsed value, or defaultValue if not found / on error
 */
export function getItem(key, defaultValue = null) {
  if (typeof key !== 'string' || key.trim().length === 0) {
    console.error('storage.getItem: key must be a non-empty string');
    return defaultValue;
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch (error) {
    console.error(`storage.getItem: failed to read key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Stores a value in localStorage after JSON-stringifying it.
 * @param {string} key - The localStorage key
 * @param {*} value - The value to store (will be JSON-stringified)
 * @returns {boolean} Whether the operation succeeded
 */
export function setItem(key, value) {
  if (typeof key !== 'string' || key.trim().length === 0) {
    console.error('storage.setItem: key must be a non-empty string');
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`storage.setItem: failed to write key "${key}":`, error);
    return false;
  }
}

/**
 * Removes an item from localStorage.
 * @param {string} key - The localStorage key to remove
 * @returns {boolean} Whether the operation succeeded
 */
export function removeItem(key) {
  if (typeof key !== 'string' || key.trim().length === 0) {
    console.error('storage.removeItem: key must be a non-empty string');
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`storage.removeItem: failed to remove key "${key}":`, error);
    return false;
  }
}

/**
 * Checks whether a key exists in localStorage.
 * @param {string} key - The localStorage key
 * @returns {boolean}
 */
export function hasItem(key) {
  if (typeof key !== 'string' || key.trim().length === 0) {
    return false;
  }

  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(`storage.hasItem: failed to check key "${key}":`, error);
    return false;
  }
}

/**
 * Clears all items from localStorage.
 * @returns {boolean} Whether the operation succeeded
 */
export function clearAll() {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error('storage.clearAll: failed to clear localStorage:', error);
    return false;
  }
}

/**
 * Returns all keys currently stored in localStorage.
 * @returns {string[]}
 */
export function getAllKeys() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) {
        keys.push(key);
      }
    }
    return keys;
  } catch (error) {
    console.error('storage.getAllKeys: failed to enumerate keys:', error);
    return [];
  }
}

/**
 * Calculates the approximate size in bytes of all data stored in localStorage.
 * @returns {number} Approximate size in bytes
 */
export function getStorageSize() {
  try {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) {
        const value = localStorage.getItem(key);
        totalSize += key.length * 2;
        if (value !== null) {
          totalSize += value.length * 2;
        }
      }
    }
    return totalSize;
  } catch (error) {
    console.error('storage.getStorageSize: failed to calculate size:', error);
    return 0;
  }
}

/**
 * Returns a human-readable string of the current storage size.
 * @returns {string} e.g. "12.5 KB" or "1.2 MB"
 */
export function getStorageSizeFormatted() {
  const bytes = getStorageSize();
  if (bytes === 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Estimates the remaining available localStorage space in bytes.
 * Uses a binary-search approach to avoid excessive memory allocation.
 * @returns {number} Approximate remaining bytes available
 */
export function getRemainingSpace() {
  const testKey = '__csnp_storage_test__';
  try {
    const used = getStorageSize();
    const estimatedMax = 5 * 1024 * 1024;
    const remaining = estimatedMax - used;
    return remaining > 0 ? remaining : 0;
  } catch (error) {
    console.error('storage.getRemainingSpace: failed to estimate space:', error);
    return 0;
  } finally {
    try {
      localStorage.removeItem(testKey);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Returns storage usage statistics.
 * @returns {{ totalKeys: number, sizeBytes: number, sizeFormatted: string, remainingBytes: number }}
 */
export function getStorageStats() {
  return {
    totalKeys: getAllKeys().length,
    sizeBytes: getStorageSize(),
    sizeFormatted: getStorageSizeFormatted(),
    remainingBytes: getRemainingSpace(),
  };
}

/**
 * Exports all localStorage data as a JSON object.
 * Useful for backup or transfer.
 * @returns {{ data: Object, exportedAt: string, totalKeys: number } | null} Export payload or null on error
 */
export function exportData() {
  try {
    const keys = getAllKeys();
    const data = {};

    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    }

    return {
      data,
      exportedAt: new Date().toISOString(),
      totalKeys: keys.length,
    };
  } catch (error) {
    console.error('storage.exportData: failed to export data:', error);
    return null;
  }
}

/**
 * Exports all localStorage data as a JSON string.
 * @returns {string|null} JSON string or null on error
 */
export function exportDataAsString() {
  const payload = exportData();
  if (payload === null) {
    return null;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    console.error('storage.exportDataAsString: failed to stringify export:', error);
    return null;
  }
}

/**
 * Imports data into localStorage from an export payload.
 * @param {Object|string} payload - The export payload object or JSON string
 * @param {{ overwrite?: boolean, merge?: boolean }} [options={}] - Import options
 * @param {boolean} [options.overwrite=false] - If true, clears existing data before import
 * @param {boolean} [options.merge=true] - If true, merges with existing data (existing keys may be overwritten)
 * @returns {{ success: boolean, keysImported: number, errors: string[] }}
 */
export function importData(payload, options = {}) {
  const { overwrite = false, merge = true } = options;
  const result = { success: false, keysImported: 0, errors: [] };

  if (!payload) {
    result.errors.push('Payload is required');
    return result;
  }

  let parsed;
  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      result.errors.push(`Failed to parse payload string: ${error.message}`);
      return result;
    }
  } else {
    parsed = payload;
  }

  const data = parsed.data || parsed;

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    result.errors.push('Payload data must be a non-null object');
    return result;
  }

  try {
    if (overwrite) {
      localStorage.clear();
    }

    const keys = Object.keys(data);
    for (const key of keys) {
      try {
        const value = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
        if (merge || overwrite || !hasItem(key)) {
          localStorage.setItem(key, value);
          result.keysImported++;
        }
      } catch (error) {
        result.errors.push(`Failed to import key "${key}": ${error.message}`);
      }
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(`Import failed: ${error.message}`);
    return result;
  }
}

/**
 * Initializes storage with seed data if not already initialized.
 * @param {boolean} [force=false] - Force re-initialization even if already seeded
 * @returns {boolean} Whether seed data was loaded
 */
export function initializeStorage(force = false) {
  try {
    if (!force && isSeedDataInitialized()) {
      return false;
    }
    return initializeSeedData(force);
  } catch (error) {
    console.error('storage.initializeStorage: failed to initialize seed data:', error);
    return false;
  }
}

/**
 * Updates a stored array by appending a new item.
 * Creates the array if the key does not exist.
 * @param {string} key - The localStorage key holding an array
 * @param {*} item - The item to append
 * @returns {boolean} Whether the operation succeeded
 */
export function appendToArray(key, item) {
  try {
    const existing = getItem(key, []);
    if (!Array.isArray(existing)) {
      console.error(`storage.appendToArray: value at key "${key}" is not an array`);
      return false;
    }
    existing.push(item);
    return setItem(key, existing);
  } catch (error) {
    console.error(`storage.appendToArray: failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Updates a specific item in a stored array by matching a predicate.
 * @param {string} key - The localStorage key holding an array
 * @param {function(*): boolean} predicate - Function to identify the item to update
 * @param {function(*): *} updater - Function that receives the matched item and returns the updated item
 * @returns {boolean} Whether the operation succeeded and an item was updated
 */
export function updateInArray(key, predicate, updater) {
  try {
    const existing = getItem(key, []);
    if (!Array.isArray(existing)) {
      console.error(`storage.updateInArray: value at key "${key}" is not an array`);
      return false;
    }

    let found = false;
    const updated = existing.map((item) => {
      if (predicate(item)) {
        found = true;
        return updater(item);
      }
      return item;
    });

    if (!found) {
      return false;
    }

    return setItem(key, updated);
  } catch (error) {
    console.error(`storage.updateInArray: failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Removes an item from a stored array by matching a predicate.
 * @param {string} key - The localStorage key holding an array
 * @param {function(*): boolean} predicate - Function to identify the item to remove
 * @returns {boolean} Whether the operation succeeded and an item was removed
 */
export function removeFromArray(key, predicate) {
  try {
    const existing = getItem(key, []);
    if (!Array.isArray(existing)) {
      console.error(`storage.removeFromArray: value at key "${key}" is not an array`);
      return false;
    }

    const filtered = existing.filter((item) => !predicate(item));
    if (filtered.length === existing.length) {
      return false;
    }

    return setItem(key, filtered);
  } catch (error) {
    console.error(`storage.removeFromArray: failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Finds an item in a stored array by matching a predicate.
 * @param {string} key - The localStorage key holding an array
 * @param {function(*): boolean} predicate - Function to identify the item
 * @returns {*|null} The matched item or null if not found
 */
export function findInArray(key, predicate) {
  try {
    const existing = getItem(key, []);
    if (!Array.isArray(existing)) {
      console.error(`storage.findInArray: value at key "${key}" is not an array`);
      return null;
    }

    const found = existing.find(predicate);
    return found !== undefined ? found : null;
  } catch (error) {
    console.error(`storage.findInArray: failed for key "${key}":`, error);
    return null;
  }
}