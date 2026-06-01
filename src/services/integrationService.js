/**
 * External system integration adapters for the CSNP Portal.
 * Provides simulated adapters for VCC (document validation), ICoE (data enrichment),
 * IKA (CMS submission), GuidingCare (care platform), HL7/FHIR (data exchange),
 * NASCO (claims), Facets (billing), and Prior Auth APIs.
 * Each adapter returns simulated responses with realistic delays.
 * @module integrationService
 */

import { v4 as uuidv4 } from 'uuid';
import { logAction } from './auditLogger.js';
import { AUDIT_ACTIONS } from '../utils/constants.js';
import {
  getCodeByICD10,
  CONDITION_CATEGORY_LABELS,
} from '../data/icd10Data.js';

// ─── Simulated Delay Helper ────────────────────────────────────────────────

/**
 * Returns a promise that resolves after a simulated delay.
 * @param {number} [minMs=100] - Minimum delay in milliseconds
 * @param {number} [maxMs=500] - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
function simulateDelay(minMs = 100, maxMs = 500) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Generates a simulated transaction ID with a given prefix.
 * @param {string} prefix - The prefix for the transaction ID
 * @returns {string} A simulated transaction ID
 */
function generateTransactionId(prefix) {
  const ts = Date.now();
  const suffix = uuidv4().substring(0, 8).toUpperCase();
  return `${prefix}-${ts}-${suffix}`;
}

// ─── Integration Status Enum ────────────────────────────────────────────────

/**
 * Integration response statuses.
 * @enum {string}
 */
export const INTEGRATION_STATUSES = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  PARTIAL: 'partial',
  TIMEOUT: 'timeout',
  PENDING: 'pending',
});

/**
 * External system identifiers.
 * @enum {string}
 */
export const EXTERNAL_SYSTEMS = Object.freeze({
  VCC: 'VCC',
  ICOE: 'ICoE',
  IKA: 'IKA',
  GUIDING_CARE: 'GuidingCare',
  HL7_FHIR: 'HL7/FHIR',
  NASCO: 'NASCO',
  FACETS: 'Facets',
  PRIOR_AUTH: 'PriorAuth',
  CDM: 'CDM',
  NCOMPASS: 'NCompass',
});

/**
 * @typedef {Object} IntegrationResponse
 * @property {boolean} success - Whether the integration call succeeded
 * @property {string} system - The external system identifier
 * @property {string} transactionId - Unique transaction identifier
 * @property {string} status - Integration status from INTEGRATION_STATUSES
 * @property {Object|null} data - Response data from the external system
 * @property {string|null} error - Error message if the call failed
 * @property {number} latencyMs - Simulated latency in milliseconds
 * @property {string} timestamp - ISO timestamp of the response
 */

/**
 * Creates a standard integration response object.
 * @param {string} system - The external system identifier
 * @param {boolean} success - Whether the call succeeded
 * @param {string} status - Integration status
 * @param {Object|null} data - Response data
 * @param {string|null} error - Error message
 * @param {number} latencyMs - Latency in milliseconds
 * @returns {IntegrationResponse}
 */
function createIntegrationResponse(system, success, status, data, error, latencyMs) {
  return {
    success,
    system,
    transactionId: generateTransactionId(system),
    status,
    data,
    error,
    latencyMs,
    timestamp: new Date().toISOString(),
  };
}

// ─── VCC (Verification & Compliance Center) Adapter ─────────────────────────

/**
 * @typedef {Object} VCCDocumentValidationRequest
 * @property {string} enrollmentId - The enrollment ID
 * @property {Object[]} documents - Array of document objects
 * @property {string} [documents[].name] - Document name
 * @property {string} [documents[].type] - Document type
 * @property {string} [documents[].content] - Document content or reference
 * @property {number} [documents[].size] - Document size in bytes
 */

/**
 * @typedef {Object} VCCDocumentValidationResponse
 * @property {boolean} allValid - Whether all documents passed validation
 * @property {Object[]} results - Individual document validation results
 * @property {string} complianceStatus - Overall compliance status
 * @property {string[]} requiredDocuments - List of required documents still missing
 * @property {string} validationId - VCC validation reference ID
 */

/**
 * Simulates VCC document validation for enrollment compliance.
 * Validates document types, completeness, and compliance requirements.
 *
 * @param {VCCDocumentValidationRequest} request - The validation request
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The VCC validation response
 */
export async function vccValidateDocuments(request, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(200, 800);

    if (!request || typeof request !== 'object') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.VCC,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'VCC validation request is required',
        latency
      );
    }

    const documents = Array.isArray(request.documents) ? request.documents : [];
    const enrollmentId = (typeof request.enrollmentId === 'string') ? request.enrollmentId.trim() : '';

    const validDocumentTypes = [
      'medical_record',
      'physician_attestation',
      'diagnosis_verification',
      'enrollment_form',
      'consent_form',
      'identification',
      'medicare_card',
      'power_of_attorney',
      'advance_directive',
    ];

    const requiredDocumentTypes = [
      'enrollment_form',
      'diagnosis_verification',
    ];

    const results = documents.map((doc) => {
      if (!doc || typeof doc !== 'object') {
        return {
          documentName: 'unknown',
          documentType: 'unknown',
          valid: false,
          reason: 'Invalid document object',
          complianceCheck: 'failed',
        };
      }

      const docName = doc.name || doc.fileName || 'unnamed';
      const docType = doc.type || doc.documentType || '';
      const docSize = typeof doc.size === 'number' ? doc.size : 0;

      const isRecognizedType = validDocumentTypes.some(
        (t) => docType.toLowerCase().includes(t) || docName.toLowerCase().includes(t)
      );

      const isTooLarge = docSize > 25 * 1024 * 1024; // 25MB limit

      let valid = true;
      let reason = 'Document validated successfully';
      let complianceCheck = 'passed';

      if (!isRecognizedType && docName === 'unnamed') {
        valid = false;
        reason = 'Document type not recognized and no name provided';
        complianceCheck = 'failed';
      } else if (isTooLarge) {
        valid = false;
        reason = 'Document exceeds maximum file size of 25MB';
        complianceCheck = 'failed';
      }

      return {
        documentName: docName,
        documentType: docType,
        valid,
        reason,
        complianceCheck,
        validatedAt: new Date().toISOString(),
      };
    });

    const allValid = results.length > 0 && results.every((r) => r.valid);

    const submittedTypes = documents.map((doc) => {
      if (!doc || typeof doc !== 'object') {
        return '';
      }
      return (doc.type || doc.documentType || doc.name || '').toLowerCase();
    });

    const requiredDocuments = requiredDocumentTypes.filter((reqType) => {
      return !submittedTypes.some((submitted) => submitted.includes(reqType));
    });

    let complianceStatus = 'compliant';
    if (!allValid) {
      complianceStatus = 'non_compliant';
    } else if (requiredDocuments.length > 0) {
      complianceStatus = 'incomplete';
    }

    const validationId = generateTransactionId('VCC-VAL');

    const responseData = {
      allValid,
      results,
      complianceStatus,
      requiredDocuments,
      validationId,
      enrollmentId,
      totalDocuments: documents.length,
      validDocuments: results.filter((r) => r.valid).length,
      invalidDocuments: results.filter((r) => !r.valid).length,
    };

    const latency = Date.now() - startTime;

    logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'vcc_validation',
        targetId: validationId,
        description: `VCC document validation completed for enrollment ${enrollmentId}. Status: ${complianceStatus}. Valid: ${responseData.validDocuments}/${responseData.totalDocuments}`,
        metadata: {
          system: EXTERNAL_SYSTEMS.VCC,
          validationId,
          enrollmentId,
          complianceStatus,
          totalDocuments: responseData.totalDocuments,
          validDocuments: responseData.validDocuments,
          latencyMs: latency,
        },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.VCC,
      true,
      allValid ? INTEGRATION_STATUSES.SUCCESS : INTEGRATION_STATUSES.PARTIAL,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.vccValidateDocuments: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.VCC,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during VCC document validation',
      latency
    );
  }
}

