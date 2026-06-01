import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import Alert from '../common/Alert.jsx';
import Button from '../common/Button.jsx';
import Card from '../common/Card.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { formatDate, formatRelativeTime, toTitleCase } from '../../utils/helpers.js';
import { getCodeByICD10, CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';

/**
 * Priority level to display style mapping.
 * @type {Object.<number, { label: string, color: string, bgColor: string, borderColor: string }>}
 */
const PRIORITY_STYLES = {
  1: { label: 'Highest', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  2: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  3: { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  4: { label: 'Low', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  5: { label: 'Lowest', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
};

/**
 * Returns the priority display style for a given priority number.
 * @param {number} priority - The priority number (1 = highest)
 * @returns {{ label: string, color: string, bgColor: string, borderColor: string }}
 */
function getPriorityStyle(priority) {
  if (typeof priority !== 'number' || priority < 1) {
    return PRIORITY_STYLES[5];
  }
  return PRIORITY_STYLES[priority] || PRIORITY_STYLES[5];
}

/**
 * Code classification badge component.
 *
 * @param {Object} props
 * @param {string} props.code - The ICD-10 code
 * @param {'valid'|'ineligible'|'invalid'} props.classification - Code classification
 * @returns {React.ReactElement}
 */
function CodeBadge({ code, classification }) {
  const styles = {
    valid: 'bg-green-100 text-green-800 border-green-200',
    ineligible: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    invalid: 'bg-red-100 text-red-800 border-red-200',
  };

  const labels = {
    valid: 'CSNP Eligible',
    ineligible: 'Not Eligible',
    invalid: 'Unrecognized',
  };

  const entry = getCodeByICD10(code);
  const styleClass = styles[classification] || styles.invalid;
  const label = labels[classification] || 'Unknown';

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${styleClass}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold whitespace-nowrap">{code}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${styleClass}`}>
            {label}
          </span>
        </div>
        {entry && (
          <p className="text-[11px] mt-0.5 opacity-80 leading-snug truncate">
            {entry.description}
          </p>
        )}
      </div>
      {entry && classification === 'valid' && (
        <div className="flex-shrink-0">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPriorityStyle(entry.priority).bgColor} ${getPriorityStyle(entry.priority).color}`}>
            P{entry.priority}
          </span>
        </div>
      )}
    </div>
  );
}

CodeBadge.propTypes = {
  code: PropTypes.string.isRequired,
  classification: PropTypes.oneOf(['valid', 'ineligible', 'invalid']).isRequired,
};

/**
 * Condition summary row component.
 *
 * @param {Object} props
 * @param {Object} props.category - Condition category summary object
 * @returns {React.ReactElement}
 */
function ConditionSummaryRow({ category }) {
  if (!category || typeof category !== 'object') {
    return null;
  }

  const priorityStyle = getPriorityStyle(category.highestPriority);

  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            category.csnpEligible ? 'bg-green-500' : 'bg-gray-400'
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-700 truncate">
            {category.categoryLabel || toTitleCase(category.category || '')}
          </p>
          <p className="text-[10px] text-gray-500">
            {Array.isArray(category.codes) ? category.codes.length : 0} code{Array.isArray(category.codes) && category.codes.length !== 1 ? 's' : ''}
            {' · '}
            Priority: <span className={`font-semibold ${priorityStyle.color}`}>{priorityStyle.label}</span>
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
  );
}

ConditionSummaryRow.propTypes = {
  category: PropTypes.shape({
    category: PropTypes.string,
    categoryLabel: PropTypes.string,
    codes: PropTypes.array,
    highestPriority: PropTypes.number,
    csnpEligible: PropTypes.bool,
  }),
};

ConditionSummaryRow.defaultProps = {
  category: null,
};

/**
 * Code classification section component.
 *
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string[]} props.codes - Array of ICD-10 codes
 * @param {'valid'|'ineligible'|'invalid'} props.classification - Code classification
 * @param {React.ReactElement} props.icon - Section icon
 * @param {string} props.iconColor - Icon color class
 * @param {string} props.bgColor - Background color class
 * @param {string} props.borderColor - Border color class
 * @returns {React.ReactElement|null}
 */
function CodeClassificationSection({ title, codes, classification, icon, iconColor, bgColor, borderColor }) {
  if (!Array.isArray(codes) || codes.length === 0) {
    return null;
  }

  return (
    <div className={`p-3 rounded-lg border ${bgColor} ${borderColor}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={iconColor}>{icon}</span>
        <p className="text-xs font-semibold">
          {title} ({codes.length})
        </p>
      </div>
      <div className="space-y-1.5">
        {codes.map((code, index) => (
          <CodeBadge
            key={`${code}-${index}`}
            code={typeof code === 'string' ? code : String(code || '')}
            classification={classification}
          />
        ))}
      </div>
    </div>
  );
}

CodeClassificationSection.propTypes = {
  title: PropTypes.string.isRequired,
  codes: PropTypes.arrayOf(PropTypes.string).isRequired,
  classification: PropTypes.oneOf(['valid', 'ineligible', 'invalid']).isRequired,
  icon: PropTypes.node.isRequired,
  iconColor: PropTypes.string.isRequired,
  bgColor: PropTypes.string.isRequired,
  borderColor: PropTypes.string.isRequired,
};

/**
 * Eligibility validation results display component.
 * Shows validated ICD-10 codes, eligibility status, matched CSNP conditions,
 * priority ranking, effective dates, and any rejection reasons.
 * Includes action buttons for enrollment initiation.
 *
 * @param {Object} props
 * @param {Object} [props.result] - The eligibility validation result from eligibilityService
 * @param {boolean} [props.result.eligible] - Whether the member is eligible
 * @param {string|null} [props.result.priorityCondition] - Highest-priority ICD-10 code
 * @param {string|null} [props.result.priorityCategory] - Condition category
 * @param {string|null} [props.result.priorityCategoryLabel] - Human-readable category label
 * @param {Object} [props.result.validationDetails] - Detailed validation results
 * @param {string|null} [props.result.auditId] - Audit log entry ID
 * @param {string} [props.result.timestamp] - ISO timestamp
 * @param {string} [props.memberId] - The member ID for enrollment initiation
 * @param {string} [props.effectiveDate] - The effective date used in validation
 * @param {string} [props.retroDate] - The retro date used in validation
 * @param {Function} [props.onInitiateEnrollment] - Callback when enrollment initiation is clicked: (result) => void
 * @param {Function} [props.onRevalidate] - Callback when revalidate is clicked
 * @param {Function} [props.onDismiss] - Callback when dismiss/close is clicked
 * @param {boolean} [props.showEnrollmentAction=true] - Whether to show the enrollment initiation button
 * @param {boolean} [props.showRevalidateAction=true] - Whether to show the revalidate button
 * @param {boolean} [props.showTimestamp=true] - Whether to show the validation timestamp
 * @param {boolean} [props.showAuditId=false] - Whether to show the audit trail ID
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function EligibilityResults({
  result,
  memberId,
  effectiveDate,
  retroDate,
  onInitiateEnrollment,
  onRevalidate,
  onDismiss,
  showEnrollmentAction = true,
  showRevalidateAction = true,
  showTimestamp = true,
  showAuditId = false,
  compact = false,
  className = '',
  ...rest
}) {
  /**
   * Computed: whether the result is present and valid.
   * @type {boolean}
   */
  const hasResult = useMemo(() => {
    return result !== null && result !== undefined && typeof result === 'object';
  }, [result]);

  /**
   * Computed: eligibility status.
   * @type {boolean}
   */
  const isEligible = useMemo(() => {
    return hasResult && result.eligible === true;
  }, [hasResult, result]);

  /**
   * Computed: validation details.
   * @type {Object|null}
   */
  const validationDetails = useMemo(() => {
    if (!hasResult || !result.validationDetails || typeof result.validationDetails !== 'object') {
      return null;
    }
    return result.validationDetails;
  }, [hasResult, result]);

  /**
   * Computed: valid CSNP-eligible codes.
   * @type {string[]}
   */
  const validCodes = useMemo(() => {
    if (!validationDetails || !Array.isArray(validationDetails.validCodes)) {
      return [];
    }
    return validationDetails.validCodes;
  }, [validationDetails]);

  /**
   * Computed: ineligible codes.
   * @type {string[]}
   */
  const ineligibleCodes = useMemo(() => {
    if (!validationDetails || !Array.isArray(validationDetails.ineligibleCodes)) {
      return [];
    }
    return validationDetails.ineligibleCodes;
  }, [validationDetails]);

  /**
   * Computed: invalid/unrecognized codes.
   * @type {string[]}
   */
  const invalidCodes = useMemo(() => {
    if (!validationDetails || !Array.isArray(validationDetails.invalidCodes)) {
      return [];
    }
    return validationDetails.invalidCodes;
  }, [validationDetails]);

  /**
   * Computed: condition summary.
   * @type {Object[]}
   */
  const conditionSummary = useMemo(() => {
    if (!validationDetails || !Array.isArray(validationDetails.conditionSummary)) {
      return [];
    }
    return validationDetails.conditionSummary;
  }, [validationDetails]);

  /**
   * Computed: whether annual re-verification is required.
   * @type {boolean}
   */
  const reverificationRequired = useMemo(() => {
    return validationDetails && validationDetails.annualReverificationRequired === true;
  }, [validationDetails]);

  /**
   * Computed: re-verification due date.
   * @type {string|null}
   */
  const reverificationDueDate = useMemo(() => {
    if (!validationDetails || !validationDetails.reverificationDueDate) {
      return null;
    }
    return validationDetails.reverificationDueDate;
  }, [validationDetails]);

  /**
   * Computed: priority condition entry.
   * @type {Object|null}
   */
  const priorityEntry = useMemo(() => {
    if (!hasResult || !result.priorityCondition) {
      return null;
    }
    return getCodeByICD10(result.priorityCondition);
  }, [hasResult, result]);

  /**
   * Computed: total codes evaluated.
   * @type {number}
   */
  const totalCodes = useMemo(() => {
    return validCodes.length + ineligibleCodes.length + invalidCodes.length;
  }, [validCodes, ineligibleCodes, invalidCodes]);

  /**
   * Handles enrollment initiation click.
   */
  const handleInitiateEnrollment = useCallback(() => {
    if (typeof onInitiateEnrollment === 'function') {
      onInitiateEnrollment(result);
    }
  }, [onInitiateEnrollment, result]);

  /**
   * Handles revalidate click.
   */
  const handleRevalidate = useCallback(() => {
    if (typeof onRevalidate === 'function') {
      onRevalidate();
    }
  }, [onRevalidate]);

  /**
   * Handles dismiss click.
   */
  const handleDismiss = useCallback(() => {
    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  }, [onDismiss]);

  if (!hasResult) {
    return (
      <EmptyState
        title="No Eligibility Results"
        description="Submit an eligibility validation to see results here."
        iconType="no-data"
        size="sm"
        className={className}
      />
    );
  }

  const containerClassName = [
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Overall Eligibility Status */}
      <Alert
        variant={isEligible ? 'success' : 'error'}
        title={isEligible ? 'Eligible for C-SNP Enrollment' : 'Not Eligible for C-SNP Enrollment'}
        showIcon={true}
        bordered={true}
        size={compact ? 'sm' : 'md'}
      >
        {isEligible ? (
          <div>
            <p>
              Member qualifies for Chronic Condition Special Needs Plan enrollment
              based on the provided diagnosis codes.
            </p>
            {result.priorityCondition && (
              <p className="mt-1">
                Primary qualifying condition:{' '}
                <strong>{result.priorityCondition}</strong>
                {result.priorityCategoryLabel && (
                  <span> ({result.priorityCategoryLabel})</span>
                )}
                {priorityEntry && (
                  <span className="block text-xs mt-0.5 opacity-80">
                    {priorityEntry.description}
                  </span>
                )}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p>
              No CSNP-eligible chronic conditions were identified from the provided
              diagnosis codes. Please verify the diagnosis codes and try again.
            </p>
            {invalidCodes.length > 0 && (
              <p className="mt-1 text-xs">
                {invalidCodes.length} unrecognized code{invalidCodes.length !== 1 ? 's' : ''} were
                provided and could not be evaluated.
              </p>
            )}
          </div>
        )}
      </Alert>

      {/* Primary Condition Card */}
      {isEligible && result.priorityCondition && (
        <div className="mt-4">
          <Card
            variant="primary"
            size={compact ? 'sm' : 'md'}
            bordered={true}
            flat={false}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-csnp-primary">
                  Primary Qualifying Condition
                </p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {result.priorityCondition}
                  </span>
                  {priorityEntry && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPriorityStyle(priorityEntry.priority).bgColor} ${getPriorityStyle(priorityEntry.priority).color}`}>
                      Priority {priorityEntry.priority} — {getPriorityStyle(priorityEntry.priority).label}
                    </span>
                  )}
                </div>
                {priorityEntry && (
                  <p className="text-xs text-gray-600 mt-1">
                    {priorityEntry.description}
                  </p>
                )}
                {result.priorityCategoryLabel && (
                  <p className="text-xs text-csnp-blue-700 mt-1">
                    Category: {result.priorityCategoryLabel}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Effective Dates */}
      {(effectiveDate || retroDate) && (
        <div className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {effectiveDate && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                  Effective Date
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {formatDate(effectiveDate)}
                </p>
              </div>
            )}
            {retroDate && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                  Retro Date
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {formatDate(retroDate)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code Classification Summary */}
      {totalCodes > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Code Classification ({totalCodes} total)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Valid CSNP-Eligible Codes */}
            <CodeClassificationSection
              title="CSNP Eligible"
              codes={validCodes}
              classification="valid"
              icon={
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
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
              iconColor="text-green-600"
              bgColor="bg-green-50"
              borderColor="border-green-200"
            />

            {/* Ineligible Codes */}
            <CodeClassificationSection
              title="Not CSNP Eligible"
              codes={ineligibleCodes}
              classification="ineligible"
              icon={
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
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
              iconColor="text-yellow-600"
              bgColor="bg-yellow-50"
              borderColor="border-yellow-200"
            />

            {/* Invalid/Unrecognized Codes */}
            <CodeClassificationSection
              title="Unrecognized"
              codes={invalidCodes}
              classification="invalid"
              icon={
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              }
              iconColor="text-red-600"
              bgColor="bg-red-50"
              borderColor="border-red-200"
            />
          </div>

          {/* Empty state for no valid codes */}
          {validCodes.length === 0 && ineligibleCodes.length === 0 && invalidCodes.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              No codes were classified.
            </p>
          )}
        </div>
      )}

      {/* Condition Summary */}
      {conditionSummary.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Condition Categories ({conditionSummary.length})
          </p>
          <div className="space-y-2">
            {conditionSummary.map((category) => (
              <ConditionSummaryRow
                key={category.category}
                category={category}
              />
            ))}
          </div>
        </div>
      )}

      {/* Re-verification Notice */}
      {reverificationRequired && (
        <div className="mt-4">
          <Alert
            variant="warning"
            title="Annual Re-Verification Required"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            {reverificationDueDate
              ? `Annual re-verification of chronic condition diagnosis is due by ${formatDate(reverificationDueDate)}. CMS requires annual confirmation of qualifying conditions for C-SNP enrollment.`
              : 'Annual re-verification of chronic condition diagnosis is required per CMS regulations. Please schedule re-verification within the required timeframe.'}
          </Alert>
        </div>
      )}

      {/* Rejection Reasons (when not eligible) */}
      {!isEligible && (
        <div className="mt-4">
          <Alert
            variant="info"
            title="Why was this member not eligible?"
            showIcon={true}
            bordered={true}
            size="sm"
          >
            <ul className="list-disc list-inside space-y-1 text-xs">
              {validCodes.length === 0 && (
                <li>No CSNP-eligible chronic condition diagnosis codes were found among the provided codes.</li>
              )}
              {invalidCodes.length > 0 && (
                <li>
                  {invalidCodes.length} code{invalidCodes.length !== 1 ? 's were' : ' was'} not recognized
                  in the ICD-10 database: {invalidCodes.join(', ')}.
                </li>
              )}
              {ineligibleCodes.length > 0 && validCodes.length === 0 && (
                <li>
                  {ineligibleCodes.length} code{ineligibleCodes.length !== 1 ? 's are' : ' is'} valid
                  ICD-10 code{ineligibleCodes.length !== 1 ? 's' : ''} but {ineligibleCodes.length !== 1 ? 'do' : 'does'} not
                  qualify for C-SNP enrollment: {ineligibleCodes.join(', ')}.
                </li>
              )}
              {totalCodes === 0 && (
                <li>No diagnosis codes were provided for evaluation.</li>
              )}
            </ul>
            <p className="mt-2 text-xs">
              To qualify for C-SNP enrollment, at least one ICD-10 diagnosis code must be associated
              with a qualifying chronic condition as defined by CMS guidelines.
            </p>
          </Alert>
        </div>
      )}

      {/* Validation Metadata */}
      {!compact && (showTimestamp || showAuditId || memberId) && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-400">
            {memberId && (
              <span>
                Member: <span className="font-medium text-gray-500">{memberId}</span>
              </span>
            )}
            {showTimestamp && result.timestamp && (
              <span>
                Validated: <span className="font-medium text-gray-500">{formatRelativeTime(result.timestamp)}</span>
              </span>
            )}
            {showAuditId && result.auditId && (
              <span>
                Audit ID: <span className="font-mono font-medium text-gray-500">{result.auditId.substring(0, 12)}…</span>
              </span>
            )}
            <span>
              Codes evaluated: <span className="font-medium text-gray-500">{totalCodes}</span>
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {(showEnrollmentAction || showRevalidateAction || typeof onDismiss === 'function') && (
        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Initiate Enrollment Button */}
            {showEnrollmentAction && isEligible && typeof onInitiateEnrollment === 'function' && (
              <Button
                variant="primary"
                size="md"
                onClick={handleInitiateEnrollment}
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
                    <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                }
              >
                Initiate Enrollment
              </Button>
            )}

            {/* Revalidate Button */}
            {showRevalidateAction && typeof onRevalidate === 'function' && (
              <Button
                variant={isEligible ? 'outline' : 'primary'}
                size="md"
                onClick={handleRevalidate}
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
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                  </svg>
                }
              >
                Revalidate
              </Button>
            )}

            {/* Dismiss Button */}
            {typeof onDismiss === 'function' && (
              <Button
                variant="ghost"
                size="md"
                onClick={handleDismiss}
              >
                Dismiss
              </Button>
            )}
          </div>

          {/* Eligibility Status Badge */}
          <div className="flex-shrink-0">
            <StatusBadge
              status={isEligible ? 'eligible' : 'ineligible'}
              size="md"
              showDot={true}
              bordered={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}

EligibilityResults.propTypes = {
  result: PropTypes.shape({
    eligible: PropTypes.bool,
    priorityCondition: PropTypes.string,
    priorityCategory: PropTypes.string,
    priorityCategoryLabel: PropTypes.string,
    validationDetails: PropTypes.shape({
      validCodes: PropTypes.arrayOf(PropTypes.string),
      invalidCodes: PropTypes.arrayOf(PropTypes.string),
      ineligibleCodes: PropTypes.arrayOf(PropTypes.string),
      missingCodes: PropTypes.arrayOf(PropTypes.string),
      annualReverificationRequired: PropTypes.bool,
      reverificationDueDate: PropTypes.string,
      conditionSummary: PropTypes.arrayOf(
        PropTypes.shape({
          category: PropTypes.string,
          categoryLabel: PropTypes.string,
          codes: PropTypes.array,
          highestPriority: PropTypes.number,
          csnpEligible: PropTypes.bool,
        })
      ),
    }),
    auditId: PropTypes.string,
    timestamp: PropTypes.string,
  }),
  memberId: PropTypes.string,
  effectiveDate: PropTypes.string,
  retroDate: PropTypes.string,
  onInitiateEnrollment: PropTypes.func,
  onRevalidate: PropTypes.func,
  onDismiss: PropTypes.func,
  showEnrollmentAction: PropTypes.bool,
  showRevalidateAction: PropTypes.bool,
  showTimestamp: PropTypes.bool,
  showAuditId: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
};

EligibilityResults.defaultProps = {
  result: null,
  memberId: undefined,
  effectiveDate: undefined,
  retroDate: undefined,
  onInitiateEnrollment: undefined,
  onRevalidate: undefined,
  onDismiss: undefined,
  showEnrollmentAction: true,
  showRevalidateAction: true,
  showTimestamp: true,
  showAuditId: false,
  compact: false,
  className: '',
};