/**
 * Application-wide constants and enumerations for the CSNP Portal.
 * @module constants
 */

/**
 * CSNP Plan Types
 * @enum {string}
 */
export const PLAN_TYPES = Object.freeze({
  C_SNP: 'C-SNP',
  D_SNP: 'D-SNP',
  I_SNP: 'I-SNP',
});

/**
 * Labels for CSNP Plan Types
 * @enum {string}
 */
export const PLAN_TYPE_LABELS = Object.freeze({
  [PLAN_TYPES.C_SNP]: 'Chronic Condition Special Needs Plan',
  [PLAN_TYPES.D_SNP]: 'Dual Eligible Special Needs Plan',
  [PLAN_TYPES.I_SNP]: 'Institutional Special Needs Plan',
});

/**
 * Enrollment Channels
 * @enum {string}
 */
export const ENROLLMENT_CHANNELS = Object.freeze({
  ONLINE: 'online',
  PHONE: 'phone',
  MAIL: 'mail',
  IN_PERSON: 'in_person',
  BROKER: 'broker',
  TRANSFER: 'transfer',
});

/**
 * Labels for Enrollment Channels
 * @enum {string}
 */
export const ENROLLMENT_CHANNEL_LABELS = Object.freeze({
  [ENROLLMENT_CHANNELS.ONLINE]: 'Online',
  [ENROLLMENT_CHANNELS.PHONE]: 'Phone',
  [ENROLLMENT_CHANNELS.MAIL]: 'Mail',
  [ENROLLMENT_CHANNELS.IN_PERSON]: 'In Person',
  [ENROLLMENT_CHANNELS.BROKER]: 'Broker',
  [ENROLLMENT_CHANNELS.TRANSFER]: 'Transfer',
});

/**
 * Enrollment Statuses
 * @enum {string}
 */
export const ENROLLMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  ACTIVE: 'active',
  DISENROLLED: 'disenrolled',
});

/**
 * Claim Statuses
 * @enum {string}
 */
export const CLAIM_STATUSES = Object.freeze({
  SUBMITTED: 'submitted',
  PENDING: 'pending',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  DENIED: 'denied',
  PARTIALLY_APPROVED: 'partially_approved',
  APPEALED: 'appealed',
  PAID: 'paid',
  VOIDED: 'voided',
});

/**
 * Labels for Claim Statuses
 * @enum {string}
 */
export const CLAIM_STATUS_LABELS = Object.freeze({
  [CLAIM_STATUSES.SUBMITTED]: 'Submitted',
  [CLAIM_STATUSES.PENDING]: 'Pending',
  [CLAIM_STATUSES.IN_REVIEW]: 'In Review',
  [CLAIM_STATUSES.APPROVED]: 'Approved',
  [CLAIM_STATUSES.DENIED]: 'Denied',
  [CLAIM_STATUSES.PARTIALLY_APPROVED]: 'Partially Approved',
  [CLAIM_STATUSES.APPEALED]: 'Appealed',
  [CLAIM_STATUSES.PAID]: 'Paid',
  [CLAIM_STATUSES.VOIDED]: 'Voided',
});

/**
 * User Roles
 * @enum {string}
 */
export const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  CARE_MANAGER: 'care_manager',
  CLAIMS_PROCESSOR: 'claims_processor',
  ENROLLMENT_SPECIALIST: 'enrollment_specialist',
  PROVIDER: 'provider',
  MEMBER: 'member',
  AUDITOR: 'auditor',
  SUPERVISOR: 'supervisor',
});

/**
 * Labels for User Roles
 * @enum {string}
 */
export const USER_ROLE_LABELS = Object.freeze({
  [USER_ROLES.ADMIN]: 'Administrator',
  [USER_ROLES.CARE_MANAGER]: 'Care Manager',
  [USER_ROLES.CLAIMS_PROCESSOR]: 'Claims Processor',
  [USER_ROLES.ENROLLMENT_SPECIALIST]: 'Enrollment Specialist',
  [USER_ROLES.PROVIDER]: 'Provider',
  [USER_ROLES.MEMBER]: 'Member',
  [USER_ROLES.AUDITOR]: 'Auditor',
  [USER_ROLES.SUPERVISOR]: 'Supervisor',
});

/**
 * Medicare Parts
 * @enum {string}
 */
export const MEDICARE_PARTS = Object.freeze({
  PART_A: 'part_a',
  PART_B: 'part_b',
  PART_C: 'part_c',
  PART_D: 'part_d',
});

/**
 * Labels for Medicare Parts
 * @enum {string}
 */
export const MEDICARE_PART_LABELS = Object.freeze({
  [MEDICARE_PARTS.PART_A]: 'Part A - Hospital Insurance',
  [MEDICARE_PARTS.PART_B]: 'Part B - Medical Insurance',
  [MEDICARE_PARTS.PART_C]: 'Part C - Medicare Advantage',
  [MEDICARE_PARTS.PART_D]: 'Part D - Prescription Drug Coverage',
});

/**
 * localStorage Keys
 * @enum {string}
 */
export const STORAGE_KEYS = Object.freeze({
  AUTH_TOKEN: 'csnp_auth_token',
  REFRESH_TOKEN: 'csnp_refresh_token',
  USER: 'csnp_user',
  USER_ROLE: 'csnp_user_role',
  SESSION_EXPIRY: 'csnp_session_expiry',
  THEME: 'csnp_theme',
  SIDEBAR_COLLAPSED: 'csnp_sidebar_collapsed',
  LAST_ACTIVITY: 'csnp_last_activity',
  LANGUAGE: 'csnp_language',
});

