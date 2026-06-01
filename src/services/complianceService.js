/**
 * Compliance and CMS reporting service for the CSNP Portal.
 * Provides CMS report generation, weekly C-SNP audits, compliance status tracking,
 * enrollment extracts, and regulatory enforcement with audit logging.
 * @module complianceService
 */

import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem, appendToArray, findInArray, updateInArray } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { getAuditLogs, verifyIntegrity, getAuditLogSummary } from './auditLogger.js';
import {
  AUDIT_ACTIONS,
  ENROLLMENT_STATUSES,
  CLAIM_STATUSES,
  PLAN_TYPES,
} from '../utils/constants.js';
import {
  CONDITION_CATEGORIES,
  CONDITION_CATEGORY_LABELS,
  getCodeByICD10,
  isCSNPEligible,
} from '../data/icd10Data.js';
import { validateRequired, validateDateFormat, validateDateRange } from '../utils/validators.js';

/**
 * localStorage key for compliance reports collection.
 * @type {string}
 */
const COMPLIANCE_REPORTS_KEY = 'csnp_compliance_reports';

/**
 * localStorage key for compliance audits collection.
 * @type {string}
 */
const COMPLIANCE_AUDITS_KEY = 'csnp_compliance_audits';

/**
 * localStorage key for compliance status collection.
 * @type {string}
 */
const COMPLIANCE_STATUS_KEY = 'csnp_compliance_status';

/**
 * localStorage key for enrollment extracts collection.
 * @type {string}
 */
const ENROLLMENT_EXTRACTS_KEY = 'csnp_enrollment_extracts';

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
 * localStorage key for claims collection.
 * @type {string}
 */
const CLAIMS_KEY = 'csnp_claims';

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
 * localStorage key for care events collection.
 * @type {string}
 */
const CARE_EVENTS_KEY = 'csnp_care_events';

/**
 * localStorage key for referrals collection.
 * @type {string}
 */
const REFERRALS_KEY = 'csnp_referrals';

/**
 * localStorage key for eligibility records collection.
 * @type {string}
 */
const ELIGIBILITY_KEY = 'csnp_eligibility_records';

/**
 * CMS Report Types.
 * @enum {string}
 */
export const CMS_REPORT_TYPES = Object.freeze({
  ENROLLMENT_SUMMARY: 'enrollment_summary',
  CLAIMS_SUMMARY: 'claims_summary',
  CARE_MANAGEMENT_SUMMARY: 'care_management_summary',
  PROVIDER_NETWORK_SUMMARY: 'provider_network_summary',
  ELIGIBILITY_SUMMARY: 'eligibility_summary',
  FINANCIAL_SUMMARY: 'financial_summary',
  COMPLIANCE_AUDIT: 'compliance_audit',
  QUALITY_MEASURES: 'quality_measures',
});

/**
 * CMS Report Type Labels.
 * @enum {string}
 */
export const CMS_REPORT_TYPE_LABELS = Object.freeze({
  [CMS_REPORT_TYPES.ENROLLMENT_SUMMARY]: 'Enrollment Summary Report',
  [CMS_REPORT_TYPES.CLAIMS_SUMMARY]: 'Claims Summary Report',
  [CMS_REPORT_TYPES.CARE_MANAGEMENT_SUMMARY]: 'Care Management Summary Report',
  [CMS_REPORT_TYPES.PROVIDER_NETWORK_SUMMARY]: 'Provider Network Summary Report',
  [CMS_REPORT_TYPES.ELIGIBILITY_SUMMARY]: 'Eligibility Summary Report',
  [CMS_REPORT_TYPES.FINANCIAL_SUMMARY]: 'Financial Summary Report',
  [CMS_REPORT_TYPES.COMPLIANCE_AUDIT]: 'Compliance Audit Report',
  [CMS_REPORT_TYPES.QUALITY_MEASURES]: 'Quality Measures Report',
});

/**
 * Compliance modules for validation.
 * @enum {string}
 */
export const COMPLIANCE_MODULES = Object.freeze({
  ENROLLMENT: 'enrollment',
  CLAIMS: 'claims',
  ELIGIBILITY: 'eligibility',
  BENEFITS: 'benefits',
  PROVIDERS: 'providers',
  CARE_MANAGEMENT: 'care_management',
  AUDIT_TRAIL: 'audit_trail',
});

/**
 * Compliance status levels.
 * @enum {string}
 */
export const COMPLIANCE_LEVELS = Object.freeze({
  COMPLIANT: 'compliant',
  MINOR_ISSUES: 'minor_issues',
  MAJOR_ISSUES: 'major_issues',
  NON_COMPLIANT: 'non_compliant',
});

/**
 * @typedef {Object} CMSReportResult
 * @property {boolean} success - Whether the report generation succeeded
 * @property {string|null} reportId - The generated report ID
 * @property {string} reportType - The report type
 * @property {string|null} reportTypeLabel - Human-readable report type label
 * @property {Object|null} reportData - The report data
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if generation failed
 */

/**
 * @typedef {Object} WeeklyAuditResult
 * @property {boolean} success - Whether the audit succeeded
 * @property {string|null} auditId - The audit record ID
 * @property {string} complianceLevel - Overall compliance level
 * @property {Object[]} findings - Array of audit findings
 * @property {Object} summary - Audit summary statistics
 * @property {string|null} auditLogId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if audit failed
 */

/**
 * @typedef {Object} ComplianceStatusResult
 * @property {boolean} success - Whether the status retrieval succeeded
 * @property {string} overallStatus - Overall compliance status
 * @property {Object.<string, Object>} moduleStatuses - Status per module
 * @property {Object[]} recentAudits - Recent audit records
 * @property {Object[]} openFindings - Open compliance findings
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if retrieval failed
 */

/**
 * @typedef {Object} EnrollmentExtractResult
 * @property {boolean} success - Whether the extract generation succeeded
 * @property {string|null} extractId - The extract ID
 * @property {number} recordCount - Number of records in the extract
 * @property {Object[]} records - The extract records
 * @property {Object} summary - Extract summary
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if generation failed
 */

/**
 * @typedef {Object} CMSComplianceValidationResult
 * @property {boolean} compliant - Whether the module is compliant
 * @property {string} module - The module validated
 * @property {string} complianceLevel - Compliance level
 * @property {Object[]} violations - Array of compliance violations
 * @property {Object[]} warnings - Array of compliance warnings
 * @property {Object[]} recommendations - Array of recommendations
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if validation failed
 */

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Retrieves all items from a localStorage collection.
 * @param {string} key - The localStorage key
 * @returns {Object[]} Array of objects
 */
function getCollection(key) {
  const items = getItem(key, []);
  if (!Array.isArray(items)) {
    return [];
  }
  return items;
}

/**
 * Filters records by date range.
 * @param {Object[]} records - Array of records
 * @param {string} dateField - The date field to filter on
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object[]} Filtered records
 */
function filterByDateRange(records, dateField, startDate, endDate) {
  if (!Array.isArray(records)) {
    return [];
  }

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return records;
  }

  return records.filter((record) => {
    const dateValue = record[dateField];
    if (!dateValue || typeof dateValue !== 'string') {
      return false;
    }

    let recordDate;
    if (dateValue.includes('T')) {
      recordDate = new Date(dateValue);
    } else {
      recordDate = new Date(dateValue + 'T00:00:00');
    }

    if (isNaN(recordDate.getTime())) {
      return false;
    }

    return recordDate.getTime() >= start.getTime() && recordDate.getTime() <= end.getTime();
  });
}

/**
 * Generates an enrollment summary report.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Enrollment summary report data
 */
