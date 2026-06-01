import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  assignBenefits,
  assignBenefitsForMember,
  configureBenefits,
  getBenefits,
  listBenefitPackages,
  getMemberBenefitAssignments,
  getActiveBenefitAssignment,
  deactivateBenefitAssignment,
  getMemberMedicareCoverage,
  getAdditionalBenefits,
  getCopaySchedule,
  getDeductibleInfo,
  getBenefitStats,
  findMatchingBenefitPackages,
  batchAssignBenefits,
  getAvailableConditionCategories,
} from '../benefitsService.js';
import {
  PLAN_TYPES,
  MEDICARE_PARTS,
} from '../../utils/constants.js';
import { CONDITION_CATEGORIES, CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';

/**
 * Helper to set up localStorage with seed members.
 * @param {Object[]} members - Array of member objects
 */
function seedMembers(members) {
  localStorage.setItem('csnp_members', JSON.stringify(members));
}

/**
 * Helper to set up localStorage with benefit packages.
 * @param {Object[]} packages - Array of benefit package objects
 */
function seedBenefitPackages(packages) {
  localStorage.setItem('csnp_benefit_packages', JSON.stringify(packages));
}

/**
 * Helper to set up localStorage with benefit assignments.
 * @param {Object[]} assignments - Array of benefit assignment objects
 */
function seedBenefitAssignments(assignments) {
  localStorage.setItem('csnp_benefit_assignments', JSON.stringify(assignments));
}

/**
 * Helper to get benefit packages from localStorage.
 * @returns {Object[]}
 */
function getStoredBenefitPackages() {
  const raw = localStorage.getItem('csnp_benefit_packages');
  if (!raw) return [];
  return JSON.parse(raw);
}

/**
 * Helper to get benefit assignments from localStorage.
 * @returns {Object[]}
 */
function getStoredBenefitAssignments() {
  const raw = localStorage.getItem('csnp_benefit_assignments');
  if (!raw) return [];
  return JSON.parse(raw);
}

/**
 * Helper to seed audit logs (empty array to avoid errors).
 */
function seedAuditLogs() {
  if (!localStorage.getItem('csnp_audit_logs')) {
    localStorage.setItem('csnp_audit_logs', JSON.stringify([]));
  }
}

const TEST_MEMBER_DIABETES = {
  id: 'member-ben-001',
  firstName: 'Alice',
  lastName: 'Johnson',
  dateOfBirth: '1950-03-15',
  ssn: '***-**-1111',
  ccid: 'H1234-001',
  medicareId: '1EG4-TE5-MK72',
  gender: 'Female',
  email: 'alice@example.com',
  phone: '(555) 111-1111',
  address: {
    street: '100 Test Lane',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
  },
  diagnosisCodes: ['E11.9', 'E11.65', 'I10'],
  conditionCategory: CONDITION_CATEGORIES.DIABETES,
  primaryProviderId: null,
  benefitPackageId: null,
  medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C, MEDICARE_PARTS.PART_D],
  csnpEligible: true,
  createdAt: '2024-01-10T08:30:00.000Z',
  updatedAt: '2024-06-15T14:22:00.000Z',
};

const TEST_MEMBER_HEART_FAILURE = {
  id: 'member-ben-002',
  firstName: 'Bob',
  lastName: 'Smith',
  dateOfBirth: '1948-07-22',
  ssn: '***-**-2222',
  ccid: 'H1234-001',
  medicareId: '2FH5-UF6-NL83',
  gender: 'Male',
  email: 'bob@example.com',
  phone: '(555) 222-2222',
  address: {
    street: '200 Test Ave',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601',
  },
  diagnosisCodes: ['I50.22', 'I50.9', 'I25.10'],
  conditionCategory: CONDITION_CATEGORIES.HEART_FAILURE,
  primaryProviderId: null,
  benefitPackageId: null,
  medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C, MEDICARE_PARTS.PART_D],
  csnpEligible: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-07-01T09:15:00.000Z',
};

const TEST_MEMBER_NO_CODES = {
  id: 'member-ben-003',
  firstName: 'Carol',
  lastName: 'Davis',
  dateOfBirth: '1955-09-12',
  ssn: '***-**-3333',
  ccid: 'H1234-002',
  medicareId: '3GI6-VG7-OM94',
  gender: 'Female',
  email: 'carol@example.com',
  phone: '(555) 333-3333',
  address: {
    street: '300 Test Blvd',
    city: 'Peoria',
    state: 'IL',
    zipCode: '61602',
  },
  diagnosisCodes: [],
  conditionCategory: null,
  primaryProviderId: null,
  benefitPackageId: null,
  medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B],
  csnpEligible: false,
  createdAt: '2024-02-01T11:30:00.000Z',
  updatedAt: '2024-05-20T16:45:00.000Z',
};

const TEST_MEMBER_COPD = {
  id: 'member-ben-004',
  firstName: 'Dan',
  lastName: 'Wilson',
  dateOfBirth: '1945-11-08',
  ssn: '***-**-4444',
  ccid: 'H1234-002',
  medicareId: '4HJ7-WH8-PN05',
  gender: 'Male',
  email: 'dan@example.com',
  phone: '(555) 444-4444',
  address: {
    street: '400 Test Rd',
    city: 'Rockford',
    state: 'IL',
    zipCode: '61101',
  },
  diagnosisCodes: ['J44.1', 'J44.9'],
  conditionCategory: CONDITION_CATEGORIES.COPD,
  primaryProviderId: null,
  benefitPackageId: null,
  medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C],
  csnpEligible: true,
  createdAt: '2024-02-10T09:00:00.000Z',
  updatedAt: '2024-08-01T11:30:00.000Z',
};

const TEST_BENEFIT_PACKAGE_1 = {
  id: 'bp-test-001',
  name: 'CSNP Comprehensive Care Plan',
  planType: PLAN_TYPES.C_SNP,
  description: 'Comprehensive C-SNP plan covering diabetes, heart failure, cardiovascular, and ESRD conditions.',
  effectiveDate: '2024-01-01',
  terminationDate: '2024-12-31',
  benefits: {
    primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay for PCP visits' },
    specialistVisit: { copay: 20, coinsurance: 0, description: '$20 copay for specialist visits' },
    emergencyRoom: { copay: 90, coinsurance: 0, description: '$90 copay (waived if admitted)' },
    inpatientHospital: { copay: 250, coinsurance: 0, description: '$250/day for days 1-5' },
    prescriptionDrugTier1: { copay: 0, coinsurance: 0, description: '$0 copay for Tier 1 generics' },
    prescriptionDrugTier2: { copay: 10, coinsurance: 0, description: '$10 copay for Tier 2 preferred generics' },
    prescriptionDrugTier3: { copay: 42, coinsurance: 0, description: '$42 copay for Tier 3 preferred brands' },
    diabetesSupplies: { copay: 0, coinsurance: 0, description: '$0 copay for diabetes testing supplies' },
    dialysis: { copay: 0, coinsurance: 20, description: '20% coinsurance for dialysis services' },
    cardiacRehab: { copay: 20, coinsurance: 0, description: '$20 copay per session' },
    homeHealth: { copay: 0, coinsurance: 0, description: '$0 copay for home health services' },
    telehealth: { copay: 0, coinsurance: 0, description: '$0 copay for telehealth visits' },
  },
  eligibleConditionCategories: [
    CONDITION_CATEGORIES.DIABETES,
    CONDITION_CATEGORIES.HEART_FAILURE,
    CONDITION_CATEGORIES.CARDIOVASCULAR,
    CONDITION_CATEGORIES.ESRD,
  ],
  monthlyPremium: 0,
  annualDeductible: 0,
  maxOutOfPocket: 3400,
  createdAt: '2023-10-01T08:00:00.000Z',
  updatedAt: '2023-12-15T10:00:00.000Z',
};

