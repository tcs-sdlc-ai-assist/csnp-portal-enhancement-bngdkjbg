/**
 * Eligibility validation service for the CSNP Portal.
 * Provides ICD-10 code validation against CSNP rules, multiple condition
 * priority logic, effective/retro date handling, annual re-verification,
 * and eligibility status persistence with audit logging.
 * @module eligibilityService
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ICD10_CODE_MAP,
  getCSNPEligibleCodes,
  isCSNPEligible,
  getCodeByICD10,
  getRelatedCodes,
  CONDITION_CATEGORIES,
  CONDITION_CATEGORY_LABELS,
} from '../data/icd10Data.js';
import { getItem, setItem, appendToArray, findInArray, updateInArray } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { AUDIT_ACTIONS } from '../utils/constants.js';
import { validateICD10Format, validateDateFormat, validateDateRange } from '../utils/validators.js';

/**
 * localStorage key for eligibility records.
 * @type {string}
 */
const ELIGIBILITY_KEY = 'csnp_eligibility_records';

/**
 * localStorage key for members collection.
 * @type {string}
 */
const MEMBERS_KEY = 'csnp_members';

/**
 * Number of days in a year for re-verification calculation.
 * @type {number}
 */
const DAYS_IN_YEAR = 365;

/**
 * @typedef {Object} EligibilityResult
 * @property {boolean} eligible - Whether the member is eligible for CSNP
 * @property {string|null} priorityCondition - The highest-priority ICD-10 code
 * @property {string|null} priorityCategory - The condition category of the priority condition
 * @property {string|null} priorityCategoryLabel - Human-readable label for the priority category
 * @property {Object} validationDetails - Detailed validation results
 * @property {string[]} validationDetails.validCodes - ICD-10 codes that are valid and CSNP-eligible
 * @property {string[]} validationDetails.invalidCodes - ICD-10 codes that are not recognized
 * @property {string[]} validationDetails.ineligibleCodes - ICD-10 codes that exist but are not CSNP-eligible
 * @property {string[]} validationDetails.missingCodes - Expected codes that were not provided
 * @property {boolean} validationDetails.annualReverificationRequired - Whether annual re-verification is needed
 * @property {string|null} validationDetails.reverificationDueDate - ISO date string for next re-verification
 * @property {Object[]} validationDetails.conditionSummary - Summary of conditions found
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp of the validation
 */

/**
 * @typedef {Object} EligibilityRecord
 * @property {string} id - Unique eligibility record identifier
 * @property {string} memberId - Member ID
 * @property {boolean} eligible - Whether the member is eligible
 * @property {string|null} priorityCondition - Highest-priority ICD-10 code
 * @property {string|null} priorityCategory - Condition category
 * @property {string[]} validatedCodes - All validated ICD-10 codes
 * @property {string[]} validCodes - Valid CSNP-eligible codes
 * @property {string[]} invalidCodes - Invalid or unrecognized codes
 * @property {string[]} ineligibleCodes - Recognized but not CSNP-eligible codes
 * @property {string|null} effectiveDate - Effective date (YYYY-MM-DD)
 * @property {string|null} retroDate - Retro date (YYYY-MM-DD)
 * @property {boolean} annualReverificationRequired - Whether re-verification is needed
 * @property {string|null} reverificationDueDate - Next re-verification due date
 * @property {string|null} performedBy - User ID who performed the validation
 * @property {string} status - Eligibility status (eligible, ineligible, pending, expired)
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * Determines the priority condition from a list of valid CSNP-eligible ICD-10 codes.
 * Returns the code with the lowest priority number (highest priority).
 * @param {string[]} validCodes - Array of valid CSNP-eligible ICD-10 codes
 * @returns {{ code: string, priority: number, category: string } | null} The priority condition or null
 */