function generateEnrollmentSummaryReport(startDate, endDate) {
  const enrollments = getCollection(ENROLLMENTS_KEY);
  const members = getCollection(MEMBERS_KEY);

  const filteredEnrollments = filterByDateRange(enrollments, 'createdAt', startDate, endDate);

  const byStatus = {};
  const byChannel = {};
  const byPlanType = {};
  const byConditionCategory = {};

  for (const enrollment of filteredEnrollments) {
    const status = enrollment.status || 'unknown';
    if (!byStatus[status]) {
      byStatus[status] = 0;
    }
    byStatus[status]++;

    const channel = enrollment.channel || 'unknown';
    if (!byChannel[channel]) {
      byChannel[channel] = 0;
    }
    byChannel[channel]++;

    const planType = enrollment.planType || 'unknown';
    if (!byPlanType[planType]) {
      byPlanType[planType] = 0;
    }
    byPlanType[planType]++;

    const member = members.find((m) => m.id === enrollment.memberId);
    if (member && member.conditionCategory) {
      const category = member.conditionCategory;
      if (!byConditionCategory[category]) {
        byConditionCategory[category] = 0;
      }
      byConditionCategory[category]++;
    }
  }

  const activeEnrollments = enrollments.filter((e) => e.status === ENROLLMENT_STATUSES.ACTIVE);
  const pendingEnrollments = enrollments.filter((e) => e.status === ENROLLMENT_STATUSES.PENDING);

  return {
    reportPeriod: { startDate, endDate },
    totalEnrollmentsInPeriod: filteredEnrollments.length,
    totalActiveEnrollments: activeEnrollments.length,
    totalPendingEnrollments: pendingEnrollments.length,
    totalMembers: members.length,
    byStatus,
    byChannel,
    byPlanType,
    byConditionCategory,
    csnpEnrollmentRate: members.length > 0
      ? Math.round((activeEnrollments.length / members.length) * 10000) / 100
      : 0,
  };
}

/**
 * Generates a claims summary report.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Claims summary report data
 */
