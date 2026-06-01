/**
 * Member notification preferences, delivery, and sync (FR-007, FR-008, FR-009).
 * - Stores per-category delivery preferences (Text/Email/Both/Off).
 * - Simulates email/SMS delivery to a localStorage "outbox".
 * - Syncs preferences to CDM and validates them in NCompass (simulated adapters).
 * No real backend — all behavior is simulated/localStorage.
 * @module notificationsService
 */

import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { AUDIT_ACTIONS } from '../utils/constants.js';
import { cdmSyncPreferences, nCompassValidatePreferences } from './integrationService.js';

/** localStorage key for per-member notification preferences (keyed map). */
const PREFS_KEY = 'csnp_notification_prefs';
/** localStorage key for the simulated notification outbox (shared with pcpChangeService). */
const OUTBOX_KEY = 'csnp_notifications_outbox';

/**
 * Notification categories (FR-007).
 * @enum {string}
 */
export const NOTIFICATION_CATEGORIES = Object.freeze({
  COVERAGE_INFO: 'coverage_info',
  PROCESSED_REQUESTS: 'processed_requests',
  HEALTH_WELLNESS: 'health_wellness',
});

/** Display metadata for each category. */
export const CATEGORY_META = Object.freeze([
  { key: NOTIFICATION_CATEGORIES.COVERAGE_INFO, label: 'Coverage Information', description: 'Plan coverage updates, benefit changes, and eligibility notices.' },
  { key: NOTIFICATION_CATEGORIES.PROCESSED_REQUESTS, label: 'Processed Requests', description: 'Updates on PCP changes, claims, and other requests you submit.' },
  { key: NOTIFICATION_CATEGORIES.HEALTH_WELLNESS, label: 'Health & Wellness', description: 'Care reminders, preventive screenings, and wellness programs.' },
]);

/**
 * Delivery methods (FR-007).
 * @enum {string}
 */
export const DELIVERY_METHODS = Object.freeze({
  NONE: 'none',
  TEXT: 'text',
  EMAIL: 'email',
  BOTH: 'both',
});

/** Display labels for delivery methods. */
export const DELIVERY_METHOD_LABELS = Object.freeze({
  [DELIVERY_METHODS.NONE]: 'Off',
  [DELIVERY_METHODS.TEXT]: 'Text',
  [DELIVERY_METHODS.EMAIL]: 'Email',
  [DELIVERY_METHODS.BOTH]: 'Both',
});

/** Default preferences applied when a member has none stored. */
const DEFAULT_PREFS = Object.freeze({
  [NOTIFICATION_CATEGORIES.COVERAGE_INFO]: DELIVERY_METHODS.EMAIL,
  [NOTIFICATION_CATEGORIES.PROCESSED_REQUESTS]: DELIVERY_METHODS.BOTH,
  [NOTIFICATION_CATEGORIES.HEALTH_WELLNESS]: DELIVERY_METHODS.EMAIL,
});

/**
 * Simulates network latency.
 * @returns {Promise<void>}
 */
function simulateDelay(minMs = 150, maxMs = 450) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Reads the full preferences map.
 * @returns {Object}
 */
function readPrefsMap() {
  const map = getItem(PREFS_KEY, {});
  return (map && typeof map === 'object' && !Array.isArray(map)) ? map : {};
}

/**
 * Returns a member's notification preferences, applying defaults.
 * @param {Object} member - The member record
 * @returns {Object} Map of category -> delivery method
 */
export function getNotificationPrefs(member) {
  const memberId = member ? member.id : null;
  const stored = memberId ? readPrefsMap()[memberId] : null;
  const prefs = { ...DEFAULT_PREFS };
  if (stored && typeof stored === 'object') {
    for (const { key } of CATEGORY_META) {
      if (stored[key]) {
        prefs[key] = stored[key];
      }
    }
  }
  return prefs;
}

/**
 * Reads the outbox.
 * @returns {Object[]}
 */
function readOutbox() {
  const list = getItem(OUTBOX_KEY, []);
  return Array.isArray(list) ? list : [];
}

/**
 * Returns a member's sent notifications, newest first.
 * @param {string} memberId - The member ID
 * @returns {Object[]}
 */