// ─── ICoE (Integration Center of Excellence) Adapter ────────────────────────

/**
 * @typedef {Object} ICoEEnrichmentRequest
 * @property {string} memberId - The member ID
 * @property {string} [firstName] - First name
 * @property {string} [lastName] - Last name
 * @property {string} [dateOfBirth] - Date of birth (YYYY-MM-DD)
 * @property {string} [medicareId] - Medicare Beneficiary Identifier
 * @property {string[]} [diagnosisCodes] - ICD-10 diagnosis codes
 * @property {Object} [address] - Member address
 */

/**
 * @typedef {Object} ICoEEnrichmentResponse
 * @property {boolean} enriched - Whether data was enriched
 * @property {Object} enrichedData - The enriched member data
 * @property {string[]} enrichedFields - List of fields that were enriched
 * @property {Object} verificationResults - Verification results for each data point
 * @property {string} enrichmentId - ICoE enrichment reference ID
 */

/**
 * Simulates ICoE data enrichment for member records.
 * Enriches member data with Medicare eligibility confirmation,
 * demographic verification, address standardization, and risk scoring.
 *
 * @param {ICoEEnrichmentRequest} request - The enrichment request
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The ICoE enrichment response
 */
export async function icoeEnrichData(request, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(300, 1000);

    if (!request || typeof request !== 'object') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.ICOE,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'ICoE enrichment request is required',
        latency
      );
    }

    const enrichedData = { ...request };
    const enrichedFields = [];
    const verificationResults = {};

    // Medicare eligibility confirmation
    if (request.medicareId && typeof request.medicareId === 'string') {
      enrichedData.medicareEligibilityConfirmed = true;
      enrichedData.medicareEligibilityDate = new Date().toISOString();
      enrichedData.medicarePartAActive = true;
      enrichedData.medicarePartBActive = true;
      enrichedFields.push('medicareEligibilityConfirmed', 'medicareEligibilityDate', 'medicarePartAActive', 'medicarePartBActive');
      verificationResults.medicareEligibility = {
        verified: true,
        source: 'CMS MBI Lookup',
        verifiedAt: new Date().toISOString(),
      };
    }

    // Demographic verification
    if (request.firstName && request.lastName) {
      enrichedData.demographicVerified = true;
      enrichedData.demographicVerificationDate = new Date().toISOString();
      enrichedData.nameStandardized = true;
      enrichedFields.push('demographicVerified', 'demographicVerificationDate', 'nameStandardized');
      verificationResults.demographics = {
        verified: true,
        source: 'SSA Master Death File / NPPES',
        verifiedAt: new Date().toISOString(),
      };
    }

    // Address standardization
    if (request.address && typeof request.address === 'object' && request.address.zipCode) {
      enrichedData.addressStandardized = true;
      enrichedData.addressVerified = true;
      enrichedData.addressVerificationDate = new Date().toISOString();

      const zipPrefix = request.address.zipCode.substring(0, 3);
      const zipNum = parseInt(zipPrefix, 10);
      let serviceArea = 'GENERAL';
      let county = 'Unknown County';

      if (zipNum >= 600 && zipNum <= 629) {
        serviceArea = 'IL-CENTRAL';
        county = 'Sangamon County';
      }
      if (zipNum >= 606 && zipNum <= 608) {
        serviceArea = 'IL-CHICAGO-METRO';
        county = 'Cook County';
      }
      if (zipNum >= 600 && zipNum <= 605) {
        serviceArea = 'IL-NORTH';
        county = 'Lake County';
      }

      enrichedData.serviceArea = serviceArea;
      enrichedData.county = county;
      enrichedData.fipsCode = `17${String(Math.floor(Math.random() * 200)).padStart(3, '0')}`;

      enrichedFields.push('addressStandardized', 'addressVerified', 'addressVerificationDate', 'serviceArea', 'county', 'fipsCode');
      verificationResults.address = {
        verified: true,
        source: 'USPS Address Standardization API',
        serviceArea,
        county,
        verifiedAt: new Date().toISOString(),
      };
    }

    // Risk score calculation
    if (Array.isArray(request.diagnosisCodes) && request.diagnosisCodes.length > 0) {
      let riskScore = Math.min(request.diagnosisCodes.length * 15, 60);
      const highSeverityPrefixes = ['N18.5', 'N18.6', 'C', 'I50', 'G30', 'B20'];

      for (const code of request.diagnosisCodes) {
        if (typeof code !== 'string') {
          continue;
        }
        const trimmed = code.trim().toUpperCase();
        for (const prefix of highSeverityPrefixes) {
          if (trimmed.startsWith(prefix)) {
            riskScore += 10;
            break;
          }
        }
      }

      riskScore = Math.min(riskScore, 100);

      let riskCategory = 'low';
      if (riskScore >= 75) {
        riskCategory = 'very_high';
      } else if (riskScore >= 50) {
        riskCategory = 'high';
      } else if (riskScore >= 25) {
        riskCategory = 'moderate';
      }

      enrichedData.riskScore = riskScore;
      enrichedData.riskCategory = riskCategory;
      enrichedData.hccScore = Math.round(riskScore * 0.85 * 100) / 100;
      enrichedFields.push('riskScore', 'riskCategory', 'hccScore');
      verificationResults.riskAssessment = {
        calculated: true,
        source: 'CMS-HCC Risk Adjustment Model',
        riskScore,
        riskCategory,
        calculatedAt: new Date().toISOString(),
      };
    }

    // Date of birth verification
    if (request.dateOfBirth && typeof request.dateOfBirth === 'string') {
      enrichedData.dobVerified = true;
      enrichedFields.push('dobVerified');
      verificationResults.dateOfBirth = {
        verified: true,
        source: 'SSA Enumeration System',
        verifiedAt: new Date().toISOString(),
      };
    }

    const enrichmentId = generateTransactionId('ICOE-ENR');

    const responseData = {
      enriched: enrichedFields.length > 0,
      enrichedData,
      enrichedFields,
      verificationResults,
      enrichmentId,
      memberId: request.memberId || null,
      totalFieldsEnriched: enrichedFields.length,
    };

    const latency = Date.now() - startTime;

    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy,
      {
        targetType: 'icoe_enrichment',
        targetId: enrichmentId,
        description: `ICoE data enrichment completed for member ${request.memberId || 'unknown'}. ${enrichedFields.length} field(s) enriched.`,
        metadata: {
          system: EXTERNAL_SYSTEMS.ICOE,
          enrichmentId,
          memberId: request.memberId || null,
          enrichedFieldCount: enrichedFields.length,
          latencyMs: latency,
        },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.ICOE,
      true,
      INTEGRATION_STATUSES.SUCCESS,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.icoeEnrichData: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.ICOE,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during ICoE data enrichment',
      latency
    );
  }
}