function generateClaimsSummaryReport(startDate, endDate) {
  const claims = getCollection(CLAIMS_KEY);
  const filteredClaims = filterByDateRange(claims, 'createdAt', startDate, endDate);

  const byStatus = {};
  let totalBilled = 0;
  let totalAllowed = 0;
  let totalPaid = 0;
  let totalMemberResponsibility = 0;
  let deniedCount = 0;
  let approvedCount = 0;
  let processedCount = 0;

  for (const claim of filteredClaims) {
    const status = claim.status || 'unknown';
    if (!byStatus[status]) {
      byStatus[status] = 0;
    }
    byStatus[status]++;

    totalBilled += typeof claim.billedAmount === 'number' ? claim.billedAmount : 0;
    totalAllowed += typeof claim.allowedAmount === 'number' ? claim.allowedAmount : 0;
    totalPaid += typeof claim.paidAmount === 'number' ? claim.paidAmount : 0;
    totalMemberResponsibility += typeof claim.memberResponsibility === 'number' ? claim.memberResponsibility : 0;

    if (claim.status === CLAIM_STATUSES.DENIED) {
      deniedCount++;
    }
    if (claim.status === CLAIM_STATUSES.APPROVED || claim.status === CLAIM_STATUSES.PAID) {
      approvedCount++;
    }
    if (claim.status === CLAIM_STATUSES.APPROVED || claim.status === CLAIM_STATUSES.PAID ||
        claim.status === CLAIM_STATUSES.DENIED || claim.status === CLAIM_STATUSES.PARTIALLY_APPROVED) {
      processedCount++;
    }
  }

  return {
    reportPeriod: { startDate, endDate },
    totalClaimsInPeriod: filteredClaims.length,
    byStatus,
    financials: {
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalAllowed: Math.round(totalAllowed * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalMemberResponsibility: Math.round(totalMemberResponsibility * 100) / 100,
      averageBilled: filteredClaims.length > 0 ? Math.round((totalBilled / filteredClaims.length) * 100) / 100 : 0,
      averagePaid: filteredClaims.length > 0 ? Math.round((totalPaid / filteredClaims.length) * 100) / 100 : 0,
    },
    rates: {
      denialRate: processedCount > 0 ? Math.round((deniedCount / processedCount) * 10000) / 100 : 0,
      approvalRate: processedCount > 0 ? Math.round((approvedCount / processedCount) * 10000) / 100 : 0,
      processedCount,
    },
  };
}

/**
 * Generates a care management summary report.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Care management summary report data
 */
function generateCareManagementSummaryReport(startDate, endDate) {
  const careEvents = getCollection(CARE_EVENTS_KEY);
  const filteredEvents = filterByDateRange(careEvents, 'createdAt', startDate, endDate);

  const byEventType = {};
  const byStatus = {};
  const uniqueMembers = new Set();

  for (const event of filteredEvents) {
    const eventType = event.eventType || 'unknown';
    if (!byEventType[eventType]) {
      byEventType[eventType] = 0;
    }
    byEventType[eventType]++;

    const status = event.status || 'unknown';
    if (!byStatus[status]) {
      byStatus[status] = 0;
    }
    byStatus[status]++;

    if (event.memberId) {
      uniqueMembers.add(event.memberId);
    }
  }

  return {
    reportPeriod: { startDate, endDate },
    totalCareEventsInPeriod: filteredEvents.length,
    uniqueMembersServed: uniqueMembers.size,
    byEventType,
    byStatus,
    averageEventsPerMember: uniqueMembers.size > 0
      ? Math.round((filteredEvents.length / uniqueMembers.size) * 100) / 100
      : 0,
  };
}

/**
 * Generates a provider network summary report.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Provider network summary report data
 */
function generateProviderNetworkSummaryReport(startDate, endDate) {
  const providers = getCollection(PROVIDERS_KEY);
  const referrals = getCollection(REFERRALS_KEY);
  const filteredReferrals = filterByDateRange(referrals, 'createdAt', startDate, endDate);

  let inNetworkCount = 0;
  let outOfNetworkCount = 0;
  let acceptingNewPatientsCount = 0;
  const bySpecialty = {};
  const byConditionCategory = {};

  for (const provider of providers) {
    if (provider.contract && provider.contract.status === 'active' && provider.contract.contractType === 'In-Network') {
      inNetworkCount++;
    } else {
      outOfNetworkCount++;
    }

    if (provider.acceptingNewPatients) {
      acceptingNewPatientsCount++;
    }

    const specialty = provider.specialty || 'Unknown';
    if (!bySpecialty[specialty]) {
      bySpecialty[specialty] = 0;
    }
    bySpecialty[specialty]++;

    if (Array.isArray(provider.conditionCategories)) {
      for (const category of provider.conditionCategories) {
        if (!byConditionCategory[category]) {
          byConditionCategory[category] = 0;
        }
        byConditionCategory[category]++;
      }
    }
  }

  const referralsByStatus = {};
  for (const referral of filteredReferrals) {
    const status = referral.status || 'unknown';
    if (!referralsByStatus[status]) {
      referralsByStatus[status] = 0;
    }
    referralsByStatus[status]++;
  }

  return {
    reportPeriod: { startDate, endDate },
    totalProviders: providers.length,
    inNetworkCount,
    outOfNetworkCount,
    acceptingNewPatientsCount,
    bySpecialty,
    byConditionCategory,
    referrals: {
      totalInPeriod: filteredReferrals.length,
      byStatus: referralsByStatus,
    },
    networkAdequacy: {
      inNetworkPercentage: providers.length > 0
        ? Math.round((inNetworkCount / providers.length) * 10000) / 100
        : 0,
      acceptingPercentage: providers.length > 0
        ? Math.round((acceptingNewPatientsCount / providers.length) * 10000) / 100
        : 0,
    },
  };
}

/**
 * Generates an eligibility summary report.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Eligibility summary report data
 */
function generateEligibilitySummaryReport(startDate, endDate) {
  const eligibilityRecords = getCollection(ELIGIBILITY_KEY);
  const filteredRecords = filterByDateRange(eligibilityRecords, 'createdAt', startDate, endDate);

  const byStatus = {};
  const byCategory = {};
  let eligibleCount = 0;
  let ineligibleCount = 0;

  for (const record of filteredRecords) {
    const status = record.status || 'unknown';
    if (!byStatus[status]) {
      byStatus[status] = 0;
    }
    byStatus[status]++;

    if (record.eligible) {
      eligibleCount++;
    } else {
      ineligibleCount++;
    }

    if (record.priorityCategory) {
      if (!byCategory[record.priorityCategory]) {
        byCategory[record.priorityCategory] = 0;
      }
      byCategory[record.priorityCategory]++;
    }
  }

  return {
    reportPeriod: { startDate, endDate },
    totalValidationsInPeriod: filteredRecords.length,
    eligibleCount,
    ineligibleCount,
    eligibilityRate: filteredRecords.length > 0
      ? Math.round((eligibleCount / filteredRecords.length) * 10000) / 100
      : 0,
    byStatus,
    byCategory,
  };
}

/**
 * Generates a financial summary report.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Financial summary report data
 */
function generateFinancialSummaryReport(startDate, endDate) {
  const claims = getCollection(CLAIMS_KEY);
  const benefitPackages = getCollection(BENEFIT_PACKAGES_KEY);
  const enrollments = getCollection(ENROLLMENTS_KEY);
  const filteredClaims = filterByDateRange(claims, 'createdAt', startDate, endDate);

  let totalBilled = 0;
  let totalAllowed = 0;
  let totalPaid = 0;
  let totalMemberResponsibility = 0;

  const byProvider = {};

  for (const claim of filteredClaims) {
    totalBilled += typeof claim.billedAmount === 'number' ? claim.billedAmount : 0;
    totalAllowed += typeof claim.allowedAmount === 'number' ? claim.allowedAmount : 0;
    totalPaid += typeof claim.paidAmount === 'number' ? claim.paidAmount : 0;
    totalMemberResponsibility += typeof claim.memberResponsibility === 'number' ? claim.memberResponsibility : 0;

    const providerId = claim.providerId || 'unknown';
    if (!byProvider[providerId]) {
      byProvider[providerId] = { billed: 0, paid: 0, claimCount: 0 };
    }
    byProvider[providerId].billed += typeof claim.billedAmount === 'number' ? claim.billedAmount : 0;
    byProvider[providerId].paid += typeof claim.paidAmount === 'number' ? claim.paidAmount : 0;
    byProvider[providerId].claimCount++;
  }

  const activeEnrollments = enrollments.filter((e) => e.status === ENROLLMENT_STATUSES.ACTIVE);
  let totalMonthlyPremiums = 0;
  for (const enrollment of activeEnrollments) {
    const pkg = benefitPackages.find((p) => p.id === enrollment.benefitPackageId);
    if (pkg && typeof pkg.monthlyPremium === 'number') {
      totalMonthlyPremiums += pkg.monthlyPremium;
    }
  }

  return {
    reportPeriod: { startDate, endDate },
    claimFinancials: {
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalAllowed: Math.round(totalAllowed * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalMemberResponsibility: Math.round(totalMemberResponsibility * 100) / 100,
      claimCount: filteredClaims.length,
    },
    premiumRevenue: {
      totalMonthlyPremiums: Math.round(totalMonthlyPremiums * 100) / 100,
      activeEnrollmentCount: activeEnrollments.length,
    },
    medicalLossRatio: totalMonthlyPremiums > 0
      ? Math.round((totalPaid / (totalMonthlyPremiums * 12)) * 10000) / 100
      : 0,
    topProvidersBySpend: Object.entries(byProvider)
      .map(([providerId, data]) => ({
        providerId,
        billed: Math.round(data.billed * 100) / 100,
        paid: Math.round(data.paid * 100) / 100,
        claimCount: data.claimCount,
      }))
      .sort((a, b) => b.paid - a.paid)
      .slice(0, 10),
  };
}

/**
 * Generates a compliance audit report.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Compliance audit report data
 */
function generateComplianceAuditReport(startDate, endDate) {
  const auditLogs = getAuditLogs({ startDate, endDate });
  const integrityResult = verifyIntegrity();
  const auditSummary = getAuditLogSummary();

  const byAction = {};
  const byModule = {};
  const byUser = {};

  for (const log of auditLogs) {
    const action = log.action || 'unknown';
    if (!byAction[action]) {
      byAction[action] = 0;
    }
    byAction[action]++;

    const module = log.module || 'unknown';
    if (!byModule[module]) {
      byModule[module] = 0;
    }
    byModule[module]++;

    const userId = log.userId || 'unknown';
    if (!byUser[userId]) {
      byUser[userId] = 0;
    }
    byUser[userId]++;
  }

  return {
    reportPeriod: { startDate, endDate },
    totalAuditEntries: auditLogs.length,
    auditTrailIntegrity: {
      valid: integrityResult.valid,
      errors: integrityResult.errors,
      checkedEntries: integrityResult.checkedEntries,
    },
    byAction,
    byModule,
    byUser,
    overallAuditSummary: auditSummary,
  };
}

/**
 * Generates a quality measures report.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Quality measures report data
 */
function generateQualityMeasuresReport(startDate, endDate) {
  const members = getCollection(MEMBERS_KEY);
  const enrollments = getCollection(ENROLLMENTS_KEY);
  const claims = getCollection(CLAIMS_KEY);
  const careEvents = getCollection(CARE_EVENTS_KEY);
  const filteredCareEvents = filterByDateRange(careEvents, 'createdAt', startDate, endDate);
  const filteredClaims = filterByDateRange(claims, 'createdAt', startDate, endDate);

  const activeEnrollments = enrollments.filter((e) => e.status === ENROLLMENT_STATUSES.ACTIVE);
  const activeMembers = new Set(activeEnrollments.map((e) => e.memberId));

  const membersWithCareEvents = new Set(filteredCareEvents.map((e) => e.memberId));
  const membersWithClaims = new Set(filteredClaims.map((c) => c.memberId));

  const careManagementEngagementRate = activeMembers.size > 0
    ? Math.round((membersWithCareEvents.size / activeMembers.size) * 10000) / 100
    : 0;

  const claimsUtilizationRate = activeMembers.size > 0
    ? Math.round((membersWithClaims.size / activeMembers.size) * 10000) / 100
    : 0;

  const deniedClaims = filteredClaims.filter((c) => c.status === CLAIM_STATUSES.DENIED);
  const claimDenialRate = filteredClaims.length > 0
    ? Math.round((deniedClaims.length / filteredClaims.length) * 10000) / 100
    : 0;

  const diabetesMembers = members.filter((m) => m.conditionCategory === CONDITION_CATEGORIES.DIABETES);
  const heartFailureMembers = members.filter((m) => m.conditionCategory === CONDITION_CATEGORIES.HEART_FAILURE);
  const copdMembers = members.filter((m) => m.conditionCategory === CONDITION_CATEGORIES.COPD);

  return {
    reportPeriod: { startDate, endDate },
    populationMetrics: {
      totalActiveMembers: activeMembers.size,
      totalMembers: members.length,
      diabetesMemberCount: diabetesMembers.length,
      heartFailureMemberCount: heartFailureMembers.length,
      copdMemberCount: copdMembers.length,
    },
    qualityIndicators: {
      careManagementEngagementRate,
      claimsUtilizationRate,
      claimDenialRate,
      membersWithCareEventsCount: membersWithCareEvents.size,
      membersWithClaimsCount: membersWithClaims.size,
    },
    csnpSpecificMeasures: {
      chronicConditionMonitoringRate: careManagementEngagementRate,
      carePlanCompletionRate: activeMembers.size > 0
        ? Math.round((membersWithCareEvents.size / activeMembers.size) * 10000) / 100
        : 0,
    },
  };
}

// ─── Compliance Validation Helpers ──────────────────────────────────────────

/**
 * Validates enrollment module compliance.
 * @returns {{ violations: Object[], warnings: Object[], recommendations: Object[] }}
 */
function validateEnrollmentCompliance() {
  const violations = [];
  const warnings = [];
  const recommendations = [];

  const enrollments = getCollection(ENROLLMENTS_KEY);
  const members = getCollection(MEMBERS_KEY);

  // Check for enrollments without verified diagnosis codes
  const enrollmentsWithoutCodes = enrollments.filter(
    (e) => (e.status === ENROLLMENT_STATUSES.ACTIVE || e.status === ENROLLMENT_STATUSES.APPROVED) &&
      (!Array.isArray(e.diagnosisCodesVerified) || e.diagnosisCodesVerified.length === 0)
  );

  if (enrollmentsWithoutCodes.length > 0) {
    violations.push({
      code: 'ENR-V001',
      severity: 'high',
      description: `${enrollmentsWithoutCodes.length} active/approved enrollment(s) without verified diagnosis codes`,
      affectedRecords: enrollmentsWithoutCodes.map((e) => e.id),
      regulation: 'CMS C-SNP enrollment requires verified chronic condition diagnosis',
    });
  }

  // Check for active enrollments with non-CSNP-eligible codes
  for (const enrollment of enrollments) {
    if (enrollment.status !== ENROLLMENT_STATUSES.ACTIVE && enrollment.status !== ENROLLMENT_STATUSES.APPROVED) {
      continue;
    }

    if (Array.isArray(enrollment.diagnosisCodesVerified)) {
      const hasEligibleCode = enrollment.diagnosisCodesVerified.some((code) => {
        if (typeof code !== 'string') {
          return false;
        }
        return isCSNPEligible(code.trim().toUpperCase());
      });

      if (!hasEligibleCode && enrollment.diagnosisCodesVerified.length > 0) {
        violations.push({
          code: 'ENR-V002',
          severity: 'critical',
          description: `Enrollment ${enrollment.id} has no CSNP-eligible diagnosis codes`,
          affectedRecords: [enrollment.id],
          regulation: 'C-SNP enrollment requires at least one qualifying chronic condition',
        });
      }
    }
  }

  // Check for members without active enrollments
  const membersWithActiveEnrollment = new Set(
    enrollments.filter((e) => e.status === ENROLLMENT_STATUSES.ACTIVE).map((e) => e.memberId)
  );
  const csnpEligibleMembersWithoutEnrollment = members.filter(
    (m) => m.csnpEligible && !membersWithActiveEnrollment.has(m.id)
  );

  if (csnpEligibleMembersWithoutEnrollment.length > 0) {
    warnings.push({
      code: 'ENR-W001',
      severity: 'medium',
      description: `${csnpEligibleMembersWithoutEnrollment.length} CSNP-eligible member(s) without active enrollment`,
      affectedRecords: csnpEligibleMembersWithoutEnrollment.map((m) => m.id),
    });
  }

  // Check for pending enrollments older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stalePendingEnrollments = enrollments.filter((e) => {
    if (e.status !== ENROLLMENT_STATUSES.PENDING) {
      return false;
    }
    const created = new Date(e.createdAt);
    return !isNaN(created.getTime()) && created.getTime() < thirtyDaysAgo.getTime();
  });

  if (stalePendingEnrollments.length > 0) {
    warnings.push({
      code: 'ENR-W002',
      severity: 'medium',
      description: `${stalePendingEnrollments.length} pending enrollment(s) older than 30 days`,
      affectedRecords: stalePendingEnrollments.map((e) => e.id),
    });
  }

  recommendations.push({
    code: 'ENR-R001',
    description: 'Ensure all active enrollments have annual re-verification of chronic condition diagnosis',
  });

  return { violations, warnings, recommendations };
}

