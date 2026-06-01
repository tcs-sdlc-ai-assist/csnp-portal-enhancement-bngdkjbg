/**
 * Input validation utilities for the CSNP Portal.
 * Provides ICD-10 code format validation, SSN format validation,
 * date range validation, required field checks, email validation,
 * phone validation, and enrollment data validation schemas.
 * @module validators
 */

import { ICD10_CODE_MAP } from '../data/icd10Data.js';
import {
  ENROLLMENT_CHANNELS,
  ENROLLMENT_STATUSES,
  PLAN_TYPES,
  MEDICARE_PARTS,
} from './constants.js';

// ─── Validation Result ──────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the validation passed
 * @property {string} [error] - Error message if validation failed
 */

/**
 * @typedef {Object} ValidationResults
 * @property {boolean} valid - Whether all validations passed
 * @property {Object.<string, string>} errors - Map of field names to error messages
 */

/**
 * Creates a successful validation result.
 * @returns {ValidationResult}
 */
function validResult() {
  return { valid: true };
}

/**
 * Creates a failed validation result with an error message.
 * @param {string} error - The error message
 * @returns {ValidationResult}
 */
function invalidResult(error) {
  return { valid: false, error };
}

// ─── Required Field Checks ──────────────────────────────────────────────────

/**
 * Validates that a value is present and non-empty.
 * @param {*} value - The value to check
 * @param {string} [fieldName='Field'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateRequired(value, fieldName = 'Field') {
  if (value === null || value === undefined) {
    return invalidResult(`${fieldName} is required`);
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return invalidResult(`${fieldName} is required`);
  }

  if (Array.isArray(value) && value.length === 0) {
    return invalidResult(`${fieldName} must have at least one item`);
  }

  return validResult();
}

/**
 * Validates that a string has a minimum length.
 * @param {string} value - The string to check
 * @param {number} minLength - Minimum required length
 * @param {string} [fieldName='Field'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateMinLength(value, minLength, fieldName = 'Field') {
  if (typeof value !== 'string') {
    return invalidResult(`${fieldName} must be a string`);
  }

  if (value.trim().length < minLength) {
    return invalidResult(`${fieldName} must be at least ${minLength} characters`);
  }

  return validResult();
}

/**
 * Validates that a string does not exceed a maximum length.
 * @param {string} value - The string to check
 * @param {number} maxLength - Maximum allowed length
 * @param {string} [fieldName='Field'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateMaxLength(value, maxLength, fieldName = 'Field') {
  if (typeof value !== 'string') {
    return invalidResult(`${fieldName} must be a string`);
  }

  if (value.length > maxLength) {
    return invalidResult(`${fieldName} must not exceed ${maxLength} characters`);
  }

  return validResult();
}

// ─── Email Validation ───────────────────────────────────────────────────────

/**
 * Validates an email address format.
 * @param {string} email - The email address to validate
 * @param {string} [fieldName='Email'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateEmail(email, fieldName = 'Email') {
  if (typeof email !== 'string' || email.trim().length === 0) {
    return invalidResult(`${fieldName} is required`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return invalidResult(`${fieldName} must be a valid email address`);
  }

  return validResult();
}

// ─── Phone Validation ───────────────────────────────────────────────────────

/**
 * Validates a US phone number format (10 or 11 digits).
 * @param {string} phone - The phone number to validate
 * @param {string} [fieldName='Phone'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validatePhone(phone, fieldName = 'Phone') {
  if (typeof phone !== 'string' || phone.trim().length === 0) {
    return invalidResult(`${fieldName} is required`);
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return validResult();
  }

  if (digits.length === 11 && digits.charAt(0) === '1') {
    return validResult();
  }

  return invalidResult(`${fieldName} must be a valid 10-digit US phone number`);
}

// ─── SSN Validation ─────────────────────────────────────────────────────────

/**
 * Validates a Social Security Number format.
 * Accepts formats: XXX-XX-XXXX, XXXXXXXXX, or masked ***-**-XXXX.
 * @param {string} ssn - The SSN to validate
 * @param {string} [fieldName='SSN'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateSSN(ssn, fieldName = 'SSN') {
  if (typeof ssn !== 'string' || ssn.trim().length === 0) {
    return invalidResult(`${fieldName} is required`);
  }

  const trimmed = ssn.trim();

  // Allow masked SSN format (***-**-XXXX)
  const maskedRegex = /^\*{3}-\*{2}-\d{4}$/;
  if (maskedRegex.test(trimmed)) {
    return validResult();
  }

  // Full SSN with dashes: XXX-XX-XXXX
  const dashedRegex = /^\d{3}-\d{2}-\d{4}$/;
  if (dashedRegex.test(trimmed)) {
    const digits = trimmed.replace(/-/g, '');
    return validateSSNDigits(digits, fieldName);
  }

  // Full SSN without dashes: XXXXXXXXX
  const plainRegex = /^\d{9}$/;
  if (plainRegex.test(trimmed)) {
    return validateSSNDigits(trimmed, fieldName);
  }

  return invalidResult(`${fieldName} must be in format XXX-XX-XXXX or a valid masked format`);
}

/**
 * Validates SSN digit rules (no all-zeros in any group, no 900-999 area numbers, etc.).
 * @param {string} digits - 9-digit SSN string
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult}
 */
