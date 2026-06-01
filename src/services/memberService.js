/**
 * Member self-service data access for the member portal.
 * Reads/writes the member record in localStorage (`csnp_members`) and
 * simulates API latency, mirroring the integrationService adapter pattern.
 * There is no real backend — all persistence is localStorage.
 * @module memberService
 */

import { getItem, setItem } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { AUDIT_ACTIONS } from '../utils/constants.js';
import { getCurrentUser } from './authService.js';

/**
 * localStorage key for the members collection.
 * @type {string}
 */
const MEMBERS_KEY = 'csnp_members';

/**
 * localStorage key for the user-accounts collection.
 * A member-role user account (in `csnp_users`) is linked to a member record
 * (in `csnp_members`) via `user.memberId`. The two records duplicate "common
 * details" (first/last name, email), so edits must be kept in sync.
 * @type {string}
 */
const USERS_KEY = 'csnp_users';

/**
 * Member profile fields a member is allowed to self-edit (FR-001).
 * SSN, Medicare ID, diagnosis codes, eligibility, etc. are intentionally excluded.
 * @type {string[]}
 */
const EDITABLE_FIELDS = Object.freeze(['firstName', 'lastName', 'email', 'phone', 'address']);

/**
 * Returns a promise that resolves after a simulated network delay.
 * @param {number} [minMs=120] - Minimum delay in milliseconds
 * @param {number} [maxMs=420] - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
function simulateDelay(minMs = 120, maxMs = 420) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Keeps the linked user account's "common details" in sync with the member
 * record, so the admin User Management view reflects member self-service edits.
 * Matches the user whose `memberId` equals this member's id.
 * @param {string} memberId - The member record ID
 * @param {{ firstName?: string, lastName?: string, email?: string }} common - Common fields to sync
 * @returns {void}
 */
function syncLinkedUser(memberId, common) {
  try {
    const users = getItem(USERS_KEY, []);
    if (!Array.isArray(users)) {
      return;
    }
    let changed = false;
    const next = users.map((u) => {
      if (u && u.memberId === memberId) {
        changed = true;
        return {
          ...u,
          firstName: common.firstName !== undefined ? common.firstName : u.firstName,
          lastName: common.lastName !== undefined ? common.lastName : u.lastName,
          email: common.email !== undefined ? common.email : u.email,
          updatedAt: new Date().toISOString(),
        };
      }
      return u;
    });
    if (changed) {
      setItem(USERS_KEY, next);
    }
  } catch (error) {
    console.error('memberService.syncLinkedUser: failed to sync linked user:', error);
  }
}

/**
 * Reads the full members collection from localStorage.
 * @returns {Object[]} Array of member records
 */
function readMembers() {
  const members = getItem(MEMBERS_KEY, []);
  return Array.isArray(members) ? members : [];
}

/**
 * Finds a member record by ID.
 * @param {string} memberId - The member ID
 * @returns {Object|null} The member record, or null if not found
 */
export function getMemberById(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return null;
  }
  const found = readMembers().find((m) => m.id === memberId.trim());
  return found || null;
}

/**
 * Resolves the member record for the currently authenticated member user.
 * Returns null if no member is logged in or the linked record is missing.
 * @returns {Object|null} The current member record, or null
 */
export function getCurrentMember() {
  const user = getCurrentUser();
  if (!user || !user.memberId) {
    return null;
  }
  return getMemberById(user.memberId);
}

/**
 * @typedef {Object} MemberUpdateResult
 * @property {boolean} success - Whether the update succeeded
 * @property {Object|null} member - The updated member record, or null on failure
 * @property {string|null} error - Error message if the update failed
 */

/**
 * Updates the editable profile fields of a member record (FR-001).
 * Simulates an API call (latency), persists to localStorage, and writes an audit entry.
 *
 * @param {string} memberId - The member ID to update
 * @param {Object} patch - Partial member fields to apply (only EDITABLE_FIELDS are honored)
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the update
 * @returns {Promise<MemberUpdateResult>} The update result
 */
export async function updateMemberProfile(memberId, patch, options = {}) {
  await simulateDelay();

  try {
    if (typeof memberId !== 'string' || memberId.trim().length === 0) {
      return { success: false, member: null, error: 'A member ID is required' };
    }
    if (!patch || typeof patch !== 'object') {
      return { success: false, member: null, error: 'No changes were provided' };
    }

    const members = readMembers();
    const index = members.findIndex((m) => m.id === memberId.trim());
    if (index === -1) {
      return { success: false, member: null, error: 'Member record not found' };
    }

    // Apply only whitelisted fields.
    const updated = { ...members[index] };
    const changedFields = [];
    for (const field of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(patch, field) && patch[field] !== undefined) {
        updated[field] = patch[field];
        changedFields.push(field);
      }
    }

    if (changedFields.length === 0) {
      return { success: false, member: null, error: 'No editable fields were changed' };
    }

    updated.updatedAt = new Date().toISOString();
    members[index] = updated;
    setItem(MEMBERS_KEY, members);

    // Keep the linked user account's common details consistent (single source of truth).
    syncLinkedUser(memberId.trim(), {
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
    });

    const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : memberId.trim();
    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy,
      {
        targetType: 'member_profile',
        targetId: memberId.trim(),
        description: `Member updated account information (${changedFields.join(', ')})`,
        metadata: { memberId: memberId.trim(), changedFields },
        ipAddress: '127.0.0.1',
      },
      'member'
    );

    return { success: true, member: updated, error: null };
  } catch (error) {
    console.error('memberService.updateMemberProfile: unexpected error:', error);
    return { success: false, member: null, error: 'An unexpected error occurred while saving your changes' };
  }
}

export { EDITABLE_FIELDS };
