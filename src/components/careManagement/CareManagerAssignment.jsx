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
  assignCareManager,
  getActiveCareManagerAssignment,
  getCareManagerMembers,
  getCareManagerTasks,
  getCareManagerAlerts,
  getCareManagementStats,
} from '../../services/careManagementService.js';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toTitleCase,
  calculateAge,
} from '../../utils/helpers.js';
import {
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Skeleton loading state for the care manager assignment panel.
 * @returns {React.ReactElement}
 */
function CareManagerAssignmentSkeleton() {
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
 * Member selector component for care manager assignment.
 *
 * @param {Object} props
 * @param {string} props.selectedMemberId - Currently selected member ID
 * @param {Function} props.onSelectMember - Callback when a member is selected
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 * @returns {React.ReactElement}
 */
function AssignmentMemberSelector({ selectedMemberId, onSelectMember, disabled = false }) {
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
              <p className="text-xs text-gray-400">No members found matching &quot;{searchQuery}&quot;</p>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-500">
        Search and select a member to assign or reassign a care manager.
      </p>
    </div>
  );
}

AssignmentMemberSelector.propTypes = {
  selectedMemberId: PropTypes.string.isRequired,
  onSelectMember: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

AssignmentMemberSelector.defaultProps = {
  disabled: false,
};

/**
 * Current care manager assignment display component.
 *
 * @param {Object} props
 * @param {Object|null} props.assignment - The active care manager assignment record
 * @param {Object|null} props.careManager - The assigned care manager user object
 * @param {Object|null} props.member - The member object
 * @param {number} props.caseloadCount - Number of members assigned to this care manager
 * @param {number} props.pendingTasksCount - Number of pending tasks for this care manager
 * @param {number} props.activeAlertsCount - Number of active alerts for this care manager
 * @param {Function} props.onReassign - Callback when reassign is clicked
 * @param {Function} props.onRemove - Callback when remove assignment is clicked
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function CurrentCareManagerDisplay({
  assignment,
  careManager,
  member,
  caseloadCount,
  pendingTasksCount,
  activeAlertsCount,
  onReassign,
  onRemove,
  disabled = false,
}) {
  if (!assignment || !careManager) {
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
            <p className="text-sm font-semibold text-yellow-800">No Care Manager Assigned</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              {member
                ? `${member.firstName} ${member.lastName} does not have a care manager assigned.`
                : 'This member does not have a care manager assigned.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const managerFullName = `${careManager.firstName || ''} ${careManager.lastName || ''}`.trim() || 'Unknown Manager';

  return (
    <div className="p-4 rounded-lg border bg-csnp-blue-50 border-csnp-blue-100">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Care Manager Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white">
            {careManager.firstName ? careManager.firstName.charAt(0).toUpperCase() : ''}
            {careManager.lastName ? careManager.lastName.charAt(0).toUpperCase() : ''}
          </div>

          {/* Care Manager Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">{managerFullName}</p>
              <StatusBadge
                status="active"
                label="Active"
                size="sm"
                showDot={true}
                bordered={true}
              />
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Care Manager · {careManager.email || 'No email'}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
              <span>Caseload: <span className="font-semibold text-gray-700">{caseloadCount} member{caseloadCount !== 1 ? 's' : ''}</span></span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>Tasks: <span className={`font-semibold ${pendingTasksCount > 0 ? 'text-yellow-700' : 'text-gray-700'}`}>{pendingTasksCount} pending</span></span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>Alerts: <span className={`font-semibold ${activeAlertsCount > 0 ? 'text-orange-700' : 'text-gray-700'}`}>{activeAlertsCount} active</span></span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
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

CurrentCareManagerDisplay.propTypes = {
  assignment: PropTypes.object,
  careManager: PropTypes.object,
  member: PropTypes.object,
  caseloadCount: PropTypes.number.isRequired,
  pendingTasksCount: PropTypes.number.isRequired,
  activeAlertsCount: PropTypes.number.isRequired,
  onReassign: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

CurrentCareManagerDisplay.defaultProps = {
  assignment: null,
  careManager: null,
  member: null,
  disabled: false,
};

/**
 * Care manager card component for the available managers list.
 *
 * @param {Object} props
 * @param {Object} props.manager - The care manager user object
 * @param {number} props.caseloadCount - Number of members assigned
 * @param {number} props.pendingTasksCount - Number of pending tasks
 * @param {number} props.activeAlertsCount - Number of active alerts
 * @param {boolean} props.isCurrentManager - Whether this is the currently assigned manager
 * @param {Function} props.onAssign - Callback when assign is clicked
 * @param {boolean} [props.disabled=false] - Whether the assign button is disabled
 * @returns {React.ReactElement}
 */
function CareManagerCard({ manager, caseloadCount, pendingTasksCount, activeAlertsCount, isCurrentManager, onAssign, disabled = false }) {
  const managerFullName = `${manager.firstName || ''} ${manager.lastName || ''}`.trim() || 'Unknown Manager';

  const caseloadLevel = caseloadCount >= 20 ? 'high' : caseloadCount >= 10 ? 'medium' : 'low';
  const caseloadColors = {
    low: 'text-green-700 bg-green-50',
    medium: 'text-yellow-700 bg-yellow-50',
    high: 'text-red-700 bg-red-50',
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors duration-150 ${
      isCurrentManager
        ? 'bg-csnp-blue-50 border-csnp-blue-100'
        : 'bg-white border-gray-200 hover:border-gray-300'
    }`}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white">
        {manager.firstName ? manager.firstName.charAt(0).toUpperCase() : ''}
        {manager.lastName ? manager.lastName.charAt(0).toUpperCase() : ''}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-gray-900 truncate max-w-[160px]" title={managerFullName}>
            {managerFullName}
          </p>
          {isCurrentManager && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-csnp-blue-100 text-csnp-primary border border-csnp-blue-200">
              Current
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {manager.email || 'No email'}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${caseloadColors[caseloadLevel]}`}>
            {caseloadCount} member{caseloadCount !== 1 ? 's' : ''}
          </span>
          {pendingTasksCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-yellow-700 bg-yellow-50">
              {pendingTasksCount} task{pendingTasksCount !== 1 ? 's' : ''}
            </span>
          )}
          {activeAlertsCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-orange-700 bg-orange-50">
              {activeAlertsCount} alert{activeAlertsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Assign Button */}
      {!isCurrentManager && !disabled && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => onAssign(manager)}
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
          Assign
        </Button>
      )}
    </div>
  );
}