function determinePriorityCondition(validCodes) {
  if (!Array.isArray(validCodes) || validCodes.length === 0) {
    return null;
  }

  let bestCode = null;
  let bestPriority = Infinity;
  let bestCategory = null;

  for (const code of validCodes) {
    const entry = getCodeByICD10(code);
    if (entry && entry.csnpEligible) {
      if (entry.priority < bestPriority) {
        bestPriority = entry.priority;
        bestCode = entry.code;
        bestCategory = entry.category;
      } else if (entry.priority === bestPriority && bestCode !== null) {
        // Tie-break: prefer the code that appears first in the input array
        // (already handled by iteration order)
      }
    }
  }

  if (bestCode === null) {
    return null;
  }

  return {
    code: bestCode,
    priority: bestPriority,
    category: bestCategory,
  };
}

/**
 * Builds a condition summary from a list of valid ICD-10 codes.
 * Groups codes by condition category and returns a summary array.
 * @param {string[]} validCodes - Array of valid CSNP-eligible ICD-10 codes
 * @returns {Object[]} Array of condition summary objects
 */
function buildConditionSummary(validCodes) {
  if (!Array.isArray(validCodes) || validCodes.length === 0) {
    return [];
  }

  const categoryMap = {};

  for (const code of validCodes) {
    const entry = getCodeByICD10(code);
    if (!entry) {
      continue;
    }

    const category = entry.category;
    if (!categoryMap[category]) {
      categoryMap[category] = {
        category,
        categoryLabel: CONDITION_CATEGORY_LABELS[category] || category,
        codes: [],
        highestPriority: Infinity,
        csnpEligible: false,
      };
    }

    categoryMap[category].codes.push({
      code: entry.code,
      description: entry.description,
      priority: entry.priority,
      csnpEligible: entry.csnpEligible,
    });

    if (entry.csnpEligible) {
      categoryMap[category].csnpEligible = true;
    }

    if (entry.priority < categoryMap[category].highestPriority) {
      categoryMap[category].highestPriority = entry.priority;
    }
  }

  return Object.values(categoryMap).sort((a, b) => a.highestPriority - b.highestPriority);
}

/**
 * Calculates the re-verification due date based on the effective date.
 * Annual re-verification is required 365 days from the effective date.
 * @param {string|null} effectiveDate - Effective date (YYYY-MM-DD)
 * @returns {string|null} Re-verification due date (YYYY-MM-DD) or null
 */
