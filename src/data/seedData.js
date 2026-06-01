/**
 * Seed/mock data for all modules.
 * Loaded into localStorage on first app launch.
 * @module seedData
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PLAN_TYPES,
  ENROLLMENT_CHANNELS,
  ENROLLMENT_STATUSES,
  CLAIM_STATUSES,
  USER_ROLES,
  MEDICARE_PARTS,
  AUDIT_ACTIONS,
  REFERRAL_STATUSES,
  CARE_MANAGEMENT_EVENTS,
  STORAGE_KEYS,
} from '../utils/constants.js';
import { CONDITION_CATEGORIES } from './icd10Data.js';

// ─── Fixed UUIDs for referential integrity ─────────────────────────────────

const MEMBER_IDS = Object.freeze({
  MEMBER_1: '10a1b2c3-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
  MEMBER_2: '20b2c3d4-e5f6-4a7b-9c8d-0e1f2a3b4c5d',
  MEMBER_3: '30c3d4e5-f6a7-4b8c-0d9e-1f2a3b4c5d6e',
  MEMBER_4: '40d4e5f6-a7b8-4c9d-1e0f-2a3b4c5d6e7f',
  MEMBER_5: '50e5f6a7-b8c9-4d0e-2f1a-3b4c5d6e7f8a',
  MEMBER_6: '60f6a7b8-c9d0-4e1f-3a2b-4c5d6e7f8a9b',
  MEMBER_7: '70a7b8c9-d0e1-4f2a-4b3c-5d6e7f8a9b0c',
  MEMBER_8: '80b8c9d0-e1f2-4a3b-5c4d-6e7f8a9b0c1d',
});

const PROVIDER_IDS = Object.freeze({
  PROVIDER_1: 'p1a1b2c3-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
  PROVIDER_2: 'p2b2c3d4-e5f6-4a7b-9c8d-0e1f2a3b4c5d',
  PROVIDER_3: 'p3c3d4e5-f6a7-4b8c-0d9e-1f2a3b4c5d6e',
  PROVIDER_4: 'p4d4e5f6-a7b8-4c9d-1e0f-2a3b4c5d6e7f',
  PROVIDER_5: 'p5e5f6a7-b8c9-4d0e-2f1a-3b4c5d6e7f8a',
  PROVIDER_6: 'p6f6a7b8-c9d0-4e1f-3a2b-4c5d6e7f8a9b',
});

const BENEFIT_PACKAGE_IDS = Object.freeze({
  PKG_1: 'bp1a1b2c-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
  PKG_2: 'bp2b2c3d-e5f6-4a7b-9c8d-0e1f2a3b4c5d',
  PKG_3: 'bp3c3d4e-f6a7-4b8c-0d9e-1f2a3b4c5d6e',
});

const ENROLLMENT_IDS = Object.freeze({
  ENROLL_1: 'en1a1b2c-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
  ENROLL_2: 'en2b2c3d-e5f6-4a7b-9c8d-0e1f2a3b4c5d',
  ENROLL_3: 'en3c3d4e-f6a7-4b8c-0d9e-1f2a3b4c5d6e',
  ENROLL_4: 'en4d4e5f-a7b8-4c9d-1e0f-2a3b4c5d6e7f',
  ENROLL_5: 'en5e5f6a-b8c9-4d0e-2f1a-3b4c5d6e7f8a',
  ENROLL_6: 'en6f6a7b-c9d0-4e1f-3a2b-4c5d6e7f8a9b',
  ENROLL_7: 'en7a7b8c-d0e1-4f2a-4b3c-5d6e7f8a9b0c',
  ENROLL_8: 'en8b8c9d-e1f2-4a3b-5c4d-6e7f8a9b0c1d',
});

const CLAIM_IDS = Object.freeze({
  CLAIM_1: 'cl1a1b2c-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
  CLAIM_2: 'cl2b2c3d-e5f6-4a7b-9c8d-0e1f2a3b4c5d',
  CLAIM_3: 'cl3c3d4e-f6a7-4b8c-0d9e-1f2a3b4c5d6e',
  CLAIM_4: 'cl4d4e5f-a7b8-4c9d-1e0f-2a3b4c5d6e7f',
  CLAIM_5: 'cl5e5f6a-b8c9-4d0e-2f1a-3b4c5d6e7f8a',
  CLAIM_6: 'cl6f6a7b-c9d0-4e1f-3a2b-4c5d6e7f8a9b',
  CLAIM_7: 'cl7a7b8c-d0e1-4f2a-4b3c-5d6e7f8a9b0c',
  CLAIM_8: 'cl8b8c9d-e1f2-4a3b-5c4d-6e7f8a9b0c1d',
  CLAIM_9: 'cl9c9d0e-f2a3-4b4c-6d5e-7f8a9b0c1d2e',
  CLAIM_10: 'cla0d1e2-a3b4-4c5d-7e6f-8a9b0c1d2e3f',
});

const CARE_EVENT_IDS = Object.freeze({
  EVENT_1: 'ce1a1b2c-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
  EVENT_2: 'ce2b2c3d-e5f6-4a7b-9c8d-0e1f2a3b4c5d',
  EVENT_3: 'ce3c3d4e-f6a7-4b8c-0d9e-1f2a3b4c5d6e',
  EVENT_4: 'ce4d4e5f-a7b8-4c9d-1e0f-2a3b4c5d6e7f',
  EVENT_5: 'ce5e5f6a-b8c9-4d0e-2f1a-3b4c5d6e7f8a',
  EVENT_6: 'ce6f6a7b-c9d0-4e1f-3a2b-4c5d6e7f8a9b',
  EVENT_7: 'ce7a7b8c-d0e1-4f2a-4b3c-5d6e7f8a9b0c',
  EVENT_8: 'ce8b8c9d-e1f2-4a3b-5c4d-6e7f8a9b0c1d',
  EVENT_9: 'ce9c9d0e-f2a3-4b4c-6d5e-7f8a9b0c1d2e',
  EVENT_10: 'cea0d1e2-a3b4-4c5d-7e6f-8a9b0c1d2e3f',
});

const USER_IDS = Object.freeze({
  ADMIN: 'us1a1b2c-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
  CARE_MANAGER_1: 'us2b2c3d-e5f6-4a7b-9c8d-0e1f2a3b4c5d',
  CARE_MANAGER_2: 'us3c3d4e-f6a7-4b8c-0d9e-1f2a3b4c5d6e',
  CLAIMS_PROCESSOR: 'us4d4e5f-a7b8-4c9d-1e0f-2a3b4c5d6e7f',
  ENROLLMENT_SPEC: 'us5e5f6a-b8c9-4d0e-2f1a-3b4c5d6e7f8a',
  AUDITOR: 'us6f6a7b-c9d0-4e1f-3a2b-4c5d6e7f8a9b',
  MEMBER_1: 'us7a7b8c-d0e1-4f2a-4b3c-5d6e7f8a9b0c',
  MEMBER_2: 'us8b8c9d-e1f2-4a3b-5c4d-6e7f8a9b0c1d',
});

// ─── Members ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SeedMember
 * @property {string} id - Unique member identifier
 * @property {string} firstName - First name
 * @property {string} lastName - Last name
 * @property {string} dateOfBirth - Date of birth (YYYY-MM-DD)
 * @property {string} ssn - Social Security Number (masked format XXX-XX-XXXX)
 * @property {string} ccid - CMS Contract/Component ID
 * @property {string} appin - Application Identification Number
 * @property {string} medicareId - Medicare Beneficiary Identifier
 * @property {string} gender - Gender
 * @property {string} email - Email address
 * @property {string} phone - Phone number
 * @property {Object} address - Mailing address
 * @property {string[]} diagnosisCodes - ICD-10 diagnosis codes
 * @property {string} conditionCategory - Primary condition category
 * @property {string} primaryProviderId - Primary care provider ID
 * @property {string} benefitPackageId - Assigned benefit package ID
 * @property {string[]} medicareParts - Enrolled Medicare parts
 * @property {boolean} csnpEligible - CSNP eligibility flag
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/** @type {SeedMember[]} */
export const SEED_MEMBERS = Object.freeze([
  {
    id: MEMBER_IDS.MEMBER_1,
    firstName: 'Margaret',
    lastName: 'Thompson',
    dateOfBirth: '1948-03-15',
    ssn: '***-**-4521',
    ccid: 'H1234-001',
    appin: 'APP-2024-00001',
    medicareId: '1EG4-TE5-MK72',
    gender: 'Female',
    email: 'margaret.thompson@example.com',
    phone: '(555) 123-4567',
    address: {
      street: '1234 Oak Lane',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
    },
    diagnosisCodes: ['E11.9', 'E11.65', 'I10'],
    conditionCategory: CONDITION_CATEGORIES.DIABETES,
    vccAttestation: { status: 'completed', completedDate: '2024-05-01', attestedBy: 'Dr. Sarah Chen' },
    primaryProviderId: PROVIDER_IDS.PROVIDER_1,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_1,
    medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C, MEDICARE_PARTS.PART_D],
    csnpEligible: true,
    createdAt: '2024-01-10T08:30:00.000Z',
    updatedAt: '2024-06-15T14:22:00.000Z',
  },
  {
    id: MEMBER_IDS.MEMBER_2,
    firstName: 'Robert',
    lastName: 'Garcia',
    dateOfBirth: '1952-07-22',
    ssn: '***-**-8834',
    ccid: 'H1234-001',
    appin: 'APP-2024-00002',
    medicareId: '2FH5-UF6-NL83',
    gender: 'Male',
    email: 'robert.garcia@example.com',
    phone: '(555) 234-5678',
    address: {
      street: '5678 Maple Drive',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
    },
    diagnosisCodes: ['I50.22', 'I50.9', 'I25.10'],
    conditionCategory: CONDITION_CATEGORIES.HEART_FAILURE,
    vccAttestation: { status: 'in_progress', completedDate: null, attestedBy: null },
    primaryProviderId: PROVIDER_IDS.PROVIDER_2,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_1,
    medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C, MEDICARE_PARTS.PART_D],
    csnpEligible: true,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-07-01T09:15:00.000Z',
  },
  {
    id: MEMBER_IDS.MEMBER_3,
    firstName: 'Dorothy',
    lastName: 'Williams',
    dateOfBirth: '1945-11-08',
    ssn: '***-**-2267',
    ccid: 'H1234-002',
    appin: 'APP-2024-00003',
    medicareId: '3GI6-VG7-OM94',
    gender: 'Female',
    email: 'dorothy.williams@example.com',
    phone: '(555) 345-6789',
    address: {
      street: '910 Elm Street',
      city: 'Peoria',
      state: 'IL',
      zipCode: '61602',
    },
    diagnosisCodes: ['J44.1', 'J44.9', 'J43.9'],
    conditionCategory: CONDITION_CATEGORIES.COPD,
    primaryProviderId: PROVIDER_IDS.PROVIDER_3,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_2,
    medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C],
    csnpEligible: true,
    createdAt: '2024-02-01T11:30:00.000Z',
    updatedAt: '2024-05-20T16:45:00.000Z',
  },
  {
    id: MEMBER_IDS.MEMBER_4,
    firstName: 'James',
    lastName: 'Anderson',
    dateOfBirth: '1950-05-30',
    ssn: '***-**-9912',
    ccid: 'H1234-002',
    appin: 'APP-2024-00004',
    medicareId: '4HJ7-WH8-PN05',
    gender: 'Male',
    email: 'james.anderson@example.com',
    phone: '(555) 456-7890',
    address: {
      street: '2345 Pine Avenue',
      city: 'Rockford',
      state: 'IL',
      zipCode: '61101',
    },
    diagnosisCodes: ['N18.4', 'N18.5', 'E11.22'],
    conditionCategory: CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
    primaryProviderId: PROVIDER_IDS.PROVIDER_4,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_2,
    medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C, MEDICARE_PARTS.PART_D],
    csnpEligible: true,
    createdAt: '2024-02-10T09:00:00.000Z',
    updatedAt: '2024-08-01T11:30:00.000Z',
  },
  {
    id: MEMBER_IDS.MEMBER_5,
    firstName: 'Patricia',
    lastName: 'Martinez',
    dateOfBirth: '1955-09-12',
    ssn: '***-**-5543',
    ccid: 'H1234-001',
    appin: 'APP-2024-00005',
    medicareId: '5IK8-XI9-QO16',
    gender: 'Female',
    email: 'patricia.martinez@example.com',
    phone: '(555) 567-8901',
    address: {
      street: '6789 Birch Road',
      city: 'Naperville',
      state: 'IL',
      zipCode: '60540',
    },
    diagnosisCodes: ['G30.1', 'F02.80'],
    conditionCategory: CONDITION_CATEGORIES.DEMENTIA,
    primaryProviderId: PROVIDER_IDS.PROVIDER_5,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_3,
    medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C, MEDICARE_PARTS.PART_D],
    csnpEligible: true,
    createdAt: '2024-03-01T13:00:00.000Z',
    updatedAt: '2024-07-15T10:00:00.000Z',
  },
  {
    id: MEMBER_IDS.MEMBER_6,
    firstName: 'William',
    lastName: 'Johnson',
    dateOfBirth: '1947-01-25',
    ssn: '***-**-7789',
    ccid: 'H1234-002',
    appin: 'APP-2024-00006',
    medicareId: '6JL9-YJ0-RP27',
    gender: 'Male',
    email: 'william.johnson@example.com',
    phone: '(555) 678-9012',
    address: {
      street: '3456 Cedar Court',
      city: 'Evanston',
      state: 'IL',
      zipCode: '60201',
    },
    diagnosisCodes: ['N18.6', 'Z99.2', 'I12.0'],
    conditionCategory: CONDITION_CATEGORIES.ESRD,
    primaryProviderId: PROVIDER_IDS.PROVIDER_4,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_1,
    medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C, MEDICARE_PARTS.PART_D],
    csnpEligible: true,
    createdAt: '2024-03-15T08:00:00.000Z',
    updatedAt: '2024-08-10T15:30:00.000Z',
  },
  {
    id: MEMBER_IDS.MEMBER_7,
    firstName: 'Linda',
    lastName: 'Davis',
    dateOfBirth: '1958-12-03',
    ssn: '***-**-3356',
    ccid: 'H1234-001',
    appin: 'APP-2024-00007',
    medicareId: '7KM0-ZK1-SQ38',
    gender: 'Female',
    email: 'linda.davis@example.com',
    phone: '(555) 789-0123',
    address: {
      street: '7890 Walnut Boulevard',
      city: 'Aurora',
      state: 'IL',
      zipCode: '60502',
    },
    diagnosisCodes: ['M32.9', 'M32.10'],
    conditionCategory: CONDITION_CATEGORIES.AUTOIMMUNE,
    primaryProviderId: PROVIDER_IDS.PROVIDER_6,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_3,
    medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C],
    csnpEligible: true,
    createdAt: '2024-04-01T10:30:00.000Z',
    updatedAt: '2024-07-20T12:00:00.000Z',
  },
  {
    id: MEMBER_IDS.MEMBER_8,
    firstName: 'Richard',
    lastName: 'Brown',
    dateOfBirth: '1943-06-18',
    ssn: '***-**-6678',
    ccid: 'H1234-002',
    appin: 'APP-2024-00008',
    medicareId: '8LN1-AL2-TR49',
    gender: 'Male',
    email: 'richard.brown@example.com',
    phone: '(555) 890-1234',
    address: {
      street: '4567 Ash Way',
      city: 'Joliet',
      state: 'IL',
      zipCode: '60431',
    },
    diagnosisCodes: ['C34.90', 'J44.9'],
    conditionCategory: CONDITION_CATEGORIES.CANCER,
    primaryProviderId: PROVIDER_IDS.PROVIDER_3,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_2,
    medicareParts: [MEDICARE_PARTS.PART_A, MEDICARE_PARTS.PART_B, MEDICARE_PARTS.PART_C, MEDICARE_PARTS.PART_D],
    csnpEligible: true,
    createdAt: '2024-04-15T14:00:00.000Z',
    updatedAt: '2024-08-05T09:45:00.000Z',
  },
]);

