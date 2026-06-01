import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import FormField from '../common/FormField.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Modal from '../common/Modal.jsx';
import { triggerCareManagement } from '../../services/careManagementService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toTitleCase,
  calculateAge,
} from '../../utils/helpers.js';
import {
  CARE_MANAGEMENT_EVENTS,
  CARE_MANAGEMENT_EVENT_LABELS,
} from '../../utils/constants.js';
import {
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';

/**
 * Event type options for the select field.
 * @type {{ value: string, label: string, description: string, category: string }[]}
 */
const EVENT_TYPE_OPTIONS = [
  {
    value: CARE_MANAGEMENT_EVENTS.HOSPITALIZATION,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.HOSPITALIZATION],
    description: 'Member has been admitted to a hospital',
    category: 'clinical',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.DISCHARGE,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.DISCHARGE],
    description: 'Member has been discharged from a hospital',
    category: 'clinical',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.TRANSITION_OF_CARE,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.TRANSITION_OF_CARE],
    description: 'Member is transitioning between care settings',
    category: 'clinical',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.ASSESSMENT,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.ASSESSMENT],
    description: 'Health risk assessment or initial assessment due',
    category: 'assessment',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.CARE_PLAN_CREATED,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.CARE_PLAN_CREATED],
    description: 'Create a new individualized care plan for the member',
    category: 'care_plan',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.CARE_PLAN_UPDATED,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.CARE_PLAN_UPDATED],
    description: 'Update an existing care plan with new goals or interventions',
    category: 'care_plan',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.CARE_PLAN_REVIEWED,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.CARE_PLAN_REVIEWED],
    description: 'Periodic review of the member\'s care plan',
    category: 'care_plan',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.MEDICATION_REVIEW,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.MEDICATION_REVIEW],
    description: 'Medication reconciliation or review triggered',
    category: 'clinical',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.REFERRAL_MADE,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.REFERRAL_MADE],
    description: 'A referral to a specialist or service has been made',
    category: 'referral',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.FOLLOW_UP,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.FOLLOW_UP],
    description: 'Scheduled follow-up with the member',
    category: 'outreach',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.PHONE_CALL,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.PHONE_CALL],
    description: 'Phone call outreach to the member',
    category: 'outreach',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.HOME_VISIT,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.HOME_VISIT],
    description: 'In-home visit with the member',
    category: 'outreach',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.OFFICE_VISIT,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.OFFICE_VISIT],
    description: 'Office visit with the member',
    category: 'outreach',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.MEMBER_OUTREACH,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.MEMBER_OUTREACH],
    description: 'General outreach attempt to the member',
    category: 'outreach',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.PROVIDER_COORDINATION,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.PROVIDER_COORDINATION],
    description: 'Coordination with the member\'s provider(s)',
    category: 'referral',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.GOAL_MET,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.GOAL_MET],
    description: 'A care plan goal has been achieved',
    category: 'care_plan',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.GOAL_UPDATED,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.GOAL_UPDATED],
    description: 'A care plan goal has been modified',
    category: 'care_plan',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.BARRIER_IDENTIFIED,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.BARRIER_IDENTIFIED],
    description: 'A barrier to care has been identified',
    category: 'clinical',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.INTERVENTION,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.INTERVENTION],
    description: 'A care management intervention has been performed',
    category: 'clinical',
  },
  {
    value: CARE_MANAGEMENT_EVENTS.ESCALATION,
    label: CARE_MANAGEMENT_EVENT_LABELS[CARE_MANAGEMENT_EVENTS.ESCALATION],
    description: 'An issue has been escalated for urgent attention',
    category: 'clinical',
  },
];

/**
 * Event type select options for the FormField select.
 * @type {{ value: string, label: string }[]}
 */
const EVENT_TYPE_SELECT_OPTIONS = EVENT_TYPE_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
}));

/**
 * Event category labels.
 * @type {Object.<string, string>}
 */
