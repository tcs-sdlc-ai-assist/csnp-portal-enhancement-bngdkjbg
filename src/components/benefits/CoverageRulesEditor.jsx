import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import FormField from '../common/FormField.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Modal from '../common/Modal.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import { toTitleCase, formatDate } from '../../utils/helpers.js';
import {
  CONDITION_CATEGORIES,
  CONDITION_CATEGORY_LABELS,
} from '../../data/icd10Data.js';

/**
 * Rule types for coverage rules.
 * @enum {string}
 */
const RULE_TYPES = Object.freeze({
  CONDITION_BASED: 'condition_based',
  DATE_BASED: 'date_based',
  PRIORITY_BASED: 'priority_based',
  SERVICE_BASED: 'service_based',
  COST_BASED: 'cost_based',
});

/**
 * Labels for rule types.
 * @type {Object.<string, string>}
 */
const RULE_TYPE_LABELS = Object.freeze({
  [RULE_TYPES.CONDITION_BASED]: 'Condition-Based Rule',
  [RULE_TYPES.DATE_BASED]: 'Date-Based Rule',
  [RULE_TYPES.PRIORITY_BASED]: 'Priority-Based Rule',
  [RULE_TYPES.SERVICE_BASED]: 'Service-Based Rule',
  [RULE_TYPES.COST_BASED]: 'Cost-Based Rule',
});

/**
 * Rule type options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const RULE_TYPE_OPTIONS = Object.entries(RULE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Rule actions for coverage rules.
 * @enum {string}
 */
const RULE_ACTIONS = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  REQUIRE_AUTH: 'require_authorization',
  LIMIT: 'limit',
  WAIVE_COST: 'waive_cost_sharing',
  APPLY_COPAY: 'apply_copay',
  APPLY_COINSURANCE: 'apply_coinsurance',
});

/**
 * Labels for rule actions.
 * @type {Object.<string, string>}
 */
const RULE_ACTION_LABELS = Object.freeze({
  [RULE_ACTIONS.ALLOW]: 'Allow Coverage',
  [RULE_ACTIONS.DENY]: 'Deny Coverage',
  [RULE_ACTIONS.REQUIRE_AUTH]: 'Require Prior Authorization',
  [RULE_ACTIONS.LIMIT]: 'Apply Limit',
  [RULE_ACTIONS.WAIVE_COST]: 'Waive Cost Sharing',
  [RULE_ACTIONS.APPLY_COPAY]: 'Apply Copay',
  [RULE_ACTIONS.APPLY_COINSURANCE]: 'Apply Coinsurance',
});

/**
 * Rule action options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const RULE_ACTION_OPTIONS = Object.entries(RULE_ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Condition category options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const CONDITION_CATEGORY_OPTIONS = Object.entries(CONDITION_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Comparison operators for rules.
 * @type {{ value: string, label: string }[]}
 */
const COMPARISON_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'greater_or_equal', label: 'Greater Than or Equal' },
  { value: 'less_or_equal', label: 'Less Than or Equal' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
  { value: 'between', label: 'Between' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
];

/**
 * Priority level options.
 * @type {{ value: string, label: string }[]}
 */
const PRIORITY_OPTIONS = [
  { value: '1', label: 'Priority 1 (Highest)' },
  { value: '2', label: 'Priority 2 (High)' },
  { value: '3', label: 'Priority 3 (Medium)' },
  { value: '4', label: 'Priority 4 (Low)' },
  { value: '5', label: 'Priority 5 (Lowest)' },
];

/**
 * Rule status options.
 * @type {{ value: string, label: string }[]}
 */
const RULE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'draft', label: 'Draft' },
];

/**
 * Service type options for service-based rules.
 * @type {{ value: string, label: string }[]}
 */
const SERVICE_TYPE_OPTIONS = [
  { value: 'primaryCare', label: 'Primary Care Visit' },
  { value: 'specialistVisit', label: 'Specialist Visit' },
  { value: 'emergencyRoom', label: 'Emergency Room' },
  { value: 'inpatientHospital', label: 'Inpatient Hospital' },
  { value: 'prescriptionDrugTier1', label: 'Rx Tier 1 (Preferred Generic)' },
  { value: 'prescriptionDrugTier2', label: 'Rx Tier 2 (Generic)' },
  { value: 'prescriptionDrugTier3', label: 'Rx Tier 3 (Preferred Brand)' },
  { value: 'homeHealth', label: 'Home Health Services' },
  { value: 'telehealth', label: 'Telehealth Visits' },
  { value: 'dialysis', label: 'Dialysis Services' },
  { value: 'cardiacRehab', label: 'Cardiac Rehabilitation' },
  { value: 'pulmonaryRehab', label: 'Pulmonary Rehabilitation' },
  { value: 'mentalHealth', label: 'Mental Health Services' },
  { value: 'occupationalTherapy', label: 'Occupational Therapy' },
  { value: 'speechTherapy', label: 'Speech Therapy' },
  { value: 'chemotherapy', label: 'Chemotherapy' },
  { value: 'oxygenEquipment', label: 'Oxygen Equipment' },
  { value: 'adultDayCare', label: 'Adult Day Care' },
];