// ─── Providers ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SeedProvider
 * @property {string} id - Unique provider identifier
 * @property {string} npi - National Provider Identifier
 * @property {string} firstName - First name
 * @property {string} lastName - Last name
 * @property {string} specialty - Medical specialty
 * @property {string} facilityName - Practice/facility name
 * @property {string} email - Email address
 * @property {string} phone - Phone number
 * @property {Object} address - Practice address
 * @property {Object} contract - Contract details
 * @property {boolean} acceptingNewPatients - Whether accepting new patients
 * @property {string[]} conditionCategories - Condition categories treated
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/** @type {SeedProvider[]} */
export const SEED_PROVIDERS = Object.freeze([
  {
    id: PROVIDER_IDS.PROVIDER_1,
    npi: '1234567890',
    firstName: 'Sarah',
    lastName: 'Chen',
    specialty: 'Endocrinology',
    facilityName: 'Springfield Diabetes & Endocrine Center',
    email: 'dr.chen@springfieldendo.example.com',
    phone: '(555) 111-2222',
    address: {
      street: '100 Medical Plaza',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62702',
    },
    contract: {
      contractId: 'CTR-2024-001',
      effectiveDate: '2024-01-01',
      terminationDate: '2025-12-31',
      contractType: 'In-Network',
      reimbursementRate: 'Fee-for-Service',
      status: 'active',
    },
    acceptingNewPatients: true,
    conditionCategories: [CONDITION_CATEGORIES.DIABETES],
    createdAt: '2023-11-01T08:00:00.000Z',
    updatedAt: '2024-06-01T10:00:00.000Z',
  },
  {
    id: PROVIDER_IDS.PROVIDER_2,
    npi: '2345678901',
    firstName: 'Michael',
    lastName: 'Patel',
    specialty: 'Cardiology',
    facilityName: 'Chicago Heart & Vascular Institute',
    email: 'dr.patel@chicagoheart.example.com',
    phone: '(555) 222-3333',
    address: {
      street: '200 Cardiac Drive',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60602',
    },
    contract: {
      contractId: 'CTR-2024-002',
      effectiveDate: '2024-01-01',
      terminationDate: '2025-12-31',
      contractType: 'In-Network',
      reimbursementRate: 'Capitated',
      status: 'active',
    },
    acceptingNewPatients: true,
    conditionCategories: [CONDITION_CATEGORIES.HEART_FAILURE, CONDITION_CATEGORIES.CARDIOVASCULAR],
    createdAt: '2023-11-01T08:00:00.000Z',
    updatedAt: '2024-05-15T14:30:00.000Z',
  },
  {
    id: PROVIDER_IDS.PROVIDER_3,
    npi: '3456789012',
    firstName: 'Emily',
    lastName: 'Rodriguez',
    specialty: 'Pulmonology',
    facilityName: 'Central Illinois Pulmonary Associates',
    email: 'dr.rodriguez@cilpulm.example.com',
    phone: '(555) 333-4444',
    address: {
      street: '300 Respiratory Lane',
      city: 'Peoria',
      state: 'IL',
      zipCode: '61603',
    },
    contract: {
      contractId: 'CTR-2024-003',
      effectiveDate: '2024-01-01',
      terminationDate: '2025-12-31',
      contractType: 'In-Network',
      reimbursementRate: 'Fee-for-Service',
      status: 'active',
    },
    acceptingNewPatients: true,
    conditionCategories: [CONDITION_CATEGORIES.COPD, CONDITION_CATEGORIES.RESPIRATORY],
    createdAt: '2023-11-15T09:00:00.000Z',
    updatedAt: '2024-04-20T11:00:00.000Z',
  },
  {
    id: PROVIDER_IDS.PROVIDER_4,
    npi: '4567890123',
    firstName: 'David',
    lastName: 'Kim',
    specialty: 'Nephrology',
    facilityName: 'Rockford Kidney Care Center',
    email: 'dr.kim@rockfordkidney.example.com',
    phone: '(555) 444-5555',
    address: {
      street: '400 Renal Way',
      city: 'Rockford',
      state: 'IL',
      zipCode: '61102',
    },
    contract: {
      contractId: 'CTR-2024-004',
      effectiveDate: '2024-01-01',
      terminationDate: '2025-12-31',
      contractType: 'In-Network',
      reimbursementRate: 'Capitated',
      status: 'active',
    },
    acceptingNewPatients: false,
    conditionCategories: [CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE, CONDITION_CATEGORIES.ESRD],
    createdAt: '2023-12-01T10:00:00.000Z',
    updatedAt: '2024-07-10T08:30:00.000Z',
  },
  {
    id: PROVIDER_IDS.PROVIDER_5,
    npi: '5678901234',
    firstName: 'Jennifer',
    lastName: 'Walsh',
    specialty: 'Neurology',
    facilityName: 'Naperville Neuroscience Group',
    email: 'dr.walsh@naperneuro.example.com',
    phone: '(555) 555-6666',
    address: {
      street: '500 Brain Health Blvd',
      city: 'Naperville',
      state: 'IL',
      zipCode: '60541',
    },
    contract: {
      contractId: 'CTR-2024-005',
      effectiveDate: '2024-02-01',
      terminationDate: '2026-01-31',
      contractType: 'In-Network',
      reimbursementRate: 'Fee-for-Service',
      status: 'active',
    },
    acceptingNewPatients: true,
    conditionCategories: [CONDITION_CATEGORIES.DEMENTIA, CONDITION_CATEGORIES.NEUROLOGICAL],
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt: '2024-06-30T16:00:00.000Z',
  },
  {
    id: PROVIDER_IDS.PROVIDER_6,
    npi: '6789012345',
    firstName: 'Anthony',
    lastName: 'Nguyen',
    specialty: 'Rheumatology',
    facilityName: 'Aurora Rheumatology & Autoimmune Clinic',
    email: 'dr.nguyen@aurorarheum.example.com',
    phone: '(555) 666-7777',
    address: {
      street: '600 Immune Drive',
      city: 'Aurora',
      state: 'IL',
      zipCode: '60503',
    },
    contract: {
      contractId: 'CTR-2024-006',
      effectiveDate: '2024-01-01',
      terminationDate: '2025-12-31',
      contractType: 'In-Network',
      reimbursementRate: 'Fee-for-Service',
      status: 'active',
    },
    acceptingNewPatients: true,
    conditionCategories: [CONDITION_CATEGORIES.AUTOIMMUNE],
    createdAt: '2024-01-15T09:30:00.000Z',
    updatedAt: '2024-05-01T13:00:00.000Z',
  },
]);

