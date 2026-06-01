import React, { useState, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import Modal from '../common/Modal.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import FormField from '../common/FormField.jsx';
import Tabs from '../common/Tabs.jsx';
import {
  exportData,
  exportDataAsString,
  importData,
  getStorageStats,
  getAllKeys,
  getItem,
  setItem,
  initializeStorage,
} from '../../utils/storage.js';
import { resetSeedData } from '../../data/seedData.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import {
  formatDateTime,
  formatRelativeTime,
  toTitleCase,
} from '../../utils/helpers.js';

/**
 * Module definitions for selective export.
 * @type {{ key: string, label: string, storageKeys: string[], description: string }[]}
 */
const EXPORT_MODULES = [
  {
    key: 'members',
    label: 'Members',
    storageKeys: ['csnp_members'],
    description: 'Member demographic data, diagnosis codes, and condition categories',
  },
  {
    key: 'enrollments',
    label: 'Enrollments',
    storageKeys: ['csnp_enrollments'],
    description: 'Enrollment applications, statuses, and CMS submission records',
  },
  {
    key: 'claims',
    label: 'Claims',
    storageKeys: ['csnp_claims'],
    description: 'Claims records, adjudication results, and payment details',
  },
  {
    key: 'providers',
    label: 'Providers',
    storageKeys: ['csnp_providers', 'csnp_provider_assignments', 'csnp_referrals'],
    description: 'Provider network, PCP assignments, and referral records',
  },
  {
    key: 'benefits',
    label: 'Benefits',
    storageKeys: ['csnp_benefit_packages', 'csnp_benefit_assignments'],
    description: 'Benefit packages, copay schedules, and member benefit assignments',
  },
  {
    key: 'care_management',
    label: 'Care Management',
    storageKeys: [
      'csnp_care_events',
      'csnp_care_plans',
      'csnp_care_alerts',
      'csnp_care_tasks',
      'csnp_hra_records',
      'csnp_care_manager_assignments',
      'csnp_care_programs',
      'csnp_care_program_enrollments',
    ],
    description: 'Care events, care plans, HRA records, alerts, tasks, and care manager assignments',
  },
  {
    key: 'eligibility',
    label: 'Eligibility',
    storageKeys: ['csnp_eligibility_records'],
    description: 'Eligibility validation records and re-verification history',
  },
  {
    key: 'compliance',
    label: 'Compliance',
    storageKeys: [
      'csnp_compliance_reports',
      'csnp_compliance_audits',
      'csnp_compliance_status',
      'csnp_enrollment_extracts',
    ],
    description: 'CMS reports, compliance audits, and enrollment extracts',
  },
  {
    key: 'audit_logs',
    label: 'Audit Logs',
    storageKeys: ['csnp_audit_logs'],
    description: 'Audit trail entries with hash chain integrity',
  },
  {
    key: 'users',
    label: 'Users',
    storageKeys: ['csnp_users'],
    description: 'User accounts and role assignments',
  },
];

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
    console.error('DataExportImport: failed to download file:', err);
  }
}

/**
 * Formats a byte count to a human-readable string.
 * @param {number} bytes - Byte count
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }
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
 * Validates imported data structure.
 * @param {Object} data - The parsed import data
 * @returns {{ valid: boolean, errors: string[], warnings: string[], stats: Object }}
 */
