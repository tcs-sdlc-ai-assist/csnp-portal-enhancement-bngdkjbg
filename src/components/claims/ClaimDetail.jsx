import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import Modal from '../common/Modal.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Tabs from '../common/Tabs.jsx';
import {
  getClaimById,
  getClaimStatus,
  processClaim,
  appealClaim,
  voidClaim,
  markClaimPaid,
  reprocessClaim,
  updateClaimNotes,
} from '../../services/claimsService.js';
import { getAuditLogs } from '../../services/auditLogger.js';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  toTitleCase,
  calculateAge,
  formatPhone,
  formatAddress,
} from '../../utils/helpers.js';
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
} from '../../utils/constants.js';
import {
  getCodeByICD10,
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';
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
 * Status to banner style mapping.
 * @type {Object.<string, { bg: string, border: string }>}
 */
const STATUS_BANNER_STYLES = {
  [CLAIM_STATUSES.SUBMITTED]: { bg: 'bg-indigo-50', border: 'border-indigo-200' },
  [CLAIM_STATUSES.PENDING]: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
  [CLAIM_STATUSES.IN_REVIEW]: { bg: 'bg-purple-50', border: 'border-purple-200' },
  [CLAIM_STATUSES.APPROVED]: { bg: 'bg-blue-50', border: 'border-blue-200' },
  [CLAIM_STATUSES.DENIED]: { bg: 'bg-red-50', border: 'border-red-200' },
  [CLAIM_STATUSES.PARTIALLY_APPROVED]: { bg: 'bg-orange-50', border: 'border-orange-200' },
  [CLAIM_STATUSES.APPEALED]: { bg: 'bg-amber-50', border: 'border-amber-200' },
  [CLAIM_STATUSES.PAID]: { bg: 'bg-green-50', border: 'border-green-200' },
  [CLAIM_STATUSES.VOIDED]: { bg: 'bg-gray-50', border: 'border-gray-200' },
};

/**
 * Default banner style.
 * @type {{ bg: string, border: string }}
 */
const DEFAULT_BANNER_STYLE = { bg: 'bg-gray-50', border: 'border-gray-200' };

/**
 * Skeleton loading state for the claim detail.
 * @returns {React.ReactElement}
 */
function ClaimDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-16 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-32 bg-gray-200 rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="h-3 w-32 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Audit history item component.
 *
 * @param {Object} props
 * @param {Object} props.entry - Audit log entry
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function AuditHistoryItem({ entry, isLast = false }) {
  const actionLabel = toTitleCase(entry.action || 'unknown');

  const actionColors = {
    create: { bg: 'bg-green-50', text: 'text-green-600' },
    update: { bg: 'bg-csnp-blue-50', text: 'text-csnp-primary' },
    claim_submit: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
    claim_approve: { bg: 'bg-green-50', text: 'text-green-600' },
    claim_deny: { bg: 'bg-red-50', text: 'text-red-600' },
    claim_appeal: { bg: 'bg-amber-50', text: 'text-amber-600' },
    approve: { bg: 'bg-green-50', text: 'text-green-600' },
    deny: { bg: 'bg-red-50', text: 'text-red-600' },
    delete: { bg: 'bg-red-50', text: 'text-red-600' },
  };

  const colors = actionColors[entry.action] || { bg: 'bg-gray-50', text: 'text-gray-500' };

  return (
    <div className={`flex items-start gap-3 py-3 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
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
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-900">{actionLabel}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500 truncate max-w-[120px]">
              {entry.userId ? entry.userId.substring(0, 8) + '…' : 'System'}
            </span>
          </div>
          <span
            className="text-[10px] text-gray-400 flex-shrink-0 ml-2"
            title={formatDateTime(entry.timestamp)}
          >
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed line-clamp-2">
          {entry.description || `${actionLabel} action performed`}
        </p>
      </div>
    </div>
  );
}

AuditHistoryItem.propTypes = {
  entry: PropTypes.shape({
    id: PropTypes.string,
    action: PropTypes.string,
    userId: PropTypes.string,
    description: PropTypes.string,
    timestamp: PropTypes.string,
  }).isRequired,
  isLast: PropTypes.bool,
};

AuditHistoryItem.defaultProps = {
  isLast: false,
};

/**
 * Claim detail view component.
 * Shows full claim record with member info, provider info, service details,
 * adjudication results (applied rules, pricing, edits), payment status,
 * denial reasons if applicable, and audit trail.
 *
 * @param {Object} props
 * @param {string} props.claimId - The claim ID to display
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showActions=true] - Whether to show action buttons
 * @param {boolean} [props.showAuditHistory=true] - Whether to show audit history
 * @param {Function} [props.onStatusChange] - Callback when claim status changes: (claim) => void
 * @param {Function} [props.onClose] - Callback when close/back is clicked
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function ClaimDetail({
  claimId,
  showHeader = true,
  showActions = true,
  showAuditHistory = true,
  onStatusChange,
  onClose,
  className = '',
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [claim, setClaim] = useState(null);
  const [member, setMember] = useState(null);
  const [provider, setProvider] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [benefitPackage, setBenefitPackage] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  /**
   * Loads claim data and related records.
   */
  const loadClaimData = useCallback(() => {
    if (typeof claimId !== 'string' || claimId.trim().length === 0) {
      setError('Claim ID is required');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const claimRecord = getClaimById(claimId.trim());
      if (!claimRecord) {
        setError(`Claim not found: ${claimId.trim()}`);
        setLoading(false);
        return;
      }

      setClaim(claimRecord);

      // Load member data
      try {
        const storedMembers = localStorage.getItem('csnp_members');
        if (storedMembers) {
          const members = JSON.parse(storedMembers);
          if (Array.isArray(members)) {
            const foundMember = members.find((m) => m.id === claimRecord.memberId);
            setMember(foundMember || null);
          }
        }
      } catch {
        setMember(null);
      }

      // Load provider data
      try {
        const storedProviders = localStorage.getItem('csnp_providers');
        if (storedProviders) {
          const providers = JSON.parse(storedProviders);
          if (Array.isArray(providers)) {
            const foundProvider = providers.find((p) => p.id === claimRecord.providerId);
            setProvider(foundProvider || null);
          }
        }
      } catch {
        setProvider(null);
      }

      // Load enrollment data
      try {
        if (claimRecord.enrollmentId) {
          const storedEnrollments = localStorage.getItem('csnp_enrollments');
          if (storedEnrollments) {
            const enrollments = JSON.parse(storedEnrollments);
            if (Array.isArray(enrollments)) {
              const foundEnrollment = enrollments.find((e) => e.id === claimRecord.enrollmentId);
              setEnrollment(foundEnrollment || null);

              // Load benefit package from enrollment
              if (foundEnrollment && foundEnrollment.benefitPackageId) {
                const storedPackages = localStorage.getItem('csnp_benefit_packages');
                if (storedPackages) {
                  const packages = JSON.parse(storedPackages);
                  if (Array.isArray(packages)) {
                    const foundPackage = packages.find((p) => p.id === foundEnrollment.benefitPackageId);
                    setBenefitPackage(foundPackage || null);
                  }
                }
              }
            }
          }
        }
      } catch {
        setEnrollment(null);
        setBenefitPackage(null);
      }

      // Load audit history
      if (showAuditHistory) {
        try {
          const logs = getAuditLogs({
            targetType: 'claim',
            targetId: claimId.trim(),
          });

          // Also get claim rule evaluation audit logs
          const ruleEvalLogs = getAuditLogs({
            targetType: 'claim_rule_evaluation',
            targetId: claimId.trim(),
          });

          const allLogs = [...(Array.isArray(logs) ? logs : []), ...(Array.isArray(ruleEvalLogs) ? ruleEvalLogs : [])];

          // Deduplicate by ID and sort by timestamp descending
          const uniqueLogsMap = new Map();
          for (const log of allLogs) {
            if (log.id && !uniqueLogsMap.has(log.id)) {
              uniqueLogsMap.set(log.id, log);
            }
          }

          const uniqueLogs = [...uniqueLogsMap.values()]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 20);

          setAuditLogs(uniqueLogs);
        } catch {
          setAuditLogs([]);
        }
      }
    } catch (err) {
      console.error('ClaimDetail: failed to load claim data:', err);
      setError('Unable to load claim details');
    } finally {
      setLoading(false);
    }
  }, [claimId, showAuditHistory]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadClaimData();
  }, [loadClaimData]);

  /**
   * Computed: badge status.
   */
  const badgeStatus = useMemo(() => {
    if (!claim) return 'pending';
    return STATUS_BADGE_MAP[claim.status] || 'pending';
  }, [claim]);

  /**
   * Computed: banner style.
   */
  const bannerStyle = useMemo(() => {
    if (!claim) return DEFAULT_BANNER_STYLE;
    return STATUS_BANNER_STYLES[claim.status] || DEFAULT_BANNER_STYLE;
  }, [claim]);

  /**
   * Computed: status label.
   */
  const statusLabel = useMemo(() => {
    if (!claim) return '—';
    return CLAIM_STATUS_LABELS[claim.status] || toTitleCase(claim.status || 'unknown');
  }, [claim]);

  /**
   * Computed: member display name.
   */
  const memberName = useMemo(() => {
    if (claim && claim.memberName) {
      return claim.memberName;
    }
    if (member) {
      return `${member.firstName || ''} ${member.lastName || ''}`.trim() || '—';
    }
    if (claim && claim.memberId) {
      return claim.memberId.substring(0, 12) + '…';
    }
    return '—';
  }, [claim, member]);

  /**
   * Computed: provider display name.
   */
  const providerName = useMemo(() => {
    if (claim && claim.providerName) {
      return claim.providerName;
    }
    if (provider) {
      return `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || '—';
    }
    if (claim && claim.providerId) {
      return claim.providerId.substring(0, 12) + '…';
    }
    return '—';
  }, [claim, provider]);

  /**
   * Computed: diagnosis codes.
   */
  const diagnosisCodes = useMemo(() => {
    if (!claim) return [];
    return Array.isArray(claim.diagnosisCodes) ? claim.diagnosisCodes : [];
  }, [claim]);

  /**
   * Computed: denial reasons.
   */
  const denialReasons = useMemo(() => {
    if (!claim) return [];
    return Array.isArray(claim.denialReasons) ? claim.denialReasons : [];
  }, [claim]);

  /**
   * Computed: denial prevention warnings.
   */
  const denialPreventionWarnings = useMemo(() => {
    if (!claim) return [];
    return Array.isArray(claim.denialPreventionWarnings) ? claim.denialPreventionWarnings : [];
  }, [claim]);

  /**
   * Computed: rule evaluation.
   */
  const ruleEvaluation = useMemo(() => {
    if (!claim || !claim.ruleEvaluation || typeof claim.ruleEvaluation !== 'object') {
      return null;
    }
    return claim.ruleEvaluation;
  }, [claim]);

  /**
   * Computed: pricing details.
   */
  const pricingDetails = useMemo(() => {
    if (!claim || !claim.pricingDetails || typeof claim.pricingDetails !== 'object') {
      return null;
    }
    return claim.pricingDetails;
  }, [claim]);

  /**
   * Computed: condition category label from member.
   */
  const conditionCategoryLabel = useMemo(() => {
    if (member && member.conditionCategory) {
      return CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory);
    }
    return null;
  }, [member]);

  /**
   * Computed: provider in-network status.
   */
  const providerInNetwork = useMemo(() => {
    if (!provider || !provider.contract) return null;
    return provider.contract.status === 'active' && provider.contract.contractType === 'In-Network';
  }, [provider]);

  /**
   * Computed: whether actions are available based on claim status.
   */
  const canProcess = useMemo(() => {
    if (!claim) return false;
    return [CLAIM_STATUSES.SUBMITTED, CLAIM_STATUSES.PENDING, CLAIM_STATUSES.IN_REVIEW].includes(claim.status);
  }, [claim]);

  const canAppeal = useMemo(() => {
    if (!claim) return false;
    return claim.status === CLAIM_STATUSES.DENIED;
  }, [claim]);

  const canVoid = useMemo(() => {
    if (!claim) return false;
    return claim.status !== CLAIM_STATUSES.VOIDED && claim.status !== CLAIM_STATUSES.PAID;
  }, [claim]);

  const canMarkPaid = useMemo(() => {
    if (!claim) return false;
    return claim.status === CLAIM_STATUSES.APPROVED;
  }, [claim]);

  const canReprocess = useMemo(() => {
    if (!claim) return false;
    return [CLAIM_STATUSES.IN_REVIEW, CLAIM_STATUSES.APPEALED].includes(claim.status);
  }, [claim]);

  /**
   * Handles processing the claim.
   */
  const handleProcess = useCallback(() => {
    if (!claim) return;
    setActionLoading(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = processClaim(claim.id, { performedBy });

      if (result.success) {
        addNotification(
          'success',
          'Claim Processed',
          `Claim ${claim.claimNumber || claim.id} has been processed. Status: ${CLAIM_STATUS_LABELS[result.status] || result.status}. Paid: ${formatCurrency(result.paidAmount)}`
        );
        loadClaimData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification(
          'warning',
          'Claim Processing',
          `Claim processed with status: ${CLAIM_STATUS_LABELS[result.status] || result.status}. ${result.denialReasons && result.denialReasons.length > 0 ? result.denialReasons[0] : ''}`
        );
        loadClaimData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      }
    } catch (err) {
      console.error('ClaimDetail: process error:', err);
      addNotification('error', 'Processing Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [claim, user, addNotification, loadClaimData, onStatusChange]);

  /**
   * Handles appealing the claim.
   */
  const handleAppeal = useCallback(() => {
    if (!claim) return;
    setActionLoading(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = appealClaim(claim.id, 'Appeal submitted via claim detail view', performedBy);

      if (result.success) {
        addNotification(
          'info',
          'Claim Appealed',
          `Claim ${claim.claimNumber || claim.id} has been appealed.`
        );
        loadClaimData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification(
          'error',
          'Appeal Failed',
          result.error || 'An error occurred while appealing the claim.'
        );
      }
    } catch (err) {
      console.error('ClaimDetail: appeal error:', err);
      addNotification('error', 'Appeal Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [claim, user, addNotification, loadClaimData, onStatusChange]);

  /**
   * Handles voiding the claim.
   */
  const handleVoid = useCallback(() => {
    if (!claim) return;
    setActionLoading(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = voidClaim(claim.id, 'Voided via claim detail view', performedBy);

      if (result.success) {
        addNotification(
          'info',
          'Claim Voided',
          `Claim ${claim.claimNumber || claim.id} has been voided.`
        );
        loadClaimData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification(
          'error',
          'Void Failed',
          result.error || 'An error occurred while voiding the claim.'
        );
      }
    } catch (err) {
      console.error('ClaimDetail: void error:', err);
      addNotification('error', 'Void Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [claim, user, addNotification, loadClaimData, onStatusChange]);

  /**
   * Handles marking the claim as paid.
   */
  const handleMarkPaid = useCallback(() => {
    if (!claim) return;
    setActionLoading(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = markClaimPaid(claim.id, performedBy);

      if (result.success) {
        addNotification(
          'success',
          'Claim Paid',
          `Claim ${claim.claimNumber || claim.id} has been marked as paid.`
        );
        loadClaimData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification(
          'error',
          'Payment Failed',
          result.error || 'An error occurred while marking the claim as paid.'
        );
      }
    } catch (err) {
      console.error('ClaimDetail: mark paid error:', err);
      addNotification('error', 'Payment Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [claim, user, addNotification, loadClaimData, onStatusChange]);

  /**
   * Handles reprocessing the claim.
   */
  const handleReprocess = useCallback(() => {
    if (!claim) return;
    setActionLoading(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = reprocessClaim(claim.id, { performedBy });

      if (result.success) {
        addNotification(
          'success',
          'Claim Reprocessed',
          `Claim ${claim.claimNumber || claim.id} has been reprocessed. Status: ${CLAIM_STATUS_LABELS[result.status] || result.status}`
        );
        loadClaimData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      } else {
        addNotification(
          'warning',
          'Reprocessing Result',
          `Claim reprocessed with status: ${CLAIM_STATUS_LABELS[result.status] || result.status}`
        );
        loadClaimData();
        if (typeof onStatusChange === 'function') {
          onStatusChange(result);
        }
      }
    } catch (err) {
      console.error('ClaimDetail: reprocess error:', err);
      addNotification('error', 'Reprocessing Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [claim, user, addNotification, loadClaimData, onStatusChange]);

  const hasClaimId = typeof claimId === 'string' && claimId.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  if (!hasClaimId) {
    return (
      <div className={containerClassName} {...rest}>
        <EmptyState
          title="No Claim Selected"
          description="Select a claim to view its details."
          iconType="no-data"
          size="sm"
        />
      </div>
    );
  }

  /**
   * Renders the Overview tab content.
   */
  function renderOverviewTab() {
    return (
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${bannerStyle.bg} ${bannerStyle.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={badgeStatus}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">
                {statusLabel}
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
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Status</p>
            <p className="text-xs text-gray-700 mt-0.5">{statusLabel}</p>
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
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Processed Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {claim.processedDate ? formatDate(claim.processedDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Processed By</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {claim.processedBy ? claim.processedBy.substring(0, 12) + '…' : 'Not processed'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {claim.createdAt ? formatDateTime(claim.createdAt) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Last Updated</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {claim.updatedAt ? formatDateTime(claim.updatedAt) : '—'}
            </p>
          </div>
        </div>

        {/* Financial Summary */}
        <Card bordered={true} flat={false} variant="primary" size="sm">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-csnp-primary">Financial Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Billed</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {formatCurrency(claim.billedAmount)}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Allowed</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {formatCurrency(claim.allowedAmount)}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Paid</p>
                <p className={`text-sm font-bold mt-0.5 ${(claim.status === CLAIM_STATUSES.PAID || claim.status === CLAIM_STATUSES.APPROVED) ? 'text-green-700' : 'text-gray-900'}`}>
                  {formatCurrency(claim.paidAmount)}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member Resp.</p>
                <p className="text-sm font-bold text-yellow-700 mt-0.5">
                  {formatCurrency(claim.memberResponsibility)}
                </p>
              </div>
            </div>

            {/* Adjustment amount */}
            {typeof claim.billedAmount === 'number' && typeof claim.allowedAmount === 'number' && claim.allowedAmount > 0 && (
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span>Adjustment: {formatCurrency(claim.billedAmount - claim.allowedAmount)}</span>
                <span className="text-gray-300" aria-hidden="true">·</span>
                <span>Allowed Rate: {claim.billedAmount > 0 ? Math.round((claim.allowedAmount / claim.billedAmount) * 100) : 0}%</span>
              </div>
            )}
          </div>
        </Card>

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
            <div className="space-y-1.5">
              {diagnosisCodes.map((code, idx) => {
                const entry = getCodeByICD10(typeof code === 'string' ? code.trim().toUpperCase() : '');
                return (
                  <div
                    key={`${code}-${idx}`}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{code}</span>
                        {entry && entry.csnpEligible && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">
                            CSNP
                          </span>
                        )}
                      </div>
                      {entry && (
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[400px]" title={entry.description}>
                          {entry.description}
                        </p>
                      )}
                    </div>
                    {entry && (
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[10px] font-medium text-gray-400">
                          P{entry.priority}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {CONDITION_CATEGORY_LABELS[entry.category] || entry.category}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
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
    );
  }

  /**
   * Renders the Member & Provider tab content.
   */
  function renderMemberProviderTab() {
    return (
      <div className="space-y-4">
        {/* Member Info */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Member Information</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Name</p>
              <p className="text-xs font-medium text-gray-700 mt-0.5 truncate" title={memberName}>
                {memberName}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member ID</p>
              <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={claim.memberId}>
                {claim.memberId ? claim.memberId.substring(0, 16) + '…' : '—'}
              </p>
            </div>
            {member && (
              <>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Date of Birth</p>
                  <p className="text-xs text-gray-700 mt-0.5">
                    {member.dateOfBirth ? `${formatDate(member.dateOfBirth)} (Age ${calculateAge(member.dateOfBirth) || '—'})` : '—'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Medicare ID</p>
                  <p className="text-xs font-mono text-gray-700 mt-0.5">
                    {member.medicareId || claim.memberMedicareId || '—'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Condition</p>
                  <p className="text-xs text-gray-700 mt-0.5 truncate">
                    {conditionCategoryLabel || '—'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">CSNP Eligible</p>
                  <p className="text-xs mt-0.5">
                    {member.csnpEligible ? (
                      <span className="text-green-700 font-medium">Yes</span>
                    ) : (
                      <span className="text-red-700 font-medium">No</span>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Provider Info */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Provider Information</p>
          <div className={`p-3 rounded-lg border ${providerInNetwork === true ? 'bg-green-50 border-green-200' : providerInNetwork === false ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900">{providerName}</span>
                {providerInNetwork !== null && (
                  <StatusBadge
                    status={providerInNetwork ? 'active' : 'expired'}
                    label={providerInNetwork ? 'In-Network' : 'Out-of-Network'}
                    size="sm"
                    showDot={true}
                    bordered={true}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-gray-400">Provider ID</p>
                <p className="text-xs font-mono text-gray-700 truncate" title={claim.providerId}>
                  {claim.providerId ? claim.providerId.substring(0, 16) + '…' : '—'}
                </p>
              </div>
              {provider && (
                <>
                  <div>
                    <p className="text-[10px] text-gray-400">NPI</p>
                    <p className="text-xs font-mono text-gray-700">{provider.npi || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Specialty</p>
                    <p className="text-xs text-gray-700">{provider.specialty || claim.providerSpecialty || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Facility</p>
                    <p className="text-xs text-gray-700 truncate">{provider.facilityName || claim.providerFacility || '—'}</p>
                  </div>
                  {provider.phone && (
                    <div>
                      <p className="text-[10px] text-gray-400">Phone</p>
                      <p className="text-xs text-gray-700">{formatPhone(provider.phone)}</p>
                    </div>
                  )}
                  {provider.address && typeof provider.address === 'object' && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-[10px] text-gray-400">Address</p>
                      <p className="text-xs text-gray-700">{formatAddress(provider.address) || '—'}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Out-of-Network Warning */}
        {providerInNetwork === false && (
          <Alert
            variant="warning"
            title="Out-of-Network Provider"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            This claim was submitted by an out-of-network provider. Out-of-network claims may have higher member cost-sharing and may require prior authorization.
          </Alert>
        )}

        {/* Enrollment Info */}
        {enrollment && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Enrollment Information</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Enrollment ID</p>
                <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={enrollment.id}>
                  {enrollment.id ? enrollment.id.substring(0, 16) + '…' : '—'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Enrollment Status</p>
                <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(enrollment.status || 'unknown')}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Plan Type</p>
                <p className="text-xs text-gray-700 mt-0.5">{enrollment.planType || claim.enrollmentPlanType || '—'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Effective Date</p>
                <p className="text-xs text-gray-700 mt-0.5">
                  {enrollment.effectiveDate ? formatDate(enrollment.effectiveDate) : '—'}
                </p>
              </div>
              {benefitPackage && (
                <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Benefit Package</p>
                  <p className="text-xs text-gray-700 mt-0.5 truncate" title={benefitPackage.name}>
                    {benefitPackage.name || '—'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Adjudication tab content.
   */
  function renderAdjudicationTab() {
    return (
      <div className="space-y-4">
        {/* Adjudication Result */}
        {ruleEvaluation && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Adjudication Result</p>
            <div className={`p-3 rounded-lg border ${
              ruleEvaluation.approved
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${
                  ruleEvaluation.approved ? 'text-green-800' : 'text-red-800'
                }`}>
                  {ruleEvaluation.approved ? 'Approved by Rule Engine' : 'Not Approved by Rule Engine'}
                </span>
                {ruleEvaluation.recommendedStatus && (
                  <span className="text-[10px] font-mono text-gray-500">
                    Recommended: {toTitleCase(ruleEvaluation.recommendedStatus)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-600">
                {typeof ruleEvaluation.rulesPassed === 'number' && (
                  <span className="text-green-600">
                    <span className="font-semibold">{ruleEvaluation.rulesPassed}</span> rules passed
                  </span>
                )}
                {typeof ruleEvaluation.rulesFailed === 'number' && ruleEvaluation.rulesFailed > 0 && (
                  <span className="text-red-600">
                    <span className="font-semibold">{ruleEvaluation.rulesFailed}</span> rules failed
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No adjudication result */}
        {!ruleEvaluation && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-xs text-gray-400">No adjudication results available. The claim may not have been processed yet.</p>
          </div>
        )}

        {/* Pricing Details */}
        {pricingDetails && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pricing Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pricingDetails.method && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Pricing Method</p>
                  <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(pricingDetails.method.replace(/_/g, ' '))}</p>
                </div>
              )}
              {typeof pricingDetails.allowedRate === 'number' && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Allowed Rate</p>
                  <p className="text-xs text-gray-700 mt-0.5">{(pricingDetails.allowedRate * 100).toFixed(0)}%</p>
                </div>
              )}
              {typeof pricingDetails.copay === 'number' && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Copay</p>
                  <p className="text-xs text-gray-700 mt-0.5">{formatCurrency(pricingDetails.copay)}</p>
                </div>
              )}
              {typeof pricingDetails.coinsurance === 'number' && pricingDetails.coinsurance > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Coinsurance</p>
                  <p className="text-xs text-gray-700 mt-0.5">{pricingDetails.coinsurance}%</p>
                </div>
              )}
              {typeof pricingDetails.coinsuranceAmount === 'number' && pricingDetails.coinsuranceAmount > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Coinsurance Amount</p>
                  <p className="text-xs text-gray-700 mt-0.5">{formatCurrency(pricingDetails.coinsuranceAmount)}</p>
                </div>
              )}
              {pricingDetails.matchedBenefit && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Matched Benefit</p>
                  <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(pricingDetails.matchedBenefit.replace(/([A-Z])/g, ' $1').trim())}</p>
                </div>
              )}
              {typeof pricingDetails.billedAmount === 'number' && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Billed Amount</p>
                  <p className="text-xs text-gray-700 mt-0.5">{formatCurrency(pricingDetails.billedAmount)}</p>
                </div>
              )}
              {typeof pricingDetails.adjustmentAmount === 'number' && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Adjustment</p>
                  <p className="text-xs text-gray-700 mt-0.5">{formatCurrency(pricingDetails.adjustmentAmount)}</p>
                </div>
              )}
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

        {/* Payment Status */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Status</p>
          <div className={`p-3 rounded-lg border ${
            claim.status === CLAIM_STATUSES.PAID
              ? 'bg-green-50 border-green-200'
              : claim.status === CLAIM_STATUSES.APPROVED
                ? 'bg-blue-50 border-blue-200'
                : claim.status === CLAIM_STATUSES.DENIED
                  ? 'bg-red-50 border-red-200'
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
                <span className="text-xs font-semibold text-gray-900">
                  {claim.status === CLAIM_STATUSES.PAID
                    ? `Paid: ${formatCurrency(claim.paidAmount)}`
                    : claim.status === CLAIM_STATUSES.APPROVED
                      ? `Approved: ${formatCurrency(claim.paidAmount)} (pending payment)`
                      : claim.status === CLAIM_STATUSES.DENIED
                        ? 'Claim Denied'
                        : claim.status === CLAIM_STATUSES.PARTIALLY_APPROVED
                          ? `Partially Approved: ${formatCurrency(claim.paidAmount)}`
                          : claim.status === CLAIM_STATUSES.APPEALED
                            ? 'Under Appeal'
                            : claim.status === CLAIM_STATUSES.VOIDED
                              ? 'Claim Voided'
                              : 'Pending Processing'}
                </span>
              </div>
              {claim.processedDate && (
                <span className="text-[10px] text-gray-400">
                  Processed: {formatDate(claim.processedDate)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CMS Compliance Notice */}
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
    );
  }

  /**
   * Renders the Audit History tab content.
   */
  function renderAuditHistoryTab() {
    if (auditLogs.length === 0) {
      return (
        <EmptyState
          title="No Audit History"
          description="No audit trail entries have been recorded for this claim."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Audit Trail ({auditLogs.length} entries)
        </p>
        <div>
          {auditLogs.map((entry, index) => (
            <AuditHistoryItem
              key={entry.id || `audit-${index}`}
              entry={entry}
              isLast={index === auditLogs.length - 1}
            />
          ))}
        </div>
      </div>
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    const tabList = [
      {
        key: 'overview',
        label: 'Overview',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
        content: claim ? renderOverviewTab() : null,
      },
      {
        key: 'member_provider',
        label: 'Member & Provider',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        content: claim ? renderMemberProviderTab() : null,
      },
      {
        key: 'adjudication',
        label: 'Adjudication',
        badge: denialReasons.length > 0 ? String(denialReasons.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        content: claim ? renderAdjudicationTab() : null,
      },
    ];

    if (showAuditHistory) {
      tabList.push({
        key: 'audit',
        label: 'Audit History',
        badge: auditLogs.length > 0 ? String(auditLogs.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
        content: claim ? renderAuditHistoryTab() : null,
      });
    }

    return tabList;
  }, [claim, member, provider, enrollment, benefitPackage, diagnosisCodes, denialReasons, denialPreventionWarnings, ruleEvaluation, pricingDetails, auditLogs, showAuditHistory, badgeStatus, bannerStyle, statusLabel, memberName, providerName, conditionCategoryLabel, providerInNetwork]);

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {typeof onClose === 'function' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                iconLeft={
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
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                }
              >
                Back
              </Button>
            )}
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
                  <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-csnp-primary">
                  Claim Details
                </h3>
                {claim && (
                  <p className="text-xs text-gray-500">
                    {claim.claimNumber || ''} · {memberName} · {statusLabel}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadClaimData}
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
      )}

      {/* Loading State */}
      {loading && (
        <ClaimDetailSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load claim details"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadClaimData}
          actionVariant="outline"
        />
      )}

      {/* Claim Data */}
      {!loading && !error && claim && (
        <>
          {/* Denial Alert */}
          {claim.status === CLAIM_STATUSES.DENIED && denialReasons.length > 0 && (
            <Alert
              variant="error"
              title="Claim Denied"
              showIcon={true}
              bordered={true}
              size="sm"
              className="mb-4"
            >
              {denialReasons.length === 1
                ? denialReasons[0]
                : `${denialReasons.length} denial reason(s): ${denialReasons[0]}${denialReasons.length > 1 ? ` and ${denialReasons.length - 1} more` : ''}`}
            </Alert>
          )}

          {/* Appealed Alert */}
          {claim.status === CLAIM_STATUSES.APPEALED && (
            <Alert
              variant="warning"
              title="Claim Under Appeal"
              showIcon={true}
              bordered={true}
              size="sm"
              className="mb-4"
            >
              This claim has been appealed and is pending review. The claim may be reprocessed.
            </Alert>
          )}

          {/* Tabs */}
          <Tabs
            tabs={tabs}
            defaultActiveKey="overview"
            variant="underline"
            size="sm"
            className="mb-4"
          />

          {/* Action Buttons */}
          {showActions && isAuthenticated && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Process */}
                  {canProcess && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleProcess}
                      disabled={actionLoading}
                      loading={actionLoading}
                      loadingText="Processing..."
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
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      }
                    >
                      Process Claim
                    </Button>
                  )}

                  {/* Mark Paid */}
                  {canMarkPaid && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={handleMarkPaid}
                      disabled={actionLoading}
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
                          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                    >
                      Mark Paid
                    </Button>
                  )}

                  {/* Reprocess */}
                  {canReprocess && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleReprocess}
                      disabled={actionLoading}
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
                      Reprocess
                    </Button>
                  )}

                  {/* Appeal */}
                  {canAppeal && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAppeal}
                      disabled={actionLoading}
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
                          <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      }
                    >
                      Appeal
                    </Button>
                  )}

                  {/* Void */}
                  {canVoid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleVoid}
                      disabled={actionLoading}
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
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      }
                    >
                      Void
                    </Button>
                  )}
                </div>

                {/* Status Badge and Summary */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{formatCurrency(claim.billedAmount)} billed</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{formatCurrency(claim.paidAmount)} paid</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{diagnosisCodes.length} code{diagnosisCodes.length !== 1 ? 's' : ''}</span>
                  </div>
                  <StatusBadge
                    status={badgeStatus}
                    size="md"
                    showDot={true}
                    bordered={true}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

ClaimDetail.propTypes = {
  claimId: PropTypes.string.isRequired,
  showHeader: PropTypes.bool,
  showActions: PropTypes.bool,
  showAuditHistory: PropTypes.bool,
  onStatusChange: PropTypes.func,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

ClaimDetail.defaultProps = {
  showHeader: true,
  showActions: true,
  showAuditHistory: true,
  onStatusChange: undefined,
  onClose: undefined,
  className: '',
};