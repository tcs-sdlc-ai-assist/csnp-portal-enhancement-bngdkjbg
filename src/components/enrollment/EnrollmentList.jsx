import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import DataTable from '../common/DataTable.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import Modal from '../common/Modal.jsx';
import { getAllEnrollmentRecords, getEnrollmentStats } from '../../services/enrollmentService.js';
import { formatDate, formatRelativeTime, formatDateTime, toTitleCase, formatCurrency } from '../../utils/helpers.js';
import { getCodeByICD10, CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import {
  ENROLLMENT_STATUSES,
  ENROLLMENT_CHANNELS,
  ENROLLMENT_CHANNEL_LABELS,
  PLAN_TYPE_LABELS,
} from '../../utils/constants.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Status to StatusBadge status mapping.
 * @type {Object.<string, string>}
 */
const STATUS_BADGE_MAP = {
  [ENROLLMENT_STATUSES.PENDING]: 'pending',
  [ENROLLMENT_STATUSES.APPROVED]: 'approved',
  [ENROLLMENT_STATUSES.REJECTED]: 'rejected',
  [ENROLLMENT_STATUSES.CANCELLED]: 'cancelled',
  [ENROLLMENT_STATUSES.ACTIVE]: 'active',
  [ENROLLMENT_STATUSES.DISENROLLED]: 'disenrolled',
};

/**
 * Status filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: ENROLLMENT_STATUSES.PENDING, label: 'Pending' },
  { value: ENROLLMENT_STATUSES.APPROVED, label: 'Approved' },
  { value: ENROLLMENT_STATUSES.ACTIVE, label: 'Active' },
  { value: ENROLLMENT_STATUSES.REJECTED, label: 'Rejected' },
  { value: ENROLLMENT_STATUSES.CANCELLED, label: 'Cancelled' },
  { value: ENROLLMENT_STATUSES.DISENROLLED, label: 'Disenrolled' },
];

/**
 * Channel filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const CHANNEL_FILTER_OPTIONS = [
  { value: '', label: 'All Channels' },
  ...Object.entries(ENROLLMENT_CHANNEL_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

/**
 * Builds a CSV string from enrollment records.
 * @param {Object[]} records - Array of enrollment records
 * @param {Object[]} members - Array of member objects
 * @returns {string} CSV string
 */
function buildCSVExport(records, members) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  const headers = [
    'Enrollment ID',
    'Member ID',
    'Member Name',
    'Plan Type',
    'Status',
    'Channel',
    'Effective Date',
    'Application Date',
    'Approval Date',
    'Termination Date',
    'Diagnosis Codes',
    'Processed By',
    'Notes',
    'Created At',
  ];

  const rows = records.map((record) => {
    const member = Array.isArray(members)
      ? members.find((m) => m.id === record.memberId)
      : null;
    const memberName = member
      ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
      : record.memberId || '';

    return [
      record.id || '',
      record.memberId || '',
      memberName,
      record.planType || '',
      record.status || '',
      ENROLLMENT_CHANNEL_LABELS[record.channel] || record.channel || '',
      record.effectiveDate || '',
      record.applicationDate || '',
      record.approvalDate || '',
      record.terminationDate || '',
      Array.isArray(record.diagnosisCodesVerified) ? record.diagnosisCodesVerified.join('; ') : '',
      record.processedBy || '',
      record.notes || '',
      record.createdAt || '',
    ];
  });

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
    console.error('EnrollmentList: failed to download file:', err);
  }
}

/**
 * Enrollment detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.record - The enrollment record to display
 * @param {Object|null} props.member - The member object
 * @returns {React.ReactElement|null}
 */
