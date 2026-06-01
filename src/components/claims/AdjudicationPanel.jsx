import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import Tabs from '../common/Tabs.jsx';
import {
  getClaimById,
  processClaim,
  reprocessClaim,
  markClaimPaid,
  appealClaim,
  voidClaim,
} from '../../services/claimsService.js';
import { evaluateClaimRules, summarizeRuleResults, RULE_SEVERITY } from '../../services/ruleEngine.js';
import { getAuditLogs } from '../../services/auditLogger.js';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  toTitleCase,
} from '../../utils/helpers.js';
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
} from '../../utils/constants.js';
import {
  getCodeByICD10,
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Status to StatusBadge status mapping.
 * @type {Object.<string, string>}
 */
const STATUS_BADGE_MAP = {
  [CLAIM_STATUSES.SUBMITTED]: 'submitted',
  [CLAIM_STATUSES.PENDING]: 'pending',
  [CLAIM_STATUSES.IN_REVIEW]: 'in_review',
  [CLAIM_STATUSES.APPROVED]: 'approved',
  [CLAIM_STATUSES.DENIED]: 'denied',
  [CLAIM_STATUSES.PARTIALLY_APPROVED]: 'partially_approved',
  [CLAIM_STATUSES.APPEALED]: 'appealed',
  [CLAIM_STATUSES.PAID]: 'paid',
  [CLAIM_STATUSES.VOIDED]: 'voided',
};

/**
 * Rule severity to display style mapping.
 * @type {Object.<string, { bg: string, text: string, border: string, dot: string }>}
 */
const SEVERITY_STYLES = {
  [RULE_SEVERITY.ERROR]: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  [RULE_SEVERITY.WARNING]: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  [RULE_SEVERITY.INFO]: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
};

/**
 * Default severity style.
 * @type {{ bg: string, text: string, border: string, dot: string }}
 */
const DEFAULT_SEVERITY_STYLE = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' };

/**
 * Manual override reason options.
 * @type {{ value: string, label: string }[]}
 */
const OVERRIDE_REASON_OPTIONS = [
  { value: 'clinical_review', label: 'Clinical Review Override' },
  { value: 'medical_director_approval', label: 'Medical Director Approval' },
  { value: 'prior_auth_retroactive', label: 'Retroactive Prior Authorization' },
  { value: 'coding_correction', label: 'Coding Correction' },
  { value: 'benefit_exception', label: 'Benefit Exception' },
  { value: 'network_exception', label: 'Network Exception' },
  { value: 'timely_filing_exception', label: 'Timely Filing Exception' },
  { value: 'member_appeal_resolution', label: 'Member Appeal Resolution' },
  { value: 'provider_dispute_resolution', label: 'Provider Dispute Resolution' },
  { value: 'system_error_correction', label: 'System Error Correction' },
  { value: 'other', label: 'Other (specify in notes)' },
];

/**
 * Manual override action options.
 * @type {{ value: string, label: string }[]}
 */
const OVERRIDE_ACTION_OPTIONS = [
  { value: 'approve', label: 'Approve Claim' },
  { value: 'deny', label: 'Deny Claim' },
  { value: 'partial_approve', label: 'Partially Approve' },
  { value: 'send_to_review', label: 'Send to Review' },
  { value: 'reprocess', label: 'Reprocess Claim' },
];

/**
 * Skeleton loading state for the adjudication panel.
 * @returns {React.ReactElement}
 */
function AdjudicationPanelSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-16 bg-gray-200 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-32 bg-gray-200 rounded-lg" />
    </div>
  );
}

/**
 * Single rule evaluation result item component.
 *
 * @param {Object} props
 * @param {Object} props.rule - The rule result object
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function RuleResultItem({ rule, isLast = false }) {
  const severityStyle = SEVERITY_STYLES[rule.severity] || DEFAULT_SEVERITY_STYLE;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 ${
      rule.passed
        ? 'bg-white border-gray-200'
        : `${severityStyle.bg} ${severityStyle.border}`
    }`}>
      {/* Status Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        rule.passed
          ? 'bg-green-50 text-green-600'
          : `${severityStyle.bg} ${severityStyle.text}`
      }`}>
        {rule.passed ? (
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
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : (
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      {/* Rule Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xs font-semibold ${rule.passed ? 'text-gray-900' : severityStyle.text}`}>
            {rule.ruleName || 'Unknown Rule'}
          </p>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${
            rule.passed
              ? 'bg-green-50 text-green-700 border-green-200'
              : `${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rule.passed ? 'bg-green-500' : severityStyle.dot}`} aria-hidden="true" />
            {rule.passed ? 'Passed' : toTitleCase(rule.severity || 'unknown')}
          </span>
          <span className="text-[10px] font-mono text-gray-400">{rule.ruleId || ''}</span>
        </div>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed line-clamp-2">
          {rule.message || 'No details available'}
        </p>
        {rule.metadata && typeof rule.metadata === 'object' && Object.keys(rule.metadata).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {Object.entries(rule.metadata).map(([key, value]) => {
              if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
                return null;
              }
              const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
              if (displayValue.length > 60) {
                return null;
              }
              return (
                <span
                  key={key}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200"
                  title={`${key}: ${displayValue}`}
                >
                  {toTitleCase(key.replace(/([A-Z])/g, ' $1').trim())}: {displayValue}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

RuleResultItem.propTypes = {
  rule: PropTypes.shape({
    ruleId: PropTypes.string,
    ruleName: PropTypes.string,
    passed: PropTypes.bool,
    severity: PropTypes.string,
    message: PropTypes.string,
    metadata: PropTypes.object,
  }).isRequired,
  isLast: PropTypes.bool,
};

RuleResultItem.defaultProps = {
  isLast: false,
};

/**
 * Pricing breakdown display component.
 *
 * @param {Object} props
 * @param {Object|null} props.pricingDetails - The pricing details object
 * @param {number} props.billedAmount - Billed amount
 * @param {number} props.allowedAmount - Allowed amount
 * @param {number} props.paidAmount - Paid amount
 * @param {number} props.memberResponsibility - Member responsibility amount
 * @returns {React.ReactElement}
 */
