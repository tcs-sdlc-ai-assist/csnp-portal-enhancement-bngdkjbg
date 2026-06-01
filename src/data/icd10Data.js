/**
 * ICD-10 diagnosis code dataset for CSNP eligibility.
 * Contains chronic condition codes with descriptions, CSNP eligibility flags,
 * priority rankings, and condition category mappings.
 * @module icd10Data
 */

/**
 * Condition categories for CSNP eligibility grouping.
 * @enum {string}
 */
export const CONDITION_CATEGORIES = Object.freeze({
  DIABETES: 'diabetes',
  HEART_FAILURE: 'heart_failure',
  COPD: 'copd',
  CHRONIC_KIDNEY_DISEASE: 'chronic_kidney_disease',
  CARDIOVASCULAR: 'cardiovascular',
  STROKE: 'stroke',
  DEMENTIA: 'dementia',
  MENTAL_HEALTH: 'mental_health',
  AUTOIMMUNE: 'autoimmune',
  HIV_AIDS: 'hiv_aids',
  ESRD: 'esrd',
  CANCER: 'cancer',
  LIVER_DISEASE: 'liver_disease',
  RESPIRATORY: 'respiratory',
  NEUROLOGICAL: 'neurological',
});

/**
 * Labels for condition categories.
 * @enum {string}
 */
export const CONDITION_CATEGORY_LABELS = Object.freeze({
  [CONDITION_CATEGORIES.DIABETES]: 'Diabetes Mellitus',
  [CONDITION_CATEGORIES.HEART_FAILURE]: 'Congestive Heart Failure',
  [CONDITION_CATEGORIES.COPD]: 'Chronic Obstructive Pulmonary Disease',
  [CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE]: 'Chronic Kidney Disease',
  [CONDITION_CATEGORIES.CARDIOVASCULAR]: 'Cardiovascular Disease',
  [CONDITION_CATEGORIES.STROKE]: 'Cerebrovascular Disease / Stroke',
  [CONDITION_CATEGORIES.DEMENTIA]: 'Dementia / Alzheimer\'s',
  [CONDITION_CATEGORIES.MENTAL_HEALTH]: 'Chronic Mental Health Conditions',
  [CONDITION_CATEGORIES.AUTOIMMUNE]: 'Autoimmune Disorders',
  [CONDITION_CATEGORIES.HIV_AIDS]: 'HIV / AIDS',
  [CONDITION_CATEGORIES.ESRD]: 'End-Stage Renal Disease',
  [CONDITION_CATEGORIES.CANCER]: 'Cancer',
  [CONDITION_CATEGORIES.LIVER_DISEASE]: 'Chronic Liver Disease',
  [CONDITION_CATEGORIES.RESPIRATORY]: 'Chronic Respiratory Conditions',
  [CONDITION_CATEGORIES.NEUROLOGICAL]: 'Neurological Conditions',
});

/**
 * @typedef {Object} ICD10Code
 * @property {string} code - The ICD-10-CM diagnosis code
 * @property {string} description - Human-readable description of the diagnosis
 * @property {string} category - Condition category from CONDITION_CATEGORIES
 * @property {boolean} csnpEligible - Whether this code qualifies for C-SNP enrollment
 * @property {number} priority - Priority ranking (1 = highest priority)
 * @property {string[]} relatedCodes - Array of related ICD-10 codes
 */

/**
 * Comprehensive ICD-10 diagnosis code dataset for CSNP eligibility.
 * @type {ICD10Code[]}
 */