const EVENT_CATEGORY_LABELS = {
  clinical: 'Clinical Events',
  assessment: 'Assessment Events',
  care_plan: 'Care Plan Events',
  outreach: 'Outreach Events',
  referral: 'Referral & Coordination',
};

/**
 * Event category to color mapping.
 * @type {Object.<string, { bg: string, text: string, border: string }>}
 */
const EVENT_CATEGORY_STYLES = {
  clinical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  assessment: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  care_plan: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  outreach: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  referral: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
};

/**
 * High-priority event types that trigger alerts.
 * @type {string[]}
 */
const HIGH_PRIORITY_EVENTS = [
  CARE_MANAGEMENT_EVENTS.HOSPITALIZATION,
  CARE_MANAGEMENT_EVENTS.DISCHARGE,
  CARE_MANAGEMENT_EVENTS.ESCALATION,
  CARE_MANAGEMENT_EVENTS.TRANSITION_OF_CARE,
];

/**
 * Member selector component for care event trigger.
 *
 * @param {Object} props
 * @param {string} props.selectedMemberId - Currently selected member ID
 * @param {Function} props.onSelectMember - Callback when a member is selected
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 * @returns {React.ReactElement}
 */
function CareEventMemberSelector({ selectedMemberId, onSelectMember, disabled = false }) {
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
        Search and select a member to trigger a care management event.
      </p>
    </div>
  );
}

CareEventMemberSelector.propTypes = {
  selectedMemberId: PropTypes.string.isRequired,
  onSelectMember: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

CareEventMemberSelector.defaultProps = {
  disabled: false,
};

/**
 * Event type card component for visual event type selection.
 *
 * @param {Object} props
 * @param {Object} props.eventOption - The event type option object
 * @param {boolean} props.selected - Whether this event type is selected
 * @param {Function} props.onSelect - Selection handler
 * @param {boolean} [props.disabled=false] - Whether the card is disabled
 * @returns {React.ReactElement}
 */
function EventTypeCard({ eventOption, selected, onSelect, disabled = false }) {
  const categoryStyle = EVENT_CATEGORY_STYLES[eventOption.category] || EVENT_CATEGORY_STYLES.clinical;
  const isHighPriority = HIGH_PRIORITY_EVENTS.includes(eventOption.value);

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(eventOption.value)}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-1 ${
        selected
          ? 'bg-csnp-blue-50 border-csnp-primary shadow-sm'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={selected}
    >
      <div className="flex items-start gap-2">
        <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5 ${
          selected ? 'bg-csnp-primary text-white' : `${categoryStyle.bg} ${categoryStyle.text}`
        }`}>
          {selected ? (
            <svg
              width="12"
              height="12"
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
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-xs font-semibold ${selected ? 'text-csnp-primary' : 'text-gray-900'}`}>
              {eventOption.label}
            </p>
            {isHighPriority && (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">
                HIGH
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
            {eventOption.description}
          </p>
        </div>
      </div>
    </button>
  );
}

EventTypeCard.propTypes = {
  eventOption: PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    category: PropTypes.string.isRequired,
  }).isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

EventTypeCard.defaultProps = {
  disabled: false,
};

/**
 * Trigger result display component.
 *
 * @param {Object} props
 * @param {Object} props.result - The trigger result object
 * @param {Function} props.onDismiss - Dismiss handler
 * @returns {React.ReactElement}
 */
