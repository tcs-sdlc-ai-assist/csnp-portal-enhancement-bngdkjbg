import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import DataTable from '../common/DataTable.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import Card from '../common/Card.jsx';
import EmptyState from '../common/EmptyState.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import Modal from '../common/Modal.jsx';
import { getEligibilityHistory, checkAnnualReverification } from '../../services/eligibilityService.js';
import { getCodeByICD10, CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { formatDate, formatRelativeTime, formatDateTime, toTitleCase } from '../../utils/helpers.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Status to StatusBadge status mapping.
 * @type {Object.<string, string>}
 */
const STATUS_BADGE_MAP = {
  eligible: 'eligible',
  ineligible: 'ineligible',
  pending: 'pending',
  expired: 'expired',
};

/**
 * Formats an array of ICD-10 codes into a display string.
 * @param {string[]} codes - Array of ICD-10 codes
 * @param {number} [maxDisplay=3] - Maximum number of codes to display before truncating
 * @returns {string} Formatted codes string
 */
function formatCodesDisplay(codes, maxDisplay = 3) {
  if (!Array.isArray(codes) || codes.length === 0) {
    return '—';
  }

  if (codes.length <= maxDisplay) {
    return codes.join(', ');
  }

  return `${codes.slice(0, maxDisplay).join(', ')} +${codes.length - maxDisplay} more`;
}

/**
 * Builds a CSV string from eligibility records.
 * @param {Object[]} records - Array of eligibility records
 * @returns {string} CSV string
 */
function buildCSVExport(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  const headers = [
    'Record ID',
    'Member ID',
    'Status',
    'Eligible',
    'Priority Condition',
    'Priority Category',
    'Valid Codes',
    'Invalid Codes',
    'Ineligible Codes',
    'Effective Date',
    'Retro Date',
    'Re-Verification Required',
    'Re-Verification Due Date',
    'Performed By',
    'Created At',
  ];

  const rows = records.map((record) => [
    record.id || '',
    record.memberId || '',
    record.status || '',
    record.eligible ? 'Yes' : 'No',
    record.priorityCondition || '',
    record.priorityCategory || '',
    Array.isArray(record.validCodes) ? record.validCodes.join('; ') : '',
    Array.isArray(record.invalidCodes) ? record.invalidCodes.join('; ') : '',
    Array.isArray(record.ineligibleCodes) ? record.ineligibleCodes.join('; ') : '',
    record.effectiveDate || '',
    record.retroDate || '',
    record.annualReverificationRequired ? 'Yes' : 'No',
    record.reverificationDueDate || '',
    record.performedBy || '',
    record.createdAt || '',
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
    console.error('EligibilityHistory: failed to download file:', err);
  }
}

/**
 * Detail modal for a single eligibility record.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.record - The eligibility record to display
 * @returns {React.ReactElement|null}
 */
function EligibilityDetailModal({ isOpen, onClose, record }) {
  if (!record) {
    return null;
  }

  const validCodes = Array.isArray(record.validCodes) ? record.validCodes : [];
  const invalidCodes = Array.isArray(record.invalidCodes) ? record.invalidCodes : [];
  const ineligibleCodes = Array.isArray(record.ineligibleCodes) ? record.ineligibleCodes : [];
  const allValidatedCodes = Array.isArray(record.validatedCodes) ? record.validatedCodes : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Eligibility Record Details"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${record.eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={STATUS_BADGE_MAP[record.status] || 'pending'}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">
                {record.eligible ? 'Eligible for C-SNP' : 'Not Eligible for C-SNP'}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(record.createdAt)}
            </span>
          </div>
        </div>

        {/* Record Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Record ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={record.id}>
              {record.id ? record.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={record.memberId}>
              {record.memberId ? record.memberId.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Effective Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.effectiveDate ? formatDate(record.effectiveDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Retro Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.retroDate ? formatDate(record.retroDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Performed By</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.performedBy || 'System'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Validated At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.createdAt ? formatDateTime(record.createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* Priority Condition */}
        {record.priorityCondition && (
          <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
            <div className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-csnp-primary flex-shrink-0"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-csnp-primary">
                  Priority Condition: {record.priorityCondition}
                </p>
                {record.priorityCategory && (
                  <p className="text-xs text-csnp-blue-700">
                    {CONDITION_CATEGORY_LABELS[record.priorityCategory] || toTitleCase(record.priorityCategory)}
                  </p>
                )}
                {(() => {
                  const entry = getCodeByICD10(record.priorityCondition);
                  if (entry) {
                    return (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {entry.description}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Re-Verification Status */}
        {record.annualReverificationRequired && (
          <Alert
            variant="warning"
            title="Annual Re-Verification Required"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            {record.reverificationDueDate
              ? `Re-verification is due by ${formatDate(record.reverificationDueDate)}.`
              : 'Annual re-verification of chronic condition diagnosis is required.'}
          </Alert>
        )}

        {/* Code Classification */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Code Classification ({allValidatedCodes.length} total)
          </p>

          {/* Valid Codes */}
          {validCodes.length > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs font-semibold text-green-800 mb-1.5">
                CSNP Eligible ({validCodes.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {validCodes.map((code) => {
                  const entry = getCodeByICD10(code);
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 border border-green-200"
                      title={entry ? entry.description : code}
                    >
                      {code}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ineligible Codes */}
          {ineligibleCodes.length > 0 && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs font-semibold text-yellow-800 mb-1.5">
                Not CSNP Eligible ({ineligibleCodes.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ineligibleCodes.map((code) => {
                  const entry = getCodeByICD10(code);
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700 border border-yellow-200"
                      title={entry ? entry.description : code}
                    >
                      {code}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invalid Codes */}
          {invalidCodes.length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs font-semibold text-red-800 mb-1.5">
                Unrecognized ({invalidCodes.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {invalidCodes.map((code, idx) => (
                  <span
                    key={`${code}-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 border border-red-200"
                  >
                    {code || '(empty)'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* No codes at all */}
          {validCodes.length === 0 && ineligibleCodes.length === 0 && invalidCodes.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">
              No codes were classified.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

EligibilityDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  record: PropTypes.object,
};

EligibilityDetailModal.defaultProps = {
  record: null,
};

/**
 * Eligibility history table component for a member.
 * Shows all past eligibility checks with dates, ICD-10 codes, results,
 * and re-verification status. Supports filtering and export.
 *
 * @param {Object} props
 * @param {string} props.memberId - The member ID to show history for
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Eligibility History'] - Section title
 * @param {boolean} [props.showExport=true] - Whether to show the export button
 * @param {boolean} [props.showReverificationStatus=true] - Whether to show re-verification status
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.initialPageSize=10] - Initial page size
 * @param {Function} [props.onRecordSelect] - Callback when a record is selected: (record) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function EligibilityHistory({
  memberId,
  showHeader = true,
  title = 'Eligibility History',
  showExport = true,
  showReverificationStatus = true,
  compact = false,
  initialPageSize = 10,
  onRecordSelect,
  className = '',
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reverification, setReverification] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  /**
   * Loads eligibility history for the member.
   */
  const loadHistory = useCallback(() => {
    if (typeof memberId !== 'string' || memberId.trim().length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const history = getEligibilityHistory(memberId.trim());
      setRecords(Array.isArray(history) ? history : []);

      if (showReverificationStatus) {
        const reverificationResult = checkAnnualReverification(memberId.trim());
        setReverification(reverificationResult);
      }
    } catch (err) {
      console.error('EligibilityHistory: failed to load history:', err);
      setError('Unable to load eligibility history');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [memberId, showReverificationStatus]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /**
   * Filtered records based on status filter.
   */
  const filteredRecords = useMemo(() => {
    if (!statusFilter || statusFilter.trim().length === 0) {
      return records;
    }
    return records.filter((r) => r.status === statusFilter.trim());
  }, [records, statusFilter]);

  /**
   * Handles viewing a record's details.
   * @param {Object} record - The eligibility record
   */
  const handleViewDetails = useCallback((record) => {
    setSelectedRecord(record);
    setDetailModalOpen(true);

    if (typeof onRecordSelect === 'function') {
      onRecordSelect(record);
    }
  }, [onRecordSelect]);

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetail = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedRecord(null);
  }, []);

  /**
   * Handles exporting eligibility history as CSV.
   */
  const handleExportCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No eligibility records to export.');
      return;
    }

    try {
      const csv = buildCSVExport(filteredRecords);
      const filename = `eligibility_history_${memberId ? memberId.substring(0, 8) : 'unknown'}_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} eligibility record(s) to CSV.`);
    } catch (err) {
      console.error('EligibilityHistory: export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting eligibility history.');
    }
  }, [filteredRecords, memberId, addNotification]);

  /**
   * Handles exporting eligibility history as JSON.
   */
  const handleExportJSON = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No eligibility records to export.');
      return;
    }

    try {
      const payload = {
        memberId: memberId || null,
        exportedAt: new Date().toISOString(),
        totalRecords: filteredRecords.length,
        records: filteredRecords,
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `eligibility_history_${memberId ? memberId.substring(0, 8) : 'unknown'}_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} eligibility record(s) to JSON.`);
    } catch (err) {
      console.error('EligibilityHistory: JSON export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting eligibility history.');
    }
  }, [filteredRecords, memberId, addNotification]);

  /**
   * Handles status filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleStatusFilterChange = useCallback((e) => {
    setStatusFilter(e.target.value);
  }, []);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const total = records.length;
    const eligible = records.filter((r) => r.eligible === true).length;
    const ineligible = records.filter((r) => r.eligible === false).length;
    const pending = records.filter((r) => r.status === 'pending').length;
    const expired = records.filter((r) => r.status === 'expired').length;

    return { total, eligible, ineligible, pending, expired };
  }, [records]);

  /**
   * Table columns definition.
   */
  const columns = useMemo(() => {
    const cols = [
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        searchable: false,
        width: 'min-w-[120px]',
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
        key: 'status',
        label: 'Status',
        sortable: true,
        searchable: true,
        width: 'min-w-[100px]',
        render: (value) => {
          const badgeStatus = STATUS_BADGE_MAP[value] || 'pending';
          return (
            <StatusBadge
              status={badgeStatus}
              size="sm"
              showDot={true}
              bordered={true}
            />
          );
        },
      },
      {
        key: 'eligible',
        label: 'Result',
        sortable: true,
        searchable: false,
        width: 'min-w-[80px]',
        render: (value) => {
          return (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${value ? 'text-green-700' : 'text-red-700'}`}>
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${value ? 'bg-green-500' : 'bg-red-500'}`}
                aria-hidden="true"
              />
              {value ? 'Eligible' : 'Not Eligible'}
            </span>
          );
        },
      },
      {
        key: 'priorityCondition',
        label: 'Priority Condition',
        sortable: true,
        searchable: true,
        width: 'min-w-[140px]',
        render: (value, row) => {
          if (!value) {
            return <span className="text-gray-400">—</span>;
          }

          const entry = getCodeByICD10(value);
          const categoryLabel = row.priorityCategory
            ? (CONDITION_CATEGORY_LABELS[row.priorityCategory] || toTitleCase(row.priorityCategory))
            : null;

          return (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900">{value}</p>
              {entry && (
                <p className="text-[10px] text-gray-500 truncate max-w-[180px]" title={entry.description}>
                  {entry.description}
                </p>
              )}
              {categoryLabel && (
                <p className="text-[10px] text-csnp-primary-light truncate max-w-[180px]">
                  {categoryLabel}
                </p>
              )}
            </div>
          );
        },
      },
    ];

    if (!compact) {
      cols.push({
        key: 'validCodes',
        label: 'Valid Codes',
        sortable: false,
        searchable: false,
        width: 'min-w-[120px]',
        render: (value) => {
          if (!Array.isArray(value) || value.length === 0) {
            return <span className="text-gray-400">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {value.slice(0, 3).map((code) => (
                <span
                  key={code}
                  className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded"
                  title={(() => {
                    const e = getCodeByICD10(code);
                    return e ? e.description : code;
                  })()}
                >
                  {code}
                </span>
              ))}
              {value.length > 3 && (
                <span className="text-[10px] text-gray-400 self-center">
                  +{value.length - 3}
                </span>
              )}
            </div>
          );
        },
      });

      cols.push({
        key: 'annualReverificationRequired',
        label: 'Re-Verification',
        sortable: true,
        searchable: false,
        width: 'min-w-[110px]',
        render: (value, row) => {
          if (value === true) {
            return (
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" aria-hidden="true" />
                  Required
                </span>
                {row.reverificationDueDate && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Due: {formatDate(row.reverificationDueDate)}
                  </p>
                )}
              </div>
            );
          }
          return (
            <span className="text-[10px] text-gray-400">Not required</span>
          );
        },
      });
    }

    cols.push({
      key: 'effectiveDate',
      label: 'Effective Date',
      sortable: true,
      searchable: false,
      width: 'min-w-[100px]',
      render: (value) => {
        if (!value) {
          return <span className="text-gray-400">—</span>;
        }
        return <span className="text-xs text-gray-700">{formatDate(value)}</span>;
      },
    });

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
  const hasMemberId = typeof memberId === 'string' && memberId.trim().length > 0;

  const containerClassName = [
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (!hasMemberId) {
    return (
      <div className={containerClassName} {...rest}>
        <EmptyState
          title="No Member Selected"
          description="Select a member to view their eligibility history."
          iconType="no-data"
          size="sm"
        />
      </div>
    );
  }

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasTitle && (
                <h3 className="text-lg font-semibold text-csnp-primary">
                  {title}
                </h3>
              )}
              {!loading && records.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {records.length} record{records.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                aria-label="Filter by status"
              >
                <option value="">All Statuses</option>
                <option value="eligible">Eligible</option>
                <option value="ineligible">Ineligible</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
              </select>

              {/* Export Buttons */}
              {showExport && !loading && records.length > 0 && (
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
                onClick={loadHistory}
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
            </div>
          </div>

          {/* Summary Stats */}
          {!loading && !error && records.length > 0 && !compact && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-green-700">
                  {stats.eligible} eligible
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-red-700">
                  {stats.ineligible} ineligible
                </span>
              </div>
              {stats.pending > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-yellow-700">
                    {stats.pending} pending
                  </span>
                </div>
              )}
              {stats.expired > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-orange-700">
                    {stats.expired} expired
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Re-Verification Alert */}
      {showReverificationStatus && !loading && reverification && reverification.required && (
        <Alert
          variant="warning"
          title="Annual Re-Verification Required"
          showIcon={true}
          bordered={true}
          size="sm"
          className="mb-4"
        >
          {reverification.dueDate
            ? reverification.daysUntilDue !== null && reverification.daysUntilDue < 0
              ? `Re-verification is overdue. Was due by ${formatDate(reverification.dueDate)} (${Math.abs(reverification.daysUntilDue)} day${Math.abs(reverification.daysUntilDue) !== 1 ? 's' : ''} overdue).`
              : `Re-verification is due by ${formatDate(reverification.dueDate)} (${reverification.daysUntilDue} day${reverification.daysUntilDue !== 1 ? 's' : ''} remaining).`
            : 'Annual re-verification of chronic condition diagnosis is required per CMS regulations.'}
          {reverification.lastValidation && (
            <span className="block mt-1 text-xs opacity-80">
              Last validation: {formatRelativeTime(reverification.lastValidation)}
            </span>
          )}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <LoadingSpinner
          size="md"
          variant="primary"
          text="Loading eligibility history..."
        />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load eligibility history"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadHistory}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && records.length === 0 && (
        <EmptyState
          title="No Eligibility History"
          description="No eligibility validations have been performed for this member yet."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Filtered Empty State */}
      {!loading && !error && records.length > 0 && filteredRecords.length === 0 && (
        <EmptyState
          title="No Matching Records"
          description={`No eligibility records match the selected filter "${toTitleCase(statusFilter)}".`}
          iconType="no-results"
          size="sm"
          actionLabel="Clear Filter"
          onAction={() => setStatusFilter('')}
          actionVariant="outline"
        />
      )}

      {/* Data Table */}
      {!loading && !error && filteredRecords.length > 0 && (
        <DataTable
          data={filteredRecords}
          columns={columns}
          actions={actions}
          loading={false}
          searchable={!compact}
          searchPlaceholder="Search by condition, status..."
          paginated={true}
          initialPageSize={initialPageSize}
          initialSortField="createdAt"
          initialSortDirection="desc"
          emptyMessage="No eligibility records found"
          emptyDescription="No records match the current search criteria."
          idKey="id"
          onRowClick={handleViewDetails}
          className=""
        />
      )}

      {/* Detail Modal */}
      <EligibilityDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        record={selectedRecord}
      />
    </div>
  );
}

EligibilityHistory.propTypes = {
  memberId: PropTypes.string.isRequired,
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showExport: PropTypes.bool,
  showReverificationStatus: PropTypes.bool,
  compact: PropTypes.bool,
  initialPageSize: PropTypes.number,
  onRecordSelect: PropTypes.func,
  className: PropTypes.string,
};

EligibilityHistory.defaultProps = {
  showHeader: true,
  title: 'Eligibility History',
  showExport: true,
  showReverificationStatus: true,
  compact: false,
  initialPageSize: 10,
  onRecordSelect: undefined,
  className: '',
};