/**
 * Validates claims module compliance.
 * @returns {{ violations: Object[], warnings: Object[], recommendations: Object[] }}
 */
function validateClaimsCompliance() {
  const violations = [];
  const warnings = [];
  const recommendations = [];

  const claims = getCollection(CLAIMS_KEY);
  const enrollments = getCollection(ENROLLMENTS_KEY);

  // Check for claims without enrollment
  const claimsWithoutEnrollment = claims.filter((c) => {
    if (!c.enrollmentId) {
      return true;
    }
    const enrollment = enrollments.find((e) => e.id === c.enrollmentId);
    return !enrollment;
  });

  if (claimsWithoutEnrollment.length > 0) {
    violations.push({
      code: 'CLM-V001',
      severity: 'high',
      description: `${claimsWithoutEnrollment.length} claim(s) without valid enrollment reference`,
      affectedRecords: claimsWithoutEnrollment.map((c) => c.id),
      regulation: 'All claims must be associated with a valid enrollment',
    });
  }

  // Check for claims with invalid diagnosis codes
  const claimsWithInvalidCodes = claims.filter((c) => {
    if (!Array.isArray(c.diagnosisCodes) || c.diagnosisCodes.length === 0) {
      return true;
    }
    return c.diagnosisCodes.every((code) => {
      if (typeof code !== 'string') {
        return true;
      }
      return !getCodeByICD10(code.trim().toUpperCase());
    });
  });

  if (claimsWithInvalidCodes.length > 0) {
    warnings.push({
      code: 'CLM-W001',
      severity: 'medium',
      description: `${claimsWithInvalidCodes.length} claim(s) with no valid ICD-10 diagnosis codes`,
      affectedRecords: claimsWithInvalidCodes.map((c) => c.id),
    });
  }

  // Check claim processing timeliness (claims submitted > 14 days ago still pending)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const overdueClaimsProcessing = claims.filter((c) => {
    if (c.status !== CLAIM_STATUSES.SUBMITTED && c.status !== CLAIM_STATUSES.PENDING) {
      return false;
    }
    const created = new Date(c.createdAt);
    return !isNaN(created.getTime()) && created.getTime() < fourteenDaysAgo.getTime();
  });

  if (overdueClaimsProcessing.length > 0) {
    warnings.push({
      code: 'CLM-W002',
      severity: 'high',
      description: `${overdueClaimsProcessing.length} claim(s) pending processing for more than 14 days`,
      affectedRecords: overdueClaimsProcessing.map((c) => c.id),
    });
  }

  // Check denial rate
  const processedClaims = claims.filter((c) =>
    c.status === CLAIM_STATUSES.APPROVED || c.status === CLAIM_STATUSES.PAID ||
    c.status === CLAIM_STATUSES.DENIED || c.status === CLAIM_STATUSES.PARTIALLY_APPROVED
  );
  const deniedClaims = claims.filter((c) => c.status === CLAIM_STATUSES.DENIED);

  if (processedClaims.length > 0) {
    const denialRate = (deniedClaims.length / processedClaims.length) * 100;
    if (denialRate > 20) {
      warnings.push({
        code: 'CLM-W003',
        severity: 'high',
        description: `Claim denial rate is ${denialRate.toFixed(1)}%, which exceeds the 20% threshold`,
        affectedRecords: [],
      });
    }
  }

  recommendations.push({
    code: 'CLM-R001',
    description: 'Implement automated claim processing to reduce turnaround time',
  });
  recommendations.push({
    code: 'CLM-R002',
    description: 'Review denial patterns to identify systemic issues and reduce denial rate',
  });

  return { violations, warnings, recommendations };
}

/**
 * Validates eligibility module compliance.
 * @returns {{ violations: Object[], warnings: Object[], recommendations: Object[] }}
 */
function validateEligibilityCompliance() {
  const violations = [];
  const warnings = [];
  const recommendations = [];

  const members = getCollection(MEMBERS_KEY);
  const eligibilityRecords = getCollection(ELIGIBILITY_KEY);

  // Check for members without eligibility validation
  const membersWithEligibility = new Set(eligibilityRecords.map((r) => r.memberId));
  const membersWithoutEligibility = members.filter((m) => !membersWithEligibility.has(m.id));

  if (membersWithoutEligibility.length > 0) {
    warnings.push({
      code: 'ELG-W001',
      severity: 'medium',
      description: `${membersWithoutEligibility.length} member(s) without eligibility validation records`,
      affectedRecords: membersWithoutEligibility.map((m) => m.id),
    });
  }

  // Check for expired eligibility records
  const expiredRecords = eligibilityRecords.filter((r) => r.status === 'expired');
  if (expiredRecords.length > 0) {
    warnings.push({
      code: 'ELG-W002',
      severity: 'medium',
      description: `${expiredRecords.length} expired eligibility record(s) requiring re-verification`,
      affectedRecords: expiredRecords.map((r) => r.id),
    });
  }

  // Check for members marked CSNP-eligible without valid diagnosis codes
  for (const member of members) {
    if (!member.csnpEligible) {
      continue;
    }

    if (!Array.isArray(member.diagnosisCodes) || member.diagnosisCodes.length === 0) {
      violations.push({
        code: 'ELG-V001',
        severity: 'high',
        description: `Member ${member.id} is marked CSNP-eligible but has no diagnosis codes`,
        affectedRecords: [member.id],
        regulation: 'CSNP eligibility requires documented chronic condition diagnosis codes',
      });
    }
  }

  recommendations.push({
    code: 'ELG-R001',
    description: 'Implement automated annual re-verification reminders for all CSNP-eligible members',
  });

  return { violations, warnings, recommendations };
}