const TEST_BENEFIT_PACKAGE_2 = {
  id: 'bp-test-002',
  name: 'CSNP Respiratory & Renal Plan',
  planType: PLAN_TYPES.C_SNP,
  description: 'C-SNP plan tailored for members with COPD, chronic respiratory conditions, CKD, and cancer.',
  effectiveDate: '2024-01-01',
  terminationDate: '2024-12-31',
  benefits: {
    primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay for PCP visits' },
    specialistVisit: { copay: 25, coinsurance: 0, description: '$25 copay for specialist visits' },
    emergencyRoom: { copay: 90, coinsurance: 0, description: '$90 copay (waived if admitted)' },
    inpatientHospital: { copay: 275, coinsurance: 0, description: '$275/day for days 1-5' },
    prescriptionDrugTier1: { copay: 0, coinsurance: 0, description: '$0 copay for Tier 1 generics' },
    prescriptionDrugTier2: { copay: 12, coinsurance: 0, description: '$12 copay for Tier 2 preferred generics' },
    prescriptionDrugTier3: { copay: 47, coinsurance: 0, description: '$47 copay for Tier 3 preferred brands' },
    pulmonaryRehab: { copay: 20, coinsurance: 0, description: '$20 copay per session' },
    oxygenEquipment: { copay: 0, coinsurance: 20, description: '20% coinsurance for oxygen equipment' },
    chemotherapy: { copay: 0, coinsurance: 20, description: '20% coinsurance for chemotherapy' },
    homeHealth: { copay: 0, coinsurance: 0, description: '$0 copay for home health services' },
    telehealth: { copay: 0, coinsurance: 0, description: '$0 copay for telehealth visits' },
  },
  eligibleConditionCategories: [
    CONDITION_CATEGORIES.COPD,
    CONDITION_CATEGORIES.RESPIRATORY,
    CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    CONDITION_CATEGORIES.CANCER,
  ],
  monthlyPremium: 15,
  annualDeductible: 0,
  maxOutOfPocket: 3900,
  createdAt: '2023-10-01T08:00:00.000Z',
  updatedAt: '2023-12-15T10:00:00.000Z',
};

const TEST_BENEFIT_PACKAGE_3 = {
  id: 'bp-test-003',
  name: 'CSNP Neuro & Autoimmune Plan',
  planType: PLAN_TYPES.C_SNP,
  description: 'C-SNP plan for dementia, neurological, autoimmune, and mental health conditions.',
  effectiveDate: '2024-01-01',
  terminationDate: '2024-12-31',
  benefits: {
    primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay for PCP visits' },
    specialistVisit: { copay: 15, coinsurance: 0, description: '$15 copay for specialist visits' },
    emergencyRoom: { copay: 90, coinsurance: 0, description: '$90 copay (waived if admitted)' },
    mentalHealth: { copay: 0, coinsurance: 0, description: '$0 copay for outpatient mental health visits' },
    occupationalTherapy: { copay: 20, coinsurance: 0, description: '$20 copay per session' },
    speechTherapy: { copay: 20, coinsurance: 0, description: '$20 copay per session' },
    homeHealth: { copay: 0, coinsurance: 0, description: '$0 copay for home health services' },
    telehealth: { copay: 0, coinsurance: 0, description: '$0 copay for telehealth visits' },
    adultDayCare: { copay: 0, coinsurance: 0, description: '$0 copay for adult day care services' },
  },
  eligibleConditionCategories: [
    CONDITION_CATEGORIES.DEMENTIA,
    CONDITION_CATEGORIES.NEUROLOGICAL,
    CONDITION_CATEGORIES.AUTOIMMUNE,
    CONDITION_CATEGORIES.MENTAL_HEALTH,
  ],
  monthlyPremium: 0,
  annualDeductible: 0,
  maxOutOfPocket: 3200,
  createdAt: '2023-10-01T08:00:00.000Z',
  updatedAt: '2023-12-15T10:00:00.000Z',
};

const EXPIRED_BENEFIT_PACKAGE = {
  id: 'bp-test-expired',
  name: 'Expired CSNP Plan',
  planType: PLAN_TYPES.C_SNP,
  description: 'An expired benefit package for testing.',
  effectiveDate: '2022-01-01',
  terminationDate: '2022-12-31',
  benefits: {
    primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay' },
  },
  eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
  monthlyPremium: 0,
  annualDeductible: 0,
  maxOutOfPocket: 3400,
  createdAt: '2021-10-01T08:00:00.000Z',
  updatedAt: '2021-12-15T10:00:00.000Z',
};

