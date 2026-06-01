/**
 * Enrollment management service for the CSNP Portal.
 * Provides multi-channel enrollment intake, document validation (VCC simulation),
 * data enrichment (ICoE simulation), CMS submission (IKA simulation),
 * TRR response processing, and enrollment persistence with audit logging.
 * @module enrollmentService
 */

import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem, appendToArray, findInArray, updateInArray } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { validateEligibility } from './eligibilityService.js';
import { evaluateEligibilityRules, evaluateBenefitRules } from './ruleEngine.js';
import {
  AUDIT_ACTIONS,
  ENROLLMENT_CHANNELS,
  ENROLLMENT_STATUSES,
  PLAN_TYPES,
} from '../utils/constants.js';
import {
  validateEnrollmentData,
  validateRequired,
  validateDateFormat,
  validateICD10Codes,
  validateSSN,
  validateMedicareId,
} from '../utils/validators.js';

/**
 * localStorage key for enrollments collection.
 * @type {string}
 */
const ENROLLMENTS_KEY = 'csnp_enrollments';

/**
 * localStorage key for members collection.
 * @type {string}
 */
const MEMBERS_KEY = 'csnp_members';

/**
 * localStorage key for benefit packages collection.
 * @type {string}
 */
const BENEFIT_PACKAGES_KEY = 'csnp_benefit_packages';

/**
 * localStorage key for enrollment documents collection.
 * @type {string}
 */
const ENROLLMENT_DOCUMENTS_KEY = 'csnp_enrollment_documents';

/**
 * localStorage key for enrollment processing queue.
 * @type {string}
 */
const ENROLLMENT_QUEUE_KEY = 'csnp_enrollment_queue';

/**
 * @typedef {Object} EnrollmentIntakeResult
 * @property {boolean} success - Whether the intake succeeded
 * @property {string|null} enrollmentId - The created enrollment ID
 * @property {string} status - The enrollment status
 * @property {string|null} auditId - Audit log entry ID
 * @property {Object|null} validationErrors - Validation errors if any
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if intake failed
 */

/**
 * @typedef {Object} EnrollmentSubmissionResult
 * @property {boolean} success - Whether the submission succeeded
 * @property {string|null} enrollmentId - The enrollment ID
 * @property {string} status - The enrollment status after submission
 * @property {Object|null} vccResult - VCC document validation result
 * @property {Object|null} icoeResult - ICoE data enrichment result
 * @property {Object|null} ikaResult - IKA CMS submission result
 * @property {Object|null} trrResult - TRR response processing result
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if submission failed
 */

/**
 * @typedef {Object} DocumentProcessingResult
 * @property {boolean} success - Whether document processing succeeded
 * @property {string} enrollmentId - The enrollment ID
 * @property {Object[]} processedDocuments - Array of processed document results
 * @property {string[]} validDocuments - Array of valid document names
 * @property {string[]} invalidDocuments - Array of invalid document names
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if processing failed
 */

/**
 * @typedef {Object} VCCValidationResult
 * @property {boolean} valid - Whether all documents passed VCC validation
 * @property {Object[]} results - Individual document validation results
 * @property {string} timestamp - ISO timestamp
 */

/**
 * @typedef {Object} ICoEEnrichmentResult
 * @property {boolean} success - Whether data enrichment succeeded
 * @property {Object|null} enrichedData - Enriched member data
 * @property {string[]} enrichedFields - List of fields that were enriched
 * @property {string} timestamp - ISO timestamp
 */

/**
 * @typedef {Object} IKASubmissionResult
 * @property {boolean} success - Whether CMS submission succeeded
 * @property {string|null} transactionId - CMS transaction ID
 * @property {string} status - Submission status
 * @property {string} timestamp - ISO timestamp
 */

/**
 * @typedef {Object} TRRResponseResult
 * @property {boolean} accepted - Whether the TRR was accepted
 * @property {string|null} responseCode - TRR response code
 * @property {string|null} responseMessage - TRR response message
 * @property {string} timestamp - ISO timestamp
 */

// ─── VCC Document Validation Simulation ─────────────────────────────────────

/**
 * Simulates VCC (Verification & Compliance Center) document validation.
 * In production, this would call an external VCC API.
 * @param {Object[]} documents - Array of document objects to validate
 * @returns {VCCValidationResult} VCC validation result
 */
function simulateVCCValidation(documents) {
  const timestamp = new Date().toISOString();

  if (!Array.isArray(documents) || documents.length === 0) {
    return {
      valid: false,
      results: [],
      timestamp,
    };
  }

  const results = documents.map((doc) => {
    if (!doc || typeof doc !== 'object') {
      return {
        documentName: 'unknown',
        valid: false,
        reason: 'Invalid document object',
      };
    }

    const docName = doc.name || doc.fileName || 'unnamed';
    const docType = doc.type || doc.documentType || '';

    // Simulate validation rules
    const validTypes = [
      'medical_record',
      'physician_attestation',
      'diagnosis_verification',
      'enrollment_form',
      'consent_form',
      'identification',
      'medicare_card',
      'pdf',
      'image',
      'document',
    ];

    const hasValidType = validTypes.some(
      (t) => docType.toLowerCase().includes(t) || docName.toLowerCase().includes(t)
    );

    // Simulate that most documents pass validation
    const isValid = hasValidType || docName.length > 0;

    return {
      documentName: docName,
      documentType: docType,
      valid: isValid,
      reason: isValid ? 'Document validated successfully' : 'Document type not recognized or invalid',
      validatedAt: timestamp,
    };
  });

  const allValid = results.every((r) => r.valid);

  return {
    valid: allValid,
    results,
    timestamp,
  };
}

// ─── ICoE Data Enrichment Simulation ────────────────────────────────────────

/**
 * Simulates ICoE (Integration Center of Excellence) data enrichment.
 * In production, this would call an external ICoE API to enrich member data.
 * @param {Object} memberData - Member data to enrich
 * @returns {ICoEEnrichmentResult} ICoE enrichment result
 */
