import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import FormField from '../common/FormField.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Modal from '../common/Modal.jsx';
import { processHRA, getLatestHRA } from '../../services/careManagementService.js';
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
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';

/**
 * Risk level to display style mapping.
 * @type {Object.<string, { bg: string, text: string, border: string, label: string, color: string }>}
 */
const RISK_LEVEL_STYLES = {
  low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Low Risk', color: '#27ae60' },
  moderate: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Moderate Risk', color: '#f39c12' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'High Risk', color: '#e67e22' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Critical Risk', color: '#e74c3c' },
};

/**
 * Default risk level style.
 * @type {{ bg: string, text: string, border: string, label: string, color: string }}
 */
const DEFAULT_RISK_LEVEL_STYLE = { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: 'Unknown', color: '#9ca3af' };

/**
 * Pain level options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const PAIN_LEVEL_OPTIONS = [
  { value: '0', label: '0 - No Pain' },
  { value: '1', label: '1 - Minimal' },
  { value: '2', label: '2 - Mild' },
  { value: '3', label: '3 - Uncomfortable' },
  { value: '4', label: '4 - Moderate' },
  { value: '5', label: '5 - Distracting' },
  { value: '6', label: '6 - Distressing' },
  { value: '7', label: '7 - Severe' },
  { value: '8', label: '8 - Intense' },
  { value: '9', label: '9 - Excruciating' },
  { value: '10', label: '10 - Worst Possible' },
];

/**
 * Functional status options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const FUNCTIONAL_STATUS_OPTIONS = [
  { value: 'independent', label: 'Fully Independent' },
  { value: 'mostly_independent', label: 'Mostly Independent (minimal assistance)' },
  { value: 'some_assistance', label: 'Needs Some Assistance' },
  { value: 'significant_assistance', label: 'Needs Significant Assistance' },
  { value: 'dependent', label: 'Fully Dependent' },
];

/**
 * Living situation options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const LIVING_SITUATION_OPTIONS = [
  { value: 'alone', label: 'Lives Alone' },
  { value: 'with_spouse', label: 'Lives with Spouse/Partner' },
  { value: 'with_family', label: 'Lives with Family Members' },
  { value: 'assisted_living', label: 'Assisted Living Facility' },
  { value: 'nursing_home', label: 'Nursing Home / Skilled Nursing' },
  { value: 'group_home', label: 'Group Home' },
  { value: 'other', label: 'Other' },
];

/**
 * Transportation access options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const TRANSPORTATION_OPTIONS = [
  { value: 'own_vehicle', label: 'Drives Own Vehicle' },
  { value: 'family_friend', label: 'Family/Friend Provides Transportation' },
  { value: 'public_transit', label: 'Public Transportation' },
  { value: 'medical_transport', label: 'Medical Transportation Service' },
  { value: 'rideshare', label: 'Rideshare (Uber/Lyft)' },
  { value: 'limited', label: 'Limited Access' },
  { value: 'none', label: 'No Transportation Access' },
];

/**
 * Risk score gauge SVG component.
 *
 * @param {Object} props
 * @param {number} props.score - Score value (0-100)
 * @param {string} props.color - Gauge color hex string
 * @param {string} props.label - Label text below the score
 * @returns {React.ReactElement}
 */