/**
 * Validates benefits module compliance.
 * @returns {{ violations: Object[], warnings: Object[], recommendations: Object[] }}
 */
function validateBenefitsCompliance() {
  const violations = [];
  const warnings = [];
  const recommendations = [];

  const benefitPackages = getCollection(BENEFIT_PACKAGES_KEY);
  const enrollments = getCollection(ENROLLMENTS_KEY);

  // Check for benefit packages without eligible condition categories
  const packagesWithoutCategories = benefitPackages.filter(
    (pkg) => !Array.isArray(pkg.eligibleConditionCategories) || pkg.eligibleConditionCategories.length === 0
  );

  if (packagesWithoutCategories.length > 0) {
    violations.push({
      code: 'BEN-V001',
      severity: 'high',
      description: `${packagesWithoutCategories.length} benefit package(s) without eligible condition categories`,
      affectedRecords: packagesWithoutCategories.map((p) => p.id),
      regulation: 'C-SNP benefit packages must specify eligible chronic condition categories',
    });
  }

  // Check for expired benefit packages with active enrollments
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const pkg of benefitPackages) {
    if (!pkg.terminationDate) {
      continue;
    }

    try {
      const termDate = new Date(pkg.terminationDate + 'T23:59:59');
      if (!isNaN(termDate.getTime()) && termDate.getTime() < today.getTime()) {
        const activeEnrollmentsForPackage = enrollments.filter(
          (e) => e.benefitPackageId === pkg.id && e.status === ENROLLMENT_STATUSES.ACTIVE
        );

        if (activeEnrollmentsForPackage.length > 0) {
          violations.push({
            code: 'BEN-V002',
            severity: 'critical',
            description: `Benefit package "${pkg.name}" (${pkg.id}) has expired but has ${activeEnrollmentsForPackage.length} active enrollment(s)`,
            affectedRecords: [pkg.id, ...activeEnrollmentsForPackage.map((e) => e.id)],
            regulation: 'Active enrollments must be associated with valid, non-expired benefit packages',
          });
        }
      }
    } catch {
      // Ignore date parsing errors
    }
  }

  // Check for non-C-SNP plan types
  const nonCSNPPackages = benefitPackages.filter((pkg) => pkg.planType !== PLAN_TYPES.C_SNP);
  if (nonCSNPPackages.length > 0) {
    warnings.push({
      code: 'BEN-W001',
      severity: 'low',
      description: `${nonCSNPPackages.length} benefit package(s) are not C-SNP plan type`,
      affectedRecords: nonCSNPPackages.map((p) => p.id),
    });
  }

  recommendations.push({
    code: 'BEN-R001',
    description: 'Review benefit packages annually to ensure alignment with CMS C-SNP requirements',
  });

  return { violations, warnings, recommendations };
}

/**
 * Validates providers module compliance.
 * @returns {{ violations: Object[], warnings: Object[], recommendations: Object[] }}
 */
function validateProvidersCompliance() {
  const violations = [];
  const warnings = [];
  const recommendations = [];

  const providers = getCollection(PROVIDERS_KEY);

  // Check for providers without NPI
  const providersWithoutNPI = providers.filter(
    (p) => !p.npi || (typeof p.npi === 'string' && p.npi.trim().length === 0)
  );

  if (providersWithoutNPI.length > 0) {
    violations.push({
      code: 'PRV-V001',
      severity: 'high',
      description: `${providersWithoutNPI.length} provider(s) without National Provider Identifier (NPI)`,
      affectedRecords: providersWithoutNPI.map((p) => p.id),
      regulation: 'All providers must have a valid NPI for CMS compliance',
    });
  }

  // Check for providers with expired contracts
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const providersWithExpiredContracts = providers.filter((p) => {
    if (!p.contract || !p.contract.terminationDate) {
      return false;
    }
    try {
      const termDate = new Date(p.contract.terminationDate + 'T23:59:59');
      return !isNaN(termDate.getTime()) && termDate.getTime() < today.getTime() && p.contract.status === 'active';
    } catch {
      return false;
    }
  });

  if (providersWithExpiredContracts.length > 0) {
    warnings.push({
      code: 'PRV-W001',
      severity: 'high',
      description: `${providersWithExpiredContracts.length} provider(s) with expired contracts still marked as active`,
      affectedRecords: providersWithExpiredContracts.map((p) => p.id),
    });
  }

  // Check for providers without condition categories
  const providersWithoutCategories = providers.filter(
    (p) => !Array.isArray(p.conditionCategories) || p.conditionCategories.length === 0
  );

  if (providersWithoutCategories.length > 0) {
    warnings.push({
      code: 'PRV-W002',
      severity: 'low',
      description: `${providersWithoutCategories.length} provider(s) without assigned condition categories`,
      affectedRecords: providersWithoutCategories.map((p) => p.id),
    });
  }

  recommendations.push({
    code: 'PRV-R001',
    description: 'Conduct quarterly provider network adequacy assessments',
  });

  return { violations, warnings, recommendations };
}

/**
 * Validates care management module compliance.
 * @returns {{ violations: Object[], warnings: Object[], recommendations: Object[] }}
 */
function validateCareManagementCompliance() {
  const violations = [];
  const warnings = [];
  const recommendations = [];

  const members = getCollection(MEMBERS_KEY);
  const enrollments = getCollection(ENROLLMENTS_KEY);
  const careEvents = getCollection(CARE_EVENTS_KEY);

  const activeEnrollments = enrollments.filter((e) => e.status === ENROLLMENT_STATUSES.ACTIVE);
  const activeMemberIds = new Set(activeEnrollments.map((e) => e.memberId));
  const membersWithCareEvents = new Set(careEvents.map((e) => e.memberId));

  // Check for active members without any care management events
  const activeMembersWithoutCare = [...activeMemberIds].filter((id) => !membersWithCareEvents.has(id));

  if (activeMembersWithoutCare.length > 0) {
    warnings.push({
      code: 'CM-W001',
      severity: 'high',
      description: `${activeMembersWithoutCare.length} actively enrolled member(s) without any care management events`,
      affectedRecords: activeMembersWithoutCare,
    });
  }

  // Check care management engagement rate
  if (activeMemberIds.size > 0) {
    const engagementRate = (membersWithCareEvents.size / activeMemberIds.size) * 100;
    if (engagementRate < 80) {
      warnings.push({
        code: 'CM-W002',
        severity: 'medium',
        description: `Care management engagement rate is ${engagementRate.toFixed(1)}%, below the 80% target`,
        affectedRecords: [],
      });
    }
  }

  // CMS requires initial health risk assessment for C-SNP members
  recommendations.push({
    code: 'CM-R001',
    description: 'Ensure all newly enrolled C-SNP members receive an initial Health Risk Assessment within 90 days',
  });
  recommendations.push({
    code: 'CM-R002',
    description: 'Implement individualized care plans for all C-SNP members with documented goals and interventions',
  });

  return { violations, warnings, recommendations };
}

/**
 * Validates audit trail module compliance.
 * @returns {{ violations: Object[], warnings: Object[], recommendations: Object[] }}
 */
function validateAuditTrailCompliance() {
  const violations = [];
  const warnings = [];
  const recommendations = [];

  const integrityResult = verifyIntegrity();

  if (!integrityResult.valid) {
    violations.push({
      code: 'AUD-V001',
      severity: 'critical',
      description: `Audit trail integrity check failed with ${integrityResult.errors.length} error(s)`,
      affectedRecords: [],
      regulation: 'CMS requires tamper-proof audit trails for all PHI access and modifications',
      details: integrityResult.errors,
    });
  }

  if (integrityResult.checkedEntries === 0) {
    warnings.push({
      code: 'AUD-W001',
      severity: 'medium',
      description: 'No audit trail entries found. System activity may not be properly logged.',
      affectedRecords: [],
    });
  }

  recommendations.push({
    code: 'AUD-R001',
    description: 'Implement regular audit trail integrity verification (at least weekly)',
  });
  recommendations.push({
    code: 'AUD-R002',
    description: 'Ensure all PHI access events are captured in the audit trail',
  });

  return { violations, warnings, recommendations };
}

/**
 * Determines the compliance level based on violations and warnings.
 * @param {Object[]} violations - Array of violations
 * @param {Object[]} warnings - Array of warnings
 * @returns {string} Compliance level
 */