// ─── IKA (Integration Key Architecture) CMS Submission Adapter ──────────────

/**
 * @typedef {Object} IKASubmissionRequest
 * @property {string} enrollmentId - The enrollment ID
 * @property {string} memberId - The member ID
 * @property {string} medicareId - Medicare Beneficiary Identifier
 * @property {string} planType - Plan type
 * @property {string} benefitPackageId - Benefit package ID
 * @property {string} effectiveDate - Effective date (YYYY-MM-DD)
 * @property {string[]} diagnosisCodesVerified - Verified ICD-10 codes
 * @property {string} channel - Enrollment channel
 * @property {string} applicationDate - Application date (YYYY-MM-DD)
 */

/**
 * @typedef {Object} IKASubmissionResponse
 * @property {string} cmsTransactionId - CMS transaction ID
 * @property {string} submissionStatus - Submission status
 * @property {string} confirmationNumber - CMS confirmation number
 * @property {string|null} trrExpectedDate - Expected TRR response date
 * @property {Object} submissionDetails - Detailed submission information
 */

/**
 * Simulates IKA CMS enrollment submission.
 * Submits enrollment data to CMS via the IKA platform and returns
 * a simulated CMS transaction response.
 *
 * @param {IKASubmissionRequest} request - The submission request
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The IKA submission response
 */
