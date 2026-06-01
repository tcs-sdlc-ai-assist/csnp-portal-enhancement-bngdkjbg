import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
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
import {
  assignProvider,
  getProviderNetwork,
  getActivePCPAssignment,
  getMemberProviderAssignments,
  getProviderById,
  deactivateProviderAssignment,
  findEligibleProvidersForMember,
  checkProviderEligibility,
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
import { CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Specialty filter options for the provider list.
 * @param {Object[]} providers - Array of provider objects
 * @returns {{ value: string, label: string }[]}
 */
function buildSpecialtyOptions(providers) {
  const specialties = new Set();
  if (Array.isArray(providers)) {
    for (const provider of providers) {
      if (provider.specialty && typeof provider.specialty === 'string' && provider.specialty.trim().length > 0) {
        specialties.add(provider.specialty.trim());
      }
    }
  }
  const sorted = [...specialties].sort();
  return [
    { value: '', label: 'All Specialties' },
    ...sorted.map((s) => ({ value: s, label: s })),
  ];
}

/**
 * Skeleton loading state for the PCP assignment panel.
 * @returns {React.ReactElement}
 */
function PCPAssignmentSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-20 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  );
}

/**
 * Current PCP assignment display component.
 *
 * @param {Object} props
 * @param {Object|null} props.assignment - The active PCP assignment record
 * @param {Object|null} props.provider - The assigned provider object
 * @param {Object|null} props.member - The member object
 * @param {Function} props.onReassign - Callback when reassign is clicked
 * @param {Function} props.onRemove - Callback when remove assignment is clicked
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function CurrentPCPDisplay({ assignment, provider, member, onReassign, onRemove, disabled = false }) {
  if (!assignment || !provider) {
    return (
      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
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
            className="text-yellow-600 flex-shrink-0"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-yellow-800">No PCP Assigned</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              {member
                ? `${member.firstName} ${member.lastName} does not have a primary care provider assigned.`
                : 'This member does not have a primary care provider assigned.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const providerFullName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Unknown Provider';
  const inNetwork = provider.inNetwork === true || (provider.contract && provider.contract.status === 'active' && provider.contract.contractType === 'In-Network');
  const conditionCategories = Array.isArray(provider.conditionCategories) ? provider.conditionCategories : [];

  return (
    <div className={`p-4 rounded-lg border ${inNetwork ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Provider Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${inNetwork ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          {/* Provider Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">{providerFullName}</p>
              <StatusBadge
                status={inNetwork ? 'active' : 'expired'}
                label={inNetwork ? 'In-Network' : 'Out-of-Network'}
                size="sm"
                showDot={true}
                bordered={true}
              />
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              {provider.specialty || 'No specialty'} · {provider.facilityName || 'No facility'}
            </p>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
              {provider.npi && (
                <span>NPI: <span className="font-mono">{provider.npi}</span></span>
              )}
              {provider.phone && (
                <span>{formatPhone(provider.phone)}</span>
              )}
            </div>
            {provider.address && typeof provider.address === 'object' && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {formatAddress(provider.address)}
              </p>
            )}
            {conditionCategories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {conditionCategories.slice(0, 3).map((category) => (
                  <span
                    key={category}
                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded border border-green-200"
                  >
                    {CONDITION_CATEGORY_LABELS[category] || category}
                  </span>
                ))}
                {conditionCategories.length > 3 && (
                  <span className="text-[10px] text-gray-400 self-center">
                    +{conditionCategories.length - 3} more
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
              <span>Assigned: {assignment.createdAt ? formatRelativeTime(assignment.createdAt) : '—'}</span>
              {assignment.assignedBy && (
                <>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                  <span>By: {assignment.assignedBy.substring(0, 8)}…</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!disabled && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onReassign}
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
                  <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              }
            >
              Reassign
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              }
            >
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

CurrentPCPDisplay.propTypes = {
  assignment: PropTypes.object,
  provider: PropTypes.object,
  member: PropTypes.object,
  onReassign: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

CurrentPCPDisplay.defaultProps = {
  assignment: null,
  provider: null,
  member: null,
  disabled: false,
};

/**
 * Member search/select component for PCP assignment.
 *
 * @param {Object} props
 * @param {string} props.selectedMemberId - Currently selected member ID
 * @param {Function} props.onSelectMember - Callback when a member is selected
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 * @returns {React.ReactElement}
 */