function determineComplianceLevel(violations, warnings) {
  const criticalViolations = violations.filter((v) => v.severity === 'critical');
  const highViolations = violations.filter((v) => v.severity === 'high');
  const highWarnings = warnings.filter((w) => w.severity === 'high');

  if (criticalViolations.length > 0) {
    return COMPLIANCE_LEVELS.NON_COMPLIANT;
  }

  if (highViolations.length > 0) {
    return COMPLIANCE_LEVELS.MAJOR_ISSUES;
  }

  if (highWarnings.length > 0 || violations.length > 0) {
    return COMPLIANCE_LEVELS.MINOR_ISSUES;
  }

  return COMPLIANCE_LEVELS.COMPLIANT;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generates a CMS report of the specified type for the given date range.
 *
 * @param {string} reportType - The report type from CMS_REPORT_TYPES
 * @param {Object} dateRange - The date range for the report
 * @param {string} dateRange.startDate - Start date (YYYY-MM-DD)
 * @param {string} dateRange.endDate - End date (YYYY-MM-DD)
 * @param {Object} [options={}] - Report options
 * @param {string} [options.performedBy] - User ID generating the report
 * @returns {CMSReportResult} The CMS report result
 */
export function generateCMSReport(reportType, dateRange, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    reportId: null,
    reportType: reportType || '',
    reportTypeLabel: null,
    reportData: null,
    auditId: null,
    timestamp,
  };

  // Validate report type
  const reportTypeResult = validateRequired(reportType, 'Report type');
  if (!reportTypeResult.valid) {
    return { ...defaultResult, error: reportTypeResult.error };
  }

  const trimmedType = reportType.trim();
  const validTypes = Object.values(CMS_REPORT_TYPES);
  if (!validTypes.includes(trimmedType)) {
    return {
      ...defaultResult,
      error: `Invalid report type: "${trimmedType}". Must be one of: ${validTypes.join(', ')}`,
    };
  }

  // Validate date range
  if (!dateRange || typeof dateRange !== 'object') {
    return { ...defaultResult, error: 'Date range is required' };
  }

  const startDateResult = validateDateFormat(dateRange.startDate, 'Start date');
  if (!startDateResult.valid) {
    return { ...defaultResult, error: startDateResult.error };
  }

  const endDateResult = validateDateFormat(dateRange.endDate, 'End date');
  if (!endDateResult.valid) {
    return { ...defaultResult, error: endDateResult.error };
  }

  const rangeResult = validateDateRange(dateRange.startDate, dateRange.endDate, 'Start date', 'End date');
  if (!rangeResult.valid) {
    return { ...defaultResult, error: rangeResult.error };
  }

  const startDate = dateRange.startDate.trim();
  const endDate = dateRange.endDate.trim();

  try {
    let reportData = null;

    switch (trimmedType) {
      case CMS_REPORT_TYPES.ENROLLMENT_SUMMARY:
        reportData = generateEnrollmentSummaryReport(startDate, endDate);
        break;
      case CMS_REPORT_TYPES.CLAIMS_SUMMARY:
        reportData = generateClaimsSummaryReport(startDate, endDate);
        break;
      case CMS_REPORT_TYPES.CARE_MANAGEMENT_SUMMARY:
        reportData = generateCareManagementSummaryReport(startDate, endDate);
        break;
      case CMS_REPORT_TYPES.PROVIDER_NETWORK_SUMMARY:
        reportData = generateProviderNetworkSummaryReport(startDate, endDate);
        break;
      case CMS_REPORT_TYPES.ELIGIBILITY_SUMMARY:
        reportData = generateEligibilitySummaryReport(startDate, endDate);
        break;
      case CMS_REPORT_TYPES.FINANCIAL_SUMMARY:
        reportData = generateFinancialSummaryReport(startDate, endDate);
        break;
      case CMS_REPORT_TYPES.COMPLIANCE_AUDIT:
        reportData = generateComplianceAuditReport(startDate, endDate);
        break;
      case CMS_REPORT_TYPES.QUALITY_MEASURES:
        reportData = generateQualityMeasuresReport(startDate, endDate);
        break;
      default:
        return { ...defaultResult, error: `Unsupported report type: "${trimmedType}"` };
    }

    // Persist report record
    const reportId = uuidv4();
    const reportRecord = {
      id: reportId,
      reportType: trimmedType,
      reportTypeLabel: CMS_REPORT_TYPE_LABELS[trimmedType] || trimmedType,
      dateRange: { startDate, endDate },
      reportData,
      generatedBy: performedBy,
      generatedAt: timestamp,
      createdAt: timestamp,
    };

    appendToArray(COMPLIANCE_REPORTS_KEY, reportRecord);

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.EXPORT,
      performedBy,
      {
        targetType: 'cms_report',
        targetId: reportId,
        description: `CMS report generated: ${CMS_REPORT_TYPE_LABELS[trimmedType] || trimmedType}. Period: ${startDate} to ${endDate}`,
        metadata: {
          reportId,
          reportType: trimmedType,
          startDate,
          endDate,
        },
        ipAddress: '127.0.0.1',
      },
      'compliance'
    );

    return {
      success: true,
      reportId,
      reportType: trimmedType,
      reportTypeLabel: CMS_REPORT_TYPE_LABELS[trimmedType] || trimmedType,
      reportData,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('complianceService.generateCMSReport: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during report generation' };
  }
}

/**
 * Runs a weekly C-SNP compliance audit across all modules.
 * Checks enrollment integrity, claims processing, eligibility verification,
 * provider network adequacy, care management engagement, and audit trail integrity.
 *
 * @param {Object} [options={}] - Audit options
 * @param {string} [options.performedBy] - User ID performing the audit
 * @returns {WeeklyAuditResult} The weekly audit result
 */
export function runWeeklyAudit(options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    auditId: null,
    complianceLevel: COMPLIANCE_LEVELS.NON_COMPLIANT,
    findings: [],
    summary: {},
    auditLogId: null,
    timestamp,
  };

  try {
    const allViolations = [];
    const allWarnings = [];
    const allRecommendations = [];
    const moduleResults = {};

    // Run compliance checks for each module
    const modules = [
      { name: COMPLIANCE_MODULES.ENROLLMENT, validator: validateEnrollmentCompliance },
      { name: COMPLIANCE_MODULES.CLAIMS, validator: validateClaimsCompliance },
      { name: COMPLIANCE_MODULES.ELIGIBILITY, validator: validateEligibilityCompliance },
      { name: COMPLIANCE_MODULES.BENEFITS, validator: validateBenefitsCompliance },
      { name: COMPLIANCE_MODULES.PROVIDERS, validator: validateProvidersCompliance },
      { name: COMPLIANCE_MODULES.CARE_MANAGEMENT, validator: validateCareManagementCompliance },
      { name: COMPLIANCE_MODULES.AUDIT_TRAIL, validator: validateAuditTrailCompliance },
    ];

    for (const mod of modules) {
      const result = mod.validator();
      moduleResults[mod.name] = {
        violations: result.violations.length,
        warnings: result.warnings.length,
        recommendations: result.recommendations.length,
        complianceLevel: determineComplianceLevel(result.violations, result.warnings),
      };

      allViolations.push(...result.violations.map((v) => ({ ...v, module: mod.name })));
      allWarnings.push(...result.warnings.map((w) => ({ ...w, module: mod.name })));
      allRecommendations.push(...result.recommendations.map((r) => ({ ...r, module: mod.name })));
    }

    // Determine overall compliance level
    const overallLevel = determineComplianceLevel(allViolations, allWarnings);

    // Build findings
    const findings = [
      ...allViolations.map((v) => ({ type: 'violation', ...v })),
      ...allWarnings.map((w) => ({ type: 'warning', ...w })),
      ...allRecommendations.map((r) => ({ type: 'recommendation', ...r })),
    ];

    // Build summary
    const summary = {
      totalViolations: allViolations.length,
      criticalViolations: allViolations.filter((v) => v.severity === 'critical').length,
      highViolations: allViolations.filter((v) => v.severity === 'high').length,
      totalWarnings: allWarnings.length,
      totalRecommendations: allRecommendations.length,
      moduleResults,
      overallComplianceLevel: overallLevel,
    };

    // Persist audit record
    const auditId = uuidv4();
    const auditRecord = {
      id: auditId,
      auditType: 'weekly',
      complianceLevel: overallLevel,
      findings,
      summary,
      performedBy,
      performedAt: timestamp,
      status: 'completed',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    appendToArray(COMPLIANCE_AUDITS_KEY, auditRecord);

    // Update compliance status
    const statusRecord = {
      overallStatus: overallLevel,
      lastAuditId: auditId,
      lastAuditDate: timestamp,
      moduleStatuses: moduleResults,
      updatedAt: timestamp,
    };
    setItem(COMPLIANCE_STATUS_KEY, statusRecord);

    // Audit log
    const auditLogEntry = logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'compliance_audit',
        targetId: auditId,
        description: `Weekly C-SNP compliance audit completed. Overall level: ${overallLevel}. Violations: ${allViolations.length}, Warnings: ${allWarnings.length}, Recommendations: ${allRecommendations.length}`,
        metadata: {
          auditId,
          complianceLevel: overallLevel,
          totalViolations: allViolations.length,
          totalWarnings: allWarnings.length,
          totalRecommendations: allRecommendations.length,
          criticalViolations: allViolations.filter((v) => v.severity === 'critical').length,
        },
        ipAddress: '127.0.0.1',
      },
      'compliance'
    );

    return {
      success: true,
      auditId,
      complianceLevel: overallLevel,
      findings,
      summary,
      auditLogId: auditLogEntry ? auditLogEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('complianceService.runWeeklyAudit: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during the weekly audit' };
  }
}