function calculateReverificationDueDate(effectiveDate) {
  if (!effectiveDate || typeof effectiveDate !== 'string') {
    return null;
  }

  try {
    const parsed = new Date(effectiveDate + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      return null;
    }

    const dueDate = new Date(parsed);
    dueDate.setDate(dueDate.getDate() + DAYS_IN_YEAR);

    const year = dueDate.getFullYear();
    const month = String(dueDate.getMonth() + 1).padStart(2, '0');
    const day = String(dueDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Checks whether annual re-verification is required for a member.
 * Re-verification is required if the most recent eligibility record
 * has a reverification due date that is in the past or within 30 days.
 * @param {string} memberId - The member ID
 * @returns {{ required: boolean, dueDate: string|null, daysUntilDue: number|null, lastValidation: string|null }}
 */
export function checkAnnualReverification(memberId) {
  const result = {
    required: false,
    dueDate: null,
    daysUntilDue: null,
    lastValidation: null,
  };

  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return result;
  }

  try {
    const records = getItem(ELIGIBILITY_KEY, []);
    if (!Array.isArray(records)) {
      return result;
    }

    // Find the most recent eligible record for this member
    const memberRecords = records
      .filter((r) => r.memberId === memberId && r.status === 'eligible')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (memberRecords.length === 0) {
      result.required = true;
      return result;
    }

    const latestRecord = memberRecords[0];
    result.lastValidation = latestRecord.createdAt;

    if (!latestRecord.reverificationDueDate) {
      // If no due date, calculate from effective date or creation date
      const baseDate = latestRecord.effectiveDate || latestRecord.createdAt.split('T')[0];
      const dueDate = calculateReverificationDueDate(baseDate);
      result.dueDate = dueDate;
    } else {
      result.dueDate = latestRecord.reverificationDueDate;
    }

    if (result.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(result.dueDate + 'T00:00:00');

      if (!isNaN(due.getTime())) {
        const diffMs = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        result.daysUntilDue = diffDays;

        // Required if due date is in the past or within 30 days
        if (diffDays <= 30) {
          result.required = true;
        }
      }
    }

    return result;
  } catch (error) {
    console.error('eligibilityService.checkAnnualReverification: unexpected error:', error);
    return result;
  }
}

/**
 * Validates a member's eligibility for CSNP enrollment.
 * Performs ICD-10 code validation, priority condition determination,
 * date validation, and persists the eligibility record with audit logging.
 *
 * @param {Object} memberData - Member data object
 * @param {string} memberData.memberId - Member ID
 * @param {string} [memberData.effectiveDate] - Effective date (YYYY-MM-DD)
 * @param {string} [memberData.retroDate] - Retro date (YYYY-MM-DD)
 * @param {string} [memberData.performedBy] - User ID performing the validation
 * @param {string[]} icd10Codes - Array of ICD-10 codes to validate
 * @returns {EligibilityResult} The eligibility validation result
 */
export function validateEligibility(memberData, icd10Codes) {
  const timestamp = new Date().toISOString();

  // Default result
  const result = {
    eligible: false,
    priorityCondition: null,
    priorityCategory: null,
    priorityCategoryLabel: null,
    validationDetails: {
      validCodes: [],
      invalidCodes: [],
      ineligibleCodes: [],
      missingCodes: [],
      annualReverificationRequired: false,
      reverificationDueDate: null,
      conditionSummary: [],
    },
    auditId: null,
    timestamp,
  };

  // Validate inputs
  if (!memberData || typeof memberData !== 'object') {
    console.error('eligibilityService.validateEligibility: memberData is required');
    return result;
  }

  if (typeof memberData.memberId !== 'string' || memberData.memberId.trim().length === 0) {
    console.error('eligibilityService.validateEligibility: memberData.memberId is required');
    return result;
  }

  if (!Array.isArray(icd10Codes) || icd10Codes.length === 0) {
    console.error('eligibilityService.validateEligibility: icd10Codes must be a non-empty array');
    return result;
  }

  const memberId = memberData.memberId.trim();
  const effectiveDate = memberData.effectiveDate || null;
  const retroDate = memberData.retroDate || null;
  const performedBy = memberData.performedBy || null;

  try {
    // Validate effective date if provided
    if (effectiveDate) {
      const dateResult = validateDateFormat(effectiveDate, 'Effective date');
      if (!dateResult.valid) {
        console.error('eligibilityService.validateEligibility:', dateResult.error);
        return result;
      }
    }

    // Validate retro date if provided
    if (retroDate) {
      const retroResult = validateDateFormat(retroDate, 'Retro date');
      if (!retroResult.valid) {
        console.error('eligibilityService.validateEligibility:', retroResult.error);
        return result;
      }
    }

    // Validate date range if both dates provided
    if (retroDate && effectiveDate) {
      const rangeResult = validateDateRange(retroDate, effectiveDate, 'Retro date', 'Effective date');
      if (!rangeResult.valid) {
        console.error('eligibilityService.validateEligibility:', rangeResult.error);
        return result;
      }
    }

    // Classify each ICD-10 code
    const validCodes = [];
    const invalidCodes = [];
    const ineligibleCodes = [];

    for (const code of icd10Codes) {
      if (typeof code !== 'string' || code.trim().length === 0) {
        invalidCodes.push(code || '');
        continue;
      }

      const trimmedCode = code.trim().toUpperCase();

      // Check format
      const formatResult = validateICD10Format(trimmedCode, 'ICD-10 code');
      if (!formatResult.valid) {
        invalidCodes.push(trimmedCode);
        continue;
      }

      // Check if code exists in our dataset
      const entry = getCodeByICD10(trimmedCode);
      if (!entry) {
        invalidCodes.push(trimmedCode);
        continue;
      }

      // Check CSNP eligibility
      if (entry.csnpEligible) {
        validCodes.push(trimmedCode);
      } else {
        ineligibleCodes.push(trimmedCode);
      }
    }

    result.validationDetails.validCodes = validCodes;
    result.validationDetails.invalidCodes = invalidCodes;
    result.validationDetails.ineligibleCodes = ineligibleCodes;

    // Determine eligibility
    result.eligible = validCodes.length > 0;

    // Determine priority condition
    if (validCodes.length > 0) {
      const priority = determinePriorityCondition(validCodes);
      if (priority) {
        result.priorityCondition = priority.code;
        result.priorityCategory = priority.category;
        result.priorityCategoryLabel = CONDITION_CATEGORY_LABELS[priority.category] || priority.category;
      }
    }

    // Build condition summary
    result.validationDetails.conditionSummary = buildConditionSummary(validCodes);

    // Check annual re-verification
    const reverification = checkAnnualReverification(memberId);
    result.validationDetails.annualReverificationRequired = reverification.required;
    result.validationDetails.reverificationDueDate = reverification.dueDate;

    // Calculate re-verification due date for new eligibility
    if (result.eligible && effectiveDate) {
      const newDueDate = calculateReverificationDueDate(effectiveDate);
      if (newDueDate) {
        result.validationDetails.reverificationDueDate = newDueDate;
      }
    }

    // Persist eligibility record
    const recordId = uuidv4();
    const eligibilityRecord = {
      id: recordId,
      memberId,
      eligible: result.eligible,
      priorityCondition: result.priorityCondition,
      priorityCategory: result.priorityCategory,
      validatedCodes: icd10Codes.map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : '')),
      validCodes,
      invalidCodes,
      ineligibleCodes,
      effectiveDate,
      retroDate,
      annualReverificationRequired: result.validationDetails.annualReverificationRequired,
      reverificationDueDate: result.validationDetails.reverificationDueDate,
      performedBy,
      status: result.eligible ? 'eligible' : 'ineligible',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    appendToArray(ELIGIBILITY_KEY, eligibilityRecord);

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.APPROVE,
      performedBy || 'system',
      {
        targetType: 'eligibility',
        targetId: recordId,
        description: result.eligible
          ? `Eligibility validated for member ${memberId}. Priority condition: ${result.priorityCondition || 'N/A'}`
          : `Eligibility validation failed for member ${memberId}. No valid CSNP-eligible codes found.`,
        metadata: {
          memberId,
          eligible: result.eligible,
          priorityCondition: result.priorityCondition,
          validCodesCount: validCodes.length,
          invalidCodesCount: invalidCodes.length,
          ineligibleCodesCount: ineligibleCodes.length,
        },
        ipAddress: '127.0.0.1',
      },
      'eligibility'
    );

    if (auditEntry) {
      result.auditId = auditEntry.id;
    }

    return result;
  } catch (error) {
    console.error('eligibilityService.validateEligibility: unexpected error:', error);
    return result;
  }
}