function validateImportData(data) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalKeys: 0,
      recognizedKeys: 0,
      unrecognizedKeys: 0,
      modules: [],
    },
  };

  if (!data || typeof data !== 'object') {
    result.valid = false;
    result.errors.push('Import data must be a valid JSON object');
    return result;
  }

  const importPayload = data.data || data;

  if (typeof importPayload !== 'object' || importPayload === null || Array.isArray(importPayload)) {
    result.valid = false;
    result.errors.push('Import data must contain a valid data object');
    return result;
  }

  const keys = Object.keys(importPayload);
  result.stats.totalKeys = keys.length;

  if (keys.length === 0) {
    result.valid = false;
    result.errors.push('Import data is empty — no keys found');
    return result;
  }

  const allKnownKeys = new Set();
  for (const mod of EXPORT_MODULES) {
    for (const sk of mod.storageKeys) {
      allKnownKeys.add(sk);
    }
  }
  allKnownKeys.add('csnp_seed_initialized');
  allKnownKeys.add('csnp_auth_token');
  allKnownKeys.add('csnp_refresh_token');
  allKnownKeys.add('csnp_user');
  allKnownKeys.add('csnp_user_role');
  allKnownKeys.add('csnp_session_expiry');
  allKnownKeys.add('csnp_last_activity');
  allKnownKeys.add('csnp_theme');
  allKnownKeys.add('csnp_sidebar_collapsed');

  const recognizedKeys = [];
  const unrecognizedKeys = [];

  for (const key of keys) {
    if (allKnownKeys.has(key)) {
      recognizedKeys.push(key);
    } else {
      unrecognizedKeys.push(key);
    }
  }

  result.stats.recognizedKeys = recognizedKeys.length;
  result.stats.unrecognizedKeys = unrecognizedKeys.length;

  if (unrecognizedKeys.length > 0) {
    result.warnings.push(
      `${unrecognizedKeys.length} unrecognized key(s) found: ${unrecognizedKeys.slice(0, 5).join(', ')}${unrecognizedKeys.length > 5 ? ` and ${unrecognizedKeys.length - 5} more` : ''}`
    );
  }

  const matchedModules = [];
  for (const mod of EXPORT_MODULES) {
    const matchedKeys = mod.storageKeys.filter((sk) => keys.includes(sk));
    if (matchedKeys.length > 0) {
      let recordCount = 0;
      for (const mk of matchedKeys) {
        const val = importPayload[mk];
        if (Array.isArray(val)) {
          recordCount += val.length;
        }
      }
      matchedModules.push({
        key: mod.key,
        label: mod.label,
        matchedKeys: matchedKeys.length,
        totalKeys: mod.storageKeys.length,
        recordCount,
      });
    }
  }
  result.stats.modules = matchedModules;

  for (const key of recognizedKeys) {
    const value = importPayload[key];
    if (value === undefined) {
      result.warnings.push(`Key "${key}" has undefined value`);
    }
  }

  const arrayKeys = [
    'csnp_members', 'csnp_enrollments', 'csnp_claims', 'csnp_providers',
    'csnp_benefit_packages', 'csnp_care_events', 'csnp_audit_logs',
    'csnp_users', 'csnp_referrals', 'csnp_eligibility_records',
  ];

  for (const ak of arrayKeys) {
    if (importPayload[ak] !== undefined && !Array.isArray(importPayload[ak])) {
      result.warnings.push(`Key "${ak}" is expected to be an array but found ${typeof importPayload[ak]}`);
    }
  }

  return result;
}

/**
 * Module selection chip component.
 *
 * @param {Object} props
 * @param {Object} props.module - Module definition object
 * @param {boolean} props.selected - Whether the module is selected
 * @param {Function} props.onToggle - Toggle handler
 * @param {boolean} [props.disabled=false] - Whether the chip is disabled
 * @param {number} [props.recordCount] - Number of records in this module
 * @returns {React.ReactElement}
 */
function ModuleChip({ module, selected, onToggle, disabled = false, recordCount }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(module.key)}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-1 ${
        selected
          ? 'bg-csnp-blue-50 border-csnp-primary shadow-sm'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={selected}
    >
      <div className="flex items-start gap-2">
        <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5 ${
          selected ? 'bg-csnp-primary text-white' : 'bg-gray-100 text-gray-400'
        }`}>
          {selected ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-xs font-semibold ${selected ? 'text-csnp-primary' : 'text-gray-900'}`}>
              {module.label}
            </p>
            {typeof recordCount === 'number' && recordCount > 0 && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {recordCount} record{recordCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
            {module.description}
          </p>
        </div>
      </div>
    </button>
  );
}

ModuleChip.propTypes = {
  module: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    storageKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
    description: PropTypes.string.isRequired,
  }).isRequired,
  selected: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  recordCount: PropTypes.number,
};

ModuleChip.defaultProps = {
  disabled: false,
  recordCount: undefined,
};

/**
 * Import validation result display component.
 *
 * @param {Object} props
 * @param {Object} props.validation - The validation result
 * @param {string} props.fileName - The imported file name
 * @param {number} props.fileSize - The imported file size in bytes
 * @returns {React.ReactElement|null}
 */
