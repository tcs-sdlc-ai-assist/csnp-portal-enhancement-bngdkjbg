/**
 * Centralized business rules engine for the CSNP Portal.
 * Provides configurable rule evaluation for CSNP eligibility determination,
 * benefit package assignment, and claims adjudication with priority logic,
 * rule chaining, and audit trail integration.
 * @module ruleEngine
 */

import {
  ICD10_CODE_MAP,
  getCodeByICD10,
  getCSNPEligibleCodes,
  getEligibleCodesByCategory,
  CONDITION_CATEGORIES,
  CONDITION_CATEGORY_LABELS,
} from '../data/icd10Data.js';
import { getItem } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { AUDIT_ACTIONS, PLAN_TYPES, CLAIM_STATUSES } from '../utils/constants.js';

/**
 * localStorage key for benefit packages.
 * @type {string}
 */
const BENEFIT_PACKAGES_KEY = 'csnp_benefit_packages';

/**
 * localStorage key for enrollments.
 * @type {string}
 */
const ENROLLMENTS_KEY = 'csnp_enrollments';

// ─── Rule Severity Levels ───────────────────────────────────────────────────

/**
 * Rule severity levels for rule evaluation results.
 * @enum {string}
 */
export const RULE_SEVERITY = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
});

// ─── Rule Categories ────────────────────────────────────────────────────────

/**
 * Rule categories for grouping rules.
 * @enum {string}
 */
export const RULE_CATEGORIES = Object.freeze({
  ELIGIBILITY: 'eligibility',
  BENEFIT: 'benefit',
  CLAIM: 'claim',
});

// ─── Rule Result Types ──────────────────────────────────────────────────────

/**
 * @typedef {Object} RuleResult
 * @property {string} ruleId - Unique identifier for the rule
 * @property {string} ruleName - Human-readable rule name
 * @property {boolean} passed - Whether the rule passed
 * @property {string} severity - Severity level from RULE_SEVERITY
 * @property {string} message - Result message
 * @property {Object|null} metadata - Additional metadata
 */

/**
 * @typedef {Object} EligibilityRuleResult
 * @property {boolean} eligible - Whether the member is eligible for CSNP
 * @property {string|null} primaryConditionCode - The highest-priority ICD-10 code
 * @property {string|null} primaryConditionCategory - The condition category
 * @property {string|null} primaryConditionCategoryLabel - Human-readable category label
 * @property {RuleResult[]} ruleResults - Individual rule evaluation results
 * @property {string[]} eligibleCodes - ICD-10 codes that are CSNP-eligible
 * @property {string[]} ineligibleCodes - ICD-10 codes that are not CSNP-eligible
 * @property {string[]} invalidCodes - ICD-10 codes that are not recognized
 * @property {Object[]} conditionSummary - Summary of conditions found
 * @property {string} timestamp - ISO timestamp of the evaluation
 */

/**
 * @typedef {Object} BenefitRuleResult
 * @property {boolean} eligible - Whether the condition qualifies for the plan type
 * @property {string|null} recommendedPackageId - Recommended benefit package ID
 * @property {string|null} recommendedPackageName - Recommended benefit package name
 * @property {RuleResult[]} ruleResults - Individual rule evaluation results
 * @property {Object[]} matchingPackages - All matching benefit packages
 * @property {string} timestamp - ISO timestamp of the evaluation
 */

/**
 * @typedef {Object} ClaimRuleResult
 * @property {boolean} approved - Whether the claim is approved
 * @property {string} recommendedStatus - Recommended claim status
 * @property {number} allowedAmount - Calculated allowed amount
 * @property {number} memberResponsibility - Calculated member responsibility
 * @property {number} paidAmount - Calculated paid amount
 * @property {RuleResult[]} ruleResults - Individual rule evaluation results
 * @property {string[]} denialReasons - Reasons for denial if applicable
 * @property {string} timestamp - ISO timestamp of the evaluation
 */

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Creates a rule result object.
 * @param {string} ruleId - Unique rule identifier
 * @param {string} ruleName - Human-readable rule name
 * @param {boolean} passed - Whether the rule passed
 * @param {string} severity - Severity level
 * @param {string} message - Result message
 * @param {Object|null} [metadata=null] - Additional metadata
 * @returns {RuleResult}
 */
function createRuleResult(ruleId, ruleName, passed, severity, message, metadata = null) {
  return {
    ruleId,
    ruleName,
    passed,
    severity,
    message,
    metadata,
  };
}

/**
 * Classifies ICD-10 codes into eligible, ineligible, and invalid categories.
 * @param {string[]} codes - Array of ICD-10 codes
 * @returns {{ eligibleCodes: string[], ineligibleCodes: string[], invalidCodes: string[], codeEntries: Object[] }}
 */
function classifyCodes(codes) {
  const eligibleCodes = [];
  const ineligibleCodes = [];
  const invalidCodes = [];
  const codeEntries = [];

  if (!Array.isArray(codes)) {
    return { eligibleCodes, ineligibleCodes, invalidCodes, codeEntries };
  }

  for (const code of codes) {
    if (typeof code !== 'string' || code.trim().length === 0) {
      invalidCodes.push(code || '');
      continue;
    }

    const trimmed = code.trim().toUpperCase();
    const entry = getCodeByICD10(trimmed);

    if (!entry) {
      invalidCodes.push(trimmed);
      continue;
    }

    codeEntries.push(entry);

    if (entry.csnpEligible) {
      eligibleCodes.push(trimmed);
    } else {
      ineligibleCodes.push(trimmed);
    }
  }

  return { eligibleCodes, ineligibleCodes, invalidCodes, codeEntries };
}

/**
 * Determines the primary (highest-priority) condition from eligible code entries.
 * @param {Object[]} codeEntries - Array of ICD-10 code entry objects
 * @returns {{ code: string, category: string, priority: number } | null}
 */
function determinePrimaryCondition(codeEntries) {
  if (!Array.isArray(codeEntries) || codeEntries.length === 0) {
    return null;
  }

  const eligibleEntries = codeEntries.filter((entry) => entry.csnpEligible);
  if (eligibleEntries.length === 0) {
    return null;
  }

  let best = null;

  for (const entry of eligibleEntries) {
    if (best === null || entry.priority < best.priority) {
      best = {
        code: entry.code,
        category: entry.category,
        priority: entry.priority,
      };
    }
  }

  return best;
}

/**
 * Builds a condition summary grouped by category from code entries.
 * @param {Object[]} codeEntries - Array of ICD-10 code entry objects
 * @returns {Object[]}
 */