/**
 * Retrieves the eligibility history for a member.
 * Returns all eligibility records sorted by creation date descending.
 * @param {string} memberId - The member ID
 * @returns {EligibilityRecord[]} Array of eligibility records
 */
export function getEligibilityHistory(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    const records = getItem(ELIGIBILITY_KEY, []);
    if (!Array.isArray(records)) {
      return [];
    }

    return records
      .filter((r) => r.memberId === memberId.trim())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('eligibilityService.getEligibilityHistory: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves the most recent eligibility record for a member.
 * @param {string} memberId - The member ID
 * @returns {EligibilityRecord|null} The most recent eligibility record or null
 */
export function getLatestEligibility(memberId) {
  const history = getEligibilityHistory(memberId);
  return history.length > 0 ? history[0] : null;
}

/**
 * Checks whether a member is currently eligible for CSNP.
 * Considers the most recent eligibility record and re-verification status.
 * @param {string} memberId - The member ID
 * @returns {{ eligible: boolean, reason: string, record: EligibilityRecord|null }}
 */
export function isCurrentlyEligible(memberId) {
  const defaultResult = { eligible: false, reason: 'No eligibility record found', record: null };

  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return defaultResult;
  }

  try {
    const latest = getLatestEligibility(memberId);
    if (!latest) {
      return defaultResult;
    }

    if (latest.status === 'expired') {
      return { eligible: false, reason: 'Eligibility has expired', record: latest };
    }

    if (latest.status === 'ineligible') {
      return { eligible: false, reason: 'Member is not eligible based on last validation', record: latest };
    }

    // Check re-verification
    const reverification = checkAnnualReverification(memberId);
    if (reverification.required && reverification.daysUntilDue !== null && reverification.daysUntilDue < 0) {
      return { eligible: false, reason: 'Annual re-verification is overdue', record: latest };
    }

    if (latest.eligible && latest.status === 'eligible') {
      return { eligible: true, reason: 'Member is eligible for CSNP', record: latest };
    }

    return { eligible: false, reason: 'Eligibility status is not confirmed', record: latest };
  } catch (error) {
    console.error('eligibilityService.isCurrentlyEligible: unexpected error:', error);
    return defaultResult;
  }
}

/**
 * Updates the status of an eligibility record.
 * @param {string} recordId - The eligibility record ID
 * @param {string} newStatus - The new status (eligible, ineligible, pending, expired)
 * @param {string} [performedBy] - User ID performing the update
 * @returns {boolean} Whether the update succeeded
 */
export function updateEligibilityStatus(recordId, newStatus, performedBy) {
  if (typeof recordId !== 'string' || recordId.trim().length === 0) {
    console.error('eligibilityService.updateEligibilityStatus: recordId is required');
    return false;
  }

  const validStatuses = ['eligible', 'ineligible', 'pending', 'expired'];
  if (!validStatuses.includes(newStatus)) {
    console.error('eligibilityService.updateEligibilityStatus: invalid status:', newStatus);
    return false;
  }

  try {
    const updated = updateInArray(
      ELIGIBILITY_KEY,
      (record) => record.id === recordId.trim(),
      (record) => ({
        ...record,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })
    );

    if (updated) {
      logAction(
        AUDIT_ACTIONS.UPDATE,
        performedBy || 'system',
        {
          targetType: 'eligibility',
          targetId: recordId.trim(),
          description: `Eligibility status updated to "${newStatus}" for record ${recordId.trim()}`,
          metadata: { recordId: recordId.trim(), newStatus },
          ipAddress: '127.0.0.1',
        },
        'eligibility'
      );
    }

    return updated;
  } catch (error) {
    console.error('eligibilityService.updateEligibilityStatus: unexpected error:', error);
    return false;
  }
}

/**
 * Validates eligibility for a member using their stored diagnosis codes.
 * Fetches the member from localStorage and validates their existing codes.
 * @param {string} memberId - The member ID
 * @param {string} [performedBy] - User ID performing the validation
 * @returns {EligibilityResult} The eligibility validation result
 */
export function validateMemberEligibility(memberId, performedBy) {
  const defaultResult = {
    eligible: false,
    priorityCondition: null,
    priorityCategory: null,
    priorityCategoryLabel: null,
    validationDetails: {
      validCodes: [],
      invalidCodes: [],
      ineligibleCodes: [],
      missingCodes: [],
      annualReverificationRequired: false,
      reverificationDueDate: null,
      conditionSummary: [],
    },
    auditId: null,
    timestamp: new Date().toISOString(),
  };

  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    console.error('eligibilityService.validateMemberEligibility: memberId is required');
    return defaultResult;
  }

  try {
    const member = findInArray(MEMBERS_KEY, (m) => m.id === memberId.trim());
    if (!member) {
      console.error('eligibilityService.validateMemberEligibility: member not found:', memberId);
      return defaultResult;
    }

    const diagnosisCodes = member.diagnosisCodes || [];
    if (diagnosisCodes.length === 0) {
      return defaultResult;
    }

    const memberData = {
      memberId: member.id,
      effectiveDate: null,
      retroDate: null,
      performedBy: performedBy || null,
    };

    return validateEligibility(memberData, diagnosisCodes);
  } catch (error) {
    console.error('eligibilityService.validateMemberEligibility: unexpected error:', error);
    return defaultResult;
  }
}

