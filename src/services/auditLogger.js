/**
 * Audit trail service for the CSNP Portal.
 * Provides append-only audit logging with timestamps, user context,
 * action types, module tracking, and hash chaining for tamper detection.
 * @module auditLogger
 */

import { v4 as uuidv4 } from 'uuid';
import { AUDIT_ACTIONS } from '../utils/constants.js';
import { getItem, setItem } from '../utils/storage.js';

/**
 * localStorage key for audit logs.
 * @type {string}
 */
const AUDIT_LOG_KEY = 'csnp_audit_logs';

/**
 * @typedef {Object} AuditLogEntry
 * @property {string} id - Unique audit log identifier
 * @property {string} action - Audit action from AUDIT_ACTIONS
 * @property {string} userId - User who performed the action
 * @property {string} targetType - Type of entity affected
 * @property {string} targetId - ID of entity affected
 * @property {string} description - Human-readable description
 * @property {Object|null} metadata - Additional metadata
 * @property {string} ipAddress - IP address
 * @property {string} timestamp - ISO timestamp
 * @property {string} module - Module where the action occurred
 * @property {string} previousHash - Hash of the previous log entry
 * @property {string} hash - Hash of this log entry
 */

/**
 * @typedef {Object} AuditLogFilters
 * @property {string} [action] - Filter by action type
 * @property {string} [userId] - Filter by user ID
 * @property {string} [module] - Filter by module
 * @property {string} [targetType] - Filter by target type
 * @property {string} [targetId] - Filter by target ID
 * @property {string} [startDate] - Filter by start date (ISO string or YYYY-MM-DD)
 * @property {string} [endDate] - Filter by end date (ISO string or YYYY-MM-DD)
 * @property {string} [search] - Free-text search across description and metadata
 */

/**
 * Generates a simple hash string from input data for tamper detection.
 * Uses a basic string hashing algorithm since we cannot rely on crypto APIs
 * in all environments and no external hashing library is available.
 * @param {string} data - The string data to hash
 * @returns {string} A hex-encoded hash string
 */
function generateHash(data) {
  if (typeof data !== 'string' || data.length === 0) {
    return '0000000000000000';
  }

  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(16).padStart(16, '0');
}

/**
 * Computes the hash for an audit log entry based on its content and the previous hash.
 * @param {Object} entry - The audit log entry (without hash)
 * @param {string} previousHash - The hash of the previous entry
 * @returns {string} The computed hash
 */
function computeEntryHash(entry, previousHash) {
  const payload = [
    entry.id,
    entry.action,
    entry.userId,
    entry.targetType,
    entry.targetId,
    entry.description,
    JSON.stringify(entry.metadata),
    entry.timestamp,
    entry.module,
    previousHash,
  ].join('|');

  return generateHash(payload);
}

/**
 * Retrieves all audit logs from localStorage.
 * @returns {AuditLogEntry[]} Array of audit log entries
 */
function getAllLogs() {
  const logs = getItem(AUDIT_LOG_KEY, []);
  if (!Array.isArray(logs)) {
    return [];
  }
  return logs;
}

/**
 * Persists audit logs to localStorage.
 * @param {AuditLogEntry[]} logs - Array of audit log entries
 * @returns {boolean} Whether the operation succeeded
 */
function saveLogs(logs) {
  return setItem(AUDIT_LOG_KEY, logs);
}

/**
 * Gets the hash of the last log entry in the chain.
 * @param {AuditLogEntry[]} logs - Array of audit log entries
 * @returns {string} The hash of the last entry, or a genesis hash if empty
 */
function getLastHash(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return '0000000000000000';
  }

  const lastEntry = logs[logs.length - 1];
  return lastEntry.hash || '0000000000000000';
}

/**
 * Logs an audit action to the append-only audit trail.
 * @param {string} action - Audit action type from AUDIT_ACTIONS
 * @param {string} userId - ID of the user performing the action
 * @param {Object} [details={}] - Additional details about the action
 * @param {string} [details.targetType=''] - Type of entity affected
 * @param {string} [details.targetId=''] - ID of entity affected
 * @param {string} [details.description=''] - Human-readable description
 * @param {Object|null} [details.metadata=null] - Additional metadata
 * @param {string} [details.ipAddress='127.0.0.1'] - IP address
 * @param {string} [module='general'] - Module where the action occurred
 * @returns {AuditLogEntry|null} The created audit log entry, or null on failure
 */