/**
 * Default empty rule object.
 * @returns {Object} A new empty rule object
 */
function createEmptyRule() {
  return {
    id: '',
    name: '',
    description: '',
    ruleType: RULE_TYPES.CONDITION_BASED,
    action: RULE_ACTIONS.ALLOW,
    status: 'active',
    priority: 3,
    conditionCategory: '',
    operator: 'equals',
    value: '',
    valueSecondary: '',
    serviceType: '',
    effectiveDate: '',
    terminationDate: '',
    copayAmount: 0,
    coinsurancePercent: 0,
    limitValue: '',
    limitUnit: 'per_year',
    notes: '',
  };
}

/**
 * Limit unit options.
 * @type {{ value: string, label: string }[]}
 */
const LIMIT_UNIT_OPTIONS = [
  { value: 'per_visit', label: 'Per Visit' },
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_month', label: 'Per Month' },
  { value: 'per_year', label: 'Per Year' },
  { value: 'lifetime', label: 'Lifetime' },
];

/**
 * Rule type to icon color mapping.
 * @type {Object.<string, { bg: string, text: string }>}
 */
const RULE_TYPE_COLORS = {
  [RULE_TYPES.CONDITION_BASED]: { bg: 'bg-green-50', text: 'text-green-600' },
  [RULE_TYPES.DATE_BASED]: { bg: 'bg-blue-50', text: 'text-blue-600' },
  [RULE_TYPES.PRIORITY_BASED]: { bg: 'bg-purple-50', text: 'text-purple-600' },
  [RULE_TYPES.SERVICE_BASED]: { bg: 'bg-orange-50', text: 'text-orange-600' },
  [RULE_TYPES.COST_BASED]: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
};

/**
 * Default rule type color.
 * @type {{ bg: string, text: string }}
 */
const DEFAULT_RULE_TYPE_COLOR = { bg: 'bg-gray-50', text: 'text-gray-500' };

/**
 * Action to badge status mapping.
 * @type {Object.<string, string>}
 */
const ACTION_BADGE_MAP = {
  [RULE_ACTIONS.ALLOW]: 'active',
  [RULE_ACTIONS.DENY]: 'denied',
  [RULE_ACTIONS.REQUIRE_AUTH]: 'pending',
  [RULE_ACTIONS.LIMIT]: 'minor_issues',
  [RULE_ACTIONS.WAIVE_COST]: 'eligible',
  [RULE_ACTIONS.APPLY_COPAY]: 'processing',
  [RULE_ACTIONS.APPLY_COINSURANCE]: 'processing',
};

/**
 * Validates a coverage rule object.
 * @param {Object} rule - The rule to validate
 * @returns {{ valid: boolean, errors: Object.<string, string> }}
 */
