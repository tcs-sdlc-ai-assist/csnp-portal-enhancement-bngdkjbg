/**
 * Benefits configuration and assignment service for the CSNP Portal.
 * Provides condition-specific benefit package configuration, copay/deductible logic,
 * Medicare Part A/B/D coverage rules, additional benefits (telehealth, transportation, meals),
 * and audit logging.
 * @module benefitsService
 */

import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem, appendToArray, findInArray, updateInArray } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { evaluateBenefitRules } from './ruleEngine.js';
import {
  AUDIT_ACTIONS,
  PLAN_TYPES,
  MEDICARE_PARTS,
  MEDICARE_PART_LABELS,
} from '../utils/constants.js';
import {
  CONDITION_CATEGORIES,
  CONDITION_CATEGORY_LABELS,
  getCodeByICD10,
} from '../data/icd10Data.js';
import { validateRequired, validateDateFormat } from '../utils/validators.js';

/**
 * localStorage key for benefit packages collection.
 * @type {string}
 */
const BENEFIT_PACKAGES_KEY = 'csnp_benefit_packages';

/**
 * localStorage key for members collection.
 * @type {string}
 */
const MEMBERS_KEY = 'csnp_members';

/**
 * localStorage key for benefit assignments collection.
 * @type {string}
 */
const BENEFIT_ASSIGNMENTS_KEY = 'csnp_benefit_assignments';

/**
 * localStorage key for enrollments collection.
 * @type {string}
 */
const ENROLLMENTS_KEY = 'csnp_enrollments';

/**
 * @typedef {Object} BenefitAssignmentResult
 * @property {boolean} success - Whether the assignment succeeded
 * @property {string|null} assignmentId - The created assignment ID
 * @property {string|null} benefitPackageId - The assigned benefit package ID
 * @property {string|null} benefitPackageName - The assigned benefit package name
 * @property {Object|null} benefitSummary - Summary of assigned benefits
 * @property {Object|null} ruleEvaluation - Rule engine evaluation result
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if assignment failed
 */

/**
 * @typedef {Object} BenefitPackageConfig
 * @property {string} id - Unique benefit package identifier
 * @property {string} name - Package name
 * @property {string} planType - Plan type from PLAN_TYPES
 * @property {string} description - Package description
 * @property {string} effectiveDate - Effective date (YYYY-MM-DD)
 * @property {string} terminationDate - Termination date (YYYY-MM-DD)
 * @property {Object} benefits - Benefit details
 * @property {string[]} eligibleConditionCategories - Eligible condition categories
 * @property {number} monthlyPremium - Monthly premium amount
 * @property {number} annualDeductible - Annual deductible amount
 * @property {number} maxOutOfPocket - Maximum out-of-pocket amount
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} BenefitAssignment
 * @property {string} id - Unique assignment identifier
 * @property {string} memberId - Member ID
 * @property {string} benefitPackageId - Benefit package ID
 * @property {string} conditionCategory - Primary condition category
 * @property {string[]} diagnosisCodes - Associated ICD-10 codes
 * @property {Object} coverageDetails - Coverage details
 * @property {Object} copaySchedule - Copay schedule
 * @property {Object} deductibleInfo - Deductible information
 * @property {Object} additionalBenefits - Additional benefits
 * @property {string[]} medicareParts - Enrolled Medicare parts
 * @property {string} status - Assignment status (active, inactive, pending)
 * @property {string|null} assignedBy - User ID who assigned the benefit
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

// ─── Medicare Coverage Rules ────────────────────────────────────────────────

/**
 * Default Medicare Part A coverage rules.
 * @type {Object}
 */
const MEDICARE_PART_A_COVERAGE = Object.freeze({
  partType: MEDICARE_PARTS.PART_A,
  label: MEDICARE_PART_LABELS[MEDICARE_PARTS.PART_A],
  coverageItems: [
    { service: 'Inpatient Hospital Care', covered: true, notes: 'Semi-private room, meals, general nursing, drugs as part of inpatient treatment' },
    { service: 'Skilled Nursing Facility', covered: true, notes: 'Up to 100 days per benefit period after qualifying hospital stay' },
    { service: 'Home Health Services', covered: true, notes: 'Part-time or intermittent skilled nursing care and home health aide services' },
    { service: 'Hospice Care', covered: true, notes: 'Pain relief, symptom management, and support services for terminal illness' },
    { service: 'Inpatient Psychiatric Care', covered: true, notes: 'Up to 190 days lifetime limit in psychiatric hospital' },
  ],
});

/**
 * Default Medicare Part B coverage rules.
 * @type {Object}
 */
const MEDICARE_PART_B_COVERAGE = Object.freeze({
  partType: MEDICARE_PARTS.PART_B,
  label: MEDICARE_PART_LABELS[MEDICARE_PARTS.PART_B],
  coverageItems: [
    { service: 'Physician Services', covered: true, notes: 'Office visits, outpatient care, and some preventive services' },
    { service: 'Outpatient Hospital Services', covered: true, notes: 'Surgery, diagnostic tests, and other outpatient services' },
    { service: 'Durable Medical Equipment', covered: true, notes: 'Wheelchairs, walkers, hospital beds, and other equipment' },
    { service: 'Clinical Laboratory Services', covered: true, notes: 'Blood tests, urinalysis, and other lab work' },
    { service: 'Preventive Services', covered: true, notes: 'Screenings, vaccinations, and annual wellness visits' },
    { service: 'Mental Health Services', covered: true, notes: 'Outpatient mental health services including therapy' },
    { service: 'Ambulance Services', covered: true, notes: 'Emergency and medically necessary ambulance transportation' },
  ],
});

/**
 * Default Medicare Part D coverage rules.
 * @type {Object}
 */
const MEDICARE_PART_D_COVERAGE = Object.freeze({
  partType: MEDICARE_PARTS.PART_D,
  label: MEDICARE_PART_LABELS[MEDICARE_PARTS.PART_D],
  coverageItems: [
    { service: 'Tier 1 - Preferred Generic', covered: true, notes: 'Lowest cost generic medications' },
    { service: 'Tier 2 - Generic', covered: true, notes: 'Other generic medications' },
    { service: 'Tier 3 - Preferred Brand', covered: true, notes: 'Preferred brand-name medications' },
    { service: 'Tier 4 - Non-Preferred Brand', covered: true, notes: 'Non-preferred brand-name medications' },
    { service: 'Tier 5 - Specialty', covered: true, notes: 'High-cost specialty medications' },
    { service: 'Medication Therapy Management', covered: true, notes: 'Comprehensive medication review and optimization' },
  ],
});

