import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import DataTable from '../common/DataTable.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import Modal from '../common/Modal.jsx';
import Card from '../common/Card.jsx';
import FormField from '../common/FormField.jsx';
import { useAuditTrail } from '../../hooks/useAuditTrail.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toTitleCase,
} from '../../utils/helpers.js';
import { AUDIT_ACTIONS } from '../../utils/constants.js';

/**
 * Action filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All Actions' },
  ...Object.entries(AUDIT_ACTIONS).map(([key, value]) => ({
    value,
    label: toTitleCase(value),
  })),
];

/**
 * Module filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const MODULE_FILTER_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'auth', label: 'Authentication' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'benefits', label: 'Benefits' },
  { value: 'claims', label: 'Claims' },
  { value: 'provider', label: 'Provider' },
  { value: 'care_management', label: 'Care Management' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'integration', label: 'Integration' },
  { value: 'ruleEngine', label: 'Rule Engine' },
  { value: 'general', label: 'General' },
];

/**
 * Module badge status mapping.
 * @type {Object.<string, string>}
 */
const MODULE_BADGE_STATUSES = {
  auth: 'submitted',
  eligibility: 'eligible',
  enrollment: 'active',
  benefits: 'approved',
  claims: 'processing',
  provider: 'accepted',
  care_management: 'in_progress',
  compliance: 'compliant',
  integration: 'pending',
  ruleEngine: 'in_review',
  general: 'pending',
};

/**
 * Action type to color class mapping for activity feed icons.
 * @type {Object.<string, { bg: string, text: string }>}
 */
const ACTION_COLORS = {
  [AUDIT_ACTIONS.LOGIN]: { bg: 'bg-blue-50', text: 'text-blue-600' },
  [AUDIT_ACTIONS.LOGOUT]: { bg: 'bg-gray-50', text: 'text-gray-500' },
  [AUDIT_ACTIONS.CREATE]: { bg: 'bg-green-50', text: 'text-green-600' },
  [AUDIT_ACTIONS.UPDATE]: { bg: 'bg-csnp-blue-50', text: 'text-csnp-primary' },
  [AUDIT_ACTIONS.DELETE]: { bg: 'bg-red-50', text: 'text-red-600' },
  [AUDIT_ACTIONS.APPROVE]: { bg: 'bg-green-50', text: 'text-green-600' },
  [AUDIT_ACTIONS.DENY]: { bg: 'bg-red-50', text: 'text-red-600' },
  [AUDIT_ACTIONS.SUBMIT]: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  [AUDIT_ACTIONS.ENROLL]: { bg: 'bg-csnp-green-50', text: 'text-csnp-secondary' },
  [AUDIT_ACTIONS.DISENROLL]: { bg: 'bg-orange-50', text: 'text-orange-600' },
  [AUDIT_ACTIONS.CLAIM_SUBMIT]: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  [AUDIT_ACTIONS.CLAIM_APPROVE]: { bg: 'bg-green-50', text: 'text-green-600' },
  [AUDIT_ACTIONS.CLAIM_DENY]: { bg: 'bg-red-50', text: 'text-red-600' },
  [AUDIT_ACTIONS.CLAIM_APPEAL]: { bg: 'bg-amber-50', text: 'text-amber-600' },
  [AUDIT_ACTIONS.REFERRAL_CREATE]: { bg: 'bg-purple-50', text: 'text-purple-600' },
  [AUDIT_ACTIONS.REFERRAL_UPDATE]: { bg: 'bg-purple-50', text: 'text-purple-600' },
  [AUDIT_ACTIONS.CARE_PLAN_CREATE]: { bg: 'bg-pink-50', text: 'text-pink-600' },
  [AUDIT_ACTIONS.CARE_PLAN_UPDATE]: { bg: 'bg-pink-50', text: 'text-pink-600' },
  [AUDIT_ACTIONS.EXPORT]: { bg: 'bg-teal-50', text: 'text-teal-600' },
  [AUDIT_ACTIONS.IMPORT]: { bg: 'bg-teal-50', text: 'text-teal-600' },
};