function validateRule(rule) {
  const errors = {};

  if (!rule || typeof rule !== 'object') {
    return { valid: false, errors: { _form: 'Rule data is required' } };
  }

  if (typeof rule.name !== 'string' || rule.name.trim().length === 0) {
    errors.name = 'Rule name is required';
  } else if (rule.name.trim().length < 3) {
    errors.name = 'Rule name must be at least 3 characters';
  }

  if (typeof rule.description !== 'string' || rule.description.trim().length === 0) {
    errors.description = 'Description is required';
  }

  if (!rule.ruleType || !Object.values(RULE_TYPES).includes(rule.ruleType)) {
    errors.ruleType = 'Rule type is required';
  }

  if (!rule.action || !Object.values(RULE_ACTIONS).includes(rule.action)) {
    errors.action = 'Rule action is required';
  }

  // Condition-based rule validation
  if (rule.ruleType === RULE_TYPES.CONDITION_BASED) {
    if (!rule.conditionCategory || rule.conditionCategory.trim().length === 0) {
      errors.conditionCategory = 'Condition category is required for condition-based rules';
    }
  }

  // Date-based rule validation
  if (rule.ruleType === RULE_TYPES.DATE_BASED) {
    if (!rule.effectiveDate || rule.effectiveDate.trim().length === 0) {
      errors.effectiveDate = 'Effective date is required for date-based rules';
    }
    if (!rule.terminationDate || rule.terminationDate.trim().length === 0) {
      errors.terminationDate = 'Termination date is required for date-based rules';
    }
    if (rule.effectiveDate && rule.terminationDate) {
      try {
        const start = new Date(rule.effectiveDate + 'T00:00:00');
        const end = new Date(rule.terminationDate + 'T00:00:00');
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start.getTime() > end.getTime()) {
          errors.terminationDate = 'Termination date must be after effective date';
        }
      } catch {
        // Ignore date parsing errors
      }
    }
  }

  // Priority-based rule validation
  if (rule.ruleType === RULE_TYPES.PRIORITY_BASED) {
    const priorityNum = typeof rule.priority === 'number' ? rule.priority : parseInt(String(rule.priority), 10);
    if (isNaN(priorityNum) || priorityNum < 1 || priorityNum > 5) {
      errors.priority = 'Priority must be between 1 and 5';
    }
  }

  // Service-based rule validation
  if (rule.ruleType === RULE_TYPES.SERVICE_BASED) {
    if (!rule.serviceType || rule.serviceType.trim().length === 0) {
      errors.serviceType = 'Service type is required for service-based rules';
    }
  }

  // Cost-based rule validation
  if (rule.ruleType === RULE_TYPES.COST_BASED) {
    if (rule.action === RULE_ACTIONS.APPLY_COPAY) {
      const copay = typeof rule.copayAmount === 'number' ? rule.copayAmount : parseFloat(String(rule.copayAmount));
      if (isNaN(copay) || copay < 0) {
        errors.copayAmount = 'Copay amount must be a valid non-negative number';
      }
    }
    if (rule.action === RULE_ACTIONS.APPLY_COINSURANCE) {
      const coinsurance = typeof rule.coinsurancePercent === 'number' ? rule.coinsurancePercent : parseFloat(String(rule.coinsurancePercent));
      if (isNaN(coinsurance) || coinsurance < 0 || coinsurance > 100) {
        errors.coinsurancePercent = 'Coinsurance must be between 0 and 100';
      }
    }
  }

  // Limit action validation
  if (rule.action === RULE_ACTIONS.LIMIT) {
    if (!rule.limitValue || rule.limitValue.toString().trim().length === 0) {
      errors.limitValue = 'Limit value is required when action is "Apply Limit"';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Builds a human-readable summary of a rule.
 * @param {Object} rule - The rule object
 * @returns {string} Summary string
 */
function buildRuleSummary(rule) {
  if (!rule || typeof rule !== 'object') {
    return '';
  }

  const parts = [];

  const actionLabel = RULE_ACTION_LABELS[rule.action] || rule.action || 'Unknown action';
  parts.push(actionLabel);

  switch (rule.ruleType) {
    case RULE_TYPES.CONDITION_BASED: {
      const categoryLabel = CONDITION_CATEGORY_LABELS[rule.conditionCategory] || rule.conditionCategory || 'any condition';
      parts.push(`for ${categoryLabel}`);
      break;
    }
    case RULE_TYPES.DATE_BASED: {
      if (rule.effectiveDate && rule.terminationDate) {
        parts.push(`from ${formatDate(rule.effectiveDate)} to ${formatDate(rule.terminationDate)}`);
      } else if (rule.effectiveDate) {
        parts.push(`starting ${formatDate(rule.effectiveDate)}`);
      }
      break;
    }
    case RULE_TYPES.PRIORITY_BASED: {
      parts.push(`for priority ${rule.priority} conditions`);
      break;
    }
    case RULE_TYPES.SERVICE_BASED: {
      const serviceOption = SERVICE_TYPE_OPTIONS.find((o) => o.value === rule.serviceType);
      const serviceLabel = serviceOption ? serviceOption.label : rule.serviceType || 'any service';
      parts.push(`for ${serviceLabel}`);
      break;
    }
    case RULE_TYPES.COST_BASED: {
      if (rule.action === RULE_ACTIONS.APPLY_COPAY) {
        parts.push(`$${rule.copayAmount || 0} copay`);
      } else if (rule.action === RULE_ACTIONS.APPLY_COINSURANCE) {
        parts.push(`${rule.coinsurancePercent || 0}% coinsurance`);
      }
      break;
    }
    default:
      break;
  }

  if (rule.action === RULE_ACTIONS.LIMIT && rule.limitValue) {
    const unitOption = LIMIT_UNIT_OPTIONS.find((o) => o.value === rule.limitUnit);
    const unitLabel = unitOption ? unitOption.label.toLowerCase() : rule.limitUnit || '';
    parts.push(`(limit: ${rule.limitValue} ${unitLabel})`);
  }

  return parts.join(' ');
}

/**
 * Single coverage rule item component.
 *
 * @param {Object} props
 * @param {Object} props.rule - The rule object
 * @param {Function} props.onEdit - Edit handler
 * @param {Function} props.onDelete - Delete handler
 * @param {Function} props.onToggleStatus - Toggle status handler
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function CoverageRuleItem({ rule, onEdit, onDelete, onToggleStatus, disabled = false }) {
  const ruleTypeLabel = RULE_TYPE_LABELS[rule.ruleType] || toTitleCase(rule.ruleType || 'unknown');
  const actionLabel = RULE_ACTION_LABELS[rule.action] || toTitleCase(rule.action || 'unknown');
  const ruleColors = RULE_TYPE_COLORS[rule.ruleType] || DEFAULT_RULE_TYPE_COLOR;
  const actionBadgeStatus = ACTION_BADGE_MAP[rule.action] || 'pending';
  const summary = buildRuleSummary(rule);

  const statusBadgeStatus = rule.status === 'active' ? 'active' : rule.status === 'inactive' ? 'expired' : 'pending';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 ${
      rule.status === 'active'
        ? 'bg-white border-gray-200 hover:border-gray-300'
        : rule.status === 'inactive'
          ? 'bg-gray-50 border-gray-200 opacity-70'
          : 'bg-yellow-50 border-yellow-200'
    }`}>
      {/* Rule Type Icon */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${ruleColors.bg} ${ruleColors.text}`}>
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
          {rule.ruleType === RULE_TYPES.CONDITION_BASED && (
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          )}
          {rule.ruleType === RULE_TYPES.DATE_BASED && (
            <>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </>
          )}
          {rule.ruleType === RULE_TYPES.PRIORITY_BASED && (
            <>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </>
          )}
          {rule.ruleType === RULE_TYPES.SERVICE_BASED && (
            <>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </>
          )}
          {rule.ruleType === RULE_TYPES.COST_BASED && (
            <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
      </div>

      {/* Rule Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-gray-900 truncate max-w-[200px]" title={rule.name}>
            {rule.name || 'Unnamed Rule'}
          </p>
          <StatusBadge
            status={statusBadgeStatus}
            label={toTitleCase(rule.status || 'draft')}
            size="sm"
            showDot={true}
            bordered={false}
          />
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ruleColors.bg} ${ruleColors.text}`}>
            {ruleTypeLabel}
          </span>
        </div>

        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed line-clamp-1" title={summary}>
          {summary}
        </p>

        {rule.description && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[400px]" title={rule.description}>
            {rule.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1">
          <StatusBadge
            status={actionBadgeStatus}
            label={actionLabel}
            size="sm"
            showDot={false}
            bordered={true}
          />
          {rule.ruleType === RULE_TYPES.PRIORITY_BASED && (
            <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
              P{rule.priority}
            </span>
          )}
          {rule.ruleType === RULE_TYPES.CONDITION_BASED && rule.conditionCategory && (
            <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={CONDITION_CATEGORY_LABELS[rule.conditionCategory] || rule.conditionCategory}>
              {CONDITION_CATEGORY_LABELS[rule.conditionCategory] || rule.conditionCategory}
            </span>
          )}
          {rule.ruleType === RULE_TYPES.DATE_BASED && rule.effectiveDate && (
            <span className="text-[10px] text-gray-400">
              {formatDate(rule.effectiveDate)} – {rule.terminationDate ? formatDate(rule.terminationDate) : '∞'}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Toggle Status */}
        {!disabled && (
          <button
            type="button"
            onClick={() => onToggleStatus(rule.id)}
            className={`p-1.5 rounded transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light ${
              rule.status === 'active'
                ? 'text-green-500 hover:bg-green-50 hover:text-green-700'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
            aria-label={rule.status === 'active' ? `Deactivate rule "${rule.name}"` : `Activate rule "${rule.name}"`}
            title={rule.status === 'active' ? 'Deactivate' : 'Activate'}
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
              {rule.status === 'active' ? (
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </>
              )}
            </svg>
          </button>
        )}

        {/* Edit */}
        {!disabled && (
          <button
            type="button"
            onClick={() => onEdit(rule)}
            className="p-1.5 rounded text-csnp-primary hover:bg-csnp-blue-50 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light transition-colors duration-150"
            aria-label={`Edit rule "${rule.name}"`}
            title="Edit rule"
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
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}

        {/* Delete */}
        {!disabled && (
          <button
            type="button"
            onClick={() => onDelete(rule.id)}
            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-300 transition-colors duration-150"
            aria-label={`Delete rule "${rule.name}"`}
            title="Delete rule"
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

CoverageRuleItem.propTypes = {
  rule: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    ruleType: PropTypes.string.isRequired,
    action: PropTypes.string.isRequired,
    status: PropTypes.string,
    priority: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    conditionCategory: PropTypes.string,
    operator: PropTypes.string,
    value: PropTypes.string,
    valueSecondary: PropTypes.string,
    serviceType: PropTypes.string,
    effectiveDate: PropTypes.string,
    terminationDate: PropTypes.string,
    copayAmount: PropTypes.number,
    coinsurancePercent: PropTypes.number,
    limitValue: PropTypes.string,
    limitUnit: PropTypes.string,
    notes: PropTypes.string,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onToggleStatus: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

CoverageRuleItem.defaultProps = {
  disabled: false,
};

/**
 * Rule editor form modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler
 * @param {Object|null} props.rule - The rule to edit (null for new rule)
 * @param {boolean} props.isEditMode - Whether editing an existing rule
 * @returns {React.ReactElement|null}
 */
function RuleEditorModal({ isOpen, onClose, onSave, rule, isEditMode }) {
  const [formData, setFormData] = useState(() => {
    if (rule && typeof rule === 'object') {
      return { ...rule };
    }
    return createEmptyRule();
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  /**
   * Resets form when rule changes.
   */
  React.useEffect(() => {
    if (isOpen) {
      if (rule && typeof rule === 'object') {
        setFormData({ ...rule });
      } else {
        setFormData(createEmptyRule());
      }
      setFormErrors({});
      setSaving(false);
    }
  }, [isOpen, rule]);

  /**
   * Handles field change.
   * @param {string} field - Field name
   * @param {*} value - New value
   */
  const handleFieldChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }, []);

  /**
   * Handles form submission.
   */
  const handleSubmit = useCallback(() => {
    const validation = validateRule(formData);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setSaving(true);

    const ruleToSave = {
      ...formData,
      id: formData.id || uuidv4(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      priority: typeof formData.priority === 'string' ? parseInt(formData.priority, 10) : formData.priority,
      copayAmount: typeof formData.copayAmount === 'string' ? parseFloat(formData.copayAmount) || 0 : formData.copayAmount,
      coinsurancePercent: typeof formData.coinsurancePercent === 'string' ? parseFloat(formData.coinsurancePercent) || 0 : formData.coinsurancePercent,
      notes: typeof formData.notes === 'string' ? formData.notes.trim() : '',
      updatedAt: new Date().toISOString(),
    };

    if (!isEditMode) {
      ruleToSave.createdAt = new Date().toISOString();
    }

    onSave(ruleToSave);
    setSaving(false);
  }, [formData, isEditMode, onSave]);

  /**
   * Renders condition-based rule fields.
   */
  function renderConditionBasedFields() {
    return (
      <div className="space-y-4">
        <FormField
          name="conditionCategory"
          label="Condition Category"
          type="select"
          value={formData.conditionCategory}
          onChange={(e) => handleFieldChange('conditionCategory', e.target.value)}
          options={CONDITION_CATEGORY_OPTIONS}
          required={true}
          error={formErrors.conditionCategory}
          placeholder="Select condition category..."
          helperText="The chronic condition category this rule applies to"
        />

        <FormField
          name="operator"
          label="Comparison Operator"
          type="select"
          value={formData.operator}
          onChange={(e) => handleFieldChange('operator', e.target.value)}
          options={COMPARISON_OPERATORS}
        />
      </div>
    );
  }

  /**
   * Renders date-based rule fields.
   */
  function renderDateBasedFields() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            name="effectiveDate"
            label="Effective Date"
            type="date"
            value={formData.effectiveDate}
            onChange={(e) => handleFieldChange('effectiveDate', e.target.value)}
            required={true}
            error={formErrors.effectiveDate}
            helperText="Date the rule takes effect"
          />

          <FormField
            name="terminationDate"
            label="Termination Date"
            type="date"
            value={formData.terminationDate}
            onChange={(e) => handleFieldChange('terminationDate', e.target.value)}
            required={true}
            error={formErrors.terminationDate}
            helperText="Date the rule expires"
          />
        </div>

        <FormField
          name="operator"
          label="Date Comparison"
          type="select"
          value={formData.operator}
          onChange={(e) => handleFieldChange('operator', e.target.value)}
          options={[
            { value: 'between', label: 'Between (Effective and Termination)' },
            { value: 'before', label: 'Before Termination Date' },
            { value: 'after', label: 'After Effective Date' },
          ]}
        />
      </div>
    );
  }

  /**
   * Renders priority-based rule fields.
   */
  function renderPriorityBasedFields() {
    return (
      <div className="space-y-4">
        <FormField
          name="priority"
          label="Condition Priority Level"
          type="select"
          value={String(formData.priority)}
          onChange={(e) => handleFieldChange('priority', e.target.value)}
          options={PRIORITY_OPTIONS}
          required={true}
          error={formErrors.priority}
          helperText="The ICD-10 condition priority level this rule targets"
        />

        <FormField
          name="operator"
          label="Priority Comparison"
          type="select"
          value={formData.operator}
          onChange={(e) => handleFieldChange('operator', e.target.value)}
          options={[
            { value: 'equals', label: 'Equals' },
            { value: 'less_or_equal', label: 'Less Than or Equal (Higher Priority)' },
            { value: 'greater_or_equal', label: 'Greater Than or Equal (Lower Priority)' },
          ]}
        />
      </div>
    );
  }

  /**
   * Renders service-based rule fields.
   */
  function renderServiceBasedFields() {
    return (
      <div className="space-y-4">
        <FormField
          name="serviceType"
          label="Service Type"
          type="select"
          value={formData.serviceType}
          onChange={(e) => handleFieldChange('serviceType', e.target.value)}
          options={SERVICE_TYPE_OPTIONS}
          required={true}
          error={formErrors.serviceType}
          placeholder="Select service type..."
          helperText="The type of medical service this rule applies to"
        />
      </div>
    );
  }

  /**
   * Renders cost-based rule fields.
   */
  function renderCostBasedFields() {
    return (
      <div className="space-y-4">
        {(formData.action === RULE_ACTIONS.APPLY_COPAY || formData.action === RULE_ACTIONS.WAIVE_COST) && (
          <FormField
            name="copayAmount"
            label="Copay Amount ($)"
            type="number"
            value={formData.copayAmount}
            onChange={(e) => handleFieldChange('copayAmount', parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            error={formErrors.copayAmount}
            helperText="Dollar amount for copay"
          />
        )}

        {(formData.action === RULE_ACTIONS.APPLY_COINSURANCE) && (
          <FormField
            name="coinsurancePercent"
            label="Coinsurance (%)"
            type="number"
            value={formData.coinsurancePercent}
            onChange={(e) => handleFieldChange('coinsurancePercent', parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
            step="1"
            error={formErrors.coinsurancePercent}
            helperText="Coinsurance percentage (0-100)"
          />
        )}

        <FormField
          name="serviceType"
          label="Applicable Service Type"
          type="select"
          value={formData.serviceType}
          onChange={(e) => handleFieldChange('serviceType', e.target.value)}
          options={[{ value: '', label: 'All Services' }, ...SERVICE_TYPE_OPTIONS]}
          helperText="Optionally restrict this cost rule to a specific service type"
        />
      </div>
    );
  }

  /**
   * Renders action-specific fields.
   */
  function renderActionFields() {
    if (formData.action === RULE_ACTIONS.LIMIT) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            name="limitValue"
            label="Limit Value"
            type="text"
            value={formData.limitValue}
            onChange={(e) => handleFieldChange('limitValue', e.target.value)}
            placeholder="e.g., 24, 100, 5000"
            required={true}
            error={formErrors.limitValue}
            helperText="The numeric limit to apply"
          />

          <FormField
            name="limitUnit"
            label="Limit Unit"
            type="select"
            value={formData.limitUnit}
            onChange={(e) => handleFieldChange('limitUnit', e.target.value)}
            options={LIMIT_UNIT_OPTIONS}
            helperText="Time period for the limit"
          />
        </div>
      );
    }

    return null;
  }

  /**
   * Renders rule-type-specific fields.
   */
  function renderRuleTypeFields() {
    switch (formData.ruleType) {
      case RULE_TYPES.CONDITION_BASED:
        return renderConditionBasedFields();
      case RULE_TYPES.DATE_BASED:
        return renderDateBasedFields();
      case RULE_TYPES.PRIORITY_BASED:
        return renderPriorityBasedFields();
      case RULE_TYPES.SERVICE_BASED:
        return renderServiceBasedFields();
      case RULE_TYPES.COST_BASED:
        return renderCostBasedFields();
      default:
        return null;
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Coverage Rule' : 'Add Coverage Rule'}
      size="lg"
      showCloseButton={true}
    >
      <div className="space-y-5">
        {/* Form Error */}
        {formErrors._form && (
          <Alert
            variant="error"
            title="Validation Error"
            size="sm"
            bordered={true}
          >
            {formErrors._form}
          </Alert>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-csnp-primary">Basic Information</p>

          <FormField
            name="ruleName"
            label="Rule Name"
            type="text"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            placeholder="e.g., Diabetes Primary Care Waiver"
            required={true}
            error={formErrors.name}
            helperText="A descriptive name for this coverage rule"
          />

          <FormField
            name="ruleDescription"
            label="Description"
            type="textarea"
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Describe what this rule does and when it applies..."
            required={true}
            error={formErrors.description}
            rows={2}
            maxLength={300}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              name="ruleType"
              label="Rule Type"
              type="select"
              value={formData.ruleType}
              onChange={(e) => handleFieldChange('ruleType', e.target.value)}
              options={RULE_TYPE_OPTIONS}
              required={true}
              error={formErrors.ruleType}
            />

            <FormField
              name="ruleAction"
              label="Action"
              type="select"
              value={formData.action}
              onChange={(e) => handleFieldChange('action', e.target.value)}
              options={RULE_ACTION_OPTIONS}
              required={true}
              error={formErrors.action}
            />

            <FormField
              name="ruleStatus"
              label="Status"
              type="select"
              value={formData.status}
              onChange={(e) => handleFieldChange('status', e.target.value)}
              options={RULE_STATUS_OPTIONS}
            />
          </div>
        </div>

        {/* Rule Type Specific Fields */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-csnp-primary">
            {RULE_TYPE_LABELS[formData.ruleType] || 'Rule'} Configuration
          </p>
          {renderRuleTypeFields()}
        </div>

        {/* Action-Specific Fields */}
        {renderActionFields()}

        {/* Notes */}
        <FormField
          name="ruleNotes"
          label="Notes"
          type="textarea"
          value={formData.notes}
          onChange={(e) => handleFieldChange('notes', e.target.value)}
          placeholder="Additional notes or CMS regulatory references..."
          rows={2}
          maxLength={500}
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
            Coverage rules must comply with CMS regulations for C-SNP plans (42 CFR §422.100).
            Ensure all cost-sharing rules meet CMS maximum out-of-pocket limits and that
            condition-based rules align with approved benefit package configurations.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            loading={saving}
            loadingText="Saving..."
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
            {isEditMode ? 'Update Rule' : 'Add Rule'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

RuleEditorModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  rule: PropTypes.object,
  isEditMode: PropTypes.bool.isRequired,
};

RuleEditorModal.defaultProps = {
  rule: null,
};

/**
 * Coverage rules editor component.
 * Visual rule builder for benefit coverage conditions, including
 * condition-based rules, date-based rules, and priority-based rules.
 * Supports add/edit/delete rules with validation.
 *
 * @param {Object} props
 * @param {Object[]} [props.initialRules=[]] - Pre-existing coverage rules
 * @param {Function} [props.onRulesChange] - Callback when rules change: (rules) => void
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showStats=true] - Whether to show rule statistics
 * @param {boolean} [props.disabled=false] - Whether editing is disabled
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function CoverageRulesEditor({
  initialRules = [],
  onRulesChange,
  showHeader = true,
  showStats = true,
  disabled = false,
  compact = false,
  className = '',
  ...rest
}) {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [rules, setRules] = useState(() => {
    if (Array.isArray(initialRules) && initialRules.length > 0) {
      return initialRules.map((rule) => ({
        ...createEmptyRule(),
        ...rule,
        id: rule.id || uuidv4(),
      }));
    }
    return [];
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  /**
   * Notifies parent of rules changes.
   * @param {Object[]} updatedRules - The updated rules array
   */
  const notifyRulesChange = useCallback((updatedRules) => {
    if (typeof onRulesChange === 'function') {
      onRulesChange(updatedRules);
    }
  }, [onRulesChange]);

  /**
   * Handles opening the editor for a new rule.
   */
  const handleAddRule = useCallback(() => {
    setEditingRule(null);
    setIsEditMode(false);
    setEditorOpen(true);
  }, []);

  /**
   * Handles opening the editor for an existing rule.
   * @param {Object} rule - The rule to edit
   */
  const handleEditRule = useCallback((rule) => {
    setEditingRule(rule);
    setIsEditMode(true);
    setEditorOpen(true);
  }, []);

  /**
   * Handles closing the editor.
   */
  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingRule(null);
    setIsEditMode(false);
  }, []);

  /**
   * Handles saving a rule (add or update).
   * @param {Object} savedRule - The rule to save
   */
  const handleSaveRule = useCallback((savedRule) => {
    setRules((prev) => {
      let updated;
      const existingIndex = prev.findIndex((r) => r.id === savedRule.id);

      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = savedRule;
      } else {
        updated = [...prev, savedRule];
      }

      notifyRulesChange(updated);
      return updated;
    });

    addNotification(
      'success',
      isEditMode ? 'Rule Updated' : 'Rule Added',
      `Coverage rule "${savedRule.name}" has been ${isEditMode ? 'updated' : 'added'} successfully.`
    );

    handleCloseEditor();
  }, [isEditMode, addNotification, notifyRulesChange, handleCloseEditor]);

  /**
   * Handles initiating rule deletion.
   * @param {string} ruleId - The rule ID to delete
   */
  const handleDeleteInit = useCallback((ruleId) => {
    setDeleteConfirmId(ruleId);
  }, []);

  /**
   * Handles confirming rule deletion.
   */
  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirmId) {
      return;
    }

    setRules((prev) => {
      const ruleToDelete = prev.find((r) => r.id === deleteConfirmId);
      const updated = prev.filter((r) => r.id !== deleteConfirmId);
      notifyRulesChange(updated);

      if (ruleToDelete) {
        addNotification(
          'info',
          'Rule Deleted',
          `Coverage rule "${ruleToDelete.name}" has been removed.`
        );
      }

      return updated;
    });

    setDeleteConfirmId(null);
  }, [deleteConfirmId, addNotification, notifyRulesChange]);

  /**
   * Handles toggling a rule's status between active and inactive.
   * @param {string} ruleId - The rule ID to toggle
   */
  const handleToggleStatus = useCallback((ruleId) => {
    setRules((prev) => {
      const updated = prev.map((r) => {
        if (r.id === ruleId) {
          const newStatus = r.status === 'active' ? 'inactive' : 'active';
          return { ...r, status: newStatus, updatedAt: new Date().toISOString() };
        }
        return r;
      });

      notifyRulesChange(updated);

      const toggledRule = updated.find((r) => r.id === ruleId);
      if (toggledRule) {
        addNotification(
          'info',
          `Rule ${toggledRule.status === 'active' ? 'Activated' : 'Deactivated'}`,
          `Coverage rule "${toggledRule.name}" is now ${toggledRule.status}.`
        );
      }

      return updated;
    });
  }, [addNotification, notifyRulesChange]);

  /**
   * Handles filter type change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleFilterTypeChange = useCallback((e) => {
    setFilterType(e.target.value);
  }, []);

  /**
   * Handles filter status change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleFilterStatusChange = useCallback((e) => {
    setFilterStatus(e.target.value);
  }, []);

  /**
   * Filtered rules based on type and status filters.
   */
  const filteredRules = useMemo(() => {
    let filtered = rules;

    if (filterType && filterType.trim().length > 0) {
      filtered = filtered.filter((r) => r.ruleType === filterType.trim());
    }

    if (filterStatus && filterStatus.trim().length > 0) {
      filtered = filtered.filter((r) => r.status === filterStatus.trim());
    }

    // Sort by priority ascending, then by name
    return [...filtered].sort((a, b) => {
      const priorityA = typeof a.priority === 'number' ? a.priority : 3;
      const priorityB = typeof b.priority === 'number' ? b.priority : 3;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [rules, filterType, filterStatus]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const total = rules.length;
    const active = rules.filter((r) => r.status === 'active').length;
    const inactive = rules.filter((r) => r.status === 'inactive').length;
    const draft = rules.filter((r) => r.status === 'draft').length;

    const byType = {};
    for (const rule of rules) {
      const type = rule.ruleType || 'unknown';
      if (!byType[type]) {
        byType[type] = 0;
      }
      byType[type]++;
    }

    const byAction = {};
    for (const rule of rules) {
      const action = rule.action || 'unknown';
      if (!byAction[action]) {
        byAction[action] = 0;
      }
      byAction[action]++;
    }

    return { total, active, inactive, draft, byType, byAction };
  }, [rules]);

  /**
   * Computed: the rule being confirmed for deletion.
   */
  const ruleToDelete = useMemo(() => {
    if (!deleteConfirmId) {
      return null;
    }
    return rules.find((r) => r.id === deleteConfirmId) || null;
  }, [deleteConfirmId, rules]);

  const containerClassName = [className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
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
                <h3 className="text-sm font-semibold text-csnp-primary">
                  Coverage Rules Editor
                </h3>
                {!compact && (
                  <p className="text-[10px] text-gray-500">
                    Configure coverage conditions, restrictions, and cost-sharing rules
                  </p>
                )}
              </div>
              {rules.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {rules.length} rule{rules.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Type Filter */}
              <select
                value={filterType}
                onChange={handleFilterTypeChange}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                aria-label="Filter by rule type"
              >
                <option value="">All Types</option>
                {RULE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={handleFilterStatusChange}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
                aria-label="Filter by status"
              >
                <option value="">All Statuses</option>
                {RULE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Add Rule Button */}
              {!disabled && isAuthenticated && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddRule}
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
                  Add Rule
                </Button>
              )}
            </div>
          </div>

          {/* Stats Summary */}
          {showStats && !compact && rules.length > 0 && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-green-700">
                  {stats.active} active
                </span>
              </div>
              {stats.inactive > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-gray-600">
                    {stats.inactive} inactive
                  </span>
                </div>
              )}
              {stats.draft > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-yellow-700">
                    {stats.draft} draft
                  </span>
                </div>
              )}
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-1.5 px-2.5 py-1 bg-csnp-blue-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-csnp-primary" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-csnp-primary">
                    {count} {RULE_TYPE_LABELS[type] ? RULE_TYPE_LABELS[type].replace(' Rule', '') : toTitleCase(type)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rules List */}
      {filteredRules.length > 0 && (
        <div className="space-y-2">
          {filteredRules.map((rule) => (
            <CoverageRuleItem
              key={rule.id}
              rule={rule}
              onEdit={handleEditRule}
              onDelete={handleDeleteInit}
              onToggleStatus={handleToggleStatus}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {rules.length === 0 && (
        <EmptyState
          title="No Coverage Rules"
          description="Add coverage rules to define conditions, restrictions, and cost-sharing for this benefit package."
          iconType="no-data"
          size="sm"
          actionLabel={!disabled && isAuthenticated ? 'Add First Rule' : undefined}
          onAction={!disabled && isAuthenticated ? handleAddRule : undefined}
          actionVariant="primary"
          actionIcon={
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
        />
      )}

      {/* Filtered Empty State */}
      {rules.length > 0 && filteredRules.length === 0 && (
        <EmptyState
          title="No Matching Rules"
          description={`No coverage rules match the selected filters${filterType ? ` (Type: ${RULE_TYPE_LABELS[filterType] || toTitleCase(filterType)})` : ''}${filterStatus ? ` (Status: ${toTitleCase(filterStatus)})` : ''}.`}
          iconType="no-results"
          size="sm"
          actionLabel="Clear Filters"
          onAction={() => {
            setFilterType('');
            setFilterStatus('');
          }}
          actionVariant="outline"
        />
      )}

      {/* CMS Compliance Notice */}
      {!compact && rules.length > 0 && (
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
              <span className="font-semibold">CMS Compliance:</span>{' '}
              Coverage rules must comply with CMS regulations for Chronic Condition Special Needs Plans
              (42 CFR §422.100). All cost-sharing rules are subject to CMS maximum out-of-pocket limits.
              Condition-based rules must align with the benefit package&apos;s eligible condition categories.
              Rules are evaluated in priority order during claims adjudication.
            </p>
          </div>
        </div>
      )}

      {/* Rule Editor Modal */}
      <RuleEditorModal
        isOpen={editorOpen}
        onClose={handleCloseEditor}
        onSave={handleSaveRule}
        rule={editingRule}
        isEditMode={isEditMode}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Coverage Rule"
        message={ruleToDelete
          ? `Are you sure you want to delete the coverage rule "${ruleToDelete.name}"? This action cannot be undone.`
          : 'Are you sure you want to delete this coverage rule?'}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

CoverageRulesEditor.propTypes = {
  initialRules: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      description: PropTypes.string,
      ruleType: PropTypes.string,
      action: PropTypes.string,
      status: PropTypes.string,
      priority: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      conditionCategory: PropTypes.string,
      operator: PropTypes.string,
      value: PropTypes.string,
      valueSecondary: PropTypes.string,
      serviceType: PropTypes.string,
      effectiveDate: PropTypes.string,
      terminationDate: PropTypes.string,
      copayAmount: PropTypes.number,
      coinsurancePercent: PropTypes.number,
      limitValue: PropTypes.string,
      limitUnit: PropTypes.string,
      notes: PropTypes.string,
    })
  ),
  onRulesChange: PropTypes.func,
  showHeader: PropTypes.bool,
  showStats: PropTypes.bool,
  disabled: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
};

CoverageRulesEditor.defaultProps = {
  initialRules: [],
  onRulesChange: undefined,
  showHeader: true,
  showStats: true,
  disabled: false,
  compact: false,
  className: '',
};