function validateSSNDigits(digits, fieldName) {
  const area = digits.substring(0, 3);
  const group = digits.substring(3, 5);
  const serial = digits.substring(5, 9);

  if (area === '000' || group === '00' || serial === '0000') {
    return invalidResult(`${fieldName} contains invalid segment (zeros not allowed)`);
  }

  if (area === '666') {
    return invalidResult(`${fieldName} contains invalid area number`);
  }

  const areaNum = parseInt(area, 10);
  if (areaNum >= 900 && areaNum <= 999) {
    return invalidResult(`${fieldName} contains invalid area number (900-999 range)`);
  }

  return validResult();
}

// ─── ICD-10 Code Validation ─────────────────────────────────────────────────

/**
 * Validates an ICD-10-CM code format.
 * ICD-10-CM codes follow the pattern: letter + 2 digits + optional dot + up to 4 alphanumeric characters.
 * @param {string} code - The ICD-10 code to validate
 * @param {string} [fieldName='ICD-10 code'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateICD10Format(code, fieldName = 'ICD-10 code') {
  if (typeof code !== 'string' || code.trim().length === 0) {
    return invalidResult(`${fieldName} is required`);
  }

  const trimmed = code.trim().toUpperCase();

  // ICD-10-CM format: A00-Z99 with optional decimal and additional characters
  // Pattern: [A-Z][0-9]{2}(.[0-9A-Z]{1,4})?
  const icd10Regex = /^[A-Z]\d{2}(\.\d{1,4})?$/;
  if (!icd10Regex.test(trimmed)) {
    return invalidResult(`${fieldName} must be a valid ICD-10-CM format (e.g., E11.9, J44.1)`);
  }

  return validResult();
}

/**
 * Validates that an ICD-10 code exists in the known dataset.
 * @param {string} code - The ICD-10 code to validate
 * @param {string} [fieldName='ICD-10 code'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateICD10Exists(code, fieldName = 'ICD-10 code') {
  const formatResult = validateICD10Format(code, fieldName);
  if (!formatResult.valid) {
    return formatResult;
  }

  const trimmed = code.trim().toUpperCase();
  if (!ICD10_CODE_MAP[trimmed]) {
    return invalidResult(`${fieldName} "${trimmed}" is not recognized in the system`);
  }

  return validResult();
}

/**
 * Validates that an ICD-10 code is eligible for CSNP enrollment.
 * @param {string} code - The ICD-10 code to validate
 * @param {string} [fieldName='ICD-10 code'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateICD10CSNPEligible(code, fieldName = 'ICD-10 code') {
  const existsResult = validateICD10Exists(code, fieldName);
  if (!existsResult.valid) {
    return existsResult;
  }

  const trimmed = code.trim().toUpperCase();
  const entry = ICD10_CODE_MAP[trimmed];
  if (!entry.csnpEligible) {
    return invalidResult(`${fieldName} "${trimmed}" is not eligible for C-SNP enrollment`);
  }

  return validResult();
}

/**
 * Validates an array of ICD-10 codes.
 * @param {string[]} codes - Array of ICD-10 codes to validate
 * @param {string} [fieldName='Diagnosis codes'] - Name of the field for error messages
 * @param {{ requireCSNPEligible?: boolean, minCount?: number }} [options={}] - Validation options
 * @returns {ValidationResult}
 */
