/**
 * General utility functions for the CSNP Portal.
 * Provides date formatting, UUID generation, string sanitization,
 * masking helpers, deep clone, debounce, search/filter utilities,
 * and status badge color mapping.
 * @module helpers
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ENROLLMENT_STATUSES,
  CLAIM_STATUSES,
  REFERRAL_STATUSES,
} from './constants.js';

// ─── UUID Generation ────────────────────────────────────────────────────────

/**
 * Generates a new UUID v4 string.
 * @returns {string} A new UUID
 */
export function generateId() {
  return uuidv4();
}

// ─── Date Formatting ────────────────────────────────────────────────────────

/**
 * Formats a date string or Date object to a human-readable format.
 * @param {string|Date|null|undefined} date - The date to format
 * @param {Object} [options={}] - Intl.DateTimeFormat options override
 * @returns {string} Formatted date string, or empty string if invalid
 */
export function formatDate(date, options = {}) {
  if (!date) {
    return '';
  }

  try {
    const parsed = typeof date === 'string' ? new Date(date) : date;
    if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
      return '';
    }

    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    };

    return new Intl.DateTimeFormat('en-US', defaultOptions).format(parsed);
  } catch {
    return '';
  }
}

/**
 * Formats a date string or Date object to MM/DD/YYYY format.
 * @param {string|Date|null|undefined} date - The date to format
 * @returns {string} Formatted date string, or empty string if invalid
 */