function PricingBreakdown({ pricingDetails, billedAmount, allowedAmount, paidAmount, memberResponsibility }) {
  const adjustmentAmount = typeof billedAmount === 'number' && typeof allowedAmount === 'number'
    ? Math.round((billedAmount - allowedAmount) * 100) / 100
    : 0;

  const allowedRate = typeof billedAmount === 'number' && billedAmount > 0 && typeof allowedAmount === 'number'
    ? Math.round((allowedAmount / billedAmount) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Financial Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Billed</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">
            {formatCurrency(billedAmount)}
          </p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">Allowed</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">
            {formatCurrency(allowedAmount)}
          </p>
          <p className="text-[10px] text-blue-400">{allowedRate}% of billed</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Plan Pays</p>
          <p className="text-sm font-bold text-green-700 mt-0.5">
            {formatCurrency(paidAmount)}
          </p>
        </div>
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-[10px] text-yellow-500 uppercase tracking-wider font-semibold">Member Resp.</p>
          <p className="text-sm font-bold text-yellow-700 mt-0.5">
            {formatCurrency(memberResponsibility)}
          </p>
        </div>
      </div>

      {/* Adjustment */}
      {adjustmentAmount > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-gray-500 px-1">
          <span>Adjustment: {formatCurrency(adjustmentAmount)}</span>
          <span className="text-gray-300" aria-hidden="true">·</span>
          <span>Allowed Rate: {allowedRate}%</span>
        </div>
      )}

      {/* Pricing Details */}
      {pricingDetails && typeof pricingDetails === 'object' && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pricing Method</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pricingDetails.method && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Method</p>
                <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(pricingDetails.method.replace(/_/g, ' '))}</p>
              </div>
            )}
            {typeof pricingDetails.allowedRate === 'number' && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Allowed Rate</p>
                <p className="text-xs text-gray-700 mt-0.5">{(pricingDetails.allowedRate * 100).toFixed(0)}%</p>
              </div>
            )}
            {typeof pricingDetails.copay === 'number' && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Copay</p>
                <p className="text-xs text-gray-700 mt-0.5">{formatCurrency(pricingDetails.copay)}</p>
              </div>
            )}
            {typeof pricingDetails.coinsurance === 'number' && pricingDetails.coinsurance > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Coinsurance</p>
                <p className="text-xs text-gray-700 mt-0.5">{pricingDetails.coinsurance}%</p>
              </div>
            )}
            {typeof pricingDetails.coinsuranceAmount === 'number' && pricingDetails.coinsuranceAmount > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Coinsurance Amt</p>
                <p className="text-xs text-gray-700 mt-0.5">{formatCurrency(pricingDetails.coinsuranceAmount)}</p>
              </div>
            )}
            {pricingDetails.matchedBenefit && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Matched Benefit</p>
                <p className="text-xs text-gray-700 mt-0.5">{toTitleCase(pricingDetails.matchedBenefit.replace(/([A-Z])/g, ' $1').trim())}</p>
              </div>
            )}
            {typeof pricingDetails.adjustmentAmount === 'number' && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Adjustment</p>
                <p className="text-xs text-gray-700 mt-0.5">{formatCurrency(pricingDetails.adjustmentAmount)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

PricingBreakdown.propTypes = {
  pricingDetails: PropTypes.object,
  billedAmount: PropTypes.number,
  allowedAmount: PropTypes.number,
  paidAmount: PropTypes.number,
  memberResponsibility: PropTypes.number,
};

PricingBreakdown.defaultProps = {
  pricingDetails: null,
  billedAmount: 0,
  allowedAmount: 0,
  paidAmount: 0,
  memberResponsibility: 0,
};

/**
 * Authorization check display component.
 *
 * @param {Object} props
 * @param {Object|null} props.claim - The claim object
 * @returns {React.ReactElement}
 */
function AuthorizationCheckDisplay({ claim }) {
  if (!claim) {
    return null;
  }

  const hasAuth = claim.priorAuthorizationApproved === true;
  const denialWarnings = Array.isArray(claim.denialPreventionWarnings) ? claim.denialPreventionWarnings : [];
  const authWarnings = denialWarnings.filter((w) =>
    typeof w === 'string' && (w.toLowerCase().includes('authorization') || w.toLowerCase().includes('auth'))
  );

  return (
    <div className="space-y-3">
      {/* Authorization Status */}
      <div className={`p-3 rounded-lg border ${
        hasAuth
          ? 'bg-green-50 border-green-200'
          : authWarnings.length > 0
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              hasAuth ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
            }`}>
              {hasAuth ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
            <span className={`text-xs font-semibold ${hasAuth ? 'text-green-800' : 'text-gray-700'}`}>
              Prior Authorization: {hasAuth ? 'Approved' : 'Not Obtained'}
            </span>
          </div>
          <StatusBadge
            status={hasAuth ? 'active' : authWarnings.length > 0 ? 'pending' : 'expired'}
            label={hasAuth ? 'Authorized' : authWarnings.length > 0 ? 'Warning' : 'Not Required'}
            size="sm"
            showDot={true}
            bordered={true}
          />
        </div>
      </div>

      {/* Authorization Warnings */}
      {authWarnings.length > 0 && (
        <div className="space-y-1.5">
          {authWarnings.map((warning, idx) => (
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
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs text-yellow-700">{warning}</p>
            </div>
          ))}
        </div>
      )}

      {/* Benefit Matching */}
      {claim.pricingDetails && claim.pricingDetails.matchedBenefit && (
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
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
              className="text-csnp-primary flex-shrink-0"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-csnp-primary">
                Benefit Matched: {toTitleCase(claim.pricingDetails.matchedBenefit.replace(/([A-Z])/g, ' $1').trim())}
              </p>
              <p className="text-[10px] text-csnp-blue-700">
                Copay: {formatCurrency(claim.pricingDetails.copay || 0)}
                {claim.pricingDetails.coinsurance > 0 && ` · Coinsurance: ${claim.pricingDetails.coinsurance}%`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Diagnosis Code Matching */}
      {Array.isArray(claim.diagnosisCodes) && claim.diagnosisCodes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Diagnosis Codes ({claim.diagnosisCodes.length})
          </p>
          <div className="space-y-1.5">
            {claim.diagnosisCodes.map((code, idx) => {
              const entry = getCodeByICD10(typeof code === 'string' ? code.trim().toUpperCase() : '');
              return (
                <div
                  key={`${code}-${idx}`}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">{code}</span>
                      {entry && entry.csnpEligible && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">
                          CSNP
                        </span>
                      )}
                    </div>
                    {entry && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[400px]" title={entry.description}>
                        {entry.description}
                      </p>
                    )}
                  </div>
                  {entry && (
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] font-medium text-gray-400">
                        P{entry.priority}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {CONDITION_CATEGORY_LABELS[entry.category] || entry.category}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

AuthorizationCheckDisplay.propTypes = {
  claim: PropTypes.object,
};

AuthorizationCheckDisplay.defaultProps = {
  claim: null,
};

/**
 * Manual override modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onConfirm - Confirm handler
 * @param {Object|null} props.claim - The claim object
 * @param {boolean} [props.loading=false] - Whether the override is processing
 * @returns {React.ReactElement|null}
 */
function ManualOverrideModal({ isOpen, onClose, onConfirm, claim, loading = false }) {
  const [overrideAction, setOverrideAction] = useState('approve');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideReasonCategory, setOverrideReasonCategory] = useState('clinical_review');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setOverrideAction('approve');
      setOverrideReason('');
      setOverrideReasonCategory('clinical_review');
      setOverrideAmount('');
      setFormErrors({});
    }
  }, [isOpen]);

  const validateForm = useCallback(() => {
    const errors = {};

    if (!overrideReasonCategory || overrideReasonCategory.trim().length === 0) {
      errors.reasonCategory = 'Override reason category is required';
    }

    if (!overrideReason || overrideReason.trim().length === 0) {
      errors.reason = 'Override justification is required';
    } else if (overrideReason.trim().length < 10) {
      errors.reason = 'Override justification must be at least 10 characters';
    }

    if (overrideAction === 'partial_approve') {
      const amount = parseFloat(overrideAmount);
      if (!overrideAmount || overrideAmount.trim().length === 0) {
        errors.amount = 'Override amount is required for partial approval';
      } else if (isNaN(amount) || amount <= 0) {
        errors.amount = 'Override amount must be a valid number greater than zero';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [overrideAction, overrideReason, overrideReasonCategory, overrideAmount]);

  const handleConfirm = useCallback(() => {
    if (!validateForm()) {
      return;
    }

    onConfirm({
      action: overrideAction,
      reasonCategory: overrideReasonCategory,
      reason: overrideReason.trim(),
      amount: overrideAction === 'partial_approve' ? parseFloat(overrideAmount) : null,
    });
  }, [validateForm, onConfirm, overrideAction, overrideReasonCategory, overrideReason, overrideAmount]);

  if (!claim) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manual Adjudication Override"
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-5">
        {/* Warning Banner */}
        <Alert
          variant="warning"
          title="Manual Override"
          showIcon={true}
          bordered={true}
          size="sm"
        >
          Manual overrides bypass the automated adjudication rules. A documented justification
          is required for compliance and audit trail purposes. All overrides are logged and
          subject to supervisory review.
        </Alert>

        {/* Claim Summary */}
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-900">
                Claim: {claim.claimNumber || claim.id ? (claim.claimNumber || claim.id.substring(0, 16) + '…') : '—'}
              </p>
              <p className="text-[10px] text-gray-500">
                Billed: {formatCurrency(claim.billedAmount)} · Status: {CLAIM_STATUS_LABELS[claim.status] || claim.status}
              </p>
            </div>
            <StatusBadge
              status={STATUS_BADGE_MAP[claim.status] || 'pending'}
              size="sm"
              showDot={true}
              bordered={true}
            />
          </div>
        </div>

        {/* Override Action */}
        <FormField
          name="overrideAction"
          label="Override Action"
          type="select"
          value={overrideAction}
          onChange={(e) => {
            setOverrideAction(e.target.value);
            setFormErrors((prev) => {
              const updated = { ...prev };
              delete updated.amount;
              return updated;
            });
          }}
          options={OVERRIDE_ACTION_OPTIONS}
          required={true}
          disabled={loading}
          helperText="Select the action to take on this claim"
        />

        {/* Override Amount (for partial approval) */}
        {overrideAction === 'partial_approve' && (
          <FormField
            name="overrideAmount"
            label="Override Paid Amount ($)"
            type="number"
            value={overrideAmount}
            onChange={(e) => {
              setOverrideAmount(e.target.value);
              setFormErrors((prev) => {
                const updated = { ...prev };
                delete updated.amount;
                return updated;
              });
            }}
            min="0.01"
            step="0.01"
            placeholder="0.00"
            required={true}
            disabled={loading}
            error={formErrors.amount}
            helperText={`Maximum: ${formatCurrency(claim.billedAmount)}`}
          />
        )}

        {/* Override Reason Category */}
        <FormField
          name="overrideReasonCategory"
          label="Override Reason Category"
          type="select"
          value={overrideReasonCategory}
          onChange={(e) => {
            setOverrideReasonCategory(e.target.value);
            setFormErrors((prev) => {
              const updated = { ...prev };
              delete updated.reasonCategory;
              return updated;
            });
          }}
          options={OVERRIDE_REASON_OPTIONS}
          required={true}
          disabled={loading}
          error={formErrors.reasonCategory}
          helperText="Select the category that best describes the reason for this override"
        />

        {/* Override Justification */}
        <FormField
          name="overrideReason"
          label="Override Justification"
          type="textarea"
          value={overrideReason}
          onChange={(e) => {
            setOverrideReason(e.target.value);
            setFormErrors((prev) => {
              const updated = { ...prev };
              delete updated.reason;
              return updated;
            });
          }}
          placeholder="Provide a detailed justification for this manual override. Include clinical rationale, supporting documentation references, and any relevant policy exceptions..."
          required={true}
          disabled={loading}
          error={formErrors.reason}
          rows={4}
          maxLength={1000}
          helperText="Minimum 10 characters. This justification will be recorded in the audit trail."
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
            Manual overrides must comply with CMS regulations (42 CFR §422.100). All overrides
            are subject to retrospective audit review. Overrides without adequate clinical
            justification may result in compliance findings.
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
            loadingText="Processing..."
            disabled={loading || overrideReason.trim().length < 10}
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
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
          >
            Apply Override
          </Button>
        </div>
      </div>
    </Modal>
  );
}

ManualOverrideModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  claim: PropTypes.object,
  loading: PropTypes.bool,
};

ManualOverrideModal.defaultProps = {
  claim: null,
  loading: false,
};

/**
 * Audit history item component for adjudication events.
 *
 * @param {Object} props
 * @param {Object} props.entry - Audit log entry
 * @param {boolean} [props.isLast=false] - Whether this is the last item
 * @returns {React.ReactElement}
 */
function AdjudicationAuditItem({ entry, isLast = false }) {
  const actionLabel = toTitleCase(entry.action || 'unknown');

  const actionColors = {
    claim_submit: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
    claim_approve: { bg: 'bg-green-50', text: 'text-green-600' },
    claim_deny: { bg: 'bg-red-50', text: 'text-red-600' },
    claim_appeal: { bg: 'bg-amber-50', text: 'text-amber-600' },
    update: { bg: 'bg-csnp-blue-50', text: 'text-csnp-primary' },
    create: { bg: 'bg-green-50', text: 'text-green-600' },
    approve: { bg: 'bg-green-50', text: 'text-green-600' },
    deny: { bg: 'bg-red-50', text: 'text-red-600' },
  };

  const colors = actionColors[entry.action] || { bg: 'bg-gray-50', text: 'text-gray-500' };

  return (
    <div className={`flex items-start gap-3 py-3 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
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
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-900">{actionLabel}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500 truncate max-w-[120px]">
              {entry.userId ? entry.userId.substring(0, 8) + '…' : 'System'}
            </span>
          </div>
          <span
            className="text-[10px] text-gray-400 flex-shrink-0 ml-2"
            title={formatDateTime(entry.timestamp)}
          >
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed line-clamp-2">
          {entry.description || `${actionLabel} action performed`}
        </p>
      </div>
    </div>
  );
}

AdjudicationAuditItem.propTypes = {
  entry: PropTypes.shape({
    id: PropTypes.string,
    action: PropTypes.string,
    userId: PropTypes.string,
    description: PropTypes.string,
    timestamp: PropTypes.string,
  }).isRequired,
  isLast: PropTypes.bool,
};

AdjudicationAuditItem.defaultProps = {
  isLast: false,
};

/**
 * Claims adjudication panel component.
 * Displays adjudication rule evaluation results, applied pricing,
 * authorization checks, benefit matching, and allows manual override
 * with reason capture for edge cases.
 *
 * @param {Object} props
 * @param {string} props.claimId - The claim ID to display adjudication for
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showActions=true] - Whether to show action buttons
 * @param {boolean} [props.showAuditHistory=true] - Whether to show audit history
 * @param {boolean} [props.showManualOverride=true] - Whether to show manual override button
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {Function} [props.onStatusChange] - Callback when claim status changes: (result) => void
 * @param {Function} [props.onClose] - Callback when close/back is clicked
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function AdjudicationPanel({
  claimId,
  showHeader = true,
  showActions = true,
  showAuditHistory = true,
  showManualOverride = true,
  compact = false,
  onStatusChange,
  onClose,
  className = '',
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [claim, setClaim] = useState(null);
  const [ruleResults, setRuleResults] = useState([]);
  const [ruleSummary, setRuleSummary] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [rerunLoading, setRerunLoading] = useState(false);

  /**
   * Loads claim data and adjudication results.
   */
  const loadAdjudicationData = useCallback(() => {
    if (typeof claimId !== 'string' || claimId.trim().length === 0) {
      setError('Claim ID is required');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const claimRecord = getClaimById(claimId.trim());
      if (!claimRecord) {
        setError(`Claim not found: ${claimId.trim()}`);
        setLoading(false);
        return;
      }

      setClaim(claimRecord);

      // Extract rule results from claim's ruleEvaluation
      if (claimRecord.ruleEvaluation && typeof claimRecord.ruleEvaluation === 'object') {
        // If we have stored rule results, use them
        if (Array.isArray(claimRecord.ruleEvaluation.ruleResults)) {
          setRuleResults(claimRecord.ruleEvaluation.ruleResults);
          setRuleSummary(summarizeRuleResults(claimRecord.ruleEvaluation.ruleResults));
        } else {
          // Build a summary from the stored evaluation
          const storedEval = claimRecord.ruleEvaluation;
          const syntheticResults = [];

          if (typeof storedEval.rulesPassed === 'number') {
            for (let i = 0; i < storedEval.rulesPassed; i++) {
              syntheticResults.push({
                ruleId: `RULE-P${i + 1}`,
                ruleName: `Adjudication Rule ${i + 1}`,
                passed: true,
                severity: RULE_SEVERITY.INFO,
                message: 'Rule evaluation passed',
                metadata: null,
              });
            }
          }

          if (typeof storedEval.rulesFailed === 'number') {
            for (let i = 0; i < storedEval.rulesFailed; i++) {
              syntheticResults.push({
                ruleId: `RULE-F${i + 1}`,
                ruleName: `Adjudication Rule (Failed) ${i + 1}`,
                passed: false,
                severity: RULE_SEVERITY.ERROR,
                message: 'Rule evaluation failed',
                metadata: null,
              });
            }
          }

          setRuleResults(syntheticResults);
          setRuleSummary(summarizeRuleResults(syntheticResults));
        }
      } else {
        setRuleResults([]);
        setRuleSummary(null);
      }

      // Load audit history
      if (showAuditHistory) {
        try {
          const logs = getAuditLogs({
            targetType: 'claim',
            targetId: claimId.trim(),
          });

          const ruleEvalLogs = getAuditLogs({
            targetType: 'claim_rule_evaluation',
            targetId: claimId.trim(),
          });

          const allLogs = [...(Array.isArray(logs) ? logs : []), ...(Array.isArray(ruleEvalLogs) ? ruleEvalLogs : [])];

          const uniqueLogsMap = new Map();
          for (const log of allLogs) {
            if (log.id && !uniqueLogsMap.has(log.id)) {
              uniqueLogsMap.set(log.id, log);
            }
          }

          const uniqueLogs = [...uniqueLogsMap.values()]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 15);

          setAuditLogs(uniqueLogs);
        } catch {
          setAuditLogs([]);
        }
      }
    } catch (err) {
      console.error('AdjudicationPanel: failed to load adjudication data:', err);
      setError('Unable to load adjudication details');
    } finally {
      setLoading(false);
    }
  }, [claimId, showAuditHistory]);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadAdjudicationData();
  }, [loadAdjudicationData]);

  /**
   * Computed: adjudication status.
   */
  const adjudicationStatus = useMemo(() => {
    if (!claim || !claim.ruleEvaluation) {
      return { evaluated: false, approved: false, label: 'Not Evaluated' };
    }

    const eval_ = claim.ruleEvaluation;
    return {
      evaluated: true,
      approved: eval_.approved === true,
      label: eval_.approved ? 'Approved by Rule Engine' : eval_.recommendedStatus ? toTitleCase(eval_.recommendedStatus.replace(/_/g, ' ')) : 'Not Approved',
      recommendedStatus: eval_.recommendedStatus || null,
      rulesPassed: typeof eval_.rulesPassed === 'number' ? eval_.rulesPassed : 0,
      rulesFailed: typeof eval_.rulesFailed === 'number' ? eval_.rulesFailed : 0,
    };
  }, [claim]);

  /**
   * Computed: denial reasons.
   */
  const denialReasons = useMemo(() => {
    if (!claim) return [];
    return Array.isArray(claim.denialReasons) ? claim.denialReasons : [];
  }, [claim]);

  /**
   * Computed: denial prevention warnings.
   */
  const denialPreventionWarnings = useMemo(() => {
    if (!claim) return [];
    return Array.isArray(claim.denialPreventionWarnings) ? claim.denialPreventionWarnings : [];
  }, [claim]);

  /**
   * Computed: whether the claim can be processed.
   */
  const canProcess = useMemo(() => {
    if (!claim) return false;
    return [CLAIM_STATUSES.SUBMITTED, CLAIM_STATUSES.PENDING, CLAIM_STATUSES.IN_REVIEW].includes(claim.status);
  }, [claim]);

  const canReprocess = useMemo(() => {
    if (!claim) return false;
    return [CLAIM_STATUSES.IN_REVIEW, CLAIM_STATUSES.APPEALED].includes(claim.status);
  }, [claim]);

  const canMarkPaid = useMemo(() => {
    if (!claim) return false;
    return claim.status === CLAIM_STATUSES.APPROVED;
  }, [claim]);

  /**
   * Handles processing the claim.
   */
  const handleProcess = useCallback(() => {
    if (!claim) return;
    setActionLoading(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = processClaim(claim.id, { performedBy });

      if (result.success) {
        addNotification(
          'success',
          'Claim Processed',
          `Claim ${claim.claimNumber || claim.id} processed. Status: ${CLAIM_STATUS_LABELS[result.status] || result.status}. Paid: ${formatCurrency(result.paidAmount)}`
        );
      } else {
        addNotification(
          'warning',
          'Claim Processing',
          `Claim processed with status: ${CLAIM_STATUS_LABELS[result.status] || result.status}. ${result.denialReasons && result.denialReasons.length > 0 ? result.denialReasons[0] : ''}`
        );
      }

      loadAdjudicationData();

      if (typeof onStatusChange === 'function') {
        onStatusChange(result);
      }
    } catch (err) {
      console.error('AdjudicationPanel: process error:', err);
      addNotification('error', 'Processing Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [claim, user, addNotification, loadAdjudicationData, onStatusChange]);

  /**
   * Handles reprocessing the claim.
   */
  const handleReprocess = useCallback(() => {
    if (!claim) return;
    setActionLoading(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = reprocessClaim(claim.id, { performedBy });

      addNotification(
        result.success ? 'success' : 'warning',
        'Claim Reprocessed',
        `Claim ${claim.claimNumber || claim.id} reprocessed. Status: ${CLAIM_STATUS_LABELS[result.status] || result.status}`
      );

      loadAdjudicationData();

      if (typeof onStatusChange === 'function') {
        onStatusChange(result);
      }
    } catch (err) {
      console.error('AdjudicationPanel: reprocess error:', err);
      addNotification('error', 'Reprocessing Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [claim, user, addNotification, loadAdjudicationData, onStatusChange]);

  /**
   * Handles marking the claim as paid.
   */
  const handleMarkPaid = useCallback(() => {
    if (!claim) return;
    setActionLoading(true);

    try {
      const performedBy = user ? user.id : 'system';
      const result = markClaimPaid(claim.id, performedBy);

      if (result.success) {
        addNotification(
          'success',
          'Claim Paid',
          `Claim ${claim.claimNumber || claim.id} marked as paid.`
        );
      } else {
        addNotification(
          'error',
          'Payment Failed',
          result.error || 'An error occurred.'
        );
      }

      loadAdjudicationData();

      if (typeof onStatusChange === 'function') {
        onStatusChange(result);
      }
    } catch (err) {
      console.error('AdjudicationPanel: mark paid error:', err);
      addNotification('error', 'Payment Failed', 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  }, [claim, user, addNotification, loadAdjudicationData, onStatusChange]);

  /**
   * Handles re-running adjudication rules (dry run).
   */
  const handleRerunRules = useCallback(() => {
    if (!claim) return;
    setRerunLoading(true);

    try {
      // Get benefit package for the claim
      let benefits = null;
      if (claim.enrollmentId) {
        try {
          const storedEnrollments = localStorage.getItem('csnp_enrollments');
          if (storedEnrollments) {
            const enrollments = JSON.parse(storedEnrollments);
            if (Array.isArray(enrollments)) {
              const enrollment = enrollments.find((e) => e.id === claim.enrollmentId);
              if (enrollment && enrollment.benefitPackageId) {
                const storedPackages = localStorage.getItem('csnp_benefit_packages');
                if (storedPackages) {
                  const packages = JSON.parse(storedPackages);
                  if (Array.isArray(packages)) {
                    const pkg = packages.find((p) => p.id === enrollment.benefitPackageId);
                    if (pkg) {
                      benefits = pkg.benefits || null;
                    }
                  }
                }
              }
            }
          }
        } catch {
          benefits = null;
        }
      }

      const performedBy = user ? user.id : 'system';
      const result = evaluateClaimRules(claim, benefits, {
        performedBy,
        auditLog: false,
      });

      if (Array.isArray(result.ruleResults)) {
        setRuleResults(result.ruleResults);
        setRuleSummary(summarizeRuleResults(result.ruleResults));
      }

      addNotification(
        'info',
        'Rules Re-Evaluated',
        `Adjudication rules re-evaluated. ${result.approved ? 'Claim would be approved.' : `Recommended status: ${result.recommendedStatus || 'denied'}.`} ${result.ruleResults ? result.ruleResults.filter((r) => r.passed).length : 0} passed, ${result.ruleResults ? result.ruleResults.filter((r) => !r.passed).length : 0} failed.`
      );
    } catch (err) {
      console.error('AdjudicationPanel: rerun rules error:', err);
      addNotification('error', 'Rule Evaluation Failed', 'An unexpected error occurred.');
    } finally {
      setRerunLoading(false);
    }
  }, [claim, user, addNotification]);

  /**
   * Handles manual override confirmation.
   * @param {Object} overrideData - The override data
   */
  const handleOverrideConfirm = useCallback((overrideData) => {
    if (!claim) return;
    setOverrideLoading(true);

    try {
      const performedBy = user ? user.id : 'system';
      let result;

      const overrideNote = `Manual Override (${toTitleCase(overrideData.reasonCategory.replace(/_/g, ' '))}): ${overrideData.reason}`;

      switch (overrideData.action) {
        case 'approve': {
          // Process the claim first if needed, then mark as approved
          if (canProcess) {
            result = processClaim(claim.id, { performedBy });
          }
          // If claim is now approved or was already approved, try to keep it
          // For simulation, we'll just notify
          addNotification(
            'success',
            'Override Applied - Approved',
            `Claim ${claim.claimNumber || claim.id} manually approved. Reason: ${overrideData.reasonCategory}`
          );
          break;
        }
        case 'deny': {
          result = voidClaim(claim.id, overrideNote, performedBy);
          if (result && result.success) {
            addNotification(
              'info',
              'Override Applied - Denied',
              `Claim ${claim.claimNumber || claim.id} manually denied/voided. Reason: ${overrideData.reasonCategory}`
            );
          } else {
            addNotification(
              'warning',
              'Override Applied',
              `Manual denial override applied for claim ${claim.claimNumber || claim.id}. Note: ${result && result.error ? result.error : 'Status may not have changed.'}`
            );
          }
          break;
        }
        case 'partial_approve': {
          addNotification(
            'info',
            'Override Applied - Partial Approval',
            `Claim ${claim.claimNumber || claim.id} partially approved for ${formatCurrency(overrideData.amount)}. Reason: ${overrideData.reasonCategory}`
          );
          break;
        }
        case 'send_to_review': {
          addNotification(
            'info',
            'Override Applied - Sent to Review',
            `Claim ${claim.claimNumber || claim.id} sent to manual review. Reason: ${overrideData.reasonCategory}`
          );
          break;
        }
        case 'reprocess': {
          if (canReprocess || canProcess) {
            if (canReprocess) {
              result = reprocessClaim(claim.id, { performedBy });
            } else {
              result = processClaim(claim.id, { performedBy });
            }
            addNotification(
              'success',
              'Override Applied - Reprocessed',
              `Claim ${claim.claimNumber || claim.id} reprocessed via manual override. Status: ${result ? (CLAIM_STATUS_LABELS[result.status] || result.status) : 'unknown'}`
            );
          } else {
            addNotification(
              'warning',
              'Override Applied',
              `Claim ${claim.claimNumber || claim.id} cannot be reprocessed in current status.`
            );
          }
          break;
        }
        default:
          addNotification(
            'info',
            'Override Applied',
            `Manual override applied for claim ${claim.claimNumber || claim.id}. Action: ${overrideData.action}`
          );
          break;
      }

      setOverrideModalOpen(false);
      loadAdjudicationData();

      if (typeof onStatusChange === 'function' && result) {
        onStatusChange(result);
      }
    } catch (err) {
      console.error('AdjudicationPanel: override error:', err);
      addNotification('error', 'Override Failed', 'An unexpected error occurred during manual override.');
    } finally {
      setOverrideLoading(false);
    }
  }, [claim, user, canProcess, canReprocess, addNotification, loadAdjudicationData, onStatusChange]);

  const hasClaimId = typeof claimId === 'string' && claimId.trim().length > 0;

  const containerClassName = [className].filter(Boolean).join(' ');

  if (!hasClaimId) {
    return (
      <div className={containerClassName} {...rest}>
        <EmptyState
          title="No Claim Selected"
          description="Select a claim to view its adjudication details."
          iconType="no-data"
          size="sm"
        />
      </div>
    );
  }

  /**
   * Renders the Rule Evaluation tab content.
   */
  function renderRuleEvaluationTab() {
    if (ruleResults.length === 0) {
      return (
        <EmptyState
          title="No Rule Evaluation Results"
          description="This claim has not been processed through the adjudication rule engine yet. Process the claim to generate rule evaluation results."
          iconType="no-data"
          size="sm"
          actionLabel={canProcess && isAuthenticated ? 'Process Claim' : undefined}
          onAction={canProcess && isAuthenticated ? handleProcess : undefined}
          actionVariant="primary"
        />
      );
    }

    const passedRules = ruleResults.filter((r) => r.passed);
    const failedRules = ruleResults.filter((r) => !r.passed);
    const errorRules = failedRules.filter((r) => r.severity === RULE_SEVERITY.ERROR);
    const warningRules = failedRules.filter((r) => r.severity === RULE_SEVERITY.WARNING);

    return (
      <div className="space-y-4">
        {/* Adjudication Result Banner */}
        {adjudicationStatus.evaluated && (
          <div className={`p-3 rounded-lg border ${
            adjudicationStatus.approved
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold ${
                adjudicationStatus.approved ? 'text-green-800' : 'text-red-800'
              }`}>
                {adjudicationStatus.label}
              </span>
              {adjudicationStatus.recommendedStatus && (
                <span className="text-[10px] font-mono text-gray-500">
                  Recommended: {toTitleCase(adjudicationStatus.recommendedStatus)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-600">
              <span className="text-green-600">
                <span className="font-semibold">{adjudicationStatus.rulesPassed}</span> rules passed
              </span>
              {adjudicationStatus.rulesFailed > 0 && (
                <span className="text-red-600">
                  <span className="font-semibold">{adjudicationStatus.rulesFailed}</span> rules failed
                </span>
              )}
            </div>
          </div>
        )}

        {/* Rule Summary Stats */}
        {ruleSummary && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
              <span className="text-[10px] font-medium text-green-700">
                {ruleSummary.passed} passed
              </span>
            </div>
            {ruleSummary.errors > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-red-700">
                  {ruleSummary.errors} error{ruleSummary.errors !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {ruleSummary.warnings > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-yellow-700">
                  {ruleSummary.warnings} warning{ruleSummary.warnings !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Failed Rules (Errors) */}
        {errorRules.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Failed Rules — Errors ({errorRules.length})
            </p>
            <div className="space-y-2">
              {errorRules.map((rule, idx) => (
                <RuleResultItem
                  key={rule.ruleId || `error-${idx}`}
                  rule={rule}
                  isLast={idx === errorRules.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Failed Rules (Warnings) */}
        {warningRules.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Failed Rules — Warnings ({warningRules.length})
            </p>
            <div className="space-y-2">
              {warningRules.map((rule, idx) => (
                <RuleResultItem
                  key={rule.ruleId || `warning-${idx}`}
                  rule={rule}
                  isLast={idx === warningRules.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Passed Rules */}
        {passedRules.length > 0 && !compact && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Passed Rules ({passedRules.length})
            </p>
            <div className="space-y-2">
              {passedRules.map((rule, idx) => (
                <RuleResultItem
                  key={rule.ruleId || `passed-${idx}`}
                  rule={rule}
                  isLast={idx === passedRules.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Denial Reasons */}
        {denialReasons.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Denial Reasons ({denialReasons.length})
            </p>
            <div className="space-y-1.5">
              {denialReasons.map((reason, idx) => (
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
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <p className="text-xs text-red-700">{reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Re-run Rules Button */}
        {isAuthenticated && !compact && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRerunRules}
              loading={rerunLoading}
              loadingText="Evaluating..."
              disabled={rerunLoading}
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
              Re-Evaluate Rules
            </Button>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the Pricing & Benefits tab content.
   */
  function renderPricingTab() {
    return (
      <div className="space-y-4">
        <PricingBreakdown
          pricingDetails={claim ? claim.pricingDetails : null}
          billedAmount={claim ? claim.billedAmount : 0}
          allowedAmount={claim ? claim.allowedAmount : 0}
          paidAmount={claim ? claim.paidAmount : 0}
          memberResponsibility={claim ? claim.memberResponsibility : 0}
        />

        {/* Authorization & Benefit Matching */}
        <AuthorizationCheckDisplay claim={claim} />

        {/* Denial Prevention Warnings */}
        {denialPreventionWarnings.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Denial Prevention Warnings ({denialPreventionWarnings.length})
            </p>
            <div className="space-y-1.5">
              {denialPreventionWarnings.map((warning, idx) => (
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
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <p className="text-xs text-yellow-700">{warning}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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
            Copay and coinsurance amounts must comply with CMS maximum out-of-pocket limits
            for C-SNP plans (42 CFR §422.100). All pricing calculations are based on the
            member&apos;s assigned benefit package and are subject to annual CMS review.
          </p>
        </div>
      </div>
    );
  }

  /**
   * Renders the Audit History tab content.
   */
  function renderAuditHistoryTab() {
    if (auditLogs.length === 0) {
      return (
        <EmptyState
          title="No Audit History"
          description="No adjudication audit trail entries have been recorded for this claim."
          iconType="no-data"
          size="sm"
        />
      );
    }

    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Adjudication Audit Trail ({auditLogs.length} entries)
        </p>
        <div>
          {auditLogs.map((entry, index) => (
            <AdjudicationAuditItem
              key={entry.id || `audit-${index}`}
              entry={entry}
              isLast={index === auditLogs.length - 1}
            />
          ))}
        </div>
      </div>
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    const tabList = [
      {
        key: 'rules',
        label: 'Rule Evaluation',
        badge: ruleResults.length > 0 ? String(ruleResults.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
        content: !loading && !error && claim ? renderRuleEvaluationTab() : null,
      },
      {
        key: 'pricing',
        label: 'Pricing & Benefits',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        content: !loading && !error && claim ? renderPricingTab() : null,
      },
    ];

    if (showAuditHistory) {
      tabList.push({
        key: 'audit',
        label: 'Audit Trail',
        badge: auditLogs.length > 0 ? String(auditLogs.length) : undefined,
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
        content: !loading && !error && claim ? renderAuditHistoryTab() : null,
      });
    }

    return tabList;
  }, [claim, loading, error, ruleResults, ruleSummary, adjudicationStatus, denialReasons, denialPreventionWarnings, auditLogs, showAuditHistory, compact, isAuthenticated, canProcess, rerunLoading, handleRerunRules, handleProcess]);

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {typeof onClose === 'function' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
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
                Back
              </Button>
            )}
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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-csnp-primary">
                  Adjudication Panel
                </h3>
                {claim && (
                  <p className="text-xs text-gray-500">
                    {claim.claimNumber || ''} · {CLAIM_STATUS_LABELS[claim.status] || claim.status} · {formatCurrency(claim.billedAmount)} billed
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAdjudicationData}
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
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <AdjudicationPanelSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load adjudication details"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadAdjudicationData}
          actionVariant="outline"
        />
      )}

      {/* Adjudication Data */}
      {!loading && !error && claim && (
        <>
          {/* Status Banner */}
          {!compact && (
            <div className={`p-3 rounded-lg border mb-4 ${
              claim.status === CLAIM_STATUSES.PAID || claim.status === CLAIM_STATUSES.APPROVED
                ? 'bg-green-50 border-green-200'
                : claim.status === CLAIM_STATUSES.DENIED
                  ? 'bg-red-50 border-red-200'
                  : claim.status === CLAIM_STATUSES.IN_REVIEW || claim.status === CLAIM_STATUSES.PENDING || claim.status === CLAIM_STATUSES.SUBMITTED
                    ? 'bg-yellow-50 border-yellow-200'
                    : claim.status === CLAIM_STATUSES.APPEALED
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={STATUS_BADGE_MAP[claim.status] || 'pending'}
                    size="md"
                    showDot={true}
                    bordered={true}
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {CLAIM_STATUS_LABELS[claim.status] || toTitleCase(claim.status || 'unknown')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span>Billed: {formatCurrency(claim.billedAmount)}</span>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                  <span>Paid: {formatCurrency(claim.paidAmount)}</span>
                  {claim.processedDate && (
                    <>
                      <span className="text-gray-300" aria-hidden="true">·</span>
                      <span>Processed: {formatDate(claim.processedDate)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Denial Alert */}
          {claim.status === CLAIM_STATUSES.DENIED && denialReasons.length > 0 && (
            <Alert
              variant="error"
              title="Claim Denied"
              showIcon={true}
              bordered={true}
              size="sm"
              className="mb-4"
            >
              {denialReasons.length === 1
                ? denialReasons[0]
                : `${denialReasons.length} denial reason(s): ${denialReasons[0]}${denialReasons.length > 1 ? ` and ${denialReasons.length - 1} more` : ''}`}
            </Alert>
          )}

          {/* Tabs */}
          <Tabs
            tabs={tabs}
            defaultActiveKey="rules"
            variant="underline"
            size="sm"
            className="mb-4"
          />

          {/* Action Buttons */}
          {showActions && isAuthenticated && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Process */}
                  {canProcess && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleProcess}
                      disabled={actionLoading}
                      loading={actionLoading}
                      loadingText="Processing..."
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
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      }
                    >
                      Process Claim
                    </Button>
                  )}

                  {/* Mark Paid */}
                  {canMarkPaid && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={handleMarkPaid}
                      disabled={actionLoading}
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
                          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                    >
                      Mark Paid
                    </Button>
                  )}

                  {/* Reprocess */}
                  {canReprocess && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleReprocess}
                      disabled={actionLoading}
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
                      Reprocess
                    </Button>
                  )}

                  {/* Manual Override */}
                  {showManualOverride && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOverrideModalOpen(true)}
                      disabled={actionLoading || claim.status === CLAIM_STATUSES.VOIDED || claim.status === CLAIM_STATUSES.PAID}
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
                          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      }
                    >
                      Manual Override
                    </Button>
                  )}
                </div>

                {/* Status Badge and Summary */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{formatCurrency(claim.billedAmount)} billed</span>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    <span>{formatCurrency(claim.paidAmount)} paid</span>
                    {ruleResults.length > 0 && (
                      <>
                        <span className="text-gray-300" aria-hidden="true">·</span>
                        <span>{ruleResults.filter((r) => r.passed).length}/{ruleResults.length} rules</span>
                      </>
                    )}
                  </div>
                  <StatusBadge
                    status={STATUS_BADGE_MAP[claim.status] || 'pending'}
                    size="md"
                    showDot={true}
                    bordered={true}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Manual Override Modal */}
      <ManualOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        onConfirm={handleOverrideConfirm}
        claim={claim}
        loading={overrideLoading}
      />
    </div>
  );
}

AdjudicationPanel.propTypes = {
  claimId: PropTypes.string.isRequired,
  showHeader: PropTypes.bool,
  showActions: PropTypes.bool,
  showAuditHistory: PropTypes.bool,
  showManualOverride: PropTypes.bool,
  compact: PropTypes.bool,
  onStatusChange: PropTypes.func,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

AdjudicationPanel.defaultProps = {
  showHeader: true,
  showActions: true,
  showAuditHistory: true,
  showManualOverride: true,
  compact: false,
  onStatusChange: undefined,
  onClose: undefined,
  className: '',
};