function ImportValidationDisplay({ validation, fileName, fileSize }) {
  if (!validation) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* File Info */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900 truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-[10px] text-gray-500">
            {formatBytes(fileSize)} · {validation.stats.totalKeys} key{validation.stats.totalKeys !== 1 ? 's' : ''}
          </p>
        </div>
        <StatusBadge
          status={validation.valid ? 'active' : 'denied'}
          label={validation.valid ? 'Valid' : 'Invalid'}
          size="sm"
          showDot={true}
          bordered={true}
        />
      </div>

      {/* Validation Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-2 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Total Keys</p>
          <p className="text-lg font-bold text-csnp-primary">{validation.stats.totalKeys}</p>
        </div>
        <div className="p-2 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Recognized</p>
          <p className="text-lg font-bold text-green-700">{validation.stats.recognizedKeys}</p>
        </div>
        <div className={`p-2 rounded-lg border ${validation.stats.unrecognizedKeys > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${validation.stats.unrecognizedKeys > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>Unrecognized</p>
          <p className={`text-lg font-bold ${validation.stats.unrecognizedKeys > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>{validation.stats.unrecognizedKeys}</p>
        </div>
      </div>

      {/* Matched Modules */}
      {validation.stats.modules.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Detected Modules ({validation.stats.modules.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {validation.stats.modules.map((mod) => (
              <span
                key={mod.key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-csnp-blue-50 text-csnp-primary border border-csnp-blue-100"
              >
                {mod.label}
                {mod.recordCount > 0 && (
                  <span className="text-[9px] text-csnp-blue-400">({mod.recordCount})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="space-y-1.5">
          {validation.errors.map((error, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-200">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-600 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="space-y-1.5">
          {validation.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-yellow-600 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs text-yellow-700">{warning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

ImportValidationDisplay.propTypes = {
  validation: PropTypes.shape({
    valid: PropTypes.bool,
    errors: PropTypes.arrayOf(PropTypes.string),
    warnings: PropTypes.arrayOf(PropTypes.string),
    stats: PropTypes.shape({
      totalKeys: PropTypes.number,
      recognizedKeys: PropTypes.number,
      unrecognizedKeys: PropTypes.number,
      modules: PropTypes.array,
    }),
  }),
  fileName: PropTypes.string,
  fileSize: PropTypes.number,
};

ImportValidationDisplay.defaultProps = {
  validation: null,
  fileName: '',
  fileSize: 0,
};

/**
 * Data export/import component for the CSNP Portal settings page.
 * Provides full localStorage data export as JSON, selective module export,
 * JSON file import with validation, confirmation dialog before overwrite,
 * and seed data reset functionality.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function DataExportImport({
  showHeader = true,
  compact = false,
  className = '',
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Export state
  const [selectedModules, setSelectedModules] = useState(() => {
    return EXPORT_MODULES.map((m) => m.key);
  });
  const [exporting, setExporting] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importFileName, setImportFileName] = useState('');
  const [importFileSize, setImportFileSize] = useState(0);
  const [importData, setImportData] = useState(null);
  const [importValidation, setImportValidation] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Reset state
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Storage stats
  const [storageStats, setStorageStats] = useState(() => getStorageStats());

  const fileInputRef = useRef(null);

  /**
   * Refreshes storage statistics.
   */
  const refreshStats = useCallback(() => {
    setStorageStats(getStorageStats());
  }, []);

  /**
   * Computes record counts per module from localStorage.
   */
  const moduleRecordCounts = useMemo(() => {
    const counts = {};
    for (const mod of EXPORT_MODULES) {
      let total = 0;
      for (const sk of mod.storageKeys) {
        try {
          const val = getItem(sk, []);
          if (Array.isArray(val)) {
            total += val.length;
          }
        } catch {
          // Silently fail
        }
      }
      counts[mod.key] = total;
    }
    return counts;
  }, [storageStats]);

  /**
   * Handles toggling a module for selective export.
   * @param {string} moduleKey - The module key to toggle
   */
  const handleToggleModule = useCallback((moduleKey) => {
    setSelectedModules((prev) => {
      if (prev.includes(moduleKey)) {
        return prev.filter((k) => k !== moduleKey);
      }
      return [...prev, moduleKey];
    });
  }, []);

  /**
   * Handles selecting all modules.
   */
  const handleSelectAllModules = useCallback(() => {
    setSelectedModules(EXPORT_MODULES.map((m) => m.key));
  }, []);

  /**
   * Handles deselecting all modules.
   */
  const handleDeselectAllModules = useCallback(() => {
    setSelectedModules([]);
  }, []);

  /**
   * Handles full data export (all localStorage data).
   */
  const handleExportAll = useCallback(() => {
    setExporting(true);

    try {
      const exportPayload = exportData();
      if (!exportPayload) {
        addNotification('error', 'Export Failed', 'Failed to export localStorage data.');
        return;
      }

      const json = JSON.stringify(exportPayload, null, 2);
      const filename = `csnp_portal_backup_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');

      addNotification(
        'success',
        'Export Complete',
        `Full data backup exported successfully. ${exportPayload.totalKeys} key(s) exported.`
      );

      refreshStats();
    } catch (err) {
      console.error('DataExportImport: export all failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting data.');
    } finally {
      setExporting(false);
    }
  }, [addNotification, refreshStats]);

  /**
   * Handles selective module export.
   */
  const handleExportSelected = useCallback(() => {
    if (selectedModules.length === 0) {
      addNotification('warning', 'No Modules Selected', 'Please select at least one module to export.');
      return;
    }

    setExporting(true);

    try {
      const selectedStorageKeys = new Set();
      for (const modKey of selectedModules) {
        const mod = EXPORT_MODULES.find((m) => m.key === modKey);
        if (mod) {
          for (const sk of mod.storageKeys) {
            selectedStorageKeys.add(sk);
          }
        }
      }

      const exportPayload = {};
      let totalRecords = 0;

      for (const key of selectedStorageKeys) {
        try {
          const raw = localStorage.getItem(key);
          if (raw !== null) {
            try {
              const parsed = JSON.parse(raw);
              exportPayload[key] = parsed;
              if (Array.isArray(parsed)) {
                totalRecords += parsed.length;
              }
            } catch {
              exportPayload[key] = raw;
            }
          }
        } catch {
          // Silently skip
        }
      }

      if (Object.keys(exportPayload).length === 0) {
        addNotification('warning', 'No Data', 'No data found for the selected modules.');
        setExporting(false);
        return;
      }

      const payload = {
        data: exportPayload,
        exportedAt: new Date().toISOString(),
        totalKeys: Object.keys(exportPayload).length,
        exportType: 'selective',
        selectedModules,
        totalRecords,
      };

      const json = JSON.stringify(payload, null, 2);
      const moduleNames = selectedModules.map((k) => {
        const mod = EXPORT_MODULES.find((m) => m.key === k);
        return mod ? mod.label.toLowerCase().replace(/\s+/g, '_') : k;
      });
      const filename = `csnp_portal_${moduleNames.slice(0, 3).join('_')}${selectedModules.length > 3 ? '_and_more' : ''}_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');

      addNotification(
        'success',
        'Export Complete',
        `Exported ${selectedModules.length} module(s) with ${totalRecords} record(s).`
      );

      refreshStats();
    } catch (err) {
      console.error('DataExportImport: selective export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting selected modules.');
    } finally {
      setExporting(false);
    }
  }, [selectedModules, addNotification, refreshStats]);

  /**
   * Handles file input change for import.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleFileInputChange = useCallback((e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      return;
    }

    setImportResult(null);
    setImportValidation(null);
    setImportData(null);

    if (!file.name.endsWith('.json')) {
      addNotification('warning', 'Invalid File', 'Please select a JSON file (.json).');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      addNotification('warning', 'File Too Large', 'Import file must be less than 50MB.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setImportFileName(file.name);
    setImportFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const parsed = JSON.parse(content);
        setImportFile(content);
        setImportData(parsed);

        const validation = validateImportData(parsed);
        setImportValidation(validation);

        if (validation.valid) {
          addNotification(
            'info',
            'File Loaded',
            `"${file.name}" loaded and validated. ${validation.stats.totalKeys} key(s) found.`
          );
        } else {
          addNotification(
            'warning',
            'Validation Issues',
            `"${file.name}" has validation issues. Please review before importing.`
          );
        }
      } catch (err) {
        console.error('DataExportImport: failed to parse import file:', err);
        setImportValidation({
          valid: false,
          errors: ['Failed to parse JSON file. Please ensure the file contains valid JSON.'],
          warnings: [],
          stats: { totalKeys: 0, recognizedKeys: 0, unrecognizedKeys: 0, modules: [] },
        });
        addNotification('error', 'Parse Error', 'Failed to parse the selected JSON file.');
      }
    };

    reader.onerror = () => {
      addNotification('error', 'Read Error', 'Failed to read the selected file.');
    };

    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addNotification]);

  /**
   * Handles clicking the import file area.
   */
  const handleImportAreaClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  /**
   * Handles clearing the imported file.
   */
  const handleClearImport = useCallback(() => {
    setImportFile(null);
    setImportFileName('');
    setImportFileSize(0);
    setImportData(null);
    setImportValidation(null);
    setImportResult(null);
    setImportOverwrite(false);
  }, []);

  /**
   * Handles initiating the import process.
   */
  const handleInitiateImport = useCallback(() => {
    if (!importData || !importValidation || !importValidation.valid) {
      addNotification('warning', 'Cannot Import', 'Please load a valid JSON file before importing.');
      return;
    }

    setImportConfirmOpen(true);
  }, [importData, importValidation, addNotification]);

  /**
   * Handles confirming and executing the import.
   */
  const handleConfirmImport = useCallback(() => {
    setImportConfirmOpen(false);
    setImporting(true);
    setImportResult(null);

    try {
      const result = importData(importFile, {
        overwrite: importOverwrite,
        merge: !importOverwrite,
      });

      setImportResult(result);

      if (result.success) {
        addNotification(
          'success',
          'Import Complete',
          `Successfully imported ${result.keysImported} key(s).${result.errors.length > 0 ? ` ${result.errors.length} error(s) occurred.` : ''}`
        );
      } else {
        addNotification(
          result.keysImported > 0 ? 'warning' : 'error',
          result.keysImported > 0 ? 'Partial Import' : 'Import Failed',
          result.keysImported > 0
            ? `Imported ${result.keysImported} key(s) with ${result.errors.length} error(s).`
            : `Import failed with ${result.errors.length} error(s).`
        );
      }

      refreshStats();
    } catch (err) {
      console.error('DataExportImport: import failed:', err);
      setImportResult({
        success: false,
        keysImported: 0,
        errors: ['An unexpected error occurred during import'],
      });
      addNotification('error', 'Import Failed', 'An unexpected error occurred during data import.');
    } finally {
      setImporting(false);
    }
  }, [importFile, importOverwrite, importData, addNotification, refreshStats]);

  /**
   * Handles resetting to seed data.
   */
  const handleResetToSeedData = useCallback(() => {
    setResetting(true);
    setResetConfirmOpen(false);

    try {
      const success = resetSeedData();

      if (success) {
        addNotification(
          'success',
          'Data Reset',
          'All data has been reset to the initial seed data. Please refresh the page for changes to take effect.'
        );
      } else {
        addNotification(
          'error',
          'Reset Failed',
          'Failed to reset data to seed values.'
        );
      }

      refreshStats();
    } catch (err) {
      console.error('DataExportImport: reset failed:', err);
      addNotification('error', 'Reset Failed', 'An unexpected error occurred during data reset.');
    } finally {
      setResetting(false);
    }
  }, [addNotification, refreshStats]);

  /**
   * Computed: total selected record count.
   */
  const selectedRecordCount = useMemo(() => {
    let total = 0;
    for (const modKey of selectedModules) {
      total += moduleRecordCounts[modKey] || 0;
    }
    return total;
  }, [selectedModules, moduleRecordCounts]);

  /**
   * Computed: total record count across all modules.
   */
  const totalRecordCount = useMemo(() => {
    let total = 0;
    for (const count of Object.values(moduleRecordCounts)) {
      total += count;
    }
    return total;
  }, [moduleRecordCounts]);

  const containerClassName = [className].filter(Boolean).join(' ');

  /**
   * Renders the Export tab content.
   */
  function renderExportTab() {
    return (
      <div className="space-y-6">
        {/* Storage Stats */}
        {!compact && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
              <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Storage Used</p>
              <p className="text-lg font-bold text-csnp-primary">{storageStats.sizeFormatted}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Keys</p>
              <p className="text-lg font-bold text-gray-700">{storageStats.totalKeys}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Total Records</p>
              <p className="text-lg font-bold text-green-700">{totalRecordCount}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Remaining</p>
              <p className="text-lg font-bold text-gray-700">{formatBytes(storageStats.remainingBytes)}</p>
            </div>
          </div>
        )}

        {/* Full Export */}
        <Card bordered={true} flat={false} size="sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-csnp-primary">Full Data Export</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Export all localStorage data as a single JSON backup file
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExportAll}
                loading={exporting}
                loadingText="Exporting..."
                disabled={exporting || storageStats.totalKeys === 0}
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
                Export All
              </Button>
            </div>
          </div>
        </Card>

        {/* Selective Module Export */}
        <Card bordered={true} flat={false} size="sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-csnp-primary">Selective Module Export</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Choose specific modules to include in the export
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllModules}
                  className="text-[10px] font-medium text-csnp-primary hover:text-csnp-primary-dark focus:outline-none transition-colors duration-150"
                >
                  Select All
                </button>
                <span className="text-gray-300" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={handleDeselectAllModules}
                  className="text-[10px] font-medium text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-150"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Module Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXPORT_MODULES.map((mod) => (
                <ModuleChip
                  key={mod.key}
                  module={mod}
                  selected={selectedModules.includes(mod.key)}
                  onToggle={handleToggleModule}
                  disabled={exporting}
                  recordCount={moduleRecordCounts[mod.key]}
                />
              ))}
            </div>

            {/* Export Selected Button */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} selected</span>
                <span className="text-gray-300" aria-hidden="true">·</span>
                <span>{selectedRecordCount} record{selectedRecordCount !== 1 ? 's' : ''}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSelected}
                loading={exporting}
                loadingText="Exporting..."
                disabled={exporting || selectedModules.length === 0}
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
                Export Selected
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /**
   * Renders the Import tab content.
   */
  function renderImportTab() {
    return (
      <div className="space-y-6">
        {/* File Upload Area */}
        {!importData && (
          <div
            className="relative border-2 border-dashed rounded-xl transition-all duration-200 border-gray-300 bg-white hover:border-csnp-primary-light hover:bg-gray-50 cursor-pointer p-6"
            onClick={handleImportAreaClick}
            role="button"
            tabIndex={0}
            aria-label="Select a JSON file to import"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleImportAreaClick();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileInputChange}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />

            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">
                <span className="text-csnp-primary font-semibold">Click to select</span>
                {' '}a JSON backup file
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JSON files up to 50MB · Exported from CSNP Portal
              </p>
            </div>
          </div>
        )}

        {/* Imported File Validation */}
        {importData && importValidation && (
          <Card bordered={true} flat={false} size="sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-csnp-primary">Import Validation</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearImport}
                  disabled={importing}
                >
                  Clear
                </Button>
              </div>

              <ImportValidationDisplay
                validation={importValidation}
                fileName={importFileName}
                fileSize={importFileSize}
              />

              {/* Overwrite Toggle */}
              {importValidation.valid && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-xs font-medium text-gray-700">Overwrite Existing Data</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      If enabled, all existing data will be cleared before import. If disabled, imported data will be merged with existing data.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={importOverwrite}
                    onClick={() => !importing && setImportOverwrite((prev) => !prev)}
                    disabled={importing}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
                      importOverwrite ? 'bg-red-500' : 'bg-gray-300'
                    } ${importing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        importOverwrite ? 'translate-x-5' : 'translate-x-0'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              )}

              {/* Overwrite Warning */}
              {importOverwrite && importValidation.valid && (
                <Alert
                  variant="warning"
                  title="Overwrite Mode Enabled"
                  showIcon={true}
                  bordered={true}
                  size="sm"
                >
                  All existing data will be permanently deleted before importing. This action cannot be undone.
                  Make sure you have a backup of your current data.
                </Alert>
              )}

              {/* Import Button */}
              {importValidation.valid && (
                <div className="flex items-center justify-end pt-2 border-t border-gray-100">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleInitiateImport}
                    loading={importing}
                    loadingText="Importing..."
                    disabled={importing}
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
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    }
                  >
                    {importOverwrite ? 'Overwrite & Import' : 'Merge & Import'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Import Result */}
        {importResult && (
          <Alert
            variant={importResult.success ? 'success' : importResult.keysImported > 0 ? 'warning' : 'error'}
            title={importResult.success ? 'Import Successful' : importResult.keysImported > 0 ? 'Partial Import' : 'Import Failed'}
            showIcon={true}
            bordered={true}
            size="sm"
          >
            <p>
              {importResult.keysImported > 0
                ? `${importResult.keysImported} key(s) imported successfully.`
                : 'No keys were imported.'}
              {importResult.errors.length > 0 && (
                <span> {importResult.errors.length} error(s) occurred.</span>
              )}
            </p>
            {importResult.errors.length > 0 && (
              <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                {importResult.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {importResult.errors.length > 5 && (
                  <li>...and {importResult.errors.length - 5} more error(s)</li>
                )}
              </ul>
            )}
          </Alert>
        )}

        {/* Reset to Seed Data */}
        <Card bordered={true} flat={false} size="sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-red-600">Reset to Seed Data</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Clear all data and restore the initial demo/seed data. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setResetConfirmOpen(true)}
                loading={resetting}
                loadingText="Resetting..."
                disabled={resetting}
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
                Reset Data
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    return [
      {
        key: 'export',
        label: 'Export Data',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        ),
        content: renderExportTab(),
      },
      {
        key: 'import',
        label: 'Import & Restore',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        ),
        content: renderImportTab(),
      },
    ];
  }, [
    storageStats, totalRecordCount, moduleRecordCounts, selectedModules,
    exporting, importing, importData, importValidation, importFileName,
    importFileSize, importOverwrite, importResult, resetting, compact,
  ]);

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
          <div className="flex items-center gap-2">
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
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-csnp-primary">
                Data Export & Import
              </h2>
              {!compact && (
                <p className="mt-0.5 text-sm text-gray-500">
                  Backup your portal data as JSON, restore from a previous backup, or reset to initial seed data.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        defaultActiveKey="export"
        variant="underline"
        size="sm"
      />

      {/* CMS Compliance Notice */}
      {!compact && (
        <div className="mt-6">
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
              <span className="font-semibold">Data Management Notice:</span>{' '}
              Exported data may contain Protected Health Information (PHI) subject to HIPAA regulations.
              Handle exported files securely and do not share them via unsecured channels. Imported data
              is validated before being applied to ensure data integrity. All data operations are performed
              locally in your browser&apos;s localStorage.
            </p>
          </div>
        </div>
      )}

      {/* Import Confirmation Dialog */}
      <ConfirmDialog
        isOpen={importConfirmOpen}
        onClose={() => setImportConfirmOpen(false)}
        onConfirm={handleConfirmImport}
        title={importOverwrite ? 'Overwrite All Data?' : 'Import Data?'}
        message={
          importOverwrite
            ? `This will permanently delete ALL existing data and replace it with the imported data from "${importFileName}". This action cannot be undone. Are you sure you want to proceed?`
            : `This will merge the imported data from "${importFileName}" with your existing data. Existing keys may be overwritten with imported values. Are you sure you want to proceed?`
        }
        confirmText={importOverwrite ? 'Overwrite & Import' : 'Merge & Import'}
        cancelText="Cancel"
        variant={importOverwrite ? 'danger' : 'warning'}
        confirmLoading={importing}
      />

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleResetToSeedData}
        title="Reset All Data to Seed Values?"
        message="This will permanently delete ALL current data (members, enrollments, claims, providers, care management records, audit logs, etc.) and replace it with the initial demo/seed data. This action cannot be undone. It is recommended to export a backup before resetting."
        confirmText="Reset All Data"
        cancelText="Cancel"
        variant="danger"
        confirmLoading={resetting}
      />
    </div>
  );
}

DataExportImport.propTypes = {
  showHeader: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
};

DataExportImport.defaultProps = {
  showHeader: true,
  compact: false,
  className: '',
};