export function validateICD10Codes(codes, fieldName = 'Diagnosis codes', options = {}) {
  const { requireCSNPEligible = false, minCount = 1 } = options;

  if (!Array.isArray(codes)) {
    return invalidResult(`${fieldName} must be an array`);
  }

  if (codes.length < minCount) {
    return invalidResult(`${fieldName} must contain at least ${minCount} code${minCount !== 1 ? 's' : ''}`);
  }

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const label = `${fieldName}[${i}]`;

    if (requireCSNPEligible) {
      const eligibleResult = validateICD10CSNPEligible(code, label);
      if (!eligibleResult.valid) {
        return eligibleResult;
      }
    } else {
      const formatResult = validateICD10Format(code, label);
      if (!formatResult.valid) {
        return formatResult;
      }
    }
  }

  return validResult();
}

// ─── Date Validation ────────────────────────────────────────────────────────

/**
 * Validates a date string in YYYY-MM-DD format.
 * @param {string} dateStr - The date string to validate
 * @param {string} [fieldName='Date'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateDateFormat(dateStr, fieldName = 'Date') {
  if (typeof dateStr !== 'string' || dateStr.trim().length === 0) {
    return invalidResult(`${fieldName} is required`);
  }

  const trimmed = dateStr.trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(trimmed)) {
    return invalidResult(`${fieldName} must be in YYYY-MM-DD format`);
  }

  const parsed = new Date(trimmed + 'T00:00:00');
  if (isNaN(parsed.getTime())) {
    return invalidResult(`${fieldName} is not a valid date`);
  }

  // Verify the date components match (catches invalid dates like 2024-02-30)
  const [year, month, day] = trimmed.split('-').map(Number);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return invalidResult(`${fieldName} is not a valid calendar date`);
  }

  return validResult();
}

/**
 * Validates that a date is not in the future.
 * @param {string} dateStr - The date string to validate (YYYY-MM-DD)
 * @param {string} [fieldName='Date'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateDateNotFuture(dateStr, fieldName = 'Date') {
  const formatResult = validateDateFormat(dateStr, fieldName);
  if (!formatResult.valid) {
    return formatResult;
  }

  const parsed = new Date(dateStr.trim() + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (parsed.getTime() > today.getTime()) {
    return invalidResult(`${fieldName} cannot be in the future`);
  }

  return validResult();
}

/**
 * Validates that a date is not in the past.
 * @param {string} dateStr - The date string to validate (YYYY-MM-DD)
 * @param {string} [fieldName='Date'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateDateNotPast(dateStr, fieldName = 'Date') {
  const formatResult = validateDateFormat(dateStr, fieldName);
  if (!formatResult.valid) {
    return formatResult;
  }

  const parsed = new Date(dateStr.trim() + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (parsed.getTime() < today.getTime()) {
    return invalidResult(`${fieldName} cannot be in the past`);
  }

  return validResult();
}

/**
 * Validates that a date range is valid (start date is before or equal to end date).
 * @param {string} startDate - Start date string (YYYY-MM-DD)
 * @param {string} endDate - End date string (YYYY-MM-DD)
 * @param {string} [startFieldName='Start date'] - Name of the start date field
 * @param {string} [endFieldName='End date'] - Name of the end date field
 * @returns {ValidationResult}
 */
export function validateDateRange(startDate, endDate, startFieldName = 'Start date', endFieldName = 'End date') {
  const startResult = validateDateFormat(startDate, startFieldName);
  if (!startResult.valid) {
    return startResult;
  }

  const endResult = validateDateFormat(endDate, endFieldName);
  if (!endResult.valid) {
    return endResult;
  }

  const start = new Date(startDate.trim() + 'T00:00:00');
  const end = new Date(endDate.trim() + 'T00:00:00');

  if (start.getTime() > end.getTime()) {
    return invalidResult(`${startFieldName} must be before or equal to ${endFieldName}`);
  }

  return validResult();
}

