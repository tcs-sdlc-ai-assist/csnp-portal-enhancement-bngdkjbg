import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateEligibility,
  getEligibilityHistory,
  getLatestEligibility,
  isCurrentlyEligible,
  checkAnnualReverification,
  validateMemberEligibility,
  updateEligibilityStatus,
  getEligibilityStats,
  getAllEligibilityRecords,
  getSuggestedRelatedCodes,
  batchCheckEligibility,
} from '../eligibilityService.js';

/**
 * Helper to set up localStorage with seed members.
 * @param {Object[]} members - Array of member objects
 */
function seedMembers(members) {
  localStorage.setItem('csnp_members', JSON.stringify(members));
}

/**
 * Helper to set up localStorage with eligibility records.
 * @param {Object[]} records - Array of eligibility record objects
 */
function seedEligibilityRecords(records) {
  localStorage.setItem('csnp_eligibility_records', JSON.stringify(records));
}

/**
 * Helper to get eligibility records from localStorage.
 * @returns {Object[]}
 */
function getStoredEligibilityRecords() {
  const raw = localStorage.getItem('csnp_eligibility_records');
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

describe('eligibilityService', () => {
  beforeEach(() => {
    localStorage.clear();
    seedAuditLogs();
  });

  describe('validateEligibility', () => {
    it('returns eligible=true for a valid CSNP-eligible ICD-10 code', () => {
      const memberData = {
        memberId: 'member-001',
        effectiveDate: '2024-01-01',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.eligible).toBe(true);
      expect(result.priorityCondition).toBe('E11.9');
      expect(result.priorityCategory).toBe('diabetes');
      expect(result.priorityCategoryLabel).toBe('Diabetes Mellitus');
      expect(result.validationDetails.validCodes).toContain('E11.9');
      expect(result.validationDetails.invalidCodes).toHaveLength(0);
      expect(result.validationDetails.ineligibleCodes).toHaveLength(0);
      expect(result.timestamp).toBeDefined();
    });

    it('returns eligible=false when no CSNP-eligible codes are provided', () => {
      const memberData = {
        memberId: 'member-002',
        performedBy: 'user-001',
      };

      // I10 (Essential hypertension) is in the dataset but NOT csnpEligible
      const result = validateEligibility(memberData, ['I10']);

      expect(result.eligible).toBe(false);
      expect(result.priorityCondition).toBeNull();
      expect(result.validationDetails.validCodes).toHaveLength(0);
      expect(result.validationDetails.ineligibleCodes).toContain('I10');
    });

    it('returns eligible=false when all codes are unrecognized', () => {
      const memberData = {
        memberId: 'member-003',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['ZZZZZ', 'XXXXX']);

      expect(result.eligible).toBe(false);
      expect(result.priorityCondition).toBeNull();
      expect(result.validationDetails.invalidCodes).toContain('ZZZZZ');
      expect(result.validationDetails.invalidCodes).toContain('XXXXX');
      expect(result.validationDetails.validCodes).toHaveLength(0);
    });

    it('returns eligible=false when empty codes array is provided', () => {
      const memberData = {
        memberId: 'member-004',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, []);

      expect(result.eligible).toBe(false);
      expect(result.priorityCondition).toBeNull();
    });

    it('returns default result when memberData is null', () => {
      const result = validateEligibility(null, ['E11.9']);

      expect(result.eligible).toBe(false);
      expect(result.priorityCondition).toBeNull();
    });

    it('returns default result when memberId is missing', () => {
      const result = validateEligibility({ performedBy: 'user-001' }, ['E11.9']);

      expect(result.eligible).toBe(false);
    });

    it('returns default result when icd10Codes is not an array', () => {
      const memberData = {
        memberId: 'member-005',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, 'E11.9');

      expect(result.eligible).toBe(false);
    });

    it('classifies codes correctly into valid, invalid, and ineligible', () => {
      const memberData = {
        memberId: 'member-006',
        performedBy: 'user-001',
      };

      // E11.9 = valid CSNP-eligible, I10 = valid but not CSNP-eligible, ZZZZZ = invalid
      const result = validateEligibility(memberData, ['E11.9', 'I10', 'ZZZZZ']);

      expect(result.eligible).toBe(true);
      expect(result.validationDetails.validCodes).toContain('E11.9');
      expect(result.validationDetails.ineligibleCodes).toContain('I10');
      expect(result.validationDetails.invalidCodes).toContain('ZZZZZ');
    });

    it('handles empty string codes as invalid', () => {
      const memberData = {
        memberId: 'member-007',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['', 'E11.9']);

      expect(result.eligible).toBe(true);
      expect(result.validationDetails.invalidCodes).toContain('');
      expect(result.validationDetails.validCodes).toContain('E11.9');
    });

    it('handles non-string codes as invalid', () => {
      const memberData = {
        memberId: 'member-008',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, [null, undefined, 123, 'E11.9']);

      expect(result.eligible).toBe(true);
      expect(result.validationDetails.validCodes).toContain('E11.9');
      // null, undefined, 123 should be treated as invalid
      expect(result.validationDetails.invalidCodes.length).toBeGreaterThanOrEqual(3);
    });

    it('normalizes codes to uppercase', () => {
      const memberData = {
        memberId: 'member-009',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['e11.9']);

      expect(result.eligible).toBe(true);
      expect(result.validationDetails.validCodes).toContain('E11.9');
    });

    it('persists eligibility record to localStorage', () => {
      const memberData = {
        memberId: 'member-010',
        performedBy: 'user-001',
      };

      validateEligibility(memberData, ['E11.9']);

      const records = getStoredEligibilityRecords();
      expect(records.length).toBeGreaterThanOrEqual(1);

      const record = records.find((r) => r.memberId === 'member-010');
      expect(record).toBeDefined();
      expect(record.eligible).toBe(true);
      expect(record.priorityCondition).toBe('E11.9');
      expect(record.status).toBe('eligible');
    });

    it('persists ineligible record to localStorage', () => {
      const memberData = {
        memberId: 'member-011',
        performedBy: 'user-001',
      };

      validateEligibility(memberData, ['I10']);

      const records = getStoredEligibilityRecords();
      const record = records.find((r) => r.memberId === 'member-011');
      expect(record).toBeDefined();
      expect(record.eligible).toBe(false);
      expect(record.status).toBe('ineligible');
    });

    it('returns an auditId when validation succeeds', () => {
      const memberData = {
        memberId: 'member-012',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.auditId).toBeDefined();
      expect(typeof result.auditId).toBe('string');
      expect(result.auditId.length).toBeGreaterThan(0);
    });
  });

  describe('multiple conditions priority logic', () => {
    it('selects the highest-priority condition when multiple eligible codes are provided', () => {
      const memberData = {
        memberId: 'member-020',
        performedBy: 'user-001',
      };

      // E11.9 (diabetes, priority 1) and J44.9 (COPD, priority 1) - both priority 1
      // The first one encountered with lowest priority number wins
      const result = validateEligibility(memberData, ['J44.9', 'E11.9']);

      expect(result.eligible).toBe(true);
      expect(result.priorityCondition).toBeDefined();
      // Both are priority 1, so either could be selected based on iteration order
      expect(['E11.9', 'J44.9']).toContain(result.priorityCondition);
    });

    it('selects priority 1 code over priority 2 code', () => {
      const memberData = {
        memberId: 'member-021',
        performedBy: 'user-001',
      };

      // E11.9 = priority 1 (diabetes), E13.9 = priority 2 (other diabetes)
      const result = validateEligibility(memberData, ['E13.9', 'E11.9']);

      expect(result.eligible).toBe(true);
      expect(result.priorityCondition).toBe('E11.9');
    });

    it('selects priority 1 code over priority 3 code', () => {
      const memberData = {
        memberId: 'member-022',
        performedBy: 'user-001',
      };

      // I50.22 = priority 1 (heart failure), J41.0 = priority 3 (simple chronic bronchitis)
      const result = validateEligibility(memberData, ['J41.0', 'I50.22']);

      expect(result.eligible).toBe(true);
      expect(result.priorityCondition).toBe('I50.22');
    });

    it('builds condition summary with multiple categories', () => {
      const memberData = {
        memberId: 'member-023',
        performedBy: 'user-001',
      };

      // E11.9 = diabetes, I50.22 = heart failure, J44.9 = COPD
      const result = validateEligibility(memberData, ['E11.9', 'I50.22', 'J44.9']);

      expect(result.eligible).toBe(true);
      expect(result.validationDetails.conditionSummary.length).toBe(3);

      const categories = result.validationDetails.conditionSummary.map((s) => s.category);
      expect(categories).toContain('diabetes');
      expect(categories).toContain('heart_failure');
      expect(categories).toContain('copd');
    });

    it('condition summary is sorted by highest priority', () => {
      const memberData = {
        memberId: 'member-024',
        performedBy: 'user-001',
      };

      // N18.9 = CKD priority 3, E11.9 = diabetes priority 1
      const result = validateEligibility(memberData, ['N18.9', 'E11.9']);

      expect(result.eligible).toBe(true);
      expect(result.validationDetails.conditionSummary.length).toBe(2);
      // First entry should have the highest priority (lowest number)
      expect(result.validationDetails.conditionSummary[0].highestPriority).toBeLessThanOrEqual(
        result.validationDetails.conditionSummary[1].highestPriority
      );
    });

    it('identifies CSNP-eligible categories in condition summary', () => {
      const memberData = {
        memberId: 'member-025',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9', 'I50.22']);

      for (const summary of result.validationDetails.conditionSummary) {
        expect(summary.csnpEligible).toBe(true);
      }
    });
  });

  describe('effective/retro date handling', () => {
    it('accepts a valid effective date', () => {
      const memberData = {
        memberId: 'member-030',
        effectiveDate: '2024-06-01',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.eligible).toBe(true);
    });

    it('accepts a valid retro date', () => {
      const memberData = {
        memberId: 'member-031',
        retroDate: '2024-01-01',
        effectiveDate: '2024-06-01',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.eligible).toBe(true);
    });

    it('returns default result for invalid effective date format', () => {
      const memberData = {
        memberId: 'member-032',
        effectiveDate: 'not-a-date',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.eligible).toBe(false);
    });

    it('returns default result for invalid retro date format', () => {
      const memberData = {
        memberId: 'member-033',
        retroDate: 'invalid',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.eligible).toBe(false);
    });

    it('returns default result when retro date is after effective date', () => {
      const memberData = {
        memberId: 'member-034',
        retroDate: '2024-12-01',
        effectiveDate: '2024-01-01',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.eligible).toBe(false);
    });

    it('calculates re-verification due date from effective date', () => {
      const memberData = {
        memberId: 'member-035',
        effectiveDate: '2024-01-01',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.eligible).toBe(true);
      expect(result.validationDetails.reverificationDueDate).toBeDefined();
      expect(result.validationDetails.reverificationDueDate).toBe('2025-01-01');
    });

    it('handles null effective date gracefully', () => {
      const memberData = {
        memberId: 'member-036',
        effectiveDate: null,
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.eligible).toBe(true);
    });

    it('handles null retro date gracefully', () => {
      const memberData = {
        memberId: 'member-037',
        retroDate: null,
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.eligible).toBe(true);
    });
  });

  describe('missing diagnosis rejection', () => {
    it('rejects when no diagnosis codes are provided (empty array)', () => {
      const memberData = {
        memberId: 'member-040',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, []);

      expect(result.eligible).toBe(false);
      expect(result.priorityCondition).toBeNull();
      expect(result.validationDetails.validCodes).toHaveLength(0);
    });

    it('rejects when all provided codes are empty strings', () => {
      const memberData = {
        memberId: 'member-041',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['', '', '']);

      expect(result.eligible).toBe(false);
      expect(result.validationDetails.invalidCodes.length).toBe(3);
    });

    it('rejects when all provided codes are whitespace-only', () => {
      const memberData = {
        memberId: 'member-042',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['   ', '  ']);

      expect(result.eligible).toBe(false);
    });

    it('rejects when codes array contains only non-existent codes', () => {
      const memberData = {
        memberId: 'member-043',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['A99.99', 'B88.88', 'C77.77']);

      expect(result.eligible).toBe(false);
      expect(result.validationDetails.invalidCodes.length).toBe(3);
    });

    it('rejects when codes exist but none are CSNP-eligible', () => {
      const memberData = {
        memberId: 'member-044',
        performedBy: 'user-001',
      };

      // I10 = Essential hypertension, exists but not CSNP-eligible
      // N18.1 = CKD stage 1, exists but not CSNP-eligible
      // N18.2 = CKD stage 2, exists but not CSNP-eligible
      const result = validateEligibility(memberData, ['I10', 'N18.1', 'N18.2']);

      expect(result.eligible).toBe(false);
      expect(result.validationDetails.ineligibleCodes).toContain('I10');
      expect(result.validationDetails.ineligibleCodes).toContain('N18.1');
      expect(result.validationDetails.ineligibleCodes).toContain('N18.2');
      expect(result.validationDetails.validCodes).toHaveLength(0);
    });
  });

  describe('annual re-verification', () => {
    it('returns required=true when no eligibility records exist for member', () => {
      const result = checkAnnualReverification('member-050');

      expect(result.required).toBe(true);
      expect(result.dueDate).toBeNull();
      expect(result.lastValidation).toBeNull();
    });

    it('returns required=false when member ID is empty', () => {
      const result = checkAnnualReverification('');

      expect(result.required).toBe(false);
    });

    it('returns required=true when the most recent eligible record has a past due date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 400); // 400 days ago
      const pastDateStr = pastDate.toISOString().split('T')[0];

      const dueDate = new Date(pastDate);
      dueDate.setDate(dueDate.getDate() + 365);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      seedEligibilityRecords([
        {
          id: 'elig-001',
          memberId: 'member-051',
          eligible: true,
          status: 'eligible',
          effectiveDate: pastDateStr,
          reverificationDueDate: dueDateStr,
          createdAt: pastDate.toISOString(),
          updatedAt: pastDate.toISOString(),
        },
      ]);

      const result = checkAnnualReverification('member-051');

      expect(result.required).toBe(true);
      expect(result.dueDate).toBe(dueDateStr);
      expect(result.lastValidation).toBe(pastDate.toISOString());
    });

    it('returns required=false when re-verification is not yet due', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago

      const dueDate = new Date(recentDate);
      dueDate.setDate(dueDate.getDate() + 365);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      seedEligibilityRecords([
        {
          id: 'elig-002',
          memberId: 'member-052',
          eligible: true,
          status: 'eligible',
          effectiveDate: recentDate.toISOString().split('T')[0],
          reverificationDueDate: dueDateStr,
          createdAt: recentDate.toISOString(),
          updatedAt: recentDate.toISOString(),
        },
      ]);

      const result = checkAnnualReverification('member-052');

      expect(result.required).toBe(false);
      expect(result.dueDate).toBe(dueDateStr);
      expect(result.daysUntilDue).toBeGreaterThan(30);
    });

    it('returns required=true when re-verification is due within 30 days', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 345); // 345 days ago

      const dueDate = new Date(pastDate);
      dueDate.setDate(dueDate.getDate() + 365); // 20 days from now
      const dueDateStr = dueDate.toISOString().split('T')[0];

      seedEligibilityRecords([
        {
          id: 'elig-003',
          memberId: 'member-053',
          eligible: true,
          status: 'eligible',
          effectiveDate: pastDate.toISOString().split('T')[0],
          reverificationDueDate: dueDateStr,
          createdAt: pastDate.toISOString(),
          updatedAt: pastDate.toISOString(),
        },
      ]);

      const result = checkAnnualReverification('member-053');

      expect(result.required).toBe(true);
      expect(result.daysUntilDue).toBeLessThanOrEqual(30);
    });

    it('sets annualReverificationRequired in validation result', () => {
      const memberData = {
        memberId: 'member-054',
        effectiveDate: '2024-01-01',
        performedBy: 'user-001',
      };

      const result = validateEligibility(memberData, ['E11.9']);

      expect(result.validationDetails.annualReverificationRequired).toBeDefined();
      expect(typeof result.validationDetails.annualReverificationRequired).toBe('boolean');
    });
  });

  describe('getEligibilityHistory', () => {
    it('returns empty array for unknown member', () => {
      const history = getEligibilityHistory('nonexistent-member');
      expect(history).toEqual([]);
    });

    it('returns empty array for empty member ID', () => {
      const history = getEligibilityHistory('');
      expect(history).toEqual([]);
    });

    it('returns records sorted by creation date descending', () => {
      seedEligibilityRecords([
        {
          id: 'elig-h1',
          memberId: 'member-060',
          eligible: true,
          status: 'eligible',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'elig-h2',
          memberId: 'member-060',
          eligible: false,
          status: 'ineligible',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
        {
          id: 'elig-h3',
          memberId: 'member-060',
          eligible: true,
          status: 'eligible',
          createdAt: '2024-03-01T10:00:00.000Z',
          updatedAt: '2024-03-01T10:00:00.000Z',
        },
      ]);

      const history = getEligibilityHistory('member-060');

      expect(history).toHaveLength(3);
      expect(history[0].id).toBe('elig-h2'); // Most recent
      expect(history[1].id).toBe('elig-h3');
      expect(history[2].id).toBe('elig-h1'); // Oldest
    });

    it('only returns records for the specified member', () => {
      seedEligibilityRecords([
        {
          id: 'elig-h4',
          memberId: 'member-061',
          eligible: true,
          status: 'eligible',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'elig-h5',
          memberId: 'member-062',
          eligible: false,
          status: 'ineligible',
          createdAt: '2024-02-01T10:00:00.000Z',
          updatedAt: '2024-02-01T10:00:00.000Z',
        },
      ]);

      const history = getEligibilityHistory('member-061');

      expect(history).toHaveLength(1);
      expect(history[0].memberId).toBe('member-061');
    });
  });

  describe('getLatestEligibility', () => {
    it('returns null for unknown member', () => {
      const latest = getLatestEligibility('nonexistent');
      expect(latest).toBeNull();
    });

    it('returns the most recent eligibility record', () => {
      seedEligibilityRecords([
        {
          id: 'elig-l1',
          memberId: 'member-070',
          eligible: true,
          status: 'eligible',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
        {
          id: 'elig-l2',
          memberId: 'member-070',
          eligible: false,
          status: 'ineligible',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
      ]);

      const latest = getLatestEligibility('member-070');

      expect(latest).not.toBeNull();
      expect(latest.id).toBe('elig-l2');
    });
  });

  describe('isCurrentlyEligible', () => {
    it('returns eligible=false when no records exist', () => {
      const result = isCurrentlyEligible('nonexistent');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('No eligibility record found');
      expect(result.record).toBeNull();
    });

    it('returns eligible=true when latest record is eligible', () => {
      seedEligibilityRecords([
        {
          id: 'elig-c1',
          memberId: 'member-080',
          eligible: true,
          status: 'eligible',
          reverificationDueDate: '2025-12-31',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
      ]);

      const result = isCurrentlyEligible('member-080');

      expect(result.eligible).toBe(true);
      expect(result.record).not.toBeNull();
    });

    it('returns eligible=false when latest record is ineligible', () => {
      seedEligibilityRecords([
        {
          id: 'elig-c2',
          memberId: 'member-081',
          eligible: false,
          status: 'ineligible',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
      ]);

      const result = isCurrentlyEligible('member-081');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Member is not eligible based on last validation');
    });

    it('returns eligible=false when latest record is expired', () => {
      seedEligibilityRecords([
        {
          id: 'elig-c3',
          memberId: 'member-082',
          eligible: true,
          status: 'expired',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
      ]);

      const result = isCurrentlyEligible('member-082');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Eligibility has expired');
    });
  });

  describe('validateMemberEligibility', () => {
    it('validates eligibility using member stored diagnosis codes', () => {
      seedMembers([
        {
          id: 'member-090',
          firstName: 'Test',
          lastName: 'User',
          diagnosisCodes: ['E11.9', 'I50.22'],
          conditionCategory: 'diabetes',
          csnpEligible: true,
        },
      ]);

      const result = validateMemberEligibility('member-090', 'user-001');

      expect(result.eligible).toBe(true);
      expect(result.priorityCondition).toBeDefined();
      expect(result.validationDetails.validCodes.length).toBeGreaterThanOrEqual(1);
    });

    it('returns ineligible when member has no diagnosis codes', () => {
      seedMembers([
        {
          id: 'member-091',
          firstName: 'Test',
          lastName: 'User',
          diagnosisCodes: [],
          conditionCategory: null,
          csnpEligible: false,
        },
      ]);

      const result = validateMemberEligibility('member-091', 'user-001');

      expect(result.eligible).toBe(false);
    });

    it('returns ineligible when member is not found', () => {
      const result = validateMemberEligibility('nonexistent-member', 'user-001');

      expect(result.eligible).toBe(false);
    });

    it('returns ineligible when member ID is empty', () => {
      const result = validateMemberEligibility('', 'user-001');

      expect(result.eligible).toBe(false);
    });
  });

  describe('updateEligibilityStatus', () => {
    it('updates the status of an existing eligibility record', () => {
      seedEligibilityRecords([
        {
          id: 'elig-u1',
          memberId: 'member-100',
          eligible: true,
          status: 'eligible',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
      ]);

      const result = updateEligibilityStatus('elig-u1', 'expired', 'user-001');

      expect(result).toBe(true);

      const records = getStoredEligibilityRecords();
      const updated = records.find((r) => r.id === 'elig-u1');
      expect(updated.status).toBe('expired');
    });

    it('returns false for empty record ID', () => {
      const result = updateEligibilityStatus('', 'expired', 'user-001');
      expect(result).toBe(false);
    });

    it('returns false for invalid status', () => {
      seedEligibilityRecords([
        {
          id: 'elig-u2',
          memberId: 'member-101',
          eligible: true,
          status: 'eligible',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
      ]);

      const result = updateEligibilityStatus('elig-u2', 'invalid_status', 'user-001');
      expect(result).toBe(false);
    });

    it('returns false when record does not exist', () => {
      const result = updateEligibilityStatus('nonexistent-id', 'expired', 'user-001');
      expect(result).toBe(false);
    });
  });

  describe('getEligibilityStats', () => {
    it('returns zero counts when no records exist', () => {
      const stats = getEligibilityStats();

      expect(stats.totalValidations).toBe(0);
      expect(stats.eligibleCount).toBe(0);
      expect(stats.ineligibleCount).toBe(0);
      expect(stats.pendingCount).toBe(0);
      expect(stats.expiredCount).toBe(0);
    });

    it('returns correct counts for mixed records', () => {
      seedEligibilityRecords([
        { id: 'e1', memberId: 'm1', eligible: true, status: 'eligible', priorityCategory: 'diabetes', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        { id: 'e2', memberId: 'm2', eligible: false, status: 'ineligible', priorityCategory: null, createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' },
        { id: 'e3', memberId: 'm3', eligible: true, status: 'eligible', priorityCategory: 'heart_failure', createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-01-03T00:00:00Z' },
        { id: 'e4', memberId: 'm4', eligible: true, status: 'expired', priorityCategory: 'diabetes', createdAt: '2024-01-04T00:00:00Z', updatedAt: '2024-01-04T00:00:00Z' },
        { id: 'e5', memberId: 'm5', eligible: false, status: 'pending', priorityCategory: null, createdAt: '2024-01-05T00:00:00Z', updatedAt: '2024-01-05T00:00:00Z' },
      ]);

      const stats = getEligibilityStats();

      expect(stats.totalValidations).toBe(5);
      expect(stats.eligibleCount).toBe(2);
      expect(stats.ineligibleCount).toBe(1);
      expect(stats.expiredCount).toBe(1);
      expect(stats.pendingCount).toBe(1);
      expect(stats.byCategory.diabetes).toBe(2);
      expect(stats.byCategory.heart_failure).toBe(1);
    });
  });

  describe('getAllEligibilityRecords', () => {
    it('returns empty array when no records exist', () => {
      const records = getAllEligibilityRecords();
      expect(records).toEqual([]);
    });

    it('returns all stored records', () => {
      seedEligibilityRecords([
        { id: 'r1', memberId: 'm1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        { id: 'r2', memberId: 'm2', createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' },
      ]);

      const records = getAllEligibilityRecords();
      expect(records).toHaveLength(2);
    });
  });

  describe('getSuggestedRelatedCodes', () => {
    it('returns related codes for a valid ICD-10 code', () => {
      const related = getSuggestedRelatedCodes('E11.9');

      expect(Array.isArray(related)).toBe(true);
      expect(related.length).toBeGreaterThan(0);

      for (const entry of related) {
        expect(entry.code).toBeDefined();
        expect(entry.description).toBeDefined();
        expect(typeof entry.csnpEligible).toBe('boolean');
        expect(typeof entry.priority).toBe('number');
      }
    });

    it('returns empty array for unknown code', () => {
      const related = getSuggestedRelatedCodes('ZZZZZ');
      expect(related).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      const related = getSuggestedRelatedCodes('');
      expect(related).toEqual([]);
    });
  });

  describe('batchCheckEligibility', () => {
    it('returns results for multiple members', () => {
      seedMembers([
        {
          id: 'batch-m1',
          firstName: 'Alice',
          lastName: 'Smith',
          diagnosisCodes: ['E11.9'],
          conditionCategory: 'diabetes',
          csnpEligible: true,
        },
        {
          id: 'batch-m2',
          firstName: 'Bob',
          lastName: 'Jones',
          diagnosisCodes: ['I10'],
          conditionCategory: null,
          csnpEligible: false,
        },
      ]);

      const results = batchCheckEligibility(['batch-m1', 'batch-m2'], 'user-001');

      expect(results).toHaveLength(2);

      const m1Result = results.find((r) => r.memberId === 'batch-m1');
      expect(m1Result.eligible).toBe(true);

      const m2Result = results.find((r) => r.memberId === 'batch-m2');
      expect(m2Result.eligible).toBe(false);
    });

    it('returns empty array for empty input', () => {
      const results = batchCheckEligibility([], 'user-001');
      expect(results).toEqual([]);
    });

    it('handles invalid member IDs gracefully', () => {
      const results = batchCheckEligibility(['', null], 'user-001');

      expect(results).toHaveLength(2);
      expect(results[0].eligible).toBe(false);
      expect(results[1].eligible).toBe(false);
    });

    it('handles nonexistent members gracefully', () => {
      const results = batchCheckEligibility(['nonexistent-1', 'nonexistent-2'], 'user-001');

      expect(results).toHaveLength(2);
      expect(results[0].eligible).toBe(false);
      expect(results[1].eligible).toBe(false);
    });
  });
});