/**
 * Retrieves all eligibility records from localStorage.
 * @returns {EligibilityRecord[]} Array of all eligibility records
 */
export function getAllEligibilityRecords() {
  try {
    const records = getItem(ELIGIBILITY_KEY, []);
    if (!Array.isArray(records)) {
      return [];
    }
    return records;
  } catch (error) {
    console.error('eligibilityService.getAllEligibilityRecords: unexpected error:', error);
    return [];
  }
}

/**
 * Returns eligibility statistics across all members.
 * @returns {{ totalValidations: number, eligibleCount: number, ineligibleCount: number, pendingCount: number, expiredCount: number, byCategory: Object.<string, number> }}
 */
export function getEligibilityStats() {
  try {
    const records = getItem(ELIGIBILITY_KEY, []);
    if (!Array.isArray(records)) {
      return {
        totalValidations: 0,
        eligibleCount: 0,
        ineligibleCount: 0,
        pendingCount: 0,
        expiredCount: 0,
        byCategory: {},
      };
    }

    const stats = {
      totalValidations: records.length,
      eligibleCount: 0,
      ineligibleCount: 0,
      pendingCount: 0,
      expiredCount: 0,
      byCategory: {},
    };

    for (const record of records) {
      switch (record.status) {
        case 'eligible':
          stats.eligibleCount++;
          break;
        case 'ineligible':
          stats.ineligibleCount++;
          break;
        case 'pending':
          stats.pendingCount++;
          break;
        case 'expired':
          stats.expiredCount++;
          break;
        default:
          break;
      }

      if (record.priorityCategory) {
        if (!stats.byCategory[record.priorityCategory]) {
          stats.byCategory[record.priorityCategory] = 0;
        }
        stats.byCategory[record.priorityCategory]++;
      }
    }

    return stats;
  } catch (error) {
    console.error('eligibilityService.getEligibilityStats: unexpected error:', error);
    return {
      totalValidations: 0,
      eligibleCount: 0,
      ineligibleCount: 0,
      pendingCount: 0,
      expiredCount: 0,
      byCategory: {},
    };
  }
}

