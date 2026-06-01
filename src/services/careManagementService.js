/**
 * Care management integration service for the CSNP Portal.
 * Provides event-driven care management triggers, auto-enrollment in care programs,
 * care manager assignment, care plan generation, HRA processing, alert/task creation,
 * and audit logging.
 * @module careManagementService
 */

import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem, appendToArray, findInArray, updateInArray } from '../utils/storage.js';
import { logAction } from './auditLogger.js';
import {
  AUDIT_ACTIONS,
  CARE_MANAGEMENT_EVENTS,
  CARE_MANAGEMENT_EVENT_LABELS,
} from '../utils/constants.js';
import { validateRequired } from '../utils/validators.js';
import {
  CONDITION_CATEGORIES,
  CONDITION_CATEGORY_LABELS,
  getCodeByICD10,
} from '../data/icd10Data.js';

/**
 * localStorage key for care events collection.
 * @type {string}
 */
const CARE_EVENTS_KEY = 'csnp_care_events';

/**
 * localStorage key for members collection.
 * @type {string}
 */
const MEMBERS_KEY = 'csnp_members';

/**
 * localStorage key for users collection.
 * @type {string}
 */
const USERS_KEY = 'csnp_users';

/**
 * localStorage key for care programs collection.
 * @type {string}
 */
const CARE_PROGRAMS_KEY = 'csnp_care_programs';

/**
 * localStorage key for care program enrollments collection.
 * @type {string}
 */
const CARE_PROGRAM_ENROLLMENTS_KEY = 'csnp_care_program_enrollments';

/**
 * localStorage key for care plans collection.
 * @type {string}
 */
const CARE_PLANS_KEY = 'csnp_care_plans';

/**
 * localStorage key for care alerts collection.
 * @type {string}
 */
const CARE_ALERTS_KEY = 'csnp_care_alerts';

/**
 * localStorage key for care tasks collection.
 * @type {string}
 */
const CARE_TASKS_KEY = 'csnp_care_tasks';

/**
 * localStorage key for HRA records collection.
 * @type {string}
 */
const HRA_RECORDS_KEY = 'csnp_hra_records';

/**
 * localStorage key for care manager assignments collection.
 * @type {string}
 */
const CARE_MANAGER_ASSIGNMENTS_KEY = 'csnp_care_manager_assignments';

/**
 * @typedef {Object} CareManagementTriggerResult
 * @property {boolean} success - Whether the trigger succeeded
 * @property {string|null} eventId - The created care event ID
 * @property {string|null} careEnrollmentStatus - Care enrollment status
 * @property {string|null} careManagerId - Assigned care manager ID
 * @property {string|null} carePlanId - Generated care plan ID
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if trigger failed
 */

/**
 * @typedef {Object} CareProgramEnrollmentResult
 * @property {boolean} success - Whether the enrollment succeeded
 * @property {string|null} enrollmentId - The care program enrollment ID
 * @property {string|null} programId - The care program ID
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if enrollment failed
 */

/**
 * @typedef {Object} CareManagerAssignmentResult
 * @property {boolean} success - Whether the assignment succeeded
 * @property {string|null} assignmentId - The care manager assignment ID
 * @property {string|null} memberId - The member ID
 * @property {string|null} managerId - The care manager ID
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if assignment failed
 */

/**
 * @typedef {Object} CarePlanResult
 * @property {boolean} success - Whether the care plan generation succeeded
 * @property {string|null} carePlanId - The generated care plan ID
 * @property {string|null} memberId - The member ID
 * @property {Object|null} carePlan - The generated care plan object
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if generation failed
 */

/**
 * @typedef {Object} AlertResult
 * @property {boolean} success - Whether the alert creation succeeded
 * @property {string|null} alertId - The created alert ID
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if creation failed
 */

/**
 * @typedef {Object} TaskResult
 * @property {boolean} success - Whether the task creation succeeded
 * @property {string|null} taskId - The created task ID
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if creation failed
 */

/**
 * @typedef {Object} HRAResult
 * @property {boolean} success - Whether the HRA processing succeeded
 * @property {string|null} hraId - The HRA record ID
 * @property {number|null} riskScore - Calculated risk score
 * @property {string|null} riskLevel - Risk level (low, moderate, high, critical)
 * @property {Object|null} recommendations - HRA recommendations
 * @property {string|null} auditId - Audit log entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} [error] - Error message if processing failed
 */

// ─── Valid Event Types ──────────────────────────────────────────────────────

/**
 * Valid care management event types for triggering.
 * @type {string[]}
 */
const VALID_TRIGGER_EVENT_TYPES = Object.freeze([
  CARE_MANAGEMENT_EVENTS.ASSESSMENT,
  CARE_MANAGEMENT_EVENTS.CARE_PLAN_CREATED,
  CARE_MANAGEMENT_EVENTS.CARE_PLAN_UPDATED,
  CARE_MANAGEMENT_EVENTS.CARE_PLAN_REVIEWED,
  CARE_MANAGEMENT_EVENTS.FOLLOW_UP,
  CARE_MANAGEMENT_EVENTS.PHONE_CALL,
  CARE_MANAGEMENT_EVENTS.HOME_VISIT,
  CARE_MANAGEMENT_EVENTS.OFFICE_VISIT,
  CARE_MANAGEMENT_EVENTS.HOSPITALIZATION,
  CARE_MANAGEMENT_EVENTS.DISCHARGE,
  CARE_MANAGEMENT_EVENTS.TRANSITION_OF_CARE,
  CARE_MANAGEMENT_EVENTS.MEDICATION_REVIEW,
  CARE_MANAGEMENT_EVENTS.REFERRAL_MADE,
  CARE_MANAGEMENT_EVENTS.GOAL_MET,
  CARE_MANAGEMENT_EVENTS.GOAL_UPDATED,
  CARE_MANAGEMENT_EVENTS.BARRIER_IDENTIFIED,
  CARE_MANAGEMENT_EVENTS.INTERVENTION,
  CARE_MANAGEMENT_EVENTS.ESCALATION,
  CARE_MANAGEMENT_EVENTS.MEMBER_OUTREACH,
  CARE_MANAGEMENT_EVENTS.PROVIDER_COORDINATION,
]);

/**
 * Alert severity levels.
 * @enum {string}
 */
const ALERT_SEVERITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

/**
 * Task priority levels.
 * @enum {string}
 */
const TASK_PRIORITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
});

/**
 * Task statuses.
 * @enum {string}
 */
const TASK_STATUSES = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
});

/**
 * Risk levels for HRA scoring.
 * @enum {string}
 */
const RISK_LEVELS = Object.freeze({
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  CRITICAL: 'critical',
});

// ─── Care Plan Templates by Condition Category ─────────────────────────────

/**
 * Care plan goal templates by condition category.
 * @type {Object.<string, Object[]>}
 */
