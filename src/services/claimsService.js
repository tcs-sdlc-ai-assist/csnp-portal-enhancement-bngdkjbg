/**
 * Claims processing service for the CSNP Portal.
 * Provides claims initiation post-enrollment, CSNP-specific adjudication rules,
 * plan-based pricing, authorization logic, denial prevention, and audit logging.
 * @module claimsService
 */

import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem, appendToArray, findInArray, updateInArray } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { evaluateClaimRules } from './ruleEngine.js';
import {
  AUDIT_ACTIONS,
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  ENROLLMENT_STATUSES,
} from '../utils/constants.js';
import {
  validateRequired,
  validateDateFormat,
  validateDateNotFuture,
  validateICD10Codes,
  validateClaimData,
} from '../utils/validators.js';
import {
  getCodeByICD10,
  CONDITION_CATEGORIES,
  CONDITION_CATEGORY_LABELS,
} from '../data/icd10Data.js';

/**
 * localStorage key for claims collection.
 * @type {string}
 */
const CLAIMS_KEY = 'csnp_claims';

/**
 * localStorage key for members collection.
 * @type {string}
 */
const MEMBERS_KEY = 'csnp_members';

/**
 * localStorage key for enrollments collection.
 * @type {string}
 */
const ENROLLMENTS_KEY = 'csnp_enrollments';

/**
 * localStorage key for providers collection.
 * @type {string}
 */
const PROVIDERS_KEY = 'csnp_providers';

/**
 * localStorage key for benefit packages collection.
 * @type {string}
 */
const BENEFIT_PACKAGES_KEY = 'csnp_benefit_packages';

/**
 * @typedef {Object} ClaimInitiationResult
 * @property {boolean} success - Whether the claim initiation succeeded
 * @property {string|null} claimId - The created claim ID
 * @property {string|null} claimNumber - The human-readable claim number
 * @property {string} status - The claim status
 * @property {Object|null} ruleEvaluation - Rule engine evaluation result
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if initiation failed
 */

/**
 * @typedef {Object} ClaimProcessingResult
 * @property {boolean} success - Whether the claim processing succeeded
 * @property {string|null} claimId - The claim ID
 * @property {string} status - The claim status after processing
 * @property {number} allowedAmount - Calculated allowed amount
 * @property {number} paidAmount - Calculated paid amount
 * @property {number} memberResponsibility - Calculated member responsibility
 * @property {Object|null} ruleEvaluation - Rule engine evaluation result
 * @property {string[]} denialReasons - Reasons for denial if applicable
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if processing failed
 */

/**
 * @typedef {Object} ClaimStatusResult
 * @property {boolean} found - Whether the claim was found
 * @property {string|null} claimId - The claim ID
 * @property {string|null} claimNumber - The human-readable claim number
 * @property {string|null} status - The claim status
 * @property {string|null} statusLabel - Human-readable status label
 * @property {Object|null} claim - The full claim object
 * @property {string} [error] - Error message if not found
 */

// ─── Claim Number Generation ────────────────────────────────────────────────

/**
 * Generates a unique claim number.
 * @returns {string} Claim number in format CLM-YYYY-NNNNNN
 */
function generateClaimNumber() {
  const year = new Date().getFullYear();
  const sequence = String(Date.now()).slice(-6);
  return `CLM-${year}-${sequence}`;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Retrieves all claims from localStorage.
 * @returns {Object[]} Array of claim objects
 */
function getAllClaims() {
  const claims = getItem(CLAIMS_KEY, []);
  if (!Array.isArray(claims)) {
    return [];
  }
  return claims;
}

/**
 * Retrieves a member by ID from localStorage.
 * @param {string} memberId - The member ID
 * @returns {Object|null} The member object or null
 */
function getMemberById(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return null;
  }
  return findInArray(MEMBERS_KEY, (m) => m.id === memberId.trim());
}

/**
 * Retrieves a provider by ID from localStorage.
 * @param {string} providerId - The provider ID
 * @returns {Object|null} The provider object or null
 */
function getProviderById(providerId) {
  if (typeof providerId !== 'string' || providerId.trim().length === 0) {
    return null;
  }
  return findInArray(PROVIDERS_KEY, (p) => p.id === providerId.trim());
}

/**
 * Retrieves an enrollment by ID from localStorage.
 * @param {string} enrollmentId - The enrollment ID
 * @returns {Object|null} The enrollment object or null
 */
function getEnrollmentById(enrollmentId) {
  if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
    return null;
  }
  return findInArray(ENROLLMENTS_KEY, (e) => e.id === enrollmentId.trim());
}

/**
 * Retrieves a benefit package by ID from localStorage.
 * @param {string} packageId - The benefit package ID
 * @returns {Object|null} The benefit package object or null
 */
function getBenefitPackageById(packageId) {
  if (typeof packageId !== 'string' || packageId.trim().length === 0) {
    return null;
  }
  return findInArray(BENEFIT_PACKAGES_KEY, (p) => p.id === packageId.trim());
}

/**
 * Retrieves a claim by ID from localStorage.
 * @param {string} claimId - The claim ID
 * @returns {Object|null} The claim object or null
 */
function getClaimByIdInternal(claimId) {
  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    return null;
  }
  return findInArray(CLAIMS_KEY, (c) => c.id === claimId.trim());
}

/**
 * Finds the active enrollment for a member.
 * @param {string} memberId - The member ID
 * @returns {Object|null} The active enrollment or null
 */
function findActiveEnrollment(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return null;
  }

  const enrollments = getItem(ENROLLMENTS_KEY, []);
  if (!Array.isArray(enrollments)) {
    return null;
  }

  const active = enrollments.find(
    (e) =>
      e.memberId === memberId.trim() &&
      (e.status === ENROLLMENT_STATUSES.ACTIVE || e.status === ENROLLMENT_STATUSES.APPROVED)
  );

  return active || null;
}

/**
 * Checks for prior authorization by verifying the claim service type
 * against common services that require authorization.
 * @param {Object} claim - The claim object
 * @param {Object|null} benefitPackage - The benefit package
 * @returns {{ authorized: boolean, reason: string }}
 */
function checkAuthorization(claim, benefitPackage) {
  if (!claim || typeof claim !== 'object') {
    return { authorized: false, reason: 'Claim data is missing' };
  }

  // Services that typically require prior authorization
  const authRequiredKeywords = [
    'mri', 'ct scan', 'pet scan', 'surgery', 'transplant',
    'advanced imaging', 'inpatient', 'skilled nursing',
    'durable medical equipment', 'home health',
  ];

  const serviceDesc = (claim.serviceDescription || '').toLowerCase();
  const requiresAuth = authRequiredKeywords.some((keyword) =>
    serviceDesc.includes(keyword)
  );

  if (!requiresAuth) {
    return { authorized: true, reason: 'Service does not require prior authorization' };
  }

  // In simulation, check if the claim has a prior authorization flag
  if (claim.priorAuthorizationApproved === true) {
    return { authorized: true, reason: 'Prior authorization approved' };
  }

  // Check if the billed amount is below a threshold that doesn't require auth
  const billedAmount = typeof claim.billedAmount === 'number' ? claim.billedAmount : 0;
  if (billedAmount < 500) {
    return { authorized: true, reason: 'Service amount below authorization threshold' };
  }

  return {
    authorized: false,
    reason: 'Prior authorization required but not obtained for this service',
  };
}