export function getOutbox(memberId) {
  if (!memberId) {
    return [];
  }
  return readOutbox()
    .filter((n) => n.memberId === memberId)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

/**
 * @typedef {Object} SavePrefsResult
 * @property {boolean} success - Whether the save succeeded
 * @property {Object} prefs - The saved preferences
 * @property {Object} sync - { cdm: IntegrationResponse, ncompass: IntegrationResponse }
 */

/**
 * Saves notification preferences (FR-007), then syncs to CDM and validates
 * in NCompass (FR-009).
 * @param {Object} member - The member record
 * @param {Object} prefs - Map of category -> delivery method
 * @param {Object} [options={}] - Options
 * @param {string} [options.performedBy] - User ID performing the action
 * @returns {Promise<SavePrefsResult>}
 */
export async function saveNotificationPrefs(member, prefs, options = {}) {
  await simulateDelay();

  const map = readPrefsMap();
  const clean = {};
  for (const { key } of CATEGORY_META) {
    clean[key] = prefs[key] || DELIVERY_METHODS.NONE;
  }
  map[member.id] = { ...clean, updatedAt: new Date().toISOString() };
  setItem(PREFS_KEY, map);

  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : member.id;
  logAction(
    AUDIT_ACTIONS.UPDATE,
    performedBy,
    {
      targetType: 'notification_prefs',
      targetId: member.id,
      description: 'Member updated notification preferences',
      metadata: { memberId: member.id, preferences: clean },
      ipAddress: '127.0.0.1',
    },
    'member'
  );

  // FR-009: sync to CDM, then validate in NCompass.
  const cdm = await cdmSyncPreferences({ memberId: member.id, preferences: clean }, { performedBy });
  const ncompass = await nCompassValidatePreferences(
    {
      memberId: member.id,
      preferences: clean,
      hasEmail: !!member.email,
      hasPhone: !!member.phone,
    },
    { performedBy }
  );

  return { success: true, prefs: clean, sync: { cdm, ncompass } };
}

/**
 * @typedef {Object} DeliveryResult
 * @property {boolean} delivered - Whether at least one channel was delivered
 * @property {string[]} channels - Channels delivered on
 * @property {string|null} reason - Reason when nothing was delivered
 * @property {Object[]} entries - The outbox entries created
 */

/**
 * Delivers a notification to a member per their category preference (FR-008).
 * Writes simulated email/SMS entries to the outbox.
 * @param {Object} member - The member record
 * @param {string} category - One of NOTIFICATION_CATEGORIES
 * @param {Object} message - { subject, body }
 * @returns {Promise<DeliveryResult>}
 */
export async function deliverNotification(member, category, message) {
  await simulateDelay(120, 360);

  const prefs = getNotificationPrefs(member);
  const method = prefs[category] || DELIVERY_METHODS.NONE;

  if (method === DELIVERY_METHODS.NONE) {
    return { delivered: false, channels: [], reason: 'Notifications are turned off for this category.', entries: [] };
  }

  const wantEmail = method === DELIVERY_METHODS.EMAIL || method === DELIVERY_METHODS.BOTH;
  const wantText = method === DELIVERY_METHODS.TEXT || method === DELIVERY_METHODS.BOTH;

  const outbox = readOutbox();
  const entries = [];
  const channels = [];

  if (wantEmail) {
    const status = member.email ? 'sent' : 'failed';
    if (status === 'sent') {
      channels.push('email');
    }
    entries.push({
      id: uuidv4(), memberId: member.id, channel: 'email', to: member.email || null,
      category, subject: message.subject, body: message.body, status, sentAt: new Date().toISOString(),
    });
  }
  if (wantText) {
    const status = member.phone ? 'sent' : 'failed';
    if (status === 'sent') {
      channels.push('text');
    }
    entries.push({
      id: uuidv4(), memberId: member.id, channel: 'text', to: member.phone || null,
      category, subject: message.subject, body: message.body, status, sentAt: new Date().toISOString(),
    });
  }

  setItem(OUTBOX_KEY, [...entries, ...outbox]);

  return {
    delivered: channels.length > 0,
    channels,
    reason: channels.length > 0 ? null : 'No valid contact method on file for the selected channels.',
    entries,
  };
}