export const ICD10_CODES = Object.freeze([
  // ─── Diabetes Mellitus ───────────────────────────────────────────────
  {
    code: 'E11.9',
    description: 'Type 2 diabetes mellitus without complications',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.65', 'E11.21', 'E11.22'],
  },
  {
    code: 'E11.65',
    description: 'Type 2 diabetes mellitus with hyperglycemia',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.9', 'E11.69'],
  },
  {
    code: 'E11.21',
    description: 'Type 2 diabetes mellitus with diabetic nephropathy',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.9', 'E11.22', 'N18.3'],
  },
  {
    code: 'E11.22',
    description: 'Type 2 diabetes mellitus with diabetic chronic kidney disease',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.9', 'E11.21', 'N18.4'],
  },
  {
    code: 'E11.29',
    description: 'Type 2 diabetes mellitus with other diabetic kidney complication',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.21', 'E11.22'],
  },
  {
    code: 'E11.311',
    description: 'Type 2 diabetes mellitus with unspecified diabetic retinopathy with macular edema',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.319', 'E11.9'],
  },
  {
    code: 'E11.319',
    description: 'Type 2 diabetes mellitus with unspecified diabetic retinopathy without macular edema',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.311', 'E11.9'],
  },
  {
    code: 'E11.40',
    description: 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.41', 'E11.42', 'E11.9'],
  },
  {
    code: 'E11.41',
    description: 'Type 2 diabetes mellitus with diabetic mononeuropathy',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.40', 'E11.42'],
  },
  {
    code: 'E11.42',
    description: 'Type 2 diabetes mellitus with diabetic polyneuropathy',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.40', 'E11.41'],
  },
  {
    code: 'E11.51',
    description: 'Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.52', 'E11.9'],
  },
  {
    code: 'E11.52',
    description: 'Type 2 diabetes mellitus with diabetic peripheral angiopathy with gangrene',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.51', 'E11.9'],
  },
  {
    code: 'E11.69',
    description: 'Type 2 diabetes mellitus with other specified complication',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E11.9', 'E11.65'],
  },
  {
    code: 'E10.9',
    description: 'Type 1 diabetes mellitus without complications',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E10.65', 'E10.21'],
  },
  {
    code: 'E10.65',
    description: 'Type 1 diabetes mellitus with hyperglycemia',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E10.9', 'E10.69'],
  },
  {
    code: 'E10.21',
    description: 'Type 1 diabetes mellitus with diabetic nephropathy',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E10.9', 'E10.22'],
  },
  {
    code: 'E10.22',
    description: 'Type 1 diabetes mellitus with diabetic chronic kidney disease',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['E10.9', 'E10.21'],
  },
  {
    code: 'E13.9',
    description: 'Other specified diabetes mellitus without complications',
    category: CONDITION_CATEGORIES.DIABETES,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['E11.9', 'E10.9'],
  },

  // ─── Congestive Heart Failure ────────────────────────────────────────
  {
    code: 'I50.9',
    description: 'Heart failure, unspecified',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.20', 'I50.30', 'I50.40'],
  },
  {
    code: 'I50.20',
    description: 'Unspecified systolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.21', 'I50.22', 'I50.23'],
  },
  {
    code: 'I50.21',
    description: 'Acute systolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.20', 'I50.23'],
  },
  {
    code: 'I50.22',
    description: 'Chronic systolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.20', 'I50.23'],
  },
  {
    code: 'I50.23',
    description: 'Acute on chronic systolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.21', 'I50.22'],
  },
  {
    code: 'I50.30',
    description: 'Unspecified diastolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.31', 'I50.32', 'I50.33'],
  },
  {
    code: 'I50.31',
    description: 'Acute diastolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.30', 'I50.33'],
  },
  {
    code: 'I50.32',
    description: 'Chronic diastolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.30', 'I50.33'],
  },
  {
    code: 'I50.33',
    description: 'Acute on chronic diastolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.31', 'I50.32'],
  },
  {
    code: 'I50.40',
    description: 'Unspecified combined systolic and diastolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.41', 'I50.42', 'I50.43'],
  },
  {
    code: 'I50.41',
    description: 'Acute combined systolic and diastolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.40', 'I50.43'],
  },
  {
    code: 'I50.42',
    description: 'Chronic combined systolic and diastolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.40', 'I50.43'],
  },
  {
    code: 'I50.43',
    description: 'Acute on chronic combined systolic and diastolic (congestive) heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.41', 'I50.42'],
  },
  {
    code: 'I50.1',
    description: 'Left ventricular failure, unspecified',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I50.9', 'I50.810'],
  },
  {
    code: 'I50.810',
    description: 'Right heart failure, unspecified',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I50.9', 'I50.1'],
  },
  {
    code: 'I50.814',
    description: 'Right heart failure due to left heart failure',
    category: CONDITION_CATEGORIES.HEART_FAILURE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I50.810', 'I50.1'],
  },

  // ─── COPD ────────────────────────────────────────────────────────────
  {
    code: 'J44.9',
    description: 'Chronic obstructive pulmonary disease, unspecified',
    category: CONDITION_CATEGORIES.COPD,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['J44.0', 'J44.1'],
  },
  {
    code: 'J44.0',
    description: 'Chronic obstructive pulmonary disease with (acute) lower respiratory infection',
    category: CONDITION_CATEGORIES.COPD,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['J44.9', 'J44.1'],
  },
  {
    code: 'J44.1',
    description: 'Chronic obstructive pulmonary disease with (acute) exacerbation',
    category: CONDITION_CATEGORIES.COPD,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['J44.9', 'J44.0'],
  },
  {
    code: 'J43.9',
    description: 'Emphysema, unspecified',
    category: CONDITION_CATEGORIES.COPD,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['J44.9', 'J43.1', 'J43.2'],
  },
  {
    code: 'J43.1',
    description: 'Panlobular emphysema',
    category: CONDITION_CATEGORIES.COPD,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['J43.9', 'J43.2'],
  },
  {
    code: 'J43.2',
    description: 'Centrilobular emphysema',
    category: CONDITION_CATEGORIES.COPD,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['J43.9', 'J43.1'],
  },
  {
    code: 'J42',
    description: 'Unspecified chronic bronchitis',
    category: CONDITION_CATEGORIES.COPD,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['J44.9', 'J41.0', 'J41.1'],
  },
  {
    code: 'J41.0',
    description: 'Simple chronic bronchitis',
    category: CONDITION_CATEGORIES.COPD,
    csnpEligible: true,
    priority: 3,
    relatedCodes: ['J42', 'J41.1'],
  },
  {
    code: 'J41.1',
    description: 'Mucopurulent chronic bronchitis',
    category: CONDITION_CATEGORIES.COPD,
    csnpEligible: true,
    priority: 3,
    relatedCodes: ['J42', 'J41.0'],
  },

  // ─── Chronic Kidney Disease ──────────────────────────────────────────
  {
    code: 'N18.1',
    description: 'Chronic kidney disease, stage 1',
    category: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    csnpEligible: false,
    priority: 5,
    relatedCodes: ['N18.2', 'N18.9'],
  },
  {
    code: 'N18.2',
    description: 'Chronic kidney disease, stage 2 (mild)',
    category: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    csnpEligible: false,
    priority: 5,
    relatedCodes: ['N18.1', 'N18.3'],
  },
  {
    code: 'N18.3',
    description: 'Chronic kidney disease, stage 3 (moderate)',
    category: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['N18.2', 'N18.30', 'N18.31', 'N18.32'],
  },
  {
    code: 'N18.30',
    description: 'Chronic kidney disease, stage 3 unspecified',
    category: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['N18.31', 'N18.32'],
  },
  {
    code: 'N18.31',
    description: 'Chronic kidney disease, stage 3a',
    category: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['N18.30', 'N18.32'],
  },
  {
    code: 'N18.32',
    description: 'Chronic kidney disease, stage 3b',
    category: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['N18.30', 'N18.31'],
  },
  {
    code: 'N18.4',
    description: 'Chronic kidney disease, stage 4 (severe)',
    category: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['N18.3', 'N18.5'],
  },
  {
    code: 'N18.5',
    description: 'Chronic kidney disease, stage 5',
    category: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['N18.4', 'N18.6'],
  },
  {
    code: 'N18.6',
    description: 'End stage renal disease',
    category: CONDITION_CATEGORIES.ESRD,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['N18.5', 'Z99.2'],
  },
  {
    code: 'N18.9',
    description: 'Chronic kidney disease, unspecified',
    category: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    csnpEligible: true,
    priority: 3,
    relatedCodes: ['N18.3', 'N18.4'],
  },
  {
    code: 'Z99.2',
    description: 'Dependence on renal dialysis',
    category: CONDITION_CATEGORIES.ESRD,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['N18.6', 'N18.5'],
  },

  // ─── Cardiovascular Disease ──────────────────────────────────────────
  {
    code: 'I25.10',
    description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I25.110', 'I25.111', 'I25.118'],
  },
  {
    code: 'I25.110',
    description: 'Atherosclerotic heart disease of native coronary artery with unstable angina pectoris',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I25.10', 'I25.111'],
  },
  {
    code: 'I25.111',
    description: 'Atherosclerotic heart disease of native coronary artery with angina pectoris with documented spasm',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I25.10', 'I25.110'],
  },
  {
    code: 'I25.118',
    description: 'Atherosclerotic heart disease of native coronary artery with other forms of angina pectoris',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I25.10', 'I25.110'],
  },
  {
    code: 'I25.5',
    description: 'Ischemic cardiomyopathy',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I25.10', 'I50.9'],
  },
  {
    code: 'I25.9',
    description: 'Chronic ischemic heart disease, unspecified',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I25.10', 'I25.5'],
  },
  {
    code: 'I10',
    description: 'Essential (primary) hypertension',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: false,
    priority: 4,
    relatedCodes: ['I11.9', 'I12.9'],
  },
  {
    code: 'I11.9',
    description: 'Hypertensive heart disease without heart failure',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 3,
    relatedCodes: ['I10', 'I11.0'],
  },
  {
    code: 'I11.0',
    description: 'Hypertensive heart disease with heart failure',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I11.9', 'I50.9'],
  },
  {
    code: 'I12.9',
    description: 'Hypertensive chronic kidney disease with stage 1-4 or unspecified CKD',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I10', 'I12.0'],
  },
  {
    code: 'I12.0',
    description: 'Hypertensive chronic kidney disease with stage 5 CKD or ESRD',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I12.9', 'N18.5', 'N18.6'],
  },
  {
    code: 'I13.0',
    description: 'Hypertensive heart and chronic kidney disease with heart failure and stage 1-4 or unspecified CKD',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I11.0', 'I12.9'],
  },
  {
    code: 'I48.91',
    description: 'Unspecified atrial fibrillation',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I48.0', 'I48.1', 'I48.2'],
  },
  {
    code: 'I48.0',
    description: 'Paroxysmal atrial fibrillation',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I48.91', 'I48.1'],
  },
  {
    code: 'I48.1',
    description: 'Persistent atrial fibrillation',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I48.91', 'I48.2'],
  },
  {
    code: 'I48.2',
    description: 'Chronic atrial fibrillation',
    category: CONDITION_CATEGORIES.CARDIOVASCULAR,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I48.91', 'I48.1'],
  },

  // ─── Cerebrovascular Disease / Stroke ────────────────────────────────
  {
    code: 'I63.9',
    description: 'Cerebral infarction, unspecified',
    category: CONDITION_CATEGORIES.STROKE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I63.50', 'I69.30'],
  },
  {
    code: 'I63.50',
    description: 'Cerebral infarction due to unspecified occlusion or stenosis of unspecified cerebral artery',
    category: CONDITION_CATEGORIES.STROKE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I63.9', 'I69.30'],
  },
  {
    code: 'I69.30',
    description: 'Unspecified sequelae of cerebral infarction',
    category: CONDITION_CATEGORIES.STROKE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I63.9', 'I69.398'],
  },
  {
    code: 'I69.398',
    description: 'Other sequelae of cerebral infarction',
    category: CONDITION_CATEGORIES.STROKE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['I69.30', 'I63.9'],
  },
  {
    code: 'I67.9',
    description: 'Cerebrovascular disease, unspecified',
    category: CONDITION_CATEGORIES.STROKE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I63.9', 'I67.2'],
  },
  {
    code: 'I67.2',
    description: 'Cerebral atherosclerosis',
    category: CONDITION_CATEGORIES.STROKE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['I67.9', 'I63.9'],
  },

  // ─── Dementia / Alzheimer's ──────────────────────────────────────────
  {
    code: 'G30.9',
    description: 'Alzheimer\'s disease, unspecified',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['G30.0', 'G30.1', 'G30.8', 'F02.80'],
  },
  {
    code: 'G30.0',
    description: 'Alzheimer\'s disease with early onset',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['G30.9', 'G30.1', 'F02.80'],
  },
  {
    code: 'G30.1',
    description: 'Alzheimer\'s disease with late onset',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['G30.9', 'G30.0', 'F02.80'],
  },
  {
    code: 'G30.8',
    description: 'Other Alzheimer\'s disease',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['G30.9', 'F02.80'],
  },
  {
    code: 'F02.80',
    description: 'Dementia in other diseases classified elsewhere without behavioral disturbance',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F02.81', 'G30.9'],
  },
  {
    code: 'F02.81',
    description: 'Dementia in other diseases classified elsewhere with behavioral disturbance',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F02.80', 'G30.9'],
  },
  {
    code: 'F03.90',
    description: 'Unspecified dementia without behavioral disturbance',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['F03.91', 'F02.80'],
  },
  {
    code: 'F03.91',
    description: 'Unspecified dementia with behavioral disturbance',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['F03.90', 'F02.81'],
  },
  {
    code: 'F01.50',
    description: 'Vascular dementia without behavioral disturbance',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F01.51', 'F03.90'],
  },
  {
    code: 'F01.51',
    description: 'Vascular dementia with behavioral disturbance',
    category: CONDITION_CATEGORIES.DEMENTIA,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F01.50', 'F03.91'],
  },

  // ─── Chronic Mental Health Conditions ────────────────────────────────
  {
    code: 'F20.9',
    description: 'Schizophrenia, unspecified',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F20.0', 'F20.1', 'F20.5'],
  },
  {
    code: 'F20.0',
    description: 'Paranoid schizophrenia',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F20.9', 'F20.1'],
  },
  {
    code: 'F20.1',
    description: 'Disorganized schizophrenia',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F20.9', 'F20.0'],
  },
  {
    code: 'F20.5',
    description: 'Residual schizophrenia',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F20.9', 'F20.0'],
  },
  {
    code: 'F25.9',
    description: 'Schizoaffective disorder, unspecified',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F25.0', 'F25.1'],
  },
  {
    code: 'F25.0',
    description: 'Schizoaffective disorder, bipolar type',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F25.9', 'F25.1'],
  },
  {
    code: 'F25.1',
    description: 'Schizoaffective disorder, depressive type',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F25.9', 'F25.0'],
  },
  {
    code: 'F31.9',
    description: 'Bipolar disorder, unspecified',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['F31.10', 'F31.30', 'F31.81'],
  },
  {
    code: 'F31.10',
    description: 'Bipolar disorder, current episode manic without psychotic features, unspecified',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['F31.9', 'F31.30'],
  },
  {
    code: 'F31.30',
    description: 'Bipolar disorder, current episode depressed, mild or moderate severity, unspecified',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['F31.9', 'F31.10'],
  },
  {
    code: 'F31.81',
    description: 'Bipolar II disorder',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['F31.9', 'F31.10'],
  },
  {
    code: 'F33.9',
    description: 'Major depressive disorder, recurrent, unspecified',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 3,
    relatedCodes: ['F33.0', 'F33.1', 'F33.2'],
  },
  {
    code: 'F33.0',
    description: 'Major depressive disorder, recurrent, mild',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 3,
    relatedCodes: ['F33.9', 'F33.1'],
  },
  {
    code: 'F33.1',
    description: 'Major depressive disorder, recurrent, moderate',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 3,
    relatedCodes: ['F33.9', 'F33.2'],
  },
  {
    code: 'F33.2',
    description: 'Major depressive disorder, recurrent severe without psychotic features',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['F33.9', 'F33.3'],
  },
  {
    code: 'F33.3',
    description: 'Major depressive disorder, recurrent, severe with psychotic symptoms',
    category: CONDITION_CATEGORIES.MENTAL_HEALTH,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['F33.2', 'F33.9'],
  },

  // ─── Autoimmune Disorders ────────────────────────────────────────────
  {
    code: 'M05.79',
    description: 'Rheumatoid arthritis with rheumatoid factor of unspecified site',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['M06.9', 'M05.70'],
  },
  {
    code: 'M06.9',
    description: 'Rheumatoid arthritis, unspecified',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['M05.79', 'M06.09'],
  },
  {
    code: 'M06.09',
    description: 'Rheumatoid arthritis without rheumatoid factor, unspecified site',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['M06.9', 'M05.79'],
  },
  {
    code: 'M32.9',
    description: 'Systemic lupus erythematosus, unspecified',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['M32.10', 'M32.14'],
  },
  {
    code: 'M32.10',
    description: 'Systemic lupus erythematosus, organ or system involvement unspecified',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['M32.9', 'M32.14'],
  },
  {
    code: 'M32.14',
    description: 'Glomerular disease in systemic lupus erythematosus',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['M32.9', 'M32.10'],
  },
  {
    code: 'M34.9',
    description: 'Systemic sclerosis, unspecified',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['M34.0', 'M34.1'],
  },
  {
    code: 'M34.0',
    description: 'Progressive systemic sclerosis',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['M34.9', 'M34.1'],
  },
  {
    code: 'M34.1',
    description: 'CR(E)ST syndrome',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['M34.9', 'M34.0'],
  },
  {
    code: 'K50.90',
    description: 'Crohn\'s disease, unspecified, without complications',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['K50.00', 'K50.10'],
  },
  {
    code: 'K50.00',
    description: 'Crohn\'s disease of small intestine without complications',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['K50.90', 'K50.10'],
  },
  {
    code: 'K50.10',
    description: 'Crohn\'s disease of large intestine without complications',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['K50.90', 'K50.00'],
  },
  {
    code: 'K51.90',
    description: 'Ulcerative colitis, unspecified, without complications',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['K51.00', 'K50.90'],
  },
  {
    code: 'K51.00',
    description: 'Ulcerative (chronic) pancolitis without complications',
    category: CONDITION_CATEGORIES.AUTOIMMUNE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['K51.90'],
  },

  // ─── HIV / AIDS ──────────────────────────────────────────────────────
  {
    code: 'B20',
    description: 'Human immunodeficiency virus [HIV] disease',
    category: CONDITION_CATEGORIES.HIV_AIDS,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['Z21'],
  },
  {
    code: 'Z21',
    description: 'Asymptomatic human immunodeficiency virus [HIV] infection status',
    category: CONDITION_CATEGORIES.HIV_AIDS,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['B20'],
  },

  // ─── Cancer ──────────────────────────────────────────────────────────
  {
    code: 'C34.90',
    description: 'Malignant neoplasm of unspecified part of unspecified bronchus or lung',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C34.10', 'C34.30'],
  },
  {
    code: 'C34.10',
    description: 'Malignant neoplasm of upper lobe, unspecified bronchus or lung',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C34.90', 'C34.30'],
  },
  {
    code: 'C34.30',
    description: 'Malignant neoplasm of lower lobe, unspecified bronchus or lung',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C34.90', 'C34.10'],
  },
  {
    code: 'C50.919',
    description: 'Malignant neoplasm of unspecified site of unspecified female breast',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C50.911', 'C50.912'],
  },
  {
    code: 'C50.911',
    description: 'Malignant neoplasm of unspecified site of right female breast',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C50.919', 'C50.912'],
  },
  {
    code: 'C50.912',
    description: 'Malignant neoplasm of unspecified site of left female breast',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C50.919', 'C50.911'],
  },
  {
    code: 'C61',
    description: 'Malignant neoplasm of prostate',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: [],
  },
  {
    code: 'C18.9',
    description: 'Malignant neoplasm of colon, unspecified',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C18.0', 'C18.7'],
  },
  {
    code: 'C18.0',
    description: 'Malignant neoplasm of cecum',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C18.9', 'C18.7'],
  },
  {
    code: 'C18.7',
    description: 'Malignant neoplasm of sigmoid colon',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C18.9', 'C18.0'],
  },
  {
    code: 'C25.9',
    description: 'Malignant neoplasm of pancreas, unspecified',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C25.0', 'C25.1'],
  },
  {
    code: 'C25.0',
    description: 'Malignant neoplasm of head of pancreas',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C25.9', 'C25.1'],
  },
  {
    code: 'C25.1',
    description: 'Malignant neoplasm of body of pancreas',
    category: CONDITION_CATEGORIES.CANCER,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['C25.9', 'C25.0'],
  },

  // ─── Chronic Liver Disease ───────────────────────────────────────────
  {
    code: 'K74.60',
    description: 'Unspecified cirrhosis of liver',
    category: CONDITION_CATEGORIES.LIVER_DISEASE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['K74.69', 'K70.30'],
  },
  {
    code: 'K74.69',
    description: 'Other cirrhosis of liver',
    category: CONDITION_CATEGORIES.LIVER_DISEASE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['K74.60', 'K70.30'],
  },
  {
    code: 'K70.30',
    description: 'Alcoholic cirrhosis of liver without ascites',
    category: CONDITION_CATEGORIES.LIVER_DISEASE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['K70.31', 'K74.60'],
  },
  {
    code: 'K70.31',
    description: 'Alcoholic cirrhosis of liver with ascites',
    category: CONDITION_CATEGORIES.LIVER_DISEASE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['K70.30', 'K74.60'],
  },
  {
    code: 'K76.0',
    description: 'Fatty (change of) liver, not elsewhere classified',
    category: CONDITION_CATEGORIES.LIVER_DISEASE,
    csnpEligible: true,
    priority: 3,
    relatedCodes: ['K74.60', 'K75.81'],
  },
  {
    code: 'K75.81',
    description: 'Nonalcoholic steatohepatitis (NASH)',
    category: CONDITION_CATEGORIES.LIVER_DISEASE,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['K76.0', 'K74.60'],
  },
  {
    code: 'B18.2',
    description: 'Chronic viral hepatitis C',
    category: CONDITION_CATEGORIES.LIVER_DISEASE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['B18.1', 'K74.60'],
  },
  {
    code: 'B18.1',
    description: 'Chronic viral hepatitis B without delta-agent',
    category: CONDITION_CATEGORIES.LIVER_DISEASE,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['B18.2', 'K74.60'],
  },

  // ─── Chronic Respiratory Conditions ──────────────────────────────────
  {
    code: 'J84.10',
    description: 'Pulmonary fibrosis, unspecified',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['J84.112', 'J84.17'],
  },
  {
    code: 'J84.112',
    description: 'Idiopathic pulmonary fibrosis',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['J84.10', 'J84.17'],
  },
  {
    code: 'J84.17',
    description: 'Other interstitial pulmonary diseases with fibrosis in diseases classified elsewhere',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['J84.10', 'J84.112'],
  },
  {
    code: 'J45.50',
    description: 'Severe persistent asthma, uncomplicated',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['J45.51', 'J45.40'],
  },
  {
    code: 'J45.51',
    description: 'Severe persistent asthma with (acute) exacerbation',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['J45.50', 'J45.40'],
  },
  {
    code: 'J45.40',
    description: 'Moderate persistent asthma, uncomplicated',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 3,
    relatedCodes: ['J45.50', 'J45.41'],
  },
  {
    code: 'J45.41',
    description: 'Moderate persistent asthma with (acute) exacerbation',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['J45.40', 'J45.51'],
  },
  {
    code: 'J47.9',
    description: 'Bronchiectasis, uncomplicated',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['J47.0', 'J47.1'],
  },
  {
    code: 'J47.0',
    description: 'Bronchiectasis with acute lower respiratory infection',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['J47.9', 'J47.1'],
  },
  {
    code: 'J47.1',
    description: 'Bronchiectasis with (acute) exacerbation',
    category: CONDITION_CATEGORIES.RESPIRATORY,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['J47.9', 'J47.0'],
  },

  // ─── Neurological Conditions ─────────────────────────────────────────
  {
    code: 'G35',
    description: 'Multiple sclerosis',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 1,
    relatedCodes: [],
  },
  {
    code: 'G20',
    description: 'Parkinson\'s disease',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['G21.9'],
  },
  {
    code: 'G21.9',
    description: 'Secondary parkinsonism, unspecified',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['G20'],
  },
  {
    code: 'G40.909',
    description: 'Epilepsy, unspecified, not intractable, without status epilepticus',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['G40.919', 'G40.309'],
  },
  {
    code: 'G40.919',
    description: 'Epilepsy, unspecified, intractable, without status epilepticus',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['G40.909', 'G40.309'],
  },
  {
    code: 'G40.309',
    description: 'Generalized idiopathic epilepsy and epileptic syndromes, not intractable, without status epilepticus',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['G40.909', 'G40.919'],
  },
  {
    code: 'G12.21',
    description: 'Amyotrophic lateral sclerosis',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['G12.9'],
  },
  {
    code: 'G12.9',
    description: 'Spinal muscular atrophy, unspecified',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['G12.21'],
  },
  {
    code: 'G10',
    description: 'Huntington\'s disease',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 1,
    relatedCodes: [],
  },
  {
    code: 'G71.0',
    description: 'Muscular dystrophy',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 1,
    relatedCodes: ['G71.9'],
  },
  {
    code: 'G71.9',
    description: 'Primary disorder of muscle, unspecified',
    category: CONDITION_CATEGORIES.NEUROLOGICAL,
    csnpEligible: true,
    priority: 2,
    relatedCodes: ['G71.0'],
  },
]);

