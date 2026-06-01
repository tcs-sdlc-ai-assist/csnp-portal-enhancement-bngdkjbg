import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import DataTable from '../common/DataTable.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import Modal from '../common/Modal.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import Card from '../common/Card.jsx';
import { listBenefitPackages, configureBenefits, getBenefits, deactivateBenefitAssignment, getBenefitStats } from '../../services/benefitsService.js';
import { formatDate, formatRelativeTime, formatDateTime, formatCurrency, toTitleCase } from '../../utils/helpers.js';
import { CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { PLAN_TYPE_LABELS, PLAN_TYPES } from '../../utils/constants.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Plan type filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const PLAN_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Plan Types' },
  ...Object.entries(PLAN_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

/**
 * Status filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'upcoming', label: 'Upcoming' },
];

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
 * Builds a CSV string from benefit package records.
 * @param {Object[]} records - Array of benefit package records
 * @returns {string} CSV string
 */
function buildCSVExport(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  const headers = [
    'Package ID',
    'Name',
    'Plan Type',
    'Description',
    'Status',
    'Effective Date',
    'Termination Date',
    'Monthly Premium',
    'Annual Deductible',
    'Max Out-of-Pocket',
    'Eligible Condition Categories',
    'Created At',
    'Updated At',
  ];

  const rows = records.map((record) => [
    record.id || '',
    record.name || '',
    record.planType || '',
    record.description || '',
    record._status || '',
    record.effectiveDate || '',
    record.terminationDate || '',
    typeof record.monthlyPremium === 'number' ? record.monthlyPremium.toFixed(2) : '0.00',
    typeof record.annualDeductible === 'number' ? record.annualDeductible.toFixed(2) : '0.00',
    typeof record.maxOutOfPocket === 'number' ? record.maxOutOfPocket.toFixed(2) : '0.00',
    Array.isArray(record.eligibleConditionCategories)
      ? record.eligibleConditionCategories.map((c) => CONDITION_CATEGORY_LABELS[c] || c).join('; ')
      : '',
    record.createdAt || '',
    record.updatedAt || '',
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
    console.error('BenefitPackageList: failed to download file:', err);
  }
}

/**
 * Benefit package detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.pkg - The benefit package to display
 * @returns {React.ReactElement|null}
 */
function BenefitPackageDetailModal({ isOpen, onClose, pkg }) {
  if (!pkg) {
    return null;
  }

  const status = determineBenefitPackageStatus(pkg);
  const badgeStatus = STATUS_BADGE_MAP[status] || 'pending';
  const planTypeLabel = PLAN_TYPE_LABELS[pkg.planType] || pkg.planType || '—';
  const conditionCategories = Array.isArray(pkg.eligibleConditionCategories)
    ? pkg.eligibleConditionCategories
    : [];

  const benefits = pkg.benefits && typeof pkg.benefits === 'object' ? pkg.benefits : {};
  const benefitKeys = Object.keys(benefits);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Benefit Package Details"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${
          status === 'active'
            ? 'bg-green-50 border-green-200'
            : status === 'expired'
              ? 'bg-orange-50 border-orange-200'
              : 'bg-yellow-50 border-yellow-200'
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
                {pkg.name || 'Unnamed Package'}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {pkg.updatedAt ? formatRelativeTime(pkg.updatedAt) : ''}
            </span>
          </div>
        </div>

        {/* Package Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Package ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={pkg.id}>
              {pkg.id ? pkg.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Plan Type</p>
            <p className="text-xs text-gray-700 mt-0.5">{planTypeLabel}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Status</p>
            <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(status)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Monthly Premium</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {formatCurrency(pkg.monthlyPremium)}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Annual Deductible</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {formatCurrency(pkg.annualDeductible)}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Max Out-of-Pocket</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {formatCurrency(pkg.maxOutOfPocket)}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Effective Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {pkg.effectiveDate ? formatDate(pkg.effectiveDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Termination Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {pkg.terminationDate ? formatDate(pkg.terminationDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {pkg.createdAt ? formatDateTime(pkg.createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* Description */}
        {pkg.description && typeof pkg.description === 'string' && pkg.description.trim().length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {pkg.description}
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

        {/* Copay & Coinsurance Schedule */}
        {benefitKeys.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Copay & Coinsurance Schedule ({benefitKeys.length} services)
            </p>
            <div className="space-y-1.5">
              {benefitKeys.map((key) => {
                const benefit = benefits[key];
                if (!benefit || typeof benefit !== 'object') {
                  return null;
                }

                const copay = typeof benefit.copay === 'number' ? benefit.copay : null;
                const coinsurance = typeof benefit.coinsurance === 'number' ? benefit.coinsurance : null;
                const description = typeof benefit.description === 'string' ? benefit.description : '';

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-700">
                        {toTitleCase(key.replace(/([A-Z])/g, ' $1').trim())}
                      </p>
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

BenefitPackageDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  pkg: PropTypes.object,
};

BenefitPackageDetailModal.defaultProps = {
  pkg: null,
};

/**
 * Benefit packages list component.
 * Displays all configured benefit packages with condition, plan type,
 * copay/deductible summary, effective dates, and status.
 * Supports search, filter by plan type/status, and row actions
 * (view, edit, clone, deactivate).
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Benefit Packages'] - Section title
 * @param {boolean} [props.showExport=true] - Whether to show the export button
 * @param {boolean} [props.showStats=true] - Whether to show summary statistics
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.initialPageSize=20] - Initial page size
 * @param {string} [props.filterPlanType] - Pre-set plan type filter
 * @param {string} [props.filterConditionCategory] - Pre-set condition category filter
 * @param {Function} [props.onRecordSelect] - Callback when a record is selected: (record) => void
 * @param {Function} [props.onEdit] - Callback when edit is clicked: (record) => void
 * @param {Function} [props.onClone] - Callback when clone is clicked: (record) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function BenefitPackageList({
  showHeader = true,
  title = 'Benefit Packages',
  showExport = true,
  showStats = true,
  compact = false,
  initialPageSize = 20,
  filterPlanType: initialFilterPlanType,
  filterConditionCategory,
  onRecordSelect,
  onEdit,
  onClone,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planTypeFilter, setPlanTypeFilter] = useState(initialFilterPlanType || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [cloneProcessing, setCloneProcessing] = useState(false);

  /**
   * Loads benefit packages from the benefits service.
   */
  const loadData = useCallback(() => {
    setError(null);
    setLoading(true);

    try {
      const filters = {};

      if (filterConditionCategory && typeof filterConditionCategory === 'string' && filterConditionCategory.trim().length > 0) {
        filters.conditionCategory = filterConditionCategory.trim();
      }

      const allPackages = listBenefitPackages(filters);
      setPackages(Array.isArray(allPackages) ? allPackages : []);
    } catch (err) {
      console.error('BenefitPackageList: failed to load data:', err);
      setError('Unable to load benefit packages');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [filterConditionCategory]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Enriched packages with computed status and display fields.
   */
  const enrichedPackages = useMemo(() => {
    return packages.map((pkg) => {
      const status = determineBenefitPackageStatus(pkg);
      const planTypeLabel = PLAN_TYPE_LABELS[pkg.planType] || pkg.planType || '—';

      const conditionCategories = Array.isArray(pkg.eligibleConditionCategories)
        ? pkg.eligibleConditionCategories
        : [];

      const conditionLabels = conditionCategories
        .map((c) => CONDITION_CATEGORY_LABELS[c] || c)
        .join(', ');

      const conditionLabelsShort = conditionCategories.length > 2
        ? `${conditionCategories.slice(0, 2).map((c) => CONDITION_CATEGORY_LABELS[c] || c).join(', ')} +${conditionCategories.length - 2} more`
        : conditionLabels;

      const benefits = pkg.benefits && typeof pkg.benefits === 'object' ? pkg.benefits : {};
      const benefitCount = Object.keys(benefits).length;

      const copayRange = [];
      for (const [, value] of Object.entries(benefits)) {
        if (value && typeof value === 'object' && typeof value.copay === 'number') {
          copayRange.push(value.copay);
        }
      }

      let copayDisplay = '—';
      if (copayRange.length > 0) {
        const minCopay = Math.min(...copayRange);
        const maxCopay = Math.max(...copayRange);
        if (minCopay === maxCopay) {
          copayDisplay = `$${minCopay}`;
        } else {
          copayDisplay = `$${minCopay} – $${maxCopay}`;
        }
      }

      return {
        ...pkg,
        _status: status,
        _planTypeLabel: planTypeLabel,
        _conditionLabels: conditionLabels,
        _conditionLabelsShort: conditionLabelsShort,
        _conditionCount: conditionCategories.length,
        _benefitCount: benefitCount,
        _copayDisplay: copayDisplay,
      };
    });
  }, [packages]);

  /**
   * Filtered records based on plan type and status filters.
   */
  const filteredRecords = useMemo(() => {
    let filtered = enrichedPackages;

    if (planTypeFilter && planTypeFilter.trim().length > 0) {
      filtered = filtered.filter((r) => r.planType === planTypeFilter.trim());
    }

    if (statusFilter && statusFilter.trim().length > 0) {
      filtered = filtered.filter((r) => r._status === statusFilter.trim());
    }

    return filtered;
  }, [enrichedPackages, planTypeFilter, statusFilter]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const total = packages.length;
    const active = enrichedPackages.filter((p) => p._status === 'active').length;
    const expired = enrichedPackages.filter((p) => p._status === 'expired').length;
    const upcoming = enrichedPackages.filter((p) => p._status === 'upcoming').length;

    const byPlanType = {};
    for (const pkg of packages) {
      const pt = pkg.planType || 'unknown';
      if (!byPlanType[pt]) {
        byPlanType[pt] = 0;
      }
      byPlanType[pt]++;
    }

    return { total, active, expired, upcoming, byPlanType };
  }, [packages, enrichedPackages]);

  /**
   * Handles viewing a record's details.
   * @param {Object} record - The benefit package record
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
   * Handles edit action.
   * @param {Object} record - The benefit package record
   */
  const handleEdit = useCallback((record) => {
    if (typeof onEdit === 'function') {
      onEdit(record);
    } else {
      addNotification('info', 'Edit Package', `Edit functionality for "${record.name}" would open the benefit package form.`);
    }
  }, [onEdit, addNotification]);

  /**
   * Handles clone action.
   * @param {Object} record - The benefit package record to clone
   */
  const handleClone = useCallback((record) => {
    if (typeof onClone === 'function') {
      onClone(record);
      return;
    }

    setCloneProcessing(true);

    try {
      const performedBy = user ? user.id : 'system';

      const cloneData = {
        name: `${record.name} (Copy)`,
        planType: record.planType || PLAN_TYPES.C_SNP,
        description: record.description || '',
        effectiveDate: record.effectiveDate || '',
        terminationDate: record.terminationDate || '',
        benefits: record.benefits || {},
        eligibleConditionCategories: Array.isArray(record.eligibleConditionCategories)
          ? [...record.eligibleConditionCategories]
          : [],
        monthlyPremium: typeof record.monthlyPremium === 'number' ? record.monthlyPremium : 0,
        annualDeductible: typeof record.annualDeductible === 'number' ? record.annualDeductible : 0,
        maxOutOfPocket: typeof record.maxOutOfPocket === 'number' ? record.maxOutOfPocket : 0,
      };

      const result = configureBenefits(cloneData, { performedBy });

      if (result.success) {
        addNotification(
          'success',
          'Package Cloned',
          `Benefit package "${record.name}" has been cloned successfully as "${cloneData.name}".`
        );
        loadData();
      } else {
        addNotification(
          'error',
          'Clone Failed',
          result.error || 'An error occurred while cloning the benefit package.'
        );
      }
    } catch (err) {
      console.error('BenefitPackageList: clone error:', err);
      addNotification('error', 'Clone Error', 'An unexpected error occurred while cloning the benefit package.');
    } finally {
      setCloneProcessing(false);
    }
  }, [onClone, user, addNotification, loadData]);

  /**
   * Handles deactivate action initiation.
   * @param {Object} record - The benefit package record to deactivate
   */
  const handleDeactivateInit = useCallback((record) => {
    setDeactivateTarget(record);
    setDeactivateDialogOpen(true);
  }, []);

  /**
   * Confirms and executes deactivation.
   */
  const handleConfirmDeactivate = useCallback(() => {
    if (!deactivateTarget) {
      return;
    }

    setDeactivateDialogOpen(false);

    try {
      const performedBy = user ? user.id : 'system';

      // Update the package termination date to today to effectively deactivate it
      const today = new Date().toISOString().split('T')[0];

      const updateData = {
        id: deactivateTarget.id,
        name: deactivateTarget.name,
        description: deactivateTarget.description || '',
        effectiveDate: deactivateTarget.effectiveDate || '',
        terminationDate: today,
        benefits: deactivateTarget.benefits || {},
        eligibleConditionCategories: Array.isArray(deactivateTarget.eligibleConditionCategories)
          ? [...deactivateTarget.eligibleConditionCategories]
          : [],
        monthlyPremium: typeof deactivateTarget.monthlyPremium === 'number' ? deactivateTarget.monthlyPremium : 0,
        annualDeductible: typeof deactivateTarget.annualDeductible === 'number' ? deactivateTarget.annualDeductible : 0,
        maxOutOfPocket: typeof deactivateTarget.maxOutOfPocket === 'number' ? deactivateTarget.maxOutOfPocket : 0,
      };

      const result = configureBenefits(updateData, { performedBy });

      if (result.success) {
        addNotification(
          'success',
          'Package Deactivated',
          `Benefit package "${deactivateTarget.name}" has been deactivated. Termination date set to ${formatDate(today)}.`
        );
        loadData();
      } else {
        addNotification(
          'error',
          'Deactivation Failed',
          result.error || 'An error occurred while deactivating the benefit package.'
        );
      }
    } catch (err) {
      console.error('BenefitPackageList: deactivate error:', err);
      addNotification('error', 'Deactivation Error', 'An unexpected error occurred while deactivating the benefit package.');
    } finally {
      setDeactivateTarget(null);
    }
  }, [deactivateTarget, user, addNotification, loadData]);

  /**
   * Handles plan type filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handlePlanTypeFilterChange = useCallback((e) => {
    setPlanTypeFilter(e.target.value);
  }, []);

  /**
   * Handles status filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleStatusFilterChange = useCallback((e) => {
    setStatusFilter(e.target.value);
  }, []);

  /**
   * Handles exporting benefit packages as CSV.
   */
  const handleExportCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No benefit packages to export.');
      return;
    }

    try {
      const csv = buildCSVExport(filteredRecords);
      const filename = `benefit_packages_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} benefit package(s) to CSV.`);
    } catch (err) {
      console.error('BenefitPackageList: export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting benefit packages.');
    }
  }, [filteredRecords, addNotification]);

  /**
   * Handles exporting benefit packages as JSON.
   */
  const handleExportJSON = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No benefit packages to export.');
      return;
    }

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalRecords: filteredRecords.length,
        filters: {
          planType: planTypeFilter || 'all',
          status: statusFilter || 'all',
        },
        records: filteredRecords.map(({ _status, _planTypeLabel, _conditionLabels, _conditionLabelsShort, _conditionCount, _benefitCount, _copayDisplay, ...rest }) => rest),
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `benefit_packages_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} benefit package(s) to JSON.`);
    } catch (err) {
      console.error('BenefitPackageList: JSON export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting benefit packages.');
    }
  }, [filteredRecords, planTypeFilter, statusFilter, addNotification]);

  /**
   * Table columns definition.
   */
  const columns = useMemo(() => {
    const cols = [
      {
        key: 'name',
        label: 'Package Name',
        sortable: true,
        searchable: true,
        width: 'min-w-[180px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate max-w-[200px]" title={value}>
                {value || 'Unnamed Package'}
              </p>
              <p className="text-[10px] text-gray-500 truncate" title={row.id}>
                {row.id ? row.id.substring(0, 12) + '…' : '—'}
              </p>
            </div>
          );
        },
      },
      {
        key: '_planTypeLabel',
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
      },
      {
        key: '_status',
        label: 'Status',
        sortable: true,
        searchable: false,
        width: 'min-w-[100px]',
        render: (value) => {
          const badgeStatus = STATUS_BADGE_MAP[value] || 'pending';
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
      {
        key: '_conditionLabelsShort',
        label: 'Conditions',
        sortable: false,
        searchable: true,
        width: 'min-w-[160px]',
        render: (value, row) => {
          if (!value || row._conditionCount === 0) {
            return <span className="text-gray-400 text-xs">—</span>;
          }
          return (
            <div className="min-w-0">
              <p className="text-xs text-gray-700 truncate max-w-[180px]" title={row._conditionLabels}>
                {value}
              </p>
              <p className="text-[10px] text-gray-400">
                {row._conditionCount} categor{row._conditionCount !== 1 ? 'ies' : 'y'}
              </p>
            </div>
          );
        },
      },
      {
        key: '_copayDisplay',
        label: 'Copay Range',
        sortable: false,
        searchable: false,
        width: 'min-w-[100px]',
        render: (value) => {
          return (
            <span className="text-xs font-medium text-gray-700">
              {value || '—'}
            </span>
          );
        },
      },
    ];

    if (!compact) {
      cols.push({
        key: 'monthlyPremium',
        label: 'Premium',
        sortable: true,
        searchable: false,
        width: 'min-w-[90px]',
        align: 'right',
        render: (value) => {
          return (
            <span className="text-xs font-medium text-gray-700">
              {formatCurrency(value)}/mo
            </span>
          );
        },
      });

      cols.push({
        key: 'maxOutOfPocket',
        label: 'Max OOP',
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
      });

      cols.push({
        key: 'effectiveDate',
        label: 'Effective',
        sortable: true,
        searchable: false,
        width: 'min-w-[110px]',
        render: (value, row) => {
          if (!value) {
            return <span className="text-gray-400">—</span>;
          }
          return (
            <div>
              <p className="text-xs text-gray-700">{formatDate(value)}</p>
              {row.terminationDate && (
                <p className="text-[10px] text-gray-400">to {formatDate(row.terminationDate)}</p>
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
    const actionList = [
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

    if (isAuthenticated) {
      actionList.push({
        label: 'Edit',
        onClick: (row) => handleEdit(row),
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
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
      });

      actionList.push({
        label: 'Clone',
        onClick: (row) => handleClone(row),
        variant: 'ghost',
        size: 'sm',
        disabled: () => cloneProcessing,
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
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        ),
      });

      actionList.push({
        label: 'Deactivate',
        onClick: (row) => handleDeactivateInit(row),
        variant: 'ghost',
        size: 'sm',
        visible: (row) => row._status === 'active',
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
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
      });
    }

    return actionList;
  }, [isAuthenticated, handleViewDetails, handleEdit, handleClone, handleDeactivateInit, cloneProcessing]);

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
              {/* Benefits icon */}
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
              {hasTitle && (
                <h3 className="text-lg font-semibold text-csnp-primary">
                  {title}
                </h3>
              )}
              {!loading && packages.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {packages.length} package{packages.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Plan Type Filter */}
              <select
                value={planTypeFilter}
                onChange={handlePlanTypeFilterChange}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                aria-label="Filter by plan type"
              >
                {PLAN_TYPE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

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
          {showStats && !loading && !error && packages.length > 0 && !compact && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-green-700">
                  {stats.active} active
                </span>
              </div>
              {stats.expired > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-orange-700">
                    {stats.expired} expired
                  </span>
                </div>
              )}
              {stats.upcoming > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-yellow-700">
                    {stats.upcoming} upcoming
                  </span>
                </div>
              )}
              {Object.entries(stats.byPlanType).map(([planType, count]) => (
                <div key={planType} className="flex items-center gap-1.5 px-2.5 py-1 bg-csnp-blue-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-csnp-primary" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-csnp-primary">
                    {count} {PLAN_TYPE_LABELS[planType] || planType}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <LoadingSpinner
          size="md"
          variant="primary"
          text="Loading benefit packages..."
        />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load benefit packages"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadData}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && packages.length === 0 && (
        <EmptyState
          title="No Benefit Packages"
          description="No benefit packages have been configured yet. Create a new benefit package to get started."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Filtered Empty State */}
      {!loading && !error && packages.length > 0 && filteredRecords.length === 0 && (
        <EmptyState
          title="No Matching Packages"
          description={`No benefit packages match the selected filters${planTypeFilter ? ` (Plan Type: ${PLAN_TYPE_LABELS[planTypeFilter] || toTitleCase(planTypeFilter)})` : ''}${statusFilter ? ` (Status: ${toTitleCase(statusFilter)})` : ''}.`}
          iconType="no-results"
          size="sm"
          actionLabel="Clear Filters"
          onAction={() => {
            setPlanTypeFilter('');
            setStatusFilter('');
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
          searchPlaceholder="Search by name, plan type, condition..."
          paginated={true}
          initialPageSize={initialPageSize}
          initialSortField="name"
          initialSortDirection="asc"
          emptyMessage="No benefit packages found"
          emptyDescription="No packages match the current search criteria."
          idKey="id"
          onRowClick={handleViewDetails}
          className=""
        />
      )}

      {/* CMS Compliance Notice */}
      {!loading && !error && !compact && packages.length > 0 && (
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
              All C-SNP benefit packages must comply with CMS regulations (42 CFR §422.4).
              Packages must include condition-specific supplemental benefits, care coordination services,
              and meet CMS maximum out-of-pocket limits. Review packages annually to ensure continued compliance.
            </p>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <BenefitPackageDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        pkg={selectedRecord}
      />

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={deactivateDialogOpen}
        onClose={() => {
          setDeactivateDialogOpen(false);
          setDeactivateTarget(null);
        }}
        onConfirm={handleConfirmDeactivate}
        title="Deactivate Benefit Package"
        message={deactivateTarget
          ? `Are you sure you want to deactivate "${deactivateTarget.name}"? The termination date will be set to today. Active enrollments using this package may be affected.`
          : 'Are you sure you want to deactivate this benefit package?'}
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}

BenefitPackageList.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showExport: PropTypes.bool,
  showStats: PropTypes.bool,
  compact: PropTypes.bool,
  initialPageSize: PropTypes.number,
  filterPlanType: PropTypes.string,
  filterConditionCategory: PropTypes.string,
  onRecordSelect: PropTypes.func,
  onEdit: PropTypes.func,
  onClone: PropTypes.func,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

BenefitPackageList.defaultProps = {
  showHeader: true,
  title: 'Benefit Packages',
  showExport: true,
  showStats: true,
  compact: false,
  initialPageSize: 20,
  filterPlanType: undefined,
  filterConditionCategory: undefined,
  onRecordSelect: undefined,
  onEdit: undefined,
  onClone: undefined,
  className: '',
  headerActions: null,
};