function simulateICoEEnrichment(memberData) {
  const timestamp = new Date().toISOString();

  if (!memberData || typeof memberData !== 'object') {
    return {
      success: false,
      enrichedData: null,
      enrichedFields: [],
      timestamp,
    };
  }

  const enrichedData = { ...memberData };
  const enrichedFields = [];

  // Simulate enrichment: add Medicare eligibility confirmation
  if (memberData.medicareId) {
    enrichedData.medicareEligibilityConfirmed = true;
    enrichedData.medicareEligibilityDate = timestamp;
    enrichedFields.push('medicareEligibilityConfirmed', 'medicareEligibilityDate');
  }

  // Simulate enrichment: add demographic verification
  if (memberData.firstName && memberData.lastName) {
    enrichedData.demographicVerified = true;
    enrichedData.demographicVerificationDate = timestamp;
    enrichedFields.push('demographicVerified', 'demographicVerificationDate');
  }

  // Simulate enrichment: add address standardization
  if (memberData.address && memberData.address.zipCode) {
    enrichedData.addressStandardized = true;
    enrichedData.serviceArea = determineServiceArea(memberData.address.zipCode);
    enrichedFields.push('addressStandardized', 'serviceArea');
  }

  // Simulate enrichment: add risk score
  if (Array.isArray(memberData.diagnosisCodes) && memberData.diagnosisCodes.length > 0) {
    enrichedData.riskScore = calculateSimulatedRiskScore(memberData.diagnosisCodes);
    enrichedFields.push('riskScore');
  }

  return {
    success: true,
    enrichedData,
    enrichedFields,
    timestamp,
  };
}

/**
 * Determines a simulated service area based on ZIP code.
 * @param {string} zipCode - ZIP code
 * @returns {string} Service area identifier
 */
function determineServiceArea(zipCode) {
  if (typeof zipCode !== 'string') {
    return 'UNKNOWN';
  }

  const prefix = zipCode.substring(0, 3);
  const prefixNum = parseInt(prefix, 10);

  if (prefixNum >= 600 && prefixNum <= 629) {
    return 'IL-CENTRAL';
  }
  if (prefixNum >= 606 && prefixNum <= 608) {
    return 'IL-CHICAGO';
  }
  if (prefixNum >= 600 && prefixNum <= 605) {
    return 'IL-NORTH';
  }

  return 'IL-GENERAL';
}

/**
 * Calculates a simulated risk score based on diagnosis codes.
 * @param {string[]} diagnosisCodes - Array of ICD-10 codes
 * @returns {number} Simulated risk score (0-100)
 */
function calculateSimulatedRiskScore(diagnosisCodes) {
  if (!Array.isArray(diagnosisCodes) || diagnosisCodes.length === 0) {
    return 0;
  }

  // Base score increases with number of conditions
  let score = Math.min(diagnosisCodes.length * 15, 60);

  // Add points for high-severity condition prefixes
  const highSeverityPrefixes = ['N18.5', 'N18.6', 'C', 'I50', 'G30', 'B20'];
  for (const code of diagnosisCodes) {
    if (typeof code !== 'string') {
      continue;
    }
    const trimmed = code.trim().toUpperCase();
    for (const prefix of highSeverityPrefixes) {
      if (trimmed.startsWith(prefix)) {
        score += 10;
        break;
      }
    }
  }

  return Math.min(score, 100);
}

// ─── IKA CMS Submission Simulation ──────────────────────────────────────────

/**
 * Simulates IKA (Integration Key Architecture) CMS submission.
 * In production, this would submit enrollment data to CMS via the IKA platform.
 * @param {Object} enrollmentData - Enrollment data to submit
 * @returns {IKASubmissionResult} IKA submission result
 */
