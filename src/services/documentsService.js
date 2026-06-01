/**
 * Member documents & paperless delivery (FR-005, FR-006).
 * Manages paperless-delivery preferences (with a verified delivery email) and
 * provides the member's plan documents (EOB, statements, benefit documents).
 * All data is simulated/localStorage — no real backend or document store.
 * @module documentsService
 */

import { getItem, setItem } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import { AUDIT_ACTIONS } from '../utils/constants.js';
import { validateEmail } from '../utils/validators.js';

/** localStorage key for per-member paperless preferences (keyed map by memberId). */
const PAPERLESS_KEY = 'csnp_paperless_prefs';

/**
 * Document types available for paperless delivery (FR-006).
 * @enum {string}
 */
export const DOCUMENT_TYPES = Object.freeze({
  EOB: 'eob',
  STATEMENT: 'statement',
  BENEFIT: 'benefit',
});

/**
 * Display labels for document types.
 * @type {Object.<string,string>}
 */
export const DOCUMENT_TYPE_LABELS = Object.freeze({
  [DOCUMENT_TYPES.EOB]: 'Explanation of Benefits',
  [DOCUMENT_TYPES.STATEMENT]: 'Statement',
  [DOCUMENT_TYPES.BENEFIT]: 'Benefit Document',
});

/**
 * Simulates network latency.
 * @returns {Promise<void>}
 */
function simulateDelay(minMs = 150, maxMs = 500) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Reads the full paperless-preferences map.
 * @returns {Object} Map of memberId -> prefs
 */
function readPrefsMap() {
  const map = getItem(PAPERLESS_KEY, {});
  return (map && typeof map === 'object' && !Array.isArray(map)) ? map : {};
}

/**
 * @typedef {Object} PaperlessPrefs
 * @property {boolean} enabled - Whether paperless delivery is on
 * @property {string} deliveryEmail - Email used for paperless delivery
 * @property {boolean} verified - Whether the delivery email is verified
 * @property {string|null} updatedAt - ISO timestamp of the last change
 */

/**
 * Returns a member's paperless preferences, defaulting to their verified
 * account email (FR-005: verified email by default).
 * @param {Object} member - The member record
 * @returns {PaperlessPrefs}
 */
export function getPaperlessPrefs(member) {
  const memberId = member ? member.id : null;
  const map = readPrefsMap();
  const stored = memberId ? map[memberId] : null;
  if (stored && typeof stored === 'object') {
    return {
      enabled: !!stored.enabled,
      deliveryEmail: stored.deliveryEmail || (member ? member.email : ''),
      verified: stored.verified !== false,
      updatedAt: stored.updatedAt || null,
    };
  }
  // Default: paperless off, delivery to the member's verified account email.
  return {
    enabled: false,
    deliveryEmail: member ? member.email : '',
    verified: true,
    updatedAt: null,
  };
}

/**
 * Persists a member's paperless preferences and writes an audit entry.
 * @param {Object} member - The member record
 * @param {PaperlessPrefs} prefs - The preferences to store
 * @param {string} description - Audit description
 * @returns {PaperlessPrefs} The stored preferences
 */
function persistPrefs(member, prefs, description) {
  const map = readPrefsMap();
  const next = { ...prefs, updatedAt: new Date().toISOString() };
  map[member.id] = next;
  setItem(PAPERLESS_KEY, map);
  logAction(
    AUDIT_ACTIONS.UPDATE,
    member.id,
    {
      targetType: 'paperless_prefs',
      targetId: member.id,
      description,
      metadata: { enabled: next.enabled, deliveryEmail: next.deliveryEmail, verified: next.verified },
      ipAddress: '127.0.0.1',
    },
    'member'
  );
  return next;
}

/**
 * Enables or disables paperless delivery (FR-005).
 * @param {Object} member - The member record
 * @param {boolean} enabled - Whether paperless should be on
 * @returns {Promise<{ success: boolean, prefs: PaperlessPrefs }>}
 */
export async function setPaperlessEnabled(member, enabled) {
  await simulateDelay();
  const current = getPaperlessPrefs(member);
  const prefs = persistPrefs(
    member,
    { ...current, enabled: !!enabled },
    `Member ${enabled ? 'enabled' : 'disabled'} paperless document delivery`
  );
  return { success: true, prefs };
}

/**
 * Changes the paperless delivery email (FR-005). The new email starts
 * unverified and must be verified before it is considered trusted.
 * @param {Object} member - The member record
 * @param {string} email - The new delivery email
 * @returns {Promise<{ success: boolean, prefs: PaperlessPrefs|null, error: string|null }>}
 */
