import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import Modal from '../common/Modal.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import FormField from '../common/FormField.jsx';
import DataTable from '../common/DataTable.jsx';
import Tabs from '../common/Tabs.jsx';
import {
  manageReferral,
  getProviderNetwork,
  getProviderById,
  getMemberReferrals,
  getProviderReferrals,
  getReferralById,
  cancelReferral,
  getAllReferralRecords,
} from '../../services/providerService.js';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatAddress,
  formatPhone,
  toTitleCase,
  calculateAge,
} from '../../utils/helpers.js';
import {
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABELS,
} from '../../utils/constants.js';
import { CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
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
 * Status filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: REFERRAL_STATUSES.PENDING, label: 'Pending' },
  { value: REFERRAL_STATUSES.ACCEPTED, label: 'Accepted' },
  { value: REFERRAL_STATUSES.IN_PROGRESS, label: 'In Progress' },
  { value: REFERRAL_STATUSES.COMPLETED, label: 'Completed' },
  { value: REFERRAL_STATUSES.REJECTED, label: 'Rejected' },
  { value: REFERRAL_STATUSES.CANCELLED, label: 'Cancelled' },
  { value: REFERRAL_STATUSES.EXPIRED, label: 'Expired' },
];

/**
 * Urgency options for the referral form.
 * @type {{ value: string, label: string }[]}
 */
const URGENCY_OPTIONS = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergent', label: 'Emergent' },
];

/**
 * Urgency style mapping.
 * @type {Object.<string, string>}
 */
const URGENCY_STYLES = {
  routine: 'text-gray-600 bg-gray-50 border-gray-200',
  urgent: 'text-orange-700 bg-orange-50 border-orange-200',
  emergent: 'text-red-700 bg-red-50 border-red-200',
};

/**
 * Determines whether a provider is in-network.
 * @param {Object} provider - The provider object
 * @returns {boolean}
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
 * Builds a CSV string from referral records.
 * @param {Object[]} records - Array of referral records
 * @returns {string} CSV string
 */
function buildCSVExport(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  const headers = [
    'Referral ID',
    'Member',
    'Referring Provider',
    'Receiving Provider',
    'Status',
    'Urgency',
    'Reason',
    'Diagnosis Codes',
    'Referral Date',
    'Expiration Date',
    'Notes',
    'Created At',
  ];

  const rows = records.map((record) => [
    record.id || '',
    record._memberName || record.memberId || '',
    record._referringProviderName || record.referringProviderId || '',
    record._receivingProviderName || record.receivingProviderId || '',
    REFERRAL_STATUS_LABELS[record.status] || record.status || '',
    record.urgency || '',
    record.reason || '',
    Array.isArray(record.diagnosisCodes) ? record.diagnosisCodes.join('; ') : '',
    record.referralDate || '',
    record.expirationDate || '',
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
    console.error('ReferralManagement: failed to download file:', err);
  }
}

/**
 * Skeleton loading state for the referral management panel.
 * @returns {React.ReactElement}
 */
function ReferralManagementSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-16 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  );
}

/**
 * Member selector component for referral creation.
 *
 * @param {Object} props
 * @param {string} props.selectedMemberId - Currently selected member ID
 * @param {Function} props.onSelectMember - Callback when a member is selected
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 * @returns {React.ReactElement}
 */