function simulateIKASubmission(enrollmentData) {
  const timestamp = new Date().toISOString();

  if (!enrollmentData || typeof enrollmentData !== 'object') {
    return {
      success: false,
      transactionId: null,
      status: 'failed',
      timestamp,
    };
  }

  // Simulate CMS transaction ID generation
  const transactionId = `CMS-TXN-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

  // Simulate submission success (in production, this would be an async API call)
  return {
    success: true,
    transactionId,
    status: 'submitted',
    timestamp,
  };
}

// ─── TRR Response Processing Simulation ─────────────────────────────────────

/**
 * Simulates TRR (Transaction Reply Report) response processing.
 * In production, this would process the CMS TRR response.
 * @param {string} transactionId - CMS transaction ID
 * @param {Object} enrollmentData - Enrollment data for context
 * @returns {TRRResponseResult} TRR response result
 */
function simulateTRRResponse(transactionId, enrollmentData) {
  const timestamp = new Date().toISOString();

  if (!transactionId || typeof transactionId !== 'string') {
    return {
      accepted: false,
      responseCode: 'TRR-ERR-001',
      responseMessage: 'Invalid transaction ID',
      timestamp,
    };
  }

  // Simulate TRR acceptance (most enrollments are accepted in simulation)
  const hasValidDiagnosis = enrollmentData &&
    Array.isArray(enrollmentData.diagnosisCodesVerified) &&
    enrollmentData.diagnosisCodesVerified.length > 0;

  if (hasValidDiagnosis) {
    return {
      accepted: true,
      responseCode: 'TRR-ACC-000',
      responseMessage: 'Enrollment accepted by CMS',
      timestamp,
    };
  }

  return {
    accepted: false,
    responseCode: 'TRR-REJ-002',
    responseMessage: 'Enrollment rejected: insufficient diagnosis documentation',
    timestamp,
  };
}

// ─── Enrollment Number Generation ───────────────────────────────────────────

/**
 * Generates a unique enrollment application number.
 * @returns {string} Application number in format APP-YYYY-NNNNN
 */
function generateApplicationNumber() {
  const year = new Date().getFullYear();
  const sequence = String(Date.now()).slice(-5);
  return `APP-${year}-${sequence}`;
}

/**
 * Generates a unique claim number for enrollment tracking.
 * @returns {string} Claim number
 */
function generateClaimNumber() {
  const year = new Date().getFullYear();
  const sequence = String(Date.now()).slice(-6);
  return `CLM-${year}-${sequence}`;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Retrieves all enrollments from localStorage.
 * @returns {Object[]} Array of enrollment objects
 */
function getAllEnrollments() {
  const enrollments = getItem(ENROLLMENTS_KEY, []);
  if (!Array.isArray(enrollments)) {
    return [];
  }
  return enrollments;
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
 * Validates the enrollment channel.
 * @param {string} channel - The enrollment channel
 * @returns {boolean} Whether the channel is valid
 */
function isValidChannel(channel) {
  if (typeof channel !== 'string') {
    return false;
  }
  const validChannels = Object.values(ENROLLMENT_CHANNELS);
  return validChannels.includes(channel.trim());
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Intakes a new enrollment application through the specified channel.
 * Validates enrollment data, checks member eligibility, and creates
 * a pending enrollment record with audit logging.
 *
 * @param {Object} enrollmentData - Enrollment data
 * @param {string} enrollmentData.memberId - Member ID
 * @param {string} enrollmentData.benefitPackageId - Benefit package ID
 * @param {string} [enrollmentData.planType='C-SNP'] - Plan type
 * @param {string} [enrollmentData.effectiveDate] - Effective date (YYYY-MM-DD)
 * @param {string} [enrollmentData.applicationDate] - Application date (YYYY-MM-DD)
 * @param {string[]} [enrollmentData.diagnosisCodesVerified] - Verified ICD-10 codes
 * @param {string} [enrollmentData.notes] - Enrollment notes
 * @param {string} [enrollmentData.processedBy] - User ID processing the enrollment
 * @param {string} channel - Enrollment channel from ENROLLMENT_CHANNELS
 * @returns {EnrollmentIntakeResult} The enrollment intake result
 */
export function intakeEnrollment(enrollmentData, channel) {
  const timestamp = new Date().toISOString();

  const defaultResult = {
    success: false,
    enrollmentId: null,
    status: ENROLLMENT_STATUSES.PENDING,
    auditId: null,
    validationErrors: null,
    timestamp,
  };

  // Validate inputs
  if (!enrollmentData || typeof enrollmentData !== 'object') {
    return { ...defaultResult, error: 'Enrollment data is required' };
  }

  if (!channel || typeof channel !== 'string' || channel.trim().length === 0) {
    return { ...defaultResult, error: 'Enrollment channel is required' };
  }

  if (!isValidChannel(channel)) {
    return { ...defaultResult, error: `Invalid enrollment channel: ${channel}. Must be one of: ${Object.values(ENROLLMENT_CHANNELS).join(', ')}` };
  }

  const trimmedChannel = channel.trim();

  try {
    const memberId = enrollmentData.memberId;
    const benefitPackageId = enrollmentData.benefitPackageId;
    const planType = enrollmentData.planType || PLAN_TYPES.C_SNP;
    const effectiveDate = enrollmentData.effectiveDate || null;
    const applicationDate = enrollmentData.applicationDate || new Date().toISOString().split('T')[0];
    const diagnosisCodesVerified = enrollmentData.diagnosisCodesVerified || [];
    const notes = enrollmentData.notes || '';
    const processedBy = enrollmentData.processedBy || null;

    // Validate member ID
    const memberIdResult = validateRequired(memberId, 'Member ID');
    if (!memberIdResult.valid) {
      return { ...defaultResult, error: memberIdResult.error, validationErrors: { memberId: memberIdResult.error } };
    }

    // Validate benefit package ID
    const packageResult = validateRequired(benefitPackageId, 'Benefit package');
    if (!packageResult.valid) {
      return { ...defaultResult, error: packageResult.error, validationErrors: { benefitPackageId: packageResult.error } };
    }

    // Verify member exists
    const member = getMemberById(memberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${memberId}`, validationErrors: { memberId: 'Member not found' } };
    }

    // Verify benefit package exists
    const benefitPackage = getBenefitPackageById(benefitPackageId);
    if (!benefitPackage) {
      return { ...defaultResult, error: `Benefit package not found: ${benefitPackageId}`, validationErrors: { benefitPackageId: 'Benefit package not found' } };
    }

    // Validate effective date if provided
    if (effectiveDate) {
      const dateResult = validateDateFormat(effectiveDate, 'Effective date');
      if (!dateResult.valid) {
        return { ...defaultResult, error: dateResult.error, validationErrors: { effectiveDate: dateResult.error } };
      }
    }

    // Validate diagnosis codes if provided
    if (diagnosisCodesVerified.length > 0) {
      const codesResult = validateICD10Codes(diagnosisCodesVerified, 'Verified diagnosis codes', { minCount: 1 });
      if (!codesResult.valid) {
        return { ...defaultResult, error: codesResult.error, validationErrors: { diagnosisCodesVerified: codesResult.error } };
      }
    }

    // Check for duplicate active enrollment
    const existingEnrollments = getAllEnrollments();
    const duplicateEnrollment = existingEnrollments.find(
      (e) =>
        e.memberId === memberId.trim() &&
        e.benefitPackageId === benefitPackageId.trim() &&
        (e.status === ENROLLMENT_STATUSES.ACTIVE ||
          e.status === ENROLLMENT_STATUSES.APPROVED ||
          e.status === ENROLLMENT_STATUSES.PENDING)
    );

    if (duplicateEnrollment) {
      return {
        ...defaultResult,
        error: `Member already has an active or pending enrollment (${duplicateEnrollment.id}) for this benefit package`,
        validationErrors: { memberId: 'Duplicate enrollment exists' },
      };
    }

    // Run eligibility rules if diagnosis codes are provided
    let eligibilityResult = null;
    if (diagnosisCodesVerified.length > 0) {
      eligibilityResult = evaluateEligibilityRules(diagnosisCodesVerified, {
        performedBy: processedBy || 'system',
        auditLog: false,
      });
    }

    // Create enrollment record
    const enrollmentId = uuidv4();
    const appin = generateApplicationNumber();

    const enrollment = {
      id: enrollmentId,
      memberId: memberId.trim(),
      benefitPackageId: benefitPackageId.trim(),
      planType,
      status: ENROLLMENT_STATUSES.PENDING,
      channel: trimmedChannel,
      effectiveDate,
      terminationDate: null,
      applicationDate,
      approvalDate: null,
      processedBy: processedBy || null,
      diagnosisCodesVerified: diagnosisCodesVerified.map((c) =>
        typeof c === 'string' ? c.trim().toUpperCase() : ''
      ),
      notes: typeof notes === 'string' ? notes.trim() : '',
      appin,
      eligibilityResult: eligibilityResult
        ? {
            eligible: eligibilityResult.eligible,
            primaryConditionCode: eligibilityResult.primaryConditionCode,
            primaryConditionCategory: eligibilityResult.primaryConditionCategory,
          }
        : null,
      vccValidation: null,
      icoeEnrichment: null,
      ikaSubmission: null,
      trrResponse: null,
      documents: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Persist enrollment
    const saved = appendToArray(ENROLLMENTS_KEY, enrollment);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist enrollment record' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.ENROLL,
      processedBy || 'system',
      {
        targetType: 'enrollment',
        targetId: enrollmentId,
        description: `Enrollment intake created for member ${member.firstName} ${member.lastName} (${appin}) via ${trimmedChannel} channel`,
        metadata: {
          memberId: memberId.trim(),
          enrollmentId,
          channel: trimmedChannel,
          planType,
          benefitPackageId: benefitPackageId.trim(),
          diagnosisCodesCount: diagnosisCodesVerified.length,
          eligible: eligibilityResult ? eligibilityResult.eligible : null,
        },
        ipAddress: '127.0.0.1',
      },
      'enrollment'
    );

    return {
      success: true,
      enrollmentId,
      status: ENROLLMENT_STATUSES.PENDING,
      auditId: auditEntry ? auditEntry.id : null,
      validationErrors: null,
      timestamp,
    };
  } catch (error) {
    console.error('enrollmentService.intakeEnrollment: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during enrollment intake' };
  }
}