// ─── Benefit Packages ───────────────────────────────────────────────────────

/**
 * @typedef {Object} SeedBenefitPackage
 * @property {string} id - Unique benefit package identifier
 * @property {string} name - Package name
 * @property {string} planType - Plan type from PLAN_TYPES
 * @property {string} description - Package description
 * @property {string} effectiveDate - Effective date (YYYY-MM-DD)
 * @property {string} terminationDate - Termination date (YYYY-MM-DD)
 * @property {Object} benefits - Benefit details
 * @property {string[]} eligibleConditionCategories - Eligible condition categories
 * @property {number} monthlyPremium - Monthly premium amount
 * @property {number} annualDeductible - Annual deductible amount
 * @property {number} maxOutOfPocket - Maximum out-of-pocket amount
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/** @type {SeedBenefitPackage[]} */
export const SEED_BENEFIT_PACKAGES = Object.freeze([
  {
    id: BENEFIT_PACKAGE_IDS.PKG_1,
    name: 'CSNP Comprehensive Care Plan',
    planType: PLAN_TYPES.C_SNP,
    description: 'Comprehensive C-SNP plan covering diabetes, heart failure, cardiovascular, and ESRD conditions with enhanced care coordination.',
    effectiveDate: '2024-01-01',
    terminationDate: '2024-12-31',
    benefits: {
      primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay for PCP visits' },
      specialistVisit: { copay: 20, coinsurance: 0, description: '$20 copay for specialist visits' },
      emergencyRoom: { copay: 90, coinsurance: 0, description: '$90 copay (waived if admitted)' },
      inpatientHospital: { copay: 250, coinsurance: 0, description: '$250/day for days 1-5' },
      prescriptionDrugTier1: { copay: 0, coinsurance: 0, description: '$0 copay for Tier 1 generics' },
      prescriptionDrugTier2: { copay: 10, coinsurance: 0, description: '$10 copay for Tier 2 preferred generics' },
      prescriptionDrugTier3: { copay: 42, coinsurance: 0, description: '$42 copay for Tier 3 preferred brands' },
      diabetesSupplies: { copay: 0, coinsurance: 0, description: '$0 copay for diabetes testing supplies' },
      dialysis: { copay: 0, coinsurance: 20, description: '20% coinsurance for dialysis services' },
      cardiacRehab: { copay: 20, coinsurance: 0, description: '$20 copay per session' },
      homeHealth: { copay: 0, coinsurance: 0, description: '$0 copay for home health services' },
      telehealth: { copay: 0, coinsurance: 0, description: '$0 copay for telehealth visits' },
    },
    eligibleConditionCategories: [
      CONDITION_CATEGORIES.DIABETES,
      CONDITION_CATEGORIES.HEART_FAILURE,
      CONDITION_CATEGORIES.CARDIOVASCULAR,
      CONDITION_CATEGORIES.ESRD,
    ],
    monthlyPremium: 0,
    annualDeductible: 0,
    maxOutOfPocket: 3400,
    createdAt: '2023-10-01T08:00:00.000Z',
    updatedAt: '2023-12-15T10:00:00.000Z',
  },
  {
    id: BENEFIT_PACKAGE_IDS.PKG_2,
    name: 'CSNP Respiratory & Renal Plan',
    planType: PLAN_TYPES.C_SNP,
    description: 'C-SNP plan tailored for members with COPD, chronic respiratory conditions, chronic kidney disease, and cancer.',
    effectiveDate: '2024-01-01',
    terminationDate: '2024-12-31',
    benefits: {
      primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay for PCP visits' },
      specialistVisit: { copay: 25, coinsurance: 0, description: '$25 copay for specialist visits' },
      emergencyRoom: { copay: 90, coinsurance: 0, description: '$90 copay (waived if admitted)' },
      inpatientHospital: { copay: 275, coinsurance: 0, description: '$275/day for days 1-5' },
      prescriptionDrugTier1: { copay: 0, coinsurance: 0, description: '$0 copay for Tier 1 generics' },
      prescriptionDrugTier2: { copay: 12, coinsurance: 0, description: '$12 copay for Tier 2 preferred generics' },
      prescriptionDrugTier3: { copay: 47, coinsurance: 0, description: '$47 copay for Tier 3 preferred brands' },
      pulmonaryRehab: { copay: 20, coinsurance: 0, description: '$20 copay per session' },
      oxygenEquipment: { copay: 0, coinsurance: 20, description: '20% coinsurance for oxygen equipment' },
      chemotherapy: { copay: 0, coinsurance: 20, description: '20% coinsurance for chemotherapy' },
      homeHealth: { copay: 0, coinsurance: 0, description: '$0 copay for home health services' },
      telehealth: { copay: 0, coinsurance: 0, description: '$0 copay for telehealth visits' },
    },
    eligibleConditionCategories: [
      CONDITION_CATEGORIES.COPD,
      CONDITION_CATEGORIES.RESPIRATORY,
      CONDITION_CATEGORIES.CHRONIC_KIDNEY_DISEASE,
      CONDITION_CATEGORIES.CANCER,
    ],
    monthlyPremium: 15,
    annualDeductible: 0,
    maxOutOfPocket: 3900,
    createdAt: '2023-10-01T08:00:00.000Z',
    updatedAt: '2023-12-15T10:00:00.000Z',
  },
  {
    id: BENEFIT_PACKAGE_IDS.PKG_3,
    name: 'CSNP Neuro & Autoimmune Plan',
    planType: PLAN_TYPES.C_SNP,
    description: 'C-SNP plan designed for members with dementia, neurological conditions, autoimmune disorders, and mental health conditions.',
    effectiveDate: '2024-01-01',
    terminationDate: '2024-12-31',
    benefits: {
      primaryCare: { copay: 0, coinsurance: 0, description: '$0 copay for PCP visits' },
      specialistVisit: { copay: 15, coinsurance: 0, description: '$15 copay for specialist visits' },
      emergencyRoom: { copay: 90, coinsurance: 0, description: '$90 copay (waived if admitted)' },
      inpatientHospital: { copay: 225, coinsurance: 0, description: '$225/day for days 1-5' },
      prescriptionDrugTier1: { copay: 0, coinsurance: 0, description: '$0 copay for Tier 1 generics' },
      prescriptionDrugTier2: { copay: 8, coinsurance: 0, description: '$8 copay for Tier 2 preferred generics' },
      prescriptionDrugTier3: { copay: 40, coinsurance: 0, description: '$40 copay for Tier 3 preferred brands' },
      mentalHealth: { copay: 0, coinsurance: 0, description: '$0 copay for outpatient mental health visits' },
      occupationalTherapy: { copay: 20, coinsurance: 0, description: '$20 copay per session' },
      speechTherapy: { copay: 20, coinsurance: 0, description: '$20 copay per session' },
      homeHealth: { copay: 0, coinsurance: 0, description: '$0 copay for home health services' },
      telehealth: { copay: 0, coinsurance: 0, description: '$0 copay for telehealth visits' },
      adultDayCare: { copay: 0, coinsurance: 0, description: '$0 copay for adult day care services' },
    },
    eligibleConditionCategories: [
      CONDITION_CATEGORIES.DEMENTIA,
      CONDITION_CATEGORIES.NEUROLOGICAL,
      CONDITION_CATEGORIES.AUTOIMMUNE,
      CONDITION_CATEGORIES.MENTAL_HEALTH,
    ],
    monthlyPremium: 0,
    annualDeductible: 0,
    maxOutOfPocket: 3200,
    createdAt: '2023-10-01T08:00:00.000Z',
    updatedAt: '2023-12-15T10:00:00.000Z',
  },
]);