describe('benefitsService', () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuditLogs();
    seedMembers([TEST_MEMBER_DIABETES, TEST_MEMBER_HEART_FAILURE, TEST_MEMBER_NO_CODES, TEST_MEMBER_COPD]);
    seedBenefitPackages([TEST_BENEFIT_PACKAGE_1, TEST_BENEFIT_PACKAGE_2, TEST_BENEFIT_PACKAGE_3]);
  });

  describe('configureBenefits', () => {
    it('creates a new benefit package with valid data', () => {
      const packageData = {
        name: 'New Test Package',
        planType: PLAN_TYPES.C_SNP,
        description: 'A new test benefit package',
        effectiveDate: '2025-01-01',
        terminationDate: '2025-12-31',
        benefits: {
          primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay' },
          specialistVisit: { copay: 30, coinsurance: 0, description: '$30 copay' },
        },
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES, CONDITION_CATEGORIES.COPD],
        monthlyPremium: 10,
        annualDeductible: 100,
        maxOutOfPocket: 4000,
      };

      const result = configureBenefits(packageData, { performedBy: 'user-001' });

      expect(result.success).toBe(true);
      expect(result.packageId).toBeDefined();
      expect(typeof result.packageId).toBe('string');
      expect(result.packageId.length).toBeGreaterThan(0);
      expect(result.auditId).toBeDefined();
    });

    it('persists new benefit package to localStorage', () => {
      const packageData = {
        name: 'Persisted Package',
        planType: PLAN_TYPES.C_SNP,
        description: 'Testing persistence',
        effectiveDate: '2025-01-01',
        terminationDate: '2025-12-31',
        benefits: {
          primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay' },
        },
        eligibleConditionCategories: [CONDITION_CATEGORIES.HEART_FAILURE],
        monthlyPremium: 0,
        annualDeductible: 0,
        maxOutOfPocket: 3500,
      };

      const result = configureBenefits(packageData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredBenefitPackages();
      const created = stored.find((p) => p.id === result.packageId);
      expect(created).toBeDefined();
      expect(created.name).toBe('Persisted Package');
      expect(created.planType).toBe(PLAN_TYPES.C_SNP);
      expect(created.monthlyPremium).toBe(0);
      expect(created.maxOutOfPocket).toBe(3500);
      expect(created.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.HEART_FAILURE);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });

    it('updates an existing benefit package', () => {
      const updateData = {
        id: TEST_BENEFIT_PACKAGE_1.id,
        name: 'Updated Comprehensive Plan',
        description: 'Updated description',
        effectiveDate: '2024-01-01',
        terminationDate: '2025-06-30',
        benefits: TEST_BENEFIT_PACKAGE_1.benefits,
        eligibleConditionCategories: TEST_BENEFIT_PACKAGE_1.eligibleConditionCategories,
        monthlyPremium: 5,
        maxOutOfPocket: 3600,
      };

      const result = configureBenefits(updateData, { performedBy: 'user-001' });

      expect(result.success).toBe(true);
      expect(result.packageId).toBe(TEST_BENEFIT_PACKAGE_1.id);

      const stored = getStoredBenefitPackages();
      const updated = stored.find((p) => p.id === TEST_BENEFIT_PACKAGE_1.id);
      expect(updated.name).toBe('Updated Comprehensive Plan');
      expect(updated.description).toBe('Updated description');
      expect(updated.monthlyPremium).toBe(5);
      expect(updated.maxOutOfPocket).toBe(3600);
    });

    it('returns error when package data is null', () => {
      const result = configureBenefits(null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('returns error when package name is missing', () => {
      const result = configureBenefits({
        description: 'No name',
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('name');
    });

    it('returns error when description is missing', () => {
      const result = configureBenefits({
        name: 'No Description',
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Description');
    });

    it('returns error when eligible condition categories are empty', () => {
      const result = configureBenefits({
        name: 'No Categories',
        description: 'Missing categories',
        eligibleConditionCategories: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('condition category');
    });

    it('returns error when updating a nonexistent package', () => {
      const result = configureBenefits({
        id: 'nonexistent-package-id',
        name: 'Ghost Package',
        description: 'Does not exist',
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error for invalid effective date format', () => {
      const result = configureBenefits({
        name: 'Bad Date Package',
        description: 'Invalid date',
        effectiveDate: 'not-a-date',
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error for invalid termination date format', () => {
      const result = configureBenefits({
        name: 'Bad Term Date Package',
        description: 'Invalid termination date',
        terminationDate: 'invalid',
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('defaults planType to C-SNP when not provided', () => {
      const packageData = {
        name: 'Default Plan Type',
        description: 'Should default to C-SNP',
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
      };

      const result = configureBenefits(packageData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredBenefitPackages();
      const created = stored.find((p) => p.id === result.packageId);
      expect(created.planType).toBe(PLAN_TYPES.C_SNP);
    });

    it('defaults financial fields to 0 when not provided', () => {
      const packageData = {
        name: 'Default Financials',
        description: 'Should default financial fields to 0',
        eligibleConditionCategories: [CONDITION_CATEGORIES.COPD],
      };

      const result = configureBenefits(packageData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredBenefitPackages();
      const created = stored.find((p) => p.id === result.packageId);
      expect(created.monthlyPremium).toBe(0);
      expect(created.annualDeductible).toBe(0);
      expect(created.maxOutOfPocket).toBe(0);
    });
  });

  describe('getBenefits', () => {
    it('returns null for empty package ID', () => {
      const result = getBenefits('');
      expect(result).toBeNull();
    });

    it('returns null for nonexistent package ID', () => {
      const result = getBenefits('nonexistent-id');
      expect(result).toBeNull();
    });

    it('returns enriched benefit package for a valid ID', () => {
      const result = getBenefits(TEST_BENEFIT_PACKAGE_1.id);

      expect(result).not.toBeNull();
      expect(result.id).toBe(TEST_BENEFIT_PACKAGE_1.id);
      expect(result.name).toBe(TEST_BENEFIT_PACKAGE_1.name);
      expect(result.planType).toBe(PLAN_TYPES.C_SNP);
    });

    it('includes copay schedule in enriched result', () => {
      const result = getBenefits(TEST_BENEFIT_PACKAGE_1.id);

      expect(result.copaySchedule).toBeDefined();
      expect(typeof result.copaySchedule).toBe('object');
      expect(result.copaySchedule.primaryCare).toBeDefined();
      expect(result.copaySchedule.primaryCare.copay).toBe(0);
      expect(result.copaySchedule.specialistVisit).toBeDefined();
      expect(result.copaySchedule.specialistVisit.copay).toBe(20);
    });

    it('includes deductible info in enriched result', () => {
      const result = getBenefits(TEST_BENEFIT_PACKAGE_1.id);

      expect(result.deductibleInfo).toBeDefined();
      expect(result.deductibleInfo.annualDeductible).toBe(0);
      expect(result.deductibleInfo.maxOutOfPocket).toBe(3400);
      expect(result.deductibleInfo.monthlyPremium).toBe(0);
    });

    it('includes additional benefits by category in enriched result', () => {
      const result = getBenefits(TEST_BENEFIT_PACKAGE_1.id);

      expect(result.additionalBenefitsByCategory).toBeDefined();
      expect(typeof result.additionalBenefitsByCategory).toBe('object');

      // Package 1 covers diabetes, heart_failure, cardiovascular, esrd
      expect(result.additionalBenefitsByCategory[CONDITION_CATEGORIES.DIABETES]).toBeDefined();
      expect(result.additionalBenefitsByCategory[CONDITION_CATEGORIES.DIABETES].categoryLabel).toBe('Diabetes Mellitus');
      expect(Array.isArray(result.additionalBenefitsByCategory[CONDITION_CATEGORIES.DIABETES].benefits)).toBe(true);
      expect(result.additionalBenefitsByCategory[CONDITION_CATEGORIES.DIABETES].benefits.length).toBeGreaterThan(0);

      expect(result.additionalBenefitsByCategory[CONDITION_CATEGORIES.HEART_FAILURE]).toBeDefined();
      expect(result.additionalBenefitsByCategory[CONDITION_CATEGORIES.ESRD]).toBeDefined();
    });

    it('returns correct deductible info for package with premium', () => {
      const result = getBenefits(TEST_BENEFIT_PACKAGE_2.id);

      expect(result).not.toBeNull();
      expect(result.deductibleInfo.monthlyPremium).toBe(15);
      expect(result.deductibleInfo.maxOutOfPocket).toBe(3900);
    });
  });

  describe('listBenefitPackages', () => {
    it('returns all benefit packages when no filters are provided', () => {
      const packages = listBenefitPackages();

      expect(Array.isArray(packages)).toBe(true);
      expect(packages.length).toBe(3);
    });

    it('filters by plan type', () => {
      const packages = listBenefitPackages({ planType: PLAN_TYPES.C_SNP });

      expect(packages.length).toBe(3);
      expect(packages.every((p) => p.planType === PLAN_TYPES.C_SNP)).toBe(true);
    });

    it('filters by condition category', () => {
      const packages = listBenefitPackages({ conditionCategory: CONDITION_CATEGORIES.DIABETES });

      expect(packages.length).toBe(1);
      expect(packages[0].id).toBe(TEST_BENEFIT_PACKAGE_1.id);
    });

    it('returns empty array when no packages match condition category', () => {
      const packages = listBenefitPackages({ conditionCategory: CONDITION_CATEGORIES.HIV_AIDS });

      expect(packages.length).toBe(0);
    });

    it('filters by active date range', () => {
      seedBenefitPackages([TEST_BENEFIT_PACKAGE_1, TEST_BENEFIT_PACKAGE_2, EXPIRED_BENEFIT_PACKAGE]);

      const packages = listBenefitPackages({ activeOnly: true });

      // Only non-expired packages should be returned
      const expiredFound = packages.find((p) => p.id === EXPIRED_BENEFIT_PACKAGE.id);
      expect(expiredFound).toBeUndefined();
    });

    it('returns empty array when no packages exist', () => {
      seedBenefitPackages([]);

      const packages = listBenefitPackages();
      expect(packages).toEqual([]);
    });

    it('combines plan type and condition category filters', () => {
      const packages = listBenefitPackages({
        planType: PLAN_TYPES.C_SNP,
        conditionCategory: CONDITION_CATEGORIES.COPD,
      });

      expect(packages.length).toBe(1);
      expect(packages[0].id).toBe(TEST_BENEFIT_PACKAGE_2.id);
    });
  });

  describe('getCopaySchedule', () => {
    it('returns null for empty package ID', () => {
      const result = getCopaySchedule('');
      expect(result).toBeNull();
    });

    it('returns null for nonexistent package ID', () => {
      const result = getCopaySchedule('nonexistent');
      expect(result).toBeNull();
    });

    it('returns copay schedule for a valid package', () => {
      const schedule = getCopaySchedule(TEST_BENEFIT_PACKAGE_1.id);

      expect(schedule).not.toBeNull();
      expect(typeof schedule).toBe('object');
      expect(schedule.primaryCare).toBeDefined();
      expect(schedule.primaryCare.copay).toBe(0);
      expect(schedule.primaryCare.coinsurance).toBe(0);
      expect(schedule.primaryCare.description).toBe('$0 copay for PCP visits');
    });

    it('returns correct copay values for specialist visits', () => {
      const schedule = getCopaySchedule(TEST_BENEFIT_PACKAGE_1.id);

      expect(schedule.specialistVisit.copay).toBe(20);
      expect(schedule.specialistVisit.coinsurance).toBe(0);
    });

    it('returns correct coinsurance values for dialysis', () => {
      const schedule = getCopaySchedule(TEST_BENEFIT_PACKAGE_1.id);

      expect(schedule.dialysis.copay).toBe(0);
      expect(schedule.dialysis.coinsurance).toBe(20);
    });

    it('returns correct copay values for different packages', () => {
      const schedule1 = getCopaySchedule(TEST_BENEFIT_PACKAGE_1.id);
      const schedule2 = getCopaySchedule(TEST_BENEFIT_PACKAGE_2.id);

      expect(schedule1.specialistVisit.copay).toBe(20);
      expect(schedule2.specialistVisit.copay).toBe(25);
    });

    it('includes all benefit types in the schedule', () => {
      const schedule = getCopaySchedule(TEST_BENEFIT_PACKAGE_1.id);

      const expectedKeys = Object.keys(TEST_BENEFIT_PACKAGE_1.benefits);
      for (const key of expectedKeys) {
        expect(schedule[key]).toBeDefined();
        expect(schedule[key].copay).toBeDefined();
        expect(schedule[key].coinsurance).toBeDefined();
        expect(schedule[key].description).toBeDefined();
      }
    });
  });

  describe('getDeductibleInfo', () => {
    it('returns null for empty package ID', () => {
      const result = getDeductibleInfo('');
      expect(result).toBeNull();
    });

    it('returns null for nonexistent package ID', () => {
      const result = getDeductibleInfo('nonexistent');
      expect(result).toBeNull();
    });

    it('returns correct deductible info for package with zero premium', () => {
      const info = getDeductibleInfo(TEST_BENEFIT_PACKAGE_1.id);

      expect(info).not.toBeNull();
      expect(info.annualDeductible).toBe(0);
      expect(info.maxOutOfPocket).toBe(3400);
      expect(info.monthlyPremium).toBe(0);
    });

    it('returns correct deductible info for package with premium', () => {
      const info = getDeductibleInfo(TEST_BENEFIT_PACKAGE_2.id);

      expect(info).not.toBeNull();
      expect(info.annualDeductible).toBe(0);
      expect(info.maxOutOfPocket).toBe(3900);
      expect(info.monthlyPremium).toBe(15);
    });

    it('returns correct deductible info for neuro plan', () => {
      const info = getDeductibleInfo(TEST_BENEFIT_PACKAGE_3.id);

      expect(info).not.toBeNull();
      expect(info.maxOutOfPocket).toBe(3200);
      expect(info.monthlyPremium).toBe(0);
    });
  });

  describe('getAdditionalBenefits', () => {
    it('returns empty array for empty condition category', () => {
      const benefits = getAdditionalBenefits('');
      expect(benefits).toEqual([]);
    });

    it('returns additional benefits for diabetes', () => {
      const benefits = getAdditionalBenefits(CONDITION_CATEGORIES.DIABETES);

      expect(Array.isArray(benefits)).toBe(true);
      expect(benefits.length).toBeGreaterThan(0);

      const telehealth = benefits.find((b) => b.benefit === 'Telehealth');
      expect(telehealth).toBeDefined();
      expect(telehealth.included).toBe(true);

      const diabetesSupplies = benefits.find((b) => b.benefit === 'Diabetes Supplies');
      expect(diabetesSupplies).toBeDefined();
      expect(diabetesSupplies.included).toBe(true);

      const nutritionCounseling = benefits.find((b) => b.benefit === 'Nutrition Counseling');
      expect(nutritionCounseling).toBeDefined();
    });

    it('returns additional benefits for heart failure', () => {
      const benefits = getAdditionalBenefits(CONDITION_CATEGORIES.HEART_FAILURE);

      expect(benefits.length).toBeGreaterThan(0);

      const cardiacRehab = benefits.find((b) => b.benefit === 'Cardiac Rehabilitation');
      expect(cardiacRehab).toBeDefined();
      expect(cardiacRehab.included).toBe(true);

      const remoteMonitoring = benefits.find((b) => b.benefit === 'Remote Monitoring');
      expect(remoteMonitoring).toBeDefined();
    });

    it('returns additional benefits for COPD', () => {
      const benefits = getAdditionalBenefits(CONDITION_CATEGORIES.COPD);

      expect(benefits.length).toBeGreaterThan(0);

      const pulmonaryRehab = benefits.find((b) => b.benefit === 'Pulmonary Rehabilitation');
      expect(pulmonaryRehab).toBeDefined();

      const smokingCessation = benefits.find((b) => b.benefit === 'Smoking Cessation');
      expect(smokingCessation).toBeDefined();
    });

    it('returns additional benefits for dementia', () => {
      const benefits = getAdditionalBenefits(CONDITION_CATEGORIES.DEMENTIA);

      expect(benefits.length).toBeGreaterThan(0);

      const adultDayCare = benefits.find((b) => b.benefit === 'Adult Day Care');
      expect(adultDayCare).toBeDefined();

      const caregiverSupport = benefits.find((b) => b.benefit === 'Caregiver Support');
      expect(caregiverSupport).toBeDefined();

      const homeSafety = benefits.find((b) => b.benefit === 'Home Safety');
      expect(homeSafety).toBeDefined();
    });

    it('returns additional benefits for ESRD', () => {
      const benefits = getAdditionalBenefits(CONDITION_CATEGORIES.ESRD);

      expect(benefits.length).toBeGreaterThan(0);

      const dialysis = benefits.find((b) => b.benefit === 'Dialysis Services');
      expect(dialysis).toBeDefined();

      const transportation = benefits.find((b) => b.benefit === 'Transportation');
      expect(transportation).toBeDefined();
      expect(transportation.description).toContain('Unlimited');
    });

    it('returns additional benefits for cancer', () => {
      const benefits = getAdditionalBenefits(CONDITION_CATEGORIES.CANCER);

      expect(benefits.length).toBeGreaterThan(0);

      const chemo = benefits.find((b) => b.benefit === 'Chemotherapy');
      expect(chemo).toBeDefined();

      const palliative = benefits.find((b) => b.benefit === 'Palliative Care');
      expect(palliative).toBeDefined();
    });

    it('returns empty array for unknown condition category', () => {
      const benefits = getAdditionalBenefits('unknown_category');
      expect(benefits).toEqual([]);
    });

    it('all additional benefits have required fields', () => {
      const categories = Object.values(CONDITION_CATEGORIES);

      for (const category of categories) {
        const benefits = getAdditionalBenefits(category);
        for (const benefit of benefits) {
          expect(benefit.benefit).toBeDefined();
          expect(typeof benefit.benefit).toBe('string');
          expect(benefit.description).toBeDefined();
          expect(typeof benefit.description).toBe('string');
          expect(typeof benefit.included).toBe('boolean');
        }
      }
    });
  });

  describe('getMemberMedicareCoverage', () => {
    it('returns null for empty member ID', () => {
      const result = getMemberMedicareCoverage('');
      expect(result).toBeNull();
    });

    it('returns null for nonexistent member', () => {
      const result = getMemberMedicareCoverage('nonexistent');
      expect(result).toBeNull();
    });

    it('returns Medicare coverage for member with all parts', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_DIABETES.id);

      expect(result).not.toBeNull();
      expect(result.medicareParts).toBeDefined();
      expect(Array.isArray(result.medicareParts)).toBe(true);
      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_A);
      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_B);
      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_D);
    });

    it('returns coverage details for enrolled Medicare parts', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_DIABETES.id);

      expect(result.coverageDetails).toBeDefined();
      expect(Array.isArray(result.coverageDetails)).toBe(true);
      expect(result.coverageDetails.length).toBeGreaterThan(0);

      // Should have Part A, Part B, and Part D coverage details
      const partA = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_A);
      expect(partA).toBeDefined();
      expect(partA.coverageItems).toBeDefined();
      expect(Array.isArray(partA.coverageItems)).toBe(true);
      expect(partA.coverageItems.length).toBeGreaterThan(0);

      const partB = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_B);
      expect(partB).toBeDefined();

      const partD = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_D);
      expect(partD).toBeDefined();
    });

    it('Part A coverage includes inpatient hospital care', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_DIABETES.id);

      const partA = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_A);
      expect(partA).toBeDefined();

      const inpatient = partA.coverageItems.find((item) => item.service.includes('Inpatient'));
      expect(inpatient).toBeDefined();
      expect(inpatient.covered).toBe(true);
    });

    it('Part B coverage includes physician services', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_DIABETES.id);

      const partB = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_B);
      expect(partB).toBeDefined();

      const physician = partB.coverageItems.find((item) => item.service.includes('Physician'));
      expect(physician).toBeDefined();
      expect(physician.covered).toBe(true);
    });

    it('Part D coverage includes prescription drug tiers', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_DIABETES.id);

      const partD = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_D);
      expect(partD).toBeDefined();

      const tier1 = partD.coverageItems.find((item) => item.service.includes('Tier 1'));
      expect(tier1).toBeDefined();
      expect(tier1.covered).toBe(true);
    });

    it('returns fewer coverage details for member with fewer Medicare parts', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_NO_CODES.id);

      expect(result).not.toBeNull();
      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_A);
      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_B);
      expect(result.medicareParts).not.toContain(MEDICARE_PARTS.PART_D);

      // Should not have Part D coverage
      const partD = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_D);
      expect(partD).toBeUndefined();
    });
  });

  describe('assignBenefits', () => {
    it('assigns benefits to a member with a matching condition category', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);
      expect(result.assignmentId).toBeDefined();
      expect(result.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_1.id);
      expect(result.benefitPackageName).toBe(TEST_BENEFIT_PACKAGE_1.name);
      expect(result.benefitSummary).toBeDefined();
      expect(result.auditId).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('persists benefit assignment to localStorage', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);

      const stored = getStoredBenefitAssignments();
      expect(stored.length).toBeGreaterThanOrEqual(1);

      const assignment = stored.find((a) => a.id === result.assignmentId);
      expect(assignment).toBeDefined();
      expect(assignment.memberId).toBe(TEST_MEMBER_DIABETES.id);
      expect(assignment.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_1.id);
      expect(assignment.conditionCategory).toBe(CONDITION_CATEGORIES.DIABETES);
      expect(assignment.status).toBe('active');
    });

    it('includes copay schedule in the assignment', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);

      const stored = getStoredBenefitAssignments();
      const assignment = stored.find((a) => a.id === result.assignmentId);
      expect(assignment.copaySchedule).toBeDefined();
      expect(typeof assignment.copaySchedule).toBe('object');
      expect(assignment.copaySchedule.primaryCare).toBeDefined();
    });

    it('includes deductible info in the assignment', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);

      const stored = getStoredBenefitAssignments();
      const assignment = stored.find((a) => a.id === result.assignmentId);
      expect(assignment.deductibleInfo).toBeDefined();
      expect(assignment.deductibleInfo.annualDeductible).toBe(0);
      expect(assignment.deductibleInfo.maxOutOfPocket).toBe(3400);
      expect(assignment.deductibleInfo.monthlyPremium).toBe(0);
    });

    it('includes additional benefits in the assignment', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);

      const stored = getStoredBenefitAssignments();
      const assignment = stored.find((a) => a.id === result.assignmentId);
      expect(assignment.additionalBenefits).toBeDefined();
      expect(Array.isArray(assignment.additionalBenefits)).toBe(true);
      expect(assignment.additionalBenefits.length).toBeGreaterThan(0);
    });

    it('includes Medicare parts in the assignment', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);

      const stored = getStoredBenefitAssignments();
      const assignment = stored.find((a) => a.id === result.assignmentId);
      expect(assignment.medicareParts).toBeDefined();
      expect(Array.isArray(assignment.medicareParts)).toBe(true);
      expect(assignment.medicareParts).toContain(MEDICARE_PARTS.PART_A);
      expect(assignment.medicareParts).toContain(MEDICARE_PARTS.PART_D);
    });

    it('returns benefit summary with correct fields', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);
      expect(result.benefitSummary).toBeDefined();
      expect(result.benefitSummary.packageId).toBe(TEST_BENEFIT_PACKAGE_1.id);
      expect(result.benefitSummary.packageName).toBe(TEST_BENEFIT_PACKAGE_1.name);
      expect(result.benefitSummary.conditionCategory).toBe(CONDITION_CATEGORIES.DIABETES);
      expect(result.benefitSummary.conditionCategoryLabel).toBe('Diabetes Mellitus');
      expect(result.benefitSummary.monthlyPremium).toBe(0);
      expect(result.benefitSummary.maxOutOfPocket).toBe(3400);
      expect(result.benefitSummary.copayCount).toBeGreaterThan(0);
      expect(result.benefitSummary.additionalBenefitsCount).toBeGreaterThan(0);
    });

    it('returns error when member ID is empty', () => {
      const result = assignBenefits('', CONDITION_CATEGORIES.DIABETES);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Member ID');
    });

    it('returns error when condition category is empty', () => {
      const result = assignBenefits(TEST_MEMBER_DIABETES.id, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Condition category');
    });

    it('returns error when member does not exist', () => {
      const result = assignBenefits('nonexistent-member', CONDITION_CATEGORIES.DIABETES);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Member not found');
    });

    it('returns error when no benefit package matches the condition category', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.HIV_AIDS,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No benefit package available');
    });

    it('returns error for duplicate active assignment', () => {
      const firstResult = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );
      expect(firstResult.success).toBe(true);

      const secondResult = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('already has an active benefit assignment');
    });

    it('assigns benefits with a specific benefit package ID', () => {
      const result = assignBenefits(
        TEST_MEMBER_HEART_FAILURE.id,
        CONDITION_CATEGORIES.HEART_FAILURE,
        { performedBy: 'user-001', benefitPackageId: TEST_BENEFIT_PACKAGE_1.id }
      );

      expect(result.success).toBe(true);
      expect(result.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_1.id);
    });

    it('returns error when specific benefit package ID does not exist', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001', benefitPackageId: 'nonexistent-package' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Benefit package not found');
    });

    it('selects the lowest premium package when multiple match', () => {
      // Add a second package that also covers diabetes but with higher premium
      const expensivePackage = {
        ...TEST_BENEFIT_PACKAGE_1,
        id: 'bp-expensive',
        name: 'Expensive Diabetes Plan',
        monthlyPremium: 50,
        maxOutOfPocket: 5000,
      };

      seedBenefitPackages([TEST_BENEFIT_PACKAGE_1, TEST_BENEFIT_PACKAGE_2, TEST_BENEFIT_PACKAGE_3, expensivePackage]);

      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);
      // Should select the package with lower premium (TEST_BENEFIT_PACKAGE_1 has $0 premium)
      expect(result.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_1.id);
    });
  });

  describe('assignBenefitsForMember', () => {
    it('assigns benefits using member stored diagnosis codes', () => {
      const result = assignBenefitsForMember(TEST_MEMBER_DIABETES.id, { performedBy: 'user-001' });

      expect(result.success).toBe(true);
      expect(result.assignmentId).toBeDefined();
      expect(result.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_1.id);
    });

    it('returns error when member ID is empty', () => {
      const result = assignBenefitsForMember('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Member ID');
    });

    it('returns error when member does not exist', () => {
      const result = assignBenefitsForMember('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Member not found');
    });

    it('returns error when member has no diagnosis codes', () => {
      const result = assignBenefitsForMember(TEST_MEMBER_NO_CODES.id, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('no diagnosis codes');
    });

    it('uses member conditionCategory when available', () => {
      const result = assignBenefitsForMember(TEST_MEMBER_COPD.id, { performedBy: 'user-001' });

      expect(result.success).toBe(true);
      expect(result.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_2.id);
    });

    it('determines condition category from diagnosis codes when conditionCategory is null', () => {
      const memberWithoutCategory = {
        ...TEST_MEMBER_DIABETES,
        id: 'member-no-category',
        conditionCategory: null,
      };
      seedMembers([memberWithoutCategory, TEST_MEMBER_HEART_FAILURE, TEST_MEMBER_NO_CODES, TEST_MEMBER_COPD]);

      const result = assignBenefitsForMember('member-no-category', { performedBy: 'user-001' });

      expect(result.success).toBe(true);
      // E11.9 is diabetes, should match package 1
      expect(result.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_1.id);
    });
  });

  describe('getMemberBenefitAssignments', () => {
    it('returns empty array for empty member ID', () => {
      const assignments = getMemberBenefitAssignments('');
      expect(assignments).toEqual([]);
    });

    it('returns empty array when no assignments exist', () => {
      const assignments = getMemberBenefitAssignments(TEST_MEMBER_DIABETES.id);
      expect(assignments).toEqual([]);
    });

    it('returns assignments for a member sorted by creation date descending', () => {
      seedBenefitAssignments([
        {
          id: 'assign-1',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'inactive',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'assign-2',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'active',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
        {
          id: 'assign-3',
          memberId: TEST_MEMBER_HEART_FAILURE.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.HEART_FAILURE,
          status: 'active',
          createdAt: '2024-03-01T10:00:00.000Z',
          updatedAt: '2024-03-01T10:00:00.000Z',
        },
      ]);

      const assignments = getMemberBenefitAssignments(TEST_MEMBER_DIABETES.id);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].id).toBe('assign-2'); // Most recent
      expect(assignments[1].id).toBe('assign-1'); // Oldest
    });

    it('filters by status', () => {
      seedBenefitAssignments([
        {
          id: 'assign-a',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'inactive',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'assign-b',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'active',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
      ]);

      const activeAssignments = getMemberBenefitAssignments(TEST_MEMBER_DIABETES.id, { status: 'active' });
      expect(activeAssignments).toHaveLength(1);
      expect(activeAssignments[0].id).toBe('assign-b');

      const inactiveAssignments = getMemberBenefitAssignments(TEST_MEMBER_DIABETES.id, { status: 'inactive' });
      expect(inactiveAssignments).toHaveLength(1);
      expect(inactiveAssignments[0].id).toBe('assign-a');
    });
  });

  describe('getActiveBenefitAssignment', () => {
    it('returns null for empty member ID', () => {
      const result = getActiveBenefitAssignment('');
      expect(result).toBeNull();
    });

    it('returns null when no active assignment exists', () => {
      const result = getActiveBenefitAssignment(TEST_MEMBER_DIABETES.id);
      expect(result).toBeNull();
    });

    it('returns the active assignment for a member', () => {
      seedBenefitAssignments([
        {
          id: 'assign-active',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'active',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
        {
          id: 'assign-inactive',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'inactive',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
      ]);

      const result = getActiveBenefitAssignment(TEST_MEMBER_DIABETES.id);

      expect(result).not.toBeNull();
      expect(result.id).toBe('assign-active');
      expect(result.status).toBe('active');
    });

    it('returns null when only inactive assignments exist', () => {
      seedBenefitAssignments([
        {
          id: 'assign-old',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'inactive',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
      ]);

      const result = getActiveBenefitAssignment(TEST_MEMBER_DIABETES.id);
      expect(result).toBeNull();
    });
  });

  describe('deactivateBenefitAssignment', () => {
    it('deactivates an active benefit assignment', () => {
      seedBenefitAssignments([
        {
          id: 'assign-to-deactivate',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'active',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
      ]);

      const result = deactivateBenefitAssignment('assign-to-deactivate', 'Testing deactivation', 'user-001');

      expect(result.success).toBe(true);

      const stored = getStoredBenefitAssignments();
      const deactivated = stored.find((a) => a.id === 'assign-to-deactivate');
      expect(deactivated.status).toBe('inactive');
      expect(deactivated.deactivationReason).toBe('Testing deactivation');
      expect(deactivated.deactivatedAt).toBeDefined();
    });

    it('returns error for empty assignment ID', () => {
      const result = deactivateBenefitAssignment('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Assignment ID');
    });

    it('returns error for nonexistent assignment', () => {
      const result = deactivateBenefitAssignment('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error when assignment is already inactive', () => {
      seedBenefitAssignments([
        {
          id: 'assign-already-inactive',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'inactive',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
      ]);

      const result = deactivateBenefitAssignment('assign-already-inactive', 'reason', 'user-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });
  });

  describe('findMatchingBenefitPackages', () => {
    it('returns empty array for empty condition categories', () => {
      const packages = findMatchingBenefitPackages([]);
      expect(packages).toEqual([]);
    });

    it('returns matching packages for a single condition category', () => {
      const packages = findMatchingBenefitPackages([CONDITION_CATEGORIES.DIABETES]);

      expect(packages.length).toBe(1);
      expect(packages[0].id).toBe(TEST_BENEFIT_PACKAGE_1.id);
    });

    it('returns matching packages for multiple condition categories', () => {
      const packages = findMatchingBenefitPackages([
        CONDITION_CATEGORIES.DIABETES,
        CONDITION_CATEGORIES.COPD,
      ]);

      expect(packages.length).toBe(2);
      const ids = packages.map((p) => p.id);
      expect(ids).toContain(TEST_BENEFIT_PACKAGE_1.id);
      expect(ids).toContain(TEST_BENEFIT_PACKAGE_2.id);
    });

    it('returns empty array when no packages match', () => {
      const packages = findMatchingBenefitPackages([CONDITION_CATEGORIES.HIV_AIDS]);
      expect(packages).toEqual([]);
    });

    it('filters by plan type', () => {
      const packages = findMatchingBenefitPackages(
        [CONDITION_CATEGORIES.DIABETES],
        PLAN_TYPES.C_SNP
      );

      expect(packages.length).toBe(1);
      expect(packages[0].planType).toBe(PLAN_TYPES.C_SNP);
    });

    it('returns empty array for non-matching plan type', () => {
      const packages = findMatchingBenefitPackages(
        [CONDITION_CATEGORIES.DIABETES],
        PLAN_TYPES.D_SNP
      );

      expect(packages).toEqual([]);
    });
  });

  describe('getBenefitStats', () => {
    it('returns zero counts when no data exists', () => {
      seedBenefitPackages([]);

      const stats = getBenefitStats();

      expect(stats.totalPackages).toBe(0);
      expect(stats.totalAssignments).toBe(0);
      expect(stats.activeAssignments).toBe(0);
    });

    it('returns correct package count', () => {
      const stats = getBenefitStats();

      expect(stats.totalPackages).toBe(3);
    });

    it('returns correct assignment counts', () => {
      seedBenefitAssignments([
        {
          id: 'stat-1',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'active',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'stat-2',
          memberId: TEST_MEMBER_HEART_FAILURE.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.HEART_FAILURE,
          status: 'active',
          createdAt: '2024-02-01T10:00:00.000Z',
          updatedAt: '2024-02-01T10:00:00.000Z',
        },
        {
          id: 'stat-3',
          memberId: TEST_MEMBER_COPD.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_2.id,
          conditionCategory: CONDITION_CATEGORIES.COPD,
          status: 'inactive',
          createdAt: '2024-03-01T10:00:00.000Z',
          updatedAt: '2024-03-01T10:00:00.000Z',
        },
      ]);

      const stats = getBenefitStats();

      expect(stats.totalAssignments).toBe(3);
      expect(stats.activeAssignments).toBe(2);
      expect(stats.inactiveAssignments).toBe(1);
    });

    it('returns correct condition category breakdown', () => {
      seedBenefitAssignments([
        {
          id: 'cat-1',
          memberId: TEST_MEMBER_DIABETES.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'active',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'cat-2',
          memberId: TEST_MEMBER_HEART_FAILURE.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.HEART_FAILURE,
          status: 'active',
          createdAt: '2024-02-01T10:00:00.000Z',
          updatedAt: '2024-02-01T10:00:00.000Z',
        },
        {
          id: 'cat-3',
          memberId: 'member-extra',
          benefitPackageId: TEST_BENEFIT_PACKAGE_1.id,
          conditionCategory: CONDITION_CATEGORIES.DIABETES,
          status: 'active',
          createdAt: '2024-03-01T10:00:00.000Z',
          updatedAt: '2024-03-01T10:00:00.000Z',
        },
      ]);

      const stats = getBenefitStats();

      expect(stats.byConditionCategory[CONDITION_CATEGORIES.DIABETES]).toBe(2);
      expect(stats.byConditionCategory[CONDITION_CATEGORIES.HEART_FAILURE]).toBe(1);
    });

    it('returns correct plan type breakdown', () => {
      const stats = getBenefitStats();

      expect(stats.byPlanType[PLAN_TYPES.C_SNP]).toBe(3);
    });
  });

  describe('getAvailableConditionCategories', () => {
    it('returns all condition categories with package availability', () => {
      const categories = getAvailableConditionCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);

      for (const cat of categories) {
        expect(cat.category).toBeDefined();
        expect(cat.label).toBeDefined();
        expect(typeof cat.hasPackage).toBe('boolean');
        expect(typeof cat.packageCount).toBe('number');
      }
    });

    it('marks categories with packages as having packages', () => {
      const categories = getAvailableConditionCategories();

      const diabetes = categories.find((c) => c.category === CONDITION_CATEGORIES.DIABETES);
      expect(diabetes).toBeDefined();
      expect(diabetes.hasPackage).toBe(true);
      expect(diabetes.packageCount).toBeGreaterThanOrEqual(1);

      const heartFailure = categories.find((c) => c.category === CONDITION_CATEGORIES.HEART_FAILURE);
      expect(heartFailure).toBeDefined();
      expect(heartFailure.hasPackage).toBe(true);
    });

    it('marks categories without packages as not having packages', () => {
      const categories = getAvailableConditionCategories();

      const hivAids = categories.find((c) => c.category === CONDITION_CATEGORIES.HIV_AIDS);
      expect(hivAids).toBeDefined();
      expect(hivAids.hasPackage).toBe(false);
      expect(hivAids.packageCount).toBe(0);
    });

    it('includes correct labels for categories', () => {
      const categories = getAvailableConditionCategories();

      const diabetes = categories.find((c) => c.category === CONDITION_CATEGORIES.DIABETES);
      expect(diabetes.label).toBe('Diabetes Mellitus');

      const copd = categories.find((c) => c.category === CONDITION_CATEGORIES.COPD);
      expect(copd.label).toBe('Chronic Obstructive Pulmonary Disease');
    });
  });

  describe('batchAssignBenefits', () => {
    it('returns empty result for empty input', () => {
      const result = batchAssignBenefits([]);

      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('processes multiple benefit assignments in batch', () => {
      const memberConditions = [
        { memberId: TEST_MEMBER_DIABETES.id, conditionCategory: CONDITION_CATEGORIES.DIABETES },
        { memberId: TEST_MEMBER_HEART_FAILURE.id, conditionCategory: CONDITION_CATEGORIES.HEART_FAILURE },
      ];

      const result = batchAssignBenefits(memberConditions, { performedBy: 'user-001' });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    it('handles mixed success and failure in batch', () => {
      const memberConditions = [
        { memberId: TEST_MEMBER_DIABETES.id, conditionCategory: CONDITION_CATEGORIES.DIABETES },
        { memberId: 'nonexistent-member', conditionCategory: CONDITION_CATEGORIES.HEART_FAILURE },
      ];

      const result = batchAssignBenefits(memberConditions, { performedBy: 'user-001' });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });

    it('handles invalid entries in batch', () => {
      const memberConditions = [
        null,
        { memberId: TEST_MEMBER_DIABETES.id, conditionCategory: CONDITION_CATEGORIES.DIABETES },
      ];

      const result = batchAssignBenefits(memberConditions, { performedBy: 'user-001' });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('handles condition category with no matching package', () => {
      const memberConditions = [
        { memberId: TEST_MEMBER_DIABETES.id, conditionCategory: CONDITION_CATEGORIES.HIV_AIDS },
      ];

      const result = batchAssignBenefits(memberConditions, { performedBy: 'user-001' });

      expect(result.total).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('No benefit package available');
    });
  });

  describe('coverage rule application', () => {
    it('assigns correct package for diabetes condition', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);
      expect(result.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_1.id);
    });

    it('assigns correct package for COPD condition', () => {
      const result = assignBenefits(
        TEST_MEMBER_COPD.id,
        CONDITION_CATEGORIES.COPD,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);
      expect(result.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_2.id);
    });

    it('assigns correct package for heart failure condition', () => {
      const result = assignBenefits(
        TEST_MEMBER_HEART_FAILURE.id,
        CONDITION_CATEGORIES.HEART_FAILURE,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);
      expect(result.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE_1.id);
    });

    it('includes rule evaluation in the result', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);
      expect(result.ruleEvaluation).toBeDefined();
    });

    it('coverage details include condition category information', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);

      const stored = getStoredBenefitAssignments();
      const assignment = stored.find((a) => a.id === result.assignmentId);
      expect(assignment.coverageDetails).toBeDefined();
      expect(assignment.coverageDetails.conditionCategory).toBe(CONDITION_CATEGORIES.DIABETES);
      expect(assignment.coverageDetails.conditionCategoryLabel).toBe('Diabetes Mellitus');
      expect(assignment.coverageDetails.planType).toBe(PLAN_TYPES.C_SNP);
      expect(assignment.coverageDetails.planName).toBe(TEST_BENEFIT_PACKAGE_1.name);
    });

    it('coverage details include Medicare coverage for enrolled parts', () => {
      const result = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );

      expect(result.success).toBe(true);

      const stored = getStoredBenefitAssignments();
      const assignment = stored.find((a) => a.id === result.assignmentId);
      expect(assignment.coverageDetails.medicareCoverage).toBeDefined();
      expect(Array.isArray(assignment.coverageDetails.medicareCoverage)).toBe(true);
      expect(assignment.coverageDetails.medicareCoverage.length).toBeGreaterThan(0);
    });
  });

  describe('benefit package lifecycle', () => {
    it('supports full lifecycle: create -> assign -> deactivate', () => {
      // Step 1: Create a new benefit package
      const createResult = configureBenefits({
        name: 'Lifecycle Test Package',
        description: 'Testing full lifecycle',
        effectiveDate: '2024-01-01',
        terminationDate: '2025-12-31',
        benefits: {
          primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay' },
          specialistVisit: { copay: 15, coinsurance: 0, description: '$15 copay' },
        },
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
        monthlyPremium: 0,
        annualDeductible: 0,
        maxOutOfPocket: 3000,
      }, { performedBy: 'user-001' });

      expect(createResult.success).toBe(true);
      const packageId = createResult.packageId;

      // Step 2: Assign benefits to a member using the new package
      const assignResult = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001', benefitPackageId: packageId }
      );

      expect(assignResult.success).toBe(true);
      const assignmentId = assignResult.assignmentId;

      // Step 3: Verify active assignment exists
      const activeAssignment = getActiveBenefitAssignment(TEST_MEMBER_DIABETES.id);
      expect(activeAssignment).not.toBeNull();
      expect(activeAssignment.id).toBe(assignmentId);
      expect(activeAssignment.status).toBe('active');

      // Step 4: Deactivate the assignment
      const deactivateResult = deactivateBenefitAssignment(assignmentId, 'Lifecycle test complete', 'user-001');
      expect(deactivateResult.success).toBe(true);

      // Step 5: Verify no active assignment exists
      const noActiveAssignment = getActiveBenefitAssignment(TEST_MEMBER_DIABETES.id);
      expect(noActiveAssignment).toBeNull();

      // Step 6: Verify the assignment is now inactive
      const allAssignments = getMemberBenefitAssignments(TEST_MEMBER_DIABETES.id);
      const deactivated = allAssignments.find((a) => a.id === assignmentId);
      expect(deactivated.status).toBe('inactive');
      expect(deactivated.deactivationReason).toBe('Lifecycle test complete');
    });

    it('supports update -> reassign workflow', () => {
      // Step 1: Assign initial benefits
      const initialAssign = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );
      expect(initialAssign.success).toBe(true);

      // Step 2: Deactivate initial assignment
      const deactivateResult = deactivateBenefitAssignment(
        initialAssign.assignmentId,
        'Reassigning to updated package',
        'user-001'
      );
      expect(deactivateResult.success).toBe(true);

      // Step 3: Update the benefit package
      const updateResult = configureBenefits({
        id: TEST_BENEFIT_PACKAGE_1.id,
        name: 'Updated Comprehensive Plan',
        description: 'Updated for reassignment test',
        eligibleConditionCategories: TEST_BENEFIT_PACKAGE_1.eligibleConditionCategories,
        maxOutOfPocket: 3600,
      }, { performedBy: 'user-001' });
      expect(updateResult.success).toBe(true);

      // Step 4: Reassign benefits
      const reassignResult = assignBenefits(
        TEST_MEMBER_DIABETES.id,
        CONDITION_CATEGORIES.DIABETES,
        { performedBy: 'user-001' }
      );
      expect(reassignResult.success).toBe(true);

      // Step 5: Verify new active assignment
      const activeAssignment = getActiveBenefitAssignment(TEST_MEMBER_DIABETES.id);
      expect(activeAssignment).not.toBeNull();
      expect(activeAssignment.id).toBe(reassignResult.assignmentId);

      // Step 6: Verify history shows both assignments
      const allAssignments = getMemberBenefitAssignments(TEST_MEMBER_DIABETES.id);
      expect(allAssignments.length).toBe(2);
      expect(allAssignments.filter((a) => a.status === 'active').length).toBe(1);
      expect(allAssignments.filter((a) => a.status === 'inactive').length).toBe(1);
    });
  });

  describe('copay and deductible logic edge cases', () => {
    it('handles package with all zero copays', () => {
      const packageData = {
        name: 'Zero Copay Package',
        description: 'All copays are zero',
        benefits: {
          primaryCare: { copay: 0, coinsurance: 0, description: '$0' },
          specialistVisit: { copay: 0, coinsurance: 0, description: '$0' },
          emergencyRoom: { copay: 0, coinsurance: 0, description: '$0' },
        },
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
        monthlyPremium: 0,
        annualDeductible: 0,
        maxOutOfPocket: 0,
      };

      const result = configureBenefits(packageData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const schedule = getCopaySchedule(result.packageId);
      expect(schedule.primaryCare.copay).toBe(0);
      expect(schedule.specialistVisit.copay).toBe(0);
      expect(schedule.emergencyRoom.copay).toBe(0);

      const deductible = getDeductibleInfo(result.packageId);
      expect(deductible.monthlyPremium).toBe(0);
      expect(deductible.annualDeductible).toBe(0);
      expect(deductible.maxOutOfPocket).toBe(0);
    });

    it('handles package with mixed copay and coinsurance', () => {
      const schedule = getCopaySchedule(TEST_BENEFIT_PACKAGE_1.id);

      // Primary care: copay only
      expect(schedule.primaryCare.copay).toBe(0);
      expect(schedule.primaryCare.coinsurance).toBe(0);

      // Specialist: copay only
      expect(schedule.specialistVisit.copay).toBe(20);
      expect(schedule.specialistVisit.coinsurance).toBe(0);

      // Dialysis: coinsurance only
      expect(schedule.dialysis.copay).toBe(0);
      expect(schedule.dialysis.coinsurance).toBe(20);
    });

    it('handles package with high premium and deductible', () => {
      const packageData = {
        name: 'High Cost Package',
        description: 'High premium and deductible',
        benefits: {
          primaryCare: { copay: 50, coinsurance: 10, description: '$50 copay + 10% coinsurance' },
        },
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
        monthlyPremium: 250,
        annualDeductible: 500,
        maxOutOfPocket: 7500,
      };

      const result = configureBenefits(packageData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const deductible = getDeductibleInfo(result.packageId);
      expect(deductible.monthlyPremium).toBe(250);
      expect(deductible.annualDeductible).toBe(500);
      expect(deductible.maxOutOfPocket).toBe(7500);

      const schedule = getCopaySchedule(result.packageId);
      expect(schedule.primaryCare.copay).toBe(50);
      expect(schedule.primaryCare.coinsurance).toBe(10);
    });

    it('handles package with empty benefits object', () => {
      const packageData = {
        name: 'Empty Benefits Package',
        description: 'No benefits configured',
        benefits: {},
        eligibleConditionCategories: [CONDITION_CATEGORIES.DIABETES],
      };

      const result = configureBenefits(packageData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const schedule = getCopaySchedule(result.packageId);
      expect(schedule).toBeDefined();
      expect(Object.keys(schedule).length).toBe(0);
    });
  });

  describe('condition category coverage rules', () => {
    it('diabetes package covers diabetes, heart failure, cardiovascular, and ESRD', () => {
      const pkg = getBenefits(TEST_BENEFIT_PACKAGE_1.id);

      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.DIABETES);
      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.HEART_FAILURE);
      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.CARDIOVASCULAR);
      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.ESRD);
      expect(pkg.eligibleConditionCategories).not.toContain(CONDITION_CATEGORIES.COPD);
    });

    it('respiratory package covers COPD, respiratory, CKD, and cancer', () => {
      const pkg = getBenefits(TEST_BENEFIT_PACKAGE_2.id);

      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.COPD);
      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.RESPIRATORY);
      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE);
      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.CANCER);
      expect(pkg.eligibleConditionCategories).not.toContain(CONDITION_CATEGORIES.DIABETES);
    });

    it('neuro package covers dementia, neurological, autoimmune, and mental health', () => {
      const pkg = getBenefits(TEST_BENEFIT_PACKAGE_3.id);

      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.DEMENTIA);
      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.NEUROLOGICAL);
      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.AUTOIMMUNE);
      expect(pkg.eligibleConditionCategories).toContain(CONDITION_CATEGORIES.MENTAL_HEALTH);
      expect(pkg.eligibleConditionCategories).not.toContain(CONDITION_CATEGORIES.HEART_FAILURE);
    });

    it('additional benefits are condition-specific', () => {
      const diabetesBenefits = getAdditionalBenefits(CONDITION_CATEGORIES.DIABETES);
      const heartFailureBenefits = getAdditionalBenefits(CONDITION_CATEGORIES.HEART_FAILURE);

      // Diabetes should have diabetes supplies but not cardiac rehab
      const diabetesSupplies = diabetesBenefits.find((b) => b.benefit === 'Diabetes Supplies');
      expect(diabetesSupplies).toBeDefined();

      const diabetesCardiacRehab = diabetesBenefits.find((b) => b.benefit === 'Cardiac Rehabilitation');
      expect(diabetesCardiacRehab).toBeUndefined();

      // Heart failure should have cardiac rehab but not diabetes supplies
      const hfCardiacRehab = heartFailureBenefits.find((b) => b.benefit === 'Cardiac Rehabilitation');
      expect(hfCardiacRehab).toBeDefined();

      const hfDiabetesSupplies = heartFailureBenefits.find((b) => b.benefit === 'Diabetes Supplies');
      expect(hfDiabetesSupplies).toBeUndefined();
    });

    it('all condition categories have telehealth as an additional benefit', () => {
      const categoriesWithBenefits = [
        CONDITION_CATEGORIES.DIABETES,
        CONDITION_CATEGORIES.HEART_FAILURE,
        CONDITION_CATEGORIES.COPD,
        CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
        CONDITION_CATEGORIES.ESRD,
        CONDITION_CATEGORIES.DEMENTIA,
        CONDITION_CATEGORIES.MENTAL_HEALTH,
        CONDITION_CATEGORIES.CARDIOVASCULAR,
        CONDITION_CATEGORIES.CANCER,
        CONDITION_CATEGORIES.AUTOIMMUNE,
        CONDITION_CATEGORIES.HIV_AIDS,
        CONDITION_CATEGORIES.LIVER_DISEASE,
        CONDITION_CATEGORIES.RESPIRATORY,
        CONDITION_CATEGORIES.NEUROLOGICAL,
        CONDITION_CATEGORIES.STROKE,
      ];

      for (const category of categoriesWithBenefits) {
        const benefits = getAdditionalBenefits(category);
        const telehealth = benefits.find((b) => b.benefit === 'Telehealth');
        expect(telehealth).toBeDefined();
        expect(telehealth.included).toBe(true);
        expect(telehealth.description).toContain('$0 copay');
      }
    });

    it('transportation benefit is available for all condition categories', () => {
      const categoriesWithTransportation = [
        CONDITION_CATEGORIES.DIABETES,
        CONDITION_CATEGORIES.HEART_FAILURE,
        CONDITION_CATEGORIES.COPD,
        CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
        CONDITION_CATEGORIES.ESRD,
        CONDITION_CATEGORIES.DEMENTIA,
        CONDITION_CATEGORIES.MENTAL_HEALTH,
        CONDITION_CATEGORIES.CARDIOVASCULAR,
        CONDITION_CATEGORIES.CANCER,
        CONDITION_CATEGORIES.AUTOIMMUNE,
        CONDITION_CATEGORIES.HIV_AIDS,
        CONDITION_CATEGORIES.LIVER_DISEASE,
        CONDITION_CATEGORIES.RESPIRATORY,
        CONDITION_CATEGORIES.NEUROLOGICAL,
        CONDITION_CATEGORIES.STROKE,
      ];

      for (const category of categoriesWithTransportation) {
        const benefits = getAdditionalBenefits(category);
        const transportation = benefits.find((b) => b.benefit === 'Transportation');
        expect(transportation).toBeDefined();
        expect(transportation.included).toBe(true);
      }
    });
  });

  describe('Medicare parts support', () => {
    it('Part A covers inpatient hospital, skilled nursing, home health, and hospice', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_DIABETES.id);
      const partA = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_A);

      expect(partA).toBeDefined();
      expect(partA.label).toContain('Hospital Insurance');

      const services = partA.coverageItems.map((item) => item.service);
      expect(services.some((s) => s.includes('Inpatient Hospital'))).toBe(true);
      expect(services.some((s) => s.includes('Skilled Nursing'))).toBe(true);
      expect(services.some((s) => s.includes('Home Health'))).toBe(true);
      expect(services.some((s) => s.includes('Hospice'))).toBe(true);

      for (const item of partA.coverageItems) {
        expect(item.covered).toBe(true);
        expect(typeof item.notes).toBe('string');
      }
    });

    it('Part B covers physician services, outpatient, DME, and preventive care', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_DIABETES.id);
      const partB = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_B);

      expect(partB).toBeDefined();
      expect(partB.label).toContain('Medical Insurance');

      const services = partB.coverageItems.map((item) => item.service);
      expect(services.some((s) => s.includes('Physician'))).toBe(true);
      expect(services.some((s) => s.includes('Outpatient'))).toBe(true);
      expect(services.some((s) => s.includes('Durable Medical Equipment'))).toBe(true);
      expect(services.some((s) => s.includes('Preventive'))).toBe(true);
    });

    it('Part D covers prescription drug tiers and medication therapy management', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_DIABETES.id);
      const partD = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_D);

      expect(partD).toBeDefined();
      expect(partD.label).toContain('Prescription Drug');

      const services = partD.coverageItems.map((item) => item.service);
      expect(services.some((s) => s.includes('Tier 1'))).toBe(true);
      expect(services.some((s) => s.includes('Tier 2'))).toBe(true);
      expect(services.some((s) => s.includes('Tier 3'))).toBe(true);
      expect(services.some((s) => s.includes('Medication Therapy Management'))).toBe(true);
    });

    it('member with Part A and B only does not get Part D coverage', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_NO_CODES.id);

      expect(result.medicareParts).toHaveLength(2);
      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_A);
      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_B);

      const partD = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_D);
      expect(partD).toBeUndefined();

      const partA = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_A);
      expect(partA).toBeDefined();

      const partB = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_B);
      expect(partB).toBeDefined();
    });

    it('member with Part A, B, and C gets A and B coverage details (C is MA wrapper)', () => {
      const result = getMemberMedicareCoverage(TEST_MEMBER_COPD.id);

      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_A);
      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_B);
      expect(result.medicareParts).toContain(MEDICARE_PARTS.PART_C);

      // Part C (Medicare Advantage) is a wrapper, so coverage details come from A and B
      const partA = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_A);
      expect(partA).toBeDefined();

      const partB = result.coverageDetails.find((c) => c.partType === MEDICARE_PARTS.PART_B);
      expect(partB).toBeDefined();
    });
  });
});