/**
 * Performs denial prevention checks on a claim.
 * Returns suggestions to prevent denial before submission.
 * @param {Object} claim - The claim object
 * @param {Object|null} member - The member object
 * @param {Object|null} enrollment - The enrollment object
 * @returns {{ preventable: boolean, warnings: string[] }}
 */
function performDenialPrevention(claim, member, enrollment) {
  const warnings = [];

  if (!claim || typeof claim !== 'object') {
    return { preventable: false, warnings: ['Claim data is missing'] };
  }

  // Check for missing diagnosis codes
  if (!Array.isArray(claim.diagnosisCodes) || claim.diagnosisCodes.length === 0) {
    warnings.push('No diagnosis codes provided. Claims without diagnosis codes are typically denied.');
  }

  // Check for valid diagnosis codes
  if (Array.isArray(claim.diagnosisCodes)) {
    for (const code of claim.diagnosisCodes) {
      if (typeof code === 'string') {
        const entry = getCodeByICD10(code.trim().toUpperCase());
        if (!entry) {
          warnings.push(`Diagnosis code "${code}" is not recognized. This may cause denial.`);
        }
      }
    }
  }

  // Check enrollment status
  if (enrollment) {
    if (enrollment.status !== ENROLLMENT_STATUSES.ACTIVE && enrollment.status !== ENROLLMENT_STATUSES.APPROVED) {
      warnings.push(`Member enrollment status is "${enrollment.status}". Claims for non-active enrollments are typically denied.`);
    }

    // Check service date against enrollment dates
    if (claim.serviceDate && enrollment.effectiveDate) {
      try {
        const serviceDate = new Date(claim.serviceDate + 'T00:00:00');
        const effectiveDate = new Date(enrollment.effectiveDate + 'T00:00:00');

        if (!isNaN(serviceDate.getTime()) && !isNaN(effectiveDate.getTime())) {
          if (serviceDate.getTime() < effectiveDate.getTime()) {
            warnings.push('Service date is before enrollment effective date. This claim will likely be denied.');
          }
        }

        if (enrollment.terminationDate) {
          const terminationDate = new Date(enrollment.terminationDate + 'T23:59:59');
          if (!isNaN(terminationDate.getTime()) && serviceDate.getTime() > terminationDate.getTime()) {
            warnings.push('Service date is after enrollment termination date. This claim will likely be denied.');
          }
        }
      } catch {
        // Ignore date parsing errors
      }
    }
  }

  // Check for missing service description
  if (!claim.serviceDescription || (typeof claim.serviceDescription === 'string' && claim.serviceDescription.trim().length === 0)) {
    warnings.push('Service description is missing. This may delay claim processing.');
  }

  // Check for zero or negative billed amount
  const billedAmount = typeof claim.billedAmount === 'number' ? claim.billedAmount : 0;
  if (billedAmount <= 0) {
    warnings.push('Billed amount must be greater than zero. Claims with zero amount are denied.');
  }

  // Check for missing provider
  if (!claim.providerId || (typeof claim.providerId === 'string' && claim.providerId.trim().length === 0)) {
    warnings.push('Provider ID is missing. Claims without a provider are typically denied.');
  }

  return {
    preventable: warnings.length > 0,
    warnings,
  };
}

/**
 * Calculates plan-based pricing for a claim based on the benefit package.
 * @param {Object} claim - The claim object
 * @param {Object|null} benefitPackage - The benefit package
 * @returns {{ allowedAmount: number, memberResponsibility: number, paidAmount: number, pricingDetails: Object }}
 */
function calculatePlanBasedPricing(claim, benefitPackage) {
  const billedAmount = typeof claim.billedAmount === 'number' ? claim.billedAmount : 0;

  if (billedAmount <= 0) {
    return {
      allowedAmount: 0,
      memberResponsibility: 0,
      paidAmount: 0,
      pricingDetails: { method: 'none', reason: 'Invalid billed amount' },
    };
  }

  // Default allowed rate: 80% of billed
  let allowedRate = 0.80;
  let copay = 0;
  let coinsurance = 0;
  let matchedBenefit = null;

  if (benefitPackage && benefitPackage.benefits && typeof benefitPackage.benefits === 'object') {
    const benefits = benefitPackage.benefits;

    // Try to match a specific benefit based on diagnosis codes
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

        // Map condition categories to benefit types
        if (entry.category === CONDITION_CATEGORIES.DIABETES && benefits.diabetesSupplies) {
          copay = benefits.diabetesSupplies.copay || 0;
          coinsurance = benefits.diabetesSupplies.coinsurance || 0;
          matchedBenefit = 'diabetesSupplies';
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.ESRD && benefits.dialysis) {
          copay = benefits.dialysis.copay || 0;
          coinsurance = benefits.dialysis.coinsurance || 0;
          matchedBenefit = 'dialysis';
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.HEART_FAILURE && benefits.cardiacRehab) {
          copay = benefits.cardiacRehab.copay || 0;
          coinsurance = benefits.cardiacRehab.coinsurance || 0;
          matchedBenefit = 'cardiacRehab';
          break;
        }
        if ((entry.category === CONDITION_CATEGORIES.COPD || entry.category === CONDITION_CATEGORIES.RESPIRATORY) && benefits.pulmonaryRehab) {
          copay = benefits.pulmonaryRehab.copay || 0;
          coinsurance = benefits.pulmonaryRehab.coinsurance || 0;
          matchedBenefit = 'pulmonaryRehab';
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.CANCER && benefits.chemotherapy) {
          copay = benefits.chemotherapy.copay || 0;
          coinsurance = benefits.chemotherapy.coinsurance || 0;
          matchedBenefit = 'chemotherapy';
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.DEMENTIA && benefits.adultDayCare) {
          copay = benefits.adultDayCare.copay || 0;
          coinsurance = benefits.adultDayCare.coinsurance || 0;
          matchedBenefit = 'adultDayCare';
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.MENTAL_HEALTH && benefits.mentalHealth) {
          copay = benefits.mentalHealth.copay || 0;
          coinsurance = benefits.mentalHealth.coinsurance || 0;
          matchedBenefit = 'mentalHealth';
          break;
        }
        if (entry.category === CONDITION_CATEGORIES.NEUROLOGICAL) {
          if (benefits.occupationalTherapy) {
            copay = benefits.occupationalTherapy.copay || 0;
            coinsurance = benefits.occupationalTherapy.coinsurance || 0;
            matchedBenefit = 'occupationalTherapy';
            break;
          }
        }
        if (entry.category === CONDITION_CATEGORIES.AUTOIMMUNE) {
          if (benefits.specialistVisit) {
            copay = benefits.specialistVisit.copay || 0;
            coinsurance = benefits.specialistVisit.coinsurance || 0;
            matchedBenefit = 'specialistVisit';
            break;
          }
        }
      }
    }

    // Fallback to specialist visit if no specific benefit matched
    if (!matchedBenefit && benefits.specialistVisit) {
      copay = benefits.specialistVisit.copay || 0;
      coinsurance = benefits.specialistVisit.coinsurance || 0;
      matchedBenefit = 'specialistVisit';
    }

    // Fallback to primary care
    if (!matchedBenefit && benefits.primaryCare) {
      copay = benefits.primaryCare.copay || 0;
      coinsurance = benefits.primaryCare.coinsurance || 0;
      matchedBenefit = 'primaryCare';
    }
  }

  const allowedAmount = Math.round(billedAmount * allowedRate * 100) / 100;
  const coinsuranceAmount = Math.round(allowedAmount * (coinsurance / 100) * 100) / 100;
  const memberResponsibility = Math.round((copay + coinsuranceAmount) * 100) / 100;
  const paidAmount = Math.round(Math.max(0, allowedAmount - memberResponsibility) * 100) / 100;

  return {
    allowedAmount,
    memberResponsibility,
    paidAmount,
    pricingDetails: {
      method: 'plan_based',
      allowedRate,
      copay,
      coinsurance,
      coinsuranceAmount,
      matchedBenefit,
      billedAmount,
    },
  };
}