/**
 * Submits an enrollment for processing through the full workflow:
 * VCC document validation, ICoE data enrichment, IKA CMS submission,
 * and TRR response processing.
 *
 * @param {string} enrollmentId - The enrollment ID to submit
 * @param {Object} [options={}] - Submission options
 * @param {string} [options.performedBy] - User ID performing the submission
 * @param {boolean} [options.skipVCC=false] - Skip VCC document validation
 * @param {boolean} [options.skipICoE=false] - Skip ICoE data enrichment
 * @param {boolean} [options.skipIKA=false] - Skip IKA CMS submission
 * @returns {EnrollmentSubmissionResult} The enrollment submission result
 */
export function submitEnrollment(enrollmentId, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const skipVCC = options && options.skipVCC === true;
  const skipICoE = options && options.skipICoE === true;
  const skipIKA = options && options.skipIKA === true;

  const defaultResult = {
    success: false,
    enrollmentId: null,
    status: ENROLLMENT_STATUSES.PENDING,
    vccResult: null,
    icoeResult: null,
    ikaResult: null,
    trrResult: null,
    auditId: null,
    timestamp,
  };

  if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
    return { ...defaultResult, error: 'Enrollment ID is required' };
  }

  const trimmedId = enrollmentId.trim();

  try {
    // Find enrollment
    const enrollment = findInArray(ENROLLMENTS_KEY, (e) => e.id === trimmedId);
    if (!enrollment) {
      return { ...defaultResult, error: `Enrollment not found: ${trimmedId}` };
    }

    // Verify enrollment is in a submittable state
    if (enrollment.status !== ENROLLMENT_STATUSES.PENDING) {
      return {
        ...defaultResult,
        enrollmentId: trimmedId,
        status: enrollment.status,
        error: `Enrollment cannot be submitted in "${enrollment.status}" status. Must be in "pending" status.`,
      };
    }

    // Get member data for enrichment
    const member = getMemberById(enrollment.memberId);
    if (!member) {
      return { ...defaultResult, enrollmentId: trimmedId, error: 'Associated member not found' };
    }

    let vccResult = null;
    let icoeResult = null;
    let ikaResult = null;
    let trrResult = null;
    let newStatus = ENROLLMENT_STATUSES.PENDING;

    // Step 1: VCC Document Validation
    if (!skipVCC) {
      const documents = enrollment.documents || [];
      if (documents.length > 0) {
        vccResult = simulateVCCValidation(documents);
        if (!vccResult.valid) {
          // Update enrollment with VCC result but don't proceed
          updateInArray(
            ENROLLMENTS_KEY,
            (e) => e.id === trimmedId,
            (e) => ({
              ...e,
              vccValidation: vccResult,
              notes: e.notes + ' | VCC validation failed: some documents are invalid.',
              updatedAt: timestamp,
            })
          );

          logAction(
            AUDIT_ACTIONS.SUBMIT,
            performedBy,
            {
              targetType: 'enrollment',
              targetId: trimmedId,
              description: `Enrollment submission paused: VCC document validation failed for enrollment ${trimmedId}`,
              metadata: { enrollmentId: trimmedId, vccValid: false },
              ipAddress: '127.0.0.1',
            },
            'enrollment'
          );

          return {
            ...defaultResult,
            enrollmentId: trimmedId,
            status: ENROLLMENT_STATUSES.PENDING,
            vccResult,
            error: 'Document validation failed. Please review and resubmit documents.',
          };
        }
      }
    }

    // Step 2: ICoE Data Enrichment
    if (!skipICoE) {
      const memberDataForEnrichment = {
        ...member,
        diagnosisCodes: enrollment.diagnosisCodesVerified || member.diagnosisCodes,
      };
      icoeResult = simulateICoEEnrichment(memberDataForEnrichment);
    }

    // Step 3: IKA CMS Submission
    if (!skipIKA) {
      const submissionData = {
        enrollmentId: trimmedId,
        memberId: enrollment.memberId,
        medicareId: member.medicareId,
        planType: enrollment.planType,
        benefitPackageId: enrollment.benefitPackageId,
        effectiveDate: enrollment.effectiveDate,
        diagnosisCodesVerified: enrollment.diagnosisCodesVerified,
        channel: enrollment.channel,
        applicationDate: enrollment.applicationDate,
      };

      ikaResult = simulateIKASubmission(submissionData);

      // Step 4: TRR Response Processing
      if (ikaResult.success && ikaResult.transactionId) {
        trrResult = simulateTRRResponse(ikaResult.transactionId, enrollment);

        if (trrResult.accepted) {
          newStatus = ENROLLMENT_STATUSES.APPROVED;
        } else {
          newStatus = ENROLLMENT_STATUSES.REJECTED;
        }
      } else {
        newStatus = ENROLLMENT_STATUSES.PENDING;
      }
    } else {
      // If skipping IKA, auto-approve for simulation
      newStatus = ENROLLMENT_STATUSES.APPROVED;
    }

    // Update enrollment record
    const approvalDate = newStatus === ENROLLMENT_STATUSES.APPROVED
      ? new Date().toISOString().split('T')[0]
      : null;

    const updated = updateInArray(
      ENROLLMENTS_KEY,
      (e) => e.id === trimmedId,
      (e) => ({
        ...e,
        status: newStatus,
        approvalDate: approvalDate || e.approvalDate,
        vccValidation: vccResult || e.vccValidation,
        icoeEnrichment: icoeResult || e.icoeEnrichment,
        ikaSubmission: ikaResult || e.ikaSubmission,
        trrResponse: trrResult || e.trrResponse,
        processedBy: performedBy,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { ...defaultResult, enrollmentId: trimmedId, error: 'Failed to update enrollment record' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.SUBMIT,
      performedBy,
      {
        targetType: 'enrollment',
        targetId: trimmedId,
        description: `Enrollment ${trimmedId} submitted and processed. Status: ${newStatus}. ${trrResult ? `TRR: ${trrResult.responseCode}` : 'No TRR response.'}`,
        metadata: {
          enrollmentId: trimmedId,
          memberId: enrollment.memberId,
          newStatus,
          vccValid: vccResult ? vccResult.valid : null,
          icoeSuccess: icoeResult ? icoeResult.success : null,
          ikaSuccess: ikaResult ? ikaResult.success : null,
          trrAccepted: trrResult ? trrResult.accepted : null,
          transactionId: ikaResult ? ikaResult.transactionId : null,
        },
        ipAddress: '127.0.0.1',
      },
      'enrollment'
    );

    return {
      success: newStatus === ENROLLMENT_STATUSES.APPROVED,
      enrollmentId: trimmedId,
      status: newStatus,
      vccResult,
      icoeResult,
      ikaResult,
      trrResult,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('enrollmentService.submitEnrollment: unexpected error:', error);
    return { ...defaultResult, enrollmentId: trimmedId, error: 'An unexpected error occurred during enrollment submission' };
  }
}

/**
 * Retrieves enrollment records for a member.
 * Returns all enrollments sorted by creation date descending.
 *
 * @param {string} memberId - The member ID
 * @returns {Object[]} Array of enrollment records
 */
export function getEnrollment(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    const enrollments = getAllEnrollments();
    return enrollments
      .filter((e) => e.memberId === memberId.trim())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('enrollmentService.getEnrollment: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves a single enrollment record by ID.
 *
 * @param {string} enrollmentId - The enrollment ID
 * @returns {Object|null} The enrollment record or null
 */
export function getEnrollmentById(enrollmentId) {
  if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
    return null;
  }

  try {
    return findInArray(ENROLLMENTS_KEY, (e) => e.id === enrollmentId.trim());
  } catch (error) {
    console.error('enrollmentService.getEnrollmentById: unexpected error:', error);
    return null;
  }
}

/**
 * Processes documents for an enrollment, running VCC validation simulation.
 *
 * @param {string} enrollmentId - The enrollment ID
 * @param {Object[]} documents - Array of document objects to process
 * @param {string} [documents[].name] - Document name
 * @param {string} [documents[].type] - Document type
 * @param {string} [documents[].content] - Document content or reference
 * @param {Object} [options={}] - Processing options
 * @param {string} [options.performedBy] - User ID performing the processing
 * @returns {DocumentProcessingResult} The document processing result
 */
export function processDocuments(enrollmentId, documents, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    enrollmentId: null,
    processedDocuments: [],
    validDocuments: [],
    invalidDocuments: [],
    auditId: null,
    timestamp,
  };

  if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
    return { ...defaultResult, error: 'Enrollment ID is required' };
  }

  if (!Array.isArray(documents) || documents.length === 0) {
    return { ...defaultResult, enrollmentId: enrollmentId.trim(), error: 'At least one document is required' };
  }

  const trimmedId = enrollmentId.trim();

  try {
    // Find enrollment
    const enrollment = findInArray(ENROLLMENTS_KEY, (e) => e.id === trimmedId);
    if (!enrollment) {
      return { ...defaultResult, enrollmentId: trimmedId, error: `Enrollment not found: ${trimmedId}` };
    }

    // Run VCC validation
    const vccResult = simulateVCCValidation(documents);

    const validDocuments = [];
    const invalidDocuments = [];
    const processedDocuments = [];

    for (const docResult of vccResult.results) {
      const processedDoc = {
        id: uuidv4(),
        enrollmentId: trimmedId,
        name: docResult.documentName,
        type: docResult.documentType || 'unknown',
        valid: docResult.valid,
        reason: docResult.reason,
        processedAt: timestamp,
      };

      processedDocuments.push(processedDoc);

      if (docResult.valid) {
        validDocuments.push(docResult.documentName);
      } else {
        invalidDocuments.push(docResult.documentName);
      }
    }

    // Update enrollment with documents and VCC result
    const existingDocs = enrollment.documents || [];
    const updatedDocs = [...existingDocs, ...processedDocuments];

    const updated = updateInArray(
      ENROLLMENTS_KEY,
      (e) => e.id === trimmedId,
      (e) => ({
        ...e,
        documents: updatedDocs,
        vccValidation: vccResult,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { ...defaultResult, enrollmentId: trimmedId, error: 'Failed to update enrollment with document results' };
    }

    // Persist documents separately for reference
    for (const doc of processedDocuments) {
      appendToArray(ENROLLMENT_DOCUMENTS_KEY, doc);
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy,
      {
        targetType: 'enrollment_documents',
        targetId: trimmedId,
        description: `Processed ${documents.length} document(s) for enrollment ${trimmedId}. Valid: ${validDocuments.length}, Invalid: ${invalidDocuments.length}`,
        metadata: {
          enrollmentId: trimmedId,
          totalDocuments: documents.length,
          validCount: validDocuments.length,
          invalidCount: invalidDocuments.length,
          vccValid: vccResult.valid,
        },
        ipAddress: '127.0.0.1',
      },
      'enrollment'
    );

    return {
      success: vccResult.valid,
      enrollmentId: trimmedId,
      processedDocuments,
      validDocuments,
      invalidDocuments,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('enrollmentService.processDocuments: unexpected error:', error);
    return { ...defaultResult, enrollmentId: trimmedId, error: 'An unexpected error occurred during document processing' };
  }
}

/**
 * Approves an enrollment, changing its status to active.
 *
 * @param {string} enrollmentId - The enrollment ID to approve
 * @param {string} [performedBy] - User ID performing the approval
 * @returns {{ success: boolean, enrollmentId: string|null, status: string, error?: string }}
 */
export function approveEnrollment(enrollmentId, performedBy) {
  if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
    return { success: false, enrollmentId: null, status: '', error: 'Enrollment ID is required' };
  }

  const trimmedId = enrollmentId.trim();

  try {
    const enrollment = findInArray(ENROLLMENTS_KEY, (e) => e.id === trimmedId);
    if (!enrollment) {
      return { success: false, enrollmentId: trimmedId, status: '', error: 'Enrollment not found' };
    }

    const approvableStatuses = [ENROLLMENT_STATUSES.PENDING, ENROLLMENT_STATUSES.APPROVED];
    if (!approvableStatuses.includes(enrollment.status)) {
      return {
        success: false,
        enrollmentId: trimmedId,
        status: enrollment.status,
        error: `Enrollment cannot be approved in "${enrollment.status}" status`,
      };
    }

    const timestamp = new Date().toISOString();
    const approvalDate = new Date().toISOString().split('T')[0];

    const updated = updateInArray(
      ENROLLMENTS_KEY,
      (e) => e.id === trimmedId,
      (e) => ({
        ...e,
        status: ENROLLMENT_STATUSES.ACTIVE,
        approvalDate,
        processedBy: performedBy || e.processedBy,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, enrollmentId: trimmedId, status: enrollment.status, error: 'Failed to update enrollment' };
    }

    logAction(
      AUDIT_ACTIONS.APPROVE,
      performedBy || 'system',
      {
        targetType: 'enrollment',
        targetId: trimmedId,
        description: `Enrollment ${trimmedId} approved and activated for member ${enrollment.memberId}`,
        metadata: {
          enrollmentId: trimmedId,
          memberId: enrollment.memberId,
          previousStatus: enrollment.status,
          newStatus: ENROLLMENT_STATUSES.ACTIVE,
        },
        ipAddress: '127.0.0.1',
      },
      'enrollment'
    );

    return { success: true, enrollmentId: trimmedId, status: ENROLLMENT_STATUSES.ACTIVE };
  } catch (error) {
    console.error('enrollmentService.approveEnrollment: unexpected error:', error);
    return { success: false, enrollmentId: trimmedId, status: '', error: 'An unexpected error occurred' };
  }
}

/**
 * Rejects an enrollment with a reason.
 *
 * @param {string} enrollmentId - The enrollment ID to reject
 * @param {string} [reason=''] - Rejection reason
 * @param {string} [performedBy] - User ID performing the rejection
 * @returns {{ success: boolean, enrollmentId: string|null, status: string, error?: string }}
 */
export function rejectEnrollment(enrollmentId, reason, performedBy) {
  if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
    return { success: false, enrollmentId: null, status: '', error: 'Enrollment ID is required' };
  }

  const trimmedId = enrollmentId.trim();

  try {
    const enrollment = findInArray(ENROLLMENTS_KEY, (e) => e.id === trimmedId);
    if (!enrollment) {
      return { success: false, enrollmentId: trimmedId, status: '', error: 'Enrollment not found' };
    }

    if (enrollment.status === ENROLLMENT_STATUSES.ACTIVE) {
      return {
        success: false,
        enrollmentId: trimmedId,
        status: enrollment.status,
        error: 'Active enrollments cannot be rejected. Use disenrollment instead.',
      };
    }

    const timestamp = new Date().toISOString();
    const rejectionReason = typeof reason === 'string' ? reason.trim() : '';

    const updated = updateInArray(
      ENROLLMENTS_KEY,
      (e) => e.id === trimmedId,
      (e) => ({
        ...e,
        status: ENROLLMENT_STATUSES.REJECTED,
        notes: rejectionReason
          ? `${e.notes} | Rejected: ${rejectionReason}`
          : e.notes,
        processedBy: performedBy || e.processedBy,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, enrollmentId: trimmedId, status: enrollment.status, error: 'Failed to update enrollment' };
    }

    logAction(
      AUDIT_ACTIONS.DENY,
      performedBy || 'system',
      {
        targetType: 'enrollment',
        targetId: trimmedId,
        description: `Enrollment ${trimmedId} rejected for member ${enrollment.memberId}. Reason: ${rejectionReason || 'Not specified'}`,
        metadata: {
          enrollmentId: trimmedId,
          memberId: enrollment.memberId,
          previousStatus: enrollment.status,
          newStatus: ENROLLMENT_STATUSES.REJECTED,
          reason: rejectionReason,
        },
        ipAddress: '127.0.0.1',
      },
      'enrollment'
    );

    return { success: true, enrollmentId: trimmedId, status: ENROLLMENT_STATUSES.REJECTED };
  } catch (error) {
    console.error('enrollmentService.rejectEnrollment: unexpected error:', error);
    return { success: false, enrollmentId: trimmedId, status: '', error: 'An unexpected error occurred' };
  }
}

/**
 * Disenrolls a member from an active enrollment.
 *
 * @param {string} enrollmentId - The enrollment ID to disenroll
 * @param {string} [reason=''] - Disenrollment reason
 * @param {string} [terminationDate] - Termination date (YYYY-MM-DD)
 * @param {string} [performedBy] - User ID performing the disenrollment
 * @returns {{ success: boolean, enrollmentId: string|null, status: string, error?: string }}
 */
export function disenrollMember(enrollmentId, reason, terminationDate, performedBy) {
  if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
    return { success: false, enrollmentId: null, status: '', error: 'Enrollment ID is required' };
  }

  const trimmedId = enrollmentId.trim();

  try {
    const enrollment = findInArray(ENROLLMENTS_KEY, (e) => e.id === trimmedId);
    if (!enrollment) {
      return { success: false, enrollmentId: trimmedId, status: '', error: 'Enrollment not found' };
    }

    if (enrollment.status !== ENROLLMENT_STATUSES.ACTIVE && enrollment.status !== ENROLLMENT_STATUSES.APPROVED) {
      return {
        success: false,
        enrollmentId: trimmedId,
        status: enrollment.status,
        error: `Only active or approved enrollments can be disenrolled. Current status: "${enrollment.status}"`,
      };
    }

    const timestamp = new Date().toISOString();
    const termDate = terminationDate || new Date().toISOString().split('T')[0];
    const disenrollReason = typeof reason === 'string' ? reason.trim() : '';

    // Validate termination date if provided
    if (terminationDate) {
      const dateResult = validateDateFormat(terminationDate, 'Termination date');
      if (!dateResult.valid) {
        return { success: false, enrollmentId: trimmedId, status: enrollment.status, error: dateResult.error };
      }
    }

    const updated = updateInArray(
      ENROLLMENTS_KEY,
      (e) => e.id === trimmedId,
      (e) => ({
        ...e,
        status: ENROLLMENT_STATUSES.DISENROLLED,
        terminationDate: termDate,
        notes: disenrollReason
          ? `${e.notes} | Disenrolled: ${disenrollReason}`
          : e.notes,
        processedBy: performedBy || e.processedBy,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, enrollmentId: trimmedId, status: enrollment.status, error: 'Failed to update enrollment' };
    }

    logAction(
      AUDIT_ACTIONS.DISENROLL,
      performedBy || 'system',
      {
        targetType: 'enrollment',
        targetId: trimmedId,
        description: `Member ${enrollment.memberId} disenrolled from enrollment ${trimmedId}. Termination date: ${termDate}. Reason: ${disenrollReason || 'Not specified'}`,
        metadata: {
          enrollmentId: trimmedId,
          memberId: enrollment.memberId,
          previousStatus: enrollment.status,
          newStatus: ENROLLMENT_STATUSES.DISENROLLED,
          terminationDate: termDate,
          reason: disenrollReason,
        },
        ipAddress: '127.0.0.1',
      },
      'enrollment'
    );

    return { success: true, enrollmentId: trimmedId, status: ENROLLMENT_STATUSES.DISENROLLED };
  } catch (error) {
    console.error('enrollmentService.disenrollMember: unexpected error:', error);
    return { success: false, enrollmentId: trimmedId, status: '', error: 'An unexpected error occurred' };
  }
}

/**
 * Cancels a pending enrollment.
 *
 * @param {string} enrollmentId - The enrollment ID to cancel
 * @param {string} [reason=''] - Cancellation reason
 * @param {string} [performedBy] - User ID performing the cancellation
 * @returns {{ success: boolean, enrollmentId: string|null, status: string, error?: string }}
 */
export function cancelEnrollment(enrollmentId, reason, performedBy) {
  if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
    return { success: false, enrollmentId: null, status: '', error: 'Enrollment ID is required' };
  }

  const trimmedId = enrollmentId.trim();

  try {
    const enrollment = findInArray(ENROLLMENTS_KEY, (e) => e.id === trimmedId);
    if (!enrollment) {
      return { success: false, enrollmentId: trimmedId, status: '', error: 'Enrollment not found' };
    }

    const cancellableStatuses = [ENROLLMENT_STATUSES.PENDING, ENROLLMENT_STATUSES.APPROVED];
    if (!cancellableStatuses.includes(enrollment.status)) {
      return {
        success: false,
        enrollmentId: trimmedId,
        status: enrollment.status,
        error: `Enrollment cannot be cancelled in "${enrollment.status}" status`,
      };
    }

    const timestamp = new Date().toISOString();
    const cancelReason = typeof reason === 'string' ? reason.trim() : '';

    const updated = updateInArray(
      ENROLLMENTS_KEY,
      (e) => e.id === trimmedId,
      (e) => ({
        ...e,
        status: ENROLLMENT_STATUSES.CANCELLED,
        notes: cancelReason
          ? `${e.notes} | Cancelled: ${cancelReason}`
          : e.notes,
        processedBy: performedBy || e.processedBy,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, enrollmentId: trimmedId, status: enrollment.status, error: 'Failed to update enrollment' };
    }

    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy || 'system',
      {
        targetType: 'enrollment',
        targetId: trimmedId,
        description: `Enrollment ${trimmedId} cancelled for member ${enrollment.memberId}. Reason: ${cancelReason || 'Not specified'}`,
        metadata: {
          enrollmentId: trimmedId,
          memberId: enrollment.memberId,
          previousStatus: enrollment.status,
          newStatus: ENROLLMENT_STATUSES.CANCELLED,
          reason: cancelReason,
        },
        ipAddress: '127.0.0.1',
      },
      'enrollment'
    );

    return { success: true, enrollmentId: trimmedId, status: ENROLLMENT_STATUSES.CANCELLED };
  } catch (error) {
    console.error('enrollmentService.cancelEnrollment: unexpected error:', error);
    return { success: false, enrollmentId: trimmedId, status: '', error: 'An unexpected error occurred' };
  }
}

/**
 * Retrieves all enrollments from localStorage.
 * @returns {Object[]} Array of all enrollment records
 */
export function getAllEnrollmentRecords() {
  try {
    return getAllEnrollments();
  } catch (error) {
    console.error('enrollmentService.getAllEnrollmentRecords: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves enrollments filtered by status.
 *
 * @param {string} status - Enrollment status to filter by
 * @returns {Object[]} Array of enrollment records matching the status
 */
export function getEnrollmentsByStatus(status) {
  if (typeof status !== 'string' || status.trim().length === 0) {
    return [];
  }

  try {
    const enrollments = getAllEnrollments();
    return enrollments
      .filter((e) => e.status === status.trim())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('enrollmentService.getEnrollmentsByStatus: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves enrollments filtered by channel.
 *
 * @param {string} channel - Enrollment channel to filter by
 * @returns {Object[]} Array of enrollment records matching the channel
 */
export function getEnrollmentsByChannel(channel) {
  if (typeof channel !== 'string' || channel.trim().length === 0) {
    return [];
  }

  try {
    const enrollments = getAllEnrollments();
    return enrollments
      .filter((e) => e.channel === channel.trim())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('enrollmentService.getEnrollmentsByChannel: unexpected error:', error);
    return [];
  }
}

/**
 * Returns enrollment statistics.
 *
 * @returns {{ total: number, byStatus: Object.<string, number>, byChannel: Object.<string, number>, byPlanType: Object.<string, number> }}
 */
export function getEnrollmentStats() {
  try {
    const enrollments = getAllEnrollments();

    const stats = {
      total: enrollments.length,
      byStatus: {},
      byChannel: {},
      byPlanType: {},
    };

    for (const enrollment of enrollments) {
      // By status
      const status = enrollment.status || 'unknown';
      if (!stats.byStatus[status]) {
        stats.byStatus[status] = 0;
      }
      stats.byStatus[status]++;

      // By channel
      const channel = enrollment.channel || 'unknown';
      if (!stats.byChannel[channel]) {
        stats.byChannel[channel] = 0;
      }
      stats.byChannel[channel]++;

      // By plan type
      const planType = enrollment.planType || 'unknown';
      if (!stats.byPlanType[planType]) {
        stats.byPlanType[planType] = 0;
      }
      stats.byPlanType[planType]++;
    }

    return stats;
  } catch (error) {
    console.error('enrollmentService.getEnrollmentStats: unexpected error:', error);
    return { total: 0, byStatus: {}, byChannel: {}, byPlanType: {} };
  }
}

/**
 * Checks whether a member has an active enrollment.
 *
 * @param {string} memberId - The member ID
 * @returns {{ hasActive: boolean, enrollment: Object|null }}
 */
export function hasActiveEnrollment(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return { hasActive: false, enrollment: null };
  }

  try {
    const enrollments = getAllEnrollments();
    const active = enrollments.find(
      (e) => e.memberId === memberId.trim() && e.status === ENROLLMENT_STATUSES.ACTIVE
    );

    return {
      hasActive: !!active,
      enrollment: active || null,
    };
  } catch (error) {
    console.error('enrollmentService.hasActiveEnrollment: unexpected error:', error);
    return { hasActive: false, enrollment: null };
  }
}

/**
 * Updates enrollment notes.
 *
 * @param {string} enrollmentId - The enrollment ID
 * @param {string} notes - Notes to append
 * @param {string} [performedBy] - User ID performing the update
 * @returns {boolean} Whether the update succeeded
 */
export function updateEnrollmentNotes(enrollmentId, notes, performedBy) {
  if (typeof enrollmentId !== 'string' || enrollmentId.trim().length === 0) {
    return false;
  }

  if (typeof notes !== 'string' || notes.trim().length === 0) {
    return false;
  }

  try {
    const trimmedId = enrollmentId.trim();
    const trimmedNotes = notes.trim();
    const timestamp = new Date().toISOString();

    const updated = updateInArray(
      ENROLLMENTS_KEY,
      (e) => e.id === trimmedId,
      (e) => ({
        ...e,
        notes: e.notes ? `${e.notes} | ${trimmedNotes}` : trimmedNotes,
        updatedAt: timestamp,
      })
    );

    if (updated) {
      logAction(
        AUDIT_ACTIONS.UPDATE,
        performedBy || 'system',
        {
          targetType: 'enrollment',
          targetId: trimmedId,
          description: `Enrollment notes updated for ${trimmedId}`,
          metadata: { enrollmentId: trimmedId, notesAdded: trimmedNotes },
          ipAddress: '127.0.0.1',
        },
        'enrollment'
      );
    }

    return updated;
  } catch (error) {
    console.error('enrollmentService.updateEnrollmentNotes: unexpected error:', error);
    return false;
  }
}

/**
 * Performs a batch enrollment intake for multiple members.
 *
 * @param {Object[]} enrollmentDataArray - Array of enrollment data objects
 * @param {string} channel - Enrollment channel
 * @param {string} [performedBy] - User ID performing the batch intake
 * @returns {{ total: number, successful: number, failed: number, results: EnrollmentIntakeResult[] }}
 */
export function batchIntakeEnrollments(enrollmentDataArray, channel, performedBy) {
  const batchResult = {
    total: 0,
    successful: 0,
    failed: 0,
    results: [],
  };

  if (!Array.isArray(enrollmentDataArray) || enrollmentDataArray.length === 0) {
    return batchResult;
  }

  batchResult.total = enrollmentDataArray.length;

  for (const enrollmentData of enrollmentDataArray) {
    const data = {
      ...enrollmentData,
      processedBy: performedBy || enrollmentData.processedBy,
    };

    const result = intakeEnrollment(data, channel);
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
      performedBy || 'system',
      {
        targetType: 'enrollment_batch',
        targetId: '',
        description: `Batch enrollment intake: ${batchResult.successful} successful, ${batchResult.failed} failed out of ${batchResult.total} total`,
        metadata: {
          total: batchResult.total,
          successful: batchResult.successful,
          failed: batchResult.failed,
          channel,
        },
        ipAddress: '127.0.0.1',
      },
      'enrollment'
    );
  }

  return batchResult;
}