function MemberSelector({ selectedMemberId, onSelectMember, disabled = false }) {
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  /**
   * Loads members from localStorage.
   */
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

  /**
   * Filtered members based on search query.
   */
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

  /**
   * Selected member object.
   */
  const selectedMember = useMemo(() => {
    if (!selectedMemberId) {
      return null;
    }
    return members.find((m) => m.id === selectedMemberId) || null;
  }, [selectedMemberId, members]);

  /**
   * Handles clicking outside the dropdown.
   */
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

  /**
   * Handles selecting a member.
   * @param {Object} member - The member object
   */
  const handleSelectMember = useCallback((member) => {
    onSelectMember(member.id);
    setSearchQuery('');
    setShowDropdown(false);
  }, [onSelectMember]);

  return (
    <div className="space-y-2">
      <label className="font-medium text-sm text-gray-700">
        Select Member
        <span className="text-csnp-alert-error ml-0.5" aria-hidden="true">*</span>
      </label>

      {/* Selected Member Display */}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Search Input */}
      {!selectedMember && (
        <div className="relative">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
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
              placeholder="Search by name, member ID, or Medicare ID..."
              disabled={disabled}
              className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
              aria-label="Search members"
            />
          </div>

          {/* Dropdown */}
          {showDropdown && filteredMembers.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              role="listbox"
            >
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
                      {member.medicareId && ` · ${member.medicareId}`}
                    </p>
                  </div>
                  {member.csnpEligible && (
                    <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                      CSNP
                    </span>
                  )}
                </button>
              ))}
              {filteredMembers.length > 10 && (
                <div className="px-3 py-2 text-[10px] text-gray-400 text-center">
                  Showing 10 of {filteredMembers.length} results. Refine your search.
                </div>
              )}
            </div>
          )}

          {showDropdown && searchQuery.trim().length > 0 && filteredMembers.length === 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
              <p className="text-xs text-gray-400">No members found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-500">
        Search and select a member to manage their PCP assignment.
      </p>
    </div>
  );
}