/**
 * Checks for duplicate claims (same member, provider, service date).
 * @param {Object} claim - The claim object
 * @returns {{ isDuplicate: boolean, duplicateIds: string[] }}
 */
function checkDuplicateClaim(claim) {
  if (!claim || typeof claim !== 'object') {
    return { isDuplicate: false, duplicateIds: [] };
  }

  const claims = getAllClaims();
  const duplicates = claims.filter(
    (existing) =>
      existing.memberId === claim.memberId &&
      existing.providerId === claim.providerId &&
      existing.serviceDate === claim.serviceDate &&
      existing.id !== claim.id &&
      existing.status !== CLAIM_STATUSES.VOIDED &&
      existing.status !== CLAIM_STATUSES.DENIED
  );

  return {
    isDuplicate: duplicates.length > 0,
    duplicateIds: duplicates.map((d) => d.id),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initiates a new claim for a member.
 * Validates claim data, checks enrollment status, performs denial prevention,
 * checks authorization, and creates a claim record with audit logging.
 *
 * @param {string} memberId - The member ID
 * @param {Object} claimData - The claim data
 * @param {string} claimData.providerId - Provider ID
 * @param {string} [claimData.enrollmentId] - Enrollment ID (auto-detected if not provided)
 * @param {string} claimData.serviceDate - Date of service (YYYY-MM-DD)
 * @param {string[]} claimData.diagnosisCodes - ICD-10 diagnosis codes
 * @param {string} claimData.serviceDescription - Description of service
 * @param {number} claimData.billedAmount - Billed amount
 * @param {boolean} [claimData.priorAuthorizationApproved] - Whether prior auth was obtained
 * @param {string} [claimData.notes] - Claim notes
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @param {boolean} [options.autoProcess=false] - Whether to auto-process the claim after initiation
 * @returns {ClaimInitiationResult} The claim initiation result
 */
export function initiateClaims(memberId, claimData, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const autoProcess = options && options.autoProcess === true;

  const defaultResult = {
    success: false,
    claimId: null,
    claimNumber: null,
    status: CLAIM_STATUSES.SUBMITTED,
    ruleEvaluation: null,
    auditId: null,
    timestamp,
  };

  // Validate member ID
  const memberIdResult = validateRequired(memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  if (!claimData || typeof claimData !== 'object') {
    return { ...defaultResult, error: 'Claim data is required' };
  }

  const trimmedMemberId = memberId.trim();

  try {
    // Verify member exists
    const member = getMemberById(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Validate provider ID
    const providerIdResult = validateRequired(claimData.providerId, 'Provider ID');
    if (!providerIdResult.valid) {
      return { ...defaultResult, error: providerIdResult.error };
    }

    const trimmedProviderId = claimData.providerId.trim();

    // Verify provider exists
    const provider = getProviderById(trimmedProviderId);
    if (!provider) {
      return { ...defaultResult, error: `Provider not found: ${trimmedProviderId}` };
    }

    // Find or validate enrollment
    let enrollment = null;
    let enrollmentId = null;

    if (claimData.enrollmentId && typeof claimData.enrollmentId === 'string' && claimData.enrollmentId.trim().length > 0) {
      enrollment = getEnrollmentById(claimData.enrollmentId.trim());
      if (!enrollment) {
        return { ...defaultResult, error: `Enrollment not found: ${claimData.enrollmentId.trim()}` };
      }
      if (enrollment.memberId !== trimmedMemberId) {
        return { ...defaultResult, error: 'Enrollment does not belong to the specified member' };
      }
      enrollmentId = enrollment.id;
    } else {
      enrollment = findActiveEnrollment(trimmedMemberId);
      if (!enrollment) {
        return { ...defaultResult, error: 'No active enrollment found for this member. Claims require an active enrollment.' };
      }
      enrollmentId = enrollment.id;
    }

    // Validate service date
    if (!claimData.serviceDate || typeof claimData.serviceDate !== 'string' || claimData.serviceDate.trim().length === 0) {
      return { ...defaultResult, error: 'Service date is required' };
    }

    const serviceDateResult = validateDateFormat(claimData.serviceDate, 'Service date');
    if (!serviceDateResult.valid) {
      return { ...defaultResult, error: serviceDateResult.error };
    }

    const serviceDateFutureResult = validateDateNotFuture(claimData.serviceDate, 'Service date');
    if (!serviceDateFutureResult.valid) {
      return { ...defaultResult, error: serviceDateFutureResult.error };
    }

    // Validate diagnosis codes
    if (!Array.isArray(claimData.diagnosisCodes) || claimData.diagnosisCodes.length === 0) {
      return { ...defaultResult, error: 'At least one diagnosis code is required' };
    }

    const codesResult = validateICD10Codes(claimData.diagnosisCodes, 'Diagnosis codes', { minCount: 1 });
    if (!codesResult.valid) {
      return { ...defaultResult, error: codesResult.error };
    }

    // Validate service description
    const descResult = validateRequired(claimData.serviceDescription, 'Service description');
    if (!descResult.valid) {
      return { ...defaultResult, error: descResult.error };
    }

    // Validate billed amount
    const billedAmount = typeof claimData.billedAmount === 'number'
      ? claimData.billedAmount
      : typeof claimData.billedAmount === 'string'
        ? parseFloat(claimData.billedAmount)
        : NaN;

    if (isNaN(billedAmount) || billedAmount <= 0) {
      return { ...defaultResult, error: 'Billed amount must be a valid number greater than zero' };
    }

    // Build claim object for validation
    const claimId = uuidv4();
    const claimNumber = generateClaimNumber();
    const diagnosisCodes = claimData.diagnosisCodes.map((c) =>
      typeof c === 'string' ? c.trim().toUpperCase() : ''
    ).filter((c) => c.length > 0);

    const claimObj = {
      id: claimId,
      claimNumber,
      memberId: trimmedMemberId,
      providerId: trimmedProviderId,
      enrollmentId,
      status: CLAIM_STATUSES.SUBMITTED,
      serviceDate: claimData.serviceDate.trim(),
      submissionDate: new Date().toISOString().split('T')[0],
      diagnosisCodes,
      serviceDescription: typeof claimData.serviceDescription === 'string' ? claimData.serviceDescription.trim() : '',
      billedAmount: Math.round(billedAmount * 100) / 100,
      allowedAmount: 0,
      paidAmount: 0,
      memberResponsibility: 0,
      priorAuthorizationApproved: claimData.priorAuthorizationApproved === true,
      processedBy: null,
      processedDate: null,
      notes: typeof claimData.notes === 'string' ? claimData.notes.trim() : '',
      denialReasons: [],
      denialPreventionWarnings: [],
      pricingDetails: null,
      ruleEvaluation: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Perform denial prevention checks
    const denialPrevention = performDenialPrevention(claimObj, member, enrollment);
    claimObj.denialPreventionWarnings = denialPrevention.warnings;

    // Check for duplicate claims
    const duplicateCheck = checkDuplicateClaim(claimObj);
    if (duplicateCheck.isDuplicate) {
      claimObj.denialPreventionWarnings.push(
        `Potential duplicate claim detected. Existing claim(s): ${duplicateCheck.duplicateIds.join(', ')}`
      );
    }

    // Check authorization
    const authCheck = checkAuthorization(claimObj, null);
    if (!authCheck.authorized) {
      claimObj.denialPreventionWarnings.push(authCheck.reason);
    }

    // Persist claim
    const saved = appendToArray(CLAIMS_KEY, claimObj);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist claim record' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CLAIM_SUBMIT,
      performedBy,
      {
        targetType: 'claim',
        targetId: claimId,
        description: `Claim ${claimNumber} initiated for member ${member.firstName} ${member.lastName} (${trimmedMemberId}). Provider: ${provider.firstName} ${provider.lastName}. Billed: $${billedAmount.toFixed(2)}. Service date: ${claimObj.serviceDate}`,
        metadata: {
          claimId,
          claimNumber,
          memberId: trimmedMemberId,
          providerId: trimmedProviderId,
          enrollmentId,
          billedAmount,
          serviceDate: claimObj.serviceDate,
          diagnosisCodesCount: diagnosisCodes.length,
          denialPreventionWarnings: denialPrevention.warnings.length,
        },
        ipAddress: '127.0.0.1',
      },
      'claims'
    );

    const result = {
      success: true,
      claimId,
      claimNumber,
      status: CLAIM_STATUSES.SUBMITTED,
      ruleEvaluation: null,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };

    // Auto-process if requested
    if (autoProcess) {
      const processResult = processClaim(claimId, { performedBy });
      result.status = processResult.status;
      result.ruleEvaluation = processResult.ruleEvaluation;
    }

    return result;
  } catch (error) {
    console.error('claimsService.initiateClaims: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during claim initiation' };
  }
}

/**
 * Processes a claim through the adjudication workflow.
 * Runs CSNP-specific adjudication rules, calculates plan-based pricing,
 * checks authorization, and updates the claim status.
 *
 * @param {string} claimId - The claim ID to process
 * @param {Object} [options={}] - Processing options
 * @param {string} [options.performedBy] - User ID performing the processing
 * @returns {ClaimProcessingResult} The claim processing result
 */
export function processClaim(claimId, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    claimId: null,
    status: CLAIM_STATUSES.DENIED,
    allowedAmount: 0,
    paidAmount: 0,
    memberResponsibility: 0,
    ruleEvaluation: null,
    denialReasons: [],
    auditId: null,
    timestamp,
  };

  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    return { ...defaultResult, error: 'Claim ID is required' };
  }

  const trimmedId = claimId.trim();

  try {
    // Find claim
    const claim = getClaimByIdInternal(trimmedId);
    if (!claim) {
      return { ...defaultResult, error: `Claim not found: ${trimmedId}` };
    }

    // Verify claim is in a processable state
    const processableStatuses = [CLAIM_STATUSES.SUBMITTED, CLAIM_STATUSES.PENDING, CLAIM_STATUSES.IN_REVIEW];
    if (!processableStatuses.includes(claim.status)) {
      return {
        ...defaultResult,
        claimId: trimmedId,
        status: claim.status,
        error: `Claim cannot be processed in "${claim.status}" status. Must be in: ${processableStatuses.join(', ')}`,
      };
    }

    // Get enrollment and benefit package
    const enrollment = claim.enrollmentId ? getEnrollmentById(claim.enrollmentId) : null;
    let benefitPackage = null;

    if (enrollment && enrollment.benefitPackageId) {
      benefitPackage = getBenefitPackageById(enrollment.benefitPackageId);
    }

    const benefits = benefitPackage ? benefitPackage.benefits : null;

    // Run claim adjudication rules
    const ruleEvaluation = evaluateClaimRules(claim, benefits, {
      performedBy,
      auditLog: false,
    });

    defaultResult.ruleEvaluation = ruleEvaluation;

    // Check authorization
    const authCheck = checkAuthorization(claim, benefitPackage);
    let denialReasons = [...(ruleEvaluation.denialReasons || [])];

    if (!authCheck.authorized) {
      denialReasons.push(authCheck.reason);
    }

    // Calculate plan-based pricing
    const pricing = calculatePlanBasedPricing(claim, benefitPackage);

    let newStatus;
    let allowedAmount;
    let paidAmount;
    let memberResponsibility;

    if (ruleEvaluation.approved && authCheck.authorized) {
      newStatus = CLAIM_STATUSES.APPROVED;
      allowedAmount = pricing.allowedAmount;
      paidAmount = pricing.paidAmount;
      memberResponsibility = pricing.memberResponsibility;
      denialReasons = [];
    } else if (ruleEvaluation.recommendedStatus === CLAIM_STATUSES.IN_REVIEW) {
      newStatus = CLAIM_STATUSES.IN_REVIEW;
      allowedAmount = pricing.allowedAmount;
      paidAmount = 0;
      memberResponsibility = 0;
    } else {
      newStatus = CLAIM_STATUSES.DENIED;
      allowedAmount = 0;
      paidAmount = 0;
      memberResponsibility = 0;
    }

    // Update claim record
    const processedDate = new Date().toISOString().split('T')[0];

    const updated = updateInArray(
      CLAIMS_KEY,
      (c) => c.id === trimmedId,
      (c) => ({
        ...c,
        status: newStatus,
        allowedAmount,
        paidAmount,
        memberResponsibility,
        processedBy: performedBy,
        processedDate,
        denialReasons,
        pricingDetails: pricing.pricingDetails,
        ruleEvaluation: {
          approved: ruleEvaluation.approved,
          recommendedStatus: ruleEvaluation.recommendedStatus,
          rulesPassed: ruleEvaluation.ruleResults ? ruleEvaluation.ruleResults.filter((r) => r.passed).length : 0,
          rulesFailed: ruleEvaluation.ruleResults ? ruleEvaluation.ruleResults.filter((r) => !r.passed).length : 0,
        },
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { ...defaultResult, claimId: trimmedId, error: 'Failed to update claim record' };
    }

    // Audit log
    const auditAction = newStatus === CLAIM_STATUSES.APPROVED
      ? AUDIT_ACTIONS.CLAIM_APPROVE
      : newStatus === CLAIM_STATUSES.DENIED
        ? AUDIT_ACTIONS.CLAIM_DENY
        : AUDIT_ACTIONS.UPDATE;

    const auditEntry = logAction(
      auditAction,
      performedBy,
      {
        targetType: 'claim',
        targetId: trimmedId,
        description: `Claim ${claim.claimNumber} processed. Status: ${newStatus}. Billed: $${claim.billedAmount.toFixed(2)}, Allowed: $${allowedAmount.toFixed(2)}, Paid: $${paidAmount.toFixed(2)}, Member responsibility: $${memberResponsibility.toFixed(2)}${denialReasons.length > 0 ? `. Denial reasons: ${denialReasons.join('; ')}` : ''}`,
        metadata: {
          claimId: trimmedId,
          claimNumber: claim.claimNumber,
          memberId: claim.memberId,
          providerId: claim.providerId,
          previousStatus: claim.status,
          newStatus,
          billedAmount: claim.billedAmount,
          allowedAmount,
          paidAmount,
          memberResponsibility,
          denialReasons,
          authorizationStatus: authCheck.authorized ? 'authorized' : 'not_authorized',
        },
        ipAddress: '127.0.0.1',
      },
      'claims'
    );

    return {
      success: newStatus === CLAIM_STATUSES.APPROVED,
      claimId: trimmedId,
      status: newStatus,
      allowedAmount,
      paidAmount,
      memberResponsibility,
      ruleEvaluation,
      denialReasons,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('claimsService.processClaim: unexpected error:', error);
    return { ...defaultResult, claimId: trimmedId, error: 'An unexpected error occurred during claim processing' };
  }
}

/**
 * Retrieves the status and details of a claim by ID.
 *
 * @param {string} claimId - The claim ID
 * @returns {ClaimStatusResult} The claim status result
 */
export function getClaimStatus(claimId) {
  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    return { found: false, claimId: null, claimNumber: null, status: null, statusLabel: null, claim: null, error: 'Claim ID is required' };
  }

  try {
    const claim = getClaimByIdInternal(claimId.trim());
    if (!claim) {
      return { found: false, claimId: claimId.trim(), claimNumber: null, status: null, statusLabel: null, claim: null, error: `Claim not found: ${claimId.trim()}` };
    }

    return {
      found: true,
      claimId: claim.id,
      claimNumber: claim.claimNumber || null,
      status: claim.status,
      statusLabel: CLAIM_STATUS_LABELS[claim.status] || claim.status,
      claim,
    };
  } catch (error) {
    console.error('claimsService.getClaimStatus: unexpected error:', error);
    return { found: false, claimId: claimId.trim(), claimNumber: null, status: null, statusLabel: null, claim: null, error: 'An unexpected error occurred' };
  }
}

/**
 * Lists claims with optional filtering.
 *
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.memberId] - Filter by member ID
 * @param {string} [filters.providerId] - Filter by provider ID
 * @param {string} [filters.enrollmentId] - Filter by enrollment ID
 * @param {string} [filters.status] - Filter by claim status
 * @param {string} [filters.startDate] - Filter by service date start (YYYY-MM-DD)
 * @param {string} [filters.endDate] - Filter by service date end (YYYY-MM-DD)
 * @param {string} [filters.search] - Free-text search across claim number, service description, notes
 * @param {string} [filters.diagnosisCode] - Filter by a specific diagnosis code
 * @returns {Object[]} Array of claim records
 */
export function listClaims(filters = {}) {
  try {
    let claims = getAllClaims();

    if (!filters || typeof filters !== 'object') {
      return claims.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Filter by member ID
    if (filters.memberId && typeof filters.memberId === 'string' && filters.memberId.trim().length > 0) {
      const memberIdFilter = filters.memberId.trim();
      claims = claims.filter((c) => c.memberId === memberIdFilter);
    }

    // Filter by provider ID
    if (filters.providerId && typeof filters.providerId === 'string' && filters.providerId.trim().length > 0) {
      const providerIdFilter = filters.providerId.trim();
      claims = claims.filter((c) => c.providerId === providerIdFilter);
    }

    // Filter by enrollment ID
    if (filters.enrollmentId && typeof filters.enrollmentId === 'string' && filters.enrollmentId.trim().length > 0) {
      const enrollmentIdFilter = filters.enrollmentId.trim();
      claims = claims.filter((c) => c.enrollmentId === enrollmentIdFilter);
    }

    // Filter by status
    if (filters.status && typeof filters.status === 'string' && filters.status.trim().length > 0) {
      const statusFilter = filters.status.trim();
      claims = claims.filter((c) => c.status === statusFilter);
    }

    // Filter by service date start
    if (filters.startDate && typeof filters.startDate === 'string' && filters.startDate.trim().length > 0) {
      const startDate = new Date(filters.startDate.trim() + 'T00:00:00');
      if (!isNaN(startDate.getTime())) {
        claims = claims.filter((c) => {
          if (!c.serviceDate) {
            return false;
          }
          const serviceDate = new Date(c.serviceDate + 'T00:00:00');
          return !isNaN(serviceDate.getTime()) && serviceDate.getTime() >= startDate.getTime();
        });
      }
    }

    // Filter by service date end
    if (filters.endDate && typeof filters.endDate === 'string' && filters.endDate.trim().length > 0) {
      const endDate = new Date(filters.endDate.trim() + 'T23:59:59');
      if (!isNaN(endDate.getTime())) {
        claims = claims.filter((c) => {
          if (!c.serviceDate) {
            return false;
          }
          const serviceDate = new Date(c.serviceDate + 'T00:00:00');
          return !isNaN(serviceDate.getTime()) && serviceDate.getTime() <= endDate.getTime();
        });
      }
    }

    // Filter by diagnosis code
    if (filters.diagnosisCode && typeof filters.diagnosisCode === 'string' && filters.diagnosisCode.trim().length > 0) {
      const codeFilter = filters.diagnosisCode.trim().toUpperCase();
      claims = claims.filter(
        (c) => Array.isArray(c.diagnosisCodes) && c.diagnosisCodes.includes(codeFilter)
      );
    }

    // Free-text search
    if (filters.search && typeof filters.search === 'string' && filters.search.trim().length > 0) {
      const searchQuery = filters.search.trim().toLowerCase();
      claims = claims.filter((c) => {
        const claimNumberMatch = c.claimNumber && typeof c.claimNumber === 'string' &&
          c.claimNumber.toLowerCase().includes(searchQuery);
        const descriptionMatch = c.serviceDescription && typeof c.serviceDescription === 'string' &&
          c.serviceDescription.toLowerCase().includes(searchQuery);
        const notesMatch = c.notes && typeof c.notes === 'string' &&
          c.notes.toLowerCase().includes(searchQuery);
        const codeMatch = Array.isArray(c.diagnosisCodes) &&
          c.diagnosisCodes.some((code) => typeof code === 'string' && code.toLowerCase().includes(searchQuery));
        return claimNumberMatch || descriptionMatch || notesMatch || codeMatch;
      });
    }

    // Sort by creation date descending (most recent first)
    claims.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return claims;
  } catch (error) {
    console.error('claimsService.listClaims: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves a single claim by ID with enriched data.
 *
 * @param {string} claimId - The claim ID
 * @returns {Object|null} The enriched claim object or null
 */
export function getClaimById(claimId) {
  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    return null;
  }

  try {
    const claim = getClaimByIdInternal(claimId.trim());
    if (!claim) {
      return null;
    }

    // Enrich with member, provider, and enrollment data
    const member = getMemberById(claim.memberId);
    const provider = getProviderById(claim.providerId);
    const enrollment = claim.enrollmentId ? getEnrollmentById(claim.enrollmentId) : null;

    return {
      ...claim,
      statusLabel: CLAIM_STATUS_LABELS[claim.status] || claim.status,
      memberName: member ? `${member.firstName} ${member.lastName}` : 'Unknown',
      memberMedicareId: member ? member.medicareId : null,
      providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown',
      providerSpecialty: provider ? provider.specialty : null,
      providerFacility: provider ? provider.facilityName : null,
      enrollmentStatus: enrollment ? enrollment.status : null,
      enrollmentPlanType: enrollment ? enrollment.planType : null,
    };
  } catch (error) {
    console.error('claimsService.getClaimById: unexpected error:', error);
    return null;
  }
}

/**
 * Retrieves claims for a specific member.
 *
 * @param {string} memberId - The member ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.status] - Filter by claim status
 * @returns {Object[]} Array of claim records
 */
export function getMemberClaims(memberId, filters = {}) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  return listClaims({ ...filters, memberId: memberId.trim() });
}

/**
 * Retrieves claims for a specific provider.
 *
 * @param {string} providerId - The provider ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.status] - Filter by claim status
 * @returns {Object[]} Array of claim records
 */
export function getProviderClaims(providerId, filters = {}) {
  if (typeof providerId !== 'string' || providerId.trim().length === 0) {
    return [];
  }

  return listClaims({ ...filters, providerId: providerId.trim() });
}

/**
 * Appeals a denied claim.
 *
 * @param {string} claimId - The claim ID to appeal
 * @param {string} [reason=''] - Appeal reason
 * @param {string} [performedBy] - User ID performing the appeal
 * @returns {{ success: boolean, claimId: string|null, status: string, error?: string }}
 */
export function appealClaim(claimId, reason, performedBy) {
  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    return { success: false, claimId: null, status: '', error: 'Claim ID is required' };
  }

  const trimmedId = claimId.trim();

  try {
    const claim = getClaimByIdInternal(trimmedId);
    if (!claim) {
      return { success: false, claimId: trimmedId, status: '', error: 'Claim not found' };
    }

    if (claim.status !== CLAIM_STATUSES.DENIED) {
      return {
        success: false,
        claimId: trimmedId,
        status: claim.status,
        error: `Only denied claims can be appealed. Current status: "${claim.status}"`,
      };
    }

    const timestamp = new Date().toISOString();
    const appealReason = typeof reason === 'string' ? reason.trim() : '';

    const updated = updateInArray(
      CLAIMS_KEY,
      (c) => c.id === trimmedId,
      (c) => ({
        ...c,
        status: CLAIM_STATUSES.APPEALED,
        notes: appealReason
          ? `${c.notes} | Appeal: ${appealReason}`
          : c.notes,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, claimId: trimmedId, status: claim.status, error: 'Failed to update claim' };
    }

    logAction(
      AUDIT_ACTIONS.CLAIM_APPEAL,
      performedBy || 'system',
      {
        targetType: 'claim',
        targetId: trimmedId,
        description: `Claim ${claim.claimNumber} appealed for member ${claim.memberId}. Reason: ${appealReason || 'Not specified'}`,
        metadata: {
          claimId: trimmedId,
          claimNumber: claim.claimNumber,
          memberId: claim.memberId,
          previousStatus: CLAIM_STATUSES.DENIED,
          newStatus: CLAIM_STATUSES.APPEALED,
          reason: appealReason,
        },
        ipAddress: '127.0.0.1',
      },
      'claims'
    );

    return { success: true, claimId: trimmedId, status: CLAIM_STATUSES.APPEALED };
  } catch (error) {
    console.error('claimsService.appealClaim: unexpected error:', error);
    return { success: false, claimId: trimmedId, status: '', error: 'An unexpected error occurred' };
  }
}

/**
 * Voids a claim.
 *
 * @param {string} claimId - The claim ID to void
 * @param {string} [reason=''] - Void reason
 * @param {string} [performedBy] - User ID performing the void
 * @returns {{ success: boolean, claimId: string|null, status: string, error?: string }}
 */
export function voidClaim(claimId, reason, performedBy) {
  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    return { success: false, claimId: null, status: '', error: 'Claim ID is required' };
  }

  const trimmedId = claimId.trim();

  try {
    const claim = getClaimByIdInternal(trimmedId);
    if (!claim) {
      return { success: false, claimId: trimmedId, status: '', error: 'Claim not found' };
    }

    if (claim.status === CLAIM_STATUSES.VOIDED) {
      return { success: false, claimId: trimmedId, status: claim.status, error: 'Claim is already voided' };
    }

    if (claim.status === CLAIM_STATUSES.PAID) {
      return { success: false, claimId: trimmedId, status: claim.status, error: 'Paid claims cannot be voided. Use adjustment instead.' };
    }

    const timestamp = new Date().toISOString();
    const voidReason = typeof reason === 'string' ? reason.trim() : '';

    const updated = updateInArray(
      CLAIMS_KEY,
      (c) => c.id === trimmedId,
      (c) => ({
        ...c,
        status: CLAIM_STATUSES.VOIDED,
        notes: voidReason
          ? `${c.notes} | Voided: ${voidReason}`
          : c.notes,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, claimId: trimmedId, status: claim.status, error: 'Failed to update claim' };
    }

    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy || 'system',
      {
        targetType: 'claim',
        targetId: trimmedId,
        description: `Claim ${claim.claimNumber} voided for member ${claim.memberId}. Reason: ${voidReason || 'Not specified'}`,
        metadata: {
          claimId: trimmedId,
          claimNumber: claim.claimNumber,
          memberId: claim.memberId,
          previousStatus: claim.status,
          newStatus: CLAIM_STATUSES.VOIDED,
          reason: voidReason,
        },
        ipAddress: '127.0.0.1',
      },
      'claims'
    );

    return { success: true, claimId: trimmedId, status: CLAIM_STATUSES.VOIDED };
  } catch (error) {
    console.error('claimsService.voidClaim: unexpected error:', error);
    return { success: false, claimId: trimmedId, status: '', error: 'An unexpected error occurred' };
  }
}

/**
 * Marks an approved claim as paid.
 *
 * @param {string} claimId - The claim ID to mark as paid
 * @param {string} [performedBy] - User ID performing the operation
 * @returns {{ success: boolean, claimId: string|null, status: string, error?: string }}
 */
export function markClaimPaid(claimId, performedBy) {
  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    return { success: false, claimId: null, status: '', error: 'Claim ID is required' };
  }

  const trimmedId = claimId.trim();

  try {
    const claim = getClaimByIdInternal(trimmedId);
    if (!claim) {
      return { success: false, claimId: trimmedId, status: '', error: 'Claim not found' };
    }

    if (claim.status !== CLAIM_STATUSES.APPROVED) {
      return {
        success: false,
        claimId: trimmedId,
        status: claim.status,
        error: `Only approved claims can be marked as paid. Current status: "${claim.status}"`,
      };
    }

    const timestamp = new Date().toISOString();

    const updated = updateInArray(
      CLAIMS_KEY,
      (c) => c.id === trimmedId,
      (c) => ({
        ...c,
        status: CLAIM_STATUSES.PAID,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, claimId: trimmedId, status: claim.status, error: 'Failed to update claim' };
    }

    logAction(
      AUDIT_ACTIONS.CLAIM_APPROVE,
      performedBy || 'system',
      {
        targetType: 'claim',
        targetId: trimmedId,
        description: `Claim ${claim.claimNumber} marked as paid for member ${claim.memberId}. Paid amount: $${claim.paidAmount.toFixed(2)}`,
        metadata: {
          claimId: trimmedId,
          claimNumber: claim.claimNumber,
          memberId: claim.memberId,
          paidAmount: claim.paidAmount,
          previousStatus: CLAIM_STATUSES.APPROVED,
          newStatus: CLAIM_STATUSES.PAID,
        },
        ipAddress: '127.0.0.1',
      },
      'claims'
    );

    return { success: true, claimId: trimmedId, status: CLAIM_STATUSES.PAID };
  } catch (error) {
    console.error('claimsService.markClaimPaid: unexpected error:', error);
    return { success: false, claimId: trimmedId, status: '', error: 'An unexpected error occurred' };
  }
}

/**
 * Reprocesses a claim that is in review or was previously denied (after appeal).
 *
 * @param {string} claimId - The claim ID to reprocess
 * @param {Object} [options={}] - Processing options
 * @param {string} [options.performedBy] - User ID performing the reprocessing
 * @returns {ClaimProcessingResult} The claim processing result
 */
export function reprocessClaim(claimId, options = {}) {
  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    return {
      success: false,
      claimId: null,
      status: CLAIM_STATUSES.DENIED,
      allowedAmount: 0,
      paidAmount: 0,
      memberResponsibility: 0,
      ruleEvaluation: null,
      denialReasons: [],
      auditId: null,
      timestamp: new Date().toISOString(),
      error: 'Claim ID is required',
    };
  }

  const trimmedId = claimId.trim();

  try {
    const claim = getClaimByIdInternal(trimmedId);
    if (!claim) {
      return {
        success: false,
        claimId: trimmedId,
        status: CLAIM_STATUSES.DENIED,
        allowedAmount: 0,
        paidAmount: 0,
        memberResponsibility: 0,
        ruleEvaluation: null,
        denialReasons: [],
        auditId: null,
        timestamp: new Date().toISOString(),
        error: `Claim not found: ${trimmedId}`,
      };
    }

    const reprocessableStatuses = [CLAIM_STATUSES.IN_REVIEW, CLAIM_STATUSES.APPEALED];
    if (!reprocessableStatuses.includes(claim.status)) {
      return {
        success: false,
        claimId: trimmedId,
        status: claim.status,
        allowedAmount: 0,
        paidAmount: 0,
        memberResponsibility: 0,
        ruleEvaluation: null,
        denialReasons: [],
        auditId: null,
        timestamp: new Date().toISOString(),
        error: `Claim cannot be reprocessed in "${claim.status}" status. Must be in: ${reprocessableStatuses.join(', ')}`,
      };
    }

    // Reset claim to submitted status for reprocessing
    const timestamp = new Date().toISOString();

    updateInArray(
      CLAIMS_KEY,
      (c) => c.id === trimmedId,
      (c) => ({
        ...c,
        status: CLAIM_STATUSES.SUBMITTED,
        updatedAt: timestamp,
      })
    );

    // Process the claim
    return processClaim(trimmedId, options);
  } catch (error) {
    console.error('claimsService.reprocessClaim: unexpected error:', error);
    return {
      success: false,
      claimId: trimmedId,
      status: CLAIM_STATUSES.DENIED,
      allowedAmount: 0,
      paidAmount: 0,
      memberResponsibility: 0,
      ruleEvaluation: null,
      denialReasons: [],
      auditId: null,
      timestamp: new Date().toISOString(),
      error: 'An unexpected error occurred during claim reprocessing',
    };
  }
}

/**
 * Updates claim notes.
 *
 * @param {string} claimId - The claim ID
 * @param {string} notes - Notes to append
 * @param {string} [performedBy] - User ID performing the update
 * @returns {boolean} Whether the update succeeded
 */
export function updateClaimNotes(claimId, notes, performedBy) {
  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    return false;
  }

  if (typeof notes !== 'string' || notes.trim().length === 0) {
    return false;
  }

  try {
    const trimmedId = claimId.trim();
    const trimmedNotes = notes.trim();
    const timestamp = new Date().toISOString();

    const updated = updateInArray(
      CLAIMS_KEY,
      (c) => c.id === trimmedId,
      (c) => ({
        ...c,
        notes: c.notes ? `${c.notes} | ${trimmedNotes}` : trimmedNotes,
        updatedAt: timestamp,
      })
    );

    if (updated) {
      logAction(
        AUDIT_ACTIONS.UPDATE,
        performedBy || 'system',
        {
          targetType: 'claim',
          targetId: trimmedId,
          description: `Claim notes updated for ${trimmedId}`,
          metadata: { claimId: trimmedId, notesAdded: trimmedNotes },
          ipAddress: '127.0.0.1',
        },
        'claims'
      );
    }

    return updated;
  } catch (error) {
    console.error('claimsService.updateClaimNotes: unexpected error:', error);
    return false;
  }
}

/**
 * Performs a batch claim initiation for multiple claims.
 *
 * @param {Array<{ memberId: string, claimData: Object }>} claimEntries - Array of claim entries
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the batch operation
 * @param {boolean} [options.autoProcess=false] - Whether to auto-process claims
 * @returns {{ total: number, successful: number, failed: number, results: ClaimInitiationResult[] }}
 */
export function batchInitiateClaims(claimEntries, options = {}) {
  const batchResult = {
    total: 0,
    successful: 0,
    failed: 0,
    results: [],
  };

  if (!Array.isArray(claimEntries) || claimEntries.length === 0) {
    return batchResult;
  }

  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  batchResult.total = claimEntries.length;

  for (const entry of claimEntries) {
    if (!entry || typeof entry !== 'object') {
      batchResult.failed++;
      batchResult.results.push({
        success: false,
        claimId: null,
        claimNumber: null,
        status: CLAIM_STATUSES.SUBMITTED,
        ruleEvaluation: null,
        auditId: null,
        timestamp: new Date().toISOString(),
        error: 'Invalid claim entry',
      });
      continue;
    }

    const result = initiateClaims(entry.memberId, entry.claimData, {
      ...options,
      performedBy,
    });

    batchResult.results.push(result);

    if (result.success) {
      batchResult.successful++;
    } else {
      batchResult.failed++;
    }
  }

  // Audit log for batch operation
  if (batchResult.total > 0) {
    logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'claim_batch',
        targetId: '',
        description: `Batch claim initiation: ${batchResult.successful} successful, ${batchResult.failed} failed out of ${batchResult.total} total`,
        metadata: {
          total: batchResult.total,
          successful: batchResult.successful,
          failed: batchResult.failed,
        },
        ipAddress: '127.0.0.1',
      },
      'claims'
    );
  }

  return batchResult;
}

/**
 * Returns claims statistics.
 *
 * @returns {{ total: number, byStatus: Object.<string, number>, totalBilled: number, totalAllowed: number, totalPaid: number, totalMemberResponsibility: number, averageBilled: number, averagePaid: number, denialRate: number, approvalRate: number }}
 */
export function getClaimStats() {
  try {
    const claims = getAllClaims();

    const stats = {
      total: claims.length,
      byStatus: {},
      totalBilled: 0,
      totalAllowed: 0,
      totalPaid: 0,
      totalMemberResponsibility: 0,
      averageBilled: 0,
      averagePaid: 0,
      denialRate: 0,
      approvalRate: 0,
    };

    let processedCount = 0;
    let deniedCount = 0;
    let approvedCount = 0;

    for (const claim of claims) {
      // By status
      const status = claim.status || 'unknown';
      if (!stats.byStatus[status]) {
        stats.byStatus[status] = 0;
      }
      stats.byStatus[status]++;

      // Financial totals
      stats.totalBilled += typeof claim.billedAmount === 'number' ? claim.billedAmount : 0;
      stats.totalAllowed += typeof claim.allowedAmount === 'number' ? claim.allowedAmount : 0;
      stats.totalPaid += typeof claim.paidAmount === 'number' ? claim.paidAmount : 0;
      stats.totalMemberResponsibility += typeof claim.memberResponsibility === 'number' ? claim.memberResponsibility : 0;

      // Track processed claims for rates
      if (claim.status === CLAIM_STATUSES.APPROVED || claim.status === CLAIM_STATUSES.PAID ||
          claim.status === CLAIM_STATUSES.DENIED || claim.status === CLAIM_STATUSES.PARTIALLY_APPROVED) {
        processedCount++;
      }

      if (claim.status === CLAIM_STATUSES.DENIED) {
        deniedCount++;
      }

      if (claim.status === CLAIM_STATUSES.APPROVED || claim.status === CLAIM_STATUSES.PAID) {
        approvedCount++;
      }
    }

    // Round financial totals
    stats.totalBilled = Math.round(stats.totalBilled * 100) / 100;
    stats.totalAllowed = Math.round(stats.totalAllowed * 100) / 100;
    stats.totalPaid = Math.round(stats.totalPaid * 100) / 100;
    stats.totalMemberResponsibility = Math.round(stats.totalMemberResponsibility * 100) / 100;

    // Averages
    if (claims.length > 0) {
      stats.averageBilled = Math.round((stats.totalBilled / claims.length) * 100) / 100;
      stats.averagePaid = Math.round((stats.totalPaid / claims.length) * 100) / 100;
    }

    // Rates
    if (processedCount > 0) {
      stats.denialRate = Math.round((deniedCount / processedCount) * 10000) / 100;
      stats.approvalRate = Math.round((approvedCount / processedCount) * 10000) / 100;
    }

    return stats;
  } catch (error) {
    console.error('claimsService.getClaimStats: unexpected error:', error);
    return {
      total: 0,
      byStatus: {},
      totalBilled: 0,
      totalAllowed: 0,
      totalPaid: 0,
      totalMemberResponsibility: 0,
      averageBilled: 0,
      averagePaid: 0,
      denialRate: 0,
      approvalRate: 0,
    };
  }
}

/**
 * Returns all claim records from localStorage.
 *
 * @returns {Object[]} Array of all claim records
 */
export function getAllClaimRecords() {
  try {
    return getAllClaims();
  } catch (error) {
    console.error('claimsService.getAllClaimRecords: unexpected error:', error);
    return [];
  }
}

/**
 * Returns claims that need attention (in review, pending, or submitted).
 *
 * @returns {Object[]} Array of claims needing attention
 */
export function getClaimsNeedingAttention() {
  try {
    const claims = getAllClaims();
    const attentionStatuses = [CLAIM_STATUSES.SUBMITTED, CLAIM_STATUSES.PENDING, CLAIM_STATUSES.IN_REVIEW, CLAIM_STATUSES.APPEALED];

    return claims
      .filter((c) => attentionStatuses.includes(c.status))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (error) {
    console.error('claimsService.getClaimsNeedingAttention: unexpected error:', error);
    return [];
  }
}

/**
 * Returns denial prevention analysis for a potential claim before submission.
 *
 * @param {string} memberId - The member ID
 * @param {Object} claimData - The claim data to analyze
 * @returns {{ preventable: boolean, warnings: string[], authorizationRequired: boolean, duplicateRisk: boolean }}
 */
export function analyzeDenialRisk(memberId, claimData) {
  const result = {
    preventable: false,
    warnings: [],
    authorizationRequired: false,
    duplicateRisk: false,
  };

  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    result.warnings.push('Member ID is required');
    result.preventable = true;
    return result;
  }

  if (!claimData || typeof claimData !== 'object') {
    result.warnings.push('Claim data is required');
    result.preventable = true;
    return result;
  }

  try {
    const member = getMemberById(memberId.trim());
    const enrollment = findActiveEnrollment(memberId.trim());

    const claimObj = {
      memberId: memberId.trim(),
      providerId: claimData.providerId || '',
      serviceDate: claimData.serviceDate || '',
      diagnosisCodes: claimData.diagnosisCodes || [],
      serviceDescription: claimData.serviceDescription || '',
      billedAmount: claimData.billedAmount || 0,
      priorAuthorizationApproved: claimData.priorAuthorizationApproved || false,
    };

    // Denial prevention
    const denialPrevention = performDenialPrevention(claimObj, member, enrollment);
    result.warnings = denialPrevention.warnings;
    result.preventable = denialPrevention.preventable;

    // Authorization check
    const authCheck = checkAuthorization(claimObj, null);
    result.authorizationRequired = !authCheck.authorized;
    if (!authCheck.authorized) {
      result.warnings.push(authCheck.reason);
      result.preventable = true;
    }

    // Duplicate check
    const duplicateCheck = checkDuplicateClaim(claimObj);
    result.duplicateRisk = duplicateCheck.isDuplicate;
    if (duplicateCheck.isDuplicate) {
      result.warnings.push(`Potential duplicate claim detected. Existing claim(s): ${duplicateCheck.duplicateIds.join(', ')}`);
      result.preventable = true;
    }

    return result;
  } catch (error) {
    console.error('claimsService.analyzeDenialRisk: unexpected error:', error);
    result.warnings.push('An error occurred during denial risk analysis');
    result.preventable = true;
    return result;
  }
}