// ─── Enrollment Records ─────────────────────────────────────────────────────

/**
 * @typedef {Object} SeedEnrollment
 * @property {string} id - Unique enrollment identifier
 * @property {string} memberId - Member ID
 * @property {string} benefitPackageId - Benefit package ID
 * @property {string} planType - Plan type
 * @property {string} status - Enrollment status
 * @property {string} channel - Enrollment channel
 * @property {string} effectiveDate - Effective date (YYYY-MM-DD)
 * @property {string|null} terminationDate - Termination date or null
 * @property {string} applicationDate - Application date (YYYY-MM-DD)
 * @property {string|null} approvalDate - Approval date or null
 * @property {string} processedBy - User ID who processed enrollment
 * @property {string[]} diagnosisCodesVerified - Verified ICD-10 codes
 * @property {string} notes - Enrollment notes
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/** @type {SeedEnrollment[]} */
export const SEED_ENROLLMENTS = Object.freeze([
  {
    id: ENROLLMENT_IDS.ENROLL_1,
    memberId: MEMBER_IDS.MEMBER_1,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_1,
    planType: PLAN_TYPES.C_SNP,
    status: ENROLLMENT_STATUSES.ACTIVE,
    channel: ENROLLMENT_CHANNELS.ONLINE,
    effectiveDate: '2024-01-01',
    terminationDate: null,
    applicationDate: '2023-11-15',
    approvalDate: '2023-12-01',
    processedBy: USER_IDS.ENROLLMENT_SPEC,
    diagnosisCodesVerified: ['E11.9', 'E11.65'],
    notes: 'Member verified with primary diagnosis of Type 2 diabetes. Eligibility confirmed.',
    createdAt: '2023-11-15T10:00:00.000Z',
    updatedAt: '2023-12-01T14:00:00.000Z',
  },
  {
    id: ENROLLMENT_IDS.ENROLL_2,
    memberId: MEMBER_IDS.MEMBER_2,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_1,
    planType: PLAN_TYPES.C_SNP,
    status: ENROLLMENT_STATUSES.ACTIVE,
    channel: ENROLLMENT_CHANNELS.PHONE,
    effectiveDate: '2024-01-01',
    terminationDate: null,
    applicationDate: '2023-11-20',
    approvalDate: '2023-12-05',
    processedBy: USER_IDS.ENROLLMENT_SPEC,
    diagnosisCodesVerified: ['I50.22', 'I50.9'],
    notes: 'Chronic systolic heart failure confirmed by cardiologist documentation.',
    createdAt: '2023-11-20T11:30:00.000Z',
    updatedAt: '2023-12-05T09:00:00.000Z',
  },
  {
    id: ENROLLMENT_IDS.ENROLL_3,
    memberId: MEMBER_IDS.MEMBER_3,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_2,
    planType: PLAN_TYPES.C_SNP,
    status: ENROLLMENT_STATUSES.ACTIVE,
    channel: ENROLLMENT_CHANNELS.MAIL,
    effectiveDate: '2024-02-01',
    terminationDate: null,
    applicationDate: '2023-12-10',
    approvalDate: '2024-01-05',
    processedBy: USER_IDS.ENROLLMENT_SPEC,
    diagnosisCodesVerified: ['J44.1', 'J44.9'],
    notes: 'COPD with acute exacerbation history. Pulmonologist records verified.',
    createdAt: '2023-12-10T08:00:00.000Z',
    updatedAt: '2024-01-05T16:00:00.000Z',
  },
  {
    id: ENROLLMENT_IDS.ENROLL_4,
    memberId: MEMBER_IDS.MEMBER_4,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_2,
    planType: PLAN_TYPES.C_SNP,
    status: ENROLLMENT_STATUSES.ACTIVE,
    channel: ENROLLMENT_CHANNELS.IN_PERSON,
    effectiveDate: '2024-03-01',
    terminationDate: null,
    applicationDate: '2024-01-15',
    approvalDate: '2024-02-01',
    processedBy: USER_IDS.ENROLLMENT_SPEC,
    diagnosisCodesVerified: ['N18.4', 'N18.5'],
    notes: 'CKD stage 4-5 confirmed. Nephrologist documentation on file.',
    createdAt: '2024-01-15T13:00:00.000Z',
    updatedAt: '2024-02-01T10:30:00.000Z',
  },
  {
    id: ENROLLMENT_IDS.ENROLL_5,
    memberId: MEMBER_IDS.MEMBER_5,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_3,
    planType: PLAN_TYPES.C_SNP,
    status: ENROLLMENT_STATUSES.ACTIVE,
    channel: ENROLLMENT_CHANNELS.BROKER,
    effectiveDate: '2024-04-01',
    terminationDate: null,
    applicationDate: '2024-02-20',
    approvalDate: '2024-03-10',
    processedBy: USER_IDS.ENROLLMENT_SPEC,
    diagnosisCodesVerified: ['G30.1', 'F02.80'],
    notes: 'Late-onset Alzheimer\'s confirmed by neurologist. Caregiver contact on file.',
    createdAt: '2024-02-20T09:00:00.000Z',
    updatedAt: '2024-03-10T11:00:00.000Z',
  },
  {
    id: ENROLLMENT_IDS.ENROLL_6,
    memberId: MEMBER_IDS.MEMBER_6,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_1,
    planType: PLAN_TYPES.C_SNP,
    status: ENROLLMENT_STATUSES.ACTIVE,
    channel: ENROLLMENT_CHANNELS.PHONE,
    effectiveDate: '2024-04-01',
    terminationDate: null,
    applicationDate: '2024-02-25',
    approvalDate: '2024-03-15',
    processedBy: USER_IDS.ENROLLMENT_SPEC,
    diagnosisCodesVerified: ['N18.6', 'Z99.2'],
    notes: 'ESRD with dialysis dependence confirmed. Dialysis center records verified.',
    createdAt: '2024-02-25T14:00:00.000Z',
    updatedAt: '2024-03-15T08:30:00.000Z',
  },
  {
    id: ENROLLMENT_IDS.ENROLL_7,
    memberId: MEMBER_IDS.MEMBER_7,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_3,
    planType: PLAN_TYPES.C_SNP,
    status: ENROLLMENT_STATUSES.APPROVED,
    channel: ENROLLMENT_CHANNELS.ONLINE,
    effectiveDate: '2024-05-01',
    terminationDate: null,
    applicationDate: '2024-03-20',
    approvalDate: '2024-04-05',
    processedBy: USER_IDS.ENROLLMENT_SPEC,
    diagnosisCodesVerified: ['M32.9', 'M32.10'],
    notes: 'Systemic lupus erythematosus confirmed by rheumatologist.',
    createdAt: '2024-03-20T10:00:00.000Z',
    updatedAt: '2024-04-05T15:00:00.000Z',
  },
  {
    id: ENROLLMENT_IDS.ENROLL_8,
    memberId: MEMBER_IDS.MEMBER_8,
    benefitPackageId: BENEFIT_PACKAGE_IDS.PKG_2,
    planType: PLAN_TYPES.C_SNP,
    status: ENROLLMENT_STATUSES.PENDING,
    channel: ENROLLMENT_CHANNELS.MAIL,
    effectiveDate: '2024-06-01',
    terminationDate: null,
    applicationDate: '2024-04-10',
    approvalDate: null,
    processedBy: USER_IDS.ENROLLMENT_SPEC,
    diagnosisCodesVerified: ['C34.90'],
    notes: 'Lung cancer diagnosis pending additional oncology documentation.',
    createdAt: '2024-04-10T11:00:00.000Z',
    updatedAt: '2024-04-10T11:00:00.000Z',
  },
]);

