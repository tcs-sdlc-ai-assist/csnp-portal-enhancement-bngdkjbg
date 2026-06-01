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
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import { checkAnnualReverification, validateMemberEligibility, getEligibilityHistory } from '../../services/eligibilityService.js';
import { getCodeByICD10, CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { formatDate, formatRelativeTime, formatDateTime, toTitleCase, calculateAge } from '../../utils/helpers.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Re-verification status style mappings.
 * @type {Object.<string, { bg: string, text: string, border: string, dot: string, label: string }>}
 */
const REVERIFICATION_STATUS_STYLES = {
  overdue: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
    label: 'Overdue',
  },
  due_soon: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
    label: 'Due Soon',
  },
  upcoming: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    label: 'Upcoming',
  },
  completed: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    dot: 'bg-green-500',
    label: 'Completed',
  },
  not_required: {
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    border: 'border-gray-200',
    dot: 'bg-gray-400',
    label: 'Not Required',
  },
};

/**
 * Determines the re-verification urgency status from reverification data.
 * @param {Object} reverification - The reverification check result
 * @returns {string} Status key
 */
function getReverificationStatus(reverification) {
  if (!reverification || typeof reverification !== 'object') {
    return 'not_required';
  }

  if (!reverification.required) {
    return 'not_required';
  }

  if (reverification.daysUntilDue !== null && reverification.daysUntilDue !== undefined) {
    if (reverification.daysUntilDue < 0) {
      return 'overdue';
    }
    if (reverification.daysUntilDue <= 14) {
      return 'due_soon';
    }
    if (reverification.daysUntilDue <= 30) {
      return 'upcoming';
    }
  }

  return 'due_soon';
}

/**
 * Builds a CSV string from re-verification records.
 * @param {Object[]} records - Array of re-verification member records
 * @returns {string} CSV string
 */
