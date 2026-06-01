/**
 * Member-driven PCP change workflow (FR-002, FR-003, FR-004).
 * Enforces the VCC-attestation eligibility gate, persists change requests to
 * localStorage with a turnaround time, and queues a failure notification when
 * a submission cannot be accepted. All behavior is simulated — no real backend.
 * @module pcpChangeService
 */

import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { AUDIT_ACTIONS } from '../utils/constants.js';

/** localStorage key for PCP change requests. */
const REQUESTS_KEY = 'csnp_pcp_change_requests';
/** localStorage key for the simulated member notification outbox (shared with notification delivery). */
const OUTBOX_KEY = 'csnp_notifications_outbox';

/** Estimated processing turnaround for an accepted PCP change. */
export const PCP_CHANGE_TURNAROUND_DAYS = 10;

/**
 * VCC attestation statuses.
 * @enum {string}
 */
export const ATTESTATION_STATUSES = Object.freeze({
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress',
  NOT_STARTED: 'not_started',
});

/**
 * Selectable reasons for a PCP change (FR-003). The 'other' reason requires free text.
 * @type {{ value: string, label: string }[]}
 */
export const PCP_CHANGE_REASONS = Object.freeze([
  { value: 'relocated', label: 'I moved / relocated' },
  { value: 'access', label: 'Provider is too far / hard to reach' },
  { value: 'availability', label: 'Trouble getting appointments' },
  { value: 'dissatisfied', label: 'Dissatisfied with current provider' },
  { value: 'specialty', label: 'Need a provider for my condition' },
  { value: 'other', label: 'Other (please specify)' },
]);

/**
 * Returns the VCC attestation status for a member, defaulting to NOT_STARTED.
 * @param {Object|null} member - The member record
 * @returns {string} One of ATTESTATION_STATUSES
 */
export function getAttestationStatus(member) {
  const status = member && member.vccAttestation ? member.vccAttestation.status : null;
  if (status === ATTESTATION_STATUSES.COMPLETED || status === ATTESTATION_STATUSES.IN_PROGRESS) {
    return status;
  }
  return ATTESTATION_STATUSES.NOT_STARTED;
}

/**
 * @typedef {Object} EligibilityResult
 * @property {boolean} allowed - Whether the member may request a PCP change
 * @property {string} status - The attestation status
 * @property {string} message - Human-readable explanation
 */

/**
 * Determines whether a member is eligible to change their PCP (FR-002).
 * A change is permitted only when VCC attestation is completed or in progress.
 * @param {Object|null} member - The member record
 * @returns {EligibilityResult}
 */
export function canChangePcp(member) {
  const status = getAttestationStatus(member);
  if (status === ATTESTATION_STATUSES.COMPLETED) {
    return { allowed: true, status, message: 'Your VCC attestation is complete. You can request a PCP change.' };
  }
  if (status === ATTESTATION_STATUSES.IN_PROGRESS) {
    return { allowed: true, status, message: 'Your VCC attestation is in progress. You can request a PCP change.' };
  }
  return {
    allowed: false,
    status,
    message: 'A PCP change requires a completed or in-progress VCC attestation. Please complete your attestation or contact Member Services.',
  };
}

/**
 * Reads all PCP change requests from storage.
 * @returns {Object[]}
 */
function readRequests() {
  const list = getItem(REQUESTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

/**
 * Returns the PCP change requests for a member, newest first.
 * @param {string} memberId - The member ID
 * @returns {Object[]}
 */
export function getPcpChangeRequests(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }
  return readRequests()
    .filter((r) => r.memberId === memberId.trim())
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

/**
 * Returns the member's active (still-processing) PCP change request, if any.
 * @param {string} memberId - The member ID
 * @returns {Object|null}
 */
export function getActivePcpChangeRequest(memberId) {
  return getPcpChangeRequests(memberId).find((r) => r.status === 'submitted') || null;
}

/**
 * Returns the resolution label for a reason value.
 * @param {string} reasonValue - The reason value
 * @returns {string}
 */
export function getReasonLabel(reasonValue) {
  const found = PCP_CHANGE_REASONS.find((r) => r.value === reasonValue);
  return found ? found.label : reasonValue;
}

/**
 * Adds business days to a date (skips Sat/Sun).
 * @param {Date} start - Start date
 * @param {number} days - Number of business days to add
 * @returns {Date}
 */
function addBusinessDays(start, days) {
  const result = new Date(start.getTime());
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added += 1;
    }
  }
  return result;
}

/**
 * Queues a simulated email notification to the member's outbox (FR-004 failure path).
 * @param {Object} params - Notification parameters
 */