// ─── Claims ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SeedClaim
 * @property {string} id - Unique claim identifier
 * @property {string} claimNumber - Human-readable claim number
 * @property {string} memberId - Member ID
 * @property {string} providerId - Provider ID
 * @property {string} enrollmentId - Enrollment ID
 * @property {string} status - Claim status
 * @property {string} serviceDate - Date of service (YYYY-MM-DD)
 * @property {string} submissionDate - Submission date (YYYY-MM-DD)
 * @property {string[]} diagnosisCodes - ICD-10 diagnosis codes
 * @property {string} serviceDescription - Description of service
 * @property {number} billedAmount - Billed amount
 * @property {number} allowedAmount - Allowed amount
 * @property {number} paidAmount - Paid amount
 * @property {number} memberResponsibility - Member responsibility amount
 * @property {string|null} processedBy - User ID who processed claim
 * @property {string|null} processedDate - Date processed
 * @property {string} notes - Claim notes
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/** @type {SeedClaim[]} */
export const SEED_CLAIMS = Object.freeze([
  {
    id: CLAIM_IDS.CLAIM_1,
    claimNumber: 'CLM-2024-000001',
    memberId: MEMBER_IDS.MEMBER_1,
    providerId: PROVIDER_IDS.PROVIDER_1,
    enrollmentId: ENROLLMENT_IDS.ENROLL_1,
    status: CLAIM_STATUSES.PAID,
    serviceDate: '2024-02-15',
    submissionDate: '2024-02-20',
    diagnosisCodes: ['E11.9', 'E11.65'],
    serviceDescription: 'Endocrinology office visit - diabetes management and A1C review',
    billedAmount: 350.00,
    allowedAmount: 280.00,
    paidAmount: 280.00,
    memberResponsibility: 0,
    processedBy: USER_IDS.CLAIMS_PROCESSOR,
    processedDate: '2024-03-01',
    notes: 'Routine diabetes management visit. A1C at 7.2%. Medication adjustment recommended.',
    createdAt: '2024-02-20T10:00:00.000Z',
    updatedAt: '2024-03-01T14:00:00.000Z',
  },
  {
    id: CLAIM_IDS.CLAIM_2,
    claimNumber: 'CLM-2024-000002',
    memberId: MEMBER_IDS.MEMBER_2,
    providerId: PROVIDER_IDS.PROVIDER_2,
    enrollmentId: ENROLLMENT_IDS.ENROLL_2,
    status: CLAIM_STATUSES.PAID,
    serviceDate: '2024-03-10',
    submissionDate: '2024-03-15',
    diagnosisCodes: ['I50.22', 'I25.10'],
    serviceDescription: 'Cardiology consultation - heart failure follow-up with echocardiogram',
    billedAmount: 875.00,
    allowedAmount: 720.00,
    paidAmount: 700.00,
    memberResponsibility: 20.00,
    processedBy: USER_IDS.CLAIMS_PROCESSOR,
    processedDate: '2024-03-25',
    notes: 'Echocardiogram shows stable EF at 35%. Continued medical management.',
    createdAt: '2024-03-15T09:00:00.000Z',
    updatedAt: '2024-03-25T11:00:00.000Z',
  },
  {
    id: CLAIM_IDS.CLAIM_3,
    claimNumber: 'CLM-2024-000003',
    memberId: MEMBER_IDS.MEMBER_3,
    providerId: PROVIDER_IDS.PROVIDER_3,
    enrollmentId: ENROLLMENT_IDS.ENROLL_3,
    status: CLAIM_STATUSES.APPROVED,
    serviceDate: '2024-04-05',
    submissionDate: '2024-04-10',
    diagnosisCodes: ['J44.1', 'J44.9'],
    serviceDescription: 'Pulmonology visit - COPD exacerbation management and pulmonary function test',
    billedAmount: 620.00,
    allowedAmount: 510.00,
    paidAmount: 485.00,
    memberResponsibility: 25.00,
    processedBy: USER_IDS.CLAIMS_PROCESSOR,
    processedDate: '2024-04-20',
    notes: 'PFT shows moderate obstruction. Inhaler regimen updated.',
    createdAt: '2024-04-10T08:30:00.000Z',
    updatedAt: '2024-04-20T13:00:00.000Z',
  },
  {
    id: CLAIM_IDS.CLAIM_4,
    claimNumber: 'CLM-2024-000004',
    memberId: MEMBER_IDS.MEMBER_4,
    providerId: PROVIDER_IDS.PROVIDER_4,
    enrollmentId: ENROLLMENT_IDS.ENROLL_4,
    status: CLAIM_STATUSES.PAID,
    serviceDate: '2024-04-20',
    submissionDate: '2024-04-25',
    diagnosisCodes: ['N18.4', 'E11.22'],
    serviceDescription: 'Nephrology visit - CKD stage 4 monitoring with labs',
    billedAmount: 480.00,
    allowedAmount: 395.00,
    paidAmount: 375.00,
    memberResponsibility: 20.00,
    processedBy: USER_IDS.CLAIMS_PROCESSOR,
    processedDate: '2024-05-05',
    notes: 'GFR at 22. Discussed dialysis preparation. Dietitian referral placed.',
    createdAt: '2024-04-25T10:00:00.000Z',
    updatedAt: '2024-05-05T09:30:00.000Z',
  },
  {
    id: CLAIM_IDS.CLAIM_5,
    claimNumber: 'CLM-2024-000005',
    memberId: MEMBER_IDS.MEMBER_5,
    providerId: PROVIDER_IDS.PROVIDER_5,
    enrollmentId: ENROLLMENT_IDS.ENROLL_5,
    status: CLAIM_STATUSES.PAID,
    serviceDate: '2024-05-12',
    submissionDate: '2024-05-17',
    diagnosisCodes: ['G30.1', 'F02.80'],
    serviceDescription: 'Neurology visit - Alzheimer\'s disease assessment and cognitive testing',
    billedAmount: 550.00,
    allowedAmount: 450.00,
    paidAmount: 435.00,
    memberResponsibility: 15.00,
    processedBy: USER_IDS.CLAIMS_PROCESSOR,
    processedDate: '2024-05-28',
    notes: 'MMSE score 18/30. Medication review completed. Caregiver support discussed.',
    createdAt: '2024-05-17T11:00:00.000Z',
    updatedAt: '2024-05-28T14:30:00.000Z',
  },
  {
    id: CLAIM_IDS.CLAIM_6,
    claimNumber: 'CLM-2024-000006',
    memberId: MEMBER_IDS.MEMBER_6,
    providerId: PROVIDER_IDS.PROVIDER_4,
    enrollmentId: ENROLLMENT_IDS.ENROLL_6,
    status: CLAIM_STATUSES.IN_REVIEW,
    serviceDate: '2024-06-01',
    submissionDate: '2024-06-05',
    diagnosisCodes: ['N18.6', 'Z99.2'],
    serviceDescription: 'Dialysis services - hemodialysis sessions (12 sessions)',
    billedAmount: 7200.00,
    allowedAmount: 5760.00,
    paidAmount: 0,
    memberResponsibility: 0,
    processedBy: null,
    processedDate: null,
    notes: 'Monthly dialysis claim for 12 sessions. Awaiting medical review.',
    createdAt: '2024-06-05T08:00:00.000Z',
    updatedAt: '2024-06-05T08:00:00.000Z',
  },
  {
    id: CLAIM_IDS.CLAIM_7,
    claimNumber: 'CLM-2024-000007',
    memberId: MEMBER_IDS.MEMBER_1,
    providerId: PROVIDER_IDS.PROVIDER_1,
    enrollmentId: ENROLLMENT_IDS.ENROLL_1,
    status: CLAIM_STATUSES.PAID,
    serviceDate: '2024-05-15',
    submissionDate: '2024-05-20',
    diagnosisCodes: ['E11.9', 'E11.42'],
    serviceDescription: 'Endocrinology follow-up - diabetic polyneuropathy evaluation',
    billedAmount: 420.00,
    allowedAmount: 340.00,
    paidAmount: 340.00,
    memberResponsibility: 0,
    processedBy: USER_IDS.CLAIMS_PROCESSOR,
    processedDate: '2024-06-01',
    notes: 'Neuropathy screening completed. Gabapentin dosage adjusted.',
    createdAt: '2024-05-20T09:00:00.000Z',
    updatedAt: '2024-06-01T10:00:00.000Z',
  },
  {
    id: CLAIM_IDS.CLAIM_8,
    claimNumber: 'CLM-2024-000008',
    memberId: MEMBER_IDS.MEMBER_7,
    providerId: PROVIDER_IDS.PROVIDER_6,
    enrollmentId: ENROLLMENT_IDS.ENROLL_7,
    status: CLAIM_STATUSES.SUBMITTED,
    serviceDate: '2024-06-10',
    submissionDate: '2024-06-15',
    diagnosisCodes: ['M32.9', 'M32.10'],
    serviceDescription: 'Rheumatology visit - SLE disease activity assessment and lab work',
    billedAmount: 590.00,
    allowedAmount: 0,
    paidAmount: 0,
    memberResponsibility: 0,
    processedBy: null,
    processedDate: null,
    notes: 'Initial visit under new enrollment. Pending processing.',
    createdAt: '2024-06-15T14:00:00.000Z',
    updatedAt: '2024-06-15T14:00:00.000Z',
  },
  {
    id: CLAIM_IDS.CLAIM_9,
    claimNumber: 'CLM-2024-000009',
    memberId: MEMBER_IDS.MEMBER_2,
    providerId: PROVIDER_IDS.PROVIDER_2,
    enrollmentId: ENROLLMENT_IDS.ENROLL_2,
    status: CLAIM_STATUSES.DENIED,
    serviceDate: '2024-05-20',
    submissionDate: '2024-05-25',
    diagnosisCodes: ['I50.22'],
    serviceDescription: 'Cardiac MRI - advanced imaging',
    billedAmount: 2800.00,
    allowedAmount: 0,
    paidAmount: 0,
    memberResponsibility: 0,
    processedBy: USER_IDS.CLAIMS_PROCESSOR,
    processedDate: '2024-06-05',
    notes: 'Denied - prior authorization not obtained. Member may appeal.',
    createdAt: '2024-05-25T10:00:00.000Z',
    updatedAt: '2024-06-05T16:00:00.000Z',
  },
  {
    id: CLAIM_IDS.CLAIM_10,
    claimNumber: 'CLM-2024-000010',
    memberId: MEMBER_IDS.MEMBER_3,
    providerId: PROVIDER_IDS.PROVIDER_3,
    enrollmentId: ENROLLMENT_IDS.ENROLL_3,
    status: CLAIM_STATUSES.PARTIALLY_APPROVED,
    serviceDate: '2024-06-08',
    submissionDate: '2024-06-12',
    diagnosisCodes: ['J44.9', 'J43.9'],
    serviceDescription: 'Pulmonary rehabilitation program - 10 sessions',
    billedAmount: 1500.00,
    allowedAmount: 1000.00,
    paidAmount: 800.00,
    memberResponsibility: 200.00,
    processedBy: USER_IDS.CLAIMS_PROCESSOR,
    processedDate: '2024-06-22',
    notes: 'Partially approved - 8 of 10 sessions approved per benefit limits.',
    createdAt: '2024-06-12T11:00:00.000Z',
    updatedAt: '2024-06-22T13:00:00.000Z',
  },
]);

// ─── Care Management Events ─────────────────────────────────────────────────

