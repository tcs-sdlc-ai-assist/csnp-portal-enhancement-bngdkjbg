import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initiateClaims,
  processClaim,
  getClaimStatus,
  getClaimById,
  listClaims,
  getMemberClaims,
  getProviderClaims,
  appealClaim,
  voidClaim,
  markClaimPaid,
  reprocessClaim,
  updateClaimNotes,
  batchInitiateClaims,
  getClaimStats,
  getAllClaimRecords,
  getClaimsNeedingAttention,
  analyzeDenialRisk,
} from '../claimsService.js';
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  ENROLLMENT_STATUSES,
  PLAN_TYPES,
} from '../../utils/constants.js';
import { CONDITION_CATEGORIES } from '../../data/icd10Data.js';

/**
 * Helper to set up localStorage with seed members.
 * @param {Object[]} members - Array of member objects
 */
function seedMembers(members) {
  localStorage.setItem('csnp_members', JSON.stringify(members));
}

/**
 * Helper to set up localStorage with providers.
 * @param {Object[]} providers - Array of provider objects
 */
function seedProviders(providers) {
  localStorage.setItem('csnp_providers', JSON.stringify(providers));
}

/**
 * Helper to set up localStorage with enrollments.
 * @param {Object[]} enrollments - Array of enrollment objects
 */
function seedEnrollments(enrollments) {
  localStorage.setItem('csnp_enrollments', JSON.stringify(enrollments));
}

/**
 * Helper to set up localStorage with benefit packages.
 * @param {Object[]} packages - Array of benefit package objects
 */
function seedBenefitPackages(packages) {
  localStorage.setItem('csnp_benefit_packages', JSON.stringify(packages));
}

/**
 * Helper to set up localStorage with claims.
 * @param {Object[]} claims - Array of claim objects
 */
function seedClaims(claims) {
  localStorage.setItem('csnp_claims', JSON.stringify(claims));
}

/**
 * Helper to get claims from localStorage.
 * @returns {Object[]}
 */