/**
 * Retrieves the current compliance status across all modules.
 *
 * @returns {ComplianceStatusResult} The compliance status result
 */
export function getComplianceStatus() {
  const timestamp = new Date().toISOString();

  try {
    const storedStatus = getItem(COMPLIANCE_STATUS_KEY, null);
    const audits = getCollection(COMPLIANCE_AUDITS_KEY);

    // Get recent audits (last 10)
    const recentAudits = audits
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((audit) => ({
        id: audit.id,
        auditType: audit.auditType,
        complianceLevel: audit.complianceLevel,
        performedAt: audit.performedAt,
        totalViolations: audit.summary ? audit.summary.totalViolations : 0,
        totalWarnings: audit.summary ? audit.summary.totalWarnings : 0,
      }));

    // Get open findings from the most recent audit
    let openFindings = [];
    if (audits.length > 0) {
      const latestAudit = audits.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      if (Array.isArray(latestAudit.findings)) {
        openFindings = latestAudit.findings.filter(
          (f) => f.type === 'violation' || f.type === 'warning'
        );
      }
    }

    if (storedStatus && typeof storedStatus === 'object') {
      return {
        success: true,
        overallStatus: storedStatus.overallStatus || COMPLIANCE_LEVELS.COMPLIANT,
        moduleStatuses: storedStatus.moduleStatuses || {},
        recentAudits,
        openFindings,
        lastAuditDate: storedStatus.lastAuditDate || null,
        timestamp,
      };
    }

    // No stored status — return default
    return {
      success: true,
      overallStatus: COMPLIANCE_LEVELS.COMPLIANT,
      moduleStatuses: {},
      recentAudits,
      openFindings,
      lastAuditDate: null,
      timestamp,
    };
  } catch (error) {
    console.error('complianceService.getComplianceStatus: unexpected error:', error);
    return {
      success: false,
      overallStatus: COMPLIANCE_LEVELS.NON_COMPLIANT,
      moduleStatuses: {},
      recentAudits: [],
      openFindings: [],
      timestamp,
      error: 'An unexpected error occurred while retrieving compliance status',
    };
  }
}

/**
 * Generates an enrollment extract for CMS submission.
 * Produces a structured extract of all active enrollments with member,
 * benefit package, and diagnosis information.
 *
 * @param {Object} [options={}] - Extract options
 * @param {string} [options.performedBy] - User ID generating the extract
 * @param {string} [options.status] - Filter by enrollment status (default: active)
 * @param {string} [options.startDate] - Filter by enrollment date start
 * @param {string} [options.endDate] - Filter by enrollment date end
 * @returns {EnrollmentExtractResult} The enrollment extract result
 */
export function generateEnrollmentExtract(options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const statusFilter = (options && typeof options.status === 'string') ? options.status.trim() : ENROLLMENT_STATUSES.ACTIVE;

  const defaultResult = {
    success: false,
    extractId: null,
    recordCount: 0,
    records: [],
    summary: {},
    auditId: null,
    timestamp,
  };

  try {
    const enrollments = getCollection(ENROLLMENTS_KEY);
    const members = getCollection(MEMBERS_KEY);
    const benefitPackages = getCollection(BENEFIT_PACKAGES_KEY);

    // Filter enrollments
    let filteredEnrollments = enrollments.filter((e) => e.status === statusFilter);

    if (options && options.startDate && typeof options.startDate === 'string') {
      const startDateResult = validateDateFormat(options.startDate, 'Start date');
      if (startDateResult.valid) {
        filteredEnrollments = filterByDateRange(filteredEnrollments, 'createdAt', options.startDate, options.endDate || '2099-12-31');
      }
    }

    // Build extract records
    const records = [];
    const byConditionCategory = {};
    const byPlanType = {};
    const byChannel = {};

    for (const enrollment of filteredEnrollments) {
      const member = members.find((m) => m.id === enrollment.memberId);
      const benefitPackage = benefitPackages.find((p) => p.id === enrollment.benefitPackageId);

      const record = {
        enrollmentId: enrollment.id,
        memberId: enrollment.memberId,
        memberFirstName: member ? member.firstName : '',
        memberLastName: member ? member.lastName : '',
        memberDateOfBirth: member ? member.dateOfBirth : '',
        memberMedicareId: member ? member.medicareId : '',
        memberGender: member ? member.gender : '',
        memberState: member && member.address ? member.address.state : '',
        memberZipCode: member && member.address ? member.address.zipCode : '',
        conditionCategory: member ? member.conditionCategory : '',
        conditionCategoryLabel: member && member.conditionCategory
          ? (CONDITION_CATEGORY_LABELS[member.conditionCategory] || member.conditionCategory)
          : '',
        diagnosisCodes: enrollment.diagnosisCodesVerified || [],
        benefitPackageId: enrollment.benefitPackageId,
        benefitPackageName: benefitPackage ? benefitPackage.name : '',
        planType: enrollment.planType || '',
        enrollmentStatus: enrollment.status,
        enrollmentChannel: enrollment.channel || '',
        effectiveDate: enrollment.effectiveDate || '',
        terminationDate: enrollment.terminationDate || '',
        applicationDate: enrollment.applicationDate || '',
        approvalDate: enrollment.approvalDate || '',
        csnpEligible: member ? member.csnpEligible : false,
      };

      records.push(record);

      // Track summary stats
      const category = record.conditionCategory || 'unknown';
      if (!byConditionCategory[category]) {
        byConditionCategory[category] = 0;
      }
      byConditionCategory[category]++;

      const planType = record.planType || 'unknown';
      if (!byPlanType[planType]) {
        byPlanType[planType] = 0;
      }
      byPlanType[planType]++;

      const channel = record.enrollmentChannel || 'unknown';
      if (!byChannel[channel]) {
        byChannel[channel] = 0;
      }
      byChannel[channel]++;
    }

    const summary = {
      totalRecords: records.length,
      statusFilter,
      byConditionCategory,
      byPlanType,
      byChannel,
      extractDate: timestamp,
    };

    // Persist extract record
    const extractId = uuidv4();
    const extractRecord = {
      id: extractId,
      recordCount: records.length,
      summary,
      generatedBy: performedBy,
      generatedAt: timestamp,
      statusFilter,
      createdAt: timestamp,
    };

    appendToArray(ENROLLMENT_EXTRACTS_KEY, extractRecord);

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.EXPORT,
      performedBy,
      {
        targetType: 'enrollment_extract',
        targetId: extractId,
        description: `Enrollment extract generated. ${records.length} record(s) with status "${statusFilter}"`,
        metadata: {
          extractId,
          recordCount: records.length,
          statusFilter,
          byConditionCategory,
          byPlanType,
        },
        ipAddress: '127.0.0.1',
      },
      'compliance'
    );

    return {
      success: true,
      extractId,
      recordCount: records.length,
      records,
      summary,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('complianceService.generateEnrollmentExtract: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during enrollment extract generation' };
  }
}