/**
 * Validates that a date of birth is reasonable (not in the future, person is at least a given age).
 * @param {string} dateOfBirth - Date of birth string (YYYY-MM-DD)
 * @param {number} [minAge=0] - Minimum age in years
 * @param {number} [maxAge=150] - Maximum age in years
 * @param {string} [fieldName='Date of birth'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateDateOfBirth(dateOfBirth, minAge = 0, maxAge = 150, fieldName = 'Date of birth') {
  const formatResult = validateDateFormat(dateOfBirth, fieldName);
  if (!formatResult.valid) {
    return formatResult;
  }

  const futureResult = validateDateNotFuture(dateOfBirth, fieldName);
  if (!futureResult.valid) {
    return futureResult;
  }

  const dob = new Date(dateOfBirth.trim() + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  if (age < minAge) {
    return invalidResult(`${fieldName} indicates age less than ${minAge} years`);
  }

  if (age > maxAge) {
    return invalidResult(`${fieldName} indicates age greater than ${maxAge} years`);
  }

  return validResult();
}

// ─── Enum Validation ────────────────────────────────────────────────────────

/**
 * Validates that a value is one of the allowed values.
 * @param {*} value - The value to check
 * @param {Array} allowedValues - Array of allowed values
 * @param {string} [fieldName='Field'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateEnum(value, allowedValues, fieldName = 'Field') {
  if (!Array.isArray(allowedValues)) {
    return invalidResult(`${fieldName} validation configuration error: allowedValues must be an array`);
  }

  if (!allowedValues.includes(value)) {
    return invalidResult(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }

  return validResult();
}

// ─── Address Validation ─────────────────────────────────────────────────────

/**
 * Validates an address object.
 * @param {Object} address - The address object to validate
 * @param {string} [fieldName='Address'] - Name of the field for error messages
 * @returns {ValidationResults}
 */