function buildConditionSummary(codeEntries) {
  if (!Array.isArray(codeEntries) || codeEntries.length === 0) {
    return [];
  }

  const categoryMap = {};

  for (const entry of codeEntries) {
    const category = entry.category;
    if (!categoryMap[category]) {
      categoryMap[category] = {
        category,
        categoryLabel: CONDITION_CATEGORY_LABELS[category] || category,
        codes: [],
        highestPriority: Infinity,
        hasEligibleCode: false,
      };
    }

    categoryMap[category].codes.push({
      code: entry.code,
      description: entry.description,
      priority: entry.priority,
      csnpEligible: entry.csnpEligible,
    });

    if (entry.csnpEligible) {
      categoryMap[category].hasEligibleCode = true;
    }

    if (entry.priority < categoryMap[category].highestPriority) {
      categoryMap[category].highestPriority = entry.priority;
    }
  }

  return Object.values(categoryMap).sort((a, b) => a.highestPriority - b.highestPriority);
}

/**
 * Retrieves all benefit packages from localStorage.
 * @returns {Object[]}
 */
function getBenefitPackages() {
  const packages = getItem(BENEFIT_PACKAGES_KEY, []);
  if (!Array.isArray(packages)) {
    return [];
  }
  return packages;
}

/**
 * Retrieves all enrollments from localStorage.
 * @returns {Object[]}
 */
function getEnrollments() {
  const enrollments = getItem(ENROLLMENTS_KEY, []);
  if (!Array.isArray(enrollments)) {
    return [];
  }
  return enrollments;
}

// ─── Eligibility Rules ──────────────────────────────────────────────────────

/**
 * Rule: At least one diagnosis code must be provided.
 * @param {string[]} codes - Array of ICD-10 codes
 * @returns {RuleResult}
 */
function ruleHasDiagnosisCodes(codes) {
  const passed = Array.isArray(codes) && codes.length > 0;
  return createRuleResult(
    'ELIG-001',
    'Diagnosis Codes Required',
    passed,
    RULE_SEVERITY.ERROR,
    passed
      ? `${codes.length} diagnosis code(s) provided`
      : 'At least one diagnosis code is required for eligibility evaluation',
    { codeCount: Array.isArray(codes) ? codes.length : 0 }
  );
}

/**
 * Rule: At least one diagnosis code must be a valid ICD-10 format.
 * @param {string[]} invalidCodes - Array of invalid codes
 * @param {string[]} allCodes - Array of all provided codes
 * @returns {RuleResult}
 */
function ruleHasValidCodes(invalidCodes, allCodes) {
  const validCount = allCodes.length - invalidCodes.length;
  const passed = validCount > 0;
  return createRuleResult(
    'ELIG-002',
    'Valid ICD-10 Codes',
    passed,
    passed ? RULE_SEVERITY.INFO : RULE_SEVERITY.ERROR,
    passed
      ? `${validCount} valid ICD-10 code(s) found`
      : 'No valid ICD-10 codes found. All provided codes are unrecognized.',
    { validCount, invalidCount: invalidCodes.length, invalidCodes }
  );
}

/**
 * Rule: At least one diagnosis code must be CSNP-eligible.
 * @param {string[]} eligibleCodes - Array of CSNP-eligible codes
 * @returns {RuleResult}
 */
function ruleHasCSNPEligibleCode(eligibleCodes) {
  const passed = eligibleCodes.length > 0;
  return createRuleResult(
    'ELIG-003',
    'CSNP-Eligible Condition',
    passed,
    RULE_SEVERITY.ERROR,
    passed
      ? `${eligibleCodes.length} CSNP-eligible condition(s) identified`
      : 'No CSNP-eligible conditions found. Member does not qualify for C-SNP enrollment.',
    { eligibleCodes, eligibleCount: eligibleCodes.length }
  );
}

/**
 * Rule: Primary condition must have priority 1 or 2 for highest confidence.
 * @param {{ code: string, category: string, priority: number } | null} primaryCondition
 * @returns {RuleResult}
 */
function rulePrimaryConditionPriority(primaryCondition) {
  if (!primaryCondition) {
    return createRuleResult(
      'ELIG-004',
      'Primary Condition Priority',
      false,
      RULE_SEVERITY.WARNING,
      'No primary condition could be determined',
      null
    );
  }

  const highPriority = primaryCondition.priority <= 2;
  return createRuleResult(
    'ELIG-004',
    'Primary Condition Priority',
    true,
    highPriority ? RULE_SEVERITY.INFO : RULE_SEVERITY.WARNING,
    highPriority
      ? `Primary condition ${primaryCondition.code} has high priority (${primaryCondition.priority})`
      : `Primary condition ${primaryCondition.code} has lower priority (${primaryCondition.priority}). Additional documentation may be required.`,
    {
      code: primaryCondition.code,
      category: primaryCondition.category,
      priority: primaryCondition.priority,
    }
  );
}

/**
 * Rule: Check for multiple chronic conditions (comorbidity).
 * @param {Object[]} conditionSummary - Condition summary array
 * @returns {RuleResult}
 */
function ruleMultipleChronicConditions(conditionSummary) {
  const eligibleCategories = conditionSummary.filter((c) => c.hasEligibleCode);
  const hasMultiple = eligibleCategories.length > 1;

  return createRuleResult(
    'ELIG-005',
    'Multiple Chronic Conditions',
    true,
    hasMultiple ? RULE_SEVERITY.INFO : RULE_SEVERITY.INFO,
    hasMultiple
      ? `Member has ${eligibleCategories.length} chronic condition categories. Enhanced care coordination recommended.`
      : `Member has ${eligibleCategories.length} chronic condition category identified.`,
    {
      categoryCount: eligibleCategories.length,
      categories: eligibleCategories.map((c) => c.category),
    }
  );
}

/**
 * Rule: Warn if any invalid codes were provided.
 * @param {string[]} invalidCodes - Array of invalid codes
 * @returns {RuleResult}
 */
function ruleInvalidCodesWarning(invalidCodes) {
  const hasInvalid = invalidCodes.length > 0;
  return createRuleResult(
    'ELIG-006',
    'Invalid Code Warning',
    !hasInvalid,
    hasInvalid ? RULE_SEVERITY.WARNING : RULE_SEVERITY.INFO,
    hasInvalid
      ? `${invalidCodes.length} unrecognized ICD-10 code(s): ${invalidCodes.join(', ')}. These codes were not evaluated.`
      : 'All provided codes are recognized in the system.',
    { invalidCodes }
  );
}

/**
 * Rule: Warn if any codes are recognized but not CSNP-eligible.
 * @param {string[]} ineligibleCodes - Array of ineligible codes
 * @returns {RuleResult}
 */