/**
 * Validates CMS compliance for a specific module.
 * Runs targeted compliance checks and returns detailed results.
 *
 * @param {string} module - The module to validate from COMPLIANCE_MODULES
 * @param {Object} [options={}] - Validation options
 * @param {string} [options.performedBy] - User ID performing the validation
 * @returns {CMSComplianceValidationResult} The compliance validation result
 */
export function validateCMSCompliance(module, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    compliant: false,
    module: module || '',
    complianceLevel: COMPLIANCE_LEVELS.NON_COMPLIANT,
    violations: [],
    warnings: [],
    recommendations: [],
    auditId: null,
    timestamp,
  };

  // Validate module
  const moduleResult = validateRequired(module, 'Module');
  if (!moduleResult.valid) {
    return { ...defaultResult, error: moduleResult.error };
  }

  const trimmedModule = module.trim();
  const validModules = Object.values(COMPLIANCE_MODULES);
  if (!validModules.includes(trimmedModule)) {
    return {
      ...defaultResult,
      error: `Invalid module: "${trimmedModule}". Must be one of: ${validModules.join(', ')}`,
    };
  }

  try {
    let validationResult;

    switch (trimmedModule) {
      case COMPLIANCE_MODULES.ENROLLMENT:
        validationResult = validateEnrollmentCompliance();
        break;
      case COMPLIANCE_MODULES.CLAIMS:
        validationResult = validateClaimsCompliance();
        break;
      case COMPLIANCE_MODULES.ELIGIBILITY:
        validationResult = validateEligibilityCompliance();
        break;
      case COMPLIANCE_MODULES.BENEFITS:
        validationResult = validateBenefitsCompliance();
        break;
      case COMPLIANCE_MODULES.PROVIDERS:
        validationResult = validateProvidersCompliance();
        break;
      case COMPLIANCE_MODULES.CARE_MANAGEMENT:
        validationResult = validateCareManagementCompliance();
        break;
      case COMPLIANCE_MODULES.AUDIT_TRAIL:
        validationResult = validateAuditTrailCompliance();
        break;
      default:
        return { ...defaultResult, error: `Unsupported module: "${trimmedModule}"` };
    }

    const complianceLevel = determineComplianceLevel(validationResult.violations, validationResult.warnings);
    const isCompliant = complianceLevel === COMPLIANCE_LEVELS.COMPLIANT;

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'compliance_validation',
        targetId: trimmedModule,
        description: `CMS compliance validation for module "${trimmedModule}". Level: ${complianceLevel}. Violations: ${validationResult.violations.length}, Warnings: ${validationResult.warnings.length}`,
        metadata: {
          module: trimmedModule,
          complianceLevel,
          compliant: isCompliant,
          violationCount: validationResult.violations.length,
          warningCount: validationResult.warnings.length,
          recommendationCount: validationResult.recommendations.length,
        },
        ipAddress: '127.0.0.1',
      },
      'compliance'
    );

    return {
      compliant: isCompliant,
      module: trimmedModule,
      complianceLevel,
      violations: validationResult.violations,
      warnings: validationResult.warnings,
      recommendations: validationResult.recommendations,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('complianceService.validateCMSCompliance: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during compliance validation' };
  }
}

/**
 * Retrieves all compliance reports from localStorage.
 *
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.reportType] - Filter by report type
 * @returns {Object[]} Array of compliance report records
 */
export function getComplianceReports(filters = {}) {
  try {
    let reports = getCollection(COMPLIANCE_REPORTS_KEY);

    if (filters && typeof filters.reportType === 'string' && filters.reportType.trim().length > 0) {
      reports = reports.filter((r) => r.reportType === filters.reportType.trim());
    }

    return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('complianceService.getComplianceReports: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves all compliance audit records from localStorage.
 *
 * @returns {Object[]} Array of compliance audit records
 */
export function getComplianceAudits() {
  try {
    const audits = getCollection(COMPLIANCE_AUDITS_KEY);
    return audits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('complianceService.getComplianceAudits: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves all enrollment extract records from localStorage.
 *
 * @returns {Object[]} Array of enrollment extract records
 */
export function getEnrollmentExtracts() {
  try {
    const extracts = getCollection(ENROLLMENT_EXTRACTS_KEY);
    return extracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('complianceService.getEnrollmentExtracts: unexpected error:', error);
    return [];
  }
}

/**
 * Returns compliance statistics across all modules.
 *
 * @returns {{ totalReports: number, totalAudits: number, totalExtracts: number, overallStatus: string, lastAuditDate: string|null, moduleStatuses: Object }}
 */
export function getComplianceStats() {
  try {
    const reports = getCollection(COMPLIANCE_REPORTS_KEY);
    const audits = getCollection(COMPLIANCE_AUDITS_KEY);
    const extracts = getCollection(ENROLLMENT_EXTRACTS_KEY);
    const status = getItem(COMPLIANCE_STATUS_KEY, null);

    return {
      totalReports: reports.length,
      totalAudits: audits.length,
      totalExtracts: extracts.length,
      overallStatus: status ? (status.overallStatus || COMPLIANCE_LEVELS.COMPLIANT) : COMPLIANCE_LEVELS.COMPLIANT,
      lastAuditDate: status ? (status.lastAuditDate || null) : null,
      moduleStatuses: status ? (status.moduleStatuses || {}) : {},
    };
  } catch (error) {
    console.error('complianceService.getComplianceStats: unexpected error:', error);
    return {
      totalReports: 0,
      totalAudits: 0,
      totalExtracts: 0,
      overallStatus: COMPLIANCE_LEVELS.COMPLIANT,
      lastAuditDate: null,
      moduleStatuses: {},
    };
  }
}

/**
 * Retrieves a specific compliance report by ID.
 *
 * @param {string} reportId - The report ID
 * @returns {Object|null} The compliance report or null
 */
export function getComplianceReportById(reportId) {
  if (typeof reportId !== 'string' || reportId.trim().length === 0) {
    return null;
  }

  try {
    return findInArray(COMPLIANCE_REPORTS_KEY, (r) => r.id === reportId.trim());
  } catch (error) {
    console.error('complianceService.getComplianceReportById: unexpected error:', error);
    return null;
  }
}

/**
 * Retrieves a specific compliance audit by ID.
 *
 * @param {string} auditId - The audit ID
 * @returns {Object|null} The compliance audit or null
 */
export function getComplianceAuditById(auditId) {
  if (typeof auditId !== 'string' || auditId.trim().length === 0) {
    return null;
  }

  try {
    return findInArray(COMPLIANCE_AUDITS_KEY, (a) => a.id === auditId.trim());
  } catch (error) {
    console.error('complianceService.getComplianceAuditById: unexpected error:', error);
    return null;
  }
}

/**
 * Runs a full compliance validation across all modules and returns a consolidated result.
 *
 * @param {Object} [options={}] - Validation options
 * @param {string} [options.performedBy] - User ID performing the validation
 * @returns {{ compliant: boolean, overallLevel: string, moduleResults: Object.<string, CMSComplianceValidationResult>, timestamp: string }}
 */
export function runFullComplianceValidation(options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const moduleResults = {};
  let allViolations = 0;
  let allWarnings = 0;

  const validModules = Object.values(COMPLIANCE_MODULES);

  for (const mod of validModules) {
    const result = validateCMSCompliance(mod, { performedBy });
    moduleResults[mod] = result;
    allViolations += result.violations.length;
    allWarnings += result.warnings.length;
  }

  const allViolationsList = [];
  const allWarningsList = [];

  for (const mod of validModules) {
    allViolationsList.push(...moduleResults[mod].violations);
    allWarningsList.push(...moduleResults[mod].warnings);
  }

  const overallLevel = determineComplianceLevel(allViolationsList, allWarningsList);
  const isCompliant = overallLevel === COMPLIANCE_LEVELS.COMPLIANT;

  return {
    compliant: isCompliant,
    overallLevel,
    totalViolations: allViolations,
    totalWarnings: allWarnings,
    moduleResults,
    timestamp,
  };
}