// ─── Additional Benefits Configuration ──────────────────────────────────────

/**
 * Additional benefits available for CSNP plans by condition category.
 * @type {Object.<string, Object[]>}
 */
const ADDITIONAL_BENEFITS_BY_CATEGORY = Object.freeze({
  [CONDITION_CATEGORIES.DIABETES]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for diabetes management', included: true },
    { benefit: 'Diabetes Supplies', description: '$0 copay for glucose monitors, test strips, and lancets', included: true },
    { benefit: 'Nutrition Counseling', description: 'Up to 12 nutrition counseling sessions per year', included: true },
    { benefit: 'Podiatry', description: 'Routine foot care for diabetic patients', included: true },
    { benefit: 'Transportation', description: 'Up to 24 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '14 meals delivered after hospital discharge', included: true },
    { benefit: 'Fitness Program', description: 'SilverSneakers or equivalent fitness membership', included: true },
  ],
  [CONDITION_CATEGORIES.HEART_FAILURE]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for cardiac monitoring', included: true },
    { benefit: 'Cardiac Rehabilitation', description: '$20 copay per cardiac rehab session', included: true },
    { benefit: 'Remote Monitoring', description: 'Home blood pressure and weight monitoring devices', included: true },
    { benefit: 'Transportation', description: 'Up to 36 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '28 heart-healthy meals delivered after hospital discharge', included: true },
    { benefit: 'Home Health', description: '$0 copay home health nursing visits', included: true },
    { benefit: 'Fitness Program', description: 'SilverSneakers or equivalent fitness membership', included: true },
  ],
  [CONDITION_CATEGORIES.COPD]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for respiratory management', included: true },
    { benefit: 'Pulmonary Rehabilitation', description: '$20 copay per pulmonary rehab session', included: true },
    { benefit: 'Oxygen Equipment', description: '20% coinsurance for home oxygen equipment', included: true },
    { benefit: 'Transportation', description: 'Up to 24 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '14 meals delivered after hospital discharge', included: true },
    { benefit: 'Smoking Cessation', description: 'Smoking cessation counseling and medications covered', included: true },
  ],
  [CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for kidney disease management', included: true },
    { benefit: 'Nutrition Counseling', description: 'Renal diet counseling sessions', included: true },
    { benefit: 'Transportation', description: 'Up to 36 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '14 renal-friendly meals delivered after hospital discharge', included: true },
    { benefit: 'Home Health', description: '$0 copay home health nursing visits', included: true },
  ],
  [CONDITION_CATEGORIES.ESRD]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for ESRD management', included: true },
    { benefit: 'Dialysis Services', description: '20% coinsurance for dialysis services', included: true },
    { benefit: 'Transportation', description: 'Unlimited trips to dialysis center', included: true },
    { benefit: 'Meals', description: '28 renal-friendly meals delivered per month', included: true },
    { benefit: 'Home Health', description: '$0 copay home health nursing visits', included: true },
    { benefit: 'Nutrition Counseling', description: 'Renal diet counseling sessions', included: true },
    { benefit: 'Vascular Access Care', description: 'Coverage for vascular access maintenance', included: true },
  ],
  [CONDITION_CATEGORIES.CARDIOVASCULAR]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for cardiovascular management', included: true },
    { benefit: 'Cardiac Rehabilitation', description: '$20 copay per cardiac rehab session', included: true },
    { benefit: 'Transportation', description: 'Up to 24 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '14 heart-healthy meals delivered after hospital discharge', included: true },
    { benefit: 'Fitness Program', description: 'SilverSneakers or equivalent fitness membership', included: true },
  ],
  [CONDITION_CATEGORIES.DEMENTIA]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for cognitive health', included: true },
    { benefit: 'Adult Day Care', description: '$0 copay for adult day care services', included: true },
    { benefit: 'Caregiver Support', description: 'Respite care and caregiver training programs', included: true },
    { benefit: 'Transportation', description: 'Up to 36 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '28 meals delivered per month', included: true },
    { benefit: 'Home Safety', description: 'Home safety evaluation and modifications', included: true },
    { benefit: 'Occupational Therapy', description: '$20 copay per OT session', included: true },
    { benefit: 'Speech Therapy', description: '$20 copay per speech therapy session', included: true },
  ],
  [CONDITION_CATEGORIES.MENTAL_HEALTH]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for mental health', included: true },
    { benefit: 'Mental Health Services', description: '$0 copay for outpatient mental health visits', included: true },
    { benefit: 'Substance Abuse Treatment', description: 'Coverage for substance abuse counseling', included: true },
    { benefit: 'Transportation', description: 'Up to 24 one-way trips per year to medical appointments', included: true },
    { benefit: 'Crisis Intervention', description: '24/7 crisis hotline and intervention services', included: true },
  ],
  [CONDITION_CATEGORIES.AUTOIMMUNE]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for autoimmune management', included: true },
    { benefit: 'Specialty Medications', description: 'Enhanced coverage for biologic and specialty drugs', included: true },
    { benefit: 'Transportation', description: 'Up to 24 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '14 meals delivered after hospital discharge', included: true },
    { benefit: 'Occupational Therapy', description: '$20 copay per OT session', included: true },
  ],
  [CONDITION_CATEGORIES.HIV_AIDS]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for HIV management', included: true },
    { benefit: 'Antiretroviral Medications', description: '$0 copay for Tier 1 antiretroviral medications', included: true },
    { benefit: 'Transportation', description: 'Up to 36 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '28 meals delivered per month', included: true },
    { benefit: 'Mental Health Services', description: '$0 copay for outpatient mental health visits', included: true },
    { benefit: 'Nutrition Counseling', description: 'Nutrition counseling sessions', included: true },
  ],
  [CONDITION_CATEGORIES.CANCER]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for oncology management', included: true },
    { benefit: 'Chemotherapy', description: '20% coinsurance for chemotherapy services', included: true },
    { benefit: 'Radiation Therapy', description: '20% coinsurance for radiation therapy', included: true },
    { benefit: 'Transportation', description: 'Up to 48 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '28 meals delivered during active treatment', included: true },
    { benefit: 'Palliative Care', description: 'Palliative care consultation and support', included: true },
    { benefit: 'Home Health', description: '$0 copay home health nursing visits', included: true },
  ],
  [CONDITION_CATEGORIES.LIVER_DISEASE]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for liver disease management', included: true },
    { benefit: 'Nutrition Counseling', description: 'Hepatic diet counseling sessions', included: true },
    { benefit: 'Transportation', description: 'Up to 24 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '14 meals delivered after hospital discharge', included: true },
    { benefit: 'Substance Abuse Treatment', description: 'Coverage for substance abuse counseling', included: true },
  ],
  [CONDITION_CATEGORIES.RESPIRATORY]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for respiratory management', included: true },
    { benefit: 'Pulmonary Rehabilitation', description: '$20 copay per pulmonary rehab session', included: true },
    { benefit: 'Oxygen Equipment', description: '20% coinsurance for home oxygen equipment', included: true },
    { benefit: 'Transportation', description: 'Up to 24 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '14 meals delivered after hospital discharge', included: true },
  ],
  [CONDITION_CATEGORIES.NEUROLOGICAL]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for neurological management', included: true },
    { benefit: 'Occupational Therapy', description: '$20 copay per OT session', included: true },
    { benefit: 'Speech Therapy', description: '$20 copay per speech therapy session', included: true },
    { benefit: 'Physical Therapy', description: '$20 copay per PT session', included: true },
    { benefit: 'Transportation', description: 'Up to 36 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '28 meals delivered per month', included: true },
    { benefit: 'Home Health', description: '$0 copay home health nursing visits', included: true },
    { benefit: 'Durable Medical Equipment', description: 'Enhanced DME coverage for mobility aids', included: true },
  ],
  [CONDITION_CATEGORIES.STROKE]: [
    { benefit: 'Telehealth', description: '$0 copay telehealth visits for stroke recovery', included: true },
    { benefit: 'Physical Therapy', description: '$20 copay per PT session', included: true },
    { benefit: 'Occupational Therapy', description: '$20 copay per OT session', included: true },
    { benefit: 'Speech Therapy', description: '$20 copay per speech therapy session', included: true },
    { benefit: 'Transportation', description: 'Up to 36 one-way trips per year to medical appointments', included: true },
    { benefit: 'Meals', description: '28 meals delivered after hospital discharge', included: true },
    { benefit: 'Home Health', description: '$0 copay home health nursing visits', included: true },
  ],
});

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Retrieves all benefit packages from localStorage.
 * @returns {Object[]} Array of benefit package objects
 */