export async function ikaSubmitToCMS(request, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(500, 1500);

    if (!request || typeof request !== 'object') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.IKA,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'IKA submission request is required',
        latency
      );
    }

    if (!request.enrollmentId || !request.memberId || !request.medicareId) {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.IKA,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'IKA submission requires enrollmentId, memberId, and medicareId',
        latency
      );
    }

    const cmsTransactionId = generateTransactionId('CMS-TXN');
    const confirmationNumber = `CNF-${Date.now().toString(36).toUpperCase()}-${uuidv4().substring(0, 6).toUpperCase()}`;

    // Calculate expected TRR response date (3-5 business days)
    const trrDate = new Date();
    trrDate.setDate(trrDate.getDate() + Math.floor(Math.random() * 3) + 3);
    const trrYear = trrDate.getFullYear();
    const trrMonth = String(trrDate.getMonth() + 1).padStart(2, '0');
    const trrDay = String(trrDate.getDate()).padStart(2, '0');
    const trrExpectedDate = `${trrYear}-${trrMonth}-${trrDay}`;

    const submissionDetails = {
      submittedAt: new Date().toISOString(),
      enrollmentId: request.enrollmentId,
      memberId: request.memberId,
      medicareId: request.medicareId,
      planType: request.planType || 'C-SNP',
      effectiveDate: request.effectiveDate || null,
      applicationDate: request.applicationDate || null,
      channel: request.channel || 'unknown',
      diagnosisCodesCount: Array.isArray(request.diagnosisCodesVerified) ? request.diagnosisCodesVerified.length : 0,
      cmsReceiptTimestamp: new Date().toISOString(),
      batchId: `BATCH-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
    };

    const responseData = {
      cmsTransactionId,
      submissionStatus: 'accepted',
      confirmationNumber,
      trrExpectedDate,
      submissionDetails,
    };

    const latency = Date.now() - startTime;

    logAction(
      AUDIT_ACTIONS.SUBMIT,
      performedBy,
      {
        targetType: 'ika_submission',
        targetId: cmsTransactionId,
        description: `IKA CMS submission completed for enrollment ${request.enrollmentId}. CMS Transaction: ${cmsTransactionId}. Confirmation: ${confirmationNumber}`,
        metadata: {
          system: EXTERNAL_SYSTEMS.IKA,
          cmsTransactionId,
          confirmationNumber,
          enrollmentId: request.enrollmentId,
          memberId: request.memberId,
          trrExpectedDate,
          latencyMs: latency,
        },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.IKA,
      true,
      INTEGRATION_STATUSES.SUCCESS,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.ikaSubmitToCMS: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.IKA,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during IKA CMS submission',
      latency
    );
  }
}

/**
 * Simulates IKA TRR (Transaction Reply Report) response processing.
 * Processes the CMS TRR response for a previously submitted enrollment.
 *
 * @param {string} cmsTransactionId - The CMS transaction ID from the original submission
 * @param {Object} [enrollmentContext={}] - Enrollment context for response determination
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The TRR response
 */
export async function ikaProcessTRR(cmsTransactionId, enrollmentContext, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(200, 600);

    if (typeof cmsTransactionId !== 'string' || cmsTransactionId.trim().length === 0) {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.IKA,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'CMS transaction ID is required for TRR processing',
        latency
      );
    }

    const context = enrollmentContext || {};
    const hasValidDiagnosis = Array.isArray(context.diagnosisCodesVerified) && context.diagnosisCodesVerified.length > 0;

    let accepted = true;
    let responseCode = 'TRR-ACC-000';
    let responseMessage = 'Enrollment accepted by CMS';
    let dispositionCode = '01';
    let dispositionDescription = 'Accepted - Enrollment Effective';

    if (!hasValidDiagnosis) {
      accepted = false;
      responseCode = 'TRR-REJ-002';
      responseMessage = 'Enrollment rejected: insufficient diagnosis documentation';
      dispositionCode = '51';
      dispositionDescription = 'Rejected - Missing Required Documentation';
    }

    const responseData = {
      accepted,
      responseCode,
      responseMessage,
      cmsTransactionId: cmsTransactionId.trim(),
      trrId: generateTransactionId('TRR'),
      dispositionCode,
      dispositionDescription,
      processedAt: new Date().toISOString(),
      enrollmentId: context.enrollmentId || null,
      memberId: context.memberId || null,
      effectiveDate: accepted ? (context.effectiveDate || null) : null,
    };

    const latency = Date.now() - startTime;

    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy,
      {
        targetType: 'ika_trr',
        targetId: responseData.trrId,
        description: `IKA TRR processed for transaction ${cmsTransactionId.trim()}. ${accepted ? 'Accepted' : 'Rejected'}: ${responseMessage}`,
        metadata: {
          system: EXTERNAL_SYSTEMS.IKA,
          trrId: responseData.trrId,
          cmsTransactionId: cmsTransactionId.trim(),
          accepted,
          responseCode,
          dispositionCode,
          latencyMs: latency,
        },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.IKA,
      true,
      accepted ? INTEGRATION_STATUSES.SUCCESS : INTEGRATION_STATUSES.PARTIAL,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.ikaProcessTRR: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.IKA,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during TRR processing',
      latency
    );
  }
}

// ─── GuidingCare (Care Management Platform) Adapter ─────────────────────────

/**
 * @typedef {Object} GuidingCareReferralRequest
 * @property {string} memberId - The member ID
 * @property {string} memberName - The member full name
 * @property {string} conditionCategory - Primary condition category
 * @property {string[]} diagnosisCodes - ICD-10 diagnosis codes
 * @property {string} [careManagerId] - Assigned care manager ID
 * @property {string} [referralReason] - Reason for care management referral
 * @property {string} [urgency] - Urgency level (routine, urgent, emergent)
 */

/**
 * @typedef {Object} GuidingCareResponse
 * @property {string} gcReferralId - GuidingCare referral ID
 * @property {string} gcMemberId - GuidingCare member ID
 * @property {string} programEnrolled - Care program enrolled
 * @property {string} assignedCareManager - Assigned care manager name
 * @property {string} initialAssessmentDue - Date initial assessment is due
 * @property {Object} carePlanTemplate - Recommended care plan template
 */

/**
 * Simulates GuidingCare care management platform integration.
 * Creates a care management referral and enrolls the member in
 * the appropriate care program.
 *
 * @param {GuidingCareReferralRequest} request - The referral request
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The GuidingCare response
 */
export async function guidingCareCreateReferral(request, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(300, 900);

    if (!request || typeof request !== 'object') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.GUIDING_CARE,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'GuidingCare referral request is required',
        latency
      );
    }

    if (!request.memberId || typeof request.memberId !== 'string') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.GUIDING_CARE,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'Member ID is required for GuidingCare referral',
        latency
      );
    }

    const gcReferralId = generateTransactionId('GC-REF');
    const gcMemberId = `GC-MBR-${request.memberId.substring(0, 8).toUpperCase()}`;

    const conditionCategory = request.conditionCategory || 'general';
    const conditionLabel = CONDITION_CATEGORY_LABELS[conditionCategory] || conditionCategory;

    const programMap = {
      diabetes: 'Diabetes Care Management Program',
      heart_failure: 'Heart Failure Care Management Program',
      copd: 'Respiratory Care Management Program',
      chronic_kidney_disease: 'Renal Care Management Program',
      esrd: 'ESRD Comprehensive Care Program',
      dementia: 'Cognitive Health Care Program',
      mental_health: 'Behavioral Health Care Program',
      cardiovascular: 'Cardiovascular Care Management Program',
      cancer: 'Oncology Care Management Program',
      autoimmune: 'Autoimmune Disease Care Program',
      hiv_aids: 'HIV/AIDS Care Management Program',
      liver_disease: 'Hepatic Care Management Program',
      respiratory: 'Respiratory Care Management Program',
      neurological: 'Neurological Care Management Program',
      stroke: 'Stroke Recovery Care Program',
    };

    const programEnrolled = programMap[conditionCategory] || 'General Chronic Condition Care Program';

    // Calculate initial assessment due date (within 30 days)
    const assessmentDue = new Date();
    assessmentDue.setDate(assessmentDue.getDate() + 30);
    const assessYear = assessmentDue.getFullYear();
    const assessMonth = String(assessmentDue.getMonth() + 1).padStart(2, '0');
    const assessDay = String(assessmentDue.getDate()).padStart(2, '0');
    const initialAssessmentDue = `${assessYear}-${assessMonth}-${assessDay}`;

    const urgency = request.urgency || 'routine';
    const assignedCareManager = request.careManagerId
      ? `Care Manager (${request.careManagerId.substring(0, 8)})`
      : 'Auto-Assigned Care Manager';

    const carePlanTemplate = {
      templateId: `TPL-${conditionCategory.toUpperCase().replace(/_/g, '-')}`,
      templateName: `${conditionLabel} Care Plan Template`,
      goalCount: Math.floor(Math.random() * 4) + 4,
      interventionCount: Math.floor(Math.random() * 6) + 5,
      assessmentFrequency: urgency === 'emergent' ? 'weekly' : urgency === 'urgent' ? 'biweekly' : 'monthly',
    };

    const responseData = {
      gcReferralId,
      gcMemberId,
      programEnrolled,
      assignedCareManager,
      initialAssessmentDue,
      carePlanTemplate,
      conditionCategory,
      conditionLabel,
      urgency,
      referralStatus: 'accepted',
      memberName: request.memberName || 'Unknown',
      diagnosisCodesCount: Array.isArray(request.diagnosisCodes) ? request.diagnosisCodes.length : 0,
      createdAt: new Date().toISOString(),
    };

    const latency = Date.now() - startTime;

    logAction(
      AUDIT_ACTIONS.REFERRAL_CREATE,
      performedBy,
      {
        targetType: 'guiding_care_referral',
        targetId: gcReferralId,
        description: `GuidingCare referral created for member ${request.memberId}. Program: ${programEnrolled}. Assessment due: ${initialAssessmentDue}`,
        metadata: {
          system: EXTERNAL_SYSTEMS.GUIDING_CARE,
          gcReferralId,
          gcMemberId,
          memberId: request.memberId,
          programEnrolled,
          urgency,
          latencyMs: latency,
        },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.GUIDING_CARE,
      true,
      INTEGRATION_STATUSES.SUCCESS,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.guidingCareCreateReferral: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.GUIDING_CARE,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during GuidingCare referral creation',
      latency
    );
  }
}

// ─── HL7/FHIR (Data Exchange) Adapter ───────────────────────────────────────

/**
 * @typedef {Object} FHIRPatientResource
 * @property {string} resourceType - Always 'Patient'
 * @property {string} id - Patient resource ID
 * @property {Object[]} identifier - Patient identifiers
 * @property {Object[]} name - Patient name
 * @property {string} gender - Patient gender
 * @property {string} birthDate - Date of birth
 * @property {Object[]} address - Patient address
 * @property {Object[]} telecom - Contact information
 */

/**
 * Simulates HL7/FHIR data exchange for member data.
 * Converts member data to FHIR Patient resource format and
 * simulates a FHIR server interaction.
 *
 * @param {string} operation - The FHIR operation ('read', 'search', 'create', 'update')
 * @param {Object} data - The data for the operation
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The FHIR response
 */
export async function fhirExchange(operation, data, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(150, 700);

    const validOperations = ['read', 'search', 'create', 'update'];
    if (typeof operation !== 'string' || !validOperations.includes(operation.trim().toLowerCase())) {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.HL7_FHIR,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        `Invalid FHIR operation: "${operation}". Must be one of: ${validOperations.join(', ')}`,
        latency
      );
    }

    if (!data || typeof data !== 'object') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.HL7_FHIR,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'FHIR operation data is required',
        latency
      );
    }

    const op = operation.trim().toLowerCase();
    let responseData = null;

    switch (op) {
      case 'read':
      case 'search': {
        const patientResource = buildFHIRPatientResource(data);
        const conditionResources = buildFHIRConditionResources(data);

        responseData = {
          resourceType: 'Bundle',
          type: op === 'read' ? 'document' : 'searchset',
          total: 1 + conditionResources.length,
          entry: [
            {
              resource: patientResource,
              fullUrl: `urn:uuid:${patientResource.id}`,
            },
            ...conditionResources.map((condition) => ({
              resource: condition,
              fullUrl: `urn:uuid:${condition.id}`,
            })),
          ],
          timestamp: new Date().toISOString(),
        };
        break;
      }
      case 'create':
      case 'update': {
        const patientResource = buildFHIRPatientResource(data);
        responseData = {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'information',
              code: 'informational',
              diagnostics: `Patient resource ${op === 'create' ? 'created' : 'updated'} successfully`,
            },
          ],
          resource: patientResource,
          location: `Patient/${patientResource.id}`,
          etag: `W/"${Date.now()}"`,
          lastModified: new Date().toISOString(),
        };
        break;
      }
      default:
        break;
    }

    const latency = Date.now() - startTime;

    logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'fhir_exchange',
        targetId: data.memberId || data.id || '',
        description: `FHIR ${op} operation completed for ${data.memberId || data.id || 'unknown'}`,
        metadata: {
          system: EXTERNAL_SYSTEMS.HL7_FHIR,
          operation: op,
          memberId: data.memberId || data.id || null,
          latencyMs: latency,
        },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.HL7_FHIR,
      true,
      INTEGRATION_STATUSES.SUCCESS,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.fhirExchange: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.HL7_FHIR,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during FHIR data exchange',
      latency
    );
  }
}

/**
 * Builds a FHIR Patient resource from member data.
 * @param {Object} memberData - The member data
 * @returns {FHIRPatientResource} FHIR Patient resource
 */
function buildFHIRPatientResource(memberData) {
  const id = memberData.memberId || memberData.id || uuidv4();

  const identifiers = [];
  if (memberData.medicareId) {
    identifiers.push({
      system: 'http://hl7.org/fhir/sid/us-mbi',
      value: memberData.medicareId,
      type: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MC', display: 'Medicare Number' }],
      },
    });
  }

  const names = [];
  if (memberData.firstName || memberData.lastName) {
    names.push({
      use: 'official',
      family: memberData.lastName || '',
      given: memberData.firstName ? [memberData.firstName] : [],
    });
  }

  const addresses = [];
  if (memberData.address && typeof memberData.address === 'object') {
    addresses.push({
      use: 'home',
      line: memberData.address.street ? [memberData.address.street] : [],
      city: memberData.address.city || '',
      state: memberData.address.state || '',
      postalCode: memberData.address.zipCode || '',
      country: 'US',
    });
  }

  const telecoms = [];
  if (memberData.phone) {
    telecoms.push({ system: 'phone', value: memberData.phone, use: 'home' });
  }
  if (memberData.email) {
    telecoms.push({ system: 'email', value: memberData.email, use: 'home' });
  }

  let gender = 'unknown';
  if (memberData.gender) {
    const g = memberData.gender.toLowerCase();
    if (g === 'male' || g === 'm') {
      gender = 'male';
    } else if (g === 'female' || g === 'f') {
      gender = 'female';
    } else {
      gender = 'other';
    }
  }

  return {
    resourceType: 'Patient',
    id,
    identifier: identifiers,
    name: names,
    gender,
    birthDate: memberData.dateOfBirth || null,
    address: addresses,
    telecom: telecoms,
    meta: {
      lastUpdated: new Date().toISOString(),
      versionId: '1',
    },
  };
}

/**
 * Builds FHIR Condition resources from member diagnosis codes.
 * @param {Object} memberData - The member data
 * @returns {Object[]} Array of FHIR Condition resources
 */
function buildFHIRConditionResources(memberData) {
  const diagnosisCodes = memberData.diagnosisCodes || [];
  if (!Array.isArray(diagnosisCodes) || diagnosisCodes.length === 0) {
    return [];
  }

  return diagnosisCodes.map((code) => {
    const trimmed = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const entry = getCodeByICD10(trimmed);

    return {
      resourceType: 'Condition',
      id: uuidv4(),
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }],
      },
      category: [
        {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item', display: 'Problem List Item' }],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code: trimmed,
            display: entry ? entry.description : trimmed,
          },
        ],
        text: entry ? entry.description : trimmed,
      },
      subject: {
        reference: `Patient/${memberData.memberId || memberData.id || 'unknown'}`,
      },
      recordedDate: new Date().toISOString(),
    };
  });
}

// ─── NASCO (Claims Processing) Adapter ──────────────────────────────────────

/**
 * @typedef {Object} NASCOClaimRequest
 * @property {string} claimId - The claim ID
 * @property {string} claimNumber - The claim number
 * @property {string} memberId - The member ID
 * @property {string} providerId - The provider ID
 * @property {string} serviceDate - Date of service (YYYY-MM-DD)
 * @property {string[]} diagnosisCodes - ICD-10 diagnosis codes
 * @property {string} serviceDescription - Description of service
 * @property {number} billedAmount - Billed amount
 * @property {string} [providerNPI] - Provider NPI
 */

/**
 * @typedef {Object} NASCOClaimResponse
 * @property {string} nascoClaimId - NASCO claim reference ID
 * @property {string} adjudicationStatus - Adjudication status
 * @property {number} allowedAmount - Allowed amount
 * @property {number} paidAmount - Paid amount
 * @property {number} memberResponsibility - Member responsibility
 * @property {string[]} editCodes - Applied edit codes
 * @property {Object} pricingDetails - Pricing breakdown
 */

/**
 * Simulates NASCO claims processing integration.
 * Submits a claim to the NASCO claims adjudication system and
 * returns a simulated adjudication response.
 *
 * @param {NASCOClaimRequest} request - The claim request
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The NASCO claims response
 */
export async function nascoProcessClaim(request, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(400, 1200);

    if (!request || typeof request !== 'object') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.NASCO,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'NASCO claim request is required',
        latency
      );
    }

    if (!request.claimId || !request.memberId) {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.NASCO,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'NASCO claim requires claimId and memberId',
        latency
      );
    }

    const billedAmount = typeof request.billedAmount === 'number' ? request.billedAmount : 0;
    const nascoClaimId = generateTransactionId('NASCO-CLM');

    // Simulate adjudication
    const allowedRate = 0.80;
    const allowedAmount = Math.round(billedAmount * allowedRate * 100) / 100;

    let copay = 20;
    let coinsurance = 0;

    // Adjust based on diagnosis codes
    if (Array.isArray(request.diagnosisCodes)) {
      for (const code of request.diagnosisCodes) {
        if (typeof code !== 'string') {
          continue;
        }
        const trimmed = code.trim().toUpperCase();
        const entry = getCodeByICD10(trimmed);
        if (!entry) {
          continue;
        }
        if (entry.category === 'diabetes' || entry.category === 'dementia') {
          copay = 0;
          break;
        }
        if (entry.category === 'esrd') {
          copay = 0;
          coinsurance = 20;
          break;
        }
        if (entry.category === 'cancer') {
          copay = 0;
          coinsurance = 20;
          break;
        }
      }
    }

    const coinsuranceAmount = Math.round(allowedAmount * (coinsurance / 100) * 100) / 100;
    const memberResponsibility = Math.round((copay + coinsuranceAmount) * 100) / 100;
    const paidAmount = Math.round(Math.max(0, allowedAmount - memberResponsibility) * 100) / 100;

    const editCodes = [];
    if (billedAmount > 5000) {
      editCodes.push('EDIT-HIGH-DOLLAR');
    }
    if (!request.providerNPI) {
      editCodes.push('EDIT-MISSING-NPI');
    }

    let adjudicationStatus = 'approved';
    if (billedAmount <= 0) {
      adjudicationStatus = 'denied';
    } else if (editCodes.length > 0) {
      adjudicationStatus = 'approved_with_edits';
    }

    const pricingDetails = {
      billedAmount,
      allowedAmount,
      allowedRate,
      copay,
      coinsurancePercent: coinsurance,
      coinsuranceAmount,
      memberResponsibility,
      paidAmount,
      adjustmentAmount: Math.round((billedAmount - allowedAmount) * 100) / 100,
      pricingMethod: 'fee_schedule',
      feeScheduleId: 'FS-CSNP-2024',
    };

    const responseData = {
      nascoClaimId,
      adjudicationStatus,
      allowedAmount,
      paidAmount,
      memberResponsibility,
      editCodes,
      pricingDetails,
      claimId: request.claimId,
      claimNumber: request.claimNumber || null,
      memberId: request.memberId,
      processedAt: new Date().toISOString(),
      eobGenerated: adjudicationStatus !== 'denied',
      eobId: adjudicationStatus !== 'denied' ? generateTransactionId('EOB') : null,
    };

    const latency = Date.now() - startTime;

    logAction(
      AUDIT_ACTIONS.CLAIM_APPROVE,
      performedBy,
      {
        targetType: 'nasco_claim',
        targetId: nascoClaimId,
        description: `NASCO claim processed. Claim: ${request.claimNumber || request.claimId}. Status: ${adjudicationStatus}. Billed: $${billedAmount.toFixed(2)}, Paid: $${paidAmount.toFixed(2)}`,
        metadata: {
          system: EXTERNAL_SYSTEMS.NASCO,
          nascoClaimId,
          claimId: request.claimId,
          adjudicationStatus,
          billedAmount,
          paidAmount,
          editCodes,
          latencyMs: latency,
        },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.NASCO,
      true,
      adjudicationStatus === 'denied' ? INTEGRATION_STATUSES.PARTIAL : INTEGRATION_STATUSES.SUCCESS,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.nascoProcessClaim: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.NASCO,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during NASCO claims processing',
      latency
    );
  }
}

// ─── Facets (Billing & Configuration) Adapter ───────────────────────────────

/**
 * @typedef {Object} FacetsBillingRequest
 * @property {string} memberId - The member ID
 * @property {string} benefitPackageId - The benefit package ID
 * @property {string} [billingPeriod] - Billing period (YYYY-MM)
 * @property {string} [action] - Billing action ('generate_invoice', 'check_premium', 'update_config')
 */

/**
 * @typedef {Object} FacetsBillingResponse
 * @property {string} facetsTransactionId - Facets transaction ID
 * @property {string} billingStatus - Billing status
 * @property {Object} billingDetails - Billing details
 * @property {Object} configurationDetails - Configuration details
 */

/**
 * Simulates Facets billing and configuration integration.
 * Handles premium billing, benefit configuration, and member billing inquiries.
 *
 * @param {FacetsBillingRequest} request - The billing request
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The Facets billing response
 */
export async function facetsBilling(request, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(200, 800);

    if (!request || typeof request !== 'object') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.FACETS,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'Facets billing request is required',
        latency
      );
    }

    if (!request.memberId || typeof request.memberId !== 'string') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.FACETS,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'Member ID is required for Facets billing',
        latency
      );
    }

    const action = (request.action && typeof request.action === 'string') ? request.action.trim() : 'check_premium';
    const facetsTransactionId = generateTransactionId('FACETS');

    const now = new Date();
    const billingPeriod = request.billingPeriod || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let billingDetails = {};
    let configurationDetails = {};
    let billingStatus = 'completed';

    switch (action) {
      case 'generate_invoice': {
        const monthlyPremium = Math.round(Math.random() * 50 * 100) / 100;
        billingDetails = {
          invoiceId: generateTransactionId('INV'),
          billingPeriod,
          monthlyPremium,
          adjustments: 0,
          totalDue: monthlyPremium,
          dueDate: `${billingPeriod}-15`,
          paymentStatus: 'pending',
          memberId: request.memberId,
          benefitPackageId: request.benefitPackageId || null,
        };
        billingStatus = 'invoice_generated';
        break;
      }
      case 'check_premium': {
        billingDetails = {
          memberId: request.memberId,
          benefitPackageId: request.benefitPackageId || null,
          billingPeriod,
          currentPremium: 0,
          premiumStatus: 'current',
          lastPaymentDate: `${billingPeriod}-01`,
          lastPaymentAmount: 0,
          outstandingBalance: 0,
          gracePeriodActive: false,
        };
        billingStatus = 'premium_checked';
        break;
      }
      case 'update_config': {
        configurationDetails = {
          memberId: request.memberId,
          benefitPackageId: request.benefitPackageId || null,
          configurationUpdated: true,
          updatedFields: ['benefit_effective_date', 'copay_schedule', 'deductible_tracking'],
          effectiveDate: new Date().toISOString().split('T')[0],
          configVersion: `v${Date.now().toString(36)}`,
        };
        billingStatus = 'configuration_updated';
        break;
      }
      default: {
        billingDetails = {
          memberId: request.memberId,
          message: `Unknown action: ${action}`,
        };
        billingStatus = 'unknown_action';
        break;
      }
    }

    const responseData = {
      facetsTransactionId,
      billingStatus,
      billingDetails,
      configurationDetails,
      action,
      processedAt: new Date().toISOString(),
    };

    const latency = Date.now() - startTime;

    logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'facets_billing',
        targetId: facetsTransactionId,
        description: `Facets billing operation "${action}" completed for member ${request.memberId}. Status: ${billingStatus}`,
        metadata: {
          system: EXTERNAL_SYSTEMS.FACETS,
          facetsTransactionId,
          memberId: request.memberId,
          action,
          billingStatus,
          latencyMs: latency,
        },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.FACETS,
      true,
      INTEGRATION_STATUSES.SUCCESS,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.facetsBilling: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.FACETS,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during Facets billing operation',
      latency
    );
  }
}

// ─── Prior Authorization API Adapter ────────────────────────────────────────

/**
 * @typedef {Object} PriorAuthRequest
 * @property {string} memberId - The member ID
 * @property {string} providerId - The requesting provider ID
 * @property {string} serviceType - Type of service requiring authorization
 * @property {string} serviceDescription - Description of the service
 * @property {string[]} diagnosisCodes - Supporting ICD-10 diagnosis codes
 * @property {string} requestedDate - Requested service date (YYYY-MM-DD)
 * @property {number} [estimatedCost] - Estimated cost of the service
 * @property {string} [urgency] - Urgency level (routine, urgent, emergent)
 * @property {string} [clinicalJustification] - Clinical justification for the service
 */

/**
 * @typedef {Object} PriorAuthResponse
 * @property {string} authorizationId - Prior authorization ID
 * @property {string} authorizationStatus - Authorization status (approved, denied, pended, partial)
 * @property {string} authorizationNumber - Authorization reference number
 * @property {string|null} approvedDate - Date authorization was approved
 * @property {string|null} expirationDate - Authorization expiration date
 * @property {string|null} denialReason - Reason for denial if applicable
 * @property {Object} reviewDetails - Review details
 */

/**
 * Simulates Prior Authorization API integration.
 * Submits a prior authorization request and returns a simulated
 * authorization determination.
 *
 * @param {PriorAuthRequest} request - The prior authorization request
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The prior authorization response
 */
export async function priorAuthSubmit(request, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(300, 1000);

    if (!request || typeof request !== 'object') {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.PRIOR_AUTH,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'Prior authorization request is required',
        latency
      );
    }

    if (!request.memberId || !request.providerId || !request.serviceType) {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.PRIOR_AUTH,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'Prior authorization requires memberId, providerId, and serviceType',
        latency
      );
    }

    const authorizationId = generateTransactionId('PA');
    const authorizationNumber = `AUTH-${Date.now().toString(36).toUpperCase()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

    const urgency = (request.urgency && typeof request.urgency === 'string') ? request.urgency.trim() : 'routine';
    const estimatedCost = typeof request.estimatedCost === 'number' ? request.estimatedCost : 0;

    // Services that are typically auto-approved for CSNP members
    const autoApproveServices = [
      'primary_care', 'specialist_visit', 'lab_work', 'preventive_care',
      'diabetes_supplies', 'home_health', 'telehealth', 'mental_health',
      'pulmonary_rehab', 'cardiac_rehab', 'dialysis',
    ];

    // Services that require clinical review
    const reviewRequiredServices = [
      'mri', 'ct_scan', 'pet_scan', 'surgery', 'transplant',
      'advanced_imaging', 'inpatient', 'skilled_nursing',
      'durable_medical_equipment', 'experimental_treatment',
    ];

    const serviceTypeLower = request.serviceType.toLowerCase().replace(/\s+/g, '_');
    const isAutoApprove = autoApproveServices.some((s) => serviceTypeLower.includes(s));
    const isReviewRequired = reviewRequiredServices.some((s) => serviceTypeLower.includes(s));

    let authorizationStatus = 'approved';
    let denialReason = null;
    let approvedDate = new Date().toISOString().split('T')[0];
    let reviewType = 'auto_approved';

    if (isAutoApprove) {
      authorizationStatus = 'approved';
      reviewType = 'auto_approved';
    } else if (isReviewRequired) {
      if (urgency === 'emergent') {
        authorizationStatus = 'approved';
        reviewType = 'expedited_review';
      } else if (estimatedCost > 10000 && !request.clinicalJustification) {
        authorizationStatus = 'pended';
        approvedDate = null;
        reviewType = 'clinical_review_required';
      } else if (request.clinicalJustification) {
        authorizationStatus = 'approved';
        reviewType = 'clinical_review_approved';
      } else {
        authorizationStatus = 'pended';
        approvedDate = null;
        reviewType = 'medical_director_review';
      }
    } else {
      // Default: approve with standard review
      authorizationStatus = 'approved';
      reviewType = 'standard_review';
    }

    // Calculate expiration date (90 days from approval)
    let expirationDate = null;
    if (authorizationStatus === 'approved' && approvedDate) {
      const expDate = new Date(approvedDate + 'T00:00:00');
      expDate.setDate(expDate.getDate() + 90);
      const expYear = expDate.getFullYear();
      const expMonth = String(expDate.getMonth() + 1).padStart(2, '0');
      const expDay = String(expDate.getDate()).padStart(2, '0');
      expirationDate = `${expYear}-${expMonth}-${expDay}`;
    }

    const reviewDetails = {
      reviewType,
      reviewedAt: new Date().toISOString(),
      reviewCriteria: [
        'Medical necessity',
        'Plan benefit coverage',
        'Provider network status',
        'Clinical guidelines compliance',
      ],
      clinicalGuidelineRef: `CG-${serviceTypeLower.toUpperCase().substring(0, 10)}-2024`,
      estimatedCost,
      urgency,
      hasClinicalJustification: !!request.clinicalJustification,
    };

    const responseData = {
      authorizationId,
      authorizationStatus,
      authorizationNumber,
      approvedDate,
      expirationDate,
      denialReason,
      reviewDetails,
      memberId: request.memberId,
      providerId: request.providerId,
      serviceType: request.serviceType,
      serviceDescription: request.serviceDescription || '',
      diagnosisCodesCount: Array.isArray(request.diagnosisCodes) ? request.diagnosisCodes.length : 0,
      processedAt: new Date().toISOString(),
    };

    const latency = Date.now() - startTime;

    logAction(
      AUDIT_ACTIONS.APPROVE,
      performedBy,
      {
        targetType: 'prior_authorization',
        targetId: authorizationId,
        description: `Prior authorization ${authorizationNumber} ${authorizationStatus} for member ${request.memberId}. Service: ${request.serviceType}. Review: ${reviewType}`,
        metadata: {
          system: EXTERNAL_SYSTEMS.PRIOR_AUTH,
          authorizationId,
          authorizationNumber,
          authorizationStatus,
          memberId: request.memberId,
          providerId: request.providerId,
          serviceType: request.serviceType,
          reviewType,
          urgency,
          latencyMs: latency,
        },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.PRIOR_AUTH,
      true,
      authorizationStatus === 'approved' ? INTEGRATION_STATUSES.SUCCESS : INTEGRATION_STATUSES.PENDING,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.priorAuthSubmit: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.PRIOR_AUTH,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during prior authorization submission',
      latency
    );
  }
}

/**
 * Checks the status of an existing prior authorization.
 *
 * @param {string} authorizationId - The prior authorization ID
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>} The prior authorization status response
 */
export async function priorAuthCheckStatus(authorizationId, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(100, 400);

    if (typeof authorizationId !== 'string' || authorizationId.trim().length === 0) {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.PRIOR_AUTH,
        false,
        INTEGRATION_STATUSES.FAILURE,
        null,
        'Authorization ID is required',
        latency
      );
    }

    const responseData = {
      authorizationId: authorizationId.trim(),
      authorizationStatus: 'approved',
      lastUpdated: new Date().toISOString(),
      expirationDate: null,
      notes: 'Authorization is active and valid',
    };

    // Calculate a simulated expiration date
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 60);
    const expYear = expDate.getFullYear();
    const expMonth = String(expDate.getMonth() + 1).padStart(2, '0');
    const expDay = String(expDate.getDate()).padStart(2, '0');
    responseData.expirationDate = `${expYear}-${expMonth}-${expDay}`;

    const latency = Date.now() - startTime;

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.PRIOR_AUTH,
      true,
      INTEGRATION_STATUSES.SUCCESS,
      responseData,
      null,
      latency
    );
  } catch (error) {
    console.error('integrationService.priorAuthCheckStatus: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.PRIOR_AUTH,
      false,
      INTEGRATION_STATUSES.FAILURE,
      null,
      'An unexpected error occurred during prior authorization status check',
      latency
    );
  }
}