function ruleIneligibleCodesWarning(ineligibleCodes) {
  const hasIneligible = ineligibleCodes.length > 0;
  return createRuleResult(
    'ELIG-007',
    'Non-Eligible Code Notice',
    true,
    hasIneligible ? RULE_SEVERITY.WARNING : RULE_SEVERITY.INFO,
    hasIneligible
      ? `${ineligibleCodes.length} code(s) are recognized but not CSNP-eligible: ${ineligibleCodes.join(', ')}`
      : 'All recognized codes are CSNP-eligible.',
    { ineligibleCodes }
  );
}

// ─── Benefit Rules ──────────────────────────────────────────────────────────

/**
 * Rule: Condition category must be supported by the plan type.
 * @param {string} conditionCategory - Condition category
 * @param {string} planType - Plan type
 * @returns {RuleResult}
 */
function rulePlanTypeSupportsCondition(conditionCategory, planType) {
  if (planType !== PLAN_TYPES.C_SNP) {
    return createRuleResult(
      'BEN-001',
      'Plan Type Validation',
      false,
      RULE_SEVERITY.ERROR,
      `Plan type "${planType}" is not a C-SNP plan. Only C-SNP plans support chronic condition eligibility.`,
      { conditionCategory, planType }
    );
  }

  return createRuleResult(
    'BEN-001',
    'Plan Type Validation',
    true,
    RULE_SEVERITY.INFO,
    `Plan type "${planType}" supports chronic condition enrollment.`,
    { conditionCategory, planType }
  );
}

/**
 * Rule: A matching benefit package must exist for the condition category.
 * @param {string} conditionCategory - Condition category
 * @param {Object[]} packages - Available benefit packages
 * @returns {RuleResult}
 */
function ruleBenefitPackageExists(conditionCategory, packages) {
  const matching = packages.filter(
    (pkg) =>
      Array.isArray(pkg.eligibleConditionCategories) &&
      pkg.eligibleConditionCategories.includes(conditionCategory)
  );

  const passed = matching.length > 0;
  return createRuleResult(
    'BEN-002',
    'Benefit Package Availability',
    passed,
    passed ? RULE_SEVERITY.INFO : RULE_SEVERITY.ERROR,
    passed
      ? `${matching.length} benefit package(s) available for condition category "${CONDITION_CATEGORY_LABELS[conditionCategory] || conditionCategory}"`
      : `No benefit packages available for condition category "${CONDITION_CATEGORY_LABELS[conditionCategory] || conditionCategory}"`,
    { matchingCount: matching.length, conditionCategory }
  );
}

/**
 * Rule: Benefit package must be within its effective date range.
 * @param {Object[]} packages - Matching benefit packages
 * @returns {RuleResult}
 */
function ruleBenefitPackageEffective(packages) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activePackages = packages.filter((pkg) => {
    if (!pkg.effectiveDate || !pkg.terminationDate) {
      return true;
    }

    try {
      const effective = new Date(pkg.effectiveDate + 'T00:00:00');
      const termination = new Date(pkg.terminationDate + 'T23:59:59');
      return today.getTime() >= effective.getTime() && today.getTime() <= termination.getTime();
    } catch {
      return false;
    }
  });

  const passed = activePackages.length > 0;
  return createRuleResult(
    'BEN-003',
    'Benefit Package Effective Date',
    passed,
    passed ? RULE_SEVERITY.INFO : RULE_SEVERITY.WARNING,
    passed
      ? `${activePackages.length} active benefit package(s) within effective date range`
      : 'No benefit packages are currently within their effective date range',
    { activeCount: activePackages.length, totalCount: packages.length }
  );
}

/**
 * Rule: Recommend the best benefit package based on premium and out-of-pocket costs.
 * @param {Object[]} matchingPackages - Matching benefit packages
 * @returns {{ ruleResult: RuleResult, recommendedPackage: Object|null }}
 */
function ruleBenefitPackageRecommendation(matchingPackages) {
  if (matchingPackages.length === 0) {
    return {
      ruleResult: createRuleResult(
        'BEN-004',
        'Package Recommendation',
        false,
        RULE_SEVERITY.WARNING,
        'No packages available for recommendation',
        null
      ),
      recommendedPackage: null,
    };
  }

  // Sort by: lowest premium first, then lowest max out-of-pocket
  const sorted = [...matchingPackages].sort((a, b) => {
    const premiumDiff = (a.monthlyPremium || 0) - (b.monthlyPremium || 0);
    if (premiumDiff !== 0) {
      return premiumDiff;
    }
    return (a.maxOutOfPocket || 0) - (b.maxOutOfPocket || 0);
  });

  const recommended = sorted[0];

  return {
    ruleResult: createRuleResult(
      'BEN-004',
      'Package Recommendation',
      true,
      RULE_SEVERITY.INFO,
      `Recommended package: "${recommended.name}" (Monthly premium: $${recommended.monthlyPremium || 0}, Max OOP: $${recommended.maxOutOfPocket || 0})`,
      {
        packageId: recommended.id,
        packageName: recommended.name,
        monthlyPremium: recommended.monthlyPremium,
        maxOutOfPocket: recommended.maxOutOfPocket,
      }
    ),
    recommendedPackage: recommended,
  };
}

// ─── Claim Rules ────────────────────────────────────────────────────────────

/**
 * Rule: Claim must have valid required fields.
 * @param {Object} claim - The claim object
 * @returns {RuleResult}
 */
function ruleClaimRequiredFields(claim) {
  const missingFields = [];

  if (!claim.memberId) {
    missingFields.push('memberId');
  }
  if (!claim.providerId) {
    missingFields.push('providerId');
  }
  if (!claim.enrollmentId) {
    missingFields.push('enrollmentId');
  }
  if (!claim.serviceDate) {
    missingFields.push('serviceDate');
  }
  if (!Array.isArray(claim.diagnosisCodes) || claim.diagnosisCodes.length === 0) {
    missingFields.push('diagnosisCodes');
  }
  if (claim.billedAmount === undefined || claim.billedAmount === null || claim.billedAmount <= 0) {
    missingFields.push('billedAmount');
  }

  const passed = missingFields.length === 0;
  return createRuleResult(
    'CLM-001',
    'Required Fields Validation',
    passed,
    passed ? RULE_SEVERITY.INFO : RULE_SEVERITY.ERROR,
    passed
      ? 'All required claim fields are present'
      : `Missing or invalid required fields: ${missingFields.join(', ')}`,
    { missingFields }
  );
}