export async function changeDeliveryEmail(member, email) {
  await simulateDelay();
  const validation = validateEmail(email, 'Delivery email');
  if (!validation.valid) {
    return { success: false, prefs: null, error: validation.error };
  }
  const current = getPaperlessPrefs(member);
  const trimmed = email.trim();
  // If it matches the member's verified account email, it's already verified.
  const isAccountEmail = member && member.email && trimmed.toLowerCase() === member.email.toLowerCase();
  const prefs = persistPrefs(
    member,
    { ...current, deliveryEmail: trimmed, verified: !!isAccountEmail },
    `Member changed paperless delivery email to ${trimmed}`
  );
  return { success: true, prefs, error: null };
}

/**
 * Simulates verifying the delivery email (e.g., the member clicked the
 * verification link). Marks the delivery email as verified.
 * @param {Object} member - The member record
 * @returns {Promise<{ success: boolean, prefs: PaperlessPrefs }>}
 */
export async function verifyDeliveryEmail(member) {
  await simulateDelay(300, 700);
  const current = getPaperlessPrefs(member);
  const prefs = persistPrefs(
    member,
    { ...current, verified: true },
    `Member verified paperless delivery email ${current.deliveryEmail}`
  );
  return { success: true, prefs };
}

/**
 * Formats a Date as YYYY-MM-DD.
 * @param {Date} d - The date
 * @returns {string}
 */
function ymd(d) {
  return d.toISOString().split('T')[0];
}

/**
 * @typedef {Object} MemberDocument
 * @property {string} id - Stable document ID
 * @property {string} type - One of DOCUMENT_TYPES
 * @property {string} title - Display title
 * @property {string} date - Document date (YYYY-MM-DD)
 * @property {string} period - Coverage/period label
 * @property {string} format - File format (e.g., 'PDF')
 * @property {number} sizeKb - Simulated file size in KB
 */

/**
 * Generates the member's plan documents (FR-006): recent EOBs, monthly
 * statements, and benefit documents. Deterministic per member + month.
 * @param {Object} member - The member record
 * @returns {MemberDocument[]} Documents, newest first
 */
export function getMemberDocuments(member) {
  if (!member || !member.id) {
    return [];
  }
  const docs = [];
  const now = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const idStem = member.id.substring(0, 8);

  // Recent EOBs + statements for the last 3 months.
  for (let i = 1; i <= 3; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 14);
    const monthLabel = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    docs.push({
      id: `eob-${idStem}-${ymd(d)}`,
      type: DOCUMENT_TYPES.EOB,
      title: `Explanation of Benefits — ${monthLabel}`,
      date: ymd(d),
      period: monthLabel,
      format: 'PDF',
      sizeKb: 120 + i * 18,
    });
    docs.push({
      id: `stmt-${idStem}-${ymd(d)}`,
      type: DOCUMENT_TYPES.STATEMENT,
      title: `Monthly Statement — ${monthLabel}`,
      date: ymd(d),
      period: monthLabel,
      format: 'PDF',
      sizeKb: 64 + i * 10,
    });
  }

  // Benefit documents for the plan year.
  docs.push({
    id: `ben-summary-${idStem}-${now.getFullYear()}`,
    type: DOCUMENT_TYPES.BENEFIT,
    title: `Summary of Benefits — ${now.getFullYear()} Plan Year`,
    date: `${now.getFullYear()}-01-01`,
    period: `${now.getFullYear()} Plan Year`,
    format: 'PDF',
    sizeKb: 280,
  });
  docs.push({
    id: `ben-anoc-${idStem}-${now.getFullYear()}`,
    type: DOCUMENT_TYPES.BENEFIT,
    title: `Annual Notice of Changes (ANOC) — ${now.getFullYear()}`,
    date: `${now.getFullYear()}-01-01`,
    period: `${now.getFullYear()} Plan Year`,
    format: 'PDF',
    sizeKb: 340,
  });

  return docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Builds simulated plain-text content for a document (used for download).
 * @param {MemberDocument} doc - The document
 * @param {Object} member - The member record
 * @returns {string} Document content
 */
export function buildDocumentContent(doc, member) {
  const lines = [
    'CSNP MEMBER PORTAL — SIMULATED DOCUMENT',
    '==========================================',
    '',
    `Document:     ${doc.title}`,
    `Type:         ${DOCUMENT_TYPE_LABELS[doc.type] || doc.type}`,
    `Date:         ${doc.date}`,
    `Period:       ${doc.period}`,
    '',
    `Member:       ${member.firstName} ${member.lastName}`,
    `Member ID:    ${member.medicareId || '—'}`,
    `Plan:         C-SNP (Medicare Advantage Part C)`,
    '',
    'This is a simulated document generated by the CSNP member portal for',
    'demonstration purposes. It does not contain real claims or benefit data.',
    '',
    `Generated: ${new Date().toISOString()}`,
  ];
  return lines.join('\n');
}