// ─── CDM (Consumer Data Management) Adapter ─────────────────────────────────

/**
 * Simulates syncing a member's notification preferences to CDM (FR-009).
 * @param {Object} request - The sync request
 * @param {string} request.memberId - The member ID
 * @param {Object} request.preferences - Notification preferences by category
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>}
 */
export async function cdmSyncPreferences(request, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(250, 800);

    if (!request || typeof request !== 'object' || !request.memberId) {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.CDM, false, INTEGRATION_STATUSES.FAILURE, null,
        'CDM sync requires a memberId', latency
      );
    }

    const cdmSyncId = generateTransactionId('CDM-SYNC');
    const responseData = {
      cdmSyncId,
      memberId: request.memberId,
      recordType: 'notification_preferences',
      preferences: request.preferences || {},
      syncStatus: 'synced',
      cdmRecordVersion: `v${Date.now().toString(36)}`,
      syncedAt: new Date().toISOString(),
    };

    const latency = Date.now() - startTime;
    logAction(
      AUDIT_ACTIONS.UPDATE, performedBy,
      {
        targetType: 'cdm_sync',
        targetId: cdmSyncId,
        description: `CDM notification-preference sync completed for member ${request.memberId}`,
        metadata: { system: EXTERNAL_SYSTEMS.CDM, cdmSyncId, memberId: request.memberId, latencyMs: latency },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(EXTERNAL_SYSTEMS.CDM, true, INTEGRATION_STATUSES.SUCCESS, responseData, null, latency);
  } catch (error) {
    console.error('integrationService.cdmSyncPreferences: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.CDM, false, INTEGRATION_STATUSES.FAILURE, null,
      'An unexpected error occurred during CDM preference sync', latency
    );
  }
}

