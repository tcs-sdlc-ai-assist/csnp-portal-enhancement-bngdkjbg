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
import {
  getProviderNetwork,
  getProviderById,
  getProviderStats,
  getAllProviderAssignmentRecords,
  getAllReferralRecords,
} from '../../services/providerService.js';
import {
  formatDate,
  formatRelativeTime,
  formatDateTime,
  toTitleCase,
  formatAddress,
} from '../../utils/helpers.js';
import { CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { REFERRAL_STATUSES } from '../../utils/constants.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Network status filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const NETWORK_FILTER_OPTIONS = [
  { value: '', label: 'All Network Types' },
  { value: 'in_network', label: 'In-Network' },
  { value: 'out_of_network', label: 'Out-of-Network' },
];

/**
 * Accepting patients filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const ACCEPTING_FILTER_OPTIONS = [
  { value: '', label: 'All Providers' },
  { value: 'accepting', label: 'Accepting New Patients' },
  { value: 'not_accepting', label: 'Not Accepting' },
];

/**
 * Determines whether a provider is in-network based on contract data.
 * @param {Object} provider - The provider object
 * @returns {boolean} Whether the provider is in-network
 */
function isProviderInNetwork(provider) {
  if (!provider || typeof provider !== 'object') {
    return false;
  }
  if (!provider.contract || typeof provider.contract !== 'object') {
    return false;
  }
  return provider.contract.status === 'active' && provider.contract.contractType === 'In-Network';
}

/**
 * Determines whether a provider's contract is within its effective date range.
 * @param {Object} provider - The provider object
 * @returns {boolean} Whether the provider's contract is effective
 */
function isContractEffective(provider) {
  if (!provider || typeof provider !== 'object' || !provider.contract) {
    return false;
  }

  const contract = provider.contract;
  if (!contract.effectiveDate || !contract.terminationDate) {
    return contract.status === 'active';
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effective = new Date(contract.effectiveDate + 'T00:00:00');
    const termination = new Date(contract.terminationDate + 'T23:59:59');

    if (isNaN(effective.getTime()) || isNaN(termination.getTime())) {
      return contract.status === 'active';
    }

    return today.getTime() >= effective.getTime() && today.getTime() <= termination.getTime();
  } catch {
    return contract.status === 'active';
  }
}

/**
 * Builds a CSV string from provider records.
 * @param {Object[]} records - Array of provider records
 * @returns {string} CSV string
 */
