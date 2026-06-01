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
import { listClaims, getClaimStats, getClaimById } from '../../services/claimsService.js';
import { formatDate, formatRelativeTime, formatDateTime, formatCurrency, toTitleCase } from '../../utils/helpers.js';
import { getCodeByICD10, CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { CLAIM_STATUSES, CLAIM_STATUS_LABELS } from '../../utils/constants.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Status to StatusBadge status mapping.
 * @type {Object.<string, string>}
 */
const STATUS_BADGE_MAP = {
  [CLAIM_STATUSES.SUBMITTED]: 'submitted',
  [CLAIM_STATUSES.PENDING]: 'pending',
  [CLAIM_STATUSES.IN_REVIEW]: 'in_review',
  [CLAIM_STATUSES.APPROVED]: 'approved',
  [CLAIM_STATUSES.DENIED]: 'denied',
  [CLAIM_STATUSES.PARTIALLY_APPROVED]: 'partially_approved',
  [CLAIM_STATUSES.APPEALED]: 'appealed',
  [CLAIM_STATUSES.PAID]: 'paid',
  [CLAIM_STATUSES.VOIDED]: 'voided',
};

/**
 * Status filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: CLAIM_STATUSES.SUBMITTED, label: 'Submitted' },
  { value: CLAIM_STATUSES.PENDING, label: 'Pending' },
  { value: CLAIM_STATUSES.IN_REVIEW, label: 'In Review' },
  { value: CLAIM_STATUSES.APPROVED, label: 'Approved' },
  { value: CLAIM_STATUSES.DENIED, label: 'Denied' },
  { value: CLAIM_STATUSES.PARTIALLY_APPROVED, label: 'Partially Approved' },
  { value: CLAIM_STATUSES.APPEALED, label: 'Appealed' },
  { value: CLAIM_STATUSES.PAID, label: 'Paid' },
  { value: CLAIM_STATUSES.VOIDED, label: 'Voided' },
];

/**
 * Builds a CSV string from claim records.
 * @param {Object[]} records - Array of claim records
 * @returns {string} CSV string
 */
function buildCSVExport(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  const headers = [
    'Claim ID',
    'Claim Number',
    'Member',
    'Provider',
    'Status',
    'Service Date',
    'Submission Date',
    'Billed Amount',
    'Allowed Amount',
    'Paid Amount',
    'Member Responsibility',
    'Diagnosis Codes',
    'Service Description',
    'Processed By',
    'Processed Date',
    'Notes',
    'Created At',
  ];

  const rows = records.map((record) => [
    record.id || '',
    record.claimNumber || '',
    record._memberName || record.memberId || '',
    record._providerName || record.providerId || '',
    CLAIM_STATUS_LABELS[record.status] || record.status || '',
    record.serviceDate || '',
    record.submissionDate || '',
    typeof record.billedAmount === 'number' ? record.billedAmount.toFixed(2) : '0.00',
    typeof record.allowedAmount === 'number' ? record.allowedAmount.toFixed(2) : '0.00',
    typeof record.paidAmount === 'number' ? record.paidAmount.toFixed(2) : '0.00',
    typeof record.memberResponsibility === 'number' ? record.memberResponsibility.toFixed(2) : '0.00',
    Array.isArray(record.diagnosisCodes) ? record.diagnosisCodes.join('; ') : '',
    record.serviceDescription || '',
    record.processedBy || '',
    record.processedDate || '',
    record.notes || '',
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
    console.error('ClaimsList: failed to download file:', err);
  }
}

/**
 * Claim detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.claim - The claim to display
 * @returns {React.ReactElement|null}
 */
function ClaimDetailModal({ isOpen, onClose, claim }) {
  if (!claim) {
    return null;
  }

  const badgeStatus = STATUS_BADGE_MAP[claim.status] || 'pending';
  const diagnosisCodes = Array.isArray(claim.diagnosisCodes) ? claim.diagnosisCodes : [];
  const denialReasons = Array.isArray(claim.denialReasons) ? claim.denialReasons : [];
  const denialPreventionWarnings = Array.isArray(claim.denialPreventionWarnings) ? claim.denialPreventionWarnings : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Claim Details"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${
          claim.status === CLAIM_STATUSES.PAID || claim.status === CLAIM_STATUSES.APPROVED
            ? 'bg-green-50 border-green-200'
            : claim.status === CLAIM_STATUSES.DENIED
              ? 'bg-red-50 border-red-200'
              : claim.status === CLAIM_STATUSES.IN_REVIEW || claim.status === CLAIM_STATUSES.PENDING || claim.status === CLAIM_STATUSES.SUBMITTED
                ? 'bg-yellow-50 border-yellow-200'
                : claim.status === CLAIM_STATUSES.PARTIALLY_APPROVED
                  ? 'bg-orange-50 border-orange-200'
                  : claim.status === CLAIM_STATUSES.APPEALED
                    ? 'bg-amber-50 border-amber-200'
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
                {CLAIM_STATUS_LABELS[claim.status] || toTitleCase(claim.status || 'unknown')}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {claim.createdAt ? formatRelativeTime(claim.createdAt) : ''}
            </span>
          </div>
        </div>

        {/* Claim Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Claim Number</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={claim.claimNumber}>
              {claim.claimNumber || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Claim ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={claim.id}>
              {claim.id ? claim.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5 truncate" title={claim._memberName}>
              {claim._memberName || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Provider</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5 truncate" title={claim._providerName}>
              {claim._providerName || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Service Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {claim.serviceDate ? formatDate(claim.serviceDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Submission Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {claim.submissionDate ? formatDate(claim.submissionDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Processed By</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {claim.processedBy || 'Not processed'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Processed Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {claim.processedDate ? formatDate(claim.processedDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {claim.createdAt ? formatDateTime(claim.createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* Financial Summary */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Financial Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
              <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Billed</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {formatCurrency(claim.billedAmount)}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Allowed</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {formatCurrency(claim.allowedAmount)}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Paid</p>
              <p className="text-sm font-bold text-green-700 mt-0.5">
                {formatCurrency(claim.paidAmount)}
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Member Resp.</p>
              <p className="text-sm font-bold text-yellow-700 mt-0.5">
                {formatCurrency(claim.memberResponsibility)}
              </p>
            </div>
          </div>
        </div>

        {/* Service Description */}
        {claim.serviceDescription && typeof claim.serviceDescription === 'string' && claim.serviceDescription.trim().length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Service Description</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {claim.serviceDescription}
              </p>
            </div>
          </div>
        )}

        {/* Diagnosis Codes */}
        {diagnosisCodes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Diagnosis Codes ({diagnosisCodes.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {diagnosisCodes.map((code, idx) => {
                const entry = getCodeByICD10(typeof code === 'string' ? code.trim().toUpperCase() : '');
                return (
                  <span
                    key={`${code}-${idx}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                      entry && entry.csnpEligible
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                    title={entry ? entry.description : code}
                  >
                    {code}
                    {entry && (
                      <span className="opacity-75 max-w-[120px] truncate">{entry.description}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Adjudication Result */}
        {claim.ruleEvaluation && typeof claim.ruleEvaluation === 'object' && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Adjudication Result</p>
            <div className={`p-3 rounded-lg border ${
              claim.ruleEvaluation.approved
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${
                  claim.ruleEvaluation.approved ? 'text-green-800' : 'text-red-800'
                }`}>
                  {claim.ruleEvaluation.approved ? 'Approved by Rule Engine' : 'Not Approved by Rule Engine'}
                </span>
                {claim.ruleEvaluation.recommendedStatus && (
                  <span className="text-[10px] font-mono text-gray-500">
                    Recommended: {toTitleCase(claim.ruleEvaluation.recommendedStatus)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-600">
                {typeof claim.ruleEvaluation.rulesPassed === 'number' && (
                  <span className="text-green-600">{claim.ruleEvaluation.rulesPassed} rules passed</span>
                )}
                {typeof claim.ruleEvaluation.rulesFailed === 'number' && claim.ruleEvaluation.rulesFailed > 0 && (
                  <span className="text-red-600">{claim.ruleEvaluation.rulesFailed} rules failed</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Denial Reasons */}
        {denialReasons.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Denial Reasons ({denialReasons.length})
            </p>
            <div className="space-y-1.5">
              {denialReasons.map((reason, idx) => (
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
                  <p className="text-xs text-red-700">{reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Denial Prevention Warnings */}
        {denialPreventionWarnings.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Denial Prevention Warnings ({denialPreventionWarnings.length})
            </p>
            <div className="space-y-1.5">
              {denialPreventionWarnings.map((warning, idx) => (
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
          </div>
        )}

        {/* Pricing Details */}
        {claim.pricingDetails && typeof claim.pricingDetails === 'object' && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pricing Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {claim.pricingDetails.method && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Method</p>
                  <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(claim.pricingDetails.method.replace(/_/g, ' '))}</p>
                </div>
              )}
              {typeof claim.pricingDetails.allowedRate === 'number' && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Allowed Rate</p>
                  <p className="text-xs text-gray-700 mt-0.5">{(claim.pricingDetails.allowedRate * 100).toFixed(0)}%</p>
                </div>
              )}
              {typeof claim.pricingDetails.copay === 'number' && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Copay</p>
                  <p className="text-xs text-gray-700 mt-0.5">{formatCurrency(claim.pricingDetails.copay)}</p>
                </div>
              )}
              {typeof claim.pricingDetails.coinsurance === 'number' && claim.pricingDetails.coinsurance > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Coinsurance</p>
                  <p className="text-xs text-gray-700 mt-0.5">{claim.pricingDetails.coinsurance}%</p>
                </div>
              )}
              {claim.pricingDetails.matchedBenefit && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Matched Benefit</p>
                  <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(claim.pricingDetails.matchedBenefit.replace(/([A-Z])/g, ' $1').trim())}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {claim.notes && typeof claim.notes === 'string' && claim.notes.trim().length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {claim.notes}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

ClaimDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  claim: PropTypes.object,
};

ClaimDetailModal.defaultProps = {
  claim: null,
};

/**
 * Claims list component.
 * Displays all claims with claim ID, member name, provider, service date,
 * amount, status (pending/processing/approved/denied/paid), and adjudication
 * result. Supports search, filter by status, and row click for detail.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Claims'] - Section title
 * @param {boolean} [props.showExport=true] - Whether to show the export button
 * @param {boolean} [props.showStats=true] - Whether to show summary statistics
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.initialPageSize=20] - Initial page size
 * @param {string} [props.filterStatus] - Pre-set status filter
 * @param {string} [props.filterMemberId] - Pre-set member ID filter
 * @param {string} [props.filterProviderId] - Pre-set provider ID filter
 * @param {Function} [props.onRecordSelect] - Callback when a record is selected: (record) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function ClaimsList({
  showHeader = true,
  title = 'Claims',
  showExport = true,
  showStats = true,
  compact = false,
  initialPageSize = 20,
  filterStatus: initialFilterStatus,
  filterMemberId,
  filterProviderId,
  onRecordSelect,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [claims, setClaims] = useState([]);
  const [members, setMembers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialFilterStatus || '');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  /**
   * Loads claims data and related records.
   */
  const loadData = useCallback(() => {
    setError(null);
    setLoading(true);

    try {
      const filters = {};

      if (filterMemberId && typeof filterMemberId === 'string' && filterMemberId.trim().length > 0) {
        filters.memberId = filterMemberId.trim();
      }

      if (filterProviderId && typeof filterProviderId === 'string' && filterProviderId.trim().length > 0) {
        filters.providerId = filterProviderId.trim();
      }

      const allClaims = listClaims(filters);
      setClaims(Array.isArray(allClaims) ? allClaims : []);

      // Load members
      try {
        const storedMembers = localStorage.getItem('csnp_members');
        if (storedMembers) {
          const parsed = JSON.parse(storedMembers);
          if (Array.isArray(parsed)) {
            setMembers(parsed);
          }
        }
      } catch {
        setMembers([]);
      }

      // Load providers
      try {
        const storedProviders = localStorage.getItem('csnp_providers');
        if (storedProviders) {
          const parsed = JSON.parse(storedProviders);
          if (Array.isArray(parsed)) {
            setProviders(parsed);
          }
        }
      } catch {
        setProviders([]);
      }
    } catch (err) {
      console.error('ClaimsList: failed to load data:', err);
      setError('Unable to load claims data');
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [filterMemberId, filterProviderId]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Enriched claims with member and provider names.
   */
  const enrichedClaims = useMemo(() => {
    return claims.map((claim) => {
      const member = members.find((m) => m.id === claim.memberId);
      const provider = providers.find((p) => p.id === claim.providerId);

      const memberName = member
        ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
        : claim.memberId
          ? claim.memberId.substring(0, 12) + '…'
          : '—';

      const providerName = provider
        ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim()
        : claim.providerId
          ? claim.providerId.substring(0, 12) + '…'
          : '—';

      const providerSpecialty = provider ? provider.specialty : null;

      let adjudicationResult = '—';
      if (claim.ruleEvaluation && typeof claim.ruleEvaluation === 'object') {
        if (claim.ruleEvaluation.approved) {
          adjudicationResult = 'Approved';
        } else if (claim.ruleEvaluation.recommendedStatus) {
          adjudicationResult = toTitleCase(claim.ruleEvaluation.recommendedStatus.replace(/_/g, ' '));
        } else {
          adjudicationResult = 'Not Approved';
        }
      } else if (claim.status === CLAIM_STATUSES.PAID || claim.status === CLAIM_STATUSES.APPROVED) {
        adjudicationResult = 'Approved';
      } else if (claim.status === CLAIM_STATUSES.DENIED) {
        adjudicationResult = 'Denied';
      } else if (claim.status === CLAIM_STATUSES.PARTIALLY_APPROVED) {
        adjudicationResult = 'Partial';
      }

      return {
        ...claim,
        _memberName: memberName,
        _providerName: providerName,
        _providerSpecialty: providerSpecialty,
        _adjudicationResult: adjudicationResult,
        _member: member || null,
        _provider: provider || null,
      };
    });
  }, [claims, members, providers]);

  /**
   * Filtered records based on status filter.
   */
  const filteredRecords = useMemo(() => {
    let filtered = enrichedClaims;

    if (statusFilter && statusFilter.trim().length > 0) {
      filtered = filtered.filter((r) => r.status === statusFilter.trim());
    }

    return filtered;
  }, [enrichedClaims, statusFilter]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const total = claims.length;
    const submitted = claims.filter((c) => c.status === CLAIM_STATUSES.SUBMITTED).length;
    const pending = claims.filter((c) => c.status === CLAIM_STATUSES.PENDING).length;
    const inReview = claims.filter((c) => c.status === CLAIM_STATUSES.IN_REVIEW).length;
    const approved = claims.filter((c) => c.status === CLAIM_STATUSES.APPROVED).length;
    const denied = claims.filter((c) => c.status === CLAIM_STATUSES.DENIED).length;
    const paid = claims.filter((c) => c.status === CLAIM_STATUSES.PAID).length;
    const partiallyApproved = claims.filter((c) => c.status === CLAIM_STATUSES.PARTIALLY_APPROVED).length;
    const appealed = claims.filter((c) => c.status === CLAIM_STATUSES.APPEALED).length;
    const voided = claims.filter((c) => c.status === CLAIM_STATUSES.VOIDED).length;

    let totalBilled = 0;
    let totalPaid = 0;
    for (const claim of claims) {
      totalBilled += typeof claim.billedAmount === 'number' ? claim.billedAmount : 0;
      totalPaid += typeof claim.paidAmount === 'number' ? claim.paidAmount : 0;
    }

    return {
      total,
      submitted,
      pending,
      inReview,
      approved,
      denied,
      paid,
      partiallyApproved,
      appealed,
      voided,
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
    };
  }, [claims]);

  /**
   * Handles viewing a record's details.
   * @param {Object} record - The claim record
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
   * Handles status filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleStatusFilterChange = useCallback((e) => {
    setStatusFilter(e.target.value);
  }, []);

  /**
   * Handles exporting claims as CSV.
   */
  const handleExportCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No claims to export.');
      return;
    }

    try {
      const csv = buildCSVExport(filteredRecords);
      const filename = `claims_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} claim(s) to CSV.`);
    } catch (err) {
      console.error('ClaimsList: export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting claims.');
    }
  }, [filteredRecords, addNotification]);

  /**
   * Handles exporting claims as JSON.
   */
  const handleExportJSON = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No claims to export.');
      return;
    }

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalRecords: filteredRecords.length,
        filters: {
          status: statusFilter || 'all',
        },
        records: filteredRecords.map(({ _memberName, _providerName, _providerSpecialty, _adjudicationResult, _member, _provider, ...rest }) => rest),
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `claims_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} claim(s) to JSON.`);
    } catch (err) {
      console.error('ClaimsList: JSON export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting claims.');
    }
  }, [filteredRecords, statusFilter, addNotification]);

  /**
   * Table columns definition.
   */
  const columns = useMemo(() => {
    const cols = [
      {
        key: 'claimNumber',
        label: 'Claim #',
        sortable: true,
        searchable: true,
        width: 'min-w-[140px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate max-w-[160px]" title={value}>
                {value || 'No Number'}
              </p>
              <p className="text-[10px] text-gray-500 truncate" title={row.id}>
                {row.id ? row.id.substring(0, 12) + '…' : '—'}
              </p>
            </div>
          );
        },
      },
      {
        key: '_memberName',
        label: 'Member',
        sortable: true,
        searchable: true,
        width: 'min-w-[140px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate max-w-[160px]" title={value}>
                {value || '—'}
              </p>
              <p className="text-[10px] text-gray-500 truncate" title={row.memberId}>
                {row.memberId ? row.memberId.substring(0, 12) + '…' : '—'}
              </p>
            </div>
          );
        },
      },
      {
        key: '_providerName',
        label: 'Provider',
        sortable: true,
        searchable: true,
        width: 'min-w-[140px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate max-w-[160px]" title={value}>
                {value || '—'}
              </p>
              {row._providerSpecialty && (
                <p className="text-[10px] text-gray-400">{row._providerSpecialty}</p>
              )}
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        searchable: true,
        width: 'min-w-[120px]',
        render: (value) => {
          const badgeStatus = STATUS_BADGE_MAP[value] || 'pending';
          return (
            <StatusBadge
              status={badgeStatus}
              label={CLAIM_STATUS_LABELS[value] || toTitleCase(value || 'unknown')}
              size="sm"
              showDot={true}
              bordered={true}
            />
          );
        },
      },
      {
        key: 'serviceDate',
        label: 'Service Date',
        sortable: true,
        searchable: false,
        width: 'min-w-[110px]',
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
        key: 'billedAmount',
        label: 'Billed',
        sortable: true,
        searchable: false,
        width: 'min-w-[90px]',
        align: 'right',
        render: (value) => {
          return (
            <span className="text-xs font-medium text-gray-700">
              {formatCurrency(value)}
            </span>
          );
        },
      },
      {
        key: 'paidAmount',
        label: 'Paid',
        sortable: true,
        searchable: false,
        width: 'min-w-[90px]',
        align: 'right',
        render: (value, row) => {
          const isPaid = row.status === CLAIM_STATUSES.PAID || row.status === CLAIM_STATUSES.APPROVED;
          return (
            <span className={`text-xs font-medium ${isPaid ? 'text-green-700' : 'text-gray-500'}`}>
              {formatCurrency(value)}
            </span>
          );
        },
      },
    ];

    if (!compact) {
      cols.push({
        key: '_adjudicationResult',
        label: 'Adjudication',
        sortable: true,
        searchable: true,
        width: 'min-w-[110px]',
        render: (value, row) => {
          if (!value || value === '—') {
            return <span className="text-gray-400 text-xs">—</span>;
          }

          let colorClass = 'text-gray-600 bg-gray-50 border-gray-200';
          if (value === 'Approved') {
            colorClass = 'text-green-700 bg-green-50 border-green-200';
          } else if (value === 'Denied' || value === 'Not Approved') {
            colorClass = 'text-red-700 bg-red-50 border-red-200';
          } else if (value === 'In Review') {
            colorClass = 'text-purple-700 bg-purple-50 border-purple-200';
          } else if (value === 'Partial') {
            colorClass = 'text-orange-700 bg-orange-50 border-orange-200';
          }

          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colorClass}`}>
              {value}
            </span>
          );
        },
      });

      cols.push({
        key: 'memberResponsibility',
        label: 'Member Resp.',
        sortable: true,
        searchable: false,
        width: 'min-w-[100px]',
        align: 'right',
        render: (value) => {
          return (
            <span className="text-xs font-medium text-gray-700">
              {formatCurrency(value)}
            </span>
          );
        },
      });

      cols.push({
        key: 'diagnosisCodes',
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
              {value.slice(0, 2).map((code, idx) => (
                <span
                  key={`${code}-${idx}`}
                  className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded"
                  title={(() => {
                    const e = getCodeByICD10(typeof code === 'string' ? code.trim().toUpperCase() : '');
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
              {/* Claims icon */}
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
                  <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                </svg>
              </div>
              {hasTitle && (
                <h3 className="text-lg font-semibold text-csnp-primary">
                  {title}
                </h3>
              )}
              {!loading && claims.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {claims.length} claim{claims.length !== 1 ? 's' : ''}
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
          {showStats && !loading && !error && claims.length > 0 && !compact && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {stats.paid > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-green-700">
                    {stats.paid} paid
                  </span>
                </div>
              )}
              {stats.approved > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-blue-700">
                    {stats.approved} approved
                  </span>
                </div>
              )}
              {(stats.submitted + stats.pending + stats.inReview) > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-yellow-700">
                    {stats.submitted + stats.pending + stats.inReview} processing
                  </span>
                </div>
              )}
              {stats.denied > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-red-700">
                    {stats.denied} denied
                  </span>
                </div>
              )}
              {stats.partiallyApproved > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-orange-700">
                    {stats.partiallyApproved} partial
                  </span>
                </div>
              )}
              {stats.appealed > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-amber-700">
                    {stats.appealed} appealed
                  </span>
                </div>
              )}
              {stats.voided > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-gray-600">
                    {stats.voided} voided
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-csnp-blue-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-csnp-primary" aria-hidden="true" />
                <span className="text-[10px] font-medium text-csnp-primary">
                  {formatCurrency(stats.totalBilled)} billed
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-green-700">
                  {formatCurrency(stats.totalPaid)} paid
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <LoadingSpinner
          size="md"
          variant="primary"
          text="Loading claims..."
        />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load claims"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadData}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && claims.length === 0 && (
        <EmptyState
          title="No Claims"
          description="No claims have been submitted yet. Claims will appear here once they are initiated."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Filtered Empty State */}
      {!loading && !error && claims.length > 0 && filteredRecords.length === 0 && (
        <EmptyState
          title="No Matching Claims"
          description={`No claims match the selected filter${statusFilter ? ` (Status: ${CLAIM_STATUS_LABELS[statusFilter] || toTitleCase(statusFilter)})` : ''}.`}
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
          searchPlaceholder="Search by claim #, member, provider, status..."
          paginated={true}
          initialPageSize={initialPageSize}
          initialSortField="serviceDate"
          initialSortDirection="desc"
          emptyMessage="No claims found"
          emptyDescription="No claims match the current search criteria."
          idKey="id"
          onRowClick={handleViewDetails}
          className=""
        />
      )}

      {/* CMS Compliance Notice */}
      {!loading && !error && !compact && claims.length > 0 && (
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
              All C-SNP claims are processed through CSNP-specific adjudication rules per CMS regulations
              (42 CFR §422.100). Claims must include valid ICD-10 diagnosis codes, be associated with an
              active enrollment, and comply with plan-based pricing and authorization requirements.
              All claim actions are logged in the audit trail.
            </p>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <ClaimDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        claim={selectedRecord}
      />
    </div>
  );
}

ClaimsList.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showExport: PropTypes.bool,
  showStats: PropTypes.bool,
  compact: PropTypes.bool,
  initialPageSize: PropTypes.number,
  filterStatus: PropTypes.string,
  filterMemberId: PropTypes.string,
  filterProviderId: PropTypes.string,
  onRecordSelect: PropTypes.func,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

ClaimsList.defaultProps = {
  showHeader: true,
  title: 'Claims',
  showExport: true,
  showStats: true,
  compact: false,
  initialPageSize: 20,
  filterStatus: undefined,
  filterMemberId: undefined,
  filterProviderId: undefined,
  onRecordSelect: undefined,
  className: '',
  headerActions: null,
};