/**
 * @typedef {Object} SeedCareEvent
 * @property {string} id - Unique event identifier
 * @property {string} memberId - Member ID
 * @property {string} eventType - Event type from CARE_MANAGEMENT_EVENTS
 * @property {string} eventDate - Event date (YYYY-MM-DD)
 * @property {string} performedBy - User ID who performed the event
 * @property {string} providerId - Associated provider ID
 * @property {string} summary - Event summary
 * @property {string} details - Detailed notes
 * @property {string|null} followUpDate - Follow-up date or null
 * @property {string} status - Event status
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/** @type {SeedCareEvent[]} */
export const SEED_CARE_EVENTS = Object.freeze([
  {
    id: CARE_EVENT_IDS.EVENT_1,
    memberId: MEMBER_IDS.MEMBER_1,
    eventType: CARE_MANAGEMENT_EVENTS.ASSESSMENT,
    eventDate: '2024-01-20',
    performedBy: USER_IDS.CARE_MANAGER_1,
    providerId: PROVIDER_IDS.PROVIDER_1,
    summary: 'Initial health risk assessment for diabetes management',
    details: 'Completed comprehensive HRA. Member has Type 2 diabetes with hyperglycemia. A1C at 7.8%. Currently on metformin and glipizide. No diabetic retinopathy or nephropathy at this time. BMI 31.2. Discussed diet and exercise goals.',
    followUpDate: '2024-02-20',
    status: 'completed',
    createdAt: '2024-01-20T10:00:00.000Z',
    updatedAt: '2024-01-20T11:30:00.000Z',
  },
  {
    id: CARE_EVENT_IDS.EVENT_2,
    memberId: MEMBER_IDS.MEMBER_1,
    eventType: CARE_MANAGEMENT_EVENTS.CARE_PLAN_CREATED,
    eventDate: '2024-01-25',
    performedBy: USER_IDS.CARE_MANAGER_1,
    providerId: PROVIDER_IDS.PROVIDER_1,
    summary: 'Individualized care plan created for diabetes management',
    details: 'Care plan goals: (1) Reduce A1C to below 7.0% within 6 months, (2) Achieve weight loss of 10 lbs in 3 months, (3) Complete annual diabetic eye exam, (4) Monthly blood glucose monitoring. Interventions include nutrition counseling, medication adherence support, and quarterly endocrinology visits.',
    followUpDate: '2024-04-25',
    status: 'completed',
    createdAt: '2024-01-25T14:00:00.000Z',
    updatedAt: '2024-01-25T15:00:00.000Z',
  },
  {
    id: CARE_EVENT_IDS.EVENT_3,
    memberId: MEMBER_IDS.MEMBER_2,
    eventType: CARE_MANAGEMENT_EVENTS.ASSESSMENT,
    eventDate: '2024-01-22',
    performedBy: USER_IDS.CARE_MANAGER_1,
    providerId: PROVIDER_IDS.PROVIDER_2,
    summary: 'Initial health risk assessment for heart failure management',
    details: 'Completed HRA. Member has chronic systolic heart failure with EF 35%. On lisinopril, carvedilol, and furosemide. Reports occasional dyspnea on exertion. Weight stable at 195 lbs. Daily weight monitoring discussed. Fall risk assessment completed - moderate risk.',
    followUpDate: '2024-02-22',
    status: 'completed',
    createdAt: '2024-01-22T09:00:00.000Z',
    updatedAt: '2024-01-22T10:30:00.000Z',
  },
  {
    id: CARE_EVENT_IDS.EVENT_4,
    memberId: MEMBER_IDS.MEMBER_2,
    eventType: CARE_MANAGEMENT_EVENTS.PHONE_CALL,
    eventDate: '2024-03-15',
    performedBy: USER_IDS.CARE_MANAGER_1,
    providerId: PROVIDER_IDS.PROVIDER_2,
    summary: 'Monthly follow-up call - heart failure symptom check',
    details: 'Member reports stable symptoms. Weight within 2 lbs of baseline. No ER visits or hospitalizations since last contact. Medication adherence confirmed. Reminded about upcoming cardiology appointment on 3/25.',
    followUpDate: '2024-04-15',
    status: 'completed',
    createdAt: '2024-03-15T11:00:00.000Z',
    updatedAt: '2024-03-15T11:30:00.000Z',
  },
  {
    id: CARE_EVENT_IDS.EVENT_5,
    memberId: MEMBER_IDS.MEMBER_3,
    eventType: CARE_MANAGEMENT_EVENTS.CARE_PLAN_CREATED,
    eventDate: '2024-02-15',
    performedBy: USER_IDS.CARE_MANAGER_2,
    providerId: PROVIDER_IDS.PROVIDER_3,
    summary: 'Care plan created for COPD management',
    details: 'Care plan goals: (1) Reduce COPD exacerbations to fewer than 2 per year, (2) Complete pulmonary rehabilitation program, (3) Smoking cessation support, (4) Annual flu and pneumonia vaccinations. Member currently uses albuterol and tiotropium inhalers. Oxygen saturation at rest 94%.',
    followUpDate: '2024-05-15',
    status: 'completed',
    createdAt: '2024-02-15T13:00:00.000Z',
    updatedAt: '2024-02-15T14:30:00.000Z',
  },
  {
    id: CARE_EVENT_IDS.EVENT_6,
    memberId: MEMBER_IDS.MEMBER_4,
    eventType: CARE_MANAGEMENT_EVENTS.PROVIDER_COORDINATION,
    eventDate: '2024-04-01',
    performedBy: USER_IDS.CARE_MANAGER_2,
    providerId: PROVIDER_IDS.PROVIDER_4,
    summary: 'Coordination with nephrologist regarding dialysis preparation',
    details: 'Spoke with Dr. Kim regarding member\'s declining GFR (now at 22). Discussed AV fistula placement timeline. Nephrologist recommends vascular surgery consult within 30 days. Dietitian referral placed for renal diet education. Member and family to be counseled on dialysis options.',
    followUpDate: '2024-05-01',
    status: 'completed',
    createdAt: '2024-04-01T10:00:00.000Z',
    updatedAt: '2024-04-01T11:00:00.000Z',
  },
  {
    id: CARE_EVENT_IDS.EVENT_7,
    memberId: MEMBER_IDS.MEMBER_5,
    eventType: CARE_MANAGEMENT_EVENTS.HOME_VISIT,
    eventDate: '2024-05-01',
    performedBy: USER_IDS.CARE_MANAGER_1,
    providerId: PROVIDER_IDS.PROVIDER_5,
    summary: 'Home safety assessment for Alzheimer\'s patient',
    details: 'Conducted home visit with member and daughter (primary caregiver). Assessed home safety: recommended grab bars in bathroom, removal of throw rugs, improved lighting in hallways. Member oriented to person only. Caregiver reports increased wandering behavior. Discussed adult day care options and respite care resources.',
    followUpDate: '2024-06-01',
    status: 'completed',
    createdAt: '2024-05-01T14:00:00.000Z',
    updatedAt: '2024-05-01T16:00:00.000Z',
  },
  {
    id: CARE_EVENT_IDS.EVENT_8,
    memberId: MEMBER_IDS.MEMBER_6,
    eventType: CARE_MANAGEMENT_EVENTS.TRANSITION_OF_CARE,
    eventDate: '2024-05-20',
    performedBy: USER_IDS.CARE_MANAGER_2,
    providerId: PROVIDER_IDS.PROVIDER_4,
    summary: 'Hospital discharge follow-up - AV fistula placement',
    details: 'Member discharged from hospital after AV fistula placement surgery. Surgical site healing well. Dialysis to begin in 6-8 weeks after fistula maturation. Home health nursing ordered for wound care. Medication reconciliation completed. Follow-up with nephrologist in 1 week.',
    followUpDate: '2024-05-27',
    status: 'completed',
    createdAt: '2024-05-20T09:00:00.000Z',
    updatedAt: '2024-05-20T10:30:00.000Z',
  },
  {
    id: CARE_EVENT_IDS.EVENT_9,
    memberId: MEMBER_IDS.MEMBER_7,
    eventType: CARE_MANAGEMENT_EVENTS.MEDICATION_REVIEW,
    eventDate: '2024-06-05',
    performedBy: USER_IDS.CARE_MANAGER_1,
    providerId: PROVIDER_IDS.PROVIDER_6,
    summary: 'Medication review for SLE management',
    details: 'Reviewed current medication regimen: hydroxychloroquine 200mg BID, prednisone 10mg daily, mycophenolate 500mg BID. Member reports joint pain improvement but ongoing fatigue. Discussed importance of sun protection and medication adherence. No adverse effects reported. Lab work ordered for next rheumatology visit.',
    followUpDate: '2024-07-05',
    status: 'completed',
    createdAt: '2024-06-05T11:00:00.000Z',
    updatedAt: '2024-06-05T12:00:00.000Z',
  },
  {
    id: CARE_EVENT_IDS.EVENT_10,
    memberId: MEMBER_IDS.MEMBER_8,
    eventType: CARE_MANAGEMENT_EVENTS.REFERRAL_MADE,
    eventDate: '2024-06-15',
    performedBy: USER_IDS.CARE_MANAGER_2,
    providerId: PROVIDER_IDS.PROVIDER_3,
    summary: 'Oncology referral for lung cancer treatment coordination',
    details: 'Referral placed to oncology for treatment planning. Member diagnosed with non-small cell lung cancer, stage IIIA. Pulmonologist recommends multidisciplinary tumor board review. Palliative care consultation also recommended. Member expressed preference for treatment close to home. Exploring clinical trial eligibility.',
    followUpDate: '2024-06-25',
    status: 'completed',
    createdAt: '2024-06-15T15:00:00.000Z',
    updatedAt: '2024-06-15T16:00:00.000Z',
  },
]);