const CARE_PLAN_TEMPLATES = Object.freeze({
  [CONDITION_CATEGORIES.DIABETES]: [
    { goal: 'Reduce A1C to below 7.0% within 6 months', category: 'clinical', priority: 'high' },
    { goal: 'Complete annual diabetic eye exam', category: 'preventive', priority: 'medium' },
    { goal: 'Monthly blood glucose monitoring', category: 'monitoring', priority: 'high' },
    { goal: 'Nutrition counseling for diabetes management', category: 'education', priority: 'medium' },
    { goal: 'Medication adherence above 80%', category: 'medication', priority: 'high' },
    { goal: 'Annual foot exam completion', category: 'preventive', priority: 'medium' },
  ],
  [CONDITION_CATEGORIES.HEART_FAILURE]: [
    { goal: 'Daily weight monitoring within 2 lbs of baseline', category: 'monitoring', priority: 'high' },
    { goal: 'Reduce hospital readmissions to zero within 12 months', category: 'clinical', priority: 'high' },
    { goal: 'Complete cardiac rehabilitation program', category: 'rehabilitation', priority: 'medium' },
    { goal: 'Medication adherence above 90%', category: 'medication', priority: 'high' },
    { goal: 'Low-sodium diet compliance', category: 'education', priority: 'medium' },
    { goal: 'Quarterly cardiology follow-up visits', category: 'clinical', priority: 'high' },
  ],
  [CONDITION_CATEGORIES.COPD]: [
    { goal: 'Reduce COPD exacerbations to fewer than 2 per year', category: 'clinical', priority: 'high' },
    { goal: 'Complete pulmonary rehabilitation program', category: 'rehabilitation', priority: 'medium' },
    { goal: 'Smoking cessation if applicable', category: 'lifestyle', priority: 'high' },
    { goal: 'Annual flu and pneumonia vaccinations', category: 'preventive', priority: 'medium' },
    { goal: 'Proper inhaler technique education', category: 'education', priority: 'medium' },
    { goal: 'Oxygen saturation monitoring', category: 'monitoring', priority: 'high' },
  ],
  [CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE]: [
    { goal: 'Monitor GFR quarterly', category: 'monitoring', priority: 'high' },
    { goal: 'Renal diet education and compliance', category: 'education', priority: 'medium' },
    { goal: 'Blood pressure control below 130/80', category: 'clinical', priority: 'high' },
    { goal: 'Medication review for nephrotoxic agents', category: 'medication', priority: 'high' },
    { goal: 'Dialysis preparation if GFR below 20', category: 'clinical', priority: 'high' },
  ],
  [CONDITION_CATEGORIES.ESRD]: [
    { goal: 'Dialysis adherence above 95%', category: 'clinical', priority: 'high' },
    { goal: 'Vascular access maintenance', category: 'clinical', priority: 'high' },
    { goal: 'Renal diet compliance', category: 'education', priority: 'medium' },
    { goal: 'Monthly lab monitoring', category: 'monitoring', priority: 'high' },
    { goal: 'Transplant evaluation if eligible', category: 'clinical', priority: 'medium' },
  ],
  [CONDITION_CATEGORIES.DEMENTIA]: [
    { goal: 'Cognitive assessment every 6 months', category: 'monitoring', priority: 'high' },
    { goal: 'Home safety evaluation and modifications', category: 'safety', priority: 'high' },
    { goal: 'Caregiver support and education', category: 'education', priority: 'medium' },
    { goal: 'Medication management and review', category: 'medication', priority: 'high' },
    { goal: 'Adult day care enrollment if appropriate', category: 'social', priority: 'medium' },
    { goal: 'Fall prevention program', category: 'safety', priority: 'high' },
  ],
  [CONDITION_CATEGORIES.MENTAL_HEALTH]: [
    { goal: 'Regular mental health therapy sessions', category: 'clinical', priority: 'high' },
    { goal: 'Medication adherence and monitoring', category: 'medication', priority: 'high' },
    { goal: 'Crisis intervention plan in place', category: 'safety', priority: 'high' },
    { goal: 'Social support network engagement', category: 'social', priority: 'medium' },
    { goal: 'Substance abuse screening if applicable', category: 'preventive', priority: 'medium' },
  ],
  [CONDITION_CATEGORIES.CARDIOVASCULAR]: [
    { goal: 'Blood pressure control below 130/80', category: 'clinical', priority: 'high' },
    { goal: 'Cholesterol management within target range', category: 'clinical', priority: 'high' },
    { goal: 'Cardiac rehabilitation completion', category: 'rehabilitation', priority: 'medium' },
    { goal: 'Heart-healthy diet compliance', category: 'education', priority: 'medium' },
    { goal: 'Regular exercise program', category: 'lifestyle', priority: 'medium' },
  ],
  [CONDITION_CATEGORIES.STROKE]: [
    { goal: 'Physical therapy completion', category: 'rehabilitation', priority: 'high' },
    { goal: 'Occupational therapy for ADL independence', category: 'rehabilitation', priority: 'high' },
    { goal: 'Speech therapy if indicated', category: 'rehabilitation', priority: 'medium' },
    { goal: 'Stroke prevention medication adherence', category: 'medication', priority: 'high' },
    { goal: 'Fall prevention program', category: 'safety', priority: 'high' },
  ],
  [CONDITION_CATEGORIES.AUTOIMMUNE]: [
    { goal: 'Disease activity monitoring', category: 'monitoring', priority: 'high' },
    { goal: 'Specialty medication management', category: 'medication', priority: 'high' },
    { goal: 'Flare prevention education', category: 'education', priority: 'medium' },
    { goal: 'Regular rheumatology follow-up', category: 'clinical', priority: 'high' },
    { goal: 'Joint protection and exercise program', category: 'rehabilitation', priority: 'medium' },
  ],
  [CONDITION_CATEGORIES.HIV_AIDS]: [
    { goal: 'Antiretroviral therapy adherence above 95%', category: 'medication', priority: 'high' },
    { goal: 'Viral load monitoring quarterly', category: 'monitoring', priority: 'high' },
    { goal: 'CD4 count monitoring', category: 'monitoring', priority: 'high' },
    { goal: 'Preventive care screenings', category: 'preventive', priority: 'medium' },
    { goal: 'Mental health support', category: 'social', priority: 'medium' },
  ],
  [CONDITION_CATEGORIES.CANCER]: [
    { goal: 'Treatment plan adherence', category: 'clinical', priority: 'high' },
    { goal: 'Pain management optimization', category: 'clinical', priority: 'high' },
    { goal: 'Nutritional support during treatment', category: 'education', priority: 'medium' },
    { goal: 'Palliative care consultation if appropriate', category: 'clinical', priority: 'medium' },
    { goal: 'Psychosocial support', category: 'social', priority: 'medium' },
  ],
  [CONDITION_CATEGORIES.LIVER_DISEASE]: [
    { goal: 'Liver function monitoring', category: 'monitoring', priority: 'high' },
    { goal: 'Hepatic diet compliance', category: 'education', priority: 'medium' },
    { goal: 'Substance abuse treatment if applicable', category: 'clinical', priority: 'high' },
    { goal: 'Medication review for hepatotoxic agents', category: 'medication', priority: 'high' },
    { goal: 'Transplant evaluation if indicated', category: 'clinical', priority: 'medium' },
  ],
  [CONDITION_CATEGORIES.RESPIRATORY]: [
    { goal: 'Pulmonary function monitoring', category: 'monitoring', priority: 'high' },
    { goal: 'Pulmonary rehabilitation completion', category: 'rehabilitation', priority: 'medium' },
    { goal: 'Oxygen therapy compliance', category: 'clinical', priority: 'high' },
    { goal: 'Respiratory infection prevention', category: 'preventive', priority: 'medium' },
    { goal: 'Breathing technique education', category: 'education', priority: 'medium' },
  ],
  [CONDITION_CATEGORIES.NEUROLOGICAL]: [
    { goal: 'Neurological assessment every 6 months', category: 'monitoring', priority: 'high' },
    { goal: 'Physical therapy for mobility', category: 'rehabilitation', priority: 'high' },
    { goal: 'Occupational therapy for ADL support', category: 'rehabilitation', priority: 'high' },
    { goal: 'Medication management and seizure control', category: 'medication', priority: 'high' },
    { goal: 'Home safety modifications', category: 'safety', priority: 'medium' },
    { goal: 'Durable medical equipment assessment', category: 'clinical', priority: 'medium' },
  ],
});

// ─── Helper Functions ───────────────────────────────────────────────────────

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
 * Retrieves a user by ID from localStorage.
 * @param {string} userId - The user ID
 * @returns {Object|null} The user object or null
 */
function getUserById(userId) {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return null;
  }
  return findInArray(USERS_KEY, (u) => u.id === userId.trim());
}

/**
 * Retrieves all care events from localStorage.
 * @returns {Object[]} Array of care event objects
 */
function getAllCareEvents() {
  const events = getItem(CARE_EVENTS_KEY, []);
  if (!Array.isArray(events)) {
    return [];
  }
  return events;
}

/**
 * Retrieves all care manager assignments from localStorage.
 * @returns {Object[]} Array of care manager assignment objects
 */
function getAllCareManagerAssignments() {
  const assignments = getItem(CARE_MANAGER_ASSIGNMENTS_KEY, []);
  if (!Array.isArray(assignments)) {
    return [];
  }
  return assignments;
}

/**
 * Retrieves all care plans from localStorage.
 * @returns {Object[]} Array of care plan objects
 */
function getAllCarePlans() {
  const plans = getItem(CARE_PLANS_KEY, []);
  if (!Array.isArray(plans)) {
    return [];
  }
  return plans;
}

/**
 * Retrieves all care program enrollments from localStorage.
 * @returns {Object[]} Array of care program enrollment objects
 */
function getAllCareProgramEnrollments() {
  const enrollments = getItem(CARE_PROGRAM_ENROLLMENTS_KEY, []);
  if (!Array.isArray(enrollments)) {
    return [];
  }
  return enrollments;
}

/**
 * Retrieves all care alerts from localStorage.
 * @returns {Object[]} Array of care alert objects
 */
function getAllCareAlerts() {
  const alerts = getItem(CARE_ALERTS_KEY, []);
  if (!Array.isArray(alerts)) {
    return [];
  }
  return alerts;
}

/**
 * Retrieves all care tasks from localStorage.
 * @returns {Object[]} Array of care task objects
 */
function getAllCareTasks() {
  const tasks = getItem(CARE_TASKS_KEY, []);
  if (!Array.isArray(tasks)) {
    return [];
  }
  return tasks;
}

/**
 * Retrieves all HRA records from localStorage.
 * @returns {Object[]} Array of HRA record objects
 */
function getAllHRARecords() {
  const records = getItem(HRA_RECORDS_KEY, []);
  if (!Array.isArray(records)) {
    return [];
  }
  return records;
}

/**
 * Determines the primary condition category from a member's diagnosis codes.
 * @param {Object} member - The member object
 * @returns {{ category: string, categoryLabel: string } | null}
 */