/**
 * Retrieves related ICD-10 codes for a given code, useful for suggesting
 * additional codes during eligibility validation.
 * @param {string} code - The ICD-10 code
 * @returns {{ code: string, description: string, csnpEligible: boolean, priority: number }[]}
 */
export function getSuggestedRelatedCodes(code) {
  if (typeof code !== 'string' || code.trim().length === 0) {
    return [];
  }

  try {
    const related = getRelatedCodes(code.trim().toUpperCase());
    return related.map((entry) => ({
      code: entry.code,
      description: entry.description,
      csnpEligible: entry.csnpEligible,
      priority: entry.priority,
    }));
  } catch (error) {
    console.error('eligibilityService.getSuggestedRelatedCodes: unexpected error:', error);
    return [];
  }
}

/**
 * Performs a batch eligibility check for multiple members.
 * @param {string[]} memberIds - Array of member IDs to check
 * @param {string} [performedBy] - User ID performing the batch check
 * @returns {{ memberId: string, eligible: boolean, priorityCondition: string|null }[]}
 */
export function batchCheckEligibility(memberIds, performedBy) {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return [];
  }

  const results = [];

  for (const memberId of memberIds) {
    if (typeof memberId !== 'string' || memberId.trim().length === 0) {
      results.push({ memberId: memberId || '', eligible: false, priorityCondition: null });
      continue;
    }

    try {
      const validationResult = validateMemberEligibility(memberId.trim(), performedBy);
      results.push({
        memberId: memberId.trim(),
        eligible: validationResult.eligible,
        priorityCondition: validationResult.priorityCondition,
      });
    } catch (error) {
      console.error(`eligibilityService.batchCheckEligibility: error for member ${memberId}:`, error);
      results.push({ memberId: memberId.trim(), eligible: false, priorityCondition: null });
    }
  }

  return results;
}