function getStoredClaims() {
  const raw = localStorage.getItem('csnp_claims');
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

const TEST_MEMBER = {
  id: 'member-clm-001',
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
  primaryProviderId: 'provider-clm-001',
  benefitPackageId: 'bp-clm-001',
  medicareParts: ['part_a', 'part_b', 'part_c', 'part_d'],
  csnpEligible: true,
  createdAt: '2024-01-10T08:30:00.000Z',
  updatedAt: '2024-06-15T14:22:00.000Z',
};

const TEST_MEMBER_2 = {
  id: 'member-clm-002',
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
  primaryProviderId: 'provider-clm-002',
  benefitPackageId: 'bp-clm-001',
  medicareParts: ['part_a', 'part_b', 'part_c', 'part_d'],
  csnpEligible: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-07-01T09:15:00.000Z',
};

const TEST_PROVIDER = {
  id: 'provider-clm-001',
  npi: '1234567890',
  firstName: 'Sarah',
  lastName: 'Chen',
  specialty: 'Endocrinology',
  facilityName: 'Springfield Diabetes Center',
  email: 'dr.chen@example.com',
  phone: '(555) 111-2222',
  address: {
    street: '100 Medical Plaza',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62702',
  },
  contract: {
    contractId: 'CTR-2024-001',
    effectiveDate: '2024-01-01',
    terminationDate: '2025-12-31',
    contractType: 'In-Network',
    reimbursementRate: 'Fee-for-Service',
    status: 'active',
  },
  acceptingNewPatients: true,
  conditionCategories: [CONDITION_CATEGORIES.DIABETES],
  createdAt: '2023-11-01T08:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
};

const TEST_PROVIDER_2 = {
  id: 'provider-clm-002',
  npi: '2345678901',
  firstName: 'Michael',
  lastName: 'Patel',
  specialty: 'Cardiology',
  facilityName: 'Chicago Heart Institute',
  email: 'dr.patel@example.com',
  phone: '(555) 222-3333',
  address: {
    street: '200 Cardiac Drive',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60602',
  },
  contract: {
    contractId: 'CTR-2024-002',
    effectiveDate: '2024-01-01',
    terminationDate: '2025-12-31',
    contractType: 'In-Network',
    reimbursementRate: 'Capitated',
    status: 'active',
  },
  acceptingNewPatients: true,
  conditionCategories: [CONDITION_CATEGORIES.HEART_FAILURE, CONDITION_CATEGORIES.CARDIOVASCULAR],
  createdAt: '2023-11-01T08:00:00.000Z',
  updatedAt: '2024-05-15T14:30:00.000Z',
};

const TEST_BENEFIT_PACKAGE = {
  id: 'bp-clm-001',
  name: 'CSNP Comprehensive Care Plan',
  planType: PLAN_TYPES.C_SNP,
  description: 'Comprehensive C-SNP plan for testing.',
  effectiveDate: '2024-01-01',
  terminationDate: '2024-12-31',
  benefits: {
    primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay for PCP visits' },
    specialistVisit: { copay: 20, coinsurance: 0, description: '$20 copay for specialist visits' },
    emergencyRoom: { copay: 90, coinsurance: 0, description: '$90 copay' },
    inpatientHospital: { copay: 250, coinsurance: 0, description: '$250/day' },
    prescriptionDrugTier1: { copay: 0, coinsurance: 0, description: '$0 copay' },
    prescriptionDrugTier2: { copay: 10, coinsurance: 0, description: '$10 copay' },
    prescriptionDrugTier3: { copay: 42, coinsurance: 0, description: '$42 copay' },
    diabetesSupplies: { copay: 0, coinsurance: 0, description: '$0 copay for diabetes supplies' },
    dialysis: { copay: 0, coinsurance: 20, description: '20% coinsurance' },
    cardiacRehab: { copay: 20, coinsurance: 0, description: '$20 copay per session' },
    homeHealth: { copay: 0, coinsurance: 0, description: '$0 copay' },
    telehealth: { copay: 0, coinsurance: 0, description: '$0 copay' },
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

const TEST_ENROLLMENT_ACTIVE = {
  id: 'enroll-clm-001',
  memberId: TEST_MEMBER.id,
  benefitPackageId: TEST_BENEFIT_PACKAGE.id,
  planType: PLAN_TYPES.C_SNP,
  status: ENROLLMENT_STATUSES.ACTIVE,
  channel: 'online',
  effectiveDate: '2024-01-01',
  terminationDate: null,
  applicationDate: '2023-11-15',
  approvalDate: '2023-12-01',
  processedBy: 'user-001',
  diagnosisCodesVerified: ['E11.9', 'E11.65'],
  notes: 'Active enrollment for testing.',
  createdAt: '2023-11-15T10:00:00.000Z',
  updatedAt: '2023-12-01T14:00:00.000Z',
};

const TEST_ENROLLMENT_ACTIVE_2 = {
  id: 'enroll-clm-002',
  memberId: TEST_MEMBER_2.id,
  benefitPackageId: TEST_BENEFIT_PACKAGE.id,
  planType: PLAN_TYPES.C_SNP,
  status: ENROLLMENT_STATUSES.ACTIVE,
  channel: 'phone',
  effectiveDate: '2024-01-01',
  terminationDate: null,
  applicationDate: '2023-11-20',
  approvalDate: '2023-12-05',
  processedBy: 'user-001',
  diagnosisCodesVerified: ['I50.22', 'I50.9'],
  notes: 'Active enrollment for member 2.',
  createdAt: '2023-11-20T11:30:00.000Z',
  updatedAt: '2023-12-05T09:00:00.000Z',
};

const TEST_ENROLLMENT_PENDING = {
  id: 'enroll-clm-003',
  memberId: 'member-clm-pending',
  benefitPackageId: TEST_BENEFIT_PACKAGE.id,
  planType: PLAN_TYPES.C_SNP,
  status: ENROLLMENT_STATUSES.PENDING,
  channel: 'mail',
  effectiveDate: '2024-06-01',
  terminationDate: null,
  applicationDate: '2024-04-10',
  approvalDate: null,
  processedBy: 'user-001',
  diagnosisCodesVerified: [],
  notes: 'Pending enrollment.',
  createdAt: '2024-04-10T11:00:00.000Z',
  updatedAt: '2024-04-10T11:00:00.000Z',
};

function setupDefaultData() {
  seedAuditLogs();
  seedMembers([TEST_MEMBER, TEST_MEMBER_2]);
  seedProviders([TEST_PROVIDER, TEST_PROVIDER_2]);
  seedBenefitPackages([TEST_BENEFIT_PACKAGE]);
  seedEnrollments([TEST_ENROLLMENT_ACTIVE, TEST_ENROLLMENT_ACTIVE_2]);
}

describe('claimsService', () => {
  beforeEach(() => {
    localStorage.clear();
    setupDefaultData();
  });

  describe('initiateClaims', () => {
    it('creates a submitted claim for a valid member with active enrollment', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9', 'E11.65'],
        serviceDescription: 'Endocrinology office visit - diabetes management',
        billedAmount: 350.00,
        notes: 'Routine diabetes visit.',
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(true);
      expect(result.claimId).toBeDefined();
      expect(typeof result.claimId).toBe('string');
      expect(result.claimId.length).toBeGreaterThan(0);
      expect(result.claimNumber).toBeDefined();
      expect(result.claimNumber.startsWith('CLM-')).toBe(true);
      expect(result.status).toBe(CLAIM_STATUSES.SUBMITTED);
      expect(result.timestamp).toBeDefined();
    });

    it('persists claim record to localStorage', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes management visit',
        billedAmount: 300.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      expect(stored.length).toBeGreaterThanOrEqual(1);

      const claim = stored.find((c) => c.id === result.claimId);
      expect(claim).toBeDefined();
      expect(claim.memberId).toBe(TEST_MEMBER.id);
      expect(claim.providerId).toBe(TEST_PROVIDER.id);
      expect(claim.enrollmentId).toBe(TEST_ENROLLMENT_ACTIVE.id);
      expect(claim.status).toBe(CLAIM_STATUSES.SUBMITTED);
      expect(claim.serviceDate).toBe('2024-03-15');
      expect(claim.billedAmount).toBe(300.00);
      expect(claim.diagnosisCodes).toContain('E11.9');
      expect(claim.createdAt).toBeDefined();
      expect(claim.updatedAt).toBeDefined();
    });

    it('returns an auditId when claim initiation succeeds', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 200.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(true);
      expect(result.auditId).toBeDefined();
      expect(typeof result.auditId).toBe('string');
      expect(result.auditId.length).toBeGreaterThan(0);
    });

    it('returns error when memberId is empty', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      };

      const result = initiateClaims('', claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when claimData is null', () => {
      const result = initiateClaims(TEST_MEMBER.id, null, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('returns error when member does not exist', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      };

      const result = initiateClaims('nonexistent-member', claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Member not found');
    });

    it('returns error when provider does not exist', () => {
      const claimData = {
        providerId: 'nonexistent-provider',
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider not found');
    });

    it('returns error when provider ID is missing', () => {
      const claimData = {
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when no active enrollment exists', () => {
      seedEnrollments([]);

      const claimData = {
        providerId: TEST_PROVIDER.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active enrollment');
    });

    it('returns error when enrollment ID does not exist', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: 'nonexistent-enrollment',
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment not found');
    });

    it('returns error when service date is missing', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Service date');
    });

    it('returns error when service date is in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: futureDateStr,
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('future');
    });

    it('returns error when diagnosis codes are empty', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: [],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('diagnosis code');
    });

    it('returns error when service description is missing', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: '',
        billedAmount: 100.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Service description');
    });

    it('returns error when billed amount is zero', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 0,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('greater than zero');
    });

    it('returns error when billed amount is negative', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: -50,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('greater than zero');
    });

    it('auto-detects enrollment when enrollmentId is not provided', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 200.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);
      expect(claim.enrollmentId).toBe(TEST_ENROLLMENT_ACTIVE.id);
    });

    it('normalizes diagnosis codes to uppercase', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['e11.9', 'e11.65'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 200.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);
      expect(claim.diagnosisCodes).toContain('E11.9');
      expect(claim.diagnosisCodes).toContain('E11.65');
    });

    it('stores prior authorization flag on the claim', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 200.00,
        priorAuthorizationApproved: true,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);
      expect(claim.priorAuthorizationApproved).toBe(true);
    });

    it('stores notes on the claim', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 200.00,
        notes: 'Test claim notes for persistence check',
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);
      expect(claim.notes).toContain('Test claim notes for persistence check');
    });

    it('generates a claim number starting with CLM-', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 200.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);
      expect(result.claimNumber).toBeDefined();
      expect(result.claimNumber.startsWith('CLM-')).toBe(true);
    });

    it('initializes financial fields to zero on submission', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 350.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);
      expect(claim.allowedAmount).toBe(0);
      expect(claim.paidAmount).toBe(0);
      expect(claim.memberResponsibility).toBe(0);
      expect(claim.processedBy).toBeNull();
      expect(claim.processedDate).toBeNull();
    });

    it('performs denial prevention checks and stores warnings', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 200.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);
      expect(claim.denialPreventionWarnings).toBeDefined();
      expect(Array.isArray(claim.denialPreventionWarnings)).toBe(true);
    });
  });

  describe('processClaim', () => {
    it('processes a submitted claim and calculates pricing', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9', 'E11.65'],
        serviceDescription: 'Endocrinology office visit',
        billedAmount: 350.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(initResult.success).toBe(true);

      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      expect(processResult.claimId).toBe(initResult.claimId);
      expect(processResult.timestamp).toBeDefined();
      expect(processResult.ruleEvaluation).toBeDefined();
      expect(typeof processResult.allowedAmount).toBe('number');
      expect(typeof processResult.paidAmount).toBe('number');
      expect(typeof processResult.memberResponsibility).toBe('number');
    });

    it('approves a claim with valid diagnosis codes and active enrollment', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes management visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(initResult.success).toBe(true);

      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      expect(processResult.status).toBe(CLAIM_STATUSES.APPROVED);
      expect(processResult.success).toBe(true);
      expect(processResult.allowedAmount).toBeGreaterThan(0);
      expect(processResult.paidAmount).toBeGreaterThan(0);
      expect(processResult.denialReasons).toHaveLength(0);
    });

    it('updates claim record with processing results', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === initResult.claimId);

      expect(claim.status).toBe(processResult.status);
      expect(claim.processedBy).toBe('user-001');
      expect(claim.processedDate).toBeDefined();
      expect(claim.allowedAmount).toBeGreaterThanOrEqual(0);
      expect(claim.paidAmount).toBeGreaterThanOrEqual(0);
      expect(claim.ruleEvaluation).toBeDefined();
      expect(claim.pricingDetails).toBeDefined();
    });

    it('returns error when claim ID is empty', () => {
      const result = processClaim('', { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim ID is required');
    });

    it('returns error when claim does not exist', () => {
      const result = processClaim('nonexistent-claim', { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim not found');
    });

    it('returns error when claim is already paid', () => {
      seedClaims([
        {
          id: 'paid-claim-001',
          claimNumber: 'CLM-2024-000001',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.PAID,
          serviceDate: '2024-03-15',
          submissionDate: '2024-03-20',
          diagnosisCodes: ['E11.9'],
          serviceDescription: 'Visit',
          billedAmount: 300.00,
          allowedAmount: 240.00,
          paidAmount: 240.00,
          memberResponsibility: 0,
          processedBy: 'user-001',
          processedDate: '2024-03-25',
          notes: '',
          denialReasons: [],
          denialPreventionWarnings: [],
          pricingDetails: null,
          ruleEvaluation: null,
          createdAt: '2024-03-20T10:00:00.000Z',
          updatedAt: '2024-03-25T14:00:00.000Z',
        },
      ]);

      const result = processClaim('paid-claim-001', { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be processed');
    });

    it('calculates allowed amount as percentage of billed amount', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 500.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      if (processResult.status === CLAIM_STATUSES.APPROVED) {
        expect(processResult.allowedAmount).toBeLessThanOrEqual(500.00);
        expect(processResult.allowedAmount).toBeGreaterThan(0);
      }
    });

    it('includes rule evaluation results in the processing result', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      expect(processResult.ruleEvaluation).toBeDefined();
      expect(processResult.ruleEvaluation.approved).toBeDefined();
      expect(typeof processResult.ruleEvaluation.approved).toBe('boolean');
    });

    it('stores pricing details on the claim after processing', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      processClaim(initResult.claimId, { performedBy: 'user-001' });

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === initResult.claimId);
      expect(claim.pricingDetails).toBeDefined();
      expect(claim.pricingDetails).not.toBeNull();
    });
  });

  describe('plan-based pricing', () => {
    it('applies diabetes-specific copay for diabetes diagnosis codes', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes supplies and management',
        billedAmount: 200.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      if (processResult.status === CLAIM_STATUSES.APPROVED) {
        const stored = getStoredClaims();
        const claim = stored.find((c) => c.id === initResult.claimId);
        expect(claim.pricingDetails).toBeDefined();
        expect(claim.pricingDetails.method).toBe('plan_based');
      }
    });

    it('applies specialist copay for non-condition-specific claims', () => {
      const claimData = {
        providerId: TEST_PROVIDER_2.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['I50.22'],
        serviceDescription: 'Cardiology consultation',
        billedAmount: 500.00,
      };

      const initResult = initiateClaims(TEST_MEMBER_2.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      if (processResult.status === CLAIM_STATUSES.APPROVED) {
        expect(processResult.memberResponsibility).toBeGreaterThanOrEqual(0);
        expect(processResult.paidAmount).toBeGreaterThan(0);
      }
    });

    it('calculates member responsibility correctly', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 400.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      if (processResult.status === CLAIM_STATUSES.APPROVED) {
        const total = processResult.paidAmount + processResult.memberResponsibility;
        expect(total).toBeLessThanOrEqual(processResult.allowedAmount + 0.01);
        expect(total).toBeGreaterThanOrEqual(processResult.allowedAmount - 0.01);
      }
    });
  });

  describe('authorization logic', () => {
    it('generates denial prevention warning for high-cost services without prior auth', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Advanced imaging MRI of abdomen',
        billedAmount: 2800.00,
        priorAuthorizationApproved: false,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);
      expect(claim.denialPreventionWarnings.length).toBeGreaterThan(0);

      const authWarning = claim.denialPreventionWarnings.find(
        (w) => w.toLowerCase().includes('authorization')
      );
      expect(authWarning).toBeDefined();
    });

    it('does not generate auth warning when prior authorization is approved', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Advanced imaging MRI of abdomen',
        billedAmount: 2800.00,
        priorAuthorizationApproved: true,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);

      const authWarning = claim.denialPreventionWarnings.find(
        (w) => w.toLowerCase().includes('prior authorization required')
      );
      expect(authWarning).toBeUndefined();
    });

    it('does not require auth for low-cost services', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Routine office visit',
        billedAmount: 150.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);

      const authWarning = claim.denialPreventionWarnings.find(
        (w) => w.toLowerCase().includes('prior authorization required')
      );
      expect(authWarning).toBeUndefined();
    });
  });

  describe('denial prevention', () => {
    it('warns when claim has no diagnosis codes', () => {
      const result = analyzeDenialRisk(TEST_MEMBER.id, {
        providerId: TEST_PROVIDER.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: [],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      });

      expect(result.preventable).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('warns when billed amount is zero', () => {
      const result = analyzeDenialRisk(TEST_MEMBER.id, {
        providerId: TEST_PROVIDER.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 0,
      });

      expect(result.preventable).toBe(true);
      const amountWarning = result.warnings.find((w) => w.toLowerCase().includes('zero'));
      expect(amountWarning).toBeDefined();
    });

    it('warns when provider ID is missing', () => {
      const result = analyzeDenialRisk(TEST_MEMBER.id, {
        providerId: '',
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      });

      expect(result.preventable).toBe(true);
      const providerWarning = result.warnings.find((w) => w.toLowerCase().includes('provider'));
      expect(providerWarning).toBeDefined();
    });

    it('warns when member ID is empty', () => {
      const result = analyzeDenialRisk('', {
        providerId: TEST_PROVIDER.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit',
        billedAmount: 100.00,
      });

      expect(result.preventable).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('warns when claim data is null', () => {
      const result = analyzeDenialRisk(TEST_MEMBER.id, null);

      expect(result.preventable).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('identifies duplicate claim risk', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const result = analyzeDenialRisk(TEST_MEMBER.id, {
        providerId: TEST_PROVIDER.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      });

      expect(result.duplicateRisk).toBe(true);
    });

    it('does not flag duplicate risk for different service dates', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const result = analyzeDenialRisk(TEST_MEMBER.id, {
        providerId: TEST_PROVIDER.id,
        serviceDate: '2024-04-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      });

      expect(result.duplicateRisk).toBe(false);
    });
  });

  describe('auto-process claims', () => {
    it('auto-processes claim when autoProcess option is true', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, {
        performedBy: 'user-001',
        autoProcess: true,
      });

      expect(result.success).toBe(true);
      expect(result.status).not.toBe(CLAIM_STATUSES.SUBMITTED);
      expect(result.ruleEvaluation).toBeDefined();
    });
  });

  describe('getClaimStatus', () => {
    it('returns claim status for a valid claim ID', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const statusResult = getClaimStatus(initResult.claimId);

      expect(statusResult.found).toBe(true);
      expect(statusResult.claimId).toBe(initResult.claimId);
      expect(statusResult.claimNumber).toBeDefined();
      expect(statusResult.status).toBe(CLAIM_STATUSES.SUBMITTED);
      expect(statusResult.statusLabel).toBe('Submitted');
      expect(statusResult.claim).toBeDefined();
    });

    it('returns not found for empty claim ID', () => {
      const result = getClaimStatus('');

      expect(result.found).toBe(false);
      expect(result.error).toContain('Claim ID is required');
    });

    it('returns not found for nonexistent claim', () => {
      const result = getClaimStatus('nonexistent-claim');

      expect(result.found).toBe(false);
      expect(result.error).toContain('Claim not found');
    });
  });

  describe('getClaimById', () => {
    it('returns null for empty claim ID', () => {
      const result = getClaimById('');
      expect(result).toBeNull();
    });

    it('returns null for nonexistent claim', () => {
      const result = getClaimById('nonexistent');
      expect(result).toBeNull();
    });

    it('returns enriched claim with member and provider names', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const claim = getClaimById(initResult.claimId);

      expect(claim).not.toBeNull();
      expect(claim.id).toBe(initResult.claimId);
      expect(claim.memberName).toContain('Alice');
      expect(claim.memberName).toContain('Johnson');
      expect(claim.providerName).toContain('Sarah');
      expect(claim.providerName).toContain('Chen');
      expect(claim.statusLabel).toBe('Submitted');
    });
  });

  describe('listClaims', () => {
    it('returns empty array when no claims exist', () => {
      const claims = listClaims();
      expect(claims).toEqual([]);
    });

    it('returns all claims sorted by creation date descending', () => {
      const claimData1 = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-02-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit 1',
        billedAmount: 200.00,
      };

      const claimData2 = {
        providerId: TEST_PROVIDER_2.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['I50.22'],
        serviceDescription: 'Visit 2',
        billedAmount: 500.00,
      };

      initiateClaims(TEST_MEMBER.id, claimData1, { performedBy: 'user-001' });
      initiateClaims(TEST_MEMBER_2.id, claimData2, { performedBy: 'user-001' });

      const claims = listClaims();
      expect(claims.length).toBe(2);
      expect(new Date(claims[0].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(claims[1].createdAt).getTime()
      );
    });

    it('filters by member ID', () => {
      const claimData1 = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-02-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit 1',
        billedAmount: 200.00,
      };

      const claimData2 = {
        providerId: TEST_PROVIDER_2.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['I50.22'],
        serviceDescription: 'Visit 2',
        billedAmount: 500.00,
      };

      initiateClaims(TEST_MEMBER.id, claimData1, { performedBy: 'user-001' });
      initiateClaims(TEST_MEMBER_2.id, claimData2, { performedBy: 'user-001' });

      const claims = listClaims({ memberId: TEST_MEMBER.id });
      expect(claims.length).toBe(1);
      expect(claims[0].memberId).toBe(TEST_MEMBER.id);
    });

    it('filters by provider ID', () => {
      const claimData1 = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-02-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit 1',
        billedAmount: 200.00,
      };

      const claimData2 = {
        providerId: TEST_PROVIDER_2.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['I50.22'],
        serviceDescription: 'Visit 2',
        billedAmount: 500.00,
      };

      initiateClaims(TEST_MEMBER.id, claimData1, { performedBy: 'user-001' });
      initiateClaims(TEST_MEMBER_2.id, claimData2, { performedBy: 'user-001' });

      const claims = listClaims({ providerId: TEST_PROVIDER_2.id });
      expect(claims.length).toBe(1);
      expect(claims[0].providerId).toBe(TEST_PROVIDER_2.id);
    });

    it('filters by status', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      processClaim(initResult.claimId, { performedBy: 'user-001' });

      const submittedClaims = listClaims({ status: CLAIM_STATUSES.SUBMITTED });
      const approvedClaims = listClaims({ status: CLAIM_STATUSES.APPROVED });

      expect(submittedClaims.length).toBe(0);
      expect(approvedClaims.length).toBe(1);
    });

    it('filters by diagnosis code', () => {
      const claimData1 = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-02-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit 1',
        billedAmount: 200.00,
      };

      const claimData2 = {
        providerId: TEST_PROVIDER_2.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['I50.22'],
        serviceDescription: 'Visit 2',
        billedAmount: 500.00,
      };

      initiateClaims(TEST_MEMBER.id, claimData1, { performedBy: 'user-001' });
      initiateClaims(TEST_MEMBER_2.id, claimData2, { performedBy: 'user-001' });

      const claims = listClaims({ diagnosisCode: 'E11.9' });
      expect(claims.length).toBe(1);
      expect(claims[0].diagnosisCodes).toContain('E11.9');
    });
  });

  describe('getMemberClaims', () => {
    it('returns empty array for empty member ID', () => {
      const claims = getMemberClaims('');
      expect(claims).toEqual([]);
    });

    it('returns claims for a specific member', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const claims = getMemberClaims(TEST_MEMBER.id);
      expect(claims.length).toBe(1);
      expect(claims[0].memberId).toBe(TEST_MEMBER.id);
    });
  });

  describe('getProviderClaims', () => {
    it('returns empty array for empty provider ID', () => {
      const claims = getProviderClaims('');
      expect(claims).toEqual([]);
    });

    it('returns claims for a specific provider', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const claims = getProviderClaims(TEST_PROVIDER.id);
      expect(claims.length).toBe(1);
      expect(claims[0].providerId).toBe(TEST_PROVIDER.id);
    });
  });

  describe('appealClaim', () => {
    it('appeals a denied claim', () => {
      seedClaims([
        {
          id: 'denied-claim-001',
          claimNumber: 'CLM-2024-DENIED',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.DENIED,
          serviceDate: '2024-03-15',
          submissionDate: '2024-03-20',
          diagnosisCodes: ['E11.9'],
          serviceDescription: 'Visit',
          billedAmount: 300.00,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          processedBy: 'user-001',
          processedDate: '2024-03-25',
          notes: '',
          denialReasons: ['Prior authorization not obtained'],
          denialPreventionWarnings: [],
          pricingDetails: null,
          ruleEvaluation: null,
          createdAt: '2024-03-20T10:00:00.000Z',
          updatedAt: '2024-03-25T14:00:00.000Z',
        },
      ]);

      const result = appealClaim('denied-claim-001', 'Clinical review requested', 'user-001');

      expect(result.success).toBe(true);
      expect(result.claimId).toBe('denied-claim-001');
      expect(result.status).toBe(CLAIM_STATUSES.APPEALED);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === 'denied-claim-001');
      expect(claim.status).toBe(CLAIM_STATUSES.APPEALED);
      expect(claim.notes).toContain('Clinical review requested');
    });

    it('returns error when claim ID is empty', () => {
      const result = appealClaim('', 'reason');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim ID is required');
    });

    it('returns error when claim does not exist', () => {
      const result = appealClaim('nonexistent', 'reason');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim not found');
    });

    it('returns error when claim is not denied', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const result = appealClaim(initResult.claimId, 'reason', 'user-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only denied claims');
    });
  });

  describe('voidClaim', () => {
    it('voids a submitted claim', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const result = voidClaim(initResult.claimId, 'Duplicate submission', 'user-001');

      expect(result.success).toBe(true);
      expect(result.claimId).toBe(initResult.claimId);
      expect(result.status).toBe(CLAIM_STATUSES.VOIDED);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === initResult.claimId);
      expect(claim.status).toBe(CLAIM_STATUSES.VOIDED);
      expect(claim.notes).toContain('Duplicate submission');
    });

    it('returns error when claim ID is empty', () => {
      const result = voidClaim('', 'reason');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim ID is required');
    });

    it('returns error when claim does not exist', () => {
      const result = voidClaim('nonexistent', 'reason');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim not found');
    });

    it('returns error when claim is already voided', () => {
      seedClaims([
        {
          id: 'voided-claim-001',
          claimNumber: 'CLM-2024-VOIDED',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.VOIDED,
          serviceDate: '2024-03-15',
          submissionDate: '2024-03-20',
          diagnosisCodes: ['E11.9'],
          serviceDescription: 'Visit',
          billedAmount: 300.00,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          notes: '',
          denialReasons: [],
          denialPreventionWarnings: [],
          pricingDetails: null,
          ruleEvaluation: null,
          createdAt: '2024-03-20T10:00:00.000Z',
          updatedAt: '2024-03-25T14:00:00.000Z',
        },
      ]);

      const result = voidClaim('voided-claim-001', 'reason', 'user-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already voided');
    });

    it('returns error when claim is paid', () => {
      seedClaims([
        {
          id: 'paid-claim-002',
          claimNumber: 'CLM-2024-PAID',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.PAID,
          serviceDate: '2024-03-15',
          submissionDate: '2024-03-20',
          diagnosisCodes: ['E11.9'],
          serviceDescription: 'Visit',
          billedAmount: 300.00,
          allowedAmount: 240.00,
          paidAmount: 240.00,
          memberResponsibility: 0,
          notes: '',
          denialReasons: [],
          denialPreventionWarnings: [],
          pricingDetails: null,
          ruleEvaluation: null,
          createdAt: '2024-03-20T10:00:00.000Z',
          updatedAt: '2024-03-25T14:00:00.000Z',
        },
      ]);

      const result = voidClaim('paid-claim-002', 'reason', 'user-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Paid claims cannot be voided');
    });
  });

  describe('markClaimPaid', () => {
    it('marks an approved claim as paid', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      processClaim(initResult.claimId, { performedBy: 'user-001' });

      const result = markClaimPaid(initResult.claimId, 'user-001');

      expect(result.success).toBe(true);
      expect(result.claimId).toBe(initResult.claimId);
      expect(result.status).toBe(CLAIM_STATUSES.PAID);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === initResult.claimId);
      expect(claim.status).toBe(CLAIM_STATUSES.PAID);
    });

    it('returns error when claim ID is empty', () => {
      const result = markClaimPaid('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim ID is required');
    });

    it('returns error when claim does not exist', () => {
      const result = markClaimPaid('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim not found');
    });

    it('returns error when claim is not approved', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const result = markClaimPaid(initResult.claimId, 'user-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only approved claims');
    });
  });

  describe('reprocessClaim', () => {
    it('reprocesses an appealed claim', () => {
      seedClaims([
        {
          id: 'appealed-claim-001',
          claimNumber: 'CLM-2024-APPEALED',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.APPEALED,
          serviceDate: '2024-03-15',
          submissionDate: '2024-03-20',
          diagnosisCodes: ['E11.9'],
          serviceDescription: 'Diabetes visit',
          billedAmount: 300.00,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          processedBy: null,
          processedDate: null,
          notes: '',
          denialReasons: [],
          denialPreventionWarnings: [],
          pricingDetails: null,
          ruleEvaluation: null,
          priorAuthorizationApproved: true,
          createdAt: '2024-03-20T10:00:00.000Z',
          updatedAt: '2024-04-01T14:00:00.000Z',
        },
      ]);

      const result = reprocessClaim('appealed-claim-001', { performedBy: 'user-001' });

      expect(result.claimId).toBe('appealed-claim-001');
      expect(result.timestamp).toBeDefined();
      expect(result.ruleEvaluation).toBeDefined();
    });

    it('reprocesses an in-review claim', () => {
      seedClaims([
        {
          id: 'review-claim-001',
          claimNumber: 'CLM-2024-REVIEW',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.IN_REVIEW,
          serviceDate: '2024-03-15',
          submissionDate: '2024-03-20',
          diagnosisCodes: ['E11.9'],
          serviceDescription: 'Diabetes visit',
          billedAmount: 300.00,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          processedBy: null,
          processedDate: null,
          notes: '',
          denialReasons: [],
          denialPreventionWarnings: [],
          pricingDetails: null,
          ruleEvaluation: null,
          createdAt: '2024-03-20T10:00:00.000Z',
          updatedAt: '2024-03-25T14:00:00.000Z',
        },
      ]);

      const result = reprocessClaim('review-claim-001', { performedBy: 'user-001' });

      expect(result.claimId).toBe('review-claim-001');
      expect(result.timestamp).toBeDefined();
    });

    it('returns error when claim ID is empty', () => {
      const result = reprocessClaim('', { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim ID is required');
    });

    it('returns error when claim does not exist', () => {
      const result = reprocessClaim('nonexistent', { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claim not found');
    });

    it('returns error when claim is in a non-reprocessable status', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const result = reprocessClaim(initResult.claimId, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be reprocessed');
    });
  });

  describe('updateClaimNotes', () => {
    it('appends notes to an existing claim', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
        notes: 'Initial note',
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const result = updateClaimNotes(initResult.claimId, 'Additional note added', 'user-001');

      expect(result).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === initResult.claimId);
      expect(claim.notes).toContain('Initial note');
      expect(claim.notes).toContain('Additional note added');
    });

    it('returns false for empty claim ID', () => {
      const result = updateClaimNotes('', 'note');
      expect(result).toBe(false);
    });

    it('returns false for empty notes', () => {
      const result = updateClaimNotes('some-id', '');
      expect(result).toBe(false);
    });

    it('returns false when claim does not exist', () => {
      const result = updateClaimNotes('nonexistent', 'note');
      expect(result).toBe(false);
    });
  });

  describe('getClaimStats', () => {
    it('returns zero counts when no claims exist', () => {
      const stats = getClaimStats();

      expect(stats.total).toBe(0);
      expect(stats.byStatus).toEqual({});
      expect(stats.totalBilled).toBe(0);
      expect(stats.totalPaid).toBe(0);
      expect(stats.totalMemberResponsibility).toBe(0);
      expect(stats.denialRate).toBe(0);
      expect(stats.approvalRate).toBe(0);
    });

    it('returns correct counts for mixed claims', () => {
      const claimData1 = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-02-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit 1',
        billedAmount: 200.00,
      };

      const claimData2 = {
        providerId: TEST_PROVIDER_2.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['I50.22'],
        serviceDescription: 'Visit 2',
        billedAmount: 500.00,
      };

      const init1 = initiateClaims(TEST_MEMBER.id, claimData1, { performedBy: 'user-001' });
      const init2 = initiateClaims(TEST_MEMBER_2.id, claimData2, { performedBy: 'user-001' });

      processClaim(init1.claimId, { performedBy: 'user-001' });
      processClaim(init2.claimId, { performedBy: 'user-001' });

      const stats = getClaimStats();

      expect(stats.total).toBe(2);
      expect(stats.totalBilled).toBe(700.00);
      expect(stats.totalPaid).toBeGreaterThan(0);
    });

    it('calculates denial rate correctly', () => {
      seedClaims([
        {
          id: 'stat-1',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.APPROVED,
          billedAmount: 200,
          allowedAmount: 160,
          paidAmount: 160,
          memberResponsibility: 0,
          diagnosisCodes: ['E11.9'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'stat-2',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.DENIED,
          billedAmount: 300,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          diagnosisCodes: ['E11.9'],
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
        {
          id: 'stat-3',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.PAID,
          billedAmount: 400,
          allowedAmount: 320,
          paidAmount: 300,
          memberResponsibility: 20,
          diagnosisCodes: ['E11.9'],
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-03T00:00:00Z',
        },
      ]);

      const stats = getClaimStats();

      expect(stats.total).toBe(3);
      expect(stats.totalBilled).toBe(900);
      expect(stats.totalPaid).toBe(460);
      expect(stats.totalMemberResponsibility).toBe(20);

      // 1 denied out of 3 processed = 33.33%
      expect(stats.denialRate).toBeCloseTo(33.33, 0);
      // 2 approved/paid out of 3 processed = 66.67%
      expect(stats.approvalRate).toBeCloseTo(66.67, 0);
    });
  });

  describe('getAllClaimRecords', () => {
    it('returns empty array when no claims exist', () => {
      const records = getAllClaimRecords();
      expect(records).toEqual([]);
    });

    it('returns all stored claim records', () => {
      const claimData1 = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-02-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit 1',
        billedAmount: 200.00,
      };

      const claimData2 = {
        providerId: TEST_PROVIDER_2.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['I50.22'],
        serviceDescription: 'Visit 2',
        billedAmount: 500.00,
      };

      initiateClaims(TEST_MEMBER.id, claimData1, { performedBy: 'user-001' });
      initiateClaims(TEST_MEMBER_2.id, claimData2, { performedBy: 'user-001' });

      const records = getAllClaimRecords();
      expect(records).toHaveLength(2);
    });
  });

  describe('getClaimsNeedingAttention', () => {
    it('returns claims in submitted, pending, in_review, or appealed status', () => {
      seedClaims([
        {
          id: 'attn-1',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.SUBMITTED,
          billedAmount: 200,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          diagnosisCodes: ['E11.9'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'attn-2',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.APPROVED,
          billedAmount: 300,
          allowedAmount: 240,
          paidAmount: 240,
          memberResponsibility: 0,
          diagnosisCodes: ['E11.9'],
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
        {
          id: 'attn-3',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.IN_REVIEW,
          billedAmount: 400,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          diagnosisCodes: ['E11.9'],
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-03T00:00:00Z',
        },
        {
          id: 'attn-4',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.APPEALED,
          billedAmount: 500,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          diagnosisCodes: ['E11.9'],
          createdAt: '2024-01-04T00:00:00Z',
          updatedAt: '2024-01-04T00:00:00Z',
        },
        {
          id: 'attn-5',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.PAID,
          billedAmount: 600,
          allowedAmount: 480,
          paidAmount: 480,
          memberResponsibility: 0,
          diagnosisCodes: ['E11.9'],
          createdAt: '2024-01-05T00:00:00Z',
          updatedAt: '2024-01-05T00:00:00Z',
        },
      ]);

      const needingAttention = getClaimsNeedingAttention();

      expect(needingAttention.length).toBe(3);
      const statuses = needingAttention.map((c) => c.status);
      expect(statuses).toContain(CLAIM_STATUSES.SUBMITTED);
      expect(statuses).toContain(CLAIM_STATUSES.IN_REVIEW);
      expect(statuses).toContain(CLAIM_STATUSES.APPEALED);
      expect(statuses).not.toContain(CLAIM_STATUSES.APPROVED);
      expect(statuses).not.toContain(CLAIM_STATUSES.PAID);
    });

    it('returns empty array when no claims need attention', () => {
      seedClaims([
        {
          id: 'no-attn-1',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.PAID,
          billedAmount: 200,
          allowedAmount: 160,
          paidAmount: 160,
          memberResponsibility: 0,
          diagnosisCodes: ['E11.9'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]);

      const needingAttention = getClaimsNeedingAttention();
      expect(needingAttention).toHaveLength(0);
    });
  });

  describe('batchInitiateClaims', () => {
    it('returns empty result for empty input', () => {
      const result = batchInitiateClaims([]);

      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('processes multiple claims in batch', () => {
      const claimEntries = [
        {
          memberId: TEST_MEMBER.id,
          claimData: {
            providerId: TEST_PROVIDER.id,
            enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
            serviceDate: '2024-02-15',
            diagnosisCodes: ['E11.9'],
            serviceDescription: 'Visit 1',
            billedAmount: 200.00,
          },
        },
        {
          memberId: TEST_MEMBER_2.id,
          claimData: {
            providerId: TEST_PROVIDER_2.id,
            enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
            serviceDate: '2024-03-15',
            diagnosisCodes: ['I50.22'],
            serviceDescription: 'Visit 2',
            billedAmount: 500.00,
          },
        },
      ];

      const result = batchInitiateClaims(claimEntries, { performedBy: 'user-001' });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    it('handles mixed success and failure in batch', () => {
      const claimEntries = [
        {
          memberId: TEST_MEMBER.id,
          claimData: {
            providerId: TEST_PROVIDER.id,
            enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
            serviceDate: '2024-02-15',
            diagnosisCodes: ['E11.9'],
            serviceDescription: 'Visit 1',
            billedAmount: 200.00,
          },
        },
        {
          memberId: 'nonexistent-member',
          claimData: {
            providerId: TEST_PROVIDER.id,
            serviceDate: '2024-03-15',
            diagnosisCodes: ['E11.9'],
            serviceDescription: 'Visit 2',
            billedAmount: 300.00,
          },
        },
      ];

      const result = batchInitiateClaims(claimEntries, { performedBy: 'user-001' });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });

    it('handles invalid entries in batch', () => {
      const claimEntries = [
        null,
        {
          memberId: TEST_MEMBER.id,
          claimData: {
            providerId: TEST_PROVIDER.id,
            enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
            serviceDate: '2024-02-15',
            diagnosisCodes: ['E11.9'],
            serviceDescription: 'Visit 1',
            billedAmount: 200.00,
          },
        },
      ];

      const result = batchInitiateClaims(claimEntries, { performedBy: 'user-001' });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('CSNP adjudication rules', () => {
    it('approves claim with valid CSNP-eligible diagnosis codes', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9', 'E11.65'],
        serviceDescription: 'Diabetes management visit',
        billedAmount: 350.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      expect(processResult.status).toBe(CLAIM_STATUSES.APPROVED);
      expect(processResult.success).toBe(true);
      expect(processResult.denialReasons).toHaveLength(0);
    });

    it('stores rule evaluation with passed and failed counts', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      processClaim(initResult.claimId, { performedBy: 'user-001' });

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === initResult.claimId);

      expect(claim.ruleEvaluation).toBeDefined();
      expect(typeof claim.ruleEvaluation.rulesPassed).toBe('number');
      expect(typeof claim.ruleEvaluation.rulesFailed).toBe('number');
      expect(typeof claim.ruleEvaluation.approved).toBe('boolean');
    });

    it('processes claim for heart failure member correctly', () => {
      const claimData = {
        providerId: TEST_PROVIDER_2.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['I50.22', 'I25.10'],
        serviceDescription: 'Cardiology consultation with echocardiogram',
        billedAmount: 875.00,
      };

      const initResult = initiateClaims(TEST_MEMBER_2.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      expect(processResult.status).toBe(CLAIM_STATUSES.APPROVED);
      expect(processResult.allowedAmount).toBeGreaterThan(0);
      expect(processResult.paidAmount).toBeGreaterThan(0);
    });
  });

  describe('claim lifecycle', () => {
    it('supports full lifecycle: initiate -> process -> mark paid', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes management visit',
        billedAmount: 350.00,
      };

      // Step 1: Initiate
      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(initResult.success).toBe(true);
      expect(initResult.status).toBe(CLAIM_STATUSES.SUBMITTED);

      // Step 2: Process
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });
      expect(processResult.status).toBe(CLAIM_STATUSES.APPROVED);
      expect(processResult.paidAmount).toBeGreaterThan(0);

      // Step 3: Mark Paid
      const paidResult = markClaimPaid(initResult.claimId, 'user-001');
      expect(paidResult.success).toBe(true);
      expect(paidResult.status).toBe(CLAIM_STATUSES.PAID);

      // Verify final state
      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === initResult.claimId);
      expect(claim.status).toBe(CLAIM_STATUSES.PAID);
      expect(claim.paidAmount).toBeGreaterThan(0);
      expect(claim.processedBy).toBe('user-001');
      expect(claim.processedDate).toBeDefined();
    });

    it('supports lifecycle: initiate -> process (deny) -> appeal -> reprocess', () => {
      seedClaims([
        {
          id: 'lifecycle-deny-001',
          claimNumber: 'CLM-2024-LIFECYCLE',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.DENIED,
          serviceDate: '2024-03-15',
          submissionDate: '2024-03-20',
          diagnosisCodes: ['E11.9'],
          serviceDescription: 'Diabetes visit',
          billedAmount: 300.00,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          processedBy: 'user-001',
          processedDate: '2024-03-25',
          notes: '',
          denialReasons: ['Prior authorization not obtained'],
          denialPreventionWarnings: [],
          pricingDetails: null,
          ruleEvaluation: null,
          priorAuthorizationApproved: false,
          createdAt: '2024-03-20T10:00:00.000Z',
          updatedAt: '2024-03-25T14:00:00.000Z',
        },
      ]);

      // Step 1: Appeal
      const appealResult = appealClaim('lifecycle-deny-001', 'Retroactive prior auth obtained', 'user-001');
      expect(appealResult.success).toBe(true);
      expect(appealResult.status).toBe(CLAIM_STATUSES.APPEALED);

      // Step 2: Reprocess
      const reprocessResult = reprocessClaim('lifecycle-deny-001', { performedBy: 'user-001' });
      expect(reprocessResult.claimId).toBe('lifecycle-deny-001');
      expect(reprocessResult.timestamp).toBeDefined();
    });

    it('supports lifecycle: initiate -> void', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      expect(initResult.success).toBe(true);

      const voidResult = voidClaim(initResult.claimId, 'Submitted in error', 'user-001');
      expect(voidResult.success).toBe(true);
      expect(voidResult.status).toBe(CLAIM_STATUSES.VOIDED);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === initResult.claimId);
      expect(claim.status).toBe(CLAIM_STATUSES.VOIDED);
    });
  });

  describe('audit logging', () => {
    it('creates audit log entry on claim initiation', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(true);
      expect(result.auditId).toBeDefined();
      expect(typeof result.auditId).toBe('string');
      expect(result.auditId.length).toBeGreaterThan(0);

      const auditLogs = JSON.parse(localStorage.getItem('csnp_audit_logs') || '[]');
      const auditEntry = auditLogs.find((log) => log.id === result.auditId);
      expect(auditEntry).toBeDefined();
      expect(auditEntry.action).toBe('claim_submit');
      expect(auditEntry.targetType).toBe('claim');
      expect(auditEntry.targetId).toBe(result.claimId);
    });

    it('creates audit log entry on claim processing', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      expect(processResult.auditId).toBeDefined();
      expect(typeof processResult.auditId).toBe('string');

      const auditLogs = JSON.parse(localStorage.getItem('csnp_audit_logs') || '[]');
      const auditEntry = auditLogs.find((log) => log.id === processResult.auditId);
      expect(auditEntry).toBeDefined();
      expect(auditEntry.targetType).toBe('claim');
      expect(auditEntry.targetId).toBe(initResult.claimId);
    });

    it('creates audit log entry on claim appeal', () => {
      seedClaims([
        {
          id: 'audit-appeal-001',
          claimNumber: 'CLM-2024-AUDIT-APPEAL',
          memberId: TEST_MEMBER.id,
          providerId: TEST_PROVIDER.id,
          enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
          status: CLAIM_STATUSES.DENIED,
          serviceDate: '2024-03-15',
          submissionDate: '2024-03-20',
          diagnosisCodes: ['E11.9'],
          serviceDescription: 'Visit',
          billedAmount: 300.00,
          allowedAmount: 0,
          paidAmount: 0,
          memberResponsibility: 0,
          notes: '',
          denialReasons: ['Denied'],
          denialPreventionWarnings: [],
          pricingDetails: null,
          ruleEvaluation: null,
          createdAt: '2024-03-20T10:00:00.000Z',
          updatedAt: '2024-03-25T14:00:00.000Z',
        },
      ]);

      const auditLogsBefore = JSON.parse(localStorage.getItem('csnp_audit_logs') || '[]');
      const countBefore = auditLogsBefore.length;

      appealClaim('audit-appeal-001', 'Appeal reason', 'user-001');

      const auditLogsAfter = JSON.parse(localStorage.getItem('csnp_audit_logs') || '[]');
      expect(auditLogsAfter.length).toBeGreaterThan(countBefore);

      const appealLog = auditLogsAfter.find(
        (log) => log.action === 'claim_appeal' && log.targetId === 'audit-appeal-001'
      );
      expect(appealLog).toBeDefined();
    });

    it('creates audit log entry on claim void', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      const auditLogsBefore = JSON.parse(localStorage.getItem('csnp_audit_logs') || '[]');
      const countBefore = auditLogsBefore.length;

      voidClaim(initResult.claimId, 'Void reason', 'user-001');

      const auditLogsAfter = JSON.parse(localStorage.getItem('csnp_audit_logs') || '[]');
      expect(auditLogsAfter.length).toBeGreaterThan(countBefore);

      const voidLog = auditLogsAfter.find(
        (log) => log.action === 'update' && log.targetId === initResult.claimId && log.description.includes('voided')
      );
      expect(voidLog).toBeDefined();
    });

    it('creates audit log entry on mark paid', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      processClaim(initResult.claimId, { performedBy: 'user-001' });

      const auditLogsBefore = JSON.parse(localStorage.getItem('csnp_audit_logs') || '[]');
      const countBefore = auditLogsBefore.length;

      markClaimPaid(initResult.claimId, 'user-001');

      const auditLogsAfter = JSON.parse(localStorage.getItem('csnp_audit_logs') || '[]');
      expect(auditLogsAfter.length).toBeGreaterThan(countBefore);

      const paidLog = auditLogsAfter.find(
        (log) => log.targetId === initResult.claimId && log.description.includes('paid')
      );
      expect(paidLog).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles claim with string billed amount', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: '300.50',
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(true);

      const stored = getStoredClaims();
      const claim = stored.find((c) => c.id === result.claimId);
      expect(claim.billedAmount).toBe(300.50);
    });

    it('handles claim with NaN billed amount', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 'not-a-number',
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('valid number');
    });

    it('handles claim with invalid service date format', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: 'not-a-date',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles claim with enrollment belonging to different member', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE_2.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 300.00,
      };

      const result = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not belong');
    });

    it('rounds financial amounts to 2 decimal places', () => {
      const claimData = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Diabetes visit',
        billedAmount: 333.33,
      };

      const initResult = initiateClaims(TEST_MEMBER.id, claimData, { performedBy: 'user-001' });
      const processResult = processClaim(initResult.claimId, { performedBy: 'user-001' });

      if (processResult.status === CLAIM_STATUSES.APPROVED) {
        const decimalPlaces = (num) => {
          const str = String(num);
          const dotIndex = str.indexOf('.');
          if (dotIndex === -1) return 0;
          return str.length - dotIndex - 1;
        };

        expect(decimalPlaces(processResult.allowedAmount)).toBeLessThanOrEqual(2);
        expect(decimalPlaces(processResult.paidAmount)).toBeLessThanOrEqual(2);
        expect(decimalPlaces(processResult.memberResponsibility)).toBeLessThanOrEqual(2);
      }
    });

    it('handles multiple claims for the same member', () => {
      const claimData1 = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-02-15',
        diagnosisCodes: ['E11.9'],
        serviceDescription: 'Visit 1',
        billedAmount: 200.00,
      };

      const claimData2 = {
        providerId: TEST_PROVIDER.id,
        enrollmentId: TEST_ENROLLMENT_ACTIVE.id,
        serviceDate: '2024-03-15',
        diagnosisCodes: ['E11.9', 'E11.65'],
        serviceDescription: 'Visit 2',
        billedAmount: 350.00,
      };

      const result1 = initiateClaims(TEST_MEMBER.id, claimData1, { performedBy: 'user-001' });
      const result2 = initiateClaims(TEST_MEMBER.id, claimData2, { performedBy: 'user-001' });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.claimId).not.toBe(result2.claimId);
      expect(result1.claimNumber).not.toBe(result2.claimNumber);

      const memberClaims = getMemberClaims(TEST_MEMBER.id);
      expect(memberClaims.length).toBe(2);
    });
  });
});