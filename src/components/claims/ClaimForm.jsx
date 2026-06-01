import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import FormField from '../common/FormField.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import Card from '../common/Card.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { initiateClaims } from '../../services/claimsService.js';
import { searchICD10Codes, getCodeByICD10, CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import { formatDate, formatCurrency, toTitleCase, calculateAge } from '../../utils/helpers.js';
import { ENROLLMENT_STATUSES } from '../../utils/constants.js';

/**
 * Maximum number of ICD-10 autocomplete suggestions.
 * @type {number}
 */
const MAX_SUGGESTIONS = 10;

/**
 * Member selector component for claim form.
 *
 * @param {Object} props
 * @param {string} props.selectedMemberId - Currently selected member ID
 * @param {Function} props.onSelectMember - Callback when a member is selected
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 * @returns {React.ReactElement}
 */
function ClaimMemberSelector({ selectedMemberId, onSelectMember, disabled = false }) {
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
        Select Member
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
        Search and select a member to initiate a claim.
      </p>
    </div>
  );
}

ClaimMemberSelector.propTypes = {
  selectedMemberId: PropTypes.string.isRequired,
  onSelectMember: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

ClaimMemberSelector.defaultProps = {
  disabled: false,
};

/**
 * Provider selector component for claim form.
 *
 * @param {Object} props
 * @param {string} props.selectedProviderId - Currently selected provider ID
 * @param {Function} props.onSelectProvider - Callback when a provider is selected
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 * @returns {React.ReactElement}
 */
function ClaimProviderSelector({ selectedProviderId, onSelectProvider, disabled = false }) {
  const [providers, setProviders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const storedProviders = localStorage.getItem('csnp_providers');
      if (storedProviders) {
        const parsed = JSON.parse(storedProviders);
        if (Array.isArray(parsed)) {
          setProviders(parsed);
        }
      }
    } catch {
      setProviders([]);
    }
  }, []);

  const filteredProviders = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return providers;
    }
    const query = searchQuery.trim().toLowerCase();
    return providers.filter((p) => {
      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
      const specialty = (p.specialty || '').toLowerCase();
      const npi = (p.npi || '').toLowerCase();
      const facility = (p.facilityName || '').toLowerCase();
      return fullName.includes(query) || specialty.includes(query) || npi.includes(query) || facility.includes(query);
    });
  }, [providers, searchQuery]);

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

  const isInNetwork = selectedProvider && selectedProvider.contract && selectedProvider.contract.status === 'active' && selectedProvider.contract.contractType === 'In-Network';

  return (
    <div className="space-y-2">
      <label className="font-medium text-sm text-gray-700">
        Select Provider
        <span className="text-csnp-alert-error ml-0.5" aria-hidden="true">*</span>
      </label>

      {selectedProvider && (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${isInNetwork ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isInNetwork ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
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
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-gray-900">
                  {selectedProvider.firstName} {selectedProvider.lastName}
                </p>
                <StatusBadge
                  status={isInNetwork ? 'active' : 'expired'}
                  label={isInNetwork ? 'In-Network' : 'Out-of-Network'}
                  size="sm"
                  showDot={true}
                  bordered={false}
                />
              </div>
              <p className="text-[10px] text-gray-500">
                {selectedProvider.specialty || 'No specialty'} · {selectedProvider.facilityName || 'No facility'}
                {selectedProvider.npi && ` · NPI: ${selectedProvider.npi}`}
              </p>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onSelectProvider('')}
              className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-150 focus:outline-none"
              aria-label="Clear provider selection"
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

      {!selectedProvider && (
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
              placeholder="Search by name, specialty, NPI, or facility..."
              disabled={disabled}
              className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent transition-shadow duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
              aria-label="Search providers"
            />
          </div>

          {showDropdown && filteredProviders.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              role="listbox"
            >
              {filteredProviders.slice(0, 10).map((provider) => {
                const provInNetwork = provider.contract && provider.contract.status === 'active' && provider.contract.contractType === 'In-Network';
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
                        {provider.npi && ` · NPI: ${provider.npi}`}
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
                  Showing 10 of {filteredProviders.length} results. Refine your search.
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

      <p className="text-[10px] text-gray-500">
        Search and select the provider who rendered the service.
      </p>
    </div>
  );
}

ClaimProviderSelector.propTypes = {
  selectedProviderId: PropTypes.string.isRequired,
  onSelectProvider: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

ClaimProviderSelector.defaultProps = {
  disabled: false,
};

/**
 * ICD-10 code selector component for claim form.
 *
 * @param {Object} props
 * @param {string[]} props.selectedCodes - Currently selected ICD-10 codes
 * @param {Function} props.onAddCode - Callback when a code is added
 * @param {Function} props.onRemoveCode - Callback when a code is removed
 * @param {boolean} [props.disabled=false] - Whether the input is disabled
 * @returns {React.ReactElement}
 */
function ClaimICD10Selector({ selectedCodes, onAddCode, onRemoveCode, disabled = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

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
        Search and select ICD-10 diagnosis codes for this claim.
      </p>
    </div>
  );
}

ClaimICD10Selector.propTypes = {
  selectedCodes: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAddCode: PropTypes.func.isRequired,
  onRemoveCode: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

ClaimICD10Selector.defaultProps = {
  disabled: false,
};

/**
 * Enrollment validation display component.
 *
 * @param {Object} props
 * @param {Object|null} props.enrollment - The active enrollment record
 * @param {Object|null} props.member - The member object
 * @returns {React.ReactElement|null}
 */
function EnrollmentValidationDisplay({ enrollment, member }) {
  if (!member) {
    return null;
  }

  if (!enrollment) {
    return (
      <Alert
        variant="error"
        title="No Active Enrollment"
        showIcon={true}
        bordered={true}
        size="sm"
      >
        <p>
          {member.firstName} {member.lastName} does not have an active enrollment.
          Claims require an active enrollment to be processed.
        </p>
      </Alert>
    );
  }

  const isActive = enrollment.status === ENROLLMENT_STATUSES.ACTIVE || enrollment.status === ENROLLMENT_STATUSES.APPROVED;

  if (!isActive) {
    return (
      <Alert
        variant="warning"
        title={`Enrollment Status: ${toTitleCase(enrollment.status)}`}
        showIcon={true}
        bordered={true}
        size="sm"
      >
        <p>
          Member&apos;s enrollment is in &quot;{enrollment.status}&quot; status.
          Claims may be denied for non-active enrollments.
        </p>
      </Alert>
    );
  }

  return (
    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
      <div className="flex items-center gap-2">
        <StatusBadge
          status="active"
          label="Active Enrollment"
          size="sm"
          showDot={true}
          bordered={true}
        />
        <span className="text-xs text-green-700">
          Enrollment verified · Effective: {enrollment.effectiveDate ? formatDate(enrollment.effectiveDate) : '—'}
        </span>
      </div>
      {enrollment.benefitPackageId && (
        <p className="text-[10px] text-green-600 mt-1">
          Enrollment ID: {enrollment.id ? enrollment.id.substring(0, 16) + '…' : '—'}
        </p>
      )}
    </div>
  );
}

EnrollmentValidationDisplay.propTypes = {
  enrollment: PropTypes.object,
  member: PropTypes.object,
};

EnrollmentValidationDisplay.defaultProps = {
  enrollment: null,
  member: null,
};

/**
 * Claim submission result display component.
 *
 * @param {Object} props
 * @param {Object} props.result - The claim initiation result
 * @param {Function} props.onDismiss - Dismiss handler
 * @returns {React.ReactElement|null}
 */
function ClaimResultDisplay({ result, onDismiss }) {
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Alert
        variant={result.success ? 'success' : 'error'}
        title={result.success ? 'Claim Submitted Successfully' : 'Claim Submission Failed'}
        showIcon={true}
        bordered={true}
      >
        {result.success ? (
          <div>
            <p>
              The claim has been submitted and is pending processing.
              {result.claimNumber && (
                <span> Claim Number: <strong>{result.claimNumber}</strong></span>
              )}
            </p>
            {result.claimId && (
              <p className="mt-1 text-xs opacity-80">
                Claim ID: {result.claimId.substring(0, 16)}…
              </p>
            )}
          </div>
        ) : (
          <p>{result.error || 'An error occurred while submitting the claim.'}</p>
        )}
      </Alert>

      {result.success && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Claim Number</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5">{result.claimNumber || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Status</p>
            <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(result.status || 'submitted')}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Submitted At</p>
            <p className="text-xs text-gray-700 mt-0.5">{result.timestamp ? formatDate(result.timestamp) : '—'}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
        >
          {result.success ? 'Submit Another Claim' : 'Try Again'}
        </Button>
      </div>
    </div>
  );
}

ClaimResultDisplay.propTypes = {
  result: PropTypes.shape({
    success: PropTypes.bool,
    claimId: PropTypes.string,
    claimNumber: PropTypes.string,
    status: PropTypes.string,
    timestamp: PropTypes.string,
    error: PropTypes.string,
  }),
  onDismiss: PropTypes.func.isRequired,
};

ClaimResultDisplay.defaultProps = {
  result: null,
};

/**
 * Claim initiation form component.
 * Provides member selection, provider selection, service date, diagnosis codes,
 * procedure codes, billed amount, authorization number. Validates against
 * enrollment and eligibility before submission.
 *
 * @param {Object} props
 * @param {string} [props.initialMemberId=''] - Pre-selected member ID
 * @param {string} [props.initialProviderId=''] - Pre-selected provider ID
 * @param {boolean} [props.showHeader=true] - Whether to show the form header
 * @param {boolean} [props.autoProcess=false] - Whether to auto-process the claim after submission
 * @param {Function} [props.onClaimSubmitted] - Callback when claim is submitted: (result) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function ClaimForm({
  initialMemberId = '',
  initialProviderId = '',
  showHeader = true,
  autoProcess = false,
  onClaimSubmitted,
  className = '',
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState(initialMemberId);
  const [selectedProviderId, setSelectedProviderId] = useState(initialProviderId);
  const [serviceDate, setServiceDate] = useState('');
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [procedureCodes, setProcedureCodes] = useState('');
  const [billedAmount, setBilledAmount] = useState('');
  const [authorizationNumber, setAuthorizationNumber] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [priorAuthApproved, setPriorAuthApproved] = useState(false);

  // Derived state
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [activeEnrollment, setActiveEnrollment] = useState(null);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  /**
   * Loads member data and active enrollment when selectedMemberId changes.
   */
  useEffect(() => {
    if (!selectedMemberId || selectedMemberId.trim().length === 0) {
      setSelectedMember(null);
      setActiveEnrollment(null);
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

    // Find active enrollment
    try {
      const storedEnrollments = localStorage.getItem('csnp_enrollments');
      if (storedEnrollments) {
        const enrollments = JSON.parse(storedEnrollments);
        if (Array.isArray(enrollments)) {
          const active = enrollments.find(
            (e) =>
              e.memberId === selectedMemberId.trim() &&
              (e.status === ENROLLMENT_STATUSES.ACTIVE || e.status === ENROLLMENT_STATUSES.APPROVED)
          );
          setActiveEnrollment(active || null);
        }
      }
    } catch {
      setActiveEnrollment(null);
    }
  }, [selectedMemberId]);

  /**
   * Loads provider data when selectedProviderId changes.
   */
  useEffect(() => {
    if (!selectedProviderId || selectedProviderId.trim().length === 0) {
      setSelectedProvider(null);
      return;
    }

    try {
      const storedProviders = localStorage.getItem('csnp_providers');
      if (storedProviders) {
        const providers = JSON.parse(storedProviders);
        if (Array.isArray(providers)) {
          const provider = providers.find((p) => p.id === selectedProviderId.trim());
          setSelectedProvider(provider || null);
        }
      }
    } catch {
      setSelectedProvider(null);
    }
  }, [selectedProviderId]);

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
    setFormErrors((prev) => {
      const updated = { ...prev };
      delete updated.diagnosisCodes;
      return updated;
    });
  }, []);

  /**
   * Handles removing an ICD-10 code.
   * @param {string} code
   */
  const handleRemoveCode = useCallback((code) => {
    setSelectedCodes((prev) => prev.filter((c) => c !== code));
  }, []);

  /**
   * Validates the form before submission.
   * @returns {boolean} Whether the form is valid
   */
  const validateForm = useCallback(() => {
    const errors = {};

    if (!selectedMemberId || selectedMemberId.trim().length === 0) {
      errors.memberId = 'Please select a member';
    }

    if (!selectedProviderId || selectedProviderId.trim().length === 0) {
      errors.providerId = 'Please select a provider';
    }

    if (!serviceDate || serviceDate.trim().length === 0) {
      errors.serviceDate = 'Service date is required';
    } else {
      try {
        const parsed = new Date(serviceDate.trim() + 'T00:00:00');
        if (isNaN(parsed.getTime())) {
          errors.serviceDate = 'Please enter a valid service date';
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (parsed.getTime() > today.getTime()) {
            errors.serviceDate = 'Service date cannot be in the future';
          }
        }
      } catch {
        errors.serviceDate = 'Please enter a valid service date';
      }
    }

    if (selectedCodes.length === 0) {
      errors.diagnosisCodes = 'At least one diagnosis code is required';
    }

    if (!serviceDescription || serviceDescription.trim().length === 0) {
      errors.serviceDescription = 'Service description is required';
    }

    const parsedAmount = parseFloat(billedAmount);
    if (!billedAmount || billedAmount.trim().length === 0) {
      errors.billedAmount = 'Billed amount is required';
    } else if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.billedAmount = 'Billed amount must be a valid number greater than zero';
    }

    if (!activeEnrollment) {
      errors.enrollment = 'Member does not have an active enrollment. Claims require an active enrollment.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedMemberId, selectedProviderId, serviceDate, selectedCodes, serviceDescription, billedAmount, activeEnrollment]);

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

      setSubmitting(true);
      setFormError(null);
      setSubmitResult(null);

      try {
        const performedBy = user ? user.id : 'system';

        const claimData = {
          providerId: selectedProviderId.trim(),
          enrollmentId: activeEnrollment ? activeEnrollment.id : undefined,
          serviceDate: serviceDate.trim(),
          diagnosisCodes: selectedCodes,
          serviceDescription: serviceDescription.trim(),
          billedAmount: parseFloat(billedAmount),
          priorAuthorizationApproved: priorAuthApproved,
          notes: [
            notes.trim(),
            procedureCodes.trim().length > 0 ? `Procedure codes: ${procedureCodes.trim()}` : '',
            authorizationNumber.trim().length > 0 ? `Authorization #: ${authorizationNumber.trim()}` : '',
          ].filter(Boolean).join(' | '),
        };

        const result = initiateClaims(selectedMemberId.trim(), claimData, {
          performedBy,
          autoProcess,
        });

        setSubmitResult(result);

        if (result.success) {
          addNotification(
            'success',
            'Claim Submitted',
            `Claim ${result.claimNumber || ''} has been submitted successfully for ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'the member'}.`
          );

          if (typeof onClaimSubmitted === 'function') {
            onClaimSubmitted(result);
          }
        } else {
          addNotification(
            'error',
            'Claim Submission Failed',
            result.error || 'An error occurred while submitting the claim.'
          );
          setFormError(result.error || 'An error occurred while submitting the claim.');
        }
      } catch (err) {
        console.error('ClaimForm: submission error:', err);
        setFormError('An unexpected error occurred while submitting the claim.');
        addNotification('error', 'Submission Error', 'An unexpected error occurred.');
      } finally {
        setSubmitting(false);
      }
    },
    [
      validateForm,
      user,
      selectedMemberId,
      selectedProviderId,
      activeEnrollment,
      serviceDate,
      selectedCodes,
      serviceDescription,
      billedAmount,
      priorAuthApproved,
      notes,
      procedureCodes,
      authorizationNumber,
      selectedMember,
      autoProcess,
      addNotification,
      onClaimSubmitted,
    ]
  );

  /**
   * Handles form reset / dismiss result.
   */
  const handleReset = useCallback(() => {
    setSelectedMemberId(initialMemberId);
    setSelectedProviderId(initialProviderId);
    setServiceDate('');
    setSelectedCodes([]);
    setProcedureCodes('');
    setBilledAmount('');
    setAuthorizationNumber('');
    setServiceDescription('');
    setNotes('');
    setPriorAuthApproved(false);
    setSubmitResult(null);
    setFormError(null);
    setFormErrors({});
  }, [initialMemberId, initialProviderId]);

  /**
   * Computed: whether the form can be submitted.
   * @type {boolean}
   */
  const canSubmit = useMemo(() => {
    return (
      typeof selectedMemberId === 'string' &&
      selectedMemberId.trim().length > 0 &&
      typeof selectedProviderId === 'string' &&
      selectedProviderId.trim().length > 0 &&
      typeof serviceDate === 'string' &&
      serviceDate.trim().length > 0 &&
      selectedCodes.length > 0 &&
      typeof serviceDescription === 'string' &&
      serviceDescription.trim().length > 0 &&
      typeof billedAmount === 'string' &&
      billedAmount.trim().length > 0 &&
      !submitting
    );
  }, [selectedMemberId, selectedProviderId, serviceDate, selectedCodes, serviceDescription, billedAmount, submitting]);

  /**
   * Computed: parsed billed amount for display.
   */
  const parsedBilledAmount = useMemo(() => {
    const parsed = parseFloat(billedAmount);
    if (isNaN(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, [billedAmount]);

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
                <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-csnp-primary">
                Initiate Claim
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Submit a new claim by selecting a member, provider, and entering service details.
                The claim will be validated against the member&apos;s enrollment and eligibility before processing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form Error */}
      {formError && !submitResult && (
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

      {/* Submission Result */}
      {submitResult && (
        <ClaimResultDisplay
          result={submitResult}
          onDismiss={handleReset}
        />
      )}

      {/* Form */}
      {!submitResult && (
        <form onSubmit={handleSubmit} noValidate>
          {/* Section 1: Member & Provider Selection */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary mb-3">
                Member & Provider
              </p>

              {/* Member Selection */}
              <ClaimMemberSelector
                selectedMemberId={selectedMemberId}
                onSelectMember={(id) => {
                  setSelectedMemberId(id);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.memberId;
                    delete updated.enrollment;
                    return updated;
                  });
                }}
                disabled={submitting}
              />

              {formErrors.memberId && (
                <p className="text-xs text-csnp-alert-error" role="alert">
                  {formErrors.memberId}
                </p>
              )}

              {/* Enrollment Validation */}
              {selectedMemberId && selectedMemberId.trim().length > 0 && (
                <EnrollmentValidationDisplay
                  enrollment={activeEnrollment}
                  member={selectedMember}
                />
              )}

              {formErrors.enrollment && !activeEnrollment && (
                <p className="text-xs text-csnp-alert-error" role="alert">
                  {formErrors.enrollment}
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
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Medicare ID</p>
                    <p className="text-xs font-mono text-gray-700 mt-0.5 truncate">
                      {selectedMember.medicareId || '—'}
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

              {/* Provider Selection */}
              <ClaimProviderSelector
                selectedProviderId={selectedProviderId}
                onSelectProvider={(id) => {
                  setSelectedProviderId(id);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.providerId;
                    return updated;
                  });
                }}
                disabled={submitting}
              />

              {formErrors.providerId && (
                <p className="text-xs text-csnp-alert-error" role="alert">
                  {formErrors.providerId}
                </p>
              )}
            </div>
          </Card>

          {/* Section 2: Service Details */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary mb-3">
                Service Details
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  name="serviceDate"
                  label="Service Date"
                  type="date"
                  value={serviceDate}
                  onChange={(e) => {
                    setServiceDate(e.target.value);
                    setFormErrors((prev) => {
                      const updated = { ...prev };
                      delete updated.serviceDate;
                      return updated;
                    });
                  }}
                  required={true}
                  disabled={submitting}
                  error={formErrors.serviceDate}
                  helperText="Date the service was rendered (cannot be in the future)"
                />

                <FormField
                  name="billedAmount"
                  label="Billed Amount ($)"
                  type="number"
                  value={billedAmount}
                  onChange={(e) => {
                    setBilledAmount(e.target.value);
                    setFormErrors((prev) => {
                      const updated = { ...prev };
                      delete updated.billedAmount;
                      return updated;
                    });
                  }}
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required={true}
                  disabled={submitting}
                  error={formErrors.billedAmount}
                  helperText="Total billed amount for the service"
                />
              </div>

              <FormField
                name="serviceDescription"
                label="Service Description"
                type="textarea"
                value={serviceDescription}
                onChange={(e) => {
                  setServiceDescription(e.target.value);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.serviceDescription;
                    return updated;
                  });
                }}
                placeholder="Describe the service rendered (e.g., Endocrinology office visit - diabetes management and A1C review)"
                required={true}
                disabled={submitting}
                error={formErrors.serviceDescription}
                rows={3}
                maxLength={500}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  name="procedureCodes"
                  label="Procedure Codes (CPT/HCPCS)"
                  type="text"
                  value={procedureCodes}
                  onChange={(e) => setProcedureCodes(e.target.value)}
                  placeholder="e.g., 99213, 99214 (comma-separated)"
                  disabled={submitting}
                  helperText="Enter CPT/HCPCS procedure codes separated by commas (optional)"
                />

                <FormField
                  name="authorizationNumber"
                  label="Authorization Number"
                  type="text"
                  value={authorizationNumber}
                  onChange={(e) => setAuthorizationNumber(e.target.value)}
                  placeholder="e.g., AUTH-2024-XXXXX"
                  disabled={submitting}
                  helperText="Prior authorization reference number (if applicable)"
                />
              </div>

              {/* Prior Authorization Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-700">Prior Authorization Approved</p>
                  <p className="text-[10px] text-gray-500">
                    Indicate if prior authorization was obtained for this service
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={priorAuthApproved}
                  onClick={() => !submitting && setPriorAuthApproved((prev) => !prev)}
                  disabled={submitting}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
                    priorAuthApproved ? 'bg-csnp-primary' : 'bg-gray-300'
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      priorAuthApproved ? 'translate-x-5' : 'translate-x-0'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </Card>

          {/* Section 3: Diagnosis Codes */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary mb-3">
                Diagnosis Codes
              </p>

              <ClaimICD10Selector
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

          {/* Section 4: Additional Notes */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary mb-3">
                Additional Notes
              </p>

              <FormField
                name="claimNotes"
                label="Notes"
                type="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional notes or clinical observations..."
                disabled={submitting}
                rows={3}
                maxLength={1000}
              />
            </div>
          </Card>

          {/* Claim Summary */}
          {selectedMemberId && selectedProviderId && selectedCodes.length > 0 && (
            <Card bordered={true} flat={false} className="mb-6" variant="primary">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-csnp-primary">
                  Claim Summary
                </p>

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
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Provider</p>
                    <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">
                      {selectedProvider
                        ? `${selectedProvider.firstName} ${selectedProvider.lastName}`
                        : selectedProviderId.substring(0, 12) + '…'}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Billed Amount</p>
                    <p className="text-xs font-medium text-gray-700 mt-0.5">
                      {parsedBilledAmount !== null ? formatCurrency(parsedBilledAmount) : '—'}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Dx Codes</p>
                    <p className="text-xs font-medium text-gray-700 mt-0.5">
                      {selectedCodes.length} code{selectedCodes.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {selectedCodes.length > 0 && (
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
                )}

                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  {serviceDate && (
                    <span>Service: {formatDate(serviceDate)}</span>
                  )}
                  {priorAuthApproved && (
                    <>
                      <span className="text-gray-300" aria-hidden="true">·</span>
                      <span className="text-green-600 font-medium">Prior Auth Approved</span>
                    </>
                  )}
                  {authorizationNumber.trim().length > 0 && (
                    <>
                      <span className="text-gray-300" aria-hidden="true">·</span>
                      <span>Auth #: {authorizationNumber.trim()}</span>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* CMS Compliance Notice */}
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
                All C-SNP claims are processed through CSNP-specific adjudication rules per CMS regulations
                (42 CFR §422.100). Claims must include valid ICD-10 diagnosis codes, be associated with an
                active enrollment, and comply with plan-based pricing and authorization requirements.
                Services requiring prior authorization must have approval documented before submission.
                All claim actions are logged in the audit trail.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={submitting}
                loadingText="Submitting..."
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
                Submit Claim
              </Button>

              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleReset}
                disabled={submitting}
              >
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{selectedCodes.length} code{selectedCodes.length !== 1 ? 's' : ''}</span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>{parsedBilledAmount !== null ? formatCurrency(parsedBilledAmount) : '$0.00'}</span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>{activeEnrollment ? 'Enrolled' : 'No enrollment'}</span>
              {priorAuthApproved && (
                <>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                  <span className="text-green-600">Auth ✓</span>
                </>
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

ClaimForm.propTypes = {
  initialMemberId: PropTypes.string,
  initialProviderId: PropTypes.string,
  showHeader: PropTypes.bool,
  autoProcess: PropTypes.bool,
  onClaimSubmitted: PropTypes.func,
  className: PropTypes.string,
};

ClaimForm.defaultProps = {
  initialMemberId: '',
  initialProviderId: '',
  showHeader: true,
  autoProcess: false,
  onClaimSubmitted: undefined,
  className: '',
};