function buildCSVExport(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  const headers = [
    'Provider ID',
    'NPI',
    'First Name',
    'Last Name',
    'Specialty',
    'Facility Name',
    'Network Status',
    'Contract Status',
    'Contract Type',
    'Accepting New Patients',
    'Condition Categories',
    'Email',
    'Phone',
    'City',
    'State',
    'ZIP Code',
    'Contract Effective Date',
    'Contract Termination Date',
    'Assigned Members',
    'Created At',
  ];

  const rows = records.map((record) => [
    record.id || '',
    record.npi || '',
    record.firstName || '',
    record.lastName || '',
    record.specialty || '',
    record.facilityName || '',
    record._networkStatus || '',
    record.contract ? record.contract.status : '',
    record.contract ? record.contract.contractType : '',
    record.acceptingNewPatients ? 'Yes' : 'No',
    Array.isArray(record.conditionCategories)
      ? record.conditionCategories.map((c) => CONDITION_CATEGORY_LABELS[c] || c).join('; ')
      : '',
    record.email || '',
    record.phone || '',
    record.address ? record.address.city : '',
    record.address ? record.address.state : '',
    record.address ? record.address.zipCode : '',
    record.contract ? record.contract.effectiveDate : '',
    record.contract ? record.contract.terminationDate : '',
    typeof record._assignedMemberCount === 'number' ? String(record._assignedMemberCount) : '0',
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
    console.error('ProviderList: failed to download file:', err);
  }
}

/**
 * Provider detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.provider - The provider to display
 * @returns {React.ReactElement|null}
 */
function ProviderDetailModal({ isOpen, onClose, provider }) {
  if (!provider) {
    return null;
  }

  const inNetwork = isProviderInNetwork(provider);
  const contractEffective = isContractEffective(provider);
  const conditionCategories = Array.isArray(provider.conditionCategories)
    ? provider.conditionCategories
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Provider Details"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${
          inNetwork && contractEffective
            ? 'bg-green-50 border-green-200'
            : !inNetwork
              ? 'bg-orange-50 border-orange-200'
              : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={inNetwork ? 'active' : 'expired'}
                label={inNetwork ? 'In-Network' : 'Out-of-Network'}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">
                {provider.firstName} {provider.lastName}, {provider.specialty}
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
            <p className="text-xs text-gray-700 mt-0.5">{provider.phone || '—'}</p>
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
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Network Type</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {provider.contract ? provider.contract.contractType : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Assigned Members</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {typeof provider._assignedMemberCount === 'number' ? provider._assignedMemberCount : 0}
            </p>
          </div>
        </div>

        {/* Address */}
        {provider.address && typeof provider.address === 'object' && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Address</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {formatAddress(provider.address) || '—'}
            </p>
          </div>
        )}

        {/* Contract Details */}
        {provider.contract && typeof provider.contract === 'object' && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contract Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Contract ID</p>
                <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={provider.contract.contractId}>
                  {provider.contract.contractId || '—'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Contract Status</p>
                <p className="text-xs text-gray-700 mt-0.5">
                  {toTitleCase(provider.contract.status || 'unknown')}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Reimbursement</p>
                <p className="text-xs text-gray-700 mt-0.5">
                  {provider.contract.reimbursementRate || '—'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Effective Date</p>
                <p className="text-xs text-gray-700 mt-0.5">
                  {provider.contract.effectiveDate ? formatDate(provider.contract.effectiveDate) : '—'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Termination Date</p>
                <p className="text-xs text-gray-700 mt-0.5">
                  {provider.contract.terminationDate ? formatDate(provider.contract.terminationDate) : '—'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Contract Effective</p>
                <p className="text-xs text-gray-700 mt-0.5">
                  {contractEffective ? (
                    <span className="text-green-700 font-medium">Yes</span>
                  ) : (
                    <span className="text-red-700 font-medium">No</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Condition Categories */}
        {conditionCategories.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Condition Categories ({conditionCategories.length})
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

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {provider.createdAt ? formatDateTime(provider.createdAt) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Last Updated</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {provider.updatedAt ? formatDateTime(provider.updatedAt) : '—'}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

ProviderDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  provider: PropTypes.object,
};

ProviderDetailModal.defaultProps = {
  provider: null,
};

/**
 * Provider network list component.
 * Displays all providers with name, specialty, NPI, contract status,
 * network type (in/out), and assigned member count.
 * Supports search, filter by specialty/network, and row actions (view, edit).
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Provider Network'] - Section title
 * @param {boolean} [props.showExport=true] - Whether to show the export button
 * @param {boolean} [props.showStats=true] - Whether to show summary statistics
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.initialPageSize=20] - Initial page size
 * @param {string} [props.filterSpecialty] - Pre-set specialty filter
 * @param {string} [props.filterConditionCategory] - Pre-set condition category filter
 * @param {Function} [props.onRecordSelect] - Callback when a record is selected: (record) => void
 * @param {Function} [props.onEdit] - Callback when edit is clicked: (record) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function ProviderList({
  showHeader = true,
  title = 'Provider Network',
  showExport = true,
  showStats = true,
  compact = false,
  initialPageSize = 20,
  filterSpecialty: initialFilterSpecialty,
  filterConditionCategory,
  onRecordSelect,
  onEdit,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [specialtyFilter, setSpecialtyFilter] = useState(initialFilterSpecialty || '');
  const [networkFilter, setNetworkFilter] = useState('');
  const [acceptingFilter, setAcceptingFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  /**
   * Loads provider data from the provider service.
   */
  const loadData = useCallback(() => {
    setError(null);
    setLoading(true);

    try {
      const filters = {};

      if (filterConditionCategory && typeof filterConditionCategory === 'string' && filterConditionCategory.trim().length > 0) {
        filters.conditionCategory = filterConditionCategory.trim();
      }

      const allProviders = getProviderNetwork(filters);
      setProviders(Array.isArray(allProviders) ? allProviders : []);
    } catch (err) {
      console.error('ProviderList: failed to load data:', err);
      setError('Unable to load provider network');
      setProviders([]);
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
   * Computed: unique specialties for the filter dropdown.
   */
  const specialtyOptions = useMemo(() => {
    const specialties = new Set();
    for (const provider of providers) {
      if (provider.specialty && typeof provider.specialty === 'string' && provider.specialty.trim().length > 0) {
        specialties.add(provider.specialty.trim());
      }
    }
    const sorted = [...specialties].sort();
    return [
      { value: '', label: 'All Specialties' },
      ...sorted.map((s) => ({ value: s, label: s })),
    ];
  }, [providers]);

  /**
   * Computed: assignment counts per provider.
   */
  const assignmentCountMap = useMemo(() => {
    const counts = {};
    try {
      const assignments = getAllProviderAssignmentRecords();
      const activeAssignments = assignments.filter((a) => a.status === 'active');
      for (const assignment of activeAssignments) {
        const providerId = assignment.providerId;
        if (!counts[providerId]) {
          counts[providerId] = 0;
        }
        counts[providerId]++;
      }
    } catch {
      // Silently fail
    }
    return counts;
  }, [providers]);

  /**
   * Enriched providers with computed fields.
   */
  const enrichedProviders = useMemo(() => {
    return providers.map((provider) => {
      const inNetwork = isProviderInNetwork(provider);
      const contractEffective = isContractEffective(provider);
      const assignedMemberCount = assignmentCountMap[provider.id] || 0;

      const conditionCategories = Array.isArray(provider.conditionCategories)
        ? provider.conditionCategories
        : [];

      const conditionLabels = conditionCategories
        .map((c) => CONDITION_CATEGORY_LABELS[c] || c)
        .join(', ');

      const conditionLabelsShort = conditionCategories.length > 2
        ? `${conditionCategories.slice(0, 2).map((c) => CONDITION_CATEGORY_LABELS[c] || c).join(', ')} +${conditionCategories.length - 2} more`
        : conditionLabels;

      const networkStatus = inNetwork ? 'In-Network' : 'Out-of-Network';
      const contractStatus = provider.contract
        ? toTitleCase(provider.contract.status || 'unknown')
        : 'Unknown';

      return {
        ...provider,
        _inNetwork: inNetwork,
        _contractEffective: contractEffective,
        _assignedMemberCount: assignedMemberCount,
        _networkStatus: networkStatus,
        _contractStatus: contractStatus,
        _conditionLabels: conditionLabels,
        _conditionLabelsShort: conditionLabelsShort,
        _conditionCount: conditionCategories.length,
        _fullName: `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
      };
    });
  }, [providers, assignmentCountMap]);

  /**
   * Filtered records based on specialty, network, and accepting filters.
   */
  const filteredRecords = useMemo(() => {
    let filtered = enrichedProviders;

    if (specialtyFilter && specialtyFilter.trim().length > 0) {
      filtered = filtered.filter((r) => r.specialty === specialtyFilter.trim());
    }

    if (networkFilter && networkFilter.trim().length > 0) {
      if (networkFilter === 'in_network') {
        filtered = filtered.filter((r) => r._inNetwork === true);
      } else if (networkFilter === 'out_of_network') {
        filtered = filtered.filter((r) => r._inNetwork === false);
      }
    }

    if (acceptingFilter && acceptingFilter.trim().length > 0) {
      if (acceptingFilter === 'accepting') {
        filtered = filtered.filter((r) => r.acceptingNewPatients === true);
      } else if (acceptingFilter === 'not_accepting') {
        filtered = filtered.filter((r) => r.acceptingNewPatients === false);
      }
    }

    return filtered;
  }, [enrichedProviders, specialtyFilter, networkFilter, acceptingFilter]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const total = providers.length;
    const inNetwork = enrichedProviders.filter((p) => p._inNetwork).length;
    const outOfNetwork = enrichedProviders.filter((p) => !p._inNetwork).length;
    const accepting = enrichedProviders.filter((p) => p.acceptingNewPatients).length;
    const notAccepting = enrichedProviders.filter((p) => !p.acceptingNewPatients).length;

    const bySpecialty = {};
    for (const provider of providers) {
      const specialty = provider.specialty || 'Unknown';
      if (!bySpecialty[specialty]) {
        bySpecialty[specialty] = 0;
      }
      bySpecialty[specialty]++;
    }

    return { total, inNetwork, outOfNetwork, accepting, notAccepting, bySpecialty };
  }, [providers, enrichedProviders]);

  /**
   * Handles viewing a record's details.
   * @param {Object} record - The provider record
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
   * @param {Object} record - The provider record
   */
  const handleEdit = useCallback((record) => {
    if (typeof onEdit === 'function') {
      onEdit(record);
    } else {
      addNotification('info', 'Edit Provider', `Edit functionality for "${record.firstName} ${record.lastName}" would open the provider form.`);
    }
  }, [onEdit, addNotification]);

  /**
   * Handles specialty filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleSpecialtyFilterChange = useCallback((e) => {
    setSpecialtyFilter(e.target.value);
  }, []);

  /**
   * Handles network filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleNetworkFilterChange = useCallback((e) => {
    setNetworkFilter(e.target.value);
  }, []);

  /**
   * Handles accepting filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleAcceptingFilterChange = useCallback((e) => {
    setAcceptingFilter(e.target.value);
  }, []);

  /**
   * Handles exporting providers as CSV.
   */
  const handleExportCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No providers to export.');
      return;
    }

    try {
      const csv = buildCSVExport(filteredRecords);
      const filename = `provider_network_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} provider(s) to CSV.`);
    } catch (err) {
      console.error('ProviderList: export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting providers.');
    }
  }, [filteredRecords, addNotification]);

  /**
   * Handles exporting providers as JSON.
   */
  const handleExportJSON = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No providers to export.');
      return;
    }

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalRecords: filteredRecords.length,
        filters: {
          specialty: specialtyFilter || 'all',
          network: networkFilter || 'all',
          accepting: acceptingFilter || 'all',
        },
        records: filteredRecords.map(({
          _inNetwork,
          _contractEffective,
          _assignedMemberCount,
          _networkStatus,
          _contractStatus,
          _conditionLabels,
          _conditionLabelsShort,
          _conditionCount,
          _fullName,
          ...rest
        }) => rest),
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `provider_network_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} provider(s) to JSON.`);
    } catch (err) {
      console.error('ProviderList: JSON export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting providers.');
    }
  }, [filteredRecords, specialtyFilter, networkFilter, acceptingFilter, addNotification]);

  /**
   * Table columns definition.
   */
  const columns = useMemo(() => {
    const cols = [
      {
        key: '_fullName',
        label: 'Provider',
        sortable: true,
        searchable: true,
        width: 'min-w-[180px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate max-w-[200px]" title={value}>
                {value || 'Unnamed Provider'}
              </p>
              <p className="text-[10px] text-gray-500 truncate" title={row.facilityName}>
                {row.facilityName || '—'}
              </p>
            </div>
          );
        },
      },
      {
        key: 'specialty',
        label: 'Specialty',
        sortable: true,
        searchable: true,
        width: 'min-w-[120px]',
        render: (value) => {
          return (
            <span className="text-xs text-gray-700 truncate max-w-[140px]" title={value}>
              {value || '—'}
            </span>
          );
        },
      },
      {
        key: 'npi',
        label: 'NPI',
        sortable: true,
        searchable: true,
        width: 'min-w-[100px]',
        render: (value) => {
          return (
            <span className="text-xs font-mono text-gray-700">
              {value || '—'}
            </span>
          );
        },
      },
      {
        key: '_networkStatus',
        label: 'Network',
        sortable: true,
        searchable: false,
        width: 'min-w-[110px]',
        render: (value, row) => {
          return (
            <StatusBadge
              status={row._inNetwork ? 'active' : 'expired'}
              label={value}
              size="sm"
              showDot={true}
              bordered={true}
            />
          );
        },
      },
      {
        key: '_contractStatus',
        label: 'Contract',
        sortable: true,
        searchable: false,
        width: 'min-w-[100px]',
        render: (value, row) => {
          const contractActive = row.contract && row.contract.status === 'active';
          return (
            <StatusBadge
              status={contractActive ? 'active' : 'expired'}
              label={value}
              size="sm"
              showDot={true}
              bordered={true}
            />
          );
        },
      },
      {
        key: '_assignedMemberCount',
        label: 'Members',
        sortable: true,
        searchable: false,
        width: 'min-w-[80px]',
        align: 'right',
        render: (value) => {
          return (
            <span className="text-xs font-medium text-gray-700">
              {typeof value === 'number' ? value : 0}
            </span>
          );
        },
      },
    ];

    if (!compact) {
      cols.push({
        key: 'acceptingNewPatients',
        label: 'Accepting',
        sortable: true,
        searchable: false,
        width: 'min-w-[90px]',
        render: (value) => {
          return value ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" aria-hidden="true" />
              Yes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" aria-hidden="true" />
              No
            </span>
          );
        },
      });

      cols.push({
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
    }

    return actionList;
  }, [isAuthenticated, handleViewDetails, handleEdit]);

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
              {/* Provider icon */}
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
              {hasTitle && (
                <h3 className="text-lg font-semibold text-csnp-primary">
                  {title}
                </h3>
              )}
              {!loading && providers.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {providers.length} provider{providers.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Specialty Filter */}
              <select
                value={specialtyFilter}
                onChange={handleSpecialtyFilterChange}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                aria-label="Filter by specialty"
              >
                {specialtyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Network Filter */}
              <select
                value={networkFilter}
                onChange={handleNetworkFilterChange}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                aria-label="Filter by network type"
              >
                {NETWORK_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Accepting Filter */}
              {!compact && (
                <select
                  value={acceptingFilter}
                  onChange={handleAcceptingFilterChange}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter by accepting status"
                >
                  {ACCEPTING_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

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
          {showStats && !loading && !error && providers.length > 0 && !compact && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-green-700">
                  {stats.inNetwork} in-network
                </span>
              </div>
              {stats.outOfNetwork > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-orange-700">
                    {stats.outOfNetwork} out-of-network
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-csnp-blue-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-csnp-primary" aria-hidden="true" />
                <span className="text-[10px] font-medium text-csnp-primary">
                  {stats.accepting} accepting
                </span>
              </div>
              {stats.notAccepting > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-gray-600">
                    {stats.notAccepting} not accepting
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
          text="Loading provider network..."
        />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load provider network"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadData}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && providers.length === 0 && (
        <EmptyState
          title="No Providers"
          description="No providers have been added to the network yet. Add a new provider to get started."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Filtered Empty State */}
      {!loading && !error && providers.length > 0 && filteredRecords.length === 0 && (
        <EmptyState
          title="No Matching Providers"
          description={`No providers match the selected filters${specialtyFilter ? ` (Specialty: ${specialtyFilter})` : ''}${networkFilter ? ` (Network: ${networkFilter === 'in_network' ? 'In-Network' : 'Out-of-Network'})` : ''}${acceptingFilter ? ` (${acceptingFilter === 'accepting' ? 'Accepting' : 'Not Accepting'})` : ''}.`}
          iconType="no-results"
          size="sm"
          actionLabel="Clear Filters"
          onAction={() => {
            setSpecialtyFilter('');
            setNetworkFilter('');
            setAcceptingFilter('');
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
          searchPlaceholder="Search by name, specialty, NPI, facility..."
          paginated={true}
          initialPageSize={initialPageSize}
          initialSortField="_fullName"
          initialSortDirection="asc"
          emptyMessage="No providers found"
          emptyDescription="No providers match the current search criteria."
          idKey="id"
          onRowClick={handleViewDetails}
          className=""
        />
      )}

      {/* CMS Compliance Notice */}
      {!loading && !error && !compact && providers.length > 0 && (
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
              C-SNP provider networks must meet CMS network adequacy requirements (42 CFR §422.116).
              All providers must have valid NPI numbers, active contracts, and appropriate specialty
              coverage for the chronic conditions served by the plan. Conduct quarterly network
              adequacy assessments to ensure continued compliance.
            </p>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <ProviderDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        provider={selectedRecord}
      />
    </div>
  );
}

ProviderList.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showExport: PropTypes.bool,
  showStats: PropTypes.bool,
  compact: PropTypes.bool,
  initialPageSize: PropTypes.number,
  filterSpecialty: PropTypes.string,
  filterConditionCategory: PropTypes.string,
  onRecordSelect: PropTypes.func,
  onEdit: PropTypes.func,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

ProviderList.defaultProps = {
  showHeader: true,
  title: 'Provider Network',
  showExport: true,
  showStats: true,
  compact: false,
  initialPageSize: 20,
  filterSpecialty: undefined,
  filterConditionCategory: undefined,
  onRecordSelect: undefined,
  onEdit: undefined,
  className: '',
  headerActions: null,
};