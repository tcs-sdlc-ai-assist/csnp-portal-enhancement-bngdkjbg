/**
 * Custom React hook for audit trail operations.
 * Wraps the auditLogger service for React component usage,
 * providing log actions, filtered audit log retrieval, export,
 * integrity verification, and summary statistics.
 * @module useAuditTrail
 */

import { useState, useCallback, useRef } from 'react';
import {
  logAction,
  getAuditLogs,
  exportAuditLogs,
  exportAuditLogsAsString,
  verifyIntegrity,
  getAuditLogCount,
  getAuditLogsByUser,
  getAuditLogsByAction,
  getAuditLogsByModule,
  getAuditLogsByTarget,
  getAuditLogSummary,
} from '../services/auditLogger.js';

/**
 * @typedef {Object} UseAuditTrailReturn
 * @property {import('../services/auditLogger.js').AuditLogEntry[]} logs - Current audit log entries
 * @property {boolean} loading - Whether an audit operation is in progress
 * @property {string|null} error - Error message from the last operation, or null
 * @property {function(string, string, Object=, string=): import('../services/auditLogger.js').AuditLogEntry|null} log - Log an audit action
 * @property {function(import('../services/auditLogger.js').AuditLogFilters=): void} fetchLogs - Fetch audit logs with optional filters
 * @property {function(string): void} fetchLogsByUser - Fetch audit logs for a specific user
 * @property {function(string): void} fetchLogsByAction - Fetch audit logs for a specific action type
 * @property {function(string): void} fetchLogsByModule - Fetch audit logs for a specific module
 * @property {function(string, string=): void} fetchLogsByTarget - Fetch audit logs for a specific target entity
 * @property {function(): { logs: import('../services/auditLogger.js').AuditLogEntry[], exportedAt: string, totalEntries: number, integrityValid: boolean }|null} exportLogs - Export all audit logs as an object
 * @property {function(): string|null} exportLogsAsString - Export all audit logs as a JSON string
 * @property {function(): { valid: boolean, errors: string[], checkedEntries: number }} checkIntegrity - Verify audit trail integrity
 * @property {function(): number} getCount - Get total audit log entry count
 * @property {function(): Object.<string, number>} getSummary - Get audit log summary grouped by action type
 * @property {function(): void} clearError - Clear the current error state
 * @property {function(): void} clearLogs - Clear the current logs state
 */

/**
 * Custom React hook for audit trail operations.
 * Provides a React-friendly interface to the auditLogger service
 * with loading states, error handling, and memoized callbacks.
 *
 * @returns {UseAuditTrailReturn} The audit trail state and control functions
 *
 * @example
 * const { logs, loading, error, log, fetchLogs, exportLogs, checkIntegrity } = useAuditTrail();
 *
 * // Log an action
 * log('create', userId, { targetType: 'member', targetId: '123', description: 'Created member' }, 'enrollment');
 *
 * // Fetch filtered logs
 * fetchLogs({ action: 'login', startDate: '2024-01-01' });
 *
 * // Export logs
 * const exportData = exportLogs();
 *
 * // Verify integrity
 * const integrity = checkIntegrity();
 */
