import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import FormField from '../common/FormField.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import Card from '../common/Card.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import { intakeEnrollment } from '../../services/enrollmentService.js';
import { validateEligibility } from '../../services/eligibilityService.js';
import { searchICD10Codes, getCodeByICD10 } from '../../data/icd10Data.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import { formatDate } from '../../utils/helpers.js';
import {
  ENROLLMENT_CHANNELS,
  ENROLLMENT_CHANNEL_LABELS,
  PLAN_TYPES,
  PLAN_TYPE_LABELS,
} from '../../utils/constants.js';

/**
 * Total number of steps in the enrollment form.
 * @type {number}
 */
const TOTAL_STEPS = 4;

/**
 * Step labels for the progress indicator.
 * @type {string[]}
 */
const STEP_LABELS = [
  'Channel & Member Info',
  'Diagnosis & Eligibility',
  'Documents',
  'Review & Submit',
];

/**
 * Channel options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const CHANNEL_OPTIONS = Object.entries(ENROLLMENT_CHANNEL_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Plan type options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const PLAN_TYPE_OPTIONS = Object.entries(PLAN_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * US state options for the address state select.
 * @type {{ value: string, label: string }[]}
 */
const US_STATE_OPTIONS = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

/**
 * Maximum number of ICD-10 autocomplete suggestions.
 * @type {number}
 */
const MAX_SUGGESTIONS = 8;

/**
 * Step progress indicator component.
 *
 * @param {Object} props
 * @param {number} props.currentStep - Current step (1-indexed)
 * @param {number} props.totalSteps - Total number of steps
 * @param {string[]} props.labels - Step labels
 * @returns {React.ReactElement}
 */
function StepIndicator({ currentStep, totalSteps, labels }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {labels.map((label, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-200 ${
                  isCompleted
                    ? 'bg-csnp-alert-success text-white'
                    : isActive
                      ? 'bg-csnp-primary text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isCompleted ? (
                  <svg
                    width="14"
                    height="14"
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
                  stepNum
                )}
              </div>
              <span
                className={`mt-1.5 text-[10px] font-medium text-center max-w-[80px] leading-tight ${
                  isActive ? 'text-csnp-primary' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {stepNum < totalSteps && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-16px] transition-colors duration-200 ${
                  isCompleted ? 'bg-csnp-alert-success' : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

StepIndicator.propTypes = {
  currentStep: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired,
  labels: PropTypes.arrayOf(PropTypes.string).isRequired,
};

/**
 * ICD-10 code selector component for the enrollment form.
 *
 * @param {Object} props
 * @param {string[]} props.selectedCodes - Currently selected ICD-10 codes
 * @param {Function} props.onAddCode - Callback when a code is added
 * @param {Function} props.onRemoveCode - Callback when a code is removed
 * @param {boolean} [props.disabled=false] - Whether the input is disabled
 * @returns {React.ReactElement}
 */
function EnrollmentICD10Selector({ selectedCodes, onAddCode, onRemoveCode, disabled = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = React.useRef(null);
  const suggestionsRef = React.useRef(null);

  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      setQuery(value);
      setHighlightedIndex(-1);

      if (value.trim().length < 1) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const results = searchICD10Codes(value.trim());
      const filtered = results.filter(
        (entry) => !selectedCodes.includes(entry.code)
      );
      setSuggestions(filtered.slice(0, MAX_SUGGESTIONS));
      setShowSuggestions(filtered.length > 0);
    },
    [selectedCodes]
  );

  const handleSelectSuggestion = useCallback(
    (entry) => {
      if (!selectedCodes.includes(entry.code)) {
        onAddCode(entry.code);
      }
      setQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    [selectedCodes, onAddCode]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!showSuggestions || suggestions.length === 0) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    },
    [showSuggestions, suggestions, highlightedIndex, handleSelectSuggestion]
  );

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    }

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  return (
    <div className="flex flex-col w-full">
      <label className="font-medium text-sm text-gray-700 mb-1">
        ICD-10 Diagnosis Codes
        <span className="text-csnp-alert-error ml-0.5" aria-hidden="true">
          *
        </span>
      </label>

      {selectedCodes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedCodes.map((code) => {
            const entry = getCodeByICD10(code);
            return (
              <span
                key={code}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  entry && entry.csnpEligible
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                <span className="font-semibold">{code}</span>
                {entry && (
                  <span className="text-[10px] opacity-75 max-w-[160px] truncate">
                    {entry.description}
                  </span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onRemoveCode(code)}
                    className="ml-1 p-0.5 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors duration-150 focus:outline-none"
                    aria-label={`Remove ${code}`}
                  >
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
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

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
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder="Search by code or description (e.g., E11.9, diabetes)..."
            disabled={disabled}
            className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
            aria-label="Search ICD-10 codes"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
            role="combobox"
          />
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            role="listbox"
          >
            {suggestions.map((entry, index) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => handleSelectSuggestion(entry)}
                className={`w-full flex items-start gap-3 px-3 py-2 text-left text-sm transition-colors duration-100 ${
                  index === highlightedIndex
                    ? 'bg-csnp-blue-50 text-csnp-primary'
                    : 'hover:bg-gray-50 text-gray-700'
                } ${index !== suggestions.length - 1 ? 'border-b border-gray-50' : ''}`}
                role="option"
                aria-selected={index === highlightedIndex}
              >
                <span className="font-semibold text-xs whitespace-nowrap min-w-[60px]">
                  {entry.code}
                </span>
                <span className="flex-1 min-w-0 text-xs text-gray-600 truncate">
                  {entry.description}
                </span>
                <span className="flex-shrink-0">
                  {entry.csnpEligible ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                      CSNP
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                      N/A
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Search and select ICD-10 codes for C-SNP eligibility verification.
      </p>
    </div>
  );
}

EnrollmentICD10Selector.propTypes = {
  selectedCodes: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAddCode: PropTypes.func.isRequired,
  onRemoveCode: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

EnrollmentICD10Selector.defaultProps = {
  disabled: false,
};

/**
 * Simulated document item component for the document upload step.
 *
 * @param {Object} props
 * @param {Object} props.doc - Document object
 * @param {Function} props.onRemove - Remove handler
 * @param {boolean} props.disabled - Whether removal is disabled
 * @returns {React.ReactElement}
 */
function DocumentItem({ doc, onRemove, disabled }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-csnp-primary flex-shrink-0"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-700 truncate">{doc.name}</p>
          <p className="text-[10px] text-gray-400">{doc.type}</p>
        </div>
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={() => onRemove(doc.id)}
          className="flex-shrink-0 ml-2 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-150 focus:outline-none"
          aria-label={`Remove ${doc.name}`}
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
  );
}

DocumentItem.propTypes = {
  doc: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
  disabled: PropTypes.bool.isRequired,
};

/**
 * Multi-step enrollment intake form component.
 * Step 1 - Channel selection and member info (name, SSN, CCID, APPIN, DOB, address).
 * Step 2 - Diagnosis codes and eligibility verification.
 * Step 3 - Document upload (simulated).
 * Step 4 - Review and submit.
 * Calls enrollmentService.intakeEnrollment on submission.
 *
 * @param {Object} props
 * @param {string} [props.initialMemberId=''] - Pre-filled member ID
 * @param {string} [props.initialBenefitPackageId=''] - Pre-filled benefit package ID
 * @param {Function} [props.onEnrollmentComplete] - Callback when enrollment completes: (result) => void
 * @param {boolean} [props.showHeader=true] - Whether to show the form header
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function EnrollmentForm({
  initialMemberId = '',
  initialBenefitPackageId = '',
  onEnrollmentComplete,
  showHeader = true,
  className = '',
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Channel & Member Info
  const [channel, setChannel] = useState(ENROLLMENT_CHANNELS.ONLINE);
  const [planType, setPlanType] = useState(PLAN_TYPES.C_SNP);
  const [memberId, setMemberId] = useState(initialMemberId);
  const [benefitPackageId, setBenefitPackageId] = useState(initialBenefitPackageId);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [ssn, setSSN] = useState('');
  const [ccid, setCCID] = useState('');
  const [appin, setAPPIN] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [applicationDate, setApplicationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Step 2: Diagnosis & Eligibility
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [eligibilityResult, setEligibilityResult] = useState(null);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  // Step 3: Documents
  const [documents, setDocuments] = useState([]);
  const [docNameInput, setDocNameInput] = useState('');
  const [docTypeInput, setDocTypeInput] = useState('enrollment_form');

  // Step 4: Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // Form errors
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState(null);

  // Benefit packages from localStorage
  const benefitPackages = useMemo(() => {
    try {
      const stored = localStorage.getItem('csnp_benefit_packages');
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

  const benefitPackageOptions = useMemo(() => {
    return benefitPackages.map((pkg) => ({
      value: pkg.id,
      label: pkg.name,
    }));
  }, [benefitPackages]);

  const documentTypeOptions = [
    { value: 'enrollment_form', label: 'Enrollment Form' },
    { value: 'diagnosis_verification', label: 'Diagnosis Verification' },
    { value: 'physician_attestation', label: 'Physician Attestation' },
    { value: 'medical_record', label: 'Medical Record' },
    { value: 'consent_form', label: 'Consent Form' },
    { value: 'identification', label: 'Identification' },
    { value: 'medicare_card', label: 'Medicare Card' },
    { value: 'power_of_attorney', label: 'Power of Attorney' },
  ];

  /**
   * Validates Step 1 fields.
   * @returns {boolean}
   */
  const validateStep1 = useCallback(() => {
    const errors = {};

    if (!channel || channel.trim().length === 0) {
      errors.channel = 'Enrollment channel is required';
    }

    if (!memberId || memberId.trim().length === 0) {
      errors.memberId = 'Member ID is required';
    }

    if (!benefitPackageId || benefitPackageId.trim().length === 0) {
      errors.benefitPackageId = 'Benefit package is required';
    }

    if (!firstName || firstName.trim().length === 0) {
      errors.firstName = 'First name is required';
    }

    if (!lastName || lastName.trim().length === 0) {
      errors.lastName = 'Last name is required';
    }

    if (!dateOfBirth || dateOfBirth.trim().length === 0) {
      errors.dateOfBirth = 'Date of birth is required';
    }

    if (!effectiveDate || effectiveDate.trim().length === 0) {
      errors.effectiveDate = 'Effective date is required';
    }

    if (!applicationDate || applicationDate.trim().length === 0) {
      errors.applicationDate = 'Application date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [channel, memberId, benefitPackageId, firstName, lastName, dateOfBirth, effectiveDate, applicationDate]);

  /**
   * Validates Step 2 fields.
   * @returns {boolean}
   */
  const validateStep2 = useCallback(() => {
    const errors = {};

    if (selectedCodes.length === 0) {
      errors.diagnosisCodes = 'At least one ICD-10 diagnosis code is required';
    }

    if (!eligibilityChecked) {
      errors.eligibility = 'Please verify eligibility before proceeding';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedCodes, eligibilityChecked]);

  /**
   * Handles adding an ICD-10 code.
   * @param {string} code
   */
  const handleAddCode = useCallback((code) => {
    setSelectedCodes((prev) => {
      if (prev.includes(code)) {
        return prev;
      }
      return [...prev, code];
    });
    setEligibilityResult(null);
    setEligibilityChecked(false);
  }, []);

  /**
   * Handles removing an ICD-10 code.
   * @param {string} code
   */
  const handleRemoveCode = useCallback((code) => {
    setSelectedCodes((prev) => prev.filter((c) => c !== code));
    setEligibilityResult(null);
    setEligibilityChecked(false);
  }, []);

  /**
   * Handles eligibility verification.
   */
  const handleVerifyEligibility = useCallback(() => {
    if (selectedCodes.length === 0) {
      setFormErrors({ diagnosisCodes: 'At least one diagnosis code is required' });
      return;
    }

    setEligibilityLoading(true);
    setFormErrors({});
    setEligibilityResult(null);

    try {
      const performedBy = user ? user.id : 'system';
      const memberData = {
        memberId: memberId.trim(),
        effectiveDate: effectiveDate.trim().length > 0 ? effectiveDate.trim() : null,
        performedBy,
      };

      const result = validateEligibility(memberData, selectedCodes);
      setEligibilityResult(result);
      setEligibilityChecked(true);

      if (result.eligible) {
        addNotification(
          'success',
          'Eligibility Confirmed',
          `Member is eligible for C-SNP enrollment. Primary condition: ${result.priorityCondition || 'N/A'}`
        );
      } else {
        addNotification(
          'warning',
          'Not Eligible',
          'Member does not meet C-SNP eligibility requirements based on the provided diagnosis codes.'
        );
      }
    } catch (err) {
      console.error('EnrollmentForm: eligibility verification error:', err);
      setFormError('An error occurred during eligibility verification.');
      addNotification('error', 'Verification Error', 'An error occurred during eligibility verification.');
    } finally {
      setEligibilityLoading(false);
    }
  }, [selectedCodes, memberId, effectiveDate, user, addNotification]);

  /**
   * Handles adding a simulated document.
   */
  const handleAddDocument = useCallback(() => {
    if (!docNameInput || docNameInput.trim().length === 0) {
      return;
    }

    const newDoc = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: docNameInput.trim(),
      type: docTypeInput,
    };

    setDocuments((prev) => [...prev, newDoc]);
    setDocNameInput('');
  }, [docNameInput, docTypeInput]);

  /**
   * Handles removing a document.
   * @param {string} docId
   */
  const handleRemoveDocument = useCallback((docId) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  /**
   * Handles moving to the next step.
   */
  const handleNext = useCallback(() => {
    setFormError(null);

    if (currentStep === 1) {
      if (!validateStep1()) {
        return;
      }
    } else if (currentStep === 2) {
      if (!validateStep2()) {
        return;
      }
    }

    setFormErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }, [currentStep, validateStep1, validateStep2]);

  /**
   * Handles moving to the previous step.
   */
  const handlePrevious = useCallback(() => {
    setFormError(null);
    setFormErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  /**
   * Handles form submission.
   */
  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    setFormError(null);
    setSubmitResult(null);

    try {
      const performedBy = user ? user.id : 'system';

      const enrollmentData = {
        memberId: memberId.trim(),
        benefitPackageId: benefitPackageId.trim(),
        planType,
        effectiveDate: effectiveDate.trim(),
        applicationDate: applicationDate.trim(),
        diagnosisCodesVerified: selectedCodes,
        notes: `Enrolled via ${ENROLLMENT_CHANNEL_LABELS[channel] || channel} channel. Member: ${firstName.trim()} ${lastName.trim()}. DOB: ${dateOfBirth}. ${ccid ? `CCID: ${ccid}. ` : ''}${appin ? `APPIN: ${appin}. ` : ''}${documents.length} document(s) attached.`,
        processedBy: performedBy,
      };

      const result = intakeEnrollment(enrollmentData, channel);

      setSubmitResult(result);

      if (result.success) {
        addNotification(
          'success',
          'Enrollment Submitted',
          `Enrollment application has been submitted successfully. Enrollment ID: ${result.enrollmentId ? result.enrollmentId.substring(0, 12) + '…' : 'N/A'}`
        );

        if (typeof onEnrollmentComplete === 'function') {
          onEnrollmentComplete(result);
        }
      } else {
        addNotification(
          'error',
          'Enrollment Failed',
          result.error || 'An error occurred while submitting the enrollment application.'
        );
        setFormError(result.error || 'Enrollment submission failed. Please review and try again.');
      }
    } catch (err) {
      console.error('EnrollmentForm: submission error:', err);
      setFormError('An unexpected error occurred during enrollment submission.');
      addNotification('error', 'Submission Error', 'An unexpected error occurred during enrollment submission.');
    } finally {
      setSubmitting(false);
    }
  }, [
    user,
    memberId,
    benefitPackageId,
    planType,
    effectiveDate,
    applicationDate,
    selectedCodes,
    channel,
    firstName,
    lastName,
    dateOfBirth,
    ccid,
    appin,
    documents,
    addNotification,
    onEnrollmentComplete,
  ]);

  /**
   * Handles form reset.
   */
  const handleReset = useCallback(() => {
    setCurrentStep(1);
    setChannel(ENROLLMENT_CHANNELS.ONLINE);
    setPlanType(PLAN_TYPES.C_SNP);
    setMemberId(initialMemberId);
    setBenefitPackageId(initialBenefitPackageId);
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setSSN('');
    setCCID('');
    setAPPIN('');
    setEffectiveDate('');
    setApplicationDate(new Date().toISOString().split('T')[0]);
    setStreet('');
    setCity('');
    setState('');
    setZipCode('');
    setSelectedCodes([]);
    setEligibilityResult(null);
    setEligibilityChecked(false);
    setDocuments([]);
    setDocNameInput('');
    setDocTypeInput('enrollment_form');
    setSubmitResult(null);
    setFormErrors({});
    setFormError(null);
  }, [initialMemberId, initialBenefitPackageId]);

  /**
   * Computed: selected benefit package object.
   */
  const selectedBenefitPackage = useMemo(() => {
    if (!benefitPackageId) {
      return null;
    }
    return benefitPackages.find((pkg) => pkg.id === benefitPackageId) || null;
  }, [benefitPackageId, benefitPackages]);

  const containerClassName = [className].filter(Boolean).join(' ');

  /**
   * Renders Step 1: Channel & Member Info.
   * @returns {React.ReactElement}
   */
  function renderStep1() {
    return (
      <div className="space-y-5">
        <Card bordered={true} flat={false}>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">Enrollment Channel & Plan</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="channel"
                label="Enrollment Channel"
                type="select"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                options={CHANNEL_OPTIONS}
                required={true}
                error={formErrors.channel}
                placeholder="Select channel..."
              />

              <FormField
                name="planType"
                label="Plan Type"
                type="select"
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                options={PLAN_TYPE_OPTIONS}
                required={true}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="benefitPackageId"
                label="Benefit Package"
                type="select"
                value={benefitPackageId}
                onChange={(e) => setBenefitPackageId(e.target.value)}
                options={benefitPackageOptions}
                required={true}
                error={formErrors.benefitPackageId}
                placeholder="Select benefit package..."
              />

              <FormField
                name="memberId"
                label="Member ID"
                type="text"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="Enter member ID"
                required={true}
                error={formErrors.memberId}
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
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
              />
            </div>
          </div>
        </Card>

        <Card bordered={true} flat={false}>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">Member Information</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="firstName"
                label="First Name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
                required={true}
                error={formErrors.firstName}
              />

              <FormField
                name="lastName"
                label="Last Name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
                required={true}
                error={formErrors.lastName}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                name="dateOfBirth"
                label="Date of Birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required={true}
                error={formErrors.dateOfBirth}
              />

              <FormField
                name="ssn"
                label="SSN"
                type="text"
                value={ssn}
                onChange={(e) => setSSN(e.target.value)}
                placeholder="XXX-XX-XXXX"
                helperText="Social Security Number (optional)"
              />

              <FormField
                name="ccid"
                label="CCID"
                type="text"
                value={ccid}
                onChange={(e) => setCCID(e.target.value)}
                placeholder="H1234-001"
                helperText="CMS Contract/Component ID"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                name="appin"
                label="APPIN"
                type="text"
                value={appin}
                onChange={(e) => setAPPIN(e.target.value)}
                placeholder="APP-2024-XXXXX"
                helperText="Application ID Number"
              />

              <FormField
                name="effectiveDate"
                label="Effective Date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required={true}
                error={formErrors.effectiveDate}
                helperText="Date enrollment takes effect"
              />

              <FormField
                name="applicationDate"
                label="Application Date"
                type="date"
                value={applicationDate}
                onChange={(e) => setApplicationDate(e.target.value)}
                required={true}
                error={formErrors.applicationDate}
              />
            </div>
          </div>
        </Card>

        <Card bordered={true} flat={false}>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">Mailing Address</p>

            <FormField
              name="street"
              label="Street Address"
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="1234 Main Street"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                name="city"
                label="City"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />

              <FormField
                name="state"
                label="State"
                type="select"
                value={state}
                onChange={(e) => setState(e.target.value)}
                options={US_STATE_OPTIONS}
                placeholder="Select state..."
              />

              <FormField
                name="zipCode"
                label="ZIP Code"
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="XXXXX"
              />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /**
   * Renders Step 2: Diagnosis & Eligibility.
   * @returns {React.ReactElement}
   */
  function renderStep2() {
    return (
      <div className="space-y-5">
        <Card bordered={true} flat={false}>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">Diagnosis Codes</p>

            <EnrollmentICD10Selector
              selectedCodes={selectedCodes}
              onAddCode={handleAddCode}
              onRemoveCode={handleRemoveCode}
              disabled={submitting}
            />

            {formErrors.diagnosisCodes && (
              <p className="text-xs text-csnp-alert-error" role="alert">
                {formErrors.diagnosisCodes}
              </p>
            )}
          </div>
        </Card>

        <Card bordered={true} flat={false}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-csnp-primary">Eligibility Verification</p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleVerifyEligibility}
                loading={eligibilityLoading}
                loadingText="Verifying..."
                disabled={selectedCodes.length === 0 || eligibilityLoading}
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
                Verify Eligibility
              </Button>
            </div>

            {formErrors.eligibility && (
              <p className="text-xs text-csnp-alert-error" role="alert">
                {formErrors.eligibility}
              </p>
            )}

            {eligibilityLoading && (
              <LoadingSpinner
                size="sm"
                variant="primary"
                text="Evaluating eligibility rules..."
              />
            )}

            {!eligibilityLoading && eligibilityResult && (
              <div className="mt-3">
                <Alert
                  variant={eligibilityResult.eligible ? 'success' : 'error'}
                  title={
                    eligibilityResult.eligible
                      ? 'Eligible for C-SNP Enrollment'
                      : 'Not Eligible for C-SNP Enrollment'
                  }
                  showIcon={true}
                  bordered={true}
                  size="sm"
                >
                  {eligibilityResult.eligible ? (
                    <p>
                      Member qualifies for C-SNP enrollment.
                      {eligibilityResult.priorityCondition && (
                        <span>
                          {' '}Primary condition: <strong>{eligibilityResult.priorityCondition}</strong>
                          {eligibilityResult.priorityCategoryLabel && (
                            <span> ({eligibilityResult.priorityCategoryLabel})</span>
                          )}
                          .
                        </span>
                      )}
                    </p>
                  ) : (
                    <p>
                      No CSNP-eligible chronic conditions were identified. Please verify the diagnosis codes.
                    </p>
                  )}
                </Alert>

                {eligibilityResult.validationDetails && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-2 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-[10px] font-semibold text-green-800">
                        CSNP Eligible ({eligibilityResult.validationDetails.validCodes.length})
                      </p>
                      {eligibilityResult.validationDetails.validCodes.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {eligibilityResult.validationDetails.validCodes.map((code) => (
                            <span
                              key={code}
                              className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-green-600 mt-1">None</p>
                      )}
                    </div>

                    <div className="p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-[10px] font-semibold text-yellow-800">
                        Not Eligible ({eligibilityResult.validationDetails.ineligibleCodes.length})
                      </p>
                      {eligibilityResult.validationDetails.ineligibleCodes.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {eligibilityResult.validationDetails.ineligibleCodes.map((code) => (
                            <span
                              key={code}
                              className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700 rounded"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-yellow-600 mt-1">None</p>
                      )}
                    </div>

                    <div className="p-2 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-[10px] font-semibold text-red-800">
                        Unrecognized ({eligibilityResult.validationDetails.invalidCodes.length})
                      </p>
                      {eligibilityResult.validationDetails.invalidCodes.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {eligibilityResult.validationDetails.invalidCodes.map((code, idx) => (
                            <span
                              key={`${code}-${idx}`}
                              className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded"
                            >
                              {code || '(empty)'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-red-600 mt-1">None</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!eligibilityLoading && !eligibilityResult && selectedCodes.length > 0 && (
              <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
                <p className="text-xs text-csnp-blue-700">
                  Click "Verify Eligibility" to check if the selected diagnosis codes qualify for C-SNP enrollment.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  /**
   * Renders Step 3: Document Upload (simulated).
   * @returns {React.ReactElement}
   */
  function renderStep3() {
    return (
      <div className="space-y-5">
        <Card bordered={true} flat={false}>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">Supporting Documents</p>

            <p className="text-xs text-gray-500 mb-3">
              Add supporting documents for the enrollment application. In a production environment,
              these would be uploaded files. For this simulation, enter document names and types.
            </p>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <FormField
                  name="docName"
                  label="Document Name"
                  type="text"
                  value={docNameInput}
                  onChange={(e) => setDocNameInput(e.target.value)}
                  placeholder="e.g., Physician Attestation Form"
                  size="sm"
                />
              </div>
              <div className="w-48">
                <FormField
                  name="docType"
                  label="Document Type"
                  type="select"
                  value={docTypeInput}
                  onChange={(e) => setDocTypeInput(e.target.value)}
                  options={documentTypeOptions}
                  size="sm"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddDocument}
                disabled={!docNameInput || docNameInput.trim().length === 0}
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
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                }
              >
                Add
              </Button>
            </div>

            {documents.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-xs font-medium text-gray-500">
                  {documents.length} document{documents.length !== 1 ? 's' : ''} attached
                </p>
                {documents.map((doc) => (
                  <DocumentItem
                    key={doc.id}
                    doc={doc}
                    onRemove={handleRemoveDocument}
                    disabled={submitting}
                  />
                ))}
              </div>
            )}

            {documents.length === 0 && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                <svg
                  className="w-10 h-10 text-gray-300 mx-auto mb-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="text-xs text-gray-400">No documents attached yet.</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Documents are optional but recommended for faster processing.
                </p>
              </div>
            )}

            <Alert
              variant="info"
              title="Required Documents"
              showIcon={true}
              bordered={true}
              size="sm"
            >
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>Enrollment Form (signed)</li>
                <li>Diagnosis Verification (physician attestation or medical records)</li>
                <li>Medicare Card copy (recommended)</li>
              </ul>
            </Alert>
          </div>
        </Card>
      </div>
    );
  }

  /**
   * Renders Step 4: Review & Submit.
   * @returns {React.ReactElement}
   */
  function renderStep4() {
    return (
      <div className="space-y-5">
        {submitResult && submitResult.success && (
          <Alert
            variant="success"
            title="Enrollment Submitted Successfully"
            showIcon={true}
            bordered={true}
          >
            <p>
              The enrollment application has been submitted and is pending review.
              {submitResult.enrollmentId && (
                <span>
                  {' '}Enrollment ID: <strong>{submitResult.enrollmentId.substring(0, 16)}…</strong>
                </span>
              )}
            </p>
          </Alert>
        )}

        {submitResult && !submitResult.success && (
          <Alert
            variant="error"
            title="Enrollment Submission Failed"
            showIcon={true}
            bordered={true}
          >
            <p>{submitResult.error || 'An error occurred during submission.'}</p>
          </Alert>
        )}

        <Card bordered={true} flat={false}>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-csnp-primary mb-3">Enrollment Summary</p>

            {/* Channel & Plan */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
                Channel & Plan
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400">Channel</p>
                  <p className="text-xs font-medium text-gray-700">
                    {ENROLLMENT_CHANNEL_LABELS[channel] || channel}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Plan Type</p>
                  <p className="text-xs font-medium text-gray-700">
                    {PLAN_TYPE_LABELS[planType] || planType}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Benefit Package</p>
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {selectedBenefitPackage ? selectedBenefitPackage.name : benefitPackageId || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Member Info */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
                Member Information
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400">Member ID</p>
                  <p className="text-xs font-medium text-gray-700 truncate">{memberId || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Name</p>
                  <p className="text-xs font-medium text-gray-700">
                    {firstName} {lastName}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Date of Birth</p>
                  <p className="text-xs font-medium text-gray-700">
                    {dateOfBirth ? formatDate(dateOfBirth) : '—'}
                  </p>
                </div>
                {ssn && (
                  <div>
                    <p className="text-[10px] text-gray-400">SSN</p>
                    <p className="text-xs font-medium text-gray-700">***-**-{ssn.slice(-4)}</p>
                  </div>
                )}
                {ccid && (
                  <div>
                    <p className="text-[10px] text-gray-400">CCID</p>
                    <p className="text-xs font-medium text-gray-700">{ccid}</p>
                  </div>
                )}
                {appin && (
                  <div>
                    <p className="text-[10px] text-gray-400">APPIN</p>
                    <p className="text-xs font-medium text-gray-700">{appin}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-gray-400">Effective Date</p>
                  <p className="text-xs font-medium text-gray-700">
                    {effectiveDate ? formatDate(effectiveDate) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Application Date</p>
                  <p className="text-xs font-medium text-gray-700">
                    {applicationDate ? formatDate(applicationDate) : '—'}
                  </p>
                </div>
              </div>

              {(street || city || state || zipCode) && (
                <div className="mt-2">
                  <p className="text-[10px] text-gray-400">Address</p>
                  <p className="text-xs font-medium text-gray-700">
                    {[street, city, state, zipCode].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* Diagnosis Codes */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
                Diagnosis Codes ({selectedCodes.length})
              </p>
              {selectedCodes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCodes.map((code) => {
                    const entry = getCodeByICD10(code);
                    return (
                      <span
                        key={code}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                          entry && entry.csnpEligible
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {code}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No codes selected</p>
              )}

              {eligibilityResult && (
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge
                    status={eligibilityResult.eligible ? 'eligible' : 'ineligible'}
                    size="sm"
                    showDot={true}
                    bordered={true}
                  />
                  {eligibilityResult.priorityCondition && (
                    <span className="text-[10px] text-gray-500">
                      Primary: {eligibilityResult.priorityCondition}
                      {eligibilityResult.priorityCategoryLabel && (
                        <span> ({eligibilityResult.priorityCategoryLabel})</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
                Documents ({documents.length})
              </p>
              {documents.length > 0 ? (
                <div className="space-y-1">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-gray-400 flex-shrink-0"
                        aria-hidden="true"
                      >
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-xs text-gray-700">{doc.name}</span>
                      <span className="text-[10px] text-gray-400">({doc.type})</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No documents attached</p>
              )}
            </div>
          </div>
        </Card>

        {!submitResult && eligibilityResult && !eligibilityResult.eligible && (
          <Alert
            variant="warning"
            title="Eligibility Warning"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            The member did not pass eligibility verification. You may still submit the enrollment,
            but it may be rejected during processing.
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-csnp-primary">
            Enrollment Application
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Complete the multi-step enrollment intake form to submit a new C-SNP enrollment application.
          </p>
        </div>
      )}

      {/* Form Error */}
      {formError && (
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

      {/* Step Indicator */}
      <StepIndicator
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        labels={STEP_LABELS}
      />

      {/* Step Content */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (currentStep === TOTAL_STEPS && !submitResult) {
            handleSubmit();
          } else if (currentStep < TOTAL_STEPS) {
            handleNext();
          }
        }}
        noValidate
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            {currentStep > 1 && !submitResult && (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handlePrevious}
                disabled={submitting}
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
                Previous
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleReset}
              disabled={submitting}
            >
              {submitResult && submitResult.success ? 'New Enrollment' : 'Reset'}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Step {currentStep} of {TOTAL_STEPS}
            </span>

            {currentStep < TOTAL_STEPS && (
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting}
                iconRight={
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
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                }
              >
                Next
              </Button>
            )}

            {currentStep === TOTAL_STEPS && !submitResult && (
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={submitting}
                loadingText="Submitting..."
                disabled={submitting}
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
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                Submit Enrollment
              </Button>
            )}

            {submitResult && submitResult.success && (
              <StatusBadge
                status="submitted"
                label="Submitted"
                size="md"
                showDot={true}
                bordered={true}
              />
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

EnrollmentForm.propTypes = {
  initialMemberId: PropTypes.string,
  initialBenefitPackageId: PropTypes.string,
  onEnrollmentComplete: PropTypes.func,
  showHeader: PropTypes.bool,
  className: PropTypes.string,
};

EnrollmentForm.defaultProps = {
  initialMemberId: '',
  initialBenefitPackageId: '',
  onEnrollmentComplete: undefined,
  showHeader: true,
  className: '',
};