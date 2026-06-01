import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  intakeEnrollment,
  submitEnrollment,
  getEnrollment,
  getEnrollmentById,
  processDocuments,
  approveEnrollment,
  rejectEnrollment,
  cancelEnrollment,
  disenrollMember,
  getAllEnrollmentRecords,
  getEnrollmentsByStatus,
  getEnrollmentsByChannel,
  getEnrollmentStats,
  hasActiveEnrollment,
  updateEnrollmentNotes,
  batchIntakeEnrollments,
} from '../enrollmentService.js';
import {
  ENROLLMENT_CHANNELS,
  ENROLLMENT_STATUSES,
  PLAN_TYPES,
} from '../../utils/constants.js';

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
 * Helper to set up localStorage with enrollments.
 * @param {Object[]} enrollments - Array of enrollment objects
 */
function seedEnrollments(enrollments) {
  localStorage.setItem('csnp_enrollments', JSON.stringify(enrollments));
}

/**
 * Helper to get enrollments from localStorage.
 * @returns {Object[]}
 */
function getStoredEnrollments() {
  const raw = localStorage.getItem('csnp_enrollments');
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

/**
 * Helper to seed eligibility records (empty array to avoid errors).
 */
function seedEligibilityRecords() {
  if (!localStorage.getItem('csnp_eligibility_records')) {
    localStorage.setItem('csnp_eligibility_records', JSON.stringify([]));
  }
}

const TEST_MEMBER = {
  id: 'member-test-001',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1950-05-15',
  ssn: '***-**-1234',
  ccid: 'H1234-001',
  appin: 'APP-2024-99999',
  medicareId: '1EG4-TE5-MK72',
  gender: 'Female',
  email: 'jane.doe@example.com',
  phone: '(555) 999-0001',
  address: {
    street: '100 Test Lane',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
  },
  diagnosisCodes: ['E11.9', 'E11.65'],
  conditionCategory: 'diabetes',
  primaryProviderId: null,
  benefitPackageId: null,
  medicareParts: ['part_a', 'part_b', 'part_c', 'part_d'],
  csnpEligible: true,
  createdAt: '2024-01-10T08:30:00.000Z',
  updatedAt: '2024-06-15T14:22:00.000Z',
};

const TEST_MEMBER_2 = {
  id: 'member-test-002',
  firstName: 'John',
  lastName: 'Smith',
  dateOfBirth: '1948-11-20',
  ssn: '***-**-5678',
  ccid: 'H1234-002',
  appin: 'APP-2024-99998',
  medicareId: '2FH5-UF6-NL83',
  gender: 'Male',
  email: 'john.smith@example.com',
  phone: '(555) 999-0002',
  address: {
    street: '200 Test Ave',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601',
  },
  diagnosisCodes: ['I50.22', 'I50.9'],
  conditionCategory: 'heart_failure',
  primaryProviderId: null,
  benefitPackageId: null,
  medicareParts: ['part_a', 'part_b', 'part_c', 'part_d'],
  csnpEligible: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-07-01T09:15:00.000Z',
};

const TEST_BENEFIT_PACKAGE = {
  id: 'bp-test-001',
  name: 'Test CSNP Plan',
  planType: PLAN_TYPES.C_SNP,
  description: 'Test benefit package for unit tests',
  effectiveDate: '2024-01-01',
  terminationDate: '2024-12-31',
  benefits: {
    primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay' },
    specialistVisit: { copay: 20, coinsurance: 0, description: '$20 copay' },
  },
  eligibleConditionCategories: ['diabetes', 'heart_failure'],
  monthlyPremium: 0,
  annualDeductible: 0,
  maxOutOfPocket: 3400,
  createdAt: '2023-10-01T08:00:00.000Z',
  updatedAt: '2023-12-15T10:00:00.000Z',
};

const TEST_BENEFIT_PACKAGE_2 = {
  id: 'bp-test-002',
  name: 'Test CSNP Plan 2',
  planType: PLAN_TYPES.C_SNP,
  description: 'Second test benefit package',
  effectiveDate: '2024-01-01',
  terminationDate: '2024-12-31',
  benefits: {
    primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay' },
  },
  eligibleConditionCategories: ['copd', 'respiratory'],
  monthlyPremium: 15,
  annualDeductible: 0,
  maxOutOfPocket: 3900,
  createdAt: '2023-10-01T08:00:00.000Z',
  updatedAt: '2023-12-15T10:00:00.000Z',
};

describe('enrollmentService', () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuditLogs();
    seedEligibilityRecords();
    seedMembers([TEST_MEMBER, TEST_MEMBER_2]);
    seedBenefitPackages([TEST_BENEFIT_PACKAGE, TEST_BENEFIT_PACKAGE_2]);
  });

  describe('intakeEnrollment', () => {
    it('creates a pending enrollment for a valid member and benefit package', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        notes: 'Test enrollment',
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(true);
      expect(result.enrollmentId).toBeDefined();
      expect(typeof result.enrollmentId).toBe('string');
      expect(result.enrollmentId.length).toBeGreaterThan(0);
      expect(result.status).toBe(ENROLLMENT_STATUSES.PENDING);
      expect(result.timestamp).toBeDefined();
      expect(result.validationErrors).toBeNull();
    });

    it('persists enrollment record to localStorage', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      const stored = getStoredEnrollments();
      expect(stored.length).toBeGreaterThanOrEqual(1);

      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment).toBeDefined();
      expect(enrollment.memberId).toBe(TEST_MEMBER.id);
      expect(enrollment.benefitPackageId).toBe(TEST_BENEFIT_PACKAGE.id);
      expect(enrollment.status).toBe(ENROLLMENT_STATUSES.PENDING);
      expect(enrollment.channel).toBe(ENROLLMENT_CHANNELS.ONLINE);
      expect(enrollment.planType).toBe(PLAN_TYPES.C_SNP);
      expect(enrollment.effectiveDate).toBe('2024-06-01');
      expect(enrollment.applicationDate).toBe('2024-05-01');
    });

    it('returns an auditId when enrollment succeeds', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.auditId).toBeDefined();
      expect(typeof result.auditId).toBe('string');
      expect(result.auditId.length).toBeGreaterThan(0);
    });

    it('returns error when enrollmentData is null', () => {
      const result = intakeEnrollment(null, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
    });

    it('returns error when channel is missing', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
      };

      const result = intakeEnrollment(enrollmentData, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('channel');
    });

    it('returns error when channel is invalid', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
      };

      const result = intakeEnrollment(enrollmentData, 'carrier_pigeon');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid enrollment channel');
    });

    it('returns error when memberId is missing', () => {
      const enrollmentData = {
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when member does not exist', () => {
      const enrollmentData = {
        memberId: 'nonexistent-member',
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Member not found');
    });

    it('returns error when benefitPackageId is missing', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        planType: PLAN_TYPES.C_SNP,
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when benefit package does not exist', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: 'nonexistent-package',
        planType: PLAN_TYPES.C_SNP,
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Benefit package not found');
    });

    it('returns error for invalid effective date format', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: 'not-a-date',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error for duplicate active enrollment', () => {
      seedEnrollments([
        {
          id: 'existing-enrollment-001',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          applicationDate: '2023-11-15',
          createdAt: '2023-11-15T10:00:00.000Z',
          updatedAt: '2023-12-01T14:00:00.000Z',
        },
      ]);

      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already has an active or pending enrollment');
    });

    it('returns error for duplicate pending enrollment', () => {
      seedEnrollments([
        {
          id: 'existing-enrollment-002',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.PENDING,
          channel: ENROLLMENT_CHANNELS.PHONE,
          effectiveDate: '2024-06-01',
          applicationDate: '2024-04-01',
          createdAt: '2024-04-01T10:00:00.000Z',
          updatedAt: '2024-04-01T10:00:00.000Z',
        },
      ]);

      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-07-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already has an active or pending enrollment');
    });

    it('allows enrollment for a different benefit package when no duplicate exists', () => {
      seedEnrollments([
        {
          id: 'existing-enrollment-003',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.REJECTED,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          applicationDate: '2023-11-15',
          createdAt: '2023-11-15T10:00:00.000Z',
          updatedAt: '2023-12-01T14:00:00.000Z',
        },
      ]);

      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(true);
      expect(result.enrollmentId).toBeDefined();
    });
  });

  describe('multi-channel enrollment intake', () => {
    it('accepts enrollment via online channel', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.channel).toBe(ENROLLMENT_CHANNELS.ONLINE);
    });

    it('accepts enrollment via phone channel', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.PHONE);

      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.channel).toBe(ENROLLMENT_CHANNELS.PHONE);
    });

    it('accepts enrollment via mail channel', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.MAIL);

      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.channel).toBe(ENROLLMENT_CHANNELS.MAIL);
    });

    it('accepts enrollment via in_person channel', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.IN_PERSON);

      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.channel).toBe(ENROLLMENT_CHANNELS.IN_PERSON);
    });

    it('accepts enrollment via broker channel', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.BROKER);

      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.channel).toBe(ENROLLMENT_CHANNELS.BROKER);
    });

    it('accepts enrollment via transfer channel', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.TRANSFER);

      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.channel).toBe(ENROLLMENT_CHANNELS.TRANSFER);
    });
  });

  describe('submitEnrollment', () => {
    it('processes a pending enrollment through the full workflow', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      const submitResult = submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      expect(submitResult.enrollmentId).toBe(intakeResult.enrollmentId);
      expect(submitResult.timestamp).toBeDefined();
    });

    it('returns error when enrollmentId is empty', () => {
      const result = submitEnrollment('', { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment ID is required');
    });

    it('returns error when enrollment does not exist', () => {
      const result = submitEnrollment('nonexistent-enrollment', { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment not found');
    });

    it('returns error when enrollment is not in pending status', () => {
      seedEnrollments([
        {
          id: 'active-enrollment-001',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          applicationDate: '2023-11-15',
          diagnosisCodesVerified: ['E11.9'],
          documents: [],
          createdAt: '2023-11-15T10:00:00.000Z',
          updatedAt: '2023-12-01T14:00:00.000Z',
        },
      ]);

      const result = submitEnrollment('active-enrollment-001', { performedBy: 'user-001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('pending');
    });

    it('updates enrollment status after successful submission with TRR acceptance', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      const submitResult = submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      // With valid diagnosis codes, TRR should accept
      if (submitResult.trrResult && submitResult.trrResult.accepted) {
        expect(submitResult.status).toBe(ENROLLMENT_STATUSES.APPROVED);
      }

      // Verify the stored enrollment was updated
      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment).toBeDefined();
      expect(enrollment.status).not.toBe(ENROLLMENT_STATUSES.PENDING);
    });

    it('includes IKA submission result when not skipped', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      const submitResult = submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      expect(submitResult.ikaResult).toBeDefined();
      if (submitResult.ikaResult) {
        expect(submitResult.ikaResult.success).toBe(true);
        expect(submitResult.ikaResult.transactionId).toBeDefined();
      }
    });

    it('includes TRR response result when IKA submission succeeds', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      const submitResult = submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      expect(submitResult.trrResult).toBeDefined();
      if (submitResult.trrResult) {
        expect(typeof submitResult.trrResult.accepted).toBe('boolean');
        expect(submitResult.trrResult.responseCode).toBeDefined();
        expect(submitResult.trrResult.responseMessage).toBeDefined();
      }
    });

    it('skips VCC validation when skipVCC option is true', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      const submitResult = submitEnrollment(intakeResult.enrollmentId, {
        performedBy: 'user-001',
        skipVCC: true,
      });

      expect(submitResult.vccResult).toBeNull();
    });

    it('skips IKA submission and auto-approves when skipIKA option is true', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      const submitResult = submitEnrollment(intakeResult.enrollmentId, {
        performedBy: 'user-001',
        skipIKA: true,
      });

      expect(submitResult.ikaResult).toBeNull();
      expect(submitResult.trrResult).toBeNull();
      expect(submitResult.status).toBe(ENROLLMENT_STATUSES.APPROVED);
    });
  });

  describe('processDocuments', () => {
    it('processes documents and returns VCC validation results', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      const documents = [
        { name: 'enrollment_form.pdf', type: 'enrollment_form' },
        { name: 'diagnosis_verification.pdf', type: 'diagnosis_verification' },
      ];

      const docResult = processDocuments(intakeResult.enrollmentId, documents, { performedBy: 'user-001' });

      expect(docResult.enrollmentId).toBe(intakeResult.enrollmentId);
      expect(docResult.processedDocuments).toBeDefined();
      expect(Array.isArray(docResult.processedDocuments)).toBe(true);
      expect(docResult.processedDocuments.length).toBe(2);
      expect(docResult.validDocuments).toBeDefined();
      expect(docResult.invalidDocuments).toBeDefined();
      expect(docResult.timestamp).toBeDefined();
    });

    it('returns error when enrollmentId is empty', () => {
      const result = processDocuments('', [{ name: 'test.pdf', type: 'enrollment_form' }]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment ID is required');
    });

    it('returns error when enrollment does not exist', () => {
      const result = processDocuments('nonexistent', [{ name: 'test.pdf', type: 'enrollment_form' }]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment not found');
    });

    it('returns error when documents array is empty', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      const result = processDocuments(intakeResult.enrollmentId, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one document is required');
    });

    it('validates documents with recognized types as valid', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      const documents = [
        { name: 'enrollment_form.pdf', type: 'enrollment_form' },
        { name: 'medical_record.pdf', type: 'medical_record' },
        { name: 'consent_form.pdf', type: 'consent_form' },
      ];

      const docResult = processDocuments(intakeResult.enrollmentId, documents, { performedBy: 'user-001' });

      expect(docResult.success).toBe(true);
      expect(docResult.validDocuments.length).toBe(3);
      expect(docResult.invalidDocuments.length).toBe(0);
    });

    it('updates enrollment record with document results', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      const documents = [
        { name: 'enrollment_form.pdf', type: 'enrollment_form' },
      ];

      processDocuments(intakeResult.enrollmentId, documents, { performedBy: 'user-001' });

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment).toBeDefined();
      expect(enrollment.documents).toBeDefined();
      expect(enrollment.documents.length).toBeGreaterThanOrEqual(1);
      expect(enrollment.vccValidation).toBeDefined();
    });
  });

  describe('approveEnrollment', () => {
    it('approves a pending enrollment and sets status to active', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      const approveResult = approveEnrollment(intakeResult.enrollmentId, 'user-001');

      expect(approveResult.success).toBe(true);
      expect(approveResult.enrollmentId).toBe(intakeResult.enrollmentId);
      expect(approveResult.status).toBe(ENROLLMENT_STATUSES.ACTIVE);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment.status).toBe(ENROLLMENT_STATUSES.ACTIVE);
      expect(enrollment.approvalDate).toBeDefined();
    });

    it('returns error when enrollmentId is empty', () => {
      const result = approveEnrollment('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment ID is required');
    });

    it('returns error when enrollment does not exist', () => {
      const result = approveEnrollment('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment not found');
    });

    it('approves an already approved enrollment (transitions to active)', () => {
      seedEnrollments([
        {
          id: 'approved-enrollment-001',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.APPROVED,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-06-01',
          applicationDate: '2024-05-01',
          createdAt: '2024-05-01T10:00:00.000Z',
          updatedAt: '2024-05-15T10:00:00.000Z',
        },
      ]);

      const result = approveEnrollment('approved-enrollment-001', 'user-001');

      expect(result.success).toBe(true);
      expect(result.status).toBe(ENROLLMENT_STATUSES.ACTIVE);
    });
  });

  describe('rejectEnrollment', () => {
    it('rejects a pending enrollment with a reason', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      const rejectResult = rejectEnrollment(intakeResult.enrollmentId, 'Insufficient documentation', 'user-001');

      expect(rejectResult.success).toBe(true);
      expect(rejectResult.enrollmentId).toBe(intakeResult.enrollmentId);
      expect(rejectResult.status).toBe(ENROLLMENT_STATUSES.REJECTED);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment.status).toBe(ENROLLMENT_STATUSES.REJECTED);
      expect(enrollment.notes).toContain('Insufficient documentation');
    });

    it('returns error when enrollmentId is empty', () => {
      const result = rejectEnrollment('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment ID is required');
    });

    it('returns error when enrollment does not exist', () => {
      const result = rejectEnrollment('nonexistent', 'reason');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment not found');
    });

    it('returns error when trying to reject an active enrollment', () => {
      seedEnrollments([
        {
          id: 'active-enrollment-002',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          applicationDate: '2023-11-15',
          notes: '',
          createdAt: '2023-11-15T10:00:00.000Z',
          updatedAt: '2023-12-01T14:00:00.000Z',
        },
      ]);

      const result = rejectEnrollment('active-enrollment-002', 'reason', 'user-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('disenrollment');
    });
  });

  describe('cancelEnrollment', () => {
    it('cancels a pending enrollment with a reason', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      const cancelResult = cancelEnrollment(intakeResult.enrollmentId, 'Member requested cancellation', 'user-001');

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.enrollmentId).toBe(intakeResult.enrollmentId);
      expect(cancelResult.status).toBe(ENROLLMENT_STATUSES.CANCELLED);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment.status).toBe(ENROLLMENT_STATUSES.CANCELLED);
      expect(enrollment.notes).toContain('Member requested cancellation');
    });

    it('returns error when enrollmentId is empty', () => {
      const result = cancelEnrollment('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment ID is required');
    });

    it('returns error when enrollment does not exist', () => {
      const result = cancelEnrollment('nonexistent', 'reason');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment not found');
    });

    it('returns error when trying to cancel an active enrollment', () => {
      seedEnrollments([
        {
          id: 'active-enrollment-003',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          applicationDate: '2023-11-15',
          notes: '',
          createdAt: '2023-11-15T10:00:00.000Z',
          updatedAt: '2023-12-01T14:00:00.000Z',
        },
      ]);

      const result = cancelEnrollment('active-enrollment-003', 'reason', 'user-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be cancelled');
    });

    it('cancels an approved enrollment', () => {
      seedEnrollments([
        {
          id: 'approved-enrollment-002',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.APPROVED,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-06-01',
          applicationDate: '2024-05-01',
          notes: '',
          createdAt: '2024-05-01T10:00:00.000Z',
          updatedAt: '2024-05-15T10:00:00.000Z',
        },
      ]);

      const result = cancelEnrollment('approved-enrollment-002', 'Changed mind', 'user-001');

      expect(result.success).toBe(true);
      expect(result.status).toBe(ENROLLMENT_STATUSES.CANCELLED);
    });
  });

  describe('disenrollMember', () => {
    it('disenrolls a member from an active enrollment', () => {
      seedEnrollments([
        {
          id: 'active-enrollment-004',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          applicationDate: '2023-11-15',
          notes: '',
          createdAt: '2023-11-15T10:00:00.000Z',
          updatedAt: '2023-12-01T14:00:00.000Z',
        },
      ]);

      const result = disenrollMember('active-enrollment-004', 'Member moved out of service area', '2024-07-01', 'user-001');

      expect(result.success).toBe(true);
      expect(result.enrollmentId).toBe('active-enrollment-004');
      expect(result.status).toBe(ENROLLMENT_STATUSES.DISENROLLED);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === 'active-enrollment-004');
      expect(enrollment.status).toBe(ENROLLMENT_STATUSES.DISENROLLED);
      expect(enrollment.terminationDate).toBe('2024-07-01');
      expect(enrollment.notes).toContain('Member moved out of service area');
    });

    it('disenrolls a member from an approved enrollment', () => {
      seedEnrollments([
        {
          id: 'approved-enrollment-003',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.APPROVED,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-06-01',
          applicationDate: '2024-05-01',
          notes: '',
          createdAt: '2024-05-01T10:00:00.000Z',
          updatedAt: '2024-05-15T10:00:00.000Z',
        },
      ]);

      const result = disenrollMember('approved-enrollment-003', 'Voluntary disenrollment', null, 'user-001');

      expect(result.success).toBe(true);
      expect(result.status).toBe(ENROLLMENT_STATUSES.DISENROLLED);
    });

    it('returns error when enrollmentId is empty', () => {
      const result = disenrollMember('', 'reason', '2024-07-01');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment ID is required');
    });

    it('returns error when enrollment does not exist', () => {
      const result = disenrollMember('nonexistent', 'reason', '2024-07-01');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enrollment not found');
    });

    it('returns error when trying to disenroll a pending enrollment', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      const result = disenrollMember(intakeResult.enrollmentId, 'reason', '2024-07-01', 'user-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only active or approved');
    });

    it('returns error for invalid termination date format', () => {
      seedEnrollments([
        {
          id: 'active-enrollment-005',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          applicationDate: '2023-11-15',
          notes: '',
          createdAt: '2023-11-15T10:00:00.000Z',
          updatedAt: '2023-12-01T14:00:00.000Z',
        },
      ]);

      const result = disenrollMember('active-enrollment-005', 'reason', 'not-a-date', 'user-001');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('uses today as default termination date when not provided', () => {
      seedEnrollments([
        {
          id: 'active-enrollment-006',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          applicationDate: '2023-11-15',
          notes: '',
          createdAt: '2023-11-15T10:00:00.000Z',
          updatedAt: '2023-12-01T14:00:00.000Z',
        },
      ]);

      const result = disenrollMember('active-enrollment-006', 'reason', null, 'user-001');

      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === 'active-enrollment-006');
      expect(enrollment.terminationDate).toBeDefined();
      expect(enrollment.terminationDate.length).toBe(10); // YYYY-MM-DD format
    });
  });

  describe('getEnrollment', () => {
    it('returns empty array for unknown member', () => {
      const enrollments = getEnrollment('nonexistent-member');
      expect(enrollments).toEqual([]);
    });

    it('returns empty array for empty member ID', () => {
      const enrollments = getEnrollment('');
      expect(enrollments).toEqual([]);
    });

    it('returns enrollments for a specific member sorted by creation date descending', () => {
      seedEnrollments([
        {
          id: 'enroll-a',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.REJECTED,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'enroll-b',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.PHONE,
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
        {
          id: 'enroll-c',
          memberId: TEST_MEMBER_2.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.MAIL,
          createdAt: '2024-03-01T10:00:00.000Z',
          updatedAt: '2024-03-01T10:00:00.000Z',
        },
      ]);

      const enrollments = getEnrollment(TEST_MEMBER.id);

      expect(enrollments).toHaveLength(2);
      expect(enrollments[0].id).toBe('enroll-b'); // Most recent
      expect(enrollments[1].id).toBe('enroll-a'); // Oldest
    });

    it('only returns enrollments for the specified member', () => {
      seedEnrollments([
        {
          id: 'enroll-d',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'enroll-e',
          memberId: TEST_MEMBER_2.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.PENDING,
          channel: ENROLLMENT_CHANNELS.PHONE,
          createdAt: '2024-02-01T10:00:00.000Z',
          updatedAt: '2024-02-01T10:00:00.000Z',
        },
      ]);

      const enrollments = getEnrollment(TEST_MEMBER_2.id);

      expect(enrollments).toHaveLength(1);
      expect(enrollments[0].memberId).toBe(TEST_MEMBER_2.id);
    });
  });

  describe('getEnrollmentById', () => {
    it('returns null for empty enrollment ID', () => {
      const enrollment = getEnrollmentById('');
      expect(enrollment).toBeNull();
    });

    it('returns null for nonexistent enrollment', () => {
      const enrollment = getEnrollmentById('nonexistent');
      expect(enrollment).toBeNull();
    });

    it('returns the enrollment record for a valid ID', () => {
      seedEnrollments([
        {
          id: 'enroll-f',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          applicationDate: '2023-11-15',
          createdAt: '2023-11-15T10:00:00.000Z',
          updatedAt: '2023-12-01T14:00:00.000Z',
        },
      ]);

      const enrollment = getEnrollmentById('enroll-f');

      expect(enrollment).not.toBeNull();
      expect(enrollment.id).toBe('enroll-f');
      expect(enrollment.memberId).toBe(TEST_MEMBER.id);
      expect(enrollment.status).toBe(ENROLLMENT_STATUSES.ACTIVE);
    });
  });

  describe('getAllEnrollmentRecords', () => {
    it('returns empty array when no enrollments exist', () => {
      const records = getAllEnrollmentRecords();
      expect(records).toEqual([]);
    });

    it('returns all stored enrollment records', () => {
      seedEnrollments([
        {
          id: 'enroll-g',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.ACTIVE,
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'enroll-h',
          memberId: TEST_MEMBER_2.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.PENDING,
          createdAt: '2024-02-01T10:00:00.000Z',
          updatedAt: '2024-02-01T10:00:00.000Z',
        },
      ]);

      const records = getAllEnrollmentRecords();
      expect(records).toHaveLength(2);
    });
  });

  describe('getEnrollmentsByStatus', () => {
    it('returns empty array for empty status', () => {
      const enrollments = getEnrollmentsByStatus('');
      expect(enrollments).toEqual([]);
    });

    it('returns enrollments filtered by status', () => {
      seedEnrollments([
        {
          id: 'enroll-i',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.ACTIVE,
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'enroll-j',
          memberId: TEST_MEMBER_2.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.PENDING,
          createdAt: '2024-02-01T10:00:00.000Z',
          updatedAt: '2024-02-01T10:00:00.000Z',
        },
        {
          id: 'enroll-k',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_2.id,
          status: ENROLLMENT_STATUSES.ACTIVE,
          createdAt: '2024-03-01T10:00:00.000Z',
          updatedAt: '2024-03-01T10:00:00.000Z',
        },
      ]);

      const activeEnrollments = getEnrollmentsByStatus(ENROLLMENT_STATUSES.ACTIVE);
      expect(activeEnrollments).toHaveLength(2);
      expect(activeEnrollments.every((e) => e.status === ENROLLMENT_STATUSES.ACTIVE)).toBe(true);

      const pendingEnrollments = getEnrollmentsByStatus(ENROLLMENT_STATUSES.PENDING);
      expect(pendingEnrollments).toHaveLength(1);
      expect(pendingEnrollments[0].status).toBe(ENROLLMENT_STATUSES.PENDING);
    });
  });

  describe('getEnrollmentsByChannel', () => {
    it('returns empty array for empty channel', () => {
      const enrollments = getEnrollmentsByChannel('');
      expect(enrollments).toEqual([]);
    });

    it('returns enrollments filtered by channel', () => {
      seedEnrollments([
        {
          id: 'enroll-l',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'enroll-m',
          memberId: TEST_MEMBER_2.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.PENDING,
          channel: ENROLLMENT_CHANNELS.PHONE,
          createdAt: '2024-02-01T10:00:00.000Z',
          updatedAt: '2024-02-01T10:00:00.000Z',
        },
        {
          id: 'enroll-n',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_2.id,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          createdAt: '2024-03-01T10:00:00.000Z',
          updatedAt: '2024-03-01T10:00:00.000Z',
        },
      ]);

      const onlineEnrollments = getEnrollmentsByChannel(ENROLLMENT_CHANNELS.ONLINE);
      expect(onlineEnrollments).toHaveLength(2);
      expect(onlineEnrollments.every((e) => e.channel === ENROLLMENT_CHANNELS.ONLINE)).toBe(true);

      const phoneEnrollments = getEnrollmentsByChannel(ENROLLMENT_CHANNELS.PHONE);
      expect(phoneEnrollments).toHaveLength(1);
      expect(phoneEnrollments[0].channel).toBe(ENROLLMENT_CHANNELS.PHONE);
    });
  });

  describe('getEnrollmentStats', () => {
    it('returns zero counts when no enrollments exist', () => {
      const stats = getEnrollmentStats();

      expect(stats.total).toBe(0);
      expect(stats.byStatus).toEqual({});
      expect(stats.byChannel).toEqual({});
      expect(stats.byPlanType).toEqual({});
    });

    it('returns correct counts for mixed enrollments', () => {
      seedEnrollments([
        {
          id: 'stat-1',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'stat-2',
          memberId: TEST_MEMBER_2.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.PENDING,
          channel: ENROLLMENT_CHANNELS.PHONE,
          createdAt: '2024-02-01T10:00:00.000Z',
          updatedAt: '2024-02-01T10:00:00.000Z',
        },
        {
          id: 'stat-3',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE_2.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.REJECTED,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          createdAt: '2024-03-01T10:00:00.000Z',
          updatedAt: '2024-03-01T10:00:00.000Z',
        },
        {
          id: 'stat-4',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.DISENROLLED,
          channel: ENROLLMENT_CHANNELS.MAIL,
          createdAt: '2024-04-01T10:00:00.000Z',
          updatedAt: '2024-04-01T10:00:00.000Z',
        },
      ]);

      const stats = getEnrollmentStats();

      expect(stats.total).toBe(4);
      expect(stats.byStatus[ENROLLMENT_STATUSES.ACTIVE]).toBe(1);
      expect(stats.byStatus[ENROLLMENT_STATUSES.PENDING]).toBe(1);
      expect(stats.byStatus[ENROLLMENT_STATUSES.REJECTED]).toBe(1);
      expect(stats.byStatus[ENROLLMENT_STATUSES.DISENROLLED]).toBe(1);
      expect(stats.byChannel[ENROLLMENT_CHANNELS.ONLINE]).toBe(2);
      expect(stats.byChannel[ENROLLMENT_CHANNELS.PHONE]).toBe(1);
      expect(stats.byChannel[ENROLLMENT_CHANNELS.MAIL]).toBe(1);
      expect(stats.byPlanType[PLAN_TYPES.C_SNP]).toBe(4);
    });
  });

  describe('hasActiveEnrollment', () => {
    it('returns hasActive=false for empty member ID', () => {
      const result = hasActiveEnrollment('');
      expect(result.hasActive).toBe(false);
      expect(result.enrollment).toBeNull();
    });

    it('returns hasActive=false when no enrollments exist', () => {
      const result = hasActiveEnrollment(TEST_MEMBER.id);
      expect(result.hasActive).toBe(false);
      expect(result.enrollment).toBeNull();
    });

    it('returns hasActive=true when member has an active enrollment', () => {
      seedEnrollments([
        {
          id: 'active-check-001',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.ACTIVE,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-01-01',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
      ]);

      const result = hasActiveEnrollment(TEST_MEMBER.id);
      expect(result.hasActive).toBe(true);
      expect(result.enrollment).not.toBeNull();
      expect(result.enrollment.id).toBe('active-check-001');
    });

    it('returns hasActive=false when member only has pending enrollment', () => {
      seedEnrollments([
        {
          id: 'pending-check-001',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.PENDING,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-06-01',
          createdAt: '2024-05-01T10:00:00.000Z',
          updatedAt: '2024-05-01T10:00:00.000Z',
        },
      ]);

      const result = hasActiveEnrollment(TEST_MEMBER.id);
      expect(result.hasActive).toBe(false);
      expect(result.enrollment).toBeNull();
    });

    it('returns hasActive=false when member only has rejected enrollment', () => {
      seedEnrollments([
        {
          id: 'rejected-check-001',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          status: ENROLLMENT_STATUSES.REJECTED,
          channel: ENROLLMENT_CHANNELS.ONLINE,
          effectiveDate: '2024-06-01',
          createdAt: '2024-05-01T10:00:00.000Z',
          updatedAt: '2024-05-01T10:00:00.000Z',
        },
      ]);

      const result = hasActiveEnrollment(TEST_MEMBER.id);
      expect(result.hasActive).toBe(false);
      expect(result.enrollment).toBeNull();
    });
  });

  describe('updateEnrollmentNotes', () => {
    it('appends notes to an existing enrollment', () => {
      seedEnrollments([
        {
          id: 'notes-001',
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          status: ENROLLMENT_STATUSES.ACTIVE,
          notes: 'Initial note',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
      ]);

      const result = updateEnrollmentNotes('notes-001', 'Additional note added', 'user-001');

      expect(result).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === 'notes-001');
      expect(enrollment.notes).toContain('Initial note');
      expect(enrollment.notes).toContain('Additional note added');
    });

    it('returns false for empty enrollment ID', () => {
      const result = updateEnrollmentNotes('', 'note');
      expect(result).toBe(false);
    });

    it('returns false for empty notes', () => {
      const result = updateEnrollmentNotes('notes-001', '');
      expect(result).toBe(false);
    });

    it('returns false when enrollment does not exist', () => {
      const result = updateEnrollmentNotes('nonexistent', 'note');
      expect(result).toBe(false);
    });
  });

  describe('batchIntakeEnrollments', () => {
    it('returns empty result for empty input', () => {
      const result = batchIntakeEnrollments([], ENROLLMENT_CHANNELS.ONLINE);

      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('processes multiple enrollments in batch', () => {
      const enrollmentDataArray = [
        {
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          effectiveDate: '2024-06-01',
          applicationDate: '2024-05-01',
          diagnosisCodesVerified: ['E11.9'],
        },
        {
          memberId: TEST_MEMBER_2.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          effectiveDate: '2024-06-01',
          applicationDate: '2024-05-01',
          diagnosisCodesVerified: ['I50.22'],
        },
      ];

      const result = batchIntakeEnrollments(enrollmentDataArray, ENROLLMENT_CHANNELS.ONLINE, 'user-001');

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    it('handles mixed success and failure in batch', () => {
      const enrollmentDataArray = [
        {
          memberId: TEST_MEMBER.id,
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          effectiveDate: '2024-06-01',
          applicationDate: '2024-05-01',
          diagnosisCodesVerified: ['E11.9'],
        },
        {
          memberId: 'nonexistent-member',
          benefitPackageId: TEST_BENEFIT_PACKAGE.id,
          planType: PLAN_TYPES.C_SNP,
          effectiveDate: '2024-06-01',
          applicationDate: '2024-05-01',
          diagnosisCodesVerified: ['I50.22'],
        },
      ];

      const result = batchIntakeEnrollments(enrollmentDataArray, ENROLLMENT_CHANNELS.ONLINE, 'user-001');

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe('enrollment persistence and data enrichment', () => {
    it('stores diagnosis codes verified on the enrollment record', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9', 'E11.65'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.diagnosisCodesVerified).toBeDefined();
      expect(enrollment.diagnosisCodesVerified).toContain('E11.9');
      expect(enrollment.diagnosisCodesVerified).toContain('E11.65');
    });

    it('stores notes on the enrollment record', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        notes: 'Test enrollment notes for persistence check',
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.notes).toContain('Test enrollment notes for persistence check');
    });

    it('stores processedBy on the enrollment record', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-test-processor',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.processedBy).toBe('user-test-processor');
    });

    it('stores createdAt and updatedAt timestamps', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.createdAt).toBeDefined();
      expect(enrollment.updatedAt).toBeDefined();
      expect(typeof enrollment.createdAt).toBe('string');
      expect(typeof enrollment.updatedAt).toBe('string');
    });

    it('generates an APPIN for the enrollment', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.appin).toBeDefined();
      expect(typeof enrollment.appin).toBe('string');
      expect(enrollment.appin.startsWith('APP-')).toBe(true);
    });

    it('initializes VCC, ICoE, IKA, and TRR fields as null on intake', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.vccValidation).toBeNull();
      expect(enrollment.icoeEnrichment).toBeNull();
      expect(enrollment.ikaSubmission).toBeNull();
      expect(enrollment.trrResponse).toBeNull();
    });

    it('populates IKA and TRR fields after submission', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment.ikaSubmission).not.toBeNull();
      expect(enrollment.trrResponse).not.toBeNull();
    });

    it('populates ICoE enrichment data after submission', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment.icoeEnrichment).not.toBeNull();
      if (enrollment.icoeEnrichment) {
        expect(enrollment.icoeEnrichment.success).toBe(true);
        expect(enrollment.icoeEnrichment.enrichedFields).toBeDefined();
        expect(Array.isArray(enrollment.icoeEnrichment.enrichedFields)).toBe(true);
      }
    });
  });

  describe('CMS submission and TRR processing', () => {
    it('TRR accepts enrollment with valid diagnosis codes', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9', 'E11.65'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      const submitResult = submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      expect(submitResult.trrResult).toBeDefined();
      if (submitResult.trrResult) {
        expect(submitResult.trrResult.accepted).toBe(true);
        expect(submitResult.trrResult.responseCode).toBe('TRR-ACC-000');
      }
      expect(submitResult.status).toBe(ENROLLMENT_STATUSES.APPROVED);
    });

    it('TRR rejects enrollment without diagnosis codes', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: [],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      const submitResult = submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      expect(submitResult.trrResult).toBeDefined();
      if (submitResult.trrResult) {
        expect(submitResult.trrResult.accepted).toBe(false);
        expect(submitResult.trrResult.responseCode).toBe('TRR-REJ-002');
      }
      expect(submitResult.status).toBe(ENROLLMENT_STATUSES.REJECTED);
    });

    it('IKA submission generates a CMS transaction ID', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      const submitResult = submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      expect(submitResult.ikaResult).toBeDefined();
      if (submitResult.ikaResult) {
        expect(submitResult.ikaResult.transactionId).toBeDefined();
        expect(typeof submitResult.ikaResult.transactionId).toBe('string');
        expect(submitResult.ikaResult.transactionId.startsWith('CMS-TXN-')).toBe(true);
      }
    });

    it('sets approval date when enrollment is approved', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      const submitResult = submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      if (submitResult.status === ENROLLMENT_STATUSES.APPROVED) {
        const stored = getStoredEnrollments();
        const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
        expect(enrollment.approvalDate).toBeDefined();
        expect(typeof enrollment.approvalDate).toBe('string');
        expect(enrollment.approvalDate.length).toBe(10); // YYYY-MM-DD
      }
    });

    it('does not set approval date when enrollment is rejected', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: [],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      const submitResult = submitEnrollment(intakeResult.enrollmentId, { performedBy: 'user-001' });

      if (submitResult.status === ENROLLMENT_STATUSES.REJECTED) {
        const stored = getStoredEnrollments();
        const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
        expect(enrollment.approvalDate).toBeNull();
      }
    });
  });

  describe('enrollment lifecycle', () => {
    it('supports full lifecycle: intake -> submit -> approve -> disenroll', () => {
      // Step 1: Intake
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);
      expect(intakeResult.status).toBe(ENROLLMENT_STATUSES.PENDING);

      // Step 2: Submit (with skipIKA to auto-approve)
      const submitResult = submitEnrollment(intakeResult.enrollmentId, {
        performedBy: 'user-001',
        skipIKA: true,
      });
      expect(submitResult.status).toBe(ENROLLMENT_STATUSES.APPROVED);

      // Step 3: Approve (activate)
      const approveResult = approveEnrollment(intakeResult.enrollmentId, 'user-001');
      expect(approveResult.success).toBe(true);
      expect(approveResult.status).toBe(ENROLLMENT_STATUSES.ACTIVE);

      // Step 4: Disenroll
      const disenrollResult = disenrollMember(intakeResult.enrollmentId, 'Member relocated', '2024-12-31', 'user-001');
      expect(disenrollResult.success).toBe(true);
      expect(disenrollResult.status).toBe(ENROLLMENT_STATUSES.DISENROLLED);

      // Verify final state
      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment.status).toBe(ENROLLMENT_STATUSES.DISENROLLED);
      expect(enrollment.terminationDate).toBe('2024-12-31');
    });

    it('supports lifecycle: intake -> reject', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      const rejectResult = rejectEnrollment(intakeResult.enrollmentId, 'Failed eligibility check', 'user-001');
      expect(rejectResult.success).toBe(true);
      expect(rejectResult.status).toBe(ENROLLMENT_STATUSES.REJECTED);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment.status).toBe(ENROLLMENT_STATUSES.REJECTED);
    });

    it('supports lifecycle: intake -> cancel', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const intakeResult = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(intakeResult.success).toBe(true);

      const cancelResult = cancelEnrollment(intakeResult.enrollmentId, 'Member withdrew application', 'user-001');
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.status).toBe(ENROLLMENT_STATUSES.CANCELLED);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === intakeResult.enrollmentId);
      expect(enrollment.status).toBe(ENROLLMENT_STATUSES.CANCELLED);
    });
  });

  describe('diagnosis code handling in enrollment', () => {
    it('normalizes diagnosis codes to uppercase', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['e11.9', 'e11.65'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.diagnosisCodesVerified).toContain('E11.9');
      expect(enrollment.diagnosisCodesVerified).toContain('E11.65');
    });

    it('handles enrollment with no diagnosis codes', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: [],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);

      // Should still succeed at intake (validation happens at submission)
      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      expect(enrollment.diagnosisCodesVerified).toEqual([]);
    });

    it('stores eligibility result when diagnosis codes are provided', () => {
      const enrollmentData = {
        memberId: TEST_MEMBER.id,
        benefitPackageId: TEST_BENEFIT_PACKAGE.id,
        planType: PLAN_TYPES.C_SNP,
        effectiveDate: '2024-06-01',
        applicationDate: '2024-05-01',
        diagnosisCodesVerified: ['E11.9'],
        processedBy: 'user-001',
      };

      const result = intakeEnrollment(enrollmentData, ENROLLMENT_CHANNELS.ONLINE);
      expect(result.success).toBe(true);

      const stored = getStoredEnrollments();
      const enrollment = stored.find((e) => e.id === result.enrollmentId);
      // eligibilityResult may or may not be populated depending on rule engine
      // but the field should exist
      expect('eligibilityResult' in enrollment).toBe(true);
    });
  });
});