// ─── Users ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SeedUser
 * @property {string} id - Unique user identifier
 * @property {string} username - Username
 * @property {string} firstName - First name
 * @property {string} lastName - Last name
 * @property {string} email - Email address
 * @property {string} role - User role from USER_ROLES
 * @property {boolean} active - Whether user is active
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/** @type {SeedUser[]} */
export const SEED_USERS = Object.freeze([
  {
    id: USER_IDS.ADMIN,
    username: 'admin',
    firstName: 'System',
    lastName: 'Administrator',
    email: 'admin@csnpportal.example.com',
    role: USER_ROLES.ADMIN,
    active: true,
    createdAt: '2023-10-01T08:00:00.000Z',
    updatedAt: '2024-01-01T08:00:00.000Z',
  },
  {
    id: USER_IDS.CARE_MANAGER_1,
    username: 'jsmith_cm',
    firstName: 'Jessica',
    lastName: 'Smith',
    email: 'jessica.smith@csnpportal.example.com',
    role: USER_ROLES.CARE_MANAGER,
    active: true,
    createdAt: '2023-10-15T09:00:00.000Z',
    updatedAt: '2024-03-01T10:00:00.000Z',
  },
  {
    id: USER_IDS.CARE_MANAGER_2,
    username: 'tlee_cm',
    firstName: 'Thomas',
    lastName: 'Lee',
    email: 'thomas.lee@csnpportal.example.com',
    role: USER_ROLES.CARE_MANAGER,
    active: true,
    createdAt: '2023-10-15T09:00:00.000Z',
    updatedAt: '2024-02-15T11:00:00.000Z',
  },
  {
    id: USER_IDS.CLAIMS_PROCESSOR,
    username: 'mwilson_cp',
    firstName: 'Maria',
    lastName: 'Wilson',
    email: 'maria.wilson@csnpportal.example.com',
    role: USER_ROLES.CLAIMS_PROCESSOR,
    active: true,
    createdAt: '2023-11-01T08:00:00.000Z',
    updatedAt: '2024-04-01T09:00:00.000Z',
  },
  {
    id: USER_IDS.ENROLLMENT_SPEC,
    username: 'kbrown_es',
    firstName: 'Kevin',
    lastName: 'Brown',
    email: 'kevin.brown@csnpportal.example.com',
    role: USER_ROLES.ENROLLMENT_SPECIALIST,
    active: true,
    createdAt: '2023-11-01T08:00:00.000Z',
    updatedAt: '2024-05-01T10:00:00.000Z',
  },
  {
    id: USER_IDS.AUDITOR,
    username: 'rjones_aud',
    firstName: 'Rachel',
    lastName: 'Jones',
    email: 'rachel.jones@csnpportal.example.com',
    role: USER_ROLES.AUDITOR,
    active: true,
    createdAt: '2023-12-01T08:00:00.000Z',
    updatedAt: '2024-06-01T08:00:00.000Z',
  },
  {
    id: USER_IDS.MEMBER_1,
    username: 'mthompson',
    firstName: 'Margaret',
    lastName: 'Thompson',
    email: 'margaret.thompson@example.com',
    role: USER_ROLES.MEMBER,
    memberId: MEMBER_IDS.MEMBER_1,
    active: true,
    createdAt: '2024-01-10T08:30:00.000Z',
    updatedAt: '2024-06-15T14:22:00.000Z',
  },
  {
    id: USER_IDS.MEMBER_2,
    username: 'rgarcia',
    firstName: 'Robert',
    lastName: 'Garcia',
    email: 'robert.garcia@example.com',
    role: USER_ROLES.MEMBER,
    memberId: MEMBER_IDS.MEMBER_2,
    active: true,
    createdAt: '2024-01-12T09:00:00.000Z',
    updatedAt: '2024-05-20T10:00:00.000Z',
  },
]);

// ─── Audit Logs ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SeedAuditLog
 * @property {string} id - Unique audit log identifier
 * @property {string} action - Audit action from AUDIT_ACTIONS
 * @property {string} userId - User who performed the action
 * @property {string} targetType - Type of entity affected
 * @property {string} targetId - ID of entity affected
 * @property {string} description - Human-readable description
 * @property {Object|null} metadata - Additional metadata
 * @property {string} ipAddress - IP address
 * @property {string} timestamp - ISO timestamp
 */

/** @type {SeedAuditLog[]} */
export const SEED_AUDIT_LOGS = Object.freeze([
  {
    id: 'al1a1b2c-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
    action: AUDIT_ACTIONS.LOGIN,
    userId: USER_IDS.ADMIN,
    targetType: 'session',
    targetId: USER_IDS.ADMIN,
    description: 'System Administrator logged in',
    metadata: { userAgent: 'Mozilla/5.0' },
    ipAddress: '192.168.1.100',
    timestamp: '2024-01-10T08:00:00.000Z',
  },
  {
    id: 'al2b2c3d-e5f6-4a7b-9c8d-0e1f2a3b4c5d',
    action: AUDIT_ACTIONS.ENROLL,
    userId: USER_IDS.ENROLLMENT_SPEC,
    targetType: 'enrollment',
    targetId: ENROLLMENT_IDS.ENROLL_1,
    description: 'Enrollment approved for member Margaret Thompson (APP-2024-00001)',
    metadata: { memberId: MEMBER_IDS.MEMBER_1, planType: PLAN_TYPES.C_SNP },
    ipAddress: '192.168.1.105',
    timestamp: '2023-12-01T14:00:00.000Z',
  },
  {
    id: 'al3c3d4e-f6a7-4b8c-0d9e-1f2a3b4c5d6e',
    action: AUDIT_ACTIONS.ENROLL,
    userId: USER_IDS.ENROLLMENT_SPEC,
    targetType: 'enrollment',
    targetId: ENROLLMENT_IDS.ENROLL_2,
    description: 'Enrollment approved for member Robert Garcia (APP-2024-00002)',
    metadata: { memberId: MEMBER_IDS.MEMBER_2, planType: PLAN_TYPES.C_SNP },
    ipAddress: '192.168.1.105',
    timestamp: '2023-12-05T09:00:00.000Z',
  },
  {
    id: 'al4d4e5f-a7b8-4c9d-1e0f-2a3b4c5d6e7f',
    action: AUDIT_ACTIONS.CARE_PLAN_CREATE,
    userId: USER_IDS.CARE_MANAGER_1,
    targetType: 'care_plan',
    targetId: CARE_EVENT_IDS.EVENT_2,
    description: 'Care plan created for member Margaret Thompson - diabetes management',
    metadata: { memberId: MEMBER_IDS.MEMBER_1, conditionCategory: CONDITION_CATEGORIES.DIABETES },
    ipAddress: '192.168.1.102',
    timestamp: '2024-01-25T14:00:00.000Z',
  },
  {
    id: 'al5e5f6a-b8c9-4d0e-2f1a-3b4c5d6e7f8a',
    action: AUDIT_ACTIONS.CLAIM_APPROVE,
    userId: USER_IDS.CLAIMS_PROCESSOR,
    targetType: 'claim',
    targetId: CLAIM_IDS.CLAIM_1,
    description: 'Claim CLM-2024-000001 approved and paid for member Margaret Thompson',
    metadata: { claimNumber: 'CLM-2024-000001', paidAmount: 280.00 },
    ipAddress: '192.168.1.104',
    timestamp: '2024-03-01T14:00:00.000Z',
  },
  {
    id: 'al6f6a7b-c9d0-4e1f-3a2b-4c5d6e7f8a9b',
    action: AUDIT_ACTIONS.CLAIM_APPROVE,
    userId: USER_IDS.CLAIMS_PROCESSOR,
    targetType: 'claim',
    targetId: CLAIM_IDS.CLAIM_2,
    description: 'Claim CLM-2024-000002 approved and paid for member Robert Garcia',
    metadata: { claimNumber: 'CLM-2024-000002', paidAmount: 700.00 },
    ipAddress: '192.168.1.104',
    timestamp: '2024-03-25T11:00:00.000Z',
  },
  {
    id: 'al7a7b8c-d0e1-4f2a-4b3c-5d6e7f8a9b0c',
    action: AUDIT_ACTIONS.CLAIM_DENY,
    userId: USER_IDS.CLAIMS_PROCESSOR,
    targetType: 'claim',
    targetId: CLAIM_IDS.CLAIM_9,
    description: 'Claim CLM-2024-000009 denied for member Robert Garcia - no prior authorization',
    metadata: { claimNumber: 'CLM-2024-000009', denialReason: 'Prior authorization not obtained' },
    ipAddress: '192.168.1.104',
    timestamp: '2024-06-05T16:00:00.000Z',
  },
  {
    id: 'al8b8c9d-e1f2-4a3b-5c4d-6e7f8a9b0c1d',
    action: AUDIT_ACTIONS.REFERRAL_CREATE,
    userId: USER_IDS.CARE_MANAGER_2,
    targetType: 'referral',
    targetId: CARE_EVENT_IDS.EVENT_10,
    description: 'Oncology referral created for member Richard Brown',
    metadata: { memberId: MEMBER_IDS.MEMBER_8, referralType: 'oncology' },
    ipAddress: '192.168.1.103',
    timestamp: '2024-06-15T15:00:00.000Z',
  },
  {
    id: 'al9c9d0e-f2a3-4b4c-6d5e-7f8a9b0c1d2e',
    action: AUDIT_ACTIONS.CARE_PLAN_UPDATE,
    userId: USER_IDS.CARE_MANAGER_1,
    targetType: 'care_plan',
    targetId: CARE_EVENT_IDS.EVENT_7,
    description: 'Care plan updated for member Patricia Martinez - home safety modifications recommended',
    metadata: { memberId: MEMBER_IDS.MEMBER_5, conditionCategory: CONDITION_CATEGORIES.DEMENTIA },
    ipAddress: '192.168.1.102',
    timestamp: '2024-05-01T16:00:00.000Z',
  },
  {
    id: 'ala0d1e2-a3b4-4c5d-7e6f-8a9b0c1d2e3f',
    action: AUDIT_ACTIONS.SUBMIT,
    userId: USER_IDS.ENROLLMENT_SPEC,
    targetType: 'enrollment',
    targetId: ENROLLMENT_IDS.ENROLL_8,
    description: 'Enrollment application submitted for member Richard Brown (APP-2024-00008)',
    metadata: { memberId: MEMBER_IDS.MEMBER_8, planType: PLAN_TYPES.C_SNP, status: ENROLLMENT_STATUSES.PENDING },
    ipAddress: '192.168.1.105',
    timestamp: '2024-04-10T11:00:00.000Z',
  },
  {
    id: 'alb1e2f3-b4c5-4d6e-8f7a-9b0c1d2e3f4a',
    action: AUDIT_ACTIONS.LOGIN,
    userId: USER_IDS.CARE_MANAGER_1,
    targetType: 'session',
    targetId: USER_IDS.CARE_MANAGER_1,
    description: 'Jessica Smith logged in',
    metadata: { userAgent: 'Mozilla/5.0' },
    ipAddress: '192.168.1.102',
    timestamp: '2024-06-15T08:00:00.000Z',
  },
  {
    id: 'alc2f3a4-c5d6-4e7f-9a8b-0c1d2e3f4a5b',
    action: AUDIT_ACTIONS.EXPORT,
    userId: USER_IDS.AUDITOR,
    targetType: 'report',
    targetId: 'rpt-claims-q2-2024',
    description: 'Q2 2024 claims report exported by auditor',
    metadata: { reportType: 'claims_summary', quarter: 'Q2', year: 2024 },
    ipAddress: '192.168.1.106',
    timestamp: '2024-07-01T10:00:00.000Z',
  },
]);