MemberSelector.propTypes = {
  selectedMemberId: PropTypes.string.isRequired,
  onSelectMember: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

MemberSelector.defaultProps = {
  disabled: false,
};

/**
 * Assignment history item component.
 *
 * @param {Object} props
 * @param {Object} props.assignment - The assignment record
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function AssignmentHistoryItem({ assignment, isLast = false }) {
  const isActive = assignment.status === 'active';

  return (
    <div className={`flex items-start gap-3 py-2.5 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isActive ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-900 truncate max-w-[140px]">
              {assignment.providerId ? assignment.providerId.substring(0, 12) + '…' : '—'}
            </span>
            <StatusBadge
              status={isActive ? 'active' : 'expired'}
              label={toTitleCase(assignment.status || 'unknown')}
              size="sm"
              showDot={true}
              bordered={false}
            />
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2" title={formatDateTime(assignment.createdAt)}>
            {formatRelativeTime(assignment.createdAt)}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {assignment.assignmentType ? toTitleCase(assignment.assignmentType) : 'PCP'}
          {assignment.inNetwork !== undefined && (
            <span> · {assignment.inNetwork ? 'In-Network' : 'Out-of-Network'}</span>
          )}
        </p>
        {assignment.deactivationReason && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate" title={assignment.deactivationReason}>
            Reason: {assignment.deactivationReason}
          </p>
        )}
      </div>
    </div>
  );
}

AssignmentHistoryItem.propTypes = {
  assignment: PropTypes.shape({
    id: PropTypes.string,
    providerId: PropTypes.string,
    status: PropTypes.string,
    assignmentType: PropTypes.string,
    inNetwork: PropTypes.bool,
    assignedBy: PropTypes.string,
    deactivationReason: PropTypes.string,
    createdAt: PropTypes.string,
  }).isRequired,
  isLast: PropTypes.bool,
};

AssignmentHistoryItem.defaultProps = {
  isLast: false,
};

/**
 * Reassignment reason modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onConfirm - Confirm handler with reason and effective date
 * @param {Object|null} props.selectedProvider - The provider being assigned
 * @param {Object|null} props.currentProvider - The current PCP provider
 * @param {boolean} props.isReassignment - Whether this is a reassignment (vs new assignment)
 * @param {boolean} [props.loading=false] - Whether the assignment is processing
 * @returns {React.ReactElement|null}
 */
function AssignmentModal({ isOpen, onClose, onConfirm, selectedProvider, currentProvider, isReassignment, loading = false }) {
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [allowOutOfNetwork, setAllowOutOfNetwork] = useState(false);

  /**
   * Resets form when modal opens.
   */
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setEffectiveDate(new Date().toISOString().split('T')[0]);
      setAllowOutOfNetwork(false);
    }
  }, [isOpen]);

  /**
   * Handles confirm action.
   */
  const handleConfirm = useCallback(() => {
    onConfirm({
      reason: reason.trim(),
      effectiveDate: effectiveDate.trim(),
      allowOutOfNetwork,
    });
  }, [onConfirm, reason, effectiveDate, allowOutOfNetwork]);

  if (!selectedProvider) {
    return null;
  }

  const providerName = `${selectedProvider.firstName || ''} ${selectedProvider.lastName || ''}`.trim() || 'Unknown Provider';
  const isInNetwork = selectedProvider.contract && selectedProvider.contract.status === 'active' && selectedProvider.contract.contractType === 'In-Network';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReassignment ? 'Reassign Primary Care Provider' : 'Assign Primary Care Provider'}
      size="md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Provider Info */}
        <div className={`p-3 rounded-lg border ${isInNetwork ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-center gap-2">
            <StatusBadge
              status={isInNetwork ? 'active' : 'expired'}
              label={isInNetwork ? 'In-Network' : 'Out-of-Network'}
              size="sm"
              showDot={true}
              bordered={true}
            />
            <span className="text-sm font-semibold text-gray-900">{providerName}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            {selectedProvider.specialty || 'No specialty'} · {selectedProvider.facilityName || 'No facility'}
          </p>
          {selectedProvider.npi && (
            <p className="text-[10px] text-gray-500 mt-0.5">NPI: {selectedProvider.npi}</p>
          )}
        </div>

        {/* Current Provider (for reassignment) */}
        {isReassignment && currentProvider && (
          <Alert
            variant="info"
            title="Current PCP will be replaced"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            <p>
              Current PCP: <strong>{currentProvider.firstName} {currentProvider.lastName}</strong> ({currentProvider.specialty || 'No specialty'}).
              This assignment will be deactivated.
            </p>
          </Alert>
        )}

        {/* Out-of-Network Warning */}
        {!isInNetwork && (
          <Alert
            variant="warning"
            title="Out-of-Network Provider"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            <p>
              This provider is not in-network. Out-of-network assignments may result in higher costs for the member.
            </p>
            <div className="mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOutOfNetwork}
                  onChange={(e) => setAllowOutOfNetwork(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-csnp-primary focus:ring-csnp-primary-light cursor-pointer"
                />
                <span className="text-xs font-medium text-yellow-800">
                  I acknowledge this is an out-of-network assignment
                </span>
              </label>
            </div>
          </Alert>
        )}

        {/* Effective Date */}
        <FormField
          name="effectiveDate"
          label="Effective Date"
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          required={true}
          helperText="Date the PCP assignment takes effect"
          disabled={loading}
        />

        {/* Reason */}
        <FormField
          name="assignmentReason"
          label={isReassignment ? 'Reassignment Reason' : 'Assignment Notes'}
          type="textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isReassignment
            ? 'Enter reason for PCP reassignment...'
            : 'Enter any notes about this PCP assignment (optional)...'}
          rows={3}
          maxLength={500}
          required={isReassignment}
          disabled={loading}
          helperText={isReassignment ? 'A reason is required for PCP reassignment' : 'Optional notes for this assignment'}
        />

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
            PCP assignments must comply with CMS network adequacy requirements (42 CFR §422.116).
            Providers must have valid NPI numbers, active contracts, and appropriate specialty
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
            onClick={handleConfirm}
            loading={loading}
            loadingText="Assigning..."
            disabled={loading || (!isInNetwork && !allowOutOfNetwork) || (isReassignment && reason.trim().length === 0)}
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
            {isReassignment ? 'Reassign PCP' : 'Assign PCP'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

AssignmentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  selectedProvider: PropTypes.object,
  currentProvider: PropTypes.object,
  isReassignment: PropTypes.bool.isRequired,
  loading: PropTypes.bool,
};

AssignmentModal.defaultProps = {
  selectedProvider: null,
  currentProvider: null,
  loading: false,
};

/**
 * PCP assignment management component.
 * Provides member search/select, available PCP list with specialty filter,
 * assignment action with effective date, current assignment display,
 * and reassignment workflow with reason capture.
 *
 * @param {Object} props
 * @param {string} [props.initialMemberId=''] - Pre-selected member ID
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showHistory=true] - Whether to show assignment history
 * @param {boolean} [props.showEligibleOnly=false] - Whether to show only eligible providers
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {Function} [props.onAssignmentChange] - Callback when assignment changes: (result) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function PCPAssignment({
  initialMemberId = '',
  showHeader = true,
  showHistory = true,
  showEligibleOnly = false,
  compact = false,
  onAssignmentChange,
  className = '',
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  // Member selection state
  const [selectedMemberId, setSelectedMemberId] = useState(initialMemberId);
  const [selectedMember, setSelectedMember] = useState(null);

  // Current assignment state
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [currentProvider, setCurrentProvider] = useState(null);
  const [assignmentHistory, setAssignmentHistory] = useState([]);

  // Available providers state
  const [availableProviders, setAvailableProviders] = useState([]);
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [networkFilter, setNetworkFilter] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedProviderForAssignment, setSelectedProviderForAssignment] = useState(null);
  const [isReassignment, setIsReassignment] = useState(false);

  // Remove confirmation state
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState('');

  /**
   * Loads member data when selectedMemberId changes.
   */
  useEffect(() => {
    if (!selectedMemberId || selectedMemberId.trim().length === 0) {
      setSelectedMember(null);
      setCurrentAssignment(null);
      setCurrentProvider(null);
      setAssignmentHistory([]);
      return;
    }

    try {
      const storedMembers = localStorage.getItem('csnp_members');
      if (storedMembers) {
        const members = JSON.parse(storedMembers);
        if (Array.isArray(members)) {
          const member = members.find((m) => m.id === selectedMemberId.trim());
          setSelectedMember(member || null);
        }
      }
    } catch {
      setSelectedMember(null);
    }
  }, [selectedMemberId]);

  /**
   * Loads current PCP assignment and history when member is selected.
   */
  const loadAssignmentData = useCallback(() => {
    if (!selectedMemberId || selectedMemberId.trim().length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load current active PCP assignment
      const activeAssignment = getActivePCPAssignment(selectedMemberId.trim());
      setCurrentAssignment(activeAssignment);

      // Load current provider details
      if (activeAssignment && activeAssignment.providerId) {
        const provider = getProviderById(activeAssignment.providerId);
        setCurrentProvider(provider);
      } else {
        setCurrentProvider(null);
      }

      // Load assignment history
      if (showHistory) {
        const history = getMemberProviderAssignments(selectedMemberId.trim());
        setAssignmentHistory(Array.isArray(history) ? history : []);
      }
    } catch (err) {
      console.error('PCPAssignment: failed to load assignment data:', err);
      setError('Unable to load PCP assignment data');
    } finally {
      setLoading(false);
    }
  }, [selectedMemberId, showHistory]);

  /**
   * Loads assignment data when member changes.
   */
  useEffect(() => {
    loadAssignmentData();
  }, [loadAssignmentData]);

  /**
   * Loads available providers.
   */
  const loadAvailableProviders = useCallback(() => {
    setProvidersLoading(true);

    try {
      let providers;

      if (showEligibleOnly && selectedMemberId && selectedMemberId.trim().length > 0) {
        providers = findEligibleProvidersForMember(selectedMemberId.trim());
      } else {
        providers = getProviderNetwork({
          acceptingNewPatients: true,
        });
      }

      setAvailableProviders(Array.isArray(providers) ? providers : []);
    } catch (err) {
      console.error('PCPAssignment: failed to load providers:', err);
      setAvailableProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  }, [selectedMemberId, showEligibleOnly]);

  /**
   * Loads providers when member changes.
   */
  useEffect(() => {
    if (selectedMemberId && selectedMemberId.trim().length > 0) {
      loadAvailableProviders();
    }
  }, [loadAvailableProviders, selectedMemberId]);

  /**
   * Computed: specialty filter options.
   */
  const specialtyOptions = useMemo(() => {
    return buildSpecialtyOptions(availableProviders);
  }, [availableProviders]);

  /**
   * Computed: filtered providers.
   */
  const filteredProviders = useMemo(() => {
    let filtered = availableProviders;

    if (specialtyFilter && specialtyFilter.trim().length > 0) {
      filtered = filtered.filter((p) => p.specialty === specialtyFilter.trim());
    }

    if (networkFilter === 'in_network') {
      filtered = filtered.filter((p) =>
        p.contract && p.contract.status === 'active' && p.contract.contractType === 'In-Network'
      );
    } else if (networkFilter === 'out_of_network') {
      filtered = filtered.filter((p) =>
        !p.contract || p.contract.status !== 'active' || p.contract.contractType !== 'In-Network'
      );
    }

    // Exclude current PCP from the list
    if (currentAssignment && currentAssignment.providerId) {
      filtered = filtered.filter((p) => p.id !== currentAssignment.providerId);
    }

    return filtered;
  }, [availableProviders, specialtyFilter, networkFilter, currentAssignment]);

  /**
   * Computed: provider stats.
   */
  const providerStats = useMemo(() => {
    const total = availableProviders.length;
    const inNetwork = availableProviders.filter((p) =>
      p.contract && p.contract.status === 'active' && p.contract.contractType === 'In-Network'
    ).length;
    const accepting = availableProviders.filter((p) => p.acceptingNewPatients).length;

    return { total, inNetwork, accepting };
  }, [availableProviders]);

  /**
   * Handles initiating a new PCP assignment.
   * @param {Object} provider - The provider to assign
   */
  const handleInitiateAssignment = useCallback((provider) => {
    setSelectedProviderForAssignment(provider);
    setIsReassignment(!!currentAssignment);
    setAssignmentModalOpen(true);
  }, [currentAssignment]);

  /**
   * Handles initiating a reassignment from the current PCP display.
   */
  const handleInitiateReassignment = useCallback(() => {
    setIsReassignment(true);
    setSelectedProviderForAssignment(null);
    setAssignmentModalOpen(false);
    // Scroll to provider list or focus on it
  }, []);

  /**
   * Handles confirming a PCP assignment.
   * @param {Object} data - Assignment data with reason and effective date
   */
  const handleConfirmAssignment = useCallback((data) => {
    if (!selectedMemberId || !selectedProviderForAssignment) {
      return;
    }

    setAssignmentLoading(true);

    try {
      const performedBy = user ? user.id : 'system';

      // If reassigning, deactivate current assignment first
      if (isReassignment && currentAssignment) {
        deactivateProviderAssignment(
          currentAssignment.id,
          data.reason || 'PCP reassignment',
          performedBy
        );
      }

      const result = assignProvider(selectedMemberId.trim(), selectedProviderForAssignment.id, {
        performedBy,
        allowOutOfNetwork: data.allowOutOfNetwork || false,
      });

      if (result.success) {
        addNotification(
          'success',
          isReassignment ? 'PCP Reassigned' : 'PCP Assigned',
          `${selectedProviderForAssignment.firstName} ${selectedProviderForAssignment.lastName} has been ${isReassignment ? 'reassigned' : 'assigned'} as PCP for ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'the member'}.`
        );

        setAssignmentModalOpen(false);
        setSelectedProviderForAssignment(null);
        loadAssignmentData();
        loadAvailableProviders();

        if (typeof onAssignmentChange === 'function') {
          onAssignmentChange(result);
        }
      } else {
        addNotification(
          'error',
          'Assignment Failed',
          result.error || 'An error occurred while assigning the PCP.'
        );
      }
    } catch (err) {
      console.error('PCPAssignment: assignment error:', err);
      addNotification('error', 'Assignment Error', 'An unexpected error occurred.');
    } finally {
      setAssignmentLoading(false);
    }
  }, [selectedMemberId, selectedProviderForAssignment, isReassignment, currentAssignment, user, selectedMember, addNotification, loadAssignmentData, loadAvailableProviders, onAssignmentChange]);

  /**
   * Handles removing the current PCP assignment.
   */
  const handleRemoveAssignment = useCallback(() => {
    if (!currentAssignment) {
      return;
    }

    try {
      const performedBy = user ? user.id : 'system';
      const result = deactivateProviderAssignment(
        currentAssignment.id,
        removeReason.trim() || 'PCP assignment removed',
        performedBy
      );

      if (result.success) {
        addNotification(
          'info',
          'PCP Assignment Removed',
          `PCP assignment has been removed for ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'the member'}.`
        );

        setRemoveConfirmOpen(false);
        setRemoveReason('');
        loadAssignmentData();
        loadAvailableProviders();

        if (typeof onAssignmentChange === 'function') {
          onAssignmentChange({ success: true, action: 'remove' });
        }
      } else {
        addNotification(
          'error',
          'Removal Failed',
          result.error || 'An error occurred while removing the PCP assignment.'
        );
      }
    } catch (err) {
      console.error('PCPAssignment: remove error:', err);
      addNotification('error', 'Removal Error', 'An unexpected error occurred.');
    }
  }, [currentAssignment, removeReason, user, selectedMember, addNotification, loadAssignmentData, loadAvailableProviders, onAssignmentChange]);

  /**
   * Provider table columns.
   */
  const providerColumns = useMemo(() => {
    const cols = [
      {
        key: 'lastName',
        label: 'Provider',
        sortable: true,
        searchable: true,
        width: 'min-w-[180px]',
        render: (value, row) => {
          const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim();
          return (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate max-w-[200px]" title={fullName}>
                {fullName || 'Unnamed Provider'}
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
        render: (value) => (
          <span className="text-xs text-gray-700 truncate max-w-[140px]" title={value}>
            {value || '—'}
          </span>
        ),
      },
      {
        key: 'npi',
        label: 'NPI',
        sortable: true,
        searchable: true,
        width: 'min-w-[100px]',
        render: (value) => (
          <span className="text-xs font-mono text-gray-700">{value || '—'}</span>
        ),
      },
    ];

    if (!compact) {
      cols.push({
        key: 'contract',
        label: 'Network',
        sortable: false,
        searchable: false,
        width: 'min-w-[110px]',
        render: (value) => {
          const inNetwork = value && value.status === 'active' && value.contractType === 'In-Network';
          return (
            <StatusBadge
              status={inNetwork ? 'active' : 'expired'}
              label={inNetwork ? 'In-Network' : 'Out-of-Network'}
              size="sm"
              showDot={true}
              bordered={true}
            />
          );
        },
      });

      cols.push({
        key: 'acceptingNewPatients',
        label: 'Accepting',
        sortable: true,
        searchable: false,
        width: 'min-w-[80px]',
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
        key: 'conditionCategories',
        label: 'Conditions',
        sortable: false,
        searchable: false,
        width: 'min-w-[140px]',
        render: (value) => {
          if (!Array.isArray(value) || value.length === 0) {
            return <span className="text-gray-400 text-xs">—</span>;
          }
          const labels = value.slice(0, 2).map((c) => CONDITION_CATEGORY_LABELS[c] || c);
          return (
            <div className="min-w-0">
              <p className="text-xs text-gray-700 truncate max-w-[160px]" title={value.map((c) => CONDITION_CATEGORY_LABELS[c] || c).join(', ')}>
                {labels.join(', ')}
                {value.length > 2 ? ` +${value.length - 2}` : ''}
              </p>
            </div>
          );
        },
      });
    }

    return cols;
  }, [compact]);

  /**
   * Provider table actions.
   */
  const providerActions = useMemo(() => {
    if (!isAuthenticated || !selectedMemberId) {
      return [];
    }

    return [
      {
        label: 'Assign',
        onClick: (row) => handleInitiateAssignment(row),
        variant: 'primary',
        size: 'sm',
        disabled: (row) => !row.acceptingNewPatients,
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
    ];
  }, [isAuthenticated, selectedMemberId, handleInitiateAssignment]);

  const hasMemberSelected = typeof selectedMemberId === 'string' && selectedMemberId.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
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
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-csnp-primary">
                PCP Assignment
              </h2>
              {!compact && (
                <p className="mt-0.5 text-sm text-gray-500">
                  Manage primary care provider assignments for C-SNP members. Search for a member, view their current PCP, and assign or reassign providers.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Member Selection */}
      <Card bordered={true} flat={false} className="mb-6">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-csnp-primary">Member Selection</p>
          <MemberSelector
            selectedMemberId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
            disabled={assignmentLoading}
          />
        </div>
      </Card>

      {/* No Member Selected */}
      {!hasMemberSelected && (
        <EmptyState
          title="Select a Member"
          description="Search and select a member above to manage their PCP assignment."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Loading State */}
      {hasMemberSelected && loading && (
        <PCPAssignmentSkeleton />
      )}

      {/* Error State */}
      {hasMemberSelected && !loading && error && (
        <EmptyState
          title="Unable to load PCP assignment data"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadAssignmentData}
          actionVariant="outline"
        />
      )}

      {/* Assignment Content */}
      {hasMemberSelected && !loading && !error && (
        <>
          {/* Current PCP Assignment */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-csnp-primary">Current PCP Assignment</p>
                {currentAssignment && (
                  <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                    Active
                  </span>
                )}
              </div>

              <CurrentPCPDisplay
                assignment={currentAssignment}
                provider={currentProvider}
                member={selectedMember}
                onReassign={handleInitiateReassignment}
                onRemove={() => setRemoveConfirmOpen(true)}
                disabled={!isAuthenticated || assignmentLoading}
              />
            </div>
          </Card>

          {/* Available Providers */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-csnp-primary">
                    Available Providers
                  </p>
                  {!providersLoading && availableProviders.length > 0 && (
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {availableProviders.length} provider{availableProviders.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Specialty Filter */}
                  <select
                    value={specialtyFilter}
                    onChange={(e) => setSpecialtyFilter(e.target.value)}
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
                    onChange={(e) => setNetworkFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                    aria-label="Filter by network type"
                  >
                    <option value="">All Networks</option>
                    <option value="in_network">In-Network</option>
                    <option value="out_of_network">Out-of-Network</option>
                  </select>

                  {/* Refresh */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadAvailableProviders}
                    disabled={providersLoading}
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

              {/* Provider Stats */}
              {!compact && !providersLoading && availableProviders.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                    <span className="text-[10px] font-medium text-green-700">
                      {providerStats.inNetwork} in-network
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-csnp-blue-50 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-csnp-primary" aria-hidden="true" />
                    <span className="text-[10px] font-medium text-csnp-primary">
                      {providerStats.accepting} accepting
                    </span>
                  </div>
                </div>
              )}

              {/* Loading Providers */}
              {providersLoading && (
                <LoadingSpinner
                  size="sm"
                  variant="primary"
                  text="Loading available providers..."
                />
              )}

              {/* No Providers */}
              {!providersLoading && availableProviders.length === 0 && (
                <EmptyState
                  title="No Available Providers"
                  description={showEligibleOnly
                    ? 'No eligible providers found for this member\'s condition category. Try disabling the eligible-only filter.'
                    : 'No providers are currently available in the network.'}
                  iconType="no-data"
                  size="sm"
                />
              )}

              {/* Filtered Empty */}
              {!providersLoading && availableProviders.length > 0 && filteredProviders.length === 0 && (
                <EmptyState
                  title="No Matching Providers"
                  description={`No providers match the selected filters${specialtyFilter ? ` (Specialty: ${specialtyFilter})` : ''}${networkFilter ? ` (Network: ${networkFilter === 'in_network' ? 'In-Network' : 'Out-of-Network'})` : ''}.`}
                  iconType="no-results"
                  size="sm"
                  actionLabel="Clear Filters"
                  onAction={() => {
                    setSpecialtyFilter('');
                    setNetworkFilter('');
                  }}
                  actionVariant="outline"
                />
              )}

              {/* Provider Table */}
              {!providersLoading && filteredProviders.length > 0 && (
                <DataTable
                  data={filteredProviders}
                  columns={providerColumns}
                  actions={providerActions}
                  loading={false}
                  searchable={!compact}
                  searchPlaceholder="Search by name, specialty, NPI..."
                  paginated={true}
                  initialPageSize={compact ? 5 : 10}
                  initialSortField="lastName"
                  initialSortDirection="asc"
                  emptyMessage="No providers found"
                  emptyDescription="No providers match the current search criteria."
                  idKey="id"
                  className=""
                />
              )}
            </div>
          </Card>

          {/* Assignment History */}
          {showHistory && assignmentHistory.length > 0 && (
            <Card bordered={true} flat={false} className="mb-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-csnp-primary">
                    Assignment History
                  </p>
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {assignmentHistory.length} record{assignmentHistory.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div>
                  {assignmentHistory.slice(0, 5).map((assignment, index) => (
                    <AssignmentHistoryItem
                      key={assignment.id || `history-${index}`}
                      assignment={assignment}
                      isLast={index === Math.min(assignmentHistory.length, 5) - 1}
                    />
                  ))}
                  {assignmentHistory.length > 5 && (
                    <p className="text-[10px] text-gray-400 text-center pt-2">
                      Showing 5 of {assignmentHistory.length} records
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* CMS Compliance Notice */}
          {!compact && (
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
                PCP assignments must comply with CMS network adequacy requirements (42 CFR §422.116).
                All assigned providers must have valid NPI numbers, active contracts within effective date ranges,
                and appropriate specialty coverage for the member&apos;s chronic conditions. C-SNP members
                should be assigned to providers who specialize in their qualifying chronic condition category.
              </p>
            </div>
          )}
        </>
      )}

      {/* Assignment Modal */}
      <AssignmentModal
        isOpen={assignmentModalOpen}
        onClose={() => {
          setAssignmentModalOpen(false);
          setSelectedProviderForAssignment(null);
        }}
        onConfirm={handleConfirmAssignment}
        selectedProvider={selectedProviderForAssignment}
        currentProvider={currentProvider}
        isReassignment={isReassignment}
        loading={assignmentLoading}
      />

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        isOpen={removeConfirmOpen}
        onClose={() => {
          setRemoveConfirmOpen(false);
          setRemoveReason('');
        }}
        onConfirm={handleRemoveAssignment}
        title="Remove PCP Assignment"
        message={currentProvider
          ? `Are you sure you want to remove ${currentProvider.firstName} ${currentProvider.lastName} as the PCP for ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'this member'}? The member will not have an assigned primary care provider.`
          : 'Are you sure you want to remove this PCP assignment?'}
        confirmText="Remove Assignment"
        cancelText="Cancel"
        variant="warning"
      >
        <div className="mt-3">
          <label htmlFor="remove-reason" className="text-xs font-medium text-gray-700 mb-1 block">
            Removal Reason (optional)
          </label>
          <textarea
            id="remove-reason"
            value={removeReason}
            onChange={(e) => setRemoveReason(e.target.value)}
            placeholder="Enter reason for removing PCP assignment..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 resize-y"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

PCPAssignment.propTypes = {
  initialMemberId: PropTypes.string,
  showHeader: PropTypes.bool,
  showHistory: PropTypes.bool,
  showEligibleOnly: PropTypes.bool,
  compact: PropTypes.bool,
  onAssignmentChange: PropTypes.func,
  className: PropTypes.string,
};

PCPAssignment.defaultProps = {
  initialMemberId: '',
  showHeader: true,
  showHistory: true,
  showEligibleOnly: false,
  compact: false,
  onAssignmentChange: undefined,
  className: '',
};