function queueEmail({ memberId, email, subject, body, category }) {
  try {
    const outbox = getItem(OUTBOX_KEY, []);
    const list = Array.isArray(outbox) ? outbox : [];
    list.unshift({
      id: uuidv4(),
      memberId,
      channel: 'email',
      to: email || null,
      category: category || 'processed_requests',
      subject,
      body,
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
    setItem(OUTBOX_KEY, list);
  } catch (err) {
    console.error('pcpChangeService.queueEmail: failed to queue email:', err);
  }
}

/**
 * Simulates network latency.
 * @returns {Promise<void>}
 */
function simulateDelay(minMs = 400, maxMs = 1100) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * @typedef {Object} PcpChangeSubmitResult
 * @property {boolean} success - Whether the request was accepted
 * @property {Object|null} request - The created request record
 * @property {number} [turnaroundDays] - Estimated turnaround in business days
 * @property {string} [estimatedCompletionDate] - ISO date the change is expected to complete
 * @property {string|null} error - Error message on failure
 * @property {boolean} [emailNotified] - Whether a failure email was sent
 */

/**
 * Submits a member's PCP change request (FR-003/FR-004).
 * On success, persists a 'submitted' request with a turnaround estimate.
 * On failure, queues an email notification to the member.
 *
 * @param {Object} payload - The change request payload
 * @param {Object} payload.member - The member record
 * @param {string} payload.currentProviderId - Current PCP provider ID (may be null)
 * @param {Object} payload.newProvider - The selected new provider (from Doctor & Hospital Finder)
 * @param {string} payload.reason - Reason value from PCP_CHANGE_REASONS
 * @param {string} [payload.reasonText] - Free text (required when reason is 'other')
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the action
 * @returns {Promise<PcpChangeSubmitResult>}
 */
export async function submitPcpChangeRequest(payload, options = {}) {
  await simulateDelay();

  const member = payload && payload.member ? payload.member : null;
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : (member ? member.id : 'system');

  try {
    // Re-check eligibility server-side (FR-002).
    const eligibility = canChangePcp(member);
    if (!member || !eligibility.allowed) {
      return { success: false, request: null, error: eligibility.message || 'You are not eligible to change your PCP at this time.' };
    }

    const newProvider = payload.newProvider;
    const reason = payload.reason;
    const reasonText = (payload.reasonText || '').trim();

    // Validation failures trigger a member email notification (FR-004 failure path).
    if (!newProvider || !newProvider.id) {
      const error = 'No new provider was selected. Your PCP change could not be submitted.';
      queueEmail({
        memberId: member.id,
        email: member.email,
        subject: 'Your PCP change request could not be processed',
        body: `Hello ${member.firstName}, we were unable to process your primary care provider change request because no provider was selected. Please try again or contact Member Services.`,
        category: 'processed_requests',
      });
      return { success: false, request: null, error, emailNotified: true };
    }

    if (reason === 'other' && reasonText.length === 0) {
      return { success: false, request: null, error: 'Please describe your reason for the change.' };
    }

    const now = new Date();
    const estimated = addBusinessDays(now, PCP_CHANGE_TURNAROUND_DAYS);
    const request = {
      id: uuidv4(),
      memberId: member.id,
      currentProviderId: payload.currentProviderId || null,
      newProviderId: newProvider.id,
      newProviderName: `${newProvider.firstName || ''} ${newProvider.lastName || ''}`.trim(),
      newProviderSpecialty: newProvider.specialty || null,
      reason,
      reasonLabel: getReasonLabel(reason),
      reasonText: reason === 'other' ? reasonText : '',
      status: 'submitted',
      turnaroundDays: PCP_CHANGE_TURNAROUND_DAYS,
      submittedAt: now.toISOString(),
      estimatedCompletionDate: estimated.toISOString().split('T')[0],
    };

    const list = readRequests();
    list.unshift(request);
    setItem(REQUESTS_KEY, list);

    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy,
      {
        targetType: 'pcp_change_request',
        targetId: request.id,
        description: `Member submitted a PCP change request to ${request.newProviderName} (reason: ${request.reasonLabel})`,
        metadata: { memberId: member.id, newProviderId: request.newProviderId, reason: request.reason },
        ipAddress: '127.0.0.1',
      },
      'member'
    );

    return {
      success: true,
      request,
      turnaroundDays: PCP_CHANGE_TURNAROUND_DAYS,
      estimatedCompletionDate: request.estimatedCompletionDate,
      error: null,
    };
  } catch (error) {
    console.error('pcpChangeService.submitPcpChangeRequest: unexpected error:', error);
    if (member) {
      queueEmail({
        memberId: member.id,
        email: member.email,
        subject: 'Your PCP change request could not be processed',
        body: `Hello ${member.firstName}, an unexpected error prevented us from processing your PCP change request. Please try again later.`,
        category: 'processed_requests',
      });
    }
    return { success: false, request: null, error: 'An unexpected error occurred while submitting your request.', emailNotified: true };
  }
}