/**
 * Audit Action Types
 * @enum {string}
 */
export const AUDIT_ACTIONS = Object.freeze({
  LOGIN: 'login',
  LOGOUT: 'logout',
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  DENY: 'deny',
  SUBMIT: 'submit',
  ENROLL: 'enroll',
  DISENROLL: 'disenroll',
  CLAIM_SUBMIT: 'claim_submit',
  CLAIM_APPROVE: 'claim_approve',
  CLAIM_DENY: 'claim_deny',
  CLAIM_APPEAL: 'claim_appeal',
  REFERRAL_CREATE: 'referral_create',
  REFERRAL_UPDATE: 'referral_update',
  CARE_PLAN_CREATE: 'care_plan_create',
  CARE_PLAN_UPDATE: 'care_plan_update',
  EXPORT: 'export',
  IMPORT: 'import',
  PASSWORD_CHANGE: 'password_change',
  ROLE_CHANGE: 'role_change',
});

/**
 * Referral Statuses
 * @enum {string}
 */
export const REFERRAL_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
});

/**
 * Labels for Referral Statuses
 * @enum {string}
 */
export const REFERRAL_STATUS_LABELS = Object.freeze({
  [REFERRAL_STATUSES.PENDING]: 'Pending',
  [REFERRAL_STATUSES.ACCEPTED]: 'Accepted',
  [REFERRAL_STATUSES.REJECTED]: 'Rejected',
  [REFERRAL_STATUSES.IN_PROGRESS]: 'In Progress',
  [REFERRAL_STATUSES.COMPLETED]: 'Completed',
  [REFERRAL_STATUSES.CANCELLED]: 'Cancelled',
  [REFERRAL_STATUSES.EXPIRED]: 'Expired',
});

/**
 * Care Management Event Types
 * @enum {string}
 */
export const CARE_MANAGEMENT_EVENTS = Object.freeze({
  ASSESSMENT: 'assessment',
  CARE_PLAN_CREATED: 'care_plan_created',
  CARE_PLAN_UPDATED: 'care_plan_updated',
  CARE_PLAN_REVIEWED: 'care_plan_reviewed',
  FOLLOW_UP: 'follow_up',
  PHONE_CALL: 'phone_call',
  HOME_VISIT: 'home_visit',
  OFFICE_VISIT: 'office_visit',
  HOSPITALIZATION: 'hospitalization',
  DISCHARGE: 'discharge',
  TRANSITION_OF_CARE: 'transition_of_care',
  MEDICATION_REVIEW: 'medication_review',
  REFERRAL_MADE: 'referral_made',
  GOAL_MET: 'goal_met',
  GOAL_UPDATED: 'goal_updated',
  BARRIER_IDENTIFIED: 'barrier_identified',
  INTERVENTION: 'intervention',
  ESCALATION: 'escalation',
  MEMBER_OUTREACH: 'member_outreach',
  PROVIDER_COORDINATION: 'provider_coordination',
});

/**
 * Labels for Care Management Event Types
 * @enum {string}
 */
export const CARE_MANAGEMENT_EVENT_LABELS = Object.freeze({
  [CARE_MANAGEMENT_EVENTS.ASSESSMENT]: 'Assessment',
  [CARE_MANAGEMENT_EVENTS.CARE_PLAN_CREATED]: 'Care Plan Created',
  [CARE_MANAGEMENT_EVENTS.CARE_PLAN_UPDATED]: 'Care Plan Updated',
  [CARE_MANAGEMENT_EVENTS.CARE_PLAN_REVIEWED]: 'Care Plan Reviewed',
  [CARE_MANAGEMENT_EVENTS.FOLLOW_UP]: 'Follow Up',
  [CARE_MANAGEMENT_EVENTS.PHONE_CALL]: 'Phone Call',
  [CARE_MANAGEMENT_EVENTS.HOME_VISIT]: 'Home Visit',
  [CARE_MANAGEMENT_EVENTS.OFFICE_VISIT]: 'Office Visit',
  [CARE_MANAGEMENT_EVENTS.HOSPITALIZATION]: 'Hospitalization',
  [CARE_MANAGEMENT_EVENTS.DISCHARGE]: 'Discharge',
  [CARE_MANAGEMENT_EVENTS.TRANSITION_OF_CARE]: 'Transition of Care',
  [CARE_MANAGEMENT_EVENTS.MEDICATION_REVIEW]: 'Medication Review',
  [CARE_MANAGEMENT_EVENTS.REFERRAL_MADE]: 'Referral Made',
  [CARE_MANAGEMENT_EVENTS.GOAL_MET]: 'Goal Met',
  [CARE_MANAGEMENT_EVENTS.GOAL_UPDATED]: 'Goal Updated',
  [CARE_MANAGEMENT_EVENTS.BARRIER_IDENTIFIED]: 'Barrier Identified',
  [CARE_MANAGEMENT_EVENTS.INTERVENTION]: 'Intervention',
  [CARE_MANAGEMENT_EVENTS.ESCALATION]: 'Escalation',
  [CARE_MANAGEMENT_EVENTS.MEMBER_OUTREACH]: 'Member Outreach',
  [CARE_MANAGEMENT_EVENTS.PROVIDER_COORDINATION]: 'Provider Coordination',
});

/**
 * Pagination defaults
 * @enum {number}
 */
export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
});

/**
 * Session timeout in seconds (from environment or default)
 * @type {number}
 */
export const SESSION_TIMEOUT = 3600;

/**
 * API Base URL
 * @type {string}
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Application title
 * @type {string}
 */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'CSNP Portal';