export function validateAddress(address, fieldName = 'Address') {
  const errors = {};

  if (!address || typeof address !== 'object') {
    return { valid: false, errors: { [fieldName]: `${fieldName} is required` } };
  }

  const streetResult = validateRequired(address.street, `${fieldName} street`);
  if (!streetResult.valid) {
    errors.street = streetResult.error;
  }

  const cityResult = validateRequired(address.city, `${fieldName} city`);
  if (!cityResult.valid) {
    errors.city = cityResult.error;
  }

  const stateResult = validateRequired(address.state, `${fieldName} state`);
  if (!stateResult.valid) {
    errors.state = stateResult.error;
  } else if (typeof address.state === 'string' && address.state.trim().length !== 2) {
    errors.state = `${fieldName} state must be a 2-letter abbreviation`;
  }

  const zipResult = validateRequired(address.zipCode, `${fieldName} ZIP code`);
  if (!zipResult.valid) {
    errors.zipCode = zipResult.error;
  } else if (typeof address.zipCode === 'string') {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(address.zipCode.trim())) {
      errors.zipCode = `${fieldName} ZIP code must be in format XXXXX or XXXXX-XXXX`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ─── Medicare ID Validation ─────────────────────────────────────────────────

/**
 * Validates a Medicare Beneficiary Identifier (MBI) format.
 * MBI format: XAXX-AXX-XXAX where X = digit/letter, A = letter only.
 * For simplicity, we validate it is a non-empty string with the expected pattern.
 * @param {string} medicareId - The Medicare ID to validate
 * @param {string} [fieldName='Medicare ID'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateMedicareId(medicareId, fieldName = 'Medicare ID') {
  if (typeof medicareId !== 'string' || medicareId.trim().length === 0) {
    return invalidResult(`${fieldName} is required`);
  }

  const trimmed = medicareId.trim();

  // Accept the format used in seed data: XXXX-XXX-XXXX (alphanumeric with dashes)
  const mbiRegex = /^[A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{4}$/;
  if (!mbiRegex.test(trimmed)) {
    return invalidResult(`${fieldName} must be in format XXXX-XXX-XXXX`);
  }

  return validResult();
}

// ─── NPI Validation ─────────────────────────────────────────────────────────

/**
 * Validates a National Provider Identifier (NPI) format.
 * NPI is a 10-digit number.
 * @param {string} npi - The NPI to validate
 * @param {string} [fieldName='NPI'] - Name of the field for error messages
 * @returns {ValidationResult}
 */
export function validateNPI(npi, fieldName = 'NPI') {
  if (typeof npi !== 'string' || npi.trim().length === 0) {
    return invalidResult(`${fieldName} is required`);
  }

  const trimmed = npi.trim();
  const npiRegex = /^\d{10}$/;
  if (!npiRegex.test(trimmed)) {
    return invalidResult(`${fieldName} must be a 10-digit number`);
  }

  return validResult();
}

// ─── Enrollment Data Validation ─────────────────────────────────────────────

/**
 * Validates enrollment form data.
 * @param {Object} data - The enrollment data to validate
 * @param {string} data.memberId - Member ID
 * @param {string} data.benefitPackageId - Benefit package ID
 * @param {string} data.planType - Plan type
 * @param {string} data.channel - Enrollment channel
 * @param {string} data.effectiveDate - Effective date (YYYY-MM-DD)
 * @param {string} data.applicationDate - Application date (YYYY-MM-DD)
 * @param {string[]} data.diagnosisCodesVerified - Verified ICD-10 codes
 * @returns {ValidationResults}
 */
export function validateEnrollmentData(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: { _form: 'Enrollment data is required' } };
  }

  // Member ID
  const memberIdResult = validateRequired(data.memberId, 'Member ID');
  if (!memberIdResult.valid) {
    errors.memberId = memberIdResult.error;
  }

  // Benefit Package ID
  const packageResult = validateRequired(data.benefitPackageId, 'Benefit package');
  if (!packageResult.valid) {
    errors.benefitPackageId = packageResult.error;
  }

  // Plan Type
  const planTypeValues = Object.values(PLAN_TYPES);
  if (data.planType !== undefined && data.planType !== null) {
    const planTypeResult = validateEnum(data.planType, planTypeValues, 'Plan type');
    if (!planTypeResult.valid) {
      errors.planType = planTypeResult.error;
    }
  } else {
    errors.planType = 'Plan type is required';
  }

  // Channel
  const channelValues = Object.values(ENROLLMENT_CHANNELS);
  if (data.channel !== undefined && data.channel !== null) {
    const channelResult = validateEnum(data.channel, channelValues, 'Enrollment channel');
    if (!channelResult.valid) {
      errors.channel = channelResult.error;
    }
  } else {
    errors.channel = 'Enrollment channel is required';
  }

  // Effective Date
  if (data.effectiveDate !== undefined && data.effectiveDate !== null) {
    const effectiveDateResult = validateDateFormat(data.effectiveDate, 'Effective date');
    if (!effectiveDateResult.valid) {
      errors.effectiveDate = effectiveDateResult.error;
    }
  } else {
    errors.effectiveDate = 'Effective date is required';
  }

  // Application Date
  if (data.applicationDate !== undefined && data.applicationDate !== null) {
    const appDateResult = validateDateFormat(data.applicationDate, 'Application date');
    if (!appDateResult.valid) {
      errors.applicationDate = appDateResult.error;
    }
  } else {
    errors.applicationDate = 'Application date is required';
  }

  // Date range: application date should be before or equal to effective date
  if (
    !errors.applicationDate &&
    !errors.effectiveDate &&
    data.applicationDate &&
    data.effectiveDate
  ) {
    const rangeResult = validateDateRange(
      data.applicationDate,
      data.effectiveDate,
      'Application date',
      'Effective date'
    );
    if (!rangeResult.valid) {
      errors.effectiveDate = rangeResult.error;
    }
  }

  // Diagnosis Codes Verified
  if (data.diagnosisCodesVerified !== undefined && data.diagnosisCodesVerified !== null) {
    const codesResult = validateICD10Codes(
      data.diagnosisCodesVerified,
      'Verified diagnosis codes',
      { requireCSNPEligible: true, minCount: 1 }
    );
    if (!codesResult.valid) {
      errors.diagnosisCodesVerified = codesResult.error;
    }
  } else {
    errors.diagnosisCodesVerified = 'At least one verified diagnosis code is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ─── Member Data Validation ─────────────────────────────────────────────────

/**
 * Validates member form data.
 * @param {Object} data - The member data to validate
 * @param {string} data.firstName - First name
 * @param {string} data.lastName - Last name
 * @param {string} data.dateOfBirth - Date of birth (YYYY-MM-DD)
 * @param {string} data.ssn - Social Security Number
 * @param {string} data.medicareId - Medicare Beneficiary Identifier
 * @param {string} data.gender - Gender
 * @param {string} data.email - Email address
 * @param {string} data.phone - Phone number
 * @param {Object} data.address - Mailing address
 * @param {string[]} data.diagnosisCodes - ICD-10 diagnosis codes
 * @returns {ValidationResults}
 */
export function validateMemberData(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: { _form: 'Member data is required' } };
  }

  // First Name
  const firstNameResult = validateRequired(data.firstName, 'First name');
  if (!firstNameResult.valid) {
    errors.firstName = firstNameResult.error;
  } else {
    const minResult = validateMinLength(data.firstName, 1, 'First name');
    if (!minResult.valid) {
      errors.firstName = minResult.error;
    }
  }

  // Last Name
  const lastNameResult = validateRequired(data.lastName, 'Last name');
  if (!lastNameResult.valid) {
    errors.lastName = lastNameResult.error;
  } else {
    const minResult = validateMinLength(data.lastName, 1, 'Last name');
    if (!minResult.valid) {
      errors.lastName = minResult.error;
    }
  }

  // Date of Birth
  if (data.dateOfBirth !== undefined && data.dateOfBirth !== null) {
    const dobResult = validateDateOfBirth(data.dateOfBirth, 0, 150, 'Date of birth');
    if (!dobResult.valid) {
      errors.dateOfBirth = dobResult.error;
    }
  } else {
    errors.dateOfBirth = 'Date of birth is required';
  }

  // SSN
  if (data.ssn !== undefined && data.ssn !== null) {
    const ssnResult = validateSSN(data.ssn, 'SSN');
    if (!ssnResult.valid) {
      errors.ssn = ssnResult.error;
    }
  } else {
    errors.ssn = 'SSN is required';
  }

  // Medicare ID
  if (data.medicareId !== undefined && data.medicareId !== null) {
    const medicareResult = validateMedicareId(data.medicareId, 'Medicare ID');
    if (!medicareResult.valid) {
      errors.medicareId = medicareResult.error;
    }
  } else {
    errors.medicareId = 'Medicare ID is required';
  }

  // Gender
  const genderResult = validateRequired(data.gender, 'Gender');
  if (!genderResult.valid) {
    errors.gender = genderResult.error;
  }

  // Email
  if (data.email !== undefined && data.email !== null && data.email !== '') {
    const emailResult = validateEmail(data.email, 'Email');
    if (!emailResult.valid) {
      errors.email = emailResult.error;
    }
  }

  // Phone
  if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
    const phoneResult = validatePhone(data.phone, 'Phone');
    if (!phoneResult.valid) {
      errors.phone = phoneResult.error;
    }
  }

  // Address
  if (data.address !== undefined && data.address !== null) {
    const addressResult = validateAddress(data.address, 'Address');
    if (!addressResult.valid) {
      Object.entries(addressResult.errors).forEach(([key, value]) => {
        errors[`address.${key}`] = value;
      });
    }
  }

  // Diagnosis Codes
  if (data.diagnosisCodes !== undefined && data.diagnosisCodes !== null) {
    const codesResult = validateICD10Codes(data.diagnosisCodes, 'Diagnosis codes', { minCount: 1 });
    if (!codesResult.valid) {
      errors.diagnosisCodes = codesResult.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ─── Claim Data Validation ──────────────────────────────────────────────────

/**
 * Validates claim form data.
 * @param {Object} data - The claim data to validate
 * @param {string} data.memberId - Member ID
 * @param {string} data.providerId - Provider ID
 * @param {string} data.enrollmentId - Enrollment ID
 * @param {string} data.serviceDate - Date of service (YYYY-MM-DD)
 * @param {string[]} data.diagnosisCodes - ICD-10 diagnosis codes
 * @param {string} data.serviceDescription - Description of service
 * @param {number} data.billedAmount - Billed amount
 * @returns {ValidationResults}
 */
export function validateClaimData(data) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: { _form: 'Claim data is required' } };
  }

  // Member ID
  const memberIdResult = validateRequired(data.memberId, 'Member ID');
  if (!memberIdResult.valid) {
    errors.memberId = memberIdResult.error;
  }

  // Provider ID
  const providerIdResult = validateRequired(data.providerId, 'Provider ID');
  if (!providerIdResult.valid) {
    errors.providerId = providerIdResult.error;
  }

  // Enrollment ID
  const enrollmentIdResult = validateRequired(data.enrollmentId, 'Enrollment ID');
  if (!enrollmentIdResult.valid) {
    errors.enrollmentId = enrollmentIdResult.error;
  }

  // Service Date
  if (data.serviceDate !== undefined && data.serviceDate !== null) {
    const serviceDateResult = validateDateNotFuture(data.serviceDate, 'Service date');
    if (!serviceDateResult.valid) {
      errors.serviceDate = serviceDateResult.error;
    }
  } else {
    errors.serviceDate = 'Service date is required';
  }

  // Diagnosis Codes
  if (data.diagnosisCodes !== undefined && data.diagnosisCodes !== null) {
    const codesResult = validateICD10Codes(data.diagnosisCodes, 'Diagnosis codes', { minCount: 1 });
    if (!codesResult.valid) {
      errors.diagnosisCodes = codesResult.error;
    }
  } else {
    errors.diagnosisCodes = 'At least one diagnosis code is required';
  }

  // Service Description
  const descResult = validateRequired(data.serviceDescription, 'Service description');
  if (!descResult.valid) {
    errors.serviceDescription = descResult.error;
  }

  // Billed Amount
  if (data.billedAmount === undefined || data.billedAmount === null) {
    errors.billedAmount = 'Billed amount is required';
  } else {
    const amount = typeof data.billedAmount === 'string' ? parseFloat(data.billedAmount) : data.billedAmount;
    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.billedAmount = 'Billed amount must be a valid number';
    } else if (amount <= 0) {
      errors.billedAmount = 'Billed amount must be greater than zero';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ─── Generic Form Validation Runner ─────────────────────────────────────────

/**
 * Runs multiple validation functions against a data object and collects all errors.
 * @param {Object} data - The data to validate
 * @param {Array<{ field: string, validate: function(*): ValidationResult }>} rules - Array of validation rules
 * @returns {ValidationResults}
 */
export function runValidations(data, rules) {
  const errors = {};

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: { _form: 'Data is required' } };
  }

  if (!Array.isArray(rules)) {
    return { valid: false, errors: { _form: 'Validation rules must be an array' } };
  }

  for (const rule of rules) {
    if (!rule || typeof rule.field !== 'string' || typeof rule.validate !== 'function') {
      continue;
    }

    // Skip if we already have an error for this field
    if (errors[rule.field]) {
      continue;
    }

    const value = data[rule.field];
    const result = rule.validate(value);

    if (result && !result.valid && result.error) {
      errors[rule.field] = result.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Checks if a validation results object has any errors.
 * @param {ValidationResults} results - The validation results to check
 * @returns {boolean} Whether there are any errors
 */
export function hasErrors(results) {
  if (!results || typeof results !== 'object') {
    return false;
  }

  if (typeof results.valid === 'boolean') {
    return !results.valid;
  }

  if (results.errors && typeof results.errors === 'object') {
    return Object.keys(results.errors).length > 0;
  }

  return false;
}

/**
 * Returns the first error message from a validation results object.
 * @param {ValidationResults} results - The validation results
 * @returns {string|null} The first error message, or null if no errors
 */
export function getFirstError(results) {
  if (!results || !results.errors || typeof results.errors !== 'object') {
    return null;
  }

  const keys = Object.keys(results.errors);
  if (keys.length === 0) {
    return null;
  }

  return results.errors[keys[0]] || null;
}

/**
 * Returns all error messages from a validation results object as a flat array.
 * @param {ValidationResults} results - The validation results
 * @returns {string[]} Array of error messages
 */
export function getAllErrors(results) {
  if (!results || !results.errors || typeof results.errors !== 'object') {
    return [];
  }

  return Object.values(results.errors).filter((msg) => typeof msg === 'string' && msg.length > 0);
}