export function formatDateShort(date) {
  return formatDate(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Formats a date string or Date object to a long format with time.
 * @param {string|Date|null|undefined} date - The date to format
 * @returns {string} Formatted date-time string, or empty string if invalid
 */
export function formatDateTime(date) {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a date as an ISO date string (YYYY-MM-DD).
 * @param {string|Date|null|undefined} date - The date to format
 * @returns {string} ISO date string, or empty string if invalid
 */
export function formatISODate(date) {
  if (!date) {
    return '';
  }

  try {
    const parsed = typeof date === 'string' ? new Date(date) : date;
    if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
      return '';
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Returns a relative time string (e.g. "3 days ago", "in 2 hours").
 * @param {string|Date|null|undefined} date - The date to compare
 * @returns {string} Relative time string, or empty string if invalid
 */
export function formatRelativeTime(date) {
  if (!date) {
    return '';
  }

  try {
    const parsed = typeof date === 'string' ? new Date(date) : date;
    if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
      return '';
    }

    const now = new Date();
    const diffMs = now.getTime() - parsed.getTime();
    const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
    const isFuture = diffMs < 0;

    if (diffSeconds < 60) {
      return 'just now';
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      const label = diffMinutes === 1 ? 'minute' : 'minutes';
      return isFuture ? `in ${diffMinutes} ${label}` : `${diffMinutes} ${label} ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      const label = diffHours === 1 ? 'hour' : 'hours';
      return isFuture ? `in ${diffHours} ${label}` : `${diffHours} ${label} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      const label = diffDays === 1 ? 'day' : 'days';
      return isFuture ? `in ${diffDays} ${label}` : `${diffDays} ${label} ago`;
    }

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      const label = diffMonths === 1 ? 'month' : 'months';
      return isFuture ? `in ${diffMonths} ${label}` : `${diffMonths} ${label} ago`;
    }

    const diffYears = Math.floor(diffMonths / 12);
    const label = diffYears === 1 ? 'year' : 'years';
    return isFuture ? `in ${diffYears} ${label}` : `${diffYears} ${label} ago`;
  } catch {
    return '';
  }
}

// ─── String Sanitization ────────────────────────────────────────────────────

/**
 * Sanitizes a string by trimming whitespace and removing HTML tags.
 * @param {string} str - The string to sanitize
 * @returns {string} Sanitized string, or empty string if input is not a string
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize
 * @returns {string} Capitalized string, or empty string if input is not a string
 */
export function capitalize(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a snake_case or kebab-case string to Title Case.
 * @param {string} str - The string to convert
 * @returns {string} Title-cased string
 */
export function toTitleCase(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }
  return str
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Truncates a string to a maximum length and appends an ellipsis.
 * @param {string} str - The string to truncate
 * @param {number} [maxLength=100] - Maximum length before truncation
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 100) {
  if (typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength).trimEnd() + '…';
}

// ─── Masking Helpers ────────────────────────────────────────────────────────

/**
 * Masks a Social Security Number, showing only the last 4 digits.
 * @param {string} ssn - The SSN to mask (any format)
 * @returns {string} Masked SSN in format ***-**-XXXX, or empty string if invalid
 */
export function maskSSN(ssn) {
  if (typeof ssn !== 'string' || ssn.length === 0) {
    return '';
  }

  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) {
    return '***-**-****';
  }

  const lastFour = digits.slice(-4);
  return `***-**-${lastFour}`;
}

/**
 * Masks a CMS Contract/Component ID, showing only the first and last segments.
 * @param {string} ccid - The CCID to mask
 * @returns {string} Masked CCID, or empty string if invalid
 */
export function maskCCID(ccid) {
  if (typeof ccid !== 'string' || ccid.length === 0) {
    return '';
  }

  const parts = ccid.split('-');
  if (parts.length < 2) {
    return ccid;
  }

  return `${parts[0]}-***`;
}

/**
 * Masks a Medicare ID, showing only the last 4 characters.
 * @param {string} medicareId - The Medicare ID to mask
 * @returns {string} Masked Medicare ID, or empty string if invalid
 */
export function maskMedicareId(medicareId) {
  if (typeof medicareId !== 'string' || medicareId.length === 0) {
    return '';
  }

  if (medicareId.length <= 4) {
    return medicareId;
  }

  const masked = '*'.repeat(medicareId.length - 4) + medicareId.slice(-4);
  return masked;
}

// ─── Deep Clone ─────────────────────────────────────────────────────────────

/**
 * Creates a deep clone of a value using structured cloning via JSON serialization.
 * @param {*} value - The value to clone
 * @returns {*} A deep clone of the value, or null on error
 */
export function deepClone(value) {
  if (value === null || value === undefined) {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    console.error('helpers.deepClone: failed to clone value');
    return null;
  }
}

// ─── Debounce ───────────────────────────────────────────────────────────────

/**
 * Creates a debounced version of a function that delays invocation
 * until after the specified wait time has elapsed since the last call.
 * @param {Function} fn - The function to debounce
 * @param {number} [wait=300] - Delay in milliseconds
 * @returns {Function} Debounced function with a .cancel() method
 */
export function debounce(fn, wait = 300) {
  let timeoutId = null;

  function debounced(...args) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, wait);
  }

  debounced.cancel = function cancel() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

// ─── Currency Formatting ────────────────────────────────────────────────────

/**
 * Formats a number as a US dollar currency string.
 * @param {number|string|null|undefined} amount - The amount to format
 * @returns {string} Formatted currency string, or '$0.00' if invalid
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) {
    return '$0.00';
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (typeof num !== 'number' || isNaN(num)) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// ─── Phone Formatting ───────────────────────────────────────────────────────

/**
 * Formats a phone number string to (XXX) XXX-XXXX format.
 * @param {string} phone - The phone number to format
 * @returns {string} Formatted phone number, or original string if not 10 digits
 */
export function formatPhone(phone) {
  if (typeof phone !== 'string') {
    return '';
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.charAt(0) === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone;
}

// ─── Search & Filter Helpers ────────────────────────────────────────────────

/**
 * Performs a case-insensitive search across multiple fields of an object.
 * @param {Object} item - The object to search within
 * @param {string[]} fields - Array of field names to search
 * @param {string} query - The search query
 * @returns {boolean} Whether any field matches the query
 */
export function matchesSearch(item, fields, query) {
  if (!item || !query || typeof query !== 'string') {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return true;
  }

  return fields.some((field) => {
    const value = getNestedValue(item, field);
    if (value === null || value === undefined) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(normalizedQuery)
      );
    }

    const strValue = String(value).toLowerCase();
    return strValue.includes(normalizedQuery);
  });
}

/**
 * Retrieves a nested value from an object using dot notation.
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path (e.g. 'address.city')
 * @returns {*} The value at the path, or undefined if not found
 */