function getMemberPrimaryCondition(member) {
  if (!member || typeof member !== 'object') {
    return null;
  }

  if (member.conditionCategory) {
    return {
      category: member.conditionCategory,
      categoryLabel: CONDITION_CATEGORY_LABELS[member.conditionCategory] || member.conditionCategory,
    };
  }

  const diagnosisCodes = member.diagnosisCodes || [];
  if (diagnosisCodes.length === 0) {
    return null;
  }

  let bestCategory = null;
  let bestPriority = Infinity;

  for (const code of diagnosisCodes) {
    if (typeof code !== 'string' || code.trim().length === 0) {
      continue;
    }
    const entry = getCodeByICD10(code.trim().toUpperCase());
    if (!entry || !entry.csnpEligible) {
      continue;
    }
    if (entry.priority < bestPriority) {
      bestPriority = entry.priority;
      bestCategory = entry.category;
    }
  }

  if (!bestCategory) {
    return null;
  }

  return {
    category: bestCategory,
    categoryLabel: CONDITION_CATEGORY_LABELS[bestCategory] || bestCategory,
  };
}

/**
 * Calculates a risk score from HRA data.
 * @param {Object} hraData - The HRA data
 * @param {Object} member - The member object
 * @returns {{ score: number, level: string }}
 */
