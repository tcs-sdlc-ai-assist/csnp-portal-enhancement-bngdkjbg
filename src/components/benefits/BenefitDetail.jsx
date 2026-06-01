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
import { getBenefits, getMemberBenefitAssignments, listBenefitPackages } from '../../services/benefitsService.js';
import { getAuditLogs } from '../../services/auditLogger.js';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  toTitleCase,
} from '../../utils/helpers.js';
import {
  PLAN_TYPES,
  PLAN_TYPE_LABELS,
  MEDICARE_PARTS,
  MEDICARE_PART_LABELS,
} from '../../utils/constants.js';
import {
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Determines the effective status of a benefit package based on its dates.
 * @param {Object} pkg - The benefit package object
 * @returns {string} Status string: 'active', 'expired', or 'upcoming'
 */
function determineBenefitPackageStatus(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    return 'active';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (pkg.effectiveDate && pkg.terminationDate) {
    try {
      const effective = new Date(pkg.effectiveDate + 'T00:00:00');
      const termination = new Date(pkg.terminationDate + 'T23:59:59');

      if (!isNaN(effective.getTime()) && !isNaN(termination.getTime())) {
        if (today.getTime() < effective.getTime()) {
          return 'upcoming';
        }
        if (today.getTime() > termination.getTime()) {
          return 'expired';
        }
        return 'active';
      }
    } catch {
      return 'active';
    }
  }

  return 'active';
}

/**
 * Maps benefit package status to StatusBadge status.
 * @type {Object.<string, string>}
 */
const STATUS_BADGE_MAP = {
  active: 'active',
  expired: 'expired',
  upcoming: 'pending',
};

/**
 * Status to banner style mapping.
 * @type {Object.<string, { bg: string, border: string }>}
 */
const STATUS_BANNER_STYLES = {
  active: { bg: 'bg-green-50', border: 'border-green-200' },
  expired: { bg: 'bg-orange-50', border: 'border-orange-200' },
  upcoming: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
};

/**
 * Default banner style.
 * @type {{ bg: string, border: string }}
 */
const DEFAULT_BANNER_STYLE = { bg: 'bg-gray-50', border: 'border-gray-200' };

/**
 * Skeleton loading state for the benefit detail.
 * @returns {React.ReactElement}
 */
function BenefitDetailSkeleton() {
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
 * Copay schedule row component.
 *
 * @param {Object} props
 * @param {string} props.serviceKey - Service key
 * @param {Object} props.benefit - Benefit details object
 * @returns {React.ReactElement}
 */
function CopayScheduleRow({ serviceKey, benefit }) {
  if (!benefit || typeof benefit !== 'object') {
    return null;
  }

  const copay = typeof benefit.copay === 'number' ? benefit.copay : null;
  const coinsurance = typeof benefit.coinsurance === 'number' ? benefit.coinsurance : null;
  const description = typeof benefit.description === 'string' ? benefit.description : '';

  const serviceLabel = toTitleCase(serviceKey.replace(/([A-Z])/g, ' $1').trim());

  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-lg">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-700">{serviceLabel}</p>
        {description && (
          <p className="text-[10px] text-gray-500 truncate max-w-[300px]" title={description}>
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        {copay !== null && (
          <span className="text-[10px] font-medium text-csnp-primary bg-csnp-blue-50 px-1.5 py-0.5 rounded">
            ${copay} copay
          </span>
        )}
        {coinsurance !== null && coinsurance > 0 && (
          <span className="text-[10px] font-medium text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded">
            {coinsurance}% coinsurance
          </span>
        )}
        {copay === 0 && (coinsurance === null || coinsurance === 0) && (
          <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
            $0 cost
          </span>
        )}
      </div>
    </div>
  );
}

CopayScheduleRow.propTypes = {
  serviceKey: PropTypes.string.isRequired,
  benefit: PropTypes.shape({
    copay: PropTypes.number,
    coinsurance: PropTypes.number,
    description: PropTypes.string,
  }).isRequired,
};

/**
 * Medicare coverage section component.
 *
 * @param {Object} props
 * @param {Object} props.coverage - Medicare coverage object
 * @returns {React.ReactElement|null}
 */
function MedicareCoverageSection({ coverage }) {
  if (!coverage || typeof coverage !== 'object') {
    return null;
  }

  const label = coverage.label || coverage.partType || 'Unknown Part';
  const items = Array.isArray(coverage.coverageItems) ? coverage.coverageItems : [];

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
      <p className="text-xs font-semibold text-csnp-primary mb-2">{label}</p>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span
              className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center mt-0.5 ${
                item.covered ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'
              }`}
            >
              {item.covered ? (
                <svg
                  width="10"
                  height="10"
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
              ) : (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700">{item.service}</p>
              {item.notes && (
                <p className="text-[10px] text-gray-500">{item.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

MedicareCoverageSection.propTypes = {
  coverage: PropTypes.shape({
    partType: PropTypes.string,
    label: PropTypes.string,
    coverageItems: PropTypes.arrayOf(
      PropTypes.shape({
        service: PropTypes.string,
        covered: PropTypes.bool,
        notes: PropTypes.string,
      })
    ),
  }),
};

MedicareCoverageSection.defaultProps = {
  coverage: null,
};

/**
 * Additional benefits section for a condition category.
 *
 * @param {Object} props
 * @param {string} props.category - Condition category key
 * @param {Object} props.data - Category benefits data
 * @returns {React.ReactElement|null}
 */
function AdditionalBenefitsCategorySection({ category, data }) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const categoryLabel = data.categoryLabel || CONDITION_CATEGORY_LABELS[category] || toTitleCase(category);
  const benefits = Array.isArray(data.benefits) ? data.benefits : [];

  if (benefits.length === 0) {
    return null;
  }

  return (
    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
      <p className="text-xs font-semibold text-green-800 mb-2">{categoryLabel}</p>
      <div className="space-y-1.5">
        {benefits.map((benefit, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span
              className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center mt-0.5 ${
                benefit.included ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'
              }`}
            >
              {benefit.included && (
                <svg
                  width="10"
                  height="10"
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
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700">{benefit.benefit}</p>
              {benefit.description && (
                <p className="text-[10px] text-gray-500">{benefit.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

AdditionalBenefitsCategorySection.propTypes = {
  category: PropTypes.string.isRequired,
  data: PropTypes.shape({
    categoryLabel: PropTypes.string,
    benefits: PropTypes.arrayOf(
      PropTypes.shape({
        benefit: PropTypes.string,
        description: PropTypes.string,
        included: PropTypes.bool,
      })
    ),
  }),
};

AdditionalBenefitsCategorySection.defaultProps = {
  data: null,
};

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
 * Benefit package detail view component.
 * Shows full benefit configuration with all Medicare parts, copay/deductible
 * breakdown, additional benefits, coverage rules, assigned members count,
 * and audit history.
 *
 * @param {Object} props
 * @param {string} props.packageId - The benefit package ID to display
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showActions=true] - Whether to show action buttons
 * @param {boolean} [props.showAuditHistory=true] - Whether to show audit history
 * @param {Function} [props.onEdit] - Callback when edit is clicked: (packageId) => void
 * @param {Function} [props.onClose] - Callback when close/back is clicked
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function BenefitDetail({
  packageId,
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

  const [benefitPackage, setBenefitPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [assignedMembersCount, setAssignedMembersCount] = useState(0);

  /**
   * Loads benefit package data and related records.
   */
  const loadBenefitData = useCallback(() => {
    if (typeof packageId !== 'string' || packageId.trim().length === 0) {
      setError('Benefit package ID is required');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const pkg = getBenefits(packageId.trim());
      if (!pkg) {
        setError(`Benefit package not found: ${packageId.trim()}`);
        setLoading(false);
        return;
      }

      setBenefitPackage(pkg);

      // Count assigned members
      try {
        const storedMembers = localStorage.getItem('csnp_members');
        if (storedMembers) {
          const members = JSON.parse(storedMembers);
          if (Array.isArray(members)) {
            const assignedCount = members.filter(
              (m) => m.benefitPackageId === packageId.trim()
            ).length;
            setAssignedMembersCount(assignedCount);
          }
        }
      } catch {
        setAssignedMembersCount(0);
      }

      // Load audit history
      if (showAuditHistory) {
        try {
          const logs = getAuditLogs({
            targetType: 'benefit_package',
            targetId: packageId.trim(),
          });
          setAuditLogs(Array.isArray(logs) ? logs.slice(0, 20) : []);
        } catch {
          setAuditLogs([]);
        }
      }
    } catch (err) {
      console.error('BenefitDetail: failed to load benefit package data:', err);
      setError('Unable to load benefit package details');
    } finally {
      setLoading(false);
    }
  }, [packageId, showAuditHistory]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadBenefitData();
  }, [loadBenefitData]);

  /**
   * Computed: package status.
   */
  const packageStatus = useMemo(() => {
    return determineBenefitPackageStatus(benefitPackage);
  }, [benefitPackage]);

  /**
   * Computed: badge status.
   */
  const badgeStatus = useMemo(() => {
    return STATUS_BADGE_MAP[packageStatus] || 'pending';
  }, [packageStatus]);

  /**
   * Computed: banner style.
   */
  const bannerStyle = useMemo(() => {
    return STATUS_BANNER_STYLES[packageStatus] || DEFAULT_BANNER_STYLE;
  }, [packageStatus]);

  /**
   * Computed: plan type label.
   */
  const planTypeLabel = useMemo(() => {
    if (!benefitPackage) return '—';
    return PLAN_TYPE_LABELS[benefitPackage.planType] || benefitPackage.planType || '—';
  }, [benefitPackage]);

  /**
   * Computed: eligible condition categories.
   */
  const conditionCategories = useMemo(() => {
    if (!benefitPackage || !Array.isArray(benefitPackage.eligibleConditionCategories)) {
      return [];
    }
    return benefitPackage.eligibleConditionCategories;
  }, [benefitPackage]);

  /**
   * Computed: benefits (copay schedule).
   */
  const benefits = useMemo(() => {
    if (!benefitPackage || !benefitPackage.benefits || typeof benefitPackage.benefits !== 'object') {
      return {};
    }
    return benefitPackage.benefits;
  }, [benefitPackage]);

  /**
   * Computed: benefit keys.
   */
  const benefitKeys = useMemo(() => {
    return Object.keys(benefits);
  }, [benefits]);

  /**
   * Computed: copay schedule from enriched data.
   */
  const copaySchedule = useMemo(() => {
    if (!benefitPackage || !benefitPackage.copaySchedule || typeof benefitPackage.copaySchedule !== 'object') {
      return null;
    }
    return benefitPackage.copaySchedule;
  }, [benefitPackage]);

  /**
   * Computed: deductible info from enriched data.
   */
  const deductibleInfo = useMemo(() => {
    if (!benefitPackage || !benefitPackage.deductibleInfo || typeof benefitPackage.deductibleInfo !== 'object') {
      return {
        annualDeductible: benefitPackage ? (benefitPackage.annualDeductible || 0) : 0,
        maxOutOfPocket: benefitPackage ? (benefitPackage.maxOutOfPocket || 0) : 0,
        monthlyPremium: benefitPackage ? (benefitPackage.monthlyPremium || 0) : 0,
      };
    }
    return benefitPackage.deductibleInfo;
  }, [benefitPackage]);

  /**
   * Computed: additional benefits by category from enriched data.
   */
  const additionalBenefitsByCategory = useMemo(() => {
    if (!benefitPackage || !benefitPackage.additionalBenefitsByCategory || typeof benefitPackage.additionalBenefitsByCategory !== 'object') {
      return {};
    }
    return benefitPackage.additionalBenefitsByCategory;
  }, [benefitPackage]);

  /**
   * Computed: additional benefits category keys.
   */
  const additionalBenefitsCategoryKeys = useMemo(() => {
    return Object.keys(additionalBenefitsByCategory);
  }, [additionalBenefitsByCategory]);

  /**
   * Computed: total additional benefits count.
   */
  const totalAdditionalBenefitsCount = useMemo(() => {
    let count = 0;
    for (const key of additionalBenefitsCategoryKeys) {
      const data = additionalBenefitsByCategory[key];
      if (data && Array.isArray(data.benefits)) {
        count += data.benefits.filter((b) => b.included).length;
      }
    }
    return count;
  }, [additionalBenefitsByCategory, additionalBenefitsCategoryKeys]);

  /**
   * Handles edit action.
   */
  const handleEdit = useCallback(() => {
    if (typeof onEdit === 'function' && benefitPackage) {
      onEdit(benefitPackage.id);
    } else {
      addNotification('info', 'Edit Package', `Edit functionality for "${benefitPackage ? benefitPackage.name : 'package'}" would open the benefit package form.`);
    }
  }, [onEdit, benefitPackage, addNotification]);

  const hasPackageId = typeof packageId === 'string' && packageId.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  if (!hasPackageId) {
    return (
      <div className={containerClassName} {...rest}>
        <EmptyState
          title="No Benefit Package Selected"
          description="Select a benefit package to view its details."
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
                {benefitPackage.name || 'Unnamed Package'}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {benefitPackage.updatedAt ? formatRelativeTime(benefitPackage.updatedAt) : ''}
            </span>
          </div>
        </div>

        {/* Package Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Package ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={benefitPackage.id}>
              {benefitPackage.id ? benefitPackage.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Plan Type</p>
            <p className="text-xs text-gray-700 mt-0.5">{planTypeLabel}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Status</p>
            <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(packageStatus)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Monthly Premium</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {formatCurrency(deductibleInfo.monthlyPremium)}/mo
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Annual Deductible</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {formatCurrency(deductibleInfo.annualDeductible)}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Max Out-of-Pocket</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {formatCurrency(deductibleInfo.maxOutOfPocket)}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Effective Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {benefitPackage.effectiveDate ? formatDate(benefitPackage.effectiveDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Termination Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {benefitPackage.terminationDate ? formatDate(benefitPackage.terminationDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Assigned Members</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {assignedMembersCount} member{assignedMembersCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {benefitPackage.createdAt ? formatDateTime(benefitPackage.createdAt) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Last Updated</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {benefitPackage.updatedAt ? formatDateTime(benefitPackage.updatedAt) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Services Covered</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {benefitKeys.length} service{benefitKeys.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Description */}
        {benefitPackage.description && typeof benefitPackage.description === 'string' && benefitPackage.description.trim().length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {benefitPackage.description}
              </p>
            </div>
          </div>
        )}

        {/* Eligible Condition Categories */}
        {conditionCategories.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Eligible Condition Categories ({conditionCategories.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {conditionCategories.map((category) => (
                <StatusBadge
                  key={category}
                  status="eligible"
                  label={CONDITION_CATEGORY_LABELS[category] || category}
                  size="sm"
                  showDot={false}
                  bordered={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Financial Summary Card */}
        <Card bordered={true} flat={false} variant="primary" size="sm">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-csnp-primary">Financial Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Premium</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {formatCurrency(deductibleInfo.monthlyPremium)}
                </p>
                <p className="text-[10px] text-gray-400">per month</p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Deductible</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {formatCurrency(deductibleInfo.annualDeductible)}
                </p>
                <p className="text-[10px] text-gray-400">per year</p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Max OOP</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {formatCurrency(deductibleInfo.maxOutOfPocket)}
                </p>
                <p className="text-[10px] text-gray-400">per year</p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Annual Cost</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {formatCurrency(deductibleInfo.monthlyPremium * 12)}
                </p>
                <p className="text-[10px] text-gray-400">premium only</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /**
   * Renders the Copay & Coverage tab content.
   */
  function renderCopayTab() {
    return (
      <div className="space-y-4">
        {/* Copay Schedule */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Copay & Coinsurance Schedule ({benefitKeys.length} services)
          </p>
          {benefitKeys.length > 0 ? (
            <div className="space-y-1.5">
              {benefitKeys.map((key) => {
                const benefit = benefits[key];
                if (!benefit || typeof benefit !== 'object') {
                  return null;
                }
                return (
                  <CopayScheduleRow
                    key={key}
                    serviceKey={key}
                    benefit={benefit}
                  />
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-xs text-gray-400">No copay schedule configured for this package.</p>
            </div>
          )}
        </div>

        {/* Copay Schedule from enriched data */}
        {copaySchedule && Object.keys(copaySchedule).length > 0 && Object.keys(copaySchedule).length !== benefitKeys.length && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Enriched Copay Schedule
            </p>
            <div className="space-y-1.5">
              {Object.entries(copaySchedule).map(([key, value]) => {
                if (!value || typeof value !== 'object') {
                  return null;
                }
                return (
                  <CopayScheduleRow
                    key={`enriched-${key}`}
                    serviceKey={key}
                    benefit={value}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Medicare Coverage */}
        {benefitPackage && benefitPackage.medicareCoverage && Array.isArray(benefitPackage.medicareCoverage) && benefitPackage.medicareCoverage.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Medicare Parts Coverage ({benefitPackage.medicareCoverage.length} parts)
            </p>
            <div className="space-y-3">
              {benefitPackage.medicareCoverage.map((coverage, idx) => (
                <MedicareCoverageSection
                  key={coverage.partType || idx}
                  coverage={coverage}
                />
              ))}
            </div>
          </div>
        )}

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
            Copay and coinsurance amounts must comply with CMS maximum out-of-pocket limits
            for C-SNP plans (42 CFR §422.100). All cost-sharing amounts are subject to annual
            CMS review and approval.
          </p>
        </div>
      </div>
    );
  }

  /**
   * Renders the Additional Benefits tab content.
   */
  function renderAdditionalBenefitsTab() {
    return (
      <div className="space-y-4">
        {additionalBenefitsCategoryKeys.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Additional Benefits by Condition Category
              </p>
              {totalAdditionalBenefitsCount > 0 && (
                <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  {totalAdditionalBenefitsCount} included
                </span>
              )}
            </div>
            <div className="space-y-3">
              {additionalBenefitsCategoryKeys.map((category) => (
                <AdditionalBenefitsCategorySection
                  key={category}
                  category={category}
                  data={additionalBenefitsByCategory[category]}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="No Additional Benefits Configured"
            description="Additional benefits are determined by the eligible condition categories assigned to this package."
            iconType="no-data"
            size="sm"
          />
        )}

        {/* Supplemental Benefits Notice */}
        {additionalBenefitsCategoryKeys.length > 0 && (
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
              <span className="font-semibold">Supplemental Benefits:</span>{' '}
              C-SNP plans must include condition-specific supplemental benefits that go beyond
              standard Medicare coverage. These benefits are tailored to the chronic conditions
              covered by this package and are subject to CMS approval.
            </p>
          </div>
        )}
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
          description="No audit trail entries have been recorded for this benefit package."
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
        content: benefitPackage ? renderOverviewTab() : null,
      },
      {
        key: 'copay',
        label: 'Copay & Coverage',
        badge: benefitKeys.length > 0 ? String(benefitKeys.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        content: benefitPackage ? renderCopayTab() : null,
      },
      {
        key: 'additional',
        label: 'Additional Benefits',
        badge: totalAdditionalBenefitsCount > 0 ? String(totalAdditionalBenefitsCount) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
        content: benefitPackage ? renderAdditionalBenefitsTab() : null,
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
        content: benefitPackage ? renderAuditHistoryTab() : null,
      });
    }

    return tabList;
  }, [benefitPackage, benefitKeys, benefits, copaySchedule, deductibleInfo, additionalBenefitsByCategory, additionalBenefitsCategoryKeys, totalAdditionalBenefitsCount, conditionCategories, packageStatus, badgeStatus, bannerStyle, planTypeLabel, assignedMembersCount, auditLogs, showAuditHistory]);

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
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-csnp-primary">
                  Benefit Package Details
                </h3>
                {benefitPackage && (
                  <p className="text-xs text-gray-500">
                    {benefitPackage.name || 'Unnamed Package'} · {planTypeLabel}
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
              onClick={loadBenefitData}
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
        <BenefitDetailSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load benefit package details"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadBenefitData}
          actionVariant="outline"
        />
      )}

      {/* Benefit Package Data */}
      {!loading && !error && benefitPackage && (
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
                    Edit Package
                  </Button>
                </div>

                {/* Status Badge and Summary */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{conditionCategories.length} condition{conditionCategories.length !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{benefitKeys.length} service{benefitKeys.length !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{assignedMembersCount} member{assignedMembersCount !== 1 ? 's' : ''}</span>
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

BenefitDetail.propTypes = {
  packageId: PropTypes.string.isRequired,
  showHeader: PropTypes.bool,
  showActions: PropTypes.bool,
  showAuditHistory: PropTypes.bool,
  onEdit: PropTypes.func,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

BenefitDetail.defaultProps = {
  showHeader: true,
  showActions: true,
  showAuditHistory: true,
  onEdit: undefined,
  onClose: undefined,
  className: '',
};