/**
 * Rule: Claim diagnosis codes must be valid ICD-10 codes.
 * @param {Object} claim - The claim object
 * @returns {RuleResult}
 */
function ruleClaimDiagnosisCodes(claim) {
  if (!Array.isArray(claim.diagnosisCodes) || claim.diagnosisCodes.length === 0) {
    return createRuleResult(
      'CLM-002',
      'Diagnosis Code Validation',
      false,
      RULE_SEVERITY.ERROR,
      'No diagnosis codes provided on claim',
      null
    );
  }

  const invalidCodes = [];
  const validCodes = [];

  for (const code of claim.diagnosisCodes) {
    if (typeof code !== 'string' || code.trim().length === 0) {
      invalidCodes.push(code || '');
      continue;
    }

    const trimmed = code.trim().toUpperCase();
    const entry = getCodeByICD10(trimmed);
    if (entry) {
      validCodes.push(trimmed);
    } else {
      invalidCodes.push(trimmed);
    }
  }

  const passed = validCodes.length > 0;
  return createRuleResult(
    'CLM-002',
    'Diagnosis Code Validation',
    passed,
    passed ? (invalidCodes.length > 0 ? RULE_SEVERITY.WARNING : RULE_SEVERITY.INFO) : RULE_SEVERITY.ERROR,
    passed
      ? `${validCodes.length} valid diagnosis code(s) on claim${invalidCodes.length > 0 ? `. ${invalidCodes.length} unrecognized code(s).` : ''}`
      : 'No valid diagnosis codes found on claim',
    { validCodes, invalidCodes }
  );
}

/**
 * Rule: Member must have an active enrollment.
 * @param {Object} claim - The claim object
 * @returns {RuleResult}
 */
function ruleClaimActiveEnrollment(claim) {
  const enrollments = getEnrollments();
  const memberEnrollment = enrollments.find(
    (e) => e.id === claim.enrollmentId && e.memberId === claim.memberId
  );

  if (!memberEnrollment) {
    return createRuleResult(
      'CLM-003',
      'Active Enrollment Verification',
      false,
      RULE_SEVERITY.ERROR,
      'No matching enrollment found for this claim',
      { enrollmentId: claim.enrollmentId, memberId: claim.memberId }
    );
  }

  const isActive = memberEnrollment.status === 'active' || memberEnrollment.status === 'approved';
  return createRuleResult(
    'CLM-003',
    'Active Enrollment Verification',
    isActive,
    isActive ? RULE_SEVERITY.INFO : RULE_SEVERITY.ERROR,
    isActive
      ? `Member has ${memberEnrollment.status} enrollment (${memberEnrollment.id})`
      : `Member enrollment status is "${memberEnrollment.status}". Claim cannot be processed for non-active enrollments.`,
    { enrollmentId: memberEnrollment.id, enrollmentStatus: memberEnrollment.status }
  );
}

/**
 * Rule: Service date must be within enrollment effective period.
 * @param {Object} claim - The claim object
 * @returns {RuleResult}
 */
function ruleClaimServiceDateInRange(claim) {
  if (!claim.serviceDate) {
    return createRuleResult(
      'CLM-004',
      'Service Date Range',
      false,
      RULE_SEVERITY.ERROR,
      'Service date is missing from claim',
      null
    );
  }

  const enrollments = getEnrollments();
  const enrollment = enrollments.find(
    (e) => e.id === claim.enrollmentId
  );

  if (!enrollment || !enrollment.effectiveDate) {
    return createRuleResult(
      'CLM-004',
      'Service Date Range',
      true,
      RULE_SEVERITY.WARNING,
      'Unable to verify service date against enrollment period. Enrollment data not found.',
      null
    );
  }

  try {
    const serviceDate = new Date(claim.serviceDate + 'T00:00:00');
    const effectiveDate = new Date(enrollment.effectiveDate + 'T00:00:00');

    if (isNaN(serviceDate.getTime()) || isNaN(effectiveDate.getTime())) {
      return createRuleResult(
        'CLM-004',
        'Service Date Range',
        false,
        RULE_SEVERITY.WARNING,
        'Unable to parse service date or enrollment effective date',
        null
      );
    }

    const isAfterEffective = serviceDate.getTime() >= effectiveDate.getTime();

    let isBeforeTermination = true;
    if (enrollment.terminationDate) {
      const terminationDate = new Date(enrollment.terminationDate + 'T23:59:59');
      if (!isNaN(terminationDate.getTime())) {
        isBeforeTermination = serviceDate.getTime() <= terminationDate.getTime();
      }
    }

    const passed = isAfterEffective && isBeforeTermination;
    return createRuleResult(
      'CLM-004',
      'Service Date Range',
      passed,
      passed ? RULE_SEVERITY.INFO : RULE_SEVERITY.ERROR,
      passed
        ? 'Service date is within enrollment effective period'
        : 'Service date is outside the enrollment effective period. Claim may be denied.',
      {
        serviceDate: claim.serviceDate,
        effectiveDate: enrollment.effectiveDate,
        terminationDate: enrollment.terminationDate || null,
      }
    );
  } catch {
    return createRuleResult(
      'CLM-004',
      'Service Date Range',
      false,
      RULE_SEVERITY.WARNING,
      'Error validating service date range',
      null
    );
  }
}

/**
 * Rule: Calculate allowed amount based on benefit rules.
 * @param {Object} claim - The claim object
 * @param {Object|null} benefits - The benefit details object
 * @returns {{ ruleResult: RuleResult, allowedAmount: number, memberResponsibility: number, paidAmount: number }}
 */