CareManagerCard.propTypes = {
  manager: PropTypes.shape({
    id: PropTypes.string.isRequired,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
    active: PropTypes.bool,
  }).isRequired,
  caseloadCount: PropTypes.number.isRequired,
  pendingTasksCount: PropTypes.number.isRequired,
  activeAlertsCount: PropTypes.number.isRequired,
  isCurrentManager: PropTypes.bool.isRequired,
  onAssign: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

CareManagerCard.defaultProps = {
  disabled: false,
};

/**
 * Assignment confirmation modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onConfirm - Confirm handler
 * @param {Object|null} props.selectedManager - The care manager being assigned
 * @param {Object|null} props.currentManager - The current care manager (for reassignment)
 * @param {Object|null} props.member - The member object
 * @param {boolean} props.isReassignment - Whether this is a reassignment
 * @param {boolean} [props.loading=false] - Whether the assignment is processing
 * @returns {React.ReactElement|null}
 */
function AssignmentConfirmModal({ isOpen, onClose, onConfirm, selectedManager, currentManager, member, isReassignment, loading = false }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    onConfirm({ reason: reason.trim() });
  }, [onConfirm, reason]);

  if (!selectedManager) {
    return null;
  }

  const managerName = `${selectedManager.firstName || ''} ${selectedManager.lastName || ''}`.trim() || 'Unknown Manager';
  const memberName = member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : 'this member';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReassignment ? 'Reassign Care Manager' : 'Assign Care Manager'}
      size="md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Selected Manager Info */}
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white">
              {selectedManager.firstName ? selectedManager.firstName.charAt(0).toUpperCase() : ''}
              {selectedManager.lastName ? selectedManager.lastName.charAt(0).toUpperCase() : ''}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-csnp-primary">{managerName}</p>
              <p className="text-xs text-csnp-blue-700">
                Care Manager · {selectedManager.email || 'No email'}
              </p>
            </div>
          </div>
        </div>

        {/* Current Manager (for reassignment) */}
        {isReassignment && currentManager && (
          <Alert
            variant="info"
            title="Current care manager will be replaced"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            <p>
              Current care manager: <strong>{currentManager.firstName} {currentManager.lastName}</strong>.
              This assignment will be deactivated and replaced.
            </p>
          </Alert>
        )}

        {/* Member Info */}
        {member && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {memberName}
              {member.conditionCategory && (
                <span className="text-gray-500"> · {CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory)}</span>
              )}
            </p>
          </div>
        )}

        {/* Reason */}
        <FormField
          name="assignmentReason"
          label={isReassignment ? 'Reassignment Reason' : 'Assignment Notes'}
          type="textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isReassignment
            ? 'Enter reason for care manager reassignment...'
            : 'Enter any notes about this assignment (optional)...'}
          rows={3}
          maxLength={500}
          required={isReassignment}
          disabled={loading}
          helperText={isReassignment ? 'A reason is required for care manager reassignment' : 'Optional notes for this assignment'}
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
            C-SNP members must have an assigned care manager for care coordination per
            42 CFR §422.101. Care manager assignments are tracked in the audit trail.
            Reassignments should include a documented reason.
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
            disabled={loading || (isReassignment && reason.trim().length === 0)}
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
            {isReassignment ? 'Reassign Care Manager' : 'Assign Care Manager'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

AssignmentConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  selectedManager: PropTypes.object,
  currentManager: PropTypes.object,
  member: PropTypes.object,
  isReassignment: PropTypes.bool.isRequired,
  loading: PropTypes.bool,
};