export function getNestedValue(obj, path) {
  if (!obj || typeof path !== 'string') {
    return undefined;
  }

  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    return current[key];
  }, obj);
}

/**
 * Filters an array of objects by a search query across specified fields.
 * @param {Object[]} items - Array of objects to filter
 * @param {string[]} fields - Array of field names to search
 * @param {string} query - The search query
 * @returns {Object[]} Filtered array
 */
export function filterBySearch(items, fields, query) {
  if (!Array.isArray(items)) {
    return [];
  }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return items;
  }

  return items.filter((item) => matchesSearch(item, fields, query));
}

/**
 * Sorts an array of objects by a specified field.
 * @param {Object[]} items - Array of objects to sort
 * @param {string} field - Field name to sort by
 * @param {'asc'|'desc'} [direction='asc'] - Sort direction
 * @returns {Object[]} New sorted array
 */
export function sortByField(items, field, direction = 'asc') {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const sorted = [...items].sort((a, b) => {
    const valA = getNestedValue(a, field);
    const valB = getNestedValue(b, field);

    if (valA === valB) {
      return 0;
    }
    if (valA === null || valA === undefined) {
      return 1;
    }
    if (valB === null || valB === undefined) {
      return -1;
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return valA.localeCompare(valB);
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return valA - valB;
    }

    return String(valA).localeCompare(String(valB));
  });

  if (direction === 'desc') {
    sorted.reverse();
  }

  return sorted;
}

/**
 * Paginates an array of items.
 * @param {Array} items - Array to paginate
 * @param {number} [page=1] - Current page (1-indexed)
 * @param {number} [pageSize=20] - Number of items per page
 * @returns {{ data: Array, page: number, pageSize: number, totalItems: number, totalPages: number }}
 */