function TriggerResultDisplay({ result, onDismiss }) {
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Alert
        variant={result.success ? 'success' : 'error'}
        title={result.success ? 'Care Management Event Triggered Successfully' : 'Event Trigger Failed'}
        showIcon={true}
        bordered={true}
      >
        {result.success ? (
          <div>
            <p>
              The care management event has been triggered and processed.
              {result.eventId && (
                <span> Event ID: <strong>{result.eventId.substring(0, 16)}…</strong></span>
              )}
            </p>
          </div>
        ) : (
          <p>{result.error || 'An error occurred while triggering the care management event.'}</p>
        )}
      </Alert>

      {result.success && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Event ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={result.eventId}>
              {result.eventId ? result.eventId.substring(0, 12) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Care Enrollment</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {result.careEnrollmentStatus ? toTitleCase(result.careEnrollmentStatus.replace(/_/g, ' ')) : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Care Manager</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate">
              {result.careManagerId ? result.careManagerId.substring(0, 12) + '…' : 'Not assigned'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Care Plan</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate">
              {result.carePlanId ? result.carePlanId.substring(0, 12) + '…' : 'Not generated'}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
        >
          {result.success ? 'Trigger Another Event' : 'Try Again'}
        </Button>
      </div>
    </div>
  );
}

TriggerResultDisplay.propTypes = {
  result: PropTypes.shape({
    success: PropTypes.bool,
    eventId: PropTypes.string,
    careEnrollmentStatus: PropTypes.string,
    careManagerId: PropTypes.string,
    carePlanId: PropTypes.string,
    auditId: PropTypes.string,
    timestamp: PropTypes.string,
    error: PropTypes.string,
  }),
  onDismiss: PropTypes.func.isRequired,
};

TriggerResultDisplay.defaultProps = {
  result: null,
};

/**
 * Care management event trigger component.
 * Provides event type selection (hospital admission, care gap, diagnosis change,
 * HRA due), member selection, event details form, and trigger action button.
 * Calls careManagementService.triggerCareManagement on submission.
 *
 * @param {Object} props
 * @param {string} [props.initialMemberId=''] - Pre-selected member ID
 * @param {string} [props.initialEventType=''] - Pre-selected event type
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showEventTypeCards=true] - Whether to show event type cards (vs select dropdown)
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {Function} [props.onTriggerComplete] - Callback when trigger completes: (result) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function CareEventTrigger({
  initialMemberId = '',
  initialEventType = '',
  showHeader = true,
  showEventTypeCards = true,
  compact = false,
  onTriggerComplete,
  className = '',
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState(initialMemberId);
  const [eventType, setEventType] = useState(initialEventType);
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [providerId, setProviderId] = useState('');
  const [autoEnroll, setAutoEnroll] = useState(true);
  const [autoAssignManager, setAutoAssignManager] = useState(true);
  const [autoGenerateCarePlan, setAutoGenerateCarePlan] = useState(false);
  const [eventCategoryFilter, setEventCategoryFilter] = useState('');

  // UI state
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Providers from localStorage
  const providers = useMemo(() => {
    try {
      const stored = localStorage.getItem('csnp_providers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Silently fail
    }
    return [];
  }, []);

  const providerOptions = useMemo(() => {
    return [
      { value: '', label: 'Select provider (optional)' },
      ...providers.map((p) => ({
        value: p.id,
        label: `${p.firstName} ${p.lastName} - ${p.specialty || 'No specialty'}`,
      })),
    ];
  }, [providers]);

  /**
   * Selected member object.
   */
  const selectedMember = useMemo(() => {
    if (!selectedMemberId) {
      return null;
    }
    try {
      const storedMembers = localStorage.getItem('csnp_members');
      if (storedMembers) {
        const members = JSON.parse(storedMembers);
        if (Array.isArray(members)) {
          return members.find((m) => m.id === selectedMemberId) || null;
        }
      }
    } catch {
      // Silently fail
    }
    return null;
  }, [selectedMemberId]);

  /**
   * Selected event type option.
   */
  const selectedEventOption = useMemo(() => {
    if (!eventType) {
      return null;
    }
    return EVENT_TYPE_OPTIONS.find((opt) => opt.value === eventType) || null;
  }, [eventType]);

  /**
   * Whether the selected event is high priority.
   */
  const isHighPriority = useMemo(() => {
    return HIGH_PRIORITY_EVENTS.includes(eventType);
  }, [eventType]);

  /**
   * Filtered event type options by category.
   */
  const filteredEventOptions = useMemo(() => {
    if (!eventCategoryFilter || eventCategoryFilter.trim().length === 0) {
      return EVENT_TYPE_OPTIONS;
    }
    return EVENT_TYPE_OPTIONS.filter((opt) => opt.category === eventCategoryFilter.trim());
  }, [eventCategoryFilter]);

  /**
   * Validates the form before submission.
   * @returns {boolean} Whether the form is valid
   */
  const validateForm = useCallback(() => {
    const errors = {};

    if (!selectedMemberId || selectedMemberId.trim().length === 0) {
      errors.memberId = 'Please select a member';
    }

    if (!eventType || eventType.trim().length === 0) {
      errors.eventType = 'Please select an event type';
    }

    if (typeof summary === 'string' && summary.trim().length === 0 && typeof details === 'string' && details.trim().length === 0) {
      // Summary is optional but we'll auto-generate one if empty
    }

    if (followUpDate && followUpDate.trim().length > 0) {
      try {
        const parsed = new Date(followUpDate.trim() + 'T00:00:00');
        if (isNaN(parsed.getTime())) {
          errors.followUpDate = 'Please enter a valid follow-up date';
        }
      } catch {
        errors.followUpDate = 'Please enter a valid follow-up date';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedMemberId, eventType, summary, details, followUpDate]);

  /**
   * Handles event type selection.
   * @param {string} type - The event type value
   */
  const handleSelectEventType = useCallback((type) => {
    setEventType(type);
    setFormErrors((prev) => {
      const updated = { ...prev };
      delete updated.eventType;
      return updated;
    });

    // Auto-enable care plan generation for care plan events
    if (type === CARE_MANAGEMENT_EVENTS.CARE_PLAN_CREATED) {
      setAutoGenerateCarePlan(true);
    }
  }, []);

  /**
   * Handles form submission.
   * @param {React.FormEvent} e - Form event
   */
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      setTriggering(true);
      setFormError(null);
      setTriggerResult(null);

      try {
        const performedBy = user ? user.id : 'system';

        const eventLabel = CARE_MANAGEMENT_EVENT_LABELS[eventType] || eventType;
        const memberName = selectedMember
          ? `${selectedMember.firstName} ${selectedMember.lastName}`
          : selectedMemberId;

        const autoSummary = summary.trim().length > 0
          ? summary.trim()
          : `${eventLabel} triggered for member ${memberName}`;

        const result = triggerCareManagement(selectedMemberId.trim(), eventType.trim(), {
          performedBy,
          providerId: providerId.trim().length > 0 ? providerId.trim() : undefined,
          summary: autoSummary,
          details: details.trim().length > 0 ? details.trim() : undefined,
          followUpDate: followUpDate.trim().length > 0 ? followUpDate.trim() : undefined,
          autoEnroll,
          autoAssignManager,
          autoGenerateCarePlan,
        });

        setTriggerResult(result);

        if (result.success) {
          addNotification(
            'success',
            'Care Event Triggered',
            `${eventLabel} has been triggered for ${memberName}. ${result.careManagerId ? 'Care manager assigned.' : ''} ${result.carePlanId ? 'Care plan generated.' : ''}`
          );

          if (typeof onTriggerComplete === 'function') {
            onTriggerComplete(result);
          }
        } else {
          addNotification(
            'error',
            'Trigger Failed',
            result.error || 'An error occurred while triggering the care management event.'
          );
          setFormError(result.error || 'An error occurred while triggering the care management event.');
        }
      } catch (err) {
        console.error('CareEventTrigger: trigger error:', err);
        setFormError('An unexpected error occurred while triggering the care management event.');
        addNotification('error', 'Trigger Error', 'An unexpected error occurred.');
      } finally {
        setTriggering(false);
      }
    },
    [
      validateForm,
      user,
      selectedMemberId,
      selectedMember,
      eventType,
      summary,
      details,
      followUpDate,
      providerId,
      autoEnroll,
      autoAssignManager,
      autoGenerateCarePlan,
      addNotification,
      onTriggerComplete,
    ]
  );

  /**
   * Handles form reset / dismiss result.
   */
  const handleReset = useCallback(() => {
    setSelectedMemberId(initialMemberId);
    setEventType(initialEventType);
    setSummary('');
    setDetails('');
    setFollowUpDate('');
    setProviderId('');
    setAutoEnroll(true);
    setAutoAssignManager(true);
    setAutoGenerateCarePlan(false);
    setEventCategoryFilter('');
    setTriggerResult(null);
    setFormError(null);
    setFormErrors({});
  }, [initialMemberId, initialEventType]);

  /**
   * Computed: whether the form can be submitted.
   * @type {boolean}
   */
  const canSubmit = useMemo(() => {
    return (
      typeof selectedMemberId === 'string' &&
      selectedMemberId.trim().length > 0 &&
      typeof eventType === 'string' &&
      eventType.trim().length > 0 &&
      !triggering
    );
  }, [selectedMemberId, eventType, triggering]);

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
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-csnp-primary">
                Trigger Care Management Event
              </h2>
              {!compact && (
                <p className="mt-0.5 text-sm text-gray-500">
                  Select a member and event type to trigger a care management workflow.
                  Events can auto-enroll members in care programs, assign care managers, and generate care plans.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Error */}
      {formError && !triggerResult && (
        <Alert
          variant="error"
          title="Error"
          dismissible={true}
          onDismiss={() => setFormError(null)}
          className="mb-4"
        >
          {formError}
        </Alert>
      )}

      {/* Trigger Result */}
      {triggerResult && (
        <TriggerResultDisplay
          result={triggerResult}
          onDismiss={handleReset}
        />
      )}

      {/* Form */}
      {!triggerResult && (
        <form onSubmit={handleSubmit} noValidate>
          {/* Section 1: Member Selection */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary">Member Selection</p>

              <CareEventMemberSelector
                selectedMemberId={selectedMemberId}
                onSelectMember={(id) => {
                  setSelectedMemberId(id);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.memberId;
                    return updated;
                  });
                }}
                disabled={triggering}
              />

              {formErrors.memberId && (
                <p className="text-xs text-csnp-alert-error" role="alert">
                  {formErrors.memberId}
                </p>
              )}

              {/* Member Info Summary */}
              {selectedMember && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Condition</p>
                    <p className="text-xs text-gray-700 mt-0.5 truncate">
                      {selectedMember.conditionCategory
                        ? (CONDITION_CATEGORY_LABELS[selectedMember.conditionCategory] || toTitleCase(selectedMember.conditionCategory))
                        : '—'}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Age</p>
                    <p className="text-xs text-gray-700 mt-0.5">
                      {selectedMember.dateOfBirth ? `${calculateAge(selectedMember.dateOfBirth) || '—'} years` : '—'}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Dx Codes</p>
                    <p className="text-xs text-gray-700 mt-0.5">
                      {Array.isArray(selectedMember.diagnosisCodes) ? `${selectedMember.diagnosisCodes.length} code(s)` : '—'}
                    </p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">CSNP Eligible</p>
                    <p className="text-xs mt-0.5">
                      {selectedMember.csnpEligible ? (
                        <span className="text-green-700 font-medium">Yes</span>
                      ) : (
                        <span className="text-red-700 font-medium">No</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Section 2: Event Type Selection */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-csnp-primary">Event Type</p>
                {eventType && selectedEventOption && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    EVENT_CATEGORY_STYLES[selectedEventOption.category]
                      ? `${EVENT_CATEGORY_STYLES[selectedEventOption.category].bg} ${EVENT_CATEGORY_STYLES[selectedEventOption.category].text} ${EVENT_CATEGORY_STYLES[selectedEventOption.category].border}`
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {EVENT_CATEGORY_LABELS[selectedEventOption.category] || selectedEventOption.category}
                  </span>
                )}
              </div>

              {formErrors.eventType && (
                <p className="text-xs text-csnp-alert-error" role="alert">
                  {formErrors.eventType}
                </p>
              )}

              {showEventTypeCards && !compact ? (
                <>
                  {/* Category Filter */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEventCategoryFilter('')}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors duration-150 ${
                        eventCategoryFilter === ''
                          ? 'bg-csnp-primary text-white border-csnp-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      All Events
                    </button>
                    {Object.entries(EVENT_CATEGORY_LABELS).map(([key, label]) => {
                      const style = EVENT_CATEGORY_STYLES[key] || EVENT_CATEGORY_STYLES.clinical;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setEventCategoryFilter(key)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors duration-150 ${
                            eventCategoryFilter === key
                              ? `${style.bg} ${style.text} ${style.border}`
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Event Type Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filteredEventOptions.map((option) => (
                      <EventTypeCard
                        key={option.value}
                        eventOption={option}
                        selected={eventType === option.value}
                        onSelect={handleSelectEventType}
                        disabled={triggering}
                      />
                    ))}
                  </div>

                  {filteredEventOptions.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">
                      No event types match the selected category.
                    </p>
                  )}
                </>
              ) : (
                <FormField
                  name="eventType"
                  label="Event Type"
                  type="select"
                  value={eventType}
                  onChange={(e) => handleSelectEventType(e.target.value)}
                  options={EVENT_TYPE_SELECT_OPTIONS}
                  required={true}
                  disabled={triggering}
                  error={formErrors.eventType}
                  placeholder="Select event type..."
                />
              )}

              {/* High Priority Warning */}
              {isHighPriority && (
                <Alert
                  variant="warning"
                  title="High Priority Event"
                  showIcon={true}
                  bordered={true}
                  size="sm"
                >
                  This event type is classified as high priority. It will generate an alert for the assigned care manager
                  and may trigger immediate outreach requirements per CMS care coordination guidelines.
                </Alert>
              )}
            </div>
          </Card>

          {/* Section 3: Event Details */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary">Event Details</p>

              <FormField
                name="eventSummary"
                label="Event Summary"
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary of the event (auto-generated if left blank)"
                disabled={triggering}
                helperText="A short description of the care management event"
              />

              <FormField
                name="eventDetails"
                label="Detailed Notes"
                type="textarea"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Enter detailed notes about the event, clinical observations, member status, etc."
                disabled={triggering}
                rows={4}
                maxLength={1000}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  name="followUpDate"
                  label="Follow-Up Date"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => {
                    setFollowUpDate(e.target.value);
                    setFormErrors((prev) => {
                      const updated = { ...prev };
                      delete updated.followUpDate;
                      return updated;
                    });
                  }}
                  disabled={triggering}
                  error={formErrors.followUpDate}
                  helperText="Schedule a follow-up date for this event (optional)"
                />

                <FormField
                  name="providerId"
                  label="Associated Provider"
                  type="select"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  options={providerOptions}
                  disabled={triggering}
                  helperText="Link this event to a specific provider (optional)"
                />
              </div>
            </div>
          </Card>

          {/* Section 4: Automation Options */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary">Automation Options</p>

              <p className="text-xs text-gray-500">
                Configure which automated actions should be triggered along with this event.
              </p>

              <div className="space-y-3">
                {/* Auto-Enroll in Care Program */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700">Auto-Enroll in Care Program</p>
                    <p className="text-[10px] text-gray-500">
                      Automatically enroll the member in the appropriate condition-specific care program
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoEnroll}
                    onClick={() => !triggering && setAutoEnroll((prev) => !prev)}
                    disabled={triggering}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
                      autoEnroll ? 'bg-csnp-primary' : 'bg-gray-300'
                    } ${triggering ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autoEnroll ? 'translate-x-5' : 'translate-x-0'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                {/* Auto-Assign Care Manager */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700">Auto-Assign Care Manager</p>
                    <p className="text-[10px] text-gray-500">
                      Automatically assign an available care manager to the member if not already assigned
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoAssignManager}
                    onClick={() => !triggering && setAutoAssignManager((prev) => !prev)}
                    disabled={triggering}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
                      autoAssignManager ? 'bg-csnp-primary' : 'bg-gray-300'
                    } ${triggering ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autoAssignManager ? 'translate-x-5' : 'translate-x-0'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                {/* Auto-Generate Care Plan */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700">Auto-Generate Care Plan</p>
                    <p className="text-[10px] text-gray-500">
                      Automatically generate an individualized care plan based on the member&apos;s condition category
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoGenerateCarePlan}
                    onClick={() => !triggering && setAutoGenerateCarePlan((prev) => !prev)}
                    disabled={triggering}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
                      autoGenerateCarePlan ? 'bg-csnp-primary' : 'bg-gray-300'
                    } ${triggering ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autoGenerateCarePlan ? 'translate-x-5' : 'translate-x-0'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Event Summary Preview */}
          {selectedMemberId && eventType && (
            <Card bordered={true} flat={false} className="mb-6" variant="primary">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-csnp-primary">Event Summary</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member</p>
                    <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">
                      {selectedMember
                        ? `${selectedMember.firstName} ${selectedMember.lastName}`
                        : selectedMemberId.substring(0, 12) + '…'}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Event Type</p>
                    <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">
                      {CARE_MANAGEMENT_EVENT_LABELS[eventType] || eventType}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Priority</p>
                    <p className="text-xs font-medium mt-0.5">
                      {isHighPriority ? (
                        <span className="text-red-700">High</span>
                      ) : (
                        <span className="text-gray-700">Standard</span>
                      )}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Automations</p>
                    <p className="text-xs font-medium text-gray-700 mt-0.5">
                      {[autoEnroll && 'Enroll', autoAssignManager && 'Manager', autoGenerateCarePlan && 'Plan']
                        .filter(Boolean)
                        .join(', ') || 'None'}
                    </p>
                  </div>
                </div>

                {followUpDate && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Follow-up scheduled: {formatDate(followUpDate)}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* CMS Compliance Notice */}
          {!compact && (
            <div className="mb-6">
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
                  Care management events are tracked per CMS C-SNP requirements (42 CFR §422.101).
                  All events are logged in the audit trail. Hospital admissions and discharges require
                  follow-up within 48 hours. Initial health risk assessments must be completed within
                  90 days of enrollment. Care plans must be reviewed at least quarterly.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={triggering}
                loadingText="Triggering..."
                disabled={!canSubmit}
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
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                }
              >
                Trigger Event
              </Button>

              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleReset}
                disabled={triggering}
              >
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              {eventType && (
                <>
                  <span>{CARE_MANAGEMENT_EVENT_LABELS[eventType] || eventType}</span>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                </>
              )}
              <span>{autoEnroll ? 'Auto-enroll' : 'No enroll'}</span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>{autoAssignManager ? 'Auto-assign' : 'No assign'}</span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>{autoGenerateCarePlan ? 'Auto-plan' : 'No plan'}</span>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

CareEventTrigger.propTypes = {
  initialMemberId: PropTypes.string,
  initialEventType: PropTypes.string,
  showHeader: PropTypes.bool,
  showEventTypeCards: PropTypes.bool,
  compact: PropTypes.bool,
  onTriggerComplete: PropTypes.func,
  className: PropTypes.string,
};

CareEventTrigger.defaultProps = {
  initialMemberId: '',
  initialEventType: '',
  showHeader: true,
  showEventTypeCards: true,
  compact: false,
  onTriggerComplete: undefined,
  className: '',
};