export function logAction(action, userId, details = {}, module = 'general') {
  if (typeof action !== 'string' || action.trim().length === 0) {
    console.error('auditLogger.logAction: action is required');
    return null;
  }

  if (typeof userId !== 'string' || userId.trim().length === 0) {
    console.error('auditLogger.logAction: userId is required');
    return null;
  }

  try {
    const logs = getAllLogs();
    const previousHash = getLastHash(logs);

    const entry = {
      id: uuidv4(),
      action: action.trim(),
      userId: userId.trim(),
      targetType: (details.targetType && typeof details.targetType === 'string') ? details.targetType.trim() : '',
      targetId: (details.targetId && typeof details.targetId === 'string') ? details.targetId.trim() : '',
      description: (details.description && typeof details.description === 'string') ? details.description.trim() : '',
      metadata: (details.metadata && typeof details.metadata === 'object' && !Array.isArray(details.metadata)) ? details.metadata : null,
      ipAddress: (details.ipAddress && typeof details.ipAddress === 'string') ? details.ipAddress.trim() : '127.0.0.1',
      timestamp: new Date().toISOString(),
      module: (typeof module === 'string' && module.trim().length > 0) ? module.trim() : 'general',
      previousHash,
      hash: '',
    };

    entry.hash = computeEntryHash(entry, previousHash);

    logs.push(entry);

    const saved = saveLogs(logs);
    if (!saved) {
      console.error('auditLogger.logAction: failed to persist audit log');
      return null;
    }

    return entry;
  } catch (error) {
    console.error('auditLogger.logAction: unexpected error:', error);
    return null;
  }
}

/**
 * Retrieves audit logs with optional filtering.
 * @param {AuditLogFilters} [filters={}] - Filters to apply
 * @returns {AuditLogEntry[]} Filtered array of audit log entries, sorted by timestamp descending
 */
export function getAuditLogs(filters = {}) {
  try {
    let logs = getAllLogs();

    if (!filters || typeof filters !== 'object') {
      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    // Filter by action
    if (filters.action && typeof filters.action === 'string' && filters.action.trim().length > 0) {
      const actionFilter = filters.action.trim().toLowerCase();
      logs = logs.filter((entry) => entry.action && entry.action.toLowerCase() === actionFilter);
    }

    // Filter by userId
    if (filters.userId && typeof filters.userId === 'string' && filters.userId.trim().length > 0) {
      const userIdFilter = filters.userId.trim();
      logs = logs.filter((entry) => entry.userId === userIdFilter);
    }

    // Filter by module
    if (filters.module && typeof filters.module === 'string' && filters.module.trim().length > 0) {
      const moduleFilter = filters.module.trim().toLowerCase();
      logs = logs.filter((entry) => entry.module && entry.module.toLowerCase() === moduleFilter);
    }

    // Filter by targetType
    if (filters.targetType && typeof filters.targetType === 'string' && filters.targetType.trim().length > 0) {
      const targetTypeFilter = filters.targetType.trim().toLowerCase();
      logs = logs.filter((entry) => entry.targetType && entry.targetType.toLowerCase() === targetTypeFilter);
    }

    // Filter by targetId
    if (filters.targetId && typeof filters.targetId === 'string' && filters.targetId.trim().length > 0) {
      const targetIdFilter = filters.targetId.trim();
      logs = logs.filter((entry) => entry.targetId === targetIdFilter);
    }

    // Filter by startDate
    if (filters.startDate && typeof filters.startDate === 'string' && filters.startDate.trim().length > 0) {
      const startDate = new Date(filters.startDate.trim());
      if (!isNaN(startDate.getTime())) {
        startDate.setHours(0, 0, 0, 0);
        logs = logs.filter((entry) => {
          const entryDate = new Date(entry.timestamp);
          return !isNaN(entryDate.getTime()) && entryDate.getTime() >= startDate.getTime();
        });
      }
    }

    // Filter by endDate
    if (filters.endDate && typeof filters.endDate === 'string' && filters.endDate.trim().length > 0) {
      const endDate = new Date(filters.endDate.trim());
      if (!isNaN(endDate.getTime())) {
        endDate.setHours(23, 59, 59, 999);
        logs = logs.filter((entry) => {
          const entryDate = new Date(entry.timestamp);
          return !isNaN(entryDate.getTime()) && entryDate.getTime() <= endDate.getTime();
        });
      }
    }

    // Free-text search across description and metadata
    if (filters.search && typeof filters.search === 'string' && filters.search.trim().length > 0) {
      const searchQuery = filters.search.trim().toLowerCase();
      logs = logs.filter((entry) => {
        const descriptionMatch = entry.description && typeof entry.description === 'string' &&
          entry.description.toLowerCase().includes(searchQuery);

        const metadataMatch = entry.metadata &&
          JSON.stringify(entry.metadata).toLowerCase().includes(searchQuery);

        const actionMatch = entry.action && typeof entry.action === 'string' &&
          entry.action.toLowerCase().includes(searchQuery);

        const moduleMatch = entry.module && typeof entry.module === 'string' &&
          entry.module.toLowerCase().includes(searchQuery);

        return descriptionMatch || metadataMatch || actionMatch || moduleMatch;
      });
    }

    // Sort by timestamp descending (most recent first)
    logs.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB.getTime() - dateA.getTime();
    });

    return logs;
  } catch (error) {
    console.error('auditLogger.getAuditLogs: unexpected error:', error);
    return [];
  }
}