export function useAuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  /**
   * Logs an audit action to the audit trail.
   * @param {string} action - Audit action type from AUDIT_ACTIONS
   * @param {string} userId - ID of the user performing the action
   * @param {Object} [details={}] - Additional details about the action
   * @param {string} [details.targetType=''] - Type of entity affected
   * @param {string} [details.targetId=''] - ID of entity affected
   * @param {string} [details.description=''] - Human-readable description
   * @param {Object|null} [details.metadata=null] - Additional metadata
   * @param {string} [details.ipAddress='127.0.0.1'] - IP address
   * @param {string} [module='general'] - Module where the action occurred
   * @returns {import('../services/auditLogger.js').AuditLogEntry|null} The created audit log entry, or null on failure
   */
  const log = useCallback((action, userId, details = {}, module = 'general') => {
    setError(null);

    try {
      const entry = logAction(action, userId, details, module);

      if (!entry) {
        setError('Failed to create audit log entry');
        return null;
      }

      return entry;
    } catch (err) {
      console.error('useAuditTrail.log: unexpected error:', err);
      setError(`Failed to log audit action: ${err.message || 'Unknown error'}`);
      return null;
    }
  }, []);

  /**
   * Fetches audit logs with optional filters.
   * @param {import('../services/auditLogger.js').AuditLogFilters} [filters={}] - Filters to apply
   */
  const fetchLogs = useCallback((filters = {}) => {
    setError(null);
    setLoading(true);

    try {
      const result = getAuditLogs(filters);
      setLogs(result);
    } catch (err) {
      console.error('useAuditTrail.fetchLogs: unexpected error:', err);
      setError(`Failed to fetch audit logs: ${err.message || 'Unknown error'}`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches audit logs for a specific user.
   * @param {string} userId - The user ID to filter by
   */
  const fetchLogsByUser = useCallback((userId) => {
    setError(null);
    setLoading(true);

    try {
      if (typeof userId !== 'string' || userId.trim().length === 0) {
        setError('User ID is required');
        setLogs([]);
        return;
      }

      const result = getAuditLogsByUser(userId);
      setLogs(result);
    } catch (err) {
      console.error('useAuditTrail.fetchLogsByUser: unexpected error:', err);
      setError(`Failed to fetch audit logs by user: ${err.message || 'Unknown error'}`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches audit logs for a specific action type.
   * @param {string} action - The action type to filter by
   */
  const fetchLogsByAction = useCallback((action) => {
    setError(null);
    setLoading(true);

    try {
      if (typeof action !== 'string' || action.trim().length === 0) {
        setError('Action type is required');
        setLogs([]);
        return;
      }

      const result = getAuditLogsByAction(action);
      setLogs(result);
    } catch (err) {
      console.error('useAuditTrail.fetchLogsByAction: unexpected error:', err);
      setError(`Failed to fetch audit logs by action: ${err.message || 'Unknown error'}`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches audit logs for a specific module.
   * @param {string} module - The module to filter by
   */
  const fetchLogsByModule = useCallback((module) => {
    setError(null);
    setLoading(true);

    try {
      if (typeof module !== 'string' || module.trim().length === 0) {
        setError('Module is required');
        setLogs([]);
        return;
      }

      const result = getAuditLogsByModule(module);
      setLogs(result);
    } catch (err) {
      console.error('useAuditTrail.fetchLogsByModule: unexpected error:', err);
      setError(`Failed to fetch audit logs by module: ${err.message || 'Unknown error'}`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches audit logs for a specific target entity.
   * @param {string} targetType - The target type to filter by
   * @param {string} [targetId] - The target ID to filter by
   */
  const fetchLogsByTarget = useCallback((targetType, targetId) => {
    setError(null);
    setLoading(true);

    try {
      if (typeof targetType !== 'string' || targetType.trim().length === 0) {
        setError('Target type is required');
        setLogs([]);
        return;
      }

      const result = getAuditLogsByTarget(targetType, targetId);
      setLogs(result);
    } catch (err) {
      console.error('useAuditTrail.fetchLogsByTarget: unexpected error:', err);
      setError(`Failed to fetch audit logs by target: ${err.message || 'Unknown error'}`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Exports all audit logs as a JSON-serializable object.
   * @returns {{ logs: import('../services/auditLogger.js').AuditLogEntry[], exportedAt: string, totalEntries: number, integrityValid: boolean }|null} Export payload or null on error
   */
  const exportLogsData = useCallback(() => {
    setError(null);

    try {
      const result = exportAuditLogs();

      if (!result) {
        setError('Failed to export audit logs');
        return null;
      }

      return result;
    } catch (err) {
      console.error('useAuditTrail.exportLogs: unexpected error:', err);
      setError(`Failed to export audit logs: ${err.message || 'Unknown error'}`);
      return null;
    }
  }, []);

  /**
   * Exports all audit logs as a formatted JSON string.
   * @returns {string|null} JSON string or null on error
   */
  const exportLogsString = useCallback(() => {
    setError(null);

    try {
      const result = exportAuditLogsAsString();

      if (!result) {
        setError('Failed to export audit logs as string');
        return null;
      }

      return result;
    } catch (err) {
      console.error('useAuditTrail.exportLogsAsString: unexpected error:', err);
      setError(`Failed to export audit logs as string: ${err.message || 'Unknown error'}`);
      return null;
    }
  }, []);

  /**
   * Verifies the integrity of the audit log chain.
   * @returns {{ valid: boolean, errors: string[], checkedEntries: number }}
   */
  const checkIntegrity = useCallback(() => {
    setError(null);

    try {
      const result = verifyIntegrity();
      return result;
    } catch (err) {
      console.error('useAuditTrail.checkIntegrity: unexpected error:', err);
      setError(`Failed to verify audit trail integrity: ${err.message || 'Unknown error'}`);
      return { valid: false, errors: [`Integrity check failed: ${err.message || 'Unknown error'}`], checkedEntries: 0 };
    }
  }, []);

  /**
   * Returns the total count of audit log entries.
   * @returns {number}
   */
  const getCount = useCallback(() => {
    try {
      return getAuditLogCount();
    } catch (err) {
      console.error('useAuditTrail.getCount: unexpected error:', err);
      return 0;
    }
  }, []);

  /**
   * Returns a summary of audit log activity grouped by action type.
   * @returns {Object.<string, number>} Map of action types to counts
   */
  const getSummary = useCallback(() => {
    try {
      return getAuditLogSummary();
    } catch (err) {
      console.error('useAuditTrail.getSummary: unexpected error:', err);
      return {};
    }
  }, []);

  /**
   * Clears the current error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clears the current logs state.
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    loading,
    error,
    log,
    fetchLogs,
    fetchLogsByUser,
    fetchLogsByAction,
    fetchLogsByModule,
    fetchLogsByTarget,
    exportLogs: exportLogsData,
    exportLogsAsString: exportLogsString,
    checkIntegrity,
    getCount,
    getSummary,
    clearError,
    clearLogs,
  };
}

export default useAuditTrail;