function ruleClaimAmountCalculation(claim, benefits) {
  const billedAmount = typeof claim.billedAmount === 'number' ? claim.billedAmount : 0;

  if (billedAmount <= 0) {
    return {
      ruleResult: createRuleResult(
        'CLM-005',
        'Amount Calculation',
        false,
        RULE_SEVERITY.ERROR,
        'Billed amount must be greater than zero',
        { billedAmount }
      ),
      allowedAmount: 0,
      memberResponsibility: 0,
      paidAmount: 0,
    };
  }

  // Default allowed rate: 80% of billed amount
  let allowedRate = 0.80;
  let copay = 0;
  let coinsurance = 0;

  // Try to determine benefit-specific rates
  if (benefits && typeof benefits === 'object') {
    // Check for specialist visit benefit as a common default
    if (benefits.specialistVisit) {
      copay = benefits.specialistVisit.copay || 0;
      coinsurance = benefits.specialistVisit.coinsurance || 0;
    }

    // Check for specific service type benefits based on diagnosis codes
    if (Array.isArray(claim.diagnosisCodes)) {
      for (const code of claim.diagnosisCodes) {
        if (typeof code !== 'string') {
          continue;
        }
        const trimmed = code.trim().toUpperCase();
        const entry = getCodeByICD10(trimmed);
        if (!entry) {
          continue;
        }

        // Map condition categories to specific benefit types
        if (entry.category === CONDITION_CATEGORIES.DIABETES && benefits.diabetesSupplies) {
          copay = benefits.diabetesSupplies.copay || 0;
          coinsurance = benefits.diabetesSupplies.coinsurance || 0;
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.ESRD && benefits.dialysis) {
          copay = benefits.dialysis.copay || 0;
          coinsurance = benefits.dialysis.coinsurance || 0;
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.HEART_FAILURE && benefits.cardiacRehab) {
          copay = benefits.cardiacRehab.copay || 0;
          coinsurance = benefits.cardiacRehab.coinsurance || 0;
          break;
        }
        if ((entry.category === CONDITION_CATEGORIES.COPD || entry.category === CONDITION_CATEGORIES.RESPIRATORY) && benefits.pulmonaryRehab) {
          copay = benefits.pulmonaryRehab.copay || 0;
          coinsurance = benefits.pulmonaryRehab.coinsurance || 0;
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.CANCER && benefits.chemotherapy) {
          copay = benefits.chemotherapy.copay || 0;
          coinsurance = benefits.chemotherapy.coinsurance || 0;
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.DEMENTIA && benefits.adultDayCare) {
          copay = benefits.adultDayCare.copay || 0;
          coinsurance = benefits.adultDayCare.coinsurance || 0;
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.MENTAL_HEALTH && benefits.mentalHealth) {
          copay = benefits.mentalHealth.copay || 0;
          coinsurance = benefits.mentalHealth.coinsurance || 0;
          break;
        }
      }
    }
  }

  const allowedAmount = Math.round(billedAmount * allowedRate * 100) / 100;
  const coinsuranceAmount = Math.round(allowedAmount * (coinsurance / 100) * 100) / 100;
  const memberResponsibility = Math.round((copay + coinsuranceAmount) * 100) / 100;
  const paidAmount = Math.round(Math.max(0, allowedAmount - memberResponsibility) * 100) / 100;

  return {
    ruleResult: createRuleResult(
      'CLM-005',
      'Amount Calculation',
      true,
      RULE_SEVERITY.INFO,
      `Billed: $${billedAmount.toFixed(2)}, Allowed: $${allowedAmount.toFixed(2)}, Member responsibility: $${memberResponsibility.toFixed(2)}, Paid: $${paidAmount.toFixed(2)}`,
      {
        billedAmount,
        allowedAmount,
        copay,
        coinsurance,
        coinsuranceAmount,
        memberResponsibility,
        paidAmount,
      }
    ),
    allowedAmount,
    memberResponsibility,
    paidAmount,
  };
}

/**
 * Rule: Check for duplicate claims (same member, provider, service date).
 * @param {Object} claim - The claim object
 * @returns {RuleResult}
 */