// ─── NCompass (Preference Validation) Adapter ───────────────────────────────

/**
 * Simulates validating a member's notification preferences in NCompass (FR-009).
 * Confirms each category has a deliverable method and required contact details exist.
 * @param {Object} request - The validation request
 * @param {string} request.memberId - The member ID
 * @param {Object} request.preferences - Notification preferences by category
 * @param {boolean} [request.hasEmail] - Whether the member has an email on file
 * @param {boolean} [request.hasPhone] - Whether the member has a phone on file
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the operation
 * @returns {Promise<IntegrationResponse>}
 */
export async function nCompassValidatePreferences(request, options = {}) {
  const startTime = Date.now();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  try {
    await simulateDelay(200, 700);

    if (!request || typeof request !== 'object' || !request.memberId) {
      const latency = Date.now() - startTime;
      return createIntegrationResponse(
        EXTERNAL_SYSTEMS.NCOMPASS, false, INTEGRATION_STATUSES.FAILURE, null,
        'NCompass validation requires a memberId', latency
      );
    }

    const prefs = request.preferences || {};
    const checks = [];
    Object.keys(prefs).forEach((category) => {
      const method = prefs[category];
      const needsEmail = method === 'email' || method === 'both';
      const needsText = method === 'text' || method === 'both';
      let ok = true;
      let detail = 'Deliverable';
      if (needsEmail && request.hasEmail === false) {
        ok = false;
        detail = 'Email selected but no email on file';
      }
      if (needsText && request.hasPhone === false) {
        ok = false;
        detail = 'Text selected but no phone on file';
      }
      checks.push({ category, method, valid: ok, detail });
    });

    const validated = checks.every((c) => c.valid);
    const validationId = generateTransactionId('NCMP-VAL');
    const responseData = {
      validationId,
      memberId: request.memberId,
      validated,
      checks,
      validatedAt: new Date().toISOString(),
    };

    const latency = Date.now() - startTime;
    logAction(
      AUDIT_ACTIONS.UPDATE, performedBy,
      {
        targetType: 'ncompass_validation',
        targetId: validationId,
        description: `NCompass validated notification preferences for member ${request.memberId} — ${validated ? 'passed' : 'issues found'}`,
        metadata: { system: EXTERNAL_SYSTEMS.NCOMPASS, validationId, memberId: request.memberId, validated, latencyMs: latency },
        ipAddress: '127.0.0.1',
      },
      'integration'
    );

    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.NCOMPASS, true,
      validated ? INTEGRATION_STATUSES.SUCCESS : INTEGRATION_STATUSES.PARTIAL,
      responseData, null, latency
    );
  } catch (error) {
    console.error('integrationService.nCompassValidatePreferences: unexpected error:', error);
    const latency = Date.now() - startTime;
    return createIntegrationResponse(
      EXTERNAL_SYSTEMS.NCOMPASS, false, INTEGRATION_STATUSES.FAILURE, null,
      'An unexpected error occurred during NCompass validation', latency
    );
  }
}