function buildCSVExport(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  const headers = [
    'Member ID',
    'First Name',
    'Last Name',
    'Date of Birth',
    'Condition Category',
    'Diagnosis Codes',
    'Re-Verification Status',
    'Due Date',
    'Days Until Due',
    'Last Validation',
  ];

  const rows = records.map((record) => [
    record.id || '',
    record.firstName || '',
    record.lastName || '',
    record.dateOfBirth || '',
    record.conditionCategoryLabel || record.conditionCategory || '',
    Array.isArray(record.diagnosisCodes) ? record.diagnosisCodes.join('; ') : '',
    record.reverificationStatusLabel || '',
    record.reverificationDueDate || '',
    record.daysUntilDue !== null && record.daysUntilDue !== undefined ? String(record.daysUntilDue) : '',
    record.lastValidation || '',
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
    console.error('ReverificationPanel: failed to download file:', err);
  }
}

/**
 * Re-verification result detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.result - The re-verification result to display
 * @param {Object|null} props.member - The member object
 * @returns {React.ReactElement|null}
 */
function ReverificationResultModal({ isOpen, onClose, result, member }) {
  if (!result || !member) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Re-Verification Result"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${result.eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={result.eligible ? 'eligible' : 'ineligible'}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">
                {result.eligible ? 'Re-Verification Passed' : 'Re-Verification Failed'}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(result.timestamp)}
            </span>
          </div>
        </div>

        {/* Member Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {member.firstName} {member.lastName}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={member.id}>
              {member.id ? member.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Condition Category</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {member.conditionCategory
                ? (CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory))
                : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Validated At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {result.timestamp ? formatDateTime(result.timestamp) : '—'}
            </p>
          </div>
        </div>

        {/* Priority Condition */}
        {result.priorityCondition && (
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
                  Priority Condition: {result.priorityCondition}
                </p>
                {result.priorityCategoryLabel && (
                  <p className="text-xs text-csnp-blue-700">
                    {result.priorityCategoryLabel}
                  </p>
                )}
                {(() => {
                  const entry = getCodeByICD10(result.priorityCondition);
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

        {/* Code Classification */}
        {result.validationDetails && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Code Classification
            </p>

            {/* Valid Codes */}
            {Array.isArray(result.validationDetails.validCodes) && result.validationDetails.validCodes.length > 0 && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs font-semibold text-green-800 mb-1.5">
                  CSNP Eligible ({result.validationDetails.validCodes.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.validationDetails.validCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ineligible Codes */}
            {Array.isArray(result.validationDetails.ineligibleCodes) && result.validationDetails.ineligibleCodes.length > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs font-semibold text-yellow-800 mb-1.5">
                  Not CSNP Eligible ({result.validationDetails.ineligibleCodes.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.validationDetails.ineligibleCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700 rounded"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Invalid Codes */}
            {Array.isArray(result.validationDetails.invalidCodes) && result.validationDetails.invalidCodes.length > 0 && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs font-semibold text-red-800 mb-1.5">
                  Unrecognized ({result.validationDetails.invalidCodes.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.validationDetails.invalidCodes.map((code, idx) => (
                    <span
                      key={`${code}-${idx}`}
                      className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded"
                    >
                      {code || '(empty)'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Not Eligible Explanation */}
        {!result.eligible && (
          <Alert
            variant="error"
            title="Re-Verification Failed"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            <p>
              The member's diagnosis codes no longer meet C-SNP eligibility requirements.
              Please review the member's current conditions and update diagnosis codes if needed.
            </p>
          </Alert>
        )}
      </div>
    </Modal>
  );
}

ReverificationResultModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  result: PropTypes.object,
  member: PropTypes.object,
};

ReverificationResultModal.defaultProps = {
  result: null,
  member: null,
};

/**
 * Skeleton loading state for the reverification panel.
 * @returns {React.ReactElement}
 */
function ReverificationPanelSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-48 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Annual eligibility re-verification panel component.
 * Lists members due for re-verification, allows batch processing,
 * shows re-verification status and results.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Annual Re-Verification'] - Section title
 * @param {boolean} [props.showExport=true] - Whether to show the export button
 * @param {boolean} [props.showBatchActions=true] - Whether to show batch action buttons
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.initialPageSize=10] - Initial page size
 * @param {string} [props.statusFilter] - Pre-set status filter ('overdue', 'due_soon', 'upcoming', 'all')
 * @param {number} [props.refreshInterval=0] - Auto-refresh interval in milliseconds (0 = no auto-refresh)
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function ReverificationPanel({
  showHeader = true,
  title = 'Annual Re-Verification',
  showExport = true,
  showBatchActions = true,
  compact = false,
  initialPageSize = 10,
  statusFilter: initialStatusFilter,
  refreshInterval = 0,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [members, setMembers] = useState([]);
  const [reverificationData, setReverificationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilterValue, setStatusFilterValue] = useState(initialStatusFilter || 'all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [processingMemberId, setProcessingMemberId] = useState(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);

  /**
   * Loads members and their re-verification status.
   */
  const loadReverificationData = useCallback(() => {
    setError(null);

    try {
      const storedMembers = localStorage.getItem('csnp_members');
      if (!storedMembers) {
        setMembers([]);
        setReverificationData([]);
        setLoading(false);
        return;
      }

      const parsedMembers = JSON.parse(storedMembers);
      if (!Array.isArray(parsedMembers)) {
        setMembers([]);
        setReverificationData([]);
        setLoading(false);
        return;
      }

      setMembers(parsedMembers);

      const enrichedData = [];

      for (const member of parsedMembers) {
        if (!member || !member.id) {
          continue;
        }

        const reverification = checkAnnualReverification(member.id);
        const reverificationStatus = getReverificationStatus(reverification);
        const statusStyle = REVERIFICATION_STATUS_STYLES[reverificationStatus] || REVERIFICATION_STATUS_STYLES.not_required;

        enrichedData.push({
          ...member,
          reverification,
          reverificationStatus,
          reverificationStatusLabel: statusStyle.label,
          reverificationDueDate: reverification ? reverification.dueDate : null,
          daysUntilDue: reverification ? reverification.daysUntilDue : null,
          lastValidation: reverification ? reverification.lastValidation : null,
          reverificationRequired: reverification ? reverification.required : false,
          conditionCategoryLabel: member.conditionCategory
            ? (CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory))
            : '',
          age: member.dateOfBirth ? calculateAge(member.dateOfBirth) : null,
        });
      }

      // Sort by urgency: overdue first, then due_soon, then upcoming
      const statusOrder = { overdue: 0, due_soon: 1, upcoming: 2, not_required: 3, completed: 4 };
      enrichedData.sort((a, b) => {
        const orderA = statusOrder[a.reverificationStatus] !== undefined ? statusOrder[a.reverificationStatus] : 99;
        const orderB = statusOrder[b.reverificationStatus] !== undefined ? statusOrder[b.reverificationStatus] : 99;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // Secondary sort by days until due (ascending)
        const daysA = a.daysUntilDue !== null && a.daysUntilDue !== undefined ? a.daysUntilDue : 9999;
        const daysB = b.daysUntilDue !== null && b.daysUntilDue !== undefined ? b.daysUntilDue : 9999;
        return daysA - daysB;
      });

      setReverificationData(enrichedData);
    } catch (err) {
      console.error('ReverificationPanel: failed to load re-verification data:', err);
      setError('Unable to load re-verification data');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadReverificationData();
  }, [loadReverificationData]);

  /**
   * Auto-refresh interval.
   */
  useEffect(() => {
    if (typeof refreshInterval !== 'number' || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      loadReverificationData();
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshInterval, loadReverificationData]);

  /**
   * Filtered data based on status filter.
   */
  const filteredData = useMemo(() => {
    if (!statusFilterValue || statusFilterValue === 'all') {
      return reverificationData;
    }

    if (statusFilterValue === 'required') {
      return reverificationData.filter((m) => m.reverificationRequired);
    }

    return reverificationData.filter((m) => m.reverificationStatus === statusFilterValue);
  }, [reverificationData, statusFilterValue]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const total = reverificationData.length;
    const overdue = reverificationData.filter((m) => m.reverificationStatus === 'overdue').length;
    const dueSoon = reverificationData.filter((m) => m.reverificationStatus === 'due_soon').length;
    const upcoming = reverificationData.filter((m) => m.reverificationStatus === 'upcoming').length;
    const notRequired = reverificationData.filter((m) => m.reverificationStatus === 'not_required').length;
    const required = reverificationData.filter((m) => m.reverificationRequired).length;

    return { total, overdue, dueSoon, upcoming, notRequired, required };
  }, [reverificationData]);

  /**
   * Handles processing re-verification for a single member.
   * @param {Object} member - The member object
   */
  const handleProcessSingle = useCallback((member) => {
    if (!member || !member.id) {
      return;
    }

    setProcessingMemberId(member.id);

    try {
      const performedBy = user ? user.id : 'system';
      const result = validateMemberEligibility(member.id, performedBy);

      setSelectedResult(result);
      setSelectedMember(member);
      setResultModalOpen(true);

      if (result.eligible) {
        addNotification(
          'success',
          'Re-Verification Passed',
          `Member ${member.firstName} ${member.lastName} has been re-verified. Eligibility confirmed.`
        );
      } else {
        addNotification(
          'warning',
          'Re-Verification Failed',
          `Member ${member.firstName} ${member.lastName} did not pass re-verification. Review required.`
        );
      }

      // Reload data to reflect updated status
      loadReverificationData();
    } catch (err) {
      console.error('ReverificationPanel: failed to process re-verification:', err);
      addNotification(
        'error',
        'Re-Verification Error',
        `An error occurred while processing re-verification for ${member.firstName} ${member.lastName}.`
      );
    } finally {
      setProcessingMemberId(null);
    }
  }, [user, addNotification, loadReverificationData]);

  /**
   * Handles batch processing of selected members.
   */
  const handleBatchProcess = useCallback(() => {
    if (selectedIds.length === 0) {
      addNotification('warning', 'No Members Selected', 'Please select at least one member for batch re-verification.');
      return;
    }

    setConfirmBatchOpen(true);
  }, [selectedIds, addNotification]);

  /**
   * Confirms and executes batch processing.
   */
  const handleConfirmBatch = useCallback(() => {
    setConfirmBatchOpen(false);
    setBatchProcessing(true);

    try {
      const performedBy = user ? user.id : 'system';
      let successCount = 0;
      let failCount = 0;

      for (const memberId of selectedIds) {
        try {
          const result = validateMemberEligibility(memberId, performedBy);
          if (result.eligible) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      addNotification(
        successCount > 0 && failCount === 0 ? 'success' : failCount > 0 && successCount === 0 ? 'error' : 'warning',
        'Batch Re-Verification Complete',
        `Processed ${selectedIds.length} member(s): ${successCount} passed, ${failCount} failed.`
      );

      setSelectedIds([]);
      loadReverificationData();
    } catch (err) {
      console.error('ReverificationPanel: batch processing failed:', err);
      addNotification(
        'error',
        'Batch Processing Error',
        'An unexpected error occurred during batch re-verification.'
      );
    } finally {
      setBatchProcessing(false);
    }
  }, [selectedIds, user, addNotification, loadReverificationData]);

  /**
   * Handles batch processing of all required members.
   */
  const handleProcessAllRequired = useCallback(() => {
    const requiredMembers = reverificationData.filter((m) => m.reverificationRequired);
    if (requiredMembers.length === 0) {
      addNotification('info', 'No Members Due', 'No members currently require re-verification.');
      return;
    }

    setSelectedIds(requiredMembers.map((m) => m.id));
    setConfirmBatchOpen(true);
  }, [reverificationData, addNotification]);

  /**
   * Handles closing the result modal.
   */
  const handleCloseResultModal = useCallback(() => {
    setResultModalOpen(false);
    setSelectedResult(null);
    setSelectedMember(null);
  }, []);

  /**
   * Handles status filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleStatusFilterChange = useCallback((e) => {
    setStatusFilterValue(e.target.value);
  }, []);

  /**
   * Handles exporting re-verification data as CSV.
   */
  const handleExportCSV = useCallback(() => {
    if (filteredData.length === 0) {
      addNotification('warning', 'No Data', 'No re-verification records to export.');
      return;
    }

    try {
      const csv = buildCSVExport(filteredData);
      const filename = `reverification_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Export Complete', `Exported ${filteredData.length} re-verification record(s) to CSV.`);
    } catch (err) {
      console.error('ReverificationPanel: export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting re-verification data.');
    }
  }, [filteredData, addNotification]);

  /**
   * Table columns definition.
   */
  const columns = useMemo(() => {
    const cols = [
      {
        key: 'lastName',
        label: 'Member',
        sortable: true,
        searchable: true,
        width: 'min-w-[160px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900">
                {row.firstName} {row.lastName}
              </p>
              <p className="text-[10px] text-gray-500 truncate" title={row.id}>
                {row.id ? row.id.substring(0, 12) + '…' : '—'}
              </p>
            </div>
          );
        },
      },
      {
        key: 'conditionCategoryLabel',
        label: 'Condition',
        sortable: true,
        searchable: true,
        width: 'min-w-[140px]',
        render: (value, row) => {
          if (!value) {
            return <span className="text-gray-400">—</span>;
          }
          return (
            <div className="min-w-0">
              <p className="text-xs text-gray-700 truncate max-w-[160px]" title={value}>
                {value}
              </p>
              {Array.isArray(row.diagnosisCodes) && row.diagnosisCodes.length > 0 && (
                <p className="text-[10px] text-gray-400">
                  {row.diagnosisCodes.length} code{row.diagnosisCodes.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          );
        },
      },
      {
        key: 'reverificationStatus',
        label: 'Status',
        sortable: true,
        searchable: false,
        width: 'min-w-[110px]',
        render: (value) => {
          const style = REVERIFICATION_STATUS_STYLES[value] || REVERIFICATION_STATUS_STYLES.not_required;
          return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.text} border ${style.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} aria-hidden="true" />
              {style.label}
            </span>
          );
        },
      },
      {
        key: 'reverificationDueDate',
        label: 'Due Date',
        sortable: true,
        searchable: false,
        width: 'min-w-[110px]',
        render: (value, row) => {
          if (!value) {
            return <span className="text-gray-400">—</span>;
          }

          const isOverdue = row.daysUntilDue !== null && row.daysUntilDue < 0;
          const isDueSoon = row.daysUntilDue !== null && row.daysUntilDue >= 0 && row.daysUntilDue <= 14;

          return (
            <div>
              <p className={`text-xs font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-700'}`}>
                {formatDate(value)}
              </p>
              {row.daysUntilDue !== null && row.daysUntilDue !== undefined && (
                <p className={`text-[10px] ${isOverdue ? 'text-red-500' : isDueSoon ? 'text-yellow-500' : 'text-gray-400'}`}>
                  {isOverdue
                    ? `${Math.abs(row.daysUntilDue)} day${Math.abs(row.daysUntilDue) !== 1 ? 's' : ''} overdue`
                    : `${row.daysUntilDue} day${row.daysUntilDue !== 1 ? 's' : ''} remaining`}
                </p>
              )}
            </div>
          );
        },
      },
    ];

    if (!compact) {
      cols.push({
        key: 'lastValidation',
        label: 'Last Validation',
        sortable: true,
        searchable: false,
        width: 'min-w-[110px]',
        render: (value) => {
          if (!value) {
            return <span className="text-gray-400">Never</span>;
          }
          return (
            <div>
              <p className="text-xs text-gray-700">{formatDate(value)}</p>
              <p className="text-[10px] text-gray-400">{formatRelativeTime(value)}</p>
            </div>
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
        label: 'Verify',
        onClick: (row) => handleProcessSingle(row),
        variant: 'primary',
        size: 'sm',
        visible: (row) => row.reverificationRequired,
        disabled: (row) => processingMemberId === row.id,
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
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: 'View',
        onClick: (row) => {
          const history = getEligibilityHistory(row.id);
          if (history.length > 0) {
            setSelectedResult({
              eligible: history[0].eligible,
              priorityCondition: history[0].priorityCondition,
              priorityCategory: history[0].priorityCategory,
              priorityCategoryLabel: history[0].priorityCategory
                ? (CONDITION_CATEGORY_LABELS[history[0].priorityCategory] || toTitleCase(history[0].priorityCategory))
                : null,
              validationDetails: {
                validCodes: history[0].validCodes || [],
                invalidCodes: history[0].invalidCodes || [],
                ineligibleCodes: history[0].ineligibleCodes || [],
              },
              timestamp: history[0].createdAt,
            });
            setSelectedMember(row);
            setResultModalOpen(true);
          } else {
            addNotification('info', 'No History', `No eligibility validation history found for ${row.firstName} ${row.lastName}.`);
          }
        },
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
  }, [handleProcessSingle, processingMemberId, addNotification]);

  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  const containerClassName = [
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Re-verification icon */}
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
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
              </div>
              {hasTitle && (
                <h3 className="text-lg font-semibold text-csnp-primary">
                  {title}
                </h3>
              )}
              {!loading && stats.required > 0 && (
                <span className="text-[10px] font-medium text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded-full border border-yellow-200">
                  {stats.required} due
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Status Filter */}
              <select
                value={statusFilterValue}
                onChange={handleStatusFilterChange}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                aria-label="Filter by re-verification status"
              >
                <option value="all">All Members</option>
                <option value="required">All Required</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due Soon</option>
                <option value="upcoming">Upcoming</option>
                <option value="not_required">Not Required</option>
              </select>

              {/* Batch Process All Required */}
              {showBatchActions && isAuthenticated && !loading && stats.required > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleProcessAllRequired}
                  loading={batchProcessing}
                  loadingText="Processing..."
                  disabled={batchProcessing}
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
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  Verify All Due
                </Button>
              )}

              {/* Batch Process Selected */}
              {showBatchActions && isAuthenticated && selectedIds.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchProcess}
                  loading={batchProcessing}
                  loadingText="Processing..."
                  disabled={batchProcessing}
                >
                  Verify Selected ({selectedIds.length})
                </Button>
              )}

              {/* Export */}
              {showExport && !loading && filteredData.length > 0 && (
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
                  Export
                </Button>
              )}

              {/* Refresh */}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadReverificationData}
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
          {!loading && !error && !compact && reverificationData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Overdue</p>
                <p className={`text-lg font-bold ${stats.overdue > 0 ? 'text-red-700' : 'text-red-400'}`}>
                  {stats.overdue}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Due Soon</p>
                <p className={`text-lg font-bold ${stats.dueSoon > 0 ? 'text-yellow-700' : 'text-yellow-400'}`}>
                  {stats.dueSoon}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Upcoming</p>
                <p className="text-lg font-bold text-blue-700">
                  {stats.upcoming}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Not Required</p>
                <p className="text-lg font-bold text-gray-700">
                  {stats.notRequired}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overdue Alert */}
      {!loading && !error && stats.overdue > 0 && (
        <Alert
          variant="error"
          title={`${stats.overdue} Member${stats.overdue !== 1 ? 's' : ''} Overdue for Re-Verification`}
          showIcon={true}
          bordered={true}
          size="sm"
          className="mb-4"
        >
          CMS requires annual re-verification of chronic condition diagnosis for all C-SNP members.
          {stats.overdue === 1
            ? ' 1 member is past their re-verification due date.'
            : ` ${stats.overdue} members are past their re-verification due dates.`}
          {' '}Please process re-verifications promptly to maintain compliance.
        </Alert>
      )}

      {/* Due Soon Warning */}
      {!loading && !error && stats.overdue === 0 && stats.dueSoon > 0 && (
        <Alert
          variant="warning"
          title={`${stats.dueSoon} Member${stats.dueSoon !== 1 ? 's' : ''} Due for Re-Verification Soon`}
          showIcon={true}
          bordered={true}
          size="sm"
          className="mb-4"
        >
          {stats.dueSoon === 1
            ? '1 member has a re-verification due within the next 14 days.'
            : `${stats.dueSoon} members have re-verifications due within the next 14 days.`}
          {' '}Schedule re-verifications to avoid compliance issues.
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <ReverificationPanelSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load re-verification data"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadReverificationData}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && reverificationData.length === 0 && (
        <EmptyState
          title="No Members Found"
          description="No members are available for re-verification. Members will appear here once they are enrolled in C-SNP plans."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Filtered Empty State */}
      {!loading && !error && reverificationData.length > 0 && filteredData.length === 0 && (
        <EmptyState
          title="No Matching Members"
          description={`No members match the selected filter "${statusFilterValue === 'required' ? 'All Required' : (REVERIFICATION_STATUS_STYLES[statusFilterValue] ? REVERIFICATION_STATUS_STYLES[statusFilterValue].label : statusFilterValue)}".`}
          iconType="no-results"
          size="sm"
          actionLabel="Clear Filter"
          onAction={() => setStatusFilterValue('all')}
          actionVariant="outline"
        />
      )}

      {/* Data Table */}
      {!loading && !error && filteredData.length > 0 && (
        <DataTable
          data={filteredData}
          columns={columns}
          actions={actions}
          loading={false}
          selectable={showBatchActions}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          idKey="id"
          searchable={!compact}
          searchPlaceholder="Search by name, condition..."
          paginated={true}
          initialPageSize={initialPageSize}
          initialSortField="reverificationDueDate"
          initialSortDirection="asc"
          emptyMessage="No members found"
          emptyDescription="No members match the current search criteria."
          className=""
        />
      )}

      {/* CMS Compliance Notice */}
      {!loading && !error && !compact && reverificationData.length > 0 && (
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
              <span className="font-semibold">CMS Requirement:</span>{' '}
              Annual re-verification of chronic condition diagnosis is required for all C-SNP enrolled members
              per 42 CFR §422.52. Members must have their qualifying chronic condition confirmed annually
              to maintain C-SNP enrollment eligibility. Failure to complete re-verification may result in
              disenrollment and compliance findings.
            </p>
          </div>
        </div>
      )}

      {/* Result Modal */}
      <ReverificationResultModal
        isOpen={resultModalOpen}
        onClose={handleCloseResultModal}
        result={selectedResult}
        member={selectedMember}
      />

      {/* Batch Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmBatchOpen}
        onClose={() => setConfirmBatchOpen(false)}
        onConfirm={handleConfirmBatch}
        title="Confirm Batch Re-Verification"
        message={`Are you sure you want to process re-verification for ${selectedIds.length} member${selectedIds.length !== 1 ? 's' : ''}? This will validate each member's current diagnosis codes against C-SNP eligibility requirements.`}
        confirmText="Process All"
        cancelText="Cancel"
        variant="info"
        confirmLoading={batchProcessing}
      />
    </div>
  );
}

ReverificationPanel.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showExport: PropTypes.bool,
  showBatchActions: PropTypes.bool,
  compact: PropTypes.bool,
  initialPageSize: PropTypes.number,
  statusFilter: PropTypes.string,
  refreshInterval: PropTypes.number,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

ReverificationPanel.defaultProps = {
  showHeader: true,
  title: 'Annual Re-Verification',
  showExport: true,
  showBatchActions: true,
  compact: false,
  initialPageSize: 10,
  statusFilter: undefined,
  refreshInterval: 0,
  className: '',
  headerActions: null,
};