/**
 * Exports all audit logs as a JSON-serializable object.
 * Includes export metadata and integrity verification results.
 * @returns {{ logs: AuditLogEntry[], exportedAt: string, totalEntries: number, integrityValid: boolean } | null}
 *   Export payload or null on error
 */
export function exportAuditLogs() {
  try {
    const logs = getAllLogs();
    const integrityResult = verifyIntegrity();

    return {
      logs,
      exportedAt: new Date().toISOString(),
      totalEntries: logs.length,
      integrityValid: integrityResult.valid,
    };
  } catch (error) {
    console.error('auditLogger.exportAuditLogs: unexpected error:', error);
    return null;
  }
}

/**
 * Exports audit logs as a formatted JSON string.
 * @returns {string|null} JSON string or null on error
 */
export function exportAuditLogsAsString() {
  const payload = exportAuditLogs();
  if (payload === null) {
    return null;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    console.error('auditLogger.exportAuditLogsAsString: failed to stringify:', error);
    return null;
  }
}

/**
 * Verifies the integrity of the audit log chain by recomputing hashes.
 * Detects any tampered, modified, or out-of-order entries.
 * @returns {{ valid: boolean, errors: string[], checkedEntries: number }}
 */
export function verifyIntegrity() {
  const result = { valid: true, errors: [], checkedEntries: 0 };

  try {
    const logs = getAllLogs();

    if (logs.length === 0) {
      return result;
    }

    let expectedPreviousHash = '0000000000000000';

    for (let i = 0; i < logs.length; i++) {
      const entry = logs[i];
      result.checkedEntries++;

      // Check previousHash chain
      if (entry.previousHash !== undefined && entry.previousHash !== expectedPreviousHash) {
        result.valid = false;
        result.errors.push(
          `Entry ${i} (${entry.id}): previousHash mismatch. Expected "${expectedPreviousHash}", found "${entry.previousHash}"`
        );
      }

      // Recompute hash and verify
      if (entry.hash) {
        const computedHash = computeEntryHash(entry, entry.previousHash || expectedPreviousHash);
        if (computedHash !== entry.hash) {
          result.valid = false;
          result.errors.push(
            `Entry ${i} (${entry.id}): hash mismatch. Entry may have been tampered with.`
          );
        }
      }

      // Update expected previous hash for next iteration
      expectedPreviousHash = entry.hash || expectedPreviousHash;
    }

    return result;
  } catch (error) {
    console.error('auditLogger.verifyIntegrity: unexpected error:', error);
    return { valid: false, errors: [`Integrity check failed: ${error.message}`], checkedEntries: 0 };
  }
}

/**
 * Returns the total count of audit log entries.
 * @returns {number}
 */
export function getAuditLogCount() {
  try {
    const logs = getAllLogs();
    return logs.length;
  } catch (error) {
    console.error('auditLogger.getAuditLogCount: unexpected error:', error);
    return 0;
  }
}

/**
 * Returns audit log entries for a specific user.
 * @param {string} userId - The user ID to filter by
 * @returns {AuditLogEntry[]}
 */
export function getAuditLogsByUser(userId) {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return [];
  }

  return getAuditLogs({ userId: userId.trim() });
}

/**
 * Returns audit log entries for a specific action type.
 * @param {string} action - The action type to filter by
 * @returns {AuditLogEntry[]}
 */
export function getAuditLogsByAction(action) {
  if (typeof action !== 'string' || action.trim().length === 0) {
    return [];
  }

  return getAuditLogs({ action: action.trim() });
}

/**
 * Returns audit log entries for a specific module.
 * @param {string} module - The module to filter by
 * @returns {AuditLogEntry[]}
 */
export function getAuditLogsByModule(module) {
  if (typeof module !== 'string' || module.trim().length === 0) {
    return [];
  }

  return getAuditLogs({ module: module.trim() });
}

/**
 * Returns audit log entries for a specific target entity.
 * @param {string} targetType - The target type to filter by
 * @param {string} targetId - The target ID to filter by
 * @returns {AuditLogEntry[]}
 */
export function getAuditLogsByTarget(targetType, targetId) {
  const filters = {};

  if (typeof targetType === 'string' && targetType.trim().length > 0) {
    filters.targetType = targetType.trim();
  }

  if (typeof targetId === 'string' && targetId.trim().length > 0) {
    filters.targetId = targetId.trim();
  }

  if (Object.keys(filters).length === 0) {
    return [];
  }

  return getAuditLogs(filters);
}

/**
 * Returns a summary of audit log activity grouped by action type.
 * @returns {Object.<string, number>} Map of action types to counts
 */
export function getAuditLogSummary() {
  try {
    const logs = getAllLogs();
    const summary = {};

    for (const entry of logs) {
      const action = entry.action || 'unknown';
      if (!summary[action]) {
        summary[action] = 0;
      }
      summary[action]++;
    }

    return summary;
  } catch (error) {
    console.error('auditLogger.getAuditLogSummary: unexpected error:', error);
    return {};
  }
}