// ─── Integration Health Check ───────────────────────────────────────────────

/**
 * Performs a health check on all external system integrations.
 * Returns the status and simulated latency for each system.
 *
 * @returns {Promise<Object>} Health check results for all systems
 */
export async function checkIntegrationHealth() {
  const timestamp = new Date().toISOString();
  const systems = Object.values(EXTERNAL_SYSTEMS);
  const results = {};

  for (const system of systems) {
    const startTime = Date.now();
    await simulateDelay(50, 200);
    const latency = Date.now() - startTime;

    results[system] = {
      system,
      status: 'healthy',
      latencyMs: latency,
      lastChecked: timestamp,
      version: '1.0.0',
      endpoint: `https://api.${system.toLowerCase().replace(/[^a-z0-9]/g, '')}.example.com/v1/health`,
    };
  }

  return {
    overallStatus: 'healthy',
    systemCount: systems.length,
    healthySystems: systems.length,
    unhealthySystems: 0,
    results,
    checkedAt: timestamp,
  };
}

/**
 * Returns integration statistics and usage summary.
 *
 * @returns {{ totalSystems: number, systems: string[], supportedOperations: Object.<string, string[]> }}
 */
export function getIntegrationStats() {
  return {
    totalSystems: Object.keys(EXTERNAL_SYSTEMS).length,
    systems: Object.values(EXTERNAL_SYSTEMS),
    supportedOperations: {
      [EXTERNAL_SYSTEMS.VCC]: ['validateDocuments'],
      [EXTERNAL_SYSTEMS.ICOE]: ['enrichData'],
      [EXTERNAL_SYSTEMS.IKA]: ['submitToCMS', 'processTRR'],
      [EXTERNAL_SYSTEMS.GUIDING_CARE]: ['createReferral'],
      [EXTERNAL_SYSTEMS.HL7_FHIR]: ['read', 'search', 'create', 'update'],
      [EXTERNAL_SYSTEMS.NASCO]: ['processClaim'],
      [EXTERNAL_SYSTEMS.FACETS]: ['generateInvoice', 'checkPremium', 'updateConfig'],
      [EXTERNAL_SYSTEMS.PRIOR_AUTH]: ['submit', 'checkStatus'],
      [EXTERNAL_SYSTEMS.CDM]: ['syncPreferences'],
      [EXTERNAL_SYSTEMS.NCOMPASS]: ['validatePreferences'],
    },
  };
}