export function paginate(items, page = 1, pageSize = 20) {
  if (!Array.isArray(items)) {
    return { data: [], page: 1, pageSize, totalItems: 0, totalPages: 0 };
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (safePage - 1) * pageSize;
  const data = items.slice(startIndex, startIndex + pageSize);

  return {
    data,
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}

// ─── Status Badge Color Mapping ─────────────────────────────────────────────

/**
 * @typedef {Object} BadgeColors
 * @property {string} bg - Tailwind background class
 * @property {string} text - Tailwind text color class
 * @property {string} border - Tailwind border class
 */

/**
 * Returns Tailwind CSS classes for enrollment status badges.
 * @param {string} status - Enrollment status from ENROLLMENT_STATUSES
 * @returns {BadgeColors} Object with bg, text, and border class strings
 */
export function getEnrollmentStatusColors(status) {
  switch (status) {
    case ENROLLMENT_STATUSES.ACTIVE:
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
    case ENROLLMENT_STATUSES.APPROVED:
      return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
    case ENROLLMENT_STATUSES.PENDING:
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
    case ENROLLMENT_STATUSES.REJECTED:
      return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
    case ENROLLMENT_STATUSES.CANCELLED:
      return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
    case ENROLLMENT_STATUSES.DISENROLLED:
      return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  }
}

/**
 * Returns Tailwind CSS classes for claim status badges.
 * @param {string} status - Claim status from CLAIM_STATUSES
 * @returns {BadgeColors} Object with bg, text, and border class strings
 */
export function getClaimStatusColors(status) {
  switch (status) {
    case CLAIM_STATUSES.PAID:
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
    case CLAIM_STATUSES.APPROVED:
      return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
    case CLAIM_STATUSES.SUBMITTED:
      return { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' };
    case CLAIM_STATUSES.PENDING:
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
    case CLAIM_STATUSES.IN_REVIEW:
      return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' };
    case CLAIM_STATUSES.DENIED:
      return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
    case CLAIM_STATUSES.PARTIALLY_APPROVED:
      return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' };
    case CLAIM_STATUSES.APPEALED:
      return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' };
    case CLAIM_STATUSES.VOIDED:
      return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  }
}

/**
 * Returns Tailwind CSS classes for referral status badges.
 * @param {string} status - Referral status from REFERRAL_STATUSES
 * @returns {BadgeColors} Object with bg, text, and border class strings
 */
export function getReferralStatusColors(status) {
  switch (status) {
    case REFERRAL_STATUSES.COMPLETED:
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
    case REFERRAL_STATUSES.ACCEPTED:
      return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
    case REFERRAL_STATUSES.PENDING:
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
    case REFERRAL_STATUSES.IN_PROGRESS:
      return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' };
    case REFERRAL_STATUSES.REJECTED:
      return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
    case REFERRAL_STATUSES.CANCELLED:
      return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
    case REFERRAL_STATUSES.EXPIRED:
      return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  }
}

// ─── Miscellaneous ──────────────────────────────────────────────────────────

/**
 * Checks whether a value is a non-empty string.
 * @param {*} value - The value to check
 * @returns {boolean}
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Checks whether a value is a valid email address (basic validation).
 * @param {string} email - The email to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Checks whether a value is a valid phone number (10 or 11 digits).
 * @param {string} phone - The phone number to validate
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (typeof phone !== 'string') {
    return false;
  }
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.charAt(0) === '1');
}

/**
 * Calculates age from a date of birth string.
 * @param {string|Date} dateOfBirth - Date of birth
 * @returns {number|null} Age in years, or null if invalid
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }

  try {
    const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    if (!(dob instanceof Date) || isNaN(dob.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  } catch {
    return null;
  }
}

/**
 * Returns the full name from a first and last name.
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {string} Full name
 */
export function getFullName(firstName, lastName) {
  const first = typeof firstName === 'string' ? firstName.trim() : '';
  const last = typeof lastName === 'string' ? lastName.trim() : '';

  if (first && last) {
    return `${first} ${last}`;
  }

  return first || last || '';
}

/**
 * Generates a display-friendly address string from an address object.
 * @param {Object} address - Address object with street, city, state, zipCode
 * @returns {string} Formatted address string
 */
export function formatAddress(address) {
  if (!address || typeof address !== 'object') {
    return '';
  }

  const parts = [];
  if (address.street) {
    parts.push(address.street);
  }

  const cityStateZip = [];
  if (address.city) {
    cityStateZip.push(address.city);
  }
  if (address.state) {
    cityStateZip.push(address.state);
  }
  if (address.zipCode) {
    cityStateZip.push(address.zipCode);
  }

  if (cityStateZip.length > 0) {
    if (address.city && address.state) {
      parts.push(`${address.city}, ${address.state} ${address.zipCode || ''}`.trim());
    } else {
      parts.push(cityStateZip.join(' '));
    }
  }

  return parts.join(', ');
}

/**
 * Groups an array of objects by a specified key.
 * @param {Object[]} items - Array of objects to group
 * @param {string} key - The key to group by
 * @returns {Object.<string, Object[]>} Grouped object
 */
export function groupBy(items, key) {
  if (!Array.isArray(items)) {
    return {};
  }

  return items.reduce((groups, item) => {
    const value = getNestedValue(item, key);
    const groupKey = value !== null && value !== undefined ? String(value) : 'undefined';

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {});
}

/**
 * Returns unique values from an array.
 * @param {Array} arr - The array to deduplicate
 * @returns {Array} Array with unique values
 */
export function unique(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }
  return [...new Set(arr)];
}

/**
 * Checks if a date string represents a date in the past.
 * @param {string|Date} date - The date to check
 * @returns {boolean}
 */
export function isPastDate(date) {
  if (!date) {
    return false;
  }

  try {
    const parsed = typeof date === 'string' ? new Date(date) : date;
    if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
      return false;
    }
    return parsed.getTime() < Date.now();
  } catch {
    return false;
  }
}

/**
 * Checks if a date string represents a date in the future.
 * @param {string|Date} date - The date to check
 * @returns {boolean}
 */
export function isFutureDate(date) {
  if (!date) {
    return false;
  }

  try {
    const parsed = typeof date === 'string' ? new Date(date) : date;
    if (!(parsed instanceof Date) || isNaN(parsed.getTime())) {
      return false;
    }
    return parsed.getTime() > Date.now();
  } catch {
    return false;
  }
}