function calculateRiskScore(hraData, member) {
  let score = 0;

  // Base score from number of chronic conditions
  const diagnosisCodes = member.diagnosisCodes || [];
  score += Math.min(diagnosisCodes.length * 10, 40);

  // Age factor
  if (member.dateOfBirth) {
    try {
      const dob = new Date(member.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age >= 80) {
        score += 20;
      } else if (age >= 70) {
        score += 15;
      } else if (age >= 65) {
        score += 10;
      } else {
        score += 5;
      }
    } catch {
      score += 5;
    }
  }

  // HRA-specific factors
  if (hraData && typeof hraData === 'object') {
    if (hraData.recentHospitalization === true) {
      score += 15;
    }
    if (hraData.recentERVisit === true) {
      score += 10;
    }
    if (hraData.fallRisk === true) {
      score += 10;
    }
    if (hraData.medicationNonAdherence === true) {
      score += 10;
    }
    if (hraData.socialIsolation === true) {
      score += 5;
    }
    if (hraData.cognitiveImpairment === true) {
      score += 10;
    }
    if (hraData.functionalLimitations === true) {
      score += 10;
    }
    if (hraData.painLevel !== undefined && typeof hraData.painLevel === 'number') {
      if (hraData.painLevel >= 7) {
        score += 10;
      } else if (hraData.painLevel >= 4) {
        score += 5;
      }
    }
    if (hraData.depressionScreenPositive === true) {
      score += 10;
    }
    if (hraData.tobaccoUse === true) {
      score += 5;
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine risk level
  let level;
  if (score >= 75) {
    level = RISK_LEVELS.CRITICAL;
  } else if (score >= 50) {
    level = RISK_LEVELS.HIGH;
  } else if (score >= 25) {
    level = RISK_LEVELS.MODERATE;
  } else {
    level = RISK_LEVELS.LOW;
  }

  return { score, level };
}

/**
 * Generates HRA recommendations based on risk factors.
 * @param {Object} hraData - The HRA data
 * @param {Object} member - The member object
 * @param {string} riskLevel - The calculated risk level
 * @returns {Object} Recommendations object
 */
function generateHRARecommendations(hraData, member, riskLevel) {
  const recommendations = {
    immediateActions: [],
    followUpActions: [],
    referrals: [],
    educationTopics: [],
    monitoringFrequency: 'quarterly',
  };

  if (riskLevel === RISK_LEVELS.CRITICAL) {
    recommendations.monitoringFrequency = 'weekly';
    recommendations.immediateActions.push('Urgent care manager outreach within 24 hours');
    recommendations.immediateActions.push('Comprehensive medication reconciliation');
  } else if (riskLevel === RISK_LEVELS.HIGH) {
    recommendations.monitoringFrequency = 'biweekly';
    recommendations.immediateActions.push('Care manager outreach within 48 hours');
  } else if (riskLevel === RISK_LEVELS.MODERATE) {
    recommendations.monitoringFrequency = 'monthly';
    recommendations.followUpActions.push('Care manager outreach within 1 week');
  }

  if (hraData && typeof hraData === 'object') {
    if (hraData.recentHospitalization === true) {
      recommendations.immediateActions.push('Post-discharge follow-up within 48 hours');
      recommendations.referrals.push('Transition of care coordination');
    }
    if (hraData.recentERVisit === true) {
      recommendations.followUpActions.push('ER visit follow-up and root cause analysis');
    }
    if (hraData.fallRisk === true) {
      recommendations.referrals.push('Physical therapy for fall prevention');
      recommendations.referrals.push('Home safety evaluation');
      recommendations.educationTopics.push('Fall prevention strategies');
    }
    if (hraData.medicationNonAdherence === true) {
      recommendations.immediateActions.push('Medication therapy management consultation');
      recommendations.educationTopics.push('Medication adherence importance');
    }
    if (hraData.socialIsolation === true) {
      recommendations.referrals.push('Social work consultation');
      recommendations.followUpActions.push('Community resource connection');
    }
    if (hraData.cognitiveImpairment === true) {
      recommendations.referrals.push('Neurology evaluation');
      recommendations.referrals.push('Cognitive assessment');
      recommendations.followUpActions.push('Caregiver support assessment');
    }
    if (hraData.functionalLimitations === true) {
      recommendations.referrals.push('Occupational therapy evaluation');
      recommendations.referrals.push('Durable medical equipment assessment');
    }
    if (hraData.depressionScreenPositive === true) {
      recommendations.referrals.push('Behavioral health consultation');
      recommendations.educationTopics.push('Mental health resources');
    }
    if (hraData.tobaccoUse === true) {
      recommendations.referrals.push('Smoking cessation program');
      recommendations.educationTopics.push('Tobacco cessation resources');
    }
  }

  // Add condition-specific education
  const primaryCondition = getMemberPrimaryCondition(member);
  if (primaryCondition) {
    const conditionLabel = primaryCondition.categoryLabel;
    recommendations.educationTopics.push(`${conditionLabel} self-management`);
    recommendations.educationTopics.push(`${conditionLabel} warning signs and when to seek care`);
  }

  return recommendations;
}

/**
 * Finds an available care manager for a member based on condition category.
 * @param {Object} member - The member object
 * @returns {Object|null} The care manager user object or null
 */
function findAvailableCareManager(member) {
  const users = getItem(USERS_KEY, []);
  if (!Array.isArray(users)) {
    return null;
  }

  const careManagers = users.filter(
    (u) => u.role === 'care_manager' && u.active === true
  );

  if (careManagers.length === 0) {
    return null;
  }

  // Get current assignment counts
  const assignments = getAllCareManagerAssignments();
  const activeAssignments = assignments.filter((a) => a.status === 'active');

  const assignmentCounts = {};
  for (const assignment of activeAssignments) {
    const managerId = assignment.managerId;
    if (!assignmentCounts[managerId]) {
      assignmentCounts[managerId] = 0;
    }
    assignmentCounts[managerId]++;
  }

  // Sort care managers by fewest active assignments (load balancing)
  const sorted = [...careManagers].sort((a, b) => {
    const countA = assignmentCounts[a.id] || 0;
    const countB = assignmentCounts[b.id] || 0;
    return countA - countB;
  });

  return sorted[0];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Triggers a care management event for a member.
 * Creates a care event record, optionally auto-enrolls in care programs,
 * assigns a care manager, and generates a care plan based on the event type.
 *
 * @param {string} memberId - The member ID
 * @param {string} eventType - The care management event type from CARE_MANAGEMENT_EVENTS
 * @param {Object} [options={}] - Trigger options
 * @param {string} [options.performedBy] - User ID performing the trigger
 * @param {string} [options.providerId] - Associated provider ID
 * @param {string} [options.summary] - Event summary
 * @param {string} [options.details] - Event details
 * @param {string} [options.followUpDate] - Follow-up date (YYYY-MM-DD)
 * @param {boolean} [options.autoEnroll=true] - Whether to auto-enroll in care program
 * @param {boolean} [options.autoAssignManager=true] - Whether to auto-assign a care manager
 * @param {boolean} [options.autoGenerateCarePlan=false] - Whether to auto-generate a care plan
 * @returns {CareManagementTriggerResult} The care management trigger result
 */
export function triggerCareManagement(memberId, eventType, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const autoEnroll = options && options.autoEnroll === false ? false : true;
  const autoAssignManager = options && options.autoAssignManager === false ? false : true;
  const autoGenerateCarePlan = options && options.autoGenerateCarePlan === true;

  const defaultResult = {
    success: false,
    eventId: null,
    careEnrollmentStatus: null,
    careManagerId: null,
    carePlanId: null,
    auditId: null,
    timestamp,
  };

  // Validate inputs
  const memberIdResult = validateRequired(memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  const eventTypeResult = validateRequired(eventType, 'Event type');
  if (!eventTypeResult.valid) {
    return { ...defaultResult, error: eventTypeResult.error };
  }

  const trimmedMemberId = memberId.trim();
  const trimmedEventType = eventType.trim();

  // Validate event type
  if (!VALID_TRIGGER_EVENT_TYPES.includes(trimmedEventType)) {
    return {
      ...defaultResult,
      error: `Invalid event type: "${trimmedEventType}". Must be one of: ${VALID_TRIGGER_EVENT_TYPES.join(', ')}`,
    };
  }

  try {
    // Verify member exists
    const member = getMemberById(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Create care event record
    const eventId = uuidv4();
    const eventDate = new Date().toISOString().split('T')[0];
    const eventLabel = CARE_MANAGEMENT_EVENT_LABELS[trimmedEventType] || trimmedEventType;

    const careEvent = {
      id: eventId,
      memberId: trimmedMemberId,
      eventType: trimmedEventType,
      eventDate,
      performedBy,
      providerId: (options && typeof options.providerId === 'string') ? options.providerId.trim() : null,
      summary: (options && typeof options.summary === 'string') ? options.summary.trim() : `${eventLabel} triggered for member ${member.firstName} ${member.lastName}`,
      details: (options && typeof options.details === 'string') ? options.details.trim() : '',
      followUpDate: (options && typeof options.followUpDate === 'string') ? options.followUpDate.trim() : null,
      status: 'completed',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Persist care event
    const eventSaved = appendToArray(CARE_EVENTS_KEY, careEvent);
    if (!eventSaved) {
      return { ...defaultResult, error: 'Failed to persist care event record' };
    }

    defaultResult.eventId = eventId;

    // Auto-enroll in care program if applicable
    let careEnrollmentStatus = null;
    if (autoEnroll) {
      const primaryCondition = getMemberPrimaryCondition(member);
      if (primaryCondition) {
        const programId = `program_${primaryCondition.category}`;
        const enrollResult = autoEnrollCareProgram(trimmedMemberId, programId, { performedBy });
        if (enrollResult.success) {
          careEnrollmentStatus = 'enrolled';
        } else {
          // Non-blocking: enrollment may already exist
          careEnrollmentStatus = enrollResult.error && enrollResult.error.includes('already enrolled')
            ? 'already_enrolled'
            : 'enrollment_failed';
        }
      }
    }
    defaultResult.careEnrollmentStatus = careEnrollmentStatus;

    // Auto-assign care manager if applicable
    let assignedManagerId = null;
    if (autoAssignManager) {
      // Check if member already has an active care manager
      const existingAssignments = getAllCareManagerAssignments();
      const activeAssignment = existingAssignments.find(
        (a) => a.memberId === trimmedMemberId && a.status === 'active'
      );

      if (activeAssignment) {
        assignedManagerId = activeAssignment.managerId;
      } else {
        const availableManager = findAvailableCareManager(member);
        if (availableManager) {
          const assignResult = assignCareManager(trimmedMemberId, availableManager.id, { performedBy });
          if (assignResult.success) {
            assignedManagerId = availableManager.id;
          }
        }
      }
    }
    defaultResult.careManagerId = assignedManagerId;

    // Auto-generate care plan if applicable
    let carePlanId = null;
    if (autoGenerateCarePlan) {
      const planResult = generateCarePlan(trimmedMemberId, { performedBy });
      if (planResult.success) {
        carePlanId = planResult.carePlanId;
      }
    }
    defaultResult.carePlanId = carePlanId;

    // Create alert for high-priority events
    const highPriorityEvents = [
      CARE_MANAGEMENT_EVENTS.HOSPITALIZATION,
      CARE_MANAGEMENT_EVENTS.DISCHARGE,
      CARE_MANAGEMENT_EVENTS.ESCALATION,
      CARE_MANAGEMENT_EVENTS.TRANSITION_OF_CARE,
    ];

    if (highPriorityEvents.includes(trimmedEventType)) {
      createAlert({
        memberId: trimmedMemberId,
        severity: ALERT_SEVERITIES.HIGH,
        title: `${eventLabel} - ${member.firstName} ${member.lastName}`,
        description: `A ${eventLabel.toLowerCase()} event has been triggered for member ${member.firstName} ${member.lastName}. Immediate attention may be required.`,
        assignedTo: assignedManagerId,
        performedBy,
      });
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CARE_PLAN_CREATE,
      performedBy,
      {
        targetType: 'care_management_event',
        targetId: eventId,
        description: `Care management event "${eventLabel}" triggered for member ${member.firstName} ${member.lastName} (${trimmedMemberId}). Enrollment: ${careEnrollmentStatus || 'N/A'}. Manager: ${assignedManagerId || 'N/A'}. Care Plan: ${carePlanId || 'N/A'}`,
        metadata: {
          eventId,
          memberId: trimmedMemberId,
          eventType: trimmedEventType,
          careEnrollmentStatus,
          careManagerId: assignedManagerId,
          carePlanId,
        },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return {
      success: true,
      eventId,
      careEnrollmentStatus,
      careManagerId: assignedManagerId,
      carePlanId,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('careManagementService.triggerCareManagement: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during care management trigger' };
  }
}

/**
 * Auto-enrolls a member in a care program.
 *
 * @param {string} memberId - The member ID
 * @param {string} programId - The care program ID
 * @param {Object} [options={}] - Enrollment options
 * @param {string} [options.performedBy] - User ID performing the enrollment
 * @returns {CareProgramEnrollmentResult} The care program enrollment result
 */
export function autoEnrollCareProgram(memberId, programId, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    enrollmentId: null,
    programId: null,
    auditId: null,
    timestamp,
  };

  // Validate inputs
  const memberIdResult = validateRequired(memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  const programIdResult = validateRequired(programId, 'Program ID');
  if (!programIdResult.valid) {
    return { ...defaultResult, error: programIdResult.error };
  }

  const trimmedMemberId = memberId.trim();
  const trimmedProgramId = programId.trim();

  try {
    // Verify member exists
    const member = getMemberById(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Check for existing active enrollment in this program
    const existingEnrollments = getAllCareProgramEnrollments();
    const duplicateEnrollment = existingEnrollments.find(
      (e) => e.memberId === trimmedMemberId && e.programId === trimmedProgramId && e.status === 'active'
    );

    if (duplicateEnrollment) {
      return {
        ...defaultResult,
        enrollmentId: duplicateEnrollment.id,
        programId: trimmedProgramId,
        error: `Member is already enrolled in care program "${trimmedProgramId}" (${duplicateEnrollment.id})`,
      };
    }

    // Create care program enrollment
    const enrollmentId = uuidv4();
    const enrollment = {
      id: enrollmentId,
      memberId: trimmedMemberId,
      programId: trimmedProgramId,
      status: 'active',
      enrollmentDate: new Date().toISOString().split('T')[0],
      enrolledBy: performedBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = appendToArray(CARE_PROGRAM_ENROLLMENTS_KEY, enrollment);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist care program enrollment' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CARE_PLAN_CREATE,
      performedBy,
      {
        targetType: 'care_program_enrollment',
        targetId: enrollmentId,
        description: `Member ${member.firstName} ${member.lastName} (${trimmedMemberId}) auto-enrolled in care program "${trimmedProgramId}"`,
        metadata: {
          enrollmentId,
          memberId: trimmedMemberId,
          programId: trimmedProgramId,
        },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return {
      success: true,
      enrollmentId,
      programId: trimmedProgramId,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('careManagementService.autoEnrollCareProgram: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during care program enrollment' };
  }
}

/**
 * Assigns a care manager to a member.
 *
 * @param {string} memberId - The member ID
 * @param {string} managerId - The care manager user ID
 * @param {Object} [options={}] - Assignment options
 * @param {string} [options.performedBy] - User ID performing the assignment
 * @returns {CareManagerAssignmentResult} The care manager assignment result
 */
export function assignCareManager(memberId, managerId, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    assignmentId: null,
    memberId: null,
    managerId: null,
    auditId: null,
    timestamp,
  };

  // Validate inputs
  const memberIdResult = validateRequired(memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  const managerIdResult = validateRequired(managerId, 'Care manager ID');
  if (!managerIdResult.valid) {
    return { ...defaultResult, error: managerIdResult.error };
  }

  const trimmedMemberId = memberId.trim();
  const trimmedManagerId = managerId.trim();

  try {
    // Verify member exists
    const member = getMemberById(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Verify care manager exists and has the correct role
    const manager = getUserById(trimmedManagerId);
    if (!manager) {
      return { ...defaultResult, error: `Care manager not found: ${trimmedManagerId}` };
    }

    if (manager.role !== 'care_manager') {
      return { ...defaultResult, error: `User ${trimmedManagerId} is not a care manager. Role: "${manager.role}"` };
    }

    if (!manager.active) {
      return { ...defaultResult, error: `Care manager ${manager.firstName} ${manager.lastName} is not active` };
    }

    // Check for existing active assignment with same manager
    const existingAssignments = getAllCareManagerAssignments();
    const duplicateAssignment = existingAssignments.find(
      (a) => a.memberId === trimmedMemberId && a.managerId === trimmedManagerId && a.status === 'active'
    );

    if (duplicateAssignment) {
      return {
        ...defaultResult,
        assignmentId: duplicateAssignment.id,
        memberId: trimmedMemberId,
        managerId: trimmedManagerId,
        error: `Member already has an active assignment with care manager ${manager.firstName} ${manager.lastName} (${duplicateAssignment.id})`,
      };
    }

    // Deactivate any existing active care manager assignment for this member
    const currentActive = existingAssignments.find(
      (a) => a.memberId === trimmedMemberId && a.status === 'active'
    );

    if (currentActive) {
      updateInArray(
        CARE_MANAGER_ASSIGNMENTS_KEY,
        (a) => a.id === currentActive.id,
        (a) => ({
          ...a,
          status: 'inactive',
          deactivatedAt: timestamp,
          deactivationReason: 'Replaced by new care manager assignment',
          updatedAt: timestamp,
        })
      );
    }

    // Create care manager assignment
    const assignmentId = uuidv4();
    const assignment = {
      id: assignmentId,
      memberId: trimmedMemberId,
      managerId: trimmedManagerId,
      status: 'active',
      assignedBy: performedBy,
      assignedDate: new Date().toISOString().split('T')[0],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = appendToArray(CARE_MANAGER_ASSIGNMENTS_KEY, assignment);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist care manager assignment' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CARE_PLAN_CREATE,
      performedBy,
      {
        targetType: 'care_manager_assignment',
        targetId: assignmentId,
        description: `Care manager ${manager.firstName} ${manager.lastName} assigned to member ${member.firstName} ${member.lastName} (${trimmedMemberId})${currentActive ? '. Previous manager replaced.' : ''}`,
        metadata: {
          assignmentId,
          memberId: trimmedMemberId,
          managerId: trimmedManagerId,
          managerName: `${manager.firstName} ${manager.lastName}`,
          previousManagerId: currentActive ? currentActive.managerId : null,
        },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return {
      success: true,
      assignmentId,
      memberId: trimmedMemberId,
      managerId: trimmedManagerId,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('careManagementService.assignCareManager: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during care manager assignment' };
  }
}

/**
 * Generates a care plan for a member based on their condition category.
 *
 * @param {string} memberId - The member ID
 * @param {Object} [options={}] - Generation options
 * @param {string} [options.performedBy] - User ID performing the generation
 * @param {string} [options.conditionCategory] - Override condition category
 * @param {Object[]} [options.additionalGoals] - Additional goals to include
 * @returns {CarePlanResult} The care plan generation result
 */
export function generateCarePlan(memberId, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';

  const defaultResult = {
    success: false,
    carePlanId: null,
    memberId: null,
    carePlan: null,
    auditId: null,
    timestamp,
  };

  // Validate inputs
  const memberIdResult = validateRequired(memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  const trimmedMemberId = memberId.trim();

  try {
    // Verify member exists
    const member = getMemberById(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Determine condition category
    let conditionCategory = null;
    let conditionCategoryLabel = null;

    if (options && typeof options.conditionCategory === 'string' && options.conditionCategory.trim().length > 0) {
      conditionCategory = options.conditionCategory.trim();
      conditionCategoryLabel = CONDITION_CATEGORY_LABELS[conditionCategory] || conditionCategory;
    } else {
      const primaryCondition = getMemberPrimaryCondition(member);
      if (primaryCondition) {
        conditionCategory = primaryCondition.category;
        conditionCategoryLabel = primaryCondition.categoryLabel;
      }
    }

    if (!conditionCategory) {
      return { ...defaultResult, memberId: trimmedMemberId, error: 'Unable to determine condition category for care plan generation' };
    }

    // Get care plan template for condition
    const templateGoals = CARE_PLAN_TEMPLATES[conditionCategory] || [];

    // Build care plan goals
    const goals = templateGoals.map((template) => ({
      id: uuidv4(),
      goal: template.goal,
      category: template.category,
      priority: template.priority,
      status: 'active',
      targetDate: null,
      completedDate: null,
      notes: '',
    }));

    // Add additional goals if provided
    if (options && Array.isArray(options.additionalGoals)) {
      for (const additionalGoal of options.additionalGoals) {
        if (additionalGoal && typeof additionalGoal === 'object' && typeof additionalGoal.goal === 'string') {
          goals.push({
            id: uuidv4(),
            goal: additionalGoal.goal.trim(),
            category: (typeof additionalGoal.category === 'string') ? additionalGoal.category.trim() : 'general',
            priority: (typeof additionalGoal.priority === 'string') ? additionalGoal.priority.trim() : 'medium',
            status: 'active',
            targetDate: (typeof additionalGoal.targetDate === 'string') ? additionalGoal.targetDate.trim() : null,
            completedDate: null,
            notes: (typeof additionalGoal.notes === 'string') ? additionalGoal.notes.trim() : '',
          });
        }
      }
    }

    // Get assigned care manager
    const assignments = getAllCareManagerAssignments();
    const activeAssignment = assignments.find(
      (a) => a.memberId === trimmedMemberId && a.status === 'active'
    );

    // Create care plan
    const carePlanId = uuidv4();
    const carePlan = {
      id: carePlanId,
      memberId: trimmedMemberId,
      conditionCategory,
      conditionCategoryLabel,
      status: 'active',
      goals,
      totalGoals: goals.length,
      completedGoals: 0,
      careManagerId: activeAssignment ? activeAssignment.managerId : null,
      primaryProviderId: member.primaryProviderId || null,
      diagnosisCodes: member.diagnosisCodes || [],
      effectiveDate: new Date().toISOString().split('T')[0],
      reviewDate: null,
      nextReviewDate: calculateNextReviewDate(),
      notes: `Auto-generated care plan for ${conditionCategoryLabel}. Member: ${member.firstName} ${member.lastName}.`,
      createdBy: performedBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Persist care plan
    const saved = appendToArray(CARE_PLANS_KEY, carePlan);
    if (!saved) {
      return { ...defaultResult, memberId: trimmedMemberId, error: 'Failed to persist care plan' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CARE_PLAN_CREATE,
      performedBy,
      {
        targetType: 'care_plan',
        targetId: carePlanId,
        description: `Care plan generated for member ${member.firstName} ${member.lastName} (${trimmedMemberId}). Condition: ${conditionCategoryLabel}. Goals: ${goals.length}`,
        metadata: {
          carePlanId,
          memberId: trimmedMemberId,
          conditionCategory,
          totalGoals: goals.length,
          careManagerId: activeAssignment ? activeAssignment.managerId : null,
        },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return {
      success: true,
      carePlanId,
      memberId: trimmedMemberId,
      carePlan,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('careManagementService.generateCarePlan: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during care plan generation' };
  }
}

/**
 * Calculates the next review date (90 days from now).
 * @returns {string} Next review date in YYYY-MM-DD format
 */
function calculateNextReviewDate() {
  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + 90);
  const year = reviewDate.getFullYear();
  const month = String(reviewDate.getMonth() + 1).padStart(2, '0');
  const day = String(reviewDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates a care management alert.
 *
 * @param {Object} alertData - The alert data
 * @param {string} alertData.memberId - Member ID
 * @param {string} [alertData.severity='medium'] - Alert severity (low, medium, high, critical)
 * @param {string} alertData.title - Alert title
 * @param {string} [alertData.description] - Alert description
 * @param {string} [alertData.assignedTo] - User ID to assign the alert to
 * @param {string} [alertData.performedBy] - User ID creating the alert
 * @param {string} [alertData.relatedEntityType] - Related entity type
 * @param {string} [alertData.relatedEntityId] - Related entity ID
 * @returns {AlertResult} The alert creation result
 */
export function createAlert(alertData) {
  const timestamp = new Date().toISOString();

  const defaultResult = {
    success: false,
    alertId: null,
    auditId: null,
    timestamp,
  };

  if (!alertData || typeof alertData !== 'object') {
    return { ...defaultResult, error: 'Alert data is required' };
  }

  // Validate required fields
  const memberIdResult = validateRequired(alertData.memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  const titleResult = validateRequired(alertData.title, 'Alert title');
  if (!titleResult.valid) {
    return { ...defaultResult, error: titleResult.error };
  }

  const trimmedMemberId = alertData.memberId.trim();
  const performedBy = (typeof alertData.performedBy === 'string') ? alertData.performedBy.trim() : 'system';

  try {
    // Verify member exists
    const member = getMemberById(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Validate severity
    const severity = (typeof alertData.severity === 'string' && Object.values(ALERT_SEVERITIES).includes(alertData.severity.trim()))
      ? alertData.severity.trim()
      : ALERT_SEVERITIES.MEDIUM;

    // Create alert
    const alertId = uuidv4();
    const alert = {
      id: alertId,
      memberId: trimmedMemberId,
      severity,
      title: alertData.title.trim(),
      description: (typeof alertData.description === 'string') ? alertData.description.trim() : '',
      assignedTo: (typeof alertData.assignedTo === 'string') ? alertData.assignedTo.trim() : null,
      relatedEntityType: (typeof alertData.relatedEntityType === 'string') ? alertData.relatedEntityType.trim() : null,
      relatedEntityId: (typeof alertData.relatedEntityId === 'string') ? alertData.relatedEntityId.trim() : null,
      status: 'active',
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      createdBy: performedBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = appendToArray(CARE_ALERTS_KEY, alert);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist care alert' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'care_alert',
        targetId: alertId,
        description: `Care alert created for member ${member.firstName} ${member.lastName} (${trimmedMemberId}). Severity: ${severity}. Title: ${alert.title}`,
        metadata: {
          alertId,
          memberId: trimmedMemberId,
          severity,
          title: alert.title,
          assignedTo: alert.assignedTo,
        },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return {
      success: true,
      alertId,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('careManagementService.createAlert: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during alert creation' };
  }
}

/**
 * Creates a care management task.
 *
 * @param {Object} taskData - The task data
 * @param {string} taskData.memberId - Member ID
 * @param {string} taskData.title - Task title
 * @param {string} [taskData.description] - Task description
 * @param {string} [taskData.priority='medium'] - Task priority (low, medium, high, urgent)
 * @param {string} [taskData.assignedTo] - User ID to assign the task to
 * @param {string} [taskData.dueDate] - Due date (YYYY-MM-DD)
 * @param {string} [taskData.category] - Task category
 * @param {string} [taskData.relatedCarePlanId] - Related care plan ID
 * @param {string} [taskData.performedBy] - User ID creating the task
 * @returns {TaskResult} The task creation result
 */
export function createTask(taskData) {
  const timestamp = new Date().toISOString();

  const defaultResult = {
    success: false,
    taskId: null,
    auditId: null,
    timestamp,
  };

  if (!taskData || typeof taskData !== 'object') {
    return { ...defaultResult, error: 'Task data is required' };
  }

  // Validate required fields
  const memberIdResult = validateRequired(taskData.memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  const titleResult = validateRequired(taskData.title, 'Task title');
  if (!titleResult.valid) {
    return { ...defaultResult, error: titleResult.error };
  }

  const trimmedMemberId = taskData.memberId.trim();
  const performedBy = (typeof taskData.performedBy === 'string') ? taskData.performedBy.trim() : 'system';

  try {
    // Verify member exists
    const member = getMemberById(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Validate priority
    const priority = (typeof taskData.priority === 'string' && Object.values(TASK_PRIORITIES).includes(taskData.priority.trim()))
      ? taskData.priority.trim()
      : TASK_PRIORITIES.MEDIUM;

    // Create task
    const taskId = uuidv4();
    const task = {
      id: taskId,
      memberId: trimmedMemberId,
      title: taskData.title.trim(),
      description: (typeof taskData.description === 'string') ? taskData.description.trim() : '',
      priority,
      status: TASK_STATUSES.PENDING,
      assignedTo: (typeof taskData.assignedTo === 'string') ? taskData.assignedTo.trim() : null,
      dueDate: (typeof taskData.dueDate === 'string') ? taskData.dueDate.trim() : null,
      category: (typeof taskData.category === 'string') ? taskData.category.trim() : 'general',
      relatedCarePlanId: (typeof taskData.relatedCarePlanId === 'string') ? taskData.relatedCarePlanId.trim() : null,
      completedAt: null,
      completedBy: null,
      createdBy: performedBy,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = appendToArray(CARE_TASKS_KEY, task);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist care task' };
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'care_task',
        targetId: taskId,
        description: `Care task created for member ${member.firstName} ${member.lastName} (${trimmedMemberId}). Priority: ${priority}. Title: ${task.title}`,
        metadata: {
          taskId,
          memberId: trimmedMemberId,
          priority,
          title: task.title,
          assignedTo: task.assignedTo,
          dueDate: task.dueDate,
        },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return {
      success: true,
      taskId,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('careManagementService.createTask: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during task creation' };
  }
}

/**
 * Processes a Health Risk Assessment (HRA) for a member.
 * Calculates risk score, determines risk level, generates recommendations,
 * and creates appropriate alerts and tasks based on findings.
 *
 * @param {string} memberId - The member ID
 * @param {Object} hraData - The HRA data
 * @param {boolean} [hraData.recentHospitalization] - Recent hospitalization
 * @param {boolean} [hraData.recentERVisit] - Recent ER visit
 * @param {boolean} [hraData.fallRisk] - Fall risk identified
 * @param {boolean} [hraData.medicationNonAdherence] - Medication non-adherence
 * @param {boolean} [hraData.socialIsolation] - Social isolation
 * @param {boolean} [hraData.cognitiveImpairment] - Cognitive impairment
 * @param {boolean} [hraData.functionalLimitations] - Functional limitations
 * @param {number} [hraData.painLevel] - Pain level (0-10)
 * @param {boolean} [hraData.depressionScreenPositive] - Depression screen positive
 * @param {boolean} [hraData.tobaccoUse] - Tobacco use
 * @param {string} [hraData.notes] - Additional notes
 * @param {Object} [options={}] - Processing options
 * @param {string} [options.performedBy] - User ID performing the HRA
 * @param {boolean} [options.createAlerts=true] - Whether to create alerts based on findings
 * @param {boolean} [options.createTasks=true] - Whether to create tasks based on findings
 * @returns {HRAResult} The HRA processing result
 */
export function processHRA(memberId, hraData, options = {}) {
  const timestamp = new Date().toISOString();
  const performedBy = (options && typeof options.performedBy === 'string') ? options.performedBy : 'system';
  const shouldCreateAlerts = options && options.createAlerts === false ? false : true;
  const shouldCreateTasks = options && options.createTasks === false ? false : true;

  const defaultResult = {
    success: false,
    hraId: null,
    riskScore: null,
    riskLevel: null,
    recommendations: null,
    auditId: null,
    timestamp,
  };

  // Validate inputs
  const memberIdResult = validateRequired(memberId, 'Member ID');
  if (!memberIdResult.valid) {
    return { ...defaultResult, error: memberIdResult.error };
  }

  if (!hraData || typeof hraData !== 'object') {
    return { ...defaultResult, error: 'HRA data is required' };
  }

  const trimmedMemberId = memberId.trim();

  try {
    // Verify member exists
    const member = getMemberById(trimmedMemberId);
    if (!member) {
      return { ...defaultResult, error: `Member not found: ${trimmedMemberId}` };
    }

    // Calculate risk score
    const { score, level } = calculateRiskScore(hraData, member);

    // Generate recommendations
    const recommendations = generateHRARecommendations(hraData, member, level);

    // Create HRA record
    const hraId = uuidv4();
    const hraRecord = {
      id: hraId,
      memberId: trimmedMemberId,
      assessmentDate: new Date().toISOString().split('T')[0],
      riskScore: score,
      riskLevel: level,
      hraData: { ...hraData },
      recommendations,
      notes: (typeof hraData.notes === 'string') ? hraData.notes.trim() : '',
      performedBy,
      status: 'completed',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = appendToArray(HRA_RECORDS_KEY, hraRecord);
    if (!saved) {
      return { ...defaultResult, error: 'Failed to persist HRA record' };
    }

    // Get assigned care manager for alerts/tasks
    const assignments = getAllCareManagerAssignments();
    const activeAssignment = assignments.find(
      (a) => a.memberId === trimmedMemberId && a.status === 'active'
    );
    const assignedManagerId = activeAssignment ? activeAssignment.managerId : null;

    // Create alerts based on risk level
    if (shouldCreateAlerts) {
      if (level === RISK_LEVELS.CRITICAL) {
        createAlert({
          memberId: trimmedMemberId,
          severity: ALERT_SEVERITIES.CRITICAL,
          title: `Critical Risk HRA - ${member.firstName} ${member.lastName}`,
          description: `HRA completed with critical risk score (${score}/100). Immediate care manager intervention required.`,
          assignedTo: assignedManagerId,
          relatedEntityType: 'hra',
          relatedEntityId: hraId,
          performedBy,
        });
      } else if (level === RISK_LEVELS.HIGH) {
        createAlert({
          memberId: trimmedMemberId,
          severity: ALERT_SEVERITIES.HIGH,
          title: `High Risk HRA - ${member.firstName} ${member.lastName}`,
          description: `HRA completed with high risk score (${score}/100). Care manager follow-up recommended within 48 hours.`,
          assignedTo: assignedManagerId,
          relatedEntityType: 'hra',
          relatedEntityId: hraId,
          performedBy,
        });
      }

      // Specific risk factor alerts
      if (hraData.recentHospitalization === true) {
        createAlert({
          memberId: trimmedMemberId,
          severity: ALERT_SEVERITIES.HIGH,
          title: `Recent Hospitalization - ${member.firstName} ${member.lastName}`,
          description: 'Member reported recent hospitalization during HRA. Post-discharge follow-up required.',
          assignedTo: assignedManagerId,
          relatedEntityType: 'hra',
          relatedEntityId: hraId,
          performedBy,
        });
      }
    }

    // Create tasks based on recommendations
    if (shouldCreateTasks) {
      // Create tasks for immediate actions
      for (const action of recommendations.immediateActions) {
        createTask({
          memberId: trimmedMemberId,
          title: action,
          description: `Auto-generated from HRA assessment (Risk Score: ${score}, Level: ${level})`,
          priority: level === RISK_LEVELS.CRITICAL ? TASK_PRIORITIES.URGENT : TASK_PRIORITIES.HIGH,
          assignedTo: assignedManagerId,
          dueDate: calculateTaskDueDate(level === RISK_LEVELS.CRITICAL ? 1 : 2),
          category: 'hra_follow_up',
          performedBy,
        });
      }

      // Create tasks for follow-up actions
      for (const action of recommendations.followUpActions) {
        createTask({
          memberId: trimmedMemberId,
          title: action,
          description: `Auto-generated from HRA assessment (Risk Score: ${score}, Level: ${level})`,
          priority: TASK_PRIORITIES.MEDIUM,
          assignedTo: assignedManagerId,
          dueDate: calculateTaskDueDate(7),
          category: 'hra_follow_up',
          performedBy,
        });
      }

      // Create tasks for referrals
      for (const referral of recommendations.referrals) {
        createTask({
          memberId: trimmedMemberId,
          title: `Referral: ${referral}`,
          description: `Referral recommended based on HRA assessment (Risk Score: ${score}, Level: ${level})`,
          priority: TASK_PRIORITIES.MEDIUM,
          assignedTo: assignedManagerId,
          dueDate: calculateTaskDueDate(14),
          category: 'referral',
          performedBy,
        });
      }
    }

    // Audit log
    const auditEntry = logAction(
      AUDIT_ACTIONS.CREATE,
      performedBy,
      {
        targetType: 'hra',
        targetId: hraId,
        description: `HRA processed for member ${member.firstName} ${member.lastName} (${trimmedMemberId}). Risk Score: ${score}/100. Risk Level: ${level}. Recommendations: ${recommendations.immediateActions.length} immediate, ${recommendations.followUpActions.length} follow-up, ${recommendations.referrals.length} referrals`,
        metadata: {
          hraId,
          memberId: trimmedMemberId,
          riskScore: score,
          riskLevel: level,
          immediateActionsCount: recommendations.immediateActions.length,
          followUpActionsCount: recommendations.followUpActions.length,
          referralsCount: recommendations.referrals.length,
        },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return {
      success: true,
      hraId,
      riskScore: score,
      riskLevel: level,
      recommendations,
      auditId: auditEntry ? auditEntry.id : null,
      timestamp,
    };
  } catch (error) {
    console.error('careManagementService.processHRA: unexpected error:', error);
    return { ...defaultResult, error: 'An unexpected error occurred during HRA processing' };
  }
}

/**
 * Calculates a task due date based on days from now.
 * @param {number} daysFromNow - Number of days from now
 * @returns {string} Due date in YYYY-MM-DD format
 */
function calculateTaskDueDate(daysFromNow) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysFromNow);
  const year = dueDate.getFullYear();
  const month = String(dueDate.getMonth() + 1).padStart(2, '0');
  const day = String(dueDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Query Functions ────────────────────────────────────────────────────────

/**
 * Retrieves care events for a member.
 *
 * @param {string} memberId - The member ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.eventType] - Filter by event type
 * @param {string} [filters.status] - Filter by status
 * @returns {Object[]} Array of care event records
 */
export function getMemberCareEvents(memberId, filters = {}) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    let events = getAllCareEvents();
    events = events.filter((e) => e.memberId === memberId.trim());

    if (filters && typeof filters.eventType === 'string' && filters.eventType.trim().length > 0) {
      events = events.filter((e) => e.eventType === filters.eventType.trim());
    }

    if (filters && typeof filters.status === 'string' && filters.status.trim().length > 0) {
      events = events.filter((e) => e.status === filters.status.trim());
    }

    return events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('careManagementService.getMemberCareEvents: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves the active care plan for a member.
 *
 * @param {string} memberId - The member ID
 * @returns {Object|null} The active care plan or null
 */
export function getActiveCarePlan(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return null;
  }

  try {
    const plans = getAllCarePlans();
    const activePlans = plans
      .filter((p) => p.memberId === memberId.trim() && p.status === 'active')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return activePlans.length > 0 ? activePlans[0] : null;
  } catch (error) {
    console.error('careManagementService.getActiveCarePlan: unexpected error:', error);
    return null;
  }
}

/**
 * Retrieves all care plans for a member.
 *
 * @param {string} memberId - The member ID
 * @returns {Object[]} Array of care plan records
 */
export function getMemberCarePlans(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    const plans = getAllCarePlans();
    return plans
      .filter((p) => p.memberId === memberId.trim())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('careManagementService.getMemberCarePlans: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves the active care manager assignment for a member.
 *
 * @param {string} memberId - The member ID
 * @returns {Object|null} The active care manager assignment or null
 */
export function getActiveCareManagerAssignment(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return null;
  }

  try {
    const assignments = getAllCareManagerAssignments();
    const active = assignments.find(
      (a) => a.memberId === memberId.trim() && a.status === 'active'
    );
    return active || null;
  } catch (error) {
    console.error('careManagementService.getActiveCareManagerAssignment: unexpected error:', error);
    return null;
  }
}

/**
 * Retrieves care alerts for a member.
 *
 * @param {string} memberId - The member ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.severity] - Filter by severity
 * @param {string} [filters.status] - Filter by status
 * @param {boolean} [filters.unacknowledgedOnly] - Only return unacknowledged alerts
 * @returns {Object[]} Array of care alert records
 */
export function getMemberAlerts(memberId, filters = {}) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    let alerts = getAllCareAlerts();
    alerts = alerts.filter((a) => a.memberId === memberId.trim());

    if (filters && typeof filters.severity === 'string' && filters.severity.trim().length > 0) {
      alerts = alerts.filter((a) => a.severity === filters.severity.trim());
    }

    if (filters && typeof filters.status === 'string' && filters.status.trim().length > 0) {
      alerts = alerts.filter((a) => a.status === filters.status.trim());
    }

    if (filters && filters.unacknowledgedOnly === true) {
      alerts = alerts.filter((a) => a.acknowledged === false);
    }

    return alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('careManagementService.getMemberAlerts: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves care tasks for a member.
 *
 * @param {string} memberId - The member ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.priority] - Filter by priority
 * @param {string} [filters.assignedTo] - Filter by assigned user
 * @returns {Object[]} Array of care task records
 */
export function getMemberTasks(memberId, filters = {}) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    let tasks = getAllCareTasks();
    tasks = tasks.filter((t) => t.memberId === memberId.trim());

    if (filters && typeof filters.status === 'string' && filters.status.trim().length > 0) {
      tasks = tasks.filter((t) => t.status === filters.status.trim());
    }

    if (filters && typeof filters.priority === 'string' && filters.priority.trim().length > 0) {
      tasks = tasks.filter((t) => t.priority === filters.priority.trim());
    }

    if (filters && typeof filters.assignedTo === 'string' && filters.assignedTo.trim().length > 0) {
      tasks = tasks.filter((t) => t.assignedTo === filters.assignedTo.trim());
    }

    return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('careManagementService.getMemberTasks: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves HRA records for a member.
 *
 * @param {string} memberId - The member ID
 * @returns {Object[]} Array of HRA records
 */
export function getMemberHRARecords(memberId) {
  if (typeof memberId !== 'string' || memberId.trim().length === 0) {
    return [];
  }

  try {
    const records = getAllHRARecords();
    return records
      .filter((r) => r.memberId === memberId.trim())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('careManagementService.getMemberHRARecords: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves the latest HRA record for a member.
 *
 * @param {string} memberId - The member ID
 * @returns {Object|null} The latest HRA record or null
 */
export function getLatestHRA(memberId) {
  const records = getMemberHRARecords(memberId);
  return records.length > 0 ? records[0] : null;
}

/**
 * Acknowledges a care alert.
 *
 * @param {string} alertId - The alert ID
 * @param {string} [performedBy] - User ID acknowledging the alert
 * @returns {{ success: boolean, error?: string }}
 */
export function acknowledgeAlert(alertId, performedBy) {
  if (typeof alertId !== 'string' || alertId.trim().length === 0) {
    return { success: false, error: 'Alert ID is required' };
  }

  const trimmedId = alertId.trim();

  try {
    const alert = findInArray(CARE_ALERTS_KEY, (a) => a.id === trimmedId);
    if (!alert) {
      return { success: false, error: `Alert not found: ${trimmedId}` };
    }

    if (alert.acknowledged) {
      return { success: false, error: 'Alert is already acknowledged' };
    }

    const timestamp = new Date().toISOString();

    const updated = updateInArray(
      CARE_ALERTS_KEY,
      (a) => a.id === trimmedId,
      (a) => ({
        ...a,
        acknowledged: true,
        acknowledgedAt: timestamp,
        acknowledgedBy: performedBy || 'system',
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, error: 'Failed to update alert' };
    }

    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy || 'system',
      {
        targetType: 'care_alert',
        targetId: trimmedId,
        description: `Care alert ${trimmedId} acknowledged for member ${alert.memberId}`,
        metadata: { alertId: trimmedId, memberId: alert.memberId },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return { success: true };
  } catch (error) {
    console.error('careManagementService.acknowledgeAlert: unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Completes a care task.
 *
 * @param {string} taskId - The task ID
 * @param {string} [performedBy] - User ID completing the task
 * @param {string} [notes] - Completion notes
 * @returns {{ success: boolean, error?: string }}
 */
export function completeTask(taskId, performedBy, notes) {
  if (typeof taskId !== 'string' || taskId.trim().length === 0) {
    return { success: false, error: 'Task ID is required' };
  }

  const trimmedId = taskId.trim();

  try {
    const task = findInArray(CARE_TASKS_KEY, (t) => t.id === trimmedId);
    if (!task) {
      return { success: false, error: `Task not found: ${trimmedId}` };
    }

    if (task.status === TASK_STATUSES.COMPLETED) {
      return { success: false, error: 'Task is already completed' };
    }

    if (task.status === TASK_STATUSES.CANCELLED) {
      return { success: false, error: 'Cannot complete a cancelled task' };
    }

    const timestamp = new Date().toISOString();
    const completionNotes = typeof notes === 'string' ? notes.trim() : '';

    const updated = updateInArray(
      CARE_TASKS_KEY,
      (t) => t.id === trimmedId,
      (t) => ({
        ...t,
        status: TASK_STATUSES.COMPLETED,
        completedAt: timestamp,
        completedBy: performedBy || 'system',
        description: completionNotes
          ? `${t.description} | Completion notes: ${completionNotes}`
          : t.description,
        updatedAt: timestamp,
      })
    );

    if (!updated) {
      return { success: false, error: 'Failed to update task' };
    }

    logAction(
      AUDIT_ACTIONS.UPDATE,
      performedBy || 'system',
      {
        targetType: 'care_task',
        targetId: trimmedId,
        description: `Care task ${trimmedId} completed for member ${task.memberId}. Title: ${task.title}`,
        metadata: { taskId: trimmedId, memberId: task.memberId, title: task.title },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return { success: true };
  } catch (error) {
    console.error('careManagementService.completeTask: unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Updates a care plan goal status.
 *
 * @param {string} carePlanId - The care plan ID
 * @param {string} goalId - The goal ID within the care plan
 * @param {string} newStatus - The new goal status (active, completed, on_hold, cancelled)
 * @param {string} [performedBy] - User ID performing the update
 * @returns {{ success: boolean, error?: string }}
 */
export function updateCarePlanGoal(carePlanId, goalId, newStatus, performedBy) {
  if (typeof carePlanId !== 'string' || carePlanId.trim().length === 0) {
    return { success: false, error: 'Care plan ID is required' };
  }

  if (typeof goalId !== 'string' || goalId.trim().length === 0) {
    return { success: false, error: 'Goal ID is required' };
  }

  const validStatuses = ['active', 'completed', 'on_hold', 'cancelled'];
  if (!validStatuses.includes(newStatus)) {
    return { success: false, error: `Invalid goal status: "${newStatus}". Must be one of: ${validStatuses.join(', ')}` };
  }

  const trimmedPlanId = carePlanId.trim();
  const trimmedGoalId = goalId.trim();

  try {
    const carePlan = findInArray(CARE_PLANS_KEY, (p) => p.id === trimmedPlanId);
    if (!carePlan) {
      return { success: false, error: `Care plan not found: ${trimmedPlanId}` };
    }

    const goalIndex = carePlan.goals.findIndex((g) => g.id === trimmedGoalId);
    if (goalIndex === -1) {
      return { success: false, error: `Goal not found: ${trimmedGoalId}` };
    }

    const timestamp = new Date().toISOString();

    const updated = updateInArray(
      CARE_PLANS_KEY,
      (p) => p.id === trimmedPlanId,
      (p) => {
        const updatedGoals = [...p.goals];
        updatedGoals[goalIndex] = {
          ...updatedGoals[goalIndex],
          status: newStatus,
          completedDate: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : updatedGoals[goalIndex].completedDate,
        };

        const completedGoals = updatedGoals.filter((g) => g.status === 'completed').length;

        return {
          ...p,
          goals: updatedGoals,
          completedGoals,
          updatedAt: timestamp,
        };
      }
    );

    if (!updated) {
      return { success: false, error: 'Failed to update care plan goal' };
    }

    logAction(
      AUDIT_ACTIONS.CARE_PLAN_UPDATE,
      performedBy || 'system',
      {
        targetType: 'care_plan_goal',
        targetId: trimmedGoalId,
        description: `Care plan goal updated to "${newStatus}" in plan ${trimmedPlanId} for member ${carePlan.memberId}`,
        metadata: {
          carePlanId: trimmedPlanId,
          goalId: trimmedGoalId,
          newStatus,
          memberId: carePlan.memberId,
        },
        ipAddress: '127.0.0.1',
      },
      'care_management'
    );

    return { success: true };
  } catch (error) {
    console.error('careManagementService.updateCarePlanGoal: unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Returns care management statistics.
 *
 * @returns {{ totalCareEvents: number, totalCarePlans: number, activeCarePlans: number, totalAlerts: number, activeAlerts: number, totalTasks: number, pendingTasks: number, completedTasks: number, totalHRAs: number, totalCareManagerAssignments: number, activeCareManagerAssignments: number, totalProgramEnrollments: number, byEventType: Object.<string, number>, byRiskLevel: Object.<string, number> }}
 */
export function getCareManagementStats() {
  try {
    const events = getAllCareEvents();
    const plans = getAllCarePlans();
    const alerts = getAllCareAlerts();
    const tasks = getAllCareTasks();
    const hras = getAllHRARecords();
    const assignments = getAllCareManagerAssignments();
    const enrollments = getAllCareProgramEnrollments();

    const stats = {
      totalCareEvents: events.length,
      totalCarePlans: plans.length,
      activeCarePlans: plans.filter((p) => p.status === 'active').length,
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter((a) => a.status === 'active' && !a.acknowledged).length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t) => t.status === TASK_STATUSES.PENDING).length,
      completedTasks: tasks.filter((t) => t.status === TASK_STATUSES.COMPLETED).length,
      totalHRAs: hras.length,
      totalCareManagerAssignments: assignments.length,
      activeCareManagerAssignments: assignments.filter((a) => a.status === 'active').length,
      totalProgramEnrollments: enrollments.length,
      byEventType: {},
      byRiskLevel: {},
    };

    for (const event of events) {
      const eventType = event.eventType || 'unknown';
      if (!stats.byEventType[eventType]) {
        stats.byEventType[eventType] = 0;
      }
      stats.byEventType[eventType]++;
    }

    for (const hra of hras) {
      const riskLevel = hra.riskLevel || 'unknown';
      if (!stats.byRiskLevel[riskLevel]) {
        stats.byRiskLevel[riskLevel] = 0;
      }
      stats.byRiskLevel[riskLevel]++;
    }

    return stats;
  } catch (error) {
    console.error('careManagementService.getCareManagementStats: unexpected error:', error);
    return {
      totalCareEvents: 0,
      totalCarePlans: 0,
      activeCarePlans: 0,
      totalAlerts: 0,
      activeAlerts: 0,
      totalTasks: 0,
      pendingTasks: 0,
      completedTasks: 0,
      totalHRAs: 0,
      totalCareManagerAssignments: 0,
      activeCareManagerAssignments: 0,
      totalProgramEnrollments: 0,
      byEventType: {},
      byRiskLevel: {},
    };
  }
}

/**
 * Retrieves tasks assigned to a specific care manager.
 *
 * @param {string} managerId - The care manager user ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.priority] - Filter by priority
 * @returns {Object[]} Array of care task records
 */
export function getCareManagerTasks(managerId, filters = {}) {
  if (typeof managerId !== 'string' || managerId.trim().length === 0) {
    return [];
  }

  try {
    let tasks = getAllCareTasks();
    tasks = tasks.filter((t) => t.assignedTo === managerId.trim());

    if (filters && typeof filters.status === 'string' && filters.status.trim().length > 0) {
      tasks = tasks.filter((t) => t.status === filters.status.trim());
    }

    if (filters && typeof filters.priority === 'string' && filters.priority.trim().length > 0) {
      tasks = tasks.filter((t) => t.priority === filters.priority.trim());
    }

    return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('careManagementService.getCareManagerTasks: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves alerts assigned to a specific care manager.
 *
 * @param {string} managerId - The care manager user ID
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.severity] - Filter by severity
 * @param {boolean} [filters.unacknowledgedOnly] - Only return unacknowledged alerts
 * @returns {Object[]} Array of care alert records
 */
export function getCareManagerAlerts(managerId, filters = {}) {
  if (typeof managerId !== 'string' || managerId.trim().length === 0) {
    return [];
  }

  try {
    let alerts = getAllCareAlerts();
    alerts = alerts.filter((a) => a.assignedTo === managerId.trim());

    if (filters && typeof filters.severity === 'string' && filters.severity.trim().length > 0) {
      alerts = alerts.filter((a) => a.severity === filters.severity.trim());
    }

    if (filters && filters.unacknowledgedOnly === true) {
      alerts = alerts.filter((a) => a.acknowledged === false);
    }

    return alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('careManagementService.getCareManagerAlerts: unexpected error:', error);
    return [];
  }
}

/**
 * Retrieves members assigned to a specific care manager.
 *
 * @param {string} managerId - The care manager user ID
 * @returns {string[]} Array of member IDs
 */
export function getCareManagerMembers(managerId) {
  if (typeof managerId !== 'string' || managerId.trim().length === 0) {
    return [];
  }

  try {
    const assignments = getAllCareManagerAssignments();
    const activeAssignments = assignments.filter(
      (a) => a.managerId === managerId.trim() && a.status === 'active'
    );

    return activeAssignments.map((a) => a.memberId);
  } catch (error) {
    console.error('careManagementService.getCareManagerMembers: unexpected error:', error);
    return [];
  }
}