function ReferralMemberSelector({ selectedMemberId, onSelectMember, disabled = false }) {
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
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
  }, []);

  const filteredMembers = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return members;
    }
    const query = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const fullName = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
      const id = (m.id || '').toLowerCase();
      const medicareId = (m.medicareId || '').toLowerCase();
      return fullName.includes(query) || id.includes(query) || medicareId.includes(query);
    });
  }, [members, searchQuery]);

  const selectedMember = useMemo(() => {
    if (!selectedMemberId) {
      return null;
    }
    return members.find((m) => m.id === selectedMemberId) || null;
  }, [selectedMemberId, members]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleSelectMember = useCallback((member) => {
    onSelectMember(member.id);
    setSearchQuery('');
    setShowDropdown(false);
  }, [onSelectMember]);

  return (
    <div className="space-y-2">
      <label className="font-medium text-sm text-gray-700">
        Member
        <span className="text-csnp-alert-error ml-0.5" aria-hidden="true">*</span>
      </label>

      {selectedMember && (
        <div className="flex items-center justify-between p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white">
              {selectedMember.firstName ? selectedMember.firstName.charAt(0).toUpperCase() : ''}
              {selectedMember.lastName ? selectedMember.lastName.charAt(0).toUpperCase() : ''}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900">
                {selectedMember.firstName} {selectedMember.lastName}
              </p>
              <p className="text-[10px] text-gray-500">
                {selectedMember.conditionCategory
                  ? (CONDITION_CATEGORY_LABELS[selectedMember.conditionCategory] || toTitleCase(selectedMember.conditionCategory))
                  : 'No condition'}
                {selectedMember.dateOfBirth && ` · Age ${calculateAge(selectedMember.dateOfBirth) || '—'}`}
              </p>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onSelectMember('')}
              className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-150 focus:outline-none"
              aria-label="Clear member selection"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {!selectedMember && (
        <div className="relative">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by name, member ID..."
              disabled={disabled}
              className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
              aria-label="Search members"
            />
          </div>

          {showDropdown && filteredMembers.length > 0 && (
            <div ref={dropdownRef} className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto" role="listbox">
              {filteredMembers.slice(0, 10).map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelectMember(member)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors duration-100 border-b border-gray-50 last:border-b-0"
                  role="option"
                  aria-selected={false}
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-csnp-primary flex items-center justify-center text-[10px] font-bold text-white">
                    {member.firstName ? member.firstName.charAt(0).toUpperCase() : ''}
                    {member.lastName ? member.lastName.charAt(0).toUpperCase() : ''}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {member.conditionCategory
                        ? (CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory))
                        : 'No condition'}
                    </p>
                  </div>
                </button>
              ))}
              {filteredMembers.length > 10 && (
                <div className="px-3 py-2 text-[10px] text-gray-400 text-center">
                  Showing 10 of {filteredMembers.length} results
                </div>
              )}
            </div>
          )}

          {showDropdown && searchQuery.trim().length > 0 && filteredMembers.length === 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
              <p className="text-xs text-gray-400">No members found matching &quot;{searchQuery}&quot;</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

ReferralMemberSelector.propTypes = {
  selectedMemberId: PropTypes.string.isRequired,
  onSelectMember: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

ReferralMemberSelector.defaultProps = {
  disabled: false,
};

/**
 * Provider selector component for referral creation.
 *
 * @param {Object} props
 * @param {string} props.label - Label text
 * @param {string} props.selectedProviderId - Currently selected provider ID
 * @param {Function} props.onSelectProvider - Callback when a provider is selected
 * @param {string} [props.excludeProviderId] - Provider ID to exclude from the list
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 * @param {boolean} [props.required=true] - Whether the field is required
 * @returns {React.ReactElement}
 */
function ProviderSelector({ label, selectedProviderId, onSelectProvider, excludeProviderId, disabled = false, required = true }) {
  const [providers, setProviders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const allProviders = getProviderNetwork({});
      setProviders(Array.isArray(allProviders) ? allProviders : []);
    } catch {
      setProviders([]);
    }
  }, []);

  const filteredProviders = useMemo(() => {
    let filtered = providers;

    if (excludeProviderId) {
      filtered = filtered.filter((p) => p.id !== excludeProviderId);
    }

    if (!searchQuery || searchQuery.trim().length === 0) {
      return filtered;
    }

    const query = searchQuery.trim().toLowerCase();
    return filtered.filter((p) => {
      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
      const specialty = (p.specialty || '').toLowerCase();
      const npi = (p.npi || '').toLowerCase();
      const facility = (p.facilityName || '').toLowerCase();
      return fullName.includes(query) || specialty.includes(query) || npi.includes(query) || facility.includes(query);
    });
  }, [providers, searchQuery, excludeProviderId]);

  const selectedProvider = useMemo(() => {
    if (!selectedProviderId) {
      return null;
    }
    return providers.find((p) => p.id === selectedProviderId) || null;
  }, [selectedProviderId, providers]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleSelectProvider = useCallback((provider) => {
    onSelectProvider(provider.id);
    setSearchQuery('');
    setShowDropdown(false);
  }, [onSelectProvider]);

  const inNetwork = selectedProvider ? isProviderInNetwork(selectedProvider) : false;

  return (
    <div className="space-y-2">
      <label className="font-medium text-sm text-gray-700">
        {label}
        {required && <span className="text-csnp-alert-error ml-0.5" aria-hidden="true">*</span>}
      </label>

      {selectedProvider && (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${inNetwork ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${inNetwork ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-gray-900">
                  {selectedProvider.firstName} {selectedProvider.lastName}
                </p>
                <StatusBadge
                  status={inNetwork ? 'active' : 'expired'}
                  label={inNetwork ? 'In-Network' : 'Out-of-Network'}
                  size="sm"
                  showDot={true}
                  bordered={false}
                />
              </div>
              <p className="text-[10px] text-gray-500">
                {selectedProvider.specialty || 'No specialty'} · {selectedProvider.facilityName || 'No facility'}
              </p>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onSelectProvider('')}
              className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-150 focus:outline-none"
              aria-label={`Clear ${label.toLowerCase()} selection`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {!selectedProvider && (
        <div className="relative">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by name, specialty, NPI..."
              disabled={disabled}
              className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
              aria-label={`Search ${label.toLowerCase()}`}
            />
          </div>

          {showDropdown && filteredProviders.length > 0 && (
            <div ref={dropdownRef} className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto" role="listbox">
              {filteredProviders.slice(0, 10).map((provider) => {
                const provInNetwork = isProviderInNetwork(provider);
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleSelectProvider(provider)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors duration-100 border-b border-gray-50 last:border-b-0"
                    role="option"
                    aria-selected={false}
                  >
                    <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${provInNetwork ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900">
                        {provider.firstName} {provider.lastName}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {provider.specialty || 'No specialty'} · {provider.facilityName || ''}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${provInNetwork ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {provInNetwork ? 'In-Net' : 'Out-Net'}
                    </span>
                  </button>
                );
              })}
              {filteredProviders.length > 10 && (
                <div className="px-3 py-2 text-[10px] text-gray-400 text-center">
                  Showing 10 of {filteredProviders.length} results
                </div>
              )}
            </div>
          )}

          {showDropdown && searchQuery.trim().length > 0 && filteredProviders.length === 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
              <p className="text-xs text-gray-400">No providers found matching &quot;{searchQuery}&quot;</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

ProviderSelector.propTypes = {
  label: PropTypes.string.isRequired,
  selectedProviderId: PropTypes.string.isRequired,
  onSelectProvider: PropTypes.func.isRequired,
  excludeProviderId: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
};

ProviderSelector.defaultProps = {
  excludeProviderId: undefined,
  disabled: false,
  required: true,
};

/**
 * Create referral form modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler
 * @param {boolean} [props.loading=false] - Whether the form is submitting
 * @param {string} [props.initialMemberId] - Pre-selected member ID
 * @param {string} [props.initialReferringProviderId] - Pre-selected referring provider ID
 * @returns {React.ReactElement}
 */
function CreateReferralModal({ isOpen, onClose, onSave, loading = false, initialMemberId, initialReferringProviderId }) {
  const [memberId, setMemberId] = useState(initialMemberId || '');
  const [referringProviderId, setReferringProviderId] = useState(initialReferringProviderId || '');
  const [receivingProviderId, setReceivingProviderId] = useState('');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('routine');
  const [diagnosisCodes, setDiagnosisCodes] = useState('');
  const [referralDate, setReferralDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setMemberId(initialMemberId || '');
      setReferringProviderId(initialReferringProviderId || '');
      setReceivingProviderId('');
      setReason('');
      setUrgency('routine');
      setDiagnosisCodes('');
      setReferralDate(new Date().toISOString().split('T')[0]);
      setExpirationDate('');
      setNotes('');
      setFormErrors({});
    }
  }, [isOpen, initialMemberId, initialReferringProviderId]);

  const validateForm = useCallback(() => {
    const errors = {};

    if (!memberId || memberId.trim().length === 0) {
      errors.memberId = 'Member is required';
    }

    if (!referringProviderId || referringProviderId.trim().length === 0) {
      errors.referringProviderId = 'Referring provider is required';
    }

    if (!receivingProviderId || receivingProviderId.trim().length === 0) {
      errors.receivingProviderId = 'Receiving provider is required';
    }

    if (referringProviderId && receivingProviderId && referringProviderId === receivingProviderId) {
      errors.receivingProviderId = 'Receiving provider must be different from referring provider';
    }

    if (!reason || reason.trim().length === 0) {
      errors.reason = 'Referral reason is required';
    }

    if (!referralDate || referralDate.trim().length === 0) {
      errors.referralDate = 'Referral date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [memberId, referringProviderId, receivingProviderId, reason, referralDate]);

  const handleSubmit = useCallback(() => {
    if (!validateForm()) {
      return;
    }

    const codes = diagnosisCodes.trim().length > 0
      ? diagnosisCodes.split(',').map((c) => c.trim().toUpperCase()).filter((c) => c.length > 0)
      : [];

    onSave({
      memberId: memberId.trim(),
      referringProviderId: referringProviderId.trim(),
      receivingProviderId: receivingProviderId.trim(),
      reason: reason.trim(),
      urgency,
      diagnosisCodes: codes,
      referralDate: referralDate.trim(),
      expirationDate: expirationDate.trim() || undefined,
      notes: notes.trim(),
    });
  }, [validateForm, memberId, referringProviderId, receivingProviderId, reason, urgency, diagnosisCodes, referralDate, expirationDate, notes, onSave]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Referral"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-5">
        {/* Member Selection */}
        <ReferralMemberSelector
          selectedMemberId={memberId}
          onSelectMember={setMemberId}
          disabled={loading}
        />
        {formErrors.memberId && (
          <p className="text-xs text-csnp-alert-error -mt-3" role="alert">{formErrors.memberId}</p>
        )}

        {/* Referring Provider */}
        <ProviderSelector
          label="Referring Provider (Source)"
          selectedProviderId={referringProviderId}
          onSelectProvider={setReferringProviderId}
          excludeProviderId={receivingProviderId}
          disabled={loading}
          required={true}
        />
        {formErrors.referringProviderId && (
          <p className="text-xs text-csnp-alert-error -mt-3" role="alert">{formErrors.referringProviderId}</p>
        )}

        {/* Receiving Provider */}
        <ProviderSelector
          label="Receiving Provider (Target)"
          selectedProviderId={receivingProviderId}
          onSelectProvider={setReceivingProviderId}
          excludeProviderId={referringProviderId}
          disabled={loading}
          required={true}
        />
        {formErrors.receivingProviderId && (
          <p className="text-xs text-csnp-alert-error -mt-3" role="alert">{formErrors.receivingProviderId}</p>
        )}

        {/* Reason */}
        <FormField
          name="referralReason"
          label="Referral Reason"
          type="textarea"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setFormErrors((prev) => {
              const updated = { ...prev };
              delete updated.reason;
              return updated;
            });
          }}
          placeholder="Describe the reason for this referral..."
          required={true}
          disabled={loading}
          error={formErrors.reason}
          rows={3}
          maxLength={500}
        />

        {/* Urgency and Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            name="urgency"
            label="Urgency"
            type="select"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            options={URGENCY_OPTIONS}
            required={true}
            disabled={loading}
          />

          <FormField
            name="referralDate"
            label="Referral Date"
            type="date"
            value={referralDate}
            onChange={(e) => {
              setReferralDate(e.target.value);
              setFormErrors((prev) => {
                const updated = { ...prev };
                delete updated.referralDate;
                return updated;
              });
            }}
            required={true}
            disabled={loading}
            error={formErrors.referralDate}
          />

          <FormField
            name="expirationDate"
            label="Expiration Date"
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            disabled={loading}
            helperText="Optional (defaults to 90 days)"
          />
        </div>

        {/* Diagnosis Codes */}
        <FormField
          name="diagnosisCodes"
          label="Diagnosis Codes"
          type="text"
          value={diagnosisCodes}
          onChange={(e) => setDiagnosisCodes(e.target.value)}
          placeholder="e.g., E11.9, I50.22 (comma-separated)"
          disabled={loading}
          helperText="Enter ICD-10 codes separated by commas (optional)"
        />

        {/* Notes */}
        <FormField
          name="referralNotes"
          label="Notes"
          type="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes or instructions..."
          disabled={loading}
          rows={2}
          maxLength={500}
        />

        {/* CMS Compliance Notice */}
        <div className="flex items-start gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-csnp-primary flex-shrink-0 mt-0.5" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
            <span className="font-semibold">CMS Compliance:</span>{' '}
            Referrals must comply with CMS network adequacy requirements (42 CFR §422.112).
            Out-of-network referrals may require prior authorization and may result in higher
            member cost-sharing. Ensure the receiving provider has appropriate specialty
            coverage for the member&apos;s chronic conditions.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            loading={loading}
            loadingText="Creating..."
            iconLeft={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            }
          >
            Create Referral
          </Button>
        </div>
      </div>
    </Modal>
  );
}

CreateReferralModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  initialMemberId: PropTypes.string,
  initialReferringProviderId: PropTypes.string,
};

CreateReferralModal.defaultProps = {
  loading: false,
  initialMemberId: undefined,
  initialReferringProviderId: undefined,
};

/**
 * Referral detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.referral - The referral record to display
 * @param {Function} props.onStatusChange - Callback when status changes
 * @param {Function} props.onCancel - Callback when cancel is clicked
 * @returns {React.ReactElement|null}
 */
function ReferralDetailModal({ isOpen, onClose, referral, onStatusChange, onCancel }) {
  if (!referral) {
    return null;
  }

  const badgeStatus = REFERRAL_STATUS_BADGE_MAP[referral.status] || 'pending';
  const statusLabel = REFERRAL_STATUS_LABELS[referral.status] || toTitleCase(referral.status || 'unknown');
  const urgencyStyle = URGENCY_STYLES[referral.urgency] || URGENCY_STYLES.routine;

  const referringInNetwork = referral._referringProvider ? isProviderInNetwork(referral._referringProvider) : false;
  const receivingInNetwork = referral._receivingProvider ? isProviderInNetwork(referral._receivingProvider) : false;

  const canCancel = [REFERRAL_STATUSES.PENDING, REFERRAL_STATUSES.ACCEPTED, REFERRAL_STATUSES.IN_PROGRESS].includes(referral.status);
  const canUpdateStatus = [REFERRAL_STATUSES.PENDING, REFERRAL_STATUSES.ACCEPTED, REFERRAL_STATUSES.IN_PROGRESS].includes(referral.status);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Referral Details"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${
          referral.status === REFERRAL_STATUSES.COMPLETED
            ? 'bg-green-50 border-green-200'
            : referral.status === REFERRAL_STATUSES.REJECTED || referral.status === REFERRAL_STATUSES.CANCELLED
              ? 'bg-red-50 border-red-200'
              : referral.status === REFERRAL_STATUSES.PENDING
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={badgeStatus}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">{statusLabel}</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${urgencyStyle}`}>
                {toTitleCase(referral.urgency || 'routine')}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {referral.createdAt ? formatRelativeTime(referral.createdAt) : ''}
            </span>
          </div>
        </div>

        {/* Referral Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Referral ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={referral.id}>
              {referral.id ? referral.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">
              {referral._memberName || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Referral Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {referral.referralDate ? formatDate(referral.referralDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Expiration Date</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {referral.expirationDate ? formatDate(referral.expirationDate) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created By</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {referral.createdBy ? referral.createdBy.substring(0, 12) + '…' : 'System'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {referral.createdAt ? formatDateTime(referral.createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* Referring Provider */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Referring Provider (Source)</p>
          <div className={`p-3 rounded-lg border ${referringInNetwork ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center gap-2">
              <StatusBadge
                status={referringInNetwork ? 'active' : 'expired'}
                label={referringInNetwork ? 'In-Network' : 'Out-of-Network'}
                size="sm"
                showDot={true}
                bordered={true}
              />
              <span className="text-xs font-semibold text-gray-900">
                {referral._referringProviderName || '—'}
              </span>
            </div>
            {referral._referringProvider && (
              <p className="text-[10px] text-gray-600 mt-0.5">
                {referral._referringProvider.specialty || 'No specialty'} · {referral._referringProvider.facilityName || ''}
                {referral._referringProvider.npi && ` · NPI: ${referral._referringProvider.npi}`}
              </p>
            )}
          </div>
        </div>

        {/* Receiving Provider */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Receiving Provider (Target)</p>
          <div className={`p-3 rounded-lg border ${receivingInNetwork ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center gap-2">
              <StatusBadge
                status={receivingInNetwork ? 'active' : 'expired'}
                label={receivingInNetwork ? 'In-Network' : 'Out-of-Network'}
                size="sm"
                showDot={true}
                bordered={true}
              />
              <span className="text-xs font-semibold text-gray-900">
                {referral._receivingProviderName || '—'}
              </span>
            </div>
            {referral._receivingProvider && (
              <p className="text-[10px] text-gray-600 mt-0.5">
                {referral._receivingProvider.specialty || 'No specialty'} · {referral._receivingProvider.facilityName || ''}
                {referral._receivingProvider.npi && ` · NPI: ${referral._receivingProvider.npi}`}
              </p>
            )}
          </div>
        </div>

        {/* Out-of-Network Warning */}
        {(!referringInNetwork || !receivingInNetwork) && (
          <Alert
            variant="warning"
            title="Out-of-Network Provider"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            {!receivingInNetwork
              ? 'The receiving provider is out-of-network. This may result in higher costs for the member and may require prior authorization.'
              : 'The referring provider is out-of-network.'}
          </Alert>
        )}

        {/* Reason */}
        {referral.reason && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reason</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {referral.reason}
              </p>
            </div>
          </div>
        )}

        {/* Diagnosis Codes */}
        {Array.isArray(referral.diagnosisCodes) && referral.diagnosisCodes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Diagnosis Codes ({referral.diagnosisCodes.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {referral.diagnosisCodes.map((code, idx) => (
                <span
                  key={`${code}-${idx}`}
                  className="inline-block px-2 py-0.5 text-[10px] font-medium bg-csnp-blue-50 text-csnp-primary rounded border border-csnp-blue-100"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {referral.notes && typeof referral.notes === 'string' && referral.notes.trim().length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {referral.notes}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        {(canUpdateStatus || canCancel) && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              {canUpdateStatus && referral.status === REFERRAL_STATUSES.PENDING && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => onStatusChange(referral.id, REFERRAL_STATUSES.ACCEPTED)}
                  iconLeft={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  Accept
                </Button>
              )}
              {canUpdateStatus && referral.status === REFERRAL_STATUSES.ACCEPTED && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onStatusChange(referral.id, REFERRAL_STATUSES.IN_PROGRESS)}
                >
                  Start Progress
                </Button>
              )}
              {canUpdateStatus && referral.status === REFERRAL_STATUSES.IN_PROGRESS && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => onStatusChange(referral.id, REFERRAL_STATUSES.COMPLETED)}
                >
                  Complete
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(referral.id)}
                >
                  Cancel Referral
                </Button>
              )}
            </div>
            <StatusBadge
              status={badgeStatus}
              size="md"
              showDot={true}
              bordered={true}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

ReferralDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  referral: PropTypes.object,
  onStatusChange: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

ReferralDetailModal.defaultProps = {
  referral: null,
};

/**
 * Referral management component.
 * Provides create new referral (source provider, target provider, member,
 * reason, urgency), referral list with status tracking (pending/approved/
 * denied/completed), in-network/out-of-network indicator, and referral
 * detail view.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {string} [props.title='Referral Management'] - Section title
 * @param {boolean} [props.showExport=true] - Whether to show the export button
 * @param {boolean} [props.showStats=true] - Whether to show summary statistics
 * @param {boolean} [props.showCreateButton=true] - Whether to show the create referral button
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.initialPageSize=20] - Initial page size
 * @param {string} [props.filterMemberId] - Pre-set member ID filter
 * @param {string} [props.filterProviderId] - Pre-set provider ID filter
 * @param {string} [props.filterStatus] - Pre-set status filter
 * @param {string} [props.initialMemberId] - Pre-selected member ID for new referrals
 * @param {string} [props.initialReferringProviderId] - Pre-selected referring provider ID for new referrals
 * @param {Function} [props.onReferralChange] - Callback when a referral changes: (result) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} [props.headerActions] - Optional header action elements
 * @returns {React.ReactElement}
 */
export default function ReferralManagement({
  showHeader = true,
  title = 'Referral Management',
  showExport = true,
  showStats = true,
  showCreateButton = true,
  compact = false,
  initialPageSize = 20,
  filterMemberId,
  filterProviderId,
  filterStatus: initialFilterStatus,
  initialMemberId,
  initialReferringProviderId,
  onReferralChange,
  className = '',
  headerActions = null,
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [referrals, setReferrals] = useState([]);
  const [members, setMembers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialFilterStatus || '');
  const [urgencyFilter, setUrgencyFilter] = useState('');

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  /**
   * Loads referral data and related records.
   */
  const loadData = useCallback(() => {
    setError(null);
    setLoading(true);

    try {
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
        const allProviders = getProviderNetwork({});
        setProviders(Array.isArray(allProviders) ? allProviders : []);
      } catch {
        setProviders([]);
      }

      // Load referrals
      let allReferrals = getAllReferralRecords();

      if (filterMemberId && typeof filterMemberId === 'string' && filterMemberId.trim().length > 0) {
        allReferrals = allReferrals.filter((r) => r.memberId === filterMemberId.trim());
      }

      if (filterProviderId && typeof filterProviderId === 'string' && filterProviderId.trim().length > 0) {
        allReferrals = allReferrals.filter(
          (r) => r.referringProviderId === filterProviderId.trim() || r.receivingProviderId === filterProviderId.trim()
        );
      }

      setReferrals(Array.isArray(allReferrals) ? allReferrals : []);
    } catch (err) {
      console.error('ReferralManagement: failed to load data:', err);
      setError('Unable to load referral data');
      setReferrals([]);
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
   * Enriched referrals with member and provider names.
   */
  const enrichedReferrals = useMemo(() => {
    return referrals.map((referral) => {
      const member = members.find((m) => m.id === referral.memberId);
      const referringProvider = providers.find((p) => p.id === referral.referringProviderId);
      const receivingProvider = providers.find((p) => p.id === referral.receivingProviderId);

      const memberName = member
        ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
        : referral.memberId ? referral.memberId.substring(0, 12) + '…' : '—';

      const referringProviderName = referringProvider
        ? `${referringProvider.firstName || ''} ${referringProvider.lastName || ''}`.trim()
        : referral.referringProviderId ? referral.referringProviderId.substring(0, 12) + '…' : '—';

      const receivingProviderName = receivingProvider
        ? `${receivingProvider.firstName || ''} ${receivingProvider.lastName || ''}`.trim()
        : referral.receivingProviderId ? referral.receivingProviderId.substring(0, 12) + '…' : '—';

      const receivingInNetwork = receivingProvider ? isProviderInNetwork(receivingProvider) : false;
      const referringInNetwork = referringProvider ? isProviderInNetwork(referringProvider) : false;

      return {
        ...referral,
        _memberName: memberName,
        _referringProviderName: referringProviderName,
        _receivingProviderName: receivingProviderName,
        _referringProvider: referringProvider || null,
        _receivingProvider: receivingProvider || null,
        _member: member || null,
        _receivingInNetwork: receivingInNetwork,
        _referringInNetwork: referringInNetwork,
        _statusLabel: REFERRAL_STATUS_LABELS[referral.status] || toTitleCase(referral.status || 'unknown'),
        _referringSpecialty: referringProvider ? referringProvider.specialty : '—',
        _receivingSpecialty: receivingProvider ? receivingProvider.specialty : '—',
      };
    });
  }, [referrals, members, providers]);

  /**
   * Filtered records based on status and urgency filters.
   */
  const filteredRecords = useMemo(() => {
    let filtered = enrichedReferrals;

    if (statusFilter && statusFilter.trim().length > 0) {
      filtered = filtered.filter((r) => r.status === statusFilter.trim());
    }

    if (urgencyFilter && urgencyFilter.trim().length > 0) {
      filtered = filtered.filter((r) => r.urgency === urgencyFilter.trim());
    }

    return filtered;
  }, [enrichedReferrals, statusFilter, urgencyFilter]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const total = referrals.length;
    const pending = referrals.filter((r) => r.status === REFERRAL_STATUSES.PENDING).length;
    const accepted = referrals.filter((r) => r.status === REFERRAL_STATUSES.ACCEPTED).length;
    const inProgress = referrals.filter((r) => r.status === REFERRAL_STATUSES.IN_PROGRESS).length;
    const completed = referrals.filter((r) => r.status === REFERRAL_STATUSES.COMPLETED).length;
    const rejected = referrals.filter((r) => r.status === REFERRAL_STATUSES.REJECTED).length;
    const cancelled = referrals.filter((r) => r.status === REFERRAL_STATUSES.CANCELLED).length;
    const expired = referrals.filter((r) => r.status === REFERRAL_STATUSES.EXPIRED).length;
    const urgent = referrals.filter((r) => r.urgency === 'urgent' || r.urgency === 'emergent').length;

    return { total, pending, accepted, inProgress, completed, rejected, cancelled, expired, urgent };
  }, [referrals]);

  /**
   * Handles creating a new referral.
   * @param {Object} data - The referral data
   */
  const handleCreateReferral = useCallback((data) => {
    setCreateLoading(true);

    try {
      const performedBy = user ? user.id : 'system';

      const result = manageReferral(
        {
          memberId: data.memberId,
          referringProviderId: data.referringProviderId,
          receivingProviderId: data.receivingProviderId,
          reason: data.reason,
          urgency: data.urgency,
          diagnosisCodes: data.diagnosisCodes,
          referralDate: data.referralDate,
          expirationDate: data.expirationDate,
          notes: data.notes,
        },
        { performedBy }
      );

      if (result.success) {
        addNotification(
          'success',
          'Referral Created',
          `Referral has been created successfully. Status: ${REFERRAL_STATUS_LABELS[result.status] || result.status}`
        );

        setCreateModalOpen(false);
        loadData();

        if (typeof onReferralChange === 'function') {
          onReferralChange(result);
        }
      } else {
        addNotification(
          'error',
          'Referral Failed',
          result.error || 'An error occurred while creating the referral.'
        );
      }
    } catch (err) {
      console.error('ReferralManagement: create error:', err);
      addNotification('error', 'Referral Error', 'An unexpected error occurred.');
    } finally {
      setCreateLoading(false);
    }
  }, [user, addNotification, loadData, onReferralChange]);

  /**
   * Handles viewing a referral's details.
   * @param {Object} record - The referral record
   */
  const handleViewDetails = useCallback((record) => {
    setSelectedReferral(record);
    setDetailModalOpen(true);
  }, []);

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetail = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedReferral(null);
  }, []);

  /**
   * Handles updating a referral's status.
   * @param {string} referralId - The referral ID
   * @param {string} newStatus - The new status
   */
  const handleStatusChange = useCallback((referralId, newStatus) => {
    try {
      const performedBy = user ? user.id : 'system';

      const result = manageReferral(
        {
          id: referralId,
          status: newStatus,
        },
        { performedBy }
      );

      if (result.success) {
        addNotification(
          'success',
          'Referral Updated',
          `Referral status updated to ${REFERRAL_STATUS_LABELS[newStatus] || newStatus}.`
        );

        setDetailModalOpen(false);
        setSelectedReferral(null);
        loadData();

        if (typeof onReferralChange === 'function') {
          onReferralChange(result);
        }
      } else {
        addNotification(
          'error',
          'Update Failed',
          result.error || 'An error occurred while updating the referral.'
        );
      }
    } catch (err) {
      console.error('ReferralManagement: status change error:', err);
      addNotification('error', 'Update Error', 'An unexpected error occurred.');
    }
  }, [user, addNotification, loadData, onReferralChange]);

  /**
   * Handles initiating referral cancellation.
   * @param {string} referralId - The referral ID
   */
  const handleCancelInit = useCallback((referralId) => {
    setCancelTargetId(referralId);
    setCancelReason('');
    setCancelConfirmOpen(true);
    setDetailModalOpen(false);
  }, []);

  /**
   * Confirms and executes referral cancellation.
   */
  const handleConfirmCancel = useCallback(() => {
    if (!cancelTargetId) {
      return;
    }

    setCancelConfirmOpen(false);

    try {
      const performedBy = user ? user.id : 'system';
      const result = cancelReferral(cancelTargetId, cancelReason.trim() || 'Cancelled by user', performedBy);

      if (result.success) {
        addNotification(
          'info',
          'Referral Cancelled',
          'The referral has been cancelled.'
        );

        loadData();

        if (typeof onReferralChange === 'function') {
          onReferralChange({ success: true, action: 'cancel', referralId: cancelTargetId });
        }
      } else {
        addNotification(
          'error',
          'Cancellation Failed',
          result.error || 'An error occurred while cancelling the referral.'
        );
      }
    } catch (err) {
      console.error('ReferralManagement: cancel error:', err);
      addNotification('error', 'Cancellation Error', 'An unexpected error occurred.');
    } finally {
      setCancelTargetId(null);
      setCancelReason('');
    }
  }, [cancelTargetId, cancelReason, user, addNotification, loadData, onReferralChange]);

  /**
   * Handles status filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleStatusFilterChange = useCallback((e) => {
    setStatusFilter(e.target.value);
  }, []);

  /**
   * Handles urgency filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleUrgencyFilterChange = useCallback((e) => {
    setUrgencyFilter(e.target.value);
  }, []);

  /**
   * Handles exporting referrals as CSV.
   */
  const handleExportCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No referrals to export.');
      return;
    }

    try {
      const csv = buildCSVExport(filteredRecords);
      const filename = `referrals_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} referral(s) to CSV.`);
    } catch (err) {
      console.error('ReferralManagement: export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting referrals.');
    }
  }, [filteredRecords, addNotification]);

  /**
   * Handles exporting referrals as JSON.
   */
  const handleExportJSON = useCallback(() => {
    if (filteredRecords.length === 0) {
      addNotification('warning', 'No Data', 'No referrals to export.');
      return;
    }

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalRecords: filteredRecords.length,
        filters: {
          status: statusFilter || 'all',
          urgency: urgencyFilter || 'all',
        },
        records: filteredRecords.map(({
          _memberName, _referringProviderName, _receivingProviderName,
          _referringProvider, _receivingProvider, _member,
          _receivingInNetwork, _referringInNetwork, _statusLabel,
          _referringSpecialty, _receivingSpecialty,
          ...rest
        }) => rest),
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `referrals_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
      addNotification('success', 'Export Complete', `Exported ${filteredRecords.length} referral(s) to JSON.`);
    } catch (err) {
      console.error('ReferralManagement: JSON export failed:', err);
      addNotification('error', 'Export Failed', 'An error occurred while exporting referrals.');
    }
  }, [filteredRecords, statusFilter, urgencyFilter, addNotification]);

  /**
   * Table columns definition.
   */
  const columns = useMemo(() => {
    const cols = [
      {
        key: '_memberName',
        label: 'Member',
        sortable: true,
        searchable: true,
        width: 'min-w-[140px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate max-w-[160px]" title={value}>
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
        key: '_referringProviderName',
        label: 'From',
        sortable: true,
        searchable: true,
        width: 'min-w-[130px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate max-w-[140px]" title={value}>
                {value || '—'}
              </p>
              <p className="text-[10px] text-gray-400">{row._referringSpecialty || '—'}</p>
            </div>
          );
        },
      },
      {
        key: '_receivingProviderName',
        label: 'To',
        sortable: true,
        searchable: true,
        width: 'min-w-[130px]',
        render: (value, row) => {
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-gray-700 truncate max-w-[120px]" title={value}>
                  {value || '—'}
                </p>
                <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${row._receivingInNetwork ? 'bg-green-500' : 'bg-orange-500'}`} aria-hidden="true" title={row._receivingInNetwork ? 'In-Network' : 'Out-of-Network'} />
              </div>
              <p className="text-[10px] text-gray-400">{row._receivingSpecialty || '—'}</p>
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
        key: 'urgency',
        label: 'Urgency',
        sortable: true,
        searchable: false,
        width: 'min-w-[80px]',
        render: (value) => {
          if (!value) {
            return <span className="text-gray-400 text-xs">—</span>;
          }
          const style = URGENCY_STYLES[value] || URGENCY_STYLES.routine;
          return (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${style}`}>
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
            <div>
              <p className="text-xs text-gray-700">{formatDate(value)}</p>
              <p className="text-[10px] text-gray-400">{formatRelativeTime(value)}</p>
            </div>
          );
        },
      },
    ];

    if (!compact) {
      cols.push({
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
      });

      cols.push({
        key: '_receivingInNetwork',
        label: 'Network',
        sortable: true,
        searchable: false,
        width: 'min-w-[100px]',
        render: (value) => {
          return (
            <StatusBadge
              status={value ? 'active' : 'expired'}
              label={value ? 'In-Network' : 'Out-of-Network'}
              size="sm"
              showDot={true}
              bordered={true}
            />
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ];

    if (isAuthenticated) {
      actionList.push({
        label: 'Cancel',
        onClick: (row) => handleCancelInit(row.id),
        variant: 'ghost',
        size: 'sm',
        visible: (row) => [REFERRAL_STATUSES.PENDING, REFERRAL_STATUSES.ACCEPTED, REFERRAL_STATUSES.IN_PROGRESS].includes(row.status),
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
      });
    }

    return actionList;
  }, [isAuthenticated, handleViewDetails, handleCancelInit]);

  /**
   * Computed: the referral being confirmed for cancellation.
   */
  const referralToCancel = useMemo(() => {
    if (!cancelTargetId) {
      return null;
    }
    return enrichedReferrals.find((r) => r.id === cancelTargetId) || null;
  }, [cancelTargetId, enrichedReferrals]);

  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Referral icon */}
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              {hasTitle && (
                <h3 className="text-lg font-semibold text-csnp-primary">
                  {title}
                </h3>
              )}
              {!loading && referrals.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {referrals.length} referral{referrals.length !== 1 ? 's' : ''}
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

              {/* Urgency Filter */}
              {!compact && (
                <select
                  value={urgencyFilter}
                  onChange={handleUrgencyFilterChange}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                  aria-label="Filter by urgency"
                >
                  <option value="">All Urgencies</option>
                  {URGENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Create Referral Button */}
              {showCreateButton && isAuthenticated && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCreateModalOpen(true)}
                  iconLeft={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  }
                >
                  New Referral
                </Button>
              )}

              {/* Export Buttons */}
              {showExport && !loading && filteredRecords.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    iconLeft={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
          {showStats && !loading && !error && referrals.length > 0 && !compact && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-yellow-700">
                  {stats.pending} pending
                </span>
              </div>
              {stats.accepted > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-blue-700">
                    {stats.accepted} accepted
                  </span>
                </div>
              )}
              {stats.inProgress > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-purple-700">
                    {stats.inProgress} in progress
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-green-700">
                  {stats.completed} completed
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
              {stats.urgent > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-orange-700">
                    {stats.urgent} urgent/emergent
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <ReferralManagementSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load referral data"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadData}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && referrals.length === 0 && (
        <EmptyState
          title="No Referrals"
          description="No referrals have been created yet. Create a new referral to get started."
          iconType="no-data"
          size="sm"
          actionLabel={showCreateButton && isAuthenticated ? 'Create Referral' : undefined}
          onAction={showCreateButton && isAuthenticated ? () => setCreateModalOpen(true) : undefined}
          actionVariant="primary"
          actionIcon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        />
      )}

      {/* Filtered Empty State */}
      {!loading && !error && referrals.length > 0 && filteredRecords.length === 0 && (
        <EmptyState
          title="No Matching Referrals"
          description={`No referrals match the selected filters${statusFilter ? ` (Status: ${REFERRAL_STATUS_LABELS[statusFilter] || toTitleCase(statusFilter)})` : ''}${urgencyFilter ? ` (Urgency: ${toTitleCase(urgencyFilter)})` : ''}.`}
          iconType="no-results"
          size="sm"
          actionLabel="Clear Filters"
          onAction={() => {
            setStatusFilter('');
            setUrgencyFilter('');
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
          searchPlaceholder="Search by member, provider, reason..."
          paginated={true}
          initialPageSize={initialPageSize}
          initialSortField="referralDate"
          initialSortDirection="desc"
          emptyMessage="No referrals found"
          emptyDescription="No referrals match the current search criteria."
          idKey="id"
          onRowClick={handleViewDetails}
          className=""
        />
      )}

      {/* CMS Compliance Notice */}
      {!loading && !error && !compact && referrals.length > 0 && (
        <div className="mt-4">
          <div className="flex items-start gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-csnp-primary flex-shrink-0 mt-0.5" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
              <span className="font-semibold">CMS Compliance:</span>{' '}
              Referrals must comply with CMS network adequacy and care coordination requirements
              (42 CFR §422.112). C-SNP members should be referred to providers who specialize in
              their qualifying chronic condition category. Out-of-network referrals may require
              prior authorization and should be documented with clinical justification. All referrals
              are tracked in the audit trail for compliance reporting.
            </p>
          </div>
        </div>
      )}

      {/* Create Referral Modal */}
      <CreateReferralModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreateReferral}
        loading={createLoading}
        initialMemberId={initialMemberId}
        initialReferringProviderId={initialReferringProviderId}
      />

      {/* Detail Modal */}
      <ReferralDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        referral={selectedReferral}
        onStatusChange={handleStatusChange}
        onCancel={handleCancelInit}
      />

      {/* Cancel Confirm Dialog */}
      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => {
          setCancelConfirmOpen(false);
          setCancelTargetId(null);
          setCancelReason('');
        }}
        onConfirm={handleConfirmCancel}
        title="Cancel Referral"
        message={referralToCancel
          ? `Are you sure you want to cancel the referral for ${referralToCancel._memberName || 'this member'}? This action cannot be undone.`
          : 'Are you sure you want to cancel this referral?'}
        confirmText="Cancel Referral"
        cancelText="Keep Referral"
        variant="warning"
      >
        <div className="mt-3">
          <label htmlFor="cancel-referral-reason" className="text-xs font-medium text-gray-700 mb-1 block">
            Cancellation Reason (optional)
          </label>
          <textarea
            id="cancel-referral-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason for cancellation..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 resize-y"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

ReferralManagement.propTypes = {
  showHeader: PropTypes.bool,
  title: PropTypes.string,
  showExport: PropTypes.bool,
  showStats: PropTypes.bool,
  showCreateButton: PropTypes.bool,
  compact: PropTypes.bool,
  initialPageSize: PropTypes.number,
  filterMemberId: PropTypes.string,
  filterProviderId: PropTypes.string,
  filterStatus: PropTypes.string,
  initialMemberId: PropTypes.string,
  initialReferringProviderId: PropTypes.string,
  onReferralChange: PropTypes.func,
  className: PropTypes.string,
  headerActions: PropTypes.node,
};

ReferralManagement.defaultProps = {
  showHeader: true,
  title: 'Referral Management',
  showExport: true,
  showStats: true,
  showCreateButton: true,
  compact: false,
  initialPageSize: 20,
  filterMemberId: undefined,
  filterProviderId: undefined,
  filterStatus: undefined,
  initialMemberId: undefined,
  initialReferringProviderId: undefined,
  onReferralChange: undefined,
  className: '',
  headerActions: null,
};