function getAllBenefitPackages() {
  const packages = getItem(BENEFIT_PACKAGES_KEY, []);
  if (!Array.isArray(packages)) {
    return [];
  }
  return packages;
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
 * Retrieves all benefit assignments from localStorage.
 * @returns {Object[]} Array of benefit assignment objects
 */
function getAllBenefitAssignments() {
  const assignments = getItem(BENEFIT_ASSIGNMENTS_KEY, []);
  if (!Array.isArray(assignments)) {
    return [];
  }
  return assignments;
}

/**
 * Determines the primary condition category from an array of ICD-10 codes.
 * Returns the category with the highest-priority (lowest number) eligible code.
 * @param {string[]} diagnosisCodes - Array of ICD-10 codes
 * @returns {{ category: string, categoryLabel: string, code: string, priority: number } | null}
 */
function determinePrimaryConditionCategory(diagnosisCodes) {
  if (!Array.isArray(diagnosisCodes) || diagnosisCodes.length === 0) {
    return null;
  }

  let bestCategory = null;
  let bestPriority = Infinity;
  let bestCode = null;

  for (const code of diagnosisCodes) {
    if (typeof code !== 'string' || code.trim().length === 0) {
      continue;
    }

    const entry = getCodeByICD10(code.trim().toUpperCase());
    if (!entry || !entry.csnpEligible) {
      continue;
    }

    if (entry.priority < bestPriority) {
      bestPriority = entry.priority;
      bestCategory = entry.category;
      bestCode = entry.code;
    }
  }

  if (bestCategory === null) {
    return null;
  }

  return {
    category: bestCategory,
    categoryLabel: CONDITION_CATEGORY_LABELS[bestCategory] || bestCategory,
    code: bestCode,
    priority: bestPriority,
  };
}

/**
 * Builds a copay schedule from a benefit package's benefits object.
 * @param {Object} benefits - The benefits object from a benefit package
 * @returns {Object} Copay schedule
 */
function buildCopaySchedule(benefits) {
  if (!benefits || typeof benefits !== 'object') {
    return {};
  }

  const schedule = {};

  for (const [key, value] of Object.entries(benefits)) {
    if (value && typeof value === 'object') {
      schedule[key] = {
        copay: typeof value.copay === 'number' ? value.copay : null,
        coinsurance: typeof value.coinsurance === 'number' ? value.coinsurance : null,
        description: typeof value.description === 'string' ? value.description : '',
      };
    }
  }

  return schedule;
}

/**
 * Builds deductible information from a benefit package.
 * @param {Object} benefitPackage - The benefit package object
 * @returns {Object} Deductible information
 */
function buildDeductibleInfo(benefitPackage) {
  if (!benefitPackage || typeof benefitPackage !== 'object') {
    return {
      annualDeductible: 0,
      maxOutOfPocket: 0,
      monthlyPremium: 0,
    };
  }

  return {
    annualDeductible: typeof benefitPackage.annualDeductible === 'number' ? benefitPackage.annualDeductible : 0,
    maxOutOfPocket: typeof benefitPackage.maxOutOfPocket === 'number' ? benefitPackage.maxOutOfPocket : 0,
    monthlyPremium: typeof benefitPackage.monthlyPremium === 'number' ? benefitPackage.monthlyPremium : 0,
  };
}

/**
 * Builds Medicare coverage details based on enrolled Medicare parts.
 * @param {string[]} medicareParts - Array of Medicare parts the member is enrolled in
 * @returns {Object[]} Array of Medicare coverage detail objects
 */
function buildMedicareCoverageDetails(medicareParts) {
  if (!Array.isArray(medicareParts) || medicareParts.length === 0) {
    return [];
  }

  const coverageDetails = [];

  if (medicareParts.includes(MEDICARE_PARTS.PART_A)) {
    coverageDetails.push({ ...MEDICARE_PART_A_COVERAGE });
  }

  if (medicareParts.includes(MEDICARE_PARTS.PART_B)) {
    coverageDetails.push({ ...MEDICARE_PART_B_COVERAGE });
  }

  if (medicareParts.includes(MEDICARE_PARTS.PART_D)) {
    coverageDetails.push({ ...MEDICARE_PART_D_COVERAGE });
  }

  return coverageDetails;
}

/**
 * Gets additional benefits for a condition category.
 * @param {string} conditionCategory - The condition category
 * @returns {Object[]} Array of additional benefit objects
 */
function getAdditionalBenefitsForCategory(conditionCategory) {
  if (typeof conditionCategory !== 'string' || conditionCategory.trim().length === 0) {
    return [];
  }

  const benefits = ADDITIONAL_BENEFITS_BY_CATEGORY[conditionCategory.trim()];
  if (!Array.isArray(benefits)) {
    return [];
  }

  return benefits.map((b) => ({ ...b }));
}

/**
 * Finds the best matching benefit package for a condition category.
 * @param {string} conditionCategory - The condition category
 * @param {string} [planType='C-SNP'] - The plan type
 * @returns {Object|null} The best matching benefit package or null
 */
function findBestBenefitPackage(conditionCategory, planType) {
  if (typeof conditionCategory !== 'string' || conditionCategory.trim().length === 0) {
    return null;
  }

  const plan = planType || PLAN_TYPES.C_SNP;
  const packages = getAllBenefitPackages();

  const matching = packages.filter(
    (pkg) =>
      Array.isArray(pkg.eligibleConditionCategories) &&
      pkg.eligibleConditionCategories.includes(conditionCategory.trim()) &&
      pkg.planType === plan
  );

  if (matching.length === 0) {
    return null;
  }

  // Sort by lowest premium, then lowest max out-of-pocket
  const sorted = [...matching].sort((a, b) => {
    const premiumDiff = (a.monthlyPremium || 0) - (b.monthlyPremium || 0);
    if (premiumDiff !== 0) {
      return premiumDiff;
    }
    return (a.maxOutOfPocket || 0) - (b.maxOutOfPocket || 0);
  });

  return sorted[0];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Assigns benefits to a member based on their condition category.
 * Determines the best benefit package, builds coverage details,
 * copay schedule, deductible info, additional benefits, and Medicare coverage.
 *
 * @param {string} memberId - The member ID
 * @param {string} conditionCategory - The condition category from CONDITION_CATEGORIES
 * @param {Object} [options={}] - Assignment options
 * @param {string} [options.performedBy] - User ID performing the assignment
 * @param {string} [options.planType='C-SNP'] - Plan type
 * @param {string} [options.benefitPackageId] - Specific benefit package ID to assign (overrides auto-selection)
 * @returns {BenefitAssignmentResult} The benefit assignment result
 */
export function assignBenefits(memberId, conditionCategory, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const planType = (options && typeof options.planType === 'string') ? options.planType : PLAN_TYPES.C_SNP;
  const specificPackageId = (options && typeof options.benefitPackageId === 'string') ? options.benefitPackageId : null;

  const defaultResult = {
    success: false,
    assignmentId: null,
    benefitPackageId: null,
    benefitPackageName: null,
    benefitSummary: null,
    ruleEvaluation: null,
    auditId: null,
    timestamp,
  };

  // Validate inputs
  const memberIdResult = validateRequired(memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  const conditionResult = validateRequired(conditionCategory, 'Condition category');
  if (!conditionResult.valid) {
    return { ...defaultResult, error: conditionResult.error };
  }

  const trimmedMemberId = memberId.trim();
  const trimmedCondition = conditionCategory.trim();

  try {
    // Verify member exists
    const member = getMemberById(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Run benefit rules evaluation
    const ruleEvaluation = evaluateBenefitRules(trimmedCondition, planType, {
      performedBy,
      auditLog: false,
    });

    defaultResult.ruleEvaluation = ruleEvaluation;

    // Determine benefit package
    let benefitPackage = null;

    if (specificPackageId) {
      benefitPackage = getBenefitPackageById(specificPackageId);
      if (!benefitPackage) {
        return { ...defaultResult, error: `Benefit package not found: ${specificPackageId}` };
      }
    } else if (ruleEvaluation.eligible && ruleEvaluation.recommendedPackageId) {
      benefitPackage = getBenefitPackageById(ruleEvaluation.recommendedPackageId);
    }

    if (!benefitPackage) {
      benefitPackage = findBestBenefitPackage(trimmedCondition, planType);
    }

    if (!benefitPackage) {
      return {
        ...defaultResult,
        error: `No benefit package available for condition category "${CONDITION_CATEGORY_LABELS[trimmedCondition] || trimmedCondition}" and plan type "${planType}"`,
      };
    }

    // Build coverage details
    const medicareParts = member.medicareParts || [];
    const medicareCoverage = buildMedicareCoverageDetails(medicareParts);
    const copaySchedule = buildCopaySchedule(benefitPackage.benefits);
    const deductibleInfo = buildDeductibleInfo(benefitPackage);
    const additionalBenefits = getAdditionalBenefitsForCategory(trimmedCondition);

    // Build coverage details object
    const coverageDetails = {
      planType: benefitPackage.planType,
      planName: benefitPackage.name,
      effectiveDate: benefitPackage.effectiveDate,
      terminationDate: benefitPackage.terminationDate,
      medicareCoverage,
      conditionCategory: trimmedCondition,
      conditionCategoryLabel: CONDITION_CATEGORY_LABELS[trimmedCondition] || trimmedCondition,
    };

    // Check for duplicate active assignment
    const existingAssignments = getAllBenefitAssignments();
    const duplicateAssignment = existingAssignments.find(
      (a) =>
        a.memberId === trimmedMemberId &&
        a.benefitPackageId === benefitPackage.id &&
        a.status === 'active'
    );

    if (duplicateAssignment) {
      return {
        ...defaultResult,
        error: `Member already has an active benefit assignment for package "${benefitPackage.name}" (${duplicateAssignment.id})`,
      };
    }

    // Create benefit assignment record
    const assignmentId = uuidv4();
    const assignment = {
      id: assignmentId,
      memberId: trimmedMemberId,
      benefitPackageId: benefitPackage.id,
      conditionCategory: trimmedCondition,
      diagnosisCodes: member.diagnosisCodes || [],
      coverageDetails,
      copaySchedule,
      deductibleInfo,
      additionalBenefits,
      medicareParts,
      status: 'active',
      assignedBy: performedBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Persist assignment
    const saved = appendToArray(BENEFIT_ASSIGNMENTS_KEY, assignment);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist benefit assignment record' };
    }

    // Build benefit summary
    const benefitSummary = {
      packageId: benefitPackage.id,
      packageName: benefitPackage.name,
      planType: benefitPackage.planType,
      conditionCategory: trimmedCondition,
      conditionCategoryLabel: CONDITION_CATEGORY_LABELS[trimmedCondition] || trimmedCondition,
      monthlyPremium: deductibleInfo.monthlyPremium,
      annualDeductible: deductibleInfo.annualDeductible,
      maxOutOfPocket: deductibleInfo.maxOutOfPocket,
      copayCount: Object.keys(copaySchedule).length,
      additionalBenefitsCount: additionalBenefits.length,
      medicareCoverageCount: medicareCoverage.length,
    };

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.APPROVE,
      performedBy,
      {
        targetType: 'benefit_assignment',
        targetId: assignmentId,
        description: `Benefits assigned to member ${member.firstName} ${member.lastName} (${trimmedMemberId}). Package: "${benefitPackage.name}". Condition: ${CONDITION_CATEGORY_LABELS[trimmedCondition] || trimmedCondition}`,
        metadata: {
          memberId: trimmedMemberId,
          assignmentId,
          benefitPackageId: benefitPackage.id,
          benefitPackageName: benefitPackage.name,
          conditionCategory: trimmedCondition,
          monthlyPremium: deductibleInfo.monthlyPremium,
          maxOutOfPocket: deductibleInfo.maxOutOfPocket,
        },
        ipAddress: '127.0.0.1',
      },
      'benefits'
    );

    return {
      success: true,
      assignmentId,
      benefitPackageId: benefitPackage.id,
      benefitPackageName: benefitPackage.name,
      benefitSummary,
      ruleEvaluation,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('benefitsService.assignBenefits: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during benefit assignment' };
  }
}

/**
 * Assigns benefits to a member using their stored diagnosis codes.
 * Automatically determines the primary condition category from the member's ICD-10 codes.
 *
 * @param {string} memberId - The member ID
 * @param {Object} [options={}] - Assignment options
 * @param {string} [options.performedBy] - User ID performing the assignment
 * @param {string} [options.planType='C-SNP'] - Plan type
 * @returns {BenefitAssignmentResult} The benefit assignment result
 */
export function assignBenefitsForMember(memberId, options = {}) {
  const timestamp = new Date().toISOString();

  const defaultResult = {
    success: false,
    assignmentId: null,
    benefitPackageId: null,
    benefitPackageName: null,
    benefitSummary: null,
    ruleEvaluation: null,
    auditId: null,
    timestamp,
  };

  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return { ...defaultResult, error: 'Member ID is required' };
  }

  try {
    const member = getMemberById(memberId.trim());
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${memberId.trim()}` };
    }

    const diagnosisCodes = member.diagnosisCodes || [];
    if (diagnosisCodes.length === 0) {
      return { ...defaultResult, error: 'Member has no diagnosis codes for benefit assignment' };
    }

    // Determine primary condition category
    const primaryCondition = determinePrimaryConditionCategory(diagnosisCodes);
    if (!primaryCondition) {
      return { ...defaultResult, error: 'No CSNP-eligible condition found in member diagnosis codes' };
    }

    // Use member's existing condition category if available, otherwise use determined one
    const conditionCategory = member.conditionCategory || primaryCondition.category;

    return assignBenefits(memberId, conditionCategory, options);
  } catch (error) {
    console.error('benefitsService.assignBenefitsForMember: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during benefit assignment' };
  }
}

/**
 * Configures a new benefit package or updates an existing one.
 *
 * @param {Object} packageData - The benefit package data
 * @param {string} [packageData.id] - Existing package ID (for updates)
 * @param {string} packageData.name - Package name
 * @param {string} [packageData.planType='C-SNP'] - Plan type
 * @param {string} packageData.description - Package description
 * @param {string} packageData.effectiveDate - Effective date (YYYY-MM-DD)
 * @param {string} packageData.terminationDate - Termination date (YYYY-MM-DD)
 * @param {Object} packageData.benefits - Benefit details
 * @param {string[]} packageData.eligibleConditionCategories - Eligible condition categories
 * @param {number} [packageData.monthlyPremium=0] - Monthly premium amount
 * @param {number} [packageData.annualDeductible=0] - Annual deductible amount
 * @param {number} [packageData.maxOutOfPocket=0] - Maximum out-of-pocket amount
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.performedBy] - User ID performing the configuration
 * @returns {{ success: boolean, packageId: string|null, auditId: string|null, error?: string }}
 */
export function configureBenefits(packageData, options = {}) {
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const timestamp = new Date().toISOString();

  if (!packageData || typeof packageData !== 'object') {
    return { success: false, packageId: null, auditId: null, error: 'Package data is required' };
  }

  // Validate required fields
  const nameResult = validateRequired(packageData.name, 'Package name');
  if (!nameResult.valid) {
    return { success: false, packageId: null, auditId: null, error: nameResult.error };
  }

  const descResult = validateRequired(packageData.description, 'Description');
  if (!descResult.valid) {
    return { success: false, packageId: null, auditId: null, error: descResult.error };
  }

  if (packageData.effectiveDate) {
    const effectiveDateResult = validateDateFormat(packageData.effectiveDate, 'Effective date');
    if (!effectiveDateResult.valid) {
      return { success: false, packageId: null, auditId: null, error: effectiveDateResult.error };
    }
  }

  if (packageData.terminationDate) {
    const terminationDateResult = validateDateFormat(packageData.terminationDate, 'Termination date');
    if (!terminationDateResult.valid) {
      return { success: false, packageId: null, auditId: null, error: terminationDateResult.error };
    }
  }

  if (!Array.isArray(packageData.eligibleConditionCategories) || packageData.eligibleConditionCategories.length === 0) {
    return { success: false, packageId: null, auditId: null, error: 'At least one eligible condition category is required' };
  }

  try {
    const isUpdate = typeof packageData.id === 'string' && packageData.id.trim().length > 0;

    if (isUpdate) {
      // Update existing package
      const existingPackage = getBenefitPackageById(packageData.id);
      if (!existingPackage) {
        return { success: false, packageId: null, auditId: null, error: `Benefit package not found: ${packageData.id}` };
      }

      const updated = updateInArray(
        BENEFIT_PACKAGES_KEY,
        (pkg) => pkg.id === packageData.id.trim(),
        (pkg) => ({
          ...pkg,
          name: packageData.name.trim(),
          planType: packageData.planType || pkg.planType || PLAN_TYPES.C_SNP,
          description: packageData.description.trim(),
          effectiveDate: packageData.effectiveDate || pkg.effectiveDate,
          terminationDate: packageData.terminationDate || pkg.terminationDate,
          benefits: packageData.benefits || pkg.benefits,
          eligibleConditionCategories: packageData.eligibleConditionCategories,
          monthlyPremium: typeof packageData.monthlyPremium === 'number' ? packageData.monthlyPremium : pkg.monthlyPremium,
          annualDeductible: typeof packageData.annualDeductible === 'number' ? packageData.annualDeductible : pkg.annualDeductible,
          maxOutOfPocket: typeof packageData.maxOutOfPocket === 'number' ? packageData.maxOutOfPocket : pkg.maxOutOfPocket,
          updatedAt: timestamp,
        })
      );

      if (!updated) {
        return { success: false, packageId: packageData.id.trim(), auditId: null, error: 'Failed to update benefit package' };
      }

      const auditEntry = logAction(
        AUDIT_ACTIONS.UPDATE,
        performedBy,
        {
          targetType: 'benefit_package',
          targetId: packageData.id.trim(),
          description: `Benefit package "${packageData.name.trim()}" updated`,
          metadata: {
            packageId: packageData.id.trim(),
            packageName: packageData.name.trim(),
            eligibleConditionCategories: packageData.eligibleConditionCategories,
          },
          ipAddress: '127.0.0.1',
        },
        'benefits'
      );

      return {
        success: true,
        packageId: packageData.id.trim(),
        auditId: auditEntry ? auditEntry.id : null,
      };
    } else {
      // Create new package
      const packageId = uuidv4();
      const newPackage = {
        id: packageId,
        name: packageData.name.trim(),
        planType: packageData.planType || PLAN_TYPES.C_SNP,
        description: packageData.description.trim(),
        effectiveDate: packageData.effectiveDate || null,
        terminationDate: packageData.terminationDate || null,
        benefits: packageData.benefits || {},
        eligibleConditionCategories: packageData.eligibleConditionCategories,
        monthlyPremium: typeof packageData.monthlyPremium === 'number' ? packageData.monthlyPremium : 0,
        annualDeductible: typeof packageData.annualDeductible === 'number' ? packageData.annualDeductible : 0,
        maxOutOfPocket: typeof packageData.maxOutOfPocket === 'number' ? packageData.maxOutOfPocket : 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const saved = appendToArray(BENEFIT_PACKAGES_KEY, newPackage);
      if (!saved) {
        return { success: false, packageId: null, auditId: null, error: 'Failed to persist benefit package' };
      }

      const auditEntry = logAction(
        AUDIT_ACTIONS.CREATE,
        performedBy,
        {
          targetType: 'benefit_package',
          targetId: packageId,
          description: `Benefit package "${packageData.name.trim()}" created`,
          metadata: {
            packageId,
            packageName: packageData.name.trim(),
            planType: newPackage.planType,
            eligibleConditionCategories: packageData.eligibleConditionCategories,
            monthlyPremium: newPackage.monthlyPremium,
            maxOutOfPocket: newPackage.maxOutOfPocket,
          },
          ipAddress: '127.0.0.1',
        },
        'benefits'
      );

      return {
        success: true,
        packageId,
        auditId: auditEntry ? auditEntry.id : null,
      };
    }
  } catch (error) {
    console.error('benefitsService.configureBenefits: unexpected error:', error);
    return { success: false, packageId: null, auditId: null, error: 'An unexpected error occurred during benefit configuration' };
  }
}

/**
 * Retrieves a benefit package by plan ID (benefit package ID).
 * Returns the full benefit package with coverage details.
 *
 * @param {string} planId - The benefit package ID
 * @returns {Object|null} The benefit package with enriched coverage details, or null
 */
export function getBenefits(planId) {
  if (typeof planId !== 'string' || planId.trim().length === 0) {
    return null;
  }

  try {
    const benefitPackage = getBenefitPackageById(planId.trim());
    if (!benefitPackage) {
      return null;
    }

    // Enrich with copay schedule and deductible info
    const copaySchedule = buildCopaySchedule(benefitPackage.benefits);
    const deductibleInfo = buildDeductibleInfo(benefitPackage);

    // Build additional benefits for all eligible categories
    const additionalBenefitsByCategory = {};
    if (Array.isArray(benefitPackage.eligibleConditionCategories)) {
      for (const category of benefitPackage.eligibleConditionCategories) {
        additionalBenefitsByCategory[category] = {
          categoryLabel: CONDITION_CATEGORY_LABELS[category] || category,
          benefits: getAdditionalBenefitsForCategory(category),
        };
      }
    }

    return {
      ...benefitPackage,
      copaySchedule,
      deductibleInfo,
      additionalBenefitsByCategory,
    };
  } catch (error) {
    console.error('benefitsService.getBenefits: unexpected error:', error);
    return null;
  }
}

/**
 * Lists all available benefit packages.
 * Optionally filters by plan type or condition category.
 *
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.planType] - Filter by plan type
 * @param {string} [filters.conditionCategory] - Filter by condition category
 * @param {boolean} [filters.activeOnly=false] - Only return packages within effective date range
 * @returns {Object[]} Array of benefit packages
 */
export function listBenefitPackages(filters = {}) {
  try {
    let packages = getAllBenefitPackages();

    if (!filters || typeof filters !== 'object') {
      return packages;
    }

    // Filter by plan type
    if (filters.planType && typeof filters.planType === 'string' && filters.planType.trim().length > 0) {
      const planTypeFilter = filters.planType.trim();
      packages = packages.filter((pkg) => pkg.planType === planTypeFilter);
    }

    // Filter by condition category
    if (filters.conditionCategory && typeof filters.conditionCategory === 'string' && filters.conditionCategory.trim().length > 0) {
      const categoryFilter = filters.conditionCategory.trim();
      packages = packages.filter(
        (pkg) =>
          Array.isArray(pkg.eligibleConditionCategories) &&
          pkg.eligibleConditionCategories.includes(categoryFilter)
      );
    }

    // Filter by active date range
    if (filters.activeOnly === true) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      packages = packages.filter((pkg) => {
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
    }

    return packages;
  } catch (error) {
    console.error('benefitsService.listBenefitPackages: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves benefit assignments for a member.
 *
 * @param {string} memberId - The member ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.status] - Filter by assignment status
 * @returns {Object[]} Array of benefit assignment records
 */
export function getMemberBenefitAssignments(memberId, filters = {}) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    let assignments = getAllBenefitAssignments();
    assignments = assignments.filter((a) => a.memberId === memberId.trim());

    if (filters && typeof filters.status === 'string' && filters.status.trim().length > 0) {
      assignments = assignments.filter((a) => a.status === filters.status.trim());
    }

    return assignments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('benefitsService.getMemberBenefitAssignments: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves the active benefit assignment for a member.
 *
 * @param {string} memberId - The member ID
 * @returns {Object|null} The active benefit assignment or null
 */
export function getActiveBenefitAssignment(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return null;
  }

  try {
    const assignments = getMemberBenefitAssignments(memberId, { status: 'active' });
    return assignments.length > 0 ? assignments[0] : null;
  } catch (error) {
    console.error('benefitsService.getActiveBenefitAssignment: unexpected error:', error);
    return null;
  }
}

/**
 * Deactivates a benefit assignment.
 *
 * @param {string} assignmentId - The benefit assignment ID
 * @param {string} [reason=''] - Deactivation reason
 * @param {string} [performedBy] - User ID performing the deactivation
 * @returns {{ success: boolean, error?: string }}
 */
export function deactivateBenefitAssignment(assignmentId, reason, performedBy) {
  if (typeof assignmentId !== 'string' || assignmentId.trim().length === 0) {
    return { success: false, error: 'Assignment ID is required' };
  }

  const trimmedId = assignmentId.trim();

  try {
    const assignment = findInArray(BENEFIT_ASSIGNMENTS_KEY, (a) => a.id === trimmedId);
    if (!assignment) {
      return { success: false, error: `Benefit assignment not found: ${trimmedId}` };
    }

    if (assignment.status !== 'active') {
      return { success: false, error: `Benefit assignment is not active. Current status: "${assignment.status}"` };
    }

    const timestamp = new Date().toISOString();
    const deactivationReason = typeof reason === 'string' ? reason.trim() : '';

    const updated = updateInArray(
      BENEFIT_ASSIGNMENTS_KEY,
      (a) => a.id === trimmedId,
      (a) => ({
        ...a,
        status: 'inactive',
        deactivationReason: deactivationReason,
        deactivatedAt: timestamp,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, error: 'Failed to update benefit assignment' };
    }

    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy || 'system',
      {
        targetType: 'benefit_assignment',
        targetId: trimmedId,
        description: `Benefit assignment ${trimmedId} deactivated for member ${assignment.memberId}. Reason: ${deactivationReason || 'Not specified'}`,
        metadata: {
          assignmentId: trimmedId,
          memberId: assignment.memberId,
          benefitPackageId: assignment.benefitPackageId,
          reason: deactivationReason,
        },
        ipAddress: '127.0.0.1',
      },
      'benefits'
    );

    return { success: true };
  } catch (error) {
    console.error('benefitsService.deactivateBenefitAssignment: unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred during deactivation' };
  }
}

/**
 * Returns the Medicare coverage details for a member based on their enrolled parts.
 *
 * @param {string} memberId - The member ID
 * @returns {{ medicareParts: string[], coverageDetails: Object[] } | null}
 */
export function getMemberMedicareCoverage(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return null;
  }

  try {
    const member = getMemberById(memberId.trim());
    if (!member) {
      return null;
    }

    const medicareParts = member.medicareParts || [];
    const coverageDetails = buildMedicareCoverageDetails(medicareParts);

    return {
      medicareParts,
      coverageDetails,
    };
  } catch (error) {
    console.error('benefitsService.getMemberMedicareCoverage: unexpected error:', error);
    return null;
  }
}

/**
 * Returns the additional benefits available for a specific condition category.
 *
 * @param {string} conditionCategory - The condition category from CONDITION_CATEGORIES
 * @returns {Object[]} Array of additional benefit objects
 */
export function getAdditionalBenefits(conditionCategory) {
  if (typeof conditionCategory !== 'string' || conditionCategory.trim().length === 0) {
    return [];
  }

  return getAdditionalBenefitsForCategory(conditionCategory.trim());
}

/**
 * Returns the copay schedule for a specific benefit package.
 *
 * @param {string} packageId - The benefit package ID
 * @returns {Object|null} The copay schedule or null
 */
export function getCopaySchedule(packageId) {
  if (typeof packageId !== 'string' || packageId.trim().length === 0) {
    return null;
  }

  try {
    const benefitPackage = getBenefitPackageById(packageId.trim());
    if (!benefitPackage) {
      return null;
    }

    return buildCopaySchedule(benefitPackage.benefits);
  } catch (error) {
    console.error('benefitsService.getCopaySchedule: unexpected error:', error);
    return null;
  }
}

/**
 * Returns the deductible information for a specific benefit package.
 *
 * @param {string} packageId - The benefit package ID
 * @returns {Object|null} The deductible information or null
 */
export function getDeductibleInfo(packageId) {
  if (typeof packageId !== 'string' || packageId.trim().length === 0) {
    return null;
  }

  try {
    const benefitPackage = getBenefitPackageById(packageId.trim());
    if (!benefitPackage) {
      return null;
    }

    return buildDeductibleInfo(benefitPackage);
  } catch (error) {
    console.error('benefitsService.getDeductibleInfo: unexpected error:', error);
    return null;
  }
}

/**
 * Returns benefit statistics across all packages and assignments.
 *
 * @returns {{ totalPackages: number, totalAssignments: number, activeAssignments: number, byConditionCategory: Object.<string, number>, byPlanType: Object.<string, number> }}
 */
export function getBenefitStats() {
  try {
    const packages = getAllBenefitPackages();
    const assignments = getAllBenefitAssignments();

    const stats = {
      totalPackages: packages.length,
      totalAssignments: assignments.length,
      activeAssignments: 0,
      inactiveAssignments: 0,
      pendingAssignments: 0,
      byConditionCategory: {},
      byPlanType: {},
    };

    for (const assignment of assignments) {
      switch (assignment.status) {
        case 'active':
          stats.activeAssignments++;
          break;
        case 'inactive':
          stats.inactiveAssignments++;
          break;
        case 'pending':
          stats.pendingAssignments++;
          break;
        default:
          break;
      }

      if (assignment.conditionCategory) {
        if (!stats.byConditionCategory[assignment.conditionCategory]) {
          stats.byConditionCategory[assignment.conditionCategory] = 0;
        }
        stats.byConditionCategory[assignment.conditionCategory]++;
      }
    }

    for (const pkg of packages) {
      const planType = pkg.planType || 'unknown';
      if (!stats.byPlanType[planType]) {
        stats.byPlanType[planType] = 0;
      }
      stats.byPlanType[planType]++;
    }

    return stats;
  } catch (error) {
    console.error('benefitsService.getBenefitStats: unexpected error:', error);
    return {
      totalPackages: 0,
      totalAssignments: 0,
      activeAssignments: 0,
      inactiveAssignments: 0,
      pendingAssignments: 0,
      byConditionCategory: {},
      byPlanType: {},
    };
  }
}

/**
 * Returns benefit packages that match a set of condition categories.
 *
 * @param {string[]} conditionCategories - Array of condition categories
 * @param {string} [planType='C-SNP'] - Plan type
 * @returns {Object[]} Array of matching benefit packages
 */
export function findMatchingBenefitPackages(conditionCategories, planType) {
  if (!Array.isArray(conditionCategories) || conditionCategories.length === 0) {
    return [];
  }

  const plan = (typeof planType === 'string' && planType.trim().length > 0) ? planType.trim() : PLAN_TYPES.C_SNP;

  try {
    const packages = getAllBenefitPackages();

    return packages.filter((pkg) => {
      if (pkg.planType !== plan) {
        return false;
      }

      if (!Array.isArray(pkg.eligibleConditionCategories)) {
        return false;
      }

      return conditionCategories.some((category) =>
        typeof category === 'string' && pkg.eligibleConditionCategories.includes(category.trim())
      );
    });
  } catch (error) {
    console.error('benefitsService.findMatchingBenefitPackages: unexpected error:', error);
    return [];
  }
}

/**
 * Performs a batch benefit assignment for multiple members.
 *
 * @param {Array<{ memberId: string, conditionCategory: string }>} memberConditions - Array of member-condition pairs
 * @param {Object} [options={}] - Assignment options
 * @param {string} [options.performedBy] - User ID performing the batch assignment
 * @param {string} [options.planType='C-SNP'] - Plan type
 * @returns {{ total: number, successful: number, failed: number, results: BenefitAssignmentResult[] }}
 */
export function batchAssignBenefits(memberConditions, options = {}) {
  const batchResult = {
    total: 0,
    successful: 0,
    failed: 0,
    results: [],
  };

  if (!Array.isArray(memberConditions) || memberConditions.length === 0) {
    return batchResult;
  }

  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  batchResult.total = memberConditions.length;

  for (const item of memberConditions) {
    if (!item || typeof item !== 'object') {
      batchResult.failed++;
      batchResult.results.push({
        success: false,
        assignmentId: null,
        benefitPackageId: null,
        benefitPackageName: null,
        benefitSummary: null,
        ruleEvaluation: null,
        auditId: null,
        timestamp: new Date().toISOString(),
        error: 'Invalid member-condition pair',
      });
      continue;
    }

    const result = assignBenefits(item.memberId, item.conditionCategory, {
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
        targetType: 'benefit_assignment_batch',
        targetId: '',
        description: `Batch benefit assignment: ${batchResult.successful} successful, ${batchResult.failed} failed out of ${batchResult.total} total`,
        metadata: {
          total: batchResult.total,
          successful: batchResult.successful,
          failed: batchResult.failed,
        },
        ipAddress: '127.0.0.1',
      },
      'benefits'
    );
  }

  return batchResult;
}

/**
 * Returns all available condition categories with their labels and
 * whether benefit packages exist for them.
 *
 * @returns {{ category: string, label: string, hasPackage: boolean, packageCount: number }[]}
 */
export function getAvailableConditionCategories() {
  try {
    const packages = getAllBenefitPackages();
    const categories = Object.values(CONDITION_CATEGORIES);

    return categories.map((category) => {
      const matchingPackages = packages.filter(
        (pkg) =>
          Array.isArray(pkg.eligibleConditionCategories) &&
          pkg.eligibleConditionCategories.includes(category)
      );

      return {
        category,
        label: CONDITION_CATEGORY_LABELS[category] || category,
        hasPackage: matchingPackages.length > 0,
        packageCount: matchingPackages.length,
      };
    });
  } catch (error) {
    console.error('benefitsService.getAvailableConditionCategories: unexpected error:', error);
    return [];
  }
}