function EnrollmentDetailModal({ isOpen, onClose, record, member }) {
  if (!record) {
    return null;
  }

  const diagnosisCodes = Array.isArray(record.diagnosisCodesVerified)
    ? record.diagnosisCodesVerified
    : [];

  const memberName = member
    ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
    : record.memberId || '—';

  const channelLabel = ENROLLMENT_CHANNEL_LABELS[record.channel] || toTitleCase(record.channel || '');
  const planTypeLabel = PLAN_TYPE_LABELS[record.planType] || record.planType || '—';
  const badgeStatus = STATUS_BADGE_MAP[record.status] || 'pending';

  const hasCMSResponse = record.trrResponse && typeof record.trrResponse === 'object';
  const hasIKASubmission = record.ikaSubmission && typeof record.ikaSubmission === 'object';
  const hasVCCValidation = record.vccValidation && typeof record.vccValidation === 'object';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enrollment Details"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${
          record.status === ENROLLMENT_STATUSES.ACTIVE || record.status === ENROLLMENT_STATUSES.APPROVED
            ? 'bg-green-50 border-green-200'
            : record.status === ENROLLMENT_STATUSES.REJECTED
              ? 'bg-red-50 border-red-200'
              : record.status === ENROLLMENT_STATUSES.PENDING
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={badgeStatus}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">
                {toTitleCase(record.status || 'unknown')}
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
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Enrollment ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={record.id}>
              {record.id ? record.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5 truncate" title={memberName}>
              {memberName}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Plan Type</p>
            <p className="text-xs text-gray-700 mt-0.5">{planTypeLabel}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Channel</p>
            <p className="text-xs text-gray-700 mt-0.5">{channelLabel}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Effective Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.effectiveDate ? formatDate(record.effectiveDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Application Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.applicationDate ? formatDate(record.applicationDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Approval Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.approvalDate ? formatDate(record.approvalDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Termination Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.terminationDate ? formatDate(record.terminationDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Processed By</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.processedBy || 'System'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {record.createdAt ? formatDateTime(record.createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* Diagnosis Codes */}
        {diagnosisCodes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Verified Diagnosis Codes ({diagnosisCodes.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {diagnosisCodes.map((code) => {
                const entry = getCodeByICD10(code);
                return (
                  <span
                    key={code}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                      entry && entry.csnpEligible
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                    title={entry ? entry.description : code}
                  >
                    {code}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* CMS Response (TRR) */}
        {hasCMSResponse && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              CMS Response (TRR)
            </p>
            <div className={`p-3 rounded-lg border ${
              record.trrResponse.accepted
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${
                  record.trrResponse.accepted ? 'text-green-800' : 'text-red-800'
                }`}>
                  {record.trrResponse.accepted ? 'Accepted' : 'Rejected'}
                </span>
                {record.trrResponse.responseCode && (
                  <span className="text-[10px] font-mono text-gray-500">
                    {record.trrResponse.responseCode}
                  </span>
                )}
              </div>
              {record.trrResponse.responseMessage && (
                <p className="text-xs text-gray-600">
                  {record.trrResponse.responseMessage}
                </p>
              )}
            </div>
          </div>
        )}

        {/* IKA Submission */}
        {hasIKASubmission && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              CMS Submission (IKA)
            </p>
            <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
              <div className="grid grid-cols-2 gap-2">
                {record.ikaSubmission.transactionId && (
                  <div>
                    <p className="text-[10px] text-gray-400">Transaction ID</p>
                    <p className="text-xs font-mono text-gray-700 truncate" title={record.ikaSubmission.transactionId}>
                      {record.ikaSubmission.transactionId}
                    </p>
                  </div>
                )}
                {record.ikaSubmission.status && (
                  <div>
                    <p className="text-[10px] text-gray-400">Status</p>
                    <p className="text-xs text-gray-700">{toTitleCase(record.ikaSubmission.status)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VCC Validation */}
        {hasVCCValidation && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Document Validation (VCC)
            </p>
            <div className={`p-3 rounded-lg border ${
              record.vccValidation.valid
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <span className={`text-xs font-semibold ${
                record.vccValidation.valid ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {record.vccValidation.valid ? 'All Documents Valid' : 'Validation Issues Found'}
              </span>
              {Array.isArray(record.vccValidation.results) && record.vccValidation.results.length > 0 && (
                <div className="mt-2 space-y-1">
                  {record.vccValidation.results.map((result, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        result.valid ? 'bg-green-500' : 'bg-red-500'
                      }`} aria-hidden="true" />
                      <span className="text-gray-600 truncate">
                        {result.documentName}: {result.reason}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {record.notes && typeof record.notes === 'string' && record.notes.trim().length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Notes
            </p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {record.notes}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

EnrollmentDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  record: PropTypes.object,
  member: PropTypes.object,
};

EnrollmentDetailModal.defaultProps = {
  record: null,
  member: null,
};

/**
 * Enrollment records table component.
 * Displays all enrollments with member name, channel, status, submission date,
 * and CMS response. Supports search, filter by status/channel, and row click
 * for detail view.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Enrollments'] - Section title
 * @param {boolean} [props.showExport=true] - Whether to show the export button
 * @param {boolean} [props.showStats=true] - Whether to show summary statistics
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.initialPageSize=20] - Initial page size
 * @param {string} [props.filterStatus] - Pre-set status filter
 * @param {string} [props.filterChannel] - Pre-set channel filter
 * @param {string} [props.filterMemberId] - Pre-set member ID filter
 * @param {Function} [props.onRecordSelect] - Callback when a record is selected: (record) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function EnrollmentList({
  showHeader = true,
  title = 'Enrollments',
  showExport = true,
  showStats = true,
  compact = false,
  initialPageSize = 20,
  filterStatus: initialFilterStatus,
  filterChannel: initialFilterChannel,
  filterMemberId,
  onRecordSelect,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  const [enrollments, setEnrollments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialFilterStatus || '');
  const [channelFilter, setChannelFilter] = useState(initialFilterChannel || '');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  /**
   * Loads enrollment records and members from localStorage.
   */
  const loadData = useCallback(() => {
    setError(null);
    setLoading(true);

    try {
      const allEnrollments = getAllEnrollmentRecords();
      setEnrollments(Array.isArray(allEnrollments) ? allEnrollments : []);

      try {
        const storedMembers = localStorage.getItem('csnp_members');
        if (storedMembers) {
          const parsed = JSON.parse(storedMembers);
          if (Array.isArray(parsed)) {
            setMembers(parsed);
          }
        }
      } catch {
        // Silently fail — member names will fall back to IDs
      }
    } catch (err) {
      console.error('EnrollmentList: failed to load data:', err);
      setError('Unable to load enrollment records');
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Enriched enrollment records with member names.
   */
  const enrichedEnrollments = useMemo(() => {
    return enrollments.map((enrollment) => {
      const member = members.find((m) => m.id === enrollment.memberId);
      const memberName = member
        ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
        : enrollment.memberId
          ? enrollment.memberId.substring(0, 12) + '…'
          : '—';

      const channelLabel = ENROLLMENT_CHANNEL_LABELS[enrollment.channel] || toTitleCase(enrollment.channel || '');
      const planTypeLabel = PLAN_TYPE_LABELS[enrollment.planType] || enrollment.planType || '—';

      let cmsResponse = '—';
      if (enrollment.trrResponse && typeof enrollment.trrResponse === 'object') {
        cmsResponse = enrollment.trrResponse.accepted ? 'Accepted' : 'Rejected';
        if (enrollment.trrResponse.responseCode) {
          cmsResponse += ` (${enrollment.trrResponse.responseCode})`;
        }
      } else if (enrollment.ikaSubmission && typeof enrollment.ikaSubmission === 'object') {
        cmsResponse = 'Submitted';
      }

      const conditionCategoryLabel = member && member.conditionCategory
        ? (CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory))
        : '';

      return {
        ...enrollment,
        memberName,
        channelLabel,
        planTypeLabel,
        cmsResponse,
        conditionCategoryLabel,
        _member: member || null,
      };
    });
  }, [enrollments, members]);

  /**
   * Filtered records based on status and channel filters.
   */
  const filteredRecords = useMemo(() => {
    let filtered = enrichedEnrollments;

    if (statusFilter && statusFilter.trim().length > 0) {
      filtered = filtered.filter((r) => r.status === statusFilter.trim());
    }

    if (channelFilter && channelFilter.trim().length > 0) {
      filtered = filtered.filter((r) => r.channel === channelFilter.trim());
    }

    if (filterMemberId && typeof filterMemberId === 'string' && filterMemberId.trim().length > 0) {
      filtered = filtered.filter((r) => r.memberId === filterMemberId.trim());
    }

    return filtered;
  }, [enrichedEnrollments, statusFilter, channelFilter, filterMemberId]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const total = enrollments.length;
    const active = enrollments.filter((r) => r.status === ENROLLMENT_STATUSES.ACTIVE).length;
    const pending = enrollments.filter((r) => r.status === ENROLLMENT_STATUSES.PENDING).length;
    const approved = enrollments.filter((r) => r.status === ENROLLMENT_STATUSES.APPROVED).length;
    const rejected = enrollments.filter((r) => r.status === ENROLLMENT_STATUSES.REJECTED).length;
    const disenrolled = enrollments.filter((r) => r.status === ENROLLMENT_STATUSES.DISENROLLED).length;
    const cancelled = enrollments.filter((r) => r.status === ENROLLMENT_STATUSES.CANCELLED).length;

    return { total, active, pending, approved, rejected, disenrolled, cancelled };
  }, [enrollments]);

  /**
   * Handles viewing a record's details.
   * @param {Object} record - The enrollment record
   */
  const handleViewDetails = useCallback((record) => {
    setSelectedRecord(record);
    setSelectedMember(record._member || null);
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
    setSelectedMember(null);
  }, []);

  /**
   * Handles status filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleStatusFilterChange = useCallback((e) => {
    setStatusFilter(e.target.value);
  }, []);

  /**
   * Handles channel filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleChannelFilterChange = useCallback((e) => {
    setChannelFilter(e.target.value);
  }, []);

  /**
   * Handles exporting enrollment records as CSV.
   */
  const handleExportCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No enrollment records to export.');
      return;
    }

    try {
      const csv = buildCSVExport(filteredRecords, members);
      const filename = `enrollments_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} enrollment record(s) to CSV.`);
    } catch (err) {
      console.error('EnrollmentList: export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting enrollment records.');
    }
  }, [filteredRecords, members, addNotification]);

  /**
   * Handles exporting enrollment records as JSON.
   */
  const handleExportJSON = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No enrollment records to export.');
      return;
    }

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalRecords: filteredRecords.length,
        filters: {
          status: statusFilter || 'all',
          channel: channelFilter || 'all',
        },
        records: filteredRecords.map(({ _member, ...rest }) => rest),
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `enrollments_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} enrollment record(s) to JSON.`);
    } catch (err) {
      console.error('EnrollmentList: JSON export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting enrollment records.');
    }
  }, [filteredRecords, statusFilter, channelFilter, addNotification]);

  /**
   * Table columns definition.
   */
  const columns = useMemo(() => {
    const cols = [
      {
        key: 'memberName',
        label: 'Member',
        sortable: true,
        searchable: true,
        width: 'min-w-[160px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate max-w-[180px]" title={value}>
                {value}
              </p>
              <p className="text-[10px] text-gray-500 truncate" title={row.memberId}>
                {row.memberId ? row.memberId.substring(0, 12) + '…' : '—'}
              </p>
            </div>
          );
        },
      },
      {
        key: 'channelLabel',
        label: 'Channel',
        sortable: true,
        searchable: true,
        width: 'min-w-[100px]',
        render: (value) => {
          return (
            <span className="text-xs text-gray-700">{value || '—'}</span>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        searchable: true,
        width: 'min-w-[110px]',
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
        key: 'applicationDate',
        label: 'Submitted',
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
        key: 'cmsResponse',
        label: 'CMS Response',
        sortable: true,
        searchable: true,
        width: 'min-w-[120px]',
        render: (value, row) => {
          if (!value || value === '—') {
            return <span className="text-gray-400 text-xs">—</span>;
          }

          const isAccepted = row.trrResponse && row.trrResponse.accepted === true;
          const isRejected = row.trrResponse && row.trrResponse.accepted === false;
          const isSubmitted = !row.trrResponse && row.ikaSubmission;

          let colorClass = 'text-gray-600 bg-gray-50 border-gray-200';
          if (isAccepted) {
            colorClass = 'text-green-700 bg-green-50 border-green-200';
          } else if (isRejected) {
            colorClass = 'text-red-700 bg-red-50 border-red-200';
          } else if (isSubmitted) {
            colorClass = 'text-blue-700 bg-blue-50 border-blue-200';
          }

          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colorClass}`}>
              {value}
            </span>
          );
        },
      },
    ];

    if (!compact) {
      cols.push({
        key: 'planTypeLabel',
        label: 'Plan Type',
        sortable: true,
        searchable: true,
        width: 'min-w-[100px]',
        render: (value) => {
          return (
            <span className="text-xs text-gray-700 truncate max-w-[120px]" title={value}>
              {value || '—'}
            </span>
          );
        },
      });

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

      cols.push({
        key: 'diagnosisCodesVerified',
        label: 'Dx Codes',
        sortable: false,
        searchable: false,
        width: 'min-w-[100px]',
        render: (value) => {
          if (!Array.isArray(value) || value.length === 0) {
            return <span className="text-gray-400">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {value.slice(0, 2).map((code) => (
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
              {value.length > 2 && (
                <span className="text-[10px] text-gray-400 self-center">
                  +{value.length - 2}
                </span>
              )}
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
              {/* Enrollment icon */}
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
                  <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              {hasTitle && (
                <h3 className="text-lg font-semibold text-csnp-primary">
                  {title}
                </h3>
              )}
              {!loading && enrollments.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {enrollments.length} record{enrollments.length !== 1 ? 's' : ''}
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
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Channel Filter */}
              <select
                value={channelFilter}
                onChange={handleChannelFilterChange}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                aria-label="Filter by channel"
              >
                {CHANNEL_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Export Buttons */}
              {showExport && !loading && filteredRecords.length > 0 && (
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
                onClick={loadData}
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
          {showStats && !loading && !error && enrollments.length > 0 && !compact && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-green-700">
                  {stats.active} active
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-blue-700">
                  {stats.approved} approved
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-yellow-700">
                  {stats.pending} pending
                </span>
              </div>
              {stats.rejected > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-red-700">
                    {stats.rejected} rejected
                  </span>
                </div>
              )}
              {stats.disenrolled > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-orange-700">
                    {stats.disenrolled} disenrolled
                  </span>
                </div>
              )}
              {stats.cancelled > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-gray-700">
                    {stats.cancelled} cancelled
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <LoadingSpinner
          size="md"
          variant="primary"
          text="Loading enrollment records..."
        />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load enrollment records"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadData}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && enrollments.length === 0 && (
        <EmptyState
          title="No Enrollment Records"
          description="No enrollment applications have been submitted yet. Create a new enrollment to get started."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Filtered Empty State */}
      {!loading && !error && enrollments.length > 0 && filteredRecords.length === 0 && (
        <EmptyState
          title="No Matching Enrollments"
          description={`No enrollment records match the selected filters${statusFilter ? ` (Status: ${toTitleCase(statusFilter)})` : ''}${channelFilter ? ` (Channel: ${ENROLLMENT_CHANNEL_LABELS[channelFilter] || toTitleCase(channelFilter)})` : ''}.`}
          iconType="no-results"
          size="sm"
          actionLabel="Clear Filters"
          onAction={() => {
            setStatusFilter('');
            setChannelFilter('');
          }}
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
          searchPlaceholder="Search by member, channel, status..."
          paginated={true}
          initialPageSize={initialPageSize}
          initialSortField="applicationDate"
          initialSortDirection="desc"
          emptyMessage="No enrollment records found"
          emptyDescription="No records match the current search criteria."
          idKey="id"
          onRowClick={handleViewDetails}
          className=""
        />
      )}

      {/* Detail Modal */}
      <EnrollmentDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        record={selectedRecord}
        member={selectedMember}
      />
    </div>
  );
}

EnrollmentList.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showExport: PropTypes.bool,
  showStats: PropTypes.bool,
  compact: PropTypes.bool,
  initialPageSize: PropTypes.number,
  filterStatus: PropTypes.string,
  filterChannel: PropTypes.string,
  filterMemberId: PropTypes.string,
  onRecordSelect: PropTypes.func,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

EnrollmentList.defaultProps = {
  showHeader: true,
  title: 'Enrollments',
  showExport: true,
  showStats: true,
  compact: false,
  initialPageSize: 20,
  filterStatus: undefined,
  filterChannel: undefined,
  filterMemberId: undefined,
  onRecordSelect: undefined,
  className: '',
  headerActions: null,
};