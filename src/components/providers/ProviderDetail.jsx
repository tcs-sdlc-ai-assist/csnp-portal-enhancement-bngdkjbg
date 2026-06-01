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
import DataTable from '../common/DataTable.jsx';
import {
  getProviderById,
  getMemberProviderAssignments,
  getProviderReferrals,
  getAllProviderAssignmentRecords,
} from '../../services/providerService.js';
import { getAuditLogs } from '../../services/auditLogger.js';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatAddress,
  toTitleCase,
  formatPhone,
} from '../../utils/helpers.js';
import {
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABELS,
} from '../../utils/constants.js';
import {
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Maps referral status to StatusBadge status.
 * @type {Object.<string, string>}
 */
const REFERRAL_STATUS_BADGE_MAP = {
  [REFERRAL_STATUSES.PENDING]: 'pending',
  [REFERRAL_STATUSES.ACCEPTED]: 'accepted',
  [REFERRAL_STATUSES.REJECTED]: 'rejected',
  [REFERRAL_STATUSES.IN_PROGRESS]: 'in_progress',
  [REFERRAL_STATUSES.COMPLETED]: 'completed',
  [REFERRAL_STATUSES.CANCELLED]: 'cancelled',
  [REFERRAL_STATUSES.EXPIRED]: 'expired',
};

/**
 * Determines the contract status display style.
 * @param {Object} provider - The provider object
 * @returns {{ bg: string, border: string }}
 */
function getContractBannerStyle(provider) {
  if (!provider || !provider.contract) {
    return { bg: 'bg-gray-50', border: 'border-gray-200' };
  }

  const inNetwork = provider.inNetwork === true;
  const contractEffective = provider.contractEffective === true;

  if (inNetwork && contractEffective) {
    return { bg: 'bg-green-50', border: 'border-green-200' };
  }
  if (!inNetwork) {
    return { bg: 'bg-orange-50', border: 'border-orange-200' };
  }
  return { bg: 'bg-yellow-50', border: 'border-yellow-200' };
}

/**
 * Skeleton loading state for the provider detail.
 * @returns {React.ReactElement}
 */
function ProviderDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-16 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
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
    approve: { bg: 'bg-green-50', text: 'text-green-600' },
    deny: { bg: 'bg-red-50', text: 'text-red-600' },
    delete: { bg: 'bg-red-50', text: 'text-red-600' },
    referral_create: { bg: 'bg-purple-50', text: 'text-purple-600' },
    referral_update: { bg: 'bg-purple-50', text: 'text-purple-600' },
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
 * Provider detail view component.
 * Shows full provider profile with contract details, assigned members list,
 * referral history, network affiliations, and audit trail.
 *
 * @param {Object} props
 * @param {string} props.providerId - The provider ID to display
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showActions=true] - Whether to show action buttons
 * @param {boolean} [props.showAuditHistory=true] - Whether to show audit history
 * @param {Function} [props.onEdit] - Callback when edit is clicked: (providerId) => void
 * @param {Function} [props.onClose] - Callback when close/back is clicked
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function ProviderDetail({
  providerId,
  showHeader = true,
  showActions = true,
  showAuditHistory = true,
  onEdit,
  onClose,
  className = '',
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignedMembers, setAssignedMembers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  /**
   * Loads provider data and related records.
   */
  const loadProviderData = useCallback(() => {
    if (typeof providerId !== 'string' || providerId.trim().length === 0) {
      setError('Provider ID is required');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const prov = getProviderById(providerId.trim());
      if (!prov) {
        setError(`Provider not found: ${providerId.trim()}`);
        setLoading(false);
        return;
      }

      setProvider(prov);

      // Load assigned members
      try {
        const allAssignments = getAllProviderAssignmentRecords();
        const providerAssignments = allAssignments.filter(
          (a) => a.providerId === providerId.trim() && a.status === 'active'
        );

        // Enrich assignments with member data
        const storedMembers = localStorage.getItem('csnp_members');
        let members = [];
        if (storedMembers) {
          try {
            members = JSON.parse(storedMembers);
          } catch {
            members = [];
          }
        }

        const enrichedAssignments = providerAssignments.map((assignment) => {
          const member = Array.isArray(members)
            ? members.find((m) => m.id === assignment.memberId)
            : null;

          return {
            ...assignment,
            memberName: member
              ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
              : assignment.memberId ? assignment.memberId.substring(0, 12) + '…' : '—',
            memberDateOfBirth: member ? member.dateOfBirth : null,
            memberConditionCategory: member ? member.conditionCategory : null,
            memberConditionCategoryLabel: member && member.conditionCategory
              ? (CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory))
              : '—',
            memberMedicareId: member ? member.medicareId : null,
          };
        });

        setAssignedMembers(enrichedAssignments);
      } catch {
        setAssignedMembers([]);
      }

      // Load referrals
      try {
        const providerReferrals = getProviderReferrals(providerId.trim());
        // Enrich referrals with member and provider names
        const storedMembers = localStorage.getItem('csnp_members');
        const storedProviders = localStorage.getItem('csnp_providers');
        let members = [];
        let providers = [];
        try {
          if (storedMembers) {
            members = JSON.parse(storedMembers);
          }
        } catch {
          members = [];
        }
        try {
          if (storedProviders) {
            providers = JSON.parse(storedProviders);
          }
        } catch {
          providers = [];
        }

        const enrichedReferrals = providerReferrals.map((referral) => {
          const member = Array.isArray(members)
            ? members.find((m) => m.id === referral.memberId)
            : null;
          const referringProvider = Array.isArray(providers)
            ? providers.find((p) => p.id === referral.referringProviderId)
            : null;
          const receivingProvider = Array.isArray(providers)
            ? providers.find((p) => p.id === referral.receivingProviderId)
            : null;

          const isReferring = referral.referringProviderId === providerId.trim();

          return {
            ...referral,
            memberName: member
              ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
              : referral.memberId ? referral.memberId.substring(0, 12) + '…' : '—',
            referringProviderName: referringProvider
              ? `${referringProvider.firstName || ''} ${referringProvider.lastName || ''}`.trim()
              : '—',
            receivingProviderName: receivingProvider
              ? `${receivingProvider.firstName || ''} ${receivingProvider.lastName || ''}`.trim()
              : '—',
            role: isReferring ? 'Referring' : 'Receiving',
            statusLabel: REFERRAL_STATUS_LABELS[referral.status] || toTitleCase(referral.status || 'unknown'),
          };
        });

        setReferrals(enrichedReferrals);
      } catch {
        setReferrals([]);
      }

      // Load audit history
      if (showAuditHistory) {
        try {
          const logs = getAuditLogs({
            targetType: 'provider',
            targetId: providerId.trim(),
          });

          // Also get provider_assignment and referral audit logs
          const assignmentLogs = getAuditLogs({
            targetType: 'provider_assignment',
          }).filter((log) => {
            if (log.metadata && typeof log.metadata === 'object') {
              return log.metadata.providerId === providerId.trim();
            }
            return false;
          });

          const referralLogs = getAuditLogs({
            targetType: 'referral',
          }).filter((log) => {
            if (log.metadata && typeof log.metadata === 'object') {
              return log.metadata.referringProviderId === providerId.trim() ||
                log.metadata.receivingProviderId === providerId.trim();
            }
            return false;
          });

          const allLogs = [...(Array.isArray(logs) ? logs : []), ...assignmentLogs, ...referralLogs];

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
      console.error('ProviderDetail: failed to load provider data:', err);
      setError('Unable to load provider details');
    } finally {
      setLoading(false);
    }
  }, [providerId, showAuditHistory]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadProviderData();
  }, [loadProviderData]);

  /**
   * Computed: banner style.
   */
  const bannerStyle = useMemo(() => {
    return getContractBannerStyle(provider);
  }, [provider]);

  /**
   * Computed: network status label.
   */
  const networkStatusLabel = useMemo(() => {
    if (!provider) return '—';
    return provider.inNetwork ? 'In-Network' : 'Out-of-Network';
  }, [provider]);

  /**
   * Computed: contract status label.
   */
  const contractStatusLabel = useMemo(() => {
    if (!provider || !provider.contract) return '—';
    return toTitleCase(provider.contract.status || 'unknown');
  }, [provider]);

  /**
   * Computed: condition categories.
   */
  const conditionCategories = useMemo(() => {
    if (!provider || !Array.isArray(provider.conditionCategories)) {
      return [];
    }
    return provider.conditionCategories;
  }, [provider]);

  /**
   * Computed: condition category labels from enriched data.
   */
  const conditionCategoryLabels = useMemo(() => {
    if (!provider || !Array.isArray(provider.conditionCategoryLabels)) {
      return conditionCategories.map((c) => ({
        category: c,
        label: CONDITION_CATEGORY_LABELS[c] || c,
      }));
    }
    return provider.conditionCategoryLabels;
  }, [provider, conditionCategories]);

  /**
   * Computed: full provider name.
   */
  const providerFullName = useMemo(() => {
    if (!provider) return '—';
    return `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || '—';
  }, [provider]);

  /**
   * Handles edit action.
   */
  const handleEdit = useCallback(() => {
    if (typeof onEdit === 'function' && provider) {
      onEdit(provider.id);
    } else {
      addNotification('info', 'Edit Provider', `Edit functionality for "${providerFullName}" would open the provider form.`);
    }
  }, [onEdit, provider, providerFullName, addNotification]);

  const hasProviderId = typeof providerId === 'string' && providerId.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  if (!hasProviderId) {
    return (
      <div className={containerClassName} {...rest}>
        <EmptyState
          title="No Provider Selected"
          description="Select a provider to view their details."
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
                status={provider.inNetwork ? 'active' : 'expired'}
                label={networkStatusLabel}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">
                {providerFullName}, {provider.specialty || ''}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {provider.updatedAt ? formatRelativeTime(provider.updatedAt) : ''}
            </span>
          </div>
        </div>

        {/* Provider Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Provider ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={provider.id}>
              {provider.id ? provider.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">NPI</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5">{provider.npi || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Specialty</p>
            <p className="text-xs text-gray-700 mt-0.5">{provider.specialty || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Facility</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate" title={provider.facilityName}>
              {provider.facilityName || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Email</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate" title={provider.email}>
              {provider.email || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Phone</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {provider.phone ? formatPhone(provider.phone) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Accepting Patients</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {provider.acceptingNewPatients ? (
                <span className="text-green-700 font-medium">Yes</span>
              ) : (
                <span className="text-red-700 font-medium">No</span>
              )}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Network Status</p>
            <p className="text-xs text-gray-700 mt-0.5">{networkStatusLabel}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Active Patients</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {typeof provider.activePatientCount === 'number' ? provider.activePatientCount : assignedMembers.length} member{(typeof provider.activePatientCount === 'number' ? provider.activePatientCount : assignedMembers.length) !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Referrals (Receiving)</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {typeof provider.activeReferralsReceivingCount === 'number' ? provider.activeReferralsReceivingCount : 0}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Referrals (Referring)</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {typeof provider.activeReferralsReferringCount === 'number' ? provider.activeReferralsReferringCount : 0}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {provider.createdAt ? formatDateTime(provider.createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* Address */}
        {provider.address && typeof provider.address === 'object' && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Practice Address</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {formatAddress(provider.address) || '—'}
            </p>
          </div>
        )}

        {/* Condition Categories */}
        {conditionCategoryLabels.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Condition Categories ({conditionCategoryLabels.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {conditionCategoryLabels.map((item) => (
                <StatusBadge
                  key={item.category}
                  status="eligible"
                  label={item.label}
                  size="sm"
                  showDot={false}
                  bordered={true}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Contract Details tab content.
   */
  function renderContractTab() {
    if (!provider || !provider.contract || typeof provider.contract !== 'object') {
      return (
        <EmptyState
          title="No Contract Information"
          description="No contract details are available for this provider."
          iconType="no-data"
          size="sm"
        />
      );
    }

    const contract = provider.contract;

    return (
      <div className="space-y-4">
        {/* Contract Status Banner */}
        <div className={`p-3 rounded-lg border ${bannerStyle.bg} ${bannerStyle.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={contract.status === 'active' ? 'active' : 'expired'}
                label={contractStatusLabel}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">
                {contract.contractType || 'Unknown Type'}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {provider.contractEffective ? 'Contract Effective' : 'Contract Not Effective'}
            </span>
          </div>
        </div>

        {/* Contract Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Contract ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={contract.contractId}>
              {contract.contractId || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Contract Type</p>
            <p className="text-xs text-gray-700 mt-0.5">{contract.contractType || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Contract Status</p>
            <p className="text-xs text-gray-700 mt-0.5">{contractStatusLabel}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Reimbursement Model</p>
            <p className="text-xs text-gray-700 mt-0.5">{contract.reimbursementRate || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Effective Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {contract.effectiveDate ? formatDate(contract.effectiveDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Termination Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {contract.terminationDate ? formatDate(contract.terminationDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Contract Effective</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {provider.contractEffective ? (
                <span className="text-green-700 font-medium">Yes</span>
              ) : (
                <span className="text-red-700 font-medium">No</span>
              )}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Network Status</p>
            <p className="text-xs text-gray-700 mt-0.5">{networkStatusLabel}</p>
          </div>
        </div>

        {/* Network Affiliations */}
        <Card bordered={true} flat={false} variant="primary" size="sm">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-csnp-primary">Network Affiliations</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Network Type</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {contract.contractType || '—'}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Specialty</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {provider.specialty || '—'}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Conditions Served</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">
                  {conditionCategories.length} categor{conditionCategories.length !== 1 ? 'ies' : 'y'}
                </p>
              </div>
            </div>

            {conditionCategoryLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {conditionCategoryLabels.map((item) => (
                  <StatusBadge
                    key={item.category}
                    status="eligible"
                    label={item.label}
                    size="sm"
                    showDot={false}
                    bordered={true}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

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
            Provider contracts must comply with CMS network adequacy requirements (42 CFR §422.116).
            All providers must have valid NPI numbers, active contracts within effective date ranges,
            and appropriate specialty coverage for the chronic conditions served by the plan.
          </p>
        </div>
      </div>
    );
  }

  /**
   * Assigned members table columns.
   */
  const assignedMembersColumns = useMemo(() => {
    return [
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
        key: 'memberConditionCategoryLabel',
        label: 'Condition',
        sortable: true,
        searchable: true,
        width: 'min-w-[140px]',
        render: (value) => {
          if (!value || value === '—') {
            return <span className="text-gray-400 text-xs">—</span>;
          }
          return (
            <span className="text-xs text-gray-700 truncate max-w-[160px]" title={value}>
              {value}
            </span>
          );
        },
      },
      {
        key: 'assignmentType',
        label: 'Type',
        sortable: true,
        searchable: false,
        width: 'min-w-[80px]',
        render: (value) => {
          return (
            <span className="text-xs text-gray-700">
              {value ? toTitleCase(value) : '—'}
            </span>
          );
        },
      },
      {
        key: 'createdAt',
        label: 'Assigned',
        sortable: true,
        searchable: false,
        width: 'min-w-[110px]',
        render: (value) => {
          if (!value) {
            return <span className="text-gray-400">—</span>;
          }
          return (
            <div>
              <p className="text-xs text-gray-700">{formatDate(value)}</p>
              <p className="text-[10px] text-gray-400">{formatRelativeTime(value)}</p>
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        searchable: false,
        width: 'min-w-[90px]',
        render: (value) => {
          const badgeStatus = value === 'active' ? 'active' : 'expired';
          return (
            <StatusBadge
              status={badgeStatus}
              label={toTitleCase(value || 'unknown')}
              size="sm"
              showDot={true}
              bordered={true}
            />
          );
        },
      },
    ];
  }, []);

  /**
   * Renders the Assigned Members tab content.
   */
  function renderAssignedMembersTab() {
    if (assignedMembers.length === 0) {
      return (
        <EmptyState
          title="No Assigned Members"
          description="No members are currently assigned to this provider."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Assigned Members ({assignedMembers.length})
          </p>
        </div>

        <DataTable
          data={assignedMembers}
          columns={assignedMembersColumns}
          loading={false}
          searchable={true}
          searchPlaceholder="Search by member name, condition..."
          paginated={true}
          initialPageSize={10}
          initialSortField="memberName"
          initialSortDirection="asc"
          emptyMessage="No assigned members found"
          emptyDescription="No members match the current search criteria."
          idKey="id"
          className=""
        />
      </div>
    );
  }

  /**
   * Referral history table columns.
   */
  const referralColumns = useMemo(() => {
    return [
      {
        key: 'memberName',
        label: 'Member',
        sortable: true,
        searchable: true,
        width: 'min-w-[140px]',
        render: (value) => {
          return (
            <span className="text-xs font-semibold text-gray-900 truncate max-w-[160px]" title={value}>
              {value || '—'}
            </span>
          );
        },
      },
      {
        key: 'role',
        label: 'Role',
        sortable: true,
        searchable: false,
        width: 'min-w-[90px]',
        render: (value) => {
          const isReferring = value === 'Referring';
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
              isReferring
                ? 'text-blue-700 bg-blue-50 border-blue-200'
                : 'text-purple-700 bg-purple-50 border-purple-200'
            }`}>
              {value || '—'}
            </span>
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
          const badgeStatus = REFERRAL_STATUS_BADGE_MAP[value] || 'pending';
          return (
            <StatusBadge
              status={badgeStatus}
              label={REFERRAL_STATUS_LABELS[value] || toTitleCase(value || 'unknown')}
              size="sm"
              showDot={true}
              bordered={true}
            />
          );
        },
      },
      {
        key: 'reason',
        label: 'Reason',
        sortable: false,
        searchable: true,
        width: 'min-w-[180px]',
        render: (value) => {
          if (!value) {
            return <span className="text-gray-400 text-xs">—</span>;
          }
          return (
            <p className="text-xs text-gray-700 truncate max-w-[220px]" title={value}>
              {value}
            </p>
          );
        },
      },
      {
        key: 'urgency',
        label: 'Urgency',
        sortable: true,
        searchable: false,
        width: 'min-w-[80px]',
        render: (value) => {
          if (!value) {
            return <span className="text-gray-400 text-xs">—</span>;
          }

          const urgencyColors = {
            routine: 'text-gray-600 bg-gray-50 border-gray-200',
            urgent: 'text-orange-700 bg-orange-50 border-orange-200',
            emergent: 'text-red-700 bg-red-50 border-red-200',
          };

          const colorClass = urgencyColors[value] || urgencyColors.routine;

          return (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorClass}`}>
              {toTitleCase(value)}
            </span>
          );
        },
      },
      {
        key: 'referralDate',
        label: 'Date',
        sortable: true,
        searchable: false,
        width: 'min-w-[100px]',
        render: (value) => {
          if (!value) {
            return <span className="text-gray-400">—</span>;
          }
          return (
            <span className="text-xs text-gray-700">{formatDate(value)}</span>
          );
        },
      },
    ];
  }, []);

  /**
   * Renders the Referral History tab content.
   */
  function renderReferralHistoryTab() {
    if (referrals.length === 0) {
      return (
        <EmptyState
          title="No Referral History"
          description="No referrals have been created for or by this provider."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Referral History ({referrals.length})
          </p>
          <div className="flex items-center gap-3">
            {referrals.filter((r) => r.role === 'Referring').length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-blue-700">
                  {referrals.filter((r) => r.role === 'Referring').length} referring
                </span>
              </div>
            )}
            {referrals.filter((r) => r.role === 'Receiving').length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-purple-700">
                  {referrals.filter((r) => r.role === 'Receiving').length} receiving
                </span>
              </div>
            )}
          </div>
        </div>

        <DataTable
          data={referrals}
          columns={referralColumns}
          loading={false}
          searchable={true}
          searchPlaceholder="Search by member, reason, status..."
          paginated={true}
          initialPageSize={10}
          initialSortField="referralDate"
          initialSortDirection="desc"
          emptyMessage="No referrals found"
          emptyDescription="No referrals match the current search criteria."
          idKey="id"
          className=""
        />
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
          description="No audit trail entries have been recorded for this provider."
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
        content: provider ? renderOverviewTab() : null,
      },
      {
        key: 'contract',
        label: 'Contract & Network',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        content: provider ? renderContractTab() : null,
      },
      {
        key: 'members',
        label: 'Assigned Members',
        badge: assignedMembers.length > 0 ? String(assignedMembers.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        content: provider ? renderAssignedMembersTab() : null,
      },
      {
        key: 'referrals',
        label: 'Referral History',
        badge: referrals.length > 0 ? String(referrals.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        ),
        content: provider ? renderReferralHistoryTab() : null,
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
        content: provider ? renderAuditHistoryTab() : null,
      });
    }

    return tabList;
  }, [provider, assignedMembers, referrals, auditLogs, showAuditHistory, bannerStyle, networkStatusLabel, contractStatusLabel, conditionCategoryLabels, conditionCategories, providerFullName, assignedMembersColumns, referralColumns]);

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
                  <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-csnp-primary">
                  Provider Details
                </h3>
                {provider && (
                  <p className="text-xs text-gray-500">
                    {providerFullName} · {provider.specialty || ''} · NPI: {provider.npi || '—'}
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
              onClick={loadProviderData}
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
        <ProviderDetailSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load provider details"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadProviderData}
          actionVariant="outline"
        />
      )}

      {/* Provider Data */}
      {!loading && !error && provider && (
        <>
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
                  {/* Edit */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleEdit}
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
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    }
                  >
                    Edit Provider
                  </Button>
                </div>

                {/* Status Badge and Summary */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{provider.specialty || 'No specialty'}</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{networkStatusLabel}</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{assignedMembers.length} member{assignedMembers.length !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{referrals.length} referral{referrals.length !== 1 ? 's' : ''}</span>
                  </div>
                  <StatusBadge
                    status={provider.inNetwork ? 'active' : 'expired'}
                    label={networkStatusLabel}
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

ProviderDetail.propTypes = {
  providerId: PropTypes.string.isRequired,
  showHeader: PropTypes.bool,
  showActions: PropTypes.bool,
  showAuditHistory: PropTypes.bool,
  onEdit: PropTypes.func,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

ProviderDetail.defaultProps = {
  showHeader: true,
  showActions: true,
  showAuditHistory: true,
  onEdit: undefined,
  onClose: undefined,
  className: '',
};