function ruleClaimDuplicateCheck(claim) {
  const claims = getItem('csnp_claims', []);
  if (!Array.isArray(claims)) {
    return createRuleResult(
      'CLM-006',
      'Duplicate Claim Check',
      true,
      RULE_SEVERITY.INFO,
      'No existing claims to check for duplicates',
      null
    );
  }

  const duplicates = claims.filter(
    (existing) =>
      existing.memberId === claim.memberId &&
      existing.providerId === claim.providerId &&
      existing.serviceDate === claim.serviceDate &&
      existing.id !== claim.id
  );

  const hasDuplicates = duplicates.length > 0;
  return createRuleResult(
    'CLM-006',
    'Duplicate Claim Check',
    !hasDuplicates,
    hasDuplicates ? RULE_SEVERITY.WARNING : RULE_SEVERITY.INFO,
    hasDuplicates
      ? `${duplicates.length} potential duplicate claim(s) found for same member, provider, and service date`
      : 'No duplicate claims detected',
    {
      duplicateCount: duplicates.length,
      duplicateIds: duplicates.map((d) => d.id),
    }
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Evaluates eligibility rules against a set of diagnosis codes.
 * Runs all eligibility rules and returns a comprehensive result.
 *
 * @param {string[]} diagnoses - Array of ICD-10 diagnosis codes
 * @param {Object} [options={}] - Evaluation options
 * @param {string} [options.performedBy] - User ID performing the evaluation
 * @param {boolean} [options.auditLog=true] - Whether to log to audit trail
 * @returns {EligibilityRuleResult} The eligibility evaluation result
 */
export function evaluateEligibilityRules(diagnoses, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const shouldAuditLog = options && options.auditLog === false ? false : true;

  const result = {
    eligible: false,
    primaryConditionCode: null,
    primaryConditionCategory: null,
    primaryConditionCategoryLabel: null,
    ruleResults: [],
    eligibleCodes: [],
    ineligibleCodes: [],
    invalidCodes: [],
    conditionSummary: [],
    timestamp,
  };

  try {
    // Rule 1: Has diagnosis codes
    const hasCodes = ruleHasDiagnosisCodes(diagnoses);
    result.ruleResults.push(hasCodes);

    if (!hasCodes.passed) {
      if (shouldAuditLog) {
        logAction(
          AUDIT_ACTIONS.APPROVE,
          performedBy,
          {
            targetType: 'eligibility_rule_evaluation',
            targetId: '',
            description: 'Eligibility rule evaluation failed: no diagnosis codes provided',
            metadata: { eligible: false, ruleResults: result.ruleResults.length },
            ipAddress: '127.0.0.1',
          },
          'ruleEngine'
        );
      }
      return result;
    }

    // Classify codes
    const { eligibleCodes, ineligibleCodes, invalidCodes, codeEntries } = classifyCodes(diagnoses);
    result.eligibleCodes = eligibleCodes;
    result.ineligibleCodes = ineligibleCodes;
    result.invalidCodes = invalidCodes;

    // Rule 2: Has valid codes
    const hasValid = ruleHasValidCodes(invalidCodes, diagnoses);
    result.ruleResults.push(hasValid);

    // Rule 3: Has CSNP-eligible code
    const hasEligible = ruleHasCSNPEligibleCode(eligibleCodes);
    result.ruleResults.push(hasEligible);

    // Determine primary condition
    const primaryCondition = determinePrimaryCondition(codeEntries);

    // Rule 4: Primary condition priority
    const priorityRule = rulePrimaryConditionPriority(primaryCondition);
    result.ruleResults.push(priorityRule);

    // Build condition summary
    const conditionSummary = buildConditionSummary(codeEntries);
    result.conditionSummary = conditionSummary;

    // Rule 5: Multiple chronic conditions
    const multipleConditions = ruleMultipleChronicConditions(conditionSummary);
    result.ruleResults.push(multipleConditions);

    // Rule 6: Invalid codes warning
    const invalidWarning = ruleInvalidCodesWarning(invalidCodes);
    result.ruleResults.push(invalidWarning);

    // Rule 7: Ineligible codes warning
    const ineligibleWarning = ruleIneligibleCodesWarning(ineligibleCodes);
    result.ruleResults.push(ineligibleWarning);

    // Determine overall eligibility
    const hasErrors = result.ruleResults.some(
      (r) => !r.passed && r.severity === RULE_SEVERITY.ERROR
    );
    result.eligible = !hasErrors && eligibleCodes.length > 0;

    // Set primary condition
    if (primaryCondition) {
      result.primaryConditionCode = primaryCondition.code;
      result.primaryConditionCategory = primaryCondition.category;
      result.primaryConditionCategoryLabel =
        CONDITION_CATEGORY_LABELS[primaryCondition.category] || primaryCondition.category;
    }

    // Audit log
    if (shouldAuditLog) {
      logAction(
        AUDIT_ACTIONS.APPROVE,
        performedBy,
        {
          targetType: 'eligibility_rule_evaluation',
          targetId: '',
          description: result.eligible
            ? `Eligibility rules passed. Primary condition: ${result.primaryConditionCode || 'N/A'}`
            : 'Eligibility rules evaluation: member not eligible',
          metadata: {
            eligible: result.eligible,
            primaryConditionCode: result.primaryConditionCode,
            eligibleCodesCount: eligibleCodes.length,
            rulesPassed: result.ruleResults.filter((r) => r.passed).length,
            rulesFailed: result.ruleResults.filter((r) => !r.passed).length,
          },
          ipAddress: '127.0.0.1',
        },
        'ruleEngine'
      );
    }

    return result;
  } catch (error) {
    console.error('ruleEngine.evaluateEligibilityRules: unexpected error:', error);
    return result;
  }
}

/**
 * Evaluates benefit assignment rules for a condition category and plan type.
 * Determines which benefit packages are available and recommends the best match.
 *
 * @param {string} condition - Condition category from CONDITION_CATEGORIES
 * @param {string} planType - Plan type from PLAN_TYPES
 * @param {Object} [options={}] - Evaluation options
 * @param {string} [options.performedBy] - User ID performing the evaluation
 * @param {boolean} [options.auditLog=true] - Whether to log to audit trail
 * @returns {BenefitRuleResult} The benefit evaluation result
 */
export function evaluateBenefitRules(condition, planType, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const shouldAuditLog = options && options.auditLog === false ? false : true;

  const result = {
    eligible: false,
    recommendedPackageId: null,
    recommendedPackageName: null,
    ruleResults: [],
    matchingPackages: [],
    timestamp,
  };

  try {
    if (typeof condition !== 'string' || condition.trim().length === 0) {
      result.ruleResults.push(
        createRuleResult(
          'BEN-000',
          'Condition Category Required',
          false,
          RULE_SEVERITY.ERROR,
          'Condition category is required for benefit evaluation',
          null
        )
      );
      return result;
    }

    if (typeof planType !== 'string' || planType.trim().length === 0) {
      result.ruleResults.push(
        createRuleResult(
          'BEN-000',
          'Plan Type Required',
          false,
          RULE_SEVERITY.ERROR,
          'Plan type is required for benefit evaluation',
          null
        )
      );
      return result;
    }

    const conditionCategory = condition.trim();
    const plan = planType.trim();

    // Rule 1: Plan type supports condition
    const planTypeRule = rulePlanTypeSupportsCondition(conditionCategory, plan);
    result.ruleResults.push(planTypeRule);

    if (!planTypeRule.passed) {
      if (shouldAuditLog) {
        logAction(
          AUDIT_ACTIONS.APPROVE,
          performedBy,
          {
            targetType: 'benefit_rule_evaluation',
            targetId: '',
            description: `Benefit rule evaluation failed: plan type "${plan}" does not support chronic conditions`,
            metadata: { conditionCategory, planType: plan, eligible: false },
            ipAddress: '127.0.0.1',
          },
          'ruleEngine'
        );
      }
      return result;
    }

    // Get benefit packages
    const packages = getBenefitPackages();

    // Rule 2: Benefit package exists for condition
    const packageExistsRule = ruleBenefitPackageExists(conditionCategory, packages);
    result.ruleResults.push(packageExistsRule);

    // Get matching packages
    const matchingPackages = packages.filter(
      (pkg) =>
        Array.isArray(pkg.eligibleConditionCategories) &&
        pkg.eligibleConditionCategories.includes(conditionCategory) &&
        pkg.planType === plan
    );
    result.matchingPackages = matchingPackages;

    if (matchingPackages.length === 0) {
      if (shouldAuditLog) {
        logAction(
          AUDIT_ACTIONS.APPROVE,
          performedBy,
          {
            targetType: 'benefit_rule_evaluation',
            targetId: '',
            description: `No matching benefit packages for condition "${conditionCategory}" and plan type "${plan}"`,
            metadata: { conditionCategory, planType: plan, eligible: false },
            ipAddress: '127.0.0.1',
          },
          'ruleEngine'
        );
      }
      return result;
    }

    // Rule 3: Benefit package effective date
    const effectiveRule = ruleBenefitPackageEffective(matchingPackages);
    result.ruleResults.push(effectiveRule);

    // Rule 4: Package recommendation
    const { ruleResult: recommendationRule, recommendedPackage } =
      ruleBenefitPackageRecommendation(matchingPackages);
    result.ruleResults.push(recommendationRule);

    if (recommendedPackage) {
      result.recommendedPackageId = recommendedPackage.id;
      result.recommendedPackageName = recommendedPackage.name;
    }

    // Determine overall eligibility
    const hasErrors = result.ruleResults.some(
      (r) => !r.passed && r.severity === RULE_SEVERITY.ERROR
    );
    result.eligible = !hasErrors && matchingPackages.length > 0;

    // Audit log
    if (shouldAuditLog) {
      logAction(
        AUDIT_ACTIONS.APPROVE,
        performedBy,
        {
          targetType: 'benefit_rule_evaluation',
          targetId: result.recommendedPackageId || '',
          description: result.eligible
            ? `Benefit rules passed. Recommended package: "${result.recommendedPackageName || 'N/A'}"`
            : 'Benefit rules evaluation: no eligible packages found',
          metadata: {
            conditionCategory,
            planType: plan,
            eligible: result.eligible,
            matchingPackagesCount: matchingPackages.length,
            recommendedPackageId: result.recommendedPackageId,
          },
          ipAddress: '127.0.0.1',
        },
        'ruleEngine'
      );
    }

    return result;
  } catch (error) {
    console.error('ruleEngine.evaluateBenefitRules: unexpected error:', error);
    return result;
  }
}

/**
 * Evaluates claims adjudication rules against a claim and its associated benefits.
 * Determines whether a claim should be approved, denied, or flagged for review.
 *
 * @param {Object} claim - The claim object
 * @param {string} claim.id - Claim ID
 * @param {string} claim.memberId - Member ID
 * @param {string} claim.providerId - Provider ID
 * @param {string} claim.enrollmentId - Enrollment ID
 * @param {string} claim.serviceDate - Service date (YYYY-MM-DD)
 * @param {string[]} claim.diagnosisCodes - ICD-10 diagnosis codes
 * @param {string} claim.serviceDescription - Service description
 * @param {number} claim.billedAmount - Billed amount
 * @param {Object|null} [benefits=null] - The benefit details object from the benefit package
 * @param {Object} [options={}] - Evaluation options
 * @param {string} [options.performedBy] - User ID performing the evaluation
 * @param {boolean} [options.auditLog=true] - Whether to log to audit trail
 * @returns {ClaimRuleResult} The claim evaluation result
 */
export function evaluateClaimRules(claim, benefits, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const shouldAuditLog = options && options.auditLog === false ? false : true;

  const result = {
    approved: false,
    recommendedStatus: CLAIM_STATUSES.DENIED,
    allowedAmount: 0,
    memberResponsibility: 0,
    paidAmount: 0,
    ruleResults: [],
    denialReasons: [],
    timestamp,
  };

  try {
    if (!claim || typeof claim !== 'object') {
      result.ruleResults.push(
        createRuleResult(
          'CLM-000',
          'Claim Data Required',
          false,
          RULE_SEVERITY.ERROR,
          'Claim data is required for adjudication',
          null
        )
      );
      result.denialReasons.push('Claim data is missing');
      return result;
    }

    // Rule 1: Required fields
    const requiredFieldsRule = ruleClaimRequiredFields(claim);
    result.ruleResults.push(requiredFieldsRule);
    if (!requiredFieldsRule.passed) {
      result.denialReasons.push(requiredFieldsRule.message);
    }

    // Rule 2: Diagnosis codes validation
    const diagnosisRule = ruleClaimDiagnosisCodes(claim);
    result.ruleResults.push(diagnosisRule);
    if (!diagnosisRule.passed) {
      result.denialReasons.push(diagnosisRule.message);
    }

    // Rule 3: Active enrollment
    const enrollmentRule = ruleClaimActiveEnrollment(claim);
    result.ruleResults.push(enrollmentRule);
    if (!enrollmentRule.passed) {
      result.denialReasons.push(enrollmentRule.message);
    }

    // Rule 4: Service date in range
    const serviceDateRule = ruleClaimServiceDateInRange(claim);
    result.ruleResults.push(serviceDateRule);
    if (!serviceDateRule.passed && serviceDateRule.severity === RULE_SEVERITY.ERROR) {
      result.denialReasons.push(serviceDateRule.message);
    }

    // Rule 5: Amount calculation
    const {
      ruleResult: amountRule,
      allowedAmount,
      memberResponsibility,
      paidAmount,
    } = ruleClaimAmountCalculation(claim, benefits);
    result.ruleResults.push(amountRule);
    result.allowedAmount = allowedAmount;
    result.memberResponsibility = memberResponsibility;
    result.paidAmount = paidAmount;

    if (!amountRule.passed) {
      result.denialReasons.push(amountRule.message);
    }

    // Rule 6: Duplicate check
    const duplicateRule = ruleClaimDuplicateCheck(claim);
    result.ruleResults.push(duplicateRule);
    if (!duplicateRule.passed) {
      result.denialReasons.push(duplicateRule.message);
    }

    // Determine overall claim status
    const errorRules = result.ruleResults.filter(
      (r) => !r.passed && r.severity === RULE_SEVERITY.ERROR
    );
    const warningRules = result.ruleResults.filter(
      (r) => !r.passed && r.severity === RULE_SEVERITY.WARNING
    );

    if (errorRules.length > 0) {
      result.approved = false;
      result.recommendedStatus = CLAIM_STATUSES.DENIED;
      result.allowedAmount = 0;
      result.memberResponsibility = 0;
      result.paidAmount = 0;
    } else if (warningRules.length > 0) {
      result.approved = false;
      result.recommendedStatus = CLAIM_STATUSES.IN_REVIEW;
      // Keep calculated amounts for review
    } else {
      result.approved = true;
      result.recommendedStatus = CLAIM_STATUSES.APPROVED;
      result.denialReasons = [];
    }

    // Audit log
    if (shouldAuditLog) {
      logAction(
        result.approved ? AUDIT_ACTIONS.CLAIM_APPROVE : AUDIT_ACTIONS.CLAIM_DENY,
        performedBy,
        {
          targetType: 'claim_rule_evaluation',
          targetId: claim.id || '',
          description: result.approved
            ? `Claim rules passed. Recommended status: ${result.recommendedStatus}. Paid amount: $${result.paidAmount.toFixed(2)}`
            : `Claim rules evaluation: ${result.recommendedStatus}. ${result.denialReasons.length} issue(s) found.`,
          metadata: {
            claimId: claim.id,
            memberId: claim.memberId,
            approved: result.approved,
            recommendedStatus: result.recommendedStatus,
            allowedAmount: result.allowedAmount,
            paidAmount: result.paidAmount,
            denialReasons: result.denialReasons,
            rulesPassed: result.ruleResults.filter((r) => r.passed).length,
            rulesFailed: result.ruleResults.filter((r) => !r.passed).length,
          },
          ipAddress: '127.0.0.1',
        },
        'ruleEngine'
      );
    }

    return result;
  } catch (error) {
    console.error('ruleEngine.evaluateClaimRules: unexpected error:', error);
    return result;
  }
}

/**
 * Returns all available eligibility rule definitions.
 * Useful for displaying rule documentation in the UI.
 * @returns {{ ruleId: string, ruleName: string, category: string, description: string, severity: string }[]}
 */
export function getEligibilityRuleDefinitions() {
  return [
    {
      ruleId: 'ELIG-001',
      ruleName: 'Diagnosis Codes Required',
      category: RULE_CATEGORIES.ELIGIBILITY,
      description: 'At least one ICD-10 diagnosis code must be provided for eligibility evaluation.',
      severity: RULE_SEVERITY.ERROR,
    },
    {
      ruleId: 'ELIG-002',
      ruleName: 'Valid ICD-10 Codes',
      category: RULE_CATEGORIES.ELIGIBILITY,
      description: 'At least one provided diagnosis code must be a recognized ICD-10-CM code.',
      severity: RULE_SEVERITY.ERROR,
    },
    {
      ruleId: 'ELIG-003',
      ruleName: 'CSNP-Eligible Condition',
      category: RULE_CATEGORIES.ELIGIBILITY,
      description: 'At least one diagnosis code must qualify for C-SNP enrollment.',
      severity: RULE_SEVERITY.ERROR,
    },
    {
      ruleId: 'ELIG-004',
      ruleName: 'Primary Condition Priority',
      category: RULE_CATEGORIES.ELIGIBILITY,
      description: 'The primary condition should have a high priority ranking (1-2) for strongest eligibility.',
      severity: RULE_SEVERITY.WARNING,
    },
    {
      ruleId: 'ELIG-005',
      ruleName: 'Multiple Chronic Conditions',
      category: RULE_CATEGORIES.ELIGIBILITY,
      description: 'Identifies members with multiple chronic condition categories for enhanced care coordination.',
      severity: RULE_SEVERITY.INFO,
    },
    {
      ruleId: 'ELIG-006',
      ruleName: 'Invalid Code Warning',
      category: RULE_CATEGORIES.ELIGIBILITY,
      description: 'Warns when unrecognized ICD-10 codes are provided.',
      severity: RULE_SEVERITY.WARNING,
    },
    {
      ruleId: 'ELIG-007',
      ruleName: 'Non-Eligible Code Notice',
      category: RULE_CATEGORIES.ELIGIBILITY,
      description: 'Identifies recognized codes that are not eligible for C-SNP enrollment.',
      severity: RULE_SEVERITY.WARNING,
    },
  ];
}

/**
 * Returns all available benefit rule definitions.
 * @returns {{ ruleId: string, ruleName: string, category: string, description: string, severity: string }[]}
 */
export function getBenefitRuleDefinitions() {
  return [
    {
      ruleId: 'BEN-001',
      ruleName: 'Plan Type Validation',
      category: RULE_CATEGORIES.BENEFIT,
      description: 'Validates that the plan type supports chronic condition enrollment.',
      severity: RULE_SEVERITY.ERROR,
    },
    {
      ruleId: 'BEN-002',
      ruleName: 'Benefit Package Availability',
      category: RULE_CATEGORIES.BENEFIT,
      description: 'Checks that at least one benefit package exists for the condition category.',
      severity: RULE_SEVERITY.ERROR,
    },
    {
      ruleId: 'BEN-003',
      ruleName: 'Benefit Package Effective Date',
      category: RULE_CATEGORIES.BENEFIT,
      description: 'Validates that matching benefit packages are within their effective date range.',
      severity: RULE_SEVERITY.WARNING,
    },
    {
      ruleId: 'BEN-004',
      ruleName: 'Package Recommendation',
      category: RULE_CATEGORIES.BENEFIT,
      description: 'Recommends the best benefit package based on premium and out-of-pocket costs.',
      severity: RULE_SEVERITY.INFO,
    },
  ];
}

/**
 * Returns all available claim rule definitions.
 * @returns {{ ruleId: string, ruleName: string, category: string, description: string, severity: string }[]}
 */
export function getClaimRuleDefinitions() {
  return [
    {
      ruleId: 'CLM-001',
      ruleName: 'Required Fields Validation',
      category: RULE_CATEGORIES.CLAIM,
      description: 'Validates that all required claim fields are present and valid.',
      severity: RULE_SEVERITY.ERROR,
    },
    {
      ruleId: 'CLM-002',
      ruleName: 'Diagnosis Code Validation',
      category: RULE_CATEGORIES.CLAIM,
      description: 'Validates that claim diagnosis codes are recognized ICD-10-CM codes.',
      severity: RULE_SEVERITY.ERROR,
    },
    {
      ruleId: 'CLM-003',
      ruleName: 'Active Enrollment Verification',
      category: RULE_CATEGORIES.CLAIM,
      description: 'Verifies that the member has an active enrollment for claim processing.',
      severity: RULE_SEVERITY.ERROR,
    },
    {
      ruleId: 'CLM-004',
      ruleName: 'Service Date Range',
      category: RULE_CATEGORIES.CLAIM,
      description: 'Validates that the service date falls within the enrollment effective period.',
      severity: RULE_SEVERITY.ERROR,
    },
    {
      ruleId: 'CLM-005',
      ruleName: 'Amount Calculation',
      category: RULE_CATEGORIES.CLAIM,
      description: 'Calculates allowed amount, member responsibility, and paid amount based on benefit rules.',
      severity: RULE_SEVERITY.INFO,
    },
    {
      ruleId: 'CLM-006',
      ruleName: 'Duplicate Claim Check',
      category: RULE_CATEGORIES.CLAIM,
      description: 'Checks for potential duplicate claims with the same member, provider, and service date.',
      severity: RULE_SEVERITY.WARNING,
    },
  ];
}

/**
 * Returns all rule definitions across all categories.
 * @returns {{ ruleId: string, ruleName: string, category: string, description: string, severity: string }[]}
 */
export function getAllRuleDefinitions() {
  return [
    ...getEligibilityRuleDefinitions(),
    ...getBenefitRuleDefinitions(),
    ...getClaimRuleDefinitions(),
  ];
}

/**
 * Returns a summary of rule evaluation results.
 * @param {RuleResult[]} ruleResults - Array of rule results
 * @returns {{ total: number, passed: number, failed: number, errors: number, warnings: number, info: number }}
 */
export function summarizeRuleResults(ruleResults) {
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    warnings: 0,
    info: 0,
  };

  if (!Array.isArray(ruleResults)) {
    return summary;
  }

  summary.total = ruleResults.length;

  for (const result of ruleResults) {
    if (result.passed) {
      summary.passed++;
    } else {
      summary.failed++;
    }

    switch (result.severity) {
      case RULE_SEVERITY.ERROR:
        summary.errors++;
        break;
      case RULE_SEVERITY.WARNING:
        summary.warnings++;
        break;
      case RULE_SEVERITY.INFO:
        summary.info++;
        break;
      default:
        break;
    }
  }

  return summary;
}