// ─── Referrals ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SeedReferral
 * @property {string} id - Unique referral identifier
 * @property {string} memberId - Member ID
 * @property {string} referringProviderId - Referring provider ID
 * @property {string} receivingProviderId - Receiving provider ID
 * @property {string} status - Referral status
 * @property {string} reason - Reason for referral
 * @property {string} urgency - Urgency level
 * @property {string[]} diagnosisCodes - Related ICD-10 codes
 * @property {string} referralDate - Referral date (YYYY-MM-DD)
 * @property {string|null} expirationDate - Expiration date or null
 * @property {string} notes - Referral notes
 * @property {string} createdBy - User ID who created the referral
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/** @type {SeedReferral[]} */
export const SEED_REFERRALS = Object.freeze([
  {
    id: 'rf1a1b2c-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
    memberId: MEMBER_IDS.MEMBER_4,
    referringProviderId: PROVIDER_IDS.PROVIDER_4,
    receivingProviderId: PROVIDER_IDS.PROVIDER_2,
    status: REFERRAL_STATUSES.COMPLETED,
    reason: 'Vascular surgery consult for AV fistula placement prior to dialysis initiation',
    urgency: 'urgent',
    diagnosisCodes: ['N18.4', 'N18.5'],
    referralDate: '2024-04-05',
    expirationDate: '2024-07-05',
    notes: 'GFR declining. Fistula placement needed within 30 days for dialysis preparation.',
    createdBy: USER_IDS.CARE_MANAGER_2,
    createdAt: '2024-04-05T10:00:00.000Z',
    updatedAt: '2024-05-15T14:00:00.000Z',
  },
  {
    id: 'rf2b2c3d-e5f6-4a7b-9c8d-0e1f2a3b4c5d',
    memberId: MEMBER_IDS.MEMBER_5,
    referringProviderId: PROVIDER_IDS.PROVIDER_5,
    receivingProviderId: PROVIDER_IDS.PROVIDER_1,
    status: REFERRAL_STATUSES.ACCEPTED,
    reason: 'Occupational therapy evaluation for cognitive decline and ADL support',
    urgency: 'routine',
    diagnosisCodes: ['G30.1', 'F02.80'],
    referralDate: '2024-05-10',
    expirationDate: '2024-08-10',
    notes: 'Member showing progressive cognitive decline. OT evaluation for home safety and ADL strategies.',
    createdBy: USER_IDS.CARE_MANAGER_1,
    createdAt: '2024-05-10T11:00:00.000Z',
    updatedAt: '2024-05-20T09:00:00.000Z',
  },
  {
    id: 'rf3c3d4e-f6a7-4b8c-0d9e-1f2a3b4c5d6e',
    memberId: MEMBER_IDS.MEMBER_8,
    referringProviderId: PROVIDER_IDS.PROVIDER_3,
    receivingProviderId: PROVIDER_IDS.PROVIDER_2,
    status: REFERRAL_STATUSES.PENDING,
    reason: 'Oncology consultation for non-small cell lung cancer treatment planning',
    urgency: 'urgent',
    diagnosisCodes: ['C34.90'],
    referralDate: '2024-06-15',
    expirationDate: '2024-09-15',
    notes: 'Stage IIIA NSCLC. Multidisciplinary tumor board review recommended. Exploring clinical trial eligibility.',
    createdBy: USER_IDS.CARE_MANAGER_2,
    createdAt: '2024-06-15T15:00:00.000Z',
    updatedAt: '2024-06-15T15:00:00.000Z',
  },
  {
    id: 'rf4d4e5f-a7b8-4c9d-1e0f-2a3b4c5d6e7f',
    memberId: MEMBER_IDS.MEMBER_1,
    referringProviderId: PROVIDER_IDS.PROVIDER_1,
    receivingProviderId: PROVIDER_IDS.PROVIDER_5,
    status: REFERRAL_STATUSES.COMPLETED,
    reason: 'Ophthalmology referral for annual diabetic retinopathy screening',
    urgency: 'routine',
    diagnosisCodes: ['E11.9', 'E11.319'],
    referralDate: '2024-02-20',
    expirationDate: '2024-05-20',
    notes: 'Annual diabetic eye exam per care plan. No prior retinopathy documented.',
    createdBy: USER_IDS.CARE_MANAGER_1,
    createdAt: '2024-02-20T10:00:00.000Z',
    updatedAt: '2024-03-15T11:00:00.000Z',
  },
]);

// ─── localStorage Keys for Seed Data ────────────────────────────────────────

const SEED_STORAGE_KEYS = Object.freeze({
  MEMBERS: 'csnp_members',
  PROVIDERS: 'csnp_providers',
  BENEFIT_PACKAGES: 'csnp_benefit_packages',
  ENROLLMENTS: 'csnp_enrollments',
  CLAIMS: 'csnp_claims',
  CARE_EVENTS: 'csnp_care_events',
  USERS: 'csnp_users',
  AUDIT_LOGS: 'csnp_audit_logs',
  REFERRALS: 'csnp_referrals',
  SEED_INITIALIZED: 'csnp_seed_initialized',
  SEED_VERSION: 'csnp_seed_version',
});

/**
 * Seed data schema version. Bump this whenever seed record shapes change
 * (e.g. a new field is added) so existing browsers re-seed on next load
 * instead of silently keeping stale data.
 * @type {string}
 */
export const SEED_VERSION = '2';

/**
 * Checks whether the current seed-data version has been loaded into localStorage.
 * @returns {boolean}
 */
export function isSeedDataInitialized() {
  return localStorage.getItem(SEED_STORAGE_KEYS.SEED_VERSION) === SEED_VERSION;
}

/**
 * Loads all seed data into localStorage.
 * Only runs if seed data has not been previously initialized.
 * @param {boolean} [force=false] - Force re-initialization even if already seeded
 * @returns {boolean} Whether seed data was loaded
 */
export function initializeSeedData(force = false) {
  if (!force && isSeedDataInitialized()) {
    return false;
  }

  try {
    localStorage.setItem(SEED_STORAGE_KEYS.MEMBERS, JSON.stringify(SEED_MEMBERS));
    localStorage.setItem(SEED_STORAGE_KEYS.PROVIDERS, JSON.stringify(SEED_PROVIDERS));
    localStorage.setItem(SEED_STORAGE_KEYS.BENEFIT_PACKAGES, JSON.stringify(SEED_BENEFIT_PACKAGES));
    localStorage.setItem(SEED_STORAGE_KEYS.ENROLLMENTS, JSON.stringify(SEED_ENROLLMENTS));
    localStorage.setItem(SEED_STORAGE_KEYS.CLAIMS, JSON.stringify(SEED_CLAIMS));
    localStorage.setItem(SEED_STORAGE_KEYS.CARE_EVENTS, JSON.stringify(SEED_CARE_EVENTS));
    localStorage.setItem(SEED_STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
    localStorage.setItem(SEED_STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(SEED_AUDIT_LOGS));
    localStorage.setItem(SEED_STORAGE_KEYS.REFERRALS, JSON.stringify(SEED_REFERRALS));
    localStorage.setItem(SEED_STORAGE_KEYS.SEED_INITIALIZED, 'true');
    localStorage.setItem(SEED_STORAGE_KEYS.SEED_VERSION, SEED_VERSION);
    return true;
  } catch (error) {
    console.error('Failed to initialize seed data:', error);
    return false;
  }
}

/**
 * Retrieves a specific seed data collection from localStorage.
 * @param {string} key - One of the SEED_STORAGE_KEYS values
 * @returns {Array} Parsed array of records, or empty array on failure
 */
export function getSeedCollection(key) {
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to retrieve seed collection for key "${key}":`, error);
    return [];
  }
}

/**
 * Clears all seed data from localStorage.
 * @returns {boolean} Whether the operation succeeded
 */
export function clearSeedData() {
  try {
    Object.values(SEED_STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Failed to clear seed data:', error);
    return false;
  }
}

/**
 * Resets seed data by clearing and re-initializing.
 * @returns {boolean} Whether the operation succeeded
 */
export function resetSeedData() {
  const cleared = clearSeedData();
  if (!cleared) {
    return false;
  }
  return initializeSeedData(true);
}

export { SEED_STORAGE_KEYS };