/**
 * Lookup map for quick access to ICD-10 codes by code string.
 * @type {Object.<string, ICD10Code>}
 */
export const ICD10_CODE_MAP = Object.freeze(
  ICD10_CODES.reduce((map, entry) => {
    map[entry.code] = entry;
    return map;
  }, {})
);

/**
 * Returns all ICD-10 codes that are eligible for C-SNP enrollment.
 * @returns {ICD10Code[]}
 */
export function getCSNPEligibleCodes() {
  return ICD10_CODES.filter((entry) => entry.csnpEligible);
}

/**
 * Returns all ICD-10 codes for a given condition category.
 * @param {string} category - A value from CONDITION_CATEGORIES
 * @returns {ICD10Code[]}
 */
export function getCodesByCategory(category) {
  return ICD10_CODES.filter((entry) => entry.category === category);
}

/**
 * Returns all CSNP-eligible ICD-10 codes for a given condition category,
 * sorted by priority (ascending — 1 is highest).
 * @param {string} category - A value from CONDITION_CATEGORIES
 * @returns {ICD10Code[]}
 */
export function getEligibleCodesByCategory(category) {
  return ICD10_CODES
    .filter((entry) => entry.category === category && entry.csnpEligible)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Looks up a single ICD-10 code entry by its code string.
 * @param {string} code - The ICD-10-CM code (e.g., 'E11.9')
 * @returns {ICD10Code|undefined}
 */
export function getCodeByICD10(code) {
  return ICD10_CODE_MAP[code];
}

/**
 * Checks whether a given ICD-10 code qualifies for C-SNP eligibility.
 * @param {string} code - The ICD-10-CM code
 * @returns {boolean}
 */
export function isCSNPEligible(code) {
  const entry = ICD10_CODE_MAP[code];
  return entry ? entry.csnpEligible : false;
}

/**
 * Searches ICD-10 codes by description or code string (case-insensitive).
 * @param {string} query - Search term
 * @returns {ICD10Code[]}
 */
export function searchICD10Codes(query) {
  if (!query || typeof query !== 'string') {
    return [];
  }
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return [];
  }
  return ICD10_CODES.filter(
    (entry) =>
      entry.code.toLowerCase().includes(normalizedQuery) ||
      entry.description.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Returns all unique condition categories that have at least one CSNP-eligible code.
 * @returns {string[]}
 */
export function getEligibleCategories() {
  const categories = new Set(
    ICD10_CODES
      .filter((entry) => entry.csnpEligible)
      .map((entry) => entry.category)
  );
  return [...categories];
}

/**
 * Returns related ICD-10 code entries for a given code.
 * @param {string} code - The ICD-10-CM code
 * @returns {ICD10Code[]}
 */
export function getRelatedCodes(code) {
  const entry = ICD10_CODE_MAP[code];
  if (!entry) {
    return [];
  }
  return entry.relatedCodes
    .map((relatedCode) => ICD10_CODE_MAP[relatedCode])
    .filter(Boolean);
}