AssignmentConfirmModal.defaultProps = {
  selectedManager: null,
  currentManager: null,
  member: null,
  loading: false,
};

/**
 * Assignment history item component.
 *
 * @param {Object} props
 * @param {Object} props.assignment - The assignment record
 * @param {Object|null} props.managerUser - The care manager user object
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function AssignmentHistoryItem({ assignment, managerUser, isLast = false }) {
  const isActive = assignment.status === 'active';
  const managerName = managerUser
    ? `${managerUser.firstName || ''} ${managerUser.lastName || ''}`.trim()
    : assignment.managerId ? assignment.managerId.substring(0, 12) + '…' : '—';

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
            <span className="text-xs font-semibold text-gray-900 truncate max-w-[160px]">
              {managerName}
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
          Care Manager Assignment
          {assignment.assignedBy && (
            <span> · Assigned by: {assignment.assignedBy.substring(0, 8)}…</span>
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
    managerId: PropTypes.string,
    status: PropTypes.string,
    assignedBy: PropTypes.string,
    deactivationReason: PropTypes.string,
    createdAt: PropTypes.string,
  }).isRequired,
  managerUser: PropTypes.object,
  isLast: PropTypes.bool,
};

AssignmentHistoryItem.defaultProps = {
  managerUser: null,
  isLast: false,
};

/**
 * Care manager assignment component.
 * Displays available care managers with caseload, allows assignment to members,
 * shows current assignments, and supports reassignment with reason capture.
 *
 * @param {Object} props
 * @param {string} [props.initialMemberId=''] - Pre-selected member ID
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showHistory=true] - Whether to show assignment history
 * @param {boolean} [props.showCaseloadStats=true] - Whether to show caseload statistics
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {Function} [props.onAssignmentChange] - Callback when assignment changes: (result) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function CareManagerAssignment({
  initialMemberId = '',
  showHeader = true,
  showHistory = true,
  showCaseloadStats = true,
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
  const [currentCareManager, setCurrentCareManager] = useState(null);

  // Available care managers state
  const [careManagers, setCareManagers] = useState([]);
  const [careManagerStats, setCareManagerStats] = useState({});

  // Assignment history state
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [users, setUsers] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [managersLoading, setManagersLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedManagerForAssignment, setSelectedManagerForAssignment] = useState(null);
  const [isReassignment, setIsReassignment] = useState(false);

  // Remove confirmation state
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  /**
   * Loads users from localStorage.
   */
  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem('csnp_users');
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          setUsers(parsed);
        }
      }
    } catch {
      setUsers([]);
    }
  }, []);

  /**
   * Loads member data when selectedMemberId changes.
   */
  useEffect(() => {
    if (!selectedMemberId || selectedMemberId.trim().length === 0) {
      setSelectedMember(null);
      setCurrentAssignment(null);
      setCurrentCareManager(null);
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
   * Loads current care manager assignment and history when member is selected.
   */
  const loadAssignmentData = useCallback(() => {
    if (!selectedMemberId || selectedMemberId.trim().length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load current active care manager assignment
      const activeAssignment = getActiveCareManagerAssignment(selectedMemberId.trim());
      setCurrentAssignment(activeAssignment);

      // Load current care manager user details
      if (activeAssignment && activeAssignment.managerId) {
        const manager = users.find((u) => u.id === activeAssignment.managerId);
        setCurrentCareManager(manager || null);
      } else {
        setCurrentCareManager(null);
      }

      // Load assignment history
      if (showHistory) {
        try {
          const storedAssignments = localStorage.getItem('csnp_care_manager_assignments');
          if (storedAssignments) {
            const allAssignments = JSON.parse(storedAssignments);
            if (Array.isArray(allAssignments)) {
              const memberAssignments = allAssignments
                .filter((a) => a.memberId === selectedMemberId.trim())
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setAssignmentHistory(memberAssignments);
            }
          }
        } catch {
          setAssignmentHistory([]);
        }
      }
    } catch (err) {
      console.error('CareManagerAssignment: failed to load assignment data:', err);
      setError('Unable to load care manager assignment data');
    } finally {
      setLoading(false);
    }
  }, [selectedMemberId, showHistory, users]);

  /**
   * Loads assignment data when member or users change.
   */
  useEffect(() => {
    loadAssignmentData();
  }, [loadAssignmentData]);

  /**
   * Loads available care managers with caseload stats.
   */
  const loadCareManagers = useCallback(() => {
    setManagersLoading(true);

    try {
      const allCareManagers = users.filter(
        (u) => u.role === 'care_manager' && u.active === true
      );
      setCareManagers(allCareManagers);

      // Calculate caseload stats for each care manager
      const stats = {};
      for (const manager of allCareManagers) {
        const memberIds = getCareManagerMembers(manager.id);
        const tasks = getCareManagerTasks(manager.id, { status: 'pending' });
        const alerts = getCareManagerAlerts(manager.id, { unacknowledgedOnly: true });

        stats[manager.id] = {
          caseloadCount: memberIds.length,
          pendingTasksCount: tasks.length,
          activeAlertsCount: alerts.length,
        };
      }
      setCareManagerStats(stats);
    } catch (err) {
      console.error('CareManagerAssignment: failed to load care managers:', err);
      setCareManagers([]);
      setCareManagerStats({});
    } finally {
      setManagersLoading(false);
    }
  }, [users]);

  /**
   * Loads care managers when users change.
   */
  useEffect(() => {
    if (users.length > 0) {
      loadCareManagers();
    }
  }, [loadCareManagers, users]);

  /**
   * Computed: sorted care managers by caseload (ascending).
   */
  const sortedCareManagers = useMemo(() => {
    return [...careManagers].sort((a, b) => {
      const caseloadA = careManagerStats[a.id] ? careManagerStats[a.id].caseloadCount : 0;
      const caseloadB = careManagerStats[b.id] ? careManagerStats[b.id].caseloadCount : 0;
      return caseloadA - caseloadB;
    });
  }, [careManagers, careManagerStats]);

  /**
   * Computed: current care manager stats.
   */
  const currentManagerStats = useMemo(() => {
    if (!currentAssignment || !currentAssignment.managerId) {
      return { caseloadCount: 0, pendingTasksCount: 0, activeAlertsCount: 0 };
    }
    return careManagerStats[currentAssignment.managerId] || { caseloadCount: 0, pendingTasksCount: 0, activeAlertsCount: 0 };
  }, [currentAssignment, careManagerStats]);

  /**
   * Computed: overall caseload stats.
   */
  const overallStats = useMemo(() => {
    let totalMembers = 0;
    let totalTasks = 0;
    let totalAlerts = 0;

    for (const managerId of Object.keys(careManagerStats)) {
      const stats = careManagerStats[managerId];
      totalMembers += stats.caseloadCount;
      totalTasks += stats.pendingTasksCount;
      totalAlerts += stats.activeAlertsCount;
    }

    const avgCaseload = careManagers.length > 0
      ? Math.round((totalMembers / careManagers.length) * 10) / 10
      : 0;

    return {
      totalManagers: careManagers.length,
      totalMembers,
      totalTasks,
      totalAlerts,
      avgCaseload,
    };
  }, [careManagers, careManagerStats]);

  /**
   * Handles initiating a care manager assignment.
   * @param {Object} manager - The care manager to assign
   */
  const handleInitiateAssignment = useCallback((manager) => {
    setSelectedManagerForAssignment(manager);
    setIsReassignment(!!currentAssignment);
    setAssignModalOpen(true);
  }, [currentAssignment]);

  /**
   * Handles confirming a care manager assignment.
   * @param {Object} data - Assignment data with reason
   */
  const handleConfirmAssignment = useCallback((data) => {
    if (!selectedMemberId || !selectedManagerForAssignment) {
      return;
    }

    setAssignmentLoading(true);

    try {
      const performedBy = user ? user.id : 'system';

      const result = assignCareManager(selectedMemberId.trim(), selectedManagerForAssignment.id, {
        performedBy,
      });

      if (result.success) {
        addNotification(
          'success',
          isReassignment ? 'Care Manager Reassigned' : 'Care Manager Assigned',
          `${selectedManagerForAssignment.firstName} ${selectedManagerForAssignment.lastName} has been ${isReassignment ? 'reassigned' : 'assigned'} as care manager for ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'the member'}.`
        );

        setAssignModalOpen(false);
        setSelectedManagerForAssignment(null);
        loadAssignmentData();
        loadCareManagers();

        if (typeof onAssignmentChange === 'function') {
          onAssignmentChange(result);
        }
      } else {
        addNotification(
          'error',
          'Assignment Failed',
          result.error || 'An error occurred while assigning the care manager.'
        );
      }
    } catch (err) {
      console.error('CareManagerAssignment: assignment error:', err);
      addNotification('error', 'Assignment Error', 'An unexpected error occurred.');
    } finally {
      setAssignmentLoading(false);
    }
  }, [selectedMemberId, selectedManagerForAssignment, isReassignment, user, selectedMember, addNotification, loadAssignmentData, loadCareManagers, onAssignmentChange]);

  /**
   * Handles removing the current care manager assignment.
   */
  const handleRemoveAssignment = useCallback(() => {
    if (!currentAssignment) {
      return;
    }

    setRemoveConfirmOpen(false);

    try {
      const performedBy = user ? user.id : 'system';

      // Deactivate the assignment by updating it in localStorage
      const storedAssignments = localStorage.getItem('csnp_care_manager_assignments');
      if (storedAssignments) {
        const allAssignments = JSON.parse(storedAssignments);
        if (Array.isArray(allAssignments)) {
          const timestamp = new Date().toISOString();
          const updated = allAssignments.map((a) => {
            if (a.id === currentAssignment.id) {
              return {
                ...a,
                status: 'inactive',
                deactivatedAt: timestamp,
                deactivationReason: 'Care manager assignment removed',
                updatedAt: timestamp,
              };
            }
            return a;
          });
          localStorage.setItem('csnp_care_manager_assignments', JSON.stringify(updated));
        }
      }

      addNotification(
        'info',
        'Care Manager Removed',
        `Care manager assignment has been removed for ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'the member'}.`
      );

      loadAssignmentData();
      loadCareManagers();

      if (typeof onAssignmentChange === 'function') {
        onAssignmentChange({ success: true, action: 'remove' });
      }
    } catch (err) {
      console.error('CareManagerAssignment: remove error:', err);
      addNotification('error', 'Removal Error', 'An unexpected error occurred.');
    }
  }, [currentAssignment, user, selectedMember, addNotification, loadAssignmentData, loadCareManagers, onAssignmentChange]);

  /**
   * Gets a user object by ID.
   * @param {string} userId - The user ID
   * @returns {Object|null}
   */
  const getUserById = useCallback((userId) => {
    if (!userId) return null;
    return users.find((u) => u.id === userId) || null;
  }, [users]);

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
                Care Manager Assignment
              </h2>
              {!compact && (
                <p className="mt-0.5 text-sm text-gray-500">
                  Assign or reassign care managers to C-SNP members. View caseload distribution
                  and manage care coordination assignments.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Caseload Statistics */}
      {showCaseloadStats && !compact && !managersLoading && careManagers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
            <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Care Managers</p>
            <p className="text-lg font-bold text-csnp-primary">{overallStats.totalManagers}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Total Members</p>
            <p className="text-lg font-bold text-green-700">{overallStats.totalMembers}</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Avg Caseload</p>
            <p className="text-lg font-bold text-yellow-700">{overallStats.avgCaseload}</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-[10px] text-orange-500 uppercase tracking-wider font-semibold">Pending Tasks</p>
            <p className={`text-lg font-bold ${overallStats.totalTasks > 0 ? 'text-orange-700' : 'text-orange-400'}`}>{overallStats.totalTasks}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Active Alerts</p>
            <p className={`text-lg font-bold ${overallStats.totalAlerts > 0 ? 'text-red-700' : 'text-red-400'}`}>{overallStats.totalAlerts}</p>
          </div>
        </div>
      )}

      {/* Member Selection */}
      <Card bordered={true} flat={false} className="mb-6">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-csnp-primary">Member Selection</p>
          <AssignmentMemberSelector
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
          description="Search and select a member above to manage their care manager assignment."
          iconType="no-data"
          size="sm"
        />
      )}

      {/* Loading State */}
      {hasMemberSelected && loading && (
        <CareManagerAssignmentSkeleton />
      )}

      {/* Error State */}
      {hasMemberSelected && !loading && error && (
        <EmptyState
          title="Unable to load care manager assignment data"
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
          {/* Current Care Manager Assignment */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-csnp-primary">Current Care Manager</p>
                {currentAssignment && (
                  <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                    Active
                  </span>
                )}
              </div>

              <CurrentCareManagerDisplay
                assignment={currentAssignment}
                careManager={currentCareManager}
                member={selectedMember}
                caseloadCount={currentManagerStats.caseloadCount}
                pendingTasksCount={currentManagerStats.pendingTasksCount}
                activeAlertsCount={currentManagerStats.activeAlertsCount}
                onReassign={() => {
                  setIsReassignment(true);
                  setSelectedManagerForAssignment(null);
                }}
                onRemove={() => setRemoveConfirmOpen(true)}
                disabled={!isAuthenticated || assignmentLoading}
              />
            </div>
          </Card>

          {/* Available Care Managers */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-csnp-primary">
                    Available Care Managers
                  </p>
                  {!managersLoading && careManagers.length > 0 && (
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {careManagers.length} manager{careManagers.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadCareManagers}
                  disabled={managersLoading}
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

              {/* Caseload Distribution Info */}
              {!compact && !managersLoading && careManagers.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                    <span className="text-[10px] font-medium text-green-700">
                      Sorted by lowest caseload
                    </span>
                  </div>
                </div>
              )}

              {/* Loading Care Managers */}
              {managersLoading && (
                <LoadingSpinner
                  size="sm"
                  variant="primary"
                  text="Loading care managers..."
                />
              )}

              {/* No Care Managers */}
              {!managersLoading && careManagers.length === 0 && (
                <EmptyState
                  title="No Care Managers Available"
                  description="No active care managers are available in the system. Please contact an administrator."
                  iconType="no-data"
                  size="sm"
                />
              )}

              {/* Care Manager Cards */}
              {!managersLoading && sortedCareManagers.length > 0 && (
                <div className="space-y-2">
                  {sortedCareManagers.map((manager) => {
                    const stats = careManagerStats[manager.id] || { caseloadCount: 0, pendingTasksCount: 0, activeAlertsCount: 0 };
                    const isCurrent = currentAssignment && currentAssignment.managerId === manager.id;

                    return (
                      <CareManagerCard
                        key={manager.id}
                        manager={manager}
                        caseloadCount={stats.caseloadCount}
                        pendingTasksCount={stats.pendingTasksCount}
                        activeAlertsCount={stats.activeAlertsCount}
                        isCurrentManager={isCurrent}
                        onAssign={handleInitiateAssignment}
                        disabled={!isAuthenticated || assignmentLoading}
                      />
                    );
                  })}
                </div>
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
                      managerUser={getUserById(assignment.managerId)}
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
                C-SNP members must have an assigned care manager for care coordination per
                42 CFR §422.101. Care managers are responsible for developing individualized
                care plans, coordinating services, and conducting regular member outreach.
                Caseload should be balanced to ensure quality care coordination. All assignments
                and reassignments are tracked in the audit trail.
              </p>
            </div>
          )}
        </>
      )}

      {/* Assignment Confirmation Modal */}
      <AssignmentConfirmModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedManagerForAssignment(null);
        }}
        onConfirm={handleConfirmAssignment}
        selectedManager={selectedManagerForAssignment}
        currentManager={currentCareManager}
        member={selectedMember}
        isReassignment={isReassignment}
        loading={assignmentLoading}
      />

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        isOpen={removeConfirmOpen}
        onClose={() => setRemoveConfirmOpen(false)}
        onConfirm={handleRemoveAssignment}
        title="Remove Care Manager Assignment"
        message={currentCareManager
          ? `Are you sure you want to remove ${currentCareManager.firstName} ${currentCareManager.lastName} as the care manager for ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'this member'}? The member will not have an assigned care manager.`
          : 'Are you sure you want to remove this care manager assignment?'}
        confirmText="Remove Assignment"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}

CareManagerAssignment.propTypes = {
  initialMemberId: PropTypes.string,
  showHeader: PropTypes.bool,
  showHistory: PropTypes.bool,
  showCaseloadStats: PropTypes.bool,
  compact: PropTypes.bool,
  onAssignmentChange: PropTypes.func,
  className: PropTypes.string,
};

CareManagerAssignment.defaultProps = {
  initialMemberId: '',
  showHeader: true,
  showHistory: true,
  showCaseloadStats: true,
  compact: false,
  onAssignmentChange: undefined,
  className: '',
};