function RiskScoreGauge({ score, color, label }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const safeScore = typeof score === 'number' && !isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg
          className="w-28 h-28 -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{safeScore}</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}

RiskScoreGauge.propTypes = {
  score: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
};

/**
 * HRA result display component.
 *
 * @param {Object} props
 * @param {Object} props.result - The HRA processing result
 * @param {Function} props.onDismiss - Dismiss handler
 * @returns {React.ReactElement|null}
 */
function HRAResultDisplay({ result, onDismiss }) {
  if (!result) {
    return null;
  }

  const riskStyle = RISK_LEVEL_STYLES[result.riskLevel] || DEFAULT_RISK_LEVEL_STYLE;
  const recommendations = result.recommendations || {};

  return (
    <div className="space-y-4">
      {/* Overall Result */}
      <Alert
        variant={result.success ? 'success' : 'error'}
        title={result.success ? 'Health Risk Assessment Completed' : 'HRA Processing Failed'}
        showIcon={true}
        bordered={true}
      >
        {result.success ? (
          <div>
            <p>
              The Health Risk Assessment has been processed successfully.
              {result.hraId && (
                <span> HRA ID: <strong>{result.hraId.substring(0, 16)}…</strong></span>
              )}
            </p>
          </div>
        ) : (
          <p>{result.error || 'An error occurred while processing the Health Risk Assessment.'}</p>
        )}
      </Alert>

      {result.success && (
        <>
          {/* Risk Score and Level */}
          <div className="flex items-start gap-6">
            <RiskScoreGauge
              score={result.riskScore || 0}
              color={riskStyle.color}
              label={riskStyle.label}
            />

            <div className="flex-1 min-w-0">
              <div className="mb-3">
                <StatusBadge
                  status={result.riskLevel === 'low' ? 'active' : result.riskLevel === 'moderate' ? 'pending' : result.riskLevel === 'high' ? 'major_issues' : 'denied'}
                  label={riskStyle.label}
                  size="md"
                  showDot={true}
                  bordered={true}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Risk Score</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{result.riskScore}/100</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Risk Level</p>
                  <p className={`text-sm font-bold mt-0.5 ${riskStyle.text}`}>{toTitleCase(result.riskLevel || 'unknown')}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Monitoring</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {recommendations.monitoringFrequency ? toTitleCase(recommendations.monitoringFrequency) : '—'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">HRA ID</p>
                  <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={result.hraId}>
                    {result.hraId ? result.hraId.substring(0, 12) + '…' : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Immediate Actions */}
          {Array.isArray(recommendations.immediateActions) && recommendations.immediateActions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Immediate Actions ({recommendations.immediateActions.length})
              </p>
              <div className="space-y-1.5">
                {recommendations.immediateActions.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-200">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-red-600 flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <p className="text-xs text-red-700">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-Up Actions */}
          {Array.isArray(recommendations.followUpActions) && recommendations.followUpActions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Follow-Up Actions ({recommendations.followUpActions.length})
              </p>
              <div className="space-y-1.5">
                {recommendations.followUpActions.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-yellow-600 flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p className="text-xs text-yellow-700">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referrals */}
          {Array.isArray(recommendations.referrals) && recommendations.referrals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Recommended Referrals ({recommendations.referrals.length})
              </p>
              <div className="space-y-1.5">
                {recommendations.referrals.map((referral, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-600 flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <p className="text-xs text-blue-700">{referral}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education Topics */}
          {Array.isArray(recommendations.educationTopics) && recommendations.educationTopics.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Education Topics ({recommendations.educationTopics.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recommendations.educationTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
        >
          {result.success ? 'Submit Another HRA' : 'Try Again'}
        </Button>
      </div>
    </div>
  );
}

HRAResultDisplay.propTypes = {
  result: PropTypes.shape({
    success: PropTypes.bool,
    hraId: PropTypes.string,
    riskScore: PropTypes.number,
    riskLevel: PropTypes.string,
    recommendations: PropTypes.shape({
      immediateActions: PropTypes.arrayOf(PropTypes.string),
      followUpActions: PropTypes.arrayOf(PropTypes.string),
      referrals: PropTypes.arrayOf(PropTypes.string),
      educationTopics: PropTypes.arrayOf(PropTypes.string),
      monitoringFrequency: PropTypes.string,
    }),
    auditId: PropTypes.string,
    timestamp: PropTypes.string,
    error: PropTypes.string,
  }),
  onDismiss: PropTypes.func.isRequired,
};

HRAResultDisplay.defaultProps = {
  result: null,
};

/**
 * Toggle switch component for boolean HRA questions.
 *
 * @param {Object} props
 * @param {string} props.label - Question label
 * @param {string} [props.description] - Question description
 * @param {boolean} props.checked - Whether the toggle is on
 * @param {Function} props.onChange - Change handler
 * @param {boolean} [props.disabled=false] - Whether the toggle is disabled
 * @param {string} [props.severity] - Visual severity indicator ('high', 'medium', 'low')
 * @returns {React.ReactElement}
 */
function HRAToggle({ label, description, checked, onChange, disabled = false, severity }) {
  const severityStyles = {
    high: checked ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200',
    medium: checked ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200',
    low: checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200',
  };

  const borderClass = severity && severityStyles[severity]
    ? severityStyles[severity]
    : checked ? 'bg-csnp-blue-50 border-csnp-blue-100' : 'bg-white border-gray-200';

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors duration-150 ${borderClass}`}>
      <div className="min-w-0 flex-1 pr-3">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        {description && (
          <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
          checked ? 'bg-csnp-primary' : 'bg-gray-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

HRAToggle.propTypes = {
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  severity: PropTypes.string,
};

HRAToggle.defaultProps = {
  description: undefined,
  disabled: false,
  severity: undefined,
};

/**
 * Member selector component for HRA form.
 *
 * @param {Object} props
 * @param {string} props.selectedMemberId - Currently selected member ID
 * @param {Function} props.onSelectMember - Callback when a member is selected
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 * @returns {React.ReactElement}
 */
function HRAMemberSelector({ selectedMemberId, onSelectMember, disabled = false }) {
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = React.useRef(null);
  const inputRef = React.useRef(null);

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
        Search and select a member to complete their Health Risk Assessment.
      </p>
    </div>
  );
}

HRAMemberSelector.propTypes = {
  selectedMemberId: PropTypes.string.isRequired,
  onSelectMember: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

HRAMemberSelector.defaultProps = {
  disabled: false,
};

/**
 * Health Risk Assessment (HRA) form component.
 * Comprehensive health questionnaire with sections for medical history,
 * current conditions, medications, functional status, social determinants,
 * and risk scoring. Submits to careManagementService.processHRA.
 *
 * @param {Object} props
 * @param {string} [props.initialMemberId=''] - Pre-selected member ID
 * @param {boolean} [props.showHeader=true] - Whether to show the form header
 * @param {boolean} [props.showPreviousHRA=true] - Whether to show previous HRA results
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {Function} [props.onHRAComplete] - Callback when HRA completes: (result) => void
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function HRAForm({
  initialMemberId = '',
  showHeader = true,
  showPreviousHRA = true,
  compact = false,
  onHRAComplete,
  className = '',
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  // Member selection
  const [selectedMemberId, setSelectedMemberId] = useState(initialMemberId);
  const [selectedMember, setSelectedMember] = useState(null);
  const [previousHRA, setPreviousHRA] = useState(null);

  // Medical History section
  const [recentHospitalization, setRecentHospitalization] = useState(false);
  const [recentERVisit, setRecentERVisit] = useState(false);
  const [hospitalizationDetails, setHospitalizationDetails] = useState('');
  const [erVisitDetails, setERVisitDetails] = useState('');
  const [numberOfHospitalizations, setNumberOfHospitalizations] = useState('0');
  const [numberOfERVisits, setNumberOfERVisits] = useState('0');

  // Current Conditions section
  const [painLevel, setPainLevel] = useState('0');
  const [cognitiveImpairment, setCognitiveImpairment] = useState(false);
  const [depressionScreenPositive, setDepressionScreenPositive] = useState(false);
  const [anxietyPresent, setAnxietyPresent] = useState(false);
  const [visionImpairment, setVisionImpairment] = useState(false);
  const [hearingImpairment, setHearingImpairment] = useState(false);

  // Medications section
  const [medicationNonAdherence, setMedicationNonAdherence] = useState(false);
  const [polypharmacy, setPolypharmacy] = useState(false);
  const [numberOfMedications, setNumberOfMedications] = useState('');
  const [medicationConcerns, setMedicationConcerns] = useState('');

  // Functional Status section
  const [functionalLimitations, setFunctionalLimitations] = useState(false);
  const [fallRisk, setFallRisk] = useState(false);
  const [fallHistory, setFallHistory] = useState(false);
  const [functionalStatus, setFunctionalStatus] = useState('independent');
  const [mobilityAids, setMobilityAids] = useState(false);
  const [adlDifficulties, setADLDifficulties] = useState('');

  // Social Determinants section
  const [socialIsolation, setSocialIsolation] = useState(false);
  const [tobaccoUse, setTobaccoUse] = useState(false);
  const [alcoholUse, setAlcoholUse] = useState(false);
  const [substanceUse, setSubstanceUse] = useState(false);
  const [foodInsecurity, setFoodInsecurity] = useState(false);
  const [housingInstability, setHousingInstability] = useState(false);
  const [livingSituation, setLivingSituation] = useState('with_family');
  const [transportationAccess, setTransportationAccess] = useState('family_friend');
  const [caregiverAvailable, setCaregiverAvailable] = useState(true);
  const [caregiverStress, setCaregiverStress] = useState(false);

  // Additional Notes
  const [notes, setNotes] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [hraResult, setHRAResult] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  /**
   * Loads member data when selectedMemberId changes.
   */
  useEffect(() => {
    if (!selectedMemberId || selectedMemberId.trim().length === 0) {
      setSelectedMember(null);
      setPreviousHRA(null);
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

    // Load previous HRA
    if (showPreviousHRA) {
      try {
        const latestHRA = getLatestHRA(selectedMemberId.trim());
        setPreviousHRA(latestHRA);
      } catch {
        setPreviousHRA(null);
      }
    }
  }, [selectedMemberId, showPreviousHRA]);

  /**
   * Validates the form before submission.
   * @returns {boolean} Whether the form is valid
   */
  const validateForm = useCallback(() => {
    const errors = {};

    if (!selectedMemberId || selectedMemberId.trim().length === 0) {
      errors.memberId = 'Please select a member';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedMemberId]);

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
      setHRAResult(null);

      try {
        const performedBy = user ? user.id : 'system';

        const hraData = {
          // Medical History
          recentHospitalization,
          recentERVisit,
          hospitalizationDetails: hospitalizationDetails.trim(),
          erVisitDetails: erVisitDetails.trim(),
          numberOfHospitalizations: parseInt(numberOfHospitalizations, 10) || 0,
          numberOfERVisits: parseInt(numberOfERVisits, 10) || 0,

          // Current Conditions
          painLevel: parseInt(painLevel, 10) || 0,
          cognitiveImpairment,
          depressionScreenPositive,
          anxietyPresent,
          visionImpairment,
          hearingImpairment,

          // Medications
          medicationNonAdherence,
          polypharmacy,
          numberOfMedications: parseInt(numberOfMedications, 10) || 0,
          medicationConcerns: medicationConcerns.trim(),

          // Functional Status
          functionalLimitations,
          fallRisk,
          fallHistory,
          functionalStatus,
          mobilityAids,
          adlDifficulties: adlDifficulties.trim(),

          // Social Determinants
          socialIsolation,
          tobaccoUse,
          alcoholUse,
          substanceUse,
          foodInsecurity,
          housingInstability,
          livingSituation,
          transportationAccess,
          caregiverAvailable,
          caregiverStress,

          // Notes
          notes: notes.trim(),
        };

        const result = processHRA(selectedMemberId.trim(), hraData, {
          performedBy,
          createAlerts: true,
          createTasks: true,
        });

        setHRAResult(result);

        if (result.success) {
          const riskStyle = RISK_LEVEL_STYLES[result.riskLevel] || DEFAULT_RISK_LEVEL_STYLE;
          addNotification(
            result.riskLevel === 'critical' || result.riskLevel === 'high' ? 'warning' : 'success',
            'HRA Completed',
            `Health Risk Assessment completed for ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'member'}. Risk Score: ${result.riskScore}/100 (${riskStyle.label}).`
          );

          if (typeof onHRAComplete === 'function') {
            onHRAComplete(result);
          }
        } else {
          addNotification(
            'error',
            'HRA Failed',
            result.error || 'An error occurred while processing the Health Risk Assessment.'
          );
          setFormError(result.error || 'An error occurred while processing the Health Risk Assessment.');
        }
      } catch (err) {
        console.error('HRAForm: submission error:', err);
        setFormError('An unexpected error occurred while processing the Health Risk Assessment.');
        addNotification('error', 'HRA Error', 'An unexpected error occurred.');
      } finally {
        setSubmitting(false);
      }
    },
    [
      validateForm,
      user,
      selectedMemberId,
      selectedMember,
      recentHospitalization,
      recentERVisit,
      hospitalizationDetails,
      erVisitDetails,
      numberOfHospitalizations,
      numberOfERVisits,
      painLevel,
      cognitiveImpairment,
      depressionScreenPositive,
      anxietyPresent,
      visionImpairment,
      hearingImpairment,
      medicationNonAdherence,
      polypharmacy,
      numberOfMedications,
      medicationConcerns,
      functionalLimitations,
      fallRisk,
      fallHistory,
      functionalStatus,
      mobilityAids,
      adlDifficulties,
      socialIsolation,
      tobaccoUse,
      alcoholUse,
      substanceUse,
      foodInsecurity,
      housingInstability,
      livingSituation,
      transportationAccess,
      caregiverAvailable,
      caregiverStress,
      notes,
      addNotification,
      onHRAComplete,
    ]
  );

  /**
   * Handles form reset / dismiss result.
   */
  const handleReset = useCallback(() => {
    setRecentHospitalization(false);
    setRecentERVisit(false);
    setHospitalizationDetails('');
    setERVisitDetails('');
    setNumberOfHospitalizations('0');
    setNumberOfERVisits('0');
    setPainLevel('0');
    setCognitiveImpairment(false);
    setDepressionScreenPositive(false);
    setAnxietyPresent(false);
    setVisionImpairment(false);
    setHearingImpairment(false);
    setMedicationNonAdherence(false);
    setPolypharmacy(false);
    setNumberOfMedications('');
    setMedicationConcerns('');
    setFunctionalLimitations(false);
    setFallRisk(false);
    setFallHistory(false);
    setFunctionalStatus('independent');
    setMobilityAids(false);
    setADLDifficulties('');
    setSocialIsolation(false);
    setTobaccoUse(false);
    setAlcoholUse(false);
    setSubstanceUse(false);
    setFoodInsecurity(false);
    setHousingInstability(false);
    setLivingSituation('with_family');
    setTransportationAccess('family_friend');
    setCaregiverAvailable(true);
    setCaregiverStress(false);
    setNotes('');
    setHRAResult(null);
    setFormError(null);
    setFormErrors({});
  }, []);

  /**
   * Computed: risk factor count for the summary.
   */
  const riskFactorCount = useMemo(() => {
    let count = 0;
    if (recentHospitalization) count++;
    if (recentERVisit) count++;
    if (parseInt(painLevel, 10) >= 7) count++;
    if (cognitiveImpairment) count++;
    if (depressionScreenPositive) count++;
    if (medicationNonAdherence) count++;
    if (functionalLimitations) count++;
    if (fallRisk) count++;
    if (socialIsolation) count++;
    if (tobaccoUse) count++;
    if (foodInsecurity) count++;
    if (housingInstability) count++;
    return count;
  }, [
    recentHospitalization, recentERVisit, painLevel, cognitiveImpairment,
    depressionScreenPositive, medicationNonAdherence, functionalLimitations,
    fallRisk, socialIsolation, tobaccoUse, foodInsecurity, housingInstability,
  ]);

  /**
   * Computed: whether the form can be submitted.
   */
  const canSubmit = useMemo(() => {
    return (
      typeof selectedMemberId === 'string' &&
      selectedMemberId.trim().length > 0 &&
      !submitting
    );
  }, [selectedMemberId, submitting]);

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
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-csnp-primary">
                Health Risk Assessment
              </h2>
              {!compact && (
                <p className="mt-0.5 text-sm text-gray-500">
                  Complete the comprehensive health questionnaire to assess the member&apos;s risk level
                  and generate care recommendations.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Error */}
      {formError && !hraResult && (
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

      {/* HRA Result */}
      {hraResult && (
        <HRAResultDisplay
          result={hraResult}
          onDismiss={handleReset}
        />
      )}

      {/* Form */}
      {!hraResult && (
        <form onSubmit={handleSubmit} noValidate>
          {/* Section 1: Member Selection */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary">Member Selection</p>

              <HRAMemberSelector
                selectedMemberId={selectedMemberId}
                onSelectMember={(id) => {
                  setSelectedMemberId(id);
                  setFormErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.memberId;
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

              {/* Previous HRA */}
              {showPreviousHRA && previousHRA && (
                <div className={`p-3 rounded-lg border ${
                  RISK_LEVEL_STYLES[previousHRA.riskLevel]
                    ? `${RISK_LEVEL_STYLES[previousHRA.riskLevel].bg} ${RISK_LEVEL_STYLES[previousHRA.riskLevel].border}`
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-gray-500 flex-shrink-0"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <p className="text-xs font-medium text-gray-700">
                        Previous HRA: Score {previousHRA.riskScore}/100 ({toTitleCase(previousHRA.riskLevel || 'unknown')})
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {previousHRA.createdAt ? formatRelativeTime(previousHRA.createdAt) : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Section 2: Medical History */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-csnp-primary">Medical History</p>
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  Section 1 of 5
                </span>
              </div>

              <p className="text-xs text-gray-500">
                Recent hospitalizations, emergency room visits, and medical events.
              </p>

              <div className="space-y-3">
                <HRAToggle
                  label="Recent Hospitalization (past 6 months)"
                  description="Has the member been admitted to a hospital in the past 6 months?"
                  checked={recentHospitalization}
                  onChange={setRecentHospitalization}
                  disabled={submitting}
                  severity="high"
                />

                {recentHospitalization && (
                  <div className="ml-4 space-y-3">
                    <FormField
                      name="numberOfHospitalizations"
                      label="Number of Hospitalizations"
                      type="number"
                      value={numberOfHospitalizations}
                      onChange={(e) => setNumberOfHospitalizations(e.target.value)}
                      min="0"
                      max="20"
                      disabled={submitting}
                      size="sm"
                      helperText="Number of hospital admissions in the past 6 months"
                    />
                    <FormField
                      name="hospitalizationDetails"
                      label="Hospitalization Details"
                      type="textarea"
                      value={hospitalizationDetails}
                      onChange={(e) => setHospitalizationDetails(e.target.value)}
                      placeholder="Describe the reason(s) for hospitalization..."
                      disabled={submitting}
                      rows={2}
                      maxLength={500}
                      size="sm"
                    />
                  </div>
                )}

                <HRAToggle
                  label="Recent Emergency Room Visit (past 6 months)"
                  description="Has the member visited the emergency room in the past 6 months?"
                  checked={recentERVisit}
                  onChange={setRecentERVisit}
                  disabled={submitting}
                  severity="medium"
                />

                {recentERVisit && (
                  <div className="ml-4 space-y-3">
                    <FormField
                      name="numberOfERVisits"
                      label="Number of ER Visits"
                      type="number"
                      value={numberOfERVisits}
                      onChange={(e) => setNumberOfERVisits(e.target.value)}
                      min="0"
                      max="20"
                      disabled={submitting}
                      size="sm"
                      helperText="Number of ER visits in the past 6 months"
                    />
                    <FormField
                      name="erVisitDetails"
                      label="ER Visit Details"
                      type="textarea"
                      value={erVisitDetails}
                      onChange={(e) => setERVisitDetails(e.target.value)}
                      placeholder="Describe the reason(s) for ER visits..."
                      disabled={submitting}
                      rows={2}
                      maxLength={500}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Section 3: Current Conditions */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-csnp-primary">Current Conditions & Symptoms</p>
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  Section 2 of 5
                </span>
              </div>

              <p className="text-xs text-gray-500">
                Current pain levels, cognitive status, mental health screening, and sensory impairments.
              </p>

              <div className="space-y-3">
                <FormField
                  name="painLevel"
                  label="Current Pain Level (0-10 Scale)"
                  type="select"
                  value={painLevel}
                  onChange={(e) => setPainLevel(e.target.value)}
                  options={PAIN_LEVEL_OPTIONS}
                  disabled={submitting}
                  size="sm"
                  helperText="Rate the member's current pain level on a 0-10 scale"
                />

                <HRAToggle
                  label="Cognitive Impairment"
                  description="Does the member show signs of cognitive decline, memory loss, or confusion?"
                  checked={cognitiveImpairment}
                  onChange={setCognitiveImpairment}
                  disabled={submitting}
                  severity="high"
                />

                <HRAToggle
                  label="Depression Screen Positive (PHQ-2/PHQ-9)"
                  description="Has the member screened positive for depression on a standardized screening tool?"
                  checked={depressionScreenPositive}
                  onChange={setDepressionScreenPositive}
                  disabled={submitting}
                  severity="medium"
                />

                <HRAToggle
                  label="Anxiety Present"
                  description="Does the member report or exhibit symptoms of anxiety?"
                  checked={anxietyPresent}
                  onChange={setAnxietyPresent}
                  disabled={submitting}
                  severity="low"
                />

                <HRAToggle
                  label="Vision Impairment"
                  description="Does the member have significant vision problems affecting daily activities?"
                  checked={visionImpairment}
                  onChange={setVisionImpairment}
                  disabled={submitting}
                  severity="low"
                />

                <HRAToggle
                  label="Hearing Impairment"
                  description="Does the member have significant hearing problems affecting communication?"
                  checked={hearingImpairment}
                  onChange={setHearingImpairment}
                  disabled={submitting}
                  severity="low"
                />
              </div>
            </div>
          </Card>

          {/* Section 4: Medications */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-csnp-primary">Medications</p>
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  Section 3 of 5
                </span>
              </div>

              <p className="text-xs text-gray-500">
                Medication adherence, polypharmacy risk, and medication-related concerns.
              </p>

              <div className="space-y-3">
                <FormField
                  name="numberOfMedications"
                  label="Number of Current Medications"
                  type="number"
                  value={numberOfMedications}
                  onChange={(e) => setNumberOfMedications(e.target.value)}
                  min="0"
                  max="50"
                  placeholder="Enter number of medications"
                  disabled={submitting}
                  size="sm"
                  helperText="Total number of prescription and over-the-counter medications"
                />

                <HRAToggle
                  label="Medication Non-Adherence"
                  description="Does the member have difficulty taking medications as prescribed (missed doses, incorrect timing, etc.)?"
                  checked={medicationNonAdherence}
                  onChange={setMedicationNonAdherence}
                  disabled={submitting}
                  severity="high"
                />

                <HRAToggle
                  label="Polypharmacy Risk (5+ medications)"
                  description="Is the member taking 5 or more medications, increasing the risk of drug interactions?"
                  checked={polypharmacy}
                  onChange={setPolypharmacy}
                  disabled={submitting}
                  severity="medium"
                />

                <FormField
                  name="medicationConcerns"
                  label="Medication Concerns"
                  type="textarea"
                  value={medicationConcerns}
                  onChange={(e) => setMedicationConcerns(e.target.value)}
                  placeholder="Note any medication-related concerns, side effects, or barriers to adherence..."
                  disabled={submitting}
                  rows={2}
                  maxLength={500}
                  size="sm"
                />
              </div>
            </div>
          </Card>

          {/* Section 5: Functional Status */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-csnp-primary">Functional Status & Safety</p>
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  Section 4 of 5
                </span>
              </div>

              <p className="text-xs text-gray-500">
                Activities of daily living, mobility, fall risk, and functional limitations.
              </p>

              <div className="space-y-3">
                <FormField
                  name="functionalStatus"
                  label="Overall Functional Status"
                  type="select"
                  value={functionalStatus}
                  onChange={(e) => setFunctionalStatus(e.target.value)}
                  options={FUNCTIONAL_STATUS_OPTIONS}
                  disabled={submitting}
                  size="sm"
                  helperText="Member's overall ability to perform daily activities independently"
                />

                <HRAToggle
                  label="Functional Limitations"
                  description="Does the member have limitations in performing activities of daily living (bathing, dressing, eating, etc.)?"
                  checked={functionalLimitations}
                  onChange={setFunctionalLimitations}
                  disabled={submitting}
                  severity="medium"
                />

                <HRAToggle
                  label="Fall Risk"
                  description="Is the member at risk for falls based on assessment (unsteady gait, balance issues, environmental hazards)?"
                  checked={fallRisk}
                  onChange={setFallRisk}
                  disabled={submitting}
                  severity="high"
                />

                <HRAToggle
                  label="Fall History (past 12 months)"
                  description="Has the member experienced one or more falls in the past 12 months?"
                  checked={fallHistory}
                  onChange={setFallHistory}
                  disabled={submitting}
                  severity="high"
                />

                <HRAToggle
                  label="Uses Mobility Aids"
                  description="Does the member use a cane, walker, wheelchair, or other mobility device?"
                  checked={mobilityAids}
                  onChange={setMobilityAids}
                  disabled={submitting}
                  severity="low"
                />

                <FormField
                  name="adlDifficulties"
                  label="ADL Difficulties"
                  type="textarea"
                  value={adlDifficulties}
                  onChange={(e) => setADLDifficulties(e.target.value)}
                  placeholder="Describe specific activities of daily living the member has difficulty with..."
                  disabled={submitting}
                  rows={2}
                  maxLength={500}
                  size="sm"
                />
              </div>
            </div>
          </Card>

          {/* Section 6: Social Determinants */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-csnp-primary">Social Determinants of Health</p>
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  Section 5 of 5
                </span>
              </div>

              <p className="text-xs text-gray-500">
                Living situation, social support, substance use, food security, and transportation access.
              </p>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    name="livingSituation"
                    label="Living Situation"
                    type="select"
                    value={livingSituation}
                    onChange={(e) => setLivingSituation(e.target.value)}
                    options={LIVING_SITUATION_OPTIONS}
                    disabled={submitting}
                    size="sm"
                  />

                  <FormField
                    name="transportationAccess"
                    label="Transportation Access"
                    type="select"
                    value={transportationAccess}
                    onChange={(e) => setTransportationAccess(e.target.value)}
                    options={TRANSPORTATION_OPTIONS}
                    disabled={submitting}
                    size="sm"
                  />
                </div>

                <HRAToggle
                  label="Social Isolation"
                  description="Does the member report feeling lonely, isolated, or lacking social connections?"
                  checked={socialIsolation}
                  onChange={setSocialIsolation}
                  disabled={submitting}
                  severity="medium"
                />

                <HRAToggle
                  label="Caregiver Available"
                  description="Does the member have a caregiver or family member who provides regular support?"
                  checked={caregiverAvailable}
                  onChange={setCaregiverAvailable}
                  disabled={submitting}
                />

                {caregiverAvailable && (
                  <HRAToggle
                    label="Caregiver Stress/Burnout"
                    description="Is the caregiver experiencing stress, burnout, or difficulty providing care?"
                    checked={caregiverStress}
                    onChange={setCaregiverStress}
                    disabled={submitting}
                    severity="medium"
                  />
                )}

                <HRAToggle
                  label="Food Insecurity"
                  description="Does the member have difficulty affording or accessing adequate food?"
                  checked={foodInsecurity}
                  onChange={setFoodInsecurity}
                  disabled={submitting}
                  severity="medium"
                />

                <HRAToggle
                  label="Housing Instability"
                  description="Does the member have concerns about housing stability or safety?"
                  checked={housingInstability}
                  onChange={setHousingInstability}
                  disabled={submitting}
                  severity="medium"
                />

                <HRAToggle
                  label="Tobacco Use"
                  description="Does the member currently use tobacco products (cigarettes, cigars, chewing tobacco, vaping)?"
                  checked={tobaccoUse}
                  onChange={setTobaccoUse}
                  disabled={submitting}
                  severity="medium"
                />

                <HRAToggle
                  label="Alcohol Use (Excessive)"
                  description="Does the member consume alcohol in excess of recommended guidelines?"
                  checked={alcoholUse}
                  onChange={setAlcoholUse}
                  disabled={submitting}
                  severity="medium"
                />

                <HRAToggle
                  label="Substance Use"
                  description="Does the member use recreational drugs or misuse prescription medications?"
                  checked={substanceUse}
                  onChange={setSubstanceUse}
                  disabled={submitting}
                  severity="high"
                />
              </div>
            </div>
          </Card>

          {/* Additional Notes */}
          <Card bordered={true} flat={false} className="mb-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-csnp-primary">Additional Notes</p>

              <FormField
                name="hraNotes"
                label="Assessment Notes"
                type="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional observations, clinical notes, or concerns about the member's health status..."
                disabled={submitting}
                rows={4}
                maxLength={2000}
              />
            </div>
          </Card>

          {/* Assessment Summary */}
          <Card bordered={true} flat={false} className="mb-6" variant="primary">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-csnp-primary">Assessment Summary</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2 bg-white rounded-lg border border-gray-200">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Member</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">
                    {selectedMember
                      ? `${selectedMember.firstName} ${selectedMember.lastName}`
                      : '—'}
                  </p>
                </div>
                <div className="p-2 bg-white rounded-lg border border-gray-200">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Risk Factors</p>
                  <p className={`text-xs font-medium mt-0.5 ${riskFactorCount >= 5 ? 'text-red-700' : riskFactorCount >= 3 ? 'text-orange-700' : riskFactorCount >= 1 ? 'text-yellow-700' : 'text-green-700'}`}>
                    {riskFactorCount} identified
                  </p>
                </div>
                <div className="p-2 bg-white rounded-lg border border-gray-200">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Pain Level</p>
                  <p className={`text-xs font-medium mt-0.5 ${parseInt(painLevel, 10) >= 7 ? 'text-red-700' : parseInt(painLevel, 10) >= 4 ? 'text-yellow-700' : 'text-green-700'}`}>
                    {painLevel}/10
                  </p>
                </div>
                <div className="p-2 bg-white rounded-lg border border-gray-200">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Functional Status</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">
                    {toTitleCase(functionalStatus.replace(/_/g, ' '))}
                  </p>
                </div>
              </div>

              {riskFactorCount > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recentHospitalization && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
                      Hospitalization
                    </span>
                  )}
                  {recentERVisit && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">
                      ER Visit
                    </span>
                  )}
                  {fallRisk && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
                      Fall Risk
                    </span>
                  )}
                  {cognitiveImpairment && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
                      Cognitive Impairment
                    </span>
                  )}
                  {depressionScreenPositive && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                      Depression
                    </span>
                  )}
                  {medicationNonAdherence && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">
                      Med Non-Adherence
                    </span>
                  )}
                  {functionalLimitations && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                      Functional Limitations
                    </span>
                  )}
                  {socialIsolation && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
                      Social Isolation
                    </span>
                  )}
                  {tobaccoUse && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                      Tobacco Use
                    </span>
                  )}
                  {foodInsecurity && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">
                      Food Insecurity
                    </span>
                  )}
                  {housingInstability && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">
                      Housing Instability
                    </span>
                  )}
                  {parseInt(painLevel, 10) >= 7 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
                      Severe Pain ({painLevel}/10)
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>

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
                  Health Risk Assessments are required for all C-SNP members per 42 CFR §422.101.
                  Initial HRAs must be completed within 90 days of enrollment. Annual reassessments
                  are required. All HRA results are logged in the audit trail and used to generate
                  individualized care plans and care management interventions.
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
                loading={submitting}
                loadingText="Processing..."
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
                Submit HRA
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
              <span>{riskFactorCount} risk factor{riskFactorCount !== 1 ? 's' : ''}</span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>Pain: {painLevel}/10</span>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <span>{toTitleCase(functionalStatus.replace(/_/g, ' '))}</span>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

HRAForm.propTypes = {
  initialMemberId: PropTypes.string,
  showHeader: PropTypes.bool,
  showPreviousHRA: PropTypes.bool,
  compact: PropTypes.bool,
  onHRAComplete: PropTypes.func,
  className: PropTypes.string,
};

HRAForm.defaultProps = {
  initialMemberId: '',
  showHeader: true,
  showPreviousHRA: true,
  compact: false,
  onHRAComplete: undefined,
  className: '',
};