/**
 * Default action color for unrecognized action types.
 * @type {{ bg: string, text: string }}
 */
const DEFAULT_ACTION_COLOR = { bg: 'bg-gray-50', text: 'text-gray-500' };

/**
 * Builds a CSV string from audit log entries.
 * @param {Object[]} records - Array of audit log entries
 * @returns {string} CSV string
 */
function buildCSVExport(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  const headers = [
    'ID',
    'Timestamp',
    'Action',
    'User ID',
    'Module',
    'Target Type',
    'Target ID',
    'Description',
    'IP Address',
    'Hash',
    'Previous Hash',
  ];

  const rows = records.map((record) => [
    record.id || '',
    record.timestamp || '',
    record.action || '',
    record.userId || '',
    record.module || '',
    record.targetType || '',
    record.targetId || '',
    record.description || '',
    record.ipAddress || '',
    record.hash || '',
    record.previousHash || '',
  ]);

  const escapeCSV = (val) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ];

  return csvLines.join('\n');
}

/**
 * Downloads a string as a file.
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('AuditLogViewer: failed to download file:', err);
  }
}

/**
 * Retrieves the user display name from a user ID.
 * @param {string} userId - The user ID
 * @param {Object[]} users - Array of user objects
 * @returns {string} The user display name or a truncated user ID
 */
function getUserDisplayName(userId, users) {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return 'System';
  }

  if (userId === 'system' || userId === 'unknown') {
    return userId === 'system' ? 'System' : 'Unknown';
  }

  if (Array.isArray(users)) {
    const user = users.find((u) => u.id === userId);
    if (user) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || userId.substring(0, 8);
    }
  }

  return userId.substring(0, 8) + '…';
}

/**
 * Audit log entry detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.entry - The audit log entry to display
 * @param {Object[]} props.users - Array of user objects for name resolution
 * @returns {React.ReactElement|null}
 */
function AuditLogDetailModal({ isOpen, onClose, entry, users }) {
  if (!entry) {
    return null;
  }

  const actionColors = ACTION_COLORS[entry.action] || DEFAULT_ACTION_COLOR;
  const userName = getUserDisplayName(entry.userId, users);
  const moduleBadgeStatus = MODULE_BADGE_STATUSES[entry.module] || 'pending';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Log Entry Details"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Action Banner */}
        <div className={`p-3 rounded-lg border ${actionColors.bg} border-gray-200`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${actionColors.bg} ${actionColors.text} border border-gray-200`}>
                {toTitleCase(entry.action || 'unknown')}
              </span>
              <StatusBadge
                status={moduleBadgeStatus}
                label={toTitleCase(entry.module || 'general')}
                size="sm"
                showDot={false}
                bordered={true}
              />
            </div>
            <span className="text-xs text-gray-500">
              {entry.timestamp ? formatRelativeTime(entry.timestamp) : ''}
            </span>
          </div>
        </div>

        {/* Entry Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Entry ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={entry.id}>
              {entry.id ? entry.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Timestamp</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {entry.timestamp ? formatDateTime(entry.timestamp) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Action</p>
            <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(entry.action || 'unknown')}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Module</p>
            <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(entry.module || 'general')}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">User</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate" title={entry.userId}>
              {userName}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">User ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={entry.userId}>
              {entry.userId || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Target Type</p>
            <p className="text-xs text-gray-700 mt-0.5">{entry.targetType ? toTitleCase(entry.targetType) : '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Target ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={entry.targetId}>
              {entry.targetId ? entry.targetId.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">IP Address</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5">{entry.ipAddress || '—'}</p>
          </div>
        </div>

        {/* Description */}
        {entry.description && typeof entry.description === 'string' && entry.description.trim().length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {entry.description}
              </p>
            </div>
          </div>
        )}

        {/* Metadata */}
        {entry.metadata && typeof entry.metadata === 'object' && Object.keys(entry.metadata).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Metadata</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <pre className="text-[10px] text-gray-700 leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Hash Chain */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Hash Chain</p>
          <div className="grid grid-cols-1 gap-3">
            <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
              <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Current Hash</p>
              <p className="text-xs font-mono text-csnp-primary mt-0.5 break-all">
                {entry.hash || '—'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Previous Hash</p>
              <p className="text-xs font-mono text-gray-700 mt-0.5 break-all">
                {entry.previousHash || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

AuditLogDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  entry: PropTypes.object,
  users: PropTypes.arrayOf(PropTypes.object),
};

AuditLogDetailModal.defaultProps = {
  entry: null,
  users: [],
};

/**
 * Skeleton loading state for the audit log viewer.
 * @returns {React.ReactElement}
 */
function AuditLogViewerSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-48 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-24 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-10 bg-gray-200 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Audit log viewer component.
 * Displays audit trail entries with timestamp, user, action, module,
 * details, and hash chain verification status. Supports filtering by
 * date range, module, user, and action type. Includes export to JSON/CSV
 * functionality.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Audit Log'] - Section title
 * @param {boolean} [props.showExport=true] - Whether to show the export buttons
 * @param {boolean} [props.showStats=true] - Whether to show summary statistics
 * @param {boolean} [props.showIntegrityCheck=true] - Whether to show the integrity check button
 * @param {boolean} [props.showFilters=true] - Whether to show the filter controls
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.initialPageSize=20] - Initial page size
 * @param {string} [props.filterModule] - Pre-set module filter
 * @param {string} [props.filterAction] - Pre-set action filter
 * @param {string} [props.filterUserId] - Pre-set user ID filter
 * @param {number} [props.refreshInterval=0] - Auto-refresh interval in milliseconds (0 = no auto-refresh)
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function AuditLogViewer({
  showHeader = true,
  title = 'Audit Log',
  showExport = true,
  showStats = true,
  showIntegrityCheck = true,
  showFilters = true,
  compact = false,
  initialPageSize = 20,
  filterModule: initialFilterModule,
  filterAction: initialFilterAction,
  filterUserId: initialFilterUserId,
  refreshInterval = 0,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();
  const {
    logs,
    loading,
    error,
    fetchLogs,
    exportLogs,
    exportLogsAsString,
    checkIntegrity,
    getCount,
    getSummary,
    clearError,
  } = useAuditTrail();

  const [users, setUsers] = useState([]);
  const [moduleFilter, setModuleFilter] = useState(initialFilterModule || '');
  const [actionFilter, setActionFilter] = useState(initialFilterAction || '');
  const [userIdFilter, setUserIdFilter] = useState(initialFilterUserId || '');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [integrityResult, setIntegrityResult] = useState(null);
  const [integrityChecking, setIntegrityChecking] = useState(false);

  /**
   * Loads users from localStorage for name resolution.
   */
  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem('csnp_users');
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          setUsers(parsed);
        }
      }
    } catch {
      setUsers([]);
    }
  }, []);

  /**
   * Loads audit logs with current filters.
   */
  const loadLogs = useCallback(() => {
    const filters = {};

    if (moduleFilter && moduleFilter.trim().length > 0) {
      filters.module = moduleFilter.trim();
    }

    if (actionFilter && actionFilter.trim().length > 0) {
      filters.action = actionFilter.trim();
    }

    if (userIdFilter && userIdFilter.trim().length > 0) {
      filters.userId = userIdFilter.trim();
    }

    if (startDateFilter && startDateFilter.trim().length > 0) {
      filters.startDate = startDateFilter.trim();
    }

    if (endDateFilter && endDateFilter.trim().length > 0) {
      filters.endDate = endDateFilter.trim();
    }

    if (searchFilter && searchFilter.trim().length > 0) {
      filters.search = searchFilter.trim();
    }

    fetchLogs(filters);
  }, [fetchLogs, moduleFilter, actionFilter, userIdFilter, startDateFilter, endDateFilter, searchFilter]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  /**
   * Auto-refresh interval.
   */
  useEffect(() => {
    if (typeof refreshInterval !== 'number' || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      loadLogs();
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshInterval, loadLogs]);

  /**
   * Enriched logs with user display names.
   */
  const enrichedLogs = useMemo(() => {
    if (!Array.isArray(logs)) {
      return [];
    }

    return logs.map((entry) => ({
      ...entry,
      _userName: getUserDisplayName(entry.userId, users),
      _actionLabel: toTitleCase(entry.action || 'unknown'),
      _moduleLabel: toTitleCase(entry.module || 'general'),
    }));
  }, [logs, users]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const totalCount = getCount();
    const summary = getSummary();

    const byModule = {};
    for (const entry of enrichedLogs) {
      const mod = entry.module || 'general';
      if (!byModule[mod]) {
        byModule[mod] = 0;
      }
      byModule[mod]++;
    }

    const byAction = {};
    for (const entry of enrichedLogs) {
      const action = entry.action || 'unknown';
      if (!byAction[action]) {
        byAction[action] = 0;
      }
      byAction[action]++;
    }

    return {
      totalCount,
      displayedCount: enrichedLogs.length,
      summary,
      byModule,
      byAction,
    };
  }, [enrichedLogs, getCount, getSummary]);

  /**
   * User filter options built from available users.
   */
  const userFilterOptions = useMemo(() => {
    const options = [{ value: '', label: 'All Users' }];

    if (Array.isArray(users)) {
      for (const u of users) {
        options.push({
          value: u.id,
          label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.id.substring(0, 8),
        });
      }
    }

    options.push({ value: 'system', label: 'System' });

    return options;
  }, [users]);

  /**
   * Handles viewing an entry's details.
   * @param {Object} entry - The audit log entry
   */
  const handleViewDetails = useCallback((entry) => {
    setSelectedEntry(entry);
    setDetailModalOpen(true);
  }, []);

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetail = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedEntry(null);
  }, []);

  /**
   * Handles running the integrity check.
   */
  const handleIntegrityCheck = useCallback(() => {
    setIntegrityChecking(true);

    try {
      const result = checkIntegrity();
      setIntegrityResult(result);

      if (result.valid) {
        addNotification(
          'success',
          'Integrity Check Passed',
          `Audit trail integrity verified. ${result.checkedEntries} entries checked with no tampering detected.`
        );
      } else {
        addNotification(
          'error',
          'Integrity Check Failed',
          `Audit trail integrity check failed with ${result.errors.length} error(s). The audit trail may have been tampered with.`
        );
      }
    } catch (err) {
      console.error('AuditLogViewer: integrity check error:', err);
      addNotification('error', 'Integrity Check Error', 'An unexpected error occurred during integrity verification.');
    } finally {
      setIntegrityChecking(false);
    }
  }, [checkIntegrity, addNotification]);

  /**
   * Handles exporting audit logs as CSV.
   */
  const handleExportCSV = useCallback(() => {
    if (enrichedLogs.length === 0) {
      addNotification('warning', 'No Data', 'No audit log entries to export.');
      return;
    }

    try {
      const csv = buildCSVExport(enrichedLogs);
      const filename = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Export Complete', `Exported ${enrichedLogs.length} audit log entry(ies) to CSV.`);
    } catch (err) {
      console.error('AuditLogViewer: CSV export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting audit logs.');
    }
  }, [enrichedLogs, addNotification]);

  /**
   * Handles exporting audit logs as JSON.
   */
  const handleExportJSON = useCallback(() => {
    if (enrichedLogs.length === 0) {
      addNotification('warning', 'No Data', 'No audit log entries to export.');
      return;
    }

    try {
      const exportData = exportLogs();
      if (!exportData) {
        addNotification('error', 'Export Failed', 'Failed to generate audit log export.');
        return;
      }

      const json = JSON.stringify(exportData, null, 2);
      const filename = `audit_log_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Export Complete', `Exported ${exportData.totalEntries} audit log entry(ies) to JSON. Integrity: ${exportData.integrityValid ? 'Valid' : 'Invalid'}`);
    } catch (err) {
      console.error('AuditLogViewer: JSON export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting audit logs.');
    }
  }, [enrichedLogs, exportLogs, addNotification]);

  /**
   * Handles clearing all filters.
   */
  const handleClearFilters = useCallback(() => {
    setModuleFilter('');
    setActionFilter('');
    setUserIdFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setSearchFilter('');
  }, []);

  /**
   * Whether any filters are active.
   */
  const hasActiveFilters = useMemo(() => {
    return (
      (moduleFilter && moduleFilter.trim().length > 0) ||
      (actionFilter && actionFilter.trim().length > 0) ||
      (userIdFilter && userIdFilter.trim().length > 0) ||
      (startDateFilter && startDateFilter.trim().length > 0) ||
      (endDateFilter && endDateFilter.trim().length > 0) ||
      (searchFilter && searchFilter.trim().length > 0)
    );
  }, [moduleFilter, actionFilter, userIdFilter, startDateFilter, endDateFilter, searchFilter]);

  /**
   * Table columns definition.
   */
  const columns = useMemo(() => {
    const cols = [
      {
        key: 'timestamp',
        label: 'Timestamp',
        sortable: true,
        searchable: false,
        width: 'min-w-[140px]',
        render: (value) => {
          if (!value) {
            return <span className="text-gray-400">—</span>;
          }
          return (
            <div>
              <p className="text-xs font-medium text-gray-900">{formatDate(value)}</p>
              <p className="text-[10px] text-gray-400">{formatRelativeTime(value)}</p>
            </div>
          );
        },
      },
      {
        key: 'action',
        label: 'Action',
        sortable: true,
        searchable: true,
        width: 'min-w-[120px]',
        render: (value) => {
          const colors = ACTION_COLORS[value] || DEFAULT_ACTION_COLOR;
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text} border border-gray-200`}>
              {toTitleCase(value || 'unknown')}
            </span>
          );
        },
      },
      {
        key: '_userName',
        label: 'User',
        sortable: true,
        searchable: true,
        width: 'min-w-[120px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate max-w-[140px]" title={value}>
                {value || 'System'}
              </p>
              <p className="text-[10px] text-gray-400 truncate" title={row.userId}>
                {row.userId ? row.userId.substring(0, 12) + '…' : '—'}
              </p>
            </div>
          );
        },
      },
      {
        key: 'module',
        label: 'Module',
        sortable: true,
        searchable: true,
        width: 'min-w-[100px]',
        render: (value) => {
          const badgeStatus = MODULE_BADGE_STATUSES[value] || 'pending';
          return (
            <StatusBadge
              status={badgeStatus}
              label={toTitleCase(value || 'general')}
              size="sm"
              showDot={false}
              bordered={true}
            />
          );
        },
      },
      {
        key: 'description',
        label: 'Description',
        sortable: false,
        searchable: true,
        width: 'min-w-[240px]',
        render: (value) => {
          if (!value || typeof value !== 'string' || value.trim().length === 0) {
            return <span className="text-gray-400 text-xs">—</span>;
          }
          return (
            <p className="text-xs text-gray-700 truncate max-w-[300px]" title={value}>
              {value}
            </p>
          );
        },
      },
    ];

    if (!compact) {
      cols.push({
        key: 'targetType',
        label: 'Target',
        sortable: true,
        searchable: true,
        width: 'min-w-[120px]',
        render: (value, row) => {
          if (!value) {
            return <span className="text-gray-400 text-xs">—</span>;
          }
          return (
            <div className="min-w-0">
              <p className="text-xs text-gray-700 truncate max-w-[140px]" title={value}>
                {toTitleCase(value)}
              </p>
              {row.targetId && (
                <p className="text-[10px] font-mono text-gray-400 truncate" title={row.targetId}>
                  {row.targetId.substring(0, 12) + '…'}
                </p>
              )}
            </div>
          );
        },
      });

      cols.push({
        key: 'hash',
        label: 'Hash',
        sortable: false,
        searchable: false,
        width: 'min-w-[100px]',
        render: (value) => {
          if (!value) {
            return <span className="text-gray-400 text-xs">—</span>;
          }
          return (
            <span className="text-[10px] font-mono text-gray-500 truncate max-w-[100px]" title={value}>
              {value.substring(0, 12) + '…'}
            </span>
          );
        },
      });
    }

    return cols;
  }, [compact]);

  /**
   * Table actions definition.
   */
  const actions = useMemo(() => {
    return [
      {
        label: 'View',
        onClick: (row) => handleViewDetails(row),
        variant: 'ghost',
        size: 'sm',
        icon: (
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ];
  }, [handleViewDetails]);

  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Audit icon */}
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
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
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              {hasTitle && (
                <h3 className="text-lg font-semibold text-csnp-primary">
                  {title}
                </h3>
              )}
              {!loading && enrichedLogs.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {enrichedLogs.length} {hasActiveFilters ? 'filtered' : ''} entr{enrichedLogs.length !== 1 ? 'ies' : 'y'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Integrity Check Button */}
              {showIntegrityCheck && isAuthenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleIntegrityCheck}
                  loading={integrityChecking}
                  loadingText="Checking..."
                  disabled={integrityChecking}
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
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  }
                >
                  Verify Integrity
                </Button>
              )}

              {/* Export Buttons */}
              {showExport && !loading && enrichedLogs.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
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
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    }
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJSON}
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
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    }
                  >
                    JSON
                  </Button>
                </>
              )}

              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadLogs}
                disabled={loading}
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
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                  </svg>
                }
              >
                Refresh
              </Button>

              {headerActions}
            </div>
          </div>

          {/* Summary Stats */}
          {showStats && !loading && !error && enrichedLogs.length > 0 && !compact && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-csnp-blue-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-csnp-primary" aria-hidden="true" />
                <span className="text-[10px] font-medium text-csnp-primary">
                  {stats.totalCount} total
                </span>
              </div>
              {hasActiveFilters && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-yellow-700">
                    {stats.displayedCount} filtered
                  </span>
                </div>
              )}
              {integrityResult && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${integrityResult.valid ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${integrityResult.valid ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden="true" />
                  <span className={`text-[10px] font-medium ${integrityResult.valid ? 'text-green-700' : 'text-red-700'}`}>
                    Integrity: {integrityResult.valid ? 'Valid' : 'Failed'}
                  </span>
                </div>
              )}
              {Object.entries(stats.byModule).slice(0, 5).map(([mod, count]) => (
                <div key={mod} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
                  <span className="text-[10px] font-medium text-gray-600">
                    {toTitleCase(mod)}: {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Integrity Check Result */}
      {integrityResult && !integrityResult.valid && (
        <Alert
          variant="error"
          title="Audit Trail Integrity Check Failed"
          showIcon={true}
          bordered={true}
          size="sm"
          dismissible={true}
          onDismiss={() => setIntegrityResult(null)}
          className="mb-4"
        >
          <p>
            The audit trail integrity verification detected {integrityResult.errors.length} error(s).
            {integrityResult.checkedEntries > 0 && ` ${integrityResult.checkedEntries} entries were checked.`}
          </p>
          {integrityResult.errors.length > 0 && (
            <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
              {integrityResult.errors.slice(0, 3).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
              {integrityResult.errors.length > 3 && (
                <li>...and {integrityResult.errors.length - 3} more error(s)</li>
              )}
            </ul>
          )}
        </Alert>
      )}

      {integrityResult && integrityResult.valid && (
        <Alert
          variant="success"
          title="Audit Trail Integrity Verified"
          showIcon={true}
          bordered={true}
          size="sm"
          dismissible={true}
          onDismiss={() => setIntegrityResult(null)}
          className="mb-4"
        >
          All {integrityResult.checkedEntries} audit trail entries passed integrity verification. No tampering detected.
        </Alert>
      )}

      {/* Filters */}
      {showFilters && !compact && (
        <Card bordered={true} flat={false} className="mb-4" size="sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filters</p>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Module Filter */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Module</label>
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter by module"
                >
                  {MODULE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Filter */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Action</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter by action"
                >
                  {ACTION_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* User Filter */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">User</label>
                <select
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter by user"
                >
                  {userFilterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date Filter */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Start Date</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter by start date"
                />
              </div>

              {/* End Date Filter */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">End Date</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter by end date"
                />
              </div>

              {/* Search Filter */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Search</label>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search descriptions..."
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Search audit logs"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Compact Filters */}
      {showFilters && compact && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
            aria-label="Filter by module"
          >
            {MODULE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
            aria-label="Filter by action"
          >
            {ACTION_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && enrichedLogs.length === 0 && (
        <AuditLogViewerSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load audit logs"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadLogs}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && enrichedLogs.length === 0 && !hasActiveFilters && (
        <EmptyState
          title="No Audit Log Entries"
          description="No audit trail entries have been recorded yet. Activity will appear here as actions are performed in the portal."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Filtered Empty State */}
      {!loading && !error && enrichedLogs.length === 0 && hasActiveFilters && (
        <EmptyState
          title="No Matching Entries"
          description="No audit log entries match the selected filters. Try adjusting your filter criteria."
          iconType="no-results"
          size="sm"
          actionLabel="Clear Filters"
          onAction={handleClearFilters}
          actionVariant="outline"
        />
      )}

      {/* Data Table */}
      {!loading && !error && enrichedLogs.length > 0 && (
        <DataTable
          data={enrichedLogs}
          columns={columns}
          actions={actions}
          loading={false}
          searchable={!compact && !showFilters}
          searchPlaceholder="Search audit logs..."
          paginated={true}
          initialPageSize={initialPageSize}
          initialSortField="timestamp"
          initialSortDirection="desc"
          emptyMessage="No audit log entries found"
          emptyDescription="No entries match the current search criteria."
          idKey="id"
          onRowClick={handleViewDetails}
          className=""
        />
      )}

      {/* CMS Compliance Notice */}
      {!loading && !error && !compact && enrichedLogs.length > 0 && (
        <div className="mt-4">
          <div className="flex items-start gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
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
              <span className="font-semibold">CMS Compliance:</span>{' '}
              The audit trail is an append-only, tamper-evident log of all system activities per CMS
              HIPAA security requirements (45 CFR §164.312). Each entry is hash-chained to the previous
              entry for integrity verification. All PHI access, modifications, and administrative actions
              are recorded. Regular integrity verification is recommended to ensure the audit trail has
              not been tampered with. Export audit logs periodically for off-site backup and compliance reporting.
            </p>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <AuditLogDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        entry={selectedEntry}
        users={users}
      />
    </div>
  );
}

AuditLogViewer.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showExport: PropTypes.bool,
  showStats: PropTypes.bool,
  showIntegrityCheck: PropTypes.bool,
  showFilters: PropTypes.bool,
  compact: PropTypes.bool,
  initialPageSize: PropTypes.number,
  filterModule: PropTypes.string,
  filterAction: PropTypes.string,
  filterUserId: PropTypes.string,
  refreshInterval: PropTypes.number,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

AuditLogViewer.defaultProps = {
  showHeader: true,
  title: 'Audit Log',
  showExport: true,
  showStats: true,
  showIntegrityCheck: true,
  showFilters: true,
  compact: false,
  initialPageSize: 20,
  filterModule: undefined,
  filterAction: undefined,
  filterUserId: undefined,
  refreshInterval: 0,
  className: '',
  headerActions: null,
};