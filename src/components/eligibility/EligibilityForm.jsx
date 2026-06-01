import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import FormField from '../common/FormField.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import Card from '../common/Card.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import { validateEligibility } from '../../services/eligibilityService.js';
import { ICD10_CODES, searchICD10Codes, getCodeByICD10, CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import { formatDate } from '../../utils/helpers.js';

/**
 * Maximum number of autocomplete suggestions to display.
 * @type {number}
 */
const MAX_SUGGESTIONS = 10;

/**
 * ICD-10 code autocomplete input component.
 *
 * @param {Object} props
 * @param {string[]} props.selectedCodes - Currently selected ICD-10 codes
 * @param {Function} props.onAddCode - Callback when a code is added
 * @param {Function} props.onRemoveCode - Callback when a code is removed
 * @param {boolean} [props.disabled=false] - Whether the input is disabled
 * @returns {React.ReactElement}
 */
function ICD10CodeSelector({ selectedCodes, onAddCode, onRemoveCode, disabled = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  /**
   * Handles search input change and updates suggestions.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
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

  /**
   * Handles selecting a suggestion.
   * @param {Object} entry - The ICD-10 code entry
   */
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

  /**
   * Handles keyboard navigation in the suggestions list.
   * @param {React.KeyboardEvent<HTMLInputElement>} e - Keyboard event
   */
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

  /**
   * Closes suggestions when clicking outside.
   */
  useEffect(() => {
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

      {/* Selected Codes */}
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

      {/* Autocomplete Input */}
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

        {/* Suggestions Dropdown */}
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
        Type to search ICD-10 codes. Select codes that qualify for C-SNP eligibility.
      </p>
    </div>
  );
}

ICD10CodeSelector.propTypes = {
  selectedCodes: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAddCode: PropTypes.func.isRequired,
  onRemoveCode: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

ICD10CodeSelector.defaultProps = {
  disabled: false,
};

/**
 * Condition priority display component.
 *
 * @param {Object} props
 * @param {Object[]} props.conditionSummary - Condition summary from validation result
 * @param {string|null} props.priorityCondition - The highest-priority ICD-10 code
 * @param {string|null} props.priorityCategory - The condition category
 * @param {string|null} props.priorityCategoryLabel - Human-readable category label
 * @returns {React.ReactElement|null}
 */
function ConditionPriorityDisplay({ conditionSummary, priorityCondition, priorityCategory, priorityCategoryLabel }) {
  if (!Array.isArray(conditionSummary) || conditionSummary.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Condition Priority
      </p>

      {priorityCondition && (
        <div className="flex items-center gap-2 mb-3 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-csnp-primary">
              Primary Condition: {priorityCondition}
            </p>
            <p className="text-xs text-csnp-blue-700">
              {priorityCategoryLabel || priorityCategory || 'Unknown Category'}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {conditionSummary.map((category) => (
          <div
            key={category.category}
            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  category.csnpEligible ? 'bg-green-500' : 'bg-gray-400'
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">
                  {category.categoryLabel}
                </p>
                <p className="text-[10px] text-gray-500">
                  {category.codes.length} code{category.codes.length !== 1 ? 's' : ''} · Priority: {category.highestPriority}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2">
              {category.csnpEligible ? (
                <StatusBadge status="eligible" label="Eligible" size="sm" showDot={false} bordered={true} />
              ) : (
                <StatusBadge status="ineligible" label="Not Eligible" size="sm" showDot={false} bordered={true} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

ConditionPriorityDisplay.propTypes = {
  conditionSummary: PropTypes.arrayOf(
    PropTypes.shape({
      category: PropTypes.string,
      categoryLabel: PropTypes.string,
      codes: PropTypes.array,
      highestPriority: PropTypes.number,
      csnpEligible: PropTypes.bool,
    })
  ),
  priorityCondition: PropTypes.string,
  priorityCategory: PropTypes.string,
  priorityCategoryLabel: PropTypes.string,
};

ConditionPriorityDisplay.defaultProps = {
  conditionSummary: [],
  priorityCondition: null,
  priorityCategory: null,
  priorityCategoryLabel: null,
};

/**
 * Validation results display component.
 *
 * @param {Object} props
 * @param {Object} props.result - The eligibility validation result
 * @returns {React.ReactElement}
 */
function ValidationResultsDisplay({ result }) {
  if (!result) {
    return null;
  }

  const { eligible, priorityCondition, priorityCategory, priorityCategoryLabel, validationDetails } = result;

  return (
    <div className="mt-6 space-y-4">
      {/* Overall Result */}
      <Alert
        variant={eligible ? 'success' : 'error'}
        title={eligible ? 'Eligible for C-SNP Enrollment' : 'Not Eligible for C-SNP Enrollment'}
        showIcon={true}
        bordered={true}
      >
        {eligible ? (
          <p>
            Member qualifies for Chronic Condition Special Needs Plan enrollment.
            {priorityCondition && (
              <span>
                {' '}Primary condition: <strong>{priorityCondition}</strong>
                {priorityCategoryLabel && <span> ({priorityCategoryLabel})</span>}.
              </span>
            )}
          </p>
        ) : (
          <p>
            No CSNP-eligible chronic conditions were identified from the provided diagnosis codes.
            Please verify the diagnosis codes and try again.
          </p>
        )}
      </Alert>

      {/* Code Classification */}
      {validationDetails && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Valid Codes */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-1.5 mb-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-600"
                aria-hidden="true"
              >
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-xs font-semibold text-green-800">
                CSNP Eligible ({validationDetails.validCodes.length})
              </p>
            </div>
            {validationDetails.validCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {validationDetails.validCodes.map((code) => (
                  <span
                    key={code}
                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded"
                  >
                    {code}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-green-600">None</p>
            )}
          </div>

          {/* Ineligible Codes */}
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-1.5 mb-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-yellow-600"
                aria-hidden="true"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs font-semibold text-yellow-800">
                Not CSNP Eligible ({validationDetails.ineligibleCodes.length})
              </p>
            </div>
            {validationDetails.ineligibleCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {validationDetails.ineligibleCodes.map((code) => (
                  <span
                    key={code}
                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700 rounded"
                  >
                    {code}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-yellow-600">None</p>
            )}
          </div>

          {/* Invalid Codes */}
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-1.5 mb-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-600"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="text-xs font-semibold text-red-800">
                Unrecognized ({validationDetails.invalidCodes.length})
              </p>
            </div>
            {validationDetails.invalidCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {validationDetails.invalidCodes.map((code, idx) => (
                  <span
                    key={`${code}-${idx}`}
                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded"
                  >
                    {code || '(empty)'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-red-600">None</p>
            )}
          </div>
        </div>
      )}

      {/* Re-verification Notice */}
      {validationDetails && validationDetails.annualReverificationRequired && (
        <Alert
          variant="warning"
          title="Annual Re-Verification Required"
          showIcon={true}
          bordered={true}
          size="sm"
        >
          {validationDetails.reverificationDueDate
            ? `Re-verification is due by ${formatDate(validationDetails.reverificationDueDate)}.`
            : 'Annual re-verification of chronic condition diagnosis is required.'}
        </Alert>
      )}

      {/* Condition Priority Display */}
      {validationDetails && (
        <ConditionPriorityDisplay
          conditionSummary={validationDetails.conditionSummary}
          priorityCondition={priorityCondition}
          priorityCategory={priorityCategory}
          priorityCategoryLabel={priorityCategoryLabel}
        />
      )}
    </div>
  );
}

ValidationResultsDisplay.propTypes = {
  result: PropTypes.shape({
    eligible: PropTypes.bool,
    priorityCondition: PropTypes.string,
    priorityCategory: PropTypes.string,
    priorityCategoryLabel: PropTypes.string,
    validationDetails: PropTypes.shape({
      validCodes: PropTypes.arrayOf(PropTypes.string),
      invalidCodes: PropTypes.arrayOf(PropTypes.string),
      ineligibleCodes: PropTypes.arrayOf(PropTypes.string),
      annualReverificationRequired: PropTypes.bool,
      reverificationDueDate: PropTypes.string,
      conditionSummary: PropTypes.array,
    }),
    auditId: PropTypes.string,
    timestamp: PropTypes.string,
  }),
};

ValidationResultsDisplay.defaultProps = {
  result: null,
};

/**
 * Eligibility validation form component.
 * Provides member ID input, ICD-10 code multi-select with autocomplete,
 * effective date picker, and displays validation results with pass/fail indicators.
 *
 * @param {Object} props
 * @param {string} [props.initialMemberId=''] - Pre-filled member ID
 * @param {string[]} [props.initialCodes=[]] - Pre-filled ICD-10 codes
 * @param {Function} [props.onValidationComplete] - Callback when validation completes: (result) => void
 * @param {boolean} [props.showHeader=true] - Whether to show the form header
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function EligibilityForm({
  initialMemberId = '',
  initialCodes = [],
  onValidationComplete,
  showHeader = true,
  className = '',
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  const [memberId, setMemberId] = useState(initialMemberId);
  const [selectedCodes, setSelectedCodes] = useState(() => {
    return Array.isArray(initialCodes) ? [...initialCodes] : [];
  });
  const [effectiveDate, setEffectiveDate] = useState('');
  const [retroDate, setRetroDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [formError, setFormError] = useState(null);

  /**
   * Handles adding an ICD-10 code to the selection.
   * @param {string} code - The ICD-10 code to add
   */
  const handleAddCode = useCallback((code) => {
    setSelectedCodes((prev) => {
      if (prev.includes(code)) {
        return prev;
      }
      return [...prev, code];
    });
    setValidationResult(null);
  }, []);

  /**
   * Handles removing an ICD-10 code from the selection.
   * @param {string} code - The ICD-10 code to remove
   */
  const handleRemoveCode = useCallback((code) => {
    setSelectedCodes((prev) => prev.filter((c) => c !== code));
    setValidationResult(null);
  }, []);

  /**
   * Handles member ID input change.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleMemberIdChange = useCallback((e) => {
    setMemberId(e.target.value);
    setValidationResult(null);
    setFormError(null);
  }, []);

  /**
   * Handles effective date input change.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleEffectiveDateChange = useCallback((e) => {
    setEffectiveDate(e.target.value);
    setValidationResult(null);
  }, []);

  /**
   * Handles retro date input change.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleRetroDateChange = useCallback((e) => {
    setRetroDate(e.target.value);
    setValidationResult(null);
  }, []);

  /**
   * Validates the form inputs before submission.
   * @returns {boolean} Whether the form is valid
   */
  const validateForm = useCallback(() => {
    if (typeof memberId !== 'string' || memberId.trim().length === 0) {
      setFormError('Member ID is required');
      return false;
    }

    if (selectedCodes.length === 0) {
      setFormError('At least one ICD-10 diagnosis code is required');
      return false;
    }

    setFormError(null);
    return true;
  }, [memberId, selectedCodes]);

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

      setLoading(true);
      setFormError(null);
      setValidationResult(null);

      try {
        const performedBy = user ? user.id : 'system';

        const memberData = {
          memberId: memberId.trim(),
          effectiveDate: effectiveDate.trim().length > 0 ? effectiveDate.trim() : null,
          retroDate: retroDate.trim().length > 0 ? retroDate.trim() : null,
          performedBy,
        };

        const result = validateEligibility(memberData, selectedCodes);

        setValidationResult(result);

        if (result.eligible) {
          addNotification(
            'success',
            'Eligibility Confirmed',
            `Member ${memberId.trim()} is eligible for C-SNP enrollment. Primary condition: ${result.priorityCondition || 'N/A'}`
          );
        } else {
          addNotification(
            'warning',
            'Not Eligible',
            `Member ${memberId.trim()} does not meet C-SNP eligibility requirements based on the provided diagnosis codes.`
          );
        }

        if (typeof onValidationComplete === 'function') {
          onValidationComplete(result);
        }
      } catch (err) {
        console.error('EligibilityForm: validation error:', err);
        setFormError('An unexpected error occurred during eligibility validation. Please try again.');
        addNotification(
          'error',
          'Validation Error',
          'An unexpected error occurred during eligibility validation.'
        );
      } finally {
        setLoading(false);
      }
    },
    [memberId, selectedCodes, effectiveDate, retroDate, user, addNotification, onValidationComplete, validateForm]
  );

  /**
   * Handles form reset.
   */
  const handleReset = useCallback(() => {
    setMemberId(initialMemberId);
    setSelectedCodes(Array.isArray(initialCodes) ? [...initialCodes] : []);
    setEffectiveDate('');
    setRetroDate('');
    setValidationResult(null);
    setFormError(null);
  }, [initialMemberId, initialCodes]);

  /**
   * Computed: whether the form can be submitted.
   * @type {boolean}
   */
  const canSubmit = useMemo(() => {
    return (
      typeof memberId === 'string' &&
      memberId.trim().length > 0 &&
      selectedCodes.length > 0 &&
      !loading
    );
  }, [memberId, selectedCodes, loading]);

  const containerClassName = [
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-csnp-primary">
            Eligibility Validation
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Validate member eligibility for Chronic Condition Special Needs Plan (C-SNP) enrollment
            by entering their information and diagnosis codes.
          </p>
        </div>
      )}

      {/* Form Error */}
      {formError && (
        <Alert
          variant="error"
          title="Validation Error"
          dismissible={true}
          onDismiss={() => setFormError(null)}
          className="mb-4"
        >
          {formError}
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        <Card bordered={true} flat={false} className="mb-6">
          <div className="space-y-5">
            {/* Member ID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="memberId"
                label="Member ID"
                type="text"
                value={memberId}
                onChange={handleMemberIdChange}
                placeholder="Enter member ID or SSN"
                required={true}
                disabled={loading}
                helperText="Enter the member's unique identifier"
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

              <FormField
                name="effectiveDate"
                label="Effective Date"
                type="date"
                value={effectiveDate}
                onChange={handleEffectiveDateChange}
                disabled={loading}
                helperText="Date eligibility takes effect (optional)"
              />
            </div>

            {/* Retro Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="retroDate"
                label="Retro Date"
                type="date"
                value={retroDate}
                onChange={handleRetroDateChange}
                disabled={loading}
                helperText="Retroactive eligibility date (optional)"
              />
              <div />
            </div>

            {/* ICD-10 Code Selector */}
            <ICD10CodeSelector
              selectedCodes={selectedCodes}
              onAddCode={handleAddCode}
              onRemoveCode={handleRemoveCode}
              disabled={loading}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              loadingText="Validating..."
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
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              Validate Eligibility
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleReset}
              disabled={loading}
            >
              Reset
            </Button>
          </div>

          {selectedCodes.length > 0 && (
            <p className="text-xs text-gray-500">
              {selectedCodes.length} code{selectedCodes.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="mt-6">
          <LoadingSpinner
            size="md"
            variant="primary"
            text="Evaluating eligibility rules..."
          />
        </div>
      )}

      {/* Validation Results */}
      {!loading && validationResult && (
        <ValidationResultsDisplay result={validationResult} />
      )}
    </div>
  );
}

EligibilityForm.propTypes = {
  initialMemberId: PropTypes.string,
  initialCodes: PropTypes.arrayOf(PropTypes.string),
  onValidationComplete: PropTypes.func,
  showHeader: PropTypes.bool,
  className: PropTypes.string,
};

EligibilityForm.defaultProps = {
  initialMemberId: '',
  initialCodes: